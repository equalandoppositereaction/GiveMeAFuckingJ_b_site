/**
 * Feed: the updates (the owner, 2026-10-08; it was "Home" until the owner named it the Feed). "For you" is ranked as X ranks its home timeline
 * (server: social/rank.ts), from the approved updates a member may see; "Following" is the people you
 * follow, newest first. Your own updates waiting for review show to you, marked. Beside it on wide
 * screens: you, people to follow, and whether your desktop app is open.
 */
import { $, api, avatar, esc, me, on, personRow, postHtml, profileUrl, who } from '/app.js'

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/feed')
  main.innerHTML = `<div class="feed-wrap">
<section class="feed" aria-label="Updates">
<div class="card start">${avatar(me)}<button type="button" data-act="create">Start an update</button></div>
<div class="feed-tabs" role="tablist" aria-label="Which updates"><button type="button" role="tab" data-mode="foryou">For you</button><button type="button" role="tab" data-mode="following">Following</button></div>
<div id="posts" class="stack"></div>
<div id="more"><div class="spin"></div></div>
</section>
<aside class="aside">
<div class="person">${who(me, `@${me.handle}`)}<a class="textbtn" href="${profileUrl(me)}">Profile</a></div>
<div class="card pad stack"><div class="aside-h"><span>Suggested for you</span><a class="textbtn" href="/search">See all</a></div><div id="sugg"><div class="spin"></div></div></div>
<div class="card pad stack">
<div class="app-state"><span class="dot" id="app-dot"></span><span id="app-text">Checking for your desktop app…</span></div>
<p class="muted small">One click apply sends jobs from this site to the Oporch app on your computer, which applies to them for you.</p>
<a class="btn ghost small" href="/download">Get the app</a>
</div>
<nav class="foot-links"><a href="/explore">Jobs</a><a href="/items">My items</a><a href="/blog/">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>© 2026 Oporch</span></nav>
</aside>
</div>`
  const list = $('#posts', main)
  const moreBox = $('#more', main)
  let mode = 'foryou'
  try {
    if (localStorage.getItem('gmafj.feed') === 'following') mode = 'following'
  } catch {
    /* the default */
  }
  let shown = new Set()
  let before = null
  let done = false
  let busy = false
  let gen = 0

  async function page() {
    if (busy || done) return
    busy = true
    const g = gen
    try {
      // For you: the next best, less what was shown this visit. Following: older than the last.
      const r = await api('POST', '/social/feed', mode === 'foryou' ? { mode, shown: [...shown].slice(-500) } : { mode, ...(before ? { before } : {}) })
      if (g !== gen) return
      const fresh = r.updates.filter((u) => !shown.has(u.id) && !list.querySelector(`[data-post="${u.id}"]`))
      for (const u of r.updates) shown.add(u.id)
      list.insertAdjacentHTML('beforeend', fresh.map(postHtml).join(''))
      before = r.updates.at(-1)?.id ?? before
      done = !r.more || !r.updates.length
      if (!list.querySelector('.post')) {
        list.innerHTML =
          mode === 'following'
            ? '<div class="card empty"><h2>Nothing here yet</h2><p>Updates from the people you follow show here.</p><a class="btn" href="/search">Find people</a></div>'
            : '<div class="card empty"><h2>No updates yet</h2><p>Be the first: share what you are working on, or a job you are hiring for.</p><button class="btn" type="button" data-act="create">Share an update</button></div>'
      }
      moreBox.hidden = done
      if (done && list.querySelector('.post')) moreBox.hidden = true
    } catch (e) {
      if (g !== gen) return
      moreBox.innerHTML = `<div class="empty"><p>${esc(e.message)}</p><button class="btn ghost small" type="button" data-retry>Try again</button></div>`
      moreBox.querySelector('[data-retry]').onclick = () => {
        moreBox.innerHTML = '<div class="spin"></div>'
        void page()
      }
    } finally {
      busy = false
      // The tab changed while this was on its way: the new one's first page.
      if (g !== gen) void page()
    }
  }

  function choose(m) {
    mode = m
    for (const b of main.querySelectorAll('[data-mode]')) b.setAttribute('aria-selected', String(b.dataset.mode === m))
    try {
      localStorage.setItem('gmafj.feed', m)
    } catch {
      /* not remembered */
    }
    gen++
    shown = new Set()
    before = null
    done = false
    list.innerHTML = ''
    moreBox.hidden = false
    moreBox.innerHTML = '<div class="spin"></div>'
    void page()
  }
  main.querySelector('.feed-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]')
    if (b && b.dataset.mode !== mode) choose(b.dataset.mode)
  })
  choose(mode)
  new IntersectionObserver((es) => es[0].isIntersecting && void page(), { rootMargin: '800px' }).observe(moreBox)

  on('posted', (u) => {
    if (list.querySelector(`[data-post="${u.id}"]`)) return
    list.querySelector('.empty')?.remove()
    shown.add(u.id)
    list.insertAdjacentHTML('afterbegin', postHtml(u))
  })

  api('GET', '/social/suggestions?limit=5')
    .then((r) => {
      $('#sugg', main).innerHTML = r.people.map((p) => personRow(p, p.reason)).join('') || '<p class="muted small">Nobody new yet. Invite people you know.</p>'
    })
    .catch(() => {
      $('#sugg', main).innerHTML = ''
    })

  on('badges', (b) => {
    $('#app-dot', main).classList.toggle('on', b.app)
    $('#app-text', main).textContent = b.app ? 'Your desktop app is open.' : 'Your desktop app is not open.'
  })
}
