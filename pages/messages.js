/**
 * Messages, Instagram's direct messages (the owner, 2026-10-21: "Any one can message anyone but only when
 * the people are following each other that the message will come in inbox, otherwise it will come in
 * requests just like instagram"; and "The messages menu does not have an option to message new people").
 * The conversations on the left, Messages and Requests, with New message; the open one on the right; on a
 * phone, one or the other. /messages?h=<username> opens one, a new one too. A request is accepted, deleted
 * or its writer blocked before it can be answered, and its writer sees no "Seen" until then. An update
 * sent from its Send button shows as a card.
 *
 * Polled, not pushed: the open conversation every 4 seconds while the tab is in view, the list every 15.
 */
import { $, ago, api, avatar, dialog, esc, linkify, me, media, param, popMenu, profileUrl, refreshBadges, report, toast, who } from '/app.js'

const PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'

export default async function ({ main }) {
  if (!me) return void location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
  main.innerHTML = `<div class="dm">
<section class="dm-list" aria-label="Conversations">
<div class="dm-top"><h1>Messages</h1><button class="menu-b" type="button" data-new aria-label="New message" title="New message">${PEN}</button></div>
<div class="feed-tabs dm-tabs" role="tablist" aria-label="Which messages"><button type="button" role="tab" data-box="inbox">Messages</button><button type="button" role="tab" data-box="requests">Requests<span class="tab-count" data-requests></span></button></div>
<div id="convs"><div class="spin"></div></div>
</section>
<section class="dm-thread" aria-label="Conversation"><div class="empty" style="margin:auto"><h2>Your messages</h2><p>Message anyone about jobs, referrals and anything else. People who follow each other land in each other’s inbox; everyone else in their requests.</p><button class="btn" type="button" data-new>New message</button></div></section>
</div>`
  const dm = $('.dm', main)
  const convs = $('#convs', main)
  const pane = $('.dm-thread', main)
  let box = 'inbox'
  let open = null // { handle, last, at, timer, seen, theirs }
  let list = []

  async function loadList() {
    let r
    try {
      r = await api('GET', `/social/messages${box === 'requests' ? '?box=requests' : ''}`)
    } catch (e) {
      convs.innerHTML = `<p class="empty">${esc(e.message)}</p>`
      return
    }
    list = r.conversations
    $('[data-requests]', main).textContent = r.requests ? String(r.requests) : ''
    for (const b of main.querySelectorAll('[data-box]')) b.setAttribute('aria-selected', String(b.dataset.box === box))
    convs.innerHTML = list.length
      ? list
          .map(
            (c) => `<button type="button" class="conv" data-h="${esc(c.peer.handle)}" aria-current="${open?.handle === c.peer.handle}">${avatar(c.peer, 'l')}<div class="who-t grow"><div class="who-n">${esc(c.peer.name)}</div><div class="who-h${c.unread ? ' unread' : ''}">${c.last.mine ? 'You: ' : ''}${esc(c.last.text)} · ${ago(c.last.at)}</div></div>${c.unread ? `<span class="badge" style="position:static">${c.unread}</span>` : ''}</button>`
          )
          .join('')
      : box === 'requests'
        ? '<p class="muted small" style="padding:0 20px">No requests. Messages from people you do not follow each other with wait here, until you accept them.</p>'
        : '<p class="muted small" style="padding:0 20px">No conversations yet. Press the pen to message someone.</p>'
  }

  const stamp = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  /** An update sent in a message, as a card: one link, so nothing in it may be a link of its own. */
  const embed = (u) =>
    u.gone
      ? '<div class="msg-embed muted small">This update is not available.</div>'
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
    // A request: they wrote, and you have not accepted it (you do not follow each other).
    const asking = r.box === 'requests' && r.messages.some((m) => !m.mine)
    const theirs = r.theirBox === 'requests' && !asking
    pane.innerHTML = `<div class="dm-head"><button type="button" class="btn ghost small" data-back>Back</button>${who({ ...r.peer, followsYou: r.followsYou }, r.peer.headline)}<button class="menu-b" type="button" data-thread-menu aria-label="More" style="margin-left:auto">⋯</button></div>
${theirs ? `<div class="dm-note muted small">Your messages go to ${esc(r.peer.name)}’s message requests, until they accept or you follow each other.</div>` : ''}
<div class="dm-msgs" id="msgs"></div>
${
  asking
    ? `<div class="dm-ask"><p><b>${esc(r.peer.name)}</b> wants to send you a message. ${r.followsYou ? 'They follow you.' : 'You do not follow each other.'} They will not see that you read it until you accept.</p><div class="row wrap"><button class="btn" type="button" data-accept-dm>Accept</button><button class="btn ghost" type="button" data-delete-dm>Delete</button><button class="btn ghost" type="button" data-block-dm>Block</button></div></div>`
    : '<form class="say" id="send"><textarea rows="1" maxlength="4000" placeholder="Write a message…" aria-label="Your message"></textarea><button class="btn small" type="submit">Send</button></form>'
}`
    const msgs = $('#msgs', pane)
    const drawn = bubbles(r.messages, 0)
    msgs.innerHTML = drawn.html || `<div class="dm-hello">${avatar(r.peer, 'xl')}<b>${esc(r.peer.name)}</b><span class="muted small">@${esc(r.peer.handle)}</span><a class="btn ghost small" href="${profileUrl(r.peer)}">View profile</a></div>`
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
    const block = async () => {
      if (!confirm(`Block ${r.peer.name}? Neither of you will see the other, and neither follows the other any more.`)) return
      try {
        await api('POST', `/social/block/${encodeURIComponent(handle)}`)
        location.replace('/messages')
      } catch (x) {
        toast(esc(x.message))
      }
    }
    const remove = async () => {
      if (!confirm('Delete this conversation? It goes from your messages only; they keep theirs.')) return
      try {
        await api('DELETE', `/social/messages/${encodeURIComponent(handle)}`)
        location.replace('/messages')
      } catch (x) {
        toast(esc(x.message))
      }
    }
    $('[data-thread-menu]', pane).addEventListener('click', (e) => {
      const items = [['View profile', () => (location.href = profileUrl(r.peer))]]
      if (r.messages.length) items.push(['Delete conversation', () => void remove(), true])
      if (open?.theirs) items.push(['Report their last message', () => report('message', { id: open.theirs }), true])
      items.push(['Block', () => void block(), true])
      popMenu(e.currentTarget, items)
    })
    $('[data-accept-dm]', pane)?.addEventListener('click', async () => {
      try {
        await api('POST', `/social/messages/${encodeURIComponent(handle)}/accept`)
        box = 'inbox'
        await loadList()
        void openThread(handle, false)
        refreshBadges()
      } catch (x) {
        toast(esc(x.message))
      }
    })
    $('[data-delete-dm]', pane)?.addEventListener('click', () => void remove())
    $('[data-block-dm]', pane)?.addEventListener('click', () => void block())
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
      const text = $('textarea', form)
      text.focus()
      text.addEventListener('input', () => {
        text.style.height = 'auto'
        text.style.height = `${Math.min(160, text.scrollHeight)}px`
      })
      text.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          form.requestSubmit()
        }
      })
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const words = text.value.trim()
        if (!words) return
        text.value = ''
        text.style.height = ''
        try {
          const m = await api('POST', `/social/messages/${encodeURIComponent(handle)}`, { text: words })
          msgs.querySelector('.dm-hello')?.remove()
          append([m])
          seen(open.seen)
          void loadList()
        } catch (err) {
          text.value = words
          toast(esc(err.message))
        }
      })
    }

    function append(fresh) {
      fresh = fresh.filter((m) => m.id > open.last)
      if (!fresh.length) return
      msgs.querySelector('.dm-hello')?.remove()
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

  /** New message: anyone, found by name or username; the people you follow first, as Instagram suggests. */
  async function newMessage() {
    const { el, close } = dialog(`<div class="dialog-h"><h2>New message</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b stack"><label class="row new-to"><b>To:</b><input class="input" data-find placeholder="Search by name or username" autocomplete="off"></label><div data-people><div class="spin"></div></div></div>`)
    let following = []
    try {
      following = (await api('GET', `/social/u/${encodeURIComponent(me.handle)}/following`)).people
    } catch {
      following = []
    }
    const draw = (people, heading) => {
      $('[data-people]', el).innerHTML =
        (heading && people.length ? `<p class="muted small" style="margin-bottom:4px">${heading}</p>` : '') +
          people
            .slice(0, 40)
            .map((p) => `<button type="button" class="person pick" data-pick="${esc(p.handle)}">${who(p, `@${p.handle}`)}</button>`)
            .join('') || `<p class="muted small">${heading ? 'Search for someone to message.' : 'Nobody by that name.'}</p>`
    }
    draw(following, 'People you follow')
    let typing = 0
    $('[data-find]', el).addEventListener('input', (e) => {
      clearTimeout(typing)
      const q = e.target.value.trim()
      typing = setTimeout(async () => {
        if (!q) return draw(following, 'People you follow')
        try {
          draw((await api('GET', `/social/search?q=${encodeURIComponent(q)}`)).people)
        } catch (x) {
          $('[data-people]', el).innerHTML = `<p class="err">${esc(x.message)}</p>`
        }
      }, 250)
    })
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]')
      if (!b) return
      close()
      box = 'inbox'
      void loadList()
      void openThread(b.dataset.pick)
    })
  }

  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return void newMessage()
    const tabBtn = e.target.closest('[data-box]')
    if (tabBtn && tabBtn.dataset.box !== box) {
      box = tabBtn.dataset.box
      void loadList()
    }
  })
  convs.addEventListener('click', (e) => {
    const b = e.target.closest('.conv')
    if (b) void openThread(b.dataset.h)
  })

  const asked = param('h')
  await loadList()
  setInterval(() => document.hidden || void loadList(), 15_000)
  if (asked) {
    // A conversation asked for that waits in the requests: show that list beside it.
    if (!list.some((c) => c.peer.handle === asked)) {
      const r = await api('GET', '/social/messages?box=requests').catch(() => null)
      if (r?.conversations.some((c) => c.peer.handle === asked)) {
        box = 'requests'
        await loadList()
      }
    }
    void openThread(asked, false)
  }
}
