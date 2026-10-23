/**
 * A post's comments, as Instagram lays them out (the owner, 2026-10-21: "same for the comment section"):
 * each a username then the comment, its age, likes and Reply under it and a small heart on its right;
 * replies folded under "View replies"; one box at the bottom to add a comment, which Reply turns into a
 * reply ("Replying to"). Comments are liked, edited, deleted and reported here, one level of replies.
 *
 * Shown on a post's own page (pages/post.js), and beside a post wherever posts are listed (app.js
 * `openComments`; the owner, 2026-10-22: "make the comment section just appear on the right side of the
 * post when clicked on the same page").
 */
import { ago, api, avatar, esc, ICON, linkify, me, popMenu, profileUrl, report, requireLogin, toast } from '/app.js'

/**
 * The comments of post `u` drawn into `root`. `first`: its first page when it is already fetched (the
 * post's own page has it), else it is fetched here. `onCount(by)`: the post's comment count moved by this
 * many. Returns `focus()`, to put the cursor in the box, and `refresh()`, to fetch them again.
 */
export function mountComments(root, u, { first = null, onCount = () => {} } = {}) {
  const next = encodeURIComponent(location.pathname + location.search)
  root.innerHTML = `<div class="ig-earlier"></div><div class="ig-list"><div class="spin"></div></div>${
    me
      ? `<form class="ig-say ig-bottom"><div class="ig-to" hidden><span></span><button class="menu-b" type="button" data-unreply aria-label="Not a reply">✕</button></div>${avatar(me, 's')}<textarea maxlength="2000" rows="1" placeholder="Add a comment…" aria-label="Add a comment"></textarea><button class="textbtn" type="submit" disabled>Post</button></form>`
      : `<div class="ig-say ig-bottom"><a class="textbtn" href="/login?next=${next}">Log in to like or comment.</a></div>`
  }`
  const list = root.querySelector('.ig-list')
  const earlier = root.querySelector('.ig-earlier')
  const say = root.querySelector('form.ig-say')
  const box = say?.querySelector('textarea')
  let comments = []
  let more = false
  /** Threads opened with "View replies", and the comment being replied to. */
  const open = new Set()
  let replyTo = null

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
    const top = reply ? c.parentId : c.id
    const replies = c.replies || []
    return `<div class="ig-c${reply ? ' reply' : ''}" data-c="${c.id}">
<a href="${href}" tabindex="-1">${avatar(a, reply ? 'xs' : 's')}</a>
<div class="grow">
<p class="ig-t" data-text><a class="ig-u" href="${href}">${esc(a?.handle ?? 'deleted')}</a> ${linkify(c.text)}</p>
<div class="ig-cm"><span>${ago(c.at)}${c.edited ? ' · Edited' : ''}</span>${c.likes ? `<span>${c.likes === 1 ? '1 like' : `${c.likes} likes`}</span>` : ''}<button type="button" data-reply="${top}" data-handle="${esc(a?.handle ?? '')}">Reply</button>${
      me ? '<button class="ig-dots" type="button" data-cmenu aria-label="More">⋯</button>' : ''
    }</div>
${
  reply || !replies.length
    ? ''
    : `<button class="ig-view" type="button" data-thread="${c.id}"><span aria-hidden="true"></span>${open.has(c.id) ? 'Hide replies' : `View replies (${replies.length})`}</button><div class="ig-replies"${open.has(c.id) ? '' : ' hidden'}>${replies.map((x) => one(x, true)).join('')}</div>`
}
</div>
<button class="ig-cl${c.liked ? ' on' : ''}" type="button" data-clike aria-pressed="${c.liked}" aria-label="${c.liked ? 'Unlike' : 'Like'} this comment">${ICON.heart}</button>
</div>`
  }
  const draw = () => {
    list.innerHTML = comments.length ? comments.map((c) => one(c)).join('') : '<p class="ig-none">No comments yet. Start the conversation.</p>'
    earlier.innerHTML = more ? '<button class="ig-view" type="button" data-earlier><span aria-hidden="true"></span>View earlier comments</button>' : ''
  }
  const refresh = async () => {
    try {
      const r = await api('GET', `/social/updates/${u.id}/comments`)
      comments = r.comments
      more = r.more
      draw()
    } catch (x) {
      list.innerHTML = `<p class="ig-none">${esc(x.message)}</p>`
    }
  }
  if (first) {
    comments = first.comments
    more = first.more
    draw()
  } else void refresh()

  async function send(text, parentId) {
    const c = await api('POST', `/social/updates/${u.id}/comments`, parentId ? { text, parentId } : { text })
    if (c.parentId) {
      const top = comments.find((x) => x.id === c.parentId)
      if (top) (top.replies ||= []).push(c)
      open.add(c.parentId)
    } else comments.push({ ...c, replies: [] })
    draw()
    onCount(1)
    list.querySelector(`[data-c="${c.id}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  function editIn(el, c) {
    const p = el.querySelector('[data-text]')
    p.outerHTML = `<div class="stack" data-editing style="gap:8px;margin-top:6px"><textarea class="textarea" maxlength="2000" style="min-height:60px">${esc(c.text)}</textarea><div class="row"><button class="btn small" type="button" data-save-edit>Save</button><button class="btn ghost small" type="button" data-cancel>Cancel</button></div></div>`
    const edit = el.querySelector('[data-editing]')
    edit.querySelector('textarea').focus()
    edit.querySelector('[data-cancel]').onclick = draw
    edit.querySelector('[data-save-edit]').onclick = async () => {
      try {
        Object.assign(c, await api('PATCH', `/social/comments/${c.id}`, { text: edit.querySelector('textarea').value }))
        draw()
      } catch (x) {
        toast(esc(x.message))
      }
    }
  }

  const replying = (to) => {
    replyTo = to
    const bar = say.querySelector('.ig-to')
    bar.hidden = !to
    if (to) bar.querySelector('span').textContent = `Replying to @${to.handle}`
  }

  root.addEventListener('click', async (e) => {
    const t = e.target
    if (t.closest('[data-earlier]')) {
      try {
        const older = await api('GET', `/social/updates/${u.id}/comments?before=${comments[0]?.id ?? ''}`)
        comments = [...older.comments, ...comments]
        more = older.more
        draw()
      } catch (x) {
        toast(esc(x.message))
      }
      return
    }
    const thread = t.closest('[data-thread]')
    if (thread) {
      const n = +thread.dataset.thread
      open.has(n) ? open.delete(n) : open.add(n)
      return draw()
    }
    if (t.closest('[data-unreply]')) return replying(null)
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
      if (!requireLogin('Log in to reply.') || !box) return
      replying({ id: +reply.dataset.reply, handle: reply.dataset.handle })
      // As Instagram: the box below starts with their username.
      const mention = reply.dataset.handle && !c.mine ? `@${reply.dataset.handle} ` : ''
      if (mention && !box.value.startsWith(mention)) box.value = mention + box.value
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
      box.dispatchEvent(new Event('input'))
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
              onCount(-gone)
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

  if (say) {
    // Enter posts, Shift+Enter is a new line, the box grows with what is typed, and Post lights up once there is something.
    box.addEventListener('input', () => {
      box.style.height = 'auto'
      box.style.height = `${box.scrollHeight}px`
      say.querySelector('button[type=submit]').disabled = !box.value.trim()
    })
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        say.requestSubmit()
      }
    })
    say.addEventListener('submit', async (e) => {
      e.preventDefault()
      const text = box.value.trim()
      if (!text) return
      const btn = say.querySelector('button[type=submit]')
      btn.disabled = true
      try {
        await send(text, replyTo?.id)
        box.value = ''
        box.style.height = ''
        replying(null)
      } catch (err) {
        toast(esc(err.message))
        btn.disabled = false
      }
    })
  }
  return { focus: () => box?.focus(), refresh }
}
