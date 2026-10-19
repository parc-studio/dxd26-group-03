// app.js: connects everything. Loaded last.
// A tap runs an action, the action changes the state, the state change redraws the page.

(function () {
  // EDIT HERE: one entry per data-action in index.html.
  const actions = {
    'go-to'(button) {
      App.state.set('screen', button.dataset.to);
    },

    'add-to-basket'() {
      const basket = App.state.get('basket');
      App.state.set('basket', { yours: basket.yours + 1, others: basket.others });
      App.state.set('notice', 'Added. Everyone now sees it in the basket.');
    },

    'empty-basket'() {
      App.state.set('basket', { yours: 0, others: 0 });
      App.state.set('notice', '');
    }
  };

  // EDIT HERE: which part of the page to redraw when a piece of state changes.
  const redraw = {
    screen() {
      App.render.screen();
      App.render.focusScreenTitle();
    },
    basket: App.render.basket,
    notice: App.render.notice
  };

  function runAction(event) {
    const element = event.target.closest('[data-action]');
    if (element && actions[element.dataset.action]) {
      actions[element.dataset.action](element);
    }
  }

  function redrawChangedState(event) {
    if (redraw[event.detail.key]) redraw[event.detail.key]();
  }

  function start() {
    App.shared.keep(['basket']);

    document.addEventListener('click', runAction);
    document.addEventListener('state-change', redrawChangedState);

    App.render.screen();
    App.render.basket();
    App.render.notice();

    App.others.start();
  }

  start();
})();
