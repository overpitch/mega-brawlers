'use strict';
// =====================================================================
//  Battle: fighters, hits, health, ledges, projectiles, items, effects,
//  the zooming camera, and the computer fighters' brains.
// =====================================================================

const MAX_HP = 100;
const RINGOUT_DAMAGE = 30;
const TEAM_COLORS = ['#ef4444', '#3b82f6'];
const SLOT_COLORS = ['#ef4444', '#3b82f6', '#facc15', '#22c55e'];
const CPU_LEVELS = [
  { name: 'EASY',   react: 26, aggro: 0.35, block: 0.04, special: 0.08, aim: 0.55 },
  { name: 'NORMAL', react: 13, aggro: 0.6,  block: 0.18, special: 0.14, aim: 0.8 },
  { name: 'HARD',   react: 5,  aggro: 0.9,  block: 0.4,  special: 0.2,  aim: 0.95 },
];
const BLANK_IN = { left: false, right: false, up: false, down: false, jump: false, jumpP: false, attackP: false, specialP: false, special: false, block: false, downP: false, upP: false };

const ITEM_MOVES = {
  throw:  { name: 'THROW', dur: 22, pose: 'throw', tick(f, t, B) { if (t === 7) { B.proj(f, { kind: 'bomb', dx: 30, dy: -70, vx: 11, vy: -7, grav: 0.5, life: 160, w: 26, h: 26, dmg: 0, kb: 0, ang: 0, boom: true, bombItem: true }); f.item = null; } } },
  hammer: { name: 'HAMMER', dur: 34, pose: 'hammer', fx: 'big', hits: [{ f: [12, 18], box: [-10, -130, 110, 130], dmg: 18, kb: 16, ang: 45 }] },
};

// ---------------------------------------------------------------- fighter
class Fighter {
  constructor(defId, slot, team, ctrl, cpuLevel = 1) {
    this.def = FIGHTERS[defId];
    this.s = this.def.stats;
    this.slot = slot; this.team = team; this.ctrl = ctrl;
    this.ai = ctrl === 'cpu' ? new BrawlAI(this, CPU_LEVELS[cpuLevel]) : null;
    this.w = this.s.w; this.h = this.s.h;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1;
    this.onGround = false; this.plat = null; this.jumps = this.s.jumps;
    this.hp = MAX_HP; this.alive = true;
    this.state = 'normal'; this.move = null; this.stateT = 0;
    this.hitstun = 0; this.freeze = 0; this.inv = 0; this.intangible = 0; this.hidden = false;
    this.helpless = false; this.usedSide = false; this.fastFall = false; this.landLag = 0;
    this.shield = 50; this.dizzyT = 0; this.frozenT = 0; this.respawnT = 0;
    this.ledgeSide = 0; this.ledgeT = 0; this.ledgeCD = 0; this.dropCD = 0; this.shortHop = 0;
    this.item = null; this.hammer = 0; this.star = 0; this.starHit = {};
    this.kos = 0; this.dmgDealt = 0; this.falls = 0; this.lastHitBy = null; this.lastHitT = -999;
    this.input = BLANK_IN;
    this.pose = { ...POSES.idle, bl: [...POSES.idle.bl], fl: [...POSES.idle.fl], ba: [...POSES.idle.ba], fa: [...POSES.idle.fa] };
    this.trail = []; this.koT = 0; this.flash = 0;
  }
  hurtbox() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  get busy() { return this.state !== 'normal' || this.landLag > 0; }

  // ------------------------------------------------------------ per-frame logic
  update(B) {
    if (!this.alive) { this.updateKO(B); return; }
    if (this.freeze > 0) { this.freeze--; return; }
    for (const k of ['inv', 'intangible', 'star', 'hammer', 'ledgeCD', 'landLag', 'dropCD', 'shortHop', 'flash']) if (this[k] > 0) this[k]--;
    this.stateT++;
    const I = this.input;
    const st = this.s;

    switch (this.state) {
      case 'respawn':
        this.vx = 0; this.vy = 0;
        if (--this.respawnT <= 0 || I.jumpP || I.attackP || I.specialP || I.left || I.right || I.down) { this.state = 'normal'; this.onGround = false; this.jumps = st.jumps - 1; }
        return;
      case 'ledge': this.updateLedge(B, I); return;
      case 'hitstun':
        if (--this.hitstun <= 0) { this.state = 'normal'; }
        if (!this.onGround) this.vx += ((I.right ? 1 : 0) - (I.left ? 1 : 0)) * 0.12;   // a little steering while flying
        this.vx *= this.onGround ? 0.8 : 0.975;
        break;
      case 'frozen':
        if (--this.frozenT <= 0) this.state = 'normal';
        this.vx *= 0.9;
        break;
      case 'dizzy':
        if (--this.dizzyT <= 0) { this.state = 'normal'; this.shield = 30; }
        this.vx *= 0.8;
        break;
      case 'shield':
        this.vx *= 0.7;
        this.shield -= 0.13;
        if (this.shield <= 0) { this.breakShield(B); break; }
        if (!I.block || !this.onGround) { this.state = 'normal'; break; }
        if (I.jumpP) { this.state = 'normal'; this.doJump(B); }
        break;
      case 'move': this.tickMove(B, I); break;
      case 'normal': this.control(B, I); break;
    }
    if (this.state !== 'shield') this.shield = Math.min(50, this.shield + 0.09);
    this.physics(B);
    if (this.alive && this.state !== 'ledge') this.tryLedge(B);
    this.checkBlast(B);
  }

  control(B, I) {
    const st = this.s;
    const dir = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    const canAct = this.landLag <= 0;
    if (this.onGround) {
      const target = dir * st.walk;
      this.vx += clamp(target - this.vx, -st.accel * 1.4, st.accel * 1.4);
      if (dir && canAct) this.face = dir;
      if (!canAct) return;
      if (I.downP && this.plat && this.plat !== B.stage.main) { this.onGround = false; this.plat = null; this.dropCD = 12; this.y += 2; return; }
      if (I.block) { this.state = 'shield'; this.stateT = 0; return; }
      if (I.jumpP) { this.doJump(B); return; }
      if (I.attackP) { this.attack(B, I); return; }
      if (I.specialP) { this.special(B, I); return; }
      if (Math.abs(this.vx) > 4 && frameCount % 9 === 0) B.dust(this.x - this.face * 10, this.y, 1);
    } else {
      this.vx += clamp(dir * st.air - this.vx, -st.accel * 0.7, st.accel * 0.7);
      if (this.shortHop > 0 && !I.jump && this.vy < -6) { this.vy *= 0.55; this.shortHop = 0; }
      if (I.downP && this.vy > -3) this.fastFall = true;
      if (this.helpless) return;
      if (I.jumpP && this.jumps > 0) {
        this.vy = -st.djump; this.jumps--; this.fastFall = false;
        if (dir) this.face = dir;
        B.puff(this.x, this.y, 'rgba(255,255,255,0.8)', 6); sfx.djump();
        return;
      }
      if (I.attackP) { this.attack(B, I); return; }
      if (I.specialP) { this.special(B, I); return; }
    }
  }

  doJump(B) {
    this.vy = -this.s.jump; this.onGround = false; this.plat = null; this.jumps = this.s.jumps - 1;
    this.shortHop = 8; this.fastFall = false;
    B.dust(this.x, this.y, 4); sfx.jump();
  }

  attack(B, I) {
    if (this.item === 'bomb') return this.startMove(B, 'throw', ITEM_MOVES.throw);
    if (this.hammer > 0) return this.startMove(B, 'hammer', ITEM_MOVES.hammer);
    const side = I.left || I.right;
    if (side) this.face = I.right ? 1 : -1;
    const key = this.onGround ? (I.up ? 'up' : I.down ? 'down' : side ? 'side' : 'jab')
                              : (I.up ? 'uair' : I.down ? 'dair' : side ? 'fair' : 'nair');
    this.startMove(B, key);
  }
  special(B, I) {
    const side = I.left || I.right;
    let key = I.up ? 'uspec' : I.down ? 'dspec' : side ? 'sspec' : 'nspec';
    if (key === 'sspec') this.face = I.right ? 1 : -1;
    const md = this.def.moves[key];
    if (md.meditate && !this.onGround) key = 'dair';
    if (md.oncePerAir && !this.onGround) { if (this.usedSide) return; this.usedSide = true; }
    this.startMove(B, key);
  }

  startMove(B, key, md = this.def.moves[key]) {
    if (!md) return;
    this.state = 'move'; this.stateT = 0;
    this.move = { key, md, t: 0, hit: new Set() };
    if (md.lunge && this.onGround) this.vx += this.face * md.lunge;
    if (md.start) md.start(this, B);
    if (md.hits) sfx.swing();
  }

  tickMove(B, I) {
    const m = this.move, md = m.md;
    m.t++;
    if (md.tick) md.tick(this, m.t, B);
    if (md.teleport) {
      if (m.t === 1) { this.hidden = true; this.intangible = 14; this.vx = 0; this.vy = 0; B.sparkle(this.x, this.y - 50, 16); sfx.teleport(); }
      if (m.t < 12) { this.vx = 0; this.vy = 0; }
      if (m.t === 12) {
        let dx = (I.right ? 1 : 0) - (I.left ? 1 : 0), dy = (I.down ? 1 : 0) - (I.up ? 1 : 0);
        if (!dx && !dy) dy = -1;
        const L = Math.hypot(dx, dy);
        this.x += dx / L * 190; this.y += dy / L * 190;
        if (dx) this.face = dx > 0 ? 1 : -1;
        this.hidden = false; this.onGround = false; this.vy = -2;
        B.sparkle(this.x, this.y - 50, 16);
      }
    }
    if (md.meditate) {
      this.vx = 0;
      if (!I.special || !this.onGround || m.t > md.dur - 1) return this.endMove(B);
      if (this.hp < MAX_HP) { this.hp = Math.min(MAX_HP, this.hp + 0.12); if (m.t % 8 === 0) B.sparkle(this.x + rand(-30, 30), this.y - rand(10, 90), 1, '#fde68a'); }
      return;
    }
    if (md.groundPound && this.onGround && m.t >= 12) {
      B.shockwave(this, 6, 8);
      this.landLag = md.landLag || 10;
      return this.endMove(B);
    }
    if (md.air && this.onGround && m.t > 2) { this.landLag = md.landLag || 4; return this.endMove(B); }
    if (!md.air && !md.tick && !md.start && this.onGround) this.vx *= 0.82;
    if (md.trail && m.t % 2 === 0) this.snapTrail();
    if (m.t >= md.dur) this.endMove(B);
  }
  endMove(B) {
    const md = this.move ? this.move.md : null;
    this.state = 'normal'; this.stateT = 0;
    if (md && !this.onGround && (md.helpless || md.airHelpless)) this.helpless = true;
    this.move = null; this.hidden = false;
  }

  physics(B) {
    const st = this.s;
    if (this.state === 'ledge' || this.state === 'respawn') return;
    const noGrav = this.move && this.move.md.teleport && this.move.t < 12;
    if (!noGrav) {
      const maxFall = this.state === 'hitstun' ? st.fall * 1.6 : this.fastFall ? st.fall * 1.5 : st.fall;
      this.vy = Math.min(this.vy + st.grav * (this.fastFall ? 1.4 : 1), maxFall);
    }
    // ride a moving platform
    if (this.onGround && this.plat && this.plat.dx !== undefined) { this.x += this.plat.dx; this.y = this.plat.cy; }

    const prevY = this.y, prevX = this.x, wasGround = this.onGround;
    this.x += this.vx; this.y += this.vy;
    const m = B.stage.main, hw = this.w / 2;

    // the main stage is solid on every side
    if (this.x + hw > m.x1 && this.x - hw < m.x2 && this.y > m.y && this.y - this.h < m.y + m.h) {
      if (prevY <= m.y + 1 && this.vy >= 0) { this.land(B, m, m.y); }
      else if (prevY - this.h >= m.y + m.h - 1 && this.vy < 0) { this.y = m.y + m.h + this.h; this.vy = 0; }
      else if (prevX <= m.x1 - hw + 1 || this.x < (m.x1 + m.x2) / 2 && prevX < m.x1) { this.x = m.x1 - hw - 0.5; this.bonk(); }
      else if (prevX >= m.x2 + hw - 1 || prevX > m.x2) { this.x = m.x2 + hw + 0.5; this.bonk(); }
      else { this.y = m.y; this.land(B, m, m.y); }
    }
    // floating platforms: land on them from above only
    if (this.vy >= 0 && this.dropCD <= 0 && !(this.onGround && this.plat === m)) {
      for (const p of B.plats) {
        if (this.x >= p.cx1 - 4 && this.x <= p.cx2 + 4 && prevY <= p.cy + 1 + Math.max(0, p.ddy || 0) && this.y >= p.cy) {
          if (this.state === 'hitstun' && this.input.down) continue;
          this.land(B, p, p.cy);
          break;
        }
      }
    }
    // walked off an edge?
    if (this.onGround && wasGround) {
      const p = this.plat;
      const x1 = p === m ? m.x1 : p.cx1, x2 = p === m ? m.x2 : p.cx2;
      if (this.x < x1 - 2 || this.x > x2 + 2) { this.onGround = false; this.plat = null; if (this.jumps === this.s.jumps) this.jumps = this.s.jumps - 1; }
    }
  }
  bonk() { if (this.state === 'hitstun' && Math.abs(this.vx) > 10) this.vx *= -0.4; else this.vx = 0; }
  land(B, plat, y) {
    const hard = this.vy > 8;
    this.y = y; this.vy = 0;
    if (!this.onGround) {
      this.onGround = true; this.jumps = this.s.jumps; this.helpless = false; this.usedSide = false; this.fastFall = false;
      if (hard) { B.dust(this.x, this.y, 5); sfx.land(); }
      if (this.state === 'hitstun' && this.hitstun > 20) this.hitstun = 12;
    }
    this.plat = plat;
  }

  // ------------------------------------------------------------ ledges
  tryLedge(B) {
    if (this.onGround || this.ledgeCD > 0 || this.vy < -2) return;
    const okState = this.state === 'normal' || (this.state === 'move' && (this.move.md.helpless || this.move.md.airHelpless));
    if (!okState) return;
    const m = B.stage.main;
    for (const side of [-1, 1]) {
      const edge = side < 0 ? m.x1 : m.x2;
      const hangX = edge + side * (this.w / 2 - 4);
      const top = this.y - this.h;
      if (Math.abs(this.x - hangX) < 44 && top > m.y - 50 && top < m.y + 26 && (side < 0 ? this.x <= m.x1 + 6 : this.x >= m.x2 - 6)) {
        if (B.fighters.some(o => o !== this && o.alive && o.state === 'ledge' && o.ledgeSide === side)) continue;
        this.state = 'ledge'; this.ledgeSide = side; this.ledgeT = 0; this.move = null; this.hidden = false;
        this.x = hangX; this.y = m.y + this.h * 0.82; this.vx = 0; this.vy = 0; this.face = -side;
        this.jumps = this.s.jumps; this.helpless = false; this.usedSide = false; this.fastFall = false;
        this.inv = Math.max(this.inv, 30);
        sfx.ledge();
        return;
      }
    }
  }
  updateLedge(B, I) {
    const m = B.stage.main, side = this.ledgeSide;
    this.ledgeT++;
    if (this.ledgeT < 6) return;
    const toward = side < 0 ? I.right : I.left, away = side < 0 ? I.left : I.right;
    const climb = (attack) => {
      this.state = 'normal'; this.x = (side < 0 ? m.x1 : m.x2) - side * (this.w / 2 + 12); this.y = m.y;
      this.onGround = true; this.plat = m; this.inv = Math.max(this.inv, 14); this.face = -side;
      if (attack) this.startMove(B, 'jab');
    };
    if (I.jumpP) { this.state = 'normal'; this.vy = -this.s.jump; this.x -= side * 10; this.jumps = this.s.jumps - 1; this.onGround = false; this.ledgeCD = 20; sfx.jump(); }
    else if (I.upP || toward) climb(false);
    else if (I.attackP) climb(true);
    else if (I.downP || away || this.ledgeT > 300) { this.state = 'normal'; this.ledgeCD = 30; this.onGround = false; this.vy = 1; }
  }

  // ------------------------------------------------------------ getting hit / knocked out
  breakShield(B) {
    this.state = 'dizzy'; this.dizzyT = 150; this.shield = 0;
    sfx.shieldBreak(); B.burst(this.x, this.y - this.h / 2, '#60a5fa', 1.5);
    this.vy = -9; this.onGround = false;
  }
  checkBlast(B) {
    if (!this.alive) return;
    const top = this.y - this.h;
    if (this.y > BLAST.bot || this.x < BLAST.l || this.x > BLAST.r || (top < BLAST.top && this.state === 'hitstun')) B.ringOut(this);
  }
  updateKO(B) {
    this.koT++;
    this.vy += 0.4; this.x += this.vx; this.y += this.vy;
    this.vx *= 0.99;
    if (this.koT % 2 === 0) this.snapTrail();
  }
  snapTrail() {
    this.trail.push({ x: this.x, y: this.y, face: this.face, pose: lerpPose(this.pose, this.pose, 0), life: 10 });
    if (this.trail.length > 6) this.trail.shift();
  }

  // ------------------------------------------------------------ animation
  targetPose() {
    const t = frameCount + this.slot * 37;
    const md = this.move && this.move.md;
    switch (this.state) {
      case 'move': {
        const name = md.pose || 'punch';
        const strike = POSES[name] || POSES.punch;
        const wind = POSES[name + 'W'] || (this.onGround ? POSES.idle : POSES.fall);
        const base = this.onGround ? POSES.idle : POSES.fall;
        const hits = md.hits || [];
        const s = hits.length ? hits[0].f[0] : Math.min(10, md.dur / 3);
        const e = hits.length ? hits[hits.length - 1].f[1] : s + 4;
        const tt = this.move.t;
        let p;
        if (md.meditate) p = POSES.meditate;
        else if (tt < s) p = lerpPose(base, wind, easeOut(tt / Math.max(1, s)));
        else if (tt <= e + 2) p = lerpPose(wind, strike, Math.min(1, (tt - s + 1) / 3));
        else p = lerpPose(strike, base, Math.min(1, (tt - e) / Math.max(1, md.dur - e)));
        if (md.spinning || name === 'spin') p = { ...p, rot: (tt * 28) % 360 };
        return p;
      }
      case 'hitstun': {
        const p = this.hitstun > 18 ? { ...POSES.hurt, rot: (this.stateT * 22) % 360 } : POSES.hurt;
        return p;
      }
      case 'frozen': return POSES.hurt;
      case 'dizzy': { const p = { ...POSES.dizzy }; p.lean = Math.sin(t * 0.15) * 14; return p; }
      case 'shield': return POSES.block;
      case 'ledge': return POSES.ledge;
      case 'respawn': return POSES.idle;
    }
    if (this.helpless) return { ...POSES.helpless, rot: Math.sin(t * 0.3) * 10 };
    if (this.landLag > 0) return POSES.crouch;
    if (!this.onGround) return this.vy < 0 ? POSES.jump : POSES.fall;
    if (Math.abs(this.vx) > 1.2) return runPose(t);
    const p = { ...POSES.idle }; p.y += Math.sin(t * 0.09) * 2; return p;
  }
  animate() {
    const tp = this.targetPose();
    const snap = this.state === 'move' || this.state === 'hitstun' ? 0.55 : 0.32;
    const p = lerpPose(this.pose, tp, snap);
    p.rot = tp.rot;                        // spins don't blend (they'd unwind backwards)
    this.pose = p;
    for (const tr of this.trail) tr.life--;
    this.trail = this.trail.filter(tr => tr.life > 0);
  }
}

// ---------------------------------------------------------------- the battle
class Battle {
  constructor(setup) {
    // setup: { stage, items, teams, entries: [{ fighter, ctrl, team, cpuLevel }] }
    this.stage = STAGES[setup.stage];
    this.itemsOn = setup.items;
    this.teams = setup.teams;
    this.time = 0;
    this.plats = this.stage.plats.map(p => ({ ...p, cx1: p.x1, cx2: p.x2, cy: p.y, dx: 0, ddy: 0 }));
    const n = setup.entries.length;
    const m = this.stage.main;
    this.fighters = setup.entries.map((e, i) => {
      const f = new Fighter(e.fighter, i, setup.teams ? e.team : i, e.ctrl, e.cpuLevel);
      f.x = lerp(m.x1 + 120, m.x2 - 120, n === 1 ? 0.5 : i / (n - 1));
      f.y = m.y; f.onGround = true; f.plat = m; f.face = f.x < 0 ? 1 : -1;
      return f;
    });
    this.projs = []; this.items = []; this.parts = [];
    this.itemTimer = 400;
    this.cam = { x: 0, y: -200, zoom: 0.9 };
    this.slow = 0; this.focus = null; this.over = false; this.overT = 0; this.winner = null;
  }

  // ------------------------------------------------------------ main update
  update(inputs) {
    if (this.over) this.overT++;
    if (this.slow > 0) { this.slow--; if (this.slow % 3 !== 0) { this.updateParticles(0.33); return; } }
    this.time++;
    // moving platforms
    for (const p of this.plats) {
      if (!p.moving) { p.dx = 0; p.ddy = 0; continue; }
      const o = p.moving(this.time);
      const nx1 = p.x1 + o.dx, ny = p.y + o.dy;
      p.dx = nx1 - p.cx1; p.ddy = ny - p.cy;
      p.cx1 = nx1; p.cx2 = p.x2 + o.dx; p.cy = ny;
    }
    for (const f of this.fighters) {
      f.input = f.ai ? f.ai.think(this) : (inputs[f.ctrl] || BLANK_IN);
      f.update(this);
    }
    this.resolveHits();
    this.updateProjs();
    this.updateItems();
    this.updateParticles(1);
    for (const f of this.fighters) f.animate();
    this.updateCamera();
  }

  enemies(a, b) { return a !== b && (!this.teams || a.team !== b.team); }

  resolveHits() {
    for (const a of this.fighters) {
      if (!a.alive || a.state !== 'move' || !a.move.md.hits || a.freeze > 0) continue;
      const m = a.move;
      m.md.hits.forEach((h, i) => {
        if (m.t < h.f[0] || m.t > h.f[1]) return;
        const box = this.hitBox(a, h);
        for (const t of this.fighters) {
          if (!t.alive || !this.enemies(a, t) || t.hidden || t.state === 'respawn') continue;
          const key = i + ':' + t.slot;
          if (m.hit.has(key)) continue;
          if (boxHit(box, t.hurtbox())) { m.hit.add(key); this.applyHit(a, t, h, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, m.md.fx); }
        }
      });
    }
    // star power: touching enemies hurts them
    for (const a of this.fighters) {
      if (!a.alive || a.star <= 0) continue;
      for (const t of this.fighters) {
        if (!t.alive || !this.enemies(a, t) || t.state === 'respawn') continue;
        if ((a.starHit[t.slot] || -99) > this.time - 30) continue;
        if (boxHit(a.hurtbox(), t.hurtbox())) { a.starHit[t.slot] = this.time; this.applyHit(a, t, { dmg: 6, kb: 9, ang: 50, both: true }, { x: t.x, y: t.y - t.h / 2 }, 'star'); }
      }
    }
  }
  hitBox(a, h) {
    const [bx, by, bw, bh] = h.box;
    return { x: a.face > 0 ? a.x + bx : a.x - bx - bw, y: a.y + by, w: bw, h: bh };
  }

  /** a = who's hitting (a fighter), t = who gets hit. opts.dir forces the push direction (projectiles). */
  applyHit(a, t, h, at, fx, opts = {}) {
    if (t.intangible > 0 || t.star > 0 || t.inv > 0) return false;
    // Kage's counter: dodge the hit, appear behind the attacker and strike back
    if (t.state === 'move' && t.move.md.counter && !opts.projectile) {
      const [c1, c2] = t.move.md.counter;
      if (t.move.t >= c1 && t.move.t <= c2) {
        t.endMove(this);
        t.x = a.x - a.face * 60; t.y = a.y; t.face = a.face; t.inv = 20;
        this.puff(t.x, t.y - 40, '#9ca3af', 10); sfx.teleport();
        this.applyHit(t, a, { dmg: 10, kb: 11, ang: 40 }, { x: a.x, y: a.y - a.h / 2 }, 'slash', { dir: a.face * -1 });
        return false;
      }
    }
    const dir = opts.dir || (h.both ? (Math.sign(t.x - a.x) || a.face) : a.face);
    if (t.state === 'shield') {
      t.shield -= h.dmg * 1.3;
      t.vx = dir * 3.5;
      if (!opts.projectile) a.freeze = 4;
      sfx.shield(); this.burst(at.x, at.y, '#93c5fd', 0.6);
      if (t.shield <= 0) t.breakShield(this);
      return true;
    }
    const dmg = h.dmg;
    t.hp = Math.max(0, t.hp - dmg);
    if (a !== t) { a.dmgDealt += dmg; t.lastHitBy = a; t.lastHitT = this.time; }
    // knockback grows as health drops, like Smash
    let kb = h.kb * (1 + (1 - t.hp / MAX_HP) * 1.6) / t.s.weight;
    const ko = t.hp <= 0;
    if (ko) kb = Math.max(kb, 24);
    const ang = h.ang * DEG;
    t.vx = Math.cos(ang) * kb * dir;
    t.vy = -Math.sin(ang) * kb;
    if (t.onGround && h.ang < 0) t.vy = -Math.abs(t.vy) * 0.5;           // spikes bounce off the floor
    if (t.onGround && t.vy > -3) t.vy = -3;
    if (t.vy < 0) { t.onGround = false; t.plat = null; }
    t.move = null; t.hidden = false; t.helpless = false; t.fastFall = false;
    t.state = 'hitstun'; t.stateT = 0; t.hitstun = Math.round(clamp(kb * 2.3, 8, 70));
    if (h.freeze) { t.state = 'frozen'; t.frozenT = h.freeze; this.burst(at.x, at.y, '#bae6fd', 1.2); }
    if (t.state === 'ledge') t.state = 'hitstun';
    // impact: freeze-frame, flash, sparks, sound, rumble
    const lag = Math.round(clamp(3 + dmg * 0.55, 3, 14));
    t.freeze = lag; if (!opts.projectile) a.freeze = lag;
    t.flash = 8;
    const big = dmg >= 11 || kb >= 18;
    this.burst(at.x, at.y, fx === 'magic' ? '#c4b5fd' : fx === 'slash' ? '#e0f2fe' : fx === 'chi' ? '#fdba74' : fx === 'fire' ? '#fb923c' : '#fff7c2', big ? 1.5 : dmg >= 6 ? 1 : 0.6);
    (big ? sfx.hitL : dmg >= 6 ? sfx.hitM : sfx.hitS)();
    rumble(t.ctrl, big ? 260 : 120, big ? 0.9 : 0.5);
    rumble(a.ctrl, 80, 0.3);
    if (ko) this.knockOut(t, a);
    return true;
  }

  knockOut(t, by) {
    if (!t.alive) return;
    t.alive = false; t.state = 'ko'; t.koT = 0; t.item = null;
    if (by && by !== t) by.kos++;
    sfx.ko();
    const left = this.sidesLeft();
    if (left.length <= 1 && !this.over) {
      this.over = true; this.overT = 0;
      this.winner = left[0] ?? null;
      this.slow = 110; this.focus = t;      // the final hit, in slow motion
    }
  }
  sidesLeft() {
    const sides = new Set(this.fighters.filter(f => f.alive).map(f => this.teams ? 't' + f.team : 's' + f.slot));
    return [...sides];
  }
  ringOut(f) {
    if (!f.alive) return;
    f.falls++;
    sfx.ringout();
    const credit = f.lastHitBy && this.time - f.lastHitT < 360 ? f.lastHitBy : null;
    f.hp = Math.max(0, f.hp - RINGOUT_DAMAGE);
    this.ring(clamp(f.x, BLAST.l + 80, BLAST.r - 80), clamp(f.y, BLAST.top + 80, BLAST.bot - 40), SLOT_COLORS[f.slot]);
    rumble(f.ctrl, 400, 1);
    if (f.hp <= 0) {
      this.knockOut(f, credit);
      f.vx = 0; f.vy = 0; f.y = BLAST.bot + 400;   // already gone off-screen
      return;
    }
    // float back in on a little cloud
    f.state = 'respawn'; f.respawnT = 160; f.inv = 150;
    f.x = 0; f.y = this.stage.main.y - 380; f.vx = 0; f.vy = 0; f.onGround = false; f.plat = null;
    f.move = null; f.helpless = false; f.hidden = false; f.item = null; f.jumps = f.s.jumps;
  }

  // ------------------------------------------------------------ projectiles
  proj(owner, o) {
    this.projs.push({ owner, kind: o.kind, x: owner.x + owner.face * o.dx, y: owner.y + o.dy, vx: o.vx * owner.face, vy: o.vy,
                      grav: o.grav || 0, bounce: o.bounce || 0, life: o.life, w: o.w, h: o.h, dmg: o.dmg, kb: o.kb, ang: o.ang,
                      freeze: o.freeze || 0, boom: !!o.boom, bombItem: !!o.bombItem, t: 0 });
  }
  updateProjs() {
    const m = this.stage.main;
    for (const p of this.projs) {
      p.t++; p.life--;
      p.vy += p.grav; p.x += p.vx; p.y += p.vy;
      const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      // ground
      const inMain = p.x > m.x1 && p.x < m.x2 && p.y + p.h / 2 > m.y && p.y - p.h / 2 < m.y + m.h;
      const onPlat = p.vy > 0 && this.plats.some(q => p.x > q.cx1 && p.x < q.cx2 && p.y + p.h / 2 >= q.cy && p.y + p.h / 2 - p.vy <= q.cy + 2);
      if (inMain || onPlat) {
        if (p.bounce && p.vy > 0 && (onPlat || p.y - p.vy + p.h / 2 <= m.y + 2)) { p.vy = -p.bounce; p.y -= 4; }
        else { if (p.boom) this.explode(p.x, p.y, p.owner, p.bombItem ? 1.3 : 1); p.life = 0; continue; }
      }
      if (p.kind === 'magic' || p.kind === 'chi') { if (p.t % 3 === 0) this.sparkle(p.x, p.y, 1, p.kind === 'chi' ? '#fdba74' : '#c4b5fd'); }
      if (p.kind === 'fire' || p.kind === 'greenfire' || p.kind === 'meteor') { if (p.t % 2 === 0) this.parts.push({ type: 'dot', x: p.x, y: p.y, vx: rand(-1, 1), vy: rand(-1, 0), life: 14, max: 14, size: p.kind === 'meteor' ? 12 : 6, color: p.kind === 'greenfire' ? '#4ade80' : '#fb923c' }); }
      // hitting fighters
      for (const t of this.fighters) {
        if (!t.alive || t.hidden || t.state === 'respawn' || !this.enemies(p.owner, t) && !(p.bombItem && t !== p.owner)) continue;
        if (t === p.owner) continue;
        if (!boxHit(box, t.hurtbox())) continue;
        if (p.boom) { this.explode(p.x, p.y, p.owner, p.bombItem ? 1.3 : 1); p.life = 0; break; }
        this.applyHit(p.owner, t, { dmg: p.dmg, kb: p.kb, ang: p.ang, freeze: p.freeze }, { x: p.x, y: p.y }, p.kind, { dir: Math.sign(p.vx) || 1, projectile: true });
        p.life = 0; break;
      }
      if (p.x < BLAST.l || p.x > BLAST.r || p.y > BLAST.bot) p.life = 0;
    }
    this.projs = this.projs.filter(p => p.life > 0);
  }
  explode(x, y, owner, size = 1) {
    sfx.boom();
    this.burst(x, y, '#fb923c', 2.2 * size);
    for (let i = 0; i < 14; i++) this.parts.push({ type: 'puff', x: x + rand(-30, 30), y: y + rand(-30, 30), vx: rand(-3, 3), vy: rand(-4, 1), life: 40, max: 40, size: rand(16, 30), color: i % 2 ? '#78716c' : '#f97316' });
    const r = 90 * size;
    for (const t of this.fighters) {
      if (!t.alive || t === owner || t.state === 'respawn') continue;
      if (Math.hypot(t.x - x, (t.y - t.h / 2) - y) < r + t.w / 2) {
        this.applyHit(owner, t, { dmg: 14 * size, kb: 13, ang: 65 }, { x: t.x, y: t.y - t.h / 2 }, 'fire', { dir: Math.sign(t.x - x) || 1, projectile: true });
      }
    }
  }
  shockwave(f, dmg, kb) {
    this.dust(f.x - 30, f.y, 4); this.dust(f.x + 30, f.y, 4);
    sfx.hitM();
    const box = { x: f.x - 90, y: f.y - 40, w: 180, h: 40 };
    for (const t of this.fighters) {
      if (!t.alive || !this.enemies(f, t) || t.state === 'respawn') continue;
      if (boxHit(box, t.hurtbox())) this.applyHit(f, t, { dmg, kb, ang: 60, both: true }, { x: t.x, y: t.y - 20 }, null, { projectile: true });
    }
  }

  // ------------------------------------------------------------ items
  updateItems() {
    const m = this.stage.main;
    if (this.itemsOn && !this.over && --this.itemTimer <= 0 && this.items.length < 2) {
      this.itemTimer = Math.round(rand(420, 720));
      this.items.push({ type: pick(['bomb', 'hammer', 'food', 'food', 'star', 'bomb']), x: rand(m.x1 + 60, m.x2 - 60), y: -760, vy: 0, life: 900, onGround: false });
    }
    for (const it of this.items) {
      it.life--;
      if (!it.onGround) {
        it.vy = Math.min(it.vy + 0.6, 12);
        const prev = it.y; it.y += it.vy;
        if (it.x > m.x1 && it.x < m.x2 && prev <= m.y && it.y >= m.y) { it.y = m.y; it.onGround = true; }
        for (const p of this.plats) if (it.x > p.cx1 && it.x < p.cx2 && prev <= p.cy && it.y >= p.cy) { it.y = p.cy; it.onGround = true; it.plat = p; }
        if (it.y > BLAST.bot) it.life = 0;
      } else if (it.plat) { it.x += it.plat.dx; it.y = it.plat.cy; }
      for (const f of this.fighters) {
        if (!f.alive || f.state === 'respawn' || f.state === 'hitstun' || it.life <= 0) continue;
        if (!boxHit(f.hurtbox(), { x: it.x - 20, y: it.y - 40, w: 40, h: 40 })) continue;
        if (it.type === 'food') { f.hp = Math.min(MAX_HP, f.hp + 25); sfx.heal(); this.floatText(f.x, f.y - f.h - 20, '+25', '#4ade80'); it.life = 0; }
        else if (it.type === 'star') { f.star = 480; sfx.star(); it.life = 0; }
        else if (!f.item && f.hammer <= 0) { if (it.type === 'bomb') f.item = 'bomb'; else f.hammer = 480; sfx.item(); it.life = 0; }
      }
    }
    this.items = this.items.filter(it => it.life > 0);
  }

  // ------------------------------------------------------------ effects
  burst(x, y, color, s = 1) {
    this.parts.push({ type: 'burst', x, y, life: 14, max: 14, size: 60 * s, color, rot: rand(0, 6) });
    this.parts.push({ type: 'ring', x, y, life: 16, max: 16, size: 70 * s, color });
    for (let i = 0; i < 6 * s; i++) this.parts.push({ type: 'dot', x, y, vx: rand(-7, 7) * s, vy: rand(-7, 4) * s, life: 20, max: 20, size: rand(3, 6), color });
  }
  ring(x, y, color) { for (let i = 0; i < 3; i++) this.parts.push({ type: 'ring', x, y, life: 30 + i * 8, max: 30 + i * 8, size: 260 + i * 80, color }); }
  dust(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ type: 'puff', x: x + rand(-10, 10), y: y - 4, vx: rand(-2, 2), vy: rand(-1.5, -0.3), life: 22, max: 22, size: rand(8, 14), color: 'rgba(255,255,255,0.85)' }); }
  puff(x, y, color, n) { for (let i = 0; i < n; i++) this.parts.push({ type: 'puff', x: x + rand(-20, 20), y: y + rand(-20, 20), vx: rand(-2, 2), vy: rand(-2, 1), life: 30, max: 30, size: rand(12, 22), color }); }
  sparkle(x, y, n, color = '#e9d5ff') { for (let i = 0; i < n; i++) this.parts.push({ type: 'sparkle', x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-1, 1), vy: rand(-1.5, 0.5), life: 26, max: 26, size: rand(4, 8), color }); }
  floatText(x, y, s, color) { this.parts.push({ type: 'text', x, y, vx: 0, vy: -1.2, life: 50, max: 50, size: 30, color, text: s }); }
  updateParticles(dt) {
    for (const q of this.parts) {
      q.life -= dt;
      if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; if (q.type === 'dot') q.vy += 0.3 * dt; }
    }
    this.parts = this.parts.filter(q => q.life > 0);
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  // ------------------------------------------------------------ camera
  updateCamera() {
    const c = this.cam;
    let tx, ty, tz;
    if (this.slow > 0 && this.focus) {
      tx = clamp(this.focus.x, BLAST.l + 300, BLAST.r - 300); ty = clamp(this.focus.y - 60, BLAST.top + 200, BLAST.bot - 150); tz = 1.35;
    } else {
      const live = this.fighters.filter(f => f.alive);
      const list = live.length ? live : this.fighters;
      let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      for (const f of list) {
        const fx = clamp(f.x, BLAST.l + 150, BLAST.r - 150), fy = clamp(f.y, BLAST.top + 150, BLAST.bot - 50);
        x1 = Math.min(x1, fx); x2 = Math.max(x2, fx); y1 = Math.min(y1, fy - f.h); y2 = Math.max(y2, fy);
      }
      const m = this.stage.main;
      x1 = Math.min(x1, -250); x2 = Math.max(x2, 250); y2 = Math.max(y2, m.y + 60);
      const w = x2 - x1 + 440, h = y2 - y1 + 360;
      tz = clamp(Math.min(SW / w, SH / h), 0.42, 1.15);
      tx = (x1 + x2) / 2; ty = (y1 + y2) / 2 - 30;
    }
    c.x = lerp(c.x, tx, 0.09); c.y = lerp(c.y, ty, 0.09); c.zoom = lerp(c.zoom, tz, 0.06);
  }

  // ------------------------------------------------------------ drawing
  draw() {
    const c = this.cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.stage.bg(c);
    ctx.setTransform(c.zoom, 0, 0, c.zoom, SW / 2 - c.x * c.zoom, SH / 2 - c.y * c.zoom);
    const m = this.stage.main;
    this.stage.drawMain(m);
    for (const p of this.plats) this.stage.drawPlat({ x1: p.cx1, x2: p.cx2, y: p.cy });
    for (const it of this.items) this.drawItem(it);
    for (const f of this.fighters) this.drawFighterFull(f);
    for (const p of this.projs) this.drawProj(p);
    this.drawParticles();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawFighterFull(f) {
    if (!f.alive && (f.koT > 90 || f.y > BLAST.bot + 100)) return;
    const col = this.teams ? TEAM_COLORS[f.team] : SLOT_COLORS[f.slot];
    // trail ghosts
    for (const tr of f.trail) drawFighter(f.def, tr.pose, tr.x, tr.y, tr.face, { alpha: tr.life / 22, vx: 0, time: frameCount });
    if (f.state === 'respawn') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 50, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (f.hidden) return;
    const blink = (f.inv > 0 && f.state !== 'ledge' && (frameCount >> 2) % 2) ? 0.45 : 1;
    const starGlow = f.star > 0;
    const opts = { alpha: blink, vx: f.vx, time: frameCount + f.slot * 50, flash: f.flash > 0 ? f.flash / 10 : 0 };
    if (starGlow) {
      ctx.save(); ctx.globalAlpha = 0.5;
      ctx.fillStyle = `hsl(${(frameCount * 12) % 360},100%,65%)`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - f.h / 2, f.w, f.h * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (f.move && f.move.md.meditate) {
      ctx.fillStyle = `rgba(253,230,138,${0.25 + Math.sin(frameCount * 0.2) * 0.1})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 40, 60, 70, 0, 0, Math.PI * 2); ctx.fill();
    }
    drawFighter(f.def, f.pose, f.x, f.y, f.face, opts);
    // held items
    if (f.item === 'bomb' || f.hammer > 0) {
      const J = joints(f.def, f.pose);
      const sc = f.def.scale || 1;
      const hx = f.x + J.fa[1][0] * f.face * sc, hy = f.y + J.fa[1][1] * sc;
      if (f.item === 'bomb') this.drawBomb(hx + f.face * 8, hy - 6, 13);
      else this.drawHammer(hx, hy, f.face, f.pose);
    }
    // active attack swoosh
    if (f.state === 'move' && f.move.md.hits) {
      for (const h of f.move.md.hits) {
        if (f.move.t >= h.f[0] && f.move.t <= h.f[1] + 1) this.drawSwoosh(this.hitBox(f, h), f, f.move.md.fx);
      }
    }
    if (f.state === 'shield') {
      const r = 26 + f.shield * 0.75;
      ctx.fillStyle = `rgba(96,165,250,${0.25 + (1 - f.shield / 50) * 0.2})`; ctx.strokeStyle = 'rgba(191,219,254,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y - f.h / 2, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (f.state === 'frozen') {
      ctx.fillStyle = 'rgba(186,230,253,0.55)'; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 3;
      rrect(f.x - f.w * 0.8, f.y - f.h - 8, f.w * 1.6, f.h + 10, 8); ctx.fill(); ctx.stroke();
    }
    if (f.state === 'dizzy') {
      for (let i = 0; i < 3; i++) {
        const a = frameCount * 0.12 + i * 2.1;
        text('★', f.x + Math.cos(a) * 26, f.y - f.h - 14 + Math.sin(a) * 6, 18, '#fde047', 'center', OUTLINE);
      }
    }
    // player tag above the head
    if (f.alive) {
      const tag = f.ai ? 'CPU' : 'P' + (f.slot + 1);
      const ty = f.y - f.h - 40;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(f.x - 8, ty + 12); ctx.lineTo(f.x + 8, ty + 12); ctx.lineTo(f.x, ty + 22); ctx.fill();
      text(tag, f.x, ty, 22, col, 'center', OUTLINE);
    }
  }

  drawSwoosh(b, f, fx) {
    const color = fx === 'magic' ? 'rgba(196,181,253,0.55)' : fx === 'slash' ? 'rgba(224,242,254,0.7)' : fx === 'chi' ? 'rgba(253,186,116,0.55)' : fx === 'big' ? 'rgba(255,240,180,0.6)' : fx === 'swoosh' ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.save();
    ctx.fillStyle = color;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.w / 2, b.h / 2, 0, f.face > 0 ? -Math.PI / 2 : Math.PI / 2, f.face > 0 ? Math.PI / 2 : Math.PI * 1.5);
    ctx.ellipse(cx - f.face * b.w * 0.15, cy, b.w * 0.3, b.h * 0.35, 0, f.face > 0 ? Math.PI / 2 : Math.PI * 1.5, f.face > 0 ? -Math.PI / 2 : Math.PI / 2, true);
    ctx.fill();
    ctx.restore();
    if (fx === 'magic' && frameCount % 2 === 0) this.sparkle(cx, cy, 1);
  }

  drawProj(p) {
    ctx.save(); ctx.translate(p.x, p.y);
    switch (p.kind) {
      case 'fire': case 'greenfire': {
        const c1 = p.kind === 'fire' ? '#f97316' : '#22c55e', c2 = p.kind === 'fire' ? '#fde047' : '#bbf7d0';
        ctx.fillStyle = c1; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, p.w / 2 + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(-2, -2, p.w / 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'magic': case 'chi': {
        const c = p.kind === 'magic' ? '#a78bfa' : '#fb923c';
        ctx.fillStyle = p.kind === 'magic' ? 'rgba(167,139,250,0.35)' : 'rgba(251,146,60,0.35)';
        ctx.beginPath(); ctx.arc(0, 0, p.w, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -3, p.w / 6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ice': {
        ctx.rotate(p.t * 0.2);
        ctx.fillStyle = 'rgba(186,230,253,0.85)'; ctx.strokeStyle = '#0369a1'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) { const r = i % 2 ? p.w * 0.25 : p.w * 0.55, a = i * Math.PI / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'shuriken': {
        ctx.rotate(p.t * 0.6);
        ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 11, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'meteor': {
        ctx.fillStyle = 'rgba(251,146,60,0.4)'; ctx.beginPath(); ctx.arc(0, 0, p.w * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#78350f'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(-6, -6, 6, 0, Math.PI * 2); ctx.arc(8, 4, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bomb': this.drawBomb(0, 0, 13); break;
    }
    ctx.restore();
  }
  drawBomb(x, y, r) {
    ctx.fillStyle = '#1f2937'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 0.8); ctx.quadraticCurveTo(x + r, y - r * 1.6, x + r * 1.3, y - r * 1.3); ctx.stroke();
    ctx.fillStyle = (frameCount >> 2) % 2 ? '#fde047' : '#f97316'; ctx.beginPath(); ctx.arc(x + r * 1.3, y - r * 1.3, 4, 0, Math.PI * 2); ctx.fill();
  }
  drawHammer(x, y, face, pose) {
    ctx.save(); ctx.translate(x, y);
    const a = (pose.fa[1] - 90) * DEG;
    ctx.rotate(face > 0 ? -a : a + Math.PI);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.fillStyle = '#92400e'; ctx.fillRect(-4, -4, 46, 8); ctx.strokeRect(-4, -4, 46, 8);
    ctx.fillStyle = '#ef4444'; rrect(36, -20, 30, 40, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fca5a5'; ctx.fillRect(40, -16, 6, 32);
    ctx.restore();
  }
  drawItem(it) {
    if (it.life < 120 && (frameCount >> 2) % 2) return;
    const x = it.x, y = it.y - 20 + Math.sin(frameCount * 0.1 + x) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    if (it.type === 'bomb') this.drawBomb(x, y, 14);
    else if (it.type === 'hammer') { this.drawHammer(x - 30, y + 10, 1, { fa: [0, 50] }); }
    else if (it.type === 'food') {
      ctx.fillStyle = '#ef4444'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x - 6, y + 2, 12, 0, Math.PI * 2); ctx.arc(x + 6, y + 2, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(x + 4, y - 12, 7, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#78350f'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y - 16); ctx.stroke();
    } else if (it.type === 'star') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(frameCount * 0.1) * 0.3);
      ctx.fillStyle = `hsl(${(frameCount * 8) % 360},100%,60%)`; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 20, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  drawParticles() {
    for (const q of this.parts) {
      const k = q.life / q.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      switch (q.type) {
        case 'burst': {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.fillStyle = q.color; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
          const s = q.size * (0.6 + (1 - k) * 0.6);
          ctx.beginPath();
          for (let i = 0; i < 16; i++) { const r = i % 2 ? s * 0.35 : s, a = i * Math.PI / 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
          break;
        }
        case 'ring':
          ctx.strokeStyle = q.color; ctx.lineWidth = 6 * k + 1;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k) + 10, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'dot': ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * k + 1, 0, Math.PI * 2); ctx.fill(); break;
        case 'puff': ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.4 - k * 0.6), 0, Math.PI * 2); ctx.fill(); break;
        case 'sparkle':
          ctx.fillStyle = q.color; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.life * 0.2);
          ctx.fillRect(-q.size, -1.5, q.size * 2, 3); ctx.fillRect(-1.5, -q.size, 3, q.size * 2); ctx.restore();
          break;
        case 'text': text(q.text, q.x, q.y, q.size, q.color); break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- computer fighters
class BrawlAI {
  constructor(f, level) { this.f = f; this.L = level; this.cd = 0; this.plan = null; this.blockT = 0; this.wait = 0; this.ledgeWait = 0; }
  think(B) {
    const f = this.f, L = this.L, m = B.stage.main;
    const I = { ...BLANK_IN };
    if (!f.alive) return I;
    if (f.state === 'respawn') { if (f.respawnT < 120 - L.react * 2) I.down = true; return I; }
    if (f.state === 'ledge') {
      if (++this.ledgeWait > L.react + 8) { this.ledgeWait = 0; if (Math.random() < 0.5) I.jumpP = true; else I.upP = true; }
      return I;
    }
    this.ledgeWait = 0;
    const center = (m.x1 + m.x2) / 2;
    const offstage = f.x < m.x1 - 4 || f.x > m.x2 + 4 || (f.y > m.y + 4 && !f.onGround);
    // 1. get back to the stage
    if (offstage && !f.onGround) {
      const dir = Math.sign(center - f.x);
      I[dir > 0 ? 'right' : 'left'] = true;
      const below = f.y > m.y - 30, farX = Math.min(Math.abs(f.x - m.x1), Math.abs(f.x - m.x2)) > 160;
      if ((below || farX) && f.vy > -1 && f.state === 'normal' && !f.helpless) {
        if (f.jumps > 0) I.jumpP = true;
        else {
          const sideGood = farX && !below && (f.def.id === 'maher' || f.def.id === 'ninja' || f.def.id === 'monk') && !f.usedSide;
          if (sideGood) { I.specialP = true; } else { I.up = true; I.specialP = true; if (f.def.id === 'wizard') I[dir > 0 ? 'right' : 'left'] = true; }
        }
      }
      return I;
    }
    if (this.cd > 0) this.cd--;
    // 2. pick a target: the nearest enemy that's still fighting
    let target = null, best = Infinity;
    for (const o of B.fighters) {
      if (!o.alive || !B.enemies(f, o) || o.state === 'respawn') continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < best) { best = d; target = o; }
    }
    // items nearby are tempting
    if (B.itemsOn && !f.item && f.hammer <= 0 && B.items.length) {
      const it = B.items.reduce((a, b) => Math.abs(a.x - f.x) < Math.abs(b.x - f.x) ? a : b);
      if (it.onGround && Math.abs(it.x - f.x) < 320 && (it.type !== 'food' || f.hp < 80) && (!target || best > 200)) {
        I[it.x > f.x ? 'right' : 'left'] = Math.abs(it.x - f.x) > 10;
        if (it.y < f.y - 60 && f.onGround && Math.random() < 0.1) I.jumpP = true;
        return I;
      }
    }
    if (!target) return I;
    const dx = target.x - f.x, dy = target.y - f.y, adx = Math.abs(dx);
    // Tenzin meditates when it's safe
    if (f.def.id === 'monk' && f.hp < 55 && best > 450 && f.onGround) {
      if (f.state === 'normal' && this.cd <= 0) { I.down = true; I.specialP = true; I.special = true; this.cd = 30; return I; }
      if (f.state === 'move' && f.move.md.meditate) { I.special = best > 280; return I; }
    }
    // 3. block incoming attacks sometimes
    if (this.blockT > 0) { this.blockT--; I.block = true; return I; }
    if (f.onGround && f.state === 'normal' && target.state === 'move' && target.move.md.hits && adx < 130 && Math.random() < L.block * 0.25) { this.blockT = 14; I.block = true; return I; }
    // 4. move toward the target, but don't run off the stage after them
    const nearEdgeL = f.x < m.x1 + 50, nearEdgeR = f.x > m.x2 - 50;
    const reach = f.def.reach || 1;                 // long-reach fighters attack from farther away
    const chase = adx > 70 * reach * (0.8 + L.aim * 0.4);
    if (chase) {
      const goRight = dx > 0;
      if (!((goRight && nearEdgeR && target.x > m.x2) || (!goRight && nearEdgeL && target.x < m.x1))) I[goRight ? 'right' : 'left'] = true;
      if (f.onGround && dy < -110 && Math.random() < 0.06 + L.aim * 0.05) I.jumpP = true;
      if (f.onGround && dy > 80 && f.plat !== m && Math.random() < 0.05) I.downP = true;
      const zoner = f.def.id === 'wizard' ? 1.5 : 1;  // Zaldor loves throwing magic from a distance
      if (adx > 220 && this.cd <= 0 && Math.random() < L.special * 0.25 * zoner && f.state === 'normal') {
        I.left = dx < 0; I.right = dx > 0; I.specialP = true; I.left = I.right = false; this.cd = L.react * 3;
        f.face = dx > 0 ? 1 : -1;
      }
      return I;
    }
    // 5. close enough: attack
    if (this.cd <= 0 && f.state === 'normal' && f.landLag <= 0 && Math.random() < L.aggro) {
      f.face = dx > 0 ? 1 : -1;
      const r = Math.random();
      if (Math.random() < L.special) {
        I.specialP = true;
        if (dy < -90) I.up = !offstage && Math.random() < 0.3;
        else if (r < 0.5) { I.right = dx > 0; I.left = dx < 0; }
      } else {
        I.attackP = true;
        if (dy < -80) I.up = true;
        else if (!f.onGround && dy > 50) I.down = true;
        else if (r < 0.35) { I.right = dx > 0; I.left = dx < 0; }
        else if (r < 0.5 && f.onGround) I.down = true;
      }
      this.cd = Math.round(L.react + rand(4, 16) / L.aggro);
    } else if (f.onGround && Math.random() < 0.02) I.jumpP = true;
    return I;
  }
}
