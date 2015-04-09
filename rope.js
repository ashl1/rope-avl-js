/**
 * Based on source code:
 *  - component/rope: https://github.com/component/rope (MIT license)
 *  - google/closure-library (AvlTree): https://github.com/google/closure-library/blob/master/closure/goog/structs/avltree.js
 *       (Apache v2.0 license)
 */

(function(factory, root) {
    if (typeof define == "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(['lexer'], factory(lexer));
    } else if (typeof module != "undefined" && typeof exports == "object") {
        // Node/CommonJS style
        var lexer = module.import('lexer')
        module.exports = factory(lexer);
    } else {
        // No AMD or CommonJS support so we place Rangy in (probably) the global variable
        root.rope = factory(root.lexer);
    }
})(function() {
  
var RopeSPLIT_LENGTH = 1500;
var RopeJOIN_LENGTH = 1000;

function isDefined(arg) {
  if (typeof arg != 'undefined')
    return true;
  return false;
}

/*
 * This structure used for the Rope as:
 *  - (line, column) determined the symbol for external usage (info about position of symbol in the text)
 *     count - the number of symbol position started from 0
 *     line - the number of line started from 0
 *     column - the number of column, where symbol located in, started from 0 (the newline character caculated as last symbol)
 *  - (count, lines, symbolsLastLine) in internal usage (info about string)
 *     count - the number of all symbols in the string
 *     lines - the number of lines in the string (empty last line not included). It couldn't be less than 1
 *     symbolsLastLine - the number of symbols located in last line (include newline character)
 */

/*
Position.count = Range.count - 1
Position.line = Range.symbolsLastLine == 0? Range.line - 1: Range.line;
Position.column = Range.symbolsLastLine == 0? determineLastLineCount(): Range.symbolsLastLine - 1;
*/

RopePosition = function () {
  if (!(this instanceof RopePosition)) return new RopePosition(arguments);

  if (arguments.length == 1 && typeof arguments == 'object')
    arguments = arguments[0];

  if (arguments.length === 1) {
    if (arguments[0] instanceof RopePosition)
      return arguments[0]
    else if (typeof arguments[0] == 'string')
      return this._fromString(arguments[0])
    else if (typeof arguments[0] == 'number')
      return this._fromIndex(arguments[0])
  } else if (arguments.length === 2)
    return this._fromLineColumn(arguments[0], arguments[1]);
  else if (arguments.length === 3)
    return this._fromFull(arguments[0], arguments[1], arguments[2]);
}

RopePosition.prototype.concat = function (position) {
  if (typeof position == 'undefined')
    return this;
  return RopePosition(
    this.count + position.count,
    this.lines + position.lines - 1,
    position.symbolsLastLine + (position.lines == 1? this.symbolsLastLine: 0)
  )
}

/*RopePosition.prototype.convertToRange = function(){
  this.count -= 1;
  if (this.symbolsLastLine == 0) {
    this.line = Math.max(this.line - 1);
    this.symbolsLastLine = determineLastLineCount();
  } else {
    this.symbolsLastLine -= 1;
  }
}*/

RopePosition.prototype.determineInfo = function(ropeLeaf) {
  if (this._isDefinedCount()){
    if (this._isDefinedLinesColumn())
      // already ok
      return
    else {
      this.lines = 0;
      this.symbolsLastLine = 0;

      var newline = true;
      for (var i = 0; i < this.count; i+=1) {
        if (newline) {
          this.lines += 1;
          this.symbolsLastLine = 0;
          newline = false;
        } else
          this.symbolsLastLine += 1;
        if (ropeLeaf.value[i] == '\n')
          newline = true;
      }
      return;
    }
  } else { // count is not defined
    if (this._isDefinedLinesColumn()) {
      this.count = 0;
      for (var iLines = 1, iSymbols = 0; (iLines < this.lines) || ((iLines === this.lines) && (iSymbols <= this.symbolsLastLine)); this.count += 1) {
        if (ropeLeaf.value[this.count] == '\n') {
          iLines += 1;
          iSymbols = 0;
        } else
          iSymbols += 1;
      }
    }
    return;
  }
  throw Error('Can\'t determine necassary info due to lack information')
}

RopePosition.prototype._fromFull = function(index, lines, column) {
  var res = RopePosition();
  res.count = index;
  res.lines = lines;
  res.symbolsLastLine = column;
  return res;
}

RopePosition.prototype._fromIndex = function(index) {
  var res = RopePosition();
  res.count = index;
  return res;
}

RopePosition.prototype._fromLineColumn = function(lines, column) {
  var res = new RopePosition()
  res.lines = lines;
  res.symbolsLastLine = column;
  return res;
}

RopePosition.prototype._fromString = function(string) {
  var res = new RopePosition()
  res.count = string.length;
  res.lines = (string.match(/\n/g) || []).length + 1;
  res.symbolsLastLine = string.length - (string.lastIndexOf('\n') + 1);
  return res;
}

RopePosition.prototype._isDefinedCount = function(){
  return isDefined(this.count);
}

RopePosition.prototype._isDefinedLinesColumn = function(){
  return isDefined(this.lines) && isDefined(this.symbolsLastLine);
}

RopePosition.prototype.isLess = function(position) {
  // this is Range, position is Position

  if (this._isDefinedCount() && position._isDefinedCount()) {
    return this.count < position.count - 1;
  }

  if (this._isDefinedLinesColumn() && position._isDefinedLinesColumn()) {
    return this.lines < position.lines? true:
         this.lines == position.lines? this.symbolsLastLine < position.symbolsLastLine: false;
  }

  throw Error("RopePosition's don't contain the appropriate info")
}

RopePosition.prototype.isEqual = function(position) {
  var ok = false;
  if (this._isDefinedCount() && position._isDefinedCount())
    ok = this.count === position.count;

  if (this._isDefinedLinesColumn && position._isDefinedLinesColumn())
    ok = ok && (this.lines === position.lines) && (this.symbolsLastLine === position.symbolsLastLine)

  return ok;
}

/*RopePosition.prototype.isLessOrEqual = function(position) {
  return this.isLess(position) || this.isEqual(position);
}*/

RopePosition.prototype.split = function(positionSecond) {
  var left = RopePosition(), right = RopePosition();
  if (this._isDefinedCount() && positionSecond._isDefinedCount()) {
    left.count = positionSecond.count;
    right.count = this.count - positionSecond.count;
  }

  if (this._isDefinedLinesColumn() && positionSecond._isDefinedLinesColumn()) {
    left.lines = positionSecond.lines;
    right.lines = this.lines - positionSecond.lines + 1;
    left.symbolsLastLine = positionSecond.symbolsLastLine;
    right.symbolsLastLine = this.symbolsLastLine - (right.lines == 1? positionSecond.symbolsLastLine: 0);
  }

  return [left, right]
}

///////////////////////////////////////////////////////////////////////////////////////////
////////////                     RopeNode                                      ////////////
///////////////////////////////////////////////////////////////////////////////////////////

/*
 * RopeNode.
 * .height
 * .length
 * .left
 * .right
 * .parent
 * .value
 * .transitionTable
 * 
 */

/*
 * Assume the string length < RopeSPLIT_LENGTH
 */

RopeNode = function(string, lexer) {
  // allow usage without `new`
  if (!(this instanceof RopeNode)) return new RopeNode(string, lexer);

  this.lexer = lexer;
  this.height = 1;
  if (typeof string == 'string') {
    this.value = string;
    this.recalculate()
  }
}

/**
 * Adjusts the tree structure, so that very long nodes are split
 * and short ones are joined
 *
 * @api private
 */

RopeNode.prototype.adjust = function(){
  if (this.isLeaf()) {
    if (this.length.count > RopeSPLIT_LENGTH) {
      var divide = Math.floor(this.length.count / 2);
      this.setLeft(new RopeNode(this.value.substring(0, divide), this.lexer));
      this.setRight(new RopeNode(this.value.substring(divide), this.lexer));
      delete this.value;
      this.recalculate();
      this.balance(this);
    }
  } else if (this.height === 2){
    if (this.length.count < RopeJOIN_LENGTH) {
      this.value = this.left.toString() + this.right.toString();
      this.unsetLeft();
      this.unsetRight();
      this.recalculate();
      this.balance(this);
    }
  }
}

RopeNode.prototype.append = function(rope) {
  if (!rope)
    return this;

  var isLeftHigherOrEqual = this.height >= rope.height;
  var leftSubtree = this;
  var rightSubtree = rope;

  // find the same depth
  var levelsDiff = Math.abs(leftSubtree.height - rightSubtree.height)
  if (isLeftHigherOrEqual) {
    for (var i = 0; i < levelsDiff && leftSubtree.right; i+=1)
      leftSubtree = leftSubtree.right;
  } else { // right is higher
    for (var i = 0; i < levelsDiff && rightSubtree.left; i+=1)
      rightSubtree = rightSubtree.left;
  }

  var newNode = new RopeNode(null, this.lexer);
  if (isLeftHigherOrEqual) {
    if (leftSubtree.parent) leftSubtree.parent.setRight(newNode);
  } else { // right is higher
    rightSubtree.parent.setLeft(newNode);
  }
  newNode.setLeft(leftSubtree);
  newNode.setRight(rightSubtree);
  newNode.recalculate();
  newNode.balance(newNode)

  while (newNode.parent) {
    newNode = newNode.parent;
    newNode.recalculate();
  }
  return newNode;
}


/**
 * Ensures that the specified node and all its ancestors are balanced. If they
 * are not, performs left and right tree rotations to achieve a balanced
 * tree. This method assumes that at most 2 rotations are necessary to balance
 * the tree (which is true for AVL-trees that are balanced after each node is
 * added or removed).
 *
 * @param {goog.structs.AvlTree.Node<T>} node Node to begin balance from.
 * @private
 */
RopeNode.prototype.balance = function(node) {
  this.traverse(function(node) {
    // Calculate the left and right node's heights
    var lh = node.left ? node.left.height : 0;
    var rh = node.right ? node.right.height : 0;

    // Rotate tree rooted at this node if it is not AVL-tree balanced
    if (lh - rh > 1) {
      if (node.left.right && (!node.left.left ||
          node.left.left.height < node.left.right.height))
        this.leftRotate(node.left);
      this.rightRotate(node);
    } else if (rh - lh > 1) {
      if (node.right.left && (!node.right.right ||
          node.right.right.height < node.right.left.height))
        this.rightRotate(node.right);
      this.leftRotate(node);
    }

    // Traverse up tree and balance parent
    return node.parent;
  }, node);

};

RopeNode.prototype.checkHeights = function(){
  if (this.isLeaf()) {
    if (this.height === 1)
      return true;
    else
      throw Error('Bad height info')
  }

  var lh = 0, rh = 0;
  if (this.left) {
    this.left.checkHeights()
    lh = this.left.height;
  }
  if (this.right) {
    this.right.checkHeights()
    rh = this.right.height;
  }
  if (this.height == (Math.max(lh, rh) + 1))
    return true
  else
    throw Error('Bad height info')
}

RopeNode.prototype.checkLinks = function () {
  if (this.isLeaf())
    return true;

  if (this.left) {
    this.left.checkLinks()
    if (this.left.parent !== this)
      throw Error('Wrong link')
  }

  if (this.right) {
    this.right.checkLinks();
    if (this.right.parent !== this)
      throw Error('Wrong link')
  }

  return true;
}

RopeNode.prototype.checkPositions = function() {
  if (this.left)
    this.left.checkPositions()
  if (this.right)
    this.right.checkPositions()
  if (this.isLeaf()) {
    if (!this.length.isEqual(RopePosition(this.value)))
      throw Error("The length is wrong")
  } else { // not a leaf
    var newNode = RopeNode(null, this.lexer)
    newNode.left = this.left
    newNode.right = this.right
    newNode.recalculate()
    if (!newNode.length.isEqual(this.length))
      throw Error("The position is wrong")
  }
  return true;
}

RopeNode.prototype.getAbsolutePosition = function(relativePosition) {
  var curNode = this;
  while (curNode) {
    if (curNode.parent && !curNode.isLeftChild()) { // curNode is right child
      relativePosition = curNode.parent.left.length.concat(relativePosition)
    }
    curNode = curNode.parent;
  }
  return relativePosition;
}

RopeNode.prototype.getDot = function(prevPath, direction) {
  if (typeof prevPath == 'undefined')
    prevPath = ''
  if (typeof direction == 'undefined')
    direction = 'o'

  var curPath = prevPath + direction;

  if (this.isLeaf())
    return [prevPath, ' -> "', this.value, "\"\n"].join(''); 
  


  var s = [prevPath, ' -> ', curPath, "\n"].join('');
  if (this.left)
    s += this.left.getDot(curPath, 'l')
  if (this.right)
    s += this.right.getDot(curPath, 'r')
  return s;
}

/**
 * @param {int|RopePosition} indexOrPosition The absolute symbol index as if rope contains one big string OR The absolute position of symbol the return node must contain. This position may not define index of symbol because the search only use lines/column info
 * @return {{node: RopeNode, position: RopePosition, lexerState: int}} Always return RopePosition with full info
 */

RopeNode.prototype.getNode = function(indexOrPosition) {
  var position = RopePosition(indexOrPosition);
  var curNode = this;
  var lexerState = 0;
  
  // find the node to start from
  while (!curNode.isLeaf()) {
    if (curNode.left && position.isLess(curNode.left.length))
      curNode = curNode.left;
    else {
      if (!curNode.right)
        console.log(!curNode.right)
      position = position.split(curNode.left.length)[1];
      lexerState = curNode.left.transitionTable.table[lexerState];
      curNode = curNode.right;
    }
  }

  position.determineInfo(curNode);
  return {'node': curNode, 'position': position, 'lexerState': lexerState}
}


RopeNode.prototype.isLeaf = function() {
  return typeof this.value != 'undefined';
}

/**
 * Returns true iff the specified node has a parent and is the left child of
 * its parent.
 *
 * @return {boolean} Whether the specified node has a parent and is the left
 *    child of its parent.
 */
RopeNode.prototype.isLeftChild = function() {
  return !!this.parent && this.parent.left == this;
};

/**
 * Performs a left tree rotation on the specified node.
 *
 * @param {goog.structs.AvlTree.Node<T>} node Pivot node to rotate from.
 * @private
 */
RopeNode.prototype.leftRotate = function(node) {
  var oldNodeRight = node.right;

  // Re-assign parent-child references for the parent of the node being removed
  if (node.parent) {
    if (node.isLeftChild())
      node.parent.setLeft(oldNodeRight);
    else // is right child
      node.parent.setRight(oldNodeRight);
  } else {
    oldNodeRight.parent = null;
  }

  // Re-assign parent-child references for the child of the node being removed
  node.setRight(oldNodeRight.left);
  oldNodeRight.setLeft(node);
  
  node.recalculate();
  oldNodeRight.recalculate();
  if (oldNodeRight.parent) oldNodeRight.parent.recalculate();
};

RopeNode.prototype.recalculate = function() {
  var lh = this.left ? this.left.height : 0;
  var rh = this.right ? this.right.height : 0;
  this.height = Math.max(lh, rh) + 1;

  if (!this.isLeaf()) {
    if (this.left) {
      if (this.right) {
        this.length = this.left.length.concat(this.right.length)
        this.transitionTable = this.left.transitionTable.concat(this.right.transitionTable);
      }
      else { // only left
        this.length = this.left.length
        this.transitionTable = this.left.transitionTable;
      }
    } else { // only right
      this.length = this.right.length;
      this.transitionTable = this.right.transitionTable;
    }
  } else { // is leaf
    this.length = RopePosition(this.value)
    this.transitionTable = LexerTransitionTable(this.lexer, this.value)
  }
}

/**
 * Performs a right tree rotation on the specified node.
 *
 * @param {goog.structs.AvlTree.Node<T>} node Pivot node to rotate from.
 * @private
 */
RopeNode.prototype.rightRotate = function(node) {
  var oldNodeLeft = node.left;

  // Re-assign parent-child references for the parent of the node being removed
  if (node.parent) {
    if (node.isLeftChild())
      node.parent.setLeft(oldNodeLeft);
    else // is right child
      node.parent.setRight(oldNodeLeft);
  } else {
    oldNodeLeft.parent = null;
  }
  
  // Re-assign parent-child references for the child of the node being removed
  node.setLeft(oldNodeLeft.right);
  oldNodeLeft.setRight(node);
  
  node.recalculate();
  oldNodeLeft.recalculate();
  if (oldNodeLeft.parent) oldNodeLeft.parent.recalculate();
};

RopeNode.prototype.setLeft = function(ropeNode) {
  this.left = ropeNode;
  this.left.parent = this;
}

RopeNode.prototype.setRight = function(ropeNode) {
  this.right = ropeNode;
  this.right.parent = this;
}

/**
 * @param {int} indexSecond The absolute index of symbol, the second rope will be started from
 */

RopeNode.prototype.split = function(indexSecond) {
  if (indexSecond < 0 || !(indexSecond < this.length.count))
    throw RangeError('indexSecond is not within rope bounds')
  
  var left, right, res

  if (this.isLeaf()) {
    left = this.value.substr(0, indexSecond);
    left = left == ''? null: RopeNode(left, this.lexer);
    right = this.value.substr(indexSecond);
    right = right == ''? null: RopeNode(right, this.lexer);
    return [left, right]
  }

  if (this.left && (indexSecond < this.left.length.count)) { // go left
    right = this.right;
    this.unsetRight();
    res = this.left.split(indexSecond);
    left = res[0]
    if (res[1])
      right = res[1].append(right);
    else
      right.parent = null;
  } else { // else go_right
    left = this.left;
    this.unsetLeft();
    res = this.right.split(indexSecond - left.length.count);
    if (left)
      left = left.append(res[0])
    else
      left = res[0]
    right = res[1]
  }

  return [left, right]
}

RopeNode.prototype.toString = function() {
  if (this.isLeaf()) {
    return this.value;
  } else {
    return this.left.toString() + this.right.toString();
  }
}

/**
 * Performs a traversal defined by the supplied {@code traversalFunc}. The first
 * call to {@code traversalFunc} is passed the root or the optionally specified
 * startNode. After that, calls {@code traversalFunc} with the node returned
 * by the previous call to {@code traversalFunc} until {@code traversalFunc}
 * returns null or the optionally specified endNode. The first call to
 * traversalFunc is passed the root or the optionally specified startNode.
 *
 * @param {function(
 *     this:goog.structs.AvlTree<T>,
 *     !goog.structs.AvlTree.Node):?goog.structs.AvlTree.Node} traversalFunc
 * Function used to traverse the tree.
 * @param {goog.structs.AvlTree.Node<T>=} opt_startNode The node at which the
 *     traversal begins.
 * @param {goog.structs.AvlTree.Node<T>=} opt_endNode The node at which the
 *     traversal ends.
 * @private
 */
RopeNode.prototype.traverse = function(traversalFunc, opt_startNode, opt_endNode) {
  var node = opt_startNode ? opt_startNode : this.root_;
  var endNode = opt_endNode ? opt_endNode : null;
  while (node && node != endNode) {
    node = traversalFunc.call(this, node);
  }
};

RopeNode.prototype.unsetLeft = function() {
  if (!this.left) return;
  this.left.parent = null;
  this.left = null;
  this.recalculate();
}

RopeNode.prototype.unsetRight = function() {
  if (!this.right) return;
  this.right.parent = null;
  this.right = null;
  this.recalculate();
}

///////////////////////////////////////////////////////////////////////////////////////////
////////////                     Rope                                          ////////////
///////////////////////////////////////////////////////////////////////////////////////////

Rope = function(string, lexer) {
  if (!(this instanceof Rope)) return new Rope(string, lexer);

  if (isDefined(lexer))
    this.lexer = lexer;

  if (!string.length) {
    this.rope = new RopeNode('', lexer);
    return;
  }
  
  // make the tree from leafs to root
  var substrSize = Math.floor((RopeSPLIT_LENGTH + RopeJOIN_LENGTH) / 2)
  var nodesOnLevelCount = Math.ceil(string.length / substrSize);
  var nodesOnLevel = new Array(nodesOnLevelCount);
  var time = Date.now(), time2, startTime = time;
  console.log('start at \t\t\t' + time)
  for (var substrStart = 0, i = 0; substrStart < string.length; substrStart += substrSize, i += 1) {
    nodesOnLevel[i] = new RopeNode(string.substring(substrStart, substrStart + substrSize), lexer)
    time2 = Date.now()
    if (time2 - time >= 1000) {
      console.log((Math.floor(i / nodesOnLevelCount * 10000) / 100) + '% rope leafs proceeded for ' + (Math.round((time2 - time) / (1000 / 10)) / 10) + ' seconds')
      time = time2;
    }
  }
  time = startTime;
  
  time2 = Date.now()
  console.log('leafs created at \t' + time2 + '\t(' + (Math.round((time2 - time) / (1000 / 100)) / 100) + ' seconds)')
  time = time2
  while (nodesOnLevelCount > 1) {
    var i, newLevelCount = Math.floor(nodesOnLevelCount / 2);
    for (i = 0; i < newLevelCount; i += 1)
      nodesOnLevel[i] = nodesOnLevel[i * 2].append(nodesOnLevel[i * 2 + 1]);
    
    if (i * 2 + 1 === nodesOnLevelCount) { // the odd count of nodes
      nodesOnLevel[i] = nodesOnLevel[i*2];
      nodesOnLevelCount = newLevelCount + 1;
    } else
      nodesOnLevelCount = newLevelCount;
  }
  time2 = Date.now()
  console.log('finished at \t\t' + time2 + '\t(' + (time2 - time) + ' ms)')
  console.log('==========================')
  this.rope = nodesOnLevel[0]
}

/*
 * @return {number} The character index started from 0 (not as count, started from 1)
 */

Rope.prototype._getIndexFromPosition = function(indexOrPosition, defaultValue) {
  if (!isDefined(indexOrPosition))
    return defaultValue;

  if (typeof indexOrPosition == 'number')
    // this is index
    return indexOrPosition;
  var target = this.rope.getNode(indexOrPosition);
  return target.node.getAbsolutePosition(target.position).count - 1;
}

// ASSUME: position has 'line' and 'symbolsLastLine' (column) properties

Rope.prototype._isPositionInBounds = function(position) {
  if (position instanceof RopePosition)
    return  (position.lines <= this.rope.length.lines) && (position.symbolsLastLine < this.getLineLength(position.lines) + 1)
  // assume position is index [number]
  return position >= 0 && position <= this.rope.length.count;
}

Rope.prototype.getLexems = function(startPosition, endPosition) {
  if (!this._isPositionInBounds(startPosition))
    return [];
  return this.lexer.getLexems(this.substr(startPosition, endPosition), this._getLexerState(startPosition));
}

Rope.prototype._getLexerState = function(position) {
  var node = this.rope.getNode(position);
  var position = node.position;
  var lexerState = node.lexerState;
  node = node.node;

  return this.lexer.getLastState(node.value.substring(0, position.count - 1), lexerState);
}


/**
 * @return {int} Count of the symbols in the line (without last newline)
 */

Rope.prototype.getLineLength = function (lineIndex) {
  if (lineIndex > this.rope.length.lines)
    return 0;
  
  var startIndex = this._getIndexFromPosition(RopePosition(lineIndex, 0));
  var endIndex;
  if (lineIndex == this.rope.length.lines)
    endIndex = this.rope.length.count;
  else
    endIndex = this._getIndexFromPosition(RopePosition(lineIndex + 1, 0)) - 1;
  return endIndex - startIndex;
}

Rope.prototype.getLinesCount = function () {
  return this.rope.length.lines;
}

Rope.prototype.insert = function(startPosition, stringOrRope) {
  if (typeof stringOrRope == 'string' && stringOrRope.length < RopeSPLIT_LENGTH) {
    var node = this.rope.getNode(startPosition);
    var position = node.position;
    var node = node.node;
    node.value = node.value.substring(0, position.count - 1) + stringOrRope + node.value.substring(position.count - 1);
    node.recalculate();
    node.adjust();
  } else {
    var startIndex = this._getIndexFromPosition(startPosition);
    var split = this.rope.split(startIndex);
    this.rope = RopeNode(stringOrRope, this.lexer).append(split[1]);
    if (split[0])
      this.rope = split[0].append(this.rope)
  }
}

Rope.prototype.remove = function(startPosition, endPosition) {
  var startNode = this.rope.getNode(startPosition);
  var endNode = this.rope.getNode(endPosition);
  if (startNode.node === endNode.node) {
    startPosition = startNode.position;
    endPosition = endNode.position;
    startNode = startNode.node;
    startNode.value = startNode.value.substring(0, startPosition.count - 1) + startNode.value.substring(endPosition.count);
    startNode.recalculate();
    startNode.parent.adjust();
  } else {
    var startIndex = this._getIndexFromPosition(startPosition);
    var endIndex = this._getIndexFromPosition(endPosition);
    // FIXME: determine can we join two leafs in the break
    var split = this.rope.split(startIndex);
    var split2 = split[1].split(endIndex - startIndex + 1);
    if (split[0])
      this.rope = split[0].append(split2[1]);
    else {
      if (split2[1])
        this.rope = split2[1]
      else
        this.rope = RopeNode("", this.lexer)
    }
  }
}

/*
 * @return The substring. If endPosition has column > line length, include the newline character to the extracted substring
 */

Rope.prototype.substr = function(startPosition, endPosition) {
  startPosition = isDefined(startPosition)? startPosition: 0;
  endPosition = isDefined(endPosition)? endPosition: this.rope.length.count;

  // ASSUME: startPosition and endPosition are on the same line and endPosition >= startPosition.
  //   In other case, the logic of determine if position not in bounds will be wrong
  if (!this._isPositionInBounds(startPosition))
    return "";
  else { // has first symbols
    if (!this._isPositionInBounds(endPosition))
      endPosition = endPosition instanceof RopePosition?
        RopePosition(endPosition.lines, this.getLineLength(endPosition.lines)):
        this.rope.length.count;
  }
  
  var startNode = this.rope.getNode(startPosition);
  var endNode = this.rope.getNode(endPosition);

  if (startNode.node === endNode.node)
    return startNode.node.value.substring(startNode.position.count - 1, endNode.position.count)
  
  var str = new Array();
  str.push(startNode.node.value.substring(startNode.position.count - 1));

  
  this._traverseLeafs(startNode.node, endNode.node, function(leaf){
    if (leaf !== startNode.node && leaf !== endNode.node)
      str.push(leaf.value);
  })
  str.push(endNode.node.value.substring(0, endNode.position.count))

  return str.join('')
}

/*
 * @param startNode The start leaf
 * @param endNode The end leaf
 */

Rope.prototype._traverseLeafs = function(startNode, endNode, func) {
  this._traverseNodes(startNode, endNode, function(node){
    if (node.isLeaf)
      func(node)
  });
}

/*
 * Traverse nodes from the deepest levels to highest, from left to right in level
 */

Rope.prototype._traverseNodes = function(startNode, endNode, func) {
    var prevNode = startNode;
  var curNode = startNode;
  var temp;

  while (curNode != endNode) {
    if (curNode.left && prevNode !== curNode.left && prevNode !== curNode.right)
      curNode = curNode.left;
    else {
      temp = curNode;
      if (curNode.right && prevNode != curNode.right)
        curNode = curNode.right;
      else {
        func(curNode);
        curNode = curNode.parent;
      }
      prevNode = temp;
    }
  }
}

Rope.prototype.getDot = function() {
  return this.rope.getDot() 
}

return {
  Rope: Rope,
  RopePosition: RopePosition,
}

}, this);