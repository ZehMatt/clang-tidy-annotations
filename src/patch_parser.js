function parsePatch(patchData) {
    const lineRanges = [];
    const chunks = patchData.split('@@').slice(1);  // split by '@@' and ignore the first empty string

    chunks.forEach(chunk => {
        const lines = chunk.split('\n');
        const header = lines[0];

        // Extract the line range from the diff chunk header
        const match = header.match(/-(\d+),?(\d+)? \+(\d+),?(\d+)?/);
        if (match) {
            const linesRemovedStart = parseInt(match[1], 10);
            const linesRemovedAffected = match[2] ? parseInt(match[2], 10) : (linesRemovedStart != 0) ? 1 : 0;
            const linesAddedStart = parseInt(match[3], 10);
            const linesAddedAffected = match[4] ? parseInt(match[4], 10) : (linesAddedStart != 0) ? 1 : 0;
            lineRanges.push({
                removed: [linesRemovedStart, linesRemovedStart + linesRemovedAffected],
                added: [linesAddedStart, linesAddedStart + linesAddedAffected],
            });
        }
    });
    return lineRanges;
}

module.exports = {
    parse: parsePatch
}