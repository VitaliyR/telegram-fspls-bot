const Telegram = require('telegram-node-bot');
const TModel = Telegram.Models;

const Parser = require('../lib/parser');

class InlineController extends Telegram.TelegramBaseInlineQueryController {

	constructor(config, api) {
		super();
		this.config = config;
		this.connector = api;
	}

	handle($) {
		const query = $.inlineQuery.query;

		if (!query) return;

		this.connector.search(query).then((res) => {
			let results = [];

			res.forEach(movie => {
				movie.link = 'http://fs.to' + movie.link;
				movie.poster = 'http:' + movie.poster;

				let movieId = Parser.getMovieId(movie);
				let cbId = 'pm_' + movieId;

				results.push(new TModel.InlineQueryResultArticle(
					'article',
					null,
					Parser.parseSearchMovieTitle(movie),
					new TModel.InputTextMessageContent(movie.link),
					new TModel.InlineKeyboardMarkup([
						[new TModel.InlineKeyboardButton('Watch', null, cbId)]
					]),
					movie.link,
					false,
					null,
					movie.poster
				));
			});

			$.answer(results);
		});
	}

}

module.exports = InlineController;