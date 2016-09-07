const Telegram = require('telegram-node-bot');
const mongoose = require('mongoose');

const User = require('../models/User');

/**
 * Persistent class wrapper for Telegram bot
 */
class Persistent extends Telegram.BaseScopeExtension {

  /**
   * Gets extension name for telegram
   * @override
   * @returns {string}
   */
  get name() {
    return 'persistent';
  }

  /**
   * @override
   * @returns {Persistent}
   */
  process() {
    return Persistent;
  }

  /**
   * Sets config and creates connection
   * @param {Object} config
   */
  static connect(config) {
    this.config = config;
    mongoose.Promise = Promise;
    mongoose.connect(`${config.db.url}${config.db.db}`, { server: { reconnectTries: Number.MAX_VALUE } });
  }

  /**
   * Creates a user in DB
   * @static
   * @param user
   * @returns {Promise.<User>}
   */
  static createUser(user) {
    const userData = {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      username: user.username
    };
    const newUser = new User(userData);
    return newUser.save();
  }

  /**
   * Enables user in system - toggle disabled flag
   * @static
   * @param {Object} userData
   * @returns {Promise.<User>}
   */
  static enableUser(userData) {
    return this.getUser(userData).then(user => {
      if (user) {
        user.disabled = false;
      } else {
        return this.createUser(userData);
      }

      return user.save();
    });
  }

  /**
   * Disables user in system - toggles disabled flag
   * @static
   * @param {Object} userData
   * @returns {Promise.<User>}
   */
  static disableUser(userData) {
    return this.getUser(userData).then(user => {
      if (user) {
        user.disabled = true;
        return user.save();
      }
    });
  }

  /**
   * Get user
   * @static
   * @param {Object} user
   * @returns {Promise.<User>}
   */
  static getUser(user) {
    return User.findOne({ id: user.id });
  }

  /**
   * Returns activity state of user according to disabled flag
   * @static
   * @param {Object} userData
   * @returns {Promise.<Boolean>}
   */
  static isActive(userData) {
    return this.getUser(userData).then(user => {
      return user ? !user.disabled : false;
    });
  }

  /**
   * Saves for user movie tree history in DB
   * @static
   * @param {Object} user
   * @param {Object} movieDesc
   * @param {Array.<String>} navHistory
   * @returns {Promise.<User>}
   */
  static saveMovie(user, movieDesc, navHistory) {
    return this.getUser(user)
      .then(doc => {
        return doc || this.createUser(user);
      })
      .then(doc => {
        let movies = doc.movies;
        let movie = movies.filter(m => {
          return m.title === movieDesc.title && m.link === movieDesc.link;
        })[0];

        if (!movie) {
          movie = {
            title: movieDesc.title,
            link: movieDesc.link
          };
          movies.push(movie);
          movie = movies[movies.length - 1];
        }

        movie.last_folders = navHistory;
        movie.lastupdate_at = Date.now();

        this.clearUser(doc);
        return doc.save();
      });
  }

  /**
   * Splice user movie history if its length more than configured maximum
   * @static
   * @private
   * @param {User} doc
   * @returns {User}
   */
  static clearUser(doc) {
    const limit = Persistent.config.history_limit;
    let movies = doc.movies = doc.movies.sort((a, b) => b.lastupdate_at - a.lastupdate_at);

    if (movies.length > limit) {
      movies.splice(limit, movies.length);
    }

    return doc;
  }

}

module.exports = Persistent;
