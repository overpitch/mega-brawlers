'use strict';
// =====================================================================
//  Fighters: their looks (a cartoon "puppet" of limbs that gets posed),
//  their stats, and their moves.
// =====================================================================

const OUTLINE = '#1a1030';

// ---------------------------------------------------------------- poses
// Angles are in degrees. Limbs: 0 = hanging straight down, 90 = pointing forward, 180 = straight up.
// bl/fl = back/front leg [thigh, shin], ba/fa = back/front arm [upper, forearm].
// y = how far the hips drop (crouch), lean = body tilt forward, rot = whole-body spin.
const P = (y, lean, bl, fl, ba, fa, head = 0, rot = 0) => ({ y, lean, bl, fl, ba, fa, head, rot });
const POSES = {
  idle:      P(2, 4, [-14, -4], [16, 6], [25, 85], [45, 110]),
  crouch:    P(18, 18, [-40, 25], [60, -5], [30, 90], [50, 120]),
  jump:      P(0, 0, [40, -25], [75, 5], [120, 150], [150, 165]),
  fall:      P(0, -4, [-6, 6], [16, 30], [110, 130], [135, 150]),
  punchW:    P(4, -6, [-18, -6], [22, 8], [10, 60], [-25, 50]),
  punch:     P(4, 18, [-28, -10], [32, 10], [-25, 25], [88, 90]),
  kickW:     P(2, -8, [-10, -4], [65, -45], [-20, 30], [60, 110]),
  kick:      P(0, -22, [-10, -6], [95, 96], [-35, 15], [55, 100]),
  uppercutW: P(14, 14, [-30, 10], [40, -10], [20, 70], [20, 95]),
  uppercut:  P(-6, -8, [-12, -4], [14, 4], [15, 60], [175, 180]),
  sweepW:    P(18, 20, [-40, 20], [55, -5], [30, 80], [40, 90]),
  sweep:     P(32, 34, [-70, -10], [88, 90], [-20, 10], [40, 60]),
  spin:      P(0, 0, [-70, -85], [70, 85], [-110, -115], [110, 115]),
  airkickW:  P(0, -5, [20, -20], [70, -30], [-30, 20], [60, 100]),
  airkick:   P(0, -12, [20, -30], [92, 94], [-40, 0], [50, 90]),
  flipkickW: P(0, 10, [40, -20], [60, -10], [40, 90], [60, 110]),
  flipkick:  P(0, -28, [30, -20], [172, 176], [60, 90], [80, 120]),
  stompW:    P(-6, 0, [50, -30], [60, -20], [130, 150], [140, 160]),
  stomp:     P(-10, 0, [4, 4], [-4, -4], [160, 170], [165, 175]),
  castW:     P(4, -10, [-14, -4], [18, 6], [40, 80], [-30, 40]),
  cast:      P(4, 12, [-24, -8], [28, 8], [40, 70], [90, 92]),
  castUpW:   P(10, 6, [-20, 0], [24, 4], [20, 60], [30, 80]),
  castUp:    P(-4, -6, [-12, -4], [14, 4], [150, 165], [170, 178]),
  castDown:  P(10, 18, [-24, 6], [30, 4], [10, -10], [30, 10]),
  dash:      P(4, 38, [-60, -30], [40, 20], [-60, -40], [90, 90]),
  headbutt:  P(0, 80, [-80, -90], [-60, -80], [-90, -95], [-85, -90]),
  rise:      P(-4, -4, [0, 10], [40, -10], [-10, 10], [175, 180]),
  meditate:  P(30, 0, [70, -70], [85, -85], [100, 168], [100, 168]),
  counter:   P(8, -6, [-22, -6], [26, 8], [60, 150], [70, 140]),
  hurt:      P(0, -26, [-30, -20], [30, 10], [120, 100], [150, 170], -15),
  block:     P(6, -4, [-20, -6], [24, 8], [70, 140], [80, 150]),
  ledge:     P(0, 0, [-6, 0], [6, 4], [175, 180], [178, 180]),
  helpless:  P(0, -10, [-10, 10], [20, 40], [150, 175], [130, 160], 10),
  victory:   P(-4, -6, [-14, -4], [16, 6], [-20, -40], [172, 178]),
  dizzy:     P(6, -10, [-14, -4], [16, 6], [20, 40], [30, 50], 20),
  throwW:    P(4, -10, [-14, -4], [18, 6], [20, 60], [160, 140]),
  throw:     P(4, 20, [-24, -8], [28, 8], [-20, 30], [70, 60]),
  hammerW:   P(4, -14, [-14, -4], [18, 6], [178, 180], [176, 180]),
  hammer:    P(10, 30, [-30, -10], [36, 10], [80, 90], [90, 92]),
  swipe:     P(4, 10, [-24, -8], [28, 8], [130, 160], [60, 30]),
};

function lerpPose(a, b, t) {
  const L2 = (u, v) => [lerp(u[0], v[0], t), lerp(u[1], v[1], t)];
  return { y: lerp(a.y, b.y, t), lean: lerp(a.lean, b.lean, t), head: lerp(a.head, b.head, t), rot: lerp(a.rot, b.rot, t),
           bl: L2(a.bl, b.bl), fl: L2(a.fl, b.fl), ba: L2(a.ba, b.ba), fa: L2(a.fa, b.fa) };
}
function runPose(t) {
  const p = t * 0.32, s = Math.sin(p), c = Math.cos(p);
  return P(Math.abs(s) * -3, 14,
    [-38 * s, -38 * s - 40 * Math.max(0, c)], [38 * s, 38 * s - 40 * Math.max(0, -c)],
    [35 * s, 35 * s + 70], [-35 * s, -35 * s + 70]);
}

// ---------------------------------------------------------------- drawing the puppet
const v = (a, len) => [Math.sin(a * DEG) * len, Math.cos(a * DEG) * len];
function seg(p1, p2, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 6;
  ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
}
function blob(x, y, r, color, ry = r) {
  ctx.beginPath(); ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
}
function shape(points, color) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
}

/** Works out where every joint is for a pose. Facing right; (0, 0) is between the feet. */
function joints(def, pose) {
  const r = def.rig;
  const hip = [0, -(r.thigh + r.shin) + pose.y];
  const leg = a => { const k = [hip[0] + v(a[0], r.thigh)[0], hip[1] + v(a[0], r.thigh)[1]]; return [k, [k[0] + v(a[1], r.shin)[0], k[1] + v(a[1], r.shin)[1]]]; };
  const neck = [hip[0] + Math.sin(pose.lean * DEG) * r.torso, hip[1] - Math.cos(pose.lean * DEG) * r.torso];
  const sh = [lerp(neck[0], hip[0], 0.12), lerp(neck[1], hip[1], 0.12)];
  const arm = a => { const e = [sh[0] + v(a[0], r.upper)[0], sh[1] + v(a[0], r.upper)[1]]; return [e, [e[0] + v(a[1], r.fore)[0], e[1] + v(a[1], r.fore)[1]]]; };
  const ha = (pose.lean + pose.head) * DEG;
  const head = [neck[0] + Math.sin(ha) * r.head * 0.85, neck[1] - Math.cos(ha) * r.head * 0.85];
  return { hip, neck, sh, head, ha, bl: leg(pose.bl), fl: leg(pose.fl), ba: arm(pose.ba), fa: arm(pose.fa) };
}

/**
 * Draws a fighter. (x, y) is between their feet, in world units.
 * opts: { alpha, flash (white), tint, vx (for capes/scarves), time }
 */
function drawFighter(def, pose, x, y, face, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * (def.scale || 1), def.scale || 1);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (pose.rot) {
    const cy = -(def.rig.thigh + def.rig.shin) * 0.9;
    ctx.translate(0, cy); ctx.rotate(pose.rot * DEG); ctx.translate(0, -cy);
  }
  const J = joints(def, pose);
  def.draw(J, pose, opts);
  if (opts.flash) {
    // a white copy of the fighter on top, only where the fighter is
    ctx.save();
    ctx.filter = 'brightness(0) invert(1)';
    ctx.globalAlpha = (opts.alpha ?? 1) * Math.min(1, opts.flash);
    def.draw(J, pose, opts);
    ctx.restore();
  }
  ctx.restore();
}

// Shared body-part painters
function limbs(J, part, upperW, lowerW, cUpper, cLower) {
  seg(J[part === 'ba' || part === 'fa' ? 'sh' : 'hip'], J[part][0], upperW, cUpper);
  seg(J[part][0], J[part][1], lowerW, cLower);
}
function hand(p, color, r = 6) { blob(p[0], p[1], r, color); }
function shoe(p, color, a = 0) {
  ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(a);
  ctx.beginPath(); ctx.ellipse(5, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.restore();
}
function torsoShape(J, w1, w2, color) {
  const dx = J.neck[0] - J.hip[0], dy = J.neck[1] - J.hip[1];
  const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  shape([
    [J.neck[0] + nx * w1, J.neck[1] + ny * w1], [J.neck[0] - nx * w1, J.neck[1] - ny * w1],
    [J.hip[0] - nx * w2, J.hip[1] - ny * w2], [J.hip[0] + nx * w2, J.hip[1] + ny * w2],
  ], color);
}
function eyes(J, r, look = 1, color = '#1a1030') {
  const ex = J.head[0] + r * 0.35, ey = J.head[1] - r * 0.1;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.2, r * 0.27, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(ex + r * 0.06 * look, ey + 1, r * 0.11, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- the five fighters
function heroDraw(c) {
  // Murilo and Maher: cap, shirt, overalls
  return (J, pose, o) => {
    const r = this_rig(c);
    limbs(J, 'ba', 11, 10, c.shirt, c.shirt); hand(J.ba[1], c.glove);
    limbs(J, 'bl', 13, 12, c.pants, c.pants); shoe(J.bl[1], c.shoe);
    torsoShape(J, 15, 15, c.shirt);
    torsoShape({ neck: [lerp(J.neck[0], J.hip[0], 0.45), lerp(J.neck[1], J.hip[1], 0.45)], hip: J.hip }, 14, 16, c.pants);
    blob(lerp(J.neck[0], J.hip[0], 0.45) + 4, lerp(J.neck[1], J.hip[1], 0.45) + 3, 3, '#facc15');
    limbs(J, 'fl', 13, 12, c.pants, c.pants); shoe(J.fl[1], c.shoe);
    // head
    const hx = J.head[0], hy = J.head[1], R = r.head;
    blob(hx, hy, R, c.skin);
    ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(hx - R * 0.55, hy + R * 0.1, R * 0.35, R * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    eyes(J, R);
    blob(hx + R * 0.85, hy + R * 0.25, R * 0.2, c.nose);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx + R * 0.45, hy + R * 0.45, R * 0.25, 0.1, 1.4); ctx.stroke();
    // cap
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(J.ha * 0.6);
    ctx.beginPath(); ctx.arc(0, -R * 0.15, R * 1.02, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = c.cap; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(R * 0.85, -R * 0.15, R * 0.7, R * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.cap; ctx.fill(); ctx.stroke();
    blob(0, -R * 0.62, R * 0.32, '#fff');
    text('M', 0, -R * 0.6, R * 0.5, c.cap, 'center', null);
    ctx.restore();
    limbs(J, 'fa', 11, 10, c.shirt, c.shirt); hand(J.fa[1], c.glove, 7);
  };
}
function this_rig(c) { return c.rigRef; }

function wizardDraw(c) {
  return (J, pose, o) => {
    const r = c.rigRef;
    const sway = clamp(-(o.vx || 0) * 2.2, -16, 16) + Math.sin((o.time || 0) * 0.08) * 2;
    limbs(J, 'ba', 15, 13, c.robeDark, c.robeDark); hand(J.ba[1], c.skin);
    // feet peek out under the robe
    shoe(J.bl[1], c.shoe); shoe(J.fl[1], c.shoe);
    // robe: from the shoulders, flaring out to a hem near the feet
    const hemY = Math.max(J.bl[1][1], J.fl[1][1]) - 8;
    const midX = (J.bl[1][0] + J.fl[1][0]) / 2;
    shape([
      [J.neck[0] - 14, J.neck[1] + 2], [J.neck[0] + 14, J.neck[1] + 2],
      [J.hip[0] + 20, J.hip[1]], [midX + 30 + sway, hemY], [midX - 30 + sway, hemY + 4], [J.hip[0] - 20, J.hip[1]],
    ], c.robe);
    for (let i = 0; i < 3; i++) {          // little stars on the robe
      const sx = lerp(J.hip[0], midX, 0.5) + (i - 1) * 14 + sway * 0.5, sy = lerp(J.hip[1], hemY, 0.3 + i * 0.2);
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    shape([[J.hip[0] - 18, J.hip[1] - 4], [J.hip[0] + 18, J.hip[1] - 4], [J.hip[0] + 18, J.hip[1] + 4], [J.hip[0] - 18, J.hip[1] + 4]], c.belt);
    // head, beard and the tall pointy hat
    const hx = J.head[0], hy = J.head[1], R = r.head;
    blob(hx, hy, R, c.skin);
    shape([[hx - R * 0.5, hy + R * 0.2], [hx + R * 0.95, hy + R * 0.2], [hx + R * 0.3, hy + R * 1.9 + Math.sin((o.time || 0) * 0.1) * 2]], c.beard);
    eyes(J, R);
    blob(hx + R * 0.85, hy + R * 0.15, R * 0.2, '#f4a582');
    ctx.save(); ctx.translate(hx, hy - R * 0.5); ctx.rotate(J.ha * 0.5 - 0.15 - sway * 0.01);
    shape([[-R * 1.1, 0], [R * 1.25, 0], [R * 0.2 - sway * 0.6, -R * 2.6], [-R * 0.4 - sway * 0.8, -R * 2.2]], c.hat);
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.5, R * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.hat; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(R * 0.1, -R * 1.1, 3.5, 0, Math.PI * 2); ctx.arc(-R * 0.3, -R * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // staff in the front hand
    const hnd = J.fa[1], el = J.fa[0];
    const dx = hnd[0] - el[0], dy = hnd[1] - el[1], L = Math.hypot(dx, dy) || 1;
    const ux = -dy / L, uy = dx / L;                 // the staff stands across the forearm
    const top = [hnd[0] - ux * 52, hnd[1] - uy * 52], bot = [hnd[0] + ux * 26, hnd[1] + uy * 26];
    seg(bot, top, 6, '#8b5a2b');
    const glow = 0.6 + Math.sin((o.time || 0) * 0.15) * 0.3;
    ctx.fillStyle = `rgba(167,139,250,${glow * 0.5})`; ctx.beginPath(); ctx.arc(top[0], top[1], 16, 0, Math.PI * 2); ctx.fill();
    blob(top[0], top[1], 8, '#c4b5fd');
    limbs(J, 'fa', 15, 13, c.robe, c.robe); hand(J.fa[1], c.skin, 6.5);
  };
}

function ninjaDraw(c) {
  return (J, pose, o) => {
    const r = c.rigRef, t = o.time || 0;
    // scarf tails stream out behind
    const tail = (len, off) => {
      const pts = [[J.neck[0], J.neck[1] + 4]];
      for (let i = 1; i <= 5; i++) {
        const k = i / 5;
        pts.push([J.neck[0] - k * len - clamp(Math.abs(o.vx || 0) * 3 * k, 0, 40), J.neck[1] + 4 + Math.sin(t * 0.25 + i + off) * 4 * k + k * 10 - clamp(Math.abs(o.vx || 0), 0, 8) * k * 2]);
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 11;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = c.scarf; ctx.lineWidth = 6;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    };
    tail(34, 0); tail(26, 2);
    // sword on the back
    seg([J.neck[0] - 18, J.neck[1] - 10], [J.hip[0] + 14, J.hip[1] + 6], 5, '#9ca3af');
    limbs(J, 'ba', 10, 9, c.suit, c.suit); hand(J.ba[1], c.suit, 5.5);
    limbs(J, 'bl', 12, 11, c.suit, c.suit); shoe(J.bl[1], c.shoe);
    torsoShape(J, 13, 12, c.suit);
    shape([[J.hip[0] - 14, J.hip[1] - 6], [J.hip[0] + 14, J.hip[1] - 6], [J.hip[0] + 14, J.hip[1] + 2], [J.hip[0] - 14, J.hip[1] + 2]], c.scarf);
    limbs(J, 'fl', 12, 11, c.suit, c.suit); shoe(J.fl[1], c.shoe);
    const hx = J.head[0], hy = J.head[1], R = r.head;
    blob(hx, hy, R, c.suit);
    // eye slit
    ctx.save(); ctx.beginPath(); ctx.ellipse(hx + R * 0.25, hy - R * 0.05, R * 0.75, R * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.skin; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath(); ctx.ellipse(hx + R * 0.5, hy - R * 0.05, R * 0.1, R * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx + R * 0.2, hy - R * 0.4); ctx.lineTo(hx + R * 0.75, hy - R * 0.28); ctx.stroke();
    // headband
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(J.ha * 0.5);
    ctx.fillStyle = c.scarf; ctx.fillRect(-R, -R * 0.62, R * 2, R * 0.28);
    ctx.restore();
    limbs(J, 'fa', 10, 9, c.suit, c.suit); hand(J.fa[1], c.suit, 6);
  };
}

function monkDraw(c) {
  return (J, pose, o) => {
    const r = c.rigRef;
    limbs(J, 'ba', 11, 10, c.robe, c.skin); hand(J.ba[1], c.skin);
    limbs(J, 'bl', 13, 12, c.pants, c.pants); shoe(J.bl[1], c.shoe);
    torsoShape(J, 15, 16, c.robe);
    // robe drape across the chest and the sash
    shape([[J.neck[0] - 6, J.neck[1] + 2], [J.neck[0] + 14, J.neck[1] + 4], [J.hip[0] + 4, J.hip[1] - 6]], c.robeDark);
    shape([[J.hip[0] - 17, J.hip[1] - 8], [J.hip[0] + 17, J.hip[1] - 8], [J.hip[0] + 17, J.hip[1] + 2], [J.hip[0] - 17, J.hip[1] + 2]], c.sash);
    // robe skirt
    const kx = (J.bl[0][0] + J.fl[0][0]) / 2, ky = (J.bl[0][1] + J.fl[0][1]) / 2;
    shape([[J.hip[0] - 17, J.hip[1]], [J.hip[0] + 17, J.hip[1]], [kx + 18, ky + 4], [kx - 18, ky + 4]], c.robe);
    limbs(J, 'fl', 13, 12, c.pants, c.pants); shoe(J.fl[1], c.shoe);
    const hx = J.head[0], hy = J.head[1], R = r.head;
    blob(hx, hy, R, c.skin);
    ctx.fillStyle = '#e8a07a';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx - R * 0.35 + i * R * 0.3, hy - R * 0.65, 1.8, 0, Math.PI * 2); ctx.fill(); }
    eyes(J, R);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx + R * 0.1, hy - R * 0.45); ctx.lineTo(hx + R * 0.65, hy - R * 0.4); ctx.stroke();
    blob(hx + R * 0.88, hy + R * 0.2, R * 0.18, '#e8a07a');
    blob(hx - R * 0.95, hy + R * 0.05, R * 0.22, c.skin);   // ear
    limbs(J, 'fa', 11, 10, c.skin, c.skin); hand(J.fa[1], c.skin, 7);
    // wrist wraps
    blob(lerp(J.fa[0][0], J.fa[1][0], 0.7), lerp(J.fa[0][1], J.fa[1][1], 0.7), 5, c.wrap);
  };
}

// ---------------------------------------------------------------- moves
/** Normal attacks, shaped by each fighter's reach (R), power (Pw) and speed (S). Boxes: [forward, up, width, height]. */
function normals(R, Pw, S, style = {}) {
  const f = a => Math.max(1, Math.round(a * S));
  return {
    jab:  { dur: f(18), pose: style.jab || 'punch', fx: style.fx, hits: [{ f: [f(4), f(7)], box: [8, -66, 44 * R, 26], dmg: 3 * Pw, kb: 5, ang: 30 }] },
    side: { dur: f(36), pose: style.side || 'kick', fx: style.fx, lunge: 3, hits: [{ f: [f(11), f(15)], box: [10, -62, 60 * R, 32], dmg: 12 * Pw, kb: 12, ang: 36 }] },
    up:   { dur: f(30), pose: style.up || 'uppercut', fx: style.fx, hits: [{ f: [f(7), f(12)], box: [-26, -138, 62, 62], dmg: 9 * Pw, kb: 10, ang: 88 }] },
    down: { dur: f(28), pose: 'sweep', fx: style.fx, hits: [{ f: [f(6), f(10)], box: [-58, -26, 120 * R, 26], dmg: 8 * Pw, kb: 8, ang: 22, both: true }] },
    nair: { dur: f(30), air: true, pose: 'spin', fx: style.fx, landLag: 8, hits: [{ f: [f(5), f(14)], box: [-42, -88, 84, 84], dmg: 8 * Pw, kb: 8, ang: 45, both: true }] },
    fair: { dur: f(32), air: true, pose: style.fair || 'airkick', fx: style.fx, landLag: 10, hits: [{ f: [f(8), f(13)], box: [10, -66, 56 * R, 36], dmg: 10 * Pw, kb: 10, ang: 40 }] },
    uair: { dur: f(26), air: true, pose: 'flipkick', fx: style.fx, landLag: 6, hits: [{ f: [f(6), f(11)], box: [-30, -142, 60, 58], dmg: 8 * Pw, kb: 9, ang: 85 }] },
    dair: { dur: f(36), air: true, pose: 'stomp', fx: style.fx, landLag: 14, hits: [{ f: [f(12), f(17)], box: [-22, -22, 44, 48], dmg: 12 * Pw, kb: 10, ang: -70 }] },
  };
}

const FIGHTERS = {
  murilo: {
    name: 'MURILO', color: '#e52521', title: 'The Hero',
    rig: { thigh: 17, shin: 16, torso: 24, upper: 13, fore: 13, head: 17 },
    stats: { walk: 7, air: 5.5, accel: 0.9, jump: 17, djump: 15, jumps: 2, grav: 0.85, fall: 15, weight: 1, w: 40, h: 84 },
    look: { cap: '#e52521', shirt: '#e52521', pants: '#2b59c3', skin: '#ffcf9e', hair: '#4a2a10', shoe: '#6b3a1a', glove: '#ffffff', nose: '#f4a582' },
    drawFn: heroDraw,
    power: 1.08,
    specials: {
      nspec: { name: 'FIREBALL', dur: 26, pose: 'cast', tick(f, t, B) { if (t === 8) { B.proj(f, { kind: 'fire', dx: 34, dy: -52, vx: 8, vy: 2, grav: 0.45, bounce: 7, life: 100, w: 20, h: 20, dmg: 5, kb: 4, ang: 35 }); sfx.fire(); } } },
      sspec: { name: 'CAPE SWIPE', dur: 30, pose: 'swipe', fx: 'swoosh',
               start(f) { if (!f.onGround && !f.usedSide) { f.vy = Math.min(f.vy, -4); f.usedSide = true; } },
               hits: [{ f: [6, 12], box: [0, -84, 62, 74], dmg: 8, kb: 9, ang: 40 }] },
      uspec: { name: 'SUPER JUMP PUNCH', dur: 34, pose: 'rise', helpless: true, trail: true,
               start(f) { f.vy = -16.5; f.vx = f.face * 2.5; f.onGround = false; },
               hits: [{ f: [2, 6], box: [-8, -112, 48, 64], dmg: 2, kb: 3, ang: 90 }, { f: [8, 12], box: [-8, -112, 48, 64], dmg: 2, kb: 3, ang: 90 },
                      { f: [14, 20], box: [-8, -116, 48, 64], dmg: 6, kb: 10, ang: 78 }] },
      dspec: { name: 'GROUND POUND', dur: 60, pose: 'stomp', groundPound: true, landLag: 12,
               start(f) { f.vy = f.onGround ? -10 : -3; f.vx *= 0.3; f.onGround = false; },
               tick(f, t) { if (t >= 12) { f.vy = 22; f.vx = 0; } },
               hits: [{ f: [12, 60], box: [-24, -34, 48, 44], dmg: 11, kb: 9, ang: -70 }] },
    },
  },

  maher: {
    name: 'MAHER', color: '#16a34a', title: 'The High Jumper',
    rig: { thigh: 20, shin: 19, torso: 26, upper: 14, fore: 14, head: 17 },
    stats: { walk: 6.5, air: 5.2, accel: 0.8, jump: 19, djump: 17, jumps: 2, grav: 0.75, fall: 13, weight: 0.95, w: 40, h: 94 },
    look: { cap: '#16a34a', shirt: '#16a34a', pants: '#1e3a8a', skin: '#ffcf9e', hair: '#2a1a0a', shoe: '#6b3a1a', glove: '#ffffff', nose: '#f4a582' },
    drawFn: heroDraw,
    specials: {
      nspec: { name: 'GREEN FIREBALL', dur: 28, pose: 'cast', tick(f, t, B) { if (t === 9) { B.proj(f, { kind: 'greenfire', dx: 34, dy: -60, vx: 7, vy: 0, life: 85, w: 22, h: 22, dmg: 6, kb: 5, ang: 30 }); sfx.fire(); } } },
      sspec: { name: 'MAHER MISSILE', dur: 36, pose: 'headbutt', trail: true, airHelpless: true,
               tick(f, t) { if (t >= 8 && t <= 26) { f.vx = f.face * 13; f.vy = 0; } else f.vx *= 0.85; },
               hits: [{ f: [8, 26], box: [12, -66, 44, 42], dmg: 10, kb: 10, ang: 25 }] },
      uspec: { name: 'SPRING JUMP', dur: 30, pose: 'jump', helpless: true, trail: true,
               start(f) { f.vy = -21; f.onGround = false; },
               hits: [{ f: [1, 6], box: [-28, -36, 56, 44], dmg: 5, kb: 7, ang: 85 }] },
      dspec: { name: 'TORNADO', dur: 50, pose: 'spin', spinning: true, landLag: 10,
               tick(f, t) { if (!f.onGround) { f.vy = Math.min(f.vy, 3.5); if (f.input.specialP) f.vy -= 4; } },
               hits: [6, 12, 18, 24, 30, 36, 42].map(s => ({ f: [s, s + 2], box: [-54, -88, 108, 88], dmg: 2, kb: 3, ang: 60, both: true }))
                       .concat([{ f: [46, 50], box: [-56, -90, 112, 90], dmg: 4, kb: 9, ang: 55, both: true }]) },
    },
  },

  wizard: {
    name: 'ZALDOR', color: '#8b5cf6', title: 'The Wizard',
    rig: { thigh: 19, shin: 18, torso: 27, upper: 14, fore: 14, head: 15 },
    stats: { walk: 5.8, air: 5.2, accel: 0.75, jump: 16, djump: 14.5, jumps: 2, grav: 0.7, fall: 12, weight: 0.86, w: 42, h: 92 },
    look: { robe: '#7c3aed', robeDark: '#5b21b6', hat: '#6d28d9', belt: '#fbbf24', skin: '#ffd9b0', beard: '#f1f5f9', shoe: '#3b2a1a' },
    drawFn: wizardDraw,
    normalsStyle: { fx: 'magic', jab: 'cast', side: 'cast', fair: 'cast' },
    reach: 1.2, power: 0.95, speed: 1.05,
    specials: {
      nspec: { name: 'MAGIC BOLT', dur: 26, pose: 'cast', tick(f, t, B) { if (t === 9) { B.proj(f, { kind: 'magic', dx: 46, dy: -62, vx: 12, vy: 0, life: 60, w: 20, h: 20, dmg: 8, kb: 7, ang: 30 }); sfx.magic(); } } },
      sspec: { name: 'ICE BLAST', dur: 34, pose: 'cast', tick(f, t, B) { if (t === 10) { B.proj(f, { kind: 'ice', dx: 40, dy: -70, vx: 7, vy: 0, life: 28, w: 44, h: 44, dmg: 5, kb: 2, ang: 20, freeze: 55 }); sfx.ice(); } } },
      uspec: { name: 'TELEPORT', dur: 30, pose: 'castUp', helpless: true, teleport: true,
               hits: [{ f: [13, 16], box: [-44, -96, 88, 96], dmg: 4, kb: 6, ang: 70, both: true }] },
      dspec: { name: 'METEOR CALL', dur: 40, pose: 'castUp', tick(f, t, B) { if (t === 14) { B.proj(f, { kind: 'meteor', dx: 190, dy: -460, vx: 1.5, vy: 6, grav: 0.35, life: 120, w: 46, h: 46, dmg: 13, kb: 12, ang: 65, boom: true }); sfx.magic(); } } },
    },
  },

  ninja: {
    name: 'KAGE', color: '#e11d48', title: 'The Ninja',
    rig: { thigh: 18, shin: 17, torso: 25, upper: 13, fore: 13, head: 15 },
    stats: { walk: 8.2, air: 6.3, accel: 1.15, jump: 17, djump: 15, jumps: 3, grav: 0.95, fall: 17, weight: 0.72, w: 38, h: 86 },
    look: { suit: '#1f2547', scarf: '#e11d48', skin: '#ffd9b0', shoe: '#111827' },
    drawFn: ninjaDraw,
    normalsStyle: { fx: 'slash', jab: 'punch', side: 'dash' },
    reach: 1.0, power: 0.72, speed: 0.88,
    specials: {
      nspec: { name: 'THROWING STARS', dur: 24, pose: 'throw', tick(f, t, B) { if (t === 6 || t === 11 || t === 16) { B.proj(f, { kind: 'shuriken', dx: 34, dy: -60, vx: 14, vy: (t - 11) * 0.15, life: 42, w: 16, h: 16, dmg: 2.5, kb: 2, ang: 20 }); sfx.swing(); } } },
      sspec: { name: 'SHADOW DASH', dur: 26, pose: 'dash', trail: true, oncePerAir: true,
               tick(f, t) { if (t >= 4 && t <= 12) { f.vx = f.face * 20; f.vy = 0; f.intangible = 2; } else f.vx *= 0.7; },
               hits: [{ f: [6, 12], box: [-24, -76, 64, 76], dmg: 8, kb: 8, ang: 35 }] },
      uspec: { name: 'SMOKE RISE', dur: 28, pose: 'jump', helpless: true, trail: true,
               start(f, B) { f.vy = -18; f.onGround = false; f.intangible = 8; B.puff(f.x, f.y - 30, '#9ca3af', 14); sfx.smoke(); },
               hits: [{ f: [1, 6], box: [-44, -88, 88, 88], dmg: 4, kb: 6, ang: 80, both: true }] },
      dspec: { name: 'COUNTER', dur: 36, pose: 'counter', counter: [3, 24] },
    },
  },

  monk: {
    name: 'TENZIN', color: '#f97316', title: 'The Monk',
    rig: { thigh: 18, shin: 17, torso: 25, upper: 14, fore: 13, head: 16 },
    stats: { walk: 6.8, air: 5.2, accel: 0.9, jump: 16.5, djump: 15, jumps: 2, grav: 0.9, fall: 15.5, weight: 1.15, w: 42, h: 88 },
    look: { robe: '#f97316', robeDark: '#c2410c', sash: '#facc15', pants: '#b45309', skin: '#f2c194', shoe: '#3b2a1a', wrap: '#fef3c7' },
    drawFn: monkDraw,
    normalsStyle: { fx: 'chi', jab: 'punch', side: 'kick' },
    reach: 1, power: 1.12, speed: 1,
    specials: {
      nspec: { name: 'CHI BLAST', dur: 30, pose: 'cast', tick(f, t, B) { if (t === 11) { B.proj(f, { kind: 'chi', dx: 40, dy: -60, vx: 9, vy: 0, life: 70, w: 26, h: 26, dmg: 8, kb: 7, ang: 30 }); sfx.magic(); } } },
      sspec: { name: 'DRAGON KICK', dur: 32, pose: 'kick', trail: true, oncePerAir: true,
               start(f) { f.vx = f.face * 11; f.vy = f.onGround ? -6 : -4; f.onGround = false; },
               hits: [{ f: [4, 18], box: [12, -64, 52, 38], dmg: 11, kb: 11, ang: 35 }] },
      uspec: { name: 'RISING DRAGON', dur: 34, pose: 'rise', helpless: true, trail: true, spinning: true,
               start(f) { f.vy = -17; f.vx = f.face * 1.5; f.onGround = false; },
               hits: [{ f: [2, 5], box: [-30, -110, 60, 110], dmg: 3, kb: 3, ang: 90, both: true }, { f: [7, 10], box: [-30, -110, 60, 110], dmg: 3, kb: 3, ang: 90, both: true },
                      { f: [12, 15], box: [-30, -110, 60, 110], dmg: 3, kb: 3, ang: 90, both: true }, { f: [18, 22], box: [-34, -120, 68, 120], dmg: 6, kb: 10, ang: 80, both: true }] },
      dspec: { name: 'MEDITATE', dur: 400, pose: 'meditate', meditate: true },
    },
  },
};

// Finish setting up each fighter: rig links, draw functions and moves.
for (const id in FIGHTERS) {
  const d = FIGHTERS[id];
  d.id = id;
  d.look.rigRef = d.rig;
  d.draw = d.drawFn(d.look);
  d.moves = Object.assign(normals(d.reach || 1, d.power || 1, d.speed || 1, d.normalsStyle || {}), d.specials);
}
const ROSTER = ['murilo', 'maher', 'wizard', 'ninja', 'monk'];
