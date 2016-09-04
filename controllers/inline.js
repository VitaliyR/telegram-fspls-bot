const Telegram = require('telegram-node-bot');

class InlineController extends Telegram.TelegramBaseInlineQueryController {

	constructor(config) {
		super();
		this.config = config;
	}

	handle($) {
		const query = $.inlineQuery.query;
		$.answer([
			new Telegram.Models.InlineQueryResultVideo(
				'video',
				'1',
				'http://n41.filecdn.to/TqGK/NDVmNTAxYWFjZjA3ZTkyYTY4ZjBhMWVkZDBkNTRiMGR8ZnN0b3wzMTA5NDQxNDE3fDEwMDAwfDJ8MHxlfDQxfDU0ODRiNDg4NDYzMzI1NjhiZWZjYjk0NGQ4MjlkOGRmfDB8OTpkLjIyOjl8MHw3MTY4ODEyODF8MTQ3Mjk5OTY2NS41NTk0fHZpZGVv/playvideo_64z3c3hn3fpoxkcs1jsl965j2.0.1139013157.974127405.1472938461.mp4',
				'video/mp4',
				'http://www.qqxxzx.com/images/pictur/pictur-13.jpg',
				'Title'
			)
		])
	}

	chosenResult() {
		console.log(arguments);
	}

}

module.exports = InlineController;