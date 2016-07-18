const Telegram = require('telegram-node-bot');

class HelpController extends Telegram.TelegramBaseController {

	constructor(config) {
		super();
		this.config = config;
	}

	handle($) {
		$.sendMessage(
			'You can search and watch videos on FS via this bot.\n\n' +
			'*Supported commands:*\n' +
			'/help - show this message\n' +
			'/h - show history of your watched movies and/or episodes\n' +
			'/news - show latest bot news\n\n' +
			'And you can, of course, just *type* movie name for *search*'
			, { parse_mode: 'Markdown' });
	}
}

module.exports = HelpController;