// others.js (demo): pretends other shoppers exist.
// Every so often "someone else" adds a mug, until the basket holds enough of theirs.
// Delete this file, its <script> tag and the App.others.start() line when you replace the demo.

(function () {
  window.App = window.App || {};

  const PAUSE_BETWEEN_SHOPPERS = 20000; // milliseconds
  const MOST_ADDED_BY_OTHERS = 9;

  function someoneElseAddsOne() {
    const basket = App.state.get('basket');
    if (basket.others >= MOST_ADDED_BY_OTHERS) return;

    App.state.set('basket', { yours: basket.yours, others: basket.others + 1 });
    App.state.set('notice', 'Someone else just added one.');
  }

  App.others = {
    start() {
      setInterval(someoneElseAddsOne, PAUSE_BETWEEN_SHOPPERS);
    }
  };
})();
