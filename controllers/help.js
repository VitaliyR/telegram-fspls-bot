const Telegram = require('telegram-node-bot');

class HelpController extends Telegram.TelegramBaseController {

  constructor(config) {
    super();
    this.config = config;
  }

  handle($) {
    const isGroup = $.message.chat.type === 'group';
    $.sendMessage(isGroup ? this.getGroupMessage() : this.getPrivateMessage(), { parse_mode: 'Markdown' });
  }

  getPrivateMessage() {
    return 'You can search and watch videos on FS via this bot.\n\n' +
      '*Supported commands:*\n' +
      '/help - show this message\n' +
      '/h - show history of your watched movies and/or episodes\n' +
      '/news - show latest bot news\n\n' +
      'And you can, of course, just *type* movie name for *search*\n\n' +
      '*Support and Feedback:*\n' +
      'Contact @salen for any questions';
  }

  getGroupMessage() {
    return 'You can search and watch videos on FS via this bot.\n\n' +
      '*Supported commands in Group mode:*\n' +
      '/help - show this message\n' +
      '/news - show latest bot news';
  }
}

module.exports = HelpController;
