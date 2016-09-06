const Telegram = require('telegram-node-bot');

const Parser = require('../lib/parser');

const logger = require('../lib/logger')();
const fsClasses = require('../lib/fs-classes');
const HistoryTree = require('../lib/history-tree');


class SearchController extends Telegram.TelegramBaseController {

  constructor(config, api) {
    super();
    this.config = config;
    this.connector = api;
  }

  /**
   * Searches FS.to
   * @param $ ctx
   */
  handle($) {
    if ($.message.chat.type === 'group') return;

    const query = $.query.request || $.message.text;

    if (!query) return;

    this.connector.search(query).then((res) => {
      if (!res.length) throw new Error('Nothing found');

      let menuOpts = {
        method: 'sendMessage',
        message: 'Found',
        params: ['*Found:*', { parse_mode: 'Markdown' }],
        menu: []
      };

      res.forEach((movie) => menuOpts.menu.push({
        text: Parser.parseSearchMovieTitle(movie),
        callback: (cb, msg) => {
          $.api.answerCallbackQuery(cb.id);
          this.rollMovie($, movie, msg).then(() => {
            $.userSession.tree.prepend(
              new fsClasses.SearchResult({
                menu: menuOpts
              })
            );
          });
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
    const folderId = typeof folder.id !== 'undefined' ? folder.id : folder;
    return this.connector.getSeries(movie, folderId)
      .then(res => Parser.parse(res))
      .then(parsedRes => {
        // if smth is blocked
        if (parsedRes.hasBlocked) {
          logger.log('Blocked movie found:', movie.title);
          const qs = folder.params || {};

          // try to parse with new parser (json actions based)
          return this.connector.getData(movie.link, qs).then(data => Parser.parseActions(data)).catch(e => {
            logger.error('Problems of parsing actions for:', movie.title);
            logger.error(e);
            return parsedRes; // return to prev folder parser
          });
        }

        // if we passed already folder - just
        if (folder instanceof fsClasses.ParsedNode) {
          folder.data = parsedRes.data;
          folder.childType = parsedRes.childType;
          return folder;
        }

        return parsedRes;
      })
      .then(parsedRes => this.buildClass($, movie, folderId, parsedRes));
  }

  buildClass($, movie, folderId, parsedRes) {
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
      const nodePos = parsedObj.data.indexOf(currentObj);

      return this.connector.getData(movie.link, currentObj.params)
        .then(data => Parser.parseActions(data))
        .then(parsedRes => {
          var newNode = $.utils().findOneNode(parsedRes, 'id', currentObj.id);
          if (!newNode) {
            throw new Error(`New node not found, weird: ${movie.title} ${currentObj.id}`);
          }

          return newNode;
        })
        .then(parsedRes => this.buildClass($, movie, currentObj.id, parsedRes))
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

    let msg = $.userSession.msg;

    $.userSession.tree.push(parsedObj);

    const menu = parsedObj.menu ? parsedObj.menu : this.getMenu($, parsedObj);

    // Fix for current framework ver
    if (!menu.params || menu.params.length > 1) {
      menu.params = [msg];
    }

    return this.runInlineMenu($, menu);
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
    }
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

  selectWatch($, parsedObj, episode) {
    let msg = $.userSession.msg;
    let tree = $.userSession.tree;

    tree.push(parsedObj);

    let menu = parsedObj.menu ? parsedObj.menu : this.getMenu($, parsedObj);

    if (parsedObj.childType === 'watch') {
      this.getWatch($, menu);
    } else {
      if (episode) {
        let episodeMenu = menu.menu.filter(m => m.id === 1 * episode.id)[0];
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
    let menuOpts = {
      method: 'sendMessage',
      params: [$.userSession.msg],
      menu: [],
      message: this.getTitle($)
    };

    parsedObj.hasBlocked && (menuOpts.message += ' (some data is blocked)');

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

    return Promise.all(urlsData.map(d => this.connector.getLink(d.url))).then(links => {
      urlsData.forEach((d, i) => (d.url = links[i]) && (d.cdnLink = true));
      return obj;
    }).catch(() => {
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
   */
  switchEpisode($, menuOpts, ep, cb) {
    let tree = $.userSession.tree;

    // handling back button when no episode passed
    if (!ep) {
      tree.pop();
      $.runInlineMenu(menuOpts, $.userSession.msg);
      return;
    }

    let menu = menuOpts.menu.filter(m => m.id === ep);

    if (menu.length) {
      $.api.answerCallbackQuery(cb.id);

      menu = menu[0];

      if (tree.last.type === 'episode') {
        tree[tree.length - 1] = menu.parsedObj;
      } else {
        tree.push(menu.parsedObj);
      }

      this.getWatch($, menu);
    } else {
      $.api.answerCallbackQuery(cb.id, {
        text: 'Can\'t go further'
      });
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
   * @param {Scope} $
   * @param {Object} movie
   * @param {Message} msg
   */
  roll($, movie, msg) {
    let tree = new HistoryTree(movie.last_folders);
    this.selectMovie($, movie, msg, tree);

    let episodeNode = tree.pop();
    let folderNode;

    if (episodeNode.type === 'episode') {
      folderNode = tree.pop();
    } else {
      folderNode = episodeNode;
      episodeNode = null;
    }

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

    this.getFolder($, folderNode)
      .then(parsedObj => {
        if (parsedObj.isBlocked) {
          tree.rebuild(leaf => {
            let node = $.utils().findOneNode(parsedObj, 'id', leaf.id);

            if (!(node instanceof fsClasses.ParsedNode)) {
              node = this.buildClass($, movie, node.id, node);
            }

            return node;
          }, this);

          let node = $.utils().findOneNode(parsedObj, 'id', folderNode.id);
          return this.getActionData($, parsedObj, node);
        } else {
          return parsedObj;
        }
      })
      .then(parsedObj => this.selectWatch($, parsedObj, episodeNode));
  }

  rollMovie($, movie, msg) {
    let retriever = Promise.resolve(movie);

    if (typeof movie !== 'object') {
      let link = '/video/films/' + movie + '.html';
      retriever = this.connector.getData(link).then(parsedObj => {
        movie = {
          title: parsedObj.coverData.title,
          link: parsedObj.actionsData.pageBaseUrl
        };

        return movie;
      });
    }

    return retriever.then(movie => {
      this.selectMovie($, movie, msg);
      return this.getFolder($).then(parsedObj => this.selectFolder($, parsedObj));
    });
  }

  runInlineMenu($, menu) {
    let msg = $.userSession.msg;

    if (!msg) {
      menu.params = [menu.message];
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
