const request = require('request-promise');

let instance;

class API {

	constructor(config) {
		this.config = config;
	}

	search(query) {
		return request({
			uri: `${this.config.base}${this.config.search}`,
			qs: {
				f: 'quick_search',
				search: query
			},
			json: true
		})
	}

	getSeries(movie, folder = 0) {
		return request({
			uri: `${this.config.base}${movie.link}`,
			qs: {
				ajax: true,
				folder: folder
			}
		});
	}

	getLink(link, qs = {}) {
		return request({
			method: 'HEAD',
			uri: link,
			qs: qs,
			transform: function (body, res) {
				return res.request.href;
			}
		})
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

}

module.exports = function(config) {
	instance = instance || (new API(config));
	return instance;
};
