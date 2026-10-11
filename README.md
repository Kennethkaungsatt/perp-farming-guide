# Perp Farming Guide

A dark, premium, mobile-first static site that guides people on how to farm perp DEXs.
Everything is driven by **one JSON file** — add an entry and the new DEX appears on both
pages automatically (icon, animation, referral link, detail view, points sheet).

- **Landing page** — hero with the X profile `@justkennethape`, a *Follow on X* button, and two big selectable cards.
- **Page 1 · Perp DEX List** (`/perp-dex-list`) — animated logo grid, each card opens the referral link in a new tab.
- **Page 2 · Points Sheet** (`/points-sheet`) — the same grid; tapping a card opens a detail view with
  Description, Latest Updates, Points/Rewards, Funding/Rival Potential, a referral button, and — for
  Arcus, Vesper and Ondo — a zoomable points-sheet image.

Plain HTML/CSS/JS. No build step, no framework, no dependencies.

---

## 1. Run it locally

Requirements: **Node.js 18+** (only for the tiny local server; the site itself is static).

```bash
npm start          # → http://localhost:4173
```

That's it — `npm start` runs `node server.js`, a 90-line dependency-free static server.
It also rewrites unknown paths back to `index.html`, so the `/perp-dex-list` and `/points-sheet`
URLs work on refresh and on direct links (the same behaviour Vercel/Netlify provide).

Other ways to run it:

```bash
npm run dev                # same as npm start
PORT=8080 npm start        # different port
npx serve . -l 4173        # any static server also works (SPA fallback must be enabled)
```

> The site must be served over HTTP (not opened as a `file://` URL) because it fetches
> `data/dexes.json`. If the page shows "Could not load the DEX data", that's the cause.

---

## 2. Project structure

```
├── index.html              # app shell: SEO/OG meta, header, hero, footer
├── css/styles.css          # all styling (design tokens at the top)
├── js/app.js               # router, page rendering, detail dialog, lightbox
├── data/
│   ├── dexes.json          # ⭐ THE list of DEXs — edit this to add/remove venues
│   └── site.json           # site copy, X handle, referral note, "last updated"
├── assets/
│   ├── logos/              # DEX logos (webp, 256×256)
│   ├── points-sheets/      # points-sheet images (png, up to 1600px wide)
│   ├── brand/              # X logo used in the hero
│   ├── fonts/              # self-hosted Inter (400–800, woff2)
│   └── og-cover.png        # 1200×630 Open Graph preview image
├── admin/                  # optional local helper for editing dexes.json
├── tools/
│   ├── check.html          # behaviour self-test — open it in the browser
│   ├── og.html             # source used to render the OG image
│   └── shoot.js            # headless screenshots + ASCII layout render
├── server.js               # local dev server (not deployed)
├── vercel.json             # SPA rewrites for Vercel
├── netlify.toml            # SPA redirects for Netlify
└── 404.html                # fallback for hosts without rewrites
```

---

## 3. How to add a new Perp DEX

Adding a venue is **three steps**: drop in the images, paste an entry, save. No layout or code changes.

### Step 1 — put the images in place

| Image | Put it here | Recommended |
|---|---|---|
| Logo | `assets/logos/mydex.webp` | square, 256×256, webp/png/jpg |
| Points sheet (only if it has one) | `assets/points-sheets/mydex-points-sheet.png` | ≤1600px wide, png or jpg |

Any image format works (png, jpg, webp) — just write the real filename in the JSON.
A square logo is cropped to a square, so use a square source.

Compress big images first (optional):

```bash
npx sharp-cli resize assets/logos/mydex.png --width 256 --format webp -o assets/logos/mydex.webp
```

### Step 2 — paste this entry into `data/dexes.json`

Add it anywhere inside the `dexes` array (the array must stay comma-separated):
put a comma after the previous entry, then paste.

```json
{
  "id": "mydex",
  "name": "MyDex",
  "logo": "/assets/logos/mydex.webp",
  "referralUrl": "https://app.mydex.com/?ref=YOURCODE",
  "status": "active",
  "shortDescription": "One or two sentences: what the venue is, what you can trade, and what is open to whom.",
  "latestUpdates": [
    "Points program launched.",
    "New listings and higher leverage."
  ],
  "pointsInfo": "How points/rewards work. Write 'No official points or airdrop.' when that is the case.",
  "fundingInfo": "Raised $XM from … , team from … , volume/open interest, and how it stacks up against rivals.",
  "speculation": [
    "Anything not officially announced must be labelled here and will render with a Speculation badge."
  ],
  "hasPointsSheet": false,
  "pointsSheetImage": null,
  "pointsSheetAlt": null,
  "displayOrder": 8
}
```

Field reference:

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | unique slug, also used for `data-open-dex` |
| `name` | ✅ | shown under the logo and in the detail view |
| `logo` | ✅ | path starting with `/assets/...` |
| `referralUrl` | ✅ | opens in a new tab with `rel="noopener noreferrer"` |
| `status` | ✅ | `"active"` (clickable) or `"coming soon"` (greyed out) |
| `shortDescription` | ✅ | Description section |
| `latestUpdates` | ✅ | array of strings → bullet list |
| `pointsInfo` | ✅ | Points / Rewards section |
| `fundingInfo` | ✅ | Funding / Rival Potential section |
| `speculation` | ⬜ | array; each item gets an amber **Speculation** badge |
| `hasPointsSheet` | ✅ | `true` only when an image is provided |
| `pointsSheetImage` | ⬜ | path, e.g. `/assets/points-sheets/mydex-points-sheet.png` |
| `pointsSheetAlt` | ⬜ | alt text for the sheet (accessibility) |
| `displayOrder` | ✅ | sort order on **both** pages (1, 2, 3 …) |

### Step 3 — save and refresh

Reload the page. The new card is already on Page 1 (with its link) and Page 2 (with its detail view,
animations, chips and everything else). Set `hasPointsSheet: true` + `pointsSheetImage` and the
zoomable sheet appears under the description.

**That's the whole system** — `js/app.js` reads `data/dexes.json` and renders every card, chip,
dialog and animation from it. Adding a DEX never requires a layout change.

Want a visual editor? Open **`/admin`** while the local server is running (see §6).

---

## 4. Editing the site copy and dates

`data/site.json`:

```json
{
  "tagline": "Your guide to farming Perp DEXs",
  "lastUpdated": "2026-10-11",
  "profile": { "handle": "@justkennethape", "url": "https://x.com/justkennethape" },
  "referralNote": "Referral links: I may earn rewards if you sign up through them. Not financial advice. DYOR."
}
```

`lastUpdated` drives the "Updated …" chip on both pages and "Last updated" in the footer.
The hero headline/subheadline live in `index.html` (search for `hero__title` / `hero__sub`).

---

## 5. Free deployment (Vercel or Netlify)

The project is fully static — both hosts serve it for free with **no build command**.

**Before deploying:** replace `https://your-domain.com` in `index.html` with your real URL
(it appears in `rel="canonical"`, `og:url`, `og:image`, `twitter:image` and the JSON-LD block).
Until you do, link previews will not resolve.

### Vercel

1. Push the project to GitHub/GitLab/Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo.
3. Framework Preset: **Other**. Build Command: *(leave empty)*. Output Directory: **`.`**.
4. Deploy. `vercel.json` already provides the SPA rewrites.
5. Optional: add your domain under *Project → Settings → Domains*.

### Netlify

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag this folder in — or connect the repo.
2. If connecting the repo: Build command: *(leave empty)*, Publish directory: **`.`**.
3. Deploy. `netlify.toml` already provides the SPA redirects.

Both give you a free `*.vercel.app` / `*.netlify.app` URL. `server.js`, `tools/` and `admin/`
are harmless if uploaded; only `server.js` is local-only (the hosts never run it).

---

## 6. Admin page (optional helper, local only)

`/admin` gives you a form to add/edit/delete DEXs instead of hand-editing JSON.

```bash
npm start                 # then open http://localhost:4173/admin/
# passphrase: perpfarm    (change it with ADMIN_PASS=yournextpassword npm start)
```

- **With the local server**: *Save* writes `data/dexes.json` directly, and *Upload image* writes the
  file into `assets/logos/` or `assets/points-sheets/` with the correct filename. Everything just works.
- **On a deployed (static) host**: there is no server to write to, so the admin falls back to
  *Download `dexes.json`* / *Download image* — you then drop the files into place yourself.

### Tradeoffs (why this isn't a headless CMS)

| Approach | Pros | Cons |
|---|---|---|
| **This repo (JSON + local admin)** ✅ | zero dependencies, free hosting, version-controlled content, instant, no vendor lock-in, works offline | editing happens on your machine; the passphrase is **client-side only** and is not real security — anyone who can reach `/admin` can read the form |
| Headless CMS (Sanity, Contentful, Netlify CMS) | non-technical editors, hosted, auth, image CDN | accounts, quotas, build step or client SDK, vendor lock-in |
| Supabase / Firebase | real auth, database, image storage | requires a backend + keys, a build step, and breaks the "static, deploy anywhere" property |
| No admin at all (edit JSON by hand) | simplest possible system | hand-editing JSON is error-prone for non-developers |

The admin page is deliberately honest about its limits: the passphrase only protects a page that has
nothing secret in it. If the site ever needs multi-user editing or private content, add a real CMS —
but for a single author maintaining a list, a JSON file in git beats all of them.

---

## 7. Assumptions I made

1. **Image → DEX matching.** Filenames were unambiguous, so mapping is 1:1:
   `Arcus.png → arcus`, `entropy.jpg → entropy`, `QFEX.jpg → qfex`, `Vesper.jpg → vesper`,
   `Ondo.png → ondo`, `Hyperliquid.jpg → hyperliquid`, `tradexyz.jpg → tradexyz`.
   `twitterlogo.png` was used as the X mark in the hero and header.
2. **Points sheets.** `arcus points sheet.png`, `vesper points sheet.png` and
   `ondo_perps_point_value_v2.png` map to Arcus, Vesper and Ondo — the only three DEXs with sheets.
   All other venues show text only.
3. **Vesper's link.** The brief lists Vesper → `https://sypherscore.com/invite?ref=VSP-KENNETH`, while
   the copy mentions `sypherscore.com/vesper` as the product page. I used the **invite link** from the
   DEX list (it carries your referral code); the product URL is described in the text only.
4. **QFEX has no referral code** in the brief, so its card links to `https://www.qfex.com/`.
5. **"Coming soon" status** is supported by the schema (`status: "coming soon"` greys the card out)
   but no venue uses it today — all 7 are `active`.
6. **Display order** follows the order in the brief (Arcus → Entropy → QFEX → Vesper → Ondo →
   Hyperliquid → TradeXYZ) via `displayOrder: 1..7`.
7. **Speculation labelling.** Any forward-looking claim (QFEX airdrop, Ondo token, a future Hyperliquid
   points season, future TradeXYZ rewards) lives in the `speculation` array and renders with an amber
   **Speculation** badge; the footer states that speculative statements are labelled.
8. **Funding gaps.** Arcus discloses no funding in the source text, so its Funding section says so and
   describes its competitive position instead of inventing numbers. Vesper has no disclosed round.
9. **Hero name.** Your X display name could not be fetched, so the card shows the handle
   `@justkennethape` plus the role line "Curated perp DEX list & points sheets". Edit
   `index.html` → `profile-card__meta` to change it.
10. **Dates.** "Last updated" is hard-set to `2026-10-11` in `data/site.json` (today) — bump it when
    you edit content.
11. **Colour/contrast.** Body text is ≥ 4.5:1 on the dark background; mint `#2ee6a8` is the single
    accent, violet is ambient background only.

---

## 8. Accessibility & performance notes

- Semantic landmarks (`header`/`main`/`nav`/`footer`), a skip link, `<ul>` grids, alt text on every logo.
- Every card is a real link or button: visible **focus ring** (2 px mint outline), keyboard operable.
- Detail view uses a native `<dialog>`: focus trap, `Esc` to close, focus returned to the card,
  background scroll locked, `role`/`aria-label` handled by the browser.
- `prefers-reduced-motion: reduce` disables all entrance/hover/transition motion (CSS + JS).
- Inter is self-hosted (2 subsets, ~134 KB) — no third-party requests at all.
- Logos are 256 px webp (~1–5 KB each); lazy-loaded below the fold.

### Self-test

With the server running, open **http://localhost:4173/tools/check.html** — it drives the real site
in an iframe and prints PASS/FAIL for 39 checks (both grids, ordering, every referral link,
`rel="noopener noreferrer"`, alt text, footer note, detail dialog sections, points-sheet zoom,
focus restore, SEO/OG meta, reduced-motion support).

Two of them (body-scroll unlock and focus restore after closing a dialog) can only run in a
**visible** browser — headless Chrome does not dispatch `<dialog>` close events when nothing is
composited — so they report `WARN` instead of `FAIL` there.

Optional dev tools (need `npm i --no-save sharp` first):

```bash
node tools/shoot.js        # headless screenshots + ASCII render of every page/size
```

To regenerate the Open Graph image after changing `tools/og.html`, see the comment at the top of that file.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not load the DEX data" | You're on a `file://` URL or a server without the JSON — use `npm start` |
| Blank page at `/perp-dex-list` after deploying | Your host needs the SPA rewrite — `vercel.json` / `netlify.toml` are included; for GitHub Pages use the provided `404.html` |
| Link previews show no image | Replace `https://your-domain.com` in `index.html` with your real domain |
| New DEX not showing | Check for a trailing comma / missing quote in `data/dexes.json` (the site prints the JSON error), and confirm `displayOrder` |
| Logo looks cropped | Use a square source image |
