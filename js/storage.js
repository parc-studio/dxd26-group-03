// storage.js: saves values in the browser (localStorage) so they survive a reload.
// Values stay in this browser on this device. Nothing is sent anywhere.

(function () {
  window.App = window.App || {};

  // Every group's project is served from the same website, and a website has one
  // localStorage. Naming each value after this folder keeps groups from overwriting each other.
  const FOLDER = location.pathname.replace(/[^/]*$/, '');

  function nameFor(key) {
    return FOLDER + key;
  }

  App.storage = {
    // Returns null when nothing was saved, or when the browser refuses storage (private mode).
    load(key) {
      try {
        return JSON.parse(localStorage.getItem(nameFor(key)));
      } catch {
        return null;
      }
    },

    save(key, value) {
      try {
        localStorage.setItem(nameFor(key), JSON.stringify(value));
      } catch {
        // The app keeps working without saving.
      }
    },

    // The browser fires "storage" in every other tab that has this page open.
    onChangeInAnotherTab(callback) {
      window.addEventListener('storage', function (event) {
        if (!event.key || !event.key.startsWith(FOLDER) || event.newValue === null) return;
        try {
          callback(event.key.slice(FOLDER.length), JSON.parse(event.newValue));
        } catch {
          // Another page wrote something unreadable under our name: ignore it.
        }
      });
    }
  };
})();
