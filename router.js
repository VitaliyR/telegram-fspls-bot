const Utils = require('./lib/utils');

const PersistentLayer = require('./lib/persistent');
const PersistentWrapper = require('./lib/persistent-wrapper');

const api = require('./lib/api')();

const Controllers = {
  History: require('./controllers/history'),
  News: require('./controllers/news'),
  Help: require('./controllers/help'),
  Search: require('./controllers/search'),
  Register: require('./controllers/register'),
  Inline: require('./controllers/inline'),
  Callback: require('./controllers/callback')
};

/**
 * Checks incoming string to be valid with route command
 * @param command
 * @returns {function(*)}
 */
const checkRoute = (command) => {
  return (message) => {
    if (!message.text) return false;
    let test = message.text.match(command);
    return test ? !!test.length : false;
  };
};

/**
 * Exports
 * @param {Telegram} tg
 * @param {Object} config
 */
module.exports = function(tg, config) {
  const persistent = PersistentWrapper(new PersistentLayer(config));

  tg.addScopeExtension(persistent);
  tg.addScopeExtension(Utils);

  const searchController = new Controllers.Search(config, api);
  const historyController = new Controllers.History(config);
  historyController.searchDelegate = searchController.roll.bind(searchController);

  /**
   * Routes
   * /h private
   * /start public
   * /news public
   * /search private-inline
   */
  tg.router
    .when({ name: 'History', test: checkRoute(/h$/) }, historyController)
    .when([{ name: 'Help', test: checkRoute(/help(@.+)*$/) }, '/start'], new Controllers.Help(config))
    .when(['/start', '/stop'], new Controllers.Register(config))
    .when('/news', new Controllers.News(config))
    .when('/search :request', searchController)
    .otherwise(searchController)
    .inlineQuery(new Controllers.Inline(config, persistent, api))
    .callbackQuery(new Controllers.Callback(config, tg._telegramDataSource._api, tg));
};
