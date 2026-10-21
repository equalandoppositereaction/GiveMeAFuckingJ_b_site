/**
 * Communities (the owner, 2026-10-21: "Add a community making feature aswell, where the group creator can
 * make admins, and the admins can decide who can message in the group and during the creation of the group
 * also decide if everyone joining can message or only admins can"). Laid out as Messages: your communities
 * and Discover on the left, with New community; the open one on the right; on a phone, one or the other.
 * /groups?id=<id> opens one.
 *
 * Making one asks who may write in it: everyone who joins, or only admins. In it, its creator makes and
 * unmakes admins (Members), and its admins let a member write or stop them, change who may write, rename it
 * and remove members (server: social/groups.ts). Polled, as Messages: the open one every 4 seconds while
 * the tab is in view, the list every 15.
 */
import { $, ago, api, avatar, dialog, esc, linkify, me, param, plural, popMenu, profileUrl, refreshBadges, toast } from '/app.js'

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

/** A community's face: its initials on a rounded square. */
const gav = (name, size = 'l') => `<span class="av ${size} i gav" aria-hidden="true">${esc(String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] ?? '').join(''))}</span>`
const ROLE = { owner: 'Owner', admin: 'Admin' }

export default async function ({ main }) {
  if (!me) return void location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
  main.innerHTML = `<div class="dm">
<section class="dm-list" aria-label="Communities">
<div class="dm-top"><h1>Communities</h1><button class="menu-b" type="button" data-new aria-label="New community" title="New community">${PLUS}</button></div>
<div class="feed-tabs dm-tabs" role="tablist" aria-label="Which communities"><button type="button" role="tab" data-tab="mine">Yours</button><button type="button" role="tab" data-tab="discover">Discover</button></div>
<div class="g-find" hidden><input class="input" type="search" placeholder="Search communities" aria-label="Search communities" autocomplete="off"></div>
<div id="groups"><div class="spin"></div></div>
</section>
<section class="dm-thread" aria-label="Community"><div class="empty" style="margin:auto"><h2>Communities</h2><p>Talk about jobs with people who do what you do: openings, referrals, interviews. Join one, or make your own and choose who can write in it.</p><button class="btn" type="button" data-new>New community</button></div></section>
</div>`
  const dm = $('.dm', main)
  const listEl = $('#groups', main)
  const pane = $('.dm-thread', main)
  const find = $('.g-find', main)
  let tab = 'mine'
  let open = null // { id, last, at, timer, group }
  let q = ''

  async function loadList() {
    let r
    try {
      r = await api('GET', `/social/groups${q && tab === 'discover' ? `?q=${encodeURIComponent(q)}` : ''}`)
    } catch (e) {
      listEl.innerHTML = `<p class="empty">${esc(e.message)}</p>`
      return
    }
    for (const b of main.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab))
    find.hidden = tab !== 'discover'
    const items = tab === 'mine' ? r.mine : r.discover
    listEl.innerHTML = items.length
      ? items
          .map((g) => {
            const line =
              tab === 'mine'
                ? g.last
                  ? `${g.last.mine ? 'You' : esc(g.last.name)}: ${esc(g.last.text)} · ${ago(g.last.at)}`
                  : `${plural(g.members, 'member')}`
                : `${plural(g.members, 'member')}${g.friends ? ` · ${plural(g.friends, 'person', 'people')} you follow` : ''}`
            return `<button type="button" class="conv" data-g="${g.id}" aria-current="${open?.id === g.id}">${gav(g.name)}<div class="who-t grow"><div class="who-n">${esc(g.name)}</div><div class="who-h${g.unread ? ' unread' : ''}">${line}</div></div>${g.unread ? `<span class="badge" style="position:static">${g.unread}</span>` : ''}</button>`
          })
          .join('')
      : tab === 'mine'
        ? '<p class="muted small" style="padding:0 20px">You are in no community yet. Find one in Discover, or make one with the plus.</p>'
        : `<p class="muted small" style="padding:0 20px">${q ? 'No community by that name.' : 'No communities to join yet. Make the first.'}</p>`
  }

  const stamp = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  /** Messages as a group chat: a time between pauses, and someone else's name over their first message in a row. */
  function bubbles(msgs, prev) {
    let html = ''
    let { at, by } = prev
    for (const m of msgs) {
      if (!at || m.at - at > 30 * 60 * 1000) {
        html += `<div class="msg-t">${stamp(m.at)}</div>`
        by = null
      }
      const who = m.author?.handle ?? ''
      if (!m.mine && who !== by) {
        html += `<div class="g-by"><a href="${m.author ? profileUrl(m.author) : '#'}">${avatar(m.author, 'xs')}<b>${esc(m.author?.name ?? 'Deleted account')}</b></a>${ROLE[m.role] ? `<span class="chip">${ROLE[m.role]}</span>` : ''}</div>`
      }
      html += `<div class="msg${m.mine ? ' mine' : ''}" data-m="${m.id}">${linkify(m.text)}</div>`
      at = m.at
      by = m.mine ? null : who
    }
    return { html, at, by }
  }

  /** What can be written here, from where you stand: the box, or why not. */
  const footer = (g) => {
    if (!g.role) return `<div class="dm-ask"><p>${g.about ? esc(g.about) : `Made by ${esc(g.owner?.name ?? 'someone')}.`}</p><div class="row wrap"><button class="btn" type="button" data-join>Join</button><span class="muted small">${g.whoPosts === 'admins' ? 'Only its admins write in it.' : 'Everyone who joins can write in it.'}</span></div></div>`
    if (g.canPost) return '<form class="say" id="send"><textarea rows="1" maxlength="4000" placeholder="Write to the community…" aria-label="Your message"></textarea><button class="btn small" type="submit">Send</button></form>'
    return `<div class="dm-note muted small" style="border-top:1px solid var(--border);border-bottom:0">${g.stopped ? 'An admin turned off your messages in this community.' : 'Only admins can write in this community.'}</div>`
  }

  async function openGroup(id, push = true) {
    if (open) clearInterval(open.timer)
    open = { id, last: 0, at: 0, by: null, timer: 0, group: null }
    dm.classList.add('open')
    if (push) history.replaceState(null, '', `/groups?id=${id}`)
    for (const b of listEl.querySelectorAll('.conv')) b.setAttribute('aria-current', String(+b.dataset.g === id))
    pane.innerHTML = '<div class="spin"></div>'
    let r
    try {
      r = await api('GET', `/social/groups/${id}`)
    } catch (e) {
      pane.innerHTML = `<div class="empty" style="margin:auto"><p>${esc(e.message)}</p></div>`
      return
    }
    if (open?.id !== id) return
    const g = (open.group = r.group)
    pane.innerHTML = `<div class="dm-head"><button type="button" class="btn ghost small" data-back>Back</button><div class="who">${gav(g.name, 's')}<div class="who-t"><div class="who-n">${esc(g.name)}</div><div class="who-h">${plural(g.members, 'member')}${ROLE[g.role] ? ` · You are ${ROLE[g.role] === 'Owner' ? 'its owner' : 'an admin'}` : ''}</div></div></div>
<button class="btn ghost small" type="button" data-members style="margin-left:auto">Members</button><button class="menu-b" type="button" data-group-menu aria-label="More">⋯</button></div>
<div class="dm-msgs" id="msgs"></div>
${footer(g)}`
    const msgs = $('#msgs', pane)
    const drawn = bubbles(r.messages, { at: 0, by: null })
    msgs.innerHTML = drawn.html || `<div class="dm-hello">${gav(g.name, 'xl')}<b>${esc(g.name)}</b>${g.about ? `<span class="muted small" style="max-width:420px">${esc(g.about)}</span>` : ''}<span class="muted small">${g.whoPosts === 'admins' ? 'Only admins write here.' : 'Everyone who joins can write here.'}</span></div>`
    Object.assign(open, { at: drawn.at, by: drawn.by, last: r.messages.at(-1)?.id ?? 0 })
    msgs.scrollTop = msgs.scrollHeight
    refreshBadges()
    void loadList()

    $('[data-back]', pane).addEventListener('click', () => {
      dm.classList.remove('open')
      clearInterval(open?.timer)
      open = null
      history.replaceState(null, '', '/groups')
    })
    $('[data-members]', pane).addEventListener('click', () => void members(g))
    $('[data-group-menu]', pane).addEventListener('click', (e) => {
      const items = [['Copy link', () => navigator.clipboard?.writeText(`${location.origin}/groups?id=${g.id}`).then(() => toast('Link copied.'))]]
      if (ROLE[g.role]) items.push(['Settings', () => void settings(g)])
      if (g.role && g.role !== 'owner') items.push(['Leave community', () => void leave(g), true])
      if (g.role === 'owner' || g.siteAdmin) items.push(['Delete community', () => void remove(g), true])
      popMenu(e.currentTarget, items)
    })
    $('[data-join]', pane)?.addEventListener('click', async () => {
      try {
        await api('POST', `/social/groups/${g.id}/join`)
        tab = 'mine'
        void openGroup(g.id, false)
      } catch (x) {
        toast(esc(x.message))
      }
    })

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
          append([await api('POST', `/social/groups/${g.id}/messages`, { text: words })])
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
      const d = bubbles(fresh, open)
      msgs.insertAdjacentHTML('beforeend', d.html)
      Object.assign(open, { at: d.at, by: d.by, last: fresh.at(-1).id })
      if (near || fresh.some((m) => m.mine)) msgs.scrollTop = msgs.scrollHeight
    }

    open.timer = setInterval(async () => {
      if (document.hidden || open?.id !== id) return
      try {
        const n = await api('GET', `/social/groups/${id}?after=${open.last}`)
        append(n.messages)
        // Who may write changed (an admin let them, or stopped them): the box follows.
        if (n.group.canPost !== open.group.canPost || n.group.role !== open.group.role) void openGroup(id, false)
      } catch {
        /* the next poll tries again */
      }
    }, 4000)
  }

  /** Its members: the owner, admins, then everyone; with what an admin (or its owner) can do to each. */
  async function members(g) {
    const { el } = dialog(`<div class="dialog-h"><h2>Members</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b" data-list><div class="spin"></div></div>`, 'small')
    const listBox = $('[data-list]', el)
    let people = []
    const draw = () => {
      listBox.innerHTML =
        people
          .map(
            (p) => `<div class="person" data-p="${esc(p.handle)}"><div class="who"><a href="${profileUrl(p)}" tabindex="-1">${avatar(p)}</a><div class="who-t"><div class="who-n"><a href="${profileUrl(p)}">${esc(p.name)}</a>${ROLE[p.role] ? `<span class="chip">${ROLE[p.role]}</span>` : ''}</div><div class="who-h">${
              p.role === 'member' ? (p.canPost ? (p.said === true ? 'Can write: an admin allowed it' : 'Can write') : p.said === false ? 'Cannot write: an admin stopped it' : 'Cannot write: admins only') : '@' + esc(p.handle)
            }</div></div></div>${ROLE[g.role] && !p.me && p.role !== 'owner' ? '<button class="menu-b" type="button" data-pmenu aria-label="What to do">⋯</button>' : ''}</div>`
          )
          .join('') || '<p class="muted">Nobody yet.</p>'
    }
    const load = async () => {
      try {
        people = (await api('GET', `/social/groups/${g.id}/members`)).members
        draw()
      } catch (e) {
        listBox.innerHTML = `<p class="err">${esc(e.message)}</p>`
      }
    }
    await load()
    const change = async (p, body) => {
      try {
        Object.assign(p, await api('POST', `/social/groups/${g.id}/members/${encodeURIComponent(p.handle)}`, body))
        draw()
      } catch (x) {
        toast(esc(x.message))
      }
    }
    listBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pmenu]')
      const p = b && people.find((x) => x.handle === b.closest('[data-p]').dataset.p)
      if (!p) return
      const items = []
      if (g.role === 'owner') items.push(p.role === 'admin' ? ['Remove as admin', () => void change(p, { role: 'member' })] : ['Make admin', () => void change(p, { role: 'admin' })])
      if (p.role === 'member') {
        items.push(p.canPost ? ['Stop them writing', () => void change(p, { canPost: false })] : ['Let them write', () => void change(p, { canPost: true })])
        if (p.said !== null) items.push([`Back to the community’s rule (${g.whoPosts === 'admins' ? 'admins only' : 'everyone'})`, () => void change(p, { canPost: null })])
      }
      if (p.role === 'member' || g.role === 'owner')
        items.push([
          'Remove from community',
          async () => {
            if (!confirm(`Remove ${p.name} from ${g.name}?`)) return
            try {
              await api('DELETE', `/social/groups/${g.id}/members/${encodeURIComponent(p.handle)}`)
              people = people.filter((x) => x !== p)
              draw()
            } catch (x) {
              toast(esc(x.message))
            }
          },
          true
        ])
      popMenu(b, items)
    })
  }

  /** Who may write, as the admins say, and its name and what it is about. */
  const whoField = (value) => `<fieldset class="stack" style="gap:8px"><legend class="small" style="font-weight:600;margin-bottom:6px">Who can write in it</legend>
<label class="check"><input type="radio" name="who" value="everyone"${value === 'everyone' ? ' checked' : ''}><span>Everyone who joins<br><span class="muted small">Admins can still stop someone.</span></span></label>
<label class="check"><input type="radio" name="who" value="admins"${value === 'admins' ? ' checked' : ''}><span>Only admins<br><span class="muted small">Admins can still let someone write.</span></span></label></fieldset>`
  function form(title, g, go) {
    const { el, close } = dialog(`<div class="dialog-h"><h2>${title}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b stack"><label class="field"><span>Name</span><input class="input" maxlength="80" required value="${esc(g?.name ?? '')}" placeholder="For example: Data jobs in Pune"></label>
<label class="field"><span>What it is about</span><textarea class="textarea" maxlength="500" style="min-height:80px" placeholder="Optional">${esc(g?.about ?? '')}</textarea></label>
${whoField(g?.whoPosts ?? 'everyone')}<p class="err" hidden></p></div>
<div class="dialog-f"><button class="btn" type="button" data-go>${g ? 'Save' : 'Create community'}</button></div>`)
    const err = $('.err', el)
    const button = $('[data-go]', el)
    button.addEventListener('click', async () => {
      button.disabled = true
      err.hidden = true
      try {
        await go({ name: $('input.input', el).value.trim(), about: $('textarea', el).value.trim(), whoPosts: $('input[name=who]:checked', el).value })
        close()
      } catch (x) {
        err.textContent = x.message
        err.hidden = false
        button.disabled = false
      }
    })
  }
  const create = () =>
    form('New community', null, async (body) => {
      const g = await api('POST', '/social/groups', body)
      tab = 'mine'
      await loadList()
      void openGroup(g.id)
    })
  const settings = (g) =>
    form('Community settings', g, async (body) => {
      await api('PATCH', `/social/groups/${g.id}`, body)
      void openGroup(g.id, false)
    })
  async function leave(g) {
    if (!confirm(`Leave ${g.name}?`)) return
    try {
      await api('DELETE', `/social/groups/${g.id}/join`)
      void openGroup(g.id, false)
    } catch (x) {
      toast(esc(x.message))
    }
  }
  async function remove(g) {
    if (!confirm(`Delete ${g.name}, with all its messages? This cannot be undone.`)) return
    try {
      await api('DELETE', `/social/groups/${g.id}`)
      location.replace('/groups')
    } catch (x) {
      toast(esc(x.message))
    }
  }

  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return void create()
    const t = e.target.closest('[data-tab]')
    if (t && t.dataset.tab !== tab) {
      tab = t.dataset.tab
      void loadList()
    }
  })
  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('.conv')
    if (b) void openGroup(+b.dataset.g)
  })
  let typing = 0
  $('input', find).addEventListener('input', (e) => {
    clearTimeout(typing)
    typing = setTimeout(() => {
      q = e.target.value.trim()
      void loadList()
    }, 250)
  })

  await loadList()
  setInterval(() => document.hidden || void loadList(), 15_000)
  const asked = Number(param('id'))
  if (asked) void openGroup(asked, false)
}
