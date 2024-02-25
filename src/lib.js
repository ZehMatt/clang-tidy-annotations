
const core = require('@actions/core');
const path = require('path');

function filterPRFiles(files, extensions) {
    // Convert the extensions string to an array of extensions
    const extArray = extensions.split(',');

    // Convert the extensions to lowercase
    extArray.forEach((ext, index) => {
        extArray[index] = ext.toLowerCase();
    });

    // Debug print the filtered extensions
    const extArrayData = extArray.toString();
    //core.debug(`Filtered Extensions: ${extArrayData}`)

    // Filter the files based on their extensions
    let filteredFiles = files.filter(file => {
        // Extract the extension from the filename
        let ext = path.extname(file.filename).toLowerCase();

        // Remove the dot from the extension
        if (ext.length > 0 && ext[0] === '.') {
            ext = ext.substring(1);
        }

        // Check if the extension is in the list of extensions
        return extArray.includes(ext);
    });

    // Debug print the files filtered by extensions
    const filteredFilesByExtData = JSON.stringify(filteredFiles, null, 4);
    //core.debug(`Files filtered by extensions: ${filteredFilesByExtData}`);

    // Only have files where the status is 'added' or 'modified'
    filteredFiles = filteredFiles.filter(file => file.status == 'added' || file.status == 'modified');

    // Debug print the files filtered by status
    const filteredFilesByStatusData = JSON.stringify(filteredFiles, null, 4);
    //core.debug(`Files filtered by status: ${filteredFilesByStatusData}`);

    // Filter out files that have no patch.
    filteredFiles = filteredFiles.filter(file => file.patch != null);

    const filteredFilesByPatchData = JSON.stringify(filteredFiles, null, 4);
    //core.debug(`Files filtered by patch: ${filteredFilesByPatchData}`);

    return filteredFiles;
}

function parseClangTidyOutput(output) {
    const lines = output.split('\n');
    const issues = [];
    lines.forEach(line => {
        const match = line.match(/(.+):(\d+):(\d+): (\w+): (.+)/);
        if (match) {
            const file = match[1];
            const line = match[2];
            const column = match[3];
            const level = match[4];
            const message = match[5];
            issues.push({
                file: file,
                line: line,
                column: column,
                level: level,
                message: message
            });
        }
    });
    return issues;
}

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

function buildFileInfos(files) {
    let fileInfos = {};
    files.forEach(file => {
        const fileInfo = {
            filename: file.filename,
            patchInfos: parsePatch(file.patch)
        };
        fileInfos[file.filename] = fileInfo;
    });
    return fileInfos;
}

module.exports = {
    filterPRFiles: filterPRFiles,
    parseClangTidyOutput: parseClangTidyOutput,
    parsePatch: parsePatch,
    buildFileInfos: buildFileInfos,
};