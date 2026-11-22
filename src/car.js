import * as THREE from 'three'
import { RAPIER } from './physics.js'

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra })

// Car points along +X. Wheels: front-left, front-right, back-left, back-right.
const WHEELS = [
  { x: 0.85, z: -0.62, front: true },
  { x: 0.85, z: 0.62, front: true },
  { x: -0.8, z: -0.62, front: false },
  { x: -0.8, z: 0.62, front: false },
]
const WHEEL_RADIUS = 0.34
const REST_LENGTH = 0.32
const SPAWN = { x: 0, y: 1.6, z: 2 }

export class Car {
  constructor(scene, physics) {
    this.physics = physics
    this.mesh = this.buildMesh()
    scene.add(this.mesh)

    const world = physics.world
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(SPAWN.x, SPAWN.y, SPAWN.z)
        .setCanSleep(false)
        .setLinearDamping(0.4)
        .setAngularDamping(1.2),
    )
    // Low, wide collider (heavy) + light cabin = low centre of mass: hard to flip, still flippable off the ramp
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.05, 0.28, 0.62).setTranslation(0, 0.05, 0).setDensity(6).setFriction(0.4), this.body)
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.55, 0.22, 0.5).setTranslation(-0.15, 0.5, 0).setDensity(1), this.body)

    this.vehicle = world.createVehicleController(this.body)
    WHEELS.forEach((w, i) => {
      this.vehicle.addWheel({ x: w.x, y: -0.05, z: w.z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, REST_LENGTH, WHEEL_RADIUS)
      this.vehicle.setWheelSuspensionStiffness(i, 30)
      this.vehicle.setWheelSuspensionCompression(i, 2.6)
      this.vehicle.setWheelSuspensionRelaxation(i, 3.2)
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.3)
      this.vehicle.setWheelFrictionSlip(i, 2.4)
      this.vehicle.setWheelSideFrictionStiffness(i, 1.4)
    })

    this.steer = 0
    this.flippedTime = 0
    this.speed = 0
  }

  buildMesh() {
    const car = new THREE.Group()
    const body = new THREE.Group()
    car.add(body)

    const red = mat('#e0574f')
    const cream = mat('#fff3df')
    const dark = mat('#3b2f2a')
    const glass = mat('#a9dcf0', { roughness: 0.2, metalness: 0.1 })

    // chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.2), red)
    chassis.position.y = 0.1
    body.add(chassis)
    // hood bevel
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.1), red)
    hood.position.set(0.7, 0.42, 0)
    body.add(hood)
    // cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.0), cream)
    cabin.position.set(-0.2, 0.6, 0)
    body.add(cabin)
    // windows
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.86), glass)
    windshield.position.set(0.36, 0.62, 0)
    body.add(windshield)
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 1.02), glass)
    sideWin.position.set(-0.2, 0.64, 0)
    body.add(sideWin)
    // roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.06), red)
    roof.position.set(-0.2, 0.89, 0)
    body.add(roof)
    // bumpers
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 1.22), dark)
    fb.position.set(1.12, -0.05, 0)
    const rb = fb.clone()
    rb.position.x = -1.12
    body.add(fb, rb)
    // headlights
    const lightMat = new THREE.MeshStandardMaterial({ color: '#fff6c9', emissive: '#ffe58a', emissiveIntensity: 0.8 })
    for (const z of [-0.4, 0.4]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.22), lightMat)
      hl.position.set(1.11, 0.18, z)
      body.add(hl)
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), mat('#ff6b5e', { emissive: '#ff3b2e', emissiveIntensity: 0.4 }))
      tl.position.set(-1.11, 0.18, z)
      body.add(tl)
    }
    // headlight beam, only switched on in the dark theme
    this.headlight = new THREE.SpotLight('#ffe6a8', 0, 22, 0.55, 0.6, 1.2)
    this.headlight.position.set(1.0, 0.25, 0)
    this.headlight.target.position.set(6, -0.8, 0)
    body.add(this.headlight, this.headlight.target)
    this.headlightMat = lightMat

    // neon underglow (Sunset and Night themes)
    this.underglowMat = new THREE.MeshBasicMaterial({ color: '#ff3d9a', transparent: true, opacity: 0 })
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 1.0), this.underglowMat)
    strip.position.y = -0.17
    body.add(strip)
    this.underglow = new THREE.PointLight('#ff3d9a', 0, 5, 1.6)
    this.underglow.position.set(0, -0.35, 0)
    body.add(this.underglow)

    // little antenna with a ball, for charm
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), dark)
    antenna.position.set(-0.65, 1.15, 0.4)
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat('#f7d046'))
    ball.position.y = 0.32
    antenna.add(ball)
    body.add(antenna)
    this.antenna = antenna

    // wheels
    this.wheelMeshes = []
    const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 10)
    tireGeo.rotateX(Math.PI / 2)
    const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.3, 6)
    hubGeo.rotateX(Math.PI / 2)
    for (let i = 0; i < 4; i++) {
      const steerGroup = new THREE.Group()
      const spin = new THREE.Group()
      spin.add(new THREE.Mesh(tireGeo, dark), new THREE.Mesh(hubGeo, cream))
      steerGroup.add(spin)
      car.add(steerGroup)
      this.wheelMeshes.push({ steerGroup, spin })
    }

    car.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    this.bodyMesh = body
    return car
  }

  /** Called once per physics tick, before world.step(). */
  control(input, dt) {
    const speed = this.vehicle.currentVehicleSpeed()
    this.speed = speed

    const boost = input.boost ? 1.7 : 1
    const maxEngine = 45 * boost
    let engine = 0
    let brake = 0

    let steerTarget
    if (input.analog) {
      // joystick: throttle 0..1 and steer -1..1 worked out in main.js
      engine = maxEngine * input.throttle
      brake = input.throttle > 0.05 ? 0 : 0.6
      steerTarget = input.steer
    } else {
      if (input.forward) engine = maxEngine
      if (input.back) {
        // brake first if rolling forward, then reverse
        if (speed > 1) brake = 3
        else engine = -maxEngine * 0.6
      }
      if (input.brake) brake = 4
      if (!input.forward && !input.back && !input.brake) brake = 0.4 // gentle roll-to-stop
      steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0)
    }

    // Less steering at high speed so it doesn't spin out
    const maxSteer = THREE.MathUtils.lerp(0.6, 0.28, Math.min(Math.abs(speed) / 25, 1))
    this.steer = THREE.MathUtils.damp(this.steer, steerTarget * maxSteer, 12, dt)

    for (let i = 0; i < 4; i++) {
      const front = WHEELS[i].front
      this.vehicle.setWheelSteering(i, front ? this.steer : 0)
      this.vehicle.setWheelEngineForce(i, front ? 0 : engine) // rear-wheel drive
      this.vehicle.setWheelBrake(i, brake)
    }
    this.vehicle.updateVehicle(dt)

    // Auto-reset if stuck upside down or fallen into the sea
    const t = this.body.translation()
    const r = this.body.rotation()
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
    this.flippedTime = up.y < 0.2 && Math.abs(speed) < 1 ? this.flippedTime + dt : 0
    if (this.flippedTime > 1.5) this.flipUpright()
    if (t.y < -6) this.reset()
  }

  flipUpright() {
    const t = this.body.translation()
    const r = this.body.rotation()
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
    const yaw = Math.atan2(-fwd.z, fwd.x)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    this.body.setTranslation({ x: t.x, y: t.y + 1.5, z: t.z }, true)
    this.body.setRotation(q, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.flippedTime = 0
  }

  setUnderglow(amount) {
    this.underglow.intensity = amount * 9
    this.underglowMat.opacity = Math.min(amount, 1)
    this.underglowMat.color.set('#ff3d9a').multiplyScalar(1 + amount * 2)
  }

  reset() {
    this.body.setTranslation(SPAWN, true)
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.flippedTime = 0
  }

  /** Sync visuals after the physics step. */
  update(dt, time) {
    const t = this.body.translation()
    const r = this.body.rotation()
    this.mesh.position.set(t.x, t.y, t.z)
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w)

    for (let i = 0; i < 4; i++) {
      const c = this.vehicle.wheelChassisConnectionPointCs(i)
      const len = this.vehicle.wheelSuspensionLength(i) ?? REST_LENGTH
      const { steerGroup, spin } = this.wheelMeshes[i]
      steerGroup.position.set(c.x, c.y - len, c.z)
      steerGroup.rotation.y = this.vehicle.wheelSteering(i) ?? 0
      spin.rotation.z = this.vehicle.wheelRotation(i) ?? 0
    }

    // antenna wobble
    this.antenna.rotation.x = Math.sin(time * 9) * 0.04 * Math.min(Math.abs(this.speed), 6)
    this.antenna.rotation.z = THREE.MathUtils.clamp(-this.speed * 0.02, -0.3, 0.3)
  }

  get position() {
    return this.mesh.position
  }
}
