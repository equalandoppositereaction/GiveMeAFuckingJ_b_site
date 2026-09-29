# givemeafuckingjob.com

The website: the home page, the Privacy Policy, Terms of Use and AI Disclosure, and the app's ad pages. No build step. Put the contents of this folder at the root of a GitHub repository and serve it with GitHub Pages.

1. Create a repository and push everything in this folder (`index.html`, `privacy.html`, `terms.html`, `ai-disclosure.html`, `s.css`, the `*ad*.html` pages, `ads.txt`, `favicon.png` and `CNAME`) to its `main` branch.
2. In the repository: **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, then `main`, then `/ (root)`. The custom domain fills in from `CNAME`.
3. In Cloudflare DNS for `givemeafuckingjob.com`, add these records with the proxy **off** (grey cloud) so GitHub can issue the certificate:
   - `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` pointing to `<your-github-username>.github.io`

   Leave `api` alone: it is the server's tunnel.
4. Once GitHub shows the certificate is ready, tick **Enforce HTTPS**.

"From our server" links to `https://api.givemeafuckingjob.com/app/download/windows`, which the server redirects to whichever installer `npm run release:publish` put there last.

## Design

`s.css` follows the look of thielfellowship.org: a near-black cover with a large regular-weight headline, monospace captions, links drawn as a rule above the text, then white, left-aligned sections with hairline dividers, and a light grey footer. It uses the system's fonts (Segoe UI on Windows), so the pages download no fonts.

## The legal pages

- `/privacy`, `/terms` and `/ai-disclosure` are the addresses the app links to (Account, and under Create account); GitHub Pages serves the `.html` files there.
- They cover both names of the app: "GMAFJ" on the Microsoft Store and "GiveMeAFuckingJ*b" here.
- Use `https://givemeafuckingjob.com/privacy` as the privacy policy URL in Partner Center.
- They name `support@givemeafuckingjob.com`. That address must receive mail: Cloudflare → Email → Email Routing can forward it to your inbox.
- The privacy policy says consent is asked where the law requires it before personalized ads. In AdSense, turn on **Privacy & messaging → European regulations** (Google's own consent message) so that is true.

## The ad pages

The app shows two pages beside each screen, in the empty space to its left and right: `<menu>adleft.html` and `<menu>adright.html`, for `dashboard`, `profile`, `jobsite` (Profile on Job Sites), `coldmail`, `answers`, `account` and `settings`. Each is one line, kept small on purpose: the "Why ads?" note, then two empty boxes, `<div class=a></div>`, one above the other.

- Paste each ad's code inside a box: `<div class=a>` the ad code `</div>`.
- The app opens a page as `https://givemeafuckingjob.com/dashboardadleft.html?theme=dark` (or `light`), and the page paints the app's own background for that theme: `#f5f5f5` light, `#0a0a0a` dark. Opened without `?theme=`, it follows the system's theme.
- Keep the `<script>` at the end: it sets the theme and tells the app the page is there. The app shows a page only once it has heard it, so a missing page, or a computer that is offline, shows nothing.
- The app shows a column only where the space beside the screen is at least 160px wide, and at most 336px; a narrow window shows none.
- A click on an ad opens in the app's own browser, never in the app's window.
