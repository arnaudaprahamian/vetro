'use strict';
// What is plugged into each HDMI port picks the tile the inputs panel draws: Samsung's device icon name (an SVG the dock
// cannot load) maps to one of the dock's own tiles, dev-<kind>-<port>.png, made by dock/tools/system_icons.py.
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const catalog = require('../service/dock-catalog.js');

const dock = path.join(__dirname, '..', '..', 'dock');
const VD = '/usr/apps/com.samsung.tv.theme-resource/shared/res/VD_ICONS/';
const kind = icon => catalog.deviceKind({IconPath: icon});

// the table, name by name
const expected = {
    gamepad: 'gamepad', pc: 'pc', cablebox: 'cablebox', stb: 'cablebox', settop: 'cablebox',
    blueray: 'disc', bluray: 'disc', dvd: 'disc', hometheater: 'audio', soundbar: 'audio',
    mobile: 'mobile', phone: 'mobile', camera: 'camera'
};
for (const name of Object.keys(expected)) {
    assert.equal(kind('i_icon_device_m_' + name + '.svg'), expected[name], name);
    assert.equal(kind(VD + 'i_icon_device_m_' + name + '.svg'), expected[name], name + ' with its folder');
}
assert.deepEqual(catalog.DEVICE_KINDS, expected, 'the service maps exactly these names');
for (const other of ['i_icon_device_m_hdmi1.svg', 'i_icon_device_m_hdmi4.svg', 'i_icon_device_m_unknown.svg', 'i_icon_device_m_toString.svg',
    'i_icon_device_m_constructor.svg', 'gamepad.svg', 'i_icon_device_m_gamepad.svg.bak', '', null, undefined])
    assert.equal(kind(other), null, 'no device tile for ' + other);
assert.equal(catalog.deviceKind({EditIconPath: 'i_icon_device_m_pc.svg', IconPath: 'i_icon_device_m_gamepad.svg'}), 'pc', 'the owner\'s own choice first');
assert.equal(catalog.deviceKind({EditIconPath: 'i_icon_device_m_hdmi2.svg', IconPath: 'i_icon_device_m_gamepad.svg'}), 'gamepad', 'a generic edited icon does not hide the device');
assert.equal(catalog.deviceKind({OrgIconPath: 'i_icon_device_m_dvd.svg'}), 'disc', 'the original icon last');
assert.equal(catalog.deviceKind({}), null);

// the owner's S95B: what .sourceCache says, and the list the dock is given
const sources = {
    TV: {EditName: '', IconPath: 'i_icon_device_m_tv.svg'},
    HDMI1: {EditName: 'Google Streamer TV 4K', SettingMethod: 0, IconPath: 'i_icon_device_m_cablebox.svg', OrgIconPath: 'i_icon_device_m_hdmi1.svg'},
    HDMI2: {DetectedName: 'PlayStation 5', SettingMethod: 2, IconPath: 'i_icon_device_m_gamepad.svg', OrgIconPath: 'i_icon_device_m_hdmi2.svg'},
    HDMI3: {EditName: 'D\u00e9codeur c\u00e2ble', IconPath: 'i_icon_device_m_cablebox.svg'},
    HDMI4: {EditName: 'PC', IconPath: 'i_icon_device_m_pc.svg'}
};
const parsed = catalog.parse('S|' + Buffer.from(JSON.stringify(sources)).toString('base64'));
const built = catalog.build(parsed);
assert.deepEqual(built.inputs.map(e => e.icon), [null, 'dev-cablebox-1.png', 'dev-gamepad-2.png', 'dev-cablebox-3.png', 'dev-pc-4.png']);
const rows = catalog.inputsTsv(built).trim().split('\n').slice(1).map(l => l.split('\t'));
assert.deepEqual(rows[0], ['in-tv', 'TV', 'source:0'], 'TV keeps its own tile');
assert.deepEqual(rows[2].slice(0, 5), ['in-hdmi2', 'HDMI 2 - PlayStation 5', 'source:14', '', 'dev-gamepad-2.png'], 'icon column holds the tile name');
const noDevice = catalog.build(catalog.parse('S|' + Buffer.from(JSON.stringify({HDMI1: {IconPath: 'i_icon_device_m_hdmi1.svg'}})).toString('base64')));
assert.equal(noDevice.inputs[1].icon, null, 'a port without a known device keeps in-hdmi1.png');
assert.equal(catalog.inputsTsv(noDevice).split('\n')[2], 'in-hdmi1\tHDMI 1\tsource:13');
// the Home row's own source tiles (when shown) take the same tile
const row = catalog.build(Object.assign({}, parsed, {order: ['s/source.layer.hdmi@HDMI2']}), {showHomeSources: true});
assert.equal(row.entries[0].icon, 'dev-gamepad-2.png');

// every kind has its four tiles in the package, at the size the dock draws a selected icon
const focus = +/public const int FocusIcon\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(dock, 'src', 'Core', 'Layout.cs'), 'utf8'))[1];
const py = fs.readFileSync(path.join(dock, 'tools', 'system_icons.py'), 'utf8');
const drawn = [...(/DEVICES = \{([^}]*)\}/.exec(py)[1]).matchAll(/"(\w+)":/g)].map(m => m[1]).sort();
assert.deepEqual(drawn, [...new Set(Object.values(expected))].sort(), 'system_icons.py draws exactly the kinds the service emits');
for (const k of drawn) for (let n = 1; n <= 4; n++) {
    const file = 'dev-' + k + '-' + n + '.png';
    assert.ok(catalog.packagedIconOk(file), file);
    const b = fs.readFileSync(path.join(dock, 'res', 'icons', file));
    assert.equal(b.slice(1, 4).toString(), 'PNG', file + ' is a PNG');
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [focus, focus], file + ' is made at the selected size');
}
for (const bad of ['dev-pc-5.png', 'dev-pc-1.svg', '../dev-pc-1.png', 'icons/dev-pc-1.png', 'dev-PC-1.png', 'in-hdmi1.png']) assert.ok(!catalog.packagedIconOk(bad), bad);

(async () => {
    // the tiles ship with the dock: they are never looked for on the TV
    const out = 'F|csfs\nO|d/webapp@aaa\nR|' + ['aaa', 'Netflix', 'org.tizen.netflix-app'].map(s => Buffer.from(s).toString('hex')).join('|') + '|0\n' +
        'S|' + Buffer.from(JSON.stringify(sources)).toString('base64');
    const scripts = [];
    const loaded = await catalog.load(async s => { scripts.push(Buffer.from(s.split(' ')[1], 'base64').toString()); return {exit_code: 0, stdout: scripts.length === 1 ? out : ''}; }, {});
    assert.ok(loaded.inputsTsv.includes('dev-gamepad-2.png'), 'kept although the TV was not asked about it');
    assert.ok(!scripts.some(s => s.includes('dev-')), 'no existence check for packaged tiles');

    // useSourceImages: a real Samsung PNG wins, and the device tile replaces it when the file is gone
    const png = '/opt/usr/apps/device/shared/console.png';
    const withPng = Object.assign({}, sources, {HDMI2: Object.assign({}, sources.HDMI2, {LauncherUnfocusedIconPath: png})});
    const out2 = out.replace(/S\|.*$/, 'S|' + Buffer.from(JSON.stringify(withPng)).toString('base64'));
    for (const present of [true, false]) {
        const r = await catalog.load(async s => {
            const text = Buffer.from(s.split(' ')[1], 'base64').toString();
            return {exit_code: 0, stdout: text.includes('for p in') ? (present ? 'OK|' + png + '\n' : '') : out2};
        }, {useSourceImages: true});
        assert.equal(r.inputsTsv.split('\n')[3].split('\t')[4], present ? png : 'dev-gamepad-2.png', 'Samsung PNG ' + (present ? 'present' : 'missing'));
    }
    console.log('PASS device tiles: Samsung device icon -> dev-<kind>-<port>.png, packaged for every kind and port');
})().catch(e => { console.error(e); process.exitCode = 1; });
