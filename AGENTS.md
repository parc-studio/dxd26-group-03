# Instructions for AI coding assistants

You are working in a design student's workshop prototype: a phone-format "digital retail
experiment" built in one week and uploaded as a folder of static files, served beneath a
sub-path such as `/dxd26/group-07/app/`. The student may not read code. `README.md` holds the
folder map and explains the state loop; read it before your first change.

## Hard rules

Breaking any of these makes the project fail to open or fail to upload. If a request needs
one broken, say so and offer the closest thing that stays inside the rules.

1. **No build tools.** No npm, `package.json`, bundler, TypeScript, Sass or framework that compiles.
2. **No modules.** No `import`, `export` or `type="module"`: they fail when the page is opened by
   double-click. Classic `<script src>` tags only.
3. **Relative paths only.** `css/app.css`, `./assets/a.jpg`, `url(../assets/a.jpg)` from a CSS file.
   Never a leading `/`: the folder runs beneath a sub-path, so a root path points outside it.
4. **Static files only.** HTML, CSS, JS, images, fonts, audio, video, JSON. No server code, no
   backend, no database, no API keys. Shared or multi-user behaviour is simulated in the browser.
5. **Opens by double-click.** `index.html` stays at the folder root and must work on `file://`.
   That rules out `fetch()` of local files: put data in a JS file as a value on `App`.
6. **Under 50 MB in total.** Before adding media, check the folder size; compress or shorten instead of exceeding it.
7. **Phone format, inside the frame.** All UI lives inside `<div class="phone">` and holds from 320
   to 430 CSS px wide with no horizontal scroll. No desktop layout, no design breakpoints. Inside the
   phone, size with `%`, `cqw`, `cqh`; never `vw`, `vh`, `dvh` (they measure the window, not the frame).
8. **A reduced-motion path for every animation.** Declare animations and transitions inside
   `@media (prefers-reduced-motion: no-preference)`, or give them an explicit reduced version.
9. **Accessible controls.** Real `<button type="button">` and `<a href>`, never a clickable `<div>`.
   Every input has a `<label>`, every image an `alt`. Tap targets are at least 44px (`--tap-target`).
   Keep the focus outline visible. Nothing works on hover only. Text keeps a 4.5:1 contrast.
10. **External libraries** only when the student asks, loaded from a CDN with a `<script>` tag.

## Keep it small

Build only what demonstrates the concept. One convincing interaction beats a complete shop.
Fake what is not the point (payment, accounts, catalogue) with fixed content. Do not add
abstractions, settings or screens that were not asked for. When the demo is replaced, delete its
leftovers: `js/others.js` with its `<script>` tag and the `App.others.start()` call, the
`(demo)` blocks in `css/app.css`, unused state keys, helpers and tokens.

## Conventions

The loop: a tap runs an action, the action calls `App.state.set`, the `state-change` event redraws.

| What | Where |
|---|---|
| Markup, one `<section class="screen" data-screen="name">` per screen | `index.html` |
| Starting values of the state | `js/state.js` |
| Actions, one per `data-action`; the `redraw` map; the list of kept keys | `js/app.js` |
| Every write to the page, one function per piece of state | `js/render.js` |
| Helpers with no page and no state access | `js/utils.js` |
| Colours, spacing, type sizes, radii | `css/tokens.css` |
| Styles of the prototype | `css/app.css` |
| Images, fonts, audio, video | `assets/` |

- `data-action="verb-noun"` on what is tapped, `data-show="name"` where a value is written,
  `data-screen="name"` on screens. Navigate with `data-action="go-to" data-to="name"`; a new
  screen needs no JavaScript. Inactive screens carry `hidden`; each screen keeps one `<h1 tabindex="-1">`.
- Change state only through `App.state.set(key, value)`. Pass a new object or array, do not mutate the old one.
- To make a value survive reloads and sync across tabs, add its key to `App.shared.keep([...])`.
  That is the whole persistence layer; do not call `localStorage` directly.
- Each JS file is wrapped in `(function () { ... })();` and shares only through `window.App`.
  A new file gets a `<script>` tag above `js/app.js`.
- Use the tokens; add a token before hard-coding a new value. The starter is deliberately neutral:
  the student's own visual direction replaces the values in `css/tokens.css`.
- `css/base.css`, `css/frame.css`, `js/frame.js`, `js/storage.js` and `js/shared.js` are plumbing. Leave them alone unless asked.
- Style: 2-space indent, single quotes in JS, `const` then `let`, kebab-case classes and data names,
  camelCase in JS. A short comment only where the student must edit or where something looks wrong but is not.

## Verify before you say it is done

There is no test runner.

1. Open `index.html` by double-click (`file://`), not through a dev server.
2. The console shows zero errors and zero failed requests.
3. Check at 375px wide (and 320px): no horizontal scroll, nothing cut off, every control reachable.
4. Use it with the keyboard only: Tab reaches every control, Enter or Space activates it, focus is visible.
5. Search the folder for `href="/`, `src="/` and `url(/`: there must be no match.
6. Reload: kept state is still there.

If you cannot open a browser, say so and tell the student exactly what to check.
