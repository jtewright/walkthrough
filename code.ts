
figma.showUI(__html__);

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
        default:
    }
};

function nextNode() {
    const page = figma.currentPage;
    const selected = page.selection;
    const nodes = page.findAll();
    let newSelection = [];

    // no frames
    if (nodes.length == 0) {
        figma.notify("Nothing to be found");
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
    const selectedNode = newSelection[0]
    const note = selectedNode.getPluginData('choi');
    const name = selectedNode.name;
    const message = {name: name, note: note};
    figma.ui.postMessage(message);
};

function saveNote(note) {
    const page = figma.currentPage;
    const selected = page.selection[0];
    selected.setPluginData('choi', note);
}