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
            switch (msg.type) {
                case 'start':
                    updateUIState(STATE_WALKING);
                    nextNode(id);
                    break;
                case 'edit':
                    updateUIState(STATE_EDITING);
                    editWalkthrough(id);
                    break;
                case 'delete':
                    console.log('deletete');
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
};
function getWalkthrough(walkthroughID) {
    const walkthroughs = getWalkthroughsArray();
    const walkthrough = walkthroughs.find(walkthrough => walkthrough.id === walkthroughID);
    return walkthrough;
}
function getWalkthroughsArray() {
    let walkthroughsObject = getWalkthroughsObject();
    let walkthroughs = walkthroughsObject.array;
    walkthroughs = walkthroughs.filter(walkthrough => { return walkthrough !== null; });
    return walkthroughs;
}
function getWalkthroughsObject() {
    let walkthroughsObject = { array: [] };
    let page = figma.currentPage;
    const existingWalkthroughs = page.getPluginData('walkthroughs');
    if (existingWalkthroughs) {
        walkthroughsObject = JSON.parse(existingWalkthroughs);
    }
    return walkthroughsObject;
}
function updateUIState(newState) {
    console.log(currentState, "->", newState);
    // cleaning up the state we're exiting from
    if (currentState == STATE_NEW && newState == STATE_HOME) {
        figma.ui.postMessage({ type: 'editing_clear' });
        editingWalkthrough = null;
    }
    if (currentState == STATE_WALKING && newState == STATE_HOME) {
        currentWalkthrough = null;
    }
    // changing state
    currentState = newState;
    const message = { type: 'state', state: currentState };
    figma.ui.postMessage(message);
    // initializing new states
    if (newState == STATE_HOME) {
        loadWalkthroughs();
    }
    if (newState == STATE_NEW || newState == STATE_EDITING) {
        addNodesToWalkthrough(true);
    }
}
figma.on("close", function () {
    currentWalkthrough = null;
    editingWalkthrough = null;
});
function loadWalkthroughs() {
    let walkthroughs = getWalkthroughsArray();
    const message = {
        type: 'walkthrough_list',
        walkthroughs: walkthroughs
    };
    console.log('jim', message.walkthroughs);
    figma.ui.postMessage(message);
}
function nextNode(walkthroughID) {
    let page = figma.currentPage;
    const selected = page.selection;
    // not already walking through
    if (currentWalkthrough == null && walkthroughID) {
        currentWalkthrough = getWalkthrough(walkthroughID);
    }
    let nodes = currentWalkthrough.nodes;
    let newSelectionID = currentWalkthrough.nodes[0].id;
    let nextIndex = 0;
    // one selected
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
    const newSelectedNode = figma.getNodeById(newSelectionID);
    const newSelection = [newSelectedNode];
    if (newSelection[0] == null) {
        console.error('no node found');
        return;
    }
    figma.currentPage.selection = newSelection;
    figma.viewport.scrollAndZoomIntoView(newSelection);
    figma.notify((nextIndex + 1) + ' — ' + newSelectedNode.name, { timeout: 1000 });
    loadNode();
}
function loadNode() {
    let page = figma.currentPage;
    const selection = page.selection;
    if (selection.length > 0) {
        const selectedNode = selection[0];
        const note = selectedNode.getPluginData('nodeNote');
        const name = selectedNode.name;
        const message = { type: 'note', name: name, note: note };
        figma.ui.postMessage(message);
    }
}
function saveNote(note) {
    let page = figma.currentPage;
    let selected = page.selection[0];
    selected.setPluginData('nodeNote', note);
}
function editWalkthrough(walkthroughID) {
    editingWalkthrough = getWalkthrough(walkthroughID);
    const uiWalkthrough = {
        id: editingWalkthrough.id,
        name: editingWalkthrough.name,
        nodes: editingWalkthrough.nodes.map(n => {
            return { name: n.name };
        }),
    };
    const message = { type: 'editing_update', walkthrough: uiWalkthrough };
    figma.ui.postMessage(message);
}
function deleteWalkthrough(walkthroughID) {
    console.log('walkthroughID', walkthroughID);
    let walkthroughs = getWalkthroughsArray();
    console.log('walkthroughID', walkthroughID);
    walkthroughs = walkthroughs.filter(walkthrough => {
        return walkthrough.id !== walkthroughID;
    });
    console.log('ya', walkthroughs);
    let walkthroughsObject = { array: walkthroughs };
    const walkthroughsObjectJSON = JSON.stringify(walkthroughsObject);
    let page = figma.currentPage;
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);
    loadWalkthroughs();
}
// adds selected nodes into currently editing walkthrough
function addNodesToWalkthrough(suppressNotify) {
    let page = figma.currentPage;
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
        };
    }
    editingWalkthrough = walkthrough;
    const uiWalkthrough = {
        id: editingWalkthrough.id,
        name: editingWalkthrough.name,
        nodes: editingWalkthrough.nodes.map(n => {
            return { name: n.name };
        }),
    };
    const message = { type: 'editing_update', walkthrough: uiWalkthrough };
    figma.ui.postMessage(message);
}
// saves the walkthrough currently being edited to storage
function saveWalkthrough(name) {
    if (!name || name == undefined) {
        figma.notify("Please name your Walkthrough");
        return;
    }
    let page = figma.currentPage;
    let newWalkthrough = editingWalkthrough;
    newWalkthrough.name = name;
    let walkthroughsObject = getWalkthroughsObject();
    let walkthroughs = walkthroughsObject.array;
    if (currentState == STATE_EDITING) {
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
    walkthroughsObject = { array: walkthroughs };
    const walkthroughsObjectJSON = JSON.stringify(walkthroughsObject);
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);
    updateUIState(STATE_HOME);
}
// generates unique ids
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
