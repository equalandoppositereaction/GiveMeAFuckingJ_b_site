/**
 * A profile, /u?h=<username>, as LinkedIn lays one out (the owner, 2026-10-08: "the profile should be like
 * linkedin"): the top card (cover, photo with its #OpenToWork or #Hiring ring, name, pronouns, headline,
 * place, contact info, connections and followers, the buttons), then Featured, About, Activity,
 * Experience, Education, Licenses and certifications, Projects, Volunteering, Skills (endorsed by
 * connections), Recommendations, Honors and awards, Languages; people you may know beside it.
 *
 * A member's own design (Settings, "Design your profile"), once approved, takes the page: the buttons
 * stay in a bar above it, and the Activity under it unless the design shows the updates itself.
 *
 * Visitors without an account see a profile its owner left public.
 */
import { $, api, avatar, dialog, DEGREE, esc, exampleTag, me, media, param, personRow, plural, popMenu, postHtml, profileUrl, relButtons, report, requireLogin, share, toast } from '/app.js'
import { mountDesign, openLine, profileParts, showsPosts } from '/design.js'

export default async function ({ main }) {
  const handle = param('h') || me?.handle
  if (!handle) return void location.replace(`/login?next=${encodeURIComponent('/u')}`)
  main.innerHTML = '<div class="spin"></div>'
  let p
  try {
    p = await api('GET', `/social/u/${encodeURIComponent(handle)}`)
  } catch (e) {
    const next = encodeURIComponent(location.pathname + location.search)
    main.innerHTML =
      e.code === 'members_only'
        ? `<div class="empty"><h2>This profile is for members</h2><p>Log in to see it.</p><a class="btn" href="/login?next=${next}">Log in</a></div>`
        : `<div class="empty"><h2>${e.status === 404 ? 'There is no one by that username' : 'This profile could not load'}</h2><p>${esc(e.message)}</p></div>`
    return
  }
  document.title = `${p.name}${p.headline ? ` | ${p.headline}` : ''} | GMAFJ`
  const self = p.relation === 'self'
  const h = encodeURIComponent(p.handle)
  // The menu's Profile is yours: it is not lit on someone else's.
  if (!self) for (const a of document.querySelectorAll('[data-nav=profile]')) a.removeAttribute('aria-current')

  const parts = profileParts(p)
  const actions = self
    ? `<a class="btn" href="/settings#profile">Edit profile</a><a class="btn line" href="/settings#design">Design your profile</a><button class="btn line" type="button" data-more aria-label="More">More</button>`
    : `${relButtons(p.handle, p.relation, false, { example: p.example, following: me && !p.example ? p.following : undefined })}<button class="btn line" type="button" data-more aria-label="More">More</button>`
  const nameLine = `<h1>${esc(p.name)}</h1>${p.pronouns ? `<span class="muted">(${esc(p.pronouns)})</span>` : ''}${exampleTag(p)}${p.degree ? `<span class="deg">· ${DEGREE[p.degree]}</span>` : ''}`
  const example = p.example ? '<section class="card pad note-card">This is an example profile, made by GMAFJ to show what a profile can be. It is not a real person, so it cannot be connected to, followed or messaged.</section>' : ''

  const section = (title, body, extra = '') => (body ? `<section class="card li-sec"><div class="sec-h"><h2>${title}</h2>${extra}</div>${body}</section>` : '')
  const canEndorse = p.relation === 'connected'
  const skills = p.skills.length
    ? p.skills
        .map(
          (s) => `<div class="skill-row" data-skill="${esc(s.name)}"><div class="grow"><b>${esc(s.name)}</b>${
            s.endorsements ? `<div class="faces">${s.faces.length ? `<span class="stack-av">${s.faces.map((f) => avatar(f, 'xs')).join('')}</span>` : ''}<span>${plural(s.endorsements, 'endorsement')}</span></div>` : ''
          }</div>${canEndorse ? `<button class="btn ${s.endorsed ? 'ghost' : 'line'} small" type="button" data-endorse aria-pressed="${s.endorsed}">${s.endorsed ? 'Endorsed' : 'Endorse'}</button>` : ''}</div>`
        )
        .join('')
    : ''
  const recs = p.recommendations
    .map(
      (r) => `<div class="rec-row">${r.author ? `<a href="${profileUrl(r.author)}">${avatar(r.author)}</a>` : ''}<div class="grow"><div class="who-n">${r.author ? `<a href="${profileUrl(r.author)}">${esc(r.author.name)}</a>${exampleTag(r.author)}` : 'Deleted account'}</div>${
        r.author?.headline ? `<div class="who-h">${esc(r.author.headline)}</div>` : ''
      }<div class="muted small">${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(r.relationship)}</div><p class="pre" style="margin-top:8px">${esc(r.text)}</p></div></div>`
    )
    .join('')
  const writeRec = canEndorse && !p.example ? '<button class="btn line small" type="button" data-recommend>Write a recommendation</button>' : ''
  const activity = `<section class="card li-sec" id="activity"><div class="sec-h"><div><h2>Activity</h2><div class="muted small">${plural(p.counts.followers, 'follower')}</div></div>${
    self ? '<button class="btn line small" type="button" data-act="create">Create an update</button>' : ''
  }</div><div id="updates" class="stack"><div class="spin"></div></div><div id="updates-more"></div></section>`

  const standard = `${example}<section class="card li-top">
<div class="li-cover"></div>
<div class="li-head">
<div class="li-photo">${avatar(p, 'xl')}</div>
<div class="li-name">${nameLine}</div>
${p.headline ? `<p class="li-headline">${esc(p.headline)}</p>` : ''}
<p class="li-meta">${p.location ? `${esc(p.location)} · ` : ''}<button type="button" class="link" data-contact>Contact info</button></p>
<p class="li-meta"><button type="button" class="link" data-list="connections">${plural(p.counts.connections, 'connection')}</button> · <button type="button" class="link" data-list="followers">${plural(p.counts.followers, 'follower')}</button>${
    p.mutual ? ` · <span>${plural(p.mutual, 'mutual connection')}</span>` : ''
  }</p>
${p.openToWork ? `<div class="otw"><b>${esc(openLine(p.openToWork))}</b>${p.openToWork.start === 'now' ? '<div class="muted small">Can start now</div>' : ''}</div>` : ''}
${p.hiring ? `<div class="otw hiring"><b>Hiring</b><div class="muted small">${esc(p.name)} is hiring. Send a message to ask about the role.</div></div>` : ''}
<div class="row wrap li-actions">${actions}</div>
</div>
</section>
${section('Featured', p.featured.map(postHtml).join(''))}
${section('About', p.about ? `<p class="pre">${esc(p.about)}</p>` : '')}
${activity}
${section('Experience', parts.experience)}
${section('Education', parts.education)}
${section('Licenses and certifications', parts.certifications)}
${section('Projects', parts.projects)}
${section('Volunteering', parts.volunteering)}
${section('Skills', skills)}
${section('Recommendations', recs || (writeRec ? `<p class="muted">${esc(p.name)} has no recommendations yet.</p>` : ''), writeRec)}
${section('Honors and awards', parts.honors)}
${section('Languages', parts.languages)}
${
  self && !p.about && !p.experience.length && !p.education.length && !p.skills.length
    ? '<section class="card li-sec"><h2>Your profile is empty</h2><p class="muted">Add an About, your experience, education and skills so people know you, or fill it in from the GMAFJ app.</p><p style="margin-top:12px"><a class="btn" href="/settings#profile">Fill in your profile</a></p></section>'
    : ''
}`

  // A design of their own: the buttons in a bar above it (the frame cannot hold them).
  const designed = () => `${example}<section class="card li-bar">${avatar(p, 'l')}<div class="grow"><div class="who-n">${nameLine.replace(/<\/?h1>/g, '')}</div>${p.headline ? `<div class="who-h">${esc(p.headline)}</div>` : ''}<div class="li-meta small"><button type="button" class="link" data-contact>Contact info</button> · <button type="button" class="link" data-list="connections">${plural(p.counts.connections, 'connection')}</button> · <button type="button" class="link" data-list="followers">${plural(p.counts.followers, 'follower')}</button></div></div><div class="row wrap li-actions">${actions}</div></section>
<div id="design" class="design-box"></div>
${showsPosts(p.design.html) ? '' : activity}`

  main.innerHTML = `<div class="li${p.design ? ' designed' : ''}">
<div class="li-main">${p.design ? designed() : standard}</div>
<aside class="li-aside" id="aside"></aside>
</div>`
  if (p.cover && !p.design) $('.li-cover', main).style.backgroundImage = `url("${media(p.cover)}")`

  // ── Activity: their latest updates, all of them on request.
  const box = $('#updates', main)
  const moreBox = $('#updates-more', main)
  let got = []
  let cursor = null
  let more = false
  let all = false
  async function loadUpdates() {
    const r = await api('GET', `/social/u/${h}/updates${cursor ? `?before=${cursor}` : ''}`)
    got = got.concat(r.updates)
    cursor = r.updates.at(-1)?.id ?? cursor
    more = r.more
    return r.updates
  }
  function drawUpdates() {
    if (!box) return
    const shown = all ? got : got.slice(0, 3)
    box.innerHTML =
      shown.map(postHtml).join('') ||
      (self ? '<p class="muted">You have not shared an update yet.</p>' : `<p class="muted">${esc(p.name)} has not shared an update yet.</p>`)
    moreBox.innerHTML = (!all && (got.length > 3 || more)) || (all && more) ? `<button class="btn ghost wide" type="button" data-all style="margin-top:12px">${all ? 'Show more' : 'Show all activity'}</button>` : ''
  }

  if (p.design) {
    // A design that shows the updates gets them before it is drawn.
    if (showsPosts(p.design.html)) await loadUpdates().catch(() => {})
    mountDesign($('#design', main), p.design, p, got)
  }
  if (box) {
    loadUpdates()
      .then(drawUpdates)
      .catch((e) => (box.innerHTML = `<p class="muted">${esc(e.message)}</p>`))
  }

  // ── Beside it: who viewed your profile, people you may know; for a visitor, the way in.
  const aside = $('#aside', main)
  if (me) {
    const cards = []
    if (self) {
      cards.push(
        api('GET', '/social/me/views')
          .then((v) => `<section class="card li-sec"><h2>Who viewed your profile</h2><p><b>${plural(v.total, 'profile view')}</b> <span class="muted small">in the past 90 days</span></p><p class="muted small">${plural(v.week, 'view')} this week</p><p style="margin-top:10px"><a class="textbtn" href="/views">See who viewed</a></p></section>`)
          .catch(() => '')
      )
    }
    cards.push(
      api('GET', '/social/suggestions?limit=6')
        .then((r) => {
          const people = r.people.filter((x) => x.handle !== p.handle).slice(0, 5)
          return people.length ? `<section class="card li-sec"><div class="sec-h"><h2>People you may know</h2><a class="textbtn" href="/search">See all</a></div>${people.map((x) => personRow(x, 'none', x.reason)).join('')}</section>` : ''
        })
        .catch(() => '')
    )
    Promise.all(cards).then((html) => (aside.innerHTML = html.join('')))
  } else {
    const next = encodeURIComponent(location.pathname + location.search)
    aside.innerHTML = `<section class="card li-sec"><h2>${esc(p.name)} is on GMAFJ</h2><p class="muted">Join to connect with ${esc(p.name)}, apply to jobs with one click and see which jobs your connections apply to.</p><div class="stack" style="margin-top:14px"><a class="btn" href="/login?new=1&next=${next}">Join GMAFJ</a><a class="btn ghost" href="/login?next=${next}">Log in</a></div></section>`
  }

  // ── The buttons

  async function people(which) {
    if (!requireLogin('Log in to see their connections.')) return
    const title = which === 'connections' ? 'Connections' : 'Followers'
    const { el } = dialog(`<div class="dialog-h"><h2>${title}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b"><div class="spin"></div></div>`, 'small')
    try {
      const r = await api('GET', `/social/u/${h}/${which}`)
      const list = r.connections ?? r.people
      $('.dialog-b', el).innerHTML = list.map((x) => personRow(x, x.relation, x.mutual ? plural(x.mutual, 'mutual connection') : x.headline)).join('') || `<p class="muted">No ${title.toLowerCase()} yet.</p>`
    } catch (e) {
      $('.dialog-b', el).innerHTML = `<p class="muted">${esc(e.message)}</p>`
    }
  }

  function contact() {
    const url = `${location.origin}/u?h=${h}`
    const row = (label, value) => `<div class="contact-row"><div class="muted small">${label}</div>${value}</div>`
    dialog(
      `<div class="dialog-h"><h2>${esc(p.name)}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b stack">
${row('Profile', `<a class="link" href="${esc(url)}">${esc(url.replace(/^https?:\/\//, ''))}</a>`)}
${p.contact.website ? row('Website', `<a class="link" href="${esc(p.contact.website)}" target="_blank" rel="noopener nofollow ugc">${esc(p.contact.website.replace(/^https?:\/\//, ''))}</a>`) : ''}
${p.contact.email ? row('Email', `<a class="link" href="mailto:${esc(p.contact.email)}">${esc(p.contact.email)}</a>`) : ''}
${p.joined ? row('Joined', esc(new Date(p.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))) : ''}
</div>`,
      'small'
    )
  }

  function recommend() {
    const { el, close } = dialog(`<div class="dialog-h"><h2>Recommend ${esc(p.name)}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div>
<div class="dialog-b stack">
<label class="field"><span>How do you know ${esc(p.name)}?</span><input maxlength="120" data-rel-how placeholder="Ex: I managed ${esc(p.name)} directly at Acme"></label>
<label class="field"><span>Your recommendation</span><textarea maxlength="3000" data-rel-text placeholder="What is ${esc(p.name)} great at? What was it like to work together?"></textarea></label>
<p class="muted small">${esc(p.name)} decides whether it shows on their profile.</p><p class="err" hidden></p></div>
<div class="dialog-f"><button class="btn" type="button" data-go>Send</button></div>`)
    $('[data-go]', el).addEventListener('click', async () => {
      try {
        await api('POST', `/social/u/${h}/recommend`, { relationship: $('[data-rel-how]', el).value, text: $('[data-rel-text]', el).value })
        close()
        toast(`Sent. ${esc(p.name)} chooses whether to show it.`)
      } catch (x) {
        const err = $('.err', el)
        err.textContent = x.message
        err.hidden = false
      }
    })
  }

  async function block() {
    if (!confirm(`Block ${p.name}? Neither of you will see the other, and any connection between you ends.`)) return
    try {
      await api('POST', `/social/block/${h}`)
      toast(`${esc(p.name)} is blocked. Unblock them in Settings.`)
      setTimeout(() => location.replace('/feed'), 1200)
    } catch (x) {
      toast(esc(x.message))
    }
  }

  main.addEventListener('click', async (e) => {
    const t = e.target
    if (t.closest('[data-contact]')) return contact()
    const list = t.closest('[data-list]')
    if (list) return void people(list.dataset.list)
    if (t.closest('[data-all]')) {
      if (all && more) await loadUpdates().catch(() => {})
      all = true
      return drawUpdates()
    }
    if (t.closest('[data-recommend]')) return recommend()
    const menu = t.closest('[data-more]')
    if (menu) {
      const items = [['Share profile', () => share(`/u?h=${h}`, p.name)]]
      if (self) items.push(['Who viewed your profile', () => (location.href = '/views')])
      if (me && !self && p.relation === 'connected' && !p.example) items.push(['Recommend', recommend])
      if (me && !self) {
        items.push(['Report profile', () => report('profile', { handle: p.handle }), true])
        items.push(['Block', block, true])
      }
      return popMenu(menu, items)
    }
    const endorse = t.closest('[data-endorse]')
    if (endorse) {
      const row = endorse.closest('[data-skill]')
      const on = endorse.getAttribute('aria-pressed') !== 'true'
      endorse.disabled = true
      try {
        const r = await api(on ? 'POST' : 'DELETE', `/social/u/${h}/endorse`, { skill: row.dataset.skill })
        endorse.setAttribute('aria-pressed', String(r.endorsed))
        endorse.textContent = r.endorsed ? 'Endorsed' : 'Endorse'
        endorse.classList.toggle('ghost', r.endorsed)
        endorse.classList.toggle('line', !r.endorsed)
        const count = row.querySelector('.faces > span:last-child')
        if (count) count.textContent = plural(r.endorsements, 'endorsement')
        else if (r.endorsements) row.querySelector('.grow').insertAdjacentHTML('beforeend', `<div class="faces"><span>${plural(r.endorsements, 'endorsement')}</span></div>`)
      } catch (x) {
        toast(esc(x.message))
      }
      endorse.disabled = false
    }
  })
}
