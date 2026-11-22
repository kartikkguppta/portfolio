import * as THREE from 'three'
import { Physics } from './physics.js'
import { buildWorld } from './world.js'
import { Car } from './car.js'
import { Controls } from './controls.js'
import { UI } from './ui.js'
import { Music } from './music.js'
import { SceneTheme, THEME_ORDER, THEME_LABELS, THEME_ICONS, STORAGE_KEY } from './theme.js'
import { profile, zones } from './content.js'

const canvas = document.getElementById('scene')
const status = document.getElementById('intro-status')
const startBtn = document.getElementById('start-btn')
const ui = new UI(profile, zones)

// ── Renderer & scene ─────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const SKY = new THREE.Color('#bfe3e0')
const scene = new THREE.Scene()
scene.background = SKY
scene.fog = new THREE.Fog(SKY, 60, 140)

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 400)

// Warm, soft lighting (values are animated by the theme below)
const hemi = new THREE.HemisphereLight('#fff4e0', '#7fae55', 1.6)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#fff1d6', 2.4)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -30
sun.shadow.camera.right = 30
sun.shadow.camera.top = 30
sun.shadow.camera.bottom = -30
sun.shadow.camera.near = 1
sun.shadow.camera.far = 80
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.03
scene.add(sun, sun.target)
const SUN_OFFSET = new THREE.Vector3(-18, 30, 12) // set by the theme

// ── Theme: Sunset (default) → Day → Night ────────────────
const sceneTheme = new SceneTheme(renderer, scene, camera, { hemi, sun, sunOffset: SUN_OFFSET })

function setTheme(name) {
  document.documentElement.dataset.theme = name
  sceneTheme.set(name)
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch (e) {
    /* storage unavailable: theme still switches for this visit */
  }
  updateToggleIcons()
}
function updateToggleIcons() {
  const current = document.documentElement.dataset.theme
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]
  for (const b of document.querySelectorAll('[data-theme-toggle]')) {
    const icon = b.querySelector('.i') || b
    icon.textContent = THEME_ICONS[current]
    const label = b.querySelector('.lbl')
    if (label) label.textContent = `Theme: ${THEME_LABELS[current]}`
    b.title = `Theme: ${THEME_LABELS[current]} — click for ${THEME_LABELS[next]}`
  }
}
for (const b of document.querySelectorAll('[data-theme-toggle]')) {
  b.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
    setTheme(THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length])
  })
}
updateToggleIcons()

// ── Camera rig: fixed diagonal angle, follows the car ────
const CAM_DIR = new THREE.Vector3(-0.55, 1, 1).normalize()
const camRig = { distance: 26, target: new THREE.Vector3(0, 0, 0), min: 14, max: 45 }
window.addEventListener(
  'wheel',
  (e) => {
    if (e.target !== canvas) return
    camRig.distance = THREE.MathUtils.clamp(camRig.distance + e.deltaY * 0.02, camRig.min, camRig.max)
  },
  { passive: true },
)

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  // pull back a little on narrow/portrait screens
  camera.fov = w < h ? 55 : 40
  camera.updateProjectionMatrix()
  sceneTheme.setSize(w, h)
}
window.addEventListener('resize', resize)
resize()

// ── Boot ─────────────────────────────────────────────────
async function boot() {
  status.textContent = 'Starting physics…'
  const physics = await Physics.init()

  status.textContent = 'Building the island…'
  // canvas sign text uses the web font, so make sure it is loaded first
  try {
    await Promise.race([Promise.all([document.fonts.load('600 64px Inter'), document.fonts.load('700 64px Inter')]), new Promise((r) => setTimeout(r, 3000))])
  } catch (e) {
    /* fall back to system font */
  }
  const world = buildWorld(scene, physics, profile, zones)
  const car = new Car(scene, physics)
  sceneTheme.attach(world, car)
  const controls = new Controls()
  ui.onPanelChange = (open) => controls.setTouchVisible(!open)

  // Background music: starts with "Start driving", toggled with the 🎵 button or M
  const music = new Music()
  const musicBtn = document.getElementById('music-btn')
  const syncMusicBtn = (on) => {
    musicBtn.classList.toggle('off', !on)
    musicBtn.title = on ? 'Music on — click to mute (M)' : 'Music off — click to play (M)'
    musicBtn.querySelector('.i').textContent = on ? '🎵' : '🔇'
    musicBtn.querySelector('.lbl').textContent = on ? 'Music: on' : 'Music: off'
  }
  syncMusicBtn(music.enabled)
  music.onChange(syncMusicBtn)
  musicBtn.addEventListener('click', () => music.toggle())
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat && started) music.toggle()
  })

  controls.on('reset', () => started && car.reset())
  controls.on('escape', () => {
    ui.toggleResume(false)
    ui.closePanel()
  })
  document.getElementById('reset-btn').addEventListener('click', () => {
    car.reset()
    physics.resetProps()
  })

  let started = false
  const intro = document.getElementById('intro')
  status.textContent = 'Ready!'
  startBtn.disabled = false
  const start = () => {
    if (started) return
    started = true
    controls.enabled = true
    music.begin()
    intro.classList.add('fade')
    setTimeout(() => intro.classList.add('hidden'), 600)
    document.getElementById('hud').classList.remove('hidden')
    controls.showTouch()
    canvas.focus()
  }
  startBtn.addEventListener('click', start)
  window.addEventListener('keydown', (e) => {
    if (!started && (e.code === 'Enter' || e.code === 'Space') && !startBtn.disabled && ui.resume.classList.contains('hidden')) start()
  })

  const noInput = { forward: false, back: false, left: false, right: false, boost: false, brake: true }
  const clock = new THREE.Clock()
  const tmp = new THREE.Vector3()

  // Joystick → "drive towards where the thumb points" (relative to the screen, not the car)
  const camRight = new THREE.Vector3()
  const camFwd = new THREE.Vector3()
  const desired = new THREE.Vector3()
  const carFwd = new THREE.Vector3()
  const carQ = new THREE.Quaternion()
  const joyInput = { analog: true, throttle: 0, steer: 0, boost: false }
  function driveInput() {
    if (!started) return noInput
    const j = controls.joy
    if (!j?.active) return controls.state
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize()
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize()
    desired.copy(camRight).multiplyScalar(j.x).addScaledVector(camFwd, -j.y)
    const mag = Math.min(desired.length(), 1)
    desired.normalize()
    const r = car.body.rotation()
    carFwd.set(1, 0, 0).applyQuaternion(carQ.set(r.x, r.y, r.z, r.w)).setY(0).normalize()
    // signed angle from the car's nose to the joystick direction (+ = turn left)
    const angle = Math.atan2(carFwd.z * desired.x - carFwd.x * desired.z, carFwd.dot(desired))
    joyInput.steer = THREE.MathUtils.clamp(angle * 1.8, -1, 1)
    joyInput.throttle = mag * (Math.abs(angle) > 1.4 ? 0.55 : 1) // ease off while turning around
    joyInput.boost = controls.state.boost
    return joyInput
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1)
    const t = clock.elapsedTime

    const input = driveInput()
    physics.update(dt, (step) => car.control(input, step))
    car.update(dt, t)
    world.update(t, dt)
    music.setSpeed(car.speed)

    // ease between themes over about a second
    sceneTheme.update(dt)

    // Which zone are we in?
    let active = null
    const p = car.position
    for (const z of world.zones) {
      const inside = Math.hypot(p.x - z.position.x, p.z - z.position.y) < z.radius
      z.setActive(inside)
      if (inside) active = z
    }
    if (started) ui.setZone(active)

    // Camera: before start, slowly orbit; after, follow the car
    if (!started) {
      const a = t * 0.08
      camRig.target.set(0, 0, 0)
      camera.position.set(Math.sin(a) * 42, 30, Math.cos(a) * 42)
      camera.lookAt(0, 0, 0)
    } else {
      // look slightly ahead of the car in its direction of travel
      const v = car.body.linvel()
      tmp.set(p.x + v.x * 0.25, 0, p.z + v.z * 0.25)
      camRig.target.lerp(tmp, 1 - Math.exp(-4 * dt))
      camera.position.copy(camRig.target).addScaledVector(CAM_DIR, camRig.distance)
      camera.lookAt(camRig.target)
    }

    // Keep the shadow box centred on what we're looking at
    sun.position.copy(camRig.target).add(SUN_OFFSET)
    sun.target.position.copy(camRig.target)

    sceneTheme.render()
    requestAnimationFrame(frame)
  }
  frame()

  if (import.meta.env.DEV) window.__game = { car, physics, controls, camera, world, music, sceneTheme, setTheme }
}

boot().catch((err) => {
  console.error(err)
  status.textContent = 'Something went wrong loading the 3D world. Try the classic résumé below.'
})
