# Starter

A small folder of plain HTML, CSS and JavaScript to start your workshop prototype from.
Nothing to install, nothing to build: you open one file and it works. The demo inside
(one product, one shared basket) only exists to show how the pieces connect. Replace all of it.

> **The one rule that breaks most uploads: every path is relative.**
> Write `css/app.css` or `./assets/photo.jpg`, never `/css/app.css` or `/assets/photo.jpg`.
> Once uploaded, your project lives in a folder of a larger website (its address ends in
> `/group-07/app/`), and a path starting with `/` looks for the file at the very top of the website,
> where it does not exist.

## Start in 60 seconds

1. Unzip the folder and rename it to your project.
2. Double-click `index.html`. It opens in your browser: a phone-sized frame with the demo inside.
3. Open the folder in your editor, change some text in `index.html`, save, reload the browser.

That is the whole workflow: edit, save, reload.

## The folder

```text
index.html          the page: all the HTML, and the list of CSS and JS files it loads
assets/             your images, fonts, audio, video (now: one placeholder image)
css/
  tokens.css        the values everything is built from: colours, spacing, type sizes, radii
  base.css          sensible defaults (reset, focus outline, reduced motion). Rarely edited
  frame.css         the phone frame. Rarely edited
  app.css           the styles of your prototype. You work here
js/
  frame.js          fits the phone frame to the window. Never edited
  utils.js          small helpers (input in, output out)
  storage.js        saves values in the browser so they survive a reload
  state.js          what the app remembers. You work here
  shared.js         makes chosen values "shared" (see below)
  others.js         demo only: pretends other shoppers exist
  render.js         updates the page from the state. You work here
  app.js            connects taps to actions. You work here
figma/              for a prototype made in Figma instead of code (see "Working in Figma")
AGENTS.md           the rules for an AI coding assistant (CLAUDE.md points to it)
```

There is no `import` between JavaScript files. Each file adds its part to one shared object
called `App` (`App.state`, `App.render`...), and `index.html` loads them in order with
`<script>` tags. If you add a JavaScript file, add its `<script>` tag above `js/app.js`.

## How it works: state and events

*State* is what the app remembers right now: which screen is open, what is in the basket.
An *event* is something that happens: a tap, a change of state.

Everything follows one loop:

```text
tap a button  ->  an action runs  ->  the action changes the state  ->  the page redraws
```

Three attributes in the HTML connect it:

| In `index.html` | Meaning |
|---|---|
| `data-action="add-to-basket"` | tapping this runs the action with that name in `js/app.js` |
| `data-show="basket-total"` | `js/render.js` writes a value into this element |
| `data-screen="basket"` | this section is one screen; only the current one is visible |

To add your own interaction:

1. `index.html`: add a `<button type="button" data-action="like-product">`.
2. `js/state.js`: add a starting value, for example `likes: 0`.
3. `js/app.js`: add the action `'like-product'() { App.state.set('likes', App.state.get('likes') + 1); }`.
4. `js/render.js`: add a function that shows it, `likes() { show('likes', App.state.get('likes')); }`,
   and put `<span data-show="likes"></span>` where the number should appear.
5. `js/app.js`: add `likes: App.render.likes` to `redraw`, and call `App.render.likes()` once in `start()`.

Always change state with `App.state.set(...)`. That is what triggers the redraw.

### Keeping state after a reload

In `js/app.js`, `App.shared.keep(['basket'])` lists the pieces of state that are saved in the
browser (in *localStorage*, a small storage every browser gives each website). Add a name to
that list and the value survives a reload.

### "Shared" state is pretend

The workshop gives you no server and no database, so nothing can really travel from one
phone to another. When your concept needs something shared ("one basket for everyone",
"12 people are looking at this"), you simulate it:

- **Saved in the browser.** Kept values survive reloads and are identical in every tab of the
  same browser. Open the page in two tabs side by side: they behave like two visitors.
- **Other people are scripted.** `js/others.js` adds an item "from someone else" every 20 seconds.
  Write your own version of that script for your story.

Two different phones each have their own copy. For the presentation, demonstrate on one device.

## Add a screen

A screen is a `<section>` in `index.html`. No JavaScript is needed to add one.

1. Copy an existing `<section class="screen" ...>` block and give it a new name: `data-screen="checkout"`.
2. Add `hidden` to it, so it starts closed. Keep one `<h1 tabindex="-1">` inside: it receives
   the focus when the screen opens, which keyboard and screen-reader users need.
3. Link to it from anywhere: `<button type="button" data-action="go-to" data-to="checkout">Checkout</button>`.

Each screen has three parts: `screen-header` (top), `screen-body` (scrolls), `screen-footer`
(stays at the bottom, good for the main button). Header and footer are optional.

## The phone frame

Your prototype is designed for a phone held upright.

- On a phone, it fills the screen.
- On a laptop, the same page shows it inside a 390 x 844 frame on a grey backdrop, and shrinks
  the frame when the window is too short. It is the same `index.html`: there is no separate desktop version.

Everything visible goes inside `<div class="phone">`. Three things to know:

- **Sizes inside the phone:** use `%`, or `cqw` / `cqh` (1cqh = 1% of the phone's height).
  Do not use `vw` / `vh`: they measure the laptop window, not the frame.
- **No breakpoints** (`@media (min-width: ...)`) for your design: it is always phone-sized. Make sure
  it holds from 320 to 430 wide.
- **Notch and home bar:** the header and footer already keep clear of them. If you build your
  own, use `var(--safe-top)` and `var(--safe-bottom)` from `css/tokens.css`.

### Test on a real phone

The frame is a preview, not a phone. Fingers, the on-screen keyboard, the camera and sound only
show their problems on the real thing. The simplest way to get your project onto your phone is to
upload it (next sections) and scan the QR code on your group page. Uploads are quick and every
version is kept, so upload early and often.

Between uploads, your browser's device mode gets you closer: right-click the page, choose
*Inspect*, then click the phone/tablet icon and pick a phone size.

## Working in Figma

If your prototype is a Figma prototype rather than code, upload the `figma` folder on its own:

1. In Figma, open your prototype (the play button), click *Share*, set *Anyone with the link can
   view*, then *Copy link*. Without that setting, visitors see a Figma sign-in page.
2. Open `figma/index.html` in your editor and paste the link between the quotes of `FIGMA_LINK`.
3. Upload the `figma` folder from your group page, like a code project. Changes you make in Figma
   show up by themselves: there is no need to upload again.

Static frames work too: put your exported images (png, jpg, webp, svg) or a pdf in a folder with
an `index.html` that shows them.

## Rules that keep your project uploadable

1. **`index.html` at the root of the folder.** Not inside a sub-folder, not renamed.
2. **Static files only:** HTML, CSS, JS, images, fonts, audio, video, JSON. (*Static* means the
   files are sent as they are; nothing runs on the server.)
3. **50 MB maximum per upload, 25 MB per file.** Compress images and video before adding them.
4. **Relative paths only.** `assets/photo.jpg`, never `/assets/photo.jpg`.
5. **No server code and no backend.** No Node, PHP, Python or database. Shared state is simulated (see above).

Also: no build step. No npm, no bundler, no framework that needs compiling. If you want a
library, load it with a `<script>` tag from a CDN (a website that hosts libraries), and only if
you really need it.

## Upload

1. Open your group page on **workshop.parc.studio** (sign in with the link emailed to you, or your group code).
2. Drag your project folder onto the upload area.
3. Add a one-line note saying what changed.
4. Scan the QR code next to your prototype to open it on your phone.

Every upload is kept as a version, and an older one can be restored. You cannot break anything by uploading.

## Common problems

- **Blank or unstyled page after upload, fine on my laptop.** A path starts with `/`. Search your
  files for `"/` and `(/` and remove the leading slash. Second cause: capital letters. `Photo.JPG`
  and `photo.jpg` are the same file on a Mac but two different files once uploaded. Use lowercase names without spaces.
- **A font or background image is missing.** Inside a CSS file, a path starts from the CSS file's
  own folder: from `css/app.css`, an image is at `url(../assets/photo.jpg)`.
- **"Page not found" after upload.** `index.html` is not at the root: you probably uploaded a folder that contains your folder.
- **The upload is refused.** The folder is over 50 MB, or one file is over 25 MB. Video is almost always the reason: shorten it or export it smaller.
- **Nothing happens when I tap.** Open the console (right-click, *Inspect*, *Console*) and read the red
  message: it names the file and line. Usual causes: a `data-action` that has no action with the same
  name in `js/app.js`, or a new JS file without its `<script>` tag.
- **Works on the laptop, not on the phone.** Check for: an effect that needs a mouse hover (phones
  have no hover, use a tap); sizes in `vh` (use `cqh` or `%`); video that does not start (it needs
  the `muted` and `playsinline` attributes to play by itself); camera, microphone or motion sensors
  (they only work on the uploaded `https` address, after the visitor taps a button and accepts).
- **My phone does not show what my laptop has in the basket.** Correct: shared state is simulated, each device has its own copy.
- **Old values keep coming back.** They are saved in the browser. In the console, run `localStorage.clear()` and reload.
- **The page is tiny on the phone.** The `<meta name="viewport" ...>` line was removed from `index.html`. Put it back.
- **Double-clicking shows the code instead of the page.** Right-click `index.html` and open it with your browser.
