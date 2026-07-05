# Expansion Architecture

Last updated: 2026-06-30

## Goal

Avoid painting the project into a narrow architecture corner.

The codebase should support the base game, major content growth, and DLC 1 without replacing the core model.

## Architectural Rules

1. Content definitions are data, not hard-coded UI branches.
2. Simulation rules live in domain modules, not React components.
3. Save data is versioned from day one.
4. Battle entities use typed effects/modifiers, so new structures, doctrines, enemies, and terrain can stack effects consistently.
5. UI screens read domain state through selectors/view models, not by mutating raw nested objects directly.
6. Every major domain has stable IDs and history fields.
7. Generated art uses an asset manifest and never becomes a dependency of game logic.

## Core Domains

| Domain | Responsibility |
| --- | --- |
| Campaign | Overall campaign state, chapter, global resources, event history, victory/failure pressure. |
| Theater | Strategic campaign map, five-band front structure, sectors, defensive lines, route choices, threat forecasts, fallback logic. |
| Army | Corps/division/brigade organization, unit roster, battle assignment. |
| Officers | Rank, traits, command capacity, injury/death, recovery, assignment. |
| Logistics | Supplies, ammunition, materials, weapons, rail/road capacity, medical capacity. |
| Fortifications | Structures, durability, construction, repair, upgrades, overrun/abandonment. |
| Battle | Tick simulation, orders, engagement, terrain, waves, morale, fatigue, casualties. |
| Doctrine | Player upgrades, career-like progression, engineering/logistics/medicine/recon branches. |
| Content | Definitions for units, enemies, weapons, structures, terrain, battles, events, doctrines. |
| Save | Versioned persistence, migration, import/export, reset. |

## Effect System

Use a common effect model for terrain, structures, doctrines, officer traits, unit perks, and events.

Example:

```text
Effect
- id
- sourceType: terrain | structure | doctrine | officer | unitPerk | event | weapon
- target: unit | enemy | structure | sector | battle | campaign
- stat: cover | morale | accuracy | fatigue | ammoUse | buildSpeed | casualtyRecovery
- operation: add | multiply | set | clamp
- value
- condition
```

This avoids custom one-off code for every new DLC structure or enemy.

## Content Pack Shape

```text
ContentPack
- id
- title
- version
- dependencies
- unitTypes
- enemyTypes
- weapons
- structures
- terrainTypes
- battleTemplates
- doctrines
- events
- campaignChapters
- artManifestEntries
```

Base game is just the first content pack. DLC 1 becomes another pack.

## Save Versioning

Save data should include:

```text
saveVersion
gameVersion
enabledContentPacks
campaignState
createdAt
updatedAt
checksum optional
```

Migration functions should be explicit:

```text
migrateSave(v1) -> v2
migrateSave(v2) -> v3
```

This matters because DLC 1 will add domains and fields.

## Battle Tick Extensibility

Battle tick should be staged:

```text
1. apply scheduled spawns
2. read player orders
3. resolve movement/position pressure
4. resolve structure interactions
5. resolve ranged/melee engagement
6. apply morale/fatigue/ammo changes
7. apply officer/unit events
8. check objectives and collapse
9. emit battle log events
```

New enemies or structures should hook into these stages through typed rules, not arbitrary UI code.

## Strategic Map Extensibility

The strategic map should be content-driven too.

```text
TheaterBandDefinition
- id
- title
- defaultSupportLevel
- defaultEnemyPressure
- allowedSectorTypes
- allowedOperationTypes
- failureConsequences
- victoryConsequences
```

```text
OperationDefinition
- id
- title
- validBands
- validSectorTags
- cost
- risk
- possibleBattleTemplates
- victoryEffects
- drawEffects
- defeatEffects
```

DLC 1 should be able to add winter sectors, rail operations, siege operations, and new enemy pressure rules without replacing the base Theater domain.

## Dynamic Operation Generation

Operation generation should be a domain service, not hand-authored UI branching.

```text
generateStrategicTurn(theater, campaign, content)
  -> mandatoryMainBattle
  -> sideOperations[3..4]
  -> threatForecast
```

Generation inputs:

- player army current sector
- current front band
- adjacent rear sectors
- adjacent forward sectors
- enemy momentum
- ignored operations
- structure condition
- logistics readiness
- weather/season/content pack rules

Side operations can use auto-resolve. Mandatory main battle cannot.

## UI Extensibility

Use screens that can grow:

- Theater Command should support more sectors later.
- Engineering Works should support more structures later.
- Doctrine screen should support new branches later.
- After Action Report should support more event types later.
- Battle screen should support more terrain and unit types later.

Do not build one-off panels that assume only three units, one battle, or one structure.
