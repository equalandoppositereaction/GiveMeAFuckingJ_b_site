/**
 * A profile, /u/<username> (the owner, 2026-10-23: "The users should be at /u/ in the link"; /u?h=<username>
 * from before still lands here), laid out as LinkedIn's (2026-10-08) with Instagram's and X's following: the top
 * card (cover, photo ringed green when open to work and blue when hiring, name, pronouns, the bio's lines, place,
 * contact info; the profile's links as named buttons on its right; posts, followers and following on a line of
 * their own; "Followed by", Follow and Message; what they are open to, under "Open to work"), then About, Posts
 * (the pinned ones whole, then the three latest as tiles), Projects to show, Experience, Education, Skills,
 * Licenses and certifications, Volunteering, who recommends them and whom they recommend, Honors and awards,
 * Languages. Beside it, profiles like theirs and jobs for the viewer (2026-10-23: "it should have profile and
 * jobs recommendations"), and your own profile's views.
 *
 * Its top right is the heart with the profile's likes, its recommendations and Share, and nothing else (the
 * owner, 2026-10-23). A recommendation is one press: the people who follow you see the profile in their Home.
 *
 * A private account shows its card and sections to everyone, and its posts and lists to its followers. A
 * member's own design, once approved, is the whole page, the site's menu over it, the like, recommend and
 * share buttons on its top right and Follow and Message on its bottom right.
 *
 * Visitors without an account see a profile its owner left public.
 */
import { $, ago, api, avatar, dialog, esc, ICON, linkIcon, me, media, on, param, personRow, plural, popMenu, postHtml, profileUrl, relButtons, report, requireLogin, share, toast, who, ytBox } from '/app.js'
import { mountDesign, openSpecs, profileParts, projectCard } from '/design.js'
import { ARROW, BOLT, apply, oneClick, salary, tags } from '/jobkit.js'

const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
const MORE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>'
/** The lists a profile's numbers open: their titles, and what an empty one says. */
const LISTS = {
  followers: ['Followers', 'No followers yet.'],
  following: ['Following', 'Not following anyone yet.'],
  likes: ['Liked by', 'Nobody has liked this profile yet.'],
  recommenders: ['Recommended by', 'Nobody has recommended this profile yet.'],
  recommends: ['Recommends', 'No profiles recommended yet.']
}
/** The latest posts as tiles, beside the pinned ones (the owner, 2026-10-23: "the current small 3 latest posts row form"). */
const TILES = 3

/** Whose profile, and which view, from the address: /u/<username>, /u/<username>/posts; /u?h=<username> from before. */
function address() {
  const m = /^\/u\/([^/]+)(?:\/(posts))?\/?$/.exec(location.pathname)
  if (m) return { handle: decodeURIComponent(m[1]).toLowerCase(), posts: m[2] === 'posts', old: false }
  return { handle: param('h') || me?.handle || null, posts: param('view') === 'posts', old: true }
}

export default async function ({ main }) {
  const at = address()
  if (!at.handle) return void location.replace(`/login?next=${encodeURIComponent('/u')}`)
  // An address from before becomes the one now, in place.
  if (at.old) history.replaceState(null, '', `/u/${encodeURIComponent(at.handle)}${at.posts ? '/posts' : ''}${location.hash}`)
  main.innerHTML = '<div class="spin"></div>'
  let p
  try {
    p = await api('GET', `/social/u/${encodeURIComponent(at.handle)}`)
  } catch (e) {
    const next = encodeURIComponent(location.pathname + location.search)
    main.innerHTML =
      e.code === 'members_only'
        ? `<div class="empty"><h2>This profile is for members</h2><p>Log in to see it.</p><a class="btn" href="/login?next=${next}">Log in</a></div>`
        : `<div class="empty"><h2>${e.status === 404 ? 'There is no one by that username' : 'This profile could not load'}</h2><p>${e.status === 404 ? 'The username may be mistyped, or the account may have been deleted.' : esc(e.message)}</p></div>`
    return
  }
  const bioLine = (p.headline || '').split('\n')[0]
  document.title = `${p.name}${bioLine ? ` | ${bioLine}` : ''} | Oporch`
  const self = p.relation === 'self'
  const h = encodeURIComponent(p.handle)
  const url = `/u/${h}`
  // The menu's Profile is yours: lit on your own, not on someone else's.
  for (const a of document.querySelectorAll('[data-nav=profile]')) self ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')
  if (at.posts) return allPosts(main, p, self)

  // ── The top right (the owner, 2026-10-22 and 23): the heart and its likes, the recommendations, Share. Nothing else.
  const count = (n, which, label) => `<button class="pf-n" type="button" data-pf-list="${which}" aria-label="${label}">${Number(n).toLocaleString('en')}</button>`
  const cluster = () => {
    const liked = !!p.likes.mine
    const recd = !!p.recommendations.mine
    return `${
      self
        ? `<span class="ig pf-i" title="Likes of your profile">${ICON.heart}</span>`
        : `<button class="ig pf-like${liked ? ' on' : ''}" type="button" data-pf-like aria-pressed="${liked}" aria-label="${liked ? 'Unlike this profile' : 'Like this profile'}" title="${liked ? 'Unlike' : 'Like'}">${ICON.heart}</button>`
    }${count(p.likes.total, 'likes', 'See who liked this profile')}${
      self
        ? `<span class="ig pf-i" title="Recommendations of your profile">${ICON.recommend}</span>`
        : `<button class="ig pf-rec${recd ? ' on' : ''}" type="button" data-pf-rec aria-pressed="${recd}" aria-label="${recd ? 'Undo your recommendation' : 'Recommend this profile to the people who follow you'}" title="${recd ? 'Recommended' : 'Recommend'}">${ICON.recommend}</button>`
    }${count(p.recommendations.total, 'recommenders', 'See who recommends this profile')}<button class="ig" type="button" data-pf-share aria-label="Share this profile" title="Share">${ICON.share}</button>`
  }
  const drawCluster = () => {
    for (const el of main.querySelectorAll('[data-pf]')) el.innerHTML = cluster()
  }

  // ── A design of their own: the whole page, the site's menu over it, and two small bars of the profile's buttons.
  if (p.design) {
    main.innerHTML = `<div class="pd" id="design"></div>
<div class="pd-bar" role="toolbar" aria-label="Like, recommend and share"><div class="pf-acts" data-pf>${cluster()}</div></div>
<div class="pd-bar pd-me" role="toolbar" aria-label="${esc(p.name)}">${avatar(p, 's')}<b class="pd-name">${esc(p.name)}</b>${
      self
        ? '<a class="btn small" href="/settings#design">Edit design</a>'
        : `${me ? relButtons(p.handle, p.relation, true, { followsYou: p.followsYou }) : relButtons(p.handle, 'none', true)}<a class="ig" href="/messages?h=${h}" aria-label="Message ${esc(p.name)}" title="Message">${ICON.send}</a>`
    }<button class="ig" type="button" data-more aria-label="More" title="More">${MORE}</button></div>`
    // As others see it, on your own too: a post turned down is not in it.
    const updates = p.locked ? [] : await api('GET', `/social/u/${h}/updates`).then((r) => r.updates.filter((u) => u.review !== 'rejected'), () => [])
    mountDesign($('#design', main), p.design, p, updates, { fill: true })
    return wire()
  }

  const parts = profileParts(p)
  const actions = () =>
    self
      ? `<a class="btn" href="/settings#edit">Edit profile</a><a class="btn line" href="/settings#design">Design your profile</a><button class="btn line" type="button" data-more aria-label="More">More</button>`
      : `${me ? relButtons(p.handle, p.relation, false, { followsYou: p.followsYou }) : relButtons(p.handle, 'none', false)}<button class="btn line" type="button" data-more aria-label="More">More</button>`
  const nameLine = `<h1>${esc(p.name)}</h1>${p.pronouns ? `<span class="muted">(${esc(p.pronouns)})</span>` : ''}${p.private ? `<span class="lock" title="Private account">${LOCK}</span>` : ''}${p.followsYou ? '<span class="chip">Follows you</span>' : ''}`
  /** Posts, followers and following, on a line of their own (the owner, 2026-10-23); followers and following open their lists. */
  const counts = () =>
    `<div class="pf-counts"><a href="${url}/posts"><b>${p.counts.posts.toLocaleString('en')}</b> ${p.counts.posts === 1 ? 'post' : 'posts'}</a><button type="button" data-pf-list="followers"><b data-followers>${p.counts.followers.toLocaleString('en')}</b> ${
      p.counts.followers === 1 ? 'follower' : 'followers'
    }</button><button type="button" data-pf-list="following"><b>${p.counts.following.toLocaleString('en')}</b> following</button></div>`
  const followedBy = () => {
    const f = p.followedBy
    if (!f?.count) return ''
    const names = f.faces.map((x) => `<b>${esc(x.name)}</b>`)
    const rest = f.count - f.faces.length
    return `<p class="faces li-by"><span class="stack-av">${f.faces.map((x) => avatar(x, 'xs')).join('')}</span><span>Followed by ${names.join(', ')}${rest > 0 ? ` and ${plural(rest, 'other')} you follow` : ''}</span></p>`
  }
  /** Their links (the owner, 2026-10-23): a name and an icon, the address not shown, on the right under the cover. */
  const links = p.links.length
    ? `<nav class="pf-links" aria-label="${esc(p.name)}’s links">${p.links.map((l) => `<a class="pf-link" href="${esc(l.url)}" target="_blank" rel="noopener nofollow ugc">${linkIcon(l)}<span>${esc(l.label)}</span></a>`).join('')}</nav>`
    : ''
  /** Open to work as LinkedIn shows it: the heading, then what they are looking for; or that they are hiring. */
  const status = p.openToWork
    ? `<div class="pf-otw"><h2>Open to work</h2><dl>${openSpecs(p.openToWork).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`
    : p.hiring
      ? `<div class="pf-otw hiring"><h2>Hiring</h2><p>${self ? 'You are hiring. People can message you about your roles.' : `${esc(p.name)} is hiring. Send a message to ask about the role.`}</p></div>`
      : ''

  const section = (title, body, extra = '', id = '') => (body ? `<section class="card li-sec"${id ? ` id="${id}"` : ''}><div class="sec-h"><h2>${title}</h2>${extra}</div>${body}</section>` : '')
  /** Skills as a grid (the owner, 2026-10-22: "3 per row, centered"); a long one takes two places or three (`fitSkills`). */
  const skills = p.skills.length
    ? `<div class="skill-grid" data-skills>${p.skills
        .map(
          (s) => `<div class="sk" data-skill="${esc(s.name)}"><b class="sk-n" title="${esc(s.name)}">${esc(s.name)}</b><span class="sk-e" data-sk-count>${s.endorsements ? plural(s.endorsements, 'endorsement') : ''}</span>${
            me && !self ? `<button class="sk-b${s.endorsed ? ' on' : ''}" type="button" data-endorse aria-pressed="${s.endorsed}">${s.endorsed ? 'Endorsed' : 'Endorse'}</button>` : ''
          }</div>`
        )
        .join('')}</div>`
    : ''
  /** Projects to show (the owner, 2026-10-23: "a place for people to showcase their projects"): picture or video, skills, a way to it. */
  const projects = p.projects.length ? `<div class="pf-projects">${p.projects.map((x) => projectCard(x, (id, name) => ytBox(id, name))).join('')}</div>` : ''
  /** People as small cards: who recommends them, and whom they recommend. */
  const cards = (list) => `<div class="pf-people">${list.map((x) => `<a class="pf-person" href="${profileUrl(x)}">${avatar(x, 'l')}<b>${esc(x.name)}</b>${x.headline ? `<span class="who-h">${esc(x.headline)}</span>` : ''}</a>`).join('')}</div>`
  const seeAll = (n, shown, which) => (n > shown ? `<button class="textbtn" type="button" data-pf-list="${which}">See all ${n.toLocaleString('en')}</button>` : '')
  const recommendedBy = p.recommendedBy.length ? section('Recommended by', cards(p.recommendedBy), seeAll(p.recommendations.total, p.recommendedBy.length, 'recommenders')) : ''
  const recommending = p.recommending?.people.length
    ? section(self ? 'Profiles you recommend' : `Profiles ${esc(p.name)} recommends`, cards(p.recommending.people), seeAll(p.recommending.count, p.recommending.people.length, 'recommends'))
    : ''
  const locked = p.locked
    ? `<section class="card li-sec locked">${LOCK}<div><h2>This account is private</h2><p class="muted">${p.relation === 'requested' ? `You asked to follow ${esc(p.name)}. You will see their posts once they say yes.` : `Follow ${esc(p.name)} to see their posts, followers and who they follow.`}</p></div></section>`
    : ''
  const postsBox = p.locked
    ? ''
    : `<section class="card li-sec" id="posts-box"><div class="sec-h"><div><h2>Posts</h2><div class="muted small">${plural(p.counts.followers, 'follower')}</div></div>${
        self ? '<button class="btn line small" type="button" data-act="create">Create a post</button>' : ''
      }</div><div class="stack pf-pinned" id="pinned"></div><div class="tiles three" id="tiles"><div class="spin"></div></div><div id="tiles-f"></div></section>`

  main.innerHTML = `<div class="li">
<div class="li-main">
<section class="card li-top">
<div class="li-cover"></div>
<div class="li-head">
<div class="li-photo-row"><div class="li-photo">${avatar(p, 'xl')}</div><div class="pf-acts" data-pf>${cluster()}</div></div>
<div class="li-cols">
<div class="li-who">
<div class="li-name">${nameLine}</div>
${p.headline ? `<p class="li-bio">${esc(p.headline)}</p>` : ''}
<p class="li-meta">${p.location ? `${esc(p.location)} · ` : ''}<button type="button" class="link" data-contact>Contact info</button></p>
</div>
${links}
</div>
${counts()}
${followedBy()}
<div class="row wrap li-actions">${actions()}</div>
${status}
</div>
</section>
${locked}
${section('About', p.about ? `<p class="pre">${esc(p.about)}</p>` : '')}
${postsBox}
${section('Projects', projects)}
${section('Experience', parts.experience)}
${section('Education', parts.education)}
${section('Skills', skills)}
${section('Licenses and certifications', parts.certifications)}
${section('Volunteering', parts.volunteering)}
${recommendedBy}
${recommending}
${section('Honors and awards', parts.honors)}
${section('Languages', parts.languages)}
${
  self && !p.about && !p.experience.length && !p.education.length && !p.skills.length && !p.projects.length
    ? '<section class="card li-sec"><h2>Your profile is empty</h2><p class="muted">Add an About, your projects, experience, education and skills so people know your work, or fill it in from the desktop app.</p><p style="margin-top:12px"><a class="btn" href="/settings#edit">Fill in your profile</a></p></section>'
    : ''
}
</div>
<aside class="li-aside" id="aside"></aside>
</div>`
  if (p.cover) $('.li-cover', main).style.backgroundImage = `url("${media(p.cover)}")`
  const grid = $('[data-skills]', main)
  if (grid) {
    fitSkills(grid)
    // Fitted again when its width changes, never in the same frame as its own change.
    let wide = grid.clientWidth
    new ResizeObserver(() => grid.clientWidth !== wide && ((wide = grid.clientWidth), requestAnimationFrame(() => fitSkills(grid)))).observe(grid)
  }

  // ── Posts (the owner, 2026-10-23): the pinned ones whole, then the three latest of the rest as tiles; all of them on their own page.
  const tiles = $('#tiles', main)
  if (tiles) {
    const pinned = p.featured || []
    $('#pinned', main).innerHTML = pinned.map((u) => postHtml(u, { pinned: true })).join('')
    api('GET', `/social/u/${h}/updates`)
      .then((r) => {
        const rest = r.updates.filter((u) => !pinned.some((x) => x.id === u.id))
        tiles.innerHTML = rest.slice(0, TILES).map(tile).join('')
        if (!rest.length && !pinned.length) tiles.outerHTML = `<p class="muted">${self ? 'You have not shared a post yet.' : `${esc(p.name)} has not shared a post yet.`}</p>`
        else if (!rest.length) tiles.remove()
        if (r.updates.length) $('#tiles-f', main).innerHTML = `<a class="btn ghost wide tiles-all" href="${url}/posts">Show all posts</a>`
      })
      .catch((e) => (tiles.innerHTML = `<p class="muted">${esc(e.message)}</p>`))
  }

  // ── Beside it (the owner, 2026-10-23): your profile's views; profiles like this one; jobs for you. For a visitor, the way in.
  const aside = $('#aside', main)
  if (me) {
    const boxes = []
    if (self) {
      boxes.push(
        api('GET', '/social/me/views')
          .then((v) => `<section class="card li-sec"><h2>Profile views</h2><p class="pf-views"><b>${v.total.toLocaleString('en')}</b> <span class="muted small">in the past 90 days</span></p><p class="muted small">${plural(v.week, 'view')} this week</p></section>`)
          .catch(() => '')
      )
    }
    boxes.push(
      api('GET', `/social/u/${h}/related?limit=5`)
        .then((r) => (r.people.length ? `<section class="card li-sec"><div class="sec-h"><h2>${self ? 'Profiles for you' : 'More profiles for you'}</h2><a class="textbtn" href="/search">See all</a></div>${r.people.map((x) => personRow(x, x.reason)).join('')}</section>` : ''))
        .catch(() => '')
    )
    let build = null
    const jobs = new Map()
    boxes.push(
      api('POST', '/social/jobs/feed', { limit: 4 })
        .then((r) => {
          if (!r.ready || !r.jobs.length) return ''
          build = r.build
          for (const j of r.jobs) jobs.set(j.id, j)
          return `<section class="card li-sec"><div class="sec-h"><h2>Jobs for you</h2><a class="textbtn" href="/home?tab=jobs">See all</a></div>${r.jobs
            .map(
              (j) => `<article class="jobcard pf-job" data-id="${j.id}"><b class="pf-job-t">${esc(j.title)}</b><p class="muted small">${/^remote$/i.test((j.loc || '').trim()) ? '' : `${esc(j.loc || 'Location not listed')} · `}${tags(j)}</p><p class="small">${esc(salary(j.pay))}</p>${
                j.why?.text ? `<p class="muted small pf-job-why">${esc(j.why.text)}</p>` : ''
              }<div class="apply-row"><button class="apply" type="button">Apply${ARROW}</button><button class="oneclick" type="button" title="Your desktop app applies to it for you">${BOLT}<span>One click apply</span></button></div></article>`
            )
            .join('')}</section>`
        })
        .catch(() => '')
    )
    Promise.all(boxes).then((html) => (aside.innerHTML = html.join('')))
    aside.addEventListener('click', (e) => {
      const el = e.target.closest('.pf-job')
      const job = el && jobs.get(+el.dataset.id)
      if (!job) return
      if (e.target.closest('.oneclick')) return void oneClick(job, e.target.closest('.oneclick'), build)
      if (e.target.closest('.apply')) return void apply(job, e.target.closest('.apply'), build)
    })
  } else {
    const next = encodeURIComponent(location.pathname + location.search)
    aside.innerHTML = `<section class="card li-sec"><h2>${esc(p.name)} is on Oporch</h2><p class="muted">Join to follow ${esc(p.name)}, show your own work, and apply to jobs with one click.</p><div class="stack" style="margin-top:14px"><a class="btn" href="/login?new=1&next=${next}">Join Oporch</a><a class="btn ghost" href="/login?next=${next}">Log in</a></div></section>`
  }
  return wire()

  // ── The buttons, on the standard profile and over a design alike
  function wire() {
    main.addEventListener('click', async (e) => {
      const t = e.target
      if (t.closest('[data-contact]')) return contact()
      const list = t.closest('[data-pf-list]')
      if (list) return void people(list.dataset.pfList)
      if (t.closest('[data-pf-share]')) return void share(url, p.name)
      if (t.closest('[data-pf-like]')) return void like(t.closest('[data-pf-like]'))
      if (t.closest('[data-pf-rec]')) return void recommend(t.closest('[data-pf-rec]'))
      const menu = t.closest('[data-more]')
      if (menu) return moreMenu(menu)
      const endorse = t.closest('[data-endorse]')
      if (endorse) return void endorseSkill(endorse)
    })
    // Following from here moves the count with it.
    on('relation', (r) => {
      if (r.handle !== p.handle || typeof r.followers !== 'number') return
      p.counts.followers = r.followers
      for (const b of main.querySelectorAll('[data-followers]')) b.textContent = r.followers.toLocaleString('en')
    })
  }

  async function like(btn) {
    if (!requireLogin('Log in to like profiles.')) return
    btn.disabled = true
    try {
      const r = await api(p.likes.mine ? 'DELETE' : 'POST', `/social/u/${h}/like`)
      p.likes = { total: r.likes, mine: r.liked }
      drawCluster()
    } catch (x) {
      btn.disabled = false
      toast(esc(x.message))
    }
  }

  async function recommend(btn) {
    if (!requireLogin('Log in to recommend profiles.')) return
    btn.disabled = true
    try {
      const r = await api(p.recommendations.mine ? 'DELETE' : 'POST', `/social/u/${h}/recommend`)
      p.recommendations = { total: r.recommendations, mine: r.recommended }
      drawCluster()
      toast(r.recommended ? `You recommend ${esc(p.name)}. The people who follow you see it in their Home.` : 'Your recommendation is undone.')
    } catch (x) {
      btn.disabled = false
      toast(esc(x.message))
    }
  }

  async function endorseSkill(btn) {
    const box = btn.closest('[data-skill]')
    const yes = btn.getAttribute('aria-pressed') !== 'true'
    btn.disabled = true
    try {
      const r = await api(yes ? 'POST' : 'DELETE', `/social/u/${h}/endorse`, { skill: box.dataset.skill })
      btn.setAttribute('aria-pressed', String(r.endorsed))
      btn.textContent = r.endorsed ? 'Endorsed' : 'Endorse'
      btn.classList.toggle('on', r.endorsed)
      $('[data-sk-count]', box).textContent = r.endorsements ? plural(r.endorsements, 'endorsement') : ''
    } catch (x) {
      toast(esc(x.message))
    }
    btn.disabled = false
  }

  function moreMenu(btn) {
    const items = [['Share Profile', () => share(url, p.name)], ['Contact Info', contact]]
    // Over a design, the lists the standard profile shows are here.
    if (p.design) {
      items.push([`Posts (${p.counts.posts.toLocaleString('en')})`, () => (location.href = `${url}/posts`)], [`Followers (${p.counts.followers.toLocaleString('en')})`, () => void people('followers')], [`Following (${p.counts.following.toLocaleString('en')})`, () => void people('following')])
      if (p.recommending?.count) items.push([self ? 'Profiles You Recommend' : 'Profiles They Recommend', () => void people('recommends')])
    }
    if (self) items.push(['Settings', () => (location.href = '/settings')])
    if (me && !self) {
      items.push(['Report Profile', () => report('profile', { handle: p.handle }), true])
      items.push(['Block', block, true])
    }
    popMenu(btn, items)
  }

  /** A list of people a number on the profile opens: its own followers and recommenders can be removed, as on Instagram. */
  async function people(which) {
    if (!requireLogin('Log in to see who they are.')) return
    const [title, none] = LISTS[which]
    const { el } = dialog(`<div class="dialog-h"><h2>${title}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b"><div class="spin"></div></div>`, 'small')
    const removable = self && (which === 'followers' || which === 'recommenders')
    try {
      const r = await api('GET', `/social/u/${h}/${which}`)
      $('.dialog-b', el).innerHTML =
        r.people.map((x) => (removable ? `<div class="person" data-removable="${esc(x.handle)}">${who(x, x.headline)}<button class="btn ghost small" type="button" data-remove>Remove</button></div>` : personRow(x, x.headline))).join('') ||
        `<p class="muted">${none}</p>`
    } catch (x) {
      $('.dialog-b', el).innerHTML = `<p class="muted">${esc(x.message)}</p>`
      return
    }
    el.addEventListener('click', async (e) => {
      const row = e.target.closest('[data-removable]')
      if (!row || !e.target.closest('[data-remove]')) return
      try {
        if (which === 'followers') {
          // They are not told, as on Instagram.
          await api('DELETE', `/social/followers/${encodeURIComponent(row.dataset.removable)}`)
          p.counts.followers = Math.max(0, p.counts.followers - 1)
          for (const b of main.querySelectorAll('[data-followers]')) b.textContent = p.counts.followers.toLocaleString('en')
        } else {
          const res = await api('DELETE', `/social/me/recommenders/${encodeURIComponent(row.dataset.removable)}`)
          p.recommendations.total = res.recommendations
          drawCluster()
        }
        row.remove()
      } catch (x) {
        toast(esc(x.message))
      }
    })
  }

  function contact() {
    const address = `${location.origin}${url}`
    const row = (label, value) => `<div class="contact-row"><div class="muted small">${label}</div>${value}</div>`
    dialog(
      `<div class="dialog-h"><h2>${esc(p.name)}</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b stack">
${row('Profile', `<a class="link" href="${esc(address)}">${esc(address.replace(/^https?:\/\//, ''))}</a>`)}
${p.contact.email ? row('Email', `<a class="link" href="mailto:${esc(p.contact.email)}">${esc(p.contact.email)}</a>`) : ''}
${p.links.length ? row('Links', `<div class="pf-links in-dialog">${p.links.map((l) => `<a class="pf-link" href="${esc(l.url)}" target="_blank" rel="noopener nofollow ugc">${linkIcon(l)}<span>${esc(l.label)}</span></a>`).join('')}</div>`) : ''}
${p.joined ? row('Joined', esc(new Date(p.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))) : ''}
</div>`,
      'small'
    )
  }

  async function block() {
    if (!confirm(`Block ${p.name}? Neither of you will see the other, and neither follows the other any more.`)) return
    try {
      await api('POST', `/social/block/${h}`)
      toast(`${esc(p.name)} is blocked. Unblock them in Settings.`)
      setTimeout(() => location.replace('/home'), 1200)
    } catch (x) {
      toast(esc(x.message))
    }
  }
}

/** A post as a small tile, LinkedIn's Activity: who and when, its first lines, its picture, its likes and comments. */
function tile(u) {
  const x = u.repostOf && !u.text && !u.repostOf.gone ? u.repostOf : u
  const did = u.repostOf ? 'reposted this' : 'posted this'
  const stats = [u.reactions?.total ? plural(u.reactions.total, 'like') : '', u.comments ? plural(u.comments, 'comment') : ''].filter(Boolean).join(' · ')
  return `<a class="tile" href="/p?id=${x.id}">
<span class="tile-h">${avatar(u.author, 'xs')}<span><b>${esc(u.author?.name ?? '')}</b> ${did} · ${ago(u.at)}</span></span>
${u.review === 'pending' ? '<span class="tile-w">Waiting for review</span>' : u.review === 'rejected' ? '<span class="tile-w bad">Not approved</span>' : ''}
${x.text ? `<span class="tile-t">${esc(x.text)}</span>` : ''}
${x.image ? `<img class="tile-i${x.text ? '' : ' only'}" src="${esc(media(x.image))}" alt="" loading="lazy">` : ''}
${stats ? `<span class="tile-s">${stats}</span>` : ''}
</a>`
}

/** Skills in rows of three, centred; one whose name does not fit takes two places, or the row. */
function fitSkills(grid) {
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 10
  const place = (grid.clientWidth - 2 * gap) / 3
  for (const el of grid.children) {
    el.classList.remove('w2', 'w3')
    const name = el.querySelector('.sk-n')
    const pad = el.clientWidth - name.clientWidth
    const need = name.scrollWidth + pad
    if (need > 2 * place + gap) el.classList.add('w3')
    else if (need > place) el.classList.add('w2')
  }
}

/** All of someone's posts, as a feed (the owner, 2026-10-22: "when 'see all' button is pressed, the rest of the posts are showed in a feed format"), the pinned ones first. */
async function allPosts(main, p, self) {
  const h = encodeURIComponent(p.handle)
  main.innerHTML = `<div class="page narrow posts-page stack">
<div class="card pad row">${avatar(p, 'l')}<div class="grow"><h1 class="pf-ph">${self ? 'Your posts' : `${esc(p.name)}’s posts`}</h1><div class="muted small">${plural(p.counts.posts, 'post')}</div></div><a class="btn ghost small" href="/u/${h}">Back to the profile</a></div>
<div id="all" class="stack"><div class="spin"></div></div>
<div id="all-more"></div>
</div>`
  document.title = `${p.name}’s posts | Oporch`
  const list = $('#all', main)
  const moreBox = $('#all-more', main)
  if (p.locked) {
    list.innerHTML = `<div class="card empty"><h2>This account is private</h2><p>Follow ${esc(p.name)} to see their posts.</p><a class="btn" href="/u/${h}">Back to the profile</a></div>`
    return
  }
  const pinned = p.featured || []
  let cursor = null
  const load = async () => {
    try {
      const r = await api('GET', `/social/u/${h}/updates${cursor ? `?before=${cursor}` : ''}`)
      if (!cursor) list.innerHTML = pinned.map((u) => postHtml(u, { pinned: true })).join('')
      list.insertAdjacentHTML('beforeend', r.updates.filter((u) => !pinned.some((x) => x.id === u.id)).map((u) => postHtml(u)).join(''))
      cursor = r.updates.at(-1)?.id ?? cursor
      if (!list.children.length) list.innerHTML = `<div class="card empty"><p>${self ? 'You have not shared a post yet.' : `${esc(p.name)} has not shared a post yet.`}</p></div>`
      moreBox.innerHTML = r.more ? '<div class="center"><button class="btn ghost" type="button">Show more</button></div>' : ''
    } catch (e) {
      moreBox.innerHTML = `<p class="muted">${esc(e.message)}</p>`
    }
  }
  moreBox.addEventListener('click', (e) => e.target.closest('button') && void load())
  await load()
}
