/**
 * Settings, laid out as Instagram's (the owner, 2026-10-21: "replicate the layout of instagram, fix the
 * screen being too narrow and too long to scroll"): the sections in a list on the left, the one chosen on
 * the right; on a phone the list, then the section with a way back. One section at a time, so no page is
 * one long scroll.
 *
 * - Your profile: Edit profile (the photo and cover, cropped before they are sent, the cover shown as it
 *   will be; name, username, pronouns, headline, place, website, About), Experience and more (LinkedIn's
 *   sections and skills, one at a time), Open to work and hiring, Design your profile (HTML and CSS, or
 *   React, with a prompt for the member's own AI and a live preview), Recommendations.
 * - Who can see your content: Account privacy (a private account, as Instagram's), Blocked.
 * - Your account: Password and account, Appearance.
 *
 * Nothing here is for sale: no prices, no payments (the owner, 2026-10-08).
 */
import { $, API, api, avatar, cropImage, esc, me, param, profileUrl, toast, toggleTheme, upload, who } from '/app.js'
import { BASE_CSS, BASE_HTML, BASE_JSX, designPrompt, mb, mountDesign, parseAnswer, PLACEHOLDERS, PROFICIENCY, WORK_TYPE } from '/design.js'

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
    short: 'Certifications',
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
    short: 'Awards',
    add: 'Add an award',
    fields: [['title', 'Title', 'text', 150], ['issuer', 'Issued by', 'text', 150], ['date', 'Date', 'date'], ['description', 'Description', 'area', 1000]]
  },
  languages: { title: 'Languages', add: 'Add a language', fields: [['name', 'Language', 'text', 60], ['proficiency', 'Proficiency', 'select']] }
}
const blank = (kind) => Object.fromEntries(SECTIONS[kind].fields.map(([f, , type]) => [f, type === 'check' ? false : type === 'select' ? 'professional' : '']))
const filled = (kind, x) => SECTIONS[kind].fields.slice(0, kind === 'experience' ? 2 : 1).some(([f]) => String(x[f] ?? '').trim())
const commas = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ICON = {
  edit: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  sections: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  work: svg('<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>'),
  design: svg('<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 3-4 3h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
  recommendations: svg('<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  privacy: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  blocked: svg('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
  account: svg('<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l3 3M14.5 8.5l2 2"/>'),
  appearance: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
}
/** The list on the left, Instagram's groups. */
const GROUPS = [
  ['Your profile', [['edit', 'Edit profile'], ['sections', 'Experience and more'], ['work', 'Open to work and hiring'], ['design', 'Design your profile'], ['recommendations', 'Recommendations']]],
  ['Who can see your content', [['privacy', 'Account privacy'], ['blocked', 'Blocked']]],
  ['Your account', [['account', 'Password and account'], ['appearance', 'Appearance']]]
]
const PANES = GROUPS.flatMap(([, items]) => items.map(([id]) => id))
// Links from before this layout (#profile) still land somewhere sensible.
const OLD = { profile: 'edit' }

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/settings')
  const draft = structuredClone(me)
  main.innerHTML = `<div class="set">
<nav class="set-side" aria-label="Settings">
<h1>Settings</h1>
${GROUPS.map(([title, items]) => `<div class="set-group"><h2>${title}</h2>${items.map(([id, label]) => `<a href="#${id}" data-pane="${id}">${ICON[id]}<span>${label}</span></a>`).join('')}</div>`).join('')}
</nav>
<section class="set-pane" id="pane" aria-live="polite"></section>
</div>`
  const set = $('.set', main)
  const pane = $('#pane', main)
  let current = null
  let dirty = false

  /** A pane's frame: Back (on a phone), its title, and its body. */
  const frame = (title, body, sub = '') =>
    `<div class="pane-h"><button class="btn ghost small set-back" type="button" data-back>Back</button><div><h2>${title}</h2>${sub ? `<p class="muted small">${sub}</p>` : ''}</div></div>${body}`

  /** Changes not saved yet are asked about before leaving the pane. */
  const leave = () => !dirty || confirm('Leave without saving your changes?')
  pane.addEventListener('input', (e) => {
    if (e.target.closest('[data-dirty]')) dirty = true
  })
  addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault()
  })

  async function show(id, push = true) {
    id = OLD[id] ?? id
    if (!PANES.includes(id)) id = 'edit'
    if (current && id !== current && !leave()) return void history.replaceState(null, '', `#${current}`)
    dirty = false
    current = id
    if (push) history.replaceState(null, '', `#${id}`)
    for (const a of main.querySelectorAll('[data-pane]')) a.setAttribute('aria-current', String(a.dataset.pane === id))
    set.classList.add('open')
    // The design studio takes the width beside the list; the forms keep to a readable measure.
    pane.classList.toggle('wide', id === 'design')
    pane.innerHTML = '<div class="spin"></div>'
    pane.onclick = pane.onchange = pane.oninput = null
    try {
      await DRAW[id]()
    } catch (e) {
      pane.innerHTML = `<div class="empty"><h2>This could not load</h2><p>${esc(e.message)}</p></div>`
    }
    pane.scrollTop = 0
    if (matchMedia('(max-width: 767px)').matches) scrollTo({ top: 0 })
  }
  main.addEventListener('click', (e) => {
    const a = e.target.closest('[data-pane]')
    if (a) {
      e.preventDefault()
      return void show(a.dataset.pane)
    }
    if (e.target.closest('[data-back]')) {
      if (!leave()) return
      dirty = false
      set.classList.remove('open')
    }
  })
  addEventListener('hashchange', () => {
    const id = location.hash.slice(1)
    if (id && id !== current) void show(id, false)
  })

  /** A labelled box for one of the profile's own fields. */
  const input = (key, label, attrs = '') => `<label class="field"><span>${label}</span><input data-k="${key}" data-dirty value="${esc(draft[key] ?? '')}" ${attrs}></label>`
  /** What a pane saves: these fields of the draft, and nothing else. */
  async function save(fields, button) {
    const err = $('.save-bar .err', pane)
    if (err) err.hidden = true
    const fail = (m) => {
      if (!err) return toast(esc(m))
      err.textContent = m
      err.hidden = false
    }
    const body = Object.fromEntries(fields.map((f) => [f, draft[f]]))
    if ('handle' in body && !HANDLE.test(body.handle)) return fail('A username is 3 to 30 lower-case letters, digits, dots or underscores, starting and ending with a letter or digit.')
    if ('name' in body && !String(body.name).trim()) return fail('Your name cannot be empty.')
    if ('skills' in body) body.skills = [...new Set(body.skills.map((s) => s.slice(0, 60)))].slice(0, 60)
    for (const kind of Object.keys(SECTIONS)) if (kind in body) body[kind] = (body[kind] || []).filter((x) => filled(kind, x))
    button.disabled = true
    try {
      Object.assign(me, await api('PATCH', '/social/me', body))
      for (const f of fields) draft[f] = structuredClone(me[f])
      dirty = false
      toast(`Saved. <a href="${profileUrl(me)}">See your profile</a>`)
      return true
    } catch (x) {
      fail(x.message)
      return false
    } finally {
      button.disabled = false
    }
  }

  const DRAW = {
    // ── Edit profile: the pictures, as they will look, and who you are
    async edit() {
      const welcome = param('welcome')
        ? '<div class="card pad stack" style="margin-bottom:18px"><h3>Welcome to Oporch</h3><p class="muted">Add a photo and a headline so people know you. Have the desktop app? Fill everything in from it.</p></div>'
        : ''
      const pictures = () => `<div class="pic-head card">
<div class="pic-cover"${draft.cover ? ` style="background-image:url('${esc(API + draft.cover)}')"` : ''}>
<div class="pic-actions"><label class="btn ghost small">${draft.cover ? 'Change cover' : 'Add a cover'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pic="cover"></label>${draft.cover ? '<button class="btn ghost small" type="button" data-unpic="cover">Remove</button>' : ''}</div>
</div>
<div class="pic-me"><div class="pic-av">${avatar(draft, 'xl')}</div><div class="grow"><b>${esc(draft.name)}</b><div class="muted small">@${esc(draft.handle)}</div></div>
<div class="row wrap"><label class="btn small">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pic="avatar"></label>${draft.avatar ? '<button class="btn ghost small" type="button" data-unpic="avatar">Remove</button>' : ''}</div></div>
</div>`
      const fields = ['name', 'handle', 'pronouns', 'headline', 'location', 'website', 'about']
      pane.innerHTML = frame(
        'Edit profile',
        `${welcome}<div data-pics>${pictures()}</div>
<div class="stack" style="margin-top:20px">
<div class="grid2">${input('name', 'Name', 'maxlength="100" required autocomplete="name"')}${input('pronouns', 'Pronouns', 'maxlength="30" placeholder="she/her, he/him, they/them"')}</div>
<label class="field"><span>Username</span><input data-k="handle" data-dirty value="${esc(draft.handle)}" maxlength="30" pattern="[a-z0-9][a-z0-9._]{1,28}[a-z0-9]" autocapitalize="none" spellcheck="false"><span class="hint">Your profile’s address: ${esc(location.host)}/u?h=<b data-handle-preview>${esc(draft.handle)}</b></span></label>
${input('headline', 'Headline', 'maxlength="220" placeholder="What you do, or the job you want"')}
<div class="grid2">${input('location', 'Location', 'maxlength="100" placeholder="City, Country"')}${input('website', 'Website', 'maxlength="300" type="url" placeholder="https://"')}</div>
<label class="field"><span>About</span><textarea data-k="about" data-dirty maxlength="2600" style="min-height:150px">${esc(draft.about ?? '')}</textarea><span class="hint" data-left>${2600 - (draft.about ?? '').length} characters left</span></label>
</div>
<div class="save-bar"><button class="btn" type="button" data-save>Save</button><button class="btn ghost" type="button" data-import>Fill in from the desktop app</button><a class="textbtn" href="${profileUrl(me)}">See your profile</a><span class="err grow" hidden></span></div>`,
        'How people see you: your photo and cover, name, headline and About.'
      )
      pane.oninput = (e) => {
        const el = e.target.closest('[data-k]')
        if (!el) return
        draft[el.dataset.k] = el.value
        if (el.dataset.k === 'handle') $('[data-handle-preview]', pane).textContent = el.value
        if (el.dataset.k === 'about') $('[data-left]', pane).textContent = `${2600 - el.value.length} characters left`
      }
      pane.onchange = async (e) => {
        const picked = e.target.closest('[data-pic]')
        const file = picked?.files?.[0]
        if (!file) return
        const which = picked.dataset.pic
        picked.value = ''
        // Cropped first, the shape it will have: a circle for the photo, a wide band for the cover.
        const blob = await cropImage(file, which === 'avatar' ? { width: 400, height: 400, round: true, title: 'Crop your photo' } : { width: 1584, height: 396, title: 'Crop your cover' })
        if (!blob) return
        try {
          const pic = await upload(blob, which)
          Object.assign(me, await api('PATCH', '/social/me', { [which]: pic.id }))
          draft[which] = me[which]
          $('[data-pics]', pane).innerHTML = pictures()
          for (const slot of document.querySelectorAll('[data-me-av]')) slot.innerHTML = avatar(me, 'xs')
          toast(which === 'avatar' ? 'Photo changed.' : 'Cover changed.')
        } catch (x) {
          toast(esc(x.message))
        }
      }
      pane.onclick = async (e) => {
        const t = e.target
        const unpic = t.closest('[data-unpic]')
        if (unpic) {
          try {
            Object.assign(me, await api('PATCH', '/social/me', { [unpic.dataset.unpic]: null }))
            draft[unpic.dataset.unpic] = null
            $('[data-pics]', pane).innerHTML = pictures()
          } catch (x) {
            toast(esc(x.message))
          }
          return
        }
        if (t.closest('[data-import]')) return void importFromApp()
        if (t.closest('[data-save]')) await save(fields, t.closest('[data-save]'))
      }
    },

    // ── Experience and more: LinkedIn's sections, one at a time
    async sections() {
      let kind = 'experience'
      const tabs = () =>
        `<div class="feed-tabs sub-tabs" role="tablist">${[...Object.entries(SECTIONS).map(([k, s]) => [k, s.short ?? s.title]), ['skills', 'Skills']]
          .map(([k, t]) => `<button type="button" role="tab" data-kind="${k}" aria-selected="${k === kind}">${t}<span class="n">${k === 'skills' ? draft.skills.length || '' : (draft[k] || []).length || ''}</span></button>`)
          .join('')}</div>`
      const entryCard = (x, i) => {
        const k = (f) => `${kind}.${i}.${f}`
        const fields = SECTIONS[kind].fields
          .map(([f, label, type, max]) => {
            if (type === 'check') return `<label class="check span2"><input type="checkbox" data-k="${k(f)}" data-dirty${x[f] ? ' checked' : ''}><span>${label}</span></label>`
            if (type === 'area') return `<label class="field span2"><span>${label}</span><textarea data-k="${k(f)}" data-dirty maxlength="${max}">${esc(x[f] ?? '')}</textarea></label>`
            if (type === 'select')
              return `<label class="field"><span>${label}</span><select data-k="${k(f)}" data-dirty>${Object.entries(PROFICIENCY)
                .map(([v, t]) => `<option value="${v}"${x[f] === v ? ' selected' : ''}>${t}</option>`)
                .join('')}</select></label>`
            const attrs = type === 'date' ? 'maxlength="20" placeholder="2023-04"' : type === 'url' ? `type="url" maxlength="${max}" placeholder="https://"` : `maxlength="${max}"`
            return `<label class="field"><span>${label}</span><input data-k="${k(f)}" data-dirty value="${esc(x[f] ?? '')}" ${attrs}${f === 'end' && x.current ? ' disabled' : ''}></label>`
          })
          .join('')
        return `<div class="card"><button class="btn ghost small rm" type="button" data-rm="${i}">Remove</button><div class="grid2 entry-ed">${fields}</div></div>`
      }
      const body = () =>
        kind === 'skills'
          ? `<label class="field"><span>Skills, separated by commas (up to 60)</span><input data-k="skills" data-dirty value="${esc(draft.skills.join(', '))}" placeholder="SQL, Excel, Python"></label>
<p class="muted small" style="margin-top:6px">People who follow each other can endorse them. A skill you take off takes its endorsements with it.</p>`
          : `<div class="sec-h"><h3>${SECTIONS[kind].title}</h3><button class="btn ghost small" type="button" data-add>${SECTIONS[kind].add}</button></div>
<div class="list-ed">${(draft[kind] || []).map(entryCard).join('') || '<p class="muted small">Nothing added yet.</p>'}</div>
<p class="muted small" style="margin-top:10px">Dates as 2023-04 (April 2023), or a year.</p>`
      const draw = () => {
        pane.innerHTML = frame(
          'Experience and more',
          `${tabs()}<div class="stack sub-body">${body()}</div>
<div class="save-bar"><button class="btn" type="button" data-save>Save</button><button class="btn ghost" type="button" data-import>Fill in from the desktop app</button><span class="err grow" hidden></span></div>`,
          'What you have done, as LinkedIn lays it out. Everything here shows on your profile.'
        )
      }
      draw()
      pane.oninput = (e) => {
        const el = e.target
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
      }
      pane.onchange = pane.oninput
      pane.onclick = async (e) => {
        const t = e.target
        const tab = t.closest('[data-kind]')
        if (tab) {
          kind = tab.dataset.kind
          return draw()
        }
        if (t.closest('[data-add]')) {
          ;(draft[kind] ||= []).push(blank(kind))
          dirty = true
          draw()
          return void [...pane.querySelectorAll(`[data-k^="${kind}."]`)].at(-SECTIONS[kind].fields.length)?.focus()
        }
        const rm = t.closest('[data-rm]')
        if (rm) {
          draft[kind].splice(+rm.dataset.rm, 1)
          dirty = true
          return draw()
        }
        if (t.closest('[data-import]')) return void importFromApp(draw)
        if (t.closest('[data-save]')) {
          if (await save([...Object.keys(SECTIONS), 'skills'], t.closest('[data-save]'))) draw()
        }
      }
    },

    // ── Open to work and hiring
    async work() {
      const draw = () => {
        const o = draft.openToWork
        pane.innerHTML = frame(
          'Open to work and hiring',
          `<div class="stack">
<label class="check"><input type="checkbox" data-otw-on data-dirty${o ? ' checked' : ''}><span><b>I am open to work</b><br><span class="muted small">Recruiters and the people who follow you see what you are looking for. The #OpenToWork frame on your photo is up to you.</span></span></label>
${
  o
    ? `<div class="grid2">
<label class="field"><span>Job titles, separated by commas (up to 5)</span><input data-otw="titles" data-dirty value="${esc(o.titles.join(', '))}" placeholder="Data Analyst, Product Analyst"></label>
<label class="field"><span>Locations, separated by commas (up to 5)</span><input data-otw="places" data-dirty value="${esc(o.places.join(', '))}" placeholder="Bengaluru, Remote"></label></div>
<div class="row wrap"><span class="small" style="font-weight:600">Workplace</span>${Object.entries(WORK_TYPE)
        .map(([v, t]) => `<label class="check"><input type="checkbox" data-otw-type="${v}" data-dirty${o.types.includes(v) ? ' checked' : ''}><span>${t}</span></label>`)
        .join('')}</div>
<div class="grid2"><label class="field"><span>Start date</span><select data-otw="start" data-dirty><option value="flexible"${o.start === 'flexible' ? ' selected' : ''}>Flexible</option><option value="now"${o.start === 'now' ? ' selected' : ''}>Immediately, I am actively applying</option></select></label></div>
<label class="check"><input type="checkbox" data-otw="frame" data-dirty${o.frame ? ' checked' : ''}><span>Show the #OpenToWork frame on my photo</span></label>`
    : ''
}
<label class="check"><input type="checkbox" data-hiring data-dirty${draft.hiring ? ' checked' : ''}><span><b>I am hiring</b><br><span class="muted small">Puts the #Hiring frame on your photo, so people know to message you about roles.</span></span></label>
</div>
<div class="save-bar"><button class="btn" type="button" data-save>Save</button><span class="err grow" hidden></span></div>`,
          'Let people know what you are looking for, or that you are hiring.'
        )
      }
      draw()
      const read = (e) => {
        const el = e.target
        if (el.matches('[data-otw]')) {
          const f = el.dataset.otw
          draft.openToWork[f] = f === 'frame' ? el.checked : f === 'start' ? el.value : commas(el.value).slice(0, 5)
        } else if (el.matches('[data-otw-type]')) {
          const types = new Set(draft.openToWork.types)
          el.checked ? types.add(el.dataset.otwType) : types.delete(el.dataset.otwType)
          draft.openToWork.types = [...types]
        } else if (el.matches('[data-otw-on]')) {
          draft.openToWork = el.checked ? (me.openToWork ? structuredClone(me.openToWork) : { titles: [], places: [], types: [], start: 'flexible', frame: true }) : null
          draw()
          dirty = true
        } else if (el.matches('[data-hiring]')) draft.hiring = el.checked
      }
      pane.onchange = read
      pane.oninput = (e) => e.target.matches('input[type=text], input:not([type])') && read(e)
      pane.onclick = async (e) => {
        if (e.target.closest('[data-save]')) await save(['openToWork', 'hiring'], e.target.closest('[data-save]'))
      }
    },

    async design() {
      await designPane()
    },

    // ── Recommendations: written for you (shown when you say so) and by you
    async recommendations() {
      const r = await api('GET', '/social/me/recommendations')
      const STATE = { pending: '<span class="state pending">New</span>', shown: '<span class="state approved">On your profile</span>', hidden: '<span class="state">Hidden</span>' }
      const card = (x, mine) => `<div class="rec-ed" data-rec="${x.id}"><div class="row">${who(mine ? x.about : x.author, x.relationship)}${mine ? '' : STATE[x.state] ?? ''}</div><p class="pre small">${esc(x.text)}</p><div class="row wrap">${
        mine
          ? '<button class="btn ghost small" type="button" data-rec-del>Delete</button>'
          : `${x.state !== 'shown' ? '<button class="btn small" type="button" data-rec-state="shown">Show on my profile</button>' : '<button class="btn ghost small" type="button" data-rec-state="hidden">Hide</button>'}<button class="btn ghost small" type="button" data-rec-del>Delete</button>`
      }</div></div>`
      pane.innerHTML = frame(
        'Recommendations',
        `<div class="card pad"><h3 style="margin-bottom:10px">Received</h3>${r.received.map((x) => card(x, false)).join('') || '<p class="muted small">None yet.</p>'}</div>
<div class="card pad" style="margin-top:16px"><h3 style="margin-bottom:10px">Given</h3>${r.given.map((x) => card(x, true)).join('') || '<p class="muted small">None yet. Recommend someone you follow each other with, from their profile.</p>'}</div>`,
        'People who follow each other with you can recommend you. A recommendation shows on your profile only once you choose to show it.'
      )
      pane.onclick = async (e) => {
        const el = e.target.closest('[data-rec]')
        if (!el) return
        const state = e.target.closest('[data-rec-state]')?.dataset.recState
        try {
          if (state) await api('PATCH', `/social/recommendations/${el.dataset.rec}`, { state })
          else if (e.target.closest('[data-rec-del]')) {
            if (!confirm('Delete this recommendation?')) return
            await api('DELETE', `/social/recommendations/${el.dataset.rec}`)
          } else return
          void DRAW.recommendations()
        } catch (x) {
          toast(esc(x.message))
        }
      }
    },

    // ── Account privacy: saved as soon as it is changed
    async privacy() {
      const tick = (key, title, text) => `<label class="toggle"><span><b>${title}</b><span class="muted small">${text}</span></span><input type="checkbox" role="switch" data-p="${key}"${me[key] ? ' checked' : ''}></label>`
      pane.innerHTML = frame(
        'Account privacy',
        `<div class="card">
${tick('privateAccount', 'Private account', 'Only the people you approve can follow you and see your updates, your followers and who you follow. Your name, photo, headline and profile sections stay visible to everyone, so recruiters can find you. Turning it off approves everyone waiting.')}
${tick('profilePublic', 'Visitors without an account can see my profile', 'Off: only people signed in to Oporch can. Updates for anyone stay open to whoever has their link.')}
${tick('appliesVisible', 'People who follow me can see the jobs I apply to', 'They see your face on a job you applied to with Apply or One click apply. Off: you are only counted, never named.')}
${tick('privateViewing', 'View profiles privately', 'People whose profiles you open see "Someone on Oporch" instead of your name. Like on LinkedIn, you then see only how many people viewed yours, not who.')}
<label class="toggle"><span><b>Who can see my email address</b><span class="muted small">In your profile’s Contact info.</span></span><select class="input" data-p="emailVisible" style="width:auto"><option value="mutual"${me.emailVisible !== 'nobody' ? ' selected' : ''}>People who follow each other with me</option><option value="nobody"${me.emailVisible === 'nobody' ? ' selected' : ''}>Nobody</option></select></label>
</div>`,
        'Who can follow you, see your updates, and find you.'
      )
      pane.onchange = async (e) => {
        const box = e.target.closest('[data-p]')
        if (!box) return
        const value = box.type === 'checkbox' ? box.checked : box.value
        if (box.dataset.p === 'privateAccount' && !value && !confirm('Make your account public? Anyone can then follow you and see your updates, and everyone waiting to follow you is approved.')) {
          box.checked = true
          return
        }
        try {
          Object.assign(me, await api('PATCH', '/social/me', { [box.dataset.p]: value }))
          toast('Saved.')
        } catch (x) {
          if (box.type === 'checkbox') box.checked = !box.checked
          toast(esc(x.message))
        }
      }
    },

    // ── Blocked
    async blocked() {
      const r = await api('GET', '/social/me/blocked')
      pane.innerHTML = frame(
        'Blocked',
        `<div class="card pad">${
          r.people.length
            ? r.people.map((p) => `<div class="person">${who(p)}<button class="btn ghost small" type="button" data-unblock="${esc(p.handle)}">Unblock</button></div>`).join('')
            : '<p class="muted small">You have not blocked anyone. Block someone from the More button on their profile.</p>'
        }</div>`,
        'People you blocked cannot see you, and you cannot see them.'
      )
      pane.onclick = async (e) => {
        const b = e.target.closest('[data-unblock]')
        if (!b) return
        await api('DELETE', `/social/block/${encodeURIComponent(b.dataset.unblock)}`).catch((x) => toast(esc(x.message)))
        void DRAW.blocked()
      }
    },

    // ── Password and account
    async account() {
      pane.innerHTML = frame(
        'Password and account',
        `<div class="card pad stack">
<p>Signed in as <b>${esc(me.email)}</b>. The same account signs in to the desktop app.</p>
<div class="row wrap"><a class="btn ghost" href="/items">My items</a><a class="btn ghost" href="/views">Who viewed your profile</a><button class="btn ghost" type="button" data-signout>Log out</button></div>
</div>
<div class="card pad stack" style="margin-top:16px"><h3>Change your password</h3>
<div class="stack" style="max-width:360px">
<label class="field"><span>Current password</span><input type="password" autocomplete="current-password" data-pw-now></label>
<label class="field"><span>New password, at least 10 characters</span><input type="password" autocomplete="new-password" minlength="10" data-pw-new></label>
<p class="muted small">Every other device, the app included, signs out.</p>
<div><button class="btn" type="button" data-pw>Change password</button></div></div></div>
<div class="card pad stack danger-zone" style="margin-top:16px"><h3>Delete your account</h3>
<p class="muted small">This deletes your account, profile, updates, comments, messages, followers and pictures, here and in the app. It cannot be undone.</p>
<label class="field" style="max-width:360px"><span>Your password</span><input type="password" autocomplete="current-password" data-delpw></label>
<div><button class="btn danger" type="button" data-delete>Delete everything</button></div></div>`,
        'Your sign-in, your password, and your account.'
      )
      pane.onclick = async (e) => {
        if (e.target.closest('[data-pw]')) {
          try {
            await api('POST', '/auth/change-password', { current: $('[data-pw-now]', pane).value, password: $('[data-pw-new]', pane).value })
            $('[data-pw-now]', pane).value = $('[data-pw-new]', pane).value = ''
            toast('Password changed. Other devices are signed out.')
          } catch (x) {
            toast(esc(x.message))
          }
          return
        }
        if (e.target.closest('[data-delete]')) {
          const password = $('[data-delpw]', pane).value
          if (!password) return toast('Type your password to confirm.')
          if (!confirm('Delete your Oporch account and everything in it? This cannot be undone.')) return
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
      }
    },

    // ── Appearance, as the More menu and the desktop app's account menu offer it
    async appearance() {
      const dark = document.documentElement.classList.contains('dark')
      pane.innerHTML = frame(
        'Appearance',
        `<div class="card"><label class="toggle"><span><b>Light</b><span class="muted small">The default.</span></span><input type="radio" name="theme" value="light"${dark ? '' : ' checked'}></label>
<label class="toggle"><span><b>Dark</b><span class="muted small">Easier on the eyes at night. Remembered on this browser.</span></span><input type="radio" name="theme" value="dark"${dark ? ' checked' : ''}></label></div>`,
        'How Oporch looks on this device.'
      )
      pane.onchange = (e) => {
        const want = e.target.value === 'dark'
        if (want !== document.documentElement.classList.contains('dark')) toggleTheme()
      }
    }
  }

  /** "Fill in from the desktop app": what the app knows goes into the draft, to be checked and saved. */
  async function importFromApp(redraw) {
    try {
      const got = await api('GET', '/social/me/import')
      for (const [k, v] of Object.entries(got)) if (v && (!Array.isArray(v) || v.length)) draft[k] = v
      dirty = true
      if (redraw) redraw()
      else for (const el of pane.querySelectorAll('[data-k]')) if (typeof draft[el.dataset.k] === 'string') el.value = draft[el.dataset.k]
      toast('Filled in from your desktop app. Check it, then press Save. Experience and the rest are under Experience and more.', 8000)
    } catch (x) {
      toast(esc(x.message), 7000)
    }
  }

  // ── Design your profile: HTML and CSS or React, your AI's or your own, its pictures, a live preview, the review
  /** `keep`: the code typed so far, when the pane is drawn again (a picture added or removed). */
  async function designPane(keep = null) {
    const [d, mine, pics, updates] = await Promise.all([
      api('GET', '/social/me/design'),
      api('GET', `/social/u/${encodeURIComponent(me.handle)}`),
      api('GET', '/social/me/design/media'),
      api('GET', `/social/u/${encodeURIComponent(me.handle)}/updates`).then((r) => r.updates)
    ])
    const canPublish = (me.features ?? []).includes('design')
    const state = {
      none: '',
      pending: '<span class="state pending">Waiting for review</span>',
      approved: '<span class="state approved">Approved and on your profile</span>',
      rejected: '<span class="state rejected">Not approved</span>'
    }[d.state]
    let kind = keep?.kind ?? (d.kind === 'react' ? 'react' : 'html')
    // Each kind keeps its own code while you switch between them; nothing designed yet starts from the standard profile.
    const code = keep?.code ?? { html: d.kind === 'html' && d.html.trim() ? d.html : BASE_HTML, react: d.kind === 'react' && d.jsx.trim() ? d.jsx : BASE_JSX }
    const css = keep?.css ?? { html: d.kind === 'html' && d.html.trim() ? d.css : BASE_CSS, react: d.kind === 'react' && d.jsx.trim() ? d.css : BASE_CSS }
    const kept = () => ({ kind, code: { ...code }, css: { ...css } })
    const address = (f) => `${API}${f.path}`
    pane.innerHTML = frame(
      `Design your profile ${state}`,
      `${d.state === 'rejected' && d.note ? `<p class="err">Why it was not approved: ${esc(d.note)}</p>` : ''}
${d.live && d.state !== 'approved' ? '<p class="muted small">Your last approved design stays up until this one is approved.</p>' : ''}
${canPublish ? '' : '<p><b>Publishing a design is part of Pro.</b> You can still try one out here.</p>'}
<div class="kind-pick" role="radiogroup" aria-label="How you make it">
<label><input type="radio" name="kind" value="html"${kind === 'html' ? ' checked' : ''}><span><b>HTML and CSS</b><span class="muted small">A page and its styles. Your details fill in through placeholders.</span></span></label>
<label><input type="radio" name="kind" value="react"${kind === 'react' ? ' checked' : ''}><span><b>React</b><span class="muted small">A component that gets your whole profile. Tabs, filters, animation: anything interactive.</span></span></label>
</div>
<details class="ai card"><summary><b>Design it with your AI</b><span class="muted small">Copy a prompt into the AI you use, then paste its answer</span></summary>
<div class="stack" style="padding:0 18px 18px">
<p class="muted small">Change the first lines to say how you want it to look, then copy the whole prompt. Upload your pictures first (below) so the prompt lists them.</p>
<textarea class="textarea code prompt" data-prompt spellcheck="false"></textarea>
<div class="row wrap"><button class="btn" type="button" data-copy>Copy the prompt</button><button class="btn ghost small" type="button" data-reprompt>Start the prompt again</button></div>
<label class="field"><span>Its answer</span><textarea class="textarea code" data-answer spellcheck="false" placeholder="Paste the AI’s whole answer here, with its code blocks" style="min-height:100px"></textarea></label>
<div class="row wrap"><button class="btn" type="button" data-use>Use this answer</button><span class="muted small">It fills in the code below, and the preview.</span></div>
</div></details>
<div class="studio">
<div class="stack studio-code">
<label class="field"><span data-code-label></span><textarea class="code" data-d="code" data-dirty spellcheck="false"></textarea></label>
<p class="err small" data-compile hidden></p>
<label class="field"><span>CSS</span><textarea class="code" data-d="css" data-dirty spellcheck="false"></textarea></label>
<details class="code-v" data-help></details>
<div class="row wrap"><button class="btn ghost small" type="button" data-dbase>Start again from the standard profile</button></div>
</div>
<div class="studio-prev"><div class="sec-h" style="margin:0 0 8px"><h3>Preview</h3><span class="muted small">As people will see it</span></div><div id="dprev" class="dprev"></div></div>
</div>
<div class="card pad stack" style="margin-top:16px">
<div class="sec-h" style="margin:0"><h3>Pictures and GIFs</h3><span class="muted small" data-meter></span></div>
<div class="meter"><span data-bar></span></div>
<p class="muted small">JPEG, PNG or GIF (GIFs up to 5 MB), at most ${pics.maxFiles}. Your design, with its pictures, can be up to ${mb(pics.budget)}.</p>
<div class="pics">${pics.files
        .map(
          (f) => `<div class="pic" data-pic-id="${esc(f.id)}"><img src="${esc(address(f))}" alt=""><div class="small muted">${mb(f.bytes)}</div><div class="row wrap" style="gap:4px"><button class="btn ghost small" type="button" data-insert>Insert</button><button class="btn ghost small" type="button" data-copyurl>Copy address</button><button class="btn ghost small" type="button" data-pic-rm>Remove</button></div></div>`
        )
        .join('')}${pics.files.length < pics.maxFiles ? '<label class="pic add"><input type="file" accept="image/jpeg,image/png,image/gif" hidden data-dpic><span>Upload a picture</span></label>' : ''}</div>
</div>
<div class="save-bar"><button class="btn" type="button" data-dsend${canPublish ? '' : ' disabled'}>Send for review</button>${d.state !== 'none' ? '<button class="btn danger" type="button" data-ddel>Remove my design</button>' : ''}<span class="err grow" hidden></span></div>`,
      'Make your profile your own. Your updates, projects, experience and everything else fill in by themselves, so it stays up to date. We check every design before it shows on your profile.'
    )

    const codeBox = $('[data-d=code]', pane)
    const cssBox = $('[data-d=css]', pane)
    const prev = $('#dprev', pane)
    const compileErr = $('[data-compile]', pane)
    const err = $('.save-bar .err', pane)
    const picBytes = pics.files.reduce((s, f) => s + f.bytes, 0)
    const meter = () => {
      const used = picBytes + new Blob([codeBox.value]).size + new Blob([cssBox.value]).size
      $('[data-meter]', pane).textContent = `${mb(used)} of ${mb(pics.budget)} used`
      $('[data-bar]', pane).style.width = `${Math.min(100, (used / pics.budget) * 100)}%`
      $('.meter', pane).classList.toggle('over', used > pics.budget)
    }
    const help = () =>
      kind === 'react'
        ? `<summary>What your component gets</summary><p class="small" style="margin:6px 0">One file, <code class="code">export default function Profile({ profile })</code>, rendered with React 19. Import from <code class="code">react</code> only. <code class="code">profile</code> holds: name, pronouns, headline, location, about, website, handle, url, joined, initials, counts (followers, following, updates), avatar and cover (addresses or null), openToWork, hiring, experience, education, certifications, projects, volunteering, honors, languages, skills, recommendations, featured and updates (each with url, date, text, image). The AI prompt above describes every field.</p>`
        : `<summary>What the placeholders fill in</summary><ul class="small" style="margin:6px 0 0 18px">${Object.entries(PLACEHOLDERS)
            .map(([k, v]) => `<li><code class="code">{{${k}}}</code> ${esc(v)}</li>`)
            .join('')}<li><code class="code">data-if="name"</code> on any element shows it only when that placeholder has something</li></ul>`
    const prompt = () => designPrompt({ kind, headline: me.headline, pictures: pics.files.map(address) })
    /** The preview: an HTML design at once; a React one compiled by the server first, its mistakes said under the code. */
    let compiling = 0
    const preview = async () => {
      meter()
      if (kind === 'html') {
        compileErr.hidden = true
        mountDesign(prev, { kind: 'html', html: codeBox.value, css: cssBox.value }, mine, updates)
        return
      }
      const mineNow = ++compiling
      try {
        const r = await api('POST', '/social/me/design/compile', { jsx: codeBox.value })
        if (mineNow !== compiling) return
        compileErr.hidden = true
        mountDesign(prev, { kind: 'react', js: r.js, css: cssBox.value }, mine, updates, (why) => {
          compileErr.textContent = `It compiled, but did not run: ${why}`
          compileErr.hidden = false
        })
      } catch (x) {
        if (mineNow !== compiling) return
        compileErr.textContent = x.message
        compileErr.hidden = false
      }
    }
    const fill = () => {
      $('[data-code-label]', pane).textContent = kind === 'react' ? 'React (JSX)' : 'HTML'
      codeBox.value = code[kind]
      cssBox.value = css[kind]
      $('[data-help]', pane).innerHTML = help()
      $('[data-prompt]', pane).value = prompt()
      void preview()
    }
    fill()
    let typing = 0
    pane.oninput = (e) => {
      if (!e.target.closest('[data-d]')) return
      code[kind] = codeBox.value
      css[kind] = cssBox.value
      clearTimeout(typing)
      typing = setTimeout(preview, kind === 'react' ? 800 : 400)
    }
    pane.onchange = async (e) => {
      if (e.target.name === 'kind') {
        kind = e.target.value
        return fill()
      }
      const input = e.target.closest('[data-dpic]')
      const file = input?.files?.[0]
      if (!file) return
      try {
        await upload(file, 'design', 2000)
        // The code typed so far stays: the pane is drawn again from it.
        await designPane(kept())
        toast('Uploaded. Insert it into your code, or ask your AI to use it.')
      } catch (x) {
        toast(esc(x.message))
      }
    }
    const insert = (url) => {
      const tag = kind === 'react' ? `<img src="${url}" alt="" />` : `<img src="${url}" alt="">`
      const at = codeBox.selectionStart ?? codeBox.value.length
      codeBox.value = codeBox.value.slice(0, at) + tag + codeBox.value.slice(at)
      code[kind] = codeBox.value
      dirty = true
      void preview()
    }
    pane.onclick = async (e) => {
      const t = e.target
      if (t.closest('[data-copy]')) {
        try {
          await navigator.clipboard.writeText($('[data-prompt]', pane).value)
          toast('Prompt copied. Paste it into your AI.')
        } catch {
          $('[data-prompt]', pane).select()
          toast('Press Ctrl+C (or Cmd+C) to copy it.')
        }
        return
      }
      if (t.closest('[data-reprompt]')) return void ($('[data-prompt]', pane).value = prompt())
      if (t.closest('[data-use]')) {
        const got = parseAnswer($('[data-answer]', pane).value, kind)
        const body = kind === 'react' ? got.jsx : got.html
        if (!body) return toast(kind === 'react' ? 'That answer has no React code in it. Paste the whole answer, with its code blocks.' : 'That answer has no HTML in it. Paste the whole answer, with its code blocks.')
        code[kind] = body
        css[kind] = got.css
        dirty = true
        fill()
        prev.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return toast('Your design is in. Check the preview, then send it for review.')
      }
      if (t.closest('[data-dbase]')) {
        if (!confirm('Replace your code with the standard profile?')) return
        code[kind] = kind === 'react' ? BASE_JSX : BASE_HTML
        css[kind] = BASE_CSS
        dirty = true
        return fill()
      }
      const pic = t.closest('[data-pic-id]')
      if (pic) {
        const url = `${API}/media/${pic.dataset.picId}`
        if (t.closest('[data-insert]')) return insert(url)
        if (t.closest('[data-copyurl]')) {
          await navigator.clipboard.writeText(url).then(() => toast('Address copied.'), () => prompt('Copy this address:', url))
          return
        }
        if (t.closest('[data-pic-rm]')) {
          if (!confirm('Remove this picture? A design that uses it will show nothing there.')) return
          await api('DELETE', `/social/media/${encodeURIComponent(pic.dataset.picId)}`).catch((x) => toast(esc(x.message)))
          return void designPane(kept())
        }
      }
      if (t.closest('[data-dsend]')) {
        err.hidden = true
        try {
          await api('PUT', '/social/me/design', kind === 'react' ? { kind, jsx: codeBox.value, css: cssBox.value } : { kind, html: codeBox.value, css: cssBox.value })
          dirty = false
          toast('Sent for review. We will email you when it is decided.')
          void designPane()
        } catch (x) {
          err.textContent = x.message
          err.hidden = false
        }
        return
      }
      if (t.closest('[data-ddel]')) {
        if (!confirm('Remove your design? Your profile goes back to the standard one.')) return
        await api('DELETE', '/social/me/design').catch((x) => toast(esc(x.message)))
        dirty = false
        void designPane()
      }
    }
  }

  // Straight to a section when the address names one; on a wide screen, the first otherwise.
  const asked = location.hash.slice(1)
  if (asked || !matchMedia('(max-width: 767px)').matches) void show(asked || 'edit', !!asked)
}
