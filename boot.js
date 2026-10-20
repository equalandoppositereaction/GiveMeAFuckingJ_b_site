// Before the page paints: the menus as the last visit left them (signed in or not), and Dark mode if it was
// chosen (light by default, as the desktop app). app.js then knows for sure.
try {
  var d = document.documentElement
  if (localStorage.getItem('gmafj.in') === '1') d.classList.add('in')
  if (localStorage.getItem('gmafj.theme') === 'dark') {
    d.classList.add('dark')
    var m = document.querySelector('meta[name=theme-color]')
    if (m) m.content = '#111111'
  }
} catch (e) {}
