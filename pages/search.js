/**
 * Search (the owner, 2026-10-08): people, with LinkedIn's filters (which degree of connection, where,
 * current company), and updates by their words or #hashtags. Under the search bar, before anything is
 * typed: people to connect with, ranked as X ranks Who To Follow (server: social/rank.ts), with why each
 * is suggested, and how many connection requests are left today (100 a day). Jobs are searched on Jobs.
 */
import { $, api, avatar, esc, exampleTag, me, on, param, personRow, plural, postHtml, profileUrl, relButtons } from '/app.js'

export default async function ({ main }) {
  if (!me) return void location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
  main.innerHTML = `<div class="page narrow">
<form id="f" role="search" class="stack" style="gap:10px">
<input class="input big" id="q" type="search" placeholder="Search people, updates or #hashtags" aria-label="Search" autocomplete="off" enterkeyhint="search">
<div class="feed-tabs" role="tablist" aria-label="What to search"><button type="button" role="tab" data-tab="people">People</button><button type="button" role="tab" data-tab="posts">Updates</button></div>
<div class="filter-row" id="filters">
<select class="input" id="degree" aria-label="Connections"><option value="">All connections</option><option value="1">1st</option><option value="2">2nd</option><option value="3">3rd+</option></select>
<input class="input" id="loc" placeholder="Location" aria-label="Location" autocomplete="off">
<input class="input" id="co" placeholder="Current company" aria-label="Current company" autocomplete="off">
</div>
</form>
<p class="muted small" style="margin:12px 2px">Looking for jobs? <a class="link" href="/explore">Search them on Jobs</a>.</p>
<div id="out"><div class="spin"></div></div>
</div>`
  const q = $('#q', main)
  const degree = $('#degree', main)
  const loc = $('#loc', main)
  const co = $('#co', main)
  const out = $('#out', main)
  const filters = $('#filters', main)
  let tab = param('tab') === 'posts' ? 'posts' : 'people'
  let typing = 0
  let asked = 0
  let before = null

  /** People to connect with, under the search bar. */
  async function suggestions() {
    const mine = ++asked
    try {
      const r = await api('GET', '/social/suggestions?limit=24')
      if (mine !== asked) return
      out.innerHTML = `<div class="sec-h" style="margin:4px 2px 12px"><h2>People you may know</h2><span class="muted small">${plural(r.left, 'connection request')} left today</span></div>${
        r.people.length
          ? `<div class="pymk">${r.people
              .map(
                (p) => `<div class="card pymk-card"><a href="${profileUrl(p)}" class="pymk-av">${avatar(p, 'l')}</a><a class="pymk-n" href="${profileUrl(p)}">${esc(p.name)}</a>${exampleTag(p)}<div class="who-h pymk-h">${esc(p.headline)}</div><div class="muted small pymk-r">${esc(p.reason)}</div>${relButtons(p.handle, 'none', true, { example: p.example })}</div>`
              )
              .join('')}</div>`
          : '<div class="card empty"><p>Nobody new right now. Search for people you know.</p></div>'
      }`
    } catch (e) {
      out.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    }
  }

  async function people() {
    const query = new URLSearchParams()
    if (q.value.trim()) query.set('q', q.value.trim())
    if (loc.value.trim()) query.set('location', loc.value.trim())
    if (co.value.trim()) query.set('company', co.value.trim())
    if (degree.value) query.set('degree', degree.value)
    if (![...query.keys()].some((k) => k !== 'degree')) return void suggestions()
    const mine = ++asked
    try {
      const r = await api('GET', `/social/search?${query}`)
      if (mine !== asked) return
      out.innerHTML = `<div class="card"><div class="sec">${
        r.people.length
          ? r.people.map((p) => personRow(p, p.relation, [p.headline, p.mutual ? plural(p.mutual, 'mutual connection') : ''].filter(Boolean).join(' · '))).join('')
          : '<p class="muted">Nobody matches. Try fewer words, or another filter.</p>'
      }</div></div>`
    } catch (e) {
      out.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    }
  }

  async function posts(next = false) {
    const text = q.value.trim()
    if (!text) {
      out.innerHTML = '<div class="card empty"><p>Search updates by their words, or a #hashtag.</p></div>'
      return
    }
    const mine = ++asked
    if (!next) before = null
    try {
      const r = await api('GET', `/social/search/updates?q=${encodeURIComponent(text)}${before ? `&before=${before}` : ''}`)
      if (mine !== asked) return
      const html = r.updates.map(postHtml).join('')
      if (next) {
        $('#more-posts', out)?.remove()
        $('#found', out).insertAdjacentHTML('beforeend', html)
      } else out.innerHTML = `<div class="stack" id="found">${html || `<div class="card empty"><p>No updates match “${esc(text)}”.</p></div>`}</div>`
      before = r.updates.at(-1)?.id ?? before
      if (r.more && r.updates.length) out.insertAdjacentHTML('beforeend', '<div class="center" id="more-posts" style="margin-top:16px"><button class="btn ghost" type="button">Show more</button></div>')
    } catch (e) {
      out.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    }
  }

  function run() {
    const s = new URLSearchParams()
    if (q.value.trim()) s.set('q', q.value.trim())
    if (tab === 'posts') s.set('tab', 'posts')
    history.replaceState(null, '', String(s) ? `?${s}` : location.pathname)
    filters.hidden = tab !== 'people'
    for (const b of main.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab))
    return tab === 'people' ? people() : posts()
  }

  $('#f', main).addEventListener('input', (e) => {
    if (e.target.tagName === 'SELECT') return
    clearTimeout(typing)
    typing = setTimeout(run, 300)
  })
  $('#f', main).addEventListener('change', (e) => e.target.tagName === 'SELECT' && void run())
  $('#f', main).addEventListener('submit', (e) => {
    e.preventDefault()
    clearTimeout(typing)
    void run()
  })
  main.querySelector('.feed-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]')
    if (!b || b.dataset.tab === tab) return
    tab = b.dataset.tab
    void run()
  })
  out.addEventListener('click', (e) => e.target.closest('#more-posts button') && void posts(true))
  // A request sent from the suggestions changes what is left today.
  on('relation', () => {
    if (tab !== 'people' || q.value.trim() || loc.value.trim() || co.value.trim()) return
    api('GET', '/social/suggestions?limit=1')
      .then((r) => {
        const left = out.querySelector('.sec-h .muted')
        if (left) left.textContent = `${plural(r.left, 'connection request')} left today`
      })
      .catch(() => {})
  })
  q.value = param('q') ?? ''
  if (!q.value) q.focus()
  void run()
}
