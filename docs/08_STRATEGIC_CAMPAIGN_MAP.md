# Strategic Campaign Map

Last updated: 2026-07-03

## Decision

The game needs a clear separation between:

- **Strategic Campaign Map**: the large war map where front lines move, sectors are held/lost, resources are allocated, side operations are chosen, reinforcements arrive, fortifications are built, and enemy pressure changes.
- **Tactical Battle Map**: the individual battle map where units fight, structures take damage, waves spawn, officers die, and a battle result is produced.

This separation must exist in the data model from the beginning.

This game does **not** use a fixed historical campaign list. Unlike UGCW's historical campaign stages, the campaign state should generate the current strategic situation dynamically from the player's army position, nearby sectors, enemy pressure, and prior results.

## UGCW Reference

`Ultimate General: Civil War` already has a campaign/battle separation:

- The official guide says each campaign stage has one Grand Battle and optional side battles.
- Side battles are represented by smaller flags and serve as secondary missions.
- Battle flags show Victory/Draw/Defeat rewards in gold, recruits, and reputation.
- Deployment is separate from camp management, with Corps slots and brigade limits depending on the battle.
- Reconnaissance reveals enemy army information before battle.
- The Intelligence Service tracks enemy `ARMY`, `TRAINING`, and `ARMORY`.
- Inflicting casualties reduces enemy `ARMY`, affecting strength in later engagements.
- Community wiki notes that minor battles can modify Grand Battles, such as reducing opposing army size or training.

Takeaway:

UGCW does not treat battles as isolated levels. The campaign map decides what battles are available, what rewards/risks exist, and how previous battles change future enemy strength.

This game should use that as the baseline and go further.

## Our Strategic Map Shape

The campaign map should be organized as large war-zone bands, not a simple linear mission list.

```text
[Home Core Defense Zone]
  Thickest player defenses, main fortress, capital-adjacent military region.

[Forward Defense Belt]
  Prepared lines, trenches, redoubts, depots, hospitals, rail hubs.

[Active Front Zone]
  Contested villages, forests, bridges, marshes, ruined towns, fluid battle line.

[Enemy Vanguard Defense Zone]
  Enemy forward nests, corrupted forts, undead staging zones, dangerous counterattack targets.

[Enemy Heartland Zone]
  Enemy core territory, source regions, imperial death-engine, late-game or expansion-grade offensives.
```

These five bands are campaign-map categories. The player army has a current operational position inside this structure, and the main battlefield should normally occur at that current position or in adjacent sectors immediately ahead/behind it.

## Band Purpose

| Band | Player Meaning | Game Function |
| --- | --- | --- |
| Home Core Defense Zone | Last major defensive depth near the player's national center. | Strongest fortifications, high support, catastrophic if breached. |
| Forward Defense Belt | Main prepared defensive theater. | Primary place for investment, forts, hospitals, depots, fallback planning. |
| Active Front Zone | The normal contested war line. | Frequent battles, raids, bridge fights, village defense, mobile reserves. |
| Enemy Vanguard Defense Zone | Enemy forward infrastructure and spawning pressure. | Counterattacks, nest suppression, supply raids, high risk/high reward. |
| Enemy Heartland Zone | Enemy strategic core. | Late campaign offensives and DLC-grade escalation. |

## Strategic State Model

Campaign state should not only store "next battle." It should store a theater map.

```text
TheaterState
- currentFrontBand
- playerArmyPositionSectorId
- rearPressureSectorIds[]
- forwardPressureSectorIds[]
- sectors[]
- globalThreat
- enemyMomentum
- playerStrategicInitiative
- campaignChapter
- turnNumber
- activeOperations[]
- mandatoryBattle
- strategicHistory[]
```

```text
Sector
- id
- name
- band
- control: player | contested | enemy
- terrainTags[]
- fortificationSlots[]
- structures[]
- supplyValue
- railValue
- medicalValue
- engineerValue
- enemyPressure
- corruptionLevel
- battleTemplates[]
- linkedSectors[]
- history[]
```

The battle map is generated or selected from a sector plus operation.

```text
BattleScenario = createBattleScenario(theater, sector, operation, assignedForces)
```

## Tactical Frontline Profile From Sector

Current implementation connects the strategic sector to tactical frontage.

`src/game/battle/frontlineDefaults.ts` reads sector band, terrain tags, structures, and enemy pressure to generate the frontline profile used by both Deployment and Battle.

Implemented profile families:

| Strategic input | Tactical frontage result |
| --- | --- |
| Home Core Defense Zone | 城塞近接防衛線: tighter fallback depth, fortress/high-ground labels, stronger rear positions. |
| Bridge terrain | 鉄道橋隘路防衛線: compressed center, bridge/rail choke labels, engineer line around the crossing. |
| Active Front with forest + marsh | 森林泥濘塹壕線: forest left, trench center, muddy right, rear artillery, trench repair line. |
| Enemy Vanguard | 敵前衛沼沢前進線: more forward anchors and dangerous swamp advance labels. |
| Enemy Heartland | 荒野縦深反攻線: further forward anchors and open counteroffensive frontage. |

The segment IDs remain stable (`left-flank`, `center-line`, `right-flank`, `reserve-line`, `engineer-line`) so saved brigade StandingOrder templates can survive across battles. If a saved anchor no longer fits the current sector's generated segment zone, the template is realigned to the same segment ID's current anchor and fallback point.

Deployment can now modify that sector-generated frontage before battle. `deploymentPlan.frontlineGeometry` stores both a geometry preset and optional per-segment handle overrides. Presets change the whole line shape, while handles adjust a specific segment's main line, fallback depth, command width, and control radius. Battle creation applies these adjustments before terrain zones, choke points, initial brigade positions, and StandingOrders are created.

Standing-order templates also now carry optional formation facing. Deployment can save a brigade's facing preset or 15-degree fine adjustment before battle, and Battle creation applies that facing to the initial `BattleFormation`. This keeps strategic frontage planning, line assignment, and tactical fire direction connected without requiring freehand drag-rotation controls yet.

The same sector terrain tags now also generate BattleState terrain zones. These zones apply tactical modifiers in `resolveTick`: local movement speed, fatigue/condition cost, cover against casualties, effective weapon range, and fire output. The Active Front implementation currently verifies forest, marsh, and trench zones in both UI and battle tick.

## Dynamic Campaign Generation

The campaign should generate each strategic turn from the current state, not from a fixed historical mission chain.

Each turn should normally produce:

- **1 mandatory main battlefield** around the player army's current sector or immediate front/rear sectors.
- **3-4 side operations** in nearby sectors.
- Enemy pressure changes based on previous battle results, undead momentum, damaged fortifications, supply state, and ignored operations.

The mandatory main battlefield is not skippable. It is the campaign's pressure point for the turn.

Side operations can be manually fought if they become tactical battles, or resolved automatically if the player assigns suitable forces/resources.

## Main Battlefield Rule

The main battlefield should be created from:

- player army current position
- current front band
- nearest enemy pressure sectors
- nearest fallback/defense sectors
- sector terrain tags
- existing fortifications
- current supply/rail/medical state
- enemy momentum

The main battlefield can represent:

- holding the current sector
- defending a prepared line
- fighting a breakthrough
- covering a withdrawal
- counterattacking a nearby enemy staging point
- defending the rear after enemy infiltration

It cannot be skipped. The player can choose posture, deployment, reinforcements, and withdrawal timing, but the core battle must resolve.

## Side Operations

Keep 3-4 side operations active per strategic turn where possible.

Side operations should be near the current army position and should matter to the next main battlefield or broader front state.

Side operation examples:

- recon patrol ahead of the current sector
- raid a nearby enemy nest
- repair rail/supply route behind the line
- evacuate hospital before fallback
- build field works in the rear sector
- artillery interdiction before the main battle
- rescue isolated detachment
- destroy bridge to slow enemy pressure

Side operations should not feel like unrelated bonus missions. They should alter:

- main battlefield enemy wave budget
- enemy special-unit spawn chance
- deployment slots
- reinforcement timing
- supply/ammo availability
- captured weapon and supply-cache opportunities
- fortification readiness
- medical recovery
- enemy pressure in adjacent sectors
- player reputation or initiative

Current implementation note, 2026-07-03:

- `StrategicOperation.spoilsIntel` forecasts expected captured weapons and supply caches, with confidence, visible forecast ranges, and optional recovery multiplier.
- Theater Command displays this intel on the mandatory battle and side operation cards.
- Recon side-operation success/draw revises same-turn unresolved operation intel to `偵察照合済み`. Recon quality is derived from assigned unit type/experience/morale/condition, officer rank/experience, and doctrine support; higher quality can show effects such as `精密照合` and `回収効率 x1.16`.
- Failed recon can mark linked intel as `誤情報疑い`, widen uncertainty, and reduce recovery certainty. This gives the current side-operation assignment UI a reason to favor better scouts/officers for risky reconnaissance.
- Deployment repeats the mandatory battle forecast as `戦利品予測` and `回収候補`.
- Side-operation auto-resolve scales forecast rewards by victory/draw/defeat plus recovery multiplier and writes captured weapons/resources into campaign stock.
- Main battle results also use the operation forecast and recon recovery multiplier to modify After Action `戦利品`, so strategic intel, tactical battle result, and Armory stock are now connected.
- Theater Command can assign one unit and one officer to each unresolved side operation. This affects recon quality and auto-resolve outcomes and makes side operations a real force-allocation decision.
- Resolved side-operation units are excluded from the mandatory main battle deployment roster for the turn, creating UGCW-like tension between side battle benefits and main battle strength.

## Auto-Resolve

Side operations should support auto-resolve.

Auto-resolve inputs:

- assigned unit/officer quality
- assigned manpower
- assigned ammo/supply/materials
- relevant doctrine
- sector terrain
- enemy pressure
- operation risk
- intelligence quality

Auto-resolve outputs:

- victory/draw/failure
- casualties
- officer injury/death risk
- resource spend
- captured weapons and recovered supply caches when operation intel supports it
- fatigue
- operation effect
- reputation/initiative change

Auto-resolve must not be free. It should be a strategic convenience with real risk, especially when the player assigns weak troops, tired officers, or insufficient supply.

The mandatory main battlefield should not use auto-resolve in the base game. It is the tactical anchor of the campaign turn.

## Strategic Turn Loop

The campaign should work like this:

```text
1. Read strategic map
2. Review intelligence and enemy pressure
3. Choose operations
4. Allocate corps, engineers, supplies, ammunition, materials, officers
5. Build/repair/upgrade/abandon defensive works
6. Fight tactical battle if operation triggers combat
7. Apply battle result to army, sector, fortifications, enemy pressure, resources
8. Move front line if conditions are met
9. Save strategic history
10. Proceed to next strategic turn
```

## Operation Types

The campaign map should offer more than mandatory battles.

| Operation | Strategic Result |
| --- | --- |
| Hold Sector | Defend a sector and preserve current front position. |
| Fighting Withdrawal | Abandon ground while preserving army and equipment. |
| Counterattack | Push into a contested/enemy sector to reduce pressure. |
| Raid Enemy Nest | Reduce enemy wave budget or special enemy spawn rate. |
| Supply Raid | Gain weapons/materials/ammunition, risk casualties. |
| Recon Patrol | Improve enemy forecast and battle deployment info. |
| Engineer Works | Build or repair fortifications without full battle. |
| Rail Repair | Improve supply throughput and reinforcement speed. |
| Bridge Demolition | Slow enemy advance but reduce later mobility/supply. |
| Evacuate Hospital | Save wounded/officers before abandoning a line. |
| Artillery Interdiction | Reduce first-wave pressure, consume ammunition. |
| Relief Operation | Rescue an isolated unit, depot, or sector. |

## UGCW-Style Side Mission Effects

Use UGCW's side battle logic as a baseline, but expand it.

Side operations can affect:

- enemy manpower / wave budget
- enemy coordination / training equivalent
- enemy armory / weapon quality equivalent
- player gold/materials/ammunition/supplies
- player recruits/veteran pool
- player reputation
- available reinforcements
- deployment slots
- bridge/rail access
- sector fortification state
- medical recovery
- intelligence quality
- enemy special-unit availability
- future battle objectives

Example:

```text
Operation: Raid Enemy Nest
Victory:
  - enemyWaveBudget -15% for next sector battle
  - enemySpecialSpawnChance -10%
  - reputation +2
Draw:
  - enemyWaveBudget -5%
  - player fatigue +small
Defeat:
  - officer casualty risk
  - enemyMomentum +1
```

## Front Movement

The front should move by accumulated strategic pressure, not by one binary battle.

```text
frontPressureDelta =
  battleOutcomeScore
  + sectorFortificationSurvival
  + enemyNestSuppression
  + logisticsReadiness
  - playerCasualtyShock
  - officerLossShock
  - structureOverrunShock
  - enemyMomentum
```

Possible outcomes:

- Hold current line
- Gain initiative in current band
- Push into next enemy-side band
- Lose a sector but preserve army
- Collapse into fallback line
- Emergency retreat toward Home Core Defense Zone

## Battle Map Relationship

The tactical battle map should be sector-specific.

Strategic map decides:

- sector terrain tags
- weather/season
- available defensive structures
- deployment zones
- reinforcement timing
- retreat routes
- enemy wave composition
- enemy wave budget
- battle objectives
- post-battle consequences

Battle result returns:

- casualties
- officer events
- ammo/supply spent
- enemy killed/suppressed
- structures damaged/overrun/held
- objectives held/lost
- retreat success/failure
- captured or lost equipment
- sector control delta

## Required Architecture Implication

Do not make `BattleState` own campaign logic.

Use separate layers:

```text
TheaterState
  -> OperationPlan
  -> BattleScenario
  -> BattleState
  -> BattleResult
  -> CampaignDelta
  -> TheaterState
```

The strategic layer must be able to add new operations later without rewriting tactical battle logic.

## Sources

- Official Steam Game Guide PDF: https://cdn.steamstatic.com/steam/apps/502520/manuals/UGCW_Guide_v1.25.pdf?t=1606630974
- UGCW Battles Wiki: https://ugcw.fandom.com/wiki/Battles
- Reddit player discussion on minor battle modifiers: https://www.reddit.com/r/ultimategeneral/comments/ua1rfz/what_is_the_point_of_minor_battles/
