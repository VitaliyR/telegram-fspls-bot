const request = require('request-promise');

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

	getLink(link) {
		return request({
			method: 'HEAD',
			uri: link,
			transform: function (body, res) {
				return res.request.href;
			}
		})
	}

	getData(link) {
		let linkEls = link.substr(1).split('/');
    linkEls.splice(linkEls.length - 1, 0, 'view_iframe');
		link = `${this.config.base}/${linkEls.join('/')}`;
    
		return this.getLink(link).then(dataLink => {
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

module.exports = API;
