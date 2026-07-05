# Product Requirements

Last updated: 2026-06-30

## Product Goal

Build a full tactical campaign game whose baseline is `Ultimate General: Civil War`-level army, officer, battle, and campaign depth, then exceed that baseline with defensive construction, theater infrastructure, and long-war survival against an undead mass army.

The game should be planned like a product, not a reduced proof-of-concept. Early implementation may start with a thin playable path, but the architecture must assume the full product from the beginning.

## Product Pillars

| Pillar | Requirement |
| --- | --- |
| Tactical battles | Tick-based real-time battles with pause/speed controls, terrain, morale, fatigue, ammo, cover, flanking, command friction, and persistent losses. |
| Army management | Persistent army organization, units, officers, veterans, replacements, equipment, supply, and battle history. |
| Dynamic strategic campaign | No fixed historical campaign chain; the campaign map reacts to current army position, adjacent sector pressure, prior outcomes, and ignored side operations. |
| Defensive war | Player builds, repairs, upgrades, abandons, and loses defensive positions across a campaign theater. |
| Long-term attrition | Victory is not only battle success; manpower, officer corps, equipment, fortifications, logistics, and reputation must survive. |
| Endless enemy pressure | Undead forces create numerical pressure through waves, escalation, special enemies, night attacks, and exhaustion of prepared positions. |
| Growth and attachment | Units, officers, forts, named sectors, and veteran formations should accumulate identity and history. |
| Extensible content | Battles, units, structures, weapons, traits, doctrines, and events must be data-driven enough to expand without rewiring core systems. |

## Expected Base Game Scope

### Campaign / Theater

- Multi-battle campaign structure.
- Persistent theater map or sector list.
- Five-band strategic map with player army current position and adjacent front/rear pressure.
- One mandatory main battlefield generated from the current strategic situation.
- 3-4 side operations active per strategic turn where possible.
- Auto-resolve for side operations with real casualty/resource/officer risk.
- Defensive lines and fallback positions.
- Strategic choices between holding, withdrawing, raiding, repairing, rebuilding, and preparing.
- Resource pressure across manpower, gold, materials, ammunition, supplies, engineer labor, weapons, medical capacity, and reputation.
- Battle consequences that affect later sectors.

### Army

- Corps/division/brigade-style organization over time.
- Officers with rank, experience, traits, injury, death, recovery, reassignment, and command capacity.
- Units with soldiers, max strength, experience, quality, morale, condition, weapon quality, perks, battle history, and named identity.
- Rookie and veteran replenishment with quality dilution/preservation.
- Equipment stock and weapon quality.
- Unit roles such as infantry, jaeger/skirmisher, artillery, cavalry/scouts, engineers, guard infantry, supply units, and later specialist formations.

### Battle

- Tick-based real-time simulation.
- Pause, normal speed, fast speed.
- Terrain effects.
- Unit orders.
- Enemy waves and escalation.
- Morale shock from casualties, flanking, fatigue, officer loss, and horror pressure.
- Ammo and supply consumption.
- Officer events.
- Structure damage, repair, overrun, and abandonment.
- Battle outcomes including hold, costly hold, withdrawal, breakthrough, collapse, and pyrrhic victory.

### Fortification / Engineering

- Buildable structures: trenches, barricades, wire/stakes, redoubts, artillery pits, supply depots, field hospitals, observation posts, fallback lines.
- Structure level, durability, effects, repair cost, construction time, and campaign persistence.
- Engineer labor as a constrained strategic resource.
- Fortification placement tied to terrain and sector identity.
- Defensive investment must compete with unit replenishment, equipment, ammunition, and recovery.

### Enemy

- Russian-inspired undead imperial army as fictional force.
- Enemy classes: mob, riflemen, brutes, officers, siege/line-breaker units, horror units, later DLC variants.
- Endless pressure but not meaningless spam: waves should test ammo, morale, fortifications, flanks, and retreat timing.
- Enemy escalation over campaign chapters.

### Screens

| Screen | Product Role |
| --- | --- |
| Theater Command | Sector map, threat forecast, strategic choice, fallback/fortification planning. |
| Army Camp | Unit roster, army structure, replenishment, morale, recovery, battle history. |
| Officers / Barracks | Officer roster, rank, injury/death, traits, assignment. |
| Armory / Logistics | Weapon stock, ammunition, supply, materials, equipment distribution. |
| Engineering Works | Build/repair/upgrade structures, assign engineer labor, manage prepared positions. |
| Battle Command | Tactical combat, orders, terrain, waves, structures, status panels. |
| After Action Report | Casualties, experience, officer events, structure status, rewards, strategic consequence. |
| Doctrine / Career | Army-wide improvements, engineering doctrine, logistics, medicine, reconnaissance, command. |
| Archive / Chronicle | Named units, battle records, medals, lost officers, lost positions. |

## Technical Product Requirements

- Vite + TypeScript + React.
- Local-first browser game.
- Save abstraction with versioned schema; initial provider can be `localStorage`, but the code should not hard-code all persistence assumptions into UI components.
- Data-driven definitions for units, enemies, structures, terrain, weapons, doctrines, battle templates, and events.
- Deterministic or seedable simulation where practical, so battle bugs can be reproduced.
- Clear domain boundaries: campaign, army, battle, fortifications, logistics, content, save, UI.
- Generated art can be integrated later through an asset manifest without changing core game logic.

## Non-Negotiable Design Rule

Do not build the first codebase as if it is a tiny game that may later grow.

Build it as the product architecture from day one, with thin initial content inside full-size boundaries.
