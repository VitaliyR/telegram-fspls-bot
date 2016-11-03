const Telegram = require('telegram-node-bot');
const HistoryTree = require('../lib/history-tree');

class HistoryController extends Telegram.TelegramBaseController {

  /**
   * Get default localization
   * @returns {*}
   */
  get texts() {
    return this._localization[this.config.i18nDefault];
  }

  /**
   * Sets searchDelegate
   * @param {SearchController.<Function>} delegate
   */
  set delegate(delegate) {
    this._delegate = delegate;
  }

  /**
   * @constructor
   * @param {Object} config
   */
  constructor(config) {
    super();
    this.config = config;
  }

  handle($) {
    const user = $.update.message.from;

    $.persistent().getUser(user).then(user => {
      let userMovies = user.movies;
      if (!userMovies.length) {
        throw new Error();
      }

      let menuOpts = {
        method: 'sendMessage',
        params: [`*${this.texts.historyAt}:*`, { parse_mode: 'Markdown' }],
        menu: []
      };

      userMovies.forEach(movie => {
        const tree = new HistoryTree(movie.last_folders);

        menuOpts.menu.push({
          text: `${movie.title} ${tree.title}`,
          callback: (cb, msg) => {
            this._delegate.localization = this._localization;
            this._delegate.roll($, movie, msg).then(() => $.api.answerCallbackQuery(cb.id));
          }
        });
      });

      $.runInlineMenu(menuOpts);
    }).catch(() => {
      $.sendMessage(this.texts.noHistory);
    });
  }

}

module.exports = HistoryController;
