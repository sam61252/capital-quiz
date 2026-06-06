# Flags & Capitals 🌍

A small, fast, **offline** geography quiz covering **207 countries** — flags & capitals.
It's a Progressive Web App (PWA): a plain static website with no framework and no
backend. Add it to your iPhone Home Screen and it behaves like a native app, fully
offline, for **$0**.

### Modes (all multiple-choice, 4 options)

| Mode | You see… | You pick… |
|---|---|---|
| **Guess the Country** | a flag | the country |
| **Find the Flag** | a country | its flag |
| **Name the Capital** | a country | its capital |
| **Whose Capital?** | a capital | the country |
| **Mixed** | a random mix of all four | |

Wrong answers are chosen to be *plausible* — same continent/sub-region, and for flag
questions biased toward famous look-alikes (Chad/Romania, the Nordic crosses, the
pan-Arab tricolours, etc.). It's **endless streak** play: keep your run going; a wrong
answer resets the current streak. Your best streak per mode is saved on the device.

### Study mode (the course)

Beyond quizzing, **Study** actually teaches the material with spaced repetition:

- **Learn cards** for each country — flag, capital(s), location pinned on an offline
  world map, and real facts (neighbours, region, area, language, currency), plus a
  look-alike-flag tip where relevant.
- **Practice** ramps from multiple-choice recognition to **typed recall**.
- **Spaced repetition** (a Leitner system) schedules reviews so it sticks; your mastery
  is saved on-device and shown as a **progress map**.
- Focus on **Flags**, **Capitals**, or **both**.

### Filter by area

A scope picker on the home screen limits **both** quiz and study to a continent or a
sub-region — e.g. just *Western Europe* — or All 207.

---

## Run it locally (to preview / develop)

You need [Node.js](https://nodejs.org) (any recent version).

```sh
npm install        # installs dev-only build tools (data, flags, world map)
npm run build      # generates data/, assets/ (flags + map), icons/, precache list
npm run serve      # serves the app at http://localhost:8080
```

Open <http://localhost:8080> in your browser. (To test the phone layout, use your
browser's device toolbar and pick an iPhone in portrait.)

`npm install` and `npm run build` are only needed **once** (or whenever you change the
country list). The shipped app has **no runtime dependencies** — it's just static files.

---

## Put it on your iPhone (free, no Mac, no App Store)

The app is hosted free on **GitHub Pages**, then "installed" via Safari.

### 1. Publish to GitHub Pages

1. Create a free [GitHub](https://github.com) account if you don't have one.
2. Create a new **public** repository named `capital-quiz`.
3. Push this folder to it:
   ```sh
   git init -b main
   git add .
   git commit -m "Flags & Capitals quiz"
   git remote add origin https://github.com/<your-username>/capital-quiz.git
   git push -u origin main
   ```
4. In the repo on github.com: **Settings → Pages → Build and deployment →
   Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save.**
5. After a minute, your app is live at:
   `https://<your-username>.github.io/capital-quiz/`

> Don't use GitHub? Any free static host works — e.g. drag this folder onto
> [app.netlify.com/drop](https://app.netlify.com/drop) or use Cloudflare Pages.

### 2. Add to Home Screen

On your iPhone, open the URL **in Safari**, then:

**Share button (□↑) → Add to Home Screen → Add.**

Launch it from the new icon. It opens full-screen in portrait and — after the first
load — works **completely offline** (try Airplane Mode).

---

## Updating the app later

GitHub Pages updates automatically when you `git push`. Because the app caches itself
for offline use, bump the cache version so phones pick up changes: edit
[`sw.js`](sw.js) and bump the cache version (e.g. `flags-capitals-v2` → `-v3`) whenever
you redeploy changed files.

## Customizing

- **Which countries** — edit `EXTRA_ALLOW` in [`scripts/build-data.mjs`](scripts/build-data.mjs)
  (UN members are always included; the build refuses to ship fewer than 206), then
  `npm run build`.
- **Look-alike flag groups** — edit `LOOKALIKE_GROUPS` in [`js/data.js`](js/data.js).
- **Flag look-alike tips** (learn cards) — edit [`data/flag-tips.json`](data/flag-tips.json).
- **Spaced-repetition intervals** — `INTERVAL` in [`js/srs.js`](js/srs.js).
- **Colors / layout** — [`styles.css`](styles.css) (CSS variables at the top; supports
  light & dark automatically).

## Credits & licenses

- Country data: [mledoze/countries](https://github.com/mledoze/countries) — ODbL.
- Flags: [lipis/flag-icons](https://github.com/lipis/flag-icons) — MIT.
- World map: built from [Natural Earth](https://www.naturalearthdata.com/) via
  [world-atlas](https://github.com/topojson/world-atlas) — public domain.

Country/capital/flag data and the map are facts from the sources above; this project
just presents them. The flag look-alike tips in `data/flag-tips.json` were written for
this project.
