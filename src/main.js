import * as THREE from 'three'
import { Physics } from './physics.js'
import { buildWorld } from './world.js'
import { Car } from './car.js'
import { Controls } from './controls.js'
import { UI } from './ui.js'
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
const SUN_OFFSET = new THREE.Vector3(-18, 30, 12)

// Stars, visible only at night
const starGeo = new THREE.BufferGeometry()
const starPos = []
for (let i = 0; i < 700; i++) {
  const v = new THREE.Vector3().randomDirection()
  v.y = Math.abs(v.y) * 0.8 + 0.08
  v.normalize().multiplyScalar(170)
  starPos.push(v.x, v.y, v.z)
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
scene.add(stars)

// ── Theme (light = sunny afternoon, dark = moonlit night) ─
const THEMES = {
  light: { sky: '#bfe3e0', hemiSky: '#fff4e0', hemiGround: '#7fae55', hemi: 1.6, sunColor: '#fff1d6', sun: 2.4, water: '#6cc3d5', foam: 0.6, exposure: 1.05, stars: 0, headlights: 0 },
  dark: { sky: '#121729', hemiSky: '#6b7cc4', hemiGround: '#1e2b22', hemi: 0.75, sunColor: '#a9b8ff', sun: 0.9, water: '#1d3f5c', foam: 0.25, exposure: 1.15, stars: 0.9, headlights: 40 },
}
const theme = { mix: document.documentElement.dataset.theme === 'dark' ? 1 : 0, target: 0 }
theme.target = theme.mix
const cA = new THREE.Color()
const cB = new THREE.Color()
const lerpColor = (out, a, b, t) => out.copy(cA.set(a)).lerp(cB.set(b), t)
let worldRef = null
let carRef = null

function applyTheme(t) {
  const L = THEMES.light
  const D = THEMES.dark
  const lerp = THREE.MathUtils.lerp
  lerpColor(scene.background, L.sky, D.sky, t)
  scene.fog.color.copy(scene.background)
  lerpColor(hemi.color, L.hemiSky, D.hemiSky, t)
  lerpColor(hemi.groundColor, L.hemiGround, D.hemiGround, t)
  hemi.intensity = lerp(L.hemi, D.hemi, t)
  lerpColor(sun.color, L.sunColor, D.sunColor, t)
  sun.intensity = lerp(L.sun, D.sun, t)
  renderer.toneMappingExposure = lerp(L.exposure, D.exposure, t)
  stars.material.opacity = lerp(L.stars, D.stars, t)
  if (worldRef) {
    lerpColor(worldRef.water.color, L.water, D.water, t)
    worldRef.foam.opacity = lerp(L.foam, D.foam, t)
  }
  if (carRef) {
    carRef.headlight.intensity = lerp(L.headlights, D.headlights, t)
    carRef.headlightMat.emissiveIntensity = lerp(0.8, 3, t)
  }
}

function setTheme(name) {
  document.documentElement.dataset.theme = name
  theme.target = name === 'dark' ? 1 : 0
  try {
    localStorage.setItem('theme', name)
  } catch (e) {
    /* storage unavailable: theme still switches for this visit */
  }
  updateToggleIcons()
}
function updateToggleIcons() {
  const dark = document.documentElement.dataset.theme === 'dark'
  for (const b of document.querySelectorAll('[data-theme-toggle]')) b.textContent = dark ? '☀️' : '🌙'
}
for (const b of document.querySelectorAll('[data-theme-toggle]')) {
  b.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'))
}
updateToggleIcons()
applyTheme(theme.mix)

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
  worldRef = world
  carRef = car
  applyTheme(theme.mix)
  const controls = new Controls()

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

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1)
    const t = clock.elapsedTime

    physics.update(dt, (step) => car.control(started ? controls.state : noInput, step))
    car.update(dt, t)
    world.update(t, dt)

    // ease between light and dark over about a second
    if (theme.mix !== theme.target) {
      const d = theme.target - theme.mix
      theme.mix = Math.abs(d) < 0.01 ? theme.target : theme.mix + d * (1 - Math.exp(-4 * dt))
      applyTheme(theme.mix)
    }

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

    renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }
  frame()

  if (import.meta.env.DEV) window.__game = { car, physics, controls, camera, world }
}

boot().catch((err) => {
  console.error(err)
  status.textContent = 'Something went wrong loading the 3D world. Try the classic résumé below.'
})
