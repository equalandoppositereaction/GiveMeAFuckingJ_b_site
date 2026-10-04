/**
 * The job search on the home page (the owner, 2026-10-05).
 *
 * jobs/index.txt holds every job's title, location, countries, type, level, remote flag, posting day and
 * salary (its format is in scripts/build-jobs.mjs). It is read as it streams in, so the newest jobs show
 * while the rest load, and then searched here as you type. A job's link and details are in its chunk,
 * jobs/<chunk>.json, fetched when the job is opened. Apply goes through /apply, which reads the same
 * chunk and forwards to the job's page, so no link is ever shown here.
 */
;(() => {
  const PAGE = 30 // tiles per "Show more"
  const EARLY = 3000 // jobs read before the first results are shown
  const TYPE = { F: 'Full time', P: 'Part time', C: 'Contract', I: 'Internship', T: 'Temporary', L: 'Freelance', A: 'Apprenticeship' }
  const LEVEL = { E: 'Entry level', M: 'Mid level', S: 'Senior level', X: 'Executive level' }
  const SYMBOL = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'CA$', AUD: 'A$', SGD: 'S$', NZD: 'NZ$', HKD: 'HK$', BRL: 'R$', MXN: 'MX$', CNY: 'CN¥', KRW: '₩', ILS: '₪', PHP: '₱' }
  const ARROW = '<svg class="arrow" viewBox="0 0 17 14" fill="none" aria-hidden="true"><path stroke="currentColor" d="M1 7h15M10 1l6 6-6 6"/></svg>'
  const DAY = 864e5
  const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / DAY)

  const $ = (id) => document.getElementById(id)
  const form = $('find'), grid = $('jobs'), count = $('count'), more = $('more')
  const fields = ['q', 'loc', 'mode', 'type', 'level', 'posted'].map($)
  const [qIn, locIn, modeIn, typeIn, levelIn, postedIn] = fields

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  // Lower case, no accents, words split on anything but letters, digits and + # . (C++, C#, .NET), led by a space so " word" finds a word's start.
  const norm = (s) => ' ' + s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu, ' ').trim()
  const cache = new Map()
  const normed = (s) => {
    let v = cache.get(s)
    if (v === undefined) cache.set(s, (v = norm(s)))
    return v
  }

  // ── The index, column by column
  let head = null
  let n = 0
  let ids, days, titles, locs, ccs, flags, pays, chunkOf
  let loaded = false

  function start(line) {
    head = JSON.parse(line)
    ids = new Int32Array(head.count)
    days = new Int32Array(head.count)
    titles = new Array(head.count)
    locs = new Array(head.count)
    ccs = new Array(head.count)
    flags = new Array(head.count)
    pays = new Array(head.count)
    chunkOf = new Array(head.count)
  }
  let id = 0
  let chunk = 'top'
  function add(line) {
    const f = line.split('\t')
    if (f.length < 7 || n >= head.count) return
    id = n ? id - f[0] : +f[0]
    // The chunk is named by the nearest job at or above this one whose id hashes low (as in scripts/build-jobs.mjs).
    if (Math.imul(id, 0x9e3779b1) >>> 0 < 2 ** 32 / head.k) chunk = String(id)
    ids[n] = id
    titles[n] = f[1]
    locs[n] = f[2]
    ccs[n] = f[3]
    flags[n] = f[4]
    days[n] = +f[5]
    pays[n] = f[6]
    chunkOf[n] = chunk
    n++
  }

  async function load() {
    const res = await fetch('jobs/index.txt', { cache: 'no-cache' })
    if (!res.ok || !res.body) throw new Error(String(res.status))
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let rest = ''
    let shown = false
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = (rest + value).split('\n')
      rest = lines.pop()
      for (const line of lines) head ? add(line) : start(line)
      if (!shown && n >= EARLY) {
        shown = true
        search()
      }
    }
    if (rest) head ? add(rest) : start(rest)
    loaded = true
    places()
    // The full list may order the first page differently; leave it be while someone is reading an open job.
    if (grid.querySelector('.open')) stale = true
    else search()
  }

  // ── Searching
  let found = []
  let shownCount = 0
  let stale = false

  /** A test for the location box: the text at a word's start in the location, or a country whose name starts with it. */
  function placeTest(text) {
    const q = norm(text)
    if (q === ' ') return null
    const word = q.trim()
    const codes = new Set()
    for (const [code, name] of Object.entries(head.countries)) {
      if (normed(name).startsWith(q) || code.toLowerCase() === word) codes.add(code)
    }
    if (/^(usa|united states of america)$/.test(word)) codes.add('US')
    if (/^(uk|england|britain|great britain)$/.test(word)) codes.add('GB')
    if (word === 'uae') codes.add('AE')
    return (i) => normed(locs[i]).includes(q) || (codes.size > 0 && ccs[i] !== '' && ccs[i].split(' ').some((c) => codes.has(c)))
  }

  function search() {
    if (!head) return
    stale = false
    const words = norm(qIn.value).split(' ').filter(Boolean).map((w) => ' ' + w)
    const place = placeTest(locIn.value)
    const mode = modeIn.value, type = typeIn.value, level = levelIn.value
    const since = +postedIn.value ? today - +postedIn.value : 0
    const byDay = new Map()
    for (let i = 0; i < n; i++) {
      const f = flags[i]
      if (type && f[0] !== type) continue
      if (level && f[1] !== level) continue
      if (mode && (f[2] === 'R') !== (mode === 'remote')) continue
      if (since && days[i] < since) continue
      if (words.length) {
        const t = normed(titles[i])
        if (!words.every((w) => t.includes(w))) continue
      }
      if (place && !place(i)) continue
      const list = byDay.get(days[i])
      if (list) list.push(i)
      else byDay.set(days[i], [i])
    }
    // Newest first: by the day posted, and within a day by id, which the index already runs down.
    found = [...byDay.keys()].sort((a, b) => b - a).flatMap((d) => byDay.get(d))
    shownCount = 0
    grid.textContent = ''
    page()
    const total = `${found.length.toLocaleString('en')} ${found.length === 1 ? 'job' : 'jobs'}`
    count.textContent = loaded ? total : `${total} so far. Loading ${(head.count - n).toLocaleString('en')} more…`
    remember()
  }

  function page() {
    const html = []
    for (const i of found.slice(shownCount, shownCount + PAGE)) html.push(tile(i))
    grid.insertAdjacentHTML('beforeend', html.join(''))
    shownCount = Math.min(found.length, shownCount + PAGE)
    more.hidden = shownCount >= found.length
  }

  // ── Tiles

  /** "EUR75-86~" -> "€75K-86K a year (estimated)"; rupees in lakhs. */
  function salary(s) {
    const m = /^([A-Z]{3})([\d.]+)(?:-([\d.]+))?(~?)$/.exec(s)
    if (!m) return 'Salary not listed'
    const [, cur, lo, hi, est] = m
    const amount = (v) => (cur === 'INR' && v >= 100 ? `${+(v / 100).toFixed(1)}L` : `${v}K`)
    const sym = SYMBOL[cur]
    return `${sym ?? cur + ' '}${amount(+lo)}${hi ? '-' + amount(+hi) : ''} a year${est ? ' (estimated)' : ''}`
  }

  function tile(i) {
    const f = flags[i]
    const tags = [f[2] === 'R' ? 'Remote' : 'On-site', TYPE[f[0]]].filter(Boolean).join(' · ')
    return `<article class="job" data-i="${i}">
<div class="top">
<h3><button type="button" aria-expanded="false">${esc(titles[i])}</button></h3>
<p class="mono">${esc(locs[i] || 'Location not listed')}</p>
<p class="mono">${tags}</p>
<p class="mono">${esc(salary(pays[i]))}</p>
<a class="apply" href="apply?j=${ids[i]}&amp;c=${chunkOf[i]}&amp;v=${head.build}" target="_blank" rel="noopener">Apply${ARROW}</a>
</div>
<div class="more" hidden></div>
<a class="app mono" href="/download">Apply with one click from our desktop app for free${ARROW}</a>
</article>`
  }

  const chunks = new Map()
  function fetchChunk(name) {
    if (!chunks.has(name)) {
      const p = fetch(`jobs/${name}.json?v=${head.build}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .catch((e) => {
          chunks.delete(name)
          throw e
        })
      chunks.set(name, p)
    }
    return chunks.get(name)
  }

  const languages = new Intl.DisplayNames(['en'], { type: 'language' })
  const language = (code) => {
    try {
      return languages.of(code) || code
    } catch {
      return code
    }
  }
  function posted(d) {
    if (!d) return ''
    const ago = today - d
    if (ago <= 0) return 'Posted today'
    if (ago === 1) return 'Posted yesterday'
    if (ago < 31) return `Posted ${ago} days ago`
    return `Posted on ${new Date(d * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`
  }

  function details(i, d) {
    const f = flags[i]
    const [, years = 0, tasks = [], perks = [], skills = [], roles = [], education = [], lang = ''] = d || []
    const experience = [LEVEL[f[1]], years ? `about ${years} ${years === 1 ? 'year' : 'years'} of experience` : ''].filter(Boolean).join(', ')
    const facts = [posted(days[i]), experience, education.length ? `Education: ${education.join(', ')}` : '', lang ? `The posting is in ${language(lang)}` : '']
      .filter(Boolean)
      .map((t) => `<p>${esc(t[0].toUpperCase() + t.slice(1))}</p>`)
    const list = (title, items) => (items.length ? `<h4>${title}</h4><ul class="mono">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '')
    const html =
      (facts.length ? `<div class="facts mono">${facts.join('')}</div>` : '') +
      list('What you will do', tasks) +
      (skills.length ? `<h4>Skills</h4><p class="chips mono">${skills.map((s) => `<span>${esc(s)}</span>`).join('')}</p>` : '') +
      list('Perks', perks) +
      (roles.length ? `<h4>Roles</h4><p class="mono">${esc(roles.join(', '))}</p>` : '')
    // Most jobs have their tasks and skills; for the rest, the posting itself has them.
    return html + (tasks.length || skills.length ? '' : '<p class="mono note">Apply to read the full job description on the job’s page.</p>')
  }

  async function toggle(job) {
    const open = !job.classList.contains('open')
    job.classList.toggle('open', open)
    job.querySelector('h3 button').setAttribute('aria-expanded', String(open))
    const box = job.querySelector('.more')
    box.hidden = !open
    if (!open) {
      if (stale) search()
      return
    }
    job.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (box.dataset.filled) return
    box.dataset.filled = '1'
    const i = +job.dataset.i
    box.innerHTML = '<p class="mono">Loading the details…</p>'
    try {
      box.innerHTML = details(i, (await fetchChunk(chunkOf[i]))[ids[i]])
    } catch {
      delete box.dataset.filled
      box.innerHTML = '<p class="mono">The details could not be loaded. Close the job and open it again to retry.</p>'
    }
  }

  // Anywhere on a tile's top part opens or closes it, except its links; a drag to select text does not.
  grid.addEventListener('click', (e) => {
    if (e.target.closest('a') || String(getSelection()).length) return
    const top = e.target.closest('.top')
    if (top) toggle(top.parentElement)
  })
  more.addEventListener('click', page)

  // ── The search box and filters
  let timer = 0
  form.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(search, 150)
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    clearTimeout(timer)
    search()
    if (matchMedia('(hover: none)').matches) document.activeElement.blur()
  })

  /** The search in the address, so it can be shared, bookmarked and reloaded. */
  function remember() {
    const p = new URLSearchParams()
    for (const el of fields) if (el.value.trim()) p.set(el.name, el.value.trim())
    const q = p.toString()
    history.replaceState(null, '', q ? `?${q}` : location.pathname)
  }
  const asked = new URLSearchParams(location.search)
  for (const el of fields) if (asked.has(el.name)) el.value = asked.get(el.name)

  /** Suggestions for the location box: the countries with the most jobs, then the most common cities. */
  function places() {
    const byCountry = new Map()
    const byCity = new Map()
    for (let i = 0; i < n; i++) {
      if (ccs[i]) for (const c of ccs[i].split(' ')) byCountry.set(c, (byCountry.get(c) || 0) + 1)
      const city = locs[i].split(/[,;|(/]/)[0].trim()
      if (city.length > 2 && !/remote|hybrid|anywhere|worldwide/i.test(city)) byCity.set(city, (byCity.get(city) || 0) + 1)
    }
    const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([v]) => v)
    const countries = top(byCountry, 200).map((c) => head.countries[c])
    const cities = top(byCity, 200).filter((c) => !countries.includes(c))
    $('places').innerHTML = [...countries, ...cities].map((p) => `<option value="${esc(p)}"></option>`).join('')
  }

  load().catch(() => {
    count.textContent = 'The jobs could not be loaded. Check your connection and refresh the page.'
  })
})()
