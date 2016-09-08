const Telegram = require('telegram-node-bot');
const logger = require('../lib/logger')();

const utils = require('../lib/utils').Utils;

class CallbackController extends Telegram.TelegramBaseCallbackQueryController {

  constructor(config, tgapi, tg) {
    super();
    this.config = config;
    this.api = tgapi;
    this.tg = tg;
  }

  handle(cb) {
    const id = cb.data;
    let [ type, ...args ] = id.split('_');

    if (type) {
      switch (type) {
        case 'pm':
          return this.handlePM.apply(this, args.concat(cb));
        default:
          break;
      }
    }
  }

  /**
   * Hack this scopes stuff and send private message with video to user
   * @param movieId
   * @param cb
   */
  handlePM(movieId, cb) {
    utils.getScopeFromCallback(cb).then(scope => {
      scope.persistent().isActive(cb.from).then((isActive) => {
        if (!isActive) throw new Error('Not active');

        let controller = this.tg._telegramDataSource.router.controllersForUpdate(scope.update)[0];

        this.api.answerCallbackQuery(cb.id);
        return controller.selectMovie(scope, movieId);
      }).catch(e => {
        if (e.code === 403) {
          scope.persistent().disableUser(cb.from);
        }
        this.api.answerCallbackQuery(cb.id, { text: 'You need to add bot firstly. Add it via ' + this.config.bot_name });
      });
    }).catch(e => {
      if (typeof e === 'string') {
        // todo
      } else {
        logger.error(e);
      }
    });
  }

}

module.exports = CallbackController;
