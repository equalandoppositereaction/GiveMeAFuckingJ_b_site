/**
 * One update, /p?id=<id>, with its comments as LinkedIn has them: replies one level deep, comments liked,
 * edited and deleted. Anyone may open an update for anyone by its link, signed in or not (the owner,
 * 2026-10-08); reacting and commenting need an account.
 */
import { $, ago, api, avatar, esc, exampleTag, linkify, me, param, popMenu, postHtml, profileUrl, report, requireLogin, toast } from '/app.js'

export default async function ({ main }) {
  const id = Number(param('id'))
  if (!id) return void (main.innerHTML = '<div class="empty"><h2>No update named</h2><a class="btn" href="/feed">Go to your feed</a></div>')
  main.innerHTML = '<div class="spin"></div>'
  let r
  try {
    r = await api('GET', `/social/updates/${id}`)
  } catch (e) {
    main.innerHTML = `<div class="empty"><h2>${e.status === 404 ? 'This update is gone' : 'This update could not load'}</h2><p>${esc(e.message)}</p><a class="btn" href="/">See jobs</a></div>`
    return
  }
  const u = r.update
  // A plain repost is the update it reposts: its reactions and comments are that one's.
  if (u.repostOf && !u.text && !u.repostOf.gone) return void location.replace(`/p?id=${u.repostOf.id}`)
  const by = u.author
  if (by) document.title = `${by.name} on GMAFJ: "${u.text.slice(0, 60)}${u.text.length > 60 ? '…' : ''}"`
  const next = encodeURIComponent(location.pathname + location.search)
  main.innerHTML = `<div class="page narrow stack">
${
  !me && by
    ? `<div class="card pad row wrap">${avatar(by)}<div class="grow"><b>${esc(by.name)}</b> is on GMAFJ</div><a class="btn small" href="/login?new=1&next=${next}">Join to connect</a><a class="btn ghost small" href="/login?next=${next}">Log in</a></div>`
    : ''
}
<div id="card">${postHtml(u)}</div>
<section class="card" aria-label="Comments">
${
  me
    ? `<form class="say" id="say" style="border-top:0;border-bottom:1px solid var(--line)">${avatar(me, 's')}<textarea maxlength="2000" rows="1" placeholder="Add a comment…" aria-label="Your comment"></textarea><button class="btn small" type="submit">Post</button></form>`
    : `<div class="say" style="border-top:0;border-bottom:1px solid var(--line)"><a class="textbtn" href="/login?next=${next}">Log in to comment</a></div>`
}
<div id="earlier"></div>
<div class="comments" id="comments"></div>
</section>
</div>`

  const list = $('#comments', main)
  const earlier = $('#earlier', main)
  let comments = r.comments
  let more = r.more

  const byId = (cid) => {
    for (const c of comments) {
      if (c.id === cid) return c
      const reply = c.replies?.find((x) => x.id === cid)
      if (reply) return reply
    }
    return null
  }
  const one = (c, reply = false) => {
    const a = c.author
    const href = a ? profileUrl(a) : '#'
    return `<div class="comment${reply ? ' reply' : ''}" data-c="${c.id}">
<a href="${href}" tabindex="-1">${avatar(a, reply ? 'xs' : 's')}</a>
<div class="grow">
<div class="comment-b"><div class="comment-h"><div class="grow"><a href="${href}"><b class="small">${esc(a?.name ?? 'Deleted account')}</b></a>${exampleTag(a)}${a?.headline ? `<div class="who-h">${esc(a.headline)}</div>` : ''}</div><span class="muted small">${ago(c.at)}${c.edited ? ' · Edited' : ''}</span>${
      me ? '<button class="menu-b" type="button" data-cmenu aria-label="More">⋯</button>' : ''
    }</div><p data-text>${linkify(c.text)}</p></div>
<div class="comment-m"><button class="textbtn quiet${c.liked ? ' on' : ''}" type="button" data-clike aria-pressed="${c.liked}">Like</button>${c.likes ? `<span>${c.likes}</span>` : ''}<span aria-hidden="true">|</span><button class="textbtn quiet" type="button" data-reply="${reply ? c.parentId : c.id}">Reply</button></div>
${reply ? '' : `<div class="replies">${(c.replies || []).map((x) => one(x, true)).join('')}</div><div data-reply-box></div>`}
</div>
</div>`
  }
  const draw = () => {
    list.innerHTML = comments.length ? comments.map((c) => one(c)).join('') : '<p class="muted small">No comments yet.</p>'
    earlier.innerHTML = more ? '<div class="center" style="padding:10px 0 0"><button class="textbtn" type="button" data-earlier>Load earlier comments</button></div>' : ''
  }
  draw()

  /** The update's card again, its comment count moved on. */
  const recount = (by) => {
    u.comments = Math.max(0, u.comments + by)
    $('#card', main).innerHTML = postHtml(u)
  }

  async function send(text, parentId) {
    const c = await api('POST', `/social/updates/${id}/comments`, parentId ? { text, parentId } : { text })
    if (c.parentId) {
      const top = comments.find((x) => x.id === c.parentId)
      if (top) (top.replies ||= []).push(c)
    } else comments.push({ ...c, replies: [] })
    draw()
    recount(1)
  }

  function editIn(el, c) {
    const p = $('[data-text]', el)
    p.outerHTML = `<div class="stack" data-editing style="gap:8px;margin-top:6px"><textarea class="textarea" maxlength="2000" style="min-height:60px">${esc(c.text)}</textarea><div class="row"><button class="btn small" type="button" data-save>Save</button><button class="btn ghost small" type="button" data-cancel>Cancel</button></div></div>`
    const box = $('[data-editing]', el)
    $('textarea', box).focus()
    $('[data-cancel]', box).onclick = draw
    $('[data-save]', box).onclick = async () => {
      try {
        Object.assign(c, await api('PATCH', `/social/comments/${c.id}`, { text: $('textarea', box).value }))
        draw()
      } catch (x) {
        toast(esc(x.message))
      }
    }
  }

  main.addEventListener('click', async (e) => {
    const t = e.target
    if (t.closest('[data-earlier]')) {
      try {
        const older = await api('GET', `/social/updates/${id}/comments?before=${comments[0]?.id ?? ''}`)
        comments = [...older.comments, ...comments]
        more = older.more
        draw()
      } catch (x) {
        toast(esc(x.message))
      }
      return
    }
    const el = t.closest('[data-c]')
    if (!el) return
    const c = byId(+el.dataset.c)
    if (!c) return
    if (t.closest('[data-clike]')) {
      if (!requireLogin('Log in to like comments.')) return
      try {
        const res = await api(c.liked ? 'DELETE' : 'POST', `/social/comments/${c.id}/like`)
        c.liked = res.liked
        c.likes = res.likes
        draw()
      } catch (x) {
        toast(esc(x.message))
      }
      return
    }
    const reply = t.closest('[data-reply]')
    if (reply) {
      if (!requireLogin('Log in to reply.')) return
      const top = list.querySelector(`[data-c="${reply.dataset.reply}"]`)
      const slot = top && $('[data-reply-box]', top)
      if (!slot) return
      const mention = c.mine || !c.author ? '' : `@${c.author.handle} `
      slot.innerHTML = `<form class="say reply-say">${avatar(me, 'xs')}<textarea maxlength="2000" rows="1" placeholder="Add a reply…" aria-label="Your reply">${esc(c.parentId ? mention : '')}</textarea><button class="btn small" type="submit">Reply</button></form>`
      const box = $('textarea', slot)
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
      $('form', slot).addEventListener('submit', async (ev) => {
        ev.preventDefault()
        const text = box.value.trim()
        if (!text) return
        try {
          await send(text, +reply.dataset.reply)
        } catch (x) {
          toast(esc(x.message))
        }
      })
      wire(box)
      return
    }
    const menu = t.closest('[data-cmenu]')
    if (menu) {
      const items = []
      if (c.mine) items.push(['Edit', () => editIn(el, c)])
      if (c.mine || u.mine || me?.admin)
        items.push([
          'Delete',
          async () => {
            if (!confirm('Delete this comment?')) return
            try {
              await api('DELETE', `/social/comments/${c.id}`)
              const top = comments.find((x) => x.id === c.id)
              const gone = top ? 1 + (top.replies?.length ?? 0) : 1
              comments = comments.filter((x) => x.id !== c.id)
              for (const x of comments) x.replies = (x.replies || []).filter((y) => y.id !== c.id)
              draw()
              recount(-gone)
            } catch (x) {
              toast(esc(x.message))
            }
          },
          true
        ])
      if (!c.mine) items.push(['Report', () => report('comment', { id: c.id }), true])
      popMenu(menu, items)
    }
  })

  /** Enter sends, Shift+Enter is a new line, and the box grows with what is typed. */
  function wire(box) {
    box.addEventListener('input', () => {
      box.style.height = 'auto'
      box.style.height = `${box.scrollHeight}px`
    })
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        box.form.requestSubmit()
      }
    })
  }

  const say = $('#say', main)
  if (!say) return
  const box = $('textarea', say)
  wire(box)
  say.addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = box.value.trim()
    if (!text) return
    const btn = $('button', say)
    btn.disabled = true
    try {
      await send(text)
      box.value = ''
      box.style.height = ''
    } catch (err) {
      toast(esc(err.message))
    } finally {
      btn.disabled = false
    }
  })
  if (location.hash === '#say') box.focus()
}
