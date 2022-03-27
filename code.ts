/*
    UI states
*/
const STATE_HOME = 'home';
const STATE_EDITING = 'editing';
const STATE_WALKING = 'walking';
const STATE_NEW = 'new';
const STATE_NOTE = 'note';

/*
    State variables
*/
let currentWalkthrough = null;
let currentWalkthroughIndex = null;
let editingWalkthrough = null;
let editingNode = null;
let currentState = null;
let lastState = null;

/*
    Initialising UI
*/
figma.showUI(__html__);
figma.ui.resize(400,400);
updateUIState(STATE_HOME);
loadSettings();
const relaunchData = getRelaunchData();
setRelaunchData();
if (figma.command == 'create') {
    updateUIState(STATE_NEW);
}

/*
    UI message handler
*/
figma.ui.onmessage = msg => {
    switch (msg.type) {
        case 'state_home':
        case 'state_walking':
        case 'state_editing':
        case 'state_new':
        case 'state_settings':
            const newState = msg.type.substring(6, msg.type.length);
            updateUIState(newState);
            break;
        case 'add_nodes':
            addNodesToWalkthrough(false);
            break;
        case 'save_walkthrough':
            const name = msg.value;
            saveWalkthrough(name);
            break;
        case 'save_note':
            saveNote(msg.value);
            break;
        case 'save_settings':
            saveSettings(msg);
            break;
        case 'next': 
            nextNode(1, null);
            break;
        case 'previous':
            nextNode(-1, null);
            break;
        case 'exit_noting':
        case 'exit_settings':
            updateUIState(lastState);
            break;
        case 'settings_save':
            figma.ui.postMessage({type: 'settings_save'});
            break;
        case 'minimize':
            figma.ui.resize(400,40);
            break;
        case 'maximize':
            figma.ui.resize(400,400);
            break;
        case 'start':
        case 'edit':
        case 'delete':
        case 'note':
        case 'up':
        case 'down':
        case 'remove':
            const key = msg.value;
            const id = key.substring(0, key.length - 4);
            switch(msg.type) {
                case 'start':
                    updateUIState(STATE_WALKING);
                    nextNode(1, id);
                    break;
                case 'edit':
                    updateUIState(STATE_EDITING);
                    editWalkthrough(id);
                    break;
                case 'delete':
                    deleteWalkthrough(id);
                    break;
                case 'note':
                    editNodeNote(id);
                    break;
                case 'up':
                    upNode(id);
                    break;
                case 'down':
                    downNode(id);
                    break;
                case 'remove':
                    removeNode(id, true);
                    break;
            }
            break;
        default:
            console.error('No onmessage handler.');
            return;
    }
}

/*
    Navigation
*/
function updateUIState(newState) {
    // cleaning up the state we're exiting from
    if ((currentState == STATE_NEW || currentState == STATE_EDITING) && newState == STATE_HOME) {
        figma.ui.postMessage({type: 'editing_clear'});
        editingWalkthrough = null;
    }
    if (currentState == STATE_HOME && newState == STATE_NEW) {
        createWalkthrough();
    }
    if (currentState == STATE_WALKING && newState == STATE_HOME) {
        currentWalkthrough = null;
    }

    // changing state
    lastState = currentState;
    currentState = newState;
    const message = {type: 'state', state: currentState};
    figma.ui.postMessage(message);

    // initializing new states
    if (newState == STATE_HOME) {
        loadWalkthroughs();
        editingWalkthrough = null;
        currentWalkthrough = null;
        currentWalkthroughIndex = null;
    }
    if (lastState == STATE_NOTE && (newState == STATE_EDITING || newState == STATE_NEW)) {
        editingNode = null;
        updateEditingNodes(false);
    }
}

figma.on("close", function() {
    currentWalkthrough = null;
    editingWalkthrough = null;
    currentWalkthroughIndex = null;
})

/*
    Loaders
*/
function loadWalkthroughs() {
    let walkthroughs = getWalkthroughsArray();
    const message = {
        type: 'walkthrough_list', 
        walkthroughs: walkthroughs
    };
    figma.ui.postMessage(message);
}

function updateEditingNodes(scroll) {
    let nodes = editingWalkthrough.nodes;
    let filteredNodes = nodes.filter((n) => {
        if (figma.getNodeById(n.id) == null) {
            removeNode(n.id, false);
            return false;
        }
        return true;
    });
    let uiWalkthrough = {
        id: editingWalkthrough.id,
        name: editingWalkthrough.name,
        nodes: filteredNodes.map(n => {
            let node = figma.getNodeById(n.id);
            return {id: node.id, name: node.name};
        }),
    };
    const message = {
        type: 'editing_update',
        state: currentState,
        scroll: scroll,
        walkthrough: uiWalkthrough};
    figma.ui.postMessage(message);
}

function loadNode() {
    let page = figma.currentPage;
    const selection = page.selection;
    const walkthrough = currentWalkthrough ?
        currentWalkthrough : editingWalkthrough;
    if (selection.length > 0) {
        const selectedNode = selection[0];
        const note = selectedNode.getPluginData(walkthrough.id);
        const name = selectedNode.name;
        const selectedRecord = walkthrough.nodes.find(node => 
            node.id == selectedNode.id);
        const position = walkthrough.nodes.indexOf(selectedRecord) + 1;
        const message = {
            type: 'note',
            id: selectedNode.id,
            name: name,
            position: position,
            note: note
        };
        figma.ui.postMessage(message);
    }
}

/*
    Walking through, saving notes
*/
function nextNode(direction, walkthroughID) {
    let page = figma.currentPage;
    const selected = page.selection;
    // if not walking through and started walkthrough first thingy has been deleted
    // not already walking through
    if (currentWalkthrough == null && walkthroughID) {
        currentWalkthrough = getWalkthrough(walkthroughID);
    }
    let nodes = currentWalkthrough.nodes;
    let nextIndex = 0;
    let newSelectionID = currentWalkthrough.nodes[nextIndex].id;
    let looping = null;
    // one selected, goes to next node
    if (walkthroughID == null) {
        if (currentWalkthroughIndex !== null) {
            nextIndex = currentWalkthroughIndex + direction;
        }
        else if (selected.length == 1) {
            const selectedNodeID = selected[0].id; 
            const selectedNode = nodes.find(node => node.id == selectedNodeID);
            const selectedNodeIndex = nodes.indexOf(selectedNode);
            nextIndex = selectedNodeIndex + direction;
        }
        else {
            console.error('Lost in the index.');
        }
        // looping
        if (direction == 1 && nextIndex >= nodes.length) {
            nextIndex = 0;
            looping = ' (looping)';
        }
        if (direction == -1 && nextIndex < 0) {
            nextIndex = nodes.length - 1;
            looping = ' (looping)';
        }
        newSelectionID = nodes[nextIndex].id;
    }
    let newSelectedNode = figma.getNodeById(newSelectionID)
    if (newSelectedNode == null) {
        // node has been deleted
        removeNode(newSelectionID, false);
        saveWalkthrough(currentWalkthrough.name);
        nextIndex = nextIndex + 1;
        if (direction == 1 && nextIndex >= nodes.length) {
            nextIndex = 0;
        }
        if (direction == -1 && nextIndex < 0) {
            nextIndex = nodes.length - 1;
        }
        newSelectionID = nodes[nextIndex].id;
        newSelectedNode = figma.getNodeById(newSelectionID);
        if (newSelectedNode == null) {
            deleteWalkthrough(currentWalkthrough.id);
            updateUIState(STATE_HOME);
            return;
        }
    }
    const newSelection = [newSelectedNode];
    figma.currentPage.selection = newSelection;
    figma.viewport.scrollAndZoomIntoView(newSelection);
    const name = newSelectedNode.name;
    const notification = (nextIndex + 1) + ' — ' + name + (looping ? looping : '');
    figma.notify(notification, {timeout: 1000});
    currentWalkthroughIndex = nextIndex;
    loadNode();
}

/*
    Editing, saving notes
*/
function editNodeNote(nodeID) {
    editingNode = figma.getNodeById(nodeID);
    const walkthrough = (currentState == STATE_WALKING) ? 
        currentWalkthrough : editingWalkthrough;
    const note = editingNode.getPluginData(walkthrough.id);
    const name = editingNode.name;
    const selectedRecord = walkthrough.nodes.find(node => 
        node.id == editingNode.id);
    const position = walkthrough.nodes.indexOf(selectedRecord) + 1;
    const message = {
        type: 'noting',
        id: nodeID,
        name: name,
        position: position,
        note: note
    };
    updateUIState(STATE_NOTE);
    figma.ui.postMessage(message);
}

function saveNote(note) {
    const walkthroughID = currentWalkthrough ? currentWalkthrough.id : editingWalkthrough.id;
    editingNode.setPluginData(walkthroughID, note);
    updateUIState(lastState);
    editingNode = null;
    loadNode();
}

/*
    Creating, editing, deleting walkthroughs
*/
function createWalkthrough() {
    editingWalkthrough = {
        id: uuidv4(),
        name: null,
        nodes: [],
    };
    addNodesToWalkthrough(true);
    updateEditingNodes(false);
}

function addNodesToWalkthrough(suppressNotify) {
    let page =figma.currentPage;
    const selected = page.selection;
    // no objects selected
    if (selected.length == 0) {
        if (!suppressNotify) {
            figma.notify('Please select some objects', {timeout: 1000});
        }
        return;
    }
    let walkthrough = editingWalkthrough;
    const currentNodes = walkthrough.nodes;
    const newNodes = selected.filter(node => currentNodes.indexOf(node) == -1);
    const dupeNodes = selected.filter(node => currentNodes.indexOf(node) !== -1);
    const dupLen = dupeNodes.length;
    if (dupLen > 0) {
        const message = (dupLen > 1) ? 
            dupLen + ' elements already in walkthrough' : dupeNodes[0].name + ' already in walkthrough';
        figma.notify(message, {timeout: 1000});
    }
    walkthrough.nodes = [...currentNodes, ...newNodes];
    editingWalkthrough = walkthrough;
    updateEditingNodes(true);
}

function upNode(nodeID) {
    let walkthrough = editingWalkthrough;
    let nodes = walkthrough.nodes;
    let node = nodes.find(node => node.id == nodeID);
    const currentIndex = nodes.indexOf(node);
    if (currentIndex == 0) {
        figma.notify('Already at the start', {timeout: 1000});
    }
    const newIndex = currentIndex - 1;
    const before = nodes.filter((n, i) => (n.id !== nodeID && i < newIndex));
    const after = nodes.filter((n, i) => (n.id !== nodeID && i >= newIndex));
    walkthrough.nodes = [...before, node, ...after];
    editingWalkthrough = walkthrough;
    updateEditingNodes(false);
}

function downNode(nodeID) {
    let walkthrough = editingWalkthrough;
    let nodes = walkthrough.nodes;
    let node = nodes.find(node => node.id == nodeID);
    const currentIndex = nodes.indexOf(node);
    if (currentIndex == (nodes.length - 1)) {
        figma.notify('Already at the end', {timeout: 1000});
    }
    const newIndex = currentIndex + 1;
    const before = nodes.filter((n, i) => (n.id !== nodeID && i <= newIndex));
    const after = nodes.filter((n, i) => (n.id !== nodeID && i > newIndex));
    walkthrough.nodes = [...before, node, ...after];
    editingWalkthrough = walkthrough;
    updateEditingNodes(false);
}

function removeNode(nodeID, updateNodes) {
    let walkthrough = (currentState == STATE_WALKING) ? currentWalkthrough : editingWalkthrough;
    let nodes = walkthrough.nodes;
    nodes = nodes.filter(node => node.id !== nodeID);
    walkthrough.nodes = nodes;
    if (currentState == STATE_WALKING) {
        currentWalkthrough = walkthrough;
    }
    else {
         editingWalkthrough = walkthrough;
         if (updateNodes == true) {
            updateEditingNodes(false);
         }
    }
}

function saveSettings(msg) {
    let settings = { color: msg.color };
    let page = figma.currentPage;
    const settingsJSON = JSON.stringify(settings);
    page.setPluginData('walkthroughSettings', settingsJSON);
}

function loadSettings() {
    const settingsJSON = figma.currentPage.getPluginData('walkthroughSettings');
    if (settingsJSON) {
        // more settings could be implemented in future
        const settings = JSON.parse(settingsJSON);
        figma.ui.postMessage({type: 'settings_load', color: settings.color});
    }
}

function saveWalkthrough(name) {
    let newWalkthrough = (currentState == STATE_WALKING) ? currentWalkthrough : editingWalkthrough;
    if (newWalkthrough.nodes.length == 0) {
        figma.notify('Please add some elements to your Walkthrough', {timeout: 1000});
        return;
    }
    if (!name || name == undefined) {
        figma.notify('Please name your Walkthrough', {timeout: 1000});
        return;
    }
    
    newWalkthrough.name = name;
    let walkthroughsObject = getWalkthroughsObject();
    let walkthroughs = walkthroughsObject.array;
    if (currentState == STATE_EDITING || currentState == STATE_WALKING) {
        walkthroughs = walkthroughs.map(walkthrough => {
            if (walkthrough.id == newWalkthrough.id) {
                return newWalkthrough;
            }
            return walkthrough;
        });
    }
    else {
        walkthroughs = [...walkthroughs, newWalkthrough];
    }
    walkthroughsObject = {array: walkthroughs};
    const walkthroughsObjectJSON = JSON.stringify(walkthroughsObject);
    let page = figma.currentPage;
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);
    setRelaunchData();
    if (currentState == STATE_EDITING || currentState == STATE_NEW) {
        updateUIState(STATE_HOME);
    }
    else if (currentState == STATE_WALKING) {
        currentWalkthrough = getWalkthrough(newWalkthrough.id);
    }
}

function editWalkthrough(walkthroughID) {
    editingWalkthrough = getWalkthrough(walkthroughID);
    updateEditingNodes(true);
}

function deleteWalkthrough(walkthroughID) {
    let walkthroughs = getWalkthroughsArray();
    walkthroughs = walkthroughs.filter(walkthrough => {
        return walkthrough.id !== walkthroughID;
    });
    let walkthroughsObject = {array: walkthroughs};
    const walkthroughsObjectJSON = JSON.stringify(walkthroughsObject);
    let page = figma.currentPage
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);
    setRelaunchData();
    updateUIState(STATE_HOME);
}

/*
    Helper functions
*/
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

function getWalkthrough(walkthroughID) {
    let walkthroughs = getWalkthroughsArray();
    let walkthrough = walkthroughs.find(walkthrough => walkthrough.id === walkthroughID);
    return walkthrough;
}

function getWalkthroughsArray() {
    let walkthroughsObject = getWalkthroughsObject();
    let walkthroughs = walkthroughsObject.array;
    return walkthroughs;
}

function getWalkthroughsObject() {
    let walkthroughsObject = {array: []};
    let page = figma.currentPage;
    const existingWalkthroughs = page.getPluginData('walkthroughs');
    if (existingWalkthroughs) {
        walkthroughsObject = JSON.parse(existingWalkthroughs);
    }
    return walkthroughsObject;
}

function setRelaunchData() {
    const page = figma.currentPage;
    const relaunchData = getRelaunchData();
    page.setRelaunchData(relaunchData);
}

function getRelaunchData() {
    const numberOfWalkthroughs = getWalkthroughsArray().length;
    if (numberOfWalkthroughs > 0) {
        return { create: '', relaunch: 'This document contains Walkthroughs.'}
    }
    else {
        return { create: '' }
    }
}