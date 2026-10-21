/**
 * The StateSnapshot of a turn, events included, to and from its binary message, as DoomNetStateCodec: pure encode /
 * decode, fields in a fixed order, little-endian throughout (NetByteWriter / NetByteReader). Float32 for every value
 * of a car and of a race's times (the integers of the original stay exact below 2^24), integers for ids, counts,
 * flags and codes; the sound commands travel as ASCII. Decoding is fail-fast: the whole message is read before it is
 * handed over, and a read that does not end exactly on its last byte is refused.
 *
 * Layout: type, turn, ticks; then the cars (id, car state, race display), the end of the race (time left, over, the
 * abandons), then the events — each section behind its count.
 */
class RacingNetStateCodec {
    /**
     * @param {object} snapshot - a RacingNetStateCapture StateSnapshot
     * @returns {ArrayBuffer}
     */
    static encode(snapshot) {
        const w = new NetByteWriter();
        w.u8(RacingNetProtocol.MESSAGE_STATE).u32(snapshot.turn).f32(snapshot.ticks);
        w.u8(snapshot.cars.length);
        for (const car of snapshot.cars) {
            w.u8(car.id);
            RacingNetStateCodec._writeCar(w, car.car);
            RacingNetStateCodec._writeRace(w, car.race);
        }
        const outcome = snapshot.outcome;
        w.u8(((outcome.countdownMs !== null) ? RacingNetStateCodec.OUTCOME_COUNTDOWN : 0) | ((outcome.over) ? RacingNetStateCodec.OUTCOME_OVER : 0))
            .f32(outcome.countdownMs ?? 0).u8(outcome.abandons.length);
        for (const id of outcome.abandons) {
            w.u8(id);
        }
        w.u16(snapshot.events.length);
        for (const event of snapshot.events) {
            RacingNetStateCodec._writeEvent(w, event);
        }

        return w.toBytes().buffer;
    }

    /**
     * @param {ArrayBuffer} buffer
     * @returns {object} the StateSnapshot, its cars' states as plain objects of the fields of RacingCarState and
     *                   RacingRaceView
     * @throws {NetError} INVALID_MESSAGE, or a RangeError read past the end
     */
    static decode(buffer) {
        const r = new NetByteReader(new Uint8Array(buffer));
        if (r.u8() !== RacingNetProtocol.MESSAGE_STATE) {
            throw new NetError(NetError.INVALID_MESSAGE, 'Not a state message');
        }
        const snapshot = {turn: r.u32(), ticks: r.f32(), cars: [], events: []};
        const cars     = r.u8();
        for (let i = 0; i < cars; i++) {
            snapshot.cars.push({id: r.u8(), car: RacingNetStateCodec._readCar(r), race: RacingNetStateCodec._readRace(r)});
        }
        const flags     = r.u8();
        const countdown = r.f32();
        const abandons  = r.u8();
        snapshot.outcome = {
            countdownMs: (((flags & RacingNetStateCodec.OUTCOME_COUNTDOWN) !== 0) ? countdown : null),
            over:        ((flags & RacingNetStateCodec.OUTCOME_OVER) !== 0),
            abandons:    Array.from({length: abandons}, () => r.u8())
        };
        const events = r.u16();
        for (let i = 0; i < events; i++) {
            snapshot.events.push(RacingNetStateCodec._readEvent(r));
        }
        if (!r.isAtEnd()) {
            throw new NetError(NetError.INVALID_MESSAGE, 'State message longer than its content');
        }

        return snapshot;
    }

    // --- Car ---

    static _writeCar(w, car) {
        for (const field of RacingNetStateCodec.CAR_FIELDS) {
            w.f32(car[field]);
        }
        const frames = car.effectFrames;
        for (const value of [frames.smoke, frames.flames, frames.sparks, frames.grass[0], frames.grass[1], frames.sand[0], frames.sand[1]]) {
            w.f32(value);
        }
        w.u8(((car.autoDriven) ? RacingNetStateCodec.CAR_AUTO_DRIVEN : 0) | ((car.smokeX !== null) ? RacingNetStateCodec.CAR_SMOKE_X : 0));
        if (car.smokeX !== null) {
            w.f32(car.smokeX[0]).f32(car.smokeX[1]);
        }
    }

    static _readCar(r) {
        const car = {};
        for (const field of RacingNetStateCodec.CAR_FIELDS) {
            car[field] = r.f32();
        }
        car.effectFrames = {smoke: r.f32(), flames: r.f32(), sparks: r.f32(), grass: [r.f32(), r.f32()], sand: [r.f32(), r.f32()]};
        const flags      = r.u8();
        car.autoDriven   = ((flags & RacingNetStateCodec.CAR_AUTO_DRIVEN) !== 0);
        car.smokeX       = (((flags & RacingNetStateCodec.CAR_SMOKE_X) !== 0) ? [r.f32(), r.f32()] : null);

        return car;
    }

    // --- Race display ---

    static _writeRace(w, race) {
        w.u16(race.laps).u16(race.lapTimes.length);
        for (const lapMs of race.lapTimes) {
            w.f32(lapMs);
        }
        w.f32(race.lapMs).f32(race.blinds).u32(race.blink).u8(race.place);
        w.u8(((race.stopped) ? RacingNetStateCodec.RACE_STOPPED : 0) | ((race.resultsDue) ? RacingNetStateCodec.RACE_RESULTS_DUE : 0)
            | ((race.newRecord) ? RacingNetStateCodec.RACE_NEW_RECORD : 0));
        const flags = ((race.started) ? RacingNetStateCodec.RACE_STARTED : 0)
            | ((race.finished) ? RacingNetStateCodec.RACE_FINISHED : 0)
            | ((race.pitStartSign) ? RacingNetStateCodec.RACE_PIT_START_SIGN : 0)
            | ((race.reverse) ? RacingNetStateCodec.RACE_REVERSE : 0)
            | ((race.pitWork) ? RacingNetStateCodec.RACE_PIT_WORK : 0)
            | ((race.record !== null) ? RacingNetStateCodec.RACE_RECORD : 0)
            | ((race.message !== null) ? RacingNetStateCodec.RACE_MESSAGE : 0)
            | ((race.split !== null) ? RacingNetStateCodec.RACE_SPLIT : 0);
        w.u8(flags).u8(RacingNetStateCodec.START_SIGNS.indexOf(race.startSign)).u8(RacingNetStateCodec.LIGHTS.indexOf(race.lights));
        if (race.record !== null) {
            w.f32(race.record.lapMs);
        }
        if (race.message !== null) {
            w.u8(RacingNetStateCodec.MESSAGE_KINDS.indexOf(race.message.kind)).f32(race.message.ms).u8(((race.message.shown) ? 1 : 0));
        }
        if (race.split !== null) {
            w.f32(race.split.ms).u8(((race.split.shown) ? 1 : 0));
        }
    }

    static _readRace(r) {
        const race    = {laps: r.u16(), lapTimes: []};
        const count   = r.u16();
        for (let i = 0; i < count; i++) {
            race.lapTimes.push(r.f32());
        }
        race.lapMs  = r.f32();
        race.blinds = r.f32();
        race.blink  = r.u32();
        race.place  = r.u8();
        const end   = r.u8();
        race.stopped    = ((end & RacingNetStateCodec.RACE_STOPPED) !== 0);
        race.resultsDue = ((end & RacingNetStateCodec.RACE_RESULTS_DUE) !== 0);
        race.newRecord  = ((end & RacingNetStateCodec.RACE_NEW_RECORD) !== 0);
        const flags = r.u8();
        race.started      = ((flags & RacingNetStateCodec.RACE_STARTED) !== 0);
        race.finished     = ((flags & RacingNetStateCodec.RACE_FINISHED) !== 0);
        race.pitStartSign = ((flags & RacingNetStateCodec.RACE_PIT_START_SIGN) !== 0);
        race.reverse      = ((flags & RacingNetStateCodec.RACE_REVERSE) !== 0);
        race.pitWork      = ((flags & RacingNetStateCodec.RACE_PIT_WORK) !== 0);
        race.startSign    = RacingNetStateCodec._code(RacingNetStateCodec.START_SIGNS, r.u8());
        race.lights       = RacingNetStateCodec._code(RacingNetStateCodec.LIGHTS, r.u8());
        race.record       = (((flags & RacingNetStateCodec.RACE_RECORD) !== 0) ? {lapMs: r.f32()} : null);
        race.message      = (((flags & RacingNetStateCodec.RACE_MESSAGE) !== 0)
            ? {kind: RacingNetStateCodec._code(RacingNetStateCodec.MESSAGE_KINDS, r.u8()), ms: r.f32(), shown: (r.u8() === 1)}
            : null);
        race.split        = (((flags & RacingNetStateCodec.RACE_SPLIT) !== 0) ? {ms: r.f32(), shown: (r.u8() === 1)} : null);

        return race;
    }

    // --- Events ---

    static _writeEvent(w, event) {
        w.u8(RacingNetStateCodec.EVENT_TYPES.indexOf(event.type)).u8(event.playerId);
        if (event.type === RacingTurnEvents.SOUND) {
            w.ascii(event.command);
            return;
        }
        if (event.type === RacingTurnEvents.LAP_RECORD) {
            // A split the lap went without (a checkpoint missed) travels as NaN.
            w.f32(event.lapMs);
            for (const ms of event.checkpointsMs) {
                w.f32(ms ?? NaN);
            }
            return;
        }
        for (const value of [...event.delays, ...event.speeds]) {
            w.f32(value);
        }
    }

    static _readEvent(r) {
        const type     = RacingNetStateCodec._code(RacingNetStateCodec.EVENT_TYPES, r.u8());
        const playerId = r.u8();
        if (type === RacingTurnEvents.SOUND) {
            return {type: type, playerId: playerId, command: r.ascii()};
        }
        if (type === RacingTurnEvents.LAP_RECORD) {
            const lapMs  = r.f32();
            const splits = Array.from({length: RacingNetStateCodec.CHECKPOINTS}, () => r.f32());

            return {type: type, playerId: playerId, lapMs: lapMs, checkpointsMs: splits.map((ms) => (Number.isNaN(ms) ? null : ms))};
        }
        const count  = RacingPitCrewSchedule.MECHANICS;
        const delays = Array.from({length: count}, () => r.f32());
        const speeds = Array.from({length: count}, () => r.f32());

        return {type: type, playerId: playerId, delays: delays, speeds: speeds};
    }

    // A code out of its table is a message this version cannot read.
    static _code(table, index) {
        if (index >= table.length) {
            throw new NetError(NetError.INVALID_MESSAGE, 'Unknown code ' + index);
        }

        return table[index];
    }
}

// The numbers of a RacingCarState, in a fixed order (the effect frames, the flags and the smoke follow).
RacingNetStateCodec.CAR_FIELDS = [
    'x', 'z', 'height', 'heading', 'shownSlip', 'pitch', 'roll', 'bodyYaw', 'bodyPitch', 'bodyRoll', 'slipInput',
    'crashLift', 'steer', 'yawRate', 'displaySpeed', 'maxSpeed', 'rpm', 'smoothRpm', 'gear', 'lap', 'damage',
    'crashRecovery', 'roadFlags', 'pitCrewFrame', 'pitBox'
];
RacingNetStateCodec.CAR_AUTO_DRIVEN = 1;
RacingNetStateCodec.CAR_SMOKE_X     = 2;

RacingNetStateCodec.RACE_STARTED        = 1;
RacingNetStateCodec.RACE_FINISHED       = 2;
RacingNetStateCodec.RACE_PIT_START_SIGN = 4;
RacingNetStateCodec.RACE_REVERSE        = 8;
RacingNetStateCodec.RACE_PIT_WORK       = 16;
RacingNetStateCodec.RACE_RECORD         = 32;
RacingNetStateCodec.RACE_MESSAGE        = 64;
RacingNetStateCodec.RACE_SPLIT          = 128;
RacingNetStateCodec.RACE_STOPPED        = 1;
RacingNetStateCodec.RACE_RESULTS_DUE    = 2;
RacingNetStateCodec.RACE_NEW_RECORD     = 4;
RacingNetStateCodec.OUTCOME_COUNTDOWN   = 1;
RacingNetStateCodec.OUTCOME_OVER        = 2;
// The splits of a lap record: the checkpoints of a lap (RacingRaceControl).
RacingNetStateCodec.CHECKPOINTS         = 2;

// The code byte of each value: its rank in the table, fixed.
RacingNetStateCodec.START_SIGNS   = [null, 3, 2, 1, RacingRaceControl.SIGN_GO, RacingRaceControl.SIGN_READY];
RacingNetStateCodec.LIGHTS        = [null, RacingRaceControl.LIGHTS_OFF, RacingRaceControl.LIGHTS_RED, RacingRaceControl.LIGHTS_GREEN];
RacingNetStateCodec.MESSAGE_KINDS = ['lapTime', 'bestLap', 'fastestLap'];
RacingNetStateCodec.EVENT_TYPES   = [RacingTurnEvents.SOUND, RacingTurnEvents.CREW_STARTED, RacingTurnEvents.LAP_RECORD];
