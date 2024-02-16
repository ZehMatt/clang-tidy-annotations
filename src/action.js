const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const stringArgv = require('string-argv');
const path = require('path');
const patchParser = require('./patch_parser');

function filterPRFiles(files, extensions) {
    // Convert the extensions string to an array of extensions
    const extArray = extensions.split(',');

    // Convert the extensions to lowercase
    extArray.forEach((ext, index) => {
        extArray[index] = ext.toLowerCase();
    });

    // Debug print the filtered extensions
    const extArrayData = extArray.toString();
    core.debug(`Filtered Extensions: ${extArrayData}`)

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
    core.debug(`Files filtered by extensions: ${filteredFilesByExtData}`);
    
    // Only have files where the status is 'added' or 'modified'
    filteredFiles = filteredFiles.filter(file => file.status == 'added' || file.status == 'modified');

    // Debug print the files filtered by status
    const filteredFilesByStatusData = JSON.stringify(filteredFiles, null, 4);
    core.debug(`Files filtered by status: ${filteredFilesByStatusData}`);

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

function isLineModified(patchInfos, line) {
    for (let i = 0; i < patchInfos.length; i++) {
        const patch = patchInfos[i];
        if (line >= patch.added[0] && line <= patch.added[1]) {
            return true;
        }
    }
    return false;
}

function createAnnotations(issues, onlyAffectedLines, fileInfos) {
    const workspacePath = process.env.GITHUB_WORKSPACE;
    const annotations = [];
    issues.forEach(issue => {
        // Get the file path relative to the workspace, clang-tidy returns the absolute path.
        const filePath = issue.file.replace(`${workspacePath}/`, '');

        // Check if the line was modified
        if(onlyAffectedLines) {
            const fileInfo = fileInfos[filePath];
            const patchInfos = fileInfo.patchInfos;
            if (!isLineModified(patchInfos, issue.line)) {
                // Debug print the line that was not modified
                core.debug(`Line ${issue.line} in file ${filePath} was not modified`);

                return;
            }
        }

        // Create the annotation.
        annotations.push({
            path: filePath,
            start_line: parseInt(issue.line),
            end_line: parseInt(issue.line),
            annotation_level: transformLevel(issue.level),
            message: issue.message,
            title: `clang-tidy: ${issue.level}`,
            start_column: parseInt(issue.column),
            end_column: parseInt(issue.column)
        });
    });
    return annotations;
}

function transformLevel(level) {
    switch (level) {
        case 'error':
            return 'failure';
        case 'warning':
            return 'warning';
        case 'note':
            return 'notice';
    }
    return 'notice';
}

async function run() {
    // Inputs.
    const buildDir = core.getInput('build_dir', { required: true });
    const sourceDir = core.getInput('source_dir', { required: true });
    const cmakeArgs = core.getInput('cmake_args', { required: false });
    const filesFilter = core.getInput('file_filter', { required: true });
    const clangTidyArgs = core.getInput('clang_tidy_args', { required: false });
    const onlyAffectedLines = core.getBooleanInput('only_affected_lines');
    const clangTidyFilePath = core.getInput('clang_tidy_file');
    const warningsAsErrors = core.getBooleanInput('warnings_as_errors');
    const failOnProblems = core.getBooleanInput('fail_on_problems');

    const payload = github.context.payload;
    const prNumber = payload.pull_request.number;
    const token = core.getInput('github_token');
    const octokit = github.getOctokit(token);

    // Request modified files from the PR
    const filesResult = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: prNumber
    });

    // Debug print the files.
    const filesData = JSON.stringify(filesResult.data, null, 4);
    core.debug(`PR files: ${filesData}`);

    let files = filterPRFiles(filesResult.data, filesFilter);

    const filteredFilesData = JSON.stringify(files, null, 4);
    core.debug(`Filtered PR files: ${filteredFilesData}`);

    if(files.length == 0) {
        core.info('No files to check');
        return;
    }

    let fileInfos = [];
    files.forEach(file => {
        const fileInfo = {
            filename: file.filename,
            patchInfos: patchParser.parse(file.patch)
        };
        fileInfos[file.filename] = fileInfo;
    });

    // Debug print the file infos.
    const fileInfosData = JSON.stringify(fileInfos, null, 4);
    core.debug(`File infos: ${fileInfosData}`);

    // Build the CMake arguments.
    let cmakeCmdArgs = [sourceDir, '-B', buildDir, '-DCMAKE_EXPORT_COMPILE_COMMANDS=on'];
    if (cmakeArgs !== undefined && cmakeArgs != '') {
        // Split the cmake args by space otherwise it will be quoted as a single argument.
        const parsedCMakeArgs = stringArgv.parseArgsStringToArgv(cmakeArgs);
        // Concatenate the cmake args with the cmake command.
        cmakeCmdArgs = cmakeCmdArgs.concat(parsedCMakeArgs);
    }

    // Execute CMake.
    const cmakeExec = await exec.getExecOutput('cmake', cmakeCmdArgs, { ignoreReturnCode: true, silent: true });
    if (cmakeExec.exitCode != 0) {
        core.error(cmakeExec.stderr);
        core.setFailed('CMake configuration failed');
        return;
    }

    // Build the clang-tidy arguments.
    const cmakeCmdArgsData = JSON.stringify(cmakeCmdArgs, null, 4);
    core.debug(`CMake command args: ${cmakeCmdArgsData}`);

    // Execute clang-tidy
    let clangTidyCmdArgs = ['--quiet', '-p', buildDir, `--config-file=${clangTidyFilePath}`];
    files.forEach(file => {
        clangTidyCmdArgs.push(file.filename);
    });
    if (clangTidyArgs !== undefined && clangTidyArgs != '') {
        // Split the clang-tidy args by space otherwise it will be quoted as a single argument.
        const parsedClangTidyArgs = stringArgv.parseArgsStringToArgv(clangTidyArgs);
        // Concatenate the clang-tidy args with the clang-tidy command.
        clangTidyCmdArgs = clangTidyCmdArgs.concat(parsedClangTidyArgs);
    }
    if(warningsAsErrors) {
        clangTidyCmdArgs.push('--warnings-as-errors=*');
    }
    
    // Debug print the clang-tidy args.
    const clangTidyArgsData = JSON.stringify(clangTidyCmdArgs, null, 4);
    core.debug(`Clang-tidy args: ${clangTidyArgsData}`);

    // Execute clang-tidy
    const clangTidyExec = await exec.getExecOutput('clang-tidy', clangTidyCmdArgs, { ignoreReturnCode: true, silent: true });

    // Debug print the clang-tidy output.
    core.debug(`Clang-tidy output: ${clangTidyExec.stdout}`);

    // Parse the clang-tidy output
    const tidyIssues = parseClangTidyOutput(clangTidyExec.stdout);

    // Output via annotations
    const annotations = createAnnotations(tidyIssues, onlyAffectedLines, fileInfos);

    // Debug print the annotations.
    const annotationsData = JSON.stringify(annotations, null, 4);
    core.debug(`Annotations: ${annotationsData}`);

    if (annotations.length > 0) {

        // Iteratea all annotations and use core.warning for warnings and core.error for errors.
        annotations.forEach(annotation => {
            const annotationResult = {
                title: annotation.title,
                file: annotation.path,
                startLine: annotation.start_line,
                endLine: annotation.end_line,
                startColumn: annotation.start_column,
                endColumn: annotation.end_column,
            };
            if (annotation.annotation_level === 'warning') {
                core.warning(annotation.message, annotationResult);
            } else if (annotation.annotation_level === 'failure') {
                core.error(annotation.message, annotationResult);
            } else {
                core.notice(annotation.message, annotationResult);
            }
        });

        if(failOnProblems) {
            core.setFailed('clang-tidy found issues');
        } else {
            core.warning('clang-tidy found issues');
        }
    }
}

run();