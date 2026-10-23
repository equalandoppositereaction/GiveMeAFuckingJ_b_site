/**
 * Settings, laid out as Instagram's (the owner, 2026-10-21: "replicate the layout of instagram, fix the
 * screen being too narrow and too long to scroll"): the sections in a list on the left, the one chosen on
 * the right; on a phone the list, then the section with a way back. One section at a time, so no page is
 * one long scroll. Every menu's title in title case (the owner, 2026-10-23: "like 'Password and Account'").
 *
 * - Your Profile: Edit Profile (the photo and cover, cropped before they are sent; name, username, pronouns,
 *   the bio's lines, place, About; links, each a name and an address, shown as buttons with an icon), Other
 *   Details (projects with their pictures and videos, LinkedIn's sections and skills, one at a time), Open to
 *   Work and Hiring (one or the other, never both), Design Your Profile (files dropped in, the template and a
 *   prompt for the member's own AI, a preview below at full width).
 * - Who Can See Your Content: Account Privacy (a private account, as Instagram's), Blocked.
 * - Your Account: Password and Account, Appearance.
 *
 * Recommendations are one press on a profile since 2026-10-22, nothing to manage here: someone's
 * recommendation of you is taken off from the list of who recommends you, on your profile.
 *
 * Nothing here is for sale: no prices, no payments (the owner, 2026-10-08).
 */
import { $, API, api, avatar, cropImage, dialog, esc, linkIcon, me, param, profileUrl, toast, toggleTheme, upload, who, ytId } from '/app.js'
import {
  JOB_TYPE,
  PROFICIENCY,
  START,
  TEMPLATE_CSS,
  TEMPLATE_HTML,
  TEMPLATE_JS,
  WORK_TYPE,
  designPrompt,
  designReadme,
  download,
  droppedFiles,
  mb,
  mountDesign,
  parseAnswer,
  sortFiles,
  zip
} from '/design.js'

const HANDLE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/

/** LinkedIn's sections, as the editor shows them: [field, label, kind, most characters]. The first field must be filled. */
const SECTIONS = {
  projects: {
    title: 'Projects',
    add: 'Add a project',
    fields: [
      ['name', 'Project name', 'text', 150],
      ['start', 'Start', 'date'],
      ['end', 'End', 'date'],
      ['url', 'Link to the project', 'url', 300],
      ['video', 'YouTube video', 'url', 300],
      ['skills', 'Skills and tools used, separated by commas', 'list', 15],
      ['description', 'What it is, and what you did', 'area', 2000],
      ['image', 'Picture', 'pic']
    ]
  },
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
const blank = (kind) => Object.fromEntries(SECTIONS[kind].fields.map(([f, , type]) => [f, type === 'check' ? false : type === 'select' ? 'professional' : type === 'list' ? [] : type === 'pic' ? null : '']))
const filled = (kind, x) => SECTIONS[kind].fields.slice(0, kind === 'experience' ? 2 : 1).some(([f]) => String(x[f] ?? '').trim())
const commas = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)
const typeOf = (kind, field) => SECTIONS[kind]?.fields.find(([f]) => f === field)?.[2]

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ICON = {
  edit: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  sections: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  work: svg('<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>'),
  design: svg('<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 3-4 3h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
  privacy: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  blocked: svg('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
  account: svg('<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l3 3M14.5 8.5l2 2"/>'),
  appearance: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
}
const UPLOAD = svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>')
/** The list on the left, Instagram's groups, every title in title case (the owner, 2026-10-23). */
const GROUPS = [
  ['Your Profile', [['edit', 'Edit Profile'], ['sections', 'Other Details'], ['work', 'Open to Work and Hiring'], ['design', 'Design Your Profile']]],
  ['Who Can See Your Content', [['privacy', 'Account Privacy'], ['blocked', 'Blocked']]],
  ['Your Account', [['account', 'Password and Account'], ['appearance', 'Appearance']]]
]
const TITLE = Object.fromEntries(GROUPS.flatMap(([, items]) => items))
const PANES = Object.keys(TITLE)
// Links from before this layout (#profile), and to the Recommendations there were, still land somewhere sensible.
const OLD = { profile: 'edit', recommendations: 'edit' }
/** Names offered for a link; any other name is fine too. */
const LINK_NAMES = ['Website', 'Portfolio', 'Google Scholar', 'GitHub', 'LinkedIn', 'Behance', 'Dribbble', 'YouTube', 'Blog', 'Résumé']

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
  const frame = (id, body, sub = '', extra = '') =>
    `<div class="pane-h"><button class="btn ghost small set-back" type="button" data-back>Back</button><div><h2>${TITLE[id]}${extra}</h2>${sub ? `<p class="muted small">${sub}</p>` : ''}</div></div>${body}`

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
    if ('headline' in body && String(body.headline).split('\n').length > 8) return fail('A bio has up to 8 lines.')
    if ('links' in body) {
      body.links = (body.links || []).map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.label || l.url)
      for (const l of body.links) if (l.url && !/^[a-z][a-z0-9+.-]*:/i.test(l.url)) l.url = `https://${l.url}`
      if (body.links.some((l) => !l.label)) return fail('Give each link a name, like Website or Portfolio.')
      if (body.links.some((l) => !/^https?:\/\/[^\s<>"]+$/i.test(l.url))) return fail('Each link needs a web address, starting with https://')
    }
    if ('skills' in body) body.skills = [...new Set(body.skills.map((s) => s.slice(0, 60)))].slice(0, 60)
    for (const kind of Object.keys(SECTIONS)) if (kind in body) body[kind] = (body[kind] || []).filter((x) => filled(kind, x))
    if ((body.projects || []).some((x) => x.video && !ytId(x.video))) return fail('A project’s video is a YouTube link, like https://youtu.be/…')
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
    // ── Edit Profile: the pictures, as they will look, who you are, and your links
    async edit() {
      const welcome = param('welcome')
        ? '<div class="card pad stack" style="margin-bottom:18px"><h3>Welcome to Oporch</h3><p class="muted">Add a photo, a bio and links to your work, so people know you. Have the desktop app? Fill everything in from it.</p></div>'
        : ''
      const pictures = () => `<div class="pic-head card">
<div class="pic-cover"${draft.cover ? ` style="background-image:url('${esc(API + draft.cover)}')"` : ''}>
<div class="pic-actions"><label class="btn ghost small">${draft.cover ? 'Change cover' : 'Add a cover'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pic="cover"></label>${draft.cover ? '<button class="btn ghost small" type="button" data-unpic="cover">Remove</button>' : ''}</div>
</div>
<div class="pic-me"><div class="pic-av">${avatar(draft, 'xl')}</div><div class="grow"><b>${esc(draft.name)}</b><div class="muted small">@${esc(draft.handle)}</div></div>
<div class="row wrap"><label class="btn small">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pic="avatar"></label>${draft.avatar ? '<button class="btn ghost small" type="button" data-unpic="avatar">Remove</button>' : ''}</div></div>
</div>`
      /** One link: its icon as it will show, its name, and where it goes. */
      const linkRow = (l, i) => `<div class="link-row" data-link="${i}"><span class="link-ic" data-link-ic>${linkIcon(l)}</span><input class="input" data-link-label list="link-names" maxlength="40" placeholder="Name, like Website" value="${esc(l.label)}" aria-label="The link’s name"><input class="input" data-link-url type="url" maxlength="500" placeholder="https://" value="${esc(l.url)}" aria-label="Where it goes"><button class="btn ghost small" type="button" data-rm-link aria-label="Remove this link">Remove</button></div>`
      const linkList = () => (draft.links || []).map(linkRow).join('') || '<p class="muted small">No links yet.</p>'
      const fields = ['name', 'handle', 'pronouns', 'headline', 'location', 'about', 'links']
      pane.innerHTML = frame(
        'edit',
        `${welcome}<div data-pics>${pictures()}</div>
<div class="stack" style="margin-top:20px">
<div class="grid2">${input('name', 'Name', 'maxlength="100" required autocomplete="name"')}${input('pronouns', 'Pronouns', 'maxlength="30" placeholder="she/her, he/him, they/them"')}</div>
<label class="field"><span>Username</span><input data-k="handle" data-dirty value="${esc(draft.handle)}" maxlength="30" pattern="[a-z0-9][a-z0-9._]{1,28}[a-z0-9]" autocapitalize="none" spellcheck="false"><span class="hint">Your profile’s address: ${esc(location.host)}/u/<b data-handle-preview>${esc(draft.handle)}</b></span></label>
<label class="field"><span>Bio</span><textarea data-k="headline" data-dirty maxlength="300" rows="4" style="min-height:96px" placeholder="What you do and what you make. Use a few lines if you like.">${esc(draft.headline ?? '')}</textarea><span class="hint" data-bio-left>${300 - (draft.headline ?? '').length} characters left, up to 8 lines</span></label>
${input('location', 'Location', 'maxlength="100" placeholder="City, Country"')}
<label class="field"><span>About</span><textarea data-k="about" data-dirty maxlength="2600" style="min-height:150px">${esc(draft.about ?? '')}</textarea><span class="hint" data-left>${2600 - (draft.about ?? '').length} characters left</span></label>
</div>
<section class="card pad stack links-ed" aria-labelledby="links-h">
<div><h3 id="links-h">Links</h3><p class="muted small">Buttons on the right of your profile, under your cover: each shows its name and an icon, and goes to its address when pressed. The address itself is not shown.</p></div>
<div class="stack" data-links>${linkList()}</div>
<div><button class="btn ghost small" type="button" data-add-link>Add a link</button></div>
<datalist id="link-names">${LINK_NAMES.map((n) => `<option value="${n}"></option>`).join('')}</datalist>
</section>
<div class="save-bar"><button class="btn" type="button" data-save>Save</button><button class="btn ghost" type="button" data-import>Fill in from the desktop app</button><a class="textbtn" href="${profileUrl(me)}">See your profile</a><span class="err grow" hidden></span></div>`,
        'How people see you: your photo and cover, name, bio, links and About.'
      )
      const redrawLinks = () => ($('[data-links]', pane).innerHTML = linkList())
      pane.oninput = (e) => {
        const row = e.target.closest('[data-link]')
        if (row) {
          const l = draft.links[+row.dataset.link]
          if (e.target.matches('[data-link-label]')) l.label = e.target.value
          if (e.target.matches('[data-link-url]')) l.url = e.target.value
          $('[data-link-ic]', row).innerHTML = linkIcon(l)
          dirty = true
          return
        }
        const el = e.target.closest('[data-k]')
        if (!el) return
        draft[el.dataset.k] = el.value
        if (el.dataset.k === 'handle') $('[data-handle-preview]', pane).textContent = el.value
        if (el.dataset.k === 'about') $('[data-left]', pane).textContent = `${2600 - el.value.length} characters left`
        if (el.dataset.k === 'headline') $('[data-bio-left]', pane).textContent = `${300 - el.value.length} characters left, up to 8 lines`
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
        if (t.closest('[data-add-link]')) {
          if ((draft.links ||= []).length >= 12) return toast('A profile has up to 12 links.')
          draft.links.push({ label: draft.links.length ? '' : 'Website', url: '' })
          dirty = true
          redrawLinks()
          return void [...pane.querySelectorAll('[data-link-url]')].at(-1)?.focus()
        }
        const rm = t.closest('[data-rm-link]')
        if (rm) {
          draft.links.splice(+rm.closest('[data-link]').dataset.link, 1)
          dirty = true
          return redrawLinks()
        }
        if (t.closest('[data-import]')) return void importFromApp(() => void DRAW.edit())
        if (t.closest('[data-save]')) {
          if (await save(fields, t.closest('[data-save]'))) redrawLinks()
        }
      }
    },

    // ── Other Details: your projects first, then LinkedIn's sections, one at a time
    async sections() {
      let kind = 'projects'
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
            if (type === 'list') return `<label class="field span2"><span>${label}</span><input data-k="${k(f)}" data-dirty value="${esc((x[f] || []).join(', '))}" placeholder="Figma, React, Photography"></label>`
            if (type === 'pic')
              return `<div class="field span2"><span>${label}</span><div class="proj-pic">${
                x.image ? `<img src="${esc(API)}/media/${esc(x.image)}" alt="">` : '<span class="muted small">None. A video, when there is one, shows instead.</span>'
              }<label class="btn ghost small">${x.image ? 'Change picture' : 'Add a picture'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-proj-pic="${i}"></label>${
                x.image ? `<button class="btn ghost small" type="button" data-proj-unpic="${i}">Remove</button>` : ''
              }</div></div>`
            const attrs =
              type === 'date' ? 'maxlength="20" placeholder="2023-04"' : type === 'url' ? `type="url" maxlength="${max}" placeholder="${f === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://'}"` : `maxlength="${max}"`
            return `<label class="field"><span>${label}</span><input data-k="${k(f)}" data-dirty value="${esc(x[f] ?? '')}" ${attrs}${f === 'end' && x.current ? ' disabled' : ''}></label>`
          })
          .join('')
        return `<div class="card"><button class="btn ghost small rm" type="button" data-rm="${i}">Remove</button><div class="grid2 entry-ed">${fields}</div></div>`
      }
      const body = () =>
        kind === 'skills'
          ? `<label class="field"><span>Skills, separated by commas (up to 60)</span><input data-k="skills" data-dirty value="${esc(draft.skills.join(', '))}" placeholder="SQL, Excel, Python"></label>
<p class="muted small" style="margin-top:6px">Anyone on Oporch can endorse them. A skill you take off takes its endorsements with it.</p>`
          : `<div class="sec-h"><h3>${SECTIONS[kind].title}</h3><button class="btn ghost small" type="button" data-add>${SECTIONS[kind].add}</button></div>
<div class="list-ed">${(draft[kind] || []).map(entryCard).join('') || '<p class="muted small">Nothing added yet.</p>'}</div>
<p class="muted small" style="margin-top:10px">Dates as 2023-04 (April 2023), or a year.${kind === 'projects' ? ' A project shows its YouTube video when it has one, else its picture.' : ''}</p>`
      const draw = () => {
        pane.innerHTML = frame(
          'sections',
          `${tabs()}<div class="stack sub-body">${body()}</div>
<div class="save-bar"><button class="btn" type="button" data-save>Save</button><button class="btn ghost" type="button" data-import>Fill in from the desktop app</button><span class="err grow" hidden></span></div>`,
          'Your projects, experience, education and the rest, as LinkedIn lays them out. Everything here shows on your profile.'
        )
      }
      draw()
      pane.oninput = (e) => {
        const el = e.target
        if (!el.matches('[data-k]')) return
        const path = el.dataset.k.split('.')
        const list = path[0] === 'skills' || typeOf(path[0], path[2]) === 'list'
        const value = el.type === 'checkbox' ? el.checked : list ? commas(el.value).slice(0, path[0] === 'skills' ? 60 : 15) : el.value
        if (path.length === 1) draft[path[0]] = value
        else draft[path[0]][+path[1]][path[2]] = value
        if (path[2] === 'current') {
          const end = el.closest('.card').querySelector(`[data-k="${path[0]}.${path[1]}.end"]`)
          end.disabled = el.checked
          if (el.checked) end.value = draft[path[0]][+path[1]].end = ''
        }
      }
      pane.onchange = async (e) => {
        const pic = e.target.closest('[data-proj-pic]')
        const file = pic?.files?.[0]
        if (!file) return pane.oninput(e)
        pic.value = ''
        try {
          const r = await upload(file, 'project', 4096)
          draft.projects[+pic.dataset.projPic].image = r.id
          dirty = true
          draw()
          toast('Picture added. Press Save to keep it.')
        } catch (x) {
          toast(esc(x.message))
        }
      }
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
          return void [...pane.querySelectorAll(`[data-k^="${kind}."]`)].at(-SECTIONS[kind].fields.filter(([, , type]) => type !== 'pic').length)?.focus()
        }
        const unpic = t.closest('[data-proj-unpic]')
        if (unpic) {
          draft.projects[+unpic.dataset.projUnpic].image = null
          dirty = true
          return draw()
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

    // ── Open to Work and Hiring: one or the other, never both (the owner, 2026-10-23)
    async work() {
      const draw = () => {
        const o = draft.openToWork
        const mode = o ? 'open' : draft.hiring ? 'hiring' : 'none'
        const choice = (value, title, text) => `<label class="toggle"><span><b>${title}</b><span class="muted small">${text}</span></span><input type="radio" name="status" value="${value}" data-status${mode === value ? ' checked' : ''}></label>`
        const ticks = (map, picked, attr) => Object.entries(map).map(([v, t]) => `<label class="check"><input type="checkbox" ${attr}="${v}" data-dirty${picked.includes(v) ? ' checked' : ''}><span>${t}</span></label>`).join('')
        pane.innerHTML = frame(
          'work',
          `<div class="stack">
<div class="card" role="radiogroup" aria-label="Open to work or hiring">
${choice('none', 'Neither', 'Your profile says neither.')}
${choice('open', 'I am open to work', 'A green ring round your photo wherever it shows on Oporch, and what you are looking for on your profile, under Open to work.')}
${choice('hiring', 'I am hiring', 'A blue ring round your photo wherever it shows on Oporch, so people know to message you about your roles.')}
</div>
${
  o
    ? `<div class="card pad stack"><h3>What you are looking for</h3>
<div class="grid2">
<label class="field"><span>Job titles, separated by commas (up to 5)</span><input data-otw="titles" data-dirty value="${esc(o.titles.join(', '))}" placeholder="Data Analyst, Product Analyst"></label>
<label class="field"><span>Locations, separated by commas (up to 5)</span><input data-otw="places" data-dirty value="${esc(o.places.join(', '))}" placeholder="Bengaluru, Remote"></label></div>
<div class="row wrap"><span class="small" style="font-weight:600">Workplace</span>${ticks(WORK_TYPE, o.types, 'data-otw-type')}</div>
<div class="row wrap"><span class="small" style="font-weight:600">Job types</span>${ticks(JOB_TYPE, o.jobTypes ?? [], 'data-otw-job')}</div>
<div class="grid2"><label class="field"><span>Start date</span><select data-otw="start" data-dirty>${Object.entries(START)
        .map(([v, t]) => `<option value="${v}"${o.start === v ? ' selected' : ''}>${t}</option>`)
        .join('')}</select></label></div></div>`
    : ''
}
</div>
<div class="save-bar"><button class="btn" type="button" data-save>Save</button><span class="err grow" hidden></span></div>`,
          'Let people know what you are looking for, or that you are hiring. One or the other, never both.'
        )
      }
      draw()
      const toggle = (list, value, on) => {
        const s = new Set(list)
        on ? s.add(value) : s.delete(value)
        return [...s]
      }
      const read = (e) => {
        const el = e.target
        if (el.matches('[data-status]')) {
          draft.openToWork = el.value === 'open' ? (draft.openToWork ?? (me.openToWork ? structuredClone(me.openToWork) : { titles: [], places: [], types: [], jobTypes: [], start: 'flexible' })) : null
          draft.hiring = el.value === 'hiring'
          dirty = true
          return draw()
        }
        if (el.matches('[data-otw]')) {
          const f = el.dataset.otw
          draft.openToWork[f] = f === 'start' ? el.value : commas(el.value).slice(0, 5)
        } else if (el.matches('[data-otw-type]')) draft.openToWork.types = toggle(draft.openToWork.types, el.dataset.otwType, el.checked)
        else if (el.matches('[data-otw-job]')) draft.openToWork.jobTypes = toggle(draft.openToWork.jobTypes ?? [], el.dataset.otwJob, el.checked)
      }
      pane.onchange = read
      pane.oninput = (e) => e.target.matches('input[type=text], input:not([type])') && read(e)
      pane.onclick = async (e) => {
        const b = e.target.closest('[data-save]')
        if (!b) return
        if (await save(['openToWork', 'hiring'], b)) {
          // Your own ring follows at once, in the menus too.
          for (const slot of document.querySelectorAll('[data-me-av]')) slot.innerHTML = avatar(me, 'xs')
        }
      }
    },

    async design() {
      await designPane()
    },

    // ── Account Privacy: saved as soon as it is changed
    async privacy() {
      const tick = (key, title, text) => `<label class="toggle"><span><b>${title}</b><span class="muted small">${text}</span></span><input type="checkbox" role="switch" data-p="${key}"${me[key] ? ' checked' : ''}></label>`
      pane.innerHTML = frame(
        'privacy',
        `<div class="card">
${tick('privateAccount', 'Private account', 'Only the people you approve can follow you and see your posts, your followers and who you follow. Your name, photo, bio, links and profile sections stay visible to everyone, so recruiters can find you, and a profile you recommend still shows that you do. Turning it off approves everyone waiting.')}
${tick('profilePublic', 'Visitors without an account can see my profile', 'Off: only people signed in to Oporch can. Posts for anyone stay open to whoever has their link.')}
${tick('appliesVisible', 'People who follow me can see the jobs I apply to', 'They see your face on a job you applied to with Apply or One click apply. Off: you are only counted, never named.')}
<label class="toggle"><span><b>Who can see my email address</b><span class="muted small">In your profile’s Contact info. Never people without an account.</span></span><select class="input" data-p="emailVisible" style="width:auto">${[
          ['anyone', 'Anyone on Oporch'],
          ['mutual', 'People who follow each other with me'],
          ['nobody', 'Nobody']
        ]
          .map(([v, t]) => `<option value="${v}"${(me.emailVisible ?? 'mutual') === v ? ' selected' : ''}>${t}</option>`)
          .join('')}</select></label>
</div>`,
        'Who can follow you, see your posts, and find you.'
      )
      pane.onchange = async (e) => {
        const box = e.target.closest('[data-p]')
        if (!box) return
        const value = box.type === 'checkbox' ? box.checked : box.value
        if (box.dataset.p === 'privateAccount' && !value && !confirm('Make your account public? Anyone can then follow you and see your posts, and everyone waiting to follow you is approved.')) {
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
        'blocked',
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

    // ── Password and Account
    async account() {
      pane.innerHTML = frame(
        'account',
        `<div class="card pad stack">
<p>Signed in as <b>${esc(me.email)}</b>. The same account signs in to the desktop app.</p>
<div class="row wrap"><a class="btn ghost" href="/items">My items</a><button class="btn ghost" type="button" data-signout>Log out</button></div>
</div>
<div class="card pad stack" style="margin-top:16px"><h3>Change your password</h3>
<div class="stack" style="max-width:360px">
<label class="field"><span>Current password</span><input type="password" autocomplete="current-password" data-pw-now></label>
<label class="field"><span>New password, at least 10 characters</span><input type="password" autocomplete="new-password" minlength="10" data-pw-new></label>
<p class="muted small">Every other device, the app included, signs out.</p>
<div><button class="btn" type="button" data-pw>Change password</button></div></div></div>
<div class="card pad stack danger-zone" style="margin-top:16px"><h3>Delete your account</h3>
<p class="muted small">This deletes your account, profile, posts, comments, likes, recommendations, messages, followers, pictures and design, here and in the app. It cannot be undone.</p>
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
        'appearance',
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

  /** "Fill in from the desktop app": what the app knows goes into the draft, to be checked and saved; its links join yours. */
  async function importFromApp(redraw) {
    try {
      const got = await api('GET', '/social/me/import')
      for (const [k, v] of Object.entries(got)) {
        if (!v || (Array.isArray(v) && !v.length)) continue
        if (k === 'links') draft.links = [...(draft.links || []), ...v.filter((l) => !(draft.links || []).some((m) => m.url === l.url))].slice(0, 12)
        else draft[k] = v
      }
      dirty = true
      redraw()
      toast('Filled in from your desktop app. Check it, then press Save. Your bio, links and About are under Edit Profile; projects, experience and the rest under Other Details.', 9000)
    } catch (x) {
      toast(esc(x.message), 7000)
    }
  }

  /*
   * ── Design Your Profile (the owner, 2026-10-23: "it is too confusing ... make the whole process more easier for the
   * user to understand and do. The user should be drag and dropping the files instead of editing in the boxes, they
   * should also be able to download the template of the files. The drag and drop place of the files and media above
   * and the preview should be below it in its full width"). Three steps, the files and pictures in place, and the
   * preview under them. What is dropped is saved at once as a draft; nobody sees it until it is sent and approved.
   */
  async function designPane() {
    const [d, mine, pics, updates] = await Promise.all([
      api('GET', '/social/me/design'),
      api('GET', `/social/u/${encodeURIComponent(me.handle)}`),
      api('GET', '/social/me/design/media'),
      // What others see: not a post that was turned down.
      api('GET', `/social/u/${encodeURIComponent(me.handle)}/updates`).then((r) => r.updates.filter((u) => u.review !== 'rejected'))
    ])
    const canPublish = (me.features ?? []).includes('design')
    const state = {
      none: '',
      draft: '<span class="state">Draft, not sent</span>',
      pending: '<span class="state pending">Waiting for review</span>',
      approved: '<span class="state approved">Approved and on your profile</span>',
      rejected: '<span class="state rejected">Not approved</span>'
    }[d.state]
    const code = { html: d.html, css: d.css, js: d.js }
    const started = !!d.html.trim()
    const FILES = [
      ['html', 'index.html', 'The page'],
      ['css', 'style.css', 'How it looks'],
      ['js', 'script.js', 'What it does, if anything']
    ]
    const size = (s) => new Blob([s]).size
    const fileRow = ([k, name, what]) =>
      `<li class="dfile${code[k].trim() ? '' : ' none'}"><span class="dfile-n"><b>${name}</b><span class="muted small">${what}</span></span><span class="muted small">${code[k].trim() ? mb(size(code[k])) : 'Not added'}</span>${
        code[k].trim() ? `<button class="btn ghost small" type="button" data-dl="${k}">Download</button><button class="btn ghost small" type="button" data-unfile="${k}">Remove</button>` : ''
      }</li>`
    pane.innerHTML = frame(
      'design',
      `${d.state === 'rejected' && d.note ? `<p class="err">Why it was not approved: ${esc(d.note)}</p>` : ''}
${d.live && d.state !== 'approved' ? '<p class="muted small">Your last approved design stays on your profile until this one is approved.</p>' : ''}
${canPublish ? '' : '<p><b>Publishing a design is part of Pro.</b> You can still make one and see it here.</p>'}
<ol class="steps">
<li class="card step"><span class="step-n" aria-hidden="true">1</span><div class="stack"><div><h3>Get the template</h3><p class="muted small">The three files a design is made of: index.html, style.css and script.js. Oporch fills your profile in wherever the template says, so your posts, projects and details stay up to date. Change the files yourself, or give them to an AI.</p></div><div class="row wrap"><button class="btn" type="button" data-template>Download the template</button>${started ? '<button class="btn ghost small" type="button" data-dl-all>Download your files</button>' : ''}</div></div></li>
<li class="card step"><span class="step-n" aria-hidden="true">2</span><div class="stack"><div><h3>Ask your AI, if you like</h3><p class="muted small">The prompt tells an AI how the files must be made. Paste it into the AI you use, then write under it how you want your page to look, and attach the template files.</p></div><div class="row wrap"><button class="btn ghost" type="button" data-copy>Copy the prompt</button><button class="textbtn" type="button" data-see-prompt>Read it first</button></div></div></li>
<li class="card step"><span class="step-n" aria-hidden="true">3</span><div class="stack grow"><div><h3>Drop your files here</h3><p class="muted small">Your index.html, style.css and script.js, and the pictures they use, all at once, or a folder or .zip of them. Pictures keep their names, so &lt;img src="photo.jpg"&gt; shows photo.jpg. Videos go on YouTube: put the link in a &lt;div data-youtube="…"&gt;.</p></div>
<div class="drop" data-drop tabindex="0" role="button" aria-label="Drop your files here, or press to choose them">${UPLOAD}<b>Drop files, a folder or a .zip here</b><span class="muted small">or press to choose them</span><input type="file" multiple hidden data-pick accept=".html,.htm,.css,.js,.mjs,.zip,image/jpeg,image/png,image/gif,image/webp"></div>
<p class="muted small" data-progress hidden></p>
<ul class="dfiles">${FILES.map(fileRow).join('')}</ul>
<div class="dpics-h"><b>Pictures</b><span class="muted small">${pics.files.length} of ${pics.maxFiles} · ${mb(pics.used)} of ${mb(pics.budget)} used with your files</span></div>
<div class="meter"><span style="width:${Math.min(100, (pics.used / pics.budget) * 100)}%"></span></div>
${
  pics.files.length
    ? `<div class="pics">${pics.files
        .map(
          (f) => `<div class="pic" data-pic-id="${esc(f.id)}"><img src="${esc(API + f.path)}" alt="" loading="lazy"><b class="pic-n" title="${esc(f.name ?? '')}">${esc(f.name ?? 'No name')}</b><span class="small muted">${mb(f.bytes)}</span><div class="row wrap" style="gap:4px"><button class="btn ghost small" type="button" data-copyname>${f.name ? 'Copy name' : 'Copy address'}</button><button class="btn ghost small" type="button" data-pic-rm>Remove</button></div></div>`
        )
        .join('')}</div>`
    : '<p class="muted small">No pictures yet. Drop them in with your files.</p>'
}
<p class="muted small">Your AI gave you code instead of files? <button class="textbtn" type="button" data-paste>Paste its answer</button></p>
</div></li>
</ol>
<section class="card dprev-card" aria-label="Preview">
<div class="sec-h dprev-h"><div><h3>Preview</h3><p class="muted small">${started ? 'Your design as people will see it, filled in from your profile.' : 'Nothing dropped yet: this is the template, filled in from your profile.'} On your profile it fills the window, with Oporch’s menu over its left edge (on a phone, its top and bottom) and two small bars of your profile’s buttons over its right corners.</p></div>
<div class="feed-tabs" role="tablist" aria-label="Preview size"><button type="button" role="tab" data-size="wide" aria-selected="true">Wide</button><button type="button" role="tab" data-size="phone" aria-selected="false">Phone</button></div></div>
<div id="dprev" class="dprev"></div>
</section>
<div class="save-bar"><button class="btn" type="button" data-dsend${canPublish && started && (d.state === 'draft' || d.state === 'rejected') ? '' : ' disabled'}>${d.state === 'pending' ? 'Waiting for review' : d.state === 'approved' ? 'Approved' : 'Send for review'}</button>${started ? '<button class="btn ghost" type="button" data-dbase>Start again from the template</button>' : ''}${d.state !== 'none' ? '<button class="btn danger" type="button" data-ddel>Remove my design</button>' : ''}<span class="err grow" hidden></span></div>`,
      'Make your profile page your own: a small website of HTML, CSS and JavaScript. Your posts, projects, experience and everything else fill in by themselves. We check every design before it shows on your profile.',
      state ? ` ${state}` : ''
    )

    const prev = $('#dprev', pane)
    const err = $('.save-bar .err', pane)
    const progress = $('[data-progress]', pane)
    mountDesign(prev, started ? { ...code, files: d.files } : { html: TEMPLATE_HTML, css: TEMPLATE_CSS, js: TEMPLATE_JS, files: d.files }, mine, updates)

    /** Saved as the draft: these files in place of what was there. */
    const keep = async (next) => {
      await api('PUT', '/social/me/design', { ...code, ...next, submit: false })
    }
    /** What was dropped or chosen: pictures uploaded by their names, the files saved as the draft, the pane drawn again. */
    const take = async (dropped) => {
      const got = await sortFiles(await dropped)
      const failed = []
      let uploaded = 0
      progress.hidden = false
      for (const [i, f] of got.pictures.entries()) {
        progress.textContent = `Uploading ${f.name}, ${i + 1} of ${got.pictures.length}…`
        try {
          await upload(f, 'design', 4096, f.name)
          uploaded++
        } catch (x) {
          failed.push(`${f.name}: ${x.message}`)
        }
      }
      const next = Object.fromEntries(['html', 'css', 'js'].filter((k) => got[k] !== null).map((k) => [k, got[k]]))
      try {
        if (Object.keys(next).length) {
          progress.textContent = 'Saving your files…'
          await keep(next)
        }
      } catch (x) {
        failed.push(x.message)
      }
      const said = [
        Object.keys(next).length ? `Added ${Object.keys(next).map((k) => FILES.find(([f]) => f === k)[1]).join(', ')}.` : '',
        uploaded ? `${uploaded} picture${uploaded === 1 ? '' : 's'} uploaded.` : '',
        got.unused.length ? `Not used: ${got.unused.slice(0, 5).join(', ')}${got.unused.length > 5 ? ' and more' : ''} (a design takes HTML, CSS, JavaScript and pictures).` : '',
        failed.length ? `Not added: ${failed.join(' ')}` : ''
      ].filter(Boolean)
      await designPane()
      toast(esc(said.join(' ') || 'Nothing there a design can use: drop your index.html, style.css, script.js and pictures.'), failed.length || got.unused.length ? 9000 : 5000)
    }

    const zone = $('[data-drop]', pane)
    const picker = $('[data-pick]', pane)
    zone.addEventListener('dragover', (e) => {
      e.preventDefault()
      zone.classList.add('over')
    })
    zone.addEventListener('dragleave', () => zone.classList.remove('over'))
    zone.addEventListener('drop', (e) => {
      e.preventDefault()
      zone.classList.remove('over')
      // Read while the drop is still happening: a dropped folder can only be opened then.
      void take(droppedFiles(e.dataTransfer)).catch((x) => toast(esc(x.message)))
    })
    zone.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), picker.click()))
    pane.onchange = (e) => {
      if (e.target !== picker || !picker.files?.length) return
      const list = [...picker.files]
      picker.value = ''
      void take(droppedFiles(list)).catch((x) => toast(esc(x.message)))
    }

    const copyPrompt = async () => {
      try {
        await navigator.clipboard.writeText(designPrompt())
        toast('Prompt copied. Paste it into your AI, then write how you want your page to look.')
      } catch {
        seePrompt()
      }
    }
    const seePrompt = () => {
      const { el } = dialog(
        `<div class="dialog-h"><h2>The prompt for your AI</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b stack"><p class="muted small">It says only how the files must be made. Under its last line, write how you want your page to look.</p><textarea class="textarea code prompt" readonly spellcheck="false">${esc(designPrompt())}</textarea></div><div class="dialog-f"><button class="btn" type="button" data-copy-in>Copy the prompt</button></div>`
      )
      $('[data-copy-in]', el).addEventListener('click', async () => {
        const box = $('textarea', el)
        box.select()
        await navigator.clipboard.writeText(box.value).then(() => toast('Prompt copied.'), () => toast('Press Ctrl+C (or Cmd+C) to copy it.'))
      })
    }
    const paste = () => {
      const { el, close } = dialog(
        `<div class="dialog-h"><h2>Paste your AI’s answer</h2><button class="menu-b" type="button" data-close aria-label="Close">✕</button></div><div class="dialog-b stack"><p class="muted small">The whole answer, with its code blocks: the HTML, CSS and JavaScript in it become your files.</p><textarea class="textarea code" spellcheck="false" style="min-height:220px" aria-label="The AI’s answer"></textarea></div><div class="dialog-f"><button class="btn" type="button" data-use>Use it</button></div>`
      )
      $('[data-use]', el).addEventListener('click', async () => {
        const got = parseAnswer($('textarea', el).value)
        if (!got.html) return toast('That answer has no HTML in it. Paste the whole answer, with its code blocks.')
        try {
          await keep(got)
          close()
          await designPane()
          toast('Your files are in. Check the preview, then send it for review.')
        } catch (x) {
          toast(esc(x.message))
        }
      })
    }

    pane.onclick = async (e) => {
      const t = e.target
      if (t.closest('[data-drop]') && !t.closest('input')) return picker.click()
      if (t.closest('[data-template]')) {
        download('oporch-profile-template.zip', zip([{ name: 'index.html', text: TEMPLATE_HTML }, { name: 'style.css', text: TEMPLATE_CSS }, { name: 'script.js', text: TEMPLATE_JS }, { name: 'README.txt', text: designReadme() }]))
        return toast('The template is downloading: index.html, style.css, script.js and a README.')
      }
      if (t.closest('[data-dl-all]')) return download('my-oporch-design.zip', zip(FILES.filter(([k]) => code[k].trim()).map(([k, name]) => ({ name, text: code[k] }))))
      const dl = t.closest('[data-dl]')
      if (dl) {
        const [, name] = FILES.find(([k]) => k === dl.dataset.dl)
        return download(name, new Blob([code[dl.dataset.dl]], { type: 'text/plain' }))
      }
      if (t.closest('[data-copy]')) return void copyPrompt()
      if (t.closest('[data-see-prompt]')) return seePrompt()
      if (t.closest('[data-paste]')) return paste()
      const size = t.closest('[data-size]')
      if (size) {
        for (const b of pane.querySelectorAll('[data-size]')) b.setAttribute('aria-selected', String(b === size))
        return prev.classList.toggle('phone', size.dataset.size === 'phone')
      }
      const unfile = t.closest('[data-unfile]')
      if (unfile) {
        const [, name] = FILES.find(([k]) => k === unfile.dataset.unfile)
        if (!confirm(`Remove ${name} from your design?`)) return
        await keep({ [unfile.dataset.unfile]: '' }).catch((x) => toast(esc(x.message)))
        return void designPane()
      }
      const pic = t.closest('[data-pic-id]')
      if (pic) {
        const f = pics.files.find((x) => x.id === pic.dataset.picId)
        if (t.closest('[data-copyname]')) {
          const text = f?.name ?? `${API}${f?.path ?? ''}`
          await navigator.clipboard.writeText(text).then(() => toast(f?.name ? `Copied “${esc(f.name)}”. Use it as src="${esc(f.name)}".` : 'Address copied.'), () => prompt('Copy this:', text))
          return
        }
        if (t.closest('[data-pic-rm]')) {
          if (!confirm('Remove this picture? A design that uses it shows nothing there.')) return
          await api('DELETE', `/social/media/${encodeURIComponent(pic.dataset.picId)}`).catch((x) => toast(esc(x.message)))
          return void designPane()
        }
      }
      if (t.closest('[data-dsend]')) {
        err.hidden = true
        try {
          await api('PUT', '/social/me/design', { ...code, submit: true })
          toast('Sent for review. We will email you when it is decided.')
          return void designPane()
        } catch (x) {
          err.textContent = x.message
          err.hidden = false
        }
        return
      }
      if (t.closest('[data-dbase]')) {
        if (!confirm('Replace your files with the template? Your pictures stay.')) return
        await keep({ html: TEMPLATE_HTML, css: TEMPLATE_CSS, js: TEMPLATE_JS }).catch((x) => toast(esc(x.message)))
        return void designPane()
      }
      if (t.closest('[data-ddel]')) {
        if (!confirm('Remove your design? Your profile goes back to the standard one. Your pictures stay until you remove them.')) return
        await api('DELETE', '/social/me/design').catch((x) => toast(esc(x.message)))
        return void designPane()
      }
    }
  }

  // Straight to a section when the address names one; on a wide screen, the first otherwise.
  const asked = location.hash.slice(1)
  if (asked || !matchMedia('(max-width: 767px)').matches) void show(asked || 'edit', !!asked)
}
