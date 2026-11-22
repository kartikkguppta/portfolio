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
    this.panel.classList.add('open')
  }

  closePanel() {
    this.panel.classList.remove('open')
  }

  setHint(text) {
    if (text) this.hint.textContent = text
    this.hint.classList.toggle('show', !!text)
  }
}
