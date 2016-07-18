const fsClasses = require('./fs-classes');

class HistoryTree extends Array {

	* reverse() {
		for (let key = this.length - 1; key >= 0; key--) {
			yield [key, this[key]];
		}
	}

	get last() {
		return this[this.length - 1];
	}

	get title() {
		return this.reduce((str, leaf) => {
			if (!leaf.number) return str;

			switch (leaf.type) {
				case 'season':
					str += `s${leaf.number}`;
					break;
				case 'episode':
					str += `e${leaf.number}`;
					break;
				default: break;
			}

			return str;
		}, '');
	}

	toString() {
		return this.map(leaf => leaf.toString()).join(',');
	}

	constructor(tree) {
		super();

		tree && tree.split(',').forEach((leaf, i) => this[i] = fsClasses.ParsedNode.unString(leaf));
	}

}

module.exports = HistoryTree;