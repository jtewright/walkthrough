figma.showUI(__html__);
figma.ui.onmessage = msg => {
    // Next
    if (msg.type === 'next') {
        const page = figma.currentPage;
        const selected = page.selection;
        const frames = page.findAll(node => node.type === "FRAME");
        let skip = false;
        if (frames.length == 0) {
            figma.notify("No Frames to be found");
            skip = true;
        }
        ;
        //nothing selected
        if (selected.length == 0 && !skip) {
            page.selection = [frames[0]];
        }
        //one thing selected
        else if (selected.length == 1 && !skip) {
            const selectedNode = selected[0];
            const selectedIndex = frames.indexOf(selectedNode);
            let nextIndex = selectedIndex + 1;
            if (nextIndex >= frames.length) {
                nextIndex = 0;
            }
            page.selection = [frames[nextIndex]];
        }
        else if (!skip) {
            page.selection = [frames[0]];
        }
    }
    if (msg.type === 'exit') {
        figma.closePlugin();
    }
};
