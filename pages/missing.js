/**
 * An address the site has no page for (GitHub Pages serves /404.html for it). A profile's own address,
 * /u/<username> (the owner, 2026-10-23: "The users should be at /u/ in the link"), is one: no page can be made
 * for every username, so this one shows the profile. Anything else is not here.
 */
import { me } from '/app.js'

export default async function ({ main }) {
  if (/^\/u\/?$/.test(location.pathname)) return void location.replace(me ? `/u/${encodeURIComponent(me.handle)}` : '/login?next=/u')
  if (/^\/u\/[^/]+(\/posts)?\/?$/.test(location.pathname)) return (await import('/pages/profile.js')).default({ main })
  document.title = 'Page not found | Oporch'
  main.innerHTML = `<div class="empty"><h2>This page does not exist</h2><p>The address may be mistyped, or the page may have moved.</p><a class="btn" href="${me ? '/home' : '/'}">${me ? 'Go to Home' : 'See jobs'}</a></div>`
}
