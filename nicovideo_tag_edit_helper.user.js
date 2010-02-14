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
  DEBUG && window.console !== undefined
  ? window.console
  : {_noSuchMethod__: function() {} };



// prototype拡張
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
const CountDown = {
  jp: function(c) { return '　あと ' + c + ' 秒'; },
  tw: function(c) { return '　還剩 ' + c + ' 秒'; },
  es: function(c) { return '　Despue\'s de ' + c + ' S'; },
  de: function(c) { return 'Sekunden nach dem ' + c; }
};


var TabPanel = function TabPanel(panels) {
  this._links = {};
  this._elems = {};
  this._selector = <div class={TabPanel.ClassNames.Tab}/>.toDOM();
};
TabPanel.ClassNames = {
  Tab: cls('tabpanel-tab'),
  Selected: cls('tabpanel-selected'),
  Panel: cls('tabpanel-panel')
};
TabPanel.PanelChangedEvent = 'GM_NicovideoTagEditHelper_PanelChanged';
TabPanel.prototype = {
  _currentPanel: null,
  get currentPanel() { return this._currentPanel; },
  _selector: null,
  get selector() { return this._selector; },
  _links: null,
  _elems: null,
  add: function(name, elem, title) {
    elem.classList.add(TabPanel.ClassNames.Panel);
    this._elems[name] = elem;
    var self = this;
    this._links[name] = HTMLUtil.commandLink(title, function() self.show(name));
    this.selector.appendChild(this._links[name]);
  },
  show: function(name) {
    if (!(name in this._links) || this._currentPanel == name)
      return;
    this._currentPanel = name;

    let (c = TabPanel.ClassNames)
      Object.forEach(this._links,
                     function(l, n) { setClass(l, c.Selected, n === name); });
    Object.forEach(this._elems,
                   function(e, n) { e.style.display = n === name ? '' : 'none'; });

    var ev = document.createEvent('Event');
    ev.initEvent(TabPanel.PanelChangedEvent, true, false);
    this.selector.dispatchEvent(ev);
  }
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


var DomainPanel = function(domain) {
  this.element = <div class={cls(domain)}></div>.toDOM();
  this.domain = domain;
  this._url = DomainHosts[domain] + 'tag_edit/' + VideoID;
};
DomainPanel.prototype = {
  domain: null,
  _url: null,
  _loaded: false,
  clearCache: function() { this._loaded = false; },
  show: function() {
    if (!this._loaded)
      this.reload('');
  },
  reload: function(data)  {
    let e = this.element;
    e.innerHTML = '<img src="img/watch/tool_loading.gif" alt="処理中">';

    GM_xmlhttpRequest(
      {method: 'POST',
       url: this._url,
       headers: {
         'X-Requested-With': 'XMLHttpRequest',
         'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
       data: data,
       onload: function(response) { e.innerHTML = response.responseText; }
      });

    this._loaded = true;
  }
};


var CustomPanel = function() {
  this.element = <div class={cls('custom-form')}/>.toDOM();
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
};


var Application = {
  editForm: null,
  panel: null,
  domainPanels: null,
  customPanel: null,
  get currentDomainPanel() {
    if (this.panel.currentPanel in this.domainPanels)
      return this.domainPanels[this.panel.currentPanel];
    return null;
  },
  _initPanel: function() {
    this.panel = new TabPanel();
    this.domainPanels = {};
    for each (let [, d] in Iterator(DomainNames)) {
      this.domainPanels[d] = new DomainPanel(d);
      this.panel.add(
        d, this.domainPanels[d].element,
        <>
          <img src={'http://tw.nicovideo.jp/img/images/ww_'+d+'.gif'} alt=''/>
          {DomainLabels[d]}
        </>
      );
    }

    this.customPanel = new CustomPanel();
    this.panel.add('custom', this.customPanel.element, 'カスタム');

    var panel = this.panel, dPanels = this.domainPanels;
    panel.selector.addEventListener(
      TabPanel.PanelChangedEvent,
      function() {
        GM_setValue('selectedCustomPanel', panel.currentPanel === 'custom');
        if (panel.currentPanel in dPanels)
          dPanels[panel.currentPanel].show();
      },
      false);

    if (GM_getValue('selectedCustomPanel', false)) panel.show('custom');
    else panel.show(SelectedDomain);
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

    this._initPanel();

    this.editForm.appendChild(
      [this.panel.selector,
       DomainNames.map(function(d) this.domainPanels[d].element, this),
       this.customPanel.element
      ].joinDOM());
  }
};


unsafeWindow.startTagEdit = function(url) {
  setTimeout(function() { Application.init(); });
};
unsafeWindow.refreshTagEdit = function(form, loadingContainer) {
  var panel = Application.currentDomainPanel;
  var domain = Application.panel.currentPanel;
  if (panel === null)
    return false;

  loadingContainer = panel.element.querySelector('#' + loadingContainer);
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
  var next = t() + 0xbb8;
  var refresh_timer = setInterval(
    function() {
      var d = next - t();
      if(d > 0) {
        loadingContainer.innerHTML = loadingText +
          CountDown[domain](Math.ceil(d / 0x3e8));
      } else {
        clearInterval(refresh_timer);
        setTimeout(function() {
                     for each (let [, d] in Iterator(DomainNames))
                       Application.domainPanels[d].clearCache();
                     panel.reload(param);
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
