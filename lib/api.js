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

	getData(link, quality, folder, language, translate, translation) {
		let linkEls = link.substr(1).split('/');
    linkEls.splice(linkEls.length - 1, 0, 'view_iframe');
		link = `${this.config.base}/${linkEls.join('/')}`;

		//get&is_lang=1&folder_id=1&quality=1080&language=%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9&translate=%D1%81%D1%82%D1%83%D0%B4%D0%B8%D0%B9%D0%BD%D1%8B%D0%B9&translation=%D0%93%D0%BB%D0%B0%D0%BD%D1%86%20%D0%9F%D0%B5%D1%82%D1%80&series=1
    //get&is_season=1&folder_id=6&season=6&audio_language=%D0%A3%D0%BA%D1%80%D0%B0%D0%B8%D0%BD%D1%81%D0%BA%D0%B8%D0%B9&translate=%D1%82%D0%B5%D0%BB%D0%B5%D0%BA%D0%B0%D0%BD%D0%B0%D0%BB&translation=%D0%A1%D0%A2%D0%91&quality=dvdrip
		let qs = {};
		if (arguments.length > 1) {
			qs.get = '';
			quality && (qs.quality = quality);
			folder && (qs.folder = folder);
			language && (qs.language = language);
			translate && (qs.translate = translate);
			translation && (qs.translation = translation);
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

module.exports = API;
