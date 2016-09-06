const mongoose = require('mongoose');
const logger = require('./logger');

const User = require('../models/User');


class PersistentLayer {
	constructor(config) {
		this.config = config;
		mongoose.Promise = Promise;
		this.connection = mongoose.connect(`${config.db.url}${config.db.db}`, { server: { reconnectTries: Number.MAX_VALUE } });
	}

	createUser(user) {
		const userData = {
			id: user.id,
			first_name: user.firstName,
			last_name: user.lastName,
			username: user.username
		};
		const newUser = new User(userData);
		return newUser.save();
	}

	removeUser(user, force) {
		return this.getUser(user).then(user => {
			if (user) {
				if (force || user.movies.length === 0) {
					return user.remove();
				}
			}

			return Promise.resolve(user);
		})
	}

	getUser(user) {
		return User.findOne({ id: user.id });
	}

	saveMovie(user, movieDesc, navHistory) {
		const userId = user.id;
		return User
			.findOne({ id: userId })
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

	clearUser(doc) {
		const limit = this.config.history_limit;
		let movies = doc.movies = doc.movies.sort((a, b) => b.lastupdate_at - a.lastupdate_at);

		if (movies.length > limit) {
			movies.splice(limit, movies.length);
		}

		return doc;
	}

}

module.exports = PersistentLayer;
