const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
		id: { type: Number, required: true, unique: true },
		first_name: { type: String, required: true },
		last_name: String,
		username: String,
		movies: {
			type: [{
				title: String,
				link: String,
				last_folders: String,
				lastupdate_at: Date
			}],
			default: []
		}
	},
	{
		timestamps: {
			createdAt: 'firstly_at',
			updatedAt: 'lasttime_at'
		}
	});

const User = mongoose.model('User', userSchema);

module.exports = User;