const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward', KeyZ: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyQ: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
  Space: 'brake',
}

export class Controls {
  constructor() {
    this.state = { forward: false, back: false, left: false, right: false, boost: false, brake: false }
    this.enabled = false
    this.listeners = {}

    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return
      const action = KEYMAP[e.code]
      if (action) {
        this.state[action] = true
        if (this.enabled) e.preventDefault()
      }
      if (e.code === 'KeyR' && !e.repeat) this.emit('reset')
      if (e.code === 'Escape') this.emit('escape')
    })
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code]
      if (action) this.state[action] = false
    })
    window.addEventListener('blur', () => {
      for (const k in this.state) this.state[k] = false
    })

    this.setupTouch()
  }

  setupTouch() {
    // Joystick: x/y in -1..1 (screen space, y down). main.js turns it into "drive towards that direction".
    this.joy = { x: 0, y: 0, active: false }
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    if (isTouch) document.documentElement.classList.add('touch')
    const pad = document.getElementById('touch')
    if (!isTouch) return
    this.touchPad = pad

    const stick = document.getElementById('joystick')
    const knob = stick.querySelector('.joy-knob')
    let pointerId = null
    const RADIUS = 52
    const move = (e) => {
      const r = stick.getBoundingClientRect()
      let dx = e.clientX - (r.left + r.width / 2)
      let dy = e.clientY - (r.top + r.height / 2)
      const len = Math.hypot(dx, dy)
      if (len > RADIUS) {
        dx = (dx / len) * RADIUS
        dy = (dy / len) * RADIUS
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      // small dead zone so a resting thumb doesn't creep
      const m = Math.min(len / RADIUS, 1)
      this.joy.active = m > 0.15
      this.joy.x = this.joy.active ? dx / RADIUS : 0
      this.joy.y = this.joy.active ? dy / RADIUS : 0
    }
    const release = (e) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      this.joy.active = false
      this.joy.x = this.joy.y = 0
      knob.style.transform = ''
      stick.classList.remove('active')
    }
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      pointerId = e.pointerId
      try { stick.setPointerCapture(e.pointerId) } catch (err) { /* not capturable: still works while the finger stays on the stick */ }
      stick.classList.add('active')
      move(e)
    })
    stick.addEventListener('pointermove', (e) => e.pointerId === pointerId && move(e))
    stick.addEventListener('pointerup', release)
    stick.addEventListener('pointercancel', release)

    const boost = document.getElementById('boost-btn')
    const on = (e) => {
      e.preventDefault()
      this.state.boost = true
      boost.classList.add('active')
    }
    const off = () => {
      this.state.boost = false
      boost.classList.remove('active')
    }
    boost.addEventListener('pointerdown', on)
    boost.addEventListener('pointerup', off)
    boost.addEventListener('pointercancel', off)
    boost.addEventListener('pointerleave', off)
  }

  /** Hide the joystick while the info sheet is open on phones (it covers the bottom of the screen). */
  setTouchVisible(visible) {
    this.touchPad?.classList.toggle('sheet-open', !visible)
  }

  showTouch() {
    this.touchPad?.classList.remove('hidden')
  }

  on(name, fn) {
    ;(this.listeners[name] ||= []).push(fn)
  }

  emit(name) {
    for (const fn of this.listeners[name] || []) fn()
  }
}
