'use strict';
// =====================================================================
//  Stages: the main ground (with grabbable ledges), floating platforms
//  you can jump up through, and the background art.
// =====================================================================

function sky(top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
}
function cloud(x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 30 * s, 0, Math.PI * 2); ctx.arc(x + 36 * s, y - 16 * s, 38 * s, 0, Math.PI * 2);
  ctx.arc(x + 78 * s, y, 30 * s, 0, Math.PI * 2); ctx.arc(x + 40 * s, y + 10 * s, 32 * s, 0, Math.PI * 2);
  ctx.fill();
}
const wrap = (x, w) => ((x % w) + w) % w;

const STAGES = [
  {
    id: 'temple', name: 'SKY TEMPLE',
    main: { x1: -440, x2: 440, y: 0, h: 150 },
    plats: [{ x1: -330, x2: -130, y: -150 }, { x1: 130, x2: 330, y: -150 }, { x1: -100, x2: 100, y: -290 }],
    bg(cam) {
      sky('#5aa9ff', '#ffe7c2');
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(SW * 0.8 - cam.x * 0.02, 140, 70, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) cloud(wrap(i * 260 - cam.x * 0.08 + frameCount * 0.15, SW + 400) - 200, 90 + (i % 3) * 70, 0.8 + (i % 2) * 0.4, 'rgba(255,255,255,0.75)');
      // distant floating islands
      for (let i = 0; i < 3; i++) {
        const x = wrap(i * 520 + 200 - cam.x * 0.15, SW + 600) - 300, y = 420 + i * 30 - cam.y * 0.08;
        ctx.fillStyle = '#9cc4e8'; ctx.beginPath(); ctx.moveTo(x - 90, y); ctx.lineTo(x + 90, y); ctx.lineTo(x + 20, y + 80); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b6d6f2'; ctx.fillRect(x - 40, y - 60, 12, 60); ctx.fillRect(x + 26, y - 60, 12, 60); ctx.fillRect(x - 50, y - 70, 100, 12);
      }
      for (let i = 0; i < 6; i++) cloud(wrap(i * 300 - cam.x * 0.3 + frameCount * 0.3, SW + 400) - 200, 560 + (i % 2) * 40 - cam.y * 0.2, 1.4, 'rgba(255,255,255,0.9)');
    },
    drawMain(m) {
      // temple floor: stone slab with columns hanging below
      ctx.fillStyle = '#d6cfc0'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(m.x1, m.y); ctx.lineTo(m.x2, m.y); ctx.lineTo(m.x2 - 60, m.y + m.h); ctx.lineTo(m.x1 + 60, m.y + m.h); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#efe9dc'; rrect(m.x1, m.y, m.x2 - m.x1, 30, 6); ctx.fill(); ctx.stroke();
      for (let x = m.x1 + 90; x < m.x2 - 60; x += 110) {
        ctx.fillStyle = '#c4bba8'; ctx.fillRect(x, m.y + 36, 26, m.h - 50); ctx.strokeRect(x, m.y + 36, 26, m.h - 50);
      }
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, m.y + 80, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
    drawPlat(p) {
      ctx.fillStyle = '#efe9dc'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      rrect(p.x1, p.y, p.x2 - p.x1, 18, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c4bba8'; ctx.beginPath(); ctx.moveTo(p.x1 + 20, p.y + 18); ctx.lineTo(p.x2 - 20, p.y + 18); ctx.lineTo((p.x1 + p.x2) / 2, p.y + 50); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
  },

  {
    id: 'rooftops', name: 'NINJA ROOFTOPS',
    main: { x1: -470, x2: 470, y: 0, h: 120 },
    plats: [{ x1: -400, x2: -210, y: -140 }, { x1: 210, x2: 400, y: -140 }, { x1: -90, x2: 90, y: -270 }],
    bg(cam) {
      sky('#0b1030', '#3b2a6b');
      for (let i = 0; i < 70; i++) {
        const tw = 0.4 + Math.sin(frameCount * 0.04 + i) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.fillRect(wrap(i * 173 - cam.x * 0.02, SW), (i * 97) % 380, 2, 2);
      }
      ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(SW * 0.72 - cam.x * 0.03, 170, 110, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,214,0.12)'; ctx.beginPath(); ctx.arc(SW * 0.72 - cam.x * 0.03, 170, 170, 0, Math.PI * 2); ctx.fill();
      // pagodas and city silhouettes
      for (let layer = 0; layer < 2; layer++) {
        const par = 0.1 + layer * 0.15, base = 520 + layer * 60 - cam.y * (0.05 + layer * 0.08);
        ctx.fillStyle = layer ? '#1a1440' : '#251d55';
        for (let i = 0; i < 9; i++) {
          const x = wrap(i * 210 - cam.x * par, SW + 400) - 200, h = 120 + ((i * 53) % 120);
          ctx.fillRect(x - 40, base - h, 80, h + 400);
          ctx.beginPath(); ctx.moveTo(x - 70, base - h); ctx.lineTo(x + 70, base - h); ctx.lineTo(x + 30, base - h - 30); ctx.lineTo(x - 30, base - h - 30); ctx.fill();
          if (layer) { ctx.fillStyle = '#fbbf24'; ctx.fillRect(x - 10, base - h + 30, 8, 10); ctx.fillStyle = '#1a1440'; }
        }
      }
    },
    drawMain(m) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
      ctx.fillStyle = '#3f2a1e'; ctx.fillRect(m.x1 + 40, m.y + 20, m.x2 - m.x1 - 80, m.h); ctx.strokeRect(m.x1 + 40, m.y + 20, m.x2 - m.x1 - 80, m.h);
      for (let x = m.x1 + 80; x < m.x2 - 80; x += 120) { ctx.fillStyle = '#fde68a'; ctx.fillRect(x, m.y + 50, 40, 40); ctx.strokeRect(x, m.y + 50, 40, 40); }
      // tiled roof edge that curls up at the ends
      ctx.fillStyle = '#334155';
      ctx.beginPath(); ctx.moveTo(m.x1 - 20, m.y - 14); ctx.quadraticCurveTo(m.x1 + 30, m.y + 6, m.x1 + 80, m.y); ctx.lineTo(m.x2 - 80, m.y);
      ctx.quadraticCurveTo(m.x2 - 30, m.y + 6, m.x2 + 20, m.y - 14); ctx.lineTo(m.x2 - 10, m.y + 28); ctx.lineTo(m.x1 + 10, m.y + 28); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
      for (let x = m.x1 + 30; x < m.x2 - 20; x += 26) { ctx.beginPath(); ctx.moveTo(x, m.y + 4); ctx.lineTo(x, m.y + 26); ctx.stroke(); }
      // lanterns
      for (const lx of [m.x1 + 120, m.x2 - 120]) {
        const sw = Math.sin(frameCount * 0.05 + lx) * 4;
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, m.y + 28); ctx.lineTo(lx + sw, m.y + 50); ctx.stroke();
        ctx.fillStyle = 'rgba(255,90,60,0.25)'; ctx.beginPath(); ctx.arc(lx + sw, m.y + 66, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(lx + sw, m.y + 66, 14, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    },
    drawPlat(p) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      ctx.fillStyle = '#334155';
      ctx.beginPath(); ctx.moveTo(p.x1 - 14, p.y - 8); ctx.quadraticCurveTo(p.x1 + 10, p.y + 4, p.x1 + 30, p.y); ctx.lineTo(p.x2 - 30, p.y);
      ctx.quadraticCurveTo(p.x2 - 10, p.y + 4, p.x2 + 14, p.y - 8); ctx.lineTo(p.x2 - 6, p.y + 18); ctx.lineTo(p.x1 + 6, p.y + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3f2a1e'; ctx.fillRect((p.x1 + p.x2) / 2 - 6, p.y + 18, 12, 200);
    },
  },

  {
    id: 'tower', name: 'WIZARD TOWER',
    main: { x1: -380, x2: 380, y: 0, h: 600 },
    plats: [
      { x1: -110, x2: 110, y: -170, moving: t => ({ dx: Math.sin(t * 0.012) * 240, dy: 0 }) },
      { x1: -360, x2: -230, y: -300, moving: t => ({ dx: 0, dy: Math.sin(t * 0.02) * 20 }) },
      { x1: 230, x2: 360, y: -300, moving: t => ({ dx: 0, dy: Math.sin(t * 0.02 + 2) * 20 }) },
    ],
    bg(cam) {
      sky('#1e0b3a', '#7c3aed');
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(253,230,138,${0.3 + Math.sin(frameCount * 0.05 + i * 2) * 0.3})`;
        ctx.beginPath(); ctx.arc(wrap(i * 211 - cam.x * 0.03, SW), (i * 131) % 420, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      // swirling magic rings
      ctx.strokeStyle = 'rgba(196,181,253,0.25)'; ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(SW / 2 - cam.x * 0.05, 300 - cam.y * 0.05, 300 + i * 140, 70 + i * 30, 0.1, frameCount * 0.01 + i, frameCount * 0.01 + i + 4); ctx.stroke();
      }
      // distant castle
      ctx.fillStyle = '#2e1065';
      const cx = SW * 0.2 - cam.x * 0.08, cy = 600 - cam.y * 0.1;
      ctx.fillRect(cx - 120, cy - 160, 240, 400); ctx.fillRect(cx - 160, cy - 230, 60, 470); ctx.fillRect(cx + 100, cy - 260, 60, 500);
      ctx.beginPath(); ctx.moveTo(cx - 170, cy - 230); ctx.lineTo(cx - 130, cy - 300); ctx.lineTo(cx - 90, cy - 230); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 90, cy - 260); ctx.lineTo(cx + 130, cy - 340); ctx.lineTo(cx + 170, cy - 260); ctx.fill();
      // floating books
      for (let i = 0; i < 5; i++) {
        const bx = wrap(i * 300 + 80 - cam.x * 0.25, SW + 300) - 150, by = 200 + (i % 3) * 130 + Math.sin(frameCount * 0.03 + i) * 14 - cam.y * 0.15;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(frameCount * 0.02 + i) * 0.3);
        ctx.fillStyle = ['#dc2626', '#2563eb', '#16a34a'][i % 3]; ctx.fillRect(-26, -18, 52, 36);
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(-22, -14, 44, 6); ctx.restore();
      }
    },
    drawMain(m) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
      ctx.fillStyle = '#6b7280'; ctx.fillRect(m.x1 + 30, m.y, m.x2 - m.x1 - 60, m.h); ctx.strokeRect(m.x1 + 30, m.y, m.x2 - m.x1 - 60, m.h);
      ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 3;
      for (let y = m.y + 40; y < m.y + m.h; y += 40) {
        ctx.beginPath(); ctx.moveTo(m.x1 + 30, y); ctx.lineTo(m.x2 - 30, y); ctx.stroke();
        for (let x = m.x1 + 30 + ((y / 40) % 2) * 40; x < m.x2 - 30; x += 80) { ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y); ctx.stroke(); }
      }
      // battlements
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5; ctx.fillStyle = '#9ca3af';
      rrect(m.x1, m.y, m.x2 - m.x1, 34, 8); ctx.fill(); ctx.stroke();
      // glowing rune in the middle of the floor
      ctx.strokeStyle = `rgba(196,181,253,${0.5 + Math.sin(frameCount * 0.06) * 0.3})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, m.y + 17, 90, 10, 0, 0, Math.PI * 2); ctx.stroke();
    },
    drawPlat(p) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      ctx.fillStyle = '#a78bfa'; rrect(p.x1, p.y, p.x2 - p.x1, 18, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(196,181,253,${0.35 + Math.sin(frameCount * 0.1) * 0.15})`;
      ctx.beginPath(); ctx.ellipse((p.x1 + p.x2) / 2, p.y + 30, (p.x2 - p.x1) * 0.35, 8, 0, 0, Math.PI * 2); ctx.fill();
    },
  },

  {
    id: 'island', name: 'GOOBER ISLAND',
    main: { x1: -500, x2: 500, y: 0, h: 160 },
    plats: [{ x1: -280, x2: -150, y: -160 }, { x1: 150, x2: 280, y: -160 }],
    bg(cam) {
      sky('#4aa8ff', '#bfe6ff');
      for (let i = 0; i < 7; i++) cloud(wrap(i * 280 - cam.x * 0.1 + frameCount * 0.2, SW + 400) - 200, 80 + (i % 3) * 60, 0.9, 'rgba(255,255,255,0.9)');
      for (let i = 0; i < 6; i++) {
        const x = wrap(i * 380 - cam.x * 0.25, SW + 600) - 300, base = 640 - cam.y * 0.15, h = 140 + (i % 3) * 50;
        ctx.fillStyle = '#3f9e44'; ctx.beginPath(); ctx.ellipse(x, base, 220, h, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#58b85c'; ctx.beginPath(); ctx.ellipse(x, base, 170, h - 30, 0, Math.PI, 0); ctx.fill();
      }
      // a Goober wandering in the background
      const gx = wrap(frameCount * 0.8 - cam.x * 0.4, SW + 200) - 100, gy = 600 - cam.y * 0.3;
      ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(gx, gy, 22, Math.PI, 0); ctx.fill(); ctx.fillRect(gx - 22, gy, 44, 10);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx - 8, gy - 6, 5, 0, Math.PI * 2); ctx.arc(gx + 8, gy - 6, 5, 0, Math.PI * 2); ctx.fill();
    },
    drawMain(m) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
      ctx.fillStyle = '#c46a2e';
      ctx.beginPath(); ctx.moveTo(m.x1, m.y); ctx.lineTo(m.x2, m.y); ctx.lineTo(m.x2 - 30, m.y + m.h); ctx.lineTo(m.x1 + 30, m.y + m.h); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8f4a1d';
      for (let i = 0; i < 14; i++) ctx.fillRect(m.x1 + 50 + i * 68, m.y + 50 + (i % 3) * 30, 10, 10);
      ctx.fillStyle = '#4cc23a'; rrect(m.x1 - 6, m.y - 4, m.x2 - m.x1 + 12, 26, 10); ctx.fill(); ctx.stroke();
      // pipes standing on the ground (just for looks)
      for (const px of [m.x1 + 60, m.x2 - 120]) {
        ctx.fillStyle = '#2fae3f'; ctx.fillRect(px + 6, m.y - 70, 48, 70); ctx.strokeRect(px + 6, m.y - 70, 48, 70);
        rrect(px, m.y - 86, 60, 22, 4); ctx.fill(); ctx.stroke();
      }
    },
    drawPlat(p) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      const n = Math.round((p.x2 - p.x1) / 32);
      for (let i = 0; i < n; i++) {
        const x = p.x1 + i * (p.x2 - p.x1) / n, w = (p.x2 - p.x1) / n;
        ctx.fillStyle = i % 2 ? '#c0582a' : '#ffbf1f'; ctx.fillRect(x, p.y, w, 30); ctx.strokeRect(x, p.y, w, 30);
        if (i % 2 === 0) text('?', x + w / 2, p.y + 16, 20, '#fff3c4', 'center', '#7a4a00');
      }
    },
  },
];

const BLAST = { l: -1250, r: 1250, top: -1050, bot: 700 };
