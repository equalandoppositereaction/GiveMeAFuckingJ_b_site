/**
 * The job search on the home page (the owner, 2026-10-05).
 *
 * Until somebody searches, the page shows a fixed few jobs from jobs/home.json, in English. Results come
 * as the words are typed and the filters picked (the owner, 2026-10-07). The first search fetches the
 * full list, jobs/index.txt (several megabytes), in one request; it is searched on the visitor's own
 * device as it streams in, the first results showing at once, and the count is exact once it is all in.
 * Twelve boxes at a time, ads included.
 *
 * A job's link and details are in its chunk, jobs/<chunk>.json, fetched when the job is opened, or as
 * the pointer reaches its Apply. Apply opens the job's page itself in a new tab; no link is ever shown.
 * Formats: scripts/build-jobs.mjs.
 */
;(() => {
  // Twelve boxes at a time, the ads among them (the owner, 2026-10-07).
  const BOXES = 12
  const EARLY = 3000 // jobs read before the first results show
  const TYPING = 300 // ms after the last key before the search runs
  /*
   * The ad unit in every sixth box. With only a slot it is a responsive display ad; give it the in-feed
   * unit's slot and layout key (AdSense: Ads, By ad unit, In-feed ads; the code it shows has both) and
   * it becomes an in-feed ad styled like the jobs.
   */
  const FEED_SLOT = '2714256184'
  const FEED_LAYOUT = ''
  const TYPE = { F: 'Full time', P: 'Part time', C: 'Contract', I: 'Internship', T: 'Temporary', L: 'Freelance', A: 'Apprenticeship' }
  const LEVEL = { E: 'Entry level', M: 'Mid level', S: 'Senior level', X: 'Executive level' }
  const SYMBOL = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'CA$', AUD: 'A$', SGD: 'S$', NZD: 'NZ$', HKD: 'HK$', BRL: 'R$', MXN: 'MX$', CNY: 'CN¥', KRW: '₩', ILS: '₪', PHP: '₱' }
  const ARROW = '<svg class="arrow" viewBox="0 0 17 14" fill="none" aria-hidden="true"><path stroke="currentColor" d="M1 7h15M10 1l6 6-6 6"/></svg>'
  const NICHE = 'Ultra niche jobs were extracted directly from the employer’s career page and usually don’t have many applicants to compete with.'
  const AD = `<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-9726750731585284" data-ad-slot="${FEED_SLOT}" ${
    FEED_LAYOUT ? `data-ad-format="fluid" data-ad-layout-key="${FEED_LAYOUT}"` : 'data-ad-format="auto"'
  }></ins>`
  // The fifth box of every six is an ad, in a job's frame; until AdSense fills it, or when it cannot, it offers the app.
  const AD_TILE = `<div class="ad-tile"><span class="ad-label mono">Advertisement</span>${AD}<div class="house"><p>Find more jobs and apply to them with one click, from our desktop app.</p><a class="apply" href="/download">Download free${ARROW}</a></div></div>`
  const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u
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

  /**
   * Every ad on screen not yet asked for. A push fills the FIRST unfilled adsbygoogle unit in the page, not a
   * chosen one, so a unit that is hidden must never be in the page unpushed.
   */
  function ads(root) {
    for (const ins of root.querySelectorAll('ins.adsbygoogle:not([data-pushed])')) {
      if (!ins.offsetWidth) continue // hidden at this width: an ad there would have no size
      ins.dataset.pushed = '1'
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch {
        /* blocked, or not approved yet: the space stays empty */
      }
    }
  }

  // ── The full list, column by column, read on the first search
  let head = null
  let n = 0
  let ids, days, titles, locs, ccs, flags, pays, chunkOf, latin
  let loaded = false
  let loading = null

  function start(line) {
    head = JSON.parse(line)
    ids = new Int32Array(head.count)
    days = new Int32Array(head.count)
    latin = new Uint8Array(head.count)
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
    latin[n] = LATIN.test(f[1]) ? 1 : 0
    n++
  }

  /** The whole list, in one request: the search runs once enough has arrived to show something, and again when all of it has. */
  async function load() {
    const res = await fetch('jobs/index.txt', { cache: 'no-cache' })
    if (!res.ok || !res.body) throw new Error(String(res.status))
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let rest = ''
    let early = false
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = (rest + value).split('\n')
      rest = lines.pop()
      for (const line of lines) head ? add(line) : start(line)
      if (!early && n >= EARLY) {
        early = true
        search(true)
      }
    }
    if (rest) head ? add(rest) : start(rest)
    loaded = true
    places()
  }

  /** The job at position i of the full list, as a tile needs it. */
  const jobAt = (i) => ({ id: ids[i], title: titles[i], loc: locs[i], flags: flags[i], day: days[i], pay: pays[i], chunk: chunkOf[i], detail: null })

  // ── Searching
  let found = [] // jobs, as tiles need them
  let shown = 0 // jobs on screen
  let boxes = 0 // and boxes, the ads among them

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

  /**
   * Searches what has loaded, newest posting day first, Latin-script titles first so a search does not
   * open on a wall of Chinese. `keep`: the same search with more of the list in, so the boxes already on
   * screen stay that many.
   */
  function search(keep = false) {
    const words = norm(qIn.value).split(' ').filter(Boolean).map((w) => ' ' + w)
    const place = placeTest(locIn.value)
    const mode = modeIn.value, type = typeIn.value, level = levelIn.value
    const since = +postedIn.value ? today - +postedIn.value : 0
    const byDay = [new Map(), new Map()]
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
      const by = byDay[latin[i]]
      const list = by.get(days[i])
      if (list) list.push(i)
      else by.set(days[i], [i])
    }
    const order = (by) => [...by.keys()].sort((a, b) => b - a).flatMap((d) => by.get(d))
    found = [...order(byDay[1]), ...order(byDay[0])].map(jobAt)
    render(keep ? Math.max(boxes, BOXES) : BOXES)
    tell(`${found.length.toLocaleString('en')} ${found.length === 1 ? 'job' : 'jobs'}${loaded ? '' : ` so far, ${(head.count - n).toLocaleString('en')} more loading…`}`)
  }

  /** Runs the search in the boxes, fetching the list first if this is the first search. Empty boxes go back to the home page's few. */
  async function run() {
    remember()
    if (!fields.some((el) => el.value.trim())) return void showHome()
    // A new search starts at twelve boxes, unless the list was still coming in: then what is on screen stays.
    const waited = !loaded
    if (!loaded) {
      if (!loading) {
        tell('Searching…')
        loading = load().catch((e) => {
          loading = null
          throw e
        })
      }
      try {
        await loading
      } catch {
        count.textContent = 'The jobs could not be loaded. Check your connection and search again.'
        return
      }
      // Cleared while the list was loading: the home page's few stay.
      if (!fields.some((el) => el.value.trim())) return
    }
    search(waited)
  }

  /** The line above the tiles: how many, and that the app has more. */
  function tell(text) {
    count.innerHTML = `${esc(text)} <a class="more-app" href="/download">(more on our desktop app)</a>`
  }

  function render(upTo) {
    shown = 0
    boxes = 0
    grid.textContent = ''
    byKey.clear()
    page(upTo)
  }

  /** Draws boxes up to `upTo` (twelve more by default). An ad only with a job after it, so a list never ends on one. */
  function page(upTo = boxes + BOXES) {
    const html = []
    while (boxes < upTo && shown < found.length) {
      if (boxes % 6 === 4) {
        html.push(AD_TILE)
        boxes++
        if (boxes >= upTo) break
      }
      html.push(tile(found[shown++]))
      boxes++
    }
    grid.insertAdjacentHTML('beforeend', html.join(''))
    // Gone once every job found is on screen: a button that does nothing is worse than none.
    more.hidden = shown >= found.length
    ads(grid)
  }

  // ── The home page's own few, before any search
  let homeJobs = null
  let homeTotal = 0
  function showHome() {
    if (!homeJobs) return void loadHome()
    found = homeJobs
    render(BOXES)
    tell(`${homeTotal.toLocaleString('en')} jobs`)
  }
  function loadHome() {
    fetch('jobs/home.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((h) => {
        homeJobs = h.jobs.map(([id, title, loc, , fl, day, pay, ...d]) => ({ id, title, loc, flags: fl, day, pay, detail: d }))
        homeTotal = h.total
        if (!fields.some((el) => el.value.trim())) showHome()
      })
      .catch(() => {
        count.textContent = 'The jobs could not be loaded. Check your connection and refresh the page.'
      })
  }

  // ── Tiles
  const byKey = new Map() // tile's job id -> the job, for its buttons

  /** "EUR75-86~" -> "€75K-86K a year (estimated)"; rupees in lakhs. */
  function salary(s) {
    const m = /^([A-Z]{3})([\d.]+)(?:-([\d.]+))?(~?)$/.exec(s)
    if (!m) return 'Salary not listed'
    const [, cur, lo, hi, est] = m
    const amount = (v) => (cur === 'INR' && v >= 100 ? `${+(v / 100).toFixed(1)}L` : `${v}K`)
    const sym = SYMBOL[cur]
    return `${sym ?? cur + ' '}${amount(+lo)}${hi ? '-' + amount(+hi) : ''} a year${est ? ' (estimated)' : ''}`
  }

  function tile(job) {
    byKey.set(job.id, job)
    const f = job.flags
    const tags = [f[2] === 'R' ? 'Remote' : 'On-site', TYPE[f[0]]].filter(Boolean).join(' · ')
    return `<article class="job" data-id="${job.id}">
<span class="niche mono" tabindex="0">Ultra niche<span class="tip" role="tooltip">${NICHE}</span></span>
<div class="top">
<h3><button type="button" aria-expanded="false">${esc(job.title)}</button></h3>
<p class="mono">${esc(job.loc || 'Location not listed')}</p>
<p class="mono">${tags}</p>
<p class="mono">${esc(salary(job.pay))}</p>
<button class="apply" type="button">Apply${ARROW}</button>
</div>
<div class="more" hidden></div>
<a class="app mono" href="/download">Apply with one click from our desktop app for free${ARROW}</a>
</article>`
  }

  const chunks = new Map()
  /** The job's link and details: [url, years, tasks, perks, skills, roles, education, language]. */
  function detail(job) {
    if (job.detail) return Promise.resolve(job.detail)
    if (!chunks.has(job.chunk)) {
      const p = fetch(`jobs/${job.chunk}.json?v=${head.build}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .catch((e) => {
          chunks.delete(job.chunk)
          throw e
        })
      chunks.set(job.chunk, p)
    }
    return chunks.get(job.chunk).then((c) => (job.detail = c[job.id] || null))
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

  function details(job, d) {
    const f = job.flags
    const [, years = 0, tasks = [], perks = [], skills = [], roles = [], education = [], lang = ''] = d || []
    const experience = [LEVEL[f[1]], years ? `about ${years} ${years === 1 ? 'year' : 'years'} of experience` : ''].filter(Boolean).join(', ')
    const facts = [posted(job.day), experience, education.length ? `Education: ${education.join(', ')}` : '', lang ? `The posting is in ${language(lang)}` : '']
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

  async function toggle(el) {
    const job = byKey.get(+el.dataset.id)
    const open = !el.classList.contains('open')
    el.classList.toggle('open', open)
    el.querySelector('h3 button').setAttribute('aria-expanded', String(open))
    const box = el.querySelector('.more')
    box.hidden = !open
    if (!open) return
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (box.dataset.filled) return
    box.dataset.filled = '1'
    if (!job.detail) box.innerHTML = '<p class="mono">Loading the details…</p>'
    try {
      box.innerHTML = details(job, await detail(job))
    } catch {
      delete box.dataset.filled
      box.innerHTML = '<p class="mono">The details could not be loaded. Close the job and open it again to retry.</p>'
    }
  }

  /**
   * Straight to the job's page, in a new tab. A tab can only be opened in the click itself, so when the
   * link has not arrived yet the tab opens empty and is sent on once it has.
   */
  async function apply(job, button) {
    if (job.detail) return void window.open(job.detail[0], '_blank', 'noopener')
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const d = await detail(job)
      if (d && /^https?:\/\//i.test(d[0])) {
        if (tab) tab.location.replace(d[0])
        else window.open(d[0], '_blank', 'noopener')
        return
      }
    } catch {
      /* said below */
    }
    tab?.close()
    button.textContent = 'No longer listed'
    button.disabled = true
  }

  grid.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('a, .niche')) return
    const job = t.closest('.job')
    if (!job) return
    const button = t.closest('.apply')
    if (button) return void apply(byKey.get(+job.dataset.id), button)
    // Anywhere else on a tile's top part opens or closes it; a drag to select text does not.
    if (t.closest('.top') && !String(getSelection()).length) toggle(job)
  })
  // The link is fetched as the pointer reaches Apply, so the click can open the page at once.
  const early = (e) => {
    const job = e.target.closest?.('.apply') && e.target.closest('.job')
    if (job) detail(byKey.get(+job.dataset.id)).catch(() => {})
  }
  grid.addEventListener('pointerover', early)
  grid.addEventListener('focusin', early)
  more.addEventListener('click', () => page())

  // ── The search box and filters: results as they are typed and picked, a moment after the last key.
  let typing = 0
  form.addEventListener('input', (e) => {
    if (e.target.tagName === 'SELECT') return
    clearTimeout(typing)
    typing = setTimeout(() => void run(), TYPING)
  })
  form.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT') void run()
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    clearTimeout(typing)
    void run()
    if (matchMedia('(hover: none)').matches) document.activeElement.blur()
  })

  /** The search in the address, so it can be shared, bookmarked and reloaded. */
  function remember() {
    const p = new URLSearchParams()
    for (const el of fields) if (el.value.trim()) p.set(el.name, el.value.trim())
    const q = p.toString()
    history.replaceState(null, '', q ? `?${q}` : location.pathname)
  }

  /** Suggestions for the location box, once the whole list has been read: the countries with the most jobs, then the most common cities. */
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

  // ── First paint: the home page's own few, or the search in the address.
  ads(document)
  const asked = new URLSearchParams(location.search)
  for (const el of fields) if (asked.has(el.name)) el.value = asked.get(el.name)
  if (fields.some((el) => el.value)) void run()
  else showHome()
})()
