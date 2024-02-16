const test = require('node:test');
const assert = require('node:assert/strict');
const patchParser = require('./patch_parser');

test('parseUnifiedPatch', t => {
    let parsed = patchParser.parse('@@ -19,11 +19,15 @@\n' +
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
        { removed: [19, 29], added: [19, 33] },
        { removed: [35, 40], added: [39, 45] }
    ]);
});