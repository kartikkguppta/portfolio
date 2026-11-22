import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json'
import { RAPIER } from './physics.js'

export const ISLAND_RADIUS = 40

// The name plaque in front of the letters; nothing else is placed on it
const PLAQUE = { x: 0, z: -3.5, w: 9, d: 1.4 }
const onPlaque = (x, z, margin = 0.4) => Math.abs(x - PLAQUE.x) < PLAQUE.w / 2 + margin && Math.abs(z - PLAQUE.z) < PLAQUE.d / 2 + margin

const palette = {
  grass: '#9cc56b',
  grassDark: '#7fae55',
  sand: '#ecd59f',
  dirt: '#d8b483',
  water: '#6cc3d5',
  trunk: '#8a5a3b',
  leaves: ['#6fae4f', '#5f9e45', '#84bf5c', '#e8a0a8', '#f0b65e'],
  rock: '#b8ada3',
  wood: '#c98b52',
  woodDark: '#9e6a3c',
  cream: '#fff3df',
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra })

// Small deterministic RNG so the island looks the same on every visit
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shadowed(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return obj
}

/** Canvas texture with centered text, for signs. */
export function textTexture(lines, { width = 512, height = 256, bg = palette.cream, color = '#3b2f2a', font = 'Inter' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)
  }
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const sizes = lines.map((l) => l.size)
  const total = sizes.reduce((a, b) => a + b * 1.25, 0)
  let y = height / 2 - total / 2
  for (const l of lines) {
    ctx.font = `${l.weight || 600} ${l.size}px ${font}, system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`
    y += (l.size * 1.25) / 2
    ctx.fillText(l.text, width / 2, y)
    y += (l.size * 1.25) / 2
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function buildWorld(scene, physics, profile, zones) {
  const rand = rng(1337)
  const blockers = [] // [x, z, radius] areas to keep scenery out of
  const animated = [] // objects with update(t)

  // ── Water ──────────────────────────────────────────────
  const waterGeo = new THREE.CircleGeometry(400, 64)
  waterGeo.rotateX(-Math.PI / 2)
  const water = new THREE.Mesh(waterGeo, mat(palette.water, { roughness: 0.3, metalness: 0.1 }))
  water.position.y = -0.9
  water.receiveShadow = true
  scene.add(water)

  // gentle foam ring around the island
  const foam = new THREE.Mesh(new THREE.RingGeometry(ISLAND_RADIUS + 2.4, ISLAND_RADIUS + 3.4, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e9f8f8', transparent: true, opacity: 0.6 }))
  foam.position.y = -0.85
  scene.add(foam)
  animated.push((t) => {
    const s = 1 + Math.sin(t * 1.2) * 0.012
    foam.scale.set(s, 1, s)
    foam.material.opacity = 0.45 + Math.sin(t * 1.2) * 0.15
  })

  // ── Island (grass top + sand skirt) ────────────────────
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS + 2.5, ISLAND_RADIUS + 5, 2, 40), mat(palette.sand))
  sand.position.y = -1.3
  sand.receiveShadow = true
  scene.add(sand)

  const grassGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 1.5, 1.2, 40, 1)
  const grass = new THREE.Mesh(grassGeo, mat(palette.grass))
  grass.position.y = -0.6
  grass.receiveShadow = true
  scene.add(grass)

  // Physical ground: a big flat cylinder; car can fall off the edge into the sea
  physics.addStatic(RAPIER.ColliderDesc.cylinder(0.6, ISLAND_RADIUS + 0.8).setFriction(1.2), [0, -0.6, 0])

  // Seabed far below so props that fall in don't sink forever (they get reset at y < -15 anyway)

  // ── Grass patches for texture ──────────────────────────
  const patchGeo = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2)
  const patchMat = mat(palette.grassDark)
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2
    const r = rand() * (ISLAND_RADIUS - 4)
    const p = new THREE.Mesh(patchGeo, patchMat)
    p.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r)
    const s = 1.5 + rand() * 3
    p.scale.set(s, 1, s * (0.6 + rand() * 0.6))
    p.rotation.y = rand() * Math.PI
    p.receiveShadow = true
    scene.add(p)
  }

  // ── Stepping-stone paths from the centre to each zone ──
  const slabGeo = new THREE.CylinderGeometry(0.7, 0.75, 0.12, 6)
  const slabMat = mat(palette.dirt)
  for (const z of zones) {
    const [zx, zz] = z.position
    const len = Math.hypot(zx, zz)
    const steps = Math.floor((len - 6) / 1.8)
    for (let i = 2; i < steps; i++) {
      const f = (i * 1.8) / len
      if (onPlaque(zx * f, zz * f, 0.8)) continue
      const s = new THREE.Mesh(slabGeo, slabMat)
      s.position.set(zx * f + (rand() - 0.5) * 0.5, 0.04, zz * f + (rand() - 0.5) * 0.5)
      s.rotation.y = rand() * Math.PI
      s.receiveShadow = true
      scene.add(s)
    }
    // keep scenery off the path
    for (let f = 0; f <= 1; f += 0.1) blockers.push([zx * f, zz * f, 3])
  }

  // ── Spawn area: the name in big knock-over letters ─────
  blockers.push([0, 0, 11])
  const font = new FontLoader().parse(fontJson)
  const letterMat = mat(palette.cream)
  const name = profile.name.toUpperCase()
  const letterSize = name.length > 10 ? 1.3 : 1.8
  const letters = []
  let cursor = 0
  for (const ch of name) {
    if (ch === ' ') {
      cursor += letterSize * 0.6
      continue
    }
    const geo = new TextGeometry(ch, { font, size: letterSize, depth: 0.6, curveSegments: 3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1 })
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const w = bb.max.x - bb.min.x
    geo.translate(-(bb.min.x + w / 2), -(bb.min.y + (bb.max.y - bb.min.y) / 2), -0.3)
    letters.push({ geo, w, h: bb.max.y - bb.min.y, x: cursor + w / 2 })
    cursor += w + letterSize * 0.15
  }
  const offset = cursor / 2
  for (const l of letters) {
    const mesh = shadowed(new THREE.Mesh(l.geo, letterMat))
    // Letters stand in a row behind the spawn point, facing the camera (+z side)
    mesh.position.set(l.x - offset, l.h / 2 + 0.02, -6)
    scene.add(mesh)
    physics.addDynamic(mesh, RAPIER.ColliderDesc.cuboid(l.w / 2, l.h / 2, 0.33).setDensity(0.4).setFriction(0.8), { angularDamping: 0.6 })
  }

  // Subtitle on a wooden plaque lying in front of the letters (raised so grass and stones don't cover it)
  const plaque = new THREE.Group()
  const plaqueBase = new THREE.Mesh(new THREE.BoxGeometry(PLAQUE.w, 0.16, PLAQUE.d), mat(palette.woodDark))
  plaqueBase.position.y = 0.08
  plaqueBase.receiveShadow = true
  const subTex = textTexture([{ text: profile.groundText || profile.title, size: 76, weight: 700 }], { width: 1024, height: 144, bg: '#6f4a2c', color: '#fff3df' })
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(PLAQUE.w - 0.3, PLAQUE.d - 0.25), new THREE.MeshStandardMaterial({ map: subTex, roughness: 1 }))
  sub.rotation.x = -Math.PI / 2
  sub.position.y = 0.165
  sub.receiveShadow = true
  plaque.add(plaqueBase, sub)
  plaque.position.set(PLAQUE.x, 0, PLAQUE.z)
  scene.add(plaque)

  // ── Zones ──────────────────────────────────────────────
  const zoneObjects = []
  for (const z of zones) zoneObjects.push(buildZone(scene, physics, z, animated))
  for (const z of zones) blockers.push([z.position[0], z.position[1], 8])

  // ── Props: crates, ramp, cones ─────────────────────────
  const crateGeo = new THREE.BoxGeometry(1, 1, 1)
  const crateMat = mat(palette.wood)
  const crateEdge = mat(palette.woodDark)
  const makeCrate = (x, y, z) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(crateGeo, crateMat))
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.18, 1.04), crateEdge)
    g.add(band)
    g.position.set(x, y, z)
    shadowed(g)
    scene.add(g)
    physics.addDynamic(g, RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setDensity(0.6).setFriction(0.7))
  }
  // pyramid of crates
  const px = 8.5, pz = 7.5
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) makeCrate(px + i * 1.05 - (2 - row) * 0.525, 0.5 + row * 1.0, pz)
  }
  blockers.push([px, pz, 4])

  // ramp
  const ramp = new THREE.Group()
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 5), mat(palette.wood))
  ramp.add(rampMesh)
  // ramp sits between the Achievements and Skills paths, sloping up toward the island edge
  const rampPos = [-13, 0.75, -4]
  const rampQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, Math.PI / 2 - 0.3, 0, 'YXZ'))
  ramp.position.set(...rampPos)
  ramp.quaternion.copy(rampQ)
  shadowed(ramp)
  scene.add(ramp)
  physics.addStatic(RAPIER.ColliderDesc.cuboid(2, 0.2, 2.5).setFriction(1), rampPos, rampQ)
  blockers.push([-13, -4, 5])
  blockers.push([-18, -6, 5])

  // traffic cones in a ring, between the Gatician and Achievements paths
  const coneGeo = new THREE.ConeGeometry(0.35, 0.9, 6)
  const coneMat = mat('#f08a4b')
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const c = shadowed(new THREE.Mesh(coneGeo, coneMat))
    c.position.set(-12 + Math.cos(a) * 2.2, 0.45, 9 + Math.sin(a) * 2.2)
    scene.add(c)
    physics.addDynamic(c, RAPIER.ColliderDesc.cone(0.45, 0.35).setDensity(0.3))
  }
  blockers.push([-12, 9, 4])

  // ── Trees & rocks ──────────────────────────────────────
  const blocked = (x, z, r) => blockers.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br + r)
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 5)
  const trunkMat = mat(palette.trunk)
  const leafMats = palette.leaves.map((c) => mat(c))
  const pineGeo = new THREE.ConeGeometry(1.3, 2.2, 6)
  const roundGeo = new THREE.IcosahedronGeometry(1.4, 0)
  const rockGeo = new THREE.DodecahedronGeometry(0.8, 0)
  const rockMat = mat(palette.rock)

  let placed = 0
  for (let tries = 0; tries < 900 && placed < 70; tries++) {
    const a = rand() * Math.PI * 2
    const r = 6 + Math.sqrt(rand()) * (ISLAND_RADIUS - 8)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (blocked(x, z, 1.5)) continue
    blockers.push([x, z, 1.6])
    placed++
    const s = 0.7 + rand() * 0.7
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.y = 0.8
    tree.add(trunk)
    if (rand() < 0.5) {
      const leafMat = leafMats[Math.floor(rand() * 3)]
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(pineGeo, leafMat)
        cone.position.y = 2 + k * 0.9
        cone.scale.setScalar(1 - k * 0.25)
        tree.add(cone)
      }
    } else {
      const leafMat = leafMats[Math.floor(rand() * leafMats.length)]
      const crown = new THREE.Mesh(roundGeo, leafMat)
      crown.position.y = 2.6
      crown.rotation.set(rand(), rand(), rand())
      tree.add(crown)
    }
    tree.position.set(x, 0, z)
    tree.scale.setScalar(s)
    tree.rotation.y = rand() * Math.PI
    shadowed(tree)
    scene.add(tree)
    physics.addStatic(RAPIER.ColliderDesc.cylinder(1.2 * s, 0.35 * s), [x, 1.2 * s, z])
    const phase = rand() * 10
    animated.push((t) => {
      tree.rotation.z = Math.sin(t * 1.1 + phase) * 0.015
    })
  }

  for (let i = 0, tries = 0; i < 25 && tries < 400; tries++) {
    const a = rand() * Math.PI * 2
    const r = 8 + rand() * (ISLAND_RADIUS - 9)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (blocked(x, z, 1)) continue
    blockers.push([x, z, 1])
    i++
    const s = 0.5 + rand() * 0.9
    const rock = shadowed(new THREE.Mesh(rockGeo, rockMat))
    rock.position.set(x, 0.2 * s, z)
    rock.scale.set(s, s * 0.7, s)
    rock.rotation.set(rand(), rand(), rand())
    scene.add(rock)
    physics.addStatic(RAPIER.ColliderDesc.ball(0.7 * s), [x, 0.2 * s, z])
  }

  // ── Flowers & grass tufts (instanced = cheap) ──────────
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.5, 3)
  const tufts = new THREE.InstancedMesh(tuftGeo, mat(palette.grassDark), 600)
  const flowerGeo = new THREE.IcosahedronGeometry(0.16, 0)
  const flowerColors = ['#ffffff', '#f7d046', '#f28fb0', '#b39ddb']
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ flatShading: true }), 300)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()
  for (let i = 0; i < tufts.count; i++) {
    let a, r
    do {
      a = rand() * Math.PI * 2
      r = rand() * (ISLAND_RADIUS - 1)
    } while (onPlaque(Math.cos(a) * r, Math.sin(a) * r))
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, rand() * 3, (rand() - 0.5) * 0.4))
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r), q, new THREE.Vector3(1, 0.6 + rand() * 0.8, 1))
    tufts.setMatrixAt(i, m)
  }
  for (let i = 0; i < flowers.count; i++) {
    let a, r
    do {
      a = rand() * Math.PI * 2
      r = rand() * (ISLAND_RADIUS - 1)
    } while (onPlaque(Math.cos(a) * r, Math.sin(a) * r))
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0.15, Math.sin(a) * r), q.identity(), new THREE.Vector3(1, 1, 1))
    flowers.setMatrixAt(i, m)
    flowers.setColorAt(i, color.set(flowerColors[Math.floor(rand() * flowerColors.length)]))
  }
  tufts.receiveShadow = true
  scene.add(tufts, flowers)

  // materials that shift colour in the Sunset theme: [material, normal colour, sunset colour]
  const tinted = [
    [grass.material, new THREE.Color(palette.grass), new THREE.Color('#4fd48f')],
    [patchMat, new THREE.Color(palette.grassDark), new THREE.Color('#35b377')],
    [tufts.material, new THREE.Color(palette.grassDark), new THREE.Color('#35b377')],
    [sand.material, new THREE.Color(palette.sand), new THREE.Color('#ffd7b0')],
  ]

  // ── Palm trees along the shore ─────────────────────────
  for (let i = 0, tries = 0; i < 20 && tries < 300; tries++) {
    const a = rand() * Math.PI * 2
    const r = 33 + rand() * 4.5
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (blocked(x, z, 1.2)) continue
    blockers.push([x, z, 2])
    i++
    const palm = buildPalm(rand)
    palm.position.set(x, 0, z)
    palm.rotation.y = -a + (rand() - 0.5) * 0.8 // lean out towards the sea
    palm.scale.setScalar(0.85 + rand() * 0.4)
    scene.add(palm)
    physics.addStatic(RAPIER.ColliderDesc.cylinder(1.5, 0.3), [x, 1.5, z])
    const phase = rand() * 10
    const crown = palm.userData.crown
    animated.push((t) => {
      crown.rotation.z = Math.sin(t * 0.9 + phase) * 0.05
      crown.rotation.x = Math.cos(t * 0.7 + phase) * 0.04
    })
  }

  // ── Clouds ─────────────────────────────────────────────
  const cloudMat = mat('#ffffff', { roughness: 1 })
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0)
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group()
    const puffs = 3 + Math.floor(rand() * 3)
    for (let k = 0; k < puffs; k++) {
      const p = new THREE.Mesh(cloudGeo, cloudMat)
      p.position.set(k * 1.4 - puffs * 0.7, rand() * 0.6, (rand() - 0.5) * 1.2)
      p.scale.setScalar(1 + rand() * 0.9)
      cloud.add(p)
    }
    const a = rand() * Math.PI * 2
    const r = 20 + rand() * 50
    cloud.position.set(Math.cos(a) * r, 14 + rand() * 8, Math.sin(a) * r)
    cloud.traverse((o) => o.isMesh && (o.castShadow = true))
    scene.add(cloud)
    const speed = 0.4 + rand() * 0.6
    animated.push((t, dt) => {
      cloud.position.x += speed * dt
      if (cloud.position.x > 90) cloud.position.x = -90
    })
  }

  return {
    zones: zoneObjects,
    water: water.material,
    foam: foam.material,
    /** 0 = no neon glow, 1 = full sunset-neon glow */
    setNeon(amount) {
      for (const z of zoneObjects) z.setNeon(amount)
    },
    /** 0 = normal colours, 1 = lush tropical colours that stay green under the orange sunset light */
    setTint(amount) {
      for (const [m, from, to] of tinted) m.color.copy(from).lerp(to, amount)
    },
    update(t, dt) {
      for (const fn of animated) fn(t, dt)
    },
  }
}

function buildPalm(rand) {
  const palm = new THREE.Group()
  const trunkMat = mat('#a87a52')
  const ringMat = mat('#8d6342')
  const segGeo = new THREE.CylinderGeometry(0.17, 0.22, 0.75, 6)
  // curved trunk: each segment tilts a little more than the last
  let y = 0
  let x = 0
  let tilt = 0
  const bend = 0.06 + rand() * 0.06
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(segGeo, i % 2 ? ringMat : trunkMat)
    seg.position.set(x, y + 0.37, 0)
    seg.rotation.z = -tilt
    palm.add(seg)
    y += Math.cos(tilt) * 0.72
    x += Math.sin(tilt) * 0.72
    tilt += bend
  }
  const crown = new THREE.Group()
  crown.position.set(x, y, 0)
  const leafGeo = new THREE.ConeGeometry(0.42, 2.8, 4)
  leafGeo.translate(0, 1.4, 0) // pivot at the base
  const leafMats = [mat('#3f9e4a'), mat('#4fb556'), mat('#358a41')]
  const leaves = 7 + Math.floor(rand() * 2)
  for (let i = 0; i < leaves; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMats[i % 3])
    leaf.scale.set(1, 1, 0.22)
    leaf.rotation.order = 'YXZ'
    leaf.rotation.y = (i / leaves) * Math.PI * 2 + rand() * 0.3
    leaf.rotation.x = 1.35 + rand() * 0.35 // droop outwards
    crown.add(leaf)
  }
  const nutMat = mat('#6b4a2e')
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), nutMat)
    nut.position.set(Math.cos(i * 2.1) * 0.22, -0.15, Math.sin(i * 2.1) * 0.22)
    crown.add(nut)
  }
  palm.add(crown)
  palm.userData.crown = crown
  return shadowed(palm)
}

function buildZone(scene, physics, zone, animated) {
  const [x, z] = zone.position
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  scene.add(group)

  const color = new THREE.Color(zone.color)
  const radius = 5.5

  // Pad
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.2, 0.14, 24), mat(color.clone().lerp(new THREE.Color('#ffffff'), 0.1)))
  pad.position.y = 0.06
  pad.receiveShadow = true
  group.add(pad)

  // Glowing ring that brightens when the car is inside
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.35, radius - 0.1, 48).rotateX(-Math.PI / 2), ringMat)
  ring.position.y = 0.15
  group.add(ring)

  // Signboard facing the island centre
  const sign = new THREE.Group()
  const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 3.2, 5)
  const postMat = mat(palette.woodDark)
  const post1 = new THREE.Mesh(postGeo, postMat)
  const post2 = new THREE.Mesh(postGeo, postMat)
  post1.position.set(-1.9, 1.6, 0)
  post2.position.set(1.9, 1.6, 0)
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2, 0.2), mat(palette.wood))
  board.position.y = 2.6
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 1.75),
    new THREE.MeshStandardMaterial({ map: textTexture([{ text: zone.icon, size: 80 }, { text: zone.title, size: 72 }], { width: 512, height: 210, bg: '#fff3df' }), roughness: 1 }),
  )
  face.position.set(0, 2.6, 0.11)
  sign.add(post1, post2, board, face)
  shadowed(sign)

  // Neon tube around the board (only lit in the Sunset and Night themes)
  const neonMat = new THREE.MeshStandardMaterial({ color: '#2a2030', emissive: color, emissiveIntensity: 0, roughness: 0.4 })
  const tube = 0.13
  for (const [w, h, px, py] of [
    [4.8, tube, 0, 3.66],
    [4.8, tube, 0, 1.54],
    [tube, 2.2, -2.4, 2.6],
    [tube, 2.2, 2.4, 2.6],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, tube), neonMat)
    bar.position.set(px, py, 0.16)
    sign.add(bar)
  }
  // place sign at the far side of the pad, facing the island centre
  const toCentre = Math.atan2(-x, -z)
  sign.position.set(Math.sin(toCentre + Math.PI) * (radius - 0.6), 0, Math.cos(toCentre + Math.PI) * (radius - 0.6))
  sign.rotation.y = toCentre
  group.add(sign)
  // sign posts are solid
  const sx = x + sign.position.x
  const sz = z + sign.position.z
  const sq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, toCentre, 0))
  physics.addStatic(RAPIER.ColliderDesc.cuboid(2.3, 1.6, 0.15), [sx, 1.6, sz], sq)

  // Floating gem marker
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), mat(color, { emissive: color, emissiveIntensity: 0.35 }))
  gem.position.y = 5
  gem.castShadow = true
  sign.add(gem)

  let inside = 0
  let neon = 0
  const white = new THREE.Color('#ffffff')
  animated.push((t) => {
    gem.rotation.y = t * 1.2
    gem.position.y = 4.9 + Math.sin(t * 2 + x) * 0.2
    ringMat.opacity = 0.35 + inside * 0.6 + Math.sin(t * 3) * 0.08 * inside
    // subtle neon flicker
    if (neon > 0) neonMat.emissiveIntensity = neon * (3.2 + Math.sin(t * 7 + x) * 0.2 + (Math.random() < 0.004 ? -3 : 0))
  })

  return {
    data: zone,
    position: new THREE.Vector2(x, z),
    radius,
    setActive(v) {
      inside = v ? 1 : 0
    },
    setNeon(amount) {
      neon = amount
      neonMat.emissiveIntensity = amount * 3.2
      gem.material.emissiveIntensity = 0.35 + amount * 3
      // ring turns from soft white into the zone's neon colour (values above 1 bloom)
      ringMat.color.copy(white).lerp(color.clone().multiplyScalar(2.2), amount)
    },
  }
}
