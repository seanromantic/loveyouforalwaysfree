/* ============================================================
 * data/scenes.js · 14 个机关的静态配置
 * 每个机关：类型、目标步数、可配置参数
 * 实际渲染与交互逻辑在 js/scenes.js 中
 * ============================================================ */
window.SCENES = {
  1: { type: 'tap_light',   steps: 1, desc: '极小暗室，四壁很近，地上一盏没亮的灯，远处墙上一个门形凹槽' },
  2: { type: 'tap_path',    steps: 3, desc: '窄到只能过一人的走廊，两侧高墙，地面深色石板，前方远处一点光' },
  3: { type: 'drag_bridge', rotation: 90, desc: '两段断开的石桥，中间悬空，桥块可转动' },
  4: { type: 'tap_order',   steps: 7, desc: '向上台阶共七级，其中几级是暗的，尽头一扇小窗' },
  5: { type: 'tap_window',  steps: 1, desc: '台阶尽头拱形窗，窗外深蓝夜空，窗台上坐着一只小企鹅' },
  6: { type: 'drag_rotate', rotation: 180, desc: '一面巨大素墙，正面空白，墙边极淡阴影提示可转' },
  7: { type: 'tap_pitch',   stones: [220, 277, 330, 370, 440], desc: '窄路悬在虚空，路中间几块会发光的浮石' },
  8: { type: 'drag_shadow', targetAngle: -35, desc: '空房，一束光从高处斜射，地上几何影子指向墙角' },
  9: { type: 'drag_fit',    rotation: 90, desc: '两个几何体悬在空中，形状差一点对不上，中间有缝隙' },
  10:{ type: 'tap_stars',   steps: 5, stars: 36, desc: '一圈圈向下的台阶通向井底，井底一盏更小的灯，灯旁一罐裂痕的蓝色星星' },
  11:{ type: 'drag_puzzle', pieces: 5, desc: '开阔空间，前面场景的几何碎片散落悬浮，拖回原位拼成一扇窗' },
  12:{ type: 'tap_move',    grid: 5, goal: [4, 4], desc: '棋盘般的网格空间，两个小人偶，一暖一冷' },
  13:{ type: 'tap_walk',    doors: 13, desc: '一条长廊，两侧是前面走过的所有门，此刻全部打开' },
  14:{ type: 'tap_letter',  lines: 14, desc: '所有几何体在光里归位，空间全亮，中央悬着一封信' }
};
