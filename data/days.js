/* ============================================================
 * data/days.js · 14 句与图标对应表
 * 与 Supabase days 表种子数据逐字一致
 * ============================================================ */
window.DAYS = [
  { day: 1,  title: '灯',     icon: 'lamp',    line: '我留了一盏灯，怕你进来的时候太黑。' },
  { day: 2,  title: '脚印',   icon: 'foot',    line: '第一步我先替你踩了，你别怕。' },
  { day: 3,  title: '桥',     icon: 'bridge',  line: '路断过，我把它转过来接上了。' },
  { day: 4,  title: '台阶',   icon: 'steps',   line: '你往上走，我在下面看着。' },
  { day: 5,  title: '企鹅',   icon: 'penguin', line: '窗边有只企鹅，它替我先坐一会儿。' },
  { day: 6,  title: '背面',   icon: 'back',    line: '有些话我放在背面，你转过去才看得见。' },
  { day: 7,  title: '音符',   icon: 'note',    line: '我喊过你很多次。你应了，我就知道是你。' },
  { day: 8,  title: '影子',   icon: 'shadow',  line: '你看不见的地方，我拿影子做了记号。' },
  { day: 9,  title: '拼合',   icon: 'merge',   line: '我们不是一开始就合得上的，是慢慢磨成这样的。' },
  { day: 10, title: '星星',   icon: 'stars',   line: '你折的那罐星星，罐子碎了。我一颗颗捡回来，一颗没少。' },
  { day: 11, title: '碎片',   icon: 'shard',   line: '缺了的那几块，我都找回来了。' },
  { day: 12, title: '双人',   icon: 'duo',     line: '你走一步，我跟一步，你不用回头。' },
  { day: 13, title: '回廊',   icon: 'gallery', line: '走到这里回头看，原来这么远了。' },
  { day: 14, title: '信',     icon: 'letter',  line: '生日快乐。星星一颗没少，企鹅还在，我也在。' }
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
