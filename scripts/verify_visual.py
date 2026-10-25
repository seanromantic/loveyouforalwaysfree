#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""14 天生日互动网页 · 视觉自检脚本
检查四项"灵魂级"修复是否真实落地：
  1. 门嵌墙（南墙门洞 alphaMap 挖空 + 门框 + 门缝微光，墙前四天可见轮廓 opacity≈0.1）
  2. 地板实体（12×12 厚板 stage0 opacity≈0.3 + 灯下暖色光斑 lamp-patch，桌不再悬浮）
  3. 灯晕真光（lamp-halo 必须是 Sprite 羽化光，绝无 SphereGeometry 气球皮）
  4. 文字框极简（无边框/无背景/宋体/暖黄 #F2B45C + 极淡 "Day N" 小字）
另附完整 14 天回归（显影 stage 序列 0,0,0,0,1,2,2,2,2,2,2,2,2,3 + 零页面错误）。

用法：
  python3 scripts/verify_visual.py            # 默认本地 8160 端口
  REPO=/path/to/repo python3 scripts/verify_visual.py
  FREE=1 python3 scripts/verify_visual.py     # 顺带验证 free 版"下一天"按钮
输出：逐项 PASS/FAIL + 截图目录 /tmp/vs_shots2/，退出码 0=全过。
"""
import os, sys, threading, time, http.server, socketserver

BASE = os.environ.get('REPO', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = int(os.environ.get('VPORT', '8160'))
os.chdir(BASE)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class S(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True; daemon_threads = True
h = S(('127.0.0.1', PORT), Q)
threading.Thread(target=h.serve_forever, daemon=True).start()

RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + ('  [' + detail + ']' if detail else ''))

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(
        executable_path='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome',
        args=['--no-sandbox', '--disable-gpu'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    ERR = []
    pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.on('console', lambda m: ERR.append(m.text) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=90000)
    pg.wait_for_timeout(2500)

    # ---------- 1. 门嵌墙 ----------
    inv = pg.evaluate("""(() => {
      const s = window.Room3D.scene;
      const pers = s.children.find(c => c.children && c.children.some(k => k.name));
      const find = (n) => pers.children.filter(k => k.name === n);
      const wall = find('south-wall')[0];
      const seam = find('door-seam')[0];
      const frames = find('door-frame');
      return {
        wallAlpha: !!(wall && wall.material.alphaMap),
        wallOpacity: wall ? wall.material.opacity : -1,
        frames: frames.length,
        frameOpacity: frames.length ? frames[0].material.opacity : -1,
        seamOp: seam ? seam.material.opacity : -1,
      };
    })()""")
    check('1a 南墙带门洞 alphaMap（门洞挖空）', inv['wallAlpha'])
    check('1b 前四天墙可见轮廓 opacity≈0.1', abs(inv['wallOpacity'] - 0.1) < 0.08, 'opacity=%.3f' % inv['wallOpacity'])
    check('1c 门框四边存在', inv['frames'] == 4, 'n=%d' % inv['frames'])
    check('1d 门框边缘阴影可见 opacity≈0.5', abs(inv['frameOpacity'] - 0.5) < 0.15, 'opacity=%.3f' % inv['frameOpacity'])
    check('1e 门缝微光 opacity≈0.16', inv['seamOp'] > 0.05, 'opacity=%.3f' % inv['seamOp'])

    # ---------- 2. 地板实体 ----------
    fl = pg.evaluate("""(() => {
      const s = window.Room3D.scene;
      const pers = s.children.find(c => c.children && c.children.some(k => k.name));
      const floor = pers.children.find(k => k.name === 'floor-base');
      const glow = pers.children.find(k => k.name === 'glow-floor');
      const patch = pers.children.find(k => k.name === 'lamp-patch');
      return {
        floorOp: floor ? floor.material.opacity : -1,
        glowW: glow ? glow.geometry.parameters.width : 0,
        glowColor: glow ? '#' + glow.material.color.getHexString() : '',
        patchAdd: !!(patch && patch.material.blending === 2),  // AdditiveBlending=2
        patchOp: patch ? patch.material.opacity : -1,
      };
    })()""")
    check('2a 厚地板实体 opacity≈0.3', abs(fl['floorOp'] - 0.3) < 0.1, 'opacity=%.3f' % fl['floorOp'])
    check('2b 灯下暖色亮区地板≥6m', fl['glowW'] >= 6, 'w=%.1f' % fl['glowW'])
    check('2c 灯下暖光斑 Additive 羽化', fl['patchAdd'] and fl['patchOp'] > 0.1,
          'add=%s op=%.2f' % (fl['patchAdd'], fl['patchOp']))

    # ---------- 3. 灯晕真光 ----------
    halo = pg.evaluate("""(() => {
      const s = window.Room3D.scene;
      const pers = s.children.find(c => c.children && c.children.some(k => k.name));
      const h = pers.children.find(k => k.name === 'lamp-halo');
      const sphereHalo = pers.children.filter(k => k.name === 'lamp-halo' && k.isMesh);
      return { isSprite: !!(h && h.isSprite), sphereCount: sphereHalo.length,
               add: !!(h && h.material && h.material.blending === 2) };
    })()""")
    check('3a 灯晕是 Sprite（无球体轮廓）', halo['isSprite'])
    check('3b 无 SphereGeometry 光晕球', halo['sphereCount'] == 0, 'sphere=%d' % halo['sphereCount'])
    check('3c 灯晕 Additive 羽化', halo['add'])

    # ---------- 4. 文字框极简 + Day N（独立页面，不污染回归） ----------
    pT = b.new_page(viewport={'width': 1440, 'height': 900})
    pT.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=60000)
    pT.wait_for_timeout(2500)
    pT.eval_on_selector('#stage3d', "el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}))")
    pT.wait_for_timeout(1200)
    pT.evaluate('window.Room3D.__fire("d1")')
    t0 = time.time()
    while time.time() - t0 < 60:
        if pT.evaluate("!!document.querySelector('.scene-text') && document.querySelector('.scene-text').style.display === 'block'"):
            break
        pT.wait_for_timeout(600)
    pT.screenshot(path='/tmp/vs_shots2/dev_day1.png')
    txt = pT.evaluate("""(() => {
      const el = document.querySelector('.scene-text');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        borderW: cs.borderWidth, bg: cs.backgroundImage,
        color: cs.color, font: cs.fontFamily,
        dayTag: (el.querySelector('.scene-text-day') || {}).textContent || ''
      };
    })()""")
    check('4a 无边框', txt is not None and txt['borderW'] == '0px', str(txt and txt['borderW']))
    check('4b 无背景', txt is not None and (txt['bg'] == 'none' or txt['bg'] == ''), str(txt and txt['bg']))
    check('4c 宋体', txt is not None and ('Serif' in txt['font'] or 'Songti' in txt['font'] or 'SimSun' in txt['font']), str(txt and txt['font']))
    check('4d 暖黄 #F2B45C', txt is not None and '242, 180, 92' in txt['color'], str(txt and txt['color']))
    check('4e Day N 极淡小字', txt is not None and txt['dayTag'] == 'Day 1', str(txt and txt['dayTag']))
    pT.close()

    # ---------- 5. 显影阶段截图 ----------
    def snap(prog, name, wait):
        p2 = b.new_page(viewport={'width': 1440, 'height': 900})
        p2.add_init_script("localStorage.setItem('loveyouforalways_progress', JSON.stringify(%s))" % prog)
        p2.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=60000)
        p2.wait_for_timeout(2800)
        p2.eval_on_selector('#stage3d', "el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}))")
        p2.wait_for_timeout(wait)
        p2.screenshot(path='/tmp/vs_shots2/%s.png' % name)
        p2.close()
    snap([1, 2], 'dev_day3', 3600)
    snap([1, 2, 3, 4], 'dev_day5', 4800)
    snap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 'dev_day14', 4800)

    # ---------- 6. 完整 14 天回归 ----------
    # 先点门进入 Day1（等待场景与 pick 注册），再逐日驱动
    pg.eval_on_selector('#stage3d', "el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}))")
    wt = time.time()
    while time.time() - wt < 30:
        if pg.evaluate('window.Room3D.__hasPick("d1")'): break
        pg.wait_for_timeout(500)
    check('回归 进入 Day1 场景', pg.evaluate('window.Room3D.__hasPick("d1")'))
    stages = []
    for d in range(1, 15):
        pid = 'd%d' % d
        ok = pg.evaluate('window.Room3D.__hasPick(%r)' % pid)
        if not ok:
            check('回归 day%02d 场景可驱动' % d, False, 'no pick'); break
        pg.evaluate('window.Room3D.__fire(%r)' % pid)
        if d == 10:
            pg.wait_for_timeout(20000)
            pg.evaluate('window.Room3D.__fire("d10-jar")')
        if d == 12:
            pg.wait_for_timeout(3000)
            pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(700)
            pg.keyboard.press('ArrowRight')
        t0 = time.time(); done = False
        while time.time() - t0 < 240:
            if pg.evaluate("document.querySelectorAll('.complete-overlay.show').length"):
                done = True; break
            pg.wait_for_timeout(700)
        stages.append(pg.evaluate('window.Room3D.getRoomStage()'))
        check('回归 day%02d' % d, done, '%.0fs stage=%d' % (time.time() - t0, stages[-1]))
        if not done: break
        if d < 14:
            nid = 'd%d' % (d + 1)
            wt = time.time()
            while time.time() - wt < 60:
                if pg.evaluate('window.Room3D.__hasPick(%r)' % nid): break
                pg.wait_for_timeout(500)
            else:
                check('day%02d→%02d 推进' % (d, d + 1), False); break
    check('显影 stage 序列正确 (0,0,0,0,1,2×8,3)',
          stages == [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3],
          str(stages))
    check('零页面错误', len(ERR) == 0, 'errs=%s' % ERR[:4])

    # ---------- 7. free 版"下一天"按钮（FREE=1 时） ----------
    if os.environ.get('FREE') == '1':
        p3 = b.new_page(viewport={'width': 1440, 'height': 900})
        p3.add_init_script("window.ENV_FREE_MODE = true")
        p3.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=60000)
        p3.wait_for_timeout(2500)
        p3.eval_on_selector('#stage3d', "el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}))")
        p3.wait_for_timeout(1200)
        p3.evaluate('window.Room3D.__fire("d1")')
        t0 = time.time(); found = False
        while time.time() - t0 < 120:
            if p3.evaluate("!!document.querySelector('.done-next-btn')"):
                found = True; break
            p3.wait_for_timeout(600)
        check('free 下一天按钮出现', found)
        if found:
            p3.evaluate("document.querySelector('.done-next-btn').click()")
            t1 = time.time(); nxt = ''
            while time.time() - t1 < 30:
                nxt = p3.evaluate("document.querySelector('.day-counter') ? document.querySelector('.day-counter').textContent : ''")
                if '02' in nxt: break
                p3.wait_for_timeout(400)
            check('free 点击后推进到 Day 2', '02' in nxt, nxt)
        p3.close()

    b.close(); h.shutdown()

fails = [r for r in RESULTS if not r[1]]
print('\n===== 自检结果：%d/%d 通过 =====' % (len(RESULTS) - len(fails), len(RESULTS)))
sys.exit(1 if fails else 0)
