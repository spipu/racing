/**
 * An animated model, loaded once and shared by every instance: skeleton,
 * skinned mesh, materials (no palette applied: a material may carry a
 * paletteIndex in its extras), clips and sockets by name. An AnimatedInstance
 * draws and animates one copy of it.
 */
class AnimatedModel extends AbstractLoadedEntity {
    constructor(id, url, callback) {
        super(id, url, callback);

        this._skeleton  = null;
        this._mesh      = null;
        this._materials = [];
        this._clips     = new Map();
        this._sockets   = new Map();
    }

    /**
     * @param {{skeleton: Skeleton, mesh: SkinnedMesh, materials: {color: number[], doubleSided: boolean, extras: object}[],
     *          clips: AnimationClip[], sockets: SkeletonSocket[]}} data - material colors [r, g, b, a] 0-1
     */
    populate(data) {
        const joints = data.skeleton.getJointCount();
        AnimatedModel._check((data.mesh.getHighestJoint() < joints), 'a vertex follows a joint the skeleton lacks');
        data.mesh.getFaces().forEach((face, k) => {
            AnimatedModel._check((data.materials[face.material] !== undefined), 'face ' + k + ': no material ' + face.material);
        });
        data.sockets.forEach((socket) => {
            AnimatedModel._check((socket.getJoint() < joints), 'socket ' + socket.getName() + ': no joint ' + socket.getJoint());
        });

        this._skeleton  = data.skeleton;
        this._mesh      = data.mesh;
        this._materials = Object.freeze(data.materials.map((material) => Object.freeze({...material})));
        this._clips     = new Map(data.clips.map((clip) => [clip.getName(), clip]));
        this._sockets   = new Map(data.sockets.map((socket) => [socket.getName(), socket]));

        return this;
    }

    getSkeleton() {
        return this._skeleton;
    }

    getMesh() {
        return this._mesh;
    }

    getMaterials() {
        return this._materials;
    }

    getClipNames() {
        return [...this._clips.keys()];
    }

    getClip(name) {
        const clip = this._clips.get(name);
        AnimatedModel._check((clip !== undefined), 'no clip ' + name);

        return clip;
    }

    getSocket(name) {
        const socket = this._sockets.get(name);
        AnimatedModel._check((socket !== undefined), 'no socket ' + name);

        return socket;
    }

    static _check(condition, message) {
        if (!condition) {
            throw new Error('AnimatedModel - ' + message);
        }
    }
}
