// prototype 拡張を行なう関数など

// 継承を行なう関数 (getter, setter 対応)
Object.extend = function() {
  var base = arguments[0];
  Array.slice(arguments, 1).forEach(
    function(obj) {
      for (let key in obj) {
        if (!obj.hasOwnProperty(key))
          continue;
        var g = obj.__lookupGetter__(key),
            s = obj.__lookupSetter__(key);
        if (g) base.__defineGetter__(key, g);
        if (s) base.__defineSetter__(key, s);
        if (!g && !s) base[key] = obj[key];
      }
    });
  return base;
};

Object.extend(
  Array.prototype,
  {
    include: function(x) this.indexOf(x) != -1,
    partition : function(fun, thisp) {
      if (typeof fun != 'function')
        throw new TypeError();

      var res1 = [], res2 = [];
      for (var i = 0, len = this.length; i < len; i++) {
        if (i in this) {
          if (fun.call(thisp, this[i], i, this))
            res1.push(this[i]);
          else
            res2.push(this[i]);
        }
      }
      return [res1, res2];
    },
    // DOM要素を結合する。引数はScalaのmkString風
    joinDOM: function() {
      var [sep, head, tail] = [null, null, null],
      arg = Array.map(arguments, Object.toDOM);

      switch(arg.length) {
      case 0: break;
      case 1: [sep] = arg; break;
      case 3: [head, sep, tail] = arg; break;
      default: throw new Error('invalid arguments');
      }

      var df = document.createDocumentFragment();
      function append(e, clone) {
        if (e !== null) df.appendChild(clone ? e.cloneNode(true) : e);
      }

      append(head);
      for (let [i, elem] in Iterator(this)) {
        if (i > 0) append(sep, true);
        append(Object.toDOM(elem));
      }
      append(tail);

      return df;
    }
  });

Object.extend(
  Function.prototype,
  {
    bind: function() {
      var self = this,
      obj = Array.shift(arguments),
      args = Array.slice(arguments);
      return function() self.apply(obj, args.concat(Array.slice(arguments)));
    },
    // 非同期処理を同期処理っぽく書く
    // http://d.hatena.ne.jp/amachang/20080303/1204544340
    go: function() {
      var g = this(function(t) { try { g.send(t); } catch (e) {} });
      g.next();
    }
  });

Object.extend(
  Number.prototype,
  {
    roundBetween: function(min, max) {
      if (this < min)
        return min;
      if (this > max)
        return max;
      return this;
    },
    chooseRange: function(len, minBound, maxBound) {
      if (minBound === undefined)
        minBound = Number.NEGATIVE_INFINITY;
      if (maxBound === undefined)
        maxBound = Number.POSITIVE_INFINITY;

      var min = this - Math.floor((len - 1) / 2);
      if (min < minBound)
        min = minBound;
      var max = min + (len - 1);
      if (max > maxBound) {
        min -= (max - maxBound);
        max = maxBound;
      }
      if (min < minBound)
        min = minBound;

      return [min, max];
    }
  });

// XML (E4X)からDOM Nodeへの変換
default xml namespace = "http://www.w3.org/1999/xhtml";
(function() {
   var parser = new DOMParser(),
       range = document.createRange();

   function toDOM(xmlns) {
     var pretty = XML.prettyPrinting;

     // 余分な空白を混入させないように，prettyPrintingを一時的に無効にする
     XML.prettyPrinting = false;
     var doc = parser.parseFromString(
       '<root xmlns="' + xmlns + '">' + this.toXMLString() + "</root>",
       "application/xml");
     XML.prettyPrinting = pretty;

     range.selectNodeContents(
       document.importNode(doc.documentElement, true));
     var fragment = range.extractContents();
     return fragment.childNodes.length > 1 ? fragment : fragment.firstChild;
   };

   XML.prototype.function::toDOM = toDOM;
   XMLList.prototype.function::toDOM = toDOM;
 })();

Object.extend(
  Object,
  {
    // 任意のオブジェクトをDOMノードに変換する
    toDOM: function(obj) {
      if (obj === null)
        return null;
      if (obj instanceof String || typeof obj === 'string')
        return document.createTextNode(obj);
      if (obj instanceof XML)
        return obj.toDOM();
      if (obj instanceof Array)
        return obj.joinDOM();
      return obj;
    },
    // オブジェクトのイテレータ
    forEach: function(obj, fun) {
      for (key in obj)
        if (obj.hasOwnProperty(key))
          fun(obj[key], key, obj);
    },
    clone: function(obj) {
      var clone = {};
      for (let key in obj) {
        if (!obj.hasOwnProperty(key))
          continue;
        var g = obj.__lookupGetter__(key),
            s = obj.__lookupSetter__(key);
        if (g) clone.__defineGetter__(key, g);
        if (s) clone.__defineSetter__(key, s);
        if (!g && !s) clone[key] = obj[key];
      }
      return clone;
    },
    memoizePrototype : function(obj, defs) {
      Object.forEach(
        defs,
        function(getter, key) {
          obj.__defineGetter__(
            key, function() {
              var val = getter.call(this);
              this.__defineGetter__(key, function() val);
              return val;
            });
        });
    },
    memoize: function(obj, defs) {
      Object.forEach(
        defs,
        function(getter, key) {
          obj.__defineGetter__(
            key, function() {
              delete this[key];
              return this[key] = getter.call(this);
            });
        });
    }
  });
