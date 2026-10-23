/**
 * A member's own profile design (the owner, 2026-10-08: "our main highlight is the custom profile"): a small
 * website of three files, index.html, style.css and script.js (the owner, 2026-10-23: "Add in support for JS
 * aswell"; "The user should be drag and dropping the files instead of editing in the boxes"), its pictures
 * called by the names they were dropped with, its videos YouTube boxes ("make videos be youtube video boxes
 * inside the page"). Its {{placeholders}} are filled in from the profile each time it is shown, and its
 * JavaScript gets the profile as data (window.oporch).
 *
 * It runs in a frame of its own (mountDesign): a data: document, which has an origin of its own that is no
 * one's, so its scripts reach neither the page around it, nor the viewer's session, nor Oporch's API. Its policy
 * lets it load its pictures, Google's fonts and cdnjs's libraries and nothing else, send nothing anywhere, and
 * frame nothing but YouTube's player, through /yt.html. On the profile it is the whole window, the site's menu
 * and the profile's buttons over it (pages/profile.js). The owner approves a design before anyone else sees it.
 *
 * Shared with the owner's review console, whose stand-in app.js gives only API, SITE, esc, media and plural.
 */
import { API, SITE, esc, media, plural, ytId } from '/app.js'

// ── Dates, as LinkedIn writes them

const NOW = new Date()
const MONTHS_NOW = NOW.getUTCFullYear() * 12 + NOW.getUTCMonth()
/** "2023-02" as "Feb 2023", and as a count of months, for working out how long; anything else as written. */
function when(v) {
  const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(String(v ?? '').trim())
  if (!m) return { text: String(v ?? '').trim(), at: null }
  const month = m[2] ? Math.min(12, Math.max(1, +m[2])) - 1 : 0
  return {
    text: m[2] ? new Date(Date.UTC(+m[1], month)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : m[1],
    // Only a month says how long: "2018 to 2022" is not 4 yrs 1 mo.
    at: m[2] ? +m[1] * 12 + month : null
  }
}
/** "Feb 2023 to now · 2 yrs 8 mos", as LinkedIn says it. */
export function span(start, end, current = false) {
  const a = when(start)
  const b = current ? { text: 'now', at: MONTHS_NOW } : when(end)
  const range = [a.text, b.text].filter(Boolean).join(' to ')
  if (a.at === null || b.at === null || b.at < a.at) return range
  const months = b.at - a.at + 1
  const y = Math.floor(months / 12)
  const mo = months % 12
  return `${range} · ${[y ? plural(y, 'yr') : '', mo ? plural(mo, 'mo') : ''].filter(Boolean).join(' ')}`
}
const day = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const PROFICIENCY = {
  elementary: 'Elementary proficiency',
  limited: 'Limited working proficiency',
  professional: 'Professional working proficiency',
  full: 'Full professional proficiency',
  native: 'Native or bilingual proficiency'
}
export const WORK_TYPE = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' }
export const JOB_TYPE = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', temporary: 'Temporary', freelance: 'Freelance' }
export const START = { now: 'Immediately, actively applying', flexible: 'Flexible' }

/**
 * What someone open to work is looking for, as LinkedIn lists it under "Open to work" (the owner, 2026-10-23:
 * "with open to work as a heading, then the specifications"): [label, value] pairs, the empty ones left out.
 */
export function openSpecs(o) {
  if (!o) return []
  return [
    ['Job titles', (o.titles || []).join(', ')],
    ['Locations', (o.places || []).join(', ')],
    ['Workplace', (o.types || []).map((t) => WORK_TYPE[t] ?? t).join(', ')],
    ['Job types', (o.jobTypes || []).map((t) => JOB_TYPE[t] ?? t).join(', ')],
    ['Start', START[o.start] ?? '']
  ].filter(([, v]) => v)
}
/** The same on one line, for a design: "Open to work: Data Analyst in Pune, Remote (Hybrid, Full-time)", or nothing. */
export function openLine(o) {
  if (!o) return ''
  const kinds = [...(o.types || []).map((t) => WORK_TYPE[t] ?? t), ...(o.jobTypes || []).map((t) => JOB_TYPE[t] ?? t)]
  return `Open to work${o.titles?.length ? `: ${o.titles.join(', ')}` : ''}${o.places?.length ? ` in ${o.places.join(', ')}` : ''}${kinds.length ? ` (${kinds.join(', ')})` : ''}`
}

/** Where a link to a video starts, in seconds: ?t=90, ?t=1m30s, ?start=90. */
const ytStart = (link) => {
  try {
    const q = new URL(String(link)).searchParams
    const t = q.get('t') ?? q.get('start') ?? ''
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t)
    return m ? (+(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0)) || 0 : 0
  } catch {
    return 0
  }
}

// ── A profile's parts as HTML, the same on the standard profile and in a design's placeholders

const initial = (s) => esc([...String(s || '?').trim()][0] ?? '?').toUpperCase()
// Line breaks as <br>, so they show in a design whatever its CSS says about white-space.
const lines = (s) => esc(s).replace(/\r?\n/g, '<br>')
const urlLink = (url, label) => (url ? `<a class="url" href="${esc(url)}" target="_blank" rel="noopener nofollow ugc">${label}</a>` : '')
const entry = (title, sub, dates, desc, logo, link = '') =>
  `<div class="entry"><div class="logo" aria-hidden="true">${initial(logo)}</div><div class="what"><h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${
    dates ? `<p class="when">${esc(dates)}</p>` : ''
  }${desc ? `<p class="desc">${lines(desc)}</p>` : ''}${link}</div></div>`

/** A post as a card in a design: plain text and its picture, linking to the post itself. */
function postCard(u) {
  const x = u.repostOf && !u.text && !u.repostOf.gone ? u.repostOf : u
  const stats = [u.reactions?.total ? plural(u.reactions.total, 'like') : '', u.comments ? plural(u.comments, 'comment') : ''].filter(Boolean).join(' · ')
  return `<a class="post" href="${SITE}/p?id=${u.id}"><p class="post-date">${x === u ? '' : 'Reposted · '}${esc(day(u.at))}</p>${x.text ? `<p class="post-text">${lines(x.text)}</p>` : ''}${
    x.image ? `<img class="post-image" src="${esc(media(x.image))}" alt="">` : ''
  }${stats ? `<p class="post-stats">${stats}</p>` : ''}</a>`
}

/**
 * A project as a card to show (the owner, 2026-10-23: "showcase their projects"): its picture or its video, its
 * name and dates, the skills it used, what it is, and a way to it. `video` draws a YouTube video: a player on
 * Oporch's own pages, a data-youtube box in a design (made a player as it is shown).
 */
export function projectCard(x, video = (id) => `<div class="video" data-youtube="${id}"></div>`) {
  const id = ytId(x.video)
  const shot = id ? video(id, x.name) : x.image ? `<img class="project-image" src="${esc(media(`/media/${x.image}`))}" alt="">` : ''
  return `<article class="project">${shot}<div class="project-body"><h3>${esc(x.name)}</h3>${span(x.start, x.end) ? `<p class="when">${esc(span(x.start, x.end))}</p>` : ''}${
    x.skills?.length ? `<p class="project-skills">${x.skills.map((s) => `<span>${esc(s)}</span>`).join(' ')}</p>` : ''
  }${x.description ? `<p class="desc">${lines(x.description)}</p>` : ''}${urlLink(x.url, 'View project')}</div></article>`
}

/** A profile's links as buttons: its name, never its address (the owner, 2026-10-23). */
const linkList = (links) => (links || []).map((l) => `<a class="link" href="${esc(l.url)}" target="_blank" rel="noopener nofollow ugc">${esc(l.label)}</a>`).join(' ')

export function profileParts(p, updates = []) {
  const of = (k) => p[k] || []
  return {
    experience: of('experience').map((x) => entry(x.title || x.company, [x.title ? x.company : '', x.location].filter(Boolean).join(' · '), span(x.start, x.end, x.current), x.description, x.company || x.title)).join(''),
    education: of('education').map((x) => entry(x.school, [x.degree, x.field].filter(Boolean).join(', '), span(x.start, x.end), '', x.school)).join(''),
    certifications: of('certifications')
      .map((x) => entry(x.name, x.issuer, [x.issued ? `Issued ${when(x.issued).text}` : '', x.expires ? `Expires ${when(x.expires).text}` : ''].filter(Boolean).join(' · '), x.credentialId ? `Credential ID ${x.credentialId}` : '', x.issuer || x.name, urlLink(x.url, 'Show credential')))
      .join(''),
    projects: of('projects').map((x) => projectCard(x)).join(''),
    volunteering: of('volunteering').map((x) => entry(x.role, [x.organization, x.cause].filter(Boolean).join(' · '), span(x.start, x.end, x.current), x.description, x.organization)).join(''),
    honors: of('honors').map((x) => entry(x.title, x.issuer ? `Issued by ${x.issuer}` : '', x.date ? when(x.date).text : '', x.description, x.title)).join(''),
    languages: of('languages').map((x) => `<div class="entry"><div class="what"><h3>${esc(x.name)}</h3><p class="sub">${esc(PROFICIENCY[x.proficiency] ?? '')}</p></div></div>`).join(''),
    // Spaced, so a design that shows skills inline can wrap them.
    skills: of('skills').map((s) => `<span class="skill">${esc(typeof s === 'string' ? s : s.name)}</span>`).join(' '),
    pinned: of('featured').map(postCard).join(''),
    posts: updates.map(postCard).join('')
  }
}

// ── The placeholders, and what JavaScript gets

/** The placeholders a design may use, for the list in Settings, the prompt and the template's README. */
export const PLACEHOLDERS = {
  name: 'your name',
  pronouns: 'your pronouns',
  bio: 'your bio, its lines kept',
  location: 'where you are',
  about: 'your About, its line breaks kept',
  links: 'your links, each an <a class="link"> with its name, like Website or Portfolio',
  website: 'the address of your first link',
  handle: 'your username',
  profile_url: 'your profile’s address on Oporch',
  joined: 'when you joined, like "October 2026"',
  followers: 'how many people follow you',
  following: 'how many people you follow',
  likes: 'how many people liked your profile',
  avatar: 'your photo (or your initials), an element with the class "avatar", ringed green when you are open to work (class "ring-open-to-work") and blue when hiring ("ring-hiring")',
  avatar_url: 'the address of your photo, for an <img> or CSS',
  cover_url: 'the address of your cover picture, for an <img> or CSS',
  open_to_work: 'what work you are open to, a line of text, when you are',
  hiring: 'the word "Hiring", when you are hiring',
  projects: 'your projects, each an <article class="project"> holding its picture (img.project-image) or video (div.video), then div.project-body with h3, p.when, p.project-skills, p.desc and a.url',
  pinned: 'the posts you pinned, each an <a class="post"> like those in {{posts}}',
  posts: 'your latest posts, each an <a class="post"> holding p.post-date, p.post-text, img.post-image and p.post-stats',
  experience: 'your experience, each a div.entry holding div.logo, div.what, h3, p.sub, p.when and p.desc',
  education: 'your education, each a div.entry',
  certifications: 'your licenses and certifications, each a div.entry, with an a.url link when there is one',
  volunteering: 'your volunteering, each a div.entry',
  honors: 'your honors and awards, each a div.entry',
  languages: 'your languages, each a div.entry (h3 the language, p.sub how well)',
  skills: 'your skills, each a span.skill'
}

/** The ring's class on {{avatar}}: names of Oporch's own, so a design's .open or .hiring never dresses the photo. */
const ringOf = (p) => (p.frame === 'open' ? ' ring-open-to-work' : p.frame === 'hiring' ? ' ring-hiring' : '')

/** The placeholders' values for this profile: text escaped, the lists as HTML. */
function values(p, updates) {
  const parts = profileParts(p, updates)
  const joined = p.joined ? new Date(p.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''
  const bio = lines(p.headline)
  return {
    name: esc(p.name),
    pronouns: esc(p.pronouns),
    bio,
    location: esc(p.location),
    about: lines(p.about),
    links: linkList(p.links),
    website: esc(p.links?.[0]?.url ?? ''),
    handle: esc(p.handle),
    profile_url: esc(`${SITE}/u/${encodeURIComponent(p.handle ?? '')}`),
    joined: esc(joined),
    followers: esc((p.counts?.followers ?? 0).toLocaleString('en')),
    following: esc((p.counts?.following ?? 0).toLocaleString('en')),
    likes: esc((p.likes?.total ?? 0).toLocaleString('en')),
    avatar: p.avatar ? `<img class="avatar${ringOf(p)}" src="${esc(media(p.avatar))}" alt="">` : `<span class="avatar${ringOf(p)}">${initial(p.name)}</span>`,
    avatar_url: esc(media(p.avatar)),
    cover_url: esc(media(p.cover)),
    open_to_work: esc(openLine(p.openToWork)),
    hiring: p.hiring ? 'Hiring' : '',
    ...parts,
    // Designs made before still read: the bio where the headline was, the pinned posts where the featured were,
    // the people who follow them where connections were, and nothing where written recommendations were.
    headline: bio,
    featured: parts.pinned,
    connections: esc((p.counts?.followers ?? 0).toLocaleString('en')),
    recommendations: ''
  }
}

/** The profile as data for a design's JavaScript: window.oporch.profile, .posts, .pinned, and .file(name) for a picture. */
function data(p, updates, files) {
  const post = (u) => {
    const x = u.repostOf && !u.text && !u.repostOf.gone ? u.repostOf : u
    return { id: u.id, url: `${SITE}/p?id=${u.id}`, text: x.text ?? '', image: x.image ? media(x.image) : null, at: u.at, likes: u.reactions?.total ?? 0, comments: u.comments ?? 0 }
  }
  return {
    profile: {
      handle: p.handle,
      url: `${SITE}/u/${encodeURIComponent(p.handle ?? '')}`,
      name: p.name,
      pronouns: p.pronouns || '',
      bio: p.headline || '',
      location: p.location || '',
      about: p.about || '',
      links: p.links || [],
      avatar: p.avatar ? media(p.avatar) : null,
      cover: p.cover ? media(p.cover) : null,
      openToWork: p.openToWork ?? null,
      hiring: !!p.hiring,
      joined: p.joined ?? null,
      followers: p.counts?.followers ?? 0,
      following: p.counts?.following ?? 0,
      posts: p.counts?.posts ?? 0,
      likes: p.likes?.total ?? 0,
      skills: (p.skills || []).map((s) => (typeof s === 'string' ? s : s.name)),
      projects: (p.projects || []).map((x) => ({ ...x, image: x.image ? media(`/media/${x.image}`) : null, video: ytId(x.video) })),
      experience: p.experience || [],
      education: p.education || [],
      certifications: p.certifications || [],
      volunteering: p.volunteering || [],
      honors: p.honors || [],
      languages: p.languages || []
    },
    pinned: (p.featured || []).map(post),
    posts: updates.map(post),
    files: Object.fromEntries(Object.entries(files || {}).map(([name, path]) => [name.toLowerCase(), media(path)]))
  }
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g
/** A design's HTML with its placeholders filled in, outside its scripts (a script reads window.oporch instead). */
const fillHtml = (html, v) =>
  String(html)
    .split(/(<script\b[\s\S]*?<\/script\s*>)/i)
    .map((part, i) => (i % 2 ? part : part.replace(PLACEHOLDER, (all, key) => (Object.hasOwn(v, key) ? v[key] : all))))
    .join('')
/** Its CSS: only the pictures' addresses, which hold nothing CSS could read as more than an address. */
const fillCss = (css, v) => String(css).replace(PLACEHOLDER, (all, key) => (key === 'avatar_url' || key === 'cover_url' ? v[key] : all))

// ── Building the page a design is

/** What its own policy lets the page do: its pictures, Google's fonts, cdnjs's libraries, YouTube through /yt.html; nothing sent anywhere. */
const policy = () =>
  [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com/ajax/libs/",
    "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com/ajax/libs/",
    'font-src data: https://fonts.gstatic.com https://cdnjs.cloudflare.com/ajax/libs/',
    `img-src data: blob: ${new URL(API).origin}/media/`,
    `frame-src ${SITE}/yt.html`,
    "form-action 'none'",
    "base-uri 'none'"
  ].join('; ')

/** A relative address's file name ("images/me.jpg" is "me.jpg"), or null for one that goes somewhere of its own. */
const fileName = (ref) => {
  const r = String(ref ?? '').trim()
  if (!r || /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(r)) return null
  try {
    return decodeURIComponent(r.split(/[?#]/)[0].split('/').pop()).toLowerCase() || null
  } catch {
    return null
  }
}
/** Pictures by name in CSS: url(me.jpg) is the uploaded me.jpg. */
const cssFiles = (css, files) =>
  String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (all, q, ref) => {
    const name = fileName(ref)
    return name && files[name] ? `url("${files[name]}")` : all
  })
const SAFE_LINK = /^(https?:|mailto:|tel:|#)/i
const ALLOWED_SHEET = /^https:\/\/(fonts\.googleapis\.com\/|cdnjs\.cloudflare\.com\/ajax\/libs\/)/i
const ALLOWED_SCRIPT = /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\//i
/** Script and style text that cannot end the element early. */
const scriptText = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1')
const styleText = (s) => String(s).replace(/<\/(style)/gi, '<\\/$1')
const attrs = (el) => [...el.attributes].map((a) => ` ${a.name}="${esc(a.value)}"`).join('')

/** What every design starts with: its video boxes 16:9 unless sized, and the ring round the photo. */
const BASE_RULES = `[data-youtube]{position:relative;display:block;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden}
[data-youtube]>iframe.oporch-video{position:absolute;inset:0;width:100%;height:100%;border:0}
.avatar.ring-open-to-work{box-shadow:0 0 0 3px #fff,0 0 0 7px #16a34a}
.avatar.ring-hiring{box-shadow:0 0 0 3px #fff,0 0 0 7px #2563eb}`

/**
 * The whole page of a design: its HTML with the placeholders filled in, cleaned (no frames but YouTube's, no
 * page of its own sending it elsewhere), its pictures found by name, style.css and script.js written in where
 * the page links them (or at the end), and the profile as data for its scripts. A design from before is a
 * piece of a page, and is made one.
 */
export function designDocument(design, p, updates = []) {
  const v = values(p, updates)
  const files = Object.fromEntries(Object.entries(design.files || {}).map(([name, path]) => [name.toLowerCase(), media(path)]))
  const doc = new DOMParser().parseFromString(fillHtml(design.html ?? '', v), 'text/html')
  for (const el of doc.querySelectorAll('[data-if]')) {
    const key = el.getAttribute('data-if').trim()
    if (!Object.hasOwn(v, key) || !v[key] || v[key] === '0') el.remove()
  }
  // Nothing that frames another page or sends this one elsewhere; a YouTube iframe becomes a video box.
  for (const el of doc.querySelectorAll('base, meta, title, object, embed, applet, frame, frameset, portal')) el.remove()
  for (const f of doc.querySelectorAll('iframe')) {
    const id = ytId(f.getAttribute('src'))
    if (!id) {
      f.remove()
      continue
    }
    const box = doc.createElement('div')
    box.setAttribute('data-youtube', f.getAttribute('src'))
    for (const a of ['class', 'style', 'id']) if (f.hasAttribute(a)) box.setAttribute(a, f.getAttribute(a))
    f.replaceWith(box)
  }
  for (const box of doc.querySelectorAll('[data-youtube]')) {
    const link = box.getAttribute('data-youtube')
    const id = ytId(link)
    if (!id) {
      box.removeAttribute('data-youtube')
      continue
    }
    const t = ytStart(link)
    box.innerHTML = `<iframe class="oporch-video" src="${SITE}/yt.html?v=${id}${t ? `&t=${t}` : ''}" title="YouTube video" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy"></iframe>`
  }
  // Links: to the web, mail or a phone, in a new tab; to a place on the page, there; anything else, nowhere.
  for (const el of doc.querySelectorAll('[href]')) {
    const href = el.getAttribute('href').trim()
    if (el.matches('link')) continue
    if (!SAFE_LINK.test(href)) {
      const name = fileName(href)
      if (name && files[name]) el.setAttribute('href', files[name])
      else el.removeAttribute('href')
    }
    if (el.matches('a, area') && /^(https?:|mailto:|tel:)/i.test(el.getAttribute('href') ?? '')) {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer nofollow ugc')
    }
  }
  // Pictures by their names, wherever the page calls them.
  for (const el of doc.querySelectorAll('[src], [poster]')) {
    if (el.matches('script, iframe')) continue
    for (const a of ['src', 'poster']) {
      const name = fileName(el.getAttribute(a))
      if (name && files[name]) el.setAttribute(a, files[name])
    }
  }
  for (const el of doc.querySelectorAll('[srcset]')) {
    el.setAttribute('srcset', el.getAttribute('srcset').replace(/(^|,)\s*([^\s,]+)/g, (all, sep, ref) => (files[fileName(ref)] ? `${sep}${files[fileName(ref)]}` : all)))
  }
  for (const el of doc.querySelectorAll('[style]')) el.setAttribute('style', cssFiles(el.getAttribute('style'), files))
  for (const el of doc.querySelectorAll('style')) el.textContent = cssFiles(el.textContent, files)

  // style.css where the page links it, script.js where it loads it; other sheets and scripts only from Google Fonts and cdnjs.
  const css = cssFiles(fillCss(design.css ?? '', v), files)
  const js = String(design.js ?? '')
  const mark = (text) => doc.createComment(`oporch:${text}`)
  let cssPlaced = false
  let jsPlaced = false
  for (const link of doc.querySelectorAll('link')) {
    const href = link.getAttribute('href') ?? ''
    if (/\bstylesheet\b/i.test(link.getAttribute('rel') ?? '') && ALLOWED_SHEET.test(href)) continue
    if (!cssPlaced && /\bstylesheet\b/i.test(link.getAttribute('rel') ?? '') && fileName(href)?.endsWith('.css')) {
      link.replaceWith(mark('css'))
      cssPlaced = true
    } else link.remove()
  }
  for (const s of doc.querySelectorAll('script[src]')) {
    const src = s.getAttribute('src') ?? ''
    if (ALLOWED_SCRIPT.test(src)) continue
    if (!jsPlaced && fileName(src)?.endsWith('.js')) {
      // Where it was loaded, so it runs when it would have; one that waited for the page (defer) at its end.
      const m = mark(s.type === 'module' ? 'module' : 'js')
      if (s.hasAttribute('defer') && s.type !== 'module') {
        doc.body.append(m)
        s.remove()
      } else s.replaceWith(m)
      jsPlaced = true
    } else s.remove()
  }
  if (!cssPlaced && css.trim()) doc.head.append(mark('css'))
  if (!jsPlaced && js.trim()) doc.body.append(mark('js'))

  const boot = `window.oporch = ${JSON.stringify(data(p, updates, design.files)).replace(/</g, '\\u003c')};
oporch.file = (name) => oporch.files[String(name).split('/').pop().toLowerCase()] ?? null;`
  const out = (el) =>
    el.innerHTML
      .replace(/<!--oporch:css-->/g, () => `<style>${styleText(css)}</style>`)
      .replace(/<!--oporch:(js|module)-->/g, (all, kind) => `<script${kind === 'module' ? ' type="module"' : ''}>${scriptText(js)}\n</script>`)
  return `<!doctype html><html${attrs(doc.documentElement)}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_RULES}</style><script>${scriptText(boot)}</script>${out(doc.head)}</head><body${attrs(doc.body)}>${out(doc.body)}</body></html>`
}

/**
 * A member's design, shown in a frame of its own inside `box`, filled in from the profile `p` and their latest
 * `updates`. The frame is a data: document whose origin is no one's: its scripts run, and reach nothing of the
 * page around it, the viewer's session or Oporch. It starts as a few lines that ask for the page and write it in
 * (its policy holds from the first of them), so a design is not limited by how long an address may be.
 * `fill`: it is the whole window (the profile), else as tall as its box makes it (the previews).
 */
export function mountDesign(box, design, p, updates = [], { fill = false } = {}) {
  const page = designDocument(design, p, updates)
  const f = document.createElement('iframe')
  f.className = fill ? 'design fill' : 'design'
  f.title = `${p.name ?? 'Their'} profile`
  // allow-same-origin keeps the data: document's own origin, which is no one's, not ours: it is what lets YouTube's player inside it play.
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
  f.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media')
  f.setAttribute('referrerpolicy', 'no-referrer')
  const send = (e) => {
    if (!f.isConnected) return removeEventListener('message', send)
    if (e.source === f.contentWindow && e.data?.oporch === 'ready') f.contentWindow.postMessage({ oporch: 'page', html: page }, '*')
  }
  addEventListener('message', send)
  const start = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy()}"></head><body><script>onmessage=function(e){if(e.source!==parent||!e.data||e.data.oporch!=='page')return;onmessage=null;document.open();document.write(e.data.html);document.close()};parent.postMessage({oporch:'ready'},'*')</script></body></html>`
  f.src = `data:text/html;base64,${btoa(start)}`
  box.replaceChildren(f)
  return f
}

// ── The template, the prompt, and the files dropped in

/**
 * The standard profile as a design's three files (the owner, 2026-10-23: "they should also be able to download
 * the template of the files"): LinkedIn's layout, every placeholder in use, and a little JavaScript to start from.
 */
export const TEMPLATE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{name}}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="profile">
    <section class="card top">
      <div class="cover" style="background-image:url('{{cover_url}}')"></div>
      <div class="intro">
        {{avatar}}
        <h1>{{name}} <span class="pronouns" data-if="pronouns">({{pronouns}})</span></h1>
        <p class="bio" data-if="bio">{{bio}}</p>
        <p class="meta"><span data-if="location">{{location}} · </span>{{followers}} followers · {{following}} following</p>
        <p class="links" data-if="links">{{links}}</p>
        <p class="open" data-if="open_to_work">{{open_to_work}}</p>
        <p class="hiring" data-if="hiring">{{hiring}}</p>
      </div>
    </section>
    <section class="card" data-if="about"><h2>About</h2><p class="about">{{about}}</p></section>
    <section class="card" data-if="projects"><h2>Projects</h2><div class="projects">{{projects}}</div></section>
    <section class="card" data-if="pinned"><h2>Pinned</h2><div class="posts">{{pinned}}</div></section>
    <section class="card" data-if="posts"><h2>Posts</h2><div class="posts">{{posts}}</div></section>
    <section class="card" data-if="experience"><h2>Experience</h2>{{experience}}</section>
    <section class="card" data-if="education"><h2>Education</h2>{{education}}</section>
    <section class="card" data-if="skills"><h2>Skills</h2><div class="skills">{{skills}}</div></section>
    <section class="card" data-if="certifications"><h2>Licenses and certifications</h2>{{certifications}}</section>
    <section class="card" data-if="volunteering"><h2>Volunteering</h2>{{volunteering}}</section>
    <section class="card" data-if="honors"><h2>Honors and awards</h2>{{honors}}</section>
    <section class="card" data-if="languages"><h2>Languages</h2>{{languages}}</section>
  </main>
  <script src="script.js"></script>
</body>
</html>
`

export const TEMPLATE_CSS = `* { box-sizing: border-box; }
/* The page is the whole window. Oporch's menu floats over its left edge (64px), the like, recommend and share
   buttons over its top right, and the follow and message buttons over its bottom right; on a phone, bars run
   across its top and bottom (56px each). */
body { margin: 0; padding: 76px 24px 96px 88px; background: #efeeea; color: #111; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: #1d4ed8; }
.profile { display: flex; flex-direction: column; gap: 8px; max-width: 880px; margin: 0 auto; }
.card { background: #fff; border: 1px solid #d6d4ce; border-radius: 8px; padding: 20px 24px; }
.top { padding: 0; overflow: hidden; }
.cover { height: 200px; background: #e2e1dc center / cover; }
.intro { padding: 0 24px 24px; }
.avatar { display: flex; align-items: center; justify-content: center; width: 152px; height: 152px; margin-top: -100px; border: 4px solid #fff; border-radius: 50%; object-fit: cover; background: #e8e7e2; color: #333; font-size: 56px; font-weight: 700; }
h1 { margin: 12px 0 0; font-size: 24px; }
.pronouns { color: #575757; font-size: 14px; font-weight: 400; }
.bio { margin: 4px 0 0; font-size: 16px; }
.meta { margin: 6px 0 0; color: #575757; font-size: 14px; }
.links { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }
.link { padding: 6px 14px; border: 1px solid #85837e; border-radius: 16px; color: #111; font-size: 14px; font-weight: 600; text-decoration: none; }
.link:hover { background: #ebeae5; }
.open, .hiring { display: inline-block; margin: 12px 8px 0 0; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
.open { background: #e3f1e7; color: #166534; }
.hiring { background: #e5ecfb; color: #1d4ed8; }
h2 { margin: 0 0 12px; font-size: 20px; }
.about { margin: 0; }
.projects { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.project { overflow: hidden; border: 1px solid #d6d4ce; border-radius: 8px; }
.project-image { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.project-body { padding: 14px 16px; }
.project h3 { margin: 0; font-size: 17px; }
.project p { margin: 4px 0 0; }
.project-skills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px !important; }
.project-skills span { padding: 2px 10px; border-radius: 12px; background: #efeeea; font-size: 13px; }
.entry { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #e2e0da; }
.entry:first-of-type { border-top: 0; padding-top: 0; }
.logo { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 4px; background: #e8e7e2; color: #333; font-weight: 700; }
.entry h3 { margin: 0; font-size: 16px; }
.entry p { margin: 2px 0 0; }
.sub { font-size: 14px; }
.when { color: #575757; font-size: 14px; }
.desc { margin-top: 8px !important; }
.url { display: inline-block; margin-top: 10px; padding: 4px 12px; border: 1px solid #85837e; border-radius: 16px; color: #111; font-size: 14px; font-weight: 600; text-decoration: none; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; }
.skill { padding: 4px 12px; border: 1px solid #b9b7b1; border-radius: 16px; }
.posts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.post { display: block; padding: 14px; border: 1px solid #d6d4ce; border-radius: 8px; color: inherit; text-decoration: none; }
.post:hover { border-color: #85837e; }
.post p { margin: 0; }
.post-date, .post-stats { color: #575757; font-size: 13px; }
.post-text { margin: 6px 0 !important; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.post-image { display: block; width: 100%; max-height: 220px; margin: 6px 0; border-radius: 6px; object-fit: cover; }
/* script.js shows each card as it scrolls into view: they wait only once it runs. */
.js .card { opacity: 0; transform: translateY(14px); transition: opacity .5s ease, transform .5s ease; }
.js .card.shown { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .js .card { opacity: 1; transform: none; transition: none; } }
@media (max-width: 767px) {
  body { padding: 64px 0 132px; }
}
@media (max-width: 600px) {
  .card { padding: 16px; border-radius: 0; }
  .top { padding: 0; }
  .intro { padding: 0 16px 16px; }
  .cover { height: 120px; }
  .avatar { width: 104px; height: 104px; margin-top: -60px; font-size: 40px; }
}
`

export const TEMPLATE_JS = `// script.js runs on your profile page. Everything on your profile is in window.oporch:
// oporch.profile (name, bio, links, projects, experience, skills...), oporch.posts, oporch.pinned,
// and oporch.file('photo.jpg') for the address of a picture you uploaded.

// Each card shows as it scrolls into view.
document.documentElement.classList.add('js')
const seen = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    e.target.classList.add('shown')
    seen.unobserve(e.target)
  }
}, { threshold: 0.1 })
for (const card of document.querySelectorAll('.card')) seen.observe(card)
`

/**
 * The prompt for a member's own AI (the owner, 2026-10-23: "The prompt must only include the instructions on the
 * format, the rest should be added by the user itself"): what the files are and what works in them. What it
 * should look like is theirs to add, under its last line.
 */
export const designPrompt = () => `Make my profile page for Oporch, a site where people show their work. Follow this format exactly. After it, I describe how I want the page to look.

${designFormat()}
HOW I WANT IT TO LOOK
`

/** The template's README.txt: the same format, for whoever opens the files. */
export const designReadme = () => `YOUR OPORCH PROFILE DESIGN

These three files are your profile page as a small website. Change them yourself, or give them to an AI with the
prompt from Settings > Design Your Profile. Then drop the files, and your pictures, into Settings > Design Your
Profile, check the preview, and send it for review.

${designFormat()}`

function designFormat() {
  const list = Object.entries(PLACEHOLDERS)
    .map(([k, v]) => `- {{${k}}}: ${v}`)
    .join('\n')
  return `FILES
Give me three files to download: index.html, style.css and script.js.
- index.html is a normal web page. Link the other two the usual way: <link rel="stylesheet" href="style.css"> in the head, and <script src="script.js"></script> at the end of the body.
- Pictures: use them by their file names, like <img src="photo.jpg"> or url("photo.jpg") in CSS. I upload them with the same names (JPEG, PNG, GIF or WebP).
- Videos: YouTube only. Where a video goes, put <div data-youtube="https://www.youtube.com/watch?v=VIDEO_ID"></div>. It becomes a player, 16:9 unless you give it another size.

MY DETAILS
Oporch fills these placeholders in from my profile every time the page is shown. Use them; never type my details in yourself:
${list}
- The lists ({{projects}}, {{posts}} and the rest) arrive as ready-made HTML with the classes above. Style those classes; do not build the lists yourself.
- Put data-if="placeholder name" on any element that should only show when that placeholder has something, for example <section data-if="projects">. Use it on every section, since some of mine may be empty.
- Placeholders work in the HTML (and {{avatar_url}} and {{cover_url}} in the CSS), not in JavaScript. JavaScript gets everything as data instead: window.oporch.profile (name, bio, links, projects, experience, skills and the rest), window.oporch.posts, window.oporch.pinned, and window.oporch.file("photo.jpg") for the address of a picture.

THE PAGE
- It is the whole browser window and scrolls like any web page. It must look right on a phone 320px wide and on a wide screen.
- Oporch's menu floats over it: a bar 64px wide down the left edge on screens 768px and wider; on phones, a bar 56px tall across the top and another across the bottom. A small bar of buttons sits in the top right corner (about 200 by 56px) and another in the bottom right corner (about 300 by 56px). Backgrounds may run under them; keep text, links and pictures clear of them.

WHAT WORKS
- HTML, CSS and JavaScript, all of them: animations, transitions, canvas, SVG, WebGL.
- Fonts from Google Fonts, with a <link> or @import. Libraries only from cdnjs.cloudflare.com, by their full https address (for example GSAP or three.js).
- Nothing else from other websites loads: no fetch or XMLHttpRequest, no forms that send anything, no pictures from other sites, no iframes but the YouTube boxes. Links to other sites open in a new tab.
- At most 2 MB of HTML, 1 MB of CSS and 1 MB of JavaScript. Pictures up to 30 MB each, 100 MB in all.
- Keep it appropriate for a professional network: Oporch checks every design before it is shown.
`
}

/** A file to save, as the browser saves a download. */
export function download(name, blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}

// ── ZIP, written and read: the template goes out as one, and a design may come back as one

const CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (bytes) => {
  let c = ~0
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8)
  return ~c >>> 0
}
/** A .zip of these files, stored as they are: [{ name, text }]. */
export function zip(entries) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const { name, text } of entries) {
    const n = enc.encode(name)
    const d = enc.encode(text)
    const crc = crc32(d)
    const head = (size, sig) => {
      const v = new DataView(new ArrayBuffer(size))
      v.setUint32(0, sig, true)
      return v
    }
    const local = head(30, 0x04034b50)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // names in UTF-8
    local.setUint16(12, 0x21, true) // 1 January 1980
    local.setUint32(14, crc, true)
    local.setUint32(18, d.length, true)
    local.setUint32(22, d.length, true)
    local.setUint16(26, n.length, true)
    parts.push(local, n, d)
    const c = head(46, 0x02014b50)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(14, 0x21, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, d.length, true)
    c.setUint32(24, d.length, true)
    c.setUint16(28, n.length, true)
    c.setUint32(42, offset, true)
    central.push(c, n)
    offset += 30 + n.length + d.length
  }
  const size = central.reduce((s, x) => s + x.byteLength, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, size, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}

/** The files in a .zip, as File objects: stored or deflated, folders and the Mac's leftovers left out. */
export async function unzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer())
  const v = new DataView(buf.buffer)
  let end = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error(`${file.name} is not a zip file that can be opened.`)
  const count = v.getUint16(end + 10, true)
  let at = v.getUint32(end + 16, true)
  const out = []
  const dec = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (v.getUint32(at, true) !== 0x02014b50) break
    const method = v.getUint16(at + 10, true)
    const packed = v.getUint32(at + 20, true)
    const nameLen = v.getUint16(at + 28, true)
    const extra = v.getUint16(at + 30, true)
    const note = v.getUint16(at + 32, true)
    const local = v.getUint32(at + 42, true)
    const name = dec.decode(buf.subarray(at + 46, at + 46 + nameLen))
    at += 46 + nameLen + extra + note
    if (name.endsWith('/') || /(^|\/)(__MACOSX|\.)/.test(name)) continue
    const from = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const raw = buf.subarray(from, from + packed)
    let bytes
    if (method === 0) bytes = raw
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    else continue
    out.push(new File([bytes], name.split('/').pop(), { type: TYPES[name.split('.').pop().toLowerCase()] ?? '' }))
  }
  return out
}
const TYPES = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }

/** Every file dropped, folders opened and zips unpacked. */
export async function droppedFiles(dt) {
  const found = []
  const walk = async (entry) => {
    if (entry.isFile) found.push(await new Promise((ok, no) => entry.file(ok, no)))
    else if (entry.isDirectory) {
      const reader = entry.createReader()
      for (let batch; (batch = await new Promise((ok, no) => reader.readEntries(ok, no))).length; ) for (const e of batch) await walk(e)
    }
  }
  const entries = [...(dt.items ?? [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean)
  if (entries.length) for (const e of entries) await walk(e)
  else found.push(...(dt.files ?? dt))
  const out = []
  for (const f of found) out.push(...(/\.zip$/i.test(f.name) ? await unzip(f) : [f]))
  return out
}

/**
 * What the files dropped are: the page (index.html, or the only .html), its CSS and its JavaScript (style.css and
 * script.js, or all of them by name, joined), pictures, and the rest, which a design cannot use.
 */
export async function sortFiles(files) {
  const by = (re) => files.filter((f) => re.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))
  const pages = by(/\.html?$/i)
  const page = pages.find((f) => /^index\.html?$/i.test(f.name)) ?? pages[0] ?? null
  const joined = async (list, first) => {
    if (!list.length) return null
    const ordered = [...list.filter((f) => first.test(f.name)), ...list.filter((f) => !first.test(f.name))]
    const texts = await Promise.all(ordered.map((f) => f.text()))
    return ordered.length === 1 ? texts[0] : texts.map((t, i) => `/* ${ordered[i].name} */\n${t}`).join('\n\n')
  }
  return {
    html: page ? await page.text() : null,
    css: await joined(by(/\.css$/i), /^style\.css$/i),
    js: await joined(by(/\.m?js$/i), /^script\.js$/i),
    pictures: by(/\.(jpe?g|png|gif|webp)$/i),
    unused: files.filter((f) => !/\.(html?|css|m?js|jpe?g|png|gif|webp)$/i.test(f.name) || (pages.length > 1 && f !== page && /\.html?$/i.test(f.name))).map((f) => f.name)
  }
}

/** An AI's answer pasted in instead of its files: its ```html, ```css and ```js blocks, or a whole page with <style> and <script> in it. */
export function parseAnswer(text) {
  const block = (langs) => new RegExp('```(?:' + langs + ')[^\\n]*\\n([\\s\\S]*?)```', 'i').exec(text)?.[1]
  const html = block('html') ?? (/```/.test(text) ? '' : text)
  return { html: html.trim(), css: (block('css') ?? '').trim(), js: (block('javascript|js') ?? '').trim() }
}

/** A size: KB under a megabyte, else MB to one decimal. */
export const mb = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)
