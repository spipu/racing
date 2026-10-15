# Virtua Racing Deluxe data — © SEGA 1994

Data extracted from the ROM of **Virtua Racing Deluxe** (Sega 32X), private use
only (see `LICENSE.md`).

- **Source**: `Virtua Racing Deluxe (USA).32x`, 3 145 728 bytes, MD5
  `72b1ad0f949f68da7d0a6339ecd51a3f`.
- **Tool**: `tools/export/exportVirtualRacing.js` (run from the repository root);
  every location it reads is listed in `tools/export/vrRomMap.js`.
- Values are kept as stored in the ROM: big-endian words turned into numbers,
  axes and units of the original game. Never edit these files by hand: change
  the exporter and run it again.

## Files

| File | Content |
|---|---|
| `catalog.json` | Codes and names of the courses and cars, in the order of the original menus; `sky` = size of the sky panoramas and their row on the horizon |
| `palettes.json` | 256-colour palette of each course, and the 64 colours of each car copied over indices 32-95 |
| `cars.json` | Every model of the three car banks, the opponents' low-detail bank and the common bank; per car: body, cockpit models and whether the cockpit view shows its front wheels (`cockpitWheels`), steering wheel with the driver's arms (shared), render slot offsets of the effects (`effectOffsets`), damaged bodies (`damaged`: one crash, two and more) and cockpit shell (`damagedCockpit`), whether the pit work hides the shadow (`pitHidesShadow`) |
| `courses/<course>.json` | Scenery and road of a course: 32 × 32 grid of model ids (`null` = empty cell) and the models |
| `skies/<course>.png` | Sky panorama of a course (Mega Drive plane B): 128 × 36 cells of 8 × 8 pixels = 1024 × 288, wrapping around 360 degrees; transparent where the VDP shows colour 0 |
| `sounds.json`, `sounds/dac_XX.wav` | The 49 Z80 DAC samples (unsigned 8-bit mono; rate computed from the Z80 loop timing, not measured) and, per sound effect id `$A0-$D2`, the samples its script plays and when (`timeline`, frames at 60 Hz), the life of its track (`frames`) its priority in the sound driver and, for an FM effect (`type: fm`, no sample), its YM2612 voice (`voice`: algorithm, feedback, and by operator S1-S4 detune, multiple, attack, decays, sustain level, release, total level) and the detune word of its track (`detune`) |
| `jingles.json`, `jingles/XX.mp3` | The FM music of the Time Attack race, which is not stored as samples: recorded from the emulated game by `tools/export/recordJingles.js` (each command played alone, silence cut, mono MP3): start, lap done (`laps`: command by laps done), new lap record, pits, results (looping), start beeps of the lights |
| `sounds/pwm_jingle.wav` | The only 32X PWM sample (stereo, 22 kHz), played on game mode transitions |
| `physics.json` | Tables of the player car physics: gear ratios and shift points, torque curves, sine quarter wave, crash recovery; per car: parameters (named after the RAM variables they are loaded into), gears, drag tables and maximum speeds by gearbox, wheel probe offsets, hitbox, camera view transitions (playback order) |
| `race.json` | Start grids (per car, group demo / race / two_players, course: 18 `[x, y, z, heading]`), per-course section tables and lap time corrections at the line and the checkpoints, the music command after a checkpoint by laps done (`checkpointJingles`, mode Virtua Racing), the pit (`pit`: the 4 mechanics' animation frames of 4 models, where they stand by course and car, the pit boxes) and the mechanics' models (`pitModels`, car scale) |

## Model format

`{v, f}`: `v` is the flat list of vertex coordinates `x, y, z` (signed 16-bit;
`y` points down); `f` the faces, each `{c, i, d?, n?}`:

- `c`: palette index (flat colour);
- `i`: 3 or 4 vertex indices;
- `d`: 1 when the face is drawn from both sides (command bit $10 clear); otherwise only when its vertices turn clockwise on screen;
- `n`: face normal, used by the original game to shade the colour.

The original engine shifts car vertices left by `vertexShift` = 6 and scenery
vertices by 11 into its 16.16 fixed-point space: one scenery unit is 32 car
units. Scenery vertices are absolute world coordinates.

## Colours

RGB555 words: red bits 0-4, green 5-9, blue 10-14, bit 15 = through bit.

## Collision (`courses/<course>.json`, `collision`)

64 × 64 cells of 512 units from `origin` (x, z), one collision unit = `toScenery` scenery units. `layers[n].cells`
gives a record index per cell (row-major, z then x); a record is `null` (wall everywhere) or a list of convex
polygons `[selector, v1, v2 (x4), A, B, C, surface, flags, direction, section]`, tested and evaluated as by the
68K (see `tools/export/vrCollisionReader.js`). Highland has a second layer for its crossing.
