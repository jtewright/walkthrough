const STATE_HOME = 'home';
const STATE_EDITING = 'editing';
const STATE_WALKING = 'walking';
const STATE_NEW = 'new';

let currentWalkthrough = null;
let editingWalkthrough = null;
let currentState = STATE_HOME;

figma.showUI(__html__);
updateUIState(currentState);
setTimeout(() => loadWalkthroughs(), 1000);

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
            console.log('nexting', currentWalkthrough.name);
            nextNode(currentWalkthrough.nodes);
            break;
        case 'save_note':
            saveNote(msg.value);
            break;
        case 'note_next':
            saveNote(msg.value);
            nextNode(currentWalkthrough.nodes);
            break;
        case 'save_walkthrough':
            saveWalkthrough(msg.value);
            break;
        case 'start':
        case 'edit':
            const key = msg.value;
            const walkthroughID = key.substring(0, key.length - 4);
            const walkthroughs = getWalkthroughsArray();
            const walkthrough = walkthroughs.find(walkthrough => 
                walkthrough.id === walkthroughID);
            if (msg.type == 'start') {
                currentWalkthrough = walkthrough;
                nextNode(currentWalkthrough.nodes);
            }
            else {
                //editWalkthrough(walkthrough);
            }
            break;
        case 'add_nodes':
            addNodesToWalkthrough();
            break;
        default:
            console.error('no ts message handler');
            return;
    }
}

function getWalkthroughsArray() {
    let walkthroughsObject = {array: []};
    const page = figma.currentPage;
    const currentWalkthroughs = page.getPluginData('walkthroughs');
    if (currentWalkthroughs) {
        walkthroughsObject = JSON.parse(currentWalkthroughs);
    }
    return walkthroughsObject.array;
}

function updateUIState(newState) {
    currentState = newState;
    let optObject = null;
    const message = {type: 'state', state: currentState};
    figma.ui.postMessage(message);
    if (newState = STATE_HOME) {
        loadWalkthroughs;
    }
}

function loadWalkthroughs() {
    const message = {
        type: 'walkthrough_list', 
        walkthroughs: getWalkthroughsArray()
    };
    figma.ui.postMessage(message);
}

function loadNode() {
    const page = figma.currentPage;
    const selection = page.selection;
    if (selection.length > 0) {
        const selectedNode = selection[0];
        const note = selectedNode.getPluginData('nodeNote');
        const name = selectedNode.name;
        const message = {type: 'note', name: name, note: note};
        figma.ui.postMessage(message);
    }
}

function nextNode(nodes) {
    const page = figma.currentPage;
    const selected = page.selection;
    let newSelection = [];

    // no frames
    if (nodes.length == 0) {
        figma.notify("No objects to walk through");
        return;
    }

    // one selected
    if (selected.length == 1) {
        console.log('currentNodes', nodes);
        const selectedNode = selected[0];
        const selectedIndex = nodes.indexOf(selectedNode);
        console.log('selected', selectedNode, 'selectedIndex', selectedIndex);
        let nextIndex = selectedIndex + 1;
        console.log('nextIndex', nextIndex);
        if (nextIndex >= nodes.length) {
            nextIndex = 0;
        }
        newSelection = [nodes[nextIndex]];
        console.log('newSelection', newSelection);
    }
    // many|none selected
    else {
        newSelection = [nodes[0]];
    }

    page.selection = newSelection;
    figma.viewport.scrollAndZoomIntoView(newSelection);
    loadNode();
}

function saveNote(note) {
    const page = figma.currentPage;
    const selected = page.selection[0];
    selected.setPluginData('nodeNote', note);
}

// adds selected nodes into currently editing walkthrough
function addNodesToWalkthrough() {
    const page = figma.currentPage;
    const selected = page.selection;

    // no objects selected
    if (selected.length == 0) {
        figma.notify("Please select some objects");
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
    console.log('wt to be sent to ui', editingWalkthrough);
    const uiWalkthrough = {
        id: editingWalkthrough.id,
        name: editingWalkthrough.name,
        nodes: editingWalkthrough.nodes.map(n => {
            return {name: n.name};
        }),
    };
    const message = {type: 'editing_update', walkthrough: uiWalkthrough};
    figma.ui.postMessage(message);
}

// saves the walkthrough currently being edited to storage
function saveWalkthrough(name) {
    const page = figma.currentPage;
    const walkthrough = editingWalkthrough;

    let walkthroughsObject = {array: []};
    const currentWalkthroughs = page.getPluginData('walkthroughs');
    if (currentWalkthroughs) {
        walkthroughsObject = JSON.parse(currentWalkthroughs);
    }

    walkthroughsObject.array = [...walkthroughsObject.array, walkthrough];
    const walkthroughsObjectJSON = JSON.stringify(walkthroughsObject);
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);

    editingWalkthrough = null;
    updateUIState(STATE_HOME);
}

// generates unique ids
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}