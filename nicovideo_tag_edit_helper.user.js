// ==UserScript==
// @name           nicovideo Tag Edit Helper
// @namespace      http://d.hatena.ne.jp/gifnksm/
// @description    Help you edit tags of nicovideo's movies.
// @include        http://www.nicovideo.jp/watch/*
// @include        http://tw.nicovideo.jp/watch/*
// @include        http://de.nicovideo.jp/watch/*
// @include        http://es.nicovideo.jp/watch/*
// @resource       style http://github.com/gifnksm/nicovideo-tag-edit-helper/raw/master/style.css
// ==/UserScript==

const DEBUG = false;
const AUTO_START = DEBUG && true;


// console.log のエラーを抑制する
const console =
  DEBUG && unsafeWindow.console !== undefined
  ? unsafeWindow.console
  : {__noSuchMethod__: function() {} };



// prototype拡張
Array.prototype.include = function(x) this.indexOf(x) != -1;
Array.prototype.partition = function(fun, thisp) {
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
};

// DOM要素を結合する。引数はScalaのmkString風
Array.prototype.joinDOM = function() {
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
};

Function.prototype.bind = function() {
  var self = this,
      obj = Array.shift(arguments),
      args = Array.slice(arguments);
  return function() self.apply(obj, args.concat(Array.slice(arguments)));
};

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

// オブジェクトをDOMノードに変換する
Object.toDOM = function(elem) {
  if (elem === null)
    return null;
  if (elem instanceof String || typeof elem === 'string')
    return document.createTextNode(elem);
  if (elem instanceof XML)
    return elem.toDOM();
  if (elem instanceof Array)
    return elem.joinDOM();
  return elem;
};
Object.forEach = function(obj, fun) {
  for (key in obj)
    if (obj.hasOwnProperty(key))
      fun(obj[key], key, obj);
};
Object.clone = function(obj) {
  var clone = {};
  for (let key in obj) {
    if (!obj.hasOwnProperty(key))
      continue;
    var g = obj.__lookupGetter__(key), s = obj.__lookupSetter__(key);
    if (g) clone.__defineGetter__(key, g);
    if (s) clone.__defineSetter__(key, s);
    if (!g && !s) clone[key] = obj[key];
  }
  return clone;
};
Object.extend = function() {
  var base = arguments[0];
  Array.slice(arguments, 1).forEach(
    function(obj) {
      for (let key in obj) {
        if (!obj.hasOwnProperty(key))
          continue;
        var g = obj.__lookupGetter__(key), s = obj.__lookupSetter__(key);
        if (g) base.__defineGetter__(key, g);
        if (s) base.__defineSetter__(key, s);
        if (!g && !s) base[key] = obj[key];
      }
    });
  return base;
};
Object.memoizePrototype = function(obj, defs) {
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
};
Object.memoize = function(obj, defs) {
  Object.forEach(
    defs,
    function(getter, key) {
      obj.__defineGetter__(
        key, function() {
          delete this[key];
          return this[key] = getter.call(this);
        });
    });
};

function evt(name) 'GM_NicovideoTagEditHelper_' + name;
function cls() Array.map(
  arguments,
  function(n) '_GM_tag_edit_helper_' + n
).join(' ');

GM_addStyle(
  GM_getResourceText('style').replace(/__(.+?)__/g, function(_, name) cls(name)));

function setClass(elem, name, flag) {
  if (flag)
    elem.classList.add(name);
  else
    elem.classList.remove(name);
}

function range(a, b) { for (let i = a; i < b; i++) yield i; }

var HTMLUtil = {
  commandLink: function(text, command) {
    var l = <a href="javascript: void(0);">{text}</a>.toDOM();
    l.addEventListener('click', command, false);
    return l;
  },
  toggleLink: function(text, command, initial) {
    var value = Boolean(initial);
    return this.commandLink(
      text,
      function(e) {
        value = !value;
        command.call(this, value, e);
      });
  },
  propertyToggler: function(text, obj, propName) {
    return this.toggleLink(
      text,
      function(value) { obj[propName] = value; },
      obj[propName]
    );
  }
};

// スクリプト本体

const VideoID = unsafeWindow.Video.id;
const DomainNames = ['jp', 'tw', 'es', 'de'];
const DomainLabels = { jp: '日本', tw: '台灣', es: 'スペイン', de: 'ドイツ' };
const DomainHosts = {
  jp: 'http://www.nicovideo.jp/',
  tw: 'http://tw.nicovideo.jp/',
  es: 'http://es.nicovideo.jp/',
  de: 'http://de.nicovideo.jp/'
};
const SelectedDomain = (
  function() {
    if (/^www/.test(location.host)) return 'jp';
    if (/^tw/.test(location.host)) return 'tw';
    if (/^es/.test(location.host)) return 'es';
    if (/^de/.test(location.host)) return 'de';
    return null;
  })();
const TagEditLoadingStatus = {
  jp: {
    'add': '追加中…',
    'remove': '削除中…',
    'lock': 'ロック設定中…',
    'set_category': 'カテゴリ設定中…',
    'unset_category': 'カテゴリ解除中…'
  },
  tw: {
    'add': '追加中…',
    'remove': '刪除中…',
    'lock': '加密設定中…'
  },
  es: {
    'add': 'Agregando',
    'remove': 'Eliminar',
    'lock': 'Cerrado el interior'
  },
  de: {
    'add': 'Hinzufu"gen',
    'remove': 'Entfernen',
    'lock': 'Gesperrt innen'
  }
};
const CountDownMessage = {
  jp: function(c) { return '　あと ' + c + ' 秒'; },
  tw: function(c) { return '　還剩 ' + c + ' 秒'; },
  es: function(c) { return '　Despue\'s de ' + c + ' S'; },
  de: function(c) { return 'Sekunden nach dem ' + c; }
};
const CategoryTags = {
  jp: [
    "エンターテイメント 音楽 スポーツ",
    "動物 料理 日記 自然 科学 歴史 ラジオ ニコニコ動画講座",
    "政治",
    "歌ってみた 演奏してみた 踊ってみた 描いてみた ニコニコ技術部",
    "アニメ ゲーム",
    "アイドルマスター 東方 VOCALOID 例のアレ その他",
    "R-18"
  ].join(' ').split(/\s+/),
  tw: [
    "\u5a1b樂 音樂 運動",
    "動物 料理 日記 自然 科學 \u6b77史 廣播電台 NICO動畫講座",
    "政治",
    "試唱 試奏 試跳 試畫 NICO技術部",
    "動漫 遊戲",
    "偶像大師 東方 VOCALOID 就是那個 其他",
    "成人級"
  ].join(' ').split(/\s+/),
  es: [
    "Entretenimiento Mu\u00fasica Deportes",
    "Animales Cocina Diario Naturaleza Ciencia Historia Radio Curso_Niconico",
    "Gobierno",
    "Canto Concierto Danza 描いてみた ニコニコ技術部",
    "Anime Juegos",
    "アイドルマスター 東方 VOCALOID 例のアレ その他",
    "M\u00e1s_de_18_a\u00f1os"
  ].join(' ').split(/\s+/),
  de: [
    "Musik Unterhaltung Sport",
    "Tiere Kochen Tagebuch Natur Naturwissenschaft Geschichte Radio NICO_Einf\u00fchrung",
    "Politik",
    "Mal_gesungen Mal_musiziert Mal_getanzt 描いてみた ニコニコ技術部",
    "Anime Spiele",
    "アイドルマスター 東方 VOCALOID 例のアレ その他",
    "R-18"
  ].join(' ').split(/\s+/)
};

var CountDownTimer = function(limit, tick) {
  if (tick === undefined || tick === 0 || tick >= limit) {
    this.start = this._startTimeout;
    this.stop = this._stopTimeout;
  } else {
    this.start = this._startInterval;
    this.stop = this._stopInterval;
  }
  this._limit = limit;
  this._tick = tick;
};
CountDownTimer.prototype = {
  _timer: null,
  _startTimeout: function() {
    this._timer = setTimeout(this.ontimeout.bind(this), this._limit);
  },
  _startInterval: function() {
    if (this._timer !== null)
      return;
    var now = function () { return (new Date()).getTime(); };
    var next = now() + this._limit;
    this._timer = setInterval(
      function() {
        var d = next - now();
        if (d > 0) {
          this.ontick(d);
          return;
        }
        this.stop();
        this.ontimeout();
      }.bind(this), this._tick);
  },
  start: null,
  _stop: function(stopFun) {
    if (this._timer === null) return;
    stopFun(this._timer);
    this._timer = null;
  },
  _stopTimeout: function() { this._stop(clearTimeout); },
  _stopInterval: function() { this._stop(clearInterval); },
  stop: null,
  ontimeout: function() {},
  ontick: function() {}
};

var Pager = function Pager(items) {
  this._element = <div class={Pager.ClassNames.Pager}/>.toDOM();
  this.items = items || [];
};
Pager.ClassNames = {
  Pager: cls('pager'),
  Pager1: cls('pager1'),
  Pager10: cls('pager10'),
  Pager100: cls('pager100'),
  Pager1000: cls('pager1000'),
  PageLink: cls('page-link'),
  Disable: cls('disable-page'),
  Highlight: cls('highlight-page')
};
Pager.PageChangedEvent = evt('PageChanged');
Pager.prototype = {
  _currentPage: -1,
  get currentPage() { return this._currentPage; },
  _element: null,
  get element() { return this._element; },
  _itemsPerPage: 5,
  get itemsPerPage() { return this._itemsPerPage; },
  set itemsPerPage(value) {
    this._itemsPerPage = value;
    this._update();
    return this._itemsPerPage;
  },
  _maxShowPage: 10,
  get maxShowPage() { return this._maxShowPage;},
  set maxShowPage(value) {
    this._maxShowPage = value;
    this._update();
    return this._maxShowPage;
  },
  _items: null,
  get items() { return this._items; },
  set items(value) {
    this._items = value;
    this._update();
    return this._items;
  },
  get currentItems() { return this._pages[this.currentPage]; },
  _pages: null,
  _links: null,
  _update: function() {
    this.element.textContent = '';
    var c = Pager.ClassNames,
        len = this._items.length,
        plen = Math.ceil(len / this.itemsPerPage);

    if (plen == 0)
      plen = 1;

    let (classes = [c.Pager1, c.Pager10, c.Pager100, c.Pager1000]) {
      for each (let [, cp] in Iterator(classes))
        this._element.classList.remove(cp);
      let (order = Math.floor(Math.log(plen) / Math.LN10))
        this._element.classList.add(classes[order < 3 ? order : 3]);
    };

    let (ipp = this.itemsPerPage)
      this._pages = [
        this._items.slice(ipp*p, ipp*(p+1)) for (p in range(0, plen)) ];

    this._links = this._pages.map(
      function(_, p) {
        var l = HTMLUtil.commandLink(p+1, this.goTo.bind(this, p));
        l.classList.add(c.PageLink);
        return l;
      }, this);

    this.element.appendChild(
      this._links.joinDOM([this._prevLink, ' '], ' ', [' ', this._nextLink]));
    this._currentPage = -1;
    this.goTo(0);
  },
  prev: function() { this.goTo(this.currentPage - 1); },
  next: function() { this.goTo(this.currentPage + 1); },
  goTo: function(page) {
    var last = this._pages.length - 1;
    page >>= 0;
    if (page < 0) {
      page = 0;
    } else if (page > last) {
      page = last;
    }

    if (this._currentPage == page)
      return;
    this._currentPage = page;

    var minIdx = page - Math.floor((this.maxShowPage - 1) / 2);
    if (minIdx < 0) minIdx = 0;
    var maxIdx = minIdx + this.maxShowPage - 1;
    if (maxIdx > last) {
      minIdx -= (maxIdx - last);
      maxIdx = last;
    }

    let (c = Pager.ClassNames) {
      setClass(this._prevLink, c.Disable, page == 0);
      setClass(this._nextLink, c.Disable, page == last);
      this._links.forEach(
        function(l, i) {
          setClass(l, c.Highlight, i == page);
          l.style.display = (i < minIdx || i > maxIdx) ? 'none' : '';
        });
    };

    var ev = document.createEvent('Event');
    ev.initEvent(Pager.PageChangedEvent, true, false);
    this.element.dispatchEvent(ev);
  }
};
Object.memoizePrototype(
  Pager.prototype, {
    _prevLink: function() {
      return HTMLUtil.commandLink('\xab', this.prev.bind(this));
    },
    _nextLink: function() {
      return HTMLUtil.commandLink('\xbb', this.next.bind(this));
    }
});


var Tab = function() {
  this._items = {};
  this._selector = <div class={Tab.ClassNames.Tab}/>.toDOM();
};
Tab.ClassNames = {
  Tab: cls('tab-tab')
};
Tab.SelectedChangedEvent = evt('SelectedChanged');
Tab.prototype = {
  _currentItem: null,
  get currentItem() { return this._currentItem; },
  _selector: null,
  get selector() { return this._selector; },
  _items: null,
  add: function(name, item) {
    this._items[name] = item;
    item.container = this;
    this.selector.appendChild(item.label);
  },
  get: function(name) { return this._items[name] || null; },
  getName: function(item) {
    for (let key in this._items) {
      if (this._items.hasOwnProperty(key) && this._items[key] === item)
        return key;
    }
    return null;
  },
  remove: function(name) {
    if (name instanceof TabItem)
      name = this.getName(name);
    if (!(name in this._items))
      return null;

    let item = this._items[name];
    item.container = null;
    delete this._items[name];
    this.selector.removeChild(item.label);
    return item;
  },
  show: function(name) {
    if (name instanceof TabItem)
      name = this.getName(name);
    if (!(name in this._items) || this._currentItem == name)
      return;
    this._currentItem = name;

    Object.forEach(this._items,
                   function(e, n) {
                     if (n === name)
                       e.show();
                     else
                       e.hide();
                   });

    var ev = document.createEvent('Event');
    ev.initEvent(Tab.SelectedChangedEvent, true, false);
    this.selector.dispatchEvent(ev);
  }
};
var TabItem = function() {};
TabItem.ClassNames = {
  Element: cls('tab-item'),
  Selected: cls('tab-selected'),
  Loaded: cls('tab-loaded'),
  Loading: cls('tab-loading'),
  Waiting: cls('tab-waiting'),
  Error: cls('tab-error'),
  Timer: cls('tab-timer')
};
TabItem.State = {
  Initial: 'initial',
  Waiting: 'waiting',
  Loading: 'loading',
  Loaded: 'loaded',
  Error: 'error'
};
TabItem.prototype = {
  container: null,
  init: function(label, element) {
    this._label = HTMLUtil.commandLink(
      label,
      function() {
        if (this.container) this.container.show(this);
      }.bind(this)
    );
    this._element = element;
    element.classList.add(TabItem.ClassNames.Element);
  },
  _label: null,
  get label() { return this._label; },
  _element: null,
  get element() { return this._element; },
  _state: TabItem.State.Initial,
  get state() { return this._state; },
  set state(state) {
    var cl = this._label.classList, c = TabItem.ClassNames, s = TabItem.State;
    for each (let [,name] in Iterator([c.Waiting, c.Loading, c.Loaded, c.Error])) {
      cl.remove(name);
    }
    switch(state) {
    case s.Initial: break;
    case s.Waiting: cl.add(c.Waiting); break;
    case s.Loading: cl.add(c.Loading); break;
    case s.Loaded:  cl.add(c.Loaded);  break;
    case s.Error:   cl.add(c.Error);   break;
    default: throw new Error('invalid state');
    }
    this._state = state;
  },
  get waiting() { return this.state === TabItem.State.Waiting; },
  get loading() { return this.state === TabItem.State.Loading; },
  get loaded() { return this.state  === TabItem.State.Loaded; },
  get error() { return this.state   === TabItem.State.Error; },
  clearCache: function() { this.state = TabItem.State.Initial; },
  show: function() {
    if (!this.loaded) {
      this._createContent();
    }
    this._label.classList.add(TabItem.ClassNames.Selected);
    this.element.style.display = '';
  },
  hide: function() {
    this._label.classList.remove(TabItem.ClassNames.Selected);
    this.element.style.display = 'none';
  }
};
var DomainTab = function(domain) {
  this.init(
      <>
        {DomainTab.getDomainImage(domain)}
        {DomainLabels[domain]}
      </>,
      <div class={cls(domain)}/>.toDOM());
  this.domain = domain;
  this._url = DomainHosts[domain] + 'tag_edit/' + VideoID;
};
DomainTab.getDomainImage = function(domain) {
  return <img src={'http://tw.nicovideo.jp/img/images/ww_'+domain+'.gif'} alt=''/>;
};
DomainTab.LoadDelay = 3000;
DomainTab.HTMLs = {
  Loading: '<img src="img/watch/tool_loading.gif" alt="処理中">',
  Error: '<p style="color: #cc0000; padding: 4px;">通信エラー</p>'
};
DomainTab.prototype = Object.extend(
  new TabItem(),
  {
    domain: null,
    tags: null,
    _url: null,
    _createContent: function() { this.reload(''); },
    reload: function(data, delay, callback)  {
      if (data === undefined) data = '';
      if (delay === undefined) delay = 0;

      var e = this.element;
      e.innerHTML = DomainTab.HTMLs.Loading;
      this.state = TabItem.State.Waiting;
      this.tags = null;

      var timer = <span class={TabItem.ClassNames.Timer}/>.toDOM();
      this.label.appendChild(timer);
      let (cd = new CountDownTimer(delay, 300)) {
        cd.ontick = function(d) {
          if (d > 0) timer.textContent = '['+Math.ceil(d/1000)+']';
        };
        cd.ontick(delay);
        cd.ontimeout = function() {
          this.label.removeChild(timer);
          this.state = TabItem.State.Loading;
          this._startLoading(data, callback);
        }.bind(this);
        cd.start();
      };
    },
    _startLoading: function(data, callback) {
      GM_xmlhttpRequest({
        method: 'POST',
        url: this._url,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        data: data,
        onload: function(response) {
          this.element.innerHTML = response.responseText;
          var success = this.parse();
          if (success)
            this.state = TabItem.State.Loaded;
          else
            this.state = TabItem.State.Error;
          if (typeof callback === 'function')
            callback(this, success);
        }.bind(this),
        onerror: function(response) {
          this.state = TabItem.State.Error;
          this.element.innerHTML = DomainTab.HTMLs.Error;
          if (typeof callback === 'function')
            callback(this, false);
        }.bind(this)
      });
    },
    parse: function() {
      // 子要素が唯一でP要素なら読み込みエラー (混雑中)
      if (this.element.firstElementChild.nodeName == 'P'
          && this.element.childElementCount == 1)
        return false;
      var rows = this.element.querySelectorAll(
        'div > table[summary=""] > tbody > tr:nth-of-type(odd)');
      this.tags = Array.map(
        rows, function(tr) {
          var tag = {};
          tag.name = tr.querySelector('td:first-child').firstChild.textContent;
          tag.deleted = false;
          let (submit = tr.querySelectorAll('input[type="submit"]')) {
            tag.canLock = submit.length > 1;
            tag.canCategorize = tag.canLock
              && CategoryTags[this.domain].include(tag.name);
          };
          var [star, domain] = Array.prototype.partition.call(
            tr.querySelectorAll('td:first-child > span'),
            function(span) span.textContent === '★'
          );
          tag.locked = star.length > 0;
          if (domain.length > 0) {
            tag.domain = domain[0].textContent.replace(/\[|\]/g, '');
          } else {
            tag.domain = this.domain;
          }
          tag.category = tr.querySelector('td:first-child > strong') != null;
          return tag;
        }, this);
      return true;
    }
  });

var Tag = function(data) {
  this.name = data.name;
  this.domain = data.domain;
  this.canLock = data.canLock;
  this.canCategorize = data.canCategorize;
  this._locked = data.locked;
  this._category = data.category;
  this._deleted = data.deleted;
};
Tag.Classes = {
  Element: cls('tag'),
  Name: cls('tag-name'),
  Locked: cls('tag-locked'),
  LockedMark: cls('tag-locked-mark'),
  LockToggle: cls('tag-lock-toggle'),
  Category: cls('tag-category'),
  CategoryMark: cls('tag-category-mark'),
  CategoryToggle: cls('tag-category-toggle'),
  Deleted: cls('tag-deleted'),
  DeleteToggle: cls('tag-delete-toggle')
};
Tag.prototype = {
  _locked: null,
  get locked() { return this._locked; },
  set locked(value) {
    this._locked = value;
    this._updateClass();
  },
  _category: null,
  get category() { return this._category; },
  set category(value) {
    this._category = value;
    this._updateClass();
  },
  _deleted: null,
  get deleted() { return this._deleted; },
  set deleted(value) {
    this._deleted = value;
    this._updateClass();
  },
  _updateClass: function() {
    if (this._element === null)
      return;
    setClass(this.element, Tag.Classes.Locked, this.locked);
    setClass(this.element, Tag.Classes.Category, this.category);
    setClass(this.element, Tag.Classes.Deleted, this.deleted);
  },
  _element: null,
  get element() {
    if (this._element !== null)
      return this._element;

    var e = <nobr class={Tag.Classes.Element}/>.toDOM(), children = [];

    if (this.canLock || !this.locked)
      children.push(this._deleteToggle);

    children.push(this._nameElement);

    if (this.canLock) {
      children.push(this._lockToggle);
    } else if (this.locked) {
      children.push(this._lockedElement);
    }

    if (this.canCategorize) {
      children.push(this._categoryToggle);
    } else if (this.category) {
      children.push(this._categoryElement);
    }

    e.appendChild(children.joinDOM());

    this._element = e;
    this._updateClass();
    return e;
  }
};
Object.memoizePrototype(
  Tag.prototype, {
    _nameElement: function() {
      return <span class={Tag.Classes.Name}>{this.name}</span>.toDOM();
    },
    _lockedElement: function() {
      return <span class={Tag.Classes.LockedMark}>★</span>.toDOM();
    },
    _lockToggle: function() {
      var l = HTMLUtil.propertyToggler('★', this, 'locked');
      l.classList.add(Tag.Classes.LockToggle);
      return l;
    },
    _categoryElement: function() {
      return <span class={Tag.Classes.CategoryMark}>カテゴリ</span>.toDOM();
    },
    _categoryToggle: function() {
      var l = HTMLUtil.propertyToggler('カテゴリ', this, 'category');
      l.classList.add(Tag.Classes.CategoryToggle);
      return l;
    },
    _deleteToggle: function() {
      var l = HTMLUtil.propertyToggler('×', this, 'deleted');
      l.classList.add(Tag.Classes.DeleteToggle);
      return l;
    }
  });

var TagList = function() {
  this._tags = {};
  this._originalTagData = {};
  this.element = <div class={TagList.Classes.Element}/>.toDOM();
};
TagList.Classes = {
  Element: cls('tag-list'),
  DomainList: cls('tag-domain-list'),
  DomainListHeader: cls('tag-domain-list-header')
};
TagList.prototype = {
  element: null,
  _tags: null,
  _originalTagData: null,
  clear: function() {
    this._tags = {};
    this._originalTags = {};
    this.element.textContent = '';
  },
  add: function(domain, tagData) {
    this._originalTagData[domain] = tagData.slice();
    var tags = this._tags[domain] = tagData.map(function(t) new Tag(t));

    var domainElement =
      <div class={TagList.Classes.DomainList}>
        <strong class={TagList.Classes.DomainListHeader}>
          {DomainTab.getDomainImage(domain)}{DomainLabels[domain]}:
        </strong>
      </div>.toDOM();
    domainElement.appendChild(Object.toDOM(' '));

    domainElement.appendChild(
      tags.filter(function(t) t.domain === domain)
          .map(function(t) t.element)
          .joinDOM(' ')
    );
    this.element.appendChild(domainElement);
  }
};
var CustomTab = function() {
  this.init('カスタム', <div class={cls('custom-form')}/>.toDOM());
  this._tagList = new TagList();
};
CustomTab.prototype = Object.extend(
  new TabItem(), {
    _tagList: null,
    _createContent: function() {
      this.element.textContent = '';
      this._tagList.clear();
      this.state = TabItem.State.Loading;

      var comment =
        <form action="javascript: void(0);">
          <input class="submit" type="button"
                 onclick={'this.disabled = true; finishTagEdit();'}
                 value="編集を完了する" />
        </form>;

      var pager = new Pager([ i for (i in range(0, 300)) ]);
      var field = <div/>.toDOM();

      pager.element.addEventListener(
        Pager.PageChangedEvent,
        function() {
          field.textContent = pager.currentPage + '::' + pager.currentItems;
        },
        false);

      this.element.appendChild([comment, this._tagList.element,
                                pager.element, field].joinDOM());

      var c = this.container;
      var loadingCount = 0, requestCount = DomainNames.length;
      var self = this;

      function loadedHandler(item, success) {
        loadingCount--;

        if (success)
          self._tagList.add(item.domain, item.tags);
        if (requestCount > 0 || loadingCount > 0)
          return;

        self.state = TabItem.State.Loaded;
      }

      DomainNames.reduce(
        function(delay, domain) {
          requestCount--;
          var item = c.get(domain);
          if (item.loaded) {
            loadedHandler(item, true);
            return delay;
          }
          loadingCount++;
          item.reload('', delay, loadedHandler);
          return delay + DomainTab.LoadDelay;
        }, 0);
    }
  }
);

var Application = {
  editForm: null,
  tab: null,
  get currentDomainTab() {
    if (DomainNames.include(this.tab.currentItem))
      return this.tab.get(this.tab.currentItem);
    return null;
  },
  _initItem: function() {
    this.tab = new Tab();
    for each (let [, d] in Iterator(DomainNames)) {
      this.tab.add(d, new DomainTab(d));
    }

    this.tab.add('custom', new CustomTab());

    var tab = this.tab;
    tab.selector.addEventListener(
      Tab.SelectedChangedEvent,
      function() {
        GM_setValue('selectedCustomTab', tab.currentItem === 'custom');
        var t = tab.currentDomainTab;
        if (t !== null)
          t.show();
      },
      false);

    if (GM_getValue('selectedCustomTab', false)) tab.show('custom');
    else tab.show(SelectedDomain);
  },
  init: function() {
    this.editForm = document.getElementById('tag_edit_form');
    let (v = document.getElementById('video_controls')) {
      if (!this.editForm) {
        this.editForm = <div id="tag_edit_form"/>.toDOM();
        v.parentNode.insertBefore(this.editForm, v.nextSibling);
      }
      v.style.display = 'none';
    };

    this._initItem();

    this.editForm.appendChild(
      [this.tab.selector,
       DomainNames.map(function(d) this.tab.get(d).element, this),
       this.tab.get('custom').element
      ].joinDOM());
  }
};


unsafeWindow.startTagEdit = function(url) {
  setTimeout(function() { Application.init(); });
};
unsafeWindow.refreshTagEdit = function(form, loadingContainer) {
  var tab = Application.currentDomainTab;
  var domain = Application.tab.currentItem;
  if (tab === null)
    return false;

  loadingContainer = tab.element.querySelector('#' + loadingContainer);
  var loadingText = '';
  var cmd = form.querySelector('input[type="hidden"][name="cmd"]');
  if (cmd) {
    cmd = cmd.getValue();
    if (cmd in TagEditLoadingStatus[domain])
      loadingText = TagEditLoadingStatus[domain][cmd];
  }

  Array.forEach(
    Application.editForm.getElementsByTagName('form'),
    function(form) {
      Array.forEach(form.elements, function(elem) { elem.disabled = true; });
    });

  var param = Array.map(
    form.elements,
    function(elem) {
      return encodeURI(elem.name) + "=" + encodeURI(elem.value);
    }).join('&');

  let (cd = new CountDownTimer(3000, 300)) {
    cd.ontick = function(d) {
      loadingContainer.innerHTML = loadingText +
        CountDownMessage[domain](Math.ceil(d / 1000));
    };
    cd.ontimeout = function() {
      for each (let [, d] in Iterator(DomainNames))
        Application.tab.get(d).clearCache();
      Application.tab.get('custom').clearCache();
      tab.reload(param);
    };
    cd.start();
  };

  return false;
};

(function(original) {
   unsafeWindow.finishTagEdit = function(url) {
     original('http://' + location.host + '/tag_edit/' + VideoID);
   };
 })(unsafeWindow.finishTagEdit);

// autostart tag edit (for debug)
if (AUTO_START) {
  (function() {
     var link = document.querySelector('a[href^="javascript:startTagEdit"]');
     location.href = link.href;
   })();
}
