'use strict';
// =====================================================================
//  Game flow: title → match rules → choose fighters → 3-2-1 → fight → results
// =====================================================================

let scene = 'title', sceneT = 0;
let battle = null, paused = false;
const rules = { teams: false, cpus: 1, cpuLevel: 0, items: true, stage: 4 };
let setupRow = 0;
let slots = [];          // { ctrl, fighter (index in ROSTER), team, ready }
let readyT = 0;
let lastSetup = null;
let titleFighters = null;

function go(next) { scene = next; sceneT = 0; paused = false; }

// ---------------------------------------------------------------- update
function update() {
  frameCount++; sceneT++;
  pollDevices();
  const A = anyDev();
  if (A.confirmP) initAudio();
  switch (scene) {
    case 'title':
      if (A.confirmP && sceneT > 20) { sfx.select(); go('setup'); }
      break;
    case 'setup': updateSetup(A); break;
    case 'select': updateSelect(A); break;
    case 'countdown':
      battle.fighters.forEach(f => f.animate());
      battle.updateCamera();
      if (sceneT % 50 === 1 && sceneT < 150) sfx.count();
      if (sceneT === 151) sfx.go();
      if (sceneT >= 151) go('fight');
      break;
    case 'fight': updateFight(); break;
    case 'results':
      if (sceneT > 40) {
        if (A.jumpP || A.attackP || A.startP || (keys.Enter && sceneT > 41 && A.confirmP)) { startBattle(lastSetup); }
        else if (A.specialP || A.backP) { slots.forEach(s => s.ready = false); go('select'); }
      }
      break;
  }
  endFrameInput();
}

// ---------------------------------------------------------------- rules screen
const SETUP_ROWS = ['MODE', 'COMPUTER FIGHTERS', 'COMPUTER LEVEL', 'ITEMS', 'STAGE', 'NEXT'];
function updateSetup(A) {
  if (A.upP) { setupRow = (setupRow + SETUP_ROWS.length - 1) % SETUP_ROWS.length; sfx.select(); }
  if (A.downP) { setupRow = (setupRow + 1) % SETUP_ROWS.length; sfx.select(); }
  const d = (A.rightP ? 1 : 0) - (A.leftP ? 1 : 0) || (A.confirmP && setupRow < 5 ? 1 : 0);
  if (d) {
    sfx.select();
    if (setupRow === 0) rules.teams = !rules.teams;
    if (setupRow === 1) rules.cpus = (rules.cpus + d + 4) % 4;
    if (setupRow === 2) rules.cpuLevel = (rules.cpuLevel + d + CPU_LEVELS.length) % CPU_LEVELS.length;
    if (setupRow === 3) rules.items = !rules.items;
    if (setupRow === 4) rules.stage = (rules.stage + d + 5) % 5;
  }
  if (setupRow === 5 && A.confirmP) {
    sfx.select();
    // whoever pressed A becomes Player 1
    const who = Object.keys(devices).find(id => devices[id].jumpP || devices[id].attackP || devices[id].startP) || 'kb1';
    slots = slots.filter(s => s.ctrl !== 'cpu');
    if (!slots.length) slots.push({ ctrl: who, fighter: 0, team: 0, ready: false });
    slots.forEach(s => s.ready = false);
    fillCPUs();
    go('select');
  }
  if (A.backP && sceneT > 10) go('title');
}

// ---------------------------------------------------------------- choose fighters
function fillCPUs() {
  const humans = slots.filter(s => s.ctrl !== 'cpu');
  const cpus = slots.filter(s => s.ctrl === 'cpu');
  const want = Math.min(rules.cpus, 4 - humans.length);
  while (cpus.length > want) cpus.pop();
  while (cpus.length < want) cpus.push({ ctrl: 'cpu', fighter: Math.floor(Math.random() * ROSTER.length), team: 0, ready: true });
  slots = humans.concat(cpus);
  // keep teams fair: computers join whichever team is smaller
  if (rules.teams) {
    for (const c of cpus) {
      const t0 = slots.filter(s => s !== c && s.team === 0).length, t1 = slots.filter(s => s !== c && s.team === 1).length;
      c.team = t0 <= t1 ? 0 : 1;
    }
  }
}
function updateSelect(A) {
  // new players join by pressing a button on their controller (or keyboard)
  for (const id in devices) {
    const d = devices[id];
    if (slots.some(s => s.ctrl === id)) continue;
    if ((d.jumpP || d.attackP) && slots.filter(s => s.ctrl !== 'cpu').length < 4) {
      const humans = slots.filter(s => s.ctrl !== 'cpu').length;
      slots.splice(humans, 0, { ctrl: id, fighter: humans % ROSTER.length, team: humans % 2, ready: false });
      fillCPUs(); sfx.join();
    }
  }
  for (const s of slots) {
    if (s.ctrl === 'cpu') continue;
    const d = dev(s.ctrl);
    if (!s.ready) {
      if (d.leftP) { s.fighter = (s.fighter + ROSTER.length - 1) % ROSTER.length; sfx.select(); }
      if (d.rightP) { s.fighter = (s.fighter + 1) % ROSTER.length; sfx.select(); }
      if (rules.teams && (d.upP || d.downP)) { s.team = 1 - s.team; sfx.select(); }
      if ((d.jumpP || d.attackP) && sceneT > 8) { s.ready = true; sfx.ready(); }
      else if (d.specialP || d.backP) {
        slots.splice(slots.indexOf(s), 1); fillCPUs();
        if (!slots.some(x => x.ctrl !== 'cpu')) { go('setup'); return; }
      }
    } else if (d.specialP || d.backP) { s.ready = false; sfx.select(); }
  }
  const humans = slots.filter(s => s.ctrl !== 'cpu');
  const teamsOk = !rules.teams || (slots.some(s => s.team === 0) && slots.some(s => s.team === 1));
  const allReady = humans.length > 0 && humans.every(s => s.ready) && slots.length >= 2 && teamsOk;
  readyT = allReady ? readyT + 1 : 0;
  if (readyT > 50) {
    const stage = rules.stage === 4 ? Math.floor(Math.random() * STAGES.length) : rules.stage;
    startBattle({ stage, items: rules.items, teams: rules.teams,
                  entries: slots.map(s => ({ fighter: ROSTER[s.fighter], ctrl: s.ctrl, team: s.team, cpuLevel: rules.cpuLevel })) });
  }
}

function startBattle(setup) {
  lastSetup = setup;
  battle = new Battle(setup);
  readyT = 0;
  go('countdown');
}

// ---------------------------------------------------------------- the fight
function updateFight() {
  const humans = battle.fighters.filter(f => !f.ai).map(f => f.ctrl);
  const pressed = f => humans.some(id => dev(id)[f + 'P']);
  if (!paused && (pressed('start') || pressed('back')) && !battle.over) { paused = true; sfx.pause(); return; }
  if (paused) {
    if (pressed('start')) { paused = false; sfx.pause(); }
    else if (pressed('back')) { slots.forEach(s => s.ready = false); go('select'); }
    return;
  }
  const inputs = {};
  for (const id of humans) {
    const d = dev(id);
    inputs[id] = { left: d.left, right: d.right, up: d.up, down: d.down, jump: d.jump, jumpP: d.jumpP,
                   attackP: d.attackP, specialP: d.specialP, special: d.special, block: d.block, downP: d.downP, upP: d.upP };
  }
  battle.update(inputs);
  if (battle.over && battle.overT > 170) { sfx.win(); go('results'); }
}

// ---------------------------------------------------------------- drawing
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  switch (scene) {
    case 'title': drawTitle(); break;
    case 'setup': drawSetup(); break;
    case 'select': drawSelect(); break;
    case 'countdown': battle.draw(); drawHUD(); drawCountdown(); break;
    case 'fight': battle.draw(); drawHUD(); if (paused) drawPause(); if (battle.over && battle.slow <= 0 && battle.overT > 20) drawGame(); break;
    case 'results': drawResults(); break;
  }
}

function idlePose(t) { const p = { ...POSES.idle }; p.y += Math.sin(t * 0.09) * 2; return p; }

function drawTitle() {
  STAGES[0].bg({ x: frameCount * 0.6, y: 0 });
  ctx.fillStyle = 'rgba(20,10,50,0.35)'; ctx.fillRect(0, 0, SW, SH);
  // fighters lined up
  ROSTER.forEach((id, i) => {
    const d = FIGHTERS[id], x = 240 + i * 200, y = 560;
    const pose = (Math.floor(frameCount / 90) % ROSTER.length) === i ? lerpPose(POSES.idle, POSES.victory, 0.9) : idlePose(frameCount + i * 30);
    ctx.save(); ctx.translate(x, y); ctx.scale(1.6, 1.6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawFighter(d, pose, 0, 0, i < 2 ? 1 : -1, { time: frameCount + i * 40 });
    ctx.restore();
  });
  const bob = Math.sin(frameCount * 0.05) * 6;
  ctx.save(); ctx.translate(SW / 2, 150 + bob); ctx.rotate(-0.04);
  text('MEGA', 0, -50, 110, '#facc15', 'center', OUTLINE);
  text('BRAWLERS', 0, 50, 120, '#ef4444', 'center', OUTLINE);
  ctx.restore();
  if ((frameCount >> 5) % 2) text('PRESS A TO START', SW / 2, 330, 40, '#fff');
  text(IS_XBOX ? 'XBOX: HOLD THE MENU BUTTON FOR A SECOND TO USE YOUR CONTROLLER' : 'UP TO 4 PLAYERS WITH CONTROLLERS · F11 = FULL SCREEN', SW / 2, 380, 20, '#e0e7ff', 'center', OUTLINE, FONT2);
  text('A GAME BY MURILO', SW / 2, SH - 26, 22, '#fff');
}

function drawSetup() {
  STAGES[2].bg({ x: frameCount * 0.4, y: 0 });
  ctx.fillStyle = 'rgba(15,8,40,0.55)'; ctx.fillRect(0, 0, SW, SH);
  text('MATCH RULES', SW / 2, 70, 64, '#facc15');
  const stageName = rules.stage === 4 ? 'RANDOM' : STAGES[rules.stage].name;
  const values = [rules.teams ? '2 VS 2 TEAMS' : 'FREE-FOR-ALL', String(rules.cpus), CPU_LEVELS[rules.cpuLevel].name, rules.items ? 'ON' : 'OFF', stageName, ''];
  SETUP_ROWS.forEach((r, i) => {
    const y = 160 + i * 72, sel = i === setupRow;
    panel(SW / 2 - 380, y - 28, 760, 56, sel ? 'rgba(250,204,21,0.25)' : 'rgba(20,12,40,0.7)', sel ? '#facc15' : 'rgba(255,255,255,0.4)');
    if (i === 5) { text('CHOOSE FIGHTERS  ▶', SW / 2, y, 36, sel ? '#facc15' : '#fff'); return; }
    text(r, SW / 2 - 350, y, 30, sel ? '#facc15' : '#fff', 'left');
    text((sel ? '◀  ' : '') + values[i] + (sel ? '  ▶' : ''), SW / 2 + 350, y, 30, '#a5f3fc', 'right');
  });
  text('STICK: CHOOSE    A: NEXT    B: BACK', SW / 2, SH - 40, 22, '#e0e7ff', 'center', OUTLINE, FONT2);
}

function drawSelect() {
  STAGES[1].bg({ x: frameCount * 0.3, y: 0 });
  ctx.fillStyle = 'rgba(15,8,40,0.5)'; ctx.fillRect(0, 0, SW, SH);
  text('CHOOSE YOUR FIGHTER', SW / 2, 54, 56, '#facc15');
  const n = 4, pw = 290, gap = 18, x0 = (SW - (n * pw + (n - 1) * gap)) / 2;
  for (let i = 0; i < n; i++) {
    const s = slots[i], x = x0 + i * (pw + gap), y = 100, ph = 520;
    if (!s) {
      panel(x, y, pw, ph, 'rgba(20,12,40,0.55)', 'rgba(255,255,255,0.3)');
      if ((frameCount >> 5) % 2) text('PRESS A', x + pw / 2, y + ph / 2 - 20, 36, '#fff');
      text('TO JOIN', x + pw / 2, y + ph / 2 + 20, 28, '#cbd5e1');
      continue;
    }
    const d = FIGHTERS[ROSTER[s.fighter]];
    const col = rules.teams ? TEAM_COLORS[s.team] : SLOT_COLORS[i];
    panel(x, y, pw, ph, 'rgba(20,12,40,0.8)', col);
    rrect(x, y, pw, 48, 14); ctx.fillStyle = col; ctx.fill();
    text(s.ctrl === 'cpu' ? 'CPU' : 'P' + (i + 1), x + pw / 2, y + 26, 34, '#fff');
    // the fighter, big
    const pose = s.ready ? lerpPose(POSES.idle, POSES.victory, 0.85) : idlePose(frameCount + i * 20);
    ctx.save(); ctx.translate(x + pw / 2, y + 330); ctx.scale(2.2, 2.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawFighter(d, pose, 0, 0, 1, { time: frameCount + i * 40 });
    ctx.restore();
    text(d.name, x + pw / 2, y + 372, 40, d.color);
    text(d.title, x + pw / 2, y + 408, 22, '#e0e7ff', 'center', OUTLINE, FONT2);
    const sp = d.specials;
    [['B', sp.nspec.name], ['▶B', sp.sspec.name], ['▲B', sp.uspec.name], ['▼B', sp.dspec.name]].forEach(([k, nm], j) => {
      text(k + '  ' + nm, x + 20, y + 440 + j * 20, 15, '#cbd5e1', 'left', null, FONT2);
    });
    if (s.ctrl !== 'cpu' && !s.ready) {
      text('◀', x + 22, y + 250, 40, '#fff'); text('▶', x + pw - 22, y + 250, 40, '#fff');
      if (rules.teams) text('▲▼ TEAM', x + pw / 2, y + 74, 18, '#fff', 'center', OUTLINE, FONT2);
    }
    if (rules.teams) text(s.team ? 'BLUE TEAM' : 'RED TEAM', x + pw / 2, y + 96, 22, col);
    if (s.ready) {
      ctx.save(); ctx.translate(x + pw / 2, y + 170); ctx.rotate(-0.12);
      text('READY!', 0, 0, 52, '#4ade80'); ctx.restore();
    }
  }
  const humans = slots.filter(s => s.ctrl !== 'cpu');
  let msg = 'STICK: PICK A FIGHTER    A: READY    B: BACK';
  if (slots.length < 2) msg = 'NEED AT LEAST 2 FIGHTERS: ADD A COMPUTER OR A FRIEND';
  else if (rules.teams && !(slots.some(s => s.team === 0) && slots.some(s => s.team === 1))) msg = 'BOTH TEAMS NEED A FIGHTER';
  else if (humans.every(s => s.ready)) msg = 'GET READY...';
  text(msg, SW / 2, SH - 40, 26, '#fff', 'center', OUTLINE, FONT2);
}

function drawHUD() {
  const fs = battle.fighters, n = fs.length, pw = 270, gap = 16, x0 = (SW - (n * pw + (n - 1) * gap)) / 2, y = SH - 96;
  fs.forEach((f, i) => {
    const x = x0 + i * (pw + gap);
    const col = battle.teams ? TEAM_COLORS[f.team] : SLOT_COLORS[f.slot];
    ctx.globalAlpha = f.alive ? 1 : 0.55;
    panel(x, y, pw, 80, 'rgba(20,12,40,0.82)', col, 12);
    // portrait
    ctx.save(); rrect(x + 6, y + 6, 68, 68, 10); ctx.clip();
    ctx.fillStyle = col; ctx.globalAlpha *= 0.35; ctx.fillRect(x + 6, y + 6, 68, 68); ctx.globalAlpha = f.alive ? 1 : 0.55;
    ctx.translate(x + 40, y + 6 + 68 + f.def.rig.head * 2.4); ctx.scale(1.45, 1.45);
    drawFighter(f.def, POSES.idle, 0, 0, 1, { time: 0 });
    ctx.restore();
    text((f.ai ? 'CPU ' : 'P' + (f.slot + 1) + ' ') + f.def.name, x + 84, y + 20, 22, '#fff', 'left');
    // health bar
    const bw = pw - 96, hpk = f.hp / MAX_HP;
    rrect(x + 84, y + 38, bw, 22, 8); ctx.fillStyle = '#1f1235'; ctx.fill();
    if (hpk > 0) {
      rrect(x + 84, y + 38, Math.max(10, bw * hpk), 22, 8);
      ctx.fillStyle = hpk > 0.5 ? '#22c55e' : hpk > 0.25 ? '#facc15' : ((frameCount >> 3) % 2 ? '#ef4444' : '#f87171'); ctx.fill();
    }
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; rrect(x + 84, y + 38, bw, 22, 8); ctx.stroke();
    text(Math.ceil(f.hp) + '', x + 84 + bw / 2, y + 50, 20, '#fff');
    let ix = x + pw - 22;
    if (f.star > 0) { text('★', ix, y + 20, 22, `hsl(${(frameCount * 12) % 360},100%,60%)`); ix -= 26; }
    if (f.item === 'bomb') { text('●', ix, y + 20, 22, '#111827', 'center', '#fff'); ix -= 26; }
    if (f.hammer > 0) { text('T', ix, y + 20, 22, '#ef4444'); ix -= 26; }
    if (!f.alive) { ctx.globalAlpha = 1; text('K.O.', x + pw / 2, y + 40, 46, '#ef4444'); }
    ctx.globalAlpha = 1;
  });
}

function drawCountdown() {
  const n = sceneT < 50 ? '3' : sceneT < 100 ? '2' : sceneT < 150 ? '1' : 'FIGHT!';
  const k = (sceneT % 50) / 50;
  ctx.save(); ctx.translate(SW / 2, SH / 2 - 40); ctx.scale(1.6 - k * 0.5, 1.6 - k * 0.5);
  text(n, 0, 0, 130, n === 'FIGHT!' ? '#ef4444' : '#facc15');
  ctx.restore();
  text(battle.stage.name, SW / 2, 60, 40, '#fff');
}

function drawPause() {
  ctx.fillStyle = 'rgba(10,5,30,0.6)'; ctx.fillRect(0, 0, SW, SH);
  text('PAUSED', SW / 2, SH / 2 - 60, 90, '#facc15');
  text('MENU / ENTER: KEEP FIGHTING', SW / 2, SH / 2 + 20, 28, '#fff', 'center', OUTLINE, FONT2);
  text('VIEW / ESC: QUIT TO FIGHTER SELECT', SW / 2, SH / 2 + 60, 28, '#cbd5e1', 'center', OUTLINE, FONT2);
}

function drawGame() {
  const k = Math.min(1, battle.overT / 30);
  ctx.save(); ctx.translate(SW / 2, SH / 2 - 60); ctx.scale(0.5 + k * 0.5, 0.5 + k * 0.5);
  text('GAME!', 0, 0, 150, '#facc15');
  ctx.restore();
}

function winnerText() {
  const w = battle.winner;
  if (!w) return { s: 'NO CONTEST', c: '#fff' };
  if (w[0] === 't') { const t = +w.slice(1); return { s: (t ? 'BLUE' : 'RED') + ' TEAM WINS!', c: TEAM_COLORS[t] }; }
  const f = battle.fighters[+w.slice(1)];
  return { s: f.def.name + ' WINS!', c: f.def.color };
}

function drawResults() {
  battle.stage.bg({ x: frameCount * 0.5, y: 0 });
  ctx.fillStyle = 'rgba(10,5,30,0.6)'; ctx.fillRect(0, 0, SW, SH);
  const wt = winnerText();
  text(wt.s, SW / 2, 74, 76, wt.c);
  const fs = battle.fighters, n = fs.length, pw = 270, gap = 20, x0 = (SW - (n * pw + (n - 1) * gap)) / 2;
  const w = battle.winner;
  fs.forEach((f, i) => {
    const x = x0 + i * (pw + gap), y = 140;
    const won = w && (w === 't' + f.team || w === 's' + f.slot);
    const col = battle.teams ? TEAM_COLORS[f.team] : SLOT_COLORS[f.slot];
    panel(x, y, pw, 460, won ? 'rgba(250,204,21,0.18)' : 'rgba(20,12,40,0.8)', won ? '#facc15' : col);
    const hop = won ? Math.abs(Math.sin(frameCount * 0.1 + i)) * 20 : 0;
    const pose = won ? lerpPose(POSES.idle, POSES.victory, 0.9) : POSES.dizzy;
    ctx.save(); ctx.translate(x + pw / 2, y + 250 - hop); ctx.scale(2, 2);
    drawFighter(f.def, pose, 0, 0, 1, { time: frameCount + i * 30 });
    ctx.restore();
    if (won) text('WINNER!', x + pw / 2, y + 36, 40, '#facc15');
    text((f.ai ? 'CPU ' : 'P' + (f.slot + 1) + ' ') + f.def.name, x + pw / 2, y + 290, 30, f.def.color);
    text('KNOCKOUTS: ' + f.kos, x + pw / 2, y + 340, 24, '#fff', 'center', OUTLINE, FONT2);
    text('DAMAGE DEALT: ' + Math.round(f.dmgDealt), x + pw / 2, y + 374, 24, '#fff', 'center', OUTLINE, FONT2);
    text('FELL OFF: ' + f.falls, x + pw / 2, y + 408, 24, '#fff', 'center', OUTLINE, FONT2);
  });
  if (sceneT > 40 && (frameCount >> 5) % 2) text('A: REMATCH     B: CHOOSE FIGHTERS', SW / 2, SH - 50, 34, '#fff');
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
