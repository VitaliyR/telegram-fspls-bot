const Telegram = require('telegram-node-bot');

const Parser = require('../lib/parser');

const logger = require('../lib/logger')();
const fsClasses = require('../lib/fs-classes');
const HistoryTree = require('../lib/history-tree');


class SearchController extends Telegram.TelegramBaseController {

  get texts() {
    return this._localization[this.config.i18nDefault];
  }

  constructor(config, api) {
    super();
    this.config = config;
    this.connector = api;
  }

  notifyError($, e) {
    if (typeof e === 'string') {
      $.sendMessage(`_${e}_`, { parse_mode: 'Markdown' });
    } else {
      logger.error(e);
    }
  }

  /**
   * Clears user session
   * @param {Telegram.Scope} $
   * @returns {Promise}
   */
  clearSession($) {
    $.userSession.tree = null;
    $.userSession.msg = null;
    $.userSession.movie = null;
    return Promise.resolve();
  }

  /**
   * Searches FS
   * @param $ ctx
   */
  handle($) {
    if ($.message.chat.type === 'group') return;

    const query = $.query.request || $.message.text;

    if (!query) return;

    this.clearSession($);
    this.connector.search(query).then((res) => {
      if (!res.length) throw this.texts.errors.nothingFound;

      let menuOpts = {
        method: 'sendMessage',
        params: [`*${this.texts.foundMovies}*`, { parse_mode: 'Markdown' }],
        menu: []
      };

      res.forEach((movie) => menuOpts.menu.push({
        text: Parser.parseSearchMovieTitle(movie),
        callback: (cb, msg) => {
          let tree = new HistoryTree([ new fsClasses.SearchResult({ menu: menuOpts }) ]);
          this.selectMovie($, movie, msg, tree).then(() => $.api.answerCallbackQuery(cb.id));
        }
      }));

      this.runInlineMenu($, menuOpts);
    }).catch(this.notifyError.bind(this, $));
  }

  /**
   * Load selected movie either by full movie object received from search or by its id
   * @param {Telegram.Scope} $
   * @param {Object|string} movie
   * @param {Telegram.Models.Message|null} [msg=]
   * @param {HistoryTree|null} [tree=]
   * @param {ParsedNode|String} [folderNode=]
   * @return {Promise}
   */
  selectMovie($, movie, msg, tree, folderNode) {
    let retriever = typeof movie === 'object' ? Promise.resolve(movie) : this.connector.getMovieData(movie);

    return retriever
      .then(movie => {
        $.userSession.msg = msg;
        $.userSession.movie = movie;
        $.userSession.tree = tree || new HistoryTree();
      })
      .then(() => this.getFolder($, folderNode))
      .then(parsedObj => {
        folderNode && folderNode.selectedEpisode && (parsedObj.selectedEpisode = folderNode.selectedEpisode);
        return parsedObj;
      })
      .then(parsedObj => this.selectFolder($, parsedObj))
      .catch(this.notifyError.bind(this, $));
  }

  getData($, movie, folder) {
    const isFolderNode = folder instanceof fsClasses.ParsedNode;
    const folderId = isFolderNode ? folder.id : folder;

    return this.connector.getSeries(movie, folderId)
      .then(res => Parser.parse(res))
      .then(parsedRes => {
        // if smth is blocked
        if (parsedRes.hasBlocked) {
          logger.log('Blocked movie found:', movie.title);
          const qs = folder.params || {};

          // try to parse with new parser (json actions based)
          return this.connector.getData(movie.link, qs)
            .then(data => Parser.parseActions(data))
            .catch(() => {
              logger.warn('Problems of parsing actions for:', movie.title);
              return parsedRes; // return to prev folder parser
            });
        }

        // if we passed already folder - just update it
        if (folder instanceof fsClasses.ParsedNode) {
          folder.data = parsedRes.data;
          folder.childType = parsedRes.childType;
          return folder;
        }

        return parsedRes;
      })
      .then(parsedRes => this.buildClass($, folderId, parsedRes))
      .then(parsedObj => {
        if (!parsedObj.isBlocked) return parsedObj;

        $.userSession.tree.rebuild(leaf => {
          if (leaf.id === -1) return leaf;

          let node = $.utils().findOneNode(parsedObj, 'id', leaf.id);

          if (!(node instanceof fsClasses.ParsedNode)) {
            node = this.buildClass($, node.id, node);
          }

          return node;
        }, this);

        if (isFolderNode) {
          let node = $.utils().findOneNode(parsedObj, 'id', folderId);
          return this.getActionData($, parsedObj, node);
        }

        return parsedObj;
      });
  }

  buildClass($, folderId, parsedRes) {
    if (parsedRes instanceof fsClasses.ParsedNode) return parsedRes;

    const tree = $.userSession.tree;

    if (typeof parsedRes.id === 'undefined') {
      parsedRes.id = folderId;
    }

    let className = parsedRes.type[0].toUpperCase() + parsedRes.type.substr(1);

    if (tree.length && tree.last.childType === 'season') {
      className = 'Season';
      if (typeof parsedRes.number === 'undefined') {
        parsedRes.number = tree.last.data.filter(d => d.folder === folderId)[0].number;
      }
    }

    return new fsClasses[className](parsedRes);
  }

  /**
   * Gets folder via actions parser
   * @param {Telegram.Scope} $
   * @param {Object} parsedObj
   * @param {ParsedNode} currentObj
   * @returns {Promise.<Object>}
   */
  getActionData($, parsedObj, currentObj) {
    const movie = $.userSession.movie;

    if (currentObj.data && currentObj.data.length) {
      return Promise.resolve(this.buildClass($, movie, currentObj));
    } else {
      const nodePos = parsedObj.data.indexOf(currentObj);

      return this.connector.getData(movie.link, currentObj.params)
        .then(data => Parser.parseActions(data))
        .then(parsedRes => {
          var newNode = $.utils().findOneNode(parsedRes, 'id', currentObj.id);
          if (!newNode) {
            throw logger.error(`New node not found, weird: ${movie.title} ${currentObj.id}`);
          }

          return newNode;
        })
        .then(parsedRes => this.buildClass($, currentObj.id, parsedRes))
        .then(parsedClass => {
          parsedObj.data[nodePos] = parsedClass;
          return parsedClass;
        });
    }
  }

  /**
   * Gets folder information
   * @type {Telegram.Scope} $
   * @type {Object|number} [folder=0] zero means root
   */
  getFolder($, folder = 0) {
    return this.getData($, $.userSession.movie, folder);
  }

  selectFolder($, parsedObj) {
    // folder which contains watches or episodes
    if (parsedObj.childType === 'watch' || parsedObj.childType === 'episode') return this.selectWatch($, parsedObj);

    $.userSession.tree.push(parsedObj);

    const menu = parsedObj.menu ? parsedObj.menu : this.getMenu($, parsedObj);

    return this.runInlineMenu($, menu);
  }

  buttonClick($, parsedObj, button, cb) {
    let retriever;

    switch (parsedObj.childType) {
      case 'watch':
      case 'episode':
        retriever = this.selectWatch($, parsedObj);
        break;
      case 'folder':
      case 'season':
        const dataRetriever = parsedObj.isBlocked
          ? this.getActionData($, parsedObj, button)
          : this.getFolder($, button.folder);
        retriever = dataRetriever.then(parsedObj => this.selectFolder($, parsedObj));
        break;
      default:
        throw logger.error('Error parsing new folder');
    }

    retriever.then((a) => $.api.answerCallbackQuery(cb.id));
  }

  backAction($) {
    let tree = $.userSession.tree;
    const isBlocked = tree.last.isBlocked;

    let currentNode = tree.pop();
    let menuNode = tree.pop();

    if (!menuNode.menu) {
      let retriever = isBlocked ? this.getActionData($, currentNode, menuNode) : this.getFolder($, menuNode);
      retriever.then(parsedObj => this.selectFolder($, parsedObj));
    } else {
      this.selectFolder($, menuNode);
    }
  }

  selectWatch($, parsedObj) {
    let tree = $.userSession.tree;
    let retriever;

    tree.push(parsedObj);

    let menu = parsedObj.menu ? parsedObj.menu : this.getMenu($, parsedObj);

    if (parsedObj.childType === 'watch') {
      retriever = this.getWatch($, menu);
    } else {
      let episode = parsedObj.selectedEpisode;
      if (episode) {
        let episodeMenu = menu.menu.filter(m => m.id === 1 * episode.id)[0];
        if (episodeMenu) {
          tree.push(episodeMenu.parsedObj);
          return this.getWatch($, episodeMenu, true);
        }
      }

      retriever = this.runInlineMenu($, menu);
    }

    return retriever;
  }

  getMenu($, parsedObj) {
    let title = this.getTitle($);

    parsedObj.hasBlocked && (title += ' ' + this.texts.blocked);

    let menuOpts = {
      method: 'sendMessage',
      params: [title, { parse_mode: 'Markdown' }],
      menu: []
    };

    // back button
    if ($.userSession.tree.length > 1) {
      menuOpts.menu.push({
        text: '∆ Back ∆',
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
          let episode = new fsClasses.Episode(data);
          let button = {
            id: data.id,
            text: '' + data.id,
            layout: [1, 2].concat(Array(Math.ceil(data.data.length / 2)).fill(2)),
            parsedObj: episode,
            callback: this.switchEpisode.bind(this, $, menuOpts, data.id),
            method: 'sendMessage',
            params: [`${this.getTitle($)}e${episode.numberString}`, { parse_mode: 'Markdown' }],
            menu: []
          };

          // back button
          button.menu.push({
            text: '∆ Back ∆',
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

    data.forEach(d => {
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
    let issue = false;

    return Promise.all(
      urlsData.map(d => {
        return this.connector.getLink(d.url)
          .catch(e => {
            logger.warn(`Failed to get movie ${obj.params[0]} ${d.text}`);
            issue = true;
          });
      }))
      .then(links => {
        urlsData.forEach((d, i) => (d.url = links[i]) && (d.cdnLink = true));
        obj.menu = obj.menu.filter((m, i) => {
          if (m._remove) return false;

          if ('url' in m) {
            if (typeof m.url === 'undefined') {
              obj.menu[i + 1]._remove = true;
              return false;
            }
          }

          return true;
        });
        issue && (obj.params[0] += `\n(${this.texts.issuesGettingMovie})`);
        return obj;
      });
  }

  getTitle($) {
    return `*${$.userSession.movie.title}* ${$.userSession.tree.title}`;
  }

  /**
   * Switches episode
   *
   * @param {Telegram.Scope} $
   * @param menuOpts
   * @param ep
   * @param {Telegram.CallbackQuery} cb
   */
  switchEpisode($, menuOpts, ep, cb) {
    let tree = $.userSession.tree;

    // handling back button when no episode passed
    if (!ep) {
      tree.pop();
      this.runInlineMenu($, menuOpts).then(() => $.api.answerCallbackQuery(cb.id));
      return false;
    }

    let menu = menuOpts.menu.filter(m => m.id === ep);

    if (menu.length) {
      menu = menu[0];

      if (tree.last.type === 'episode') {
        tree[tree.length - 1] = menu.parsedObj;
      } else {
        tree.push(menu.parsedObj);
      }

      this.getWatch($, menu).then(() => $.api.answerCallbackQuery(cb.id));
    } else {
      $.api.answerCallbackQuery(cb.id, { text: this.texts.cantGoFurther });
    }
  }

  /**
   * Get watch link & save the data and displays the menu
   * @param $
   * @param menu
   * @param silent
   * @returns {Promise|*}
   */
  getWatch($, menu, silent) {
    let data = this.getWatchLinks(menu);
    !silent && data.then(menu => this.saveMovie($));
    return data.then(() => this.runInlineMenu($, menu));
  }

  /**
   * Save movie to DB
   * @param {Telegram.Scope} $
   * @returns {Promise}
   */
  saveMovie($) {
    let lastFolders = $.userSession.tree.toString();
    return $.persistent().saveMovie($.update.message.from, $.userSession.movie, lastFolders);
  }

  /**
   * Rollback from string history tree
   * @param {Telegram.Scope} $
   * @param {Object} movie
   * @param {Telegram.Models.Message} msg
   */
  roll($, movie, msg) {
    let tree = new HistoryTree(movie.last_folders);

    let episodeNode = tree.pop();
    let folderNode;

    if (episodeNode.type === 'episode') {
      folderNode = tree.pop();
      folderNode.selectedEpisode = episodeNode;
    } else {
      folderNode = episodeNode;
      episodeNode = null;
    }

    // try to prepare for actiondata if any
    let params = folderNode.params = {
      translation: folderNode.id.split('translation')[0]
    };

    tree.forEach(t => {
      if (t.type === 'season') {
        params.season = t.id.split('season')[0];
      } else {
        let id = '' + t.id;

        if (id.indexOf('language') > 0) {
          params.language = id.split('language')[0];
        }
      }
    });

    return this.selectMovie($, movie, msg, tree, folderNode);
  }

  /**
   * Runs inline menu to scope either in existing message or create & remember new
   * @param {Telegram.Scope} $
   * @param {Object} menu
   * @returns {Promise}
   */
  runInlineMenu($, menu) {
    let msg = $.userSession.msg;

    if (!msg) {
      menu.menu.forEach(m => {
        let origCallback = m.callback;
        m.callback = function(cb, msg) {
          $.userSession.msg = msg;
          origCallback(cb, msg);
        };
      });
    }

    return $.utils().runInlineMenu($, menu, msg);
  }

}

module.exports = SearchController;
