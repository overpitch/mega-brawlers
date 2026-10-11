'use strict';
// Test: computer-vs-computer matches run as fast as possible.
// In the browser console:  load this file, then simAll()

function simMatch(setup, maxFrames = 60 * 60 * 6) {
  const B = new Battle(setup);
  let f = 0;
  const problems = [];
  try {
    while (!(B.over && B.overT > 170) && f < maxFrames) {
      B.update({});
      f++;
      for (const x of B.fighters) {
        if (![x.x, x.y, x.vx, x.vy, x.hp].every(Number.isFinite)) { problems.push(`${x.def.name}: bad numbers at frame ${f}`); return { problems, frames: f }; }
      }
    }
  } catch (e) { problems.push('CRASH: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  return {
    frames: f, time: (f / 60).toFixed(0) + 's', over: B.over, winner: B.winner, problems,
    fighters: B.fighters.map(x => `${x.def.name} hp${Math.ceil(x.hp)} ko${x.kos} fell${x.falls} dmg${Math.round(x.dmgDealt)}`),
  };
}

function simAll(level = 1) {
  const out = [];
  for (let s = 0; s < STAGES.length; s++) {
    for (const [teams, items] of [[false, true], [true, false]]) {
      const entries = ROSTER.slice(0, 4).map((id, i) => ({ fighter: ROSTER[(i + s) % ROSTER.length], ctrl: 'cpu', team: i % 2, cpuLevel: level }));
      const r = simMatch({ stage: s, items, teams, entries });
      out.push(`${STAGES[s].name} ${teams ? 'TEAMS' : 'FFA'} items:${items} → ${r.over ? 'ended' : 'NOT ENDED'} in ${r.time} winner ${r.winner} ${r.problems.join(' ')} | ${r.fighters.join(', ')}`);
    }
  }
  return out;
}
