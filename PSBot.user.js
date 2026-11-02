// ==UserScript==
// @name         PokéSurvivor Tự động treo máy (PSBot)
// @name:en      PokéSurvivor Auto-Farm (PSBot)
// @namespace    https://github.com/BoundlessEgret/pokesurvivor-autofarm
// @version      1.8.14
// @description  PokéSurvivor Tự động di chuyển né chiêu, chọn thẻ, gắn Bond, vào khe nứt bí ẩn, xử lý sự kiện (Gholdengo, cầu cứu, bàn thờ…), tự động mở ván mới
// @description:en Auto movement & dodging, card picks, bonds, rifts, events (Gholdengo, rescues, altars…) and auto restart for PokéSurvivor
// @author       BoundlessEgret
// @license      MIT
// @match        https://pokesurvivor.com/*
// @match        https://www.pokesurvivor.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// @homepageURL  https://github.com/BoundlessEgret/pokesurvivor-autofarm
// @supportURL   https://github.com/BoundlessEgret/pokesurvivor-autofarm/issues
// @updateURL    https://github.com/BoundlessEgret/pokesurvivor-autofarm/releases/latest/download/pokesurvivor-autofarm.user.js
// @downloadURL  https://github.com/BoundlessEgret/pokesurvivor-autofarm/releases/latest/download/pokesurvivor-autofarm.user.js
// ==/UserScript==

(() => {
  'use strict';
  const HOOK_KEY = 'Game';
  const STORE_KEY = 'psbot.v1';
  const VERSION = '1.8.14';   // khi sửa code nhớ sửa cùng manifest.json; tiêu đề bảng điều khiển hiển thị số này, dùng để xác nhận trình duyệt đang chạy bản mới
  const log = (...a) => console.log('%c[PSBot]', 'color:#ff8ad8', ...a);
  let booted = false;
  const start = ns => {
    if (booted) return; booted = true;
    if (Object.create === wrappedCreate) Object.create = origCreate;
    delete Object.prototype[HOOK_KEY];
    try { boot(ns); } catch (e) { console.error('[PSBot] boot failed', e); }
  };
  const own = (obj, k, v) => Object.defineProperty(obj, k, { value: v, writable: true, enumerable: true, configurable: true });
  Object.defineProperty(Object.prototype, HOOK_KEY, {
    configurable: true,
    get() { return undefined; },
    set(v) {
      own(this, HOOK_KEY, v);
      if (this && this.BUILT === true && 'LIFT' in this) start(this);
    },
  });
  const origCreate = Object.create, nullObjs = [];
  const wrappedCreate = function create(proto, props) {
    const o = props === undefined ? origCreate(proto) : origCreate(proto, props);
    if (proto === null && !booted && nullObjs.length < 200) nullObjs.push(o);
    return o;
  };
  Object.create = wrappedCreate;
  const poll = setInterval(() => {
    if (booted) return clearInterval(poll);
    const ns = nullObjs.find(o => o.BUILT === true && 'LIFT' in o && o[HOOK_KEY]);
    if (ns) { clearInterval(poll); start(ns); }
  }, 30);
  setTimeout(() => { if (!booted) { clearInterval(poll); if (Object.create === wrappedCreate) Object.create = origCreate; console.warn('[PSBot] namespace not found — the game may have changed'); } }, 30000);
  const DEFAULTS = {
    on: false,
    move: true,        // tự động di chuyển
    cards: true,       // tự động chọn thẻ nâng cấp
    bonds: true,       // tự động Bond
    items: true,       // tự động chọn vật phẩm mang theo
    rift: true,        // chủ động đi vào khe nứt bí ẩn (nguồn Bond)
    orbs: true,        // tự động dùng ngọc khi nguy cấp / đánh trùm
    restart: true,     // tự động chơi ván mới khi kết thúc
    noRank: true,      // ván treo máy không lên bảng xếp hạng
    upgrade: false,    // khi về menu chính tự động tiêu vàng mua "nâng cấp" (tốn vàng, mặc định tắt)
    gacha: false,      // khi về menu chính tự động dùng vé quay để quay (mặc định tắt)
    autoPartner: false,// khi về menu chính tự động đổi sang Pokémon mạnh nhất ra trận (mặc định tắt)
    favorites: [382, 150],
    passiveFirst: true,// chiêu bị động > nâng cấp chiêu chủ động
    farm: true,        // Gom quái: khi có chiêu diện rộng thì đi vòng nhỏ để quái dồn thành cụm, chiêu diện rộng đánh một mảng lớn (trên sân ≥54 con thì quái mới thành tinh anh, EXP ×1.6)
    lead: false,       // Bắn đón đầu (thực chiến hay bắn sượt mép, mặc định tắt: bắn thẳng vị trí hiện tại của quái, kết hợp lối di chuyển "giãn khoảng cách / đứng yên")
    focus: true,       // Tập trung hỏa lực: tiếp quản "ngắm thủ công" của game, đạn đơn thể mỗi lần chỉ bắn một con, chọn con hạ được trước để thu
    profiles: {
      150: { moves: ['confusion', 'harden', 'psychic', 'nasty-plot'], item: 'shellbell' }, // Mewtwo
    },
    panelX: null, panelY: null, collapsed: false,
  };
  let cfg;
  try { cfg = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
  catch { cfg = Object.assign({}, DEFAULTS); }
  cfg.profiles = Object.assign({}, DEFAULTS.profiles, cfg.profiles);
  for (const [dex, old] of Object.entries({ 1: 'energy-ball,nasty-plot,leaf-storm,giga-drain', 382: 'bubble,nasty-plot,aqua-ring,hydro-pump' }))
    if (cfg.profiles[dex] && (cfg.profiles[dex].moves || []).join() === old) delete cfg.profiles[dex];
  if (cfg.profiles[150] && (cfg.profiles[150].moves || []).join() === 'confusion,harden,nasty-plot,psychic') cfg.profiles[150] = Object.assign({}, cfg.profiles[150], { moves: DEFAULTS.profiles[150].moves.slice() });
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch {} };

  const stats = { runs: 0, kills: 0, coins: 0, best: 0, startedAt: Date.now() };
  function boot(ns) {
    window.__PSBOT = { ns, cfg, stats };
    log('namespace captured, version', VERSION);
    const wait = setInterval(() => {
      if (ns.Input && ns.RunUI && ns.LevelUp && ns.Moves && ns.Game && document.body) {
        clearInterval(wait);
        patch(ns);
        buildPanel(ns);
      }
    }, 50);
  }

  const S = { pickTimer: null, lastPos: null, stuckT: 0, unstickT: 0, unstickDir: null, wanderA: Math.random() * 6.28, lastSlotCheck: 0, lastOrb: 0, lastT: performance.now(), overAt: -1e9, lastPlay: -1e9, pausedAt: 0, userPausedAt: -1e9, lastDir: null, lastOffer: null, orbGoal: null, plan: null, seen: {}, ban: {}, noGo: {}, jCenter: null, holding: false, holdKey: null, holdSince: 0, wd: null, losBadT: 0, spin: 1, spinBlockT: 0, loopC: null, dirIdx: -1, holdT: 0, out: [1, 0] };

  function patch(ns) {
    const origAxis = ns.Input.axis.bind(ns.Input);
    ns.Input.axis = function () {
      const manual = origAxis();
      if (manual && (manual[0] || manual[1])) return manual;
      if (!cfg.on || !cfg.move) return manual;
      try { return steer(ns); } catch (e) { console.warn('[PSBot] steer', e); return manual; }
    };
    const origOffer = ns.LevelUp.offer;
    ns.LevelUp.offer = function () { return (S.lastOffer = origOffer.apply(this, arguments)); };
    const R = ns.RunUI;
    const origLevel = R.showLevelUp;
    R.showLevelUp = function (level, cards, cb, coop) {
      const r = origLevel.apply(this, arguments);
      if (cfg.on && cfg.cards) schedule(() => chooseCard(ns, cards), 700);
      return r;
    };
    const origBond = R.showBond;
    R.showBond = function (opt, cb) {
      const r = origBond.apply(this, arguments);
      if (cfg.on && cfg.bonds) schedule(() => chooseBond(ns, opt), 700);
      return r;
    };
    const origItem = R.showItemChoice;
    R.showItemChoice = function (cur, next, cb) {
      const r = origItem.apply(this, arguments);
      if (cfg.on && cfg.items) schedule(() => {
        const keep = itemRank(ns, cur) <= itemRank(ns, next);
        const el = document.querySelectorAll('#item-cards .card')[keep ? 0 : 1];
        el && el.click();
      }, 700);
      return r;
    };
    const origOver = R.showOver;
    R.showOver = function (d) {
      const r = origOver.apply(this, arguments);
      if (cfg.on) {
        stats.runs++; stats.kills += d.kills || 0; stats.coins += d.coins || 0;
        stats.best = Math.max(stats.best, d.time || 0);
        log(`run #${stats.runs}: ${Math.round(d.time)}s lv${d.level} kills ${d.kills} coins ${d.coins}`);
        const j = d.judge;
        cfg.history = [{ at: Date.now(), dex: ns.Game.player && ns.Game.player.dex, time: d.time, level: d.level, kills: d.kills, bosses: d.bosses, coins: d.coins, record: !!d.record,
          judge: j ? { time: j.time, bosses: j.bosses, dmg: j.dmg } : null }].concat(cfg.history || []).slice(0, 20);
        save();
        S.overAt = now();
      }
      return r;
    };
    if (ns.Ranking) for (const k of ['submitSolo', 'submitGroup']) {
      const orig = ns.Ranking[k];
      if (typeof orig !== 'function') continue;
      ns.Ranking[k] = function () {
        if (cfg.on && cfg.noRank) { log('ranking submit skipped'); return Promise.resolve(null); }
        return orig.apply(this, arguments);
      };
    }

    trackHazards(ns);
    setInterval(() => { if (cfg.on) try { housekeeping(ns); autoGacha(ns); autoPartner(ns); autoUpgrade(ns); autoRestart(ns); autoResume(ns); } catch (e) { console.warn('[PSBot] tick', e); } }, 200);
    log('patched');
  }

  function schedule(fn, ms) { setTimeout(() => { try { fn(); } catch (e) { console.warn('[PSBot]', e); } }, ms); }
  const STAT_PRI = { xp: 74, atk: 60, cd: 55, def: 45, hp: 40, rgn: 35, mag: 25, spd: 15, heal: 5 };
  const KIND_PRI = { homing: 13, nova: 12, aura: 12, orbit: 11, chain: 10, projectile: 9, boomerang: 8, beam: 8, meteor: 8, turret: 7, mine: 6, cone: 6, melee: 4, dash: 3, trail: 3 };

  function profileOf(ns) {
    const p = ns.Game.player;
    const prof = p && cfg.profiles[p.dex];
    return prof && prof.moves && prof.moves.length ? prof : null;
  }

  function scoreNewMove(ns, p, id) {
    const prof = profileOf(ns);
    if (prof) {
      const i = prof.moves.indexOf(id);
      return i >= 0 ? 900 - i * 5 : -100;
    }
    const m = ns.Moves.BY_ID[id];
    if (!m) return 0;
    const buffId = atkBuffOf(ns, p);
    if (id === 'harden') return 870;
    if (id === buffId) return 865;
    if (m.kind === 'buff') return -100;
    const atk = p.moves.filter(x => x.kind !== 'buff').length;
    const need = ['harden', buffId].filter(x => !p.hasMove(x)).length;
    if (atk === 0) return 860;
    if (p.maxMoves - p.slots.length - need < 1) return -100;
    if (atk >= 2) return -100;  // đủ 4 chiêu thì không học nữa: Bond xong trống ô cũng không lấy (chiêu học thừa sẽ bị game ép gắn thành nhóm thứ hai vô dụng)
    const aoe = aoeScore(ns, p, m);
    return aoe >= 20 && EARLY_AOE.includes(m.kind) ? 868 : 800 + aoe;
  }
  function atkBuffOf(ns, p) { return ns.Stats.sideOf(p.mon) === 'physical' ? 'swords-dance' : 'nasty-plot'; }
  const AOE_PRI = { vortex: 45, nova: 40, aura: 38, meteor: 36, orbit: 34, spin: 33, bounce: 31, chain: 30, shove: 29, quake: 27, cone: 26, charge: 24, stun: 22, beam: 22, boomerang: 20, homing: 18, projectile: 12, turret: 12, mine: 8 };
  const EARLY_AOE = ['vortex', 'aura', 'orbit'];
  function aoeScore(ns, p, m) {
    if (!(m.kind in AOE_PRI)) return -350;
    const fit = m.cat ? ns.Stats.fit(p.mon, m.cat) : 1;
    if (fit < 0.9) return -350;   // công vật lý / đặc biệt không khớp (vd: kiểu đặc biệt lại được chiêu vật lý) đánh không đau, thà reroll chờ thẻ sau
    return AOE_PRI[m.kind] + (fit >= 0.999 ? 0 : -15) + ((p.mon.types || []).includes(m.type) ? 8 : 0);
  }

  function countOwned(p, ids) { return ids.filter(id => p.hasMove(id)).length; }

  function scoreCard(ns, p, c) {
    const [type, id] = [c.type, String(c.key).split(':').slice(1).join(':')];
    const lowHp = p.hp / p.maxHp < 0.35;
    if (type === 'evo') return 1000;
    if (type === 'new') return scoreNewMove(ns, p, id);
    const EVO = ns.Moves.EVO || {};
    const evoNeeds = new Set(p.moves.filter(m => !m.evolved && EVO[m.id] && !(p.statsTaken || {})[EVO[m.id]]).map(m => EVO[m.id]));
    if (type === 'stat') {
      if (id === 'heal') return lowHp ? 950 : 10;
      if (c.color === '#ffd23f') return 980;          // lấy là tiến hóa ngay, chỉ thua chính "Tiến hóa"
      if (evoNeeds.has(id)) return 700;               // lấy trước bị động cần cho tiến hóa, khi chiêu tối đa cấp là tiến hóa luôn
      if (id === 'xp' && S.spawnLimited) return 660;
      const pri = id === 'def' && (p.dmgReduce || 0) < 0.69 ? 70 : id === 'mag' && (p.magnet || 78) < 260 ? 72 : (STAT_PRI[id] || 20);
      return (cfg.passiveFirst ? 500 : 300) + pri;
    }
    if (type === 'up') {
      const prof = profileOf(ns);
      const i = prof ? prof.moves.indexOf(id) : -1;
      const m = p.moves.find(x => x.id === id);
      const inActive = p.activeGroup().some(x => x.id === id);
      if (m && !m.evolved && EVO[id] && (i >= 0 || inActive)) {
        const maxLvl = (m.def && m.def.maxLvl) || 5;
        return 600 + Math.round(40 * (m.lvl || 1) / maxLvl) + (inActive ? 10 : 0);
      }
      return (cfg.passiveFirst ? 400 : 600) + (inActive ? 30 : 0) + (i >= 0 ? 20 - i * 3 : 0);
    }
    return 0;
  }

  function chooseCard(ns, cards) {
    const p = ns.Game.player;
    if (!p || !ns.UI.isOpen('scr-levelup')) return;
    let best = 0, bestS = -Infinity;
    cards.forEach((c, i) => { const s = scoreCard(ns, p, c); if (s > bestS) { bestS = s; best = i; } });
    const rr = document.getElementById('lvl-reroll');
    if (bestS < 500 && rr && !rr.classList.contains('hidden')) {
      log('reroll'); ns.RunUI.reroll();
      return schedule(() => chooseCard(ns, S.lastOffer || cards), 300);
    }
    log('pick', cards[best].key, bestS);
    ns.RunUI.pick(best);
  }
  function bondRank(ns, p, mv) {
    const prof = profileOf(ns);
    if (prof) { const i = prof.moves.indexOf(mv.id); return i >= 0 ? i : 50; }
    const first = p.moves.find(x => x.kind !== 'buff');
    if (first && mv.id === first.id) return 0;
    if (mv.id === 'harden') return 1;
    if (EARLY_AOE.includes(mv.kind)) return 2;
    if (mv.id === atkBuffOf(ns, p)) return 3;
    return mv.kind === 'buff' ? 10 : 4;
  }
  function chooseBond(ns, opt) {
    const p = ns.Game.player;
    if (!p || !ns.UI.isOpen('scr-bond')) return;
    const order = opt.loose.map((m, i) => ({ m, i })).sort((a, b) => bondRank(ns, p, a.m) - bondRank(ns, p, b.m));
    if (opt.mode === 'add') { log('bond add', order[0].m.id); return ns.RunUI.pickBond(order[0].i); }
    const first = order[0].m, second = order[1].m;
    log('bond pair', first.id, second.id);
    ns.RunUI.pickBond(order[0].i);
    schedule(() => {
      const list = opt.loose.filter(m => m !== first);
      ns.RunUI.pickBond(list.indexOf(second));
    }, 250);
  }
  const ITEM_PRI = ['shellbell', 'luckyegg', 'leftovers', 'quickclaw', 'focussash', 'assaultvest', 'rockyhelmet', 'amuletcoin', 'choicescarf', 'lifeorb', 'choiceband'];
  function itemRank(ns, id) {
    const prof = profileOf(ns);
    if (prof && prof.item === id) return -1;
    const i = ITEM_PRI.indexOf(id);
    return i < 0 ? 99 : i;
  }
  function groupScore(g, prof) {
    let dmg = 0, buff = 0, rank = 0;
    for (const m of g) {
      if (m.kind === 'buff') buff++; else dmg += 10 + (m.lvl || 1) + (m.evolved ? 5 : 0);
      const i = prof ? prof.moves.indexOf(m.id) : -1;
      if (i >= 0 && m.kind !== 'buff') rank += 100 - i * 20;
    }
    if (!dmg) return 0;                       // buff đơn lẻ không đánh người, đừng dừng ở ô đó
    return prof ? rank + buff * 30 + g.length * 5 : dmg + buff * 6;
  }
  function housekeeping(ns) {
    const p = ns.Game.player;
    if (!p || p.dead || ns.Game.state !== 'playing') return;
    hookAim(ns, p);
    const now = performance.now();
    const cnt = ns.EnemyMgr.count ?? ns.EnemyMgr.all().length;
    const busy = (ns.Rift && ns.Rift.inArena) || (ns.Judgment && ns.Judgment.active);
    if (!busy) { S.fieldAvg = S.fieldAvg == null ? cnt : S.fieldAvg + (cnt - S.fieldAvg) * 0.01; S.spawnLimited = ns.Game.st.time > 60 && S.fieldAvg < 25; }
    if (now - S.lastSlotCheck > 600 && p.slots.length > 1 && !p.hasItem?.('choiceband')) {
      S.lastSlotCheck = now;
      const prof = profileOf(ns);
      let best = p.active, bs = groupScore(p.slots[p.active] || [], prof);
      p.slots.forEach((g, i) => { const s = groupScore(g, prof); if (s > bs + 0.5) { bs = s; best = i; } });
      if (best !== p.active) p.setActive(best);
    }
    if (cfg.orbs && ns.Orbs && p.orbs && now - S.lastOrb > 1500) {
      let around = 0;
      for (const e of ns.EnemyMgr.all()) if (!e.dead && e.behavior !== 'thief' && Math.abs(e.x - p.x) < 90 && Math.abs(e.y - p.y) < 90) around++;
      const danger = p.hp / p.maxHp < 0.4 || around >= 8;   // sắp hết máu, hoặc bị từ 8 con quái trở lên bao sát người
      const boss = (ns.EnemyMgr.bossAlive && ns.EnemyMgr.bossAlive()) || (ns.Judgment && ns.Judgment.active);
      p.orbs.forEach((o, i) => {
        if (!o || now - S.lastOrb < 1500) return;
        const kind = ns.Orbs.BY && ns.Orbs.BY[o.id] && ns.Orbs.BY[o.id].kind;
        if ((kind === 'foe' && danger) || (kind === 'buff' && boss)) { ns.Orbs.use(p, i); S.lastOrb = now; }
      });
    }
  }
  function hookAim(ns, p) {
    if (S.aimHooked) return;
    const proto = Object.getPrototypeOf(p);
    if (!proto || typeof proto.handAim !== 'function') return;
    const orig = proto.handAim;
    proto.handAim = function () {
      if (cfg.on && cfg.focus && this === ns.Game.player && !this.remote) {
        try { return focusAim(ns, this); } catch (e) { console.warn('[PSBot] aim', e); return null; }
      }
      return orig.call(this);
    };
    const origAlong = proto.enemyAlong;
    if (typeof origAlong === 'function') proto.enemyAlong = function (all, a) {
      const fe = S.focusEnemy;
      if (cfg.on && cfg.focus && this === ns.Game.player && fe && !fe.dead) return fe;
      return origAlong.call(this, all, a);
    };
    S.aimHooked = true;
  }
  function focusAim(ns, p) {
    if (!cfg.on || !cfg.focus || ns.Game.state !== 'playing') return null;
    const judging = !!(ns.Judgment && ns.Judgment.active);
    const m = p.activeMove && p.activeMove();
    if (!m || m.kind !== 'projectile') return null;
    const reach = Math.min(520, (m.speed || 300) * (m.life || 1.5));
    const list = [];
    let arc = null;
    for (const e of ns.EnemyMgr.all()) {
      if (e.dead || e.silent) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (e.arceus) { if (d > 1) arc = { e, dx, dy, d }; continue; }
      if (judging && !e.boss) continue;
      if (!judging && e.boss && d < 330) return null;
      if (d > 1 && d < reach) list.push({ e, dx, dy, d });
    }
    if (!list.length) return null;
    const W = ns.World;
    if (W && W.projectileBlock) {
      const lift = ns.LIFT || 0;
      const clear = c => { const n = Math.ceil(c.d / 16); for (let i = 1; i < n; i++) if (W.projectileBlock(p.x + c.dx * i / n, p.y + c.dy * i / n - lift, 4)) return false; return true; };
      list.sort((a, b) => a.d - b.d);
      const vis = list.slice(0, 24).filter(clear);
      if (!vis.length) return null;   // không đánh được con nào: trả về ngắm tự động của game, phần di chuyển sẽ đi tìm góc bắn
      list.length = 0; list.push(...vis);
    }
    if (judging && arc) list.push(Object.assign(arc, { block: true }));
    const dmg = (m.dmg || 10) * (p.atkFor ? p.atkFor(m) : 1);
    const mult = e => (ns.Types && ns.Types.mult ? ns.Types.mult(m.type, e.types) : 1) * (ns.Weather && ns.Weather.mult ? ns.Weather.mult(m.type) : 1);
    const pierce = (m.pierce | 0) + 1, w = m.size || 6;
    let best = null, bs = -Infinity;
    for (const c of list) {
      const ux = c.dx / c.d, uy = c.dy / c.d, hits = [];
      if (c.block) continue;
      for (const o of list) {
        const al = o.dx * ux + o.dy * uy;
        if (al > 0 && Math.abs(o.dx * uy - o.dy * ux) < (o.e.r || 12) + w + (o.block ? 18 : 0)) hits.push([al, o.e]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      let s = -c.d / 3000;
      for (const [, e] of hits.slice(0, pierce)) {
        if (e.arceus) { s -= 1; break; }
        const hd = dmg * mult(e), hp = Math.max(1, e.hp || 1);
        s += hd >= hp ? 1.2 : 0.6 * hd / hp;
        if (e.id === S.focusId) s += 0.02 + 0.6 * Math.min(1, hd / hp);   // con đang đánh: cộng điểm theo tiến độ, con sắp chết thì bám dính, con đánh không nổi sẽ không bám chết
      }
      if (s > bs) { bs = s; best = c; }
    }
    S.focusId = best.e.id; S.focusEnemy = best.e;
    if (!cfg.lead) return Math.atan2(best.e.y - p.y, best.e.x - p.x);
    const ev = S.ev || (S.ev = new Map()), now = performance.now(), e = best.e;
    const o = ev.get(e.id);
    let vx = 0, vy = 0, sx = 0, sy = 0, sp = 0;
    if (o && now - o.t > 0 && now - o.t < 300) {
      const dts = (now - o.t) / 1000, ix = (e.x - o.x) / dts, iy = (e.y - o.y) / dts, a = 1 - Math.exp(-dts / 0.25), b = 1 - Math.exp(-dts / 0.6);
      vx = o.vx + (ix - o.vx) * a; vy = o.vy + (iy - o.vy) * a;
      sx = o.sx + (ix - o.sx) * b; sy = o.sy + (iy - o.sy) * b; sp = o.sp + (Math.hypot(ix, iy) - o.sp) * b;
    }
    ev.set(e.id, { x: e.x, y: e.y, t: now, vx, vy, sx, sy, sp });
    const cons = sp > 1 ? Math.min(1, Math.hypot(sx, sy) / sp) : 0;
    const lead = cons > 0.7 ? (cons - 0.7) / 0.3 : 0;
    vx *= lead; vy *= lead;
    if (ev.size > 200) ev.clear();
    const pp = S.pPrev;
    let pvx = 0, pvy = 0;
    if (pp && now - pp.t > 0 && now - pp.t < 300) { const k = 1000 / (now - pp.t); pvx = (p.x - pp.x) * k; pvy = (p.y - pp.y) * k; }
    S.pPrev = { x: p.x, y: p.y, t: now };
    const ov = Math.hypot(vx, vy), ed = Math.hypot(p.x - e.x, p.y - e.y) || 1;
    const chaser = e.spd > 0 && !['ranged', 'thief', 'turret'].includes(e.behavior) && lead > 0.5 && ov > 0.3 * e.spd && (vx * (p.x - e.x) + vy * (p.y - e.y)) / (ov * ed) > 0.5;
    const spd = m.speed || 300;
    let tx = e.x, ty = e.y;
    for (let i = 0; i < 3; i++) {
      const t = Math.min(m.life || 1.5, Math.hypot(tx - p.x, ty - p.y) / spd);
      if (chaser) {
        const fx = p.x + pvx * t, fy = p.y + pvy * t, gx = fx - e.x, gy = fy - e.y, gd = Math.hypot(gx, gy) || 1;
        const step = Math.min(Math.min(e.spd, sp) * t, Math.max(0, gd - (e.r || 12) - (p.r || 12)));
        tx = e.x + gx / gd * step; ty = e.y + gy / gd * step;
      } else { tx = e.x + vx * t; ty = e.y + vy * t; }
    }
    return Math.atan2(ty - p.y, tx - p.x);
  }
  const FARM_KINDS = ['vortex', 'nova', 'aura', 'orbit', 'spin', 'meteor', 'quake'];
  const PICK_W = { xp: 1, xpBig: 3, coin: 2, magnet: 5, bomb: 2.5, ticket: 9, ticket10: 12, item: 9, sphere: 6, candy: 6, heal: 0.4 };
  const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
  const hazards = [];
  function trackHazards(ns) {
    if (!ns.Hazards || !ns.Hazards.add) return;
    const orig = ns.Hazards.add;
    ns.Hazards.add = function () { const h = orig.apply(this, arguments); if (h) hazards.push(h); return h; };
    const origClear = ns.Hazards.clear;
    ns.Hazards.clear = function () { hazards.length = 0; return origClear.apply(this, arguments); };
  }
  function inHazard(h, x, y, r) {
    if (h.kind === 'zone') return (x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + r) ** 2;
    const c = Math.cos(h.angle || 0), s = Math.sin(h.angle || 0), dx = x - h.x, dy = y - h.y, along = dx * c + dy * s;
    return along > -r && along < (h.len || 0) + r && Math.abs(-dx * s + dy * c) <= (h.w || 0) / 2 + r;
  }
  const liquidOf = (ns, p) => {
    const W = ns.World, ab = p.abil || {};
    if (!W || !W.liquidEffect || ab.levitate) return {};
    const e = Object.assign({}, W.liquidEffect((p.mon && p.mon.types) || []) || {});
    if (ab.lavaProof) delete e.dmg;
    if (ab.steady) delete e.slow;
    return e;
  };
  const wetOk = (ns, p) => !liquidOf(ns, p).dmg;               // chất lỏng không mất máu thì coi như đi được
  const wetSlow = (ns, p) => liquidOf(ns, p).slow || 1;         // hệ số tốc độ khi đi trong chất lỏng (1 = không ảnh hưởng)
  const trapsNear = (W, x, y, r) => ((W && W.specialsNear && W.specialsNear(x, y, r)) || []).filter(t => t.type === 'trap');
  function findPath(ns, p, tx, ty, goalTol) {
    const W = ns.World, TS = W.TS || 32;
    if (!W.isFree) return null;
    const sx = Math.floor(p.x / TS), sy = Math.floor(p.y / TS), gx = Math.floor(tx / TS), gy = Math.floor(ty / TS);
    const span = Math.max(Math.abs(gx - sx), Math.abs(gy - sy)) + 20;
    if (span > 120) return null;                                   // quá xa, không đáng
    const traps = trapsNear(W, (p.x + tx) / 2, (p.y + ty) / 2, Math.hypot(tx - p.x, ty - p.y) / 2 + 200);
    const wet = wetOk(ns, p), wetCost = 1 / wetSlow(ns, p);   // đi trong nước chậm hơn: chi phí nhân theo tốc độ, quá xa thì đi vòng, gần thì lội thẳng
    const walk = new Map();
    const K = (x, y) => (x + 50000) * 100000 + (y + 50000);
    const ok = (x, y) => {
      const k = K(x, y);
      let v = walk.get(k);
      if (v === undefined) {
        const cx = x * TS + TS / 2, cy = y * TS + TS / 2;
        v = Math.abs(x - sx) <= span && Math.abs(y - sy) <= span && W.isFree(cx, cy, Math.min(p.r, TS * 0.45), wet)
          && !traps.some(t => (cx - t.x) ** 2 + (cy - t.y + 8) ** 2 < 26 * 26);
        walk.set(k, v);
      }
      return v;
    };
    const isGoal = (x, y) => Math.max(Math.abs(x - gx), Math.abs(y - gy)) <= goalTol;
    const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const heap = [], push = n => { heap.push(n); let i = heap.length - 1; while (i) { const j = (i - 1) >> 1; if (heap[j].f <= n.f) break; heap[i] = heap[j]; i = j; } heap[i] = n; };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++; if (heap[c].f >= last.f) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
    const g = new Map(), from = new Map();
    g.set(K(sx, sy), 0); push({ x: sx, y: sy, f: h(sx, sy) });
    let end = null, n = 0;
    while (heap.length && n++ < 8000) {
      const c = pop(), ck = K(c.x, c.y), cg = g.get(ck);
      if (isGoal(c.x, c.y)) { end = c; break; }
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = c.x + dx, ny = c.y + dy;
        if (!ok(nx, ny) && !isGoal(nx, ny)) continue;
        if (dx && dy && (!ok(c.x + dx, c.y) || !ok(c.x, c.y + dy))) continue;   // không cắt góc tường
        const wetMul = wet && W.isLiquid && W.isLiquid(nx * TS + TS / 2, ny * TS + TS / 2) ? wetCost : 1;
        const ng = cg + (dx && dy ? 1.414 : 1) * wetMul, nk = K(nx, ny);
        if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from.set(nk, ck); push({ x: nx, y: ny, f: ng + h(nx, ny) }); }
      }
    }
    if (!end) return null;
    const pts = [];
    for (let k = K(end.x, end.y); k !== undefined; k = from.get(k)) {
      const x = Math.floor(k / 100000) - 50000, y = (k % 100000) - 50000;
      pts.push([x * TS + TS / 2, y * TS + TS / 2]);
    }
    pts.reverse();
    pts[pts.length - 1] = [tx, ty];
    return { pts, len: g.get(K(end.x, end.y)) * TS + Math.hypot(tx - pts[pts.length - 1][0], ty - pts[pts.length - 1][1]) };
  }
  function waypoint(ns, p, path) {
    const W = ns.World, traps = trapsNear(W, p.x, p.y, 320);
    const clear = (x, y) => {
      const d = Math.hypot(x - p.x, y - p.y), n = Math.ceil(d / 8);
      for (let i = 1; i <= n; i++) {
        if (d * (1 - i / n) < 26) break;
        const sx = p.x + (x - p.x) * i / n, sy = p.y + (y - p.y) * i / n;
        if (!W.isFree(sx, sy, p.r, wetOk(ns, p)) || traps.some(t => (sx - t.x) ** 2 + (sy - t.y + 8) ** 2 < 23 * 23)) return false;
      }
      return true;
    };
    let near = 0, nd = Infinity;
    path.pts.forEach(([x, y], i) => { const d = Math.hypot(x - p.x, y - p.y); if (d < nd) { nd = d; near = i; } });
    path.pts.splice(0, near);
    let wp = path.pts[0];
    for (let i = 1; i < Math.min(path.pts.length, 14); i++) {
      const [x, y] = path.pts[i];
      if (Math.hypot(x - p.x, y - p.y) > 260 || !clear(x, y)) break;
      wp = path.pts[i];
    }
    return { x: wp[0], y: wp[1], offPath: nd };
  }
  function candidates(ns, p, hpPct) {
    const out = [], now = ns.Game.st.time, W = ns.World;
    if (hpPct > 0.2) for (const e of ns.EnemyMgr.all()) {
      if (e.dead || e.behavior !== 'thief') continue;
      S.seen[e.id] = S.seen[e.id] ?? now;
      const gold = (e.def && e.def.loot === 'ticket10') || e.dex === 1000;
      out.push({ key: 'thief' + e.id, x: e.x, y: e.y, tier: gold ? 5 : 3, value: gold ? 14 : 3, left: 15 - (now - S.seen[e.id]), mode: gold ? 'Đuổi Gholdengo' : 'Đuổi Meowth', goalTol: 2, chase: true, flee: e.spd || 92 });
    }
    const rift = ns.Rift && ns.Rift.rift;
    const bondDone = p.slots.some(g => g.length >= 4);
    if (cfg.rift && rift && !ns.Rift.inArena && hpPct > 0.2 && !bondDone)
      out.push({ key: 'rift', tier: 4, x: rift.x, y: rift.y - 10, value: 12, left: rift.ttl ?? 45, mode: 'Vào khe nứt', goalTol: 0, chase: true, direct: true });
    const lost = ns.Events && ns.Events._dbg && ns.Events._dbg();
    if (lost && hpPct > 0.25 && !ns.Rift.inArena) {
      if (lost.state === 'wait') out.push({ key: 'lost', tier: 3, x: lost.x, y: lost.y, value: 8, left: 90, mode: 'Đi cứu viện', goalTol: 1, chase: true });
      else out.push({ key: 'escort', tier: 3, x: lost.tx, y: lost.ty, value: 9, left: 90, mode: 'Đang hộ tống', goalTol: 0, chase: true, hold: 20, escort: true });
    }
    const lt = S.losTarget;
    if (lt && !lt.dead && !lt.arceus && !(ns.Judgment && ns.Judgment.active) && S.losBadT > 0.25 && W && W.isFree && W.projectileBlock) {
      const clearShot = (x, y) => { const d = Math.hypot(lt.x - x, lt.y - y), n = Math.ceil(d / 12); for (let i = 1; i < n; i++) if (W.projectileBlock(x + (lt.x - x) * i / n, y + (lt.y - y) * i / n - (ns.LIFT || 0), 4)) return false; return true; };
      const spots = [];
      for (const r of [140, 220, 300]) for (let k = 0; k < 24; k++) {
        const a = k / 24 * 6.2832, x = lt.x + Math.cos(a) * r, y = lt.y + Math.sin(a) * r;
        if (W.isFree(x, y, p.r + 4, wetOk(ns, p)) && clearShot(x, y)) spots.push({ x, y, d: Math.hypot(x - p.x, y - p.y) });
      }
      spots.sort((a, b) => a.d - b.d);
      for (const sp of spots.slice(0, 2)) out.push({ key: 'los' + Math.round(sp.x / 64) + ',' + Math.round(sp.y / 64), tier: 1, x: sp.x, y: sp.y, value: 6, left: Infinity, mode: 'Tìm góc bắn', goalTol: 0, chase: true });
    }
    if (!ns.Rift.inArena && W && W.specialsNear) for (const o of W.specialsNear(p.x, p.y, 700)) {
      if (o.type === 'altar' && !o.used) out.push({ key: 'altar' + o.id, tier: 2, x: o.x, y: o.y, value: 5, left: Infinity, mode: 'Ăn buff', goalTol: 1, chase: true });
      else if (o.type === 'spring' && hpPct < 0.6 && (o.charge ?? 1) > 0.2) out.push({ key: 'spring' + o.id, tier: 2, x: o.x, y: o.y - 8, value: 7, left: Infinity, mode: 'Hồi máu suối', goalTol: 0, hold: 20, until: () => p.hp >= p.maxHp * 0.95 });
      else if (o.type === 'bigchest' && hpPct > 0.5) {
        let spot = null, sd = Infinity;
        for (const r of [22, 28, 34]) for (let k = 0; k < 16; k++) {
          const a = k / 16 * 6.2832, x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r;
          if (!W.isFree || W.isFree(x, y, p.r + 2)) { const d = Math.hypot(x - p.x, y - p.y); if (d < sd) { sd = d; spot = { x, y }; } }
        }
        if (spot) out.push({ key: 'chest' + o.id, tier: 2, x: spot.x, y: spot.y, value: 3, left: Infinity, mode: 'Mở rương', goalTol: 0, hold: 10 });
      }
    }
    return out;
  }
  function plan(ns, p, hpPct) {
    const now = performance.now();
    const pSpd = (p.baseSpd || 100) * (p.spdMul || 1);
    const cur = S.plan;
    const gt = ns.Game.st.time;
    const cands = candidates(ns, p, hpPct).filter(c => !(S.ban[c.key] > gt));
    const live = cur && cands.find(c => c.key === cur.key);
    const higher = cur && cands.some(c => c.tier > cur.c.tier && !(S.noGo[c.key] > now));
    const stale = !live || higher || now - cur.at > 600 || Math.hypot(live.x - cur.c.x, live.y - cur.c.y) > 48 || (cur.path && cur.path.pts.length < 2);
    if (!stale) { cur.c = Object.assign(cur.c, live, { x: cur.c.x, y: cur.c.y }); return cur; }
    let best = null, bestScore = 0, bestTier = -1;
    const order = cands.sort((a, b) => (b.tier - a.tier) || (b.value / Math.hypot(b.x - p.x, b.y - p.y) - a.value / Math.hypot(a.x - p.x, a.y - p.y)));
    for (const c of order) {
      if (c.tier < bestTier) break;                    // đã có mục tiêu cấp cao hơn và kịp tới

      const path = findPath(ns, p, c.x, c.y, c.goalTol);
      if (!path) { S.noGo[c.key] = now + 1000; continue; }   // không đi tới được: 1 giây không tính lại
      const eta = c.flee ? Math.max(0, path.len - 220) / Math.max(8, pSpd - c.flee) : path.len / pSpd;
      if (eta > c.left - 1) { S.noGo[c.key] = now + 1000; continue; }   // không kịp
      const score = c.value / (eta + 4) * (cur && cur.key === c.key ? 1.8 : 1);   // cùng cấp, việc đang làm được cộng điểm, không bị kéo đi giữa đường
      if (c.tier > bestTier || score > bestScore) { bestTier = c.tier; bestScore = score; best = { key: c.key, c, path, at: now, eta }; }
    }
    S.plan = best;
    return best;
  }

  function pickTarget(ns, p, enemies, hpPct, fear) {
    let pl = plan(ns, p, hpPct);
    if (pl && pl.key.startsWith('los') && !S.losDefer) {
      S.losDefer = true;
      const orb = pickTarget(ns, p, enemies, hpPct, fear);
      S.losDefer = false;
      if (orb && orb.orb) return orb;
    }
    if (pl && S.losDefer && pl.key.startsWith('los')) pl = null;
    if (pl) {
      const c = pl.c;
      const wp = waypoint(ns, p, pl.path);
      if (wp.offPath > 3 * (ns.World.TS || 32)) pl.at = 0;   // bị chiêu chen lệch tuyến quá xa: khung hình sau tính lại
      return { x: wp.x, y: wp.y, fx: c.x, fy: c.y, w: 6, mode: c.mode, chase: c.chase, hold: c.hold, until: c.until, escort: c.escort, direct: c.direct };
    }
    const W = ns.World;
    const mag = p.magnet || 78;
    const gt = ns.Game.st.time;
    const pSpd = (p.baseSpd || 100) * (p.spdMul || 1);
    const traps = ((W && W.specialsNear && W.specialsNear(p.x, p.y, 600)) || []).filter(t => t.type === 'trap');
    const onTrap = k => traps.some(t => (k.x - t.x) ** 2 + (k.y - t.y + 8) ** 2 < 23 * 23);
    S.orbBan = (S.orbBan || []).filter(b => b.until > gt);
    const banned = k => S.orbBan.some(b => Math.abs(k.x - b.x) < 70 && Math.abs(k.y - b.y) < 70);
    const all = ns.Pickups.all();
    let loose = 0;
    for (const k of all) if (!k.pulled && (k.kind === 'xp' || k.kind === 'xpBig')) loose += k.kind === 'xpBig' ? 3 : 1;
    const wOf = k => k.kind === 'heal' ? (hpPct < 0.7 ? 8 : 0.2) : k.kind === 'magnet' ? 5 + loose * 0.4 : (PICK_W[k.kind] ?? 1);
    let pv = 0, px = 0, py = 0;
    for (const k of all) if (k.pulled && (k.kind === 'xp' || k.kind === 'xpBig')) { const w = k.kind === 'xpBig' ? 3 : 1; pv += w; px += k.x * w; py += k.y * w; }
    if (pv >= 6 && !(ns.Judgment && ns.Judgment.active)) {
      px /= pv; py /= pv;
      if (Math.hypot(px - p.x, py - p.y) > 60) return { x: px, y: py, w: 2.5, mode: 'Thu EXP', orb: true };
    }
    const items = all.filter(k => !k.pulled && !(k.kind === 'heal' && hpPct >= 0.95) && !onTrap(k) && !banned(k));
    const clR = Math.max(90, mag * 0.8);   // phạm vi một cụm: đứng ở tâm thì vùng hút gần như phủ được
    const g = S.orbGoal;
    if (g && gt < g.until) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < g.bestD - 40 || S.mode !== 'Nhặt cầu EXP') { g.bestD = Math.min(g.bestD, d); g.at = gt; }
      else if (gt - g.at > 3) { S.orbBan.push({ x: g.x, y: g.y, until: gt + 20 }); S.orbGoal = null; return pickTarget(ns, p, enemies, hpPct, fear); }
      let left = 0;
      for (const k of items) if (Math.abs(k.x - g.x) < clR && Math.abs(k.y - g.y) < clR) left += wOf(k);
      if (left > 0 && d > mag * 0.85 && !(S.farm && d > 440)) return { x: g.x, y: g.y, w: 2, mode: 'Nhặt cầu EXP', orb: true };
    }
    let best = null, bestS = 0;
    const [ox, oy] = S.out || [0, 0];
    const seeds = items.length > 120 ? items.map(k => [Math.hypot(k.x - p.x, k.y - p.y), k]).sort((a, b) => a[0] - b[0]).slice(0, 120).map(x => x[1]) : items;
    for (const k of seeds) {
      const dx = k.x - p.x, dy = k.y - p.y, d = Math.hypot(dx, dy);
      if (d < mag * 0.9) continue;   // đã ở trong / sát mép phạm vi hút: sẽ tự bay tới, không cần cố ý đi nhặt
      if (S.farm && d > 400) continue;   // đang gom quái thì không chạy xa: cầu rơi cạnh bầy quái, lúc đi vòng là hút được rồi; cầu xa đợi quái ít rồi nhặt
      let cluster = 0;
      for (const o of items) if (Math.abs(o.x - k.x) < clR && Math.abs(o.y - k.y) < clR) cluster += wOf(o);
      let crowd = 0;
      for (const e of enemies) if (!e.dead && Math.abs(e.x - k.x) < 70 && Math.abs(e.y - k.y) < 70) crowd += e.boss ? 5 : 1;
      const ahead = (ox * dx + oy * dy) / (d || 1);
      const s = cluster / (d + 120) / (1 + crowd * 0.35 * fear) * (1 + 0.3 * ahead);
      if (s > bestS) { bestS = s; best = k; }
    }
    if (best) {
      const d = Math.hypot(best.x - p.x, best.y - p.y);
      S.orbGoal = { x: best.x, y: best.y, until: gt + 1.5 + 2 * d / pSpd, bestD: d, at: gt };
      return { x: best.x, y: best.y, w: 2, mode: 'Nhặt cầu EXP', orb: true };
    }
    S.orbGoal = null;
    if (hpPct > 0.5) {
      let hunt = null, hd = Infinity;
      for (const e of ns.EnemyMgr.all()) {
        if (e.dead || e.silent) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < hd) { hd = d; hunt = e; }
      }
      if (hunt && hd > 600) return { x: hunt.x, y: hunt.y, w: 0.8, mode: 'Tìm quái' };
    }
    return null;
  }

  function steer(ns) {
    const p = ns.Game.player;
    if (!p || p.dead) return [0, 0];
    const now = performance.now();
    const dt = Math.min(0.1, (now - S.lastT) / 1000); S.lastT = now;
    const gt = ns.Game.st.time;
    const hpPct = p.hp / p.maxHp;
    let fear = hpPct < 0.35 ? 2.5 : hpPct < 0.6 ? 1 : 0.25;
    const aoe = p.activeGroup && p.activeGroup().some(m => FARM_KINDS.includes(m.kind));
    S.farm = cfg.farm && aoe && !(ns.Rift && ns.Rift.inArena) && !(ns.Judgment && ns.Judgment.active) && (S.farm ? hpPct > 0.45 : hpPct > 0.65);
    if (S.farm) fear = Math.min(fear, hpPct > 0.8 ? 0.15 : 0.2);

    const near = [];
    for (const e of ns.EnemyMgr.all()) {
      if (e.dead || e.silent) continue;
      if (e.behavior === 'thief') continue;   // trộm không đánh người, không cần né
      if (Math.abs(e.x - p.x) < 360 && Math.abs(e.y - p.y) < 360) near.push(e);
    }
    const shots = ns.Projectiles.all().filter(s => !s.friendly && Math.abs(s.x - p.x) < 300 && Math.abs(s.y - p.y) < 300);
    for (let i = hazards.length - 1; i >= 0; i--) { const h = hazards[i]; if (h.hit && h.t >= h.delay + h.end) hazards.splice(i, 1); }
    const J = ns.Judgment;
    const unitPx = (ns.Tiles && ns.Sprites) ? ns.Tiles.T * ns.Sprites.PX : 32;
    const judging = !!(J && J.active);
    if (!judging) S.jCenter = null;
    else {
      const wa = ns.World && ns.World.arena;   // sân do game tự ghi: {tx, ty, r, type:'judgment'} (tọa độ ô)
      if (wa && wa.type === 'judgment') S.jCenter = { x: wa.tx * unitPx + unitPx / 2, y: wa.ty * unitPx + unitPx / 2 };
      else if (!S.jCenter) S.jCenter = { x: p.x, y: p.y - 3 * unitPx };   // dự phòng: lúc bắt đầu người chơi ở tâm xuống dưới 3 ô
    }
    const arceus = judging ? ns.EnemyMgr.all().find(e => e.arceus) : null;

    let target = pickTarget(ns, p, near, hpPct, fear);
    if (target && target.escort) fear = Math.max(fear, 1);   // khi hộ tống, Pokémon đi theo sau bị quái chạm là mất máu, phải tránh bầy quái
    if (judging && target && !(target.orb && Math.hypot(target.x - p.x, target.y - p.y) < 140 && (!arceus || Math.hypot(arceus.x - p.x, arceus.y - p.y) > 320))) target = null;
    const arena = (ns.Rift && ns.Rift.inArena) || judging;
    const W = ns.World;

    const pSpd = (p.baseSpd || 100) * (p.spdMul || 1);
    const bigFear = Math.max(1, fear);
    const red = 1 - Math.min(0.8, p.reduction ?? p.dmgReduce ?? 0);
    const hitFrac = (dmg, pure) => Math.min(1, (dmg || 0) * (pure ? 1 : red) / p.maxHp);
    const hazFrac = h => Math.min(1, (h.pct ? Math.max(h.dmg || 0, p.maxHp * h.pct) : (h.dmg || 0)) * (h.pure ? 1 : red) / p.maxHp);
    const DMG_W = hpPct < 0.6 ? 160 : 90, TOUCH_W = S.farm ? (hpPct > 0.8 ? 16 : 24) : hpPct < 0.35 ? 160 : hpPct < 0.6 ? 100 : 30;
    const shotW = sh => S.farm ? Math.min(1, 0.2 + 8 * hitFrac(sh.dmg, false)) : 1;
    const danger = (x, y, tAhead) => {
      let c = 0, big = 0, worst = 0, haz = 0;
      for (const e of near) {
        const spd = e.arceus ? pSpd * 1.2 : e.spd || 40, fast = Math.min(2, spd / pSpd);
        const d = Math.hypot(x - e.x, y - e.y) - (e.r || 10) - p.r - spd * tAhead * 0.8;
        const reach = (e.arceus ? 140 : e.boss ? 90 : 35) + 45 * fast;
        const w = e.arceus ? 8 : (e.boss ? 4 : 1) * Math.min(3, Math.max(0.5, (e.dmg || 10) / (p.maxHp * 0.12)));
        const v = w * Math.exp(-Math.max(d, -20) / reach);
        if (e.boss || e.arceus) big += v; else c += v;
        const touch = Math.exp(-Math.max(0, d) / 18);
        worst = Math.max(worst, touch * (e.arceus ? 0.4 : hitFrac(e.dmg, false)));
      }
      for (const s of shots) {
        const sx = s.x + (s.vx || 0) * tAhead, sy = s.y + (s.vy || 0) * tAhead;
        const d = Math.hypot(x - sx, y - sy) - (s.r || 6) - p.r;
        big += 6 * shotW(s) * Math.exp(-Math.max(d, -10) / 30);
        worst = Math.max(worst, Math.exp(-Math.max(0, d) / 20) * Math.max(0.03, hitFrac(s.dmg, false)));
      }
      for (const h of hazards) if (!h.hit && inHazard(h, x, y, p.r)) { big += 25; haz += hazFrac(h); }
      return c * fear + big * bigFear + worst * TOUCH_W + haz * DMG_W;
    };
    const wet = wetOk(ns, p), slowWet = wet && wetSlow(ns, p) < 1 && W && W.isLiquid;
    const free = (x, y) => !W || !W.isFree || W.isFree(x, y, p.r, wet);
    const traps = ((W && W.specialsNear && W.specialsNear(p.x, p.y, 400)) || []).filter(t => t.type === 'trap');
    const onTrap = (x, y) => traps.some(t => (x - t.x) ** 2 + (y - t.y + 8) ** 2 < 23 * 23);
    const pathLen = (dx, dy, step) => {
      for (let t = 12; t <= step; t += 12) {
        const x = p.x + dx * t, y = p.y + dy * t;
        if (!free(x, y) || onTrap(x, y)) return t - 12;
      }
      return step;
    };
    const RING = DIRS.filter((_, i) => i % 2 === 0);
    const cramped = (x, y) => { let n = 0; for (const [rx, ry] of RING) if (!free(x + rx * 45, y + ry * 45)) n++; return n; };
    const los = (x1, y1, x2, y2) => {
      if (!W || !W.projectileBlock) return true;
      const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 12);
      for (let i = 1; i < n; i++) if (W.projectileBlock(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n - (ns.LIFT || 0), 4)) return false;
      return true;
    };
    const aimTargets = near.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 10);
    const lockedFrom = (x, y) => {
      const fe = cfg.focus && S.focusEnemy && !S.focusEnemy.dead && !S.focusEnemy.arceus ? S.focusEnemy : null;
      if (fe && Math.hypot(fe.x - x, fe.y - y) < 520) return fe;   // đang tập trung hỏa lực: xem con đang đánh
      let boss = null, nearest = null, nd = 520;
      for (const e of aimTargets) {
        if (e.arceus) continue;   // Arceus không đánh chết được, không vì đánh nó mà đổi vị trí (bản cũ tìm góc bắn quanh nó, đi thẳng tới nộp mạng)
        const d = Math.hypot(e.x - x, e.y - y);
        if (e.boss && d < 330) boss = e;
        if (d < nd) { nd = d; nearest = e; }
      }
      return boss || nearest;
    };
    const blockedShot = (x, y) => { const e = lockedFrom(x, y); return e && !los(x, y, e.x, e.y) ? 1 : 0; };
    const shootable = aimTargets.filter(e => !e.arceus && Math.hypot(e.x - p.x, e.y - p.y) < 520).slice(0, 6);
    const blockedFrac = (x, y) => { if (!shootable.length) return 0; let b = 0; for (const e of shootable) if (!los(x, y, e.x, e.y)) b++; return b / shootable.length; };
    S.losTarget = lockedFrom(p.x, p.y);
    S.losBadT = blockedShot(p.x, p.y) || blockedFrac(p.x, p.y) >= 0.5 ? (S.losBadT || 0) + dt : 0;
    if (S.losBadT === 0 && S.plan && S.plan.key.startsWith('los')) S.plan = null;   // đã đánh tới được rồi, không cần đi tiếp tới điểm đó
    const losW = S.losBadT > 0.25 ? 6 : 2;

    const here = danger(p.x, p.y, 0);
    let kite = null;
    S.stand = false;
    const hadTarget = S.hadTarget; S.hadTarget = !!target && here <= 2;
    const ar = judging ? (S.jCenter && { x: S.jCenter.x, y: S.jCenter.y, r: 24, judge: true }) : arena && ns.Rift.arena;
    if (ar) {
      const boss = ar.judge ? arceus : (ar.bossId && ns.EnemyMgr.get && ns.EnemyMgr.get(ar.bossId)) || near.find(e => e.boss);
      const unit = unitPx;
      const edge = Math.max(80, (ar.r - 1.4) * unit - p.r - 6);   // bán kính tối đa đứng được trong sân
      const ring = edge * (ar.judge ? 0.55 : 0.82);
      let px0 = p.x - ar.x, py0 = p.y - ar.y; const pr = Math.hypot(px0, py0) || 1;
      const pa = Math.atan2(py0, px0);
      let kx = 0, ky = 0, w = 1.8;
      if (boss && !boss.dead) {
        const ba = Math.atan2(boss.y - ar.y, boss.x - ar.x);
        let delta = pa - ba; while (delta > Math.PI) delta -= 2 * Math.PI; while (delta < -Math.PI) delta += 2 * Math.PI;
        if (Math.abs(delta) < Math.PI * 0.85) S.spin = delta >= 0 ? 1 : -1;
        const aim = pa + S.spin * 0.55;
        kx = ar.x + Math.cos(aim) * ring - p.x; ky = ar.y + Math.sin(aim) * ring - p.y;
        const bd = Math.hypot(p.x - boss.x, p.y - boss.y);
        if (bd < (ar.judge ? 240 : 180)) {                   // đã bị áp sát: kéo giãn khoảng cách là quan trọng nhất (Arceus chạm một cái 40%, chừa thêm chỗ)
          const ux = (p.x - boss.x) / (bd || 1), uy = (p.y - boss.y) / (bd || 1);
          const kl0 = Math.hypot(kx, ky) || 1;
          kx = kx / kl0 + ux * 1.5; ky = ky / kl0 + uy * 1.5;
          w = 3.5;
        }
      } else if (!ar.judge) {
        kx = ar.x - p.x; ky = ar.y - p.y;                   // thần thú Bí cảnh chưa ra: đứng giữa trước
        if (pr < 40) kx = ky = 0;
      }                                                     // trong Phán Xét không tìm thấy Arceus: tạm không động (nó sẽ giáng xuống gần giữa)
      const kl = Math.hypot(kx, ky);
      if (kl > 0.01) kite = { x: kx / kl, y: ky / kl, w };
    } else if ((!target || here > 2) && !(target && target.hold) && !(target && target.chase && here < 4)) {
      if (hadTarget) S.loopC = null;   // vừa nhặt xong cầu EXP / làm xong việc: vẽ lại vòng theo hướng đi hiện tại, đừng bị kéo về vòng cũ (sẽ quay đầu)
      let R = 380, c = S.loopC;
      const v = S.out || [1, 0];
      const anchor = () => ({ x: p.x - R * S.spin * v[1], y: p.y + R * S.spin * v[0] }); // để vị trí hiện tại nằm đúng trên vòng, hướng đi là tiếp tuyến
      let herd = null;
      if (S.farm) {
        let n = 0, hx = 0, hy = 0;
        for (const e of near) if (!e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 400) { n++; hx += e.x; hy += e.y; }
        if (n >= 6) {
          hx /= n; hy /= n;
          let sp = 0;
          for (const e of near) if (!e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 400) sp += Math.hypot(e.x - hx, e.y - hy);
          herd = { x: hx, y: hy, r: sp / n };
        }
      }
      let sparse = null;
      if (!herd) {
        let n = 0, cx = 0, cy = 0, ws = 0, dmin = Infinity;
        for (const e of near) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d > 450) continue;
          if (!e.boss) n++;
          const w = (e.boss ? 3 : 1) / Math.max(40, d);
          cx += e.x * w; cy += e.y * w; ws += w; dmin = Math.min(dmin, d - (e.r || 10));
        }
        if (n < 6 && ws > 0) {
          cx /= ws; cy /= ws;
          let ax = p.x - cx, ay = p.y - cy; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
          const st = S.sparseSt, held = gt - (S.sparseAt || 0) < 0.6;
          let want = st || 'stand';
          if (!held) {
            if (dmin < 200 || (st === 'back' && dmin < 300)) want = 'back';
            else if (dmin > 430 || (st === 'near' && dmin > 340)) want = 'near';
            else want = 'stand';
          }
          if (dmin < 120) want = 'back';   // sắp bị dí mặt: bất kể thời gian dừng, lùi ngay
          if (want === 'back' && pathLen(ax, ay, 120) < 60) want = null;   // phía sau là tường: lui về đi vòng
          if (want !== st) { S.sparseSt = want; S.sparseAt = gt; }
          if (want === 'back') sparse = { k: { x: ax, y: ay, w: 2.4 }, label: 'Giãn khoảng cách' };
          else if (want === 'near') sparse = { k: { x: -ax, y: -ay, w: 0.6 }, label: 'Áp sát' };
          else if (want === 'stand') { S.stand = true; sparse = { k: { x: ax, y: ay, w: 0.3 }, label: 'Đứng yên bắn' }; }
        }
      }
      if (sparse) { kite = sparse.k; S.kiteLabel = sparse.label; }
      else {
        S.kiteLabel = S.farm ? 'Gom quái' : 'Dắt quái';
        if (herd) {
          R = Math.max(140, Math.min(240, herd.r + (hpPct > 0.8 ? 80 : 120)));   // sát rìa bầy quái: quá xa Whirlpool không tới được bầy chính, vị trí quái chết nam châm cũng không hút tới
          c = S.loopC = S.loopC && S.herdLoop ? { x: S.loopC.x + (herd.x - S.loopC.x) * Math.min(1, dt * 2), y: S.loopC.y + (herd.y - S.loopC.y) * Math.min(1, dt * 2) } : { x: herd.x, y: herd.y };
          S.herdLoop = true;
        } else {
          if (S.herdLoop) { S.herdLoop = false; c = S.loopC = null; }
          if (S.farm) R = 220;
          if (!c || Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - R) > R * 0.6) c = S.loopC = anchor();
        }
        let rx = p.x - c.x, ry = p.y - c.y; const rd = Math.hypot(rx, ry) || 1; rx /= rd; ry /= rd;
        const ang = Math.atan2(ry, rx) + S.spin * 0.5;
        let kx = c.x + Math.cos(ang) * R - p.x, ky = c.y + Math.sin(ang) * R - p.y;
        const kl = Math.hypot(kx, ky) || 1; kx /= kl; ky /= kl;
        kite = { x: kx, y: ky, w: 1.6 + Math.min(1.5, here * 0.4) };
        S.spinBlockT = pathLen(kx, ky, 90) < 60 ? S.spinBlockT + dt : 0;
        if (S.spinBlockT > 0.6) { S.spin *= -1; S.spinBlockT = 0; S.loopC = null; }
      }
    }
    const hazardHits = (dx, dy) => {
      if (!hazards.length) return 0;
      const reach = pathLen(dx, dy, 240);
      let hit = 0, frac = 0;
      for (const h of hazards) {
        if (h.hit) continue;
        const tr = Math.max(0, (h.delay || 0) - (h.t || 0));
        const t2 = Math.min(tr * pSpd * 0.9, reach);   // 0.9: hao hụt do đổi hướng và tăng tốc
        if (inHazard(h, p.x + dx * t2, p.y + dy * t2, p.r + 4)) { hit += 1; frac += hazFrac(h); }
      }
      return hit * 30 * bigFear + frac * DMG_W * 1.5;
    };
    const cost = DIRS.map(([dx, dy]) => {
      let bestStep = Infinity;
      for (const step of [55, 120, 200]) {
        const reach = pathLen(dx, dy, step);
        if (reach < 12) continue;                       // ngay phía trước là tường / bẫy
        const x = p.x + dx * reach, y = p.y + dy * reach;
        let c = danger(x, y, reach / pSpd);
        c += (reach < step ? 6 + 6 * (1 - reach / step) : 0) + cramped(x, y) * 1.2 + (slowWet && W.isLiquid(x, y) ? 1.2 : 0);   // trong nước sẽ chậm, đi được trên cạn thì đi trên cạn
        if (target) {
          const before = Math.hypot(target.x - p.x, target.y - p.y), after = Math.hypot(target.x - x, target.y - y);
          c -= target.w * (before - after) / step;   // bị tường chắn chỉ đi được một nửa, lợi ích cũng chỉ tính một nửa
        }
        bestStep = Math.min(bestStep, c);
      }
      if (bestStep === Infinity) return Infinity;
      bestStep += hazardHits(dx, dy);
      bestStep += losW * (blockedShot(p.x + dx * 90, p.y + dy * 90) + blockedFrac(p.x + dx * 90, p.y + dy * 90));
      if (kite) bestStep -= kite.w * (dx * kite.x + dy * kite.y);
      else if (!target && !arena) bestStep -= 0.3 * (dx * Math.cos(S.wanderA) + dy * Math.sin(S.wanderA)); // rảnh rỗi: từ từ đi vòng theo vòng lớn
      return bestStep;
    });
    const sm = cost.map((c, i) => c === Infinity ? Infinity : 0.5 * c + 0.25 * (Math.min(cost[(i + 15) % 16], c + 3) + Math.min(cost[(i + 1) % 16], c + 3)));
    let bi = -1;
    for (let i = 0; i < 16; i++) if (sm[i] < Infinity && (bi < 0 || sm[i] < sm[bi])) bi = i;
    if (!target) S.wanderA += dt * 0.35;
    S.mode = judging ? (here > 2 ? 'Phán Xét: Né' : 'Phán Xét: Vòng sân') : arena ? (here > 2 ? 'Bí cảnh: Né' : 'Bí cảnh: Đánh BOSS') : here > 2 ? 'Né tránh' : target && (target.chase || target.hold) ? target.mode : kite ? (S.kiteLabel || 'Dắt quái') : target ? target.mode : 'Đi dạo';
    const escape = () => {
      let bd = null, bs = -Infinity;
      for (const [dx, dy] of DIRS) {
        let r = pathLen(dx, dy, 120);
        if (r < 12) for (let t2 = 6; t2 <= 40; t2 += 6) { if (W && W.isFree && !W.isFree(p.x + dx * t2, p.y + dy * t2, p.r * 0.5, wet)) break; r = t2 * 0.5; }
        const sc = r - cramped(p.x + dx * r, p.y + dy * r) * 15 - danger(p.x + dx * r, p.y + dy * r, 0.5) * 20;
        if (sc > bs) { bs = sc; bd = [dx, dy]; }
      }
      return bd || DIRS[(Math.random() * 16) | 0];
    };
    if (bi < 0) { S.unstickT = Math.max(S.unstickT, 0.4); S.unstickDir = escape(); bi = 0; }
    let urgent = 0;
    for (const sh of shots) urgent += 6 * shotW(sh) * Math.exp(-Math.max(Math.hypot(p.x - sh.x, p.y - sh.y) - (sh.r || 6) - p.r, -10) / 30);
    for (const h of hazards) if (!h.hit && inHazard(h, p.x, p.y, p.r + 4)) urgent += 25;
    const emergency = urgent > 4;
    S.holdT -= dt;
    const keep = S.dirIdx >= 0 && sm[S.dirIdx] < Infinity && (emergency ? sm[S.dirIdx] - sm[bi] < 3 && S.holdT > 0 : S.holdT > 0 || sm[S.dirIdx] - sm[bi] < (S.farm ? 1.2 : 0.6));
    if (keep) bi = S.dirIdx;
    else if (bi !== S.dirIdx) { S.dirIdx = bi; S.holdT = emergency ? 0.25 : S.farm ? 0.3 : 0.15; }   // gom quái thì giữ hướng ít nhất 0.3 giây, đừng nóng vội
    let best = DIRS[bi];
    S.holding = false;
    if (target && target.hold && here < 4) {
      const d = Math.hypot((target.fx ?? target.x) - p.x, (target.fy ?? target.y) - p.y);
      if (d < target.hold && !(target.until && target.until())) {
        const key = S.plan && S.plan.key;
        if (S.holdKey !== key) { S.holdKey = key; S.holdSince = gt; }
        const limit = target.escort ? 20 : target.mode === 'Mở rương' ? 6 : 10;
        if (gt - S.holdSince < limit) { S.holding = true; S.wd = null; return [0, 0]; }
        if (key) { S.ban[key] = gt + 30; S.plan = null; log('give up', key); }
      }
    }
    if (target && target.fx !== undefined && here < 2) {
      const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy) || 1;
      const safe = !hazards.some(h => !h.hit && inHazard(h, p.x + dx / d * 30, p.y + dy / d * 30, p.r));
      if (safe && d > 4) best = [dx / d, dy / d];
    }
    if (S.stand && !emergency && here < 1.5 && !S.losBadT && !(target && target.orb) && !hazards.some(h => !h.hit && inHazard(h, p.x, p.y, p.r + 10))) {
      S.mode = 'Đứng yên bắn'; S.wd = null; S.stuckT = 0; S.lastPos = [p.x, p.y];
      return [0, 0];
    }
    if (!arena && !emergency && !(S.farm && hpPct > 0.5)) {
      let close = 0; const sect = new Set();
      for (const e of near) {
        if (e.boss) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) - (e.r || 10) - p.r > 70) continue;
        close++; sect.add((Math.round(Math.atan2(e.y - p.y, e.x - p.x) / (Math.PI / 4)) + 8) % 8);
      }
      if (S.breakT > 0 && close >= 3 && pathLen(S.breakDir[0], S.breakDir[1], 40) >= 24) { S.breakT -= dt; best = S.breakDir; S.mode = 'Phá vây'; }
      else {
        S.breakT = 0;
        if (close >= 5 && sect.size >= 6) {
          let bd = null, bs = Infinity;
          for (const [dx, dy] of DIRS) {
            const reach = pathLen(dx, dy, 160);
            if (reach < 40) continue;
            let c = (160 - reach) / 20 + hazardHits(dx, dy);   // phía trước nhanh chóng đụng tường, hoặc hướng lao vào cảnh báo thì không tốt
            for (const e of near) {
              const ex = e.x - p.x, ey = e.y - p.y, d = Math.hypot(ex, ey) || 1, cos = (ex * dx + ey * dy) / d;
              if (cos > 0) c += (e.boss ? 4 : 1) * (0.5 + 10 * hitFrac(e.dmg, false)) * cos * cos * 100 / Math.max(30, d);
            }
            if (target) c -= 0.5 * (dx * (target.x - p.x) + dy * (target.y - p.y)) / (Math.hypot(target.x - p.x, target.y - p.y) || 1);
            if (c < bs) { bs = c; bd = [dx, dy]; }
          }
          if (bd) { S.breakDir = bd; S.breakT = 2.5; best = bd; S.mode = 'Phá vây'; S.dirIdx = -1; }
        }
      }
    }
    if (judging && arceus && !emergency) {
      const ax = arceus.x - p.x, ay = arceus.y - p.y, ad = Math.hypot(ax, ay) || 1;
      if (S.jBreakT > 0) {
        S.jBreakT -= dt;
        const [dx, dy] = S.jBreakDir;
        if (pathLen(dx, dy, 40) < 24 || (ad < 170 && (ax * dx + ay * dy) / ad > 0.4) || hazardHits(dx, dy) > 0) S.jBreakT = 0;
        else { best = S.jBreakDir; S.mode = 'Phán Xét: Phá vây'; }
      } else if (S.jCenter && hpPct >= 0.5) {
        const maxR = (24 - 1.4) * unitPx - p.r - 6;
        const edgeD = Math.hypot(p.x - S.jCenter.x, p.y - S.jCenter.y);
        const legs = near.filter(e => e.boss && !e.arceus && Math.hypot(e.x - p.x, e.y - p.y) < 220);
        const hazNear = hazards.filter(h => !h.hit && inHazard(h, p.x, p.y, 200)).length;
        if (((edgeD > maxR - 110 && legs.length >= 1) || legs.length >= 3) && hazNear <= 1) {
          let bd = null, bs = Infinity;
          for (const [dx, dy] of DIRS) {
            const reach = pathLen(dx, dy, 160);
            if (reach < 60) continue;
            if ((ax * dx + ay * dy) / ad > 0.2 && ad < 320) continue;   // Arceus chạm một cái mất trên 40%, phía đó không lao
            let c = (160 - reach) / 20 + hazardHits(dx, dy);
            for (const e of legs) {
              const ex = e.x - p.x, ey = e.y - p.y, d = Math.hypot(ex, ey) || 1, cos = (ex * dx + ey * dy) / d;
              if (cos > 0) c += (0.5 + 10 * hitFrac(e.dmg, false)) * cos * cos * 100 / Math.max(30, d);
            }
            c -= 1.5 * (dx * (S.jCenter.x - p.x) + dy * (S.jCenter.y - p.y)) / (edgeD || 1);   // hướng vào giữa
            if (c < bs) { bs = c; bd = [dx, dy]; }
          }
          if (bd) { S.jBreakDir = bd; S.jBreakT = 1.2; best = bd; S.mode = 'Phán Xét: Phá vây'; S.dirIdx = -1; }
        }
      }
    }
    if (S.lastPos) {
      const moved = Math.hypot(p.x - S.lastPos[0], p.y - S.lastPos[1]);
      S.stuckT = moved < 0.3 ? S.stuckT + dt : 0;
    }
    S.lastPos = [p.x, p.y];
    if (!S.wd || S.holding) S.wd = { x: p.x, y: p.y, t: gt };
    else if (gt - S.wd.t > 3) {
      if (Math.hypot(p.x - S.wd.x, p.y - S.wd.y) < 10) {
        log('watchdog: stuck, escaping');
        if (S.plan) { S.ban[S.plan.key] = gt + 15; S.plan = null; }
        S.loopC = null; S.unstickT = 0.8; S.unstickDir = escape();
      }
      S.wd = { x: p.x, y: p.y, t: gt };
    }
    if (S.stuckT > 0.4) { S.stuckT = 0; S.unstickT = 0.5; S.unstickDir = escape(); }   // bị kẹt: thoát theo hướng thoáng nhất và không nguy hiểm
    if (S.unstickT > 0) { S.unstickT -= dt; best = S.unstickDir; }
    const reversing = S.out[0] * best[0] + S.out[1] * best[1] < -0.2;   // khi cần quay ngược hướng thì quay thẳng, lấy trung bình sẽ triệt tiêu thành 0 mà dừng
    const a = emergency || reversing || S.unstickT > 0 ? 1 : Math.min(1, dt * 12);
    let ox = S.out[0] * (1 - a) + best[0] * a, oy = S.out[1] * (1 - a) + best[1] * a;
    const ol = Math.hypot(ox, oy) || 1;
    S.out = [ox / ol, oy / ol];
    if (!isFinite(S.out[0]) || !isFinite(S.out[1])) { S.out = escape(); S.loopC = null; S.plan = null; }
    return S.out;
  }
  const UPG_VALUE = { def: 1.2, xp: 1.15, atk: 1.1, cd: 1.1, coins: 1.1, reroll: 1.0, hp: 0.9, magnet: 0.9, crit: 0.8, regen: 0.8, spd: 0.4 };
  const UPG_CAP = { coins: 5, reroll: 3 };   // mấy mục này chỉ nâng tới đây là đủ
  let lastUpgrade = 0;
  function autoUpgrade(ns) {
    if (!cfg.upgrade || ns.Game.state !== 'ui' || !ns.Upgrades || !ns.DB || !ns.DB.save) return;
    if (performance.now() - lastUpgrade < 3000) return;
    lastUpgrade = performance.now();
    const sv = ns.DB.save, dex = sv.partner;
    if (!dex || !ns.DEX_BY[dex]) return;
    const upg = ns.DB.upgradesOf(dex), U = ns.Upgrades, prof = cfg.profiles[dex];
    const choices = ns.startChoices ? ns.startChoices(dex) : [];
    const bought = [];
    const buy = id => {
      const lvl = upg[id] || 0, def = U.BY[id];
      if (!def || lvl >= def.max || (def.needs && !upg[def.needs])) return false;
      const cost = U.cost(id, lvl);
      if (sv.coins < cost) return false;
      sv.coins -= cost; upg[id] = lvl + 1; bought.push(`${def.name} ${lvl + 1}`);
      return true;
    };
    const single = m => (m.kind === 'projectile' && (m.count || 1) <= 2) || m.kind === 'homing' || m.kind === 'beam';
    const autoPick = exclude => {
      const mon = ns.DEX_BY[dex];
      let best = null, bs = -Infinity;
      for (const id of choices) {
        const m = ns.Moves.BY_ID[id];
        if (!m || m.kind === 'buff' || id === exclude) continue;
        const fit = m.cat ? ns.Stats.fit(mon, m.cat) : 1;
        const sc = (single(m) ? 1000 : 0) + (m.dmg || 10) / (m.cd || 1) * fit * ((mon.types || []).includes(m.type) ? 1.2 : 1) + (m.homing || m.kind === 'homing' ? 3 : 0);
        if (sc > bs) { bs = sc; best = id; }
      }
      return best;
    };
    cfg.botStart = cfg.botStart || {}; cfg.botStart2 = cfg.botStart2 || {};
    const mine = (store, rec, legacyOk) => store[dex] === undefined || store[dex] === rec[dex] || (rec[dex] === undefined && legacyOk(store[dex]));
    const want1 = prof ? prof.moves.find(id => choices.includes(id)) : autoPick();
    sv.pstart = sv.pstart || {};
    if (want1 && mine(sv.pstart, cfg.botStart, id => !ns.Moves.BY_ID[id] || !single(ns.Moves.BY_ID[id]))) {
      if (want1 !== ns.baseStartOf(dex) && !upg.start) buy('start');
      if (upg.start && sv.pstart[dex] !== want1 && !(sv.pstart[dex] === undefined && want1 === ns.baseStartOf(dex))) {
        sv.pstart[dex] = want1; bought.push('Chiêu mở đầu→' + want1);
      }
      if (sv.pstart[dex] !== undefined) cfg.botStart[dex] = sv.pstart[dex];
    }
    const want2 = prof ? prof.moves.find(id => choices.includes(id) && id !== want1) : choices.includes('harden') ? 'harden' : autoPick(want1);
    sv.pstart2 = sv.pstart2 || {};
    if (want2 && mine(sv.pstart2, cfg.botStart2, () => false)) {
      if (!upg.moves) buy('moves');
      if (upg.moves && !upg.start2) buy('start2');
      if (upg.start2 && sv.pstart2[dex] !== want2) { sv.pstart2[dex] = want2; cfg.botStart2[dex] = want2; bought.push('Chiêu mở đầu 2→' + want2); }
    }
    save();
    for (let guard = 0; guard < 50; guard++) {
      let best = null, bs = 0;
      for (const [id, v] of Object.entries(UPG_VALUE)) {
        const def = U.BY[id], lvl = upg[id] || 0;
        if (!def || lvl >= Math.min(def.max, UPG_CAP[id] ?? def.max)) continue;
        const cost = U.cost(id, lvl);
        if (cost > sv.coins) continue;
        const sc = v / cost;
        if (sc > bs) { bs = sc; best = id; }
      }
      if (!best || !buy(best)) break;
    }
    if (bought.length) {
      ns.DB.commit(true);
      ns.UI.refreshCoins && ns.UI.refreshCoins();
      log('upgrade', ns.DEX_BY[dex].name, bought.join(', '), 'còn', sv.coins);
      S.lastUpgradeMsg = bought.slice(-3).join(', ');
    }
  }
  let lastGacha = 0;
  function gachaBanner(ns, sv) {
    const G = ns.Gacha;
    let best = null, bs = -Infinity;
    for (const b of G.BANNERS) {
      if (!G.isOpen(b.gen)) continue;
      const pity = (sv.pity || {})[b.gen] || 0;
      const missing = (G.featured(b.gen) || []).filter(d => !sv.owned[d]).map(d => ns.DEX_BY[d].bst || 0);
      const top = missing.length ? Math.max(...missing) : 0;
      const wantHere = (cfg.favorites || []).some(d => !sv.owned[d] && ns.DEX_BY[d] && ns.DEX_BY[d].gen === b.gen);
      const sc = pity * 3 + (top ? 40 + (top - 600) / 5 : 0) + (wantHere ? 200 : 0);
      if (sc > bs) { bs = sc; best = b.gen; }
    }
    return best;
  }
  function autoGacha(ns) {
    if (!cfg.gacha || ns.Game.state !== 'ui' || !ns.Gacha || !ns.DB || !ns.DB.save) return;
    if (performance.now() - lastGacha < 5000) return;
    lastGacha = performance.now();
    const sv = ns.DB.save, t = sv.tickets || {};
    const got = [];
    let pulls = 0;
    for (let i = 0; i < 30; i++) {
      const type = (t.t10 || 0) >= 1 ? 't10' : (t.t1 || 0) >= 10 ? 't1' : null;
      if (!type) break;
      const gen = gachaBanner(ns, sv);
      const res = gen && ns.Gacha.pull(sv, 10, gen, type);
      if (!res) break;
      pulls++;
      for (const r of res) if (r.isNew || r.rarity >= 4) got.push(`${ns.DEX_BY[r.dex].name}${r.shiny ? '✨' : ''}${r.rarity >= 5 ? '★' : ''}`);
    }
    if (!pulls) return;
    ns.Progress && ns.Progress.checkAch && ns.Progress.checkAch();
    ns.DB.commit(true);
    ns.UI.refreshCoins && ns.UI.refreshCoins();
    log('gacha', pulls * 10, 'lượt quay', got.join(', '));
    if (got.length) S.lastGachaMsg = got.slice(-4).join(', ');
  }
  const WEATHER_OF = { drizzle: 'water', drought: 'fire', 'sand-stream': 'rock', 'snow-warning': 'ice' };
  const WEATHER_MUL = { water: 1.5, fire: 1.5, rock: 1.3, ice: 1.3 };
  const AFK_KINDS = ['homing', 'aura', 'orbit', 'nova'];
  function power(ns, sv, dex) {
    const mon = ns.DEX_BY[dex];
    if (!mon) return 0;
    let pool = [];
    try { pool = ns.startChoices ? ns.startChoices(dex) : []; } catch {}
    const abil = ((ns.DEX_ABIL && ns.DEX_ABIL[dex]) || []).filter(Boolean);
    let off = 0;
    for (const id of pool) {
      const m = ns.Moves.BY_ID[id];
      if (!m || !(AFK_KINDS.includes(m.kind) || (m.kind === 'projectile' && m.homing))) continue;   // Confusion là "đạn đuổi"
      let v = (mon.atk || 1) * (m.cat ? ns.Stats.fit(mon, m.cat) : 1);
      if (mon.types.length === 1 && m.type === mon.types[0]) v *= 1.2;
      for (const a of abil) if (WEATHER_OF[a] === m.type) v *= WEATHER_MUL[m.type];
      off = Math.max(off, v);
    }
    if (!off) off = (mon.atk || 1) * 0.6;   // không có chiêu nào khỏi cần ngắm
    const tough = Math.sqrt((mon.hp || 80) / 100 * (((mon.df || 60) + (mon.sd || 60)) / 180));
    const u = (sv.pupg || {})[dex] || {};
    const inv = 0.04 * (u.atk || 0) + 0.03 * (u.cd || 0) + 0.02 * (u.def || 0) + 0.01 * (u.hp || 0) + 0.015 * (u.crit || 0) + 0.01 * (u.regen || 0);
    const fav = (cfg.favorites || []).includes(dex) ? 1.3 : 1;
    return off * Math.sqrt(tough) * (0.8 + 0.2 * (mon.spd || 100) / 110) * (1 + inv) * fav;
  }
  let lastPartner = 0;
  function autoPartner(ns) {
    if (!cfg.autoPartner || ns.Game.state !== 'ui' || !ns.DB || !ns.DB.save) return;
    if (performance.now() - lastPartner < 5000) return;
    lastPartner = performance.now();
    const sv = ns.DB.save, cur = sv.partner;
    let best = cur, bp = power(ns, sv, cur);
    for (const d of Object.keys(sv.owned || {})) {
      const pw = power(ns, sv, +d);
      if (pw > bp) { bp = pw; best = +d; }
    }
    if (best === cur || bp < power(ns, sv, cur) * 1.15) return;
    sv.partner = best;
    sv.partnerShiny = !!(sv.shiny && sv.shiny[best]);
    ns.DB.commit();
    log('partner', ns.DEX_BY[cur] && ns.DEX_BY[cur].name, '→', ns.DEX_BY[best].name);
    S.lastPartnerMsg = `Đổi thành ${ns.T ? ns.T(ns.DEX_BY[best].name) : ns.DEX_BY[best].name}`;
    ns.Flow && ns.Flow.goMenu && ns.Flow.goMenu();
  }
  function autoRestart(ns) {
    if (!cfg.on || !cfg.restart || !['ui', 'over'].includes(ns.Game.state)) return;
    const open = id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); };
    for (const [scr, btn] of [['scr-savenote', 'savenote-ok'], ['scr-news', 'news-close'], ['scr-nick', 'nick-later'], ['scr-recover', 'rec-later']]) {
      if (open(scr)) { document.getElementById(btn)?.click(); return; }
    }
    if (open('scr-over')) { if (now() - S.overAt > 4000) document.getElementById('btn-again')?.click(); return; }
    if (open('scr-menu') && now() - S.lastPlay > 6000 && now() - S.overAt > 5000) {
      S.lastPlay = now();
      document.querySelector('#scr-menu [data-go=play]')?.click();
    }
  }
  const now = () => performance.now();
  addEventListener('keydown', e => {
    if ((e.key === 'Escape' || e.code === 'KeyP') && window.__PSBOT && window.__PSBOT.ns.Game.state === 'playing') S.userPausedAt = now();
  }, true);
  function autoResume(ns) {
    const st = ns.Game.state;
    if (st === 'playing') { if (now() - S.userPausedAt > 1000) S.userPausedAt = -1e9; S.pausedAt = 0; return; }
    if (st !== 'paused' || S.userPausedAt > 0 || document.visibilityState !== 'visible') { S.pausedAt = 0; return; }
    if (!S.pausedAt) S.pausedAt = now();
    else if (now() - S.pausedAt > 1500) { S.pausedAt = 0; log('auto resume'); ns.Game.togglePause(); }
  }
  const REPO = 'BoundlessEgret/pokesurvivor-autofarm';
  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  async function checkUpdate(link) {
    if (typeof GM_info !== 'undefined') return;   // script Tampermonkey
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem('psbot.update') || '{}'); } catch {}
    if (!cache.at || Date.now() - cache.at > 6 * 3600e3) {
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
        if (r.ok) { const j = await r.json(); cache = { at: Date.now(), latest: String(j.tag_name || '').replace(/^v/, ''), url: j.html_url }; }
        else cache = { at: Date.now(), latest: cache.latest, url: cache.url };
        localStorage.setItem('psbot.update', JSON.stringify(cache));
      } catch {}
    }
    if (cache.latest && newer(cache.latest, VERSION)) {
      link.href = cache.url || `https://github.com/${REPO}/releases/latest`;
      link.textContent = `Có phiên bản mới v${cache.latest} (hiện tại v${VERSION}), bấm vào đây để tải`;
      link.style.display = 'block';
      log('update available', cache.latest);
    }
  }

  function buildPanel(ns) {
    const css = `
#psbot{position:fixed;z-index:2147483000;top:${cfg.panelY ?? 64}px;left:${cfg.panelX ?? 12}px;width:230px;color:#e8ecf6;background:rgba(14,18,32,.9);border:1px solid #3a4466;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.45);user-select:none}
#psbot,#psbot *{box-sizing:border-box;margin:0;font:11px/1.4 system-ui,-apple-system,"PingFang TC",sans-serif!important;letter-spacing:0!important;text-transform:none!important;text-shadow:none!important;min-height:0!important}
#psbot .hd{display:flex;align-items:center;gap:4px;padding:4px 6px;cursor:move}
#psbot .hd b{flex:1;font-weight:700!important}
#psbot button{color:#e8ecf6;background:#2a3355;border:1px solid #46527e;border-radius:5px;padding:1px 6px;cursor:pointer}
#psbot button.on{background:#c2357a;border-color:#ff8ad8}
#psbot .bd{padding:4px 6px 6px;display:grid;gap:4px;border-top:1px solid #2a3150}
#psbot.min .bd{display:none}
#psbot .st{color:#9fb1c9;white-space:pre-line!important}
#psbot details{border-top:1px solid #2a3150;padding-top:3px}
#psbot summary{cursor:pointer;color:#ff8ad8}
#psbot .opts{display:grid;gap:1px;padding:3px 0 0}
#psbot label{display:flex;align-items:center;gap:5px;padding:0!important;cursor:pointer}
#psbot input[type=checkbox]{width:12px;height:12px;flex:none}
#psbot .chips{display:flex;flex-wrap:wrap;gap:3px;padding:3px 0}
#psbot .chip{background:#33406a;border-radius:9px;padding:0 6px;cursor:pointer}
#psbot .chip:hover{background:#7a2a55}
#psbot select{color:#e8ecf6;background:#1b2240;border:1px solid #46527e;border-radius:5px;padding:1px 2px}
#psbot .row{display:flex;gap:4px;align-items:center;margin-top:3px}
#psbot .row select{flex:1;min-width:0}`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'psbot'; if (cfg.collapsed) el.classList.add('min');
    el.innerHTML = `
<div class="hd"><b>PSBot Tự động treo máy <span style="opacity:.6;font-weight:400">v${VERSION}</span></b><button data-k="toggle">OFF</button><button data-k="home" title="Đưa bảng về góc trên trái (Shift+F8)">⌂</button><button data-k="min">–</button></div>
<div class="bd">
  <div class="st" data-k="status"></div>
  <details data-k="optsBox"><summary>Cài đặt</summary><div class="opts">
    <label><input type="checkbox" data-o="move">Tự động di chuyển</label>
    <label><input type="checkbox" data-o="cards">Tự động chọn thẻ (bị động > nâng cấp chủ động)</label>
    <label><input type="checkbox" data-o="bonds">Tự động Bond (theo thứ tự build)</label>
    <label><input type="checkbox" data-o="items">Tự động chọn vật phẩm mang theo</label>
    <label><input type="checkbox" data-o="rift">Chủ động vào khe nứt bí ẩn</label>
    <label><input type="checkbox" data-o="orbs">Tự động dùng ngọc</label>
    <label><input type="checkbox" data-o="farm">Gom quái (chiêu diện rộng gom quái thành cụm rồi đánh)</label>
    <label><input type="checkbox" data-o="focus">Tập trung hỏa lực (diệt con hạ được trước)</label>
    <label><input type="checkbox" data-o="lead">Bắn đón đầu (thử nghiệm, có thể bắn sượt)</label>
    <label><input type="checkbox" data-o="restart">Tự động chơi ván mới sau khi kết thúc</label>
    <label><input type="checkbox" data-o="noRank">Ván treo máy không lên bảng xếp hạng</label>
    <label><input type="checkbox" data-o="upgrade">Tự động mua nâng cấp khi về menu (tốn vàng)</label>
    <label><input type="checkbox" data-o="gacha">Tự động quay gacha khi về menu (dùng vé quay)</label>
    <label><input type="checkbox" data-o="autoPartner">Tự động đổi Pokémon mạnh nhất ra trận</label>
  </div></details>
  <details data-k="histBox"><summary>Thành tích (5 ván gần nhất)</summary><div class="st" data-k="hist"></div></details>
  <details data-k="buildBox" open><summary data-k="ptitle">Build tối ưu</summary>
    <div class="chips" data-k="build"></div>
    <div class="row"><select data-k="pool"></select><button data-k="add">Thêm</button></div>
    <div class="row"><select data-k="item"></select><button data-k="clear">Xóa hết</button></div>
  </details>
  <a data-k="update" target="_blank" rel="noopener" style="display:none;color:#ffd23f!important;text-decoration:underline"></a>
  <div class="st">F8 bật/tắt · Giữ tab luôn hiển thị</div>
</div>`;
    document.body.appendChild(el);
    checkUpdate(el.querySelector('[data-k="update"]'));
    const $ = k => el.querySelector(`[data-k="${k}"]`);

    const setOn = v => { cfg.on = v; save(); $('toggle').textContent = v ? 'ON' : 'OFF'; $('toggle').classList.toggle('on', v); };
    setOn(cfg.on);
    $('toggle').onclick = () => setOn(!cfg.on);
    addEventListener('keydown', e => {
      if (e.key !== 'F8') return;
      e.preventDefault();
      e.shiftKey ? resetPos() : setOn(!cfg.on);
    }, true);
    $('min').onclick = () => { cfg.collapsed = !cfg.collapsed; el.classList.toggle('min', cfg.collapsed); save(); };
    el.querySelectorAll('[data-o]').forEach(i => { i.checked = !!cfg[i.dataset.o]; i.onchange = () => { cfg[i.dataset.o] = i.checked; save(); }; });
    for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) el.addEventListener(t, e => e.stopPropagation());
    let drag = null;
    $('toggle').parentElement.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON') return; drag = [e.clientX - el.offsetLeft, e.clientY - el.offsetTop]; });
    addEventListener('pointermove', e => { if (!drag) return; el.style.left = (e.clientX - drag[0]) + 'px'; el.style.top = (e.clientY - drag[1]) + 'px'; });
    addEventListener('pointerup', () => { if (!drag) return; drag = null; clampPos(); });
    function clampPos() {
      const x = Math.min(Math.max(el.offsetLeft, 40 - el.offsetWidth), innerWidth - 40);
      const y = Math.min(Math.max(el.offsetTop, 0), innerHeight - 28);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      cfg.panelX = x; cfg.panelY = y; save();
    }
    function resetPos() { el.style.left = '12px'; el.style.top = '64px'; clampPos(); }
    $('home').onclick = resetPos;
    addEventListener('resize', clampPos);
    clampPos();
    let shownDex = null;
    const curDex = () => (ns.Game.player && ns.Game.player.dex) || menuDex(ns) || shownDex;
    const prof = dex => (cfg.profiles[dex] = cfg.profiles[dex] || { moves: [], item: '' });
    const mvName = id => { const m = ns.Moves.BY_ID[id]; return m ? ns.T(m.name, 'move') : id; };
    function renderBuild(force) {
      const dex = curDex();
      if (!dex || (!force && dex === shownDex)) return;
      shownDex = dex;
      const mon = (ns.Game.player && ns.Game.player.dex === dex && ns.Game.player.mon) || (ns.DEX_BY && ns.DEX_BY[dex]);
      const name = mon ? (ns.T ? ns.T(mon.name) : mon.name) : '#' + dex;
      const pr = cfg.profiles[dex];
      $('ptitle').textContent = `Build tối ưu · ${name}${pr && pr.moves.length ? '' : ' (chế độ tự động)'}`;
      $('build').innerHTML = '';
      (pr ? pr.moves : []).forEach((id, i) => {
        const c = document.createElement('span'); c.className = 'chip'; c.title = 'Bấm để xóa';
        c.textContent = `${i + 1}. ${mvName(id)}`;
        c.onclick = () => { prof(dex).moves.splice(i, 1); save(); renderBuild(true); };
        $('build').appendChild(c);
      });
      let pool = [];
      try { pool = mon ? ns.Moves.poolFor(mon) : []; } catch {}
      if (!pool || !pool.length) pool = Object.keys(ns.Moves.BY_ID);
      $('pool').innerHTML = pool.filter(id => !(pr && pr.moves.includes(id)))
        .map(id => `<option value="${id}">${mvName(id)}${ns.Moves.BY_ID[id]?.kind === 'buff' ? ' (buff)' : ''}</option>`).join('');
      const items = (ns.Items && (ns.Items.LIST || Object.values(ns.Items.BY || {}))) || [];
      $('item').innerHTML = '<option value="">Vật phẩm: ưu tiên mặc định</option>' + items.map(it => `<option value="${it.id}">Vật phẩm: ${ns.T ? ns.T(it.name) : it.name}</option>`).join('');
      $('item').value = (pr && pr.item) || '';
    }
    $('add').onclick = () => { const dex = curDex(); const v = $('pool').value; if (!dex || !v) return; const pr = prof(dex); if (pr.moves.length < 4 && !pr.moves.includes(v)) pr.moves.push(v); save(); renderBuild(true); };
    $('clear').onclick = () => { const dex = curDex(); if (!dex) return; prof(dex).moves = []; save(); renderBuild(true); };
    $('item').onchange = () => { const dex = curDex(); if (!dex) return; prof(dex).item = $('item').value; save(); };

    setInterval(() => {
      renderBuild(false);
      const p = ns.Game.player, inRun = p && ns.Game.state !== 'ui';
      const xpLine = inRun ? `EXP ×${(p.xpMul || 1).toFixed(2)} · Trên sân ${ns.EnemyMgr.count ?? ns.EnemyMgr.all().length}/64${S.spawnLimited ? ' · Thiếu quái (ưu tiên Học tập)' : ''}\n` : '';
      const run = inRun ? xpLine + `Lv${p.level} · HP ${Math.round(p.hp)}/${Math.round(p.maxHp)} · Hạ gục ${p.kills} · Vé Bond ${p.bonds} · ${cfg.on ? S.mode || '' : 'Tạm dừng'}\nÔ chiêu: ${p.slots.map((g, i) => (i === p.active ? '▶' : '') + g.map(m => mvName(m.id)).join('+')).join(' | ')}` : 'Không ở trong game';
      const mins = Math.round((Date.now() - stats.startedAt) / 60000);
      const extra = [S.lastPartnerMsg && 'Đồng đội: ' + S.lastPartnerMsg, S.lastUpgradeMsg && 'Nâng cấp: ' + S.lastUpgradeMsg, S.lastGachaMsg && 'Đã quay: ' + S.lastGachaMsg].filter(Boolean);
      const lines = `${run}\nLần treo máy này ${mins} phút: ${stats.runs} ván, Hạ gục ${stats.kills}, Vàng ${stats.coins}`.split('\n').concat(extra);
      $('status').replaceChildren(...lines.map(t => Object.assign(document.createElement('div'), { textContent: t })));
      const mmss = t => `${Math.floor((t || 0) / 60)}:${String(Math.floor((t || 0) % 60)).padStart(2, '0')}`;
      const runLine = h => `${mmss(h.time)} Lv${h.level} · Hạ gục ${h.kills} · Vàng ${h.coins}${h.record ? ' · Kỷ lục mới' : ''}` +
        (h.judge ? `\n　Phán Xét ${mmss(h.judge.time)} · ${h.judge.bosses} Huyền thoại · Sát thương ${(h.judge.dmg || 0).toLocaleString()}` : '');
      const hist = (cfg.history || []).slice(0, 5).flatMap(h => runLine(h).split('\n'));
      if ($('hist').childElementCount !== hist.length || $('hist').textContent !== hist.join('')) $('hist').replaceChildren(...(hist.length ? hist : ['Chưa có ván nào hoàn thành']).map(t => Object.assign(document.createElement('div'), { textContent: t })));
    }, 500);
  }
  function menuDex(ns) {
    if (ns.DB && ns.DB.save && ns.DB.save.partner) return ns.DB.save.partner;
    const n = document.getElementById('menu-partner-name');
    const txt = n && n.textContent.trim();
    if (!txt || !ns.DEX) return null;
    const m = ns.DEX.find(d => d.name === txt || (ns.T && ns.T(d.name) === txt));
    return m ? m.dex : null;
  }
})();
