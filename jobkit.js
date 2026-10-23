/**
 * A website job, wherever it is shown (the jobs page, pages/jobsearch.js, and the Jobs tab of Home,
 * pages/home.js): its salary and details as words, its link and details from its chunk file
 * (jobs/<chunk>.json, scripts/build-jobs.mjs), and its three buttons. Apply opens the job's own page (and
 * asks "Did you apply?" on the way back, app.js), Save keeps it in My items, One click apply hands it to
 * the person's desktop app. A job is { id, title, loc, flags, day, pay, chunk, detail }, and the element
 * holding it carries data-id, with .apply, .oneclick and .save inside.
 */
import { didYouApply, notApplying, requireLogin, saveJob, sendToApp, toast } from '/app.js'

export const TYPE = { F: 'Full time', P: 'Part time', C: 'Contract', I: 'Internship', T: 'Temporary', L: 'Freelance', A: 'Apprenticeship' }
export const LEVEL = { E: 'Entry level', M: 'Mid level', S: 'Senior level', X: 'Executive level' }
const SYMBOL = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'CA$', AUD: 'A$', SGD: 'S$', NZD: 'NZ$', HKD: 'HK$', BRL: 'R$', MXN: 'MX$', CNY: 'CN¥', KRW: '₩', ILS: '₪', PHP: '₱' }
export const ARROW = '<svg class="arrow" viewBox="0 0 17 14" fill="none" aria-hidden="true"><path stroke="currentColor" d="M1 7h15M10 1l6 6-6 6"/></svg>'
// Save: a bookmark, so the faces beside Apply keep their room.
export const BOOKMARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
// One click apply's mark: a lightning bolt, as quick as it is.
export const BOLT = '<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
const DAY = 864e5
export const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / DAY)

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** "EUR75-86~" -> "€75K-86K a year (estimated)"; rupees in lakhs. */
export function salary(s) {
  const m = /^([A-Z]{3})([\d.]+)(?:-([\d.]+))?(~?)$/.exec(s ?? '')
  if (!m) return 'Salary not listed'
  const [, cur, lo, hi, est] = m
  const amount = (v) => (cur === 'INR' && v >= 100 ? `${+(v / 100).toFixed(1)}L` : `${v}K`)
  const sym = SYMBOL[cur]
  return `${sym ?? cur + ' '}${amount(+lo)}${hi ? '-' + amount(+hi) : ''} a year${est ? ' (estimated)' : ''}`
}

/** Remote or on-site, and the job's type. */
export const tags = (job) => [job.flags?.[2] === 'R' ? 'Remote' : 'On-site', TYPE[job.flags?.[0]]].filter(Boolean).join(' · ')

export function posted(d) {
  if (!d) return ''
  const ago = today - d
  if (ago <= 0) return 'Posted today'
  if (ago === 1) return 'Posted yesterday'
  if (ago < 31) return `Posted ${ago} days ago`
  return `Posted on ${new Date(d * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`
}

const chunks = new Map()
/** The job's link and details: [url, years, tasks, perks, skills, roles, education, language]. `build` names the listings' version. */
export function detail(job, build) {
  if (job.detail) return Promise.resolve(job.detail)
  if (!chunks.has(job.chunk)) {
    const p = fetch(`/jobs/${job.chunk}.json?v=${build ?? ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .catch((e) => {
        chunks.delete(job.chunk)
        throw e
      })
    chunks.set(job.chunk, p)
  }
  return chunks.get(job.chunk).then((c) => (job.detail = c[job.id] || null))
}

const languages = new Intl.DisplayNames(['en'], { type: 'language' })
const language = (code) => {
  try {
    return languages.of(code) || code
  } catch {
    return code
  }
}

/** The rest of a job, opened: posted, experience, education, language, then what you will do, skills, perks and roles. */
export function details(job, d) {
  const f = job.flags ?? ''
  const [, years = 0, tasks = [], perks = [], skills = [], roles = [], education = [], lang = ''] = d || []
  const experience = [LEVEL[f[1]], years ? `about ${years} ${years === 1 ? 'year' : 'years'} of experience` : ''].filter(Boolean).join(', ')
  const facts = [posted(job.day), experience, education.length ? `Education: ${education.join(', ')}` : '', lang ? `The posting is in ${language(lang)}` : '']
    .filter(Boolean)
    .map((t) => `<p>${esc(t[0].toUpperCase() + t.slice(1))}</p>`)
  const list = (title, items) => (items.length ? `<h4>${title}</h4><ul class="mono">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '')
  const html =
    (facts.length ? `<div class="facts mono">${facts.join('')}</div>` : '') +
    list('What you will do', tasks) +
    (skills.length ? `<h4>Skills</h4><p class="chips mono">${skills.map((s) => `<span>${esc(s)}</span>`).join('')}</p>` : '') +
    list('Perks', perks) +
    (roles.length ? `<h4>Roles</h4><p class="mono">${esc(roles.join(', '))}</p>` : '')
  // Most jobs have their tasks and skills; for the rest, the posting itself has them.
  return html + (tasks.length || skills.length ? '' : '<p class="mono note">Apply to read the full job description on the job’s page.</p>')
}

/** Applied (Apply says so), or with the desktop app (One click apply says so: sent, or waiting for it to open). */
export function markDone(el, sent, waiting = false) {
  if (!el) return
  if (!sent) {
    const label = el.querySelector('.apply')?.firstChild
    if (label) label.textContent = 'Applied'
    return
  }
  const button = el.querySelector('.oneclick')
  if (!button) return
  button.lastElementChild.textContent = waiting ? 'Waiting for your app' : 'Sent to your app'
  button.title = waiting ? 'It applies as soon as your desktop app is open' : 'Your desktop app has it'
  button.disabled = true
}

export function savedMark(el, on) {
  const b = el?.querySelector('.save')
  if (!b) return
  b.setAttribute('aria-pressed', String(on))
  b.setAttribute('aria-label', on ? 'Saved' : 'Save')
  b.title = on ? 'Saved. Press to unsave' : 'Save for later'
}

/**
 * Straight to the job's page, in a new tab. A tab can only be opened in the click itself, so when the
 * link has not arrived yet the tab opens empty and is sent on once it has. Coming back, they are asked
 * whether they applied, and only a yes marks it (app.js `didYouApply`).
 */
export async function apply(job, button, build) {
  if (!requireLogin('Log in to apply to jobs.')) return
  const el = button.closest('[data-id]')
  didYouApply(job.id, { title: job.title, location: job.loc || '' }, () => markDone(el, false))
  if (job.detail) return void window.open(job.detail[0], '_blank', 'noopener')
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  try {
    const d = await detail(job, build)
    if (d && /^https?:\/\//i.test(d[0])) {
      if (tab) tab.location.replace(d[0])
      else window.open(d[0], '_blank', 'noopener')
      return
    }
  } catch {
    /* said below */
  }
  // Nothing to apply to: nothing to ask about either.
  notApplying()
  tab?.close()
  button.textContent = 'No longer listed'
  button.disabled = true
}

/** Save for later (My items), or unsave: the job's link is kept with it, so it is fetched first. */
export async function save(job, button, build) {
  if (!requireLogin('Log in to save jobs.') || button.disabled) return
  button.disabled = true
  const was = button.getAttribute('aria-pressed') === 'true'
  try {
    const d = was ? null : await detail(job, build)
    if (!was && (!d || !/^https?:\/\//i.test(d[0]))) throw new Error('This job is no longer listed.')
    savedMark(button.closest('[data-id]'), await saveJob(job.id, d && { title: job.title, location: job.loc || '', url: d[0] }, was))
    if (!was) toast('Saved. <a href="/items?tab=saved">See your saved jobs</a>')
  } catch (e) {
    toast(esc(e.message))
  }
  button.disabled = false
}

/**
 * One click apply: the server hands the job to the person's desktop app, which applies to it for them.
 * When the app is not open they are told so, with the download (app.js `sendToApp`), and it waits.
 */
export async function oneClick(job, button, build) {
  if (!requireLogin('Log in to apply with one click.') || button.disabled) return
  button.disabled = true
  const label = button.lastElementChild
  label.textContent = 'Sending…'
  try {
    const d = await detail(job, build)
    if (!d || !/^https?:\/\//i.test(d[0])) throw new Error('This job is no longer listed.')
    const r = await sendToApp(job.id, { title: job.title, location: job.loc || '', url: d[0] })
    markDone(button.closest('[data-id]'), true, !r.appOpen)
  } catch (e) {
    button.disabled = false
    label.textContent = 'One click apply'
    toast(esc(e.message))
  }
}
