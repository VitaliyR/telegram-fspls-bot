const Telegram = require('telegram-node-bot');
const logger = require('../lib/logger')();

class CallbackController extends Telegram.TelegramBaseCallbackQueryController {

	constructor(config, tgapi) {
		super();
		this.config = config;
		this.api = tgapi;
		this.test = arguments[2]; // fixme: remove
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
		let update = new Telegram.Models.Update(
			Date.now(),
			new Telegram.Models.Message(
				Date.now(),
				cb.from,
				Date.now(),
				new Telegram.Models.Chat(
					cb.from.id,
					'private'
				)
			)
		);
		let processor = this.test._updateProcessor._processorForUpdate(update);

		processor._getSession(update.message).then(session => {
			let scope = new Telegram.Scope(
				update,
				processor._dataSource.router.queryForUpdate(update),
				processor._dataSource.api,
				processor._dataSource.scopeExtensions,
				processor._waitingRequests,
				processor._waitingCallbackQueries,
				session.chatSession,
				session.userSession,
				processor._dataSource.logger
			);

			scope.persistent().getUser(cb.from).then((user) => {
				if (!user) { throw new Error(); }
				this.api.answerCallbackQuery(cb.id);
				let controller = processor._dataSource.router.controllersForUpdate(update)[0];
				controller.rollMovie(scope, movieId)
			}).catch(() => {
				this.api.answerCallbackQuery(cb.id, { text: 'You need to add bot firstly. Add it via ' + this.config.bot_name });
			});
		}).catch(e => {
			logger.error(e);
		});
	}

}

module.exports = CallbackController;