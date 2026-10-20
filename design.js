/**
 * A member's own profile design (the owner, 2026-10-08: "our main highlight is the custom profile that
 * the users can show their creativity on while still being able to show the regular features of the
 * profile like posts projects and all"). HTML and CSS of their own, its {{placeholders}} filled in from
 * the profile each time it is shown, so it never goes out of date. With its pictures, at most 10 MB.
 *
 * Shown in a sealed frame (mountDesign): no script runs in it but ours, which only says how tall it is;
 * nothing in it reaches the page around it, a form, or another site (pictures are ours, fonts Google's).
 * An admin approves a design before anyone else sees it (server: social/design.ts).
 */
import { API, esc, media, plural } from '/app.js'

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

/** "Open to work: Data Analyst, Product Analyst in Pune, Remote (Hybrid, Remote)", or nothing. */
export function openLine(o) {
  if (!o) return ''
  const types = (o.types || []).map((t) => WORK_TYPE[t] ?? t)
  return `Open to work${o.titles?.length ? `: ${o.titles.join(', ')}` : ''}${o.places?.length ? ` in ${o.places.join(', ')}` : ''}${types.length ? ` (${types.join(', ')})` : ''}`
}

// ── A profile's parts as HTML: the same markup on the standard profile and in a design's placeholders

const initial = (s) => esc([...String(s || '?').trim()][0] ?? '?').toUpperCase()
// Line breaks as <br>, so they show in a design whatever its CSS says about white-space.
const lines = (s) => esc(s).replace(/\r?\n/g, '<br>')
const urlLink = (url, label) => (url ? `<a class="url" href="${esc(url)}" target="_blank" rel="noopener nofollow ugc">${label}</a>` : '')
const entry = (title, sub, dates, desc, logo, link = '') =>
  `<div class="entry"><div class="logo" aria-hidden="true">${initial(logo)}</div><div class="what"><h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${
    dates ? `<p class="when">${esc(dates)}</p>` : ''
  }${desc ? `<p class="desc">${lines(desc)}</p>` : ''}${link}</div></div>`

/** An update as a card in a design: plain text and its picture, linking to the update itself. */
function postCard(u) {
  const x = u.repostOf && !u.text && !u.repostOf.gone ? u.repostOf : u
  const stats = [u.reactions?.total ? plural(u.reactions.total, 'reaction') : '', u.comments ? plural(u.comments, 'comment') : ''].filter(Boolean).join(' · ')
  return `<a class="post" href="${location.origin}/p?id=${u.id}"><p class="post-date">${x === u ? '' : 'Reposted · '}${esc(day(u.at))}</p>${x.text ? `<p class="post-text">${lines(x.text)}</p>` : ''}${
    x.image ? `<img class="post-image" src="${esc(media(x.image))}" alt="">` : ''
  }${stats ? `<p class="post-stats">${stats}</p>` : ''}</a>`
}

export function profileParts(p, updates = []) {
  const of = (k) => p[k] || []
  return {
    experience: of('experience').map((x) => entry(x.title || x.company, [x.title ? x.company : '', x.location].filter(Boolean).join(' · '), span(x.start, x.end, x.current), x.description, x.company || x.title)).join(''),
    education: of('education').map((x) => entry(x.school, [x.degree, x.field].filter(Boolean).join(', '), span(x.start, x.end), '', x.school)).join(''),
    certifications: of('certifications')
      .map((x) => entry(x.name, x.issuer, [x.issued ? `Issued ${when(x.issued).text}` : '', x.expires ? `Expires ${when(x.expires).text}` : ''].filter(Boolean).join(' · '), x.credentialId ? `Credential ID ${x.credentialId}` : '', x.issuer || x.name, urlLink(x.url, 'Show credential')))
      .join(''),
    projects: of('projects').map((x) => entry(x.name, '', span(x.start, x.end), x.description, x.name, urlLink(x.url, 'Show project'))).join(''),
    volunteering: of('volunteering').map((x) => entry(x.role, [x.organization, x.cause].filter(Boolean).join(' · '), span(x.start, x.end, x.current), x.description, x.organization)).join(''),
    honors: of('honors').map((x) => entry(x.title, x.issuer ? `Issued by ${x.issuer}` : '', x.date ? when(x.date).text : '', x.description, x.title)).join(''),
    languages: of('languages').map((x) => `<div class="entry"><div class="what"><h3>${esc(x.name)}</h3><p class="sub">${esc(PROFICIENCY[x.proficiency] ?? '')}</p></div></div>`).join(''),
    // Spaced, so a design that shows skills inline can wrap them.
    skills: of('skills').map((s) => `<span class="skill">${esc(typeof s === 'string' ? s : s.name)}</span>`).join(' '),
    recommendations: of('recommendations')
      .map((r) => `<blockquote class="rec"><p>${lines(r.text)}</p><footer><b>${esc(r.author?.name ?? '')}</b>${r.author?.headline ? `, ${esc(r.author.headline)}` : ''}${r.relationship ? ` · ${esc(r.relationship)}` : ''}</footer></blockquote>`)
      .join(''),
    featured: of('featured').map(postCard).join(''),
    posts: updates.map(postCard).join('')
  }
}

// ── What a design starts from, and what it can use

/**
 * The standard profile, LinkedIn's, as HTML and CSS (the owner, 2026-10-08: "the base would be like
 * linkedin still"). A section with data-if shows only when its placeholder has something in it.
 */
export const BASE_HTML = `<main class="profile">
  <section class="card top">
    <div class="cover" style="background-image:url('{{cover_url}}')"></div>
    <div class="intro">
      {{avatar}}
      <h1>{{name}} <span class="pronouns" data-if="pronouns">({{pronouns}})</span></h1>
      <p class="headline">{{headline}}</p>
      <p class="meta"><span data-if="location">{{location}} · </span>{{connections}} connections · {{followers}} followers</p>
      <p class="open" data-if="open_to_work">{{open_to_work}}</p>
      <p class="hiring" data-if="hiring">{{hiring}}</p>
      <a class="site" data-if="website" href="{{website}}">{{website}}</a>
    </div>
  </section>
  <section class="card" data-if="featured"><h2>Featured</h2><div class="posts">{{featured}}</div></section>
  <section class="card" data-if="about"><h2>About</h2><p class="about">{{about}}</p></section>
  <section class="card" data-if="posts"><h2>Activity</h2><div class="posts">{{posts}}</div></section>
  <section class="card" data-if="experience"><h2>Experience</h2>{{experience}}</section>
  <section class="card" data-if="education"><h2>Education</h2>{{education}}</section>
  <section class="card" data-if="certifications"><h2>Licenses and certifications</h2>{{certifications}}</section>
  <section class="card" data-if="projects"><h2>Projects</h2>{{projects}}</section>
  <section class="card" data-if="volunteering"><h2>Volunteering</h2>{{volunteering}}</section>
  <section class="card" data-if="skills"><h2>Skills</h2><div class="skills">{{skills}}</div></section>
  <section class="card" data-if="recommendations"><h2>Recommendations</h2>{{recommendations}}</section>
  <section class="card" data-if="honors"><h2>Honors and awards</h2>{{honors}}</section>
  <section class="card" data-if="languages"><h2>Languages</h2>{{languages}}</section>
</main>`

export const BASE_CSS = `* { box-sizing: border-box; }
body { margin: 0; background: #f4f2ee; color: #191919; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: #0a66c2; }
.profile { display: flex; flex-direction: column; gap: 8px; max-width: 880px; margin: 0 auto; }
.card { background: #fff; border: 1px solid #e0dfdc; border-radius: 8px; padding: 20px 24px; }
.top { padding: 0; overflow: hidden; }
.cover { height: 200px; background: #a0b4b7 center / cover; }
.intro { padding: 0 24px 24px; }
.avatar { display: flex; align-items: center; justify-content: center; width: 152px; height: 152px; margin-top: -100px; border: 4px solid #fff; border-radius: 50%; object-fit: cover; background: #d9d9d9; color: #555; font-size: 56px; font-weight: 700; }
h1 { margin: 12px 0 0; font-size: 24px; }
.pronouns { color: #666; font-size: 14px; font-weight: 400; }
.headline { margin: 4px 0 0; font-size: 16px; }
.meta { margin: 6px 0 0; color: #666; font-size: 14px; }
.open, .hiring { display: inline-block; margin: 12px 8px 0 0; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
.open { background: #e6f4ea; color: #1a5d2e; }
.hiring { background: #ede7f6; color: #4a2a8a; }
.site { display: block; margin-top: 8px; font-weight: 600; text-decoration: none; }
h2 { margin: 0 0 12px; font-size: 20px; }
.about { margin: 0; white-space: pre-wrap; }
.entry { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #eee; }
.entry:first-of-type { border-top: 0; padding-top: 0; }
.logo { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 4px; background: #e9e5df; color: #666; font-weight: 700; }
.entry h3 { margin: 0; font-size: 16px; }
.entry p { margin: 2px 0 0; }
.sub { font-size: 14px; }
.when { color: #666; font-size: 14px; }
.desc { margin-top: 8px !important; white-space: pre-wrap; }
.url { display: inline-block; margin-top: 8px; padding: 4px 12px; border: 1px solid #666; border-radius: 16px; color: #444; font-size: 14px; font-weight: 600; text-decoration: none; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; }
.skill { padding: 4px 12px; border: 1px solid #ccc; border-radius: 16px; }
.posts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.post { display: block; padding: 14px; border: 1px solid #e0dfdc; border-radius: 8px; color: inherit; text-decoration: none; }
.post:hover { border-color: #999; }
.post p { margin: 0; }
.post-date, .post-stats { color: #666; font-size: 13px; }
.post-text { margin: 6px 0 !important; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.post-image { display: block; width: 100%; max-height: 220px; margin: 6px 0; border-radius: 6px; object-fit: cover; }
.rec { margin: 0; padding: 12px 0; border-top: 1px solid #eee; }
.rec:first-of-type { border-top: 0; padding-top: 0; }
.rec p { margin: 0 0 6px; white-space: pre-wrap; }
.rec footer { color: #666; font-size: 14px; }
@media (max-width: 600px) {
  .card { padding: 16px; border-radius: 0; }
  .top { padding: 0; }
  .intro { padding: 0 16px 16px; }
  .cover { height: 120px; }
  .avatar { width: 104px; height: 104px; margin-top: -60px; font-size: 40px; }
}
`

/** The placeholders a design may use, for the editor's list and the AI prompt. */
export const PLACEHOLDERS = {
  name: 'your name',
  pronouns: 'your pronouns',
  headline: 'your headline',
  location: 'where you are',
  about: 'your About, its line breaks kept (style it with white-space: pre-wrap)',
  website: 'your website’s address',
  handle: 'your username',
  profile_url: 'your profile’s address on GMAFJ',
  joined: 'when you joined, like "October 2026"',
  connections: 'how many connections you have',
  followers: 'how many followers you have',
  avatar: 'your photo (or your initials), an element with the class "avatar"',
  avatar_url: 'the address of your photo, for an <img> or CSS',
  cover_url: 'the address of your cover picture, for an <img> or CSS',
  open_to_work: 'what work you are open to, a line of text, when you are',
  hiring: 'the word "Hiring", when you are hiring',
  featured: 'your featured updates, each an <a class="post"> like those in {{posts}}',
  posts: 'your latest updates, each an <a class="post"> holding p.post-date, p.post-text, img.post-image and p.post-stats',
  experience: 'your experience, each a div.entry holding div.logo, div.what, h3, p.sub, p.when and p.desc',
  education: 'your education, each a div.entry',
  certifications: 'your licenses and certifications, each a div.entry, with an a.url link when there is one',
  projects: 'your projects, each a div.entry, with an a.url link when there is one',
  volunteering: 'your volunteering, each a div.entry',
  honors: 'your honors and awards, each a div.entry',
  languages: 'your languages, each a div.entry (h3 the language, p.sub how well)',
  skills: 'your skills, each a span.skill',
  recommendations: 'recommendations people wrote you, each a blockquote.rec holding p and footer'
}

/** The placeholders' values for this profile: text escaped, the lists as HTML. */
function values(p, updates) {
  const parts = profileParts(p, updates)
  const joined = p.joined ? new Date(p.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''
  return {
    name: esc(p.name),
    pronouns: esc(p.pronouns),
    headline: esc(p.headline),
    location: esc(p.location),
    about: lines(p.about),
    website: esc(p.website),
    handle: esc(p.handle),
    profile_url: esc(`${location.origin}/u?h=${encodeURIComponent(p.handle ?? '')}`),
    joined: esc(joined),
    connections: esc((p.counts?.connections ?? 0).toLocaleString('en')),
    followers: esc((p.counts?.followers ?? 0).toLocaleString('en')),
    avatar: p.avatar ? `<img class="avatar" src="${esc(media(p.avatar))}" alt="">` : `<span class="avatar">${initial(p.name)}</span>`,
    avatar_url: esc(media(p.avatar)),
    cover_url: esc(media(p.cover)),
    open_to_work: esc(openLine(p.openToWork)),
    hiring: p.hiring ? 'Hiring' : '',
    ...parts
  }
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g
/** A design's HTML with its placeholders filled in. */
export const fillDesign = (html, v) => String(html).replace(PLACEHOLDER, (all, key) => (Object.hasOwn(v, key) ? v[key] : all))
/** Its CSS: only the pictures' addresses, which hold nothing CSS could read as more than an address. */
const fillCss = (css, v) => String(css).replace(PLACEHOLDER, (all, key) => (key === 'avatar_url' || key === 'cover_url' ? v[key] : all))

const SAFE_LINK = new Set(['http:', 'https:', 'mailto:', 'tel:'])
/**
 * What the frame will not hold, whatever an admin approved: scripts, frames, forms, embeds, and the
 * <meta>, <base> and <link> that could send the frame somewhere else; event attributes; links that are
 * not web, mail or phone addresses (no javascript:, however it is spelled); SVG animations of a link.
 * Every link opens in a new tab. An element with data-if="x" stays only when {{x}} has something.
 * DOMParser runs nothing.
 */
function cleanDesign(html, v) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  for (const el of doc.querySelectorAll('[data-if]')) {
    const key = el.getAttribute('data-if').trim()
    if (!Object.hasOwn(v, key) || !v[key] || v[key] === '0') el.remove()
  }
  for (const el of doc.querySelectorAll('script, iframe, frame, frameset, object, embed, applet, form, meta, base, link, portal, video, audio, source, track')) el.remove()
  for (const el of doc.querySelectorAll('animate, set')) {
    if (/href/i.test(el.getAttribute('attributeName') ?? '')) el.remove()
  }
  for (const el of doc.body.querySelectorAll('*')) {
    for (const { name, value } of [...el.attributes]) {
      const n = name.toLowerCase()
      if (n.startsWith('on') || n === 'formaction' || n === 'srcdoc') el.removeAttribute(name)
      else if (n === 'href' || n === 'xlink:href' || n === 'action') {
        let ok = value.trim().startsWith('#')
        try {
          ok ||= SAFE_LINK.has(new URL(value, location.href).protocol)
        } catch {
          ok = false
        }
        if (!ok) el.removeAttribute(name)
      }
    }
  }
  for (const a of doc.querySelectorAll('a, area')) {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer nofollow ugc')
  }
  return doc.body.innerHTML
}

/*
 * The frame sizes itself to its page: one script of ours inside it says how tall the page is, and the
 * page's own Content-Security-Policy lets that script run and nothing else (a fresh nonce each time, and
 * the page's scripts are taken out before it is shown anyway). The parent believes only a height, only
 * from its own frames, at most 100 times each, and never more than 20000px: a page that grows when it
 * is made taller cannot run away with it.
 */
const frames = new WeakMap()
addEventListener('message', (e) => {
  const f = e.source && frames.get(e.source)
  const h = e.data?.gmafjHeight
  if (!f || typeof h !== 'number' || !Number.isFinite(h) || ++f.n > 100) return
  const px = Math.min(20000, Math.max(80, Math.ceil(h)))
  if (Math.abs(px - f.h) > 1) f.el.style.height = `${(f.h = px)}px`
})

/**
 * A member's design, shown in a sealed frame inside `box`: its own HTML and CSS, its placeholders
 * filled in from the profile `p` and their latest `updates`. Pictures only from GMAFJ, fonts only from
 * Google Fonts, no forms, nothing that can move the page around it; links open in a new tab.
 */
export function mountDesign(box, { html, css }, p, updates = []) {
  const v = values(p, updates)
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const csp = `default-src 'none'; img-src data: ${new URL(API).origin}; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; script-src 'nonce-${nonce}'`
  const sizer = `addEventListener('load',function(){var p=function(){parent.postMessage({gmafjHeight:document.documentElement.getBoundingClientRect().height},'*')};p();new ResizeObserver(p).observe(document.documentElement)})`
  const f = document.createElement('iframe')
  f.className = 'design'
  f.title = `${p.name ?? 'Their'} profile`
  f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox')
  f.setAttribute('referrerpolicy', 'no-referrer')
  f.style.height = '600px'
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><script nonce="${nonce}">${sizer}</script><style>${fillCss(css, v).replace(/<\/style/gi, '<\\/style')}</style></head><body>${cleanDesign(fillDesign(html, v), v)}</body></html>`
  box.replaceChildren(f)
  frames.set(f.contentWindow, { el: f, n: 0, h: 600 })
  return f
}

/** Does this design show the updates itself? Then the profile page does not list them again under it. */
export const showsPosts = (html) => /\{\{\s*posts\s*\}\}/.test(html ?? '')

// ── The prompt a member gives their own AI, and its answer read back

/**
 * The prompt for a member's AI to design their profile with (the owner, 2026-10-08: "so that the user
 * can just make minute changes and give their ai model the prompt"). The first lines are theirs to change.
 */
export function designPrompt({ headline = '', pictures = [] } = {}) {
  const list = Object.entries(PLACEHOLDERS)
    .map(([k, v]) => `- {{${k}}}: ${v}`)
    .join('\n')
  return `Design my profile page on GMAFJ, a social network for jobs (like LinkedIn). Write its HTML and CSS.

The look I want: bold and modern, a dark background, one bright accent colour, big type, and my projects shown as cards.
What I do: ${headline || 'my job title'}

HOW IT WORKS
- My page is shown inside a frame, as the HTML you write (only what goes inside <body>, no <html> or <head>) and the CSS you write. The frame is as wide as the page and grows as tall as the design, so it must look right on a phone 320px wide and on a wide screen.
- GMAFJ fills in these placeholders from my profile every time the page is shown. Use them; never type my details in yourself:
${list}
- The lists ({{experience}}, {{posts}} and the rest) arrive as ready-made HTML with the classes above. Style those classes; do not try to build the lists yourself.
- Put data-if="placeholder name" on any element that should only show when that placeholder has something, for example <section data-if="projects">. Use it on every section, since some of mine may be empty.

RULES
- No JavaScript: scripts are taken out and blocked. Animations and effects in CSS only (transitions, keyframes, gradients, filters, blend modes are all fine).
- No forms, iframes, video, audio or embeds. Links open in a new tab.
- Pictures: only my photo and cover ({{avatar_url}}, {{cover_url}}), the addresses listed below, or SVG and data: images written into the code. Pictures from other websites are blocked.
- Fonts: Google Fonts, through @import at the top of the CSS. Nothing else from other websites loads.
- The page around the frame already shows my name with the Connect, Follow and Message buttons, so do not make those.
- At most 2 MB of HTML and 1 MB of CSS.
- Keep it appropriate for a professional network: GMAFJ checks every design before it is shown.
- Be creative. Make it feel like me, not a template, while keeping it easy to read.

MY PICTURES
${pictures.length ? pictures.map((u, i) => `${i + 1}. ${u}`).join('\n') : 'None yet. Leave room for a picture only if it uses my photo or cover.'}

Answer with exactly two code blocks: the HTML in a \`\`\`html block, then the CSS in a \`\`\`css block.`
}

/** An AI's answer read back: its ```html and ```css blocks, or a whole page with <style> in it. */
export function parseAnswer(text) {
  const block = (lang) => new RegExp('```' + lang + '[^\\n]*\\n([\\s\\S]*?)```', 'i').exec(text)?.[1]
  let html = block('html') ?? (/```/.test(text) ? '' : text)
  let css = block('css')
  const styles = []
  if (/<body[\s>]/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    for (const s of doc.querySelectorAll('style')) {
      styles.push(s.textContent)
      s.remove()
    }
    html = doc.body.innerHTML
  } else {
    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, s) => {
      styles.push(s)
      return ''
    })
  }
  if (css === undefined) css = styles.join('\n')
  else if (styles.length) css = `${styles.join('\n')}\n${css}`
  return { html: html.trim(), css: css.trim() }
}

/** A size in MB, to one decimal. */
export const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
