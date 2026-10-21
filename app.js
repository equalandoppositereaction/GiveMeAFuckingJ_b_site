/**
 * Oporch on the web (the owner, 2026-10-08, renamed from GMAFJ 2026-10-21): Instagram's layout,
 * LinkedIn's functionality, and Instagram's and X's following (the owner, 2026-10-21: "instead of
 * connections, make it a follower and following system like instagram and x").
 *
 * Every page is the same shell: the menus, built into the page, and a <main> filled in here. This file
 * is what every page shares: the API (api.givemeafuckingjob.com until Oporch's own domain, signed in by an
 * HttpOnly cookie no script can read), who is signed in, the menus' badges, and the pieces pages are made
 * of: people and following, updates (reactions, comments, reposts, sending, their review), dialogs,
 * pictures and cropping them, jobs and One click apply. A member's own profile design is design.js. Each
 * page's own part is /pages/<name>.js, named by <body data-page>.
 *
 * Everything a person wrote goes through esc() on its way into the page. A profile design is the one
 * thing shown as written, and only inside a sandboxed frame (design.js).
 */

const stored = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const store = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode: nothing remembered, nothing broken */
  }
}

/**
 * The API. A developer running the site on their own machine points it at another one with
 * localStorage['gmafj.api']; on the real site that is ignored, so nothing can send a login elsewhere.
 */
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
export const API = ((LOCAL && stored('gmafj.api')) || 'https://api.givemeafuckingjob.com').replace(/\/+$/, '')

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
export const media = (path) => (path ? API + path : '')
export const param = (key) => new URLSearchParams(location.search).get(key)
export const profileUrl = (p) => `/u?h=${encodeURIComponent(p.handle)}`
export const plural = (n, one, many = `${one}s`) => `${Number(n).toLocaleString('en')} ${n === 1 ? one : many}`

// ── Talking to the API

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** One request. A JSON body, or a Blob sent as it is (a picture). Throws ApiError with the server's own words. */
export async function api(method, path, body) {
  const init = { method, credentials: 'include', headers: {} }
  if (body instanceof Blob) {
    init.headers['content-type'] = body.type
    init.body = body
  } else if (body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(API + path, init)
  } catch {
    throw new ApiError('Oporch cannot be reached right now. Check your connection and try again.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && me) signedOutNow()
    throw new ApiError(data.error || `Something went wrong (${res.status}). Try again.`, res.status, data.code)
  }
  return data
}

// ── Who is signed in

/** The signed-in person (GET /social/me), or null. */
export let me = null
let reachable = true

async function loadSession() {
  try {
    me = await api('GET', '/social/me')
  } catch (e) {
    me = null
    reachable = e.status !== 0
  }
  // An unreachable server says nothing about the session: the menus stay as they were.
  if (reachable) store('gmafj.in', me ? '1' : null)
}

function signedOutNow() {
  me = null
  store('gmafj.in', null)
  paintMe()
}

export async function signOut() {
  await api('POST', '/auth/logout', {}).catch(() => {})
  signedOutNow()
  location.href = '/'
}

/** Dark mode or Light mode, kept for the next visit (boot.js), as the desktop app's account menu offers it. */
export function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark')
  store('gmafj.theme', dark ? 'dark' : null)
  // The bar on top's colour (--card), so a phone's browser runs on from it.
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1c1c1c' : '#ffffff')
}

/** Signed in, or a dialog asking them to: false when they are not. */
export function requireLogin(why = 'Log in to continue.') {
  if (me) return true
  const next = encodeURIComponent(location.pathname + location.search)
  dialog(
    `<div class="dialog-b stack" style="text-align:center;padding:30px 26px">
<div class="brand" style="justify-content:center;margin:0"><span class="mark" aria-hidden="true">O</span><span>Oporch</span></div>
<h2>${esc(why)}</h2>
<p class="muted">Join Oporch to apply to jobs with one click, follow people and share updates. It is free.</p>
<a class="btn wide" href="/login?next=${next}">Log in</a>
<a class="btn ghost wide" href="/login?new=1&next=${next}">Create an account</a>
</div>`,
    'small'
  )
  return false
}

// ── A few events pages listen for

const bus = new EventTarget()
let lastBadges = null
/** Listen for an event. The badges, asked for before the page's own script ran, are told at once too. */
export const on = (name, fn) => {
  bus.addEventListener(name, (e) => fn(e.detail))
  if (name === 'badges' && lastBadges) fn(lastBadges)
}
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }))

// ── The menus

function paintMe() {
  document.documentElement.classList.toggle('in', !!me)
  for (const a of $$('[data-me-link]')) a.href = me ? profileUrl(me) : '/login'
  for (const slot of $$('[data-me-av]')) slot.innerHTML = me ? avatar(me, 'xs') : ''
}

async function badges() {
  if (!me || document.hidden) return
  try {
    lastBadges = await api('GET', '/social/badges')
  } catch {
    return
  }
  // Requests to follow you are answered on the Notifications page, message requests on Messages: they count there.
  const shown = { notifications: (lastBadges.notifications || 0) + (lastBadges.requests || 0), messages: (lastBadges.messages || 0) + (lastBadges.messageRequests || 0) }
  for (const el of $$('[data-badge]')) {
    const n = shown[el.dataset.badge] ?? lastBadges[el.dataset.badge] ?? 0
    el.textContent = n ? (n > 99 ? '99+' : String(n)) : ''
  }
  emit('badges', lastBadges)
}
export const appOpen = () => lastBadges?.app === true
export const refreshBadges = () => void badges()

// ── People and following

const SIZES = { xs: 9, s: 12, '': 15, l: 20, xl: 52 }
/** A face: their picture, or their initials; ringed as LinkedIn rings #OpenToWork and #Hiring. */
export function avatar(p, size = '') {
  const ring = p?.frame === 'open' ? ' ring-open' : p?.frame === 'hiring' ? ' ring-hiring' : ''
  const cls = `av${size ? ` ${size}` : ''}${ring}`
  if (p?.avatar) return `<img class="${cls}" src="${esc(media(p.avatar))}" alt="" loading="lazy">`
  const initials = String(p?.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] ?? '').join('')
  return `<span class="${cls} i" style="font-size:${SIZES[size] ?? 15}px" aria-hidden="true">${esc(initials)}</span>`
}

/** A person: face, name (and "Follows you", as Instagram marks it), and a line. */
export function who(p, line = p?.headline) {
  if (!p) return ''
  const href = profileUrl(p)
  return `<div class="who"><a href="${href}" tabindex="-1">${avatar(p)}</a><div class="who-t"><div class="who-n"><a href="${href}">${esc(p.name)}</a>${p.followsYou ? '<span class="chip">Follows you</span>' : ''}</div>${
    line ? `<div class="who-h">${esc(line)}</div>` : ''
  }</div></div>`
}

/**
 * What can be done with a person, from where you stand with them: Follow (Follow back when they follow
 * you), Following and Requested (a private account's), and on a profile Message, which anyone may send
 * (it reaches their requests unless you follow each other). Re-drawn in place when it changes.
 */
export function relButtons(handle, relation, compact = false, opts = {}) {
  const h = esc(handle)
  const s = compact ? ' small' : ''
  if (relation === 'self') return compact ? `<span class="row" data-rel="${h}"></span>` : `<span class="row wrap" data-rel="${h}"><a class="btn ghost" href="/settings#edit">Edit profile</a></span>`
  const follow = {
    following: `<button class="btn ghost${s}" type="button" data-following="${h}" aria-haspopup="menu">Following</button>`,
    requested: `<button class="btn ghost${s}" type="button" data-requested="${h}" aria-haspopup="menu">Requested</button>`,
    none: `<button class="btn${s}" type="button" data-follow="${h}">${opts.followsYou ? 'Follow back' : 'Follow'}</button>`
  }[relation] ?? ''
  const message = compact ? '' : `<a class="btn ghost" href="/messages?h=${encodeURIComponent(handle)}">Message</a>`
  return `<span class="row wrap" data-rel="${h}"${opts.followsYou ? ' data-follows-you="1"' : ''}>${follow}${message}</span>`
}

/** A person in a list: face, name and line, and Follow. */
export const personRow = (p, line) => `<div class="person">${who(p, line)}${relButtons(p.handle, p.relation ?? 'none', true, { followsYou: p.followsYou })}</div>`

/** Follow, unfollow, take back a request; from wherever the buttons are. */
async function relate(btn) {
  const box = btn.closest('[data-rel]')
  const handle = box?.dataset.rel
  if (!handle || !requireLogin('Log in to follow people.')) return
  const h = encodeURIComponent(handle)
  const compact = !box.closest('.li-head, .li-bar')
  const followsYou = box.dataset.followsYou === '1'
  const change = async (method) => {
    btn.disabled = true
    try {
      const r = await api(method, `/social/follow/${h}`)
      box.outerHTML = relButtons(handle, r.relation, compact, { followsYou })
      if (r.relation === 'requested') toast('Requested. Their account is private: you will follow them once they say yes.')
      emit('relation', { handle, relation: r.relation, followers: r.followers })
      refreshBadges()
    } catch (e) {
      btn.disabled = false
      toast(esc(e.message))
    }
  }
  if (btn.dataset.follow !== undefined) return void change('POST')
  if (btn.dataset.following !== undefined) return popMenu(btn, [[`Unfollow`, () => void change('DELETE'), true]])
  if (btn.dataset.requested !== undefined) return popMenu(btn, [['Cancel the request', () => void change('DELETE'), true]])
}

/** Who applied to a job: the faces of people you follow, then how many applied through Oporch. */
export function appliedLine(sig) {
  if (!sig?.total) return ''
  const f = sig.faces || []
  const yours = f.length ? `<b>${esc(f[0].name)}</b>${sig.following > 1 ? ` and ${plural(sig.following - 1, 'other')} you follow` : ''} applied` : ''
  const all = `${plural(sig.total, 'person', 'people')} applied through Oporch`
  return `<div class="faces">${f.length ? `<span class="stack-av">${f.map((p) => avatar(p, 'xs')).join('')}</span>` : ''}<span>${f.length ? yours : all}</span></div>`
}

// ── Time and text

export function ago(t) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  if (s < 30 * 86400) return `${Math.floor(s / 7 / 86400)}w`
  const d = new Date(t)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) })
}

/** Escaped text, its web addresses, @mentions and #hashtags made links. */
export const linkify = (text) =>
  esc(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"&]/g, (url) => `<a href="${url}" target="_blank" rel="noopener nofollow ugc">${url}</a>`)
    .replace(/(^|[^a-z0-9._@/])@([a-z0-9][a-z0-9._]{1,28}[a-z0-9])/gi, (_, pre, h) => `${pre}<a href="/u?h=${h.toLowerCase()}">@${h}</a>`)
    .replace(/(^|[\s(])#([\p{L}\p{N}_]{2,50})/gu, (_, pre, tag) => `${pre}<a href="/search?tab=posts&amp;q=${encodeURIComponent('#' + tag)}">#${tag}</a>`)

// ── Updates

/** LinkedIn's six reactions. */
export const REACTIONS = {
  like: { mark: '👍', label: 'Like' },
  celebrate: { mark: '👏', label: 'Celebrate' },
  support: { mark: '🤝', label: 'Support' },
  love: { mark: '❤️', label: 'Love' },
  insightful: { mark: '💡', label: 'Insightful' },
  funny: { mark: '😂', label: 'Funny' }
}
const posts = new Map() // id -> the update as last drawn, for redrawing it

/** The reactions line: the top kinds, how many, and the faces of people you follow first. */
export function reactionLine(u) {
  const r = u.reactions || { total: 0, top: [] }
  if (!r.total) return '<button type="button" class="link-quiet" data-reactions hidden></button>'
  const marks = r.top.map((k) => `<span class="rx">${REACTIONS[k]?.mark ?? ''}</span>`).join('')
  const f = u.faces || []
  const text = f.length ? `${esc(f[0].name)}${r.total > 1 ? ` and ${plural(r.total - 1, 'other')}` : ''}` : plural(r.total, 'reaction')
  return `<button type="button" class="link-quiet faces" data-reactions><span class="rxs">${marks}</span>${f.length ? `<span class="stack-av">${f.map((p) => avatar(p, 'xs')).join('')}</span>` : ''}<span>${text}</span></button>`
}

const VIA = { reacted: 'reacted to this', commented: 'commented on this' }
const AUDIENCE = { anyone: 'Anyone', followers: 'Followers' }

/**
 * Its review, said to its author only (the server sends it to nobody else): waiting, with what that means,
 * or turned down, with the owner's reason.
 */
function reviewNote(u) {
  if (u.review === 'pending') return '<div class="review pending"><b>Waiting for review.</b> It is on your profile now, and reaches the feed once it is approved.</div>'
  if (u.review === 'rejected') return `<div class="review rejected"><b>Not approved.</b> Only you can see it.${u.reviewNote ? ` The reviewer said: “${esc(u.reviewNote)}”` : ''} Edit it and it is checked again.</div>`
  return ''
}

/** An update as every list shows it, LinkedIn's: who and why, the text, a picture, a repost, the counts, the actions. */
export function postHtml(u) {
  posts.set(u.id, u)
  const a = u.author || { name: 'Deleted account', handle: '' }
  const line = [a.headline, `${ago(u.at)}${u.edited ? ' · Edited' : ''} · ${AUDIENCE[u.audience] ?? ''}`].filter(Boolean)
  const repost = u.repostOf
  const plain = repost && !u.text
  const head = u.via?.card
    ? `<div class="via">${avatar(u.via.card, 'xs')}<span><b>${esc(u.via.card.name)}</b> ${VIA[u.via.kind] ?? ''}</span></div>`
    : plain
      ? `<div class="via">${avatar(a, 'xs')}<span class="grow"><a href="${profileUrl(a)}"><b>${esc(a.name)}</b></a> reposted this</span>${
          u.mine ? '<button class="menu-b" type="button" data-repost-menu aria-label="Repost actions">⋯</button>' : ''
        }</div>`
      : ''
  const inner = (x) =>
    x.gone
      ? '<div class="card pad muted small">This update is not available.</div>'
      : `<a class="embed" href="/p?id=${x.id}"><div class="embed-h">${avatar(x.author, 's')}<div><b>${esc(x.author?.name ?? '')}</b><div class="who-h">${esc(x.author?.headline ?? '')} · ${ago(x.at)}</div></div></div>${
          x.text ? `<div class="post-t clamp">${esc(x.text)}</div>` : ''
        }${x.image ? `<img class="post-i" src="${esc(media(x.image))}" alt="" loading="lazy">` : ''}</a>`
  const body = plain
    ? `<div class="post-h">${who(repost.gone ? a : repost.author, repost.gone ? '' : `${repost.author?.headline ?? ''}`)}</div>${repost.gone ? inner(repost) : `${repost.text ? `<div class="post-t clamp">${linkify(repost.text)}</div>` : ''}${repost.image ? `<a href="/p?id=${repost.id}"><img class="post-i" src="${esc(media(repost.image))}" alt="" loading="lazy"></a>` : ''}`}`
    : `<div class="post-h">${who(a, line.join(' · '))}<button class="menu-b" type="button" data-post-menu aria-label="More actions">⋯</button></div>
${reviewNote(u)}
${u.text ? `<div class="post-t clamp">${linkify(u.text)}</div>` : ''}
${u.image ? `<a href="/p?id=${u.id}"><img class="post-i" src="${esc(media(u.image))}" alt="" loading="lazy"></a>` : ''}
${repost ? `<div class="embed-wrap">${inner(repost)}</div>` : ''}`
  const shown = plain && !repost.gone ? repost : u
  const counts = [shown.comments ? `<a class="link-quiet" href="/p?id=${shown.id}#say">${plural(shown.comments, 'comment')}</a>` : '', shown.reposts ? `<span>${plural(shown.reposts, 'repost')}</span>` : '']
    .filter(Boolean)
    .join(' · ')
  const mine = shown.reactions?.mine
  return `<article class="card post" data-post="${shown.id}"${plain ? ` data-wrapper="${u.id}"` : ''}>
${head}
${body}
<div class="post-s">${reactionLine(shown)}<span>${counts}</span></div>
<div class="post-a">
<button class="act${mine ? ' on' : ''}" type="button" data-like aria-pressed="${!!mine}">${mine ? `${REACTIONS[mine].mark} ${REACTIONS[mine].label}` : 'Like'}</button>
<a class="act" href="/p?id=${shown.id}#say">Comment</a>
<button class="act" type="button" data-repost>Repost</button>
<button class="act" type="button" data-send>Send</button>
</div>
</article>`
}

/** Redraw an update's reactions after a change. */
function redrawReactions(card, u) {
  const btn = $('[data-like]', card)
  const mine = u.reactions.mine
  btn.classList.toggle('on', !!mine)
  btn.setAttribute('aria-pressed', String(!!mine))
  btn.textContent = mine ? `${REACTIONS[mine].mark} ${REACTIONS[mine].label}` : 'Like'
  $('.post-s', card).firstElementChild.outerHTML = reactionLine(u)
}

async function react(card, kind) {
  if (!requireLogin('Log in to react to updates.')) return
  const u = posts.get(+card.dataset.post)
  if (!u) return
  const undo = kind === null || (kind === 'like' && u.reactions.mine === 'like')
  try {
    u.reactions = undo ? await api('DELETE', `/social/updates/${u.id}/like`) : await api('POST', `/social/updates/${u.id}/like`, { kind })
    redrawReactions(card, u)
  } catch (e) {
    toast(esc(e.message))
  }
}

/** The reaction picker, as LinkedIn shows it over Like. */
function reactionPicker(card, anchor) {
  $('.pop')?.remove()
  const pop = document.createElement('div')
  pop.className = 'pop rx-pop'
  pop.innerHTML = Object.entries(REACTIONS).map(([k, r]) => `<button type="button" data-kind="${k}" title="${r.label}" aria-label="${r.label}">${r.mark}</button>`).join('')
  document.body.append(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.top = `${window.scrollY + r.top - pop.offsetHeight - 6}px`
  pop.style.left = `${Math.max(8, window.scrollX + r.left)}px`
  const close = () => {
    pop.remove()
    document.removeEventListener('click', outside, true)
  }
  const outside = (e) => !pop.contains(e.target) && !anchor.contains(e.target) && close()
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-kind]')
    if (!b) return
    close()
    void react(card, b.dataset.kind)
  })
  setTimeout(() => document.addEventListener('click', outside, true))
  return close
}

/** Who reacted, by kind, the people you follow first. */
async function reactionsDialog(id) {
  const { el } = dialog(`<div class="dialog-h"><h2>Reactions</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b"><div class="spin"></div></div>`, 'small')
  try {
    const r = await api('GET', `/social/updates/${id}/likes`)
    $('.dialog-b', el).innerHTML = r.people.map((p) => `<div class="person">${who(p, p.headline)}<span class="rx" title="${REACTIONS[p.kind]?.label ?? ''}">${REACTIONS[p.kind]?.mark ?? ''}</span></div>`).join('') || '<p class="muted">No reactions yet.</p>'
  } catch (e) {
    $('.dialog-b', el).innerHTML = `<p class="err">${esc(e.message)}</p>`
  }
}

export async function share(url, title = 'Oporch') {
  const full = new URL(url, location.origin).href
  if (navigator.share && matchMedia('(hover: none)').matches) {
    try {
      await navigator.share({ url: full, title })
      return
    } catch {
      /* closed, or not allowed: copy instead */
    }
  }
  try {
    await navigator.clipboard.writeText(full)
    toast('Link copied.')
  } catch {
    prompt('Copy this link:', full)
  }
}

/** A small menu by a button: [label, action, bad?] items. Opens upward when there is no room below. */
export function popMenu(anchor, items) {
  $('.pop')?.remove()
  const pop = document.createElement('div')
  pop.className = 'pop'
  pop.setAttribute('role', 'menu')
  pop.innerHTML = items.map(([label, , bad], i) => `<button type="button" role="menuitem" data-i="${i}"${bad ? ' class="bad"' : ''}>${esc(label)}</button>`).join('')
  document.body.append(pop)
  const r = anchor.getBoundingClientRect()
  const below = r.bottom + 4 + pop.offsetHeight <= innerHeight
  pop.style.top = `${window.scrollY + (below ? r.bottom + 4 : r.top - 4 - pop.offsetHeight)}px`
  pop.style.left = `${Math.max(8, Math.min(window.scrollX + r.right - pop.offsetWidth, window.scrollX + innerWidth - pop.offsetWidth - 8))}px`
  const close = (e) => {
    if (e && pop.contains(e.target) && !e.target.closest('[data-i]')) return
    pop.remove()
    document.removeEventListener('click', close, true)
  }
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]')
    if (b) items[+b.dataset.i][1]()
  })
  setTimeout(() => document.addEventListener('click', close, true))
}

/** The ⋯ menu of an update. */
function postMenu(card, btn) {
  const u = posts.get(+card.dataset.post)
  if (!u) return
  const items = []
  if (me) items.push([u.saved ? 'Unsave' : 'Save', () => toggleSave(u)])
  items.push(['Copy link to update', () => share(`/p?id=${u.id}`)])
  if (me && u.mine) {
    if (u.audience === 'anyone') items.push([u.featured ? 'Remove from Featured' : 'Feature on top of profile', () => toggleFeature(u)])
    items.push(['Edit update', () => compose({ edit: u })])
    items.push([u.audience === 'anyone' ? 'Show to followers only' : 'Show to anyone', () => changeAudience(card, u)])
    items.push(['Delete update', () => removeUpdate(card, u), true])
  } else if (me) {
    items.push(['I don’t want to see this', () => hideUpdate(card, u)])
    items.push(['Report update', () => report('update', { id: u.id }), true])
  }
  if (me?.admin && !u.mine) items.push(['Remove (admin)', () => removeUpdate(card, u), true])
  popMenu(btn, items)
}

async function toggleSave(u) {
  try {
    await api(u.saved ? 'DELETE' : 'POST', `/social/updates/${u.id}/save`)
    u.saved = !u.saved
    toast(u.saved ? 'Saved. <a href="/items">See your saved items</a>' : 'Removed from your saved items.')
  } catch (e) {
    toast(esc(e.message))
  }
}
async function toggleFeature(u) {
  try {
    await api(u.featured ? 'DELETE' : 'POST', `/social/updates/${u.id}/feature`)
    u.featured = !u.featured
    toast(u.featured ? 'Featured on your profile.' : 'Taken off your profile’s Featured.')
  } catch (e) {
    toast(esc(e.message))
  }
}
async function changeAudience(card, u) {
  try {
    Object.assign(u, await api('PATCH', `/social/updates/${u.id}`, { audience: u.audience === 'anyone' ? 'followers' : 'anyone' }))
    card.outerHTML = postHtml(u)
  } catch (e) {
    toast(esc(e.message))
  }
}
async function removeUpdate(card, u) {
  if (!confirm('Delete this update? This cannot be undone.')) return
  try {
    await api('DELETE', `/social/updates/${u.id}`)
    card.remove()
    emit('deleted', u.id)
    toast('Deleted.')
  } catch (e) {
    toast(esc(e.message))
  }
}
async function hideUpdate(card, u) {
  try {
    await api('POST', `/social/updates/${u.id}/hide`)
    card.innerHTML = `<div class="sec row"><span class="grow muted">Hidden. You will see fewer updates like this.</span><button class="textbtn" type="button" data-unhide="${u.id}">Undo</button></div>`
  } catch (e) {
    toast(esc(e.message))
  }
}

/** Report a profile, update, comment or message: it goes to the owner's review. */
export function report(kind, target) {
  if (!requireLogin('Log in to report.')) return
  const { el, close } = dialog(`<div class="dialog-h"><h2>Report</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b stack"><p class="muted small">Tell us what is wrong. We look at every report.</p>
${['Spam', 'Harassment or hate', 'Fake profile or impersonation', 'Violence or threats', 'Adult content', 'Scam or fraud', 'Something else'].map((r, i) => `<label class="check"><input type="radio" name="why" value="${r}"${i === 0 ? ' checked' : ''}><span>${r}</span></label>`).join('')}
<textarea class="textarea" maxlength="400" placeholder="Anything else we should know (optional)"></textarea></div>
<div class="dialog-f"><button class="btn danger" type="button" data-go>Report</button></div>`)
  $('[data-go]', el).addEventListener('click', async () => {
    const why = $('input[name=why]:checked', el).value
    const more = $('textarea', el).value.trim()
    try {
      await api('POST', '/social/report', { kind, ...target, reason: more ? `${why}: ${more}` : why })
      close()
      toast('Thank you. We will look at it.')
    } catch (e) {
      toast(esc(e.message))
    }
  })
}

/** Repost, LinkedIn's two ways: as it is, or with your thoughts. */
function repostMenu(card, btn) {
  if (!requireLogin('Log in to repost.')) return
  const u = posts.get(+card.dataset.post)
  if (!u) return
  popMenu(btn, [
    ['Repost with your thoughts', () => compose({ repostOf: u })],
    [
      'Repost',
      async () => {
        try {
          const r = await api('POST', `/social/updates/${u.id}/repost`, {})
          emit('posted', r)
          toast('Reposted.')
        } catch (e) {
          toast(esc(e.message))
        }
      }
    ]
  ])
}

/** Send an update to people, in a message: the people you follow, or anyone you search for. */
async function sendDialog(card) {
  if (!requireLogin('Log in to send updates.')) return
  const u = posts.get(+card.dataset.post)
  if (!u || !me) return
  const { el, close } = dialog(`<div class="dialog-h"><h2>Send</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b stack"><input class="input" placeholder="Search people" data-find><div data-people><div class="spin"></div></div>
<textarea class="textarea" maxlength="4000" placeholder="Write a message (optional)" style="min-height:60px"></textarea></div>
<div class="dialog-f"><button class="btn" type="button" data-go disabled>Send</button></div>`)
  const picked = new Map()
  let following = []
  let found = null
  const draw = () => {
    const list = found ?? following
    $('[data-people]', el).innerHTML =
      list
        .slice(0, 50)
        .map((p) => `<label class="person check" style="align-items:center"><input type="checkbox" value="${esc(p.handle)}"${picked.has(p.handle) ? ' checked' : ''}>${who(p)}</label>`)
        .join('') || `<p class="muted small">${found ? 'Nobody by that name.' : 'Search for someone to send it to.'}</p>`
  }
  try {
    following = (await api('GET', `/social/u/${encodeURIComponent(me.handle)}/following`)).people
  } catch {
    following = []
  }
  draw()
  let typing = 0
  $('[data-find]', el).addEventListener('input', (e) => {
    clearTimeout(typing)
    const q = e.target.value.trim()
    typing = setTimeout(async () => {
      found = q ? (await api('GET', `/social/search?q=${encodeURIComponent(q)}`).catch(() => ({ people: [] }))).people : null
      draw()
    }, 250)
  })
  el.addEventListener('change', (e) => {
    const box = e.target.closest('input[type=checkbox]')
    if (!box) return
    const p = [...following, ...(found ?? [])].find((x) => x.handle === box.value)
    box.checked ? picked.set(box.value, p) : picked.delete(box.value)
    $('[data-go]', el).disabled = !picked.size
  })
  $('[data-go]', el).addEventListener('click', async () => {
    const text = $('textarea', el).value
    try {
      for (const h of picked.keys()) await api('POST', `/social/messages/${encodeURIComponent(h)}`, { text, updateId: u.id })
      close()
      toast(`Sent to ${plural(picked.size, 'person', 'people')}.`)
    } catch (e) {
      toast(esc(e.message))
    }
  })
}

// ── Dialogs and notes

export function dialog(html, cls = '') {
  const veil = document.createElement('div')
  veil.className = 'veil'
  veil.innerHTML = `<div class="dialog ${cls}" role="dialog" aria-modal="true">${html}</div>`
  document.body.append(veil)
  const close = () => {
    veil.remove()
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e) => e.key === 'Escape' && close()
  veil.addEventListener('mousedown', (e) => e.target === veil && close())
  veil.addEventListener('click', (e) => e.target.closest('[data-close]') && close())
  document.addEventListener('keydown', onKey)
  setTimeout(() => $('textarea, input:not([type=file]):not([type=radio]):not([type=checkbox]):not([type=range]), .btn', veil)?.focus())
  return { el: veil.firstElementChild, close }
}

/** Resolves when a dialog leaves the page, however it was closed. */
const closed = (el) =>
  new Promise((resolve) => {
    new MutationObserver((_, obs) => {
      if (!el.isConnected) {
        obs.disconnect()
        resolve()
      }
    }).observe(document.body, { childList: true })
  })

let toastTimer = 0
/** A note at the bottom for a few seconds. HTML: escape anything a person wrote. */
export function toast(html, ms = 4500) {
  $('.toast')?.remove()
  const t = document.createElement('div')
  t.className = 'toast'
  t.setAttribute('role', 'status')
  t.innerHTML = html
  document.body.append(t)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.remove(), ms)
}

// ── Pictures

/**
 * A picture made in the browser before it is sent: a JPEG (a PNG when it has transparency to keep) of
 * at most `max` pixels a side, with nothing but the picture in it.
 */
export async function toImage(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp|bmp)$/.test(file.type)) throw new ApiError('Choose a JPEG or PNG picture.', 400)
  const img = await createImageBitmap(file).catch(() => null)
  if (!img) throw new ApiError('That picture could not be opened. Try another.', 400)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  const g = c.getContext('2d')
  const png = file.type === 'image/png'
  if (!png) {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
  }
  g.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new ApiError('That picture could not be prepared.', 400))), png ? 'image/png' : 'image/jpeg', 0.86))
}

/**
 * Upload a chosen file for `purpose` (post, design): JPEG and PNG remade here first; a GIF sent as it
 * is, for the server to check. A photo or cover goes through `cropImage` first and arrives as a Blob.
 */
export async function upload(file, purpose = 'post', max = 1600) {
  if (!(file instanceof File)) return api('POST', `/social/media?purpose=${purpose}`, file)
  if (file.type === 'image/gif') {
    if (purpose === 'avatar' || purpose === 'cover') throw new ApiError('A photo or cover is a JPEG or PNG.', 400)
    if (file.size > 5 * 1024 * 1024) throw new ApiError('A GIF can be up to 5 MB.', 400)
    return api('POST', `/social/media?purpose=${purpose}`, new Blob([await file.arrayBuffer()], { type: 'image/gif' }))
  }
  return api('POST', `/social/media?purpose=${purpose}`, await toImage(file, max))
}

/**
 * Crop a picture before it is sent (the owner, 2026-10-21: "there is no option to crop the profile
 * picture or the cover image"): drag it into place and zoom it, inside a frame the shape it will have, a
 * circle for a photo and a wide band for a cover, as LinkedIn's editor does. Resolves to a JPEG of
 * `width` by `height`, or null when it is closed.
 */
export async function cropImage(file, { width, height, round = false, title = 'Crop your picture' }) {
  if (!/^image\/(jpeg|png|webp|bmp)$/.test(file.type)) {
    toast(file.type === 'image/gif' ? 'A photo or cover is a JPEG or PNG.' : 'Choose a JPEG or PNG picture.')
    return null
  }
  const img = await createImageBitmap(file).catch(() => null)
  if (!img) {
    toast('That picture could not be opened. Try another.')
    return null
  }
  const { el, close } = dialog(
    `<div class="dialog-h"><h2>${esc(title)}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b stack"><div class="crop${round ? ' round' : ''}" style="aspect-ratio:${width}/${height}"><canvas></canvas></div>
<label class="zoom"><span class="muted small">Zoom</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label>
<p class="muted small">Drag the picture to place it. Scroll or use the slider to zoom.</p></div>
<div class="dialog-f"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn" type="button" data-apply>Apply</button></div>`,
    round ? 'small' : ''
  )
  const frame = $('.crop', el)
  const canvas = $('canvas', frame)
  const g = canvas.getContext('2d')
  const zoomIn = $('input[type=range]', el)
  let zoom = 1
  let cx = 0
  let cy = 0
  const size = () => ({ w: frame.clientWidth, h: frame.clientHeight })
  /** Pixels on screen per pixel of the picture: zoom 1 fills the frame. */
  const scale = () => {
    const { w, h } = size()
    return Math.max(w / img.width, h / img.height) * zoom
  }
  /** The picture always covers the frame. */
  const clamp = () => {
    const { w, h } = size()
    const s = scale()
    const hw = (img.width * s) / 2
    const hh = (img.height * s) / 2
    cx = Math.min(hw, Math.max(w - hw, cx))
    cy = Math.min(hh, Math.max(h - hh, cy))
  }
  const draw = () => {
    const { w, h } = size()
    const dpr = devicePixelRatio || 1
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    clamp()
    const s = scale()
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    g.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s)
  }
  requestAnimationFrame(() => {
    const { w, h } = size()
    cx = w / 2
    cy = h / 2
    draw()
  })
  const setZoom = (z, at) => {
    const { w, h } = size()
    const before = scale()
    zoom = Math.min(4, Math.max(1, z))
    // Zoomed about the point under the pointer (the middle for the slider), as a photo editor does.
    const px = at?.x ?? w / 2
    const py = at?.y ?? h / 2
    const k = scale() / before
    cx = px - (px - cx) * k
    cy = py - (py - cy) * k
    zoomIn.value = String(zoom)
    draw()
  }
  zoomIn.addEventListener('input', () => setZoom(+zoomIn.value))
  frame.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const r = frame.getBoundingClientRect()
      setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), { x: e.clientX - r.left, y: e.clientY - r.top })
    },
    { passive: false }
  )
  let drag = null
  frame.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, cx, cy }
    frame.setPointerCapture(e.pointerId)
  })
  frame.addEventListener('pointermove', (e) => {
    if (!drag) return
    cx = drag.cx + e.clientX - drag.x
    cy = drag.cy + e.clientY - drag.y
    draw()
  })
  frame.addEventListener('pointerup', () => (drag = null))
  frame.addEventListener('pointercancel', () => (drag = null))
  frame.tabIndex = 0
  frame.setAttribute('aria-label', 'The picture. Arrow keys move it, plus and minus zoom.')
  frame.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 30 : 8
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      cx += moves[e.key][0]
      cy += moves[e.key][1]
      draw()
    } else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.1)
    else if (e.key === '-') setZoom(zoom / 1.1)
  })
  const ro = new ResizeObserver(() => draw())
  ro.observe(frame)
  let result = null
  $('[data-apply]', el).addEventListener('click', () => {
    const { w, h } = size()
    const s = scale()
    const left = cx - (img.width * s) / 2
    const top = cy - (img.height * s) / 2
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const o = out.getContext('2d')
    o.fillStyle = '#fff'
    o.fillRect(0, 0, width, height)
    o.imageSmoothingQuality = 'high'
    o.drawImage(img, -left / s, -top / s, w / s, h / s, 0, 0, width, height)
    out.toBlob((b) => {
      result = b
      close()
    }, 'image/jpeg', 0.9)
  })
  await closed(el)
  ro.disconnect()
  return result
}

// ── Writing an update: new, a repost with thoughts, or an edit

export function compose(opts = {}) {
  if (!requireLogin('Log in to share an update.')) return
  const { edit, repostOf } = opts
  const title = edit ? 'Edit update' : repostOf ? 'Repost with your thoughts' : 'Create an update'
  const { el, close } = dialog(`<div class="dialog-h"><h2>${title}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b compose">
<div class="row" style="margin-bottom:12px">${avatar(me)}<div><b>${esc(me.name)}</b><div><select class="aud" aria-label="Who can see this"><option value="anyone">Anyone</option><option value="followers">Followers only</option></select></div></div></div>
<textarea maxlength="3000" placeholder="${repostOf ? 'Add your thoughts' : 'What do you want to talk about? Use @username to mention someone and #hashtags.'}" aria-label="Your update">${esc(edit?.text ?? '')}</textarea>
${repostOf ? `<div class="embed-wrap">${postHtml(repostOf).replace(/<div class="post-a">[\s\S]*?<\/div>\s*<\/article>/, '</article>')}</div>` : ''}
<div class="preview" hidden><img alt=""><button class="btn ghost small" type="button" data-unpick>Remove</button></div>
<p class="muted small">${me.admin ? '' : 'Every update is checked before it reaches the feed. Until then it shows on your profile.'}</p>
<p class="err" hidden></p>
</div>
<div class="dialog-f">${edit || repostOf ? '' : '<label class="btn ghost">Add a picture or GIF<input type="file" accept="image/jpeg,image/png,image/gif" hidden></label>'}<span class="grow"></span><button class="btn" type="button" data-send>${edit ? 'Save' : 'Post'}</button></div>`)
  const text = $('textarea', el)
  const aud = $('.aud', el)
  aud.value = edit?.audience ?? 'anyone'
  const file = $('input[type=file]', el)
  const preview = $('.preview', el)
  const err = $('.err', el)
  const send = $('[data-send]', el)
  let picked = null
  file?.addEventListener('change', () => {
    picked = file.files?.[0] ?? null
    preview.hidden = !picked
    if (picked) $('img', preview).src = URL.createObjectURL(picked)
  })
  $('[data-unpick]', el).addEventListener('click', () => {
    picked = null
    if (file) file.value = ''
    preview.hidden = true
  })
  send.addEventListener('click', async () => {
    if (!edit && !repostOf && !text.value.trim() && !picked) return void text.focus()
    send.disabled = true
    err.hidden = true
    try {
      let u
      if (edit) u = await api('PATCH', `/social/updates/${edit.id}`, { text: text.value, audience: aud.value })
      else if (repostOf) u = await api('POST', `/social/updates/${repostOf.id}/repost`, { text: text.value, audience: aud.value })
      else {
        const image = picked ? (await upload(picked, 'post')).id : null
        u = await api('POST', '/social/updates', { text: text.value, image, audience: aud.value })
      }
      close()
      if (edit) {
        Object.assign(edit, u)
        for (const card of $$(`[data-post="${u.id}"]`)) card.outerHTML = postHtml(u)
        toast(u.review === 'pending' ? 'Saved. It is checked again before it is back in the feed.' : 'Saved.')
      } else {
        emit('posted', u)
        const waits = u.review === 'pending' ? ' It is on your profile now, and reaches the feed once it is approved.' : ''
        toast(`Posted.${waits} <a href="/p?id=${u.id}">See it</a>`, waits ? 8000 : 4500)
      }
    } catch (e) {
      err.textContent = e.message
      err.hidden = false
      send.disabled = false
    }
  })
}

// ── Jobs from the website's listings: who applied, Apply, saving, and One click apply

/** The faces of people you follow, and Oporch's counts, for these jobs, by id. Empty for a visitor. */
export async function jobSignals(ids) {
  if (!me || !ids.length) return {}
  try {
    return (await api('GET', `/social/jobs/signals?ids=${ids.slice(0, 100).join(',')}`)).signals
  } catch {
    return {}
  }
}

/** Apply pressed: kept in My items, and your followers see it (unless you turned that off). */
export const markApplied = (id, job) => api('POST', `/social/jobs/${id}/applied`, job ? { job: { title: job.title, location: job.location ?? '' } } : {})

/*
 * Apply opens the employer's page; whether they applied there is theirs to say. So, as LinkedIn asks,
 * "Did you apply?" when they come back to this tab, and only a yes is recorded: their followers see
 * applications, not pages opened.
 */
let applying = null
export function didYouApply(id, job, onYes) {
  applying = { id, job, onYes, away: false }
}
/** The page could not be opened after all: nothing to ask about. */
export const notApplying = () => void (applying = null)
const leftForTheJob = () => {
  if (applying) applying.away = true
}
const backFromTheJob = () => {
  if (!applying?.away || document.hidden) return
  const { id, job, onYes } = applying
  applying = null
  const { el, close } = dialog(
    `<div class="dialog-b stack" style="text-align:center;padding:28px 24px">
<h2>Did you apply?</h2>
<p class="muted">${esc(job.title)}${job.location ? ` · ${esc(job.location)}` : ''}</p>
<button class="btn wide" type="button" data-yes>Yes, I applied</button>
<button class="btn ghost wide" type="button" data-close>Not yet</button>
</div>`,
    'small'
  )
  $('[data-yes]', el).addEventListener('click', async () => {
    close()
    try {
      await markApplied(id, job)
      onYes?.()
      toast('Marked as applied. <a href="/items?tab=applied">See your applications</a>')
    } catch (e) {
      toast(esc(e.message))
    }
  })
}
addEventListener('blur', leftForTheJob)
addEventListener('focus', backFromTheJob)
document.addEventListener('visibilitychange', () => (document.hidden ? leftForTheJob() : backFromTheJob()))

/**
 * One click apply (the owner, 2026-10-21: "the server will try to reach the app, if its not active, the
 * user will get a pop up for that and a download button incase they dont have one"): the job goes to the
 * person's desktop app through the server. When the app is open it applies within a minute; when it is
 * not, they are told so, with the download, and the job waits for the app's next start.
 */
export async function sendToApp(id, job) {
  const r = await api('POST', `/social/jobs/${id}/applied`, { queue: true, job })
  refreshBadges()
  if (r.appOpen) {
    toast('Sent to your desktop app. It starts applying within a minute.', 6000)
    return r
  }
  dialog(
    `<div class="dialog-b stack" style="text-align:center;padding:30px 26px">
<div class="app-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></div>
<h2>Your desktop app is not open</h2>
<p class="muted">One click apply works through the Oporch app on your computer. Open it and it applies to <b>${esc(job.title)}</b> by itself. The job waits for it.</p>
<p class="muted small">Not installed yet? It is free, for Windows 10 and 11.</p>
<a class="btn wide" href="/download">Download the desktop app</a>
<button class="btn ghost wide" type="button" data-close>OK, I will open it</button>
</div>`,
    'small'
  )
  return r
}

/** Save a job for later (My items), or unsave it. */
export async function saveJob(id, job, saved) {
  if (saved) await api('DELETE', `/social/jobs/${id}/save`)
  else await api('POST', `/social/jobs/${id}/save`, { job })
  return !saved
}

// ── Shared clicks, wherever they are on the page

let pressTimer = 0
document.addEventListener('pointerdown', (e) => {
  // A long press on Like opens the reactions, as on a phone.
  const like = e.target.closest?.('[data-like]')
  if (!like) return
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    pressTimer = -1
    reactionPicker(like.closest('[data-post]'), like)
  }, 450)
})
document.addEventListener('pointerup', () => pressTimer > 0 && clearTimeout(pressTimer))
let hoverTimer = 0
document.addEventListener('pointerover', (e) => {
  const like = e.target.closest?.('[data-like]')
  clearTimeout(hoverTimer)
  if (like && matchMedia('(hover: hover)').matches && me) hoverTimer = setTimeout(() => reactionPicker(like.closest('[data-post]'), like), 600)
})

document.addEventListener('click', (e) => {
  const t = e.target
  if (!(t instanceof Element)) return
  if (t.closest('[data-act=create]')) {
    e.preventDefault()
    return compose()
  }
  if (t.closest('[data-signout]')) {
    e.preventDefault()
    return void signOut()
  }
  const more = t.closest('[data-act=more]')
  if (more) {
    const go = (href) => () => (location.href = href)
    return popMenu(more, [
      ['Settings', go('/settings')],
      ['My items', go('/items')],
      ['Who viewed your profile', go('/views')],
      ['Get the desktop app', go('/download')],
      // As the desktop app's account menu: it offers the theme that is not showing (boot.js applies it next time).
      [document.documentElement.classList.contains('dark') ? 'Light mode' : 'Dark mode', toggleTheme],
      ['Log out', () => void signOut()]
    ])
  }
  const rel = t.closest('[data-follow],[data-following],[data-requested]')
  if (rel) return void relate(rel)
  const unhide = t.closest('[data-unhide]')
  if (unhide) {
    void api('DELETE', `/social/updates/${unhide.dataset.unhide}/hide`).then(() => location.reload())
    return
  }
  const card = t.closest('[data-post]')
  if (!card) return
  // A repost made as it is: undone from its own line, as LinkedIn's is (the card's own menu is the original's).
  const undo = t.closest('[data-repost-menu]')
  if (undo) {
    const id = +card.dataset.wrapper
    return popMenu(undo, [
      [
        'Undo repost',
        async () => {
          try {
            await api('DELETE', `/social/updates/${id}`)
            card.remove()
            emit('deleted', id)
            toast('Repost undone.')
          } catch (e) {
            toast(esc(e.message))
          }
        },
        true
      ]
    ])
  }
  if (t.closest('[data-like]')) {
    if (pressTimer === -1) return void (pressTimer = 0)
    $('.rx-pop')?.remove()
    const u = posts.get(+card.dataset.post)
    return void react(card, u?.reactions?.mine ? null : 'like')
  }
  if (t.closest('[data-reactions]')) return void reactionsDialog(+card.dataset.post)
  if (t.closest('[data-repost]')) return repostMenu(card, t.closest('[data-repost]'))
  if (t.closest('[data-send]')) return void sendDialog(card)
  if (t.closest('[data-post-menu]')) return postMenu(card, t.closest('[data-post-menu]'))
  const clamp = t.closest('.post-t.clamp')
  if (clamp && !t.closest('a') && clamp.scrollHeight > clamp.clientHeight + 2) clamp.classList.remove('clamp')
})

// ── The page
/*
 * Started, not awaited at the top: the page's script imports this file, and a module still waiting at
 * its top level would never finish loading for it. That deadlocked every page.
 */
async function start() {
  const page = document.body.dataset.page
  const lit = document.body.dataset.nav || page
  for (const a of $$('[data-nav]')) if (a.dataset.nav === lit) a.setAttribute('aria-current', 'page')
  await loadSession()
  paintMe()
  void badges()
  setInterval(() => void badges(), 30_000)
  document.addEventListener('visibilitychange', () => document.hidden || void badges())

  const main = document.getElementById('main')
  try {
    const mod = await import(`/pages/${page}.js`)
    await mod.default({ main })
  } catch (e) {
    console.error(e)
    main.innerHTML = `<div class="empty"><h2>This page could not load</h2><p>${esc(e.message)}</p><a class="btn" href="">Try again</a></div>`
  }
}
void start()
