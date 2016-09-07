const Telegram = require('telegram-node-bot');
const TModel = Telegram.Models;

const Parser = require('../lib/parser');

class InlineController extends Telegram.TelegramBaseInlineQueryController {

  constructor(config, Persistent, api) {
    super();
    this.config = config;
    this.connector = api;
    this.persistent = Persistent;
  }

  handle($) {
    const query = $.inlineQuery.query;
    const user = $.update.inlineQuery.from;

    if (!query) {
      return $.answer([]);
    }

    this.persistent.isActive(user).then(isActive => {
      if (!isActive) {
        return $.answer([], {
          switch_pm_text: 'You need to add bot firstly. Add it via ' + this.config.bot_name,
          switch_pm_parameter: '/start',
          cache_time: 0
        });
      }

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
    });
  }

}

module.exports = InlineController;
