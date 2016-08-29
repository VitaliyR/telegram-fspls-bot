/**
 * Base parsed node class
 */
class ParsedNode {
	get type() { return '' }
	get childType() { return '' }
	get id() { return this._id }

	constructor(config) {
		this._id = config.id;
		this.data = config.data;
		this.menu = config.menu || [];
	}

	toString() {
		return `${this.type}_${this.id}`;
	}

	unString(id) {
		this._id = id;
	}

	static unString(str) {
		const args = str.split('_');
		const type = args[0][0].toUpperCase() + args[0].substr(1);

		let obj = new classes[type]({});
		obj.unString.apply(obj, args.splice(1));

		return obj;
	}
}


class Folder extends ParsedNode {

	get type() { return 'folder' }
	get childType() { return this._childType }

	constructor(config) {
		super(config);
		this._childType = config.childType;
		this.hasBlocked = config.hasBlocked;
		this.isBlocked = config.isBlocked;
	}
}


class Season extends Folder {

	get type() { return 'season' }
	get number() { return this._number }

	constructor(config) {
		super(config);
		this._number = config.number;
	}

	toString() {
		return `${super.toString()}_${this.number}`;
	}

	unString(id, number) {
		super.unString.apply(this, arguments);
		this._number = number;
	}

}


class Episode extends Season {

	get type() { return 'episode' }
	
	constructor(config) {
		config.number = config.id;
		super(config);
	}

}


const classes = {
	ParsedNode: ParsedNode,
	Folder: Folder,
	Season: Season,
	Episode: Episode
};

module.exports = classes;

