const Telegram = require('telegram-node-bot');
const logger = require('../lib/logger')();

class RegisterController extends Telegram.TelegramBaseController {

  get routes() {
    return {
      '/start': 'register',
      '/stop': 'unregister'
    };
  }

  register($) {
    const user = $.update.message.from;
    $.persistent().enableUser(user).catch(e => logger.error(e));
  }

  unregister($) {
    const user = $.update.message.from;
    $.persistent().disableUser(user).catch(e => logger.error(e));
  }

}

module.exports = RegisterController;
