module.exports = {

	/**
	 * Find nodes in root where key is strict equals value
	 * @param {Object} root
	 * @param {String} key
	 * @param {*} value
	 * @returns {Array.<Object>}
	 */
	findNode: function(root, key, value) {
		let res = [];
		root[key] === value && res.push(root);
		return !root.data ? res : res.concat(root.data
			.map(r => this.findNode(r, key, value), this)
			.reduce((a, b) => a.concat(b), [])
		);
	},

	/**
	 * Finds one node
	 * @see this.findNode
	 * @returns {Object}
	 */
	findOneNode: function() {
		return this.findNode.apply(this, arguments)[0];
	}

};