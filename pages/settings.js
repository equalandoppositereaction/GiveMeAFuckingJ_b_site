/**
 * Settings: your profile with LinkedIn's sections, #OpenToWork and #Hiring; who sees what; the people
 * you blocked; recommendations written for you and by you; your own profile design, made with your own
 * AI if you like (the owner, 2026-10-08: "prepare a prompt so that the user can just make minute changes
 * and give their ai model the prompt"); and the account. Nothing here is for sale: no prices, no
 * payments (the owner, 2026-10-08: "Dont have any payment or pricing place just yet").
 */
import { $, API, api, avatar, esc, me, param, profileUrl, toast, upload, who } from '/app.js'
import { BASE_CSS, BASE_HTML, designPrompt, mb, mountDesign, parseAnswer, PLACEHOLDERS, PROFICIENCY, WORK_TYPE } from '/design.js'

const HANDLE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/

/** LinkedIn's sections, as the editor shows them: [field, label, kind, most characters]. The first field must be filled. */
const SECTIONS = {
  experience: {
    title: 'Experience',
    add: 'Add experience',
    fields: [['title', 'Title', 'text', 100], ['company', 'Company', 'text', 100], ['location', 'Location', 'text', 100], ['start', 'Start', 'date'], ['end', 'End', 'date'], ['current', 'I work here now', 'check'], ['description', 'What you did', 'area', 2000]]
  },
  education: {
    title: 'Education',
    add: 'Add education',
    fields: [['school', 'School', 'text', 150], ['degree', 'Degree', 'text', 100], ['field', 'Field of study', 'text', 100], ['start', 'Start', 'date'], ['end', 'End (or expected)', 'date']]
  },
  certifications: {
    title: 'Licenses and certifications',
    add: 'Add a certification',
    fields: [['name', 'Name', 'text', 150], ['issuer', 'Issuing organization', 'text', 150], ['issued', 'Issued', 'date'], ['expires', 'Expires', 'date'], ['credentialId', 'Credential ID', 'text', 100], ['url', 'Credential URL', 'url', 300]]
  },
  projects: {
    title: 'Projects',
    add: 'Add a project',
    fields: [['name', 'Project name', 'text', 150], ['start', 'Start', 'date'], ['end', 'End', 'date'], ['url', 'Project URL', 'url', 300], ['description', 'Description', 'area', 2000]]
  },
  volunteering: {
    title: 'Volunteering',
    add: 'Add volunteering',
    fields: [['role', 'Role', 'text', 100], ['organization', 'Organization', 'text', 150], ['cause', 'Cause', 'text', 100], ['start', 'Start', 'date'], ['end', 'End', 'date'], ['current', 'I volunteer here now', 'check'], ['description', 'Description', 'area', 2000]]
  },
  honors: {
    title: 'Honors and awards',
    add: 'Add an award',
    fields: [['title', 'Title', 'text', 150], ['issuer', 'Issued by', 'text', 150], ['date', 'Date', 'date'], ['description', 'Description', 'area', 1000]]
  },
  languages: { title: 'Languages', add: 'Add a language', fields: [['name', 'Language', 'text', 60], ['proficiency', 'Proficiency', 'select']] }
}
const blank = (kind) => Object.fromEntries(SECTIONS[kind].fields.map(([f, , type]) => [f, type === 'check' ? false : type === 'select' ? 'professional' : '']))
const filled = (kind, x) => SECTIONS[kind].fields.slice(0, kind === 'experience' ? 2 : 1).some(([f]) => String(x[f] ?? '').trim())
const commas = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/settings')
  const draft = structuredClone(me)
  main.innerHTML = `<div class="page narrow">
<div class="page-h"><h1>Settings</h1></div>
${param('welcome') ? '<div class="card pad stack" style="margin-bottom:18px"><h2>Welcome to GMAFJ</h2><p class="muted">Add a photo and a headline so people know you. Have the GMAFJ app? Fill everything in from it.</p></div>' : ''}
<nav class="set-nav"><a href="#profile">Profile</a><a href="#privacy">Privacy</a><a href="#recommendations">Recommendations</a><a href="#design">Design your profile</a><a href="#account">Account</a></nav>
<div class="stack">
<section class="card" id="profile"></section>
<section class="card" id="privacy"></section>
<section class="card" id="recommendations"></section>
<section class="card" id="design"></section>
<section class="card" id="account"></section>
</div>
</div>`

  // ── Profile: everything in it, saved together

  const profile = $('#profile', main)
  const input = (key, label, attrs = '', value = draft[key]) => `<label class="field"><span>${label}</span><input data-k="${key}" value="${esc(value ?? '')}" ${attrs}></label>`

  function entryCard(kind, x, i) {
    const k = (f) => `${kind}.${i}.${f}`
    const fields = SECTIONS[kind].fields
      .map(([f, label, type, max]) => {
        if (type === 'check') return `<label class="check span2"><input type="checkbox" data-k="${k(f)}"${x[f] ? ' checked' : ''}><span>${label}</span></label>`
        if (type === 'area') return `<label class="field span2"><span>${label}</span><textarea data-k="${k(f)}" maxlength="${max}">${esc(x[f] ?? '')}</textarea></label>`
        if (type === 'select')
          return `<label class="field"><span>${label}</span><select data-k="${k(f)}">${Object.entries(PROFICIENCY)
            .map(([v, t]) => `<option value="${v}"${x[f] === v ? ' selected' : ''}>${t}</option>`)
            .join('')}</select></label>`
        const attrs = type === 'date' ? 'maxlength="20" placeholder="2023-04"' : type === 'url' ? `type="url" maxlength="${max}" placeholder="https://"` : `maxlength="${max}"`
        return `<label class="field"><span>${label}</span><input data-k="${k(f)}" value="${esc(x[f] ?? '')}" ${attrs}${f === 'end' && x.current ? ' disabled' : ''}></label>`
      })
      .join('')
    return `<div class="card"><button class="btn ghost small rm" type="button" data-rm="${kind}.${i}">Remove</button><div class="grid2 entry-ed">${fields}</div></div>`
  }

  function openToWork() {
    const o = draft.openToWork
    return `<div class="stack" style="gap:10px">
<label class="check"><input type="checkbox" data-otw-on${o ? ' checked' : ''}><span><b>I am open to work</b><br><span class="muted small">Recruiters and your network see what you are looking for. The #OpenToWork frame on your photo is up to you.</span></span></label>
${
  o
    ? `<div class="grid2">
<label class="field"><span>Job titles, separated by commas (up to 5)</span><input data-otw="titles" value="${esc(o.titles.join(', '))}" placeholder="Data Analyst, Product Analyst"></label>
<label class="field"><span>Locations, separated by commas (up to 5)</span><input data-otw="places" value="${esc(o.places.join(', '))}" placeholder="Bengaluru, Remote"></label></div>
<div class="row wrap"><span class="small" style="font-weight:600">Workplace</span>${Object.entries(WORK_TYPE)
        .map(([v, t]) => `<label class="check"><input type="checkbox" data-otw-type="${v}"${o.types.includes(v) ? ' checked' : ''}><span>${t}</span></label>`)
        .join('')}</div>
<div class="grid2"><label class="field"><span>Start date</span><select data-otw="start"><option value="flexible"${o.start === 'flexible' ? ' selected' : ''}>Flexible</option><option value="now"${o.start === 'now' ? ' selected' : ''}>Immediately, I am actively applying</option></select></label></div>
<label class="check"><input type="checkbox" data-otw="frame"${o.frame ? ' checked' : ''}><span>Show the #OpenToWork frame on my photo</span></label>`
    : ''
}
<label class="check"><input type="checkbox" data-k="hiring"${draft.hiring ? ' checked' : ''}><span><b>I am hiring</b><br><span class="muted small">Puts the #Hiring frame on your photo, so people know to message you about roles.</span></span></label>
</div>`
  }

  function drawProfile() {
    profile.innerHTML = `<div class="sec"><div class="sec-h"><h2>Profile</h2><button class="btn ghost small" type="button" data-import>Fill in from the GMAFJ app</button></div>
<div class="row" style="gap:16px;margin-bottom:16px">${avatar(draft, 'l')}<div class="stack" style="gap:6px">
<div class="row wrap"><label class="btn ghost small">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pic="avatar"></label>${draft.avatar ? '<button class="btn ghost small" type="button" data-unpic="avatar">Remove photo</button>' : ''}</div>
<div class="row wrap"><label class="btn ghost small">${draft.cover ? 'Change cover' : 'Add a cover picture'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pic="cover"></label>${draft.cover ? '<button class="btn ghost small" type="button" data-unpic="cover">Remove cover</button>' : ''}</div>
</div></div>
<div class="stack">
<div class="grid2">${input('Name', 'name', 'maxlength="100" required')}${input('Pronouns', 'pronouns', 'maxlength="30" placeholder="she/her, he/him, they/them"')}</div>
${input('Username', 'handle', 'maxlength="30" pattern="[a-z0-9][a-z0-9._]{1,28}[a-z0-9]" autocapitalize="none" spellcheck="false"')}
${input('Headline', 'headline', 'maxlength="220" placeholder="What you do, or the job you want"')}
<div class="grid2">${input('Location', 'location', 'maxlength="100" placeholder="City, Country"')}${input('Website', 'website', 'maxlength="300" type="url" placeholder="https://"')}</div>
<label class="field"><span>About</span><textarea data-k="about" maxlength="2600" style="min-height:140px">${esc(draft.about ?? '')}</textarea></label>
</div></div>
<div class="sec"><h3 style="margin-bottom:12px">Open to work and hiring</h3>${openToWork()}</div>
${Object.entries(SECTIONS)
  .map(
    ([kind, s]) => `<div class="sec"><div class="sec-h"><h3>${s.title}</h3><button class="btn ghost small" type="button" data-add="${kind}">${s.add}</button></div>
<div class="list-ed">${(draft[kind] || []).map((x, i) => entryCard(kind, x, i)).join('') || '<p class="muted small">Nothing added yet.</p>'}</div></div>`
  )
  .join('')}
<div class="sec"><label class="field"><span>Skills, separated by commas (up to 60)</span><input data-k="skills" value="${esc(draft.skills.join(', '))}" placeholder="SQL, Excel, Python"></label>
<p class="muted small" style="margin-top:6px">Your connections can endorse them. A skill you take off takes its endorsements with it.</p></div>
<div class="sec save-bar"><button class="btn" type="button" data-save>Save profile</button><a class="textbtn" href="${profileUrl(me)}">See your profile</a><span class="err grow" hidden></span></div>`
  }

  profile.addEventListener('input', (e) => {
    const el = e.target
    if (el.matches('[data-otw]')) {
      const f = el.dataset.otw
      draft.openToWork[f] = f === 'frame' ? el.checked : f === 'start' ? el.value : commas(el.value).slice(0, 5)
      return
    }
    if (el.matches('[data-otw-type]')) {
      const types = new Set(draft.openToWork.types)
      el.checked ? types.add(el.dataset.otwType) : types.delete(el.dataset.otwType)
      draft.openToWork.types = [...types]
      return
    }
    if (el.matches('[data-otw-on]')) {
      draft.openToWork = el.checked ? (me.openToWork ? structuredClone(me.openToWork) : { titles: [], places: [], types: [], start: 'flexible', frame: true }) : null
      return drawProfile()
    }
    if (!el.matches('[data-k]')) return
    const path = el.dataset.k.split('.')
    const value = el.type === 'checkbox' ? el.checked : path[0] === 'skills' ? commas(el.value) : el.value
    if (path.length === 1) draft[path[0]] = value
    else draft[path[0]][+path[1]][path[2]] = value
    if (path[2] === 'current') {
      const end = el.closest('.card').querySelector(`[data-k="${path[0]}.${path[1]}.end"]`)
      end.disabled = el.checked
      if (el.checked) end.value = draft[path[0]][+path[1]].end = ''
    }
  })
  profile.addEventListener('change', async (e) => {
    const picked = e.target.closest('[data-pic]')
    if (!picked?.files?.[0]) return
    const which = picked.dataset.pic
    try {
      const pic = await upload(picked.files[0], which, which === 'avatar' ? 400 : 1600, which === 'avatar')
      Object.assign(me, await api('PATCH', '/social/me', { [which]: pic.id }))
      draft[which] = me[which]
      drawProfile()
      toast(which === 'avatar' ? 'Photo changed.' : 'Cover changed.')
    } catch (x) {
      toast(esc(x.message))
    }
  })
  profile.addEventListener('click', async (e) => {
    const t = e.target
    const add = t.closest('[data-add]')
    if (add) {
      ;(draft[add.dataset.add] ||= []).push(blank(add.dataset.add))
      drawProfile()
      return void [...profile.querySelectorAll(`[data-k^="${add.dataset.add}."]`)].at(-SECTIONS[add.dataset.add].fields.length)?.focus()
    }
    const rm = t.closest('[data-rm]')
    if (rm) {
      const [kind, i] = rm.dataset.rm.split('.')
      draft[kind].splice(+i, 1)
      return drawProfile()
    }
    const unpic = t.closest('[data-unpic]')
    if (unpic) {
      Object.assign(me, await api('PATCH', '/social/me', { [unpic.dataset.unpic]: null }))
      draft[unpic.dataset.unpic] = null
      return drawProfile()
    }
    if (t.closest('[data-import]')) {
      try {
        const got = await api('GET', '/social/me/import')
        for (const [k, v] of Object.entries(got)) if (v && (!Array.isArray(v) || v.length)) draft[k] = v
        drawProfile()
        toast('Filled in from your GMAFJ app. Check it, then press Save profile.')
      } catch (x) {
        toast(esc(x.message), 7000)
      }
      return
    }
    if (t.closest('[data-save]')) {
      const err = $('.save-bar .err', profile)
      err.hidden = true
      const fail = (m) => {
        err.textContent = m
        err.hidden = false
      }
      if (!HANDLE.test(draft.handle)) return fail('A username is 3 to 30 lower-case letters, digits, dots or underscores, starting and ending with a letter or digit.')
      if (!String(draft.name).trim()) return fail('Your name cannot be empty.')
      const body = {
        name: draft.name,
        handle: draft.handle,
        pronouns: draft.pronouns,
        headline: draft.headline,
        location: draft.location,
        website: draft.website,
        about: draft.about,
        skills: [...new Set(draft.skills.map((s) => s.slice(0, 60)))].slice(0, 60),
        openToWork: draft.openToWork,
        hiring: !!draft.hiring
      }
      for (const kind of Object.keys(SECTIONS)) body[kind] = (draft[kind] || []).filter((x) => filled(kind, x))
      try {
        Object.assign(me, await api('PATCH', '/social/me', body))
        Object.assign(draft, structuredClone(me))
        drawProfile()
        toast(`Saved. <a href="${profileUrl(me)}">See your profile</a>`)
      } catch (x) {
        fail(x.message)
      }
    }
  })
  drawProfile()

  // ── Privacy: saved as soon as it is changed

  const privacy = $('#privacy', main)
  const tick = (key, title, text) => `<label class="check"><input type="checkbox" data-p="${key}"${me[key] ? ' checked' : ''}><span><b>${title}</b><br><span class="muted small">${text}</span></span></label>`
  privacy.innerHTML = `<div class="sec"><div class="sec-h"><h2>Privacy</h2></div><div class="stack">
${tick('profilePublic', 'Visitors without an account can see my profile', 'Off: only people signed in to GMAFJ can. Your updates for anyone still open for whoever has their link.')}
${tick('appliesVisible', 'My connections can see the jobs I apply to', 'They see your face on a job you applied to with Apply or One click apply. Off: you are only counted, never named.')}
${tick('connectionsVisible', 'My connections can see my list of connections', 'Off: they see only the connections you share.')}
${tick('privateViewing', 'View profiles privately', 'People whose profiles you open see "Someone on GMAFJ" instead of your name. Like on LinkedIn, you then see only how many people viewed yours, not who.')}
<label class="field" style="max-width:360px"><span>Who can see my email address</span><select data-p="emailVisible"><option value="connections"${me.emailVisible === 'connections' ? ' selected' : ''}>My connections</option><option value="nobody"${me.emailVisible === 'nobody' ? ' selected' : ''}>Nobody</option></select></label>
</div></div>
<div class="sec"><div class="sec-h"><h3>Blocked</h3></div><div id="blocked"><div class="spin"></div></div></div>`
  privacy.addEventListener('change', async (e) => {
    const box = e.target.closest('[data-p]')
    if (!box) return
    const value = box.type === 'checkbox' ? box.checked : box.value
    try {
      Object.assign(me, await api('PATCH', '/social/me', { [box.dataset.p]: value }))
      toast('Saved.')
    } catch (x) {
      if (box.type === 'checkbox') box.checked = !box.checked
      toast(esc(x.message))
    }
  })
  const blocked = $('#blocked', privacy)
  async function drawBlocked() {
    try {
      const r = await api('GET', '/social/me/blocked')
      blocked.innerHTML = r.people.length
        ? r.people.map((p) => `<div class="person">${who(p)}<button class="btn ghost small" type="button" data-unblock="${esc(p.handle)}">Unblock</button></div>`).join('')
        : '<p class="muted small">You have not blocked anyone. Block someone from the More button on their profile.</p>'
    } catch (x) {
      blocked.innerHTML = `<p class="err">${esc(x.message)}</p>`
    }
  }
  blocked.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-unblock]')
    if (!b) return
    await api('DELETE', `/social/block/${encodeURIComponent(b.dataset.unblock)}`).catch((x) => toast(esc(x.message)))
    void drawBlocked()
  })
  void drawBlocked()

  // ── Recommendations: written for you (shown when you say so) and by you

  const recs = $('#recommendations', main)
  async function drawRecs() {
    let r
    try {
      r = await api('GET', '/social/me/recommendations')
    } catch (x) {
      recs.innerHTML = `<div class="sec"><p class="err">${esc(x.message)}</p></div>`
      return
    }
    const STATE = { pending: '<span class="state pending">New</span>', shown: '<span class="state approved">On your profile</span>', hidden: '<span class="state">Hidden</span>' }
    const card = (x, mine) => `<div class="rec-ed" data-rec="${x.id}"><div class="row">${who(mine ? x.about : x.author, x.relationship)}${mine ? '' : STATE[x.state] ?? ''}</div><p class="pre small">${esc(x.text)}</p><div class="row wrap">${
      mine
        ? '<button class="btn ghost small" type="button" data-rec-del>Delete</button>'
        : `${x.state !== 'shown' ? '<button class="btn small" type="button" data-rec-state="shown">Show on my profile</button>' : '<button class="btn ghost small" type="button" data-rec-state="hidden">Hide</button>'}<button class="btn ghost small" type="button" data-rec-del>Delete</button>`
    }</div></div>`
    recs.innerHTML = `<div class="sec"><div class="sec-h"><h2>Recommendations</h2></div><p class="muted small">Your connections can recommend you from your profile. A recommendation shows on your profile only once you choose to show it.</p></div>
<div class="sec"><h3 style="margin-bottom:10px">Received</h3>${r.received.map((x) => card(x, false)).join('') || '<p class="muted small">None yet.</p>'}</div>
<div class="sec"><h3 style="margin-bottom:10px">Given</h3>${r.given.map((x) => card(x, true)).join('') || '<p class="muted small">None yet. Recommend a connection from their profile.</p>'}</div>`
  }
  recs.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-rec]')
    if (!el) return
    const state = e.target.closest('[data-rec-state]')?.dataset.recState
    try {
      if (state) await api('PATCH', `/social/recommendations/${el.dataset.rec}`, { state })
      else if (e.target.closest('[data-rec-del]')) {
        if (!confirm('Delete this recommendation?')) return
        await api('DELETE', `/social/recommendations/${el.dataset.rec}`)
      } else return
      void drawRecs()
    } catch (x) {
      toast(esc(x.message))
    }
  })
  void drawRecs()

  // ── Design your profile: your AI's design or your own, its pictures, a live preview, the admins' answer

  const design = $('#design', main)
  async function drawDesign() {
    let d, mine, pics, updates
    try {
      ;[d, mine, pics, updates] = await Promise.all([
        api('GET', '/social/me/design'),
        api('GET', `/social/u/${encodeURIComponent(me.handle)}`),
        api('GET', '/social/me/design/media'),
        api('GET', `/social/u/${encodeURIComponent(me.handle)}/updates`).then((r) => r.updates)
      ])
    } catch (x) {
      design.innerHTML = `<div class="sec"><p class="err">${esc(x.message)}</p></div>`
      return
    }
    const canPublish = (me.features ?? []).includes('design')
    const state = {
      none: '',
      pending: '<span class="state pending">Waiting for review</span>',
      approved: '<span class="state approved">Approved and on your profile</span>',
      rejected: '<span class="state rejected">Not approved</span>'
    }[d.state]
    // Nothing designed yet: it starts from the standard profile (the owner: "the base would be like linkedin still").
    const start = d.state === 'none' || !d.html.trim()
    const address = (f) => `${API}${f.path}`
    design.innerHTML = `<div class="sec"><div class="sec-h"><h2>Design your profile</h2>${state}</div>
<p class="muted">Make your profile your own: any layout, colours, fonts, pictures and GIFs, in HTML and CSS. Your updates, projects, experience and everything else fill in by themselves, so it stays up to date. We check every design before it shows on your profile.</p>
${d.state === 'rejected' && d.note ? `<p class="err" style="margin-top:10px">Why it was not approved: ${esc(d.note)}</p>` : ''}
${d.live && d.state !== 'approved' ? '<p class="muted small" style="margin-top:10px">Your last approved design stays up until this one is approved.</p>' : ''}
${canPublish ? '' : '<p style="margin-top:10px"><b>Publishing a design is part of Pro.</b> You can still try one out here.</p>'}</div>
<div class="sec stack">
<h3>1. Ask your AI to design it</h3>
<p class="muted small">Change the first lines to say how you want it to look, then copy the whole prompt into the AI you use. Upload your pictures first (below) so the prompt lists them.</p>
<textarea class="textarea code prompt" data-prompt spellcheck="false">${esc(designPrompt({ headline: me.headline, pictures: pics.files.map(address) }))}</textarea>
<div class="row wrap"><button class="btn" type="button" data-copy>Copy the prompt</button><button class="btn ghost small" type="button" data-reprompt>Start the prompt again</button></div>
<h3>2. Paste its answer</h3>
<textarea class="textarea code" data-answer spellcheck="false" placeholder="Paste the AI's whole answer here: its HTML and CSS blocks" style="min-height:110px"></textarea>
<div class="row wrap"><button class="btn" type="button" data-use>Use this answer</button><span class="muted small">It fills in the HTML and CSS below, and the preview.</span></div>
</div>
<div class="sec stack">
<h3>3. Check it, change anything</h3>
<div class="ed"><label class="field"><span>HTML</span><textarea class="code" data-d="html" spellcheck="false">${esc(start ? BASE_HTML : d.html)}</textarea></label>
<label class="field"><span>CSS</span><textarea class="code" data-d="css" spellcheck="false">${esc(start ? BASE_CSS : d.css)}</textarea></label></div>
<details class="code-v"><summary>What the placeholders fill in</summary><ul class="small" style="margin:6px 0 0 18px">${Object.entries(PLACEHOLDERS)
      .map(([k, v]) => `<li><code class="code">{{${k}}}</code> ${esc(v)}</li>`)
      .join('')}<li><code class="code">data-if="name"</code> on any element shows it only when that placeholder has something</li></ul></details>
<div class="row wrap"><button class="btn ghost small" type="button" data-dbase>Start again from the standard profile</button></div>
</div>
<div class="sec stack">
<div class="sec-h" style="margin:0"><h3>Pictures and GIFs</h3><span class="muted small" data-meter></span></div>
<div class="meter"><span data-bar></span></div>
<p class="muted small">JPEG, PNG or GIF (GIFs up to 5 MB), at most ${pics.maxFiles}. Your design, with its pictures, can be up to ${mb(pics.budget)}.</p>
<div class="pics">${pics.files
      .map(
        (f) => `<div class="pic" data-pic-id="${esc(f.id)}"><img src="${esc(address(f))}" alt=""><div class="small muted">${mb(f.bytes)}</div><div class="row wrap" style="gap:4px"><button class="btn ghost small" type="button" data-insert>Insert</button><button class="btn ghost small" type="button" data-copyurl>Copy address</button><button class="btn ghost small" type="button" data-pic-rm>Remove</button></div></div>`
      )
      .join('')}${pics.files.length < pics.maxFiles ? '<label class="pic add"><input type="file" accept="image/jpeg,image/png,image/gif" hidden data-dpic><span>Upload a picture</span></label>' : ''}</div>
</div>
<div class="sec"><div class="sec-h"><h3>Preview</h3><span class="muted small">As people will see it</span></div><div id="dprev" class="dprev"></div></div>
<div class="sec row wrap"><button class="btn" type="button" data-dsend${canPublish ? '' : ' disabled'}>Send for review</button>${d.state !== 'none' ? '<button class="btn danger" type="button" data-ddel>Remove my design</button>' : ''}<span class="err" hidden></span></div>`

    const html = $('[data-d=html]', design)
    const css = $('[data-d=css]', design)
    const prev = $('#dprev', design)
    const err = $('.sec:last-child .err', design)
    const picBytes = pics.files.reduce((s, f) => s + f.bytes, 0)
    const meter = () => {
      const used = picBytes + new Blob([html.value]).size + new Blob([css.value]).size
      $('[data-meter]', design).textContent = `${mb(used)} of ${mb(pics.budget)} used`
      $('[data-bar]', design).style.width = `${Math.min(100, (used / pics.budget) * 100)}%`
      $('.meter', design).classList.toggle('over', used > pics.budget)
    }
    const preview = () => {
      mountDesign(prev, { html: html.value, css: css.value }, mine, updates)
      meter()
    }
    preview()
    let typing = 0
    design.oninput = (e) => {
      if (!e.target.closest('[data-d]')) return
      clearTimeout(typing)
      typing = setTimeout(preview, 400)
    }
    const insert = (tag) => {
      const at = html.selectionStart ?? html.value.length
      html.value = html.value.slice(0, at) + tag + html.value.slice(at)
      preview()
    }
    design.onclick = async (e) => {
      const t = e.target
      if (t.closest('[data-copy]')) {
        try {
          await navigator.clipboard.writeText($('[data-prompt]', design).value)
          toast('Prompt copied. Paste it into your AI.')
        } catch {
          $('[data-prompt]', design).select()
          toast('Press Ctrl+C (or Cmd+C) to copy it.')
        }
        return
      }
      if (t.closest('[data-reprompt]')) {
        $('[data-prompt]', design).value = designPrompt({ headline: me.headline, pictures: pics.files.map(address) })
        return
      }
      if (t.closest('[data-use]')) {
        const got = parseAnswer($('[data-answer]', design).value)
        if (!got.html) return toast('That answer has no HTML in it. Paste the whole answer, with its code blocks.')
        html.value = got.html
        css.value = got.css
        preview()
        prev.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return toast('Your design is in. Check the preview, then send it for review.')
      }
      if (t.closest('[data-dbase]')) {
        if (!confirm('Replace your HTML and CSS with the standard profile?')) return
        html.value = BASE_HTML
        css.value = BASE_CSS
        return preview()
      }
      const pic = t.closest('[data-pic-id]')
      if (pic) {
        const url = `${API}/media/${pic.dataset.picId}`
        if (t.closest('[data-insert]')) return insert(`<img src="${url}" alt="">`)
        if (t.closest('[data-copyurl]')) {
          await navigator.clipboard.writeText(url).then(() => toast('Address copied.'), () => prompt('Copy this address:', url))
          return
        }
        if (t.closest('[data-pic-rm]')) {
          if (!confirm('Remove this picture? A design that uses it will show nothing there.')) return
          await api('DELETE', `/social/media/${encodeURIComponent(pic.dataset.picId)}`).catch((x) => toast(esc(x.message)))
          return void drawDesign()
        }
      }
      if (t.closest('[data-dsend]')) {
        err.hidden = true
        try {
          await api('PUT', '/social/me/design', { html: html.value, css: css.value })
          toast('Sent for review. We will let you know.')
          void drawDesign()
        } catch (x) {
          err.textContent = x.message
          err.hidden = false
        }
        return
      }
      if (t.closest('[data-ddel]')) {
        if (!confirm('Remove your design? Your profile goes back to the standard one.')) return
        await api('DELETE', '/social/me/design').catch((x) => toast(esc(x.message)))
        void drawDesign()
      }
    }
    $('[data-dpic]', design)?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        // The HTML and CSS typed so far stay: the design is drawn again from them.
        const kept = { html: html.value, css: css.value }
        await upload(file, 'design', 2000)
        await drawDesign()
        $('[data-d=html]', design).value = kept.html
        $('[data-d=css]', design).value = kept.css
        $('[data-d=html]', design).dispatchEvent(new Event('input', { bubbles: true }))
        toast('Uploaded. Insert it into your HTML, or ask your AI to use it.')
      } catch (x) {
        toast(esc(x.message))
      }
    })
  }
  void drawDesign()

  // ── Account

  const account = $('#account', main)
  account.innerHTML = `<div class="sec"><div class="sec-h"><h2>Account</h2></div><div class="stack">
<p>Signed in as <b>${esc(me.email)}</b>. The same account signs in to the GMAFJ app.</p>
<div class="row wrap"><a class="btn ghost" href="/items">My items</a><a class="btn ghost" href="/views">Who viewed your profile</a><button class="btn ghost" type="button" data-signout>Log out</button></div>
<details><summary class="textbtn" style="cursor:pointer">Change my password</summary><div class="stack" style="margin-top:12px;max-width:320px">
<label class="field"><span>Current password</span><input type="password" autocomplete="current-password" data-pw-now></label>
<label class="field"><span>New password, at least 10 characters</span><input type="password" autocomplete="new-password" minlength="10" data-pw-new></label>
<p class="muted small">Every other device, the app included, signs out.</p>
<div><button class="btn" type="button" data-pw>Change password</button></div></div></details>
<details><summary class="textbtn" style="cursor:pointer">Delete my account</summary><div class="stack" style="margin-top:12px">
<p class="muted small">This deletes your account, profile, updates, comments, messages, connections and pictures, here and in the app. It cannot be undone.</p>
<label class="field" style="max-width:320px"><span>Your password</span><input type="password" autocomplete="current-password" data-delpw></label>
<div><button class="btn danger" type="button" data-delete>Delete everything</button></div></div></details>
</div></div>`
  account.addEventListener('click', async (e) => {
    if (e.target.closest('[data-pw]')) {
      try {
        await api('POST', '/auth/change-password', { current: $('[data-pw-now]', account).value, password: $('[data-pw-new]', account).value })
        $('[data-pw-now]', account).value = $('[data-pw-new]', account).value = ''
        toast('Password changed. Other devices are signed out.')
      } catch (x) {
        toast(esc(x.message))
      }
      return
    }
    if (e.target.closest('[data-delete]')) {
      const password = $('[data-delpw]', account).value
      if (!password) return toast('Type your password to confirm.')
      if (!confirm('Delete your GMAFJ account and everything in it? This cannot be undone.')) return
      try {
        await api('DELETE', '/me', { password })
        try {
          localStorage.removeItem('gmafj.in')
        } catch {
          /* nothing to remove */
        }
        location.href = '/'
      } catch (x) {
        toast(esc(x.message))
      }
    }
  })

  if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 300)
}
