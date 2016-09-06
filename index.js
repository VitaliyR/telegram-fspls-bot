'use strict';

const Telegram = require('telegram-node-bot');
const config = require('./config');
const args = require('minimist')(process.argv.slice(2));

const logger = require('./lib/logger')(config.log);
require('./lib/api')(config.api);

/**
 * Handles process shutdown
 *
 * @param {Boolean} silent
 * @param  {Error} err
 */
var exitHandler = function(silent, err) {
  if (!silent) {
    logger.info('Shutdown');
  }
  if (err) {
    logger.error(err.stack);
  }
  process.exit();
};

process.on('exit', exitHandler.bind(null, false));
process.on('SIGINT', exitHandler.bind(null, true));
process.on('uncaughtException', exitHandler.bind(null, true));

const botKey = process.env.TELEGRAM_FSPLS_BOT_TOKEN || args.key || config.key;
if (!botKey) {
  throw new Error('Bot key is not provided');
}

const tg = new Telegram.Telegram(botKey, logger);
require('./router')(tg, config);

logger.info('Started');
