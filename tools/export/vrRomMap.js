/**
 * Locations of the data exported from Virtua Racing Deluxe (USA), as file offsets.
 * Each value was checked by parsing the ROM and against the emulated game (see the project notes).
 */
const VR_ROM_MAP = {
    // shadow: the only model of the bank lying flat at height 0, colour 4.
    // cockpit: interior view models, in the order of the player's render descriptors $FF6124 + n x $14 (n = 0..3);
    // the first one is the cockpit shell, the steering wheel with the driver's arms follows at $FF6174.
    // pitHidesShadow: the pit work hides the shadow with the wheels ($3CEC: the Formula only, $C8C8 = 0).
    // cockpitWheels: whether the cockpit view draws the front wheels (descriptors $FF6128 / $FF613C: flag 1 for the
    // Formula, 0 for the others, read in emulation).
    cars: [
        {
            code: 'formula',
            name: 'Formula',
            bank: {start: 0x280000, end: 0x283D96},
            body: 0x280000,
            shadow: 0x2806A8,
            cockpit: [0x281BA6, 0x2824AE, 0x2826E4, 0x281664],
            cockpitWheels: true,
            pitHidesShadow: true,
        },
        {
            code: 'stock',
            name: 'Stock',
            bank: {start: 0x283D96, end: 0x286EE2},
            body: 0x283D96,
            shadow: 0x284364,
            cockpit: [0x285524, 0x284FAA, 0x28506C, 0x28512E],
            cockpitWheels: false,
            pitHidesShadow: false,
        },
        {
            code: 'prototype',
            name: 'Prototype',
            bank: {start: 0x286EE2, end: 0x289CC8},
            body: 0x286EE2,
            shadow: 0x28750E,
            cockpit: [0x288738, 0x28819A, 0x28825C, 0x28831E],
            cockpitWheels: false,
            pitHidesShadow: false,
        },
    ],
    opponentBank:  {start: 0x289CC8, end: 0x28C43C},
    commonBank:    {start: 0x28C43C, end: 0x294E12},
    steeringWheel: 0x28211A,
    // Effect animations: frame tables of SDRAM pointers into the common bank (SDRAM $06033000 = file $28C43C).
    effects: {
        tyre_smoke:     {table: 0x159B0, frames: 8},
        sparks:         {table: 0x159D0, frames: 11},
        exhaust_flames: {table: 0x159FC, frames: 10},
        grass:          {table: 0x15A24, frames: 8},
        dirt:           {table: 0x15A44, frames: 8},
    },
    commonBankSdram: 0x06033000,
    // Render slots of the effects ($FF6178 + n x $14), placed at the race start ($CFAE) from a table of pointers by car
    // ($C8CC) to 8 offsets {x, y, z} in model units / 4: tyre smoke left and right (the left one mirrored), sparks,
    // exhaust flames, grass left and right, sand left and right. The left and right offsets are the same.
    effectSlots: {
        table: 0x8955CC,
        slots: ['smoke', 'smoke', 'sparks', 'flames', 'grass', 'grass', 'sand', 'sand'],
    },
    // Car scene block: pointers by car to the values the game copies to RAM $C710-$C74B. Exterior view: front left
    // wheel, front right wheel and rear axle models ($C714-$C71C, SDRAM pointers into the car bank, copied to
    // $0603C000 for every car), placed at the first 3 offsets of $C734 (render descriptors $FF6124 + n x $14, checked
    // in emulation); shadow $C720; cockpit view steering wheel at $C740; camera view transitions $C744. Offsets are in
    // model units / 4: the wheel bottoms land at height 0 with this scale.
    carScene: {
        table:           0x8956C8,
        first:           0xC710,
        bankSdram:       0x0603C000,
        wheelModels:     [0xC714, 0xC718, 0xC71C],
        shadowModel:     0xC720,
        wheelOffsets:    0xC734,
        steeringOffset:  0xC740,
        viewTransitions: 0xC744,
        // Damaged bodies on Acropolis and Highland ($2A86): one crash, two crashes and more; damaged cockpit shell.
        damagedModels:   [0xC748, 0xC74C],
        damagedCockpit:  0xC750,
        offsetScale:     4,
    },
    // Pit stops and mechanics (68K addresses; checked in emulation on Big Forest, Acropolis and Highland). The
    // mechanics' frames are not read: $895B7E, 4 SH2 pointers ($3CCE) to tables of 28 frames of 16 bytes (body, tool,
    // removed wheel, new wheel: SH2 model pointers, 0 = none), converted once into the game's glTF models. They stand
    // at the pit box of the course (mechanicBases: {x, y, z} by course, $3C7E) plus offsets by car (mechanicOffsets:
    // 4 x {dx, dz}: x + dx, z - dz).
    // pitBoxes: {x, z} of the 4 boxes of each course ($A868); approachX: x offset of the automatic approach ($A8C8).
    pit: {
        mechanicBases:   {address: 0x883C2A, words: 3},
        mechanicOffsets: {address: 0x883C4E, words: 8},
        pitBoxes:        {address: 0x88A868, words: 8},
        approachX:       0x88A8C8,
    },
    courses: [
        {code: 'big_forest', name: 'Big Forest', sceneryGrid: 0x15C000, sky: {map: 0x100000, tiles: 0x103B8E}, collision: [{map: 0x94C000, base: 0x970000}]},
        {code: 'bay_bridge', name: 'Bay Bridge', sceneryGrid: 0x15D000, sky: {map: 0x1005B2, tiles: 0x105A7E}, collision: [{map: 0x94E000, base: 0x988000}]},
        {code: 'acropolis',  name: 'Acropolis',  sceneryGrid: 0x15E000, sky: {map: 0x100A7C, tiles: 0x1077CE}, collision: [{map: 0x950000, base: 0x9A0000}]},
        {code: 'highland',   name: 'Highland',   sceneryGrid: 0x15F000, sky: {map: 0x1023A4, tiles: 0x10C30E}, collision: [{map: 0x954000, base: 0x9B8000}, {map: 0x956000, base: 0x9C4110}]},
        {code: 'sand_park',  name: 'Sand Park',  sceneryGrid: 0x161000, sky: {map: 0x10102A, tiles: 0x10992E}, collision: [{map: 0x958000, base: 0x9D0000}]},
    ],
    // Sky panorama (Mega Drive plane B): Enigma map of skyColumns cells per row, Kosinski tiles,
    // 4 palette lines at skyPalettes.start + course index x stride.
    skyColumns:       128,
    // Row of the panorama on the horizon: the sky ends there on every course (measured on the exported images).
    skyHorizonRow:    88,
    skyPalettes:      {start: 0x3B1DC, stride: 0x80},
    // Collision layers (68K addresses, tables $742C / $745C): segment map + polygon records; Highland has a second
    // layer for its crossing, entered and left through polygons whose flags bit 0 is set. One collision unit = 2 scenery units.
    collisionGridSize: 64,
    collisionCellSize: 512,
    collisionOrigin:   -16384,
    collisionToScenery: 2,
    collisionSectionField: 15,
    // Sounds: Z80 driver (DAC sample table), sound effect scripts ($A0-$D2, 68K pointers), the 32X PWM sample.
    soundDriver:     0x31688,
    dacSampleCount:  49,
    soundEffects:    {table: 0x39150, first: 0xA0, last: 0xD2, scriptMaxLength: 64, scriptEnd: 0xF2, dacCommand: [0xFF, 0x07], priorities: 0x32B30},
    pwmSample:       {offset: 0x260000, frames: 56207, rate: 22000},
    // Race sound effects whose trigger was read in the 68K code.
    soundEffectRoles: {
        0x90: 'pit_in',
        0x91: 'pit_out',
        0xB0: 'crash',
        0xB1: 'skid',
        0xB2: 'spin',
        0xB4: 'tyre_squeal',
        0xC0: 'countdown_3',
        0xC1: 'countdown_2',
        0xC2: 'countdown_1',
        0xC3: 'countdown_go',
    },
    // Jingles of the Time Attack race, FM music recorded from the emulated game (tools/export/recordJingles.js): music
    // commands of the mailbox $C8A5 — the start ($93, then the DAC $C6 it chains), the lap done (table by laps done
    // $8989EE, $34E8 state 36), a new record of the lap ($97, then the voice $CB), the pits ($90 / $91), the results
    // ($8E, looping) — and the FM start beeps of the lights ($A6 / $A7, effects mailbox $C8A4).
    jingles: {
        start:   0x93,
        laps:    {table: 0x8989EE, count: 10},
        record:  0x97,
        pitIn:   0x90,
        pitOut:  0x91,
        results: 0x8E,
        beeps:   [0xA6, 0xA7],
        // Work RAM words poked to play one: $C822 (immediate command, $F3 stops every voice), $C8A4 / $C8A5.
        stopMailbox:  0xFFC822,
        soundMailbox: 0xFFC8A4,
        stopAll:      0xF3,
        firstEffect:  0xA0,
    },
    // Game tables (68K addresses), read by VrGameDataReader.
    gameData: {
        carParams:       0x898818, // 3 pointers (by car) to: gear table pointer + 14 words loaded into the RAM variables below
        carParamNames:   ['C0E6', 'C0E8', 'C0EA', 'C0EC', 'C0EE', 'C0F0', 'C0F2', 'C0F4', 'C0F6', 'C8CE', 'C8D0', 'C8D2', 'C0F8', 'C0FA'],
        carGears:        7,
        gearRatios:      {address: 0x88A1F0, words: 6},
        upshiftRpm:      {address: 0x88A1E2, words: 7},
        downshiftRpm:    {address: 0x939EDE, words: 7},
        torqueAutomatic: {address: 0x938FCE, words: 160},
        torqueManual:    {address: 0x93910E, words: 160},
        dragTables:      0x88A1CA, // pointers by car x 2 + manual
        dragWords:       400,
        maxSpeeds:       0x88A218, // speedWords words by car x 2 + manual
        maxSpeedWords:   16,
        sinTable:        {address: 0x930000, words: 257},
        atanLow:         {address: 0x930202, words: 256}, // ratio < $400, by 4
        atanHigh:        {address: 0x930402, words: 153}, // ratio $400..$D8E, by 16
        rollTable:       {address: 0x93A02C, words: 512}, // car roll by height gap of the front probes ($70AA)
        pitchTable:      {address: 0x93A42C, words: 512}, // car pitch by height gap of the left probes
        crashRecovery:   {address: 0x939EEC, words: (41 * 4), chunk: 4}, // +$9C..+$A2 by recovery tick 0..40
        shakeTable:      {address: 0x88A2D8, words: 60}, // body yaw of a shock by tick ($A350: LEA $A2D8, +$6C from 0 or 30, up to 59)
        probeOffsets:    0x930612, // pointers by car to probePages pages of probeCount (dx, dz) byte pairs, probePageBytes apart
        probePages:      4,
        probeCount:      1024,
        probePageBytes:  0x800,
        hitboxBounds:    0x9305D6, // pointers by car to hitboxWords words
        hitboxWords:     8,
        // Car against car ($AE0A): once a corner of the second car hits, its table pointer is set to $AE06 (LEA ...(PC),
        // a bug of the original) and the next corners read the (dx, dz) byte pairs of the code there, probePageBytes apart.
        contactStrayPairs: {address: 0x88AE06, count: 3},
        viewTransitions: 16, // old view x 4 + new view
        viewTransitionFrames: 20,
        startGrids:      0x9382BA, // pointers by car to 3 groups x 6 courses of pointers to 18 records {x, y, z, heading}
        startGridGroups: ['demo', 'race', 'two_players'],
        startGridCourses: 6,
        startGridRecords: 18,
        courseProgress:  0x898A04, // by course x 20: section word pairs ($C700), section progress bytes ($C704), ...
        courseProgressStride: 20,
        // In the block: +8 crash sections ($C708, 2 bytes per progress: race then pit lane), +12 pit lane path ($C70C),
        // +16 race path (entity +$B2): {x, z, speed} words by progress, the opponents' racing line.
        pathPointsAfterLast: 3,
        // Time taken off a lap at the line ($B2E4: (K + +$E2) x 800 / +$06 ms, at most 50) and at the checkpoints
        // ($B386: K of checkpoint 1 then 2), by course.
        lineCorrection:        0x88B2D8,
        // Mode Virtua Racing ($81D8): the music command 20 ticks after a checkpoint, by laps done.
        checkpointJingles:     {address: 0x888256, count: 5},
        checkpointCorrections: 0x88B36E,
    },
    // Objects placed around a course besides the scenery grid (VrCourseObjectReader): $37B6 places one of 3 animated
    // objects of each course (start banner, checkpoint banners: x, y, z, yaw, scale, frame table pointer), then jumps
    // to the routine of the course (table $3844): two-part objects (28 bytes: parent then child words and model
    // pointer), lists of one model, single objects. The animations turn an angle by a counter ($C8E2) each tick.
    courseObjects: {
        animated: {table: 0x895A64, count: 3, entryBytes: 14, frames: 6, frameTicks: 2},
        byCourse: {
            big_forest: [
                {kind: 'pair', address: 0x883924, animation: {part: 1, angle: 'roll', perTick: 3}}, // Ferris wheel ($385E)
                {kind: 'pair', address: 0x883940, animation: {part: 1, angle: 'roll', perTick: 3, swing: 4}}, // swing boat
            ],
            bay_bridge: [
                {kind: 'list', address: 0x883A4E, count: 4, model: 0x22295A24}, // barriers ($395C)
                {kind: 'pair', address: 0x883A80, animation: {part: 1, angle: 'roll', perTick: 30}}, // windmill
                {kind: 'single', address: 0x883A76, model: 0x222A218E}, // tower, shown with the windmill
            ],
            highland: [
                {kind: 'single', address: 0x883A9C, angle: 'roll', animation: {part: 0, angle: 'yaw', perTick: 60}}, // weather vane ($3AAA)
            ],
        },
    },
    // Map of each course on the HUD (table $15668, copied by $CBCA): 16 bytes by course {x, y, z, 0, model pointer};
    // the model is a flat outline of the course in scenery units, same origin and axes as the course.
    courseMaps: {table: 0x895668, stride: 16, modelPointer: 8},
    sceneryGridSize:  32,
    sceneryEmptyCell: 0x2207FFFE,
    coursePalettes:   {start: 0x3A238, stride: 0x200, colors: 256},
    carPalettes:      {start: 0x3AE44, stride: 0x80, colors: 64, firstIndex: 32},
    // SH2 vertex loaders: car models are shifted left by 6, scenery by 11 into the 16.16 engine.
    carVertexShift:     6,
    sceneryVertexShift: 11,
};

module.exports = {VR_ROM_MAP};
