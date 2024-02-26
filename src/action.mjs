import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';
import * as stringArgv from 'string-argv';
import * as lib from './lib.mjs';

function isLineModified(fileInfos, file, line) {
    const fileInfo = fileInfos[file];
    if (fileInfo === undefined) {
        return false;
    }

    const modifiedLines = fileInfo.modifiedLines;
    if (modifiedLines === undefined) {
        return false;
    }

    return modifiedLines.includes(line);
}

function createAnnotations(issues, onlyAffectedLines, fileInfos) {
    const workspacePath = process.env.GITHUB_WORKSPACE;
    const annotations = [];
    issues.forEach(issue => {
        // Get the file path relative to the workspace, clang-tidy returns the absolute path.
        const filePath = issue.file.replace(`${workspacePath}/`, '');

        // Check if the line was modified
        if (onlyAffectedLines) {
            if (!isLineModified(fileInfos, filePath, issue.line)) {
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

    const payloadData = JSON.stringify(payload, null, 4);
    core.debug(`Payload: ${payloadData}`);

    // Request modified files from the PR
    const filesResult = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: prNumber
    });

    // Debug print the files.
    const filesData = JSON.stringify(filesResult.data, null, 4);
    core.debug(`PR files: ${filesData}`);

    let files = lib.filterPRFiles(filesResult.data, filesFilter);

    const filteredFilesData = JSON.stringify(files, null, 4);
    core.debug(`Filtered PR files: ${filteredFilesData}`);

    if (files.length == 0) {
        core.info('No files to check');
        return;
    }

    const fileInfos = lib.buildFileInfos(files);

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
    if (warningsAsErrors) {
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

        if (failOnProblems) {
            core.setFailed('clang-tidy found issues');
        } else {
            core.warning('clang-tidy found issues');
        }
    }
}

run();