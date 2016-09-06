const Telegram = require('telegram-node-bot');
const News = require('../data/news.json');

class NewsController extends Telegram.TelegramBaseController {

  constructor(config) {
    super();
    this.config = config;
  }

  handle($) {
    let menuOpts = {
      method: 'sendMessage',
      params: [`*Latest news:*`, { parse_mode: 'Markdown' }],
      menu: News
    };

    menuOpts.menu.forEach(menu => {
      menu.callback = cb => {
        $.api.answerCallbackQuery(cb.id);
        $.sendMessage(menu.desc);
      };
    });

    $.runInlineMenu(menuOpts);
  }

}

module.exports = NewsController;
