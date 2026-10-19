// state.js: everything the app remembers, in one place.
// Read with App.state.get('key'). Change with App.state.set('key', value):
// set() announces the change so the page can redraw.

(function () {
  window.App = window.App || {};

  // EDIT HERE: the starting values of your app.
  const data = {
    screen: 'product',
    basket: { yours: 0, others: 2 },
    notice: ''
  };

  App.state = {
    get(key) {
      return data[key];
    },

    set(key, value) {
      data[key] = value;
      document.dispatchEvent(new CustomEvent('state-change', { detail: { key, value } }));
    }
  };
})();
