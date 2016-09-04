'use strict';

const Telegram = require('telegram-node-bot');
const config = require('./config');
const args = require('minimist')(process.argv.slice(2));
const logger = require('./lib/logger')(config.log);

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

const bot_key = process.env.TELEGRAM_FSPLS_BOT_TOKEN || args.key || config.key;
if (!bot_key) {
	throw new Error('Bot key is not provided');
}

const PersistentLayer = require('./lib/persistent');
const Persistent = new PersistentLayer(config);

const PersistentWrapper = require('./lib/persistent-wrapper');
const HistoryController = require('./controllers/history');
const NewsController = require('./controllers/news');
const HelpController = require('./controllers/help');
const SearchController = require('./controllers/search');

const tg = new Telegram.Telegram(bot_key, logger);
tg.addScopeExtension(PersistentWrapper(Persistent));

const searchController = new SearchController(config);
const historyController = new HistoryController(config);
historyController.searchDelegate = searchController.roll.bind(searchController);

/**
 * Checks
 * @param command
 * @returns {function(*)}
 */
const checker = (command) => {
	return (message) => {
		if (!message.text) return false;
		let test = message.text.match(command);
		return test ? !!test.length : false;
	};
};

/**
 * Routes
 * /h private
 * /start public
 * /news public
 * /search private-inline
 */
tg.router
  .when({ name: 'History', test: checker(/\h$/) }, historyController)
	.when([{ name: 'Help', test: checker(/\help(@.+)*$/)}, '/start'] , new HelpController(config))
	.when('/news', new NewsController(config))
	.when('/search :request', searchController)
	.otherwise(searchController);

logger.info('Started');
