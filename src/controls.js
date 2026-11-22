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
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    const pad = document.getElementById('touch')
    if (!isTouch) return
    this.touchPad = pad
    for (const btn of pad.querySelectorAll('button')) {
      const key = btn.dataset.key
      const on = (e) => {
        e.preventDefault()
        this.state[key] = true
        btn.classList.add('active')
      }
      const off = (e) => {
        e.preventDefault()
        this.state[key] = false
        btn.classList.remove('active')
      }
      btn.addEventListener('pointerdown', on)
      btn.addEventListener('pointerup', off)
      btn.addEventListener('pointercancel', off)
      btn.addEventListener('pointerleave', off)
    }
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
