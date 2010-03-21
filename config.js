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
  jp: function(c) '　あと ' + c + ' 秒',
  tw: function(c) '　還剩 ' + c + ' 秒',
  es: function(c) '　Despue\'s de ' + c + ' S',
  de: function(c) 'Sekunden nach dem ' + c
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
