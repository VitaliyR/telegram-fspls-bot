const request = require('request-promise');

let instance;

class API {

  static get errors() { return ['ENETUNREACH', 'ETIMEDOUT', 'ENOTJSON']; }
  static get texts() { return this._texts; }

  static _handleError(e) {
    let code = e.error ? e.error.code : e.message;

    if (API.errors.includes(code)) {
      throw API.texts.serviceUnavailable;
    }

    throw e;
  }

  static _checkJSON(res) {
    if (typeof res !== 'object') {
      throw new Error('ENOTJSON');
    }

    return res;
  }

  constructor(config) {
    this.config = config;
  }

  set texts(t) { API._texts = t; }

  search(query) {
    return request({
      uri: `${this.config.base}${this.config.search}`,
      qs: {
        f: 'quick_search',
        search: query
      },
      json: true,
      timeout: this.config.timeout
    })
      .then(API._checkJSON)
      .catch(API._handleError);
  }

  getSeries(movie, folder = 0) {
    return request({
      uri: `${this.config.base}${movie.link}`,
      timeout: this.config.timeout,
      qs: {
        ajax: true,
        folder: folder
      }
    })
      .catch(API._handleError);
  }

  getLink(link, qs = {}) {
    return request({
      method: 'HEAD',
      uri: link,
      qs: qs,
      timeout: this.config.timeout,
      transform: function(body, res) {
        return res.request.href;
      }
    }).catch(API._handleError);
  }

  getData(link, qs) {
    let linkEls = link.substr(1).split('/');
    linkEls.splice(linkEls.length - 1, 0, 'view_iframe');
    link = `${this.config.base}/${linkEls.join('/')}`;

    if (qs) {
      qs.get = '';
      qs.quality = '1080';

      if (qs.season) {
        qs.is_season = '1';
      } else {
        qs.is_lang = '1';
      }
    }

    return this.getLink(link, qs).then(dataLink => {
      return request({
        uri: dataLink,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }).then(response => {
        return JSON.parse(response);
      });
    });
  }

  getMovieData(movieId) {
    let link = '/video/films/' + movieId + '.html';

    return this.getData(link).then(parsedObj => {
      return {
        title: parsedObj.coverData.title,
        link: parsedObj.actionsData.pageBaseUrl.replace('/view', '')
      };
    });
  }

}

module.exports = function(config) {
  instance = instance || (new API(config));
  return instance;
};
