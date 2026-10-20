/**
 * Admin (the owner's accounts, OWNER_EMAILS).
 * - Designs: each profile design waiting, shown exactly as people would see it, with its code; approve
 *   it, or turn it down with a reason the person reads. Live ones can be taken down.
 * - Reports: what members reported, with what it is about; dismiss it, or remove that thing.
 * - Example profiles: bring in the file of example profiles (docs/sample-profiles-prompt.md), fifty at a
 *   time, or take them all away again. They are marked "Example" everywhere.
 */
import { $, api, esc, me, plural, postHtml, refreshBadges, toast, who } from '/app.js'
import { mountDesign, showsPosts } from '/design.js'

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/admin')
  if (!me.admin) return void (main.innerHTML = '<div class="empty"><h2>Only an admin can see this</h2></div>')
  main.innerHTML = `<div class="page"><div class="page-h"><h1>Admin</h1></div>
<div class="feed-tabs" role="tablist" style="margin-bottom:18px"><button type="button" role="tab" data-tab="designs">Designs</button><button type="button" role="tab" data-tab="reports">Reports</button><button type="button" role="tab" data-tab="samples">Example profiles</button></div>
<div class="stack" id="adm"><div class="spin"></div></div></div>`
  const box = $('#adm', main)
  let tab = 'designs'

  // ── Designs

  const code = (d) => `<details class="code-v"><summary>Show the code</summary><pre class="code">${esc(d.html)}</pre><pre class="code">${esc(d.css)}</pre></details>`
  async function designs() {
    const r = await api('GET', '/admin/designs')
    box.innerHTML = `<h2>Waiting for review (${r.pending.length})</h2>
${
  r.pending
    .map(
      (d) => `<section class="card pad stack" data-h="${esc(d.person?.handle ?? '')}">
<div class="row">${who(d.person)}<span class="muted small" style="margin-left:auto">Sent ${new Date(d.at).toLocaleString('en-GB')}</span></div>
<div class="frame-slot dprev"></div>${code(d)}
<label class="field"><span>Reason, if you turn it down (they read it)</span><input data-note maxlength="500" placeholder="For example: no adult content, no contact details for sale"></label>
<div class="row"><button class="btn" type="button" data-ok>Approve</button><button class="btn danger" type="button" data-no>Turn down</button></div>
</section>`
    )
    .join('') || '<p class="muted">Nothing waiting.</p>'
}
<h2 style="margin-top:20px">Live (${r.live.length})</h2>
${
  r.live
    .map(
      (d) => `<section class="card pad stack" data-h="${esc(d.person?.handle ?? '')}">
<div class="row">${who(d.person)}<a class="textbtn" style="margin-left:auto" href="/u?h=${encodeURIComponent(d.person?.handle ?? '')}">Open profile</a></div>
<details><summary class="textbtn" style="cursor:pointer">Show it</summary><div class="frame-slot dprev" style="margin-top:10px"></div></details>${code(d)}
<label class="field"><span>Reason for taking it down (they read it)</span><input data-note maxlength="500"></label>
<div><button class="btn danger" type="button" data-down>Take down</button></div>
</section>`
    )
    .join('') || '<p class="muted">None yet.</p>'
}`
    // Shown as people see them: the same sealed frame, filled in from that person's profile and updates.
    const slots = box.querySelectorAll('.frame-slot')
    ;[...r.pending, ...r.live].forEach(async (d, i) => {
      const slot = slots[i]
      if (!slot || !d.person) return
      try {
        const h = encodeURIComponent(d.person.handle)
        // Quietly: looking at a design under review is not a profile view.
        const [p, ups] = await Promise.all([api('GET', `/social/u/${h}?quiet=1`), showsPosts(d.html) ? api('GET', `/social/u/${h}/updates`) : { updates: [] }])
        mountDesign(slot, d, p, ups.updates)
      } catch (e) {
        slot.textContent = e.message
      }
    })
  }

  // ── Reports

  const REMOVE = { update: 'Remove the update', comment: 'Remove the comment', message: 'Delete the message', profile: 'Take down their design' }
  function target(r) {
    const t = r.target
    if (!t) return '<p class="muted small">It is gone already.</p>'
    if (r.kind === 'profile') return `<div class="row">${who(t)}<a class="textbtn" style="margin-left:auto" href="/u?h=${encodeURIComponent(t.handle)}">Open profile</a></div>`
    if (r.kind === 'update') return postHtml(t)
    if (r.kind === 'comment') return `<div class="card pad">${who(t.author)}<p class="pre" style="margin-top:8px">${esc(t.text)}</p><a class="textbtn" href="/p?id=${t.updateId}">Open the update</a></div>`
    return `<div class="card pad"><div class="row">${who(t.from)}<span class="muted">to</span>${who(t.to)}</div><p class="pre" style="margin-top:8px">${esc(t.text)}</p></div>`
  }
  async function reports() {
    const r = await api('GET', '/admin/reports')
    box.innerHTML = `<h2>Open reports (${r.reports.length})</h2>${
      r.reports
        .map(
          (x) => `<section class="card pad stack" data-report="${x.id}">
<div class="row wrap"><span class="state">${esc(x.kind)}</span><b class="grow">${esc(x.reason)}</b><span class="muted small">by ${esc(x.reporter?.name ?? 'someone')} · ${new Date(x.at).toLocaleString('en-GB')}</span></div>
${target(x)}
<div class="row wrap"><button class="btn ghost" type="button" data-act-r="dismiss">Dismiss</button>${x.target ? `<button class="btn danger" type="button" data-act-r="remove">${REMOVE[x.kind]}</button>` : ''}</div>
</section>`
        )
        .join('') || '<p class="muted">Nothing reported.</p>'
    }`
  }

  // ── Example profiles

  let parsed = []
  function samples() {
    box.innerHTML = `<section class="card pad stack">
<h2>Bring in example profiles</h2>
<p class="muted">The file the AI agent made from docs/sample-profiles-prompt.md: one profile per line (JSON Lines), or one JSON list. Each becomes an example profile: marked "Example" everywhere, no password opens it, nobody can connect with, follow or message it, and its design goes live without review. They are sent fifty at a time.</p>
<label class="btn ghost" style="align-self:flex-start">Choose the file<input type="file" accept=".jsonl,.json,.txt,application/json" hidden data-file></label>
<div data-parsed></div>
<div class="row wrap"><button class="btn" type="button" data-import disabled>Bring them in</button></div>
<div data-progress class="stack" style="gap:6px"></div>
</section>
<section class="card pad stack"><h2>Take them away</h2><p class="muted">Deletes every example profile, with its updates and design. Real members are not touched.</p><div><button class="btn danger" type="button" data-wipe>Delete all example profiles</button></div></section>`
  }
  function readFile(text) {
    const errors = []
    let list = []
    const t = text.trim()
    if (t.startsWith('[')) {
      try {
        list = JSON.parse(t)
      } catch (e) {
        errors.push(`The file is not a JSON list: ${e.message}`)
      }
    } else {
      t.split(/\r?\n/).forEach((line, i) => {
        if (!line.trim()) return
        try {
          list.push(JSON.parse(line))
        } catch {
          errors.push(`Line ${i + 1} is not JSON.`)
        }
      })
    }
    return { list: Array.isArray(list) ? list.filter((x) => x && typeof x === 'object') : [], errors }
  }
  /** Fifty at a time, and under 25 MB a time, since the server takes 30 MB at most. */
  function batches(list) {
    const out = []
    let cur = []
    let size = 0
    for (const p of list) {
      const n = JSON.stringify(p).length
      if (cur.length && (cur.length >= 50 || size + n > 25e6)) {
        out.push(cur)
        cur = []
        size = 0
      }
      cur.push(p)
      size += n
    }
    if (cur.length) out.push(cur)
    return out
  }

  async function draw() {
    for (const b of main.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab))
    box.innerHTML = '<div class="spin"></div>'
    try {
      if (tab === 'designs') await designs()
      else if (tab === 'reports') await reports()
      else samples()
    } catch (e) {
      box.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    }
  }

  main.querySelector('.feed-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]')
    if (!b || b.dataset.tab === tab) return
    tab = b.dataset.tab
    void draw()
  })

  box.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-file]')
    if (!input?.files?.[0]) return
    const { list, errors } = readFile(await input.files[0].text())
    parsed = list
    $('[data-parsed]', box).innerHTML = `<p><b>${plural(list.length, 'profile')}</b> in the file.</p>${errors.length ? `<p class="err">${errors.slice(0, 10).map(esc).join('<br>')}${errors.length > 10 ? `<br>and ${errors.length - 10} more` : ''}</p>` : ''}`
    $('[data-import]', box).disabled = !list.length
  })

  box.addEventListener('click', async (e) => {
    const t = e.target
    if (t.closest('[data-import]')) {
      const btn = t.closest('[data-import]')
      btn.disabled = true
      const progress = $('[data-progress]', box)
      let made = 0
      const skipped = []
      const parts = batches(parsed)
      for (const [i, part] of parts.entries()) {
        progress.innerHTML = `<p>Sending part ${i + 1} of ${parts.length}…</p>`
        try {
          const r = await api('POST', '/admin/samples', { profiles: part })
          made += r.created.length
          skipped.push(...r.skipped)
        } catch (x) {
          skipped.push({ handle: `part ${i + 1}`, why: x.message })
        }
      }
      progress.innerHTML = `<p class="okay">${plural(made, 'example profile')} brought in.</p>${
        skipped.length ? `<p class="err">${plural(skipped.length, 'profile')} left out:</p><ul class="small" style="margin-left:18px">${skipped.map((s) => `<li>${esc(s.handle)}: ${esc(s.why)}</li>`).join('')}</ul>` : ''
      }`
      return
    }
    if (t.closest('[data-wipe]')) {
      if (!confirm('Delete every example profile, with their updates and designs?')) return
      try {
        const r = await api('DELETE', '/admin/samples')
        toast(`${plural(r.removed, 'example profile')} deleted.`)
      } catch (x) {
        toast(esc(x.message))
      }
      return
    }
    const act = t.closest('[data-act-r]')
    if (act) {
      const card = act.closest('[data-report]')
      if (act.dataset.actR === 'remove' && !confirm('Remove it? This cannot be undone.')) return
      act.disabled = true
      try {
        await api('POST', `/admin/reports/${card.dataset.report}`, { action: act.dataset.actR })
        toast(act.dataset.actR === 'remove' ? 'Removed.' : 'Dismissed.')
        refreshBadges()
        void draw()
      } catch (x) {
        act.disabled = false
        toast(esc(x.message))
      }
      return
    }
    const b = t.closest('[data-ok],[data-no],[data-down]')
    if (!b) return
    const card = b.closest('[data-h]')
    const note = $('[data-note]', card)?.value.trim() || undefined
    const body = b.dataset.ok !== undefined ? { approve: true } : { approve: false, note, ...(b.dataset.down !== undefined ? { takeDown: true } : {}) }
    if (b.dataset.down !== undefined && !confirm('Take this design down from their profile?')) return
    b.disabled = true
    try {
      await api('POST', `/admin/designs/${encodeURIComponent(card.dataset.h)}`, body)
      toast(body.approve ? 'Approved. It is live.' : b.dataset.down !== undefined ? 'Taken down.' : 'Turned down. They have been told why.')
      refreshBadges()
      void draw()
    } catch (x) {
      b.disabled = false
      toast(esc(x.message))
    }
  })
  await draw()
}
