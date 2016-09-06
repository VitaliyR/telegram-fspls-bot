const Telegram = require('telegram-node-bot');
const logger = require('../lib/logger')();

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
		let processor = this.tg._updateProcessor._processorForUpdate(update);

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

			scope.persistent().isActive(cb.from).then((isActive) => {
				if (!isActive) throw new Error('Not active');

				this.api.answerCallbackQuery(cb.id);
				let controller = processor._dataSource.router.controllersForUpdate(update)[0];

				return controller.rollMovie(scope, movieId);
			}).catch(e => {
				if (e.code === 403) {
					scope.persistent().disableUser(cb.from);
				}

				this.api.answerCallbackQuery(cb.id, { text: 'You need to add bot firstly. Add it via ' + this.config.bot_name });
			});
		}).catch(e => {
			logger.error(e);
		});
	}

}

module.exports = CallbackController;