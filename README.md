# Mega Brawlers

A Smash Bros-style fighting game made for (and designed by) Murilo. Smooth cartoon fighters, up to 4 players with Xbox controllers, plus computer fighters. It runs in a web browser, including Microsoft Edge on Xbox.

## Play online

**https://overpitch.github.io/mega-brawlers/**

**On Xbox:** open the address in Microsoft Edge, then **hold the Menu ☰ button** for about a second so the controller plays the game instead of moving the cursor.

## How it works

- **Health bars:** everyone starts with 100. Hit someone to 0 and they're out. Last fighter (or team) standing wins.
- The lower your health, the farther hits send you flying.
- **Falling off:** get back with your double jump, your **up-special** recovery move, and by **grabbing the ledge**. Fly off the edge of the screen and you lose 30 health, then float back in on a cloud.
- **Match rules** (picked before each match): Free-for-all or 2 vs 2 teams, 0 to 3 computer fighters, the computer level, items on or off, and the stage.
- **Computer levels:** **Noob** (the default: slow, rarely attacks, hits soft, sometimes zones out or forgets to jump back), **Easy**, **Normal** and **Hard**. Noob and Easy computers also do less damage and knock you less far.
- **Items:** bombs (pick up, press attack to throw), a hammer, healing food (+25), and a star (invincible for 8 seconds).
- **Effects:** freeze-frame and flash on big hits, motion trails, and the final knockout in slow motion.

## Fighters

| Fighter | Style | Specials (B, ▶B, ▲B, ▼B) |
|---|---|---|
| **Murilo** | All-rounder | Fireball, Cape Swipe, Super Jump Punch, Ground Pound |
| **Maher** | High jumper, floaty | Green Fireball, Maher Missile, Spring Jump, Tornado |
| **Zaldor** (wizard, purple robe) | Long reach, magic | Magic Bolt, Ice Blast (freezes), Teleport, Meteor Call |
| **Kage** (ninja) | Fastest, triple jump | Throwing Stars, Shadow Dash, Smoke Rise, Counter |
| **Tenzin** (monk, orange robe) | Strong kicks, heavy | Chi Blast, Dragon Kick, Rising Dragon, Meditate (heals) |

## Stages

Sky Temple, Ninja Rooftops, Wizard Tower (with a moving platform), and Goober Island (from Super Murilo).

## Controls

| | Xbox controller | Keyboard player 1 | Keyboard player 2 |
|---|---|---|---|
| Move | Left stick / d-pad | W A S D | Arrow keys |
| Jump (press again in the air to double jump) | A or Y | Space | / or Numpad 0 |
| Attack | X | J | . or Numpad 1 |
| Special | B | K | , or Numpad 2 |
| Block | Bumpers or triggers | L or Left Shift | Right Shift or Numpad 3 |
| Pause | Menu ☰ | Enter | Numpad Enter |
| Quit (while paused) | View ⧉ | Esc | Backspace |

Hold a direction while you attack or special to do a different move. In the air, press down to fall faster. On a floating platform, press down to drop through it.

## Files

- `index.html` loads everything. Bump the `?v=` numbers on the script links when you publish changes, so browsers (and the Xbox) fetch the new files.
- `js/core.js`: screen, sounds, and controls for up to 4 controllers plus 2 keyboard players.
- `js/fighters.js`: how each fighter looks (a cartoon puppet that gets posed), their stats and their moves.
- `js/stages.js`: the four stages.
- `js/battle.js`: physics, hits and knockback, ledges, projectiles, items, effects, the zooming camera, and the computer fighters' brains.
- `js/game.js`: title, match rules, fighter select, the fight, and results.
- `tests/sim.js`: runs computer-vs-computer matches at top speed to check matches end, nothing crashes, and the fighters are balanced. In the browser console, load the script and run `simAll()`.
