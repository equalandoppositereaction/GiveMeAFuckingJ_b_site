/**
 * Who viewed your profile, as LinkedIn shows it: how many in the past 90 days and this week, and who.
 * Someone who browses privately shows as "Someone on GMAFJ"; a member who browses privately sees only the
 * numbers. Pro shows everyone who looked; otherwise the three most recent (server: social/people.ts).
 */
import { $, ago, api, esc, me, personRow, plural } from '/app.js'

export default async function ({ main }) {
  if (!me) return void location.replace('/login?next=/views')
  main.innerHTML = '<div class="page narrow"><div class="page-h"><h1>Who viewed your profile</h1></div><div id="out"><div class="spin"></div></div></div>'
  const out = $('#out', main)
  let v
  try {
    v = await api('GET', '/social/me/views')
  } catch (e) {
    out.innerHTML = `<p class="empty">${esc(e.message)}</p>`
    return
  }
  const note =
    v.limited === 'private'
      ? '<p class="muted small">You view profiles privately, so you see how many people looked but not who. Change it in <a class="link" href="/settings#privacy">Settings</a>.</p>'
      : v.limited === 'plan'
        ? `<p class="muted small">You see the ${plural(v.viewers.length, 'most recent viewer')}. Pro shows everyone who viewed your profile.</p>`
        : ''
  out.innerHTML = `<div class="card"><div class="sec"><div class="stats"><div><b>${v.total.toLocaleString('en')}</b><span class="muted small">profile ${v.total === 1 ? 'view' : 'views'} in the past 90 days</span></div><div><b>${v.week.toLocaleString('en')}</b><span class="muted small">this week</span></div></div>${note}</div>
<div class="sec">${
    v.viewers
      .map((x) =>
        x.person
          ? `<div class="viewer">${personRow(x.person, x.person.degree === 1 ? 'connected' : 'none', x.person.headline)}<span class="muted small">${ago(x.at)}</span></div>`
          : `<div class="viewer person"><span class="av i" aria-hidden="true" style="font-size:15px">?</span><div class="grow"><b class="small">Someone on GMAFJ</b><div class="who-h">Browsing privately</div></div><span class="muted small">${ago(x.at)}</span></div>`
      )
      .join('') || (v.limited === 'private' ? '' : '<div class="empty"><p>Nobody has viewed your profile in the past 90 days yet. Share an update to be seen.</p></div>')
  }</div></div>`
}
