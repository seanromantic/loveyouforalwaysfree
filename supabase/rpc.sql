-- ============================================================
-- 14 天生日互动网页 · Supabase RPC 函数
-- 前端只调用 get_state / complete_day / get_scene，其余不直连表
-- ============================================================

-- ============================================================
-- 1. get_state()：获取当前整体状态（不含未解锁天的句子）
-- 返回：phase / current_day / completed / pending / letters_count / next_unlock_at
-- ============================================================
create or replace function public.get_state()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.config;
  today_local date;
  today_utc date;
  cur_day int;
  completed_ids int[];
  pending_ids int[];
  next_unlock timestamptz;
begin
  select * into cfg from public.config where id = 1;
  if not found then
    return json_build_object('phase', 'error', 'message', 'config not found');
  end if;

  -- 以寿星时区计算今天（Asia/Shanghai）
  today_utc := (now() at time zone 'UTC')::date;
  today_local := (now() at time zone cfg.timezone)::date;

  -- 1) 未开始
  if today_local < cfg.start_date then
    return json_build_object(
      'phase', 'before',
      'start_date', cfg.start_date,
      'birthday_date', cfg.birthday_date,
      'days_left', (cfg.start_date - today_local)
    );
  end if;

  -- 2) 纪念模式（生日之后）
  if today_local > cfg.birthday_date then
    return json_build_object(
      'phase', 'memorial',
      'birthday_date', cfg.birthday_date
    );
  end if;

  -- 3) 进行中：current_day = (今天 - start_date) + 1
  cur_day := (today_local - cfg.start_date) + 1;
  if cur_day < 1 then cur_day := 1; end if;
  if cur_day > 14 then cur_day := 14; end if;

  -- 已完成的集合
  select coalesce(array_agg(day order by day), '{}'::int[])
    into completed_ids
    from public.progress;

  -- 待完成 = [1..current_day] - completed
  select coalesce(array_agg(g.day order by g.day), '{}'::int[])
    into pending_ids
    from generate_series(1, cur_day) as g(day)
    where not (g.day = any (completed_ids));

  -- 下一次解锁时间：current_day 次日 00:00（若 current_day < 14）
  if cur_day < 14 then
    select unlock_at
      into next_unlock
      from public.days
      where day = cur_day + 1;
  else
    next_unlock := null;
  end if;

  return json_build_object(
    'phase', 'active',
    'current_day', cur_day,
    'completed', completed_ids,
    'pending', pending_ids,
    'letters_count', coalesce(array_length(completed_ids, 1), 0),
    'next_unlock_at', next_unlock
  );
end;
$$;

-- ============================================================
-- 2. complete_day(day int)：完成某天，返回该天句子
-- 校验：day <= current_day；重复完成返回 "already"
-- ============================================================
create or replace function public.complete_day(p_day int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.config;
  today_local date;
  cur_day int;
  rec public.days;
begin
  if p_day < 1 or p_day > 14 then
    return json_build_object('ok', false, 'error', 'invalid_day');
  end if;

  select * into cfg from public.config where id = 1;
  today_local := (now() at time zone cfg.timezone)::date;

  -- 未开始不可完成
  if today_local < cfg.start_date then
    return json_build_object('ok', false, 'error', 'not_started');
  end if;

  cur_day := least((today_local - cfg.start_date) + 1, 14);
  if cur_day < 1 then cur_day := 1; end if;

  -- 该天是否已解锁
  if p_day > cur_day then
    return json_build_object('ok', false, 'error', 'locked', 'current_day', cur_day);
  end if;

  -- 是否已完成（防重复）
  if exists (select 1 from public.progress where day = p_day) then
    return json_build_object('ok', true, 'error', 'already');
  end if;

  insert into public.progress (day) values (p_day);

  select * into rec from public.days where day = p_day;
  return json_build_object(
    'ok', true,
    'day', p_day,
    'line', rec.line,
    'title', rec.title,
    'icon', rec.icon
  );
end;
$$;

-- ============================================================
-- 3. get_scene(day int)：返回当天场景描述与机关配置
-- 只返回 day <= current_day 的行；不含 line（line 只经 complete_day 返回）
-- ============================================================
create or replace function public.get_scene(p_day int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.config;
  today_local date;
  cur_day int;
  rec public.days;
begin
  if p_day < 1 or p_day > 14 then
    return json_build_object('ok', false, 'error', 'invalid_day');
  end if;

  select * into cfg from public.config where id = 1;
  today_local := (now() at time zone cfg.timezone)::date;
  cur_day := least((today_local - cfg.start_date) + 1, 14);
  if cur_day < 1 then cur_day := 1; end if;

  if p_day > cur_day then
    return json_build_object('ok', false, 'error', 'locked');
  end if;

  select * into rec from public.days where day = p_day;
  return json_build_object(
    'ok', true,
    'day', p_day,
    'title', rec.title,
    'icon', rec.icon,
    'scene_desc', rec.scene_desc,
    'puzzle_type', rec.puzzle_type,
    'puzzle_config', rec.puzzle_config
  );
end;
$$;

-- ============================================================
-- 授权：允许匿名调用三个 RPC（数据经 security definer 读取，
-- 匿名仍无法直接 select 任何表）
-- ============================================================
grant execute on function public.get_state() to anon, authenticated;
grant execute on function public.complete_day(int) to anon, authenticated;
grant execute on function public.get_scene(int) to anon, authenticated;

-- 备注：
-- · free 版不使用这些函数，进度与解锁全部走本地（localStorage）
-- ============================================================
