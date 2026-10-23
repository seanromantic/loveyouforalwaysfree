-- ============================================================
-- 14 天生日互动网页 · Supabase 建表 SQL
-- 仓库：loveyouforalways
-- 日期：birthday_date = 2027-01-12，start_date = 2026-12-30
-- ============================================================

-- 1. config：全局配置（单行）
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  birthday_date date not null,      -- 2027-01-12
  start_date date not null,         -- 2026-12-30
  timezone text default 'Asia/Shanghai'
);

-- 2. days：14 天的内容与解锁时间
create table if not exists public.days (
  day int primary key check (day between 1 and 14),
  title text not null,
  icon text not null,
  line text not null,               -- 当天句子
  scene_desc text,                  -- 场景描述（通过 get_scene 返回）
  puzzle_type text,                 -- 机关类型
  puzzle_config jsonb,              -- 机关配置
  unlock_at timestamptz not null    -- 解锁时间，UTC 存储
);

-- 3. progress：完成进度
create table if not exists public.progress (
  day int primary key references public.days(day),
  completed_at timestamptz default now()
);

-- ============================================================
-- RLS：全部默认关闭外部访问，仅通过 RPC 函数操作
-- ============================================================
alter table public.config enable row level security;
alter table public.days enable row level security;
alter table public.progress enable row level security;

-- config：匿名不可读
create policy "config_no_anon"
  on public.config for select
  to anon
  using (false);

-- days：匿名不可直接 select（line 只经 complete_day 返回）
create policy "days_no_anon"
  on public.days for select
  to anon
  using (false);

-- progress：匿名不可直接读写（只经 RPC 操作）
create policy "progress_no_anon"
  on public.progress for all
  to anon
  using (false)
  with check (false);

-- ============================================================
-- 种子数据：config + 14 天内容（unlock_at 按 Asia/Shanghai 00:00 换算 UTC）
-- Day N unlock = 2026-12-30 + (N-1) 天，00:00 +08:00
-- ============================================================

insert into public.config (id, birthday_date, start_date, timezone)
values (1, '2027-01-12', '2026-12-30', 'Asia/Shanghai');

insert into public.days (day, title, icon, line, scene_desc, puzzle_type, puzzle_config, unlock_at) values
(1,  '灯',   'lamp',   '我留了一盏灯，怕你进来的时候太黑。', '极小暗室，四壁很近，地上一盏没亮的灯，远处墙上一个门形凹槽', 'tap_light', '{"steps":1}', '2026-12-29T16:00:00Z'),
(2,  '脚印', 'foot',   '第一步我先替你踩了，你别怕。', '窄到只能过一人的走廊，两侧高墙，地面深色石板，前方远处一点光', 'tap_path', '{"steps":3}', '2026-12-30T16:00:00Z'),
(3,  '桥',   'bridge', '路断过，我把它转过来接上了。', '两段断开的石桥，中间悬空，桥块可转动', 'drag_bridge', '{"rotation":90}', '2026-12-31T16:00:00Z'),
(4,  '台阶', 'steps',  '你往上走，我在下面看着。', '向上台阶共七级，其中几级是暗的，尽头一扇小窗', 'tap_order', '{"steps":7,"order":[1,2,3,4,5,6,7]}', '2027-01-01T16:00:00Z'),
(5,  '企鹅', 'penguin','窗边有只企鹅，它替我先坐一会儿。', '台阶尽头拱形窗，窗关着，窗外深蓝夜空，窗台上坐着一只小企鹅', 'tap_window', '{"steps":1}', '2027-01-02T16:00:00Z'),
(6,  '背面', 'back',   '有些话我放在背面，你转过去才看得见。', '一面巨大素墙，正面空白，墙边极淡阴影提示可转', 'drag_rotate', '{"rotation":180}', '2027-01-03T16:00:00Z'),
(7,  '音符', 'note',   '我喊过你很多次。你应了，我就知道是你。', '一条窄路悬在虚空，路中间几块会发光的浮石', 'tap_pitch', '{"stones":5,"freq":[220,277,330,370,440]}', '2027-01-04T16:00:00Z'),
(8,  '影子', 'shadow', '你看不见的地方，我拿影子做了记号。', '一间空房，一束光从高处斜射，地上一个几何影子指向墙角', 'drag_shadow', '{"angle":-35}', '2027-01-05T16:00:00Z'),
(9,  '拼合', 'merge',  '我们不是一开始就合得上的，是慢慢磨成这样的。', '两个几何体悬在空中，形状差一点对不上，中间有缝隙', 'drag_fit', '{"rotation":90}', '2027-01-06T16:00:00Z'),
(10, '星星', 'stars',  '你折的那罐星星，罐子碎了。我一颗颗捡回来，一颗没少。', '一圈圈向下的台阶通向井底，井底一盏更小的灯，灯旁一罐裂痕的蓝色星星', 'tap_stars', '{"stars":36,"steps":5}', '2027-01-07T16:00:00Z'),
(11, '碎片', 'shard',  '缺了的那几块，我都找回来了。', '开阔空间，前面场景的几何碎片散落悬浮，可拖回原位拼成一扇窗', 'drag_puzzle', '{"pieces":5}', '2027-01-08T16:00:00Z'),
(12, '双人', 'duo',    '你走一步，我跟一步，你不用回头。', '棋盘般的网格空间，两个小人偶，一暖一冷', 'tap_move', '{"grid":5,"goal":[4,4]}', '2027-01-09T16:00:00Z'),
(13, '回廊', 'gallery','走到这里回头看，原来这么远了。', '一条长廊，两侧是前面走过的所有门，此刻全部打开', 'tap_walk', '{"doors":13}', '2027-01-10T16:00:00Z'),
(14, '信',   'letter', '生日快乐。星星一颗没少，企鹅还在，我也在。', '所有几何体在光里归位，空间全亮，中央悬着一封信，企鹅和星星罐在旁边', 'tap_letter', '{"lines":14}', '2027-01-11T16:00:00Z');

-- ============================================================
-- 备注：
-- · unlock_at 以 UTC 存储（Asia/Shanghai 00:00 = 前一日 16:00 UTC）
-- · 种子数据的 line 与文档「九、最终信全文」逐字一致
-- · free 版（loveyouforalwaysfree）不使用本表解锁判定，进度存本地
-- ============================================================
