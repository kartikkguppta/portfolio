import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

// Three looks. "neon" (sunset over a neon beach town) is the default for every first visit.
export const THEME_ORDER = ['neon', 'light', 'dark']
export const THEME_LABELS = { neon: 'Sunset', light: 'Day', dark: 'Night' }
export const THEME_ICONS = { neon: '🌴', light: '☀️', dark: '🌙' }
export const STORAGE_KEY = 'theme-v2' // new key, so everyone (including old visitors) starts on Sunset

const THEMES = {
  neon: {
    fog: '#e9789f', fogNear: 45, fogFar: 125,
    hemiSky: '#ffb3d9', hemiGround: '#6a4aa8', hemi: 1.15,
    sunColor: '#ffbf85', sun: 2.4, sunOffset: [-30, 15, 22], // low sun = long sunset shadows
    water: '#1fa3c2', foam: 0.75, exposure: 1.0,
    stars: 0, headlights: 12, neon: 1, underglow: 1, bloom: 1,
  },
  light: {
    fog: '#bfe3e0', fogNear: 60, fogFar: 140,
    hemiSky: '#fff4e0', hemiGround: '#7fae55', hemi: 1.6,
    sunColor: '#fff1d6', sun: 2.4, sunOffset: [-18, 30, 12],
    water: '#6cc3d5', foam: 0.6, exposure: 1.05,
    stars: 0, headlights: 0, neon: 0, underglow: 0, bloom: 0,
  },
  dark: {
    fog: '#121729', fogNear: 60, fogFar: 140,
    hemiSky: '#6b7cc4', hemiGround: '#1e2b22', hemi: 0.75,
    sunColor: '#a9b8ff', sun: 0.9, sunOffset: [-18, 30, 12],
    water: '#1d3f5c', foam: 0.25, exposure: 1.15,
    stars: 0.9, headlights: 40, neon: 0.55, underglow: 0.6, bloom: 0.7,
  },
}

export function savedTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return THEME_ORDER.includes(t) ? t : 'neon'
  } catch (e) {
    return 'neon'
  }
}

/** Blends the scene between themes; call update(dt) every frame and render() instead of renderer.render. */
export class SceneTheme {
  constructor(renderer, scene, camera, { hemi, sun, sunOffset }) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.hemi = hemi
    this.sun = sun
    this.sunOffset = sunOffset
    this.world = null
    this.car = null

    const start = document.documentElement.dataset.theme || 'neon'
    this.weights = Object.fromEntries(THEME_ORDER.map((n) => [n, n === start ? 1 : 0]))
    this.target = start

    this.stars = this.makeStars()
    scene.add(this.stars)

    // Bloom makes neon tubes, the underglow and headlights glow
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 1.05)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.apply()
  }

  attach(world, car) {
    this.world = world
    this.car = car
    this.apply()
  }

  set(name) {
    this.target = name
  }

  setSize(w, h) {
    this.composer.setSize(w, h)
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
  }

  update(dt) {
    let moving = false
    const k = 1 - Math.exp(-4 * dt)
    for (const n of THEME_ORDER) {
      const goal = n === this.target ? 1 : 0
      const w = this.weights[n]
      if (Math.abs(goal - w) > 0.002) {
        this.weights[n] = w + (goal - w) * k
        moving = true
      } else this.weights[n] = goal
    }
    if (moving) this.apply()
  }

  // weighted blend of a numeric or colour property across themes
  num(key) {
    let v = 0
    for (const n of THEME_ORDER) v += THEMES[n][key] * this.weights[n]
    return v
  }
  color(key, out) {
    out.setRGB(0, 0, 0)
    const c = new THREE.Color()
    for (const n of THEME_ORDER) {
      c.set(THEMES[n][key])
      out.r += c.r * this.weights[n]
      out.g += c.g * this.weights[n]
      out.b += c.b * this.weights[n]
    }
    return out
  }

  apply() {
    const { scene, hemi, sun } = this
    if (!scene.background?.isColor) scene.background = new THREE.Color()
    this.color('fog', scene.background)
    scene.fog.color.copy(scene.background)
    scene.fog.near = this.num('fogNear')
    scene.fog.far = this.num('fogFar')
    this.color('hemiSky', hemi.color)
    this.color('hemiGround', hemi.groundColor)
    hemi.intensity = this.num('hemi')
    this.color('sunColor', sun.color)
    sun.intensity = this.num('sun')
    this.sunOffset.set(0, 0, 0)
    for (const n of THEME_ORDER) this.sunOffset.addScaledVector(new THREE.Vector3(...THEMES[n].sunOffset), this.weights[n])
    this.renderer.toneMappingExposure = this.num('exposure')
    this.stars.material.opacity = this.num('stars')
    this.bloomAmount = this.num('bloom')
    this.bloom.strength = 1.1 * this.bloomAmount

    if (this.world) {
      this.color('water', this.world.water.color)
      this.world.foam.opacity = this.num('foam')
      this.world.setNeon(this.num('neon'))
      this.world.setTint(this.weights.neon)
    }
    if (this.car) {
      this.car.headlight.intensity = this.num('headlights')
      this.car.headlightMat.emissiveIntensity = 0.8 + this.num('headlights') / 15
      this.car.setUnderglow(this.num('underglow'))
    }
  }

  render() {
    if (this.bloomAmount > 0.02) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  makeStars() {
    const geo = new THREE.BufferGeometry()
    const pos = []
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3().randomDirection()
      v.y = Math.abs(v.y) * 0.8 + 0.08
      v.normalize().multiplyScalar(170)
      pos.push(v.x, v.y, v.z)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
  }
}
