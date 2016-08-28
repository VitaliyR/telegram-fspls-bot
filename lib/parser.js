const cheerio = require('cheerio');

const mappers = {
	selectors: {
		episode: {
			link: 'b-file-new__link-material',
			number: 'b-file-new__link-material-filename-series-num',
			name: 'b-file-new__link-material-filename-text',
			size: 'b-file-new__link-material-size'
		},
		fileList: 'folder-filelist'
	},
	movieLink: 'http://fs.to/get/playvideo/',
	seasonExp: /сезон/i,
	digitExp: /\d+/,
	extensionExp: /[a-zA-Z0-9]+$/,							// file extension from uri
	episodeExp: /([0-9])+/,											// episode number from string
	folderExp: /parent_id:[ ]*["']*([^,"']+)/,	// folder name/number from string
	linkExp: /get\/dl\/(.+)\//,									// name of movie on cdn from string
	clearExp: /\n|\t/														// clears the string from tabs and newlines
};


class Parser {

  static parseActions(json) {
    let actionsData = json.actionsData;
    // data.seasons[folder] ?
    // data.languages[title].translations[title|folder]
    // data.files
    // currentSeason?
    let translations = actionsData.languages.map((l, lIndex) => {
      return {
        id: lIndex,
        type: 'folder',
        childType: 'folder',
        title: l.title,
        data: l.translations.map((t, tIndex) => {
          return {
            id: tIndex,
            type: 'folder',
            childType: 'watch', // FIXME ?
            title: t.title,
            data: [] // FIXME ?
          }
        })
      }
    })
    let data = {
      id: 0,
      childType: 'season',
      data: actionsData.seasons.map(s => {
        return {
          id: s.folder,
          number: s.folder,
          childType: 'folder',
          data: actions
        }
      })
    };

    return data;
  }

	static parse(res) {
		const episodeSelectors = mappers.selectors.episode;
		const dom = cheerio.load(res.trim());

		dom('ul ul').remove();
    dom(episodeSelectors.fileList).remove();

		const isEpisode = dom(`a.${episodeSelectors.link}`).length;
		const containsSeason = dom(`a > b`).first().text().trim().match(mappers.seasonExp);
		const hasBlocked = dom('#file-block-text').length;

		let parsedObj;

		if (isEpisode) {
			parsedObj = this.parseMovie(dom);
		} else {
			parsedObj = this.parseFolder(dom);
			if (containsSeason) {
				parsedObj.childType = 'season';
				parsedObj.data.forEach(d => {
					let seasonNumber = d.text.match(mappers.digitExp);
					if (seasonNumber) {
						d.number = seasonNumber[0];
					}
				});
			}
		}

		hasBlocked && (parsedObj.hasBlocked = true);

		return parsedObj;
	}

	static parseFolder(dom) {
		let data = [];

		dom('a').each((i, node) => {
			node = cheerio(node);

			const rel = node.attr('rel');
			if (!rel) return;

			const folder = rel.match(mappers.folderExp);
			if (folder && folder.length) {
				data.push({
					text: node.text().trim().replace(mappers.clearExp, ''),
					folder: folder[1]
				});
			}
		});

		return {
			type: 'folder',
			childType: 'folder',
			data: data
		};
	}

	static parseMovie(dom) {
		const episodeSelectors = mappers.selectors.episode;
		let episodes = {};
		let data = [];

		const isEpisodes = dom(`.${episodeSelectors.number}`).length;

		dom(`a.${mappers.selectors.episode.link}`).each((i, node) => {
			node = cheerio(node);

			if (isEpisodes) {
				let episodeObj = this.parseEpisode(node);

				const episodeNum = episodeObj.id;
				const episode = episodes[episodeNum];

				if (episode) {
					episode.data.push.apply(episode.data, episodeObj.data);
				} else {
					episodes[episodeNum] = episodeObj;
					data.push(episodes[episodeNum]);
				}
			} else {
				const watch = this.parseWatch(node);
				watch && data.push.apply(data, watch);
			}
		});

		if (isEpisodes) {
			// link episodes
			data.forEach(episode => {
				const episodeNum = episode.id;
				const prevEp = episodeNum - 1;
				const nextEp = episodeNum + 1;

				episode.data = this.removeDuplicatesVideos(episode.data);

				episodes[prevEp] && (episode.previous = episodes[prevEp]);
				episodes[nextEp] && (episode.next = episodes[nextEp]);
			});
		} else {
			data = this.removeDuplicatesVideos(data);
		}

		return {
			type: 'folder',
			childType: isEpisodes ? 'episode' : 'watch',
			data: data
		};
	}

	static parseEpisode(node) {
		const episodeNumber = node.find(`.${mappers.selectors.episode.number}`).text().match(mappers.episodeExp)[0];

		return {
			type: 'episode',
			childType: 'watch',
			id: parseInt(episodeNumber, 10),
			data: this.parseWatch(node)
		};
	}

	static parseWatch(node) {
		const episodeSelectors = mappers.selectors.episode;

		const extension = node.find(`.${episodeSelectors.name}`).text().match(mappers.extensionExp)[0];

		const cdnLink = node.next().attr('href').match(mappers.linkExp)[1];
		const link = mappers.movieLink + cdnLink;

		return [{
			type: 'watch',
			text: 'HD',
			url: link + '_hd.mp4',
			ext: extension
		},{
			type: 'watch',
			text: 'SD',
			url: link + '.mp4',
			ext: extension
		}];
	}

	static removeDuplicatesVideos(data) {
		if (data.length <= 2) return data;
		let mp4data = data.filter(d => d.ext === 'mp4');
		!mp4data.length && (mp4data = data.splice(0, 2));
		return mp4data.splice(0, 2);
	}

}

module.exports = Parser;
