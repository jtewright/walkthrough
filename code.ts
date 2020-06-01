const STATE_HOME = 'home';
const STATE_EDITING = 'editing';
const STATE_WALKING = 'walking';
const STATE_NEW = 'new';

let currentWalkthrough = null;
let editingWalkthrough = null;
let currentState = null;

figma.showUI(__html__);
updateUIState(STATE_HOME);

figma.ui.onmessage = msg => {
    switch (msg.type) {
        case 'state_home':
        case 'state_walking':
        case 'state_editing':
        case 'state_new':
            const newState = msg.type.substring(6, msg.type.length);
            updateUIState(newState);
            break;
        case 'next': 
            nextNode(null);
            break;
        case 'save_note':
            saveNote(msg.value);
            break;
        case 'note_next':
            saveNote(msg.value);
            nextNode(null);
            break;
        case 'save_walkthrough':
            const name = msg.value;
            saveWalkthrough(name);
            break;
        case 'start':
        case 'edit':
        case 'delete':
        case 'up':
        case 'down':
        case 'remove':
            const key = msg.value;
            const id = key.substring(0, key.length - 4);
            switch(msg.type) {
                case 'start':
                    updateUIState(STATE_WALKING);
                    nextNode(id);
                    break;
                case 'edit':
                    updateUIState(STATE_EDITING);
                    editWalkthrough(id);
                    break;
                case 'delete':
                    deleteWalkthrough(id);
                    break;
                case 'up':
                    upNode(id);
                    break;
                case 'down':
                    downNode(id);
                    break;
                case 'remove':
                    removeNode(id);
                    break;
            }
            break;
        case 'add_nodes':
            addNodesToWalkthrough(false);
            break;
        default:
            console.error('no ts message handler');
            return;
    }
}

/*
    Navigation
*/
function updateUIState(newState) {
    // cleaning up the state we're exiting from
    if (currentState == STATE_NEW && newState == STATE_HOME) {
        figma.ui.postMessage({type: 'editing_clear'});
        editingWalkthrough = null;
    }
    if (currentState == STATE_WALKING && newState == STATE_HOME) {
        currentWalkthrough = null;
    }

    // changing state
    currentState = newState;
    const message = {type: 'state', state: currentState};
    figma.ui.postMessage(message);

    // initializing new states
    if (newState == STATE_HOME) {
        loadWalkthroughs();
        editingWalkthrough = null;
        currentWalkthrough = null;
    }
    if (newState == STATE_NEW || newState == STATE_EDITING) {
        addNodesToWalkthrough(true);
    }
}

figma.on("close", function() {
    currentWalkthrough = null;
    editingWalkthrough = null;
})

function loadWalkthroughs() {
    let walkthroughs = getWalkthroughsArray();
    const message = {
        type: 'walkthrough_list', 
        walkthroughs: walkthroughs
    };
    figma.ui.postMessage(message);
}

/*
    Walking through, saving notes
*/

function nextNode(walkthroughID) {
    let page =figma.currentPage;
    const selected = page.selection;
    // if not walking through and started walkthrough first thingy has been deleted
    // not already walking through
    if (currentWalkthrough == null && walkthroughID) {
        currentWalkthrough = getWalkthrough(walkthroughID);
    }
    let nodes = currentWalkthrough.nodes;
    let nextIndex = 0;
    let newSelectionID = currentWalkthrough.nodes[nextIndex].id;

    // one selected, goes to next node
    if (walkthroughID == null && selected.length == 1) {
        const selectedNodeID = selected[0].id;
        const selectedNode = nodes.find(node => node.id == selectedNodeID);
        const selectedNodeIndex = nodes.indexOf(selectedNode);
        nextIndex = selectedNodeIndex + 1;
        // loop
        if (nextIndex >= nodes.length) {
            nextIndex = 0;
        }
        newSelectionID = nodes[nextIndex].id;
    }
    let newSelectedNode = figma.getNodeById(newSelectionID)
    if (newSelectedNode == null) {
        // node has been deleted
        removeNode(newSelectionID);
        saveWalkthrough(currentWalkthrough.name);
        nextIndex = nextIndex + 1;
        if (nextIndex >= nodes.length) {
            nextIndex = 0;
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
    figma.notify((nextIndex + 1) + ' — ' + newSelectedNode.name, {timeout: 1000});
    loadNode();
}

function loadNode() {
    let page = figma.currentPage;
    const selection = page.selection;
    const walkthroughID = currentWalkthrough.id;
    if (selection.length > 0) {
        const selectedNode = selection[0];
        const note = selectedNode.getPluginData(walkthroughID);
        const name = selectedNode.name;
        const message = {type: 'note', name: name, note: note};
        figma.ui.postMessage(message);
    }
}

function saveNote(note) {
    let page = figma.currentPage;
    let selected = page.selection[0];
    const walkthroughID = currentWalkthrough.id;
    selected.setPluginData(walkthroughID, note);
}

/*
    Creating, editing, deleting walkthroughs
*/
function addNodesToWalkthrough(suppressNotify) {
    let page =figma.currentPage;
    const selected = page.selection;

    // no objects selected
    if (selected.length == 0) {
        if (!suppressNotify) {
            figma.notify("Please select some objects");
        }
        return;
    }

    let walkthrough = null;
    if (editingWalkthrough != null) {
        walkthrough = editingWalkthrough;
        const currentNodes = walkthrough.nodes;
        let newNodes = [];
        let dupeNodes = [];
        selected.forEach(node => {
            if (currentNodes.indexOf(node) == -1) {
                newNodes = [...newNodes, node];
            }
            else {
                dupeNodes = [...dupeNodes, node];
            }
        });
        const dupLen = dupeNodes.length;
        if (dupLen > 0) {
            const message = (dupLen > 1) ? 
                dupLen + ' elements already in walkthrough' : dupeNodes[0].name + ' already in walkthrough';
            figma.notify(message);
        }
        walkthrough.nodes = [...currentNodes, ...newNodes];
    }
    // creating a new one
    else {
        walkthrough = {
            id: uuidv4(),
            name: null,
            nodes: selected,
        }
    }
    editingWalkthrough = walkthrough;
    updateEditingNodes();
}

function updateEditingNodes() {
    let uiWalkthrough = {
        id: editingWalkthrough.id,
        name: editingWalkthrough.name,
        nodes: editingWalkthrough.nodes.map(n => {
            let node = figma.getNodeById(n.id);
            return {id: node.id, name: node.name};
        }),
    };
    const message = {type: 'editing_update', walkthrough: uiWalkthrough};
    figma.ui.postMessage(message);
}

function upNode(nodeID) {
    let walkthrough = editingWalkthrough;
    let nodes = walkthrough.nodes;
    let node = nodes.find(node => node.id == nodeID);
    const currentIndex = nodes.indexOf(node);
    if (currentIndex == 0) {
        figma.notify('Already at the start');
    }
    const newIndex = currentIndex - 1;
    let extracted = null;
    let before = [];
    let after = [];
    nodes.forEach((node, i) => {
        if (node.id == nodeID) {
            extracted = node;
            return;
        }
        else if (i < newIndex) {
            before = [...before, node];
            return;
        }
        else if (i >= newIndex) {
            after = [...after, node];
            return;
        }
    });
    walkthrough.nodes = [...before, extracted, ...after];
    editingWalkthrough = walkthrough;
    updateEditingNodes();
}

function downNode(nodeID) {
    let walkthrough = editingWalkthrough;
    let nodes = walkthrough.nodes;
    let node = nodes.find(node => node.id == nodeID);
    const currentIndex = nodes.indexOf(node);
    if (currentIndex == (nodes.length - 1)) {
        figma.notify('Already at the end');
    }
    const newIndex = currentIndex + 1;
    let extracted = null;
    let before = [];
    let after = [];
    nodes.forEach((node, i) => {
        if (node.id == nodeID) {
            extracted = node;
            return;
        }
        else if (i <= newIndex) {
            before = [...before, node];
            return;
        }
        else if (i > newIndex) {
            after = [...after, node];
            return;
        }
    });
    walkthrough.nodes = [...before, extracted, ...after];
    editingWalkthrough = walkthrough;
    updateEditingNodes();
}

function removeNode(nodeID) {
    let walkthrough = (currentState == STATE_EDITING) ? editingWalkthrough : currentWalkthrough;
    let nodes = walkthrough.nodes;
    nodes = nodes.filter(node => {
        return node.id !== nodeID;
    });
    walkthrough.nodes = nodes;
    if (currentState == STATE_EDITING) {
        editingWalkthrough = walkthrough;
        updateEditingNodes();
    }
    else {
        currentWalkthrough = walkthrough;
    }
}

function saveWalkthrough(name) {
    if (!name || name == undefined) {
        figma.notify("Please name your Walkthrough");
        return;
    }
    let page = figma.currentPage;
    let newWalkthrough = (currentState == STATE_WALKING) ? currentWalkthrough : editingWalkthrough;
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
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);
    if (currentState == STATE_EDITING || currentState == STATE_NEW) {
        updateUIState(STATE_HOME);
    }
    else if (currentState == STATE_WALKING) {
        currentWalkthrough = getWalkthrough(newWalkthrough.id);
    }
}

function editWalkthrough(walkthroughID) {
    editingWalkthrough = getWalkthrough(walkthroughID);
    updateEditingNodes();
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
    loadWalkthroughs();
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