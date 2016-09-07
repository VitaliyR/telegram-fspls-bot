const Telegram = require('telegram-node-bot');
const TModels = Telegram.Models;

/**
 * Wrapper for TelegramNodeBot Scope extension
 */
class Utils extends Telegram.BaseScopeExtension {

  /**
   * Gets extension name for telegram
   * @override
   * @returns {string}
   */
  get name() {
    return 'utils';
  }

  /**
   * @override
   * @returns {Utils}
   */
  process() {
    return Utils;
  }

  /**
   * Sets telegram server instance
   * @static
   * @param tg
   */
  static setTg(tg) {
    this.TG = tg;
  }


  /**
   * Find nodes in root where key is strict equals value
   * @param {Object} root
   * @param {String} key
   * @param {*} value
   * @static
   * @returns {Array.<Object>}
   */
  static findNode(root, key, value) {
    let res = [];
    root[key] === value && res.push(root);
    return !root.data ? res : res.concat(root.data
      .map(r => this.findNode(r, key, value), this)
      .reduce((a, b) => a.concat(b), [])
    );
  }

  /**
   * Finds one node
   * @see this.findNode
   * @static
   * @returns {Object}
   */
  static findOneNode() {
    return this.findNode.apply(this, arguments)[0];
  }

  /**
   * Override original method for fixing bugs with api & returning response which can contains some error from
   * telegram api server
   * @static
   */
  static runInlineMenu($, menuData, prevMessage) {
    const method = menuData.method;
    const params = menuData.params || [];
    const layout = menuData.layout;
    const menu = menuData.menu;

    let keyboard = [];

    let callbackData = [];

    if (!layout) {
      keyboard = menu.map(item => {
        callbackData.push(Math.random().toString(36).substring(7));

        return [new TModels.InlineKeyboardButton(item.text, item.url, callbackData[callbackData.length - 1])];
      });
    } else {
      let line = 0;
      menu.forEach(item => {
        if (!keyboard[line]) keyboard[line] = [];

        callbackData.push(Math.random().toString(36).substring(7));

        keyboard[line].push(new TModels.InlineKeyboardButton(item.text, item.url, callbackData[callbackData.length - 1]));

        let goToNextLine = Array.isArray(layout) ? keyboard[line].length ===
        layout[line] : keyboard[line].length === layout;

        if (goToNextLine) {
          ++line;
        }
      });
    }

    if (typeof params[params.length - 1] === 'object') {
      params[params.length - 1] = Object.assign(params[params.length - 1], {
        reply_markup: JSON.stringify(new TModels.InlineKeyboardMarkup(keyboard))
      });
    } else {
      params.push({
        reply_markup: JSON.stringify(new TModels.InlineKeyboardMarkup(keyboard))
      });
    }

    var prepareCallback = (response) => {
      callbackData.forEach((data, index) => {
        $.waitForCallbackQuery(data, (query) => {
          if (menu[index].callback) {
            try {
              menu[index].callback(query, response);
            } catch (e) {
              $.logger.error({ 'error in user callback:': e });
            }
          } else {
            $.runInlineMenu(menu[index], response);
          }
        });
      });
    };

    if (!prevMessage) {
      return $[method].apply($, params)
        .then(response => {
          prepareCallback(response);
        });
    } else {
      params[0].chat_id = prevMessage.chat.id;
      params[0].message_id = prevMessage.messageId;

      $.api.editMessageText(menuData.message, params[0])
        .then(response => {
          prepareCallback(response);
        });
    }
  }

  /**
   * Returns a Scope for callback
   * @param cb
   * @static
   * @returns {Promise.<Telegram.Scope>}
   */
  static getScopeFromCallback(cb) {
    let userData = cb.from;

    let update = new TModels.Update(
      Date.now(),
      new TModels.Message(
        Date.now(),
        new TModels.User(userData),
        Date.now(),
        new TModels.Chat(
          userData.id,
          'private'
        )
      )
    );
    let processor = this.TG._updateProcessor._processorForUpdate(update);

    return processor._getSession(update.message).then(session => {
      return new Telegram.Scope(
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
    });
  }

}

module.exports = Utils;
