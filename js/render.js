// render.js: the only file that changes what is on the page.
// Each function reads the state and updates the matching part of the HTML.

(function () {
  window.App = window.App || {};

  // Writes text into every element marked data-show="name".
  function show(name, text) {
    document.querySelectorAll('[data-show="' + name + '"]').forEach(function (element) {
      element.textContent = text;
    });
  }

  App.render = {
    screen() {
      const current = App.state.get('screen');
      document.querySelectorAll('[data-screen]').forEach(function (screen) {
        screen.hidden = screen.dataset.screen !== current;
      });
    },

    // Keyboard and screen-reader users land on the new screen's title, not on a hidden button.
    focusScreenTitle() {
      const title = document.querySelector('.screen:not([hidden]) h1');
      if (title) title.focus();
    },

    basket() {
      const basket = App.state.get('basket');
      const total = App.utils.basketTotal(basket);

      show('basket-total', total);
      show('basket-yours', basket.yours);
      show('basket-others', basket.others);
      show('basket-summary', App.utils.countLabel(total, 'mug', 'mugs'));
    },

    notice() {
      show('notice', App.state.get('notice'));
    }
  };
})();
