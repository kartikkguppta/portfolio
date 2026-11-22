// Soothing generative lo-fi, made live with the Web Audio API (no audio files, no licensing).
// Slow jazzy chords, a soft bass, sparse electric-piano notes and gentle drums.
// The car's speed slowly opens a filter, so the music brightens a little as you drive.

const BPM = 72
const BEAT = 60 / BPM
const STORAGE_KEY = 'music'

// Two bars per chord: Fmaj7 → Em7 → Dm7 → Cmaj7 (MIDI note numbers)
const CHORDS = [
  { bass: 41, notes: [53, 57, 60, 64] },
  { bass: 40, notes: [52, 55, 59, 62] },
  { bass: 38, notes: [50, 53, 57, 60] },
  { bass: 36, notes: [48, 52, 55, 59] },
]
const MELODY_SCALE = [72, 74, 76, 79, 81, 84] // C major pentatonic, upper register

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12)

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    return null
  }
}
function save(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch (e) {
    /* not available: the choice lasts for this visit only */
  }
}

// One second of silence as a WAV file, made in memory (used to keep iPhone audio in "media" mode)
let silentUrl = null
function silentWavUrl() {
  if (silentUrl) return silentUrl
  const rate = 8000
  const samples = rate
  const buf = new ArrayBuffer(44 + samples)
  const v = new DataView(buf)
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true) // 8-bit
  str(36, 'data')
  v.setUint32(40, samples, true)
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128) // 8-bit silence is 128
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return silentUrl
}

export class Music {
  constructor() {
    this.enabled = readSaved() !== 'off'
    this.ctx = null
    this.started = false
    this.listeners = []
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) {
        this.ctx.suspend()
        this.keepAlive?.pause()
      } else if (this.enabled && this.started) this.resume()
    })

    // Phones are strict: audio may only start inside a touch. If the music isn't running yet
    // (or the phone paused it, e.g. after a call), any tap on the page starts it again.
    const retry = () => {
      if (this.enabled && this.started && (!this.ctx || this.ctx.state !== 'running')) this.play()
    }
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, retry, { capture: true, passive: true })
  }

  onChange(fn) {
    this.listeners.push(fn)
  }

  /** Call from a click/keypress (browsers only allow audio after a user gesture). */
  begin() {
    this.started = true
    if (this.enabled) this.play()
  }

  toggle() {
    this.enabled = !this.enabled
    save(this.enabled ? 'on' : 'off')
    if (this.enabled) {
      this.started = true
      this.play()
    } else this.pause()
    for (const fn of this.listeners) fn(this.enabled)
  }

  play() {
    this.unlockPhoneAudio()
    if (!this.ctx) this.setup()
    this.resume()
    const ctx = this.ctx
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2) // gentle fade-in
  }

  resume() {
    const p = this.ctx.resume()
    p?.catch?.(() => {}) // blocked until the next tap; `retry` handles that
    this.keepAlive?.play().catch(() => {})
  }

  pause() {
    if (!this.ctx) return
    const ctx = this.ctx
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
    this.keepAlive?.pause()
    setTimeout(() => !this.enabled && ctx.suspend(), 1200)
  }

  /**
   * iPhones treat Web Audio as "ambient" sound, which the silent switch mutes.
   * Asking for "playback" (newer iOS) and keeping a silent <audio> element playing (older iOS)
   * makes the music behave like normal media. Harmless on Android and laptops.
   */
  unlockPhoneAudio() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch (e) {
      /* not supported */
    }
    if (!this.keepAlive) {
      const a = document.createElement('audio')
      a.src = silentWavUrl()
      a.loop = true
      a.setAttribute('playsinline', '')
      a.preload = 'auto'
      this.keepAlive = a
    }
    this.keepAlive.play().catch(() => {})
  }

  /** Speed in m/s; brightens the mix a little while driving. */
  setSpeed(speed) {
    if (!this.ctx) return
    const cutoff = 1400 + Math.min(Math.abs(speed), 20) * 90
    this.tone.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.6)
  }

  setup() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.tone = ctx.createBiquadFilter()
    this.tone.type = 'lowpass'
    this.tone.frequency.value = 1400
    this.tone.Q.value = 0.3
    this.tone.connect(this.master).connect(ctx.destination)

    // Soft room reverb from a generated impulse response
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(3.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.45
    this.reverb.connect(wet).connect(this.tone)

    // Bus that feeds both the dry signal and the reverb
    this.bus = ctx.createGain()
    this.bus.connect(this.tone)
    this.bus.connect(this.reverb)

    this.noise = this.makeNoise()

    // Look-ahead scheduler
    this.step = 0 // eighth notes since start
    this.nextTime = ctx.currentTime + 0.1
    this.timer = setInterval(() => this.schedule(), 80)
  }

  schedule() {
    const ctx = this.ctx
    if (ctx.state !== 'running') return
    // If we fell far behind (e.g. tab was suspended), skip ahead instead of bursting notes
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05
    const eighth = BEAT / 2
    while (this.nextTime < ctx.currentTime + 1.2) {
      this.playStep(this.step, this.nextTime)
      // lazy swing on the off-beats
      this.nextTime += this.step % 2 === 0 ? eighth * 1.16 : eighth * 0.84
      this.step++
    }
  }

  playStep(step, t) {
    const stepInBar = step % 8
    const bar = Math.floor(step / 8)
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length]
    const firstBarOfChord = bar % 2 === 0

    // Pad: a new chord every two bars
    if (stepInBar === 0 && firstBarOfChord) for (const n of chord.notes) this.pad(freq(n), t, BEAT * 8)

    // Bass on beat 1 and the "and" of beat 3
    if (stepInBar === 0) this.bass(freq(chord.bass), t, BEAT * 1.6)
    if (stepInBar === 5) this.bass(freq(chord.bass + 7), t, BEAT * 0.9)

    // Drums: soft kick on 1 and 3, a brushed hat on the off-beats
    if (stepInBar === 0 || stepInBar === 4) this.kick(t, stepInBar === 0 ? 0.55 : 0.35)
    if (stepInBar === 2 || stepInBar === 6) this.snare(t)
    if (step % 2 === 1) this.hat(t, 0.05 + Math.random() * 0.03)

    // Sparse electric-piano melody
    if (Math.random() < (stepInBar % 2 === 0 ? 0.32 : 0.16)) {
      const pool = Math.random() < 0.6 ? chord.notes.map((n) => n + 12) : MELODY_SCALE
      this.keys(freq(pool[Math.floor(Math.random() * pool.length)]), t)
    }
  }

  // ── instruments ──────────────────────────────────────────

  pad(f, t, dur) {
    const ctx = this.ctx
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.045, t + 1.6)
    g.gain.setValueAtTime(0.045, t + dur - 0.5)
    g.gain.linearRampToValueAtTime(0, t + dur + 1.8)
    lp.connect(g).connect(this.bus)
    for (const detune of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = detune
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + 2)
    }
  }

  bass(f, t, dur) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(this.tone) // dry: keeps the low end tight
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  keys(f, t) {
    const ctx = this.ctx
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.075, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8)
    g.connect(this.bus)
    // sine + a quiet bell-like overtone, slightly detuned for warmth
    const parts = [
      [1, 1, 'sine'],
      [2.003, 0.18, 'sine'],
      [3.99, 0.04, 'sine'],
    ]
    for (const [mult, level, type] of parts) {
      const o = ctx.createOscillator()
      const og = ctx.createGain()
      o.type = type
      o.frequency.value = f * mult
      og.gain.value = level
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + 2)
    }
  }

  kick(t, level) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18)
    g.gain.setValueAtTime(level * 0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    o.connect(g).connect(this.tone)
    o.start(t)
    o.stop(t + 0.4)
  }

  snare(t) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    src.connect(bp).connect(g).connect(this.bus)
    src.start(t, Math.random() * 1.5, 0.3)
  }

  hat(t, level) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = ctx.createGain()
    g.gain.setValueAtTime(level, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    src.connect(hp).connect(g).connect(this.tone)
    src.start(t, Math.random() * 1.5, 0.1)
  }

  makeNoise() {
    const ctx = this.ctx
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  makeImpulse(seconds) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    return buf
  }
}
