# Spipu-Racing

A PWA racing game after Virtua Racing Deluxe (Sega 32X). Personal project, not distributed: the data of the original game (© SEGA 1994) must not be redistributed. The game is free and non-profit: any commercial use, direct or indirect (sale, rental, advertising, subscription, donations or any other form of payment), is prohibited.

## The game

- **Time trial**: alone on the track, on the five courses of the original (Big Forest, Bay Bridge, Acropolis, Highland, Sand Park) and their mirrored versions, with the three cars (Formula, Stock, Prototype) in automatic or manual transmission; from 5 to 50 laps.
- **True to the original**: models, colours, skies, physics, collisions, cameras and sound effects taken from the ROM, in high definition and at the screen's frame rate.
- **How a race goes**: pit start with the mechanics at Big Forest, start lights elsewhere; lap times, gaps to the record at the checkpoints, lap messages, wrong way; at the finish, the results (time of each lap, best lap, total time, new records).
- **Damage and pits**: a head-on crash at full speed damages the car; at Big Forest, Acropolis and Highland, a pit stop repairs it, with the mechanics animated.
- **Modern HUD**: rev counter, speed in km/h or mph, gear, laps, fastest lap and the times of the last laps.
- **Four views**: cockpit with the steering wheel and the driver's arms, close chase, far chase, high view.
- **Sound**: the original's sound effects and jingles, the engine computed as the console's FM chip does, its pitch following the revs.
- **Controls**: keyboard, gamepad or touch controls, chosen automatically or forced, remappable in the options.
- **Records**: fastest lap and best race kept on the device, by course, version and car, shown and erased in "Best laps".
- **Menus and help**: pause menu, options (display, race, sound, controls), a help explaining how a race goes; in English, French, Italian and Spanish.
- **Installable application**, usable offline.
- To come: a map of the course in the HUD, races with several players over the network.

## Tree

```
bench/             reference traces of the original game, recording and comparison of the physics and of the race
├── recorder/      trace recorder (libretro front end in C for PicoDrive)
├── goldens/       measures a check must not exceed (the pit mechanic's speed jumps)
├── scenarios/     input scenarios replayed in the original game
└── traces/        recorded traces (one JSON line per frame, gzip)
tools/
├── export/        exporter of the ROM data to website/assets/virtual_racing/
├── icon/          icon set generation from website/icon/icon.svg
└── pitCrewViewer/ viewer of the pit crew models around the cars
website/           the application, served as is
```

`website/js/engine/` (Spipu3D, the 3D engine) and `website/js/webapp/` (the PWA core) are copied unchanged from their reference repository, [spipu/3d-engine](https://github.com/spipu/3d-engine), which also holds their checks and examples.

## Test locally

```bash
python3 -m http.server 8082 --directory website
```

Then `http://localhost:8082/`.

## Reference traces

Prerequisites, outside the repository: in `.source/`, the ROM `Virtua Racing Deluxe (USA).32x` (MD5 `72b1ad0f949f68da7d0a6339ecd51a3f`) and the compiled PicoDrive libretro core (`.source/picodrive/picodrive_libretro.so`, `make -f Makefile.libretro`).

```bash
node bench/recordTraces.js              # every scenario
node bench/recordTraces.js wall         # one scenario
```

Each scenario replays the Time Attack menu navigation (car, transmission, course), then its inputs; the trace keeps, frame by frame from the start, the state of the player's car and the game's global variables. A `poke <address> <word>` line writes to the game's RAM (the car placed before the pits or the finish line, damage); the comparison then starts again from the traced state. A `from load` line records from the loading of the race (before the opening), `block <address> <bytes>` traces one more RAM block, `autopilot <frames>` has the original game drive the car along its racing line.

## Physics comparison

```bash
node bench/comparePhysics.js                         # every scenario, tick by tick
node bench/comparePhysics.js wall --ticks 50         # one scenario, its first 50 ticks
node bench/comparePhysics.js --continuous --rate 3   # variable step physics, 3 steps a tick
```

The default mode chains `RacingCarPhysics` tick by tick from the first state of the trace: each field that differs from the original game is reported, then set back to the trace. Every scenario must come out `identical`. The `--continuous` mode lets `RacingCarContinuousPhysics` run freely and measures the gap in path (metres) and speed (%); it fails beyond 1.5 m or 2 %. The `views` and `views_3button` scenarios serve the camera transitions: they are compared only when named; the races recorded from their loading belong to the race comparison.

## Race comparison

```bash
node bench/compareRace.js                              # the races recorded from their loading
node bench/compareRace.js race_big_forest --show 1-30  # the detail of chosen ticks
```

Replays a whole race (start, laps, checkpoints, pit stop, finish) and compares tick by tick what the player sees and hears: start signs, lights, mechanics, messages, checkpoint gaps, pit stop, blinds, race sounds, lap times and the arrival of the results. The recorded races cover the five courses and a race with a pit stop; all must come out `identical`.

## Pit crew models

```bash
node bench/pitMechanic.js            # speed jumps of the mechanic's clips against their goldens
node bench/pitMechanic.js --update   # writes the goldens again, for a wanted change of the model only
node bench/comparePitCrew.js         # the game's crew against the original's timing, its wheels on the cars' hubs
python3 -m http.server 8085          # from the repository root, then http://localhost:8085/tools/pitCrewViewer/
```

The mechanics and their wheel gun are glTF files of `website/assets/virtual_racing/models/`, converted once from the original's animation frames. The first bench samples each clip every 0.1 ms and fails when a joint or a socket changes speed more sharply than its golden. The second plays the game's crew at the original's tick and at the game's frame rates: each event must fall on the tick the original shows it, and around each car, mirrored or not, each wheel taken off or put back must lie on the car's hub. The viewer plays the game's crew around each car on the Big Forest box, at any time, image by image or at any speed, each mechanic looked at closer.

## Data of the original game

```bash
node tools/export/exportVirtualRacing.js     # USA ROM in .source/, see website/assets/virtual_racing/README.md
node tools/export/recordJingles.js           # FM jingles recorded from the emulated game (PicoDrive core and ffmpeg needed)
```

## Icons

```bash
node tools/icon/buildIcons.js                # regenerates the PNGs and favicon.ico from website/icon/icon.svg
```
