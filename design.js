/**
 * A member's own profile design (the owner, 2026-10-08: "our main highlight is the custom profile that
 * the users can show their creativity on while still being able to show the regular features of the
 * profile like posts projects and all"): HTML and CSS, CSS3 and all it can do, and nothing else (the
 * owner, 2026-10-22: "Make it just html and css (css3) for custom profiles, remove the react"). Its
 * {{placeholders}} are filled in from the profile each time it is shown.
 *
 * It is shown in a sealed frame (mountDesign) in which no script runs at all, and from which nothing
 * reaches the page around it, a form, or another site: pictures are ours, fonts Google's. On the profile it
 * is the whole window, the site's menu and the profile's buttons over it (pages/profile.js). The owner
 * approves a design before anyone else sees it, in the review console. With its pictures, at most 10 MB.
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

/** A post as a card in a design: plain text and its picture, linking to the post itself. */
function postCard(u) {
  const x = u.repostOf && !u.text && !u.repostOf.gone ? u.repostOf : u
  const stats = [u.reactions?.total ? plural(u.reactions.total, 'like') : '', u.comments ? plural(u.comments, 'comment') : ''].filter(Boolean).join(' · ')
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
      <p class="meta"><span data-if="location">{{location}} · </span>{{followers}} followers · {{following}} following</p>
      <p class="open" data-if="open_to_work">{{open_to_work}}</p>
      <p class="hiring" data-if="hiring">{{hiring}}</p>
      <a class="site" data-if="website" href="{{website}}">{{website}}</a>
    </div>
  </section>
  <section class="card" data-if="featured"><h2>Featured</h2><div class="posts">{{featured}}</div></section>
  <section class="card" data-if="about"><h2>About</h2><p class="about">{{about}}</p></section>
  <section class="card" data-if="posts"><h2>Posts</h2><div class="posts">{{posts}}</div></section>
  <section class="card" data-if="experience"><h2>Experience</h2>{{experience}}</section>
  <section class="card" data-if="education"><h2>Education</h2>{{education}}</section>
  <section class="card" data-if="certifications"><h2>Licenses and certifications</h2>{{certifications}}</section>
  <section class="card" data-if="projects"><h2>Projects</h2>{{projects}}</section>
  <section class="card" data-if="volunteering"><h2>Volunteering</h2>{{volunteering}}</section>
  <section class="card" data-if="skills"><h2>Skills</h2><div class="skills">{{skills}}</div></section>
  <section class="card" data-if="honors"><h2>Honors and awards</h2>{{honors}}</section>
  <section class="card" data-if="languages"><h2>Languages</h2>{{languages}}</section>
</main>`

export const BASE_CSS = `* { box-sizing: border-box; }
/* The page is the whole window. Oporch's menu floats over its left edge (64px) and the profile's buttons over its top right; on a phone, bars over its top and bottom (56px each). */
body { margin: 0; padding: 76px 24px 48px 88px; background: #efeeea; color: #111; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: #1d4ed8; }
.profile { display: flex; flex-direction: column; gap: 8px; max-width: 880px; margin: 0 auto; }
.card { background: #fff; border: 1px solid #d6d4ce; border-radius: 8px; padding: 20px 24px; }
.top { padding: 0; overflow: hidden; }
.cover { height: 200px; background: #e2e1dc center / cover; }
.intro { padding: 0 24px 24px; }
.avatar { display: flex; align-items: center; justify-content: center; width: 152px; height: 152px; margin-top: -100px; border: 4px solid #fff; border-radius: 50%; object-fit: cover; background: #e8e7e2; color: #333; font-size: 56px; font-weight: 700; }
h1 { margin: 12px 0 0; font-size: 24px; }
.pronouns { color: #575757; font-size: 14px; font-weight: 400; }
.headline { margin: 4px 0 0; font-size: 16px; }
.meta { margin: 6px 0 0; color: #575757; font-size: 14px; }
.open, .hiring { display: inline-block; margin: 12px 8px 0 0; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
.open { background: #e3f1e7; color: #166534; }
.hiring { background: #e8e7e2; color: #111; }
.site { display: block; margin-top: 8px; font-weight: 600; text-decoration: none; }
h2 { margin: 0 0 12px; font-size: 20px; }
.about { margin: 0; white-space: pre-wrap; }
.entry { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #e2e0da; }
.entry:first-of-type { border-top: 0; padding-top: 0; }
.logo { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 4px; background: #e8e7e2; color: #333; font-weight: 700; }
.entry h3 { margin: 0; font-size: 16px; }
.entry p { margin: 2px 0 0; }
.sub { font-size: 14px; }
.when { color: #575757; font-size: 14px; }
.desc { margin-top: 8px !important; white-space: pre-wrap; }
.url { display: inline-block; margin-top: 8px; padding: 4px 12px; border: 1px solid #85837e; border-radius: 16px; color: #111; font-size: 14px; font-weight: 600; text-decoration: none; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; }
.skill { padding: 4px 12px; border: 1px solid #b9b7b1; border-radius: 16px; }
.posts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.post { display: block; padding: 14px; border: 1px solid #d6d4ce; border-radius: 8px; color: inherit; text-decoration: none; }
.post:hover { border-color: #85837e; }
.post p { margin: 0; }
.post-date, .post-stats { color: #575757; font-size: 13px; }
.post-text { margin: 6px 0 !important; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.post-image { display: block; width: 100%; max-height: 220px; margin: 6px 0; border-radius: 6px; object-fit: cover; }
@media (max-width: 767px) {
  body { padding: 64px 0 76px; }
}
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
  profile_url: 'your profile’s address on Oporch',
  joined: 'when you joined, like "October 2026"',
  followers: 'how many people follow you',
  following: 'how many people you follow',
  avatar: 'your photo (or your initials), an element with the class "avatar"',
  avatar_url: 'the address of your photo, for an <img> or CSS',
  cover_url: 'the address of your cover picture, for an <img> or CSS',
  open_to_work: 'what work you are open to, a line of text, when you are',
  hiring: 'the word "Hiring", when you are hiring',
  featured: 'your featured posts, each an <a class="post"> like those in {{posts}}',
  posts: 'your latest posts, each an <a class="post"> holding p.post-date, p.post-text, img.post-image and p.post-stats',
  experience: 'your experience, each a div.entry holding div.logo, div.what, h3, p.sub, p.when and p.desc',
  education: 'your education, each a div.entry',
  certifications: 'your licenses and certifications, each a div.entry, with an a.url link when there is one',
  projects: 'your projects, each a div.entry, with an a.url link when there is one',
  volunteering: 'your volunteering, each a div.entry',
  honors: 'your honors and awards, each a div.entry',
  languages: 'your languages, each a div.entry (h3 the language, p.sub how well)',
  skills: 'your skills, each a span.skill'
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
    followers: esc((p.counts?.followers ?? 0).toLocaleString('en')),
    following: esc((p.counts?.following ?? 0).toLocaleString('en')),
    avatar: p.avatar ? `<img class="avatar" src="${esc(media(p.avatar))}" alt="">` : `<span class="avatar">${initial(p.name)}</span>`,
    avatar_url: esc(media(p.avatar)),
    cover_url: esc(media(p.cover)),
    open_to_work: esc(openLine(p.openToWork)),
    hiring: p.hiring ? 'Hiring' : '',
    ...parts,
    // Designs made before still read: the people who follow them where connections were, and nothing where
    // written recommendations were (a recommendation is the site's own now, over the design: the owner, 2026-10-22).
    connections: esc((p.counts?.followers ?? 0).toLocaleString('en')),
    recommendations: ''
  }
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g
/** A design's HTML with its placeholders filled in. */
export const fillDesign = (html, v) => String(html).replace(PLACEHOLDER, (all, key) => (Object.hasOwn(v, key) ? v[key] : all))
/** Its CSS: only the pictures' addresses, which hold nothing CSS could read as more than an address. */
const fillCss = (css, v) => String(css).replace(PLACEHOLDER, (all, key) => (key === 'avatar_url' || key === 'cover_url' ? v[key] : all))

const SAFE_LINK = new Set(['http:', 'https:', 'mailto:', 'tel:'])
/**
 * What the frame will not hold, whatever the owner approved: scripts, frames, forms, embeds, and the
 * <meta>, <base> and <link> that could send the frame somewhere else; event attributes; links that are
 * not web, mail or phone addresses (no javascript:, however it is spelled); SVG animations of a link.
 * Every link to somewhere else opens in a new tab; a link to a place on the page (#projects) stays in it,
 * so a design can use :target. An element with data-if="x" stays only when {{x}} has something.
 * DOMParser runs nothing.
 */
function cleanDesign(html, v) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  for (const el of doc.querySelectorAll('[data-if]')) {
    const key = el.getAttribute('data-if').trim()
    if (!Object.hasOwn(v, key) || !v[key] || v[key] === '0') el.remove()
  }
  for (const el of doc.querySelectorAll('script, noscript, iframe, frame, frameset, object, embed, applet, form, meta, base, link, portal, video, audio, source, track')) el.remove()
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
  for (const a of doc.querySelectorAll('a[href], area[href]')) {
    if (a.getAttribute('href').trim().startsWith('#')) continue
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer nofollow ugc')
  }
  return doc.body.innerHTML
}

/**
 * A member's design, shown in a sealed frame inside `box`, filled in from the profile `p` and their latest
 * `updates`. No script runs in it (no allow-scripts, and its policy allows none); pictures only from
 * Oporch, fonts only from Google Fonts, no forms, nothing that can move the page around it; links open in a
 * new tab. `fill`: it is the whole window (the profile), else as tall as its box makes it (the previews).
 */
export function mountDesign(box, design, p, updates = [], { fill = false } = {}) {
  const csp = `default-src 'none'; img-src data: blob: ${new URL(API).origin}; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; form-action 'none'; base-uri 'none'`
  const v = values(p, updates)
  const body = cleanDesign(fillDesign(design.html, v), v)
  const css = fillCss(String(design.css ?? ''), v)
  const f = document.createElement('iframe')
  f.className = fill ? 'design fill' : 'design'
  f.title = `${p.name ?? 'Their'} profile`
  f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox')
  f.setAttribute('referrerpolicy', 'no-referrer')
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${body}</body></html>`
  box.replaceChildren(f)
  return f
}

// ── The prompt a member gives their own AI, and its answer read back

/**
 * The prompt for a member's AI to design their profile with (the owner, 2026-10-08: "so that the user
 * can just make minute changes and give their ai model the prompt"). The first lines are theirs to change.
 */
export function designPrompt({ headline = '', pictures = [] } = {}) {
  const pics = pictures.length ? pictures.map((u, i) => `${i + 1}. ${u}`).join('\n') : 'None yet. Leave room for a picture only if it uses my photo or cover.'
  const list = Object.entries(PLACEHOLDERS)
    .map(([k, v]) => `- {{${k}}}: ${v}`)
    .join('\n')
  return `Design my profile page on Oporch, a social network for jobs. Write its HTML and CSS.

The look I want: bold and modern, a dark background, one bright accent colour, big type, and my projects shown as cards.
What I do: ${headline || 'my job title'}

HOW IT WORKS
- My page is the whole browser window, as the HTML you write (only what goes inside <body>, no <html> or <head>) and the CSS you write. It scrolls like any web page, and 100vh is the window's height, so full-screen sections work. It must look right on a phone 320px wide and on a wide screen.
- Oporch's own menu floats over my page: a bar 64px wide down the left edge on screens 768px and wider, and on phones a bar 56px tall across the top and another across the bottom. The top right corner holds the like, recommend, share and follow buttons, about 360px wide and 60px tall. Backgrounds may run under all of these; keep text, links and pictures clear of them.
- Oporch fills in these placeholders from my profile every time the page is shown. Use them; never type my details in yourself:
${list}
- The lists ({{experience}}, {{posts}} and the rest) arrive as ready-made HTML with the classes above. Style those classes; do not try to build the lists yourself.
- Put data-if="placeholder name" on any element that should only show when that placeholder has something, for example <section data-if="projects">. Use it on every section, since some of mine may be empty.

RULES
- HTML and CSS only. JavaScript is taken out and could not run anyway. Use all of CSS3 instead: transitions, keyframe animations, transforms, gradients, filters, blend modes, grid, custom properties, scroll snapping. For things that open, switch or reveal, use <details> and <summary>, :hover and :focus, links to #ids with :target, or labelled checkboxes and radio buttons with :checked.
- Pictures: only my photo and cover, the addresses listed below, or SVG and data: images written into the code. Pictures from other websites are blocked.
- Fonts: Google Fonts, through @import at the top of the CSS. Nothing else from other websites loads.
- No forms, iframes, video, audio or embeds. Links to other sites open in a new tab.
- Keep it appropriate for a professional network: Oporch checks every design before it is shown.
- Be creative. Make it feel like me, not a template, while keeping it easy to read.
- At most 2 MB of HTML and 1 MB of CSS.

MY PICTURES
${pics}

Answer with exactly two code blocks: the HTML in a \`\`\`html block, then the CSS in a \`\`\`css block.`
}

/** An AI's answer read back: its ```html and ```css blocks, or a whole page with <style> in it. */
export function parseAnswer(text) {
  const block = (langs) => new RegExp('```(?:' + langs + ')[^\\n]*\\n([\\s\\S]*?)```', 'i').exec(text)?.[1]
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
