/**
 * Messages, between connections (Instagram's direct messages, LinkedIn's rules): the conversations on the
 * left, the open one on the right; on a phone, one or the other. /messages?h=<username> opens one. An
 * update sent from its Send button shows as a card; "Seen" under your last message they have read.
 *
 * Polled, not pushed: the open conversation every 4 seconds while the tab is in view, the list every 15.
 */
import { $, ago, api, avatar, esc, linkify, me, media, param, popMenu, profileUrl, refreshBadges, report, toast, who } from '/app.js'

export default async function ({ main }) {
  if (!me) return void location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
  main.innerHTML = `<div class="dm">
<section class="dm-list" aria-label="Conversations"><h1>Messages</h1><div id="convs"><div class="spin"></div></div></section>
<section class="dm-thread" aria-label="Conversation"><div class="empty" style="margin:auto"><h2>Your messages</h2><p>Message your connections about jobs, referrals and anything else.</p><a class="btn" href="/search">Find people</a></div></section>
</div>`
  const dm = $('.dm', main)
  const convs = $('#convs', main)
  const pane = $('.dm-thread', main)
  let open = null // { handle, last, at, timer, seen, theirs }
  let list = []

  async function loadList() {
    try {
      list = (await api('GET', '/social/messages')).conversations
    } catch (e) {
      convs.innerHTML = `<p class="empty">${esc(e.message)}</p>`
      return
    }
    convs.innerHTML = list.length
      ? list
          .map(
            (c) => `<button type="button" class="conv" data-h="${esc(c.peer.handle)}" aria-current="${open?.handle === c.peer.handle}">${avatar(c.peer, 'l')}<div class="who-t grow"><div class="who-n">${esc(c.peer.name)}</div><div class="who-h${c.unread ? ' unread' : ''}">${c.last.mine ? 'You: ' : ''}${esc(c.last.text)} · ${ago(c.last.at)}</div></div>${c.unread ? `<span class="badge" style="position:static">${c.unread}</span>` : ''}</button>`
          )
          .join('')
      : '<p class="muted small" style="padding:0 20px">No conversations yet. Open a connection’s profile and press Message.</p>'
  }

  const stamp = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  /** An update sent in a message, as a card: one link, so nothing in it may be a link of its own. */
  const embed = (u) =>
    u.gone
      ? '<div class="msg-embed muted small">This update is no longer available.</div>'
      : `<a class="msg-embed" href="/p?id=${u.id}"><span class="embed-h" style="padding:0">${avatar(u.author, 's')}<span><b>${esc(u.author?.name ?? '')}</b><span class="who-h" style="display:block">${esc(u.author?.headline ?? '')}</span></span></span>${
          u.text ? `<p class="clamp-3">${esc(u.text)}</p>` : ''
        }${u.image ? `<img src="${esc(media(u.image))}" alt="" loading="lazy">` : ''}</a>`
  function bubbles(msgs, prevAt) {
    let html = ''
    let at = prevAt
    for (const m of msgs) {
      if (!at || m.at - at > 30 * 60 * 1000) html += `<div class="msg-t">${stamp(m.at)}</div>`
      if (m.update) html += `<div class="msg-card${m.mine ? ' mine' : ''}" data-m="${m.id}">${embed(m.update)}</div>`
      if (m.text) html += `<div class="msg${m.mine ? ' mine' : ''}" data-m="${m.id}">${linkify(m.text)}</div>`
      at = m.at
    }
    return { html, at }
  }

  async function openThread(handle, push = true) {
    if (open) clearInterval(open.timer)
    open = { handle, last: 0, at: 0, timer: 0, seen: null, theirs: 0 }
    dm.classList.add('open')
    if (push) history.replaceState(null, '', `/messages?h=${encodeURIComponent(handle)}`)
    for (const b of convs.querySelectorAll('.conv')) b.setAttribute('aria-current', String(b.dataset.h === handle))
    pane.innerHTML = '<div class="spin"></div>'
    let r
    try {
      r = await api('GET', `/social/messages/${encodeURIComponent(handle)}`)
    } catch (e) {
      pane.innerHTML = `<div class="empty" style="margin:auto"><p>${esc(e.message)}</p></div>`
      return
    }
    if (open?.handle !== handle) return
    const canWrite = r.relation === 'connected' && !r.peer.example
    pane.innerHTML = `<div class="dm-head"><button type="button" class="btn ghost small" data-back>Back</button>${who(r.peer, r.peer.headline)}<button class="menu-b" type="button" data-thread-menu aria-label="More" style="margin-left:auto">⋯</button></div>
<div class="dm-msgs" id="msgs"></div>
${
  canWrite
    ? '<form class="say" id="send"><textarea rows="1" maxlength="4000" placeholder="Write a message…" aria-label="Your message"></textarea><button class="btn small" type="submit">Send</button></form>'
    : `<div class="say muted small">${r.peer.example ? 'This is an example profile, made by GMAFJ. It cannot be messaged.' : 'You can message your connections. Connect with them first.'}</div>`
}`
    const msgs = $('#msgs', pane)
    const drawn = bubbles(r.messages, 0)
    msgs.innerHTML = drawn.html || '<p class="muted small" style="margin:auto">Say hello.</p>'
    open.at = drawn.at
    open.last = r.messages.at(-1)?.id ?? 0
    open.theirs = r.messages.filter((m) => !m.mine).at(-1)?.id ?? 0
    seen(r.seenUpTo)
    msgs.scrollTop = msgs.scrollHeight
    $('[data-back]', pane).addEventListener('click', () => {
      dm.classList.remove('open')
      clearInterval(open?.timer)
      open = null
      history.replaceState(null, '', '/messages')
    })
    $('[data-thread-menu]', pane).addEventListener('click', (e) => {
      const items = [['View profile', () => (location.href = profileUrl(r.peer))]]
      if (open?.theirs) items.push(['Report their last message', () => report('message', { id: open.theirs }), true])
      items.push([
        'Block',
        async () => {
          if (!confirm(`Block ${r.peer.name}? Neither of you will see the other, and your connection ends.`)) return
          try {
            await api('POST', `/social/block/${encodeURIComponent(handle)}`)
            location.replace('/messages')
          } catch (x) {
            toast(esc(x.message))
          }
        },
        true
      ])
      popMenu(e.currentTarget, items)
    })
    refreshBadges()

    /** "Seen" under your last message they have read. */
    function seen(upTo) {
      open.seen = upTo
      msgs.querySelector('.msg-seen')?.remove()
      const mine = [...msgs.querySelectorAll('.mine[data-m]')].at(-1)
      if (mine && upTo && +mine.dataset.m <= upTo) mine.insertAdjacentHTML('afterend', '<div class="msg-seen">Seen</div>')
    }

    const form = $('#send', pane)
    if (form) {
      const box = $('textarea', form)
      box.focus()
      box.addEventListener('input', () => {
        box.style.height = 'auto'
        box.style.height = `${Math.min(160, box.scrollHeight)}px`
      })
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          form.requestSubmit()
        }
      })
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const text = box.value.trim()
        if (!text) return
        box.value = ''
        box.style.height = ''
        try {
          const m = await api('POST', `/social/messages/${encodeURIComponent(handle)}`, { text })
          append([m])
          seen(open.seen)
          void loadList()
        } catch (err) {
          box.value = text
          toast(esc(err.message))
        }
      })
    }

    function append(fresh) {
      fresh = fresh.filter((m) => m.id > open.last)
      if (!fresh.length) return
      msgs.querySelector(':scope > p')?.remove()
      const near = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 120
      const d = bubbles(fresh, open.at)
      msgs.insertAdjacentHTML('beforeend', d.html)
      open.at = d.at
      open.last = fresh.at(-1).id
      open.theirs = fresh.filter((m) => !m.mine).at(-1)?.id ?? open.theirs
      if (near || fresh.some((m) => m.mine)) msgs.scrollTop = msgs.scrollHeight
    }

    open.timer = setInterval(async () => {
      if (document.hidden || open?.handle !== handle) return
      try {
        const n = await api('GET', `/social/messages/${encodeURIComponent(handle)}?after=${open.last}`)
        if (n.messages.length) {
          append(n.messages)
          void loadList()
        }
        if (n.seenUpTo !== open.seen || n.messages.length) seen(n.seenUpTo)
      } catch {
        /* the next poll tries again */
      }
    }, 4000)
  }

  convs.addEventListener('click', (e) => {
    const b = e.target.closest('.conv')
    if (b) void openThread(b.dataset.h)
  })

  await loadList()
  setInterval(() => document.hidden || void loadList(), 15_000)
  const asked = param('h')
  if (asked) void openThread(asked, false)
}
