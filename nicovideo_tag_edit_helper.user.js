// ==UserScript==
// @name           nicovideo Tag Edit Helper
// @namespace      http://d.hatena.ne.jp/gifnksm/
// @description    Help you edit tags of nicovideo's movies.
// @include        http://www.nicovideo.jp/watch/*
// @include        http://tw.nicovideo.jp/watch/*
// @include        http://de.nicovideo.jp/watch/*
// @include        http://es.nicovideo.jp/watch/*
// @resource       style http://github.com/gifnksm/nicovideo-tag-edit-helper/raw/master/style.css
// @require        http://github.com/gifnksm/nicovideo-tag-edit-helper/raw/master/config.js
// @require        http://github.com/gifnksm/nicovideo-tag-edit-helper/raw/master/extend.js
// ==/UserScript==

const DEBUG = false;
const AUTO_START = DEBUG && true;

// console.log のエラーを抑制する
const console =
  DEBUG && unsafeWindow.console !== undefined
  ? unsafeWindow.console
  : {__noSuchMethod__: function() {} };

// ユーティリティ関数

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
      function(e) { value = command.call(this, !value, e); });
  },
  propertyToggler: function(text, obj, propName) {
    return this.toggleLink(
      text,
      function(value) obj[propName] = value,
      obj[propName]
    );
  },
  serializeForm: function(form) Array.map(
    form.elements,
    function(elem) encodeURI(elem.name) + "=" + encodeURI(elem.value)
  ).join('&'),
  disableForm: function(form) {
    Array.forEach(form.elements, function(elem) { elem.disabled = true; });
  }
};

// スクリプト本体

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
    var now = function () (new Date()).getTime();
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
  get currentPage() this._currentPage,
  _element: null,
  get element() this._element,
  _itemsPerPage: 5,
  get itemsPerPage() this._itemsPerPage,
  set itemsPerPage(value) {
    this._itemsPerPage = value;
    this._update();
    return this._itemsPerPage;
  },
  _maxShowPage: 10,
  get maxShowPage() this._maxShowPage,
  set maxShowPage(value) {
    this._maxShowPage = value;
    this._update();
    return this._maxShowPage;
  },
  _items: null,
  get items() this._items,
  set items(value) {
    this._items = value;
    this._update();
    return this._items;
  },
  get currentItems() this._pages[this.currentPage],
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
    _prevLink: function() HTMLUtil.commandLink('\xab', this.prev.bind(this)),
    _nextLink: function() HTMLUtil.commandLink('\xbb', this.next.bind(this))
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
  get currentItem() this._currentItem,
  _selector: null,
  get selector() this._selector,
  _items: null,
  add: function(name, item) {
    this._items[name] = item;
    item.container = this;
    this.selector.appendChild(item.label);
  },
  get: function(name) this._items[name] || null,
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
  get label() this._label,
  _element: null,
  get element() this._element,
  _state: TabItem.State.Initial,
  get state() this._state,
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
  get waiting() this.state === TabItem.State.Waiting,
  get loading() this.state === TabItem.State.Loading,
  get loaded() this.state  === TabItem.State.Loaded,
  get error() this.state   === TabItem.State.Error,
  clearCache: function() { this.state = TabItem.State.Initial; },
  show: function() {
    if (!this.loaded)
      this._createContent();
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
  this.element.innerHTML = DomainTab.HTMLs.Loading;
  this.domain = domain;
  this._url = DomainHosts[domain] + 'tag_edit/' + VideoID;
  this._callbacks = [];
};
DomainTab.getDomainImage = function(domain)
  <img src={'http://tw.nicovideo.jp/img/images/ww_'+domain+'.gif'} alt=''/>;
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
    stopLoading: false,
    _createContent: function() {
      if (this.stopLoading)
        return;
      this.reload('');
    },
    _callbacks: null,
    reload: function(data, delay, callback)  {
      if (typeof(callback) === 'function')
        this._callbacks.push(callback);
      if (this.loading || this.waiting)
        return;

      if (data === undefined) data = '';
      if (delay === undefined) delay = 0;

      this.element.innerHTML = DomainTab.HTMLs.Loading;
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
          this._startLoading(data);
        }.bind(this);
        cd.start();
      };
    },
    _startLoading: function(data) {
      this.state = TabItem.State.Loading;
      GM_xmlhttpRequest({
        method: 'POST',
        url: this._url,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        data: data,
        onload: function(response) {
          var success;
          if (response.responseText.indexOf('<!DOCTYPE') == 0) {
            this.element.innerHTML = DomainTab.HTMLs.Error;
            success = false;
          } else {
            this.element.innerHTML = response.responseText;
            success = this._parse();
          }
          this.state = success ? TabItem.State.Loaded : TabItem.State.Error;
          this._callCallbacks(success);
        }.bind(this),
        onerror: function(response) {
          this.element.innerHTML = DomainTab.HTMLs.Error;
          this.state = TabItem.State.Error;
          this._callCallbacks(false);
        }.bind(this)
      });
    },
    _callCallbacks: function(success) {
      var fun;
      while ((fun = this._callbacks.shift()) !== undefined)
        fun(this, success);
    },
    _parse: function() {
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
  get locked() this._locked,
  set locked(value) {
    this._locked = value;
    this._updateClass();
  },
  _category: null,
  get category() this._category,
  set category(value) {
    this._category = value;
    this._updateClass();
  },
  _deleted: null,
  get deleted() this._deleted,
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
    _nameElement: function()
      <span class={Tag.Classes.Name}>{this.name}</span>.toDOM(),
    _lockedElement: function()
      <span class={Tag.Classes.LockedMark}>★</span>.toDOM(),
    _lockToggle: function() {
      var l = HTMLUtil.propertyToggler('★', this, 'locked');
      l.classList.add(Tag.Classes.LockToggle);
      return l;
    },
    _categoryElement: function()
      <span class={Tag.Classes.CategoryMark}>カテゴリ</span>.toDOM(),
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
  this.element = <div class={TagList.Classes.Element}/>.toDOM();
  this.element.appendChild([this.header, this.body].joinDOM());
};
TagList.Classes = {
  Element: cls('tag-list'),
  Header: cls('tag-list-header'),
  Body: cls('tag-list-body')
};
TagList.createDomainHeader = function(domain)
  <>{DomainTab.getDomainImage(domain)}{DomainLabels[domain]}:</>.toDOM();
TagList.prototype = {
  element: null,
  _tags: null,
  _originalTagData: null,
  clear: function() {
    this._tags = {};
    this._originalTags = {};
    this.body.textContent = '';
  },
  update: function(tagData) {
    this._originalTagData = tagData.slice();
    this._tags = tagData.map(function(t) new Tag(t));
    this.body.appendChild(this._tags.map(function(t) t.element).joinDOM(' '));
  }
};
Object.memoizePrototype(
  TagList.prototype, {
    header: function() <strong class={TagList.Classes.Header}/>.toDOM(),
    body: function() <span class={TagList.Classes.Body}/>.toDOM()
  });
var CustomTab = function() {
  this.init('カスタム', <div class={cls('custom-form')}/>.toDOM());
  this._tagList = {};
  for each (let [, d] in Iterator(DomainNames)) {
    this._tagList[d] = new TagList();
    this._tagList[d].header.appendChild(TagList.createDomainHeader(d));
  }
};
CustomTab.prototype = Object.extend(
  new TabItem(), {
    _tagList: null,
    _createContent: function() {
      if (this.state == TabItem.State.Loading)
        return;
      this.state = TabItem.State.Loading;

      this.element.textContent = '';
      for each (let [, d] in Iterator(DomainNames))
        this._tagList[d].clear();

      var comment =
        <form action="javascript: void(0);" style="padding: 4px">
          登録タグを編集中…&#160;
          <input class="submit" type="button"
                 onclick="this.disabled = true; finishTagEdit();"
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

      this.element.appendChild(
        [comment,
         DomainNames.map(function(d) this._tagList[d].element, this),
         pager.element, field
        ].joinDOM());
      var self = this, isFirst = true;
      DomainNames.forEach(function(d) {
                            self.container.get(d).stopLoading = true;
                          });
      (function(resume) {
         for each(let [, domain] in Iterator(DomainNames)) {
           function update(item) {
             self._tagList[domain].update(
               item.tags.filter(function(t) t.domain === domain));
           }
           let item = self.container.get(domain);
           item.stopLoading = false;
           if (item.loaded) {
             update(item);
             continue;
           }
           yield item.reload(
             '', isFirst ? 0 : DomainTab.LoadDelay,
             function(item, success) {
               if (success)
                 update(item);
               isFirst = false;
               resume();
             });
         }
         self.state = TabItem.State.Loaded;
       }).go();
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
    function(elem) encodeURI(elem.name) + "=" + encodeURI(elem.value)
  ).join('&');

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
