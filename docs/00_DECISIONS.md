# Decisions - takawasi game

Last updated: 2026-06-30

## Project Direction

`takawasi game` is a browser-based tactical campaign game inspired by the campaign and army-growth loop of `Ultimate General: Civil War`.

UGCW-level campaign and battle systems are the baseline, not the ceiling. The project should exceed that baseline through a stronger defensive-war layer: fortification, prepared positions, engineers, logistics, fallback lines, and long-term theater defense.

The project should not be planned as a reduced demo. It should be planned as a full base game with enough expansion room for DLC 1. Early implementation can be content-thin, but it must use product-scale boundaries from the start.

## Settled Decisions

| Area | Decision |
| --- | --- |
| Core reference | `Ultimate General: Civil War`; core UGCW-like campaign depth is expected over time, not treated as a stretch goal. |
| Setting | Fictional 1880s-inspired military fantasy. |
| Player side | Fictional German/Prussian-inspired army. Organized, trained, limited in manpower and resources. |
| Enemy side | Fictional Russian-inspired undead army. Cruder equipment, enormous numbers, endless waves. |
| Terrain motif | Eastern Front style, especially German-Russian front imagery: forests, mud, snow, marsh, villages, trenches, bridges, rail lines, broad fields. |
| Equipment motif | Roughly 1880s German/Russian military technology, not direct WW1 equipment. |
| First gameplay focus | Unit growth, attrition, replenishment, morale, fatigue, ammo/supply, terrain, fortification, battle-to-battle carryover. |
| Battle model | Tick-based real-time simulation with pause and speed controls. |
| First map model | 2D front-line map: player defends from the left/center while undead waves enter from the right or edges. |
| Tactical command model | Wide-map frontline command with semi-autonomous brigades. The player assigns line segments, anchors, posture, fallback rules, and facility duties rather than manually moving every unit every second. |
| Game session structure | Fight a battle, survive/withdraw/win objective, process losses, replenish, reorganize, proceed to next battle. |
| Differentiator beyond UGCW | Defensive construction: trenches, barricades, redoubts, supply depots, field hospitals, observation posts, fallback lines. |
| Technology | Vite + TypeScript + React. |
| Storage | Versioned local save abstraction; initial provider can be `localStorage`. |
| Backend | None required for base local build, but persistence must stay abstracted. |
| Visuals | Placeholder UI first. Generated art comes in phase 2. |
| Art direction | Retro, slightly pop, readable tactical-board style. Avoid heavy photorealism. |

## Design Thesis

The player should not be asked only "Can I win this battle?"

The real question is:

> Can I win or survive without ruining the army I need for the next battle?

That means a victory can still feel costly, a retreat can still feel strategically correct, and a fortified line can become a meaningful investment rather than just background scenery.

## What This Is Not

- Not a direct historical simulation.
- Not a 3D real-time action game.
- Not an art-first game.
- Not online multiplayer.
- Not a production-service game.
- Not a reduced-scope product. Build the codebase as if the full base game and DLC 1 will exist.

## Naming / Lore Constraint

Use fictional names for countries, generals, and units. Historical Germany/Russia are motifs, not direct in-game state actors.

Reason:

- keeps the setting flexible
- avoids over-committing to historical accuracy
- allows undead/fantasy elements without clashing with real events
- gives room for original unit names, medals, and campaign chapters
