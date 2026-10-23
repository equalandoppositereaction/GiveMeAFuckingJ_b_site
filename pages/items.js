/**
 * My items, as LinkedIn has them: posts you saved, jobs you saved, and the jobs you applied to from
 * the website, with Apply ("Did you apply?" said yes) or One click apply (your desktop app applied), and
 * those sent to your desktop app that it has not applied to yet. Home links here, beside its tabs.
 */
import { $, ago, api, didYouApply, esc, me, param, postHtml, toast } from '/app.js'

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/items')
  let tab = ['posts', 'saved', 'applied'].includes(param('tab')) ? param('tab') : 'posts'
  main.innerHTML = `<div class="page narrow">
<div class="page-h"><h1>My items</h1></div>
<div class="feed-tabs" role="tablist" style="margin-bottom:16px"><button type="button" role="tab" data-tab="posts">Saved Posts</button><button type="button" role="tab" data-tab="saved">Saved Jobs</button><button type="button" role="tab" data-tab="applied">Applied Jobs</button></div>
<div id="out"><div class="spin"></div></div>
</div>`
  const out = $('#out', main)
  let jobs = null
  let next = null

  const job = (j, saved) => `<div class="job-row" data-job="${j.id}"><div class="grow"><b>${esc(j.title)}</b><div class="muted small">${[j.location, `${saved ? 'Saved' : 'Applied'} ${ago(j.at)}`, j.oneClick ? 'with One click apply' : ''].filter(Boolean).join(' · ')}</div></div>${
    saved ? `${j.url ? '<button class="btn small" type="button" data-apply>Apply</button>' : ''}<button class="btn ghost small" type="button" data-unsave>Unsave</button>` : ''
  }</div>`

  async function draw(more = false) {
    for (const b of main.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab))
    history.replaceState(null, '', tab === 'posts' ? '/items' : `/items?tab=${tab}`)
    try {
      if (tab === 'posts') {
        const r = await api('GET', `/social/saved${more && next ? `?before=${next}` : ''}`)
        next = r.next
        const html = r.updates.map(postHtml).join('')
        if (more) {
          $('#more-saved', out)?.remove()
          $('#saved-list', out).insertAdjacentHTML('beforeend', html)
        } else out.innerHTML = `<div class="stack" id="saved-list">${html || '<div class="card empty"><h2>No saved posts</h2><p>Save a post with the bookmark under it to read it later.</p></div>'}</div>`
        if (r.more) out.insertAdjacentHTML('beforeend', '<div class="center" id="more-saved" style="margin-top:16px"><button class="btn ghost" type="button">Show more</button></div>')
        return
      }
      jobs ??= await api('GET', '/social/my-jobs')
      const list = jobs[tab]
      // Sent with One click apply and not applied to yet: with the app, or waiting for it to open.
      const sent =
        tab === 'applied' && jobs.sent.length
          ? `<div class="sec"><h3 style="margin-bottom:6px">Sent to your desktop app</h3>${jobs.sent
              .map(
                (j) =>
                  `<div class="job-row"><div class="grow"><b>${esc(j.title)}</b><div class="muted small">${[j.location, `Sent ${ago(j.at)}`, j.taken ? 'your app has it' : 'waiting for your app to open'].filter(Boolean).join(' · ')}</div></div></div>`
              )
              .join('')}</div>`
          : ''
      out.innerHTML = `<div class="card">${sent}<div class="sec">${
        list.map((j) => job(j, tab === 'saved')).join('') ||
        `<div class="empty"><h2>${tab === 'saved' ? 'No saved jobs' : 'No applications yet'}</h2><p>${tab === 'saved' ? 'Save a job from Jobs to come back to it.' : 'Jobs you apply to from Jobs show here.'}</p><a class="btn" href="/explore">Search jobs</a></div>`
      }</div></div>`
    } catch (e) {
      out.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    }
  }

  main.querySelector('.feed-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]')
    if (!b || b.dataset.tab === tab) return
    tab = b.dataset.tab
    out.innerHTML = '<div class="spin"></div>'
    void draw()
  })
  out.addEventListener('click', async (e) => {
    if (e.target.closest('#more-saved button')) return void draw(true)
    const row = e.target.closest('[data-job]')
    if (!row) return
    const j = jobs?.saved.find((x) => x.id === +row.dataset.job)
    if (!j) return
    if (e.target.closest('[data-apply]')) {
      // Asked when they come back, and marked only if they did (app.js `didYouApply`).
      didYouApply(j.id, j, () => {
        jobs = null
        if (tab !== 'posts') void draw()
      })
      window.open(j.url, '_blank', 'noopener')
      return
    }
    if (e.target.closest('[data-unsave]')) {
      try {
        await api('DELETE', `/social/jobs/${j.id}/save`)
        jobs.saved = jobs.saved.filter((x) => x !== j)
        void draw()
      } catch (x) {
        toast(esc(x.message))
      }
    }
  })
  await draw()
}
