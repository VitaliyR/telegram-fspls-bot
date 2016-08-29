const Telegram = require('telegram-node-bot');

const API = require('../lib/api');
const Parser = require('../lib/parser');

const logger = require('../lib/logger')();
const fsClasses = require('../lib/fs-classes');
const HistoryTree = require('../lib/history-tree');


class SearchController extends Telegram.TelegramBaseController {

	constructor(config) {
		super();
		this.config = config;
		this.connector = new API(config.api);
	}

	/**
	 * Searches FS.to
	 * @param $ ctx
	 */
	handle($) {
		const query = $.message.text;

		this.connector.search(query).then((res) => {
			if (!res.length) throw new Error();

			let menuOpts = {
				method: 'sendMessage',
				params: ['*Found:*', { parse_mode: 'Markdown' }],
				menu: []
			};

			res.forEach((movie) => menuOpts.menu.push({
				text: movie.title,
				callback: (cb, msg) => {
					$.api.answerCallbackQuery(cb.id);
					this.selectMovie($, movie, msg);
					this.getFolder($).then(parsedObj => this.selectFolder($, parsedObj));
				}
			}));

			$.runInlineMenu(menuOpts);
		}).catch(() => {
			$.sendMessage('_Not found_', { parse_mode: 'Markdown' });
		});
	}

	selectMovie($, movie, msg, tree) {
		$.userSession.msg = msg;
		$.userSession.movie = movie;
		$.userSession.tree = tree || new HistoryTree();
	}

	getData($, movie, folder) {
		return this.connector.getSeries(movie, folder)
			.then(res => Parser.parse(res, folder))
      .then(parsedRes => {
        // if smth is blocked
        if (parsedRes.hasBlocked) {
          logger.log('Blocked movie found:', movie.title);
          return this.connector.getData(movie.link).then(data => Parser.parseActions(data));
        }

        return parsedRes;
      })
			.then(parsedRes => this.buildClass($, movie, folder, parsedRes));
	}

	buildClass($, movie, folder, parsedRes) {
		const tree = $.userSession.tree;

		if (!parsedRes.id) {
			parsedRes.id = folder;
		}

		let className = parsedRes.type[0].toUpperCase() + parsedRes.type.substr(1);

		if (tree.length && tree.last.childType === 'season') {
			className = 'Season';
			if (!parsedRes.number) {
				parsedRes.number = tree.last.data.filter(d => d.folder === folder)[0].number;
			}
		}

		return new fsClasses[className](parsedRes);
	}

	/**
	 * Gets folder via actions parser
	 * @param $
	 * @param parsedObj
	 * @param currentObj
	 * @returns {Promise.<*>}
	 */
	getActionData($, parsedObj, currentObj) {
		const movie = $.userSession.movie;

		if (currentObj.data && currentObj.data.length) {
			return Promise.resolve(this.buildClass($, movie, currentObj.id, currentObj));
		} else {
			// todo params for getData?
			return this.connector.getData(movie.link, 'dvdrip' ).then(this.buildClass($, movie, ));
		}
	}

  /**
   * Gets folder information
   * @type {Telegram.Scope} $
   * @type {number} [folder=0] zero means root
   */
	getFolder($, folder = 0) {
		return this.getData($, $.userSession.movie, folder);
	}

	selectFolder($, parsedObj) {
		// folder which contains watches or episodes
		if (parsedObj.childType === 'watch' || parsedObj.childType === 'episode') return this.selectWatch($, parsedObj);

		let msg = $.userSession.msg;

		$.userSession.tree.push(parsedObj);

		const menu = parsedObj.menu.length ? parsedObj.menu : this.getMenu($, parsedObj);

		$.runInlineMenu(menu, msg);
	}

	buttonClick($, parsedObj, button, cb) {
		$.api.answerCallbackQuery(cb.id);

		switch (parsedObj.childType) {
			case 'watch':
			case 'episode':
				this.selectWatch($, parsedObj);
				break;
			case 'folder':
			case 'season':
				var retriever = parsedObj.isBlocked
					? this.getActionData($, parsedObj, button)
					: this.getFolder($, button.folder);
				retriever.then(parsedObj => this.selectFolder($, parsedObj));
				break;
			default:
				throw new Error('Error parsing new folder');
				break;
		}
	}

	backAction($) {
		let tree = $.userSession.tree;
		tree.pop();

		let menuNode = tree.pop();
		if (!menuNode.data || !menuNode.data.length) {
			this.getFolder($, menuNode.id).then(parsedObj => this.selectFolder($, parsedObj));
		} else {
			this.selectFolder($, menuNode);
		}
	}

	selectWatch($, parsedObj, episode) {
		let msg = $.userSession.msg;
		let tree = $.userSession.tree;

		tree.push(parsedObj);

		let menu = parsedObj.menu.length ? parsedObj.menu : this.getMenu($, parsedObj);

		if (parsedObj.childType === 'watch') {
			this.getWatch($, menu);
		} else {
			if (episode) {
				let episodeMenu = menu.menu.filter(m => m.id === 1*episode.id)[0];
				if (episodeMenu) {
					tree.push(episodeMenu.parsedObj);
					this.getWatch($, episodeMenu, true);
					return;
				}
			}

			$.runInlineMenu(menu, msg);
		}
	}

	getMenu($, parsedObj) {
		const msg = $.userSession.msg;

		let menuOpts = {
			method: 'sendMessage',
			params: [msg],
			menu: [],
			message: this.getTitle($)
		};

		parsedObj.hasBlocked && (menuOpts.message += ' (some data is blocked)');

		// back button
		if ($.userSession.tree.length > 1) {
			menuOpts.menu.push({
				text: 'Back',
				callback: (cb) => {
					$.api.answerCallbackQuery(cb.id);
					this.backAction($);
				}
			});
		}

		switch (parsedObj.childType) {
			case 'folder':
			case 'season':
				parsedObj.data.forEach(data => {
					let button = {
						text: '' + data.text,
						callback: this.buttonClick.bind(this, $, parsedObj, data)
					};
					menuOpts.menu.push(button);
				});
				break;
			case 'watch':
				menuOpts.layout = [1].concat(Array(parsedObj.data.length / 2).fill(2));
				menuOpts.menu.push.apply(menuOpts.menu, this.getWatchButtons($, parsedObj.data));
				break;
			case 'episode':
				menuOpts.layout = [1].concat(Array(Math.ceil(parsedObj.data.length / 4)).fill(4));

				parsedObj.data.forEach(data => {
					let button = {
						text: '' + data.id,
						id: data.id,
						layout: [1, 2].concat(Array(Math.ceil(data.data.length / 2)).fill(2)),
						message: `${this.getTitle($)}e${data.id}`,
						menu: [],
						parsedObj: new fsClasses.Episode(data),
						callback: this.switchEpisode.bind(this, $, menuOpts, data.id)
					};

					// back button
					button.menu.push({
						text: 'Back',
						callback: this.switchEpisode.bind(this, $, menuOpts, null)
					});

					// add prev & next ep buttons
					button.menu.push({
						text: '< ep',
						callback: this.switchEpisode.bind(this, $, menuOpts, data.id - 1)
					}, {
						text: 'ep >',
						callback: this.switchEpisode.bind(this, $, menuOpts, data.id + 1)
					});

					button.menu.push.apply(button.menu, this.getWatchButtons($, data.data));

					menuOpts.menu.push(button);
				});

				break;
			default:
				break;
		}

		return menuOpts;
	}

	getWatchButtons($, data) {
		let res = [];

		data.forEach((d, i) => {
			let button = Object.assign({}, d);
			let linkButton = {
				text: 'Link',
				callback: cb => {
					$.api.answerCallbackQuery(cb.id);
					$.sendMessage(button.url);
				}
			};

			res.push(button);
			res.push(linkButton);
		});

		return res;
	}

	getWatchLinks(obj) {
		let urlsData = obj.menu.filter(d => d.url && !d.cdnLink);

		return Promise.all(urlsData.map(d => this.connector.getLink(d.url))).then(links => {
			urlsData.forEach((d, i) => (d.url = links[i]) && (d.cdnLink = true));
			return obj;
		}).catch(e => {
			console.log(`Failed to get movie ${obj.message}`);
			obj.message += ' (Issues with getting movie)';
		});
	}

	getTitle($) {
		return `${$.userSession.movie.title} ${$.userSession.tree.title}`;
	}

	/**
	 * Sends message to scope
	 * @param $
	 * @param msg
	 * @param cb
   */
	sendMessage($, msg, cb) {
		$.api.answerCallbackQuery(cb.id);
		$.sendMessage(msg);
	}

	/**
	 * Switches episode
	 *
	 * @param {Telegram.Scope} $
	 * @param menuOpts
	 * @param ep
	 * @param {Telegram.CallbackQuery} cb
	 * @fixme if no episode found
   */
	switchEpisode($, menuOpts, ep, cb) {
		$.api.answerCallbackQuery(cb.id);

		let tree = $.userSession.tree;

		// handling back button when no episode passed
		if (!ep) {
			tree.pop();
			$.runInlineMenu(menuOpts, $.userSession.msg);
			return;
		}

		let menu = menuOpts.menu.filter(m => m.id === ep);

		if (menu.length) {
			menu = menu[0];

			if (tree.last.type === 'episode') {
				tree[tree.length - 1] = menu.parsedObj;
			} else {
				tree.push(menu.parsedObj);
			}

			this.getWatch($, menu);
		}
	}

	/**
	 * Get watch link & save the data and displays the menu
	 * @param $
	 * @param menu
	 * @param silent
	 * @returns {Promise|Promise.<TResult>|*}
   */
	getWatch($, menu, silent) {
		let data = this.getWatchLinks(menu);
		!silent && data.then(menu => this.saveMovie.apply(this, [$]));
		return data.then(() => $.runInlineMenu(menu, $.userSession.msg));
	}

	/**
	 * Save movie to DB
	 * @param $
	 * @returns {*}
   */
	saveMovie($) {
		let lastFolders = $.userSession.tree.toString();
		return $.persistent().saveMovie($.update.message.from, $.userSession.movie, lastFolders);
	}

	/**
	 * Rollback from string history tree
	 * @param $
	 * @param movie
	 * @param msg
   */
	roll($, movie, msg) {
		const tree = new HistoryTree(movie.last_folders);
		this.selectMovie($, movie, msg, tree);

		let episodeNode = tree.pop();
		let folderNode;

		if (episodeNode.type === 'episode') {
			folderNode = tree.pop();
		} else {
			folderNode = episodeNode;
			episodeNode = null;
		}

		this.getFolder($, folderNode.id).then(parsedObj => this.selectWatch($, parsedObj, episodeNode));
	}

}

module.exports = SearchController;
