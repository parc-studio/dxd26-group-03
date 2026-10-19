// utils.js: small helpers that only turn an input into an output.
// They never touch the page and never touch the state.

(function () {
  window.App = window.App || {};

  App.utils = {
    basketTotal(basket) {
      return basket.yours + basket.others;
    },

    countLabel(count, one, many) {
      return count + ' ' + (count === 1 ? one : many);
    }
  };
})();
