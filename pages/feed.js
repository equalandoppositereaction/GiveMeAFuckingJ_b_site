/**
 * Feed: the updates (the owner, 2026-10-08; it was "Home" until the owner named it the Feed). "For you" is
 * ranked as X ranks its home timeline (server: social/rank.ts), from the approved updates a member may see;
 * "Following" is the people you follow, newest first. Your own updates waiting for review show to you,
 * marked. Writing one is Create, in the menu, as on Instagram (the owner, 2026-10-21).
 *
 * "Jobs" (the owner, 2026-10-21): the website's jobs that match what you want, the jobs the people you
 * follow applied to, and jobs like the ones you applied to, weighted and ranked as X ranks (server:
 * social/jobs.ts and rank.ts), each saying why it is there. Beside it all on wide screens: you, people to
 * follow, and whether your desktop app is open.
 */
import { $, api, appliedLine, esc, me, on, personRow, popMenu, postHtml, profileUrl, toast, who } from '/app.js'
import { ARROW, BOLT, BOOKMARK, apply, detail, details, oneClick, salary, save, tags } from '/jobkit.js'

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/feed')
  main.innerHTML = `<div class="feed-wrap">
<section class="feed" aria-label="Feed">
<div class="feed-tabs" role="tablist" aria-label="What to show"><button type="button" role="tab" data-mode="foryou">For you</button><button type="button" role="tab" data-mode="following">Following</button><button type="button" role="tab" data-mode="jobs">Jobs</button></div>
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
<nav class="foot-links"><a href="/explore">Jobs</a><a href="/groups">Communities</a><a href="/items">My items</a><a href="/blog/">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>© 2026 Oporch</span></nav>
</aside>
</div>`
  const list = $('#posts', main)
  const moreBox = $('#more', main)
  const MODES = ['foryou', 'following', 'jobs']
  let mode = 'foryou'
  try {
    const kept = localStorage.getItem('gmafj.feed')
    if (MODES.includes(kept)) mode = kept
  } catch {
    /* the default */
  }
  let shown = new Set()
  let before = null
  let done = false
  let busy = false
  let gen = 0
  let build = null
  const jobs = new Map() // a job card's id -> the job, for its buttons

  /** A job in the Jobs tab: why it is there, what it is, and its three buttons. */
  const jobCard = (j) => {
    jobs.set(j.id, j)
    const why = j.why?.kind === 'following' && j.signals?.total ? appliedLine(j.signals) : `<span class="muted">${esc(j.why?.text ?? '')}</span>`
    return `<article class="card jobcard" data-id="${j.id}">
<div class="jc-why">${why}</div>
<div class="jc-h">
<div class="jc-logo" aria-hidden="true">${esc([...(j.title || '?').trim()][0] ?? '?')}</div>
<div class="grow"><h3><button type="button" data-open aria-expanded="false">${esc(j.title)}</button></h3>
<p class="muted small">${/^remote$/i.test((j.loc || '').trim()) ? '' : `${esc(j.loc || 'Location not listed')} · `}${tags(j)}</p>
<p class="small">${esc(salary(j.pay))}</p></div>
<button class="menu-b" type="button" data-jmenu aria-label="More">⋯</button>
</div>
<div class="more" hidden></div>
<div class="apply-row"><button class="apply" type="button">Apply${ARROW}</button><button class="oneclick" type="button" title="Your desktop app applies to it for you">${BOLT}<span>One click apply</span></button><span class="grow"></span><button class="save" type="button" aria-pressed="false" aria-label="Save" title="Save for later">${BOOKMARK}</button></div>
</article>`
  }

  async function page() {
    if (busy || done) return
    busy = true
    const g = gen
    try {
      if (mode === 'jobs') {
        const r = await api('POST', '/social/jobs/feed', { shown: [...shown].slice(-1000) })
        if (g !== gen) return
        if (!r.ready) {
          // The server is still reading the listings: a moment, then again.
          moreBox.innerHTML = '<div class="empty"><div class="spin"></div><p>Getting the jobs ready…</p></div>'
          setTimeout(() => g === gen && void page(), 4000)
          return
        }
        build = r.build
        for (const j of r.jobs) shown.add(j.id)
        list.insertAdjacentHTML('beforeend', r.jobs.map(jobCard).join(''))
        done = !r.more || !r.jobs.length
        if (!list.children.length) {
          list.innerHTML = `<div class="card empty"><h2>No jobs for you yet</h2><p>Say which jobs you want in Open to work, or follow people: the jobs they apply to show here.</p><div class="row wrap" style="justify-content:center"><a class="btn" href="/settings#work">Open to work</a><a class="btn ghost" href="/explore">Search all jobs</a></div></div>`
        }
        moreBox.hidden = done
        return
      }
      // For you: the next best, less what was shown this visit. Following: older than the last.
      const r = await api('POST', '/social/feed', mode === 'foryou' ? { mode, shown: [...shown].slice(-500) } : { mode, ...(before ? { before } : {}) })
      if (g !== gen) return
      const fresh = r.updates.filter((u) => !shown.has(u.id) && !list.querySelector(`[data-post="${u.id}"]`))
      for (const u of r.updates) shown.add(u.id)
      list.insertAdjacentHTML('beforeend', fresh.map((u) => postHtml(u)).join(''))
      before = r.updates.at(-1)?.id ?? before
      done = !r.more || !r.updates.length
      if (!list.querySelector('.post')) {
        list.innerHTML =
          mode === 'following'
            ? '<div class="card empty"><h2>Nothing here yet</h2><p>Updates from the people you follow show here.</p><a class="btn" href="/search">Find people</a></div>'
            : '<div class="card empty"><h2>No updates yet</h2><p>Be the first: share what you are working on, or a job you are hiring for.</p><button class="btn" type="button" data-act="create">Share an update</button></div>'
      }
      moreBox.hidden = done
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
    if (mode === 'jobs' || list.querySelector(`[data-post="${u.id}"]`)) return
    list.querySelector('.empty')?.remove()
    shown.add(u.id)
    list.insertAdjacentHTML('afterbegin', postHtml(u))
  })

  // ── A job card's buttons: details, Apply, One click apply, Save, and "Not interested"
  async function toggle(el, job) {
    const box = el.querySelector('.more')
    const open = box.hidden
    box.hidden = !open
    el.querySelector('[data-open]').setAttribute('aria-expanded', String(open))
    if (!open || box.dataset.filled) return
    box.dataset.filled = '1'
    box.innerHTML = '<p class="mono">Loading the details…</p>'
    try {
      box.innerHTML = details(job, await detail(job, build))
    } catch {
      delete box.dataset.filled
      box.innerHTML = '<p class="mono">The details could not be loaded. Close them and open them again to retry.</p>'
    }
  }
  list.addEventListener('click', (e) => {
    const t = e.target
    const el = t.closest('.jobcard')
    const job = el && jobs.get(+el.dataset.id)
    if (!job) return
    if (t.closest('.oneclick')) return void oneClick(job, t.closest('.oneclick'), build)
    if (t.closest('.apply')) return void apply(job, t.closest('.apply'), build)
    if (t.closest('.save')) return void save(job, t.closest('.save'), build)
    if (t.closest('[data-open]')) return void toggle(el, job)
    const undo = t.closest('[data-unhide-job]')
    if (undo) {
      void api('DELETE', `/social/jobs/${job.id}/hide`).then(() => (el.outerHTML = jobCard(job)))
      return
    }
    const menu = t.closest('[data-jmenu]')
    if (menu) {
      popMenu(menu, [
        [
          'Not interested',
          async () => {
            try {
              await api('POST', `/social/jobs/${job.id}/hide`)
              el.innerHTML = `<div class="sec row"><span class="grow muted">Hidden. You will see fewer jobs like this.</span><button class="textbtn" type="button" data-unhide-job>Undo</button></div>`
            } catch (x) {
              toast(esc(x.message))
            }
          }
        ],
        ['See all jobs', () => (location.href = '/explore')]
      ])
    }
  })
  // The link is fetched as the pointer reaches Apply, so the click can open the page at once.
  list.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('.apply, .oneclick') && e.target.closest('.jobcard')
    const job = el && jobs.get(+el.dataset.id)
    if (job) detail(job, build).catch(() => {})
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
