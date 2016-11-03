/**
 * Base parsed node class
 */
class ParsedNode {
  get type() {
    return '';
  }

  get childType() {
    return '';
  }

  get id() {
    return this._id;
  }

  set id(newId) {
    this._id = 1 * newId === 0 ? (1 * newId) : newId;
  }

  constructor(config) {
    this.id = config.id;
    this.data = config.data || [];
    this.menu = config.menu;
  }

  toString() {
    return `${this.type}_${this.id}`;
  }

  unString(id) {
    this.id = id;
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

  get type() {
    return 'folder';
  }

  get childType() {
    return this._childType;
  }

  set childType(newChildType) {
    this._childType = newChildType;
  }

  constructor(config) {
    super(config);
    this._childType = config.childType;
    this.hasBlocked = config.hasBlocked;
    this.isBlocked = config.isBlocked;
    this.params = config.params;
    this.text = config.text;
  }

}

class Season extends Folder {

  get type() {
    return 'season';
  }

  get number() {
    return this._number;
  }

  get numberString() {
    const number = '' + this.number;
    return number.length === 1 ? '0' + number : number;
  }

  constructor(config) {
    super(config);
    this._number = config.number;
  }

  toString() {
    return `${super.toString()}_${this.numberString}`;
  }

  unString(id, number) {
    super.unString.apply(this, arguments);
    this._number = number;
  }

}

class Episode extends Season {

  get type() {
    return 'episode';
  }

  constructor(config) {
    config.number = config.id;
    super(config);

    this.selectedEpisode = config.selectedEpisode;
  }

  toString() {
    return `${super.toString()}_${this.numberString}}`;
  }

}

class SearchResult extends ParsedNode {

  get type() {
    return 'search';
  }

  get childType() {
    return 'folder';
  }

  constructor(config) {
    super(config);
    this.id = -1;
    this.toString = null;
  }

}

const classes = {
  ParsedNode: ParsedNode,
  SearchResult: SearchResult,
  Folder: Folder,
  Season: Season,
  Episode: Episode
};

module.exports = classes;

