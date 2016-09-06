const Telegram = require('telegram-node-bot');
const HistoryTree = require('../lib/history-tree');

class HistoryController extends Telegram.TelegramBaseController {

  set searchDelegate(delegate) {
    this._delegate = delegate;
  }

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
        params: [`*You've stopped at:*`, { parse_mode: 'Markdown' }],
        menu: []
      };

      userMovies.forEach(movie => {
        const tree = new HistoryTree(movie.last_folders);

        menuOpts.menu.push({
          text: `${movie.title} ${tree.title}`,
          callback: (cb, msg) => {
            $.api.answerCallbackQuery(cb.id);
            this._delegate($, movie, msg);
          }
        });
      });

      $.runInlineMenu(menuOpts);
    }).catch(() => {
      $.sendMessage(`You haven't watch anything yet`);
    });
  }

}

module.exports = HistoryController;
