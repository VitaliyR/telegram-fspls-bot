const Telegram = require('telegram-node-bot');

let connector;

class Persistent extends Telegram.BaseScopeExtension {
  get name() {
    return 'persistent';
  }

  process() {
    return connector;
  }
}

module.exports = (con) => {
  connector = con;
  return Persistent;
};
