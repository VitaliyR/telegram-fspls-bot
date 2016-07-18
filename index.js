'use strict';

const Telegram = require('telegram-node-bot');

const config = require('./config');
const PersistentLayer = require('./lib/persistent');
const Persistent = new PersistentLayer(config);

const PersistentWrapper = require('./lib/persistent-wrapper');
const HistoryController = require('./controllers/history');
const NewsController = require('./controllers/news');
const HelpController = require('./controllers/help');
const SearchController = require('./controllers/search');

const tg = new Telegram.Telegram(process.env.TELEGRAM_FSPLS_BOT_TOKEN || config.key);
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
		let test = message.text.match(command);
		return test ? !!test.length : false;
	};
};

tg.router
  .when({ name: 'History', test: checker(/\h$/) }, historyController)
	.when([{ name: 'Help', test: checker(/\help$/)}, '/start'] , new HelpController(config))
	.when('/news', new NewsController(config))
	.otherwise(searchController);

console.log('Started');