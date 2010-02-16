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

const DEBUG = true;
const AUTO_START = DEBUG && true;


// console.log のエラーを抑制する
const console =
  DEBUG && unsafeWindow.console !== undefined
  ? unsafeWindow.console
  : {__noSuchMethod__: function() {} };



// prototype拡張
Array.prototype.include = function(x) this.indexOf(x) != -1;
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


// XML (E4X)からDOM Nodeへの変換
default xml namespace = "http://www.w3.org/1999/xhtml";
(function() {
   var fun = function(xmlns) {
     var pretty = XML.prettyPrinting;

     // 余分な空白を混入させないように，prettyPrintingを一時的に無効にする
     XML.prettyPrinting = false;
     var doc = (new DOMParser).parseFromString(
       '<root xmlns="' + xmlns + '">' + this.toXMLString() + "</root>",
       "application/xml");
     XML.prettyPrinting = pretty;

     var imported = document.importNode(doc.documentElement, true);
     var range = document.createRange();
     range.selectNodeContents(imported);
     var fragment = range.extractContents();
     range.detach();
     return fragment.childNodes.length > 1 ? fragment : fragment.firstChild;
   };
   XML.prototype.function::toDOM = fun;
   XMLList.prototype.function::toDOM = fun;
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
Object.extend = function() {
  var base = arguments[0];
  Array.slice(arguments, 1).forEach(
    function(obj) {
      for (let key in obj) {
        if (!obj.hasOwnProperty(key))
          return;
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
  }
};

// スクリプト本体

const VideoID = unsafeWindow.Video.id;
const DomainNames = ['jp', 'tw', 'es', 'de'];
const DomainLabels = {
  jp: '日本',
  tw: '台灣',
  es: 'スペイン',
  de: 'ドイツ'
};
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
Pager.PageChangedEvent = 'GM_NicovideoTagEditHelper_PageChanged';
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

    var self = this;
    this._links = this._pages.map(
      function(_, p) {
        var l = HTMLUtil.commandLink(p+1, function() self.goTo(p));
        l.classList.add(c.PageLink);
        return l;
      });

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
      var self = this;
      return HTMLUtil.commandLink('\xab', function() self.prev());
    },
    _nextLink: function() {
      var self = this;
      return HTMLUtil.commandLink('\xbb', function() self.next());
    }
});


var Tab = function() {
  this._items = {};
  this._selector = <div class={Tab.ClassNames.Tab}/>.toDOM();
};
Tab.ClassNames = {
  Tab: cls('tab-tab')
};
Tab.SelectedChangedEvent = 'GM_NicovideoTagEditHelper_SelectedChanged';
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
  Error: cls('tab-error')
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
    var self = this;
    this._label = HTMLUtil.commandLink(
      label,
      function() {
        if (self.container) self.container.show(self);
      });
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
        <img src={'http://tw.nicovideo.jp/img/images/ww_'+domain+'.gif'} alt=''/>
        {DomainLabels[domain]}
      </>,
      <div class={cls(domain)}></div>.toDOM());
  this.domain = domain;
  this._url = DomainHosts[domain] + 'tag_edit/' + VideoID;
};
DomainTab.LoadDelay = 3000;
DomainTab.prototype = Object.extend(
  new TabItem(),
  {
    domain: null,
    _url: null,
    _createContent: function() { this.reload(''); },
    reload: function(data, delay)  {
      if (data === undefined) data = '';
      if (delay === undefined) delay = 0;
      var e = this.element;
      e.innerHTML = '<img src="img/watch/tool_loading.gif" alt="処理中">';
      this.state = TabItem.State.Waiting;

      setTimeout(
        function(self) {
          self.state = TabItem.State.Loading;
          GM_xmlhttpRequest(
            {method: 'POST',
             url: self._url
             ,
             headers: {
               'X-Requested-With': 'XMLHttpRequest',
               'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
             data: data,
             onload: function(response) {
               e.innerHTML = response.responseText;
               if (self.parse())
                 self.state = TabItem.State.Loaded;
               else
                 self.state = TabItem.State.Error;
             },
             onerror: function(response) {
               self.state = TabItem.State.Error;
               e.innerHTML = '<p style="color: #cc0000; padding: 4px;">通信エラー</p>';
             }
            });
        }, delay, this);
    },
    parse: function() {
      // 子要素が唯一でP要素なら読み込みエラー (混雑中)
      if (this.element.firstElementChild.nodeName == 'P'
          && this.element.childElementCount == 1)
        return false;
      var rows = this.element.querySelectorAll(
        'div > table[summary=""] > tbody > tr:nth-of-type(odd)');
      console.log(rows);
      return true;
    }
  });
var CustomTab = function() {
  this.init('カスタム', <div class={cls('custom-form')}/>.toDOM());
};
CustomTab.prototype = Object.extend(
  new TabItem(),
  {
    _createContent: function() {
      var comment = <div>まだできてないよ．</div>;

      var pager = new Pager([ i for (i in range(0, 300)) ]);
      var field = <div/>.toDOM();

      pager.element.addEventListener(
        Pager.PageChangedEvent,
        function() {
          field.textContent = pager.currentPage + '::' + pager.currentItems;
        },
        false);

      this.element.appendChild([comment, pager.element, field].joinDOM());

      var c = this.container;
      DomainNames.reduce(
        function(delay, domain) {
          var item = c.get(domain);
          if (item.loaded)
            return delay;
          item.reload('', delay);
          return delay + DomainTab.LoadDelay;
        }, 0);
      this.state = TabItem.State.Loaded;
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

  var t = function () { return (new Date()).getTime(); };
  var next = t() + 3000;
  var refresh_timer = setInterval(
    function() {
      var d = next - t();
      if(d > 0) {
        loadingContainer.innerHTML = loadingText +
          CountDownMessage[domain](Math.ceil(d / 1000));
      } else {
        clearInterval(refresh_timer);
        setTimeout(function() {
                     for each (let [, d] in Iterator(DomainNames))
                       Application.tab.get(d).clearCache();
                     tab.reload(param);
                   }, 10);
      }
    }, 300);

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
