import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as lib from './lib.mjs';

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

    assert.deepEqual(parsed, [22, 23, 29, 30, 42]);
});

test('testPR21457', async t => {

    const filesFilter = "cpp,h,hpp,c,cc,cxx,hxx";
    const fileInfos = await lib.getFilesInfoForPR("OpenRCT2", "OpenRCT2", 21407, filesFilter);

    assert.deepEqual(fileInfos, {
        "src/openrct2/entity/Peep.cpp": {
            "filename": "src/openrct2/entity/Peep.cpp",
            "modifiedLines": [
                2394,
                2854,
                2855,
                2856,
                2857,
                2858,
                2859,
                2860,
                2861,
                2862,
                2863,
                2864,
                2865,
                2866,
                2867,
                2868,
                2869,
                2870
            ]
        },
        "src/openrct2/entity/Staff.cpp": {
            "filename": "src/openrct2/entity/Staff.cpp",
            "modifiedLines": [
                186,
                723,
                724
            ]
        },
        "src/openrct2/peep/GuestPathfinding.h": {
            "filename": "src/openrct2/peep/GuestPathfinding.h",
            "modifiedLines": [
                35,
                37,
                39,
                47,
                54,
                55,
                56,
                57,
                58,
                59,
                61,
                62
            ]
        },
        "test/tests/Pathfinding.cpp": {
            "filename": "test/tests/Pathfinding.cpp",
            "modifiedLines": [
                88
            ]
        }
    });
});


test('testPR21445', async t => {
    const filesFilter = "cpp,h,hpp,c,cc,cxx,hxx";
    const fileInfos = await lib.getFilesInfoForPR("OpenRCT2", "OpenRCT2", 21445, filesFilter);

    assert.deepEqual(fileInfos, {
        "src/openrct2-ui/interface/LandTool.cpp": {
            "filename": "src/openrct2-ui/interface/LandTool.cpp",
            "modifiedLines": [
                50
            ]
        },
        "src/openrct2-ui/interface/LandTool.h": {
            "filename": "src/openrct2-ui/interface/LandTool.h",
            "modifiedLines": [
                16,
                17,
                19
            ]
        },
        "src/openrct2-ui/windows/ClearScenery.cpp": {
            "filename": "src/openrct2-ui/windows/ClearScenery.cpp",
            "modifiedLines": [
                100,
                101,
                126,
                133,
                149,
                184
            ]
        },
        "src/openrct2-ui/windows/Land.cpp": {
            "filename": "src/openrct2-ui/windows/Land.cpp",
            "modifiedLines": [
                65,
                66,
                135,
                142,
                205,
                206,
                247
            ]
        },
        "src/openrct2-ui/windows/LandRights.cpp": {
            "filename": "src/openrct2-ui/windows/LandRights.cpp",
            "modifiedLines": [
                134,
                141,
                160,
                162,
                163,
                223,
                396,
                397
            ]
        },
        "src/openrct2-ui/windows/Map.cpp": {
            "filename": "src/openrct2-ui/windows/Map.cpp",
            "modifiedLines": [
                208,
                316,
                322,
                619,
                868,
                1329,
                1330
            ]
        },
        "src/openrct2-ui/windows/PatrolArea.cpp": {
            "filename": "src/openrct2-ui/windows/PatrolArea.cpp",
            "modifiedLines": [
                89,
                93,
                112,
                113,
                139,
                260,
                261
            ]
        },
        "src/openrct2-ui/windows/SceneryScatter.cpp": {
            "filename": "src/openrct2-ui/windows/SceneryScatter.cpp",
            "modifiedLines": [
                83,
                84,
                123,
                129,
                147,
                184
            ]
        },
        "src/openrct2-ui/windows/Water.cpp": {
            "filename": "src/openrct2-ui/windows/Water.cpp",
            "modifiedLines": [
                89,
                96,
                127,
                128,
                151,
                189,
                190
            ]
        },
        "src/openrct2/Context.cpp": {
            "filename": "src/openrct2/Context.cpp",
            "modifiedLines": [
                631
            ]
        },
        "src/openrct2/FileClassifier.h": {
            "filename": "src/openrct2/FileClassifier.h",
            "modifiedLines": [
                51
            ]
        },
        "src/openrct2/Intro.cpp": {
            "filename": "src/openrct2/Intro.cpp",
            "modifiedLines": [
                23,
                24,
                25,
                181,
                184,
                191,
                200,
                204,
                236,
                296
            ]
        },
        "src/openrct2/command_line/ParkInfoCommands.cpp": {
            "filename": "src/openrct2/command_line/ParkInfoCommands.cpp",
            "modifiedLines": [
                76
            ]
        }
    });
});