
import * as core from '@actions/core';
import * as path from 'node:path';
import * as diff from 'diff';
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";
import { Octokit } from '@octokit/rest';

function debugLog(message) {
    // Check that we are not running the tests.
    if (process.env['GITHUB_ACTIONS'] != 'true') {
        return;
    }
    core.debug(message);
}

function filterPRFiles(files, extensions) {
    // Convert the extensions string to an array of extensions
    const extArray = extensions.split(',');

    // Convert the extensions to lowercase
    extArray.forEach((ext, index) => {
        extArray[index] = ext.toLowerCase();
    });

    // Debug print the filtered extensions
    const extArrayData = extArray.toString();
    debugLog(`Filtered Extensions: ${extArrayData}`)

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
    debugLog(`Files filtered by extensions: ${filteredFilesByExtData}`);

    // Only have files where the status is 'added' or 'modified'
    filteredFiles = filteredFiles.filter(file => file.status == 'added' || file.status == 'modified');

    // Debug print the files filtered by status
    const filteredFilesByStatusData = JSON.stringify(filteredFiles, null, 4);
    debugLog(`Files filtered by status: ${filteredFilesByStatusData}`);

    // Filter out files that have no patch.
    filteredFiles = filteredFiles.filter(file => file.patch != null);

    const filteredFilesByPatchData = JSON.stringify(filteredFiles, null, 4);
    debugLog(`Files filtered by patch: ${filteredFilesByPatchData}`);

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
                line: parseInt(line),
                column: parseInt(column),
                level: level,
                message: message
            });
        }
    });
    return issues;
}

// Returns all the lines that are modified, deleted lines are not included.
function parsePatch(patchData) {
    var modifiedLines = [];
    const patches = diff.parsePatch(patchData);
    patches.forEach(patch => {
        patch.hunks.forEach(hunk => {
            let removed = {};
            let added = {};
            let oldLineStart = parseInt(hunk.oldStart);
            let newLineStart = parseInt(hunk.newStart);
            hunk.lines.forEach(line => {
                if (line.startsWith('-')) {
                    removed[oldLineStart] = true;
                    // Shift all added lines that are above this line by one.
                    for (let line in added) {
                        if (line > oldLineStart) {
                            added[line - 1] = true;
                            delete added[line];
                        }
                    }
                    oldLineStart++;
                } else if (line.startsWith('+')) {
                    added[newLineStart] = true;
                    // In case the line was removed and then added, consider it modified.
                    delete removed[newLineStart];
                    newLineStart++;
                } else {
                    oldLineStart++;
                    newLineStart++;
                }
            });
            for (let line in removed) {
                if (added[line]) {
                    modifiedLines.push(parseInt(line));
                    delete added[line];
                }
            }
            for (let line in added) {
                modifiedLines.push(parseInt(line));
            }
        });
    });
    return modifiedLines;
}

function buildFileInfos(files) {
    let fileInfos = {};
    files.forEach(file => {
        const fileInfo = {
            filename: file.filename,
            modifiedLines: parsePatch(file.patch)
        };
        fileInfos[file.filename] = fileInfo;
    });
    return fileInfos;
}

async function getFilesInfoForPR(owner, repo, prNumber, filesFilter) {

    const auth = createUnauthenticatedAuth({
        reason:
            "Handling an installation.deleted event (The app's access has been revoked)",
    });
    const authentication = await auth();
    const octokit = new Octokit();

    const requestWithAuth = octokit.request.defaults({
        request: {
            hook: auth.hook,
        },
    });

    const filesResult = await requestWithAuth('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
        owner: owner,
        repo: repo,
        pull_number: prNumber
    });

    const files = filterPRFiles(filesResult.data, filesFilter);
    if (files.length == 0) {
        core.info('No files to check');
        return;
    }

    return buildFileInfos(files);
}

export {
    filterPRFiles,
    parseClangTidyOutput,
    parsePatch,
    buildFileInfos,
    getFilesInfoForPR,
};