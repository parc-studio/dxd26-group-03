// frame.js: shrinks the laptop phone frame so it always fits the window.
// You never need to edit this. The frame's size is set in css/tokens.css.

(function () {
  const WINDOW_MARGIN = 24;
  const phone = document.querySelector('.phone');

  function fitFrameToWindow() {
    const scale = Math.min(
      1,
      (window.innerWidth - WINDOW_MARGIN * 2) / phone.offsetWidth,
      (window.innerHeight - WINDOW_MARGIN * 2) / phone.offsetHeight
    );
    document.documentElement.style.setProperty('--frame-scale', scale);
  }

  window.addEventListener('resize', fitFrameToWindow);
  fitFrameToWindow();
})();
