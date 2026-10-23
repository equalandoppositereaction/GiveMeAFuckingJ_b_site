/**
 * Notifications, as Instagram has them. Requests to follow you (a private account's) come first, with
 * Confirm and Delete; then what happened: new followers (with Follow back), likes of your posts and of your
 * profile, comments, replies, mentions, reposts, endorsements, recommendations of your profile, being made a
 * community's admin, and the owner's review of your posts and your profile design. Opening the list reads it.
 */
import { $, ago, api, avatar, esc, LOGO, me, media, on, profileUrl, refreshBadges, relButtons, toast, who } from '/app.js'

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/notifications')
  main.innerHTML = '<div class="page narrow"><div class="page-h"><h1>Notifications</h1></div><div id="requests"></div><div class="card" id="list"><div class="spin"></div></div><div id="more"></div></div>'
  const requests = $('#requests', main)
  const list = $('#list', main)
  const more = $('#more', main)
  let before = null

  async function drawRequests() {
    try {
      const r = await api('GET', '/social/network')
      const row = (p) =>
        `<div class="person" data-asker="${esc(p.handle)}">${who(p, [p.headline, p.followedBy ? `Followed by ${p.followedBy} you follow` : '', ago(p.at)].filter(Boolean).join(' · '))}<span class="row"><button class="btn small" type="button" data-confirm>Confirm</button><button class="btn ghost small" type="button" data-decline>Delete</button></span></div>`
      requests.innerHTML =
        (r.requests.length ? `<section class="card" style="margin-bottom:16px"><div class="sec"><div class="sec-h"><h2>Follow requests</h2><span class="muted small">${r.requests.length}</span></div>${r.requests.map(row).join('')}</div></section>` : '') +
        (r.sent.length
          ? `<details class="card sent-inv" style="margin-bottom:16px"><summary class="sec">Your requests waiting <span class="muted small">${r.sent.length}</span></summary><div class="sec">${r.sent.map((p) => `<div class="person">${who(p, `Asked ${ago(p.at)}`)}${relButtons(p.handle, 'requested', true)}</div>`).join('')}</div></details>`
          : '')
    } catch {
      requests.innerHTML = ''
    }
  }
  requests.addEventListener('click', async (e) => {
    const box = e.target.closest('[data-asker]')
    const yes = e.target.closest('[data-confirm]')
    const no = e.target.closest('[data-decline]')
    if (!box || (!yes && !no)) return
    const h = encodeURIComponent(box.dataset.asker)
    try {
      const r = yes ? await api('POST', `/social/followers/${h}/accept`) : await api('DELETE', `/social/followers/${h}`)
      // Confirmed, they can be followed back, as Instagram offers.
      box.lastElementChild.outerHTML = yes ? relButtons(box.dataset.asker, r.relation, true, { followsYou: true }) : '<span class="muted small">Deleted</span>'
      const n = $('.sec-h .muted', requests)
      if (n) n.textContent = String(Math.max(0, Number(n.textContent) - 1))
      refreshBadges()
    } catch (x) {
      toast(esc(x.message))
    }
  })

  const quote = (t) => (t ? `: “${esc(t.slice(0, 100))}${t.length > 100 ? '…' : ''}”` : '')
  const line = (n) => {
    const who = n.actor ? `<b>${esc(n.actor.name)}</b>` : ''
    const post = n.update ? `/p?id=${n.update.id}` : '/home'
    const person = n.actor ? profileUrl(n.actor) : '/search'
    switch (n.kind) {
      case 'like':
        return [`${who} liked your post${quote(n.update?.text)}`, post]
      case 'comment':
        return [`${who} commented on your post${quote(n.text)}`, `${post}#say`]
      case 'reply':
        return [`${who} replied to your comment${quote(n.text)}`, `${post}#say`]
      case 'mention':
        return [`${who} mentioned you${quote(n.text)}`, post]
      case 'repost':
        return [`${who} reposted your post${quote(n.text)}`, post]
      case 'comment_like':
        return [`${who} liked your comment${quote(n.text)}`, post]
      case 'follow':
      case 'accepted':
        return [`${who} started following you.`, person]
      case 'follow_accepted':
        return [`${who} accepted your request to follow them.`, person]
      case 'endorse':
        return [`${who} endorsed you for ${esc(n.text ?? 'a skill')}.`, profileUrl(me)]
      case 'profile_like':
        return [`${who} liked your profile.`, person]
      case 'recommend':
        return [`${who} recommended your profile to the people who follow them.`, person]
      case 'update_approved':
        return [`Your post was approved, and people can see it in their Home now${quote(n.update?.text)}`, post]
      case 'update_rejected':
        return [`Your post was not approved${n.text ? `. The reviewer said: “${esc(n.text)}”` : '.'} Only you can see it.`, post]
      case 'design_approved':
        return ['Your profile design was approved. It is on your profile now.', profileUrl(me)]
      case 'design_rejected':
        return [`Your profile design was not approved${n.text ? `: ${esc(n.text)}` : '.'}`, '/settings#design']
      case 'group_admin':
        return [`${who} made you an admin of <b>${esc(n.group?.name ?? n.text ?? 'a community')}</b>.`, n.group ? `/messages?g=${n.group.id}` : '/messages?box=communities']
      default:
        return ['Something happened on Oporch.', '/home']
    }
  }

  /** New followers can be followed back from here, as on Instagram. */
  const followBack = (n) => (n.actor && ['follow', 'accepted', 'follow_accepted'].includes(n.kind) && n.relation !== 'following' ? relButtons(n.actor.handle, n.relation ?? 'none', true, { followsYou: n.kind !== 'follow_accepted' }) : '')

  async function load() {
    try {
      const r = await api('GET', `/social/notifications${before ? `?before=${before}` : ''}`)
      if (!before) list.innerHTML = ''
      list.insertAdjacentHTML(
        'beforeend',
        r.notifications
          .map((n) => {
            const [text, href] = line(n)
            const face = n.actor ? avatar(n.actor) : `<span class="av logo-av" aria-hidden="true">${LOGO}</span>`
            return `<div class="note-row${n.read ? '' : ' unread'}"><a class="note-link" href="${href}">${face}<span class="grow">${text} <span class="muted small">${ago(n.at)}</span></span>${
              n.update?.image ? `<img src="${esc(media(n.update.image))}" alt="" class="note-thumb">` : ''
            }</a>${followBack(n)}</div>`
          })
          .join('')
      )
      before = r.notifications.at(-1)?.id ?? before
      if (!list.children.length) list.innerHTML = '<div class="empty"><h2>Nothing yet</h2><p>When people follow you, like your profile or your posts, or comment on them, it shows here.</p></div>'
      more.innerHTML = r.more ? '<div class="center" style="margin-top:16px"><button class="btn ghost" type="button">Show older</button></div>' : ''
      refreshBadges()
    } catch (e) {
      list.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    }
  }
  more.addEventListener('click', (e) => e.target.closest('button') && void load())
  // A request taken back elsewhere: the list follows.
  on('relation', () => void drawRequests())
  await Promise.all([drawRequests(), load()])
}
