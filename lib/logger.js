const Telegram = require('telegram-node-bot');
const loggy = require('loggy');

let instance;

class Logger extends Telegram.BaseLogger {

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

module.exports = function() {
	return instance || Logger;
};