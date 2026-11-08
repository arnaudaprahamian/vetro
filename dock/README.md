# Vetro launcher

A minimal launcher for a rooted Samsung Tizen TV, written in C# against the TV's own EFL
libraries and run with the TV's `dotnet`. Vetro starts and stops it from its **Launcher**
tab; it is off until you turn it on.

The launcher is a bundled Vetro plugin: `app/service/plugin-launcher.js` owns supervision and API
actions, and the existing `/dock` URLs are aliases. Its native files still ship with Vetro and are
updated and rolled back together with Vetro; installing a replacement launcher from the catalog is
not implemented. **Still selection** is an optional setting in that plugin, off by default. It skips
focus movement, icon growth/lift and per-icon glow colours; entrance and exit fades remain.

When it is on, the Home key opens this launcher instead of Samsung's Home. The dock shows
the same apps, in the same order and with the same icons as Samsung's Home row, read
from the TV at start-up, and ends with two outline pills, Settings and Samsung Home.

## Layout

- `src/` the dock. `Core/` is pure logic (layout, catalog, input decoding) and has tests;
  `Native/` holds the P/Invoke surface; `Ui/` draws with EFL.
- `tests/` desktop tests of `Core/`: `cd tests && dotnet run`.
- `res/` the images (bar, shadow, glow, focus ring), the generic Settings/HDMI icons and the HDMI device tiles.
- `tools/` generators for those images (`make-glass.cjs`, `system_icons.py`).
- `designer/` a standalone page to try looks; `designer/chosen.json` is the design the launcher currently draws.

## The look

The look is one design, ported from the designer page's JSON. `src/Core/Design.cs` holds the visual values and
`src/Core/Layout.cs` the geometry; both generators read those two files, so the pictures cannot disagree with the
code. `app/tests/dock-design.test.cjs` checks them against `designer/chosen.json` value by value.

One rule ties the shapes together: an icon's corner radius is a percentage of its side (`Design.IconRadiusPct`),
and the focus ring and the glow are built from that same radius, at every size the icon takes while it grows.

The inputs panel draws each HDMI port as a tile with its number. When the TV knows what is plugged in (the device
type picked in its source menu, or the one reported over CEC), the tile shows that device instead of the plug, with
the number kept under it: the service maps Samsung's icon name to a kind (`DEVICE_KINDS` in
`app/service/dock-catalog.js`) and names `dev-<kind>-<port>.png` in the icon column, a file of `res/icons` that
`system_icons.py` draws for every kind and port. Samsung's own device icons are SVG, which the dock cannot load.

To change the look: edit `chosen.json` (or paste a new designer export there), update the matching constants in
`Design.cs` / `Layout.cs`, then run `node tools/make-glass.cjs` and `python3 tools/system_icons.py`-based
`render_all` before building (`cd tools && python3 -c "import system_icons as s; s.render_all('../res/icons')"`).

Not ported from the designer (the launcher cannot do them): blurred background behind the bar, label fonts, the
brightness boost on a selected pill, and the desaturation of unselected icons. With the chosen design there are no
name labels and no clock, so the label styling options are not carried either.

One name is written, as in the designer's input cards: on the inputs panel, the device behind the focused HDMI port
(PlayStation 5, say) as a subtitle under its tile, in the same 26 px text a label would use. The service gives it in
the list's seventh column (the label keeps "HDMI 2 - PlayStation 5" for the dashboard); TV and a port without a name
get none, the tile already says which port it is. When any input has a name, that page's pill grows by a name row
(`DockLayout.NameRow`) and the shared window by as much, so the subtitle sits inside the pill, above the "Back"
capsule, and the apps page stays where it was on screen. The apps page writes no names.

## Build

```sh
dotnet build -c Release Launcher.csproj   # targets netcoreapp3.1, the runtime on the TV
```

Run `sh dock/build.sh` from the repository root to build and copy the native DLL and runtime config
into `app/native/dock/`. The package builder reads those copies; it does not compile C# automatically.
After changing native sources, rebuild before packaging. Run `dotnet run --project dock/tests` for the
pure logic, raw-input echo, Home guard cancellation and system-launch fallback checks (the shell
fixtures run on a Unix desktop and never access a TV).
