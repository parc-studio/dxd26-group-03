// shared.js: makes chosen pieces of state "shared".
// There is no server, so shared means: saved in this browser, and kept identical
// in every tab of this browser. Two tabs side by side behave like two visitors.

(function () {
  window.App = window.App || {};

  App.shared = {
    keep(keys) {
      keys.forEach(function (key) {
        const saved = App.storage.load(key);
        if (saved !== null) App.state.set(key, saved);
      });

      document.addEventListener('state-change', function (event) {
        if (keys.includes(event.detail.key)) {
          App.storage.save(event.detail.key, event.detail.value);
        }
      });

      App.storage.onChangeInAnotherTab(function (key, value) {
        if (keys.includes(key)) App.state.set(key, value);
      });
    }
  };
})();
