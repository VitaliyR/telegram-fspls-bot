const Telegram = require('telegram-node-bot');
const loggy = require('loggy');

let instance;

class Logger extends Telegram.BaseLogger {

  constructor() {
    super();
    loggy.notifications = false;
  }

  log() {
    loggy.info.apply(this, arguments);
  }

  warn() {
    loggy.warn.apply(this, arguments);
  }

  error() {
    loggy.error.apply(this, arguments);
  }

  info() {
    loggy.info.apply(this, arguments);
  }
}

/**
 *
 * @param config
 * @returns {Logger}
 */
module.exports = function(config) {
  instance = instance || (new Logger(config));
  return instance;
};
