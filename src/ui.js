// Turns content.js data into HTML for the zone panels and the full résumé view.

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const link = (url, label) => {
  const safe = /^(https?:|mailto:|#|\/)/i.test(url) ? url : '#'
  return `<a href="${esc(safe)}" target="_blank" rel="noopener">${esc(label)}</a>`
}

function linksHtml(profile) {
  const items = [...(profile.email ? [{ label: 'Email', url: `mailto:${profile.email}` }] : []), ...profile.links]
  return `<div class="links">${items.map((l) => link(l.url, l.label)).join('')}</div>`
}

export function zoneHtml(zone, profile) {
  let body = ''
  switch (zone.type) {
    case 'about':
      body = zone.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') + `<p class="muted">📍 ${esc(profile.location)}</p>`
      break
    case 'experience':
      body = zone.items
        .map(
          (it) => `<div class="entry"><h3>${esc(it.role)}</h3><div class="meta">${esc(it.company)} · ${esc(it.period)}</div>
          <ul>${it.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`,
        )
        .join('')
      break
    case 'projects':
      body =
        (zone.intro ? `<p class="muted">${esc(zone.intro)}</p>` : '') +
        zone.items
          .map(
            (it) => `<div class="entry"><h3>${it.url && it.url !== '#' ? link(it.url, it.name) : esc(it.name)}</h3>
          ${it.meta ? `<div class="meta">${esc(it.meta)}</div>` : ''}
          <p>${esc(it.description)}</p>
          ${(it.sections || []).map((s) => `<h4>${esc(s.heading)}</h4><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}
          <div class="tags">${(it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>`,
          )
          .join('')
      break
    case 'list':
      body = zone.items
        .map(
          (it) => `<div class="entry${it.highlight ? ' highlight' : ''}"><h3>${esc(it.title)}${it.year ? ` <span class="year">${esc(it.year)}</span>` : ''}</h3>
          <p>${esc(it.text)}</p></div>`,
        )
        .join('')
      break
    case 'skills':
      body = zone.groups
        .map((g) => `<div class="entry"><h3>${esc(g.label)}</h3><div class="tags">${g.items.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>`)
        .join('')
      break
    case 'contact':
      body = `<p>${esc(zone.text)}</p>${linksHtml(profile)}`
      break
  }
  return `<h2><span class="dot" style="background:${esc(zone.color)}"></span>${esc(zone.title)}</h2>${body}`
}

export function resumeHtml(profile, zones) {
  const sections = zones
    .filter((z) => z.type !== 'contact')
    .map((z) => `<section>${zoneHtml(z, profile)}</section>`)
    .join('')
  return `<h1>${esc(profile.fullName)}</h1><p class="muted">${esc(profile.title)} · ${esc(profile.location)}</p>
    <p>${esc(profile.tagline)}</p>${linksHtml(profile)}${sections}`
}

export class UI {
  constructor(profile, zones) {
    this.profile = profile
    this.panel = document.getElementById('panel')
    this.panelBody = this.panel.querySelector('.panel-body')
    this.hint = document.getElementById('zone-hint')
    this.resume = document.getElementById('resume')
    this.currentZone = null
    this.dismissed = null

    document.title = `${profile.fullName} — ${profile.title}`
    document.getElementById('intro-name').textContent = profile.fullName
    document.getElementById('intro-title').textContent = `${profile.title} · ${profile.tagline}`
    document.getElementById('hud-name').textContent = profile.fullName
    document.getElementById('hud-title').textContent = profile.title
    this.resume.querySelector('.resume-body').innerHTML = resumeHtml(profile, zones)

    this.panel.querySelector('.panel-close').addEventListener('click', () => {
      this.dismissed = this.currentZone
      this.closePanel()
    })
    this.resume.querySelector('.panel-close').addEventListener('click', () => this.toggleResume(false))
    this.resume.addEventListener('click', (e) => e.target === this.resume && this.toggleResume(false))
    document.getElementById('resume-btn').addEventListener('click', () => this.toggleResume(true))
    document.getElementById('intro-resume').addEventListener('click', () => this.toggleResume(true))

    this.onPanelChange = null
    this.setupMenu()
    this.setupSheet()
  }

  /** Phones: the top-right buttons live in a "⋯" menu. */
  setupMenu() {
    const btn = document.getElementById('menu-btn')
    const menu = document.getElementById('hud-actions')
    const setOpen = (open) => {
      menu.classList.toggle('open', open)
      btn.setAttribute('aria-expanded', String(open))
      btn.textContent = open ? '×' : '⋯'
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      setOpen(!menu.classList.contains('open'))
    })
    // Résumé and Reset close the menu; Music and Theme keep it open so you can see the change
    for (const id of ['resume-btn', 'reset-btn']) document.getElementById(id).addEventListener('click', () => setOpen(false))
    document.addEventListener('pointerdown', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== btn) setOpen(false)
    })
  }

  /** Phones: the zone panel is a bottom sheet. Drag the handle up for full view, down to close. */
  setupSheet() {
    const mq = matchMedia('(max-width: 640px)')
    const panel = this.panel
    const handle = panel.querySelector('.sheet-handle')
    let startY = 0
    let base = 0
    let dragging = false
    let moved = false
    handle.addEventListener('pointerdown', (e) => {
      if (!mq.matches) return
      dragging = true
      moved = false
      startY = e.clientY
      base = panel.classList.contains('full') ? 0 : window.innerHeight * 0.4
      try { handle.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
      panel.style.transition = 'none'
    })
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return
      if (Math.abs(e.clientY - startY) > 6) moved = true
      panel.style.transform = `translateY(${Math.max(0, base + e.clientY - startY)}px)`
    })
    const end = (e) => {
      if (!dragging) return
      dragging = false
      panel.style.transition = ''
      panel.style.transform = ''
      const dy = e.clientY - startY
      const full = panel.classList.contains('full')
      if (!moved) panel.classList.toggle('full') // a tap on the handle toggles half / full
      else if (dy < -40) panel.classList.add('full')
      else if (dy > 50) {
        if (full && base + dy < window.innerHeight * 0.55) panel.classList.remove('full')
        else {
          this.dismissed = this.currentZone
          this.closePanel()
        }
      }
    }
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  toggleResume(show) {
    this.resume.classList.toggle('hidden', !show)
  }

  /** Called every frame with the zone the car is inside (or null). */
  setZone(zone) {
    if (zone === this.currentZone) return
    this.currentZone = zone
    if (!zone) {
      this.dismissed = null
      this.closePanel()
      return
    }
    if (this.dismissed === zone) return
    this.panelBody.innerHTML = zoneHtml(zone.data, this.profile)
    this.panel.scrollTop = 0
    this.panel.classList.remove('full')
    this.panel.classList.add('open')
    this.onPanelChange?.(true)
  }

  closePanel() {
    this.panel.classList.remove('open', 'full')
    this.onPanelChange?.(false)
  }

  setHint(text) {
    if (text) this.hint.textContent = text
    this.hint.classList.toggle('show', !!text)
  }
}
