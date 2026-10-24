/* ============================================================
 * data/days.js · 14 句与图标对应表
 * 句子为《背景.docx》第四节信件原文（唯一权威版本）
 * ============================================================ */
window.DAYS = [
  { day: 1,  title: '灯',     icon: 'lamp',    line: '灯我给你留着。回来就有。' },
  { day: 2,  title: '脚印',   icon: 'foot',    line: '我先来过了。你别急，慢慢来。' },
  { day: 3,  title: '桥',     icon: 'bridge',  line: '这条路我走过，绕了点。但到了。' },
  { day: 4,  title: '台阶',   icon: 'steps',   line: '你往上走。我就在下面，哪儿也不去。' },
  { day: 5,  title: '企鹅',   icon: 'penguin', line: '它坐在这儿陪你。我先去给你倒杯水。' },
  { day: 6,  title: '背面',   icon: 'back',    line: '背面有句话。你转过去，就当我小声说的。' },
  { day: 7,  title: '音符',   icon: 'note',    line: '你听见响，就是我喊你了。不用应，我知道你在。' },
  { day: 8,  title: '影子',   icon: 'shadow',  line: '我不在的时候，影子替我陪你一会儿。' },
  { day: 9,  title: '拼合',   icon: 'merge',   line: '我们俩，一开始也对不上。现在挺好。' },
  { day: 10, title: '星星',   icon: 'stars',   line: '星星罐摔过。我一颗颗捡的，一颗没少。你别哭。' },
  { day: 11, title: '碎片',   icon: 'shard',   line: '缺的那几块，我找回来了。都在这儿。' },
  { day: 12, title: '双人',   icon: 'duo',     line: '你走一步，我跟一步。回头也行，我在。' },
  { day: 13, title: '回廊',   icon: 'gallery', line: '走到这儿回头看，才发现，我们已经这么远了。' },
  { day: 14, title: '信',     icon: 'letter',  line: '生日快乐。星星在，企鹅在，我一直在。' }
];

/* 图标 → 用于信袋与信的 SVG 标记 */
window.DAY_ICONS = {
  lamp:    'light-bulb',
  foot:    'footprint',
  bridge:  'arch',
  steps:   'stairs',
  penguin: 'penguin',
  back:    'door-back',
  note:    'musical-note',
  shadow:  'shadow-shape',
  merge:   'merge-shape',
  stars:   'jar-stars',
  shard:   'shard',
  duo:     'two-figures',
  gallery: 'corridor',
  letter:  'envelope'
};

/* 纪念网格 / 信袋回看的图标 SVG */
window.IconSvg = (function () {
  const P = {
    'light-bulb':    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.8c.7.6 1 1.4 1 2.2h5c0-.8.3-1.6 1-2.2A6 6 0 0 0 12 3z"/>',
    'footprint':     '<path d="M7 5c1.5.8 2 2.4 1.6 4M12 3c1.8 1 2.3 3 1.7 5M5.5 10l1 7M8 9l1.2 8M11 9l1 8"/>',
    'arch':          '<path d="M4 20v-8a8 8 0 0 1 16 0v8"/><path d="M4 20h16"/>',
    'stairs':        '<path d="M4 20h4v-4h4v-4h4V8h4"/><path d="M8 20v-4M12 16v-4M16 12V8"/>',
    'penguin':       '<path d="M12 3a5 5 0 0 1 5 5v6a5 5 0 0 1-10 0V8a5 5 0 0 1 5-5z"/><path d="M12 3v14M9.5 10h.01M14.5 10h.01"/><path d="M12 17v3"/>',
    'door-back':     '<path d="M4 3h16v18H4z"/><path d="M8 3v18M15 11h.01"/>',
    'musical-note':  '<path d="M9 18V6l8-2v12"/><circle cx="7" cy="18" r="2.4"/><circle cx="15" cy="16" r="2.4"/>',
    'shadow-shape':  '<path d="M5 19l4-11 4 11-4 2z"/><path d="M13 19l4-11 4 11-4 2z"/>',
    'merge-shape':   '<path d="M4 15a8 8 0 0 1 8-8 8 8 0 0 1 8 8"/><path d="M12 7v14"/>',
    'jar-stars':     '<path d="M7 4h10M7 4v16h10V4"/><path d="M10 4v16M14 4v16"/><path d="M8.5 10l.7 1.4 1.4.2-1 .9.2 1.4-1.3-.7-1.3.7.2-1.4-1-.9 1.4-.2z"/>',
    'shard':         '<path d="M12 4l7 5-7 11-7-11z"/><path d="M12 4v16M8.5 7.5l3.5 2M15.5 7.5l-3.5 2"/>',
    'two-figures':   '<circle cx="8.5" cy="7" r="2.6"/><path d="M4.5 18v-5a4 4 0 0 1 8 0v5"/><circle cx="16" cy="7" r="2.6"/><path d="M12 18v-5a4 4 0 0 1 8 0v5"/>',
    'corridor':      '<path d="M3 5l9 3 9-3v14l-9 3-9-3z"/><path d="M12 8v11"/>',
    'envelope':      '<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>'
  };
  return function (key) {
    const k = window.DAY_ICONS[key] || key || 'envelope';
    const p = P[k] || P['envelope'];
    return '<svg viewBox="0 0 24 24" stroke-width="1.4" fill="none" stroke="currentColor">' + p + '</svg>';
  };
})();
