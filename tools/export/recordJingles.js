#!/usr/bin/env node
/**
 * Records the FM jingles of the Time Attack race from the emulated game, run from the repository root:
 *
 *   node tools/export/recordJingles.js
 *
 * The music of the YM2612 is not stored as samples: each jingle (VR_ROM_MAP.jingles) is played by the original
 * itself, in a race on the grid of Bay Bridge (bench/recorder, PicoDrive libretro core, ROM USA): every voice
 * stopped ($C822 = $F3), its command written to its mailbox ($C8A5 music, $C8A4 effects), the sound output recorded.
 * The silence before and after is cut, the results music kept for RESULTS_SECONDS (it loops), and each one encoded
 * in mono MP3 by ffmpeg into website/assets/virtual_racing/jingles/, listed in jingles.json.
 */
const childProcess = require('child_process');
const fs           = require('fs');
const path         = require('path');

const {VrRom}                    = require('./vrRom');
const {VR_ROM_MAP}               = require('./vrRomMap');
const {VrModelEncoder}           = require('./vrModelEncoder');
const {TraceRecorder, RECORDER_DIR, RECORDER_PATH, CORE_PATH, ROM_PATH} = require('../../bench/recordTraces');

class JingleRecorder {
    run() {
        const recorder = new TraceRecorder([]);
        recorder.checkRom();
        childProcess.execFileSync(path.join(RECORDER_DIR, 'build.sh'), {stdio: 'inherit'});
        fs.mkdirSync(JingleRecorder.WORK_DIR, {recursive: true});
        fs.mkdirSync(JingleRecorder.OUTPUT_DIR, {recursive: true});

        const map   = VR_ROM_MAP.jingles;
        const rom   = new VrRom(ROM_PATH);
        const laps  = Array.from(rom.getBytes(rom.fileFrom68k(map.laps.table), map.laps.count));
        const roles = new Map([[map.start, 'start'], [map.record, 'record'], [map.pitIn, 'pit_in'], [map.pitOut, 'pit_out'],
            [map.results, 'results'], ...map.beeps.map((id, i) => [id, 'beep_' + (i + 1)])]);
        for (const id of laps) {
            if (!roles.has(id)) {
                roles.set(id, 'lap');
            }
        }
        const menu     = recorder.menuInputs(JingleRecorder.SETUP);
        const jingles  = {};
        for (const [id, role] of roles) {
            const code = VrModelEncoder.hex(id, JingleRecorder.ID_DIGITS);
            const loop = (id === map.results);
            jingles[code] = {role: role, file: (code + '.mp3'), loop: loop, ms: this._record(menu, id, code, loop)};
            process.stdout.write('jingle ' + code + ' (' + role + '): ' + jingles[code].ms + ' ms\n');
        }
        const output = {
            format:  JingleRecorder.FORMAT,
            jingles: jingles,
            laps:    laps.map((id) => VrModelEncoder.hex(id, JingleRecorder.ID_DIGITS)),
        };
        fs.writeFileSync(path.join(JingleRecorder.OUTPUT_DIR, '..', 'jingles.json'), JSON.stringify(output) + '\n');
    }

    // One run of the game: the jingle alone, recorded, trimmed and encoded.
    _record(menu, id, code, loop) {
        const wav     = path.join(JingleRecorder.WORK_DIR, code + '.wav');
        const map     = VR_ROM_MAP.jingles;
        const hex     = (value, digits) => VrModelEncoder.hex(value, digits);
        // The high byte of a word is its even address: $C8A4 effects, $C8A5 music.
        const mailbox = ((id < map.firstEffect) ? id : (id << 8));
        const seconds = ((loop) ? JingleRecorder.RESULTS_SECONDS : JingleRecorder.JINGLE_SECONDS);
        const lines   = [
            ...menu,
            JingleRecorder.RACE_WAIT + ' -',
            'poke ' + hex(map.stopMailbox, 6) + ' ' + hex((map.stopAll << 8), 4),
            JingleRecorder.SILENCE_WAIT + ' -',
            'audio ' + wav,
            'poke ' + hex(map.soundMailbox, 6) + ' ' + hex(mailbox, 4),
            Math.round(seconds * JingleRecorder.FRAMES_PER_SECOND) + ' -',
            'audio stop',
        ];
        const trace = path.join(JingleRecorder.WORK_DIR, code + '.jsonl');
        childProcess.execFileSync(RECORDER_PATH, [CORE_PATH, ROM_PATH, '-', trace], {input: lines.join('\n') + '\n', stdio: ['pipe', 'ignore', 'pipe']});
        fs.unlinkSync(trace);

        const [start, end] = this._sound(wav);
        const length = ((loop) ? (seconds - start) : ((end - start) + JingleRecorder.TAIL_SECONDS));
        childProcess.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(4), '-t', length.toFixed(4), '-i', wav,
            '-ac', '1', '-ar', String(JingleRecorder.RATE), '-b:a', JingleRecorder.BITRATE, path.join(JingleRecorder.OUTPUT_DIR, code + '.mp3')]);
        fs.unlinkSync(wav);

        return Math.round(length * 1000);
    }

    // First and last sound of a 16-bit stereo WAV, in seconds.
    _sound(wav) {
        const bytes  = fs.readFileSync(wav);
        const rate   = bytes.readUInt32LE(JingleRecorder.WAV_RATE_OFFSET);
        const frames = ((bytes.length - JingleRecorder.WAV_HEADER) / 4);
        let first = -1;
        let last  = 0;
        for (let i = 0; i < frames; i++) {
            const at = (JingleRecorder.WAV_HEADER + (i * 4));
            if ((Math.abs(bytes.readInt16LE(at)) > JingleRecorder.SILENCE) || (Math.abs(bytes.readInt16LE(at + 2)) > JingleRecorder.SILENCE)) {
                first = ((first < 0) ? i : first);
                last  = i;
            }
        }
        if (first < 0) {
            throw new Error(wav + ': nothing recorded');
        }

        return [(first / rate), (last / rate)];
    }
}

JingleRecorder.ROOT_DIR          = path.resolve(__dirname, '..', '..');
JingleRecorder.WORK_DIR          = path.join(JingleRecorder.ROOT_DIR, '.tmp.claude', 'jingles');
JingleRecorder.OUTPUT_DIR        = path.join(JingleRecorder.ROOT_DIR, 'website', 'assets', 'virtual_racing', 'jingles');
JingleRecorder.FORMAT            = 1;
JingleRecorder.ID_DIGITS         = 2;
// A race of the Formula on the grid of Bay Bridge, its start over (its own jingle and beeps gone).
JingleRecorder.SETUP             = {car: 'formula', transmission: 'automatic', course: 'bay_bridge'};
JingleRecorder.RACE_WAIT         = 700;
JingleRecorder.SILENCE_WAIT      = 30;
JingleRecorder.FRAMES_PER_SECOND = 60;
JingleRecorder.JINGLE_SECONDS    = 20;
JingleRecorder.RESULTS_SECONDS   = 90;
JingleRecorder.TAIL_SECONDS      = 0.05;
JingleRecorder.SILENCE           = 64;
JingleRecorder.WAV_HEADER        = 44;
JingleRecorder.WAV_RATE_OFFSET   = 24;
JingleRecorder.RATE              = 32000;
JingleRecorder.BITRATE           = '80k';

try {
    new JingleRecorder().run();
} catch (error) {
    process.stderr.write(String(error.stack ?? error) + '\n');
    process.exitCode = 1;
}
