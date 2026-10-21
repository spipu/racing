/**
 * A car as the presentation reads it, the same on every device: written from the physics by the device that simulates
 * the race (capture), by the replica of the main's state elsewhere; its one-shot events go through RacingTurnEvents.
 * Units of the original (RacingCarPhysics): entity units, 1/65536 turn, km/h.
 */
class RacingCarState {
    constructor() {
        this.x            = 0;
        this.z            = 0;
        this.height       = 0;      // drawn: never under the road
        this.heading      = 0;
        this.shownSlip    = 0;
        this.pitch        = 0;
        this.roll         = 0;
        this.bodyYaw      = 0;
        this.bodyPitch    = 0;
        this.bodyRoll     = 0;
        this.slipInput    = 0;
        this.crashLift    = 0;      // +$9C
        this.steer        = 0;
        this.yawRate      = 0;
        this.autoDriven   = false;
        this.displaySpeed = 0;
        this.maxSpeed     = 0;
        this.rpm          = 0;
        this.smoothRpm    = 0;
        this.gear         = 0;
        this.lap          = 0;
        this.damage       = 0;
        this.crashRecovery = 0;
        this.roadFlags    = 0;
        this.pitCrewFrame = -1;     // $C026: the crew stands at the box from 0 on
        this.pitBox       = 0;      // the box of the car's stop (RacingPitBoxes)
        this.effectFrames = {smoke: -1, flames: -1, sparks: -1, grass: [-1, -1], sand: [-1, -1]};
        this.smokeX       = null;
    }

    /**
     * @param {RacingCarPhysics} physics - after its step
     */
    capture(physics) {
        this.x            = physics.x;
        this.z            = physics.z;
        this.height       = Math.max(physics.height, physics.roadHeight());
        this.heading      = physics.heading;
        this.shownSlip    = physics.shownSlip;
        this.pitch        = physics.pitch;
        this.roll         = physics.roll;
        this.bodyYaw      = physics.bodyYaw;
        this.bodyPitch    = physics.bodyPitch;
        this.bodyRoll     = physics.bodyRoll;
        this.slipInput    = physics.slipInput;
        this.crashLift    = physics.crashPose[0];
        this.steer        = physics.steer;
        this.yawRate      = physics.yawRate;
        this.autoDriven   = physics.isDrivenAutomatically();
        this.displaySpeed = physics.displaySpeed;
        this.maxSpeed     = physics.maxSpeed;
        this.rpm          = physics.rpm;
        this.smoothRpm    = physics.smoothRpm;
        this.gear         = physics.gear;
        // A car that starts behind the line shows its first lap before crossing it (user decision).
        this.lap          = Math.max(physics.lap, 0);
        this.damage       = physics.damage;
        this.crashRecovery = physics.crashRecovery;
        this.roadFlags    = physics.roadFlags;
        this.pitCrewFrame = physics.pitCrewFrame;
        this.pitBox       = physics.pitBox;
        this.smokeX       = physics.smokeX;
        const from = physics.effectFrames;
        const to   = this.effectFrames;
        to.smoke    = from.smoke;
        to.flames   = from.flames;
        to.sparks   = from.sparks;
        to.grass[0] = from.grass[0];
        to.grass[1] = from.grass[1];
        to.sand[0]  = from.sand[0];
        to.sand[1]  = from.sand[1];

        return this;
    }
}
