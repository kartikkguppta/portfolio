import RAPIER from '@dimforge/rapier3d-compat'

export { RAPIER }

/** Thin wrapper around a Rapier world that keeps meshes in sync with bodies. */
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -18, z: 0 }) // stronger gravity feels snappier for a toy car
    this.world.timestep = 1 / 60
    this.synced = [] // { mesh, body }
    this.accumulator = 0
  }

  static async init() {
    await RAPIER.init()
    return new Physics()
  }

  /** Static collider (no body needed beyond a fixed one). */
  addStatic(colliderDesc, position = [0, 0, 0], quaternion = null) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(...position)
    if (quaternion) desc.setRotation(quaternion)
    const body = this.world.createRigidBody(desc)
    this.world.createCollider(colliderDesc, body)
    return body
  }

  /** Dynamic body that drives `mesh` every frame. */
  addDynamic(mesh, colliderDesc, { linearDamping = 0.2, angularDamping = 0.4 } = {}) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation(mesh.quaternion)
      .setLinearDamping(linearDamping)
      .setAngularDamping(angularDamping)
    const body = this.world.createRigidBody(desc)
    this.world.createCollider(colliderDesc, body)
    const entry = { mesh, body, home: { p: mesh.position.clone(), q: mesh.quaternion.clone() } }
    this.synced.push(entry)
    return body
  }

  /** Put every dynamic prop back where it started. */
  resetProps() {
    for (const { body, home } of this.synced) {
      body.setTranslation(home.p, true)
      body.setRotation(home.q, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }

  /** Fixed-step update. `beforeStep` runs once per physics tick (vehicle control lives there). */
  update(delta, beforeStep) {
    this.accumulator += Math.min(delta, 0.1)
    const step = this.world.timestep
    while (this.accumulator >= step) {
      beforeStep?.(step)
      this.world.step()
      this.accumulator -= step
    }
    for (const { mesh, body } of this.synced) {
      const t = body.translation()
      const r = body.rotation()
      mesh.position.set(t.x, t.y, t.z)
      mesh.quaternion.set(r.x, r.y, r.z, r.w)
      // Props that fall off the island quietly reset
      if (t.y < -15) {
        const entry = this.synced.find((e) => e.body === body)
        body.setTranslation(entry.home.p, true)
        body.setRotation(entry.home.q, true)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  }
}
