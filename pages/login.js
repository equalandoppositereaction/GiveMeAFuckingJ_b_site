/**
 * Log in, create an account, or reset a password: the same accounts as the desktop app, with the same
 * eight-digit codes by email. The session is a cookie the API sets and no script can read.
 */
import { $, api, esc, me, param } from '/app.js'

/** Where to go afterwards: a path on this site, never another site. */
const safeNext = (v) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/feed')

export default async function ({ main }) {
  const next = safeNext(param('next'))
  if (me) return void location.replace(next)
  let mode = param('new') ? 'new' : 'in'
  let pending = { email: '', password: '', name: '' }
  const device = () => {
    try {
      return localStorage.getItem('gmafj.device') || undefined
    } catch {
      return undefined
    }
  }
  const signedIn = (r, isNew) => {
    try {
      if (r.device) localStorage.setItem('gmafj.device', r.device)
      localStorage.setItem('gmafj.in', '1')
    } catch {
      /* not remembered */
    }
    // A new account starts by filling in its profile.
    location.replace(isNew ? '/settings?welcome=1' : next)
  }

  const legal = '<p class="legal">By continuing you agree to the <a href="/terms">Terms of Use</a> and the <a href="/privacy">Privacy Policy</a>.</p>'
  const forms = {
    in: () => `<p class="sub">Log in to apply, connect and share.</p>
<form data-f="in"><input class="input" name="email" type="email" autocomplete="email" placeholder="Email" required>
<input class="input" name="password" type="password" autocomplete="current-password" placeholder="Password" required>
<button class="btn wide" type="submit">Log in</button><p class="err" hidden></p></form>
<p class="alt"><button class="textbtn" type="button" data-go="forgot">Forgot password?</button></p>
<p class="alt">New to GMAFJ? <button class="textbtn" type="button" data-go="new">Create an account</button></p>`,
    new: () => `<p class="sub">Apply to jobs with one click, connect with people and share updates. Free.</p>
<form data-f="new"><input class="input" name="name" autocomplete="name" placeholder="Full name" maxlength="100" required>
<input class="input" name="email" type="email" autocomplete="email" placeholder="Email" required>
<p class="muted small" style="margin:-4px 2px 2px;text-align:left">An address at Gmail, Outlook, Hotmail, Yahoo, iCloud, Proton or another major email provider.</p>
<input class="input" name="password" type="password" autocomplete="new-password" placeholder="Password, at least 10 characters" minlength="10" required>
<button class="btn wide" type="submit">Create account</button><p class="err" hidden></p></form>${legal}
<p class="alt">Have an account? <button class="textbtn" type="button" data-go="in">Log in</button></p>`,
    code: () => `<p class="sub">We emailed a code to <b>${esc(pending.email)}</b>. Enter it to finish.</p>
<form data-f="code"><input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{8}" maxlength="8" placeholder="8-digit code" required>
<button class="btn wide" type="submit">Verify</button><p class="err" hidden></p><p class="okay" hidden></p></form>
<p class="alt"><button class="textbtn" type="button" data-resend>Send a new code</button> · <button class="textbtn" type="button" data-go="new">Use another email</button></p>`,
    forgot: () => `<p class="sub">We will email you a code to set a new password.</p>
<form data-f="forgot"><input class="input" name="email" type="email" autocomplete="email" placeholder="Email" required>
<button class="btn wide" type="submit">Send the code</button><p class="err" hidden></p></form>
<p class="alt"><button class="textbtn" type="button" data-go="in">Back to log in</button></p>`,
    reset: () => `<p class="sub">If <b>${esc(pending.email)}</b> has an account, a code is on its way.</p>
<form data-f="reset"><input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{8}" maxlength="8" placeholder="8-digit code" required>
<input class="input" name="password" type="password" autocomplete="new-password" placeholder="New password, at least 10 characters" minlength="10" required>
<button class="btn wide" type="submit">Set the password and log in</button><p class="err" hidden></p></form>
<p class="alt"><button class="textbtn" type="button" data-go="in">Back to log in</button></p>`
  }

  function draw() {
    main.innerHTML = `<div class="auth"><div class="card"><div class="brand">GMAFJ</div>${forms[mode]()}</div></div>`
    $('input', main)?.focus()
  }

  const submitters = {
    async in(v) {
      signedIn(await api('POST', '/auth/login', { email: v.email, password: v.password, device: device() }), false)
    },
    async new(v) {
      pending = { email: v.email.trim(), password: v.password, name: v.name.trim() }
      await api('POST', '/auth/signup', { email: pending.email, password: pending.password, name: pending.name })
      mode = 'code'
      draw()
    },
    async code(v) {
      signedIn(await api('POST', '/auth/verify-email', { email: pending.email, code: v.code.trim(), password: pending.password, name: pending.name }), true)
    },
    async forgot(v) {
      pending.email = v.email.trim()
      await api('POST', '/auth/forgot-password', { email: pending.email })
      mode = 'reset'
      draw()
    },
    async reset(v) {
      signedIn(await api('POST', '/auth/reset-password', { email: pending.email, code: v.code.trim(), password: v.password }), false)
    }
  }

  main.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-f]')
    if (!form) return
    e.preventDefault()
    const err = $('.err', form)
    const btn = $('button[type=submit]', form)
    err.hidden = true
    btn.disabled = true
    try {
      await submitters[form.dataset.f](Object.fromEntries(new FormData(form)))
    } catch (x) {
      err.textContent = x.message
      err.hidden = false
      btn.disabled = false
    }
  })
  main.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]')
    if (go) {
      mode = go.dataset.go
      return draw()
    }
    if (e.target.closest('[data-resend]')) {
      const ok = $('.okay', main)
      try {
        await api('POST', '/auth/resend-verification', { email: pending.email })
        ok.textContent = 'A new code is on its way. Codes can be sent once a minute.'
        ok.hidden = false
      } catch (x) {
        ok.textContent = x.message
        ok.hidden = false
      }
    }
  })
  draw()
}
