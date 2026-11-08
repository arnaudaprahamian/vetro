'use strict';
// The inputs panel writes the device's name under the focused tile. The list keeps "HDMI n - name" as the label (the
// dashboard shows it) and gives the dock the name alone in its own column, so the dock never has to take a label apart.
const assert = require('assert').strict;
const catalog = require('../service/dock-catalog.js');

const sources = {
    TV: {EditName: 'Living room'},
    HDMI1: {EditName: 'Google Streamer TV 4K', IconPath: 'i_icon_device_m_cablebox.svg'},
    HDMI2: {DetectedName: 'PlayStation 5', IconPath: 'i_icon_device_m_gamepad.svg'},
    HDMI3: {EditName: 'D\u00e9codeur c\u00e2ble'},
    HDMI4: {EditName: 'HDMI 4'}
};
const built = catalog.build(catalog.parse('S|' + Buffer.from(JSON.stringify(sources)).toString('base64')));
const rows = catalog.inputsTsv(built).trim().split('\n').slice(1).map(l => l.split('\t'));
assert.deepEqual(rows.map(r => r[1]), ['TV', 'HDMI 1 - Google Streamer TV 4K', 'HDMI 2 - PlayStation 5', 'HDMI 3 - D\u00e9codeur c\u00e2ble', 'HDMI 4'],
    'the label keeps the port for the dashboard');
assert.deepEqual(rows.map(r => r[6] || ''), ['', 'Google Streamer TV 4K', 'PlayStation 5', 'D\u00e9codeur c\u00e2ble', ''],
    'subtitle: the device alone; nothing for TV or a port without a name');
assert.deepEqual(rows[3], ['in-hdmi3', 'HDMI 3 - D\u00e9codeur c\u00e2ble', 'source:15', '', '', '', 'D\u00e9codeur c\u00e2ble'], 'the column is the seventh, after an empty icon');
assert.deepEqual(rows[0], ['in-tv', 'TV', 'source:0'], 'TV: no trailing columns');
assert.deepEqual(rows[4], ['in-hdmi4', 'HDMI 4', 'source:16'], 'a port named after itself: none either');
assert.ok(rows.every(r => !r[6] || (r[6].length <= 40 && !/[\t\n|]/.test(r[6]))), 'the dock\'s limits: 40 characters, no separators');
const long = catalog.build(catalog.parse('S|' + Buffer.from(JSON.stringify({HDMI1: {EditName: 'x'.repeat(60) + '\tend'}})).toString('base64')));
assert.ok(long.inputs[1].subtitle.length <= 40 && !/\t/.test(long.inputs[1].subtitle), 'a long or odd name is cleaned and cut');
// the apps list is unchanged: no subtitle column there
const apps = catalog.tsv(Object.assign({}, built, {entries: built.inputs.slice(1, 3)}));
assert.ok(apps.split('\n').every(l => l.split('\t').length <= 6), 'apps rows never carry a subtitle');
console.log('PASS input subtitles: the device name in its own column, the port label unchanged');