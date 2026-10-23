/**
 * One post, /p?id=<id>, with its comments under it as Instagram lays them out (comments.js). Anyone may open
 * a post by its link, signed in or not; liking and commenting need an account. In a list, a post's comments
 * open beside it instead (app.js `openComments`).
 */
import { $, api, avatar, esc, me, param, postHtml } from '/app.js'
import { mountComments } from '/comments.js'

export default async function ({ main }) {
  const id = Number(param('id'))
  if (!id) return void (main.innerHTML = '<div class="empty"><h2>No post named</h2><a class="btn" href="/home">Go to Home</a></div>')
  main.innerHTML = '<div class="spin"></div>'
  let r
  try {
    r = await api('GET', `/social/updates/${id}`)
  } catch (e) {
    main.innerHTML = `<div class="empty"><h2>${e.status === 404 ? 'This post is gone' : 'This post could not load'}</h2><p>${esc(e.message)}</p><a class="btn" href="/">See jobs</a></div>`
    return
  }
  const u = r.update
  // A plain repost is the post it reposts: its likes and comments are that one's.
  if (u.repostOf && !u.text && !u.repostOf.gone) return void location.replace(`/p?id=${u.repostOf.id}`)
  const by = u.author
  if (by) document.title = u.recommends ? `${by.name} recommends ${u.recommends.name} | Oporch` : `${by.name} on Oporch: "${u.text.slice(0, 60)}${u.text.length > 60 ? '…' : ''}"`
  const next = encodeURIComponent(location.pathname + location.search)
  main.innerHTML = `<div class="page narrow stack">
${
  !me && by
    ? `<div class="card pad row wrap">${avatar(by)}<div class="grow"><b>${esc(by.name)}</b> is on Oporch</div><a class="btn small" href="/login?new=1&next=${next}">Join to follow</a><a class="btn ghost small" href="/login?next=${next}">Log in</a></div>`
    : ''
}
<div id="card">${postHtml(u, { solo: true })}</div>
${u.recommends ? '' : '<section class="card ig-comments" id="comments" aria-label="Comments"></section>'}
</div>`
  if (u.recommends) return
  const thread = mountComments($('#comments', main), u, {
    first: r,
    // The post's card again, its comment count moved on.
    onCount: (by) => {
      u.comments = Math.max(0, u.comments + by)
      $('#card', main).innerHTML = postHtml(u, { solo: true })
    }
  })
  if (location.hash === '#say') thread.focus()
}
