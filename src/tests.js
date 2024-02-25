const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('./lib');
const core = require('@actions/core');
const github = require('@actions/github');

test('parseUnifiedPatch', t => {
    let parsed = lib.parsePatch('@@ -19,11 +19,15 @@\n' +
        ' \n' +
        ' using namespace OpenRCT2;\n' +
        ' \n' +
        '+#define DO_NOT_DO_THIS 1\n' +
        '+\n' +
        ' constexpr int32_t MONTH_TICKS_INCREMENT = 4;\n' +
        ' constexpr int32_t MASK_WEEK_TICKS = 0x3FFF;\n' +
        ' constexpr int32_t MASK_FORTNIGHT_TICKS = 0x7FFF;\n' +
        ' constexpr int32_t MASK_MONTH_TICKS = 0xFFFF;\n' +
        ' \n' +
        '+#define ANOTHER_MACRO 1\n' +
        '+\n' +
        ' // rct2: 0x00993988\n' +
        ' static const int16_t days_in_month[MONTH_COUNT] = {\n' +
        '     31, 30, 31, 30, 31, 31, 30, 31,\n' +
        '@@ -35,6 +39,7 @@ Date::Date(uint32_t monthsElapsed, uint16_t monthTicks)\n' +
        '     : _monthTicks(monthTicks)\n' +
        '     , _monthsElapsed(monthsElapsed)\n' +
        ' {\n' +
        '+    void* foo = NULL;\n' +
        ' }\n' +
        ' \n' +
        ' Date Date::FromYMD(int32_t year, int32_t month, int32_t day)');

    assert.deepEqual(parsed, [
        { removed: [19, 30], added: [19, 34] },
        { removed: [35, 41], added: [39, 46] }
    ]);
});

test('parseUnifiedPatch - addition only', t => {
    let parsed = lib.parsePatch('@@ -0,0 +1 @@\n' +
        '+#define DO_NOT_DO_THIS 1\n');

    assert.deepEqual(parsed, [
        { removed: [0, 0], added: [1, 2] },
    ]);
});

test('parseUnifiedPatch - deletion only', t => {
    let parsed = lib.parsePatch('@@ -1 +0 @@\n' +
        '+#define DO_NOT_DO_THIS 1\n');

    assert.deepEqual(parsed, [
        { removed: [1, 2], added: [0, 0] },
    ]);
});

test('testPR21457', async t => {

    const token = "";
    const octokit = github.getOctokit(token);

    const prNumber = 21457;
    const filesResult = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
        owner: 'OpenRCT2',
        repo: 'OpenRCT2',
        pull_number: prNumber
    });

    const filesFilter = "cpp,h,hpp,c,cc,cxx,hxx";
    let files = lib.filterPRFiles(filesResult.data, filesFilter);

    const filteredFilesData = JSON.stringify(files, null, 4);
    console.log(`Filtered PR files: ${filteredFilesData}`);

    if (files.length == 0) {
        core.info('No files to check');
        return;
    }

    let fileInfos = lib.buildFileInfos(files);

    // Debug print the file infos.
    const fileInfosData = JSON.stringify(fileInfos, null, 4);
    console.log(`File infos: ${fileInfosData}`);

});