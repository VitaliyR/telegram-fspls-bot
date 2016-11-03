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
          str += `s${leaf.numberString}`;
          break;
        case 'episode':
          str += `e${leaf.numberString}`;
          break;
        default:
          break;
      }

      return str;
    }, '');
  }

  toString() {
    return this.filter(leaf => leaf.toString).map(leaf => leaf.toString()).join(',');
  }

  /**
   * @constructor
   * @param {Array.<ParsedNode>|String} [tree=]
   * @returns {HistoryTree}
   */
  constructor(tree) {
    super();

    switch (typeof tree) {
      case 'string':
        this.parse(tree);
        break;
      case 'object':
        this.push.apply(this, tree);
        break;
    }

    return this;
  }

  parse(tree) {
    this.clear();

    tree.split(',').forEach((leaf, i) => {
      this[i] = fsClasses.ParsedNode.unString(leaf);
      let prevNode = this[i - 1];
      if (prevNode) {
        prevNode.data.push(this[i]);
      }
    });
  }

  /**
   * Clears history tree
   */
  clear() {
    this.length = 0;
  }

  /**
   * Array.Prototype.Map applied to this tree
   * @param {Function} fn
   * @param {Object} [ctx=this]
   */
  rebuild(fn, ctx) {
    ctx = ctx || this;
    this.forEach((l, i) => {
      this[i] = fn.call(ctx, l, i);
    }, ctx);
    return this;
  }

  prepend(el) {
    this.splice(0, 0, el);
    return this;
  }

}

module.exports = HistoryTree;
