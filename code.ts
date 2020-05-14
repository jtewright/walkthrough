
figma.showUI(__html__);
loadNode();

figma.ui.onmessage = msg => {
    switch (msg.type) {
        case 'next': 
            nextNode();
            break;
        case 'exit':
            figma.closePlugin();
            break;
        case 'note':
            saveNote(msg.value);
            break;
        case 'note_next':
            saveNote(msg.value);
            nextNode();
            break;
        case 'create_walkthrough':
            createWalkthrough(msg.value);
            break;    
        default:
    }
};

function loadNode() {
    const page = figma.currentPage;
    const selection = page.selection;
    if (selection.length > 0) {
        const selectedNode = selection[0];
        const note = selectedNode.getPluginData('nodeNote');
        const name = selectedNode.name;
        const message = {name: name, note: note};
        figma.ui.postMessage(message);
    }
};

function nextNode() {
    const page = figma.currentPage;
    const selected = page.selection;
    const nodes = page.findAll();
    let newSelection = [];

    // no frames
    if (nodes.length == 0) {
        figma.notify("No objects to walk through");
        return;
    }

    // one selected
    if (selected.length == 1) {
        const selectedNode = selected[0];
        const selectedIndex = nodes.indexOf(selectedNode);
        let nextIndex = selectedIndex + 1;
        if (nextIndex >= nodes.length) {
            nextIndex = 0;
        }
        newSelection = [nodes[nextIndex]];
    }
    // many|none selected
    else {
        newSelection = [nodes[0]];
    }

    page.selection = newSelection;
    figma.viewport.scrollAndZoomIntoView(newSelection);
    loadNode();
};

function saveNote(note) {
    const page = figma.currentPage;
    const selected = page.selection[0];
    selected.setPluginData('nodeNote', note);
};

function createWalkthrough(name) {
    const page = figma.currentPage;
    const selected = page.selection;

    // no frames
    if (selected.length == 0) {
        figma.notify("Please select some objects");
        return;
    }

    const newWalkthrough = {name: name, nodes: selected};
    let walkthroughsObject = {array: []};
    const currentWalkthroughs = page.getPluginData('walkthroughs');
    if (currentWalkthroughs) {
        walkthroughsObject = JSON.parse(currentWalkthroughs);
    }
    walkthroughsObject.array.push(newWalkthrough);
    const walkthroughsObjectJSON = JSON.stringify(walkthroughsObject);
    page.setPluginData('walkthroughs', walkthroughsObjectJSON);
};