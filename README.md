# givemeafuckingjob.com

The website: one page, no build step. Put the contents of this folder at the root of a GitHub repository and serve it with GitHub Pages.

1. Create a repository and push `index.html`, `favicon.png` and `CNAME` to its `main` branch.
2. In the repository: **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, then `main`, then `/ (root)`. The custom domain fills in from `CNAME`.
3. In Cloudflare DNS for `givemeafuckingjob.com`, add these records with the proxy **off** (grey cloud) so GitHub can issue the certificate:
   - `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` pointing to `<your-github-username>.github.io`
   
   Leave `api` alone: it is the server's tunnel.
4. Once GitHub shows the certificate is ready, tick **Enforce HTTPS**.

The download button links to `https://api.givemeafuckingjob.com/app/download/windows`. The server redirects that link to whichever installer `npm run release:publish` put there last, so this page never needs to change when a new version comes out.
