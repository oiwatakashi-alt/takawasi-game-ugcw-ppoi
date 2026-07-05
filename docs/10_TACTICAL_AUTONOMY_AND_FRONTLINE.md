# Tactical Autonomy / Frontline Command Design

Last updated: 2026-07-05

## Purpose

Large-army play should not depend on constant direct RTS micro.

The tactical battle should become a command game where the player defines frontage, assigned positions, defensive priorities, and standing orders. Brigades then fight autonomously around their assigned area unless the player intervenes.

This supports:

- UGCW-like brigade-scale battle readability
- desktop-first semi-automated command without constant unit micro
- wider terrain and longer battle lines
- meaningful trenches, barricades, supply depots, hospitals, observation posts, and fallback lines
- undead mass pressure without forcing the player to manually babysit every unit each second

## Core Decision

The battle model should not become a pure direct-control RTS.

Use two command layers:

| Layer | Meaning | Examples |
| --- | --- | --- |
| Immediate Order | A short direct order issued now. | Hold, Advance, Flank, Rest/Resupply, Build/Repair, Retreat. |
| Standing Order / Frontline Assignment | A persistent behavior policy and assigned area. | Hold this line segment, defend this trench, fall back at 60% morale, prioritize brutes, repair nearby works. |

Immediate orders override or nudge behavior, but the standing order is the baseline.

## Wide Map / Frontline Model

The tactical map should be wider than the visible screen and divided into meaningful command areas.

Recommended map concepts:

- `mapBounds`: abstract battlefield size, larger than viewport.
- `frontlineSegments`: named line sections such as left flank, center trench, rail embankment, village edge, bridge choke.
- `anchorPoint`: the unit's preferred location.
- `controlRadius`: area where the unit can self-adjust without further orders.
- `fallbackPoint`: rear position used when losses, morale, ammo, or overrun risk cross thresholds.
- `facilityAssignment`: optional defensive work or support facility the unit should protect, use, repair, or resupply from.

The player should mainly set:

```text
Unit -> assign to segment/anchor -> choose posture -> choose fallback rule
```

The unit should then:

- stay near the assigned anchor
- use nearby cover/fortifications
- pick targets by priority and range
- shift slightly inside control radius to maintain range or avoid overrun
- resupply or rest if standing order allows it
- retreat to fallback point if thresholds are crossed

## Standing Order Fields

Initial product-shaped model:

```ts
interface StandingOrder {
  unitId: string;
  anchor: TacticalPoint;
  controlRadius: number;
  frontlineSegmentId?: string;
  posture: "hold_line" | "elastic_defense" | "aggressive_screen" | "fire_support" | "engineer_support" | "fallback_guard";
  targetPriority: "nearest" | "brute" | "riflemen" | "officer" | "weakest" | "largest_mass";
  ammoPolicy: "normal" | "conserve" | "intense";
  fallback: {
    enabled: boolean;
    moraleBelow?: number;
    soldiersBelowRatio?: number;
    ammoBelow?: number;
    destination: TacticalPoint;
  };
  facilityAssignment?: {
    structureId: string;
    mode: "defend" | "repair" | "resupply" | "hold_near";
  };
}
```

Names can change during implementation, but the boundary should remain:

- `BattleOrder` = current tactical command
- `StandingOrder` = persistent autonomous behavior
- `FrontlineAssignment` = map/segment ownership

## Facility Value

This model makes defensive works more than passive buffs.

| Facility | Tactical use under autonomy |
| --- | --- |
| Trench | Line infantry can be assigned to hold near it; automatic cover and fallback behavior make it a true line anchor. |
| Barricade | Useful as a choke or delay object if units are told to defend a local radius rather than chase enemies globally. |
| Supply Depot | Units can automatically resupply when ammo falls below a standing threshold. |
| Field Hospital | After-action recovery can be tied to units that successfully fall back through protected medical zones. |
| Observation Post | Extends threat forecast and gives earlier warning for the segment it watches. |
| Fallback Line | Lets the player trade ground intentionally instead of only winning/collapsing. |

Without assigned areas, units drift toward nearest targets and facilities feel decorative. With assigned areas, facilities shape the battle.

## Deferred Mobile UX

Mobile-specific work is no longer a current QA gate as of 2026-07-03. The underlying semi-automated command model should still remain compatible with later mobile work, but desktop readability and tactical decision quality take priority for now.

Expected mobile controls:

- tap a unit card
- choose or cycle assigned segment
- tap a large command posture button
- set fallback threshold with simple presets
- tap alert cards to jump to threatened segment
- use pause and speed controls often

Good mobile command presets:

| Preset | Meaning |
| --- | --- |
| 固守 | Stay near anchor, prioritize nearest enemy, retreat only if ordered. |
| 弾薬節約 | Fire slower, conserve ammo, hold assigned line. |
| 弾性防御 | Hold, then auto-fallback when morale/ammo/loss thresholds are crossed. |
| 阻止射撃 | Prioritize brutes/officers or massed enemies before nearest targets. |
| 工兵支援 | Repair assigned structure first, fight only in self-defense. |

The current active QA target is desktop only. Mobile/cellphone presentation is not part of the current implementation gate unless explicitly re-added.

## Desktop UX

Desktop can still support richer interaction:

- drag an anchor point
- drag a line segment
- assign unit to a facility by clicking facility then unit
- show control radius and fallback route
- allow manual immediate orders as overrides

Desktop and mobile should use the same underlying `StandingOrder` model.

## Battle Tick Implications

The battle tick should eventually process:

1. enemy wave spawn and movement
2. standing-order desired position calculation
3. immediate-order override if active
4. facility and terrain influence
5. target selection by priority, not only nearest
6. fallback threshold checks
7. resupply/repair behavior
8. morale/fatigue/ammo/structure damage
9. objective and line-integrity checks

Current nearest-target shooting can remain as the default fallback. The next upgrade is to select targets by `targetPriority` and restrict movement around the assigned `anchor`.

## Implementation Phasing

Do not rewrite the battle system all at once.

Suggested order:

1. Add `StandingOrder` and `FrontlineSegment` types to battle state.
2. Give every deployed unit a default anchor and control radius at battle creation.
3. Make `Hold` use anchor/control radius instead of fixed no movement.
4. Add posture presets and target priority.
5. Add fallback threshold behavior.
6. Bind trenches/barricades/supply depots to assignment UI.
7. Add mobile-specific command drawer and alert cards.
8. Expand map viewport/panning after the command model exists.

## Implemented Vertical Slice - 2026-07-01

The first playable vertical slice is now implemented.

Implemented:

- `BattleState.mapBounds` with initial logical battlefield size `140 x 100`.
- `BattleState.frontlineSegments` with five starting areas: left flank, center trench line, right marsh line, reserve artillery line, engineer support line.
- `BattleUnit.standingOrder` with anchor, control radius, posture, target priority, ammo policy, fallback rule, and optional facility assignment.
- Default battle creation assigns line infantry/jaegers across line segments, artillery to fire support, and engineers to engineer support or repair duty.
- Battle tick uses target priority, ammo policy, fallback thresholds, assigned facility behavior, supply depot recovery, and engineer-support repair behavior.
- Battle Command UI shows wide horizontal battlefield, frontline segment boxes, control-radius overlays, fallback routes, anchors, and unit standing-order details.
- Unit cards can change standing-order preset, frontline segment, facility assignment, and immediate order.
- Earlier mobile experiments used the same model and a horizontal tactical map scroll rather than tiny direct dragging; current implementation gates are desktop-first unless mobile is explicitly re-added.

Still deferred after later slices:

- direct drag placement
- freehand line drawing

## Implemented Command Slice - 2026-07-02

The second command slice is now implemented.

Implemented:

- Battle UI keeps a selected brigade and highlights its map token, card, assignment radius, anchor, and fallback route.
- Selected command panel exposes posture presets, immediate orders, and map command modes.
- Map command modes support click/tap assignment for brigade anchor and fallback destination.
- Facility assignment mode lets the selected brigade click a structure on the map and bind it as defend/repair/resupply duty.
- Minimap click moves the horizontal tactical viewport and shows the current viewport rectangle.
- Minimap now includes player units, enemies, structures, and the front marker.
- `BattleUnit.actionReason` records current autonomous intent such as holding anchor, returning to anchor, moving to facility, resupplying, repairing, firing, or falling back.
- Alert cards surface key battlefield events, including enemy wave approach, line danger, structure damage, morale danger, and ammo danger. Clicking an alert selects or scrolls toward the relevant target.
- Mobile command mode scrolls the tactical map into view before tap assignment, avoiding tiny direct-drag requirements.
- `StandingOrderTemplate` is now persisted in `CampaignState.standingOrderTemplates` and versioned local saves.
- Battle Command can save the selected brigade's current autonomous command as that brigade's standard order.
- Deployment shows which selected/reserve brigades have saved autonomous orders.
- Battle creation automatically applies saved brigade templates to starting position, anchor, fallback, posture, target priority, ammo policy, and valid facility duty.

## Implemented Deployment Planner Slice - 2026-07-02

The third command slice moves standing-order planning into the pre-battle Deployment scene.

Implemented:

- Battle frontline defaults are shared through `src/game/battle/frontlineDefaults.ts`, so Deployment and Battle use the same left/center/right/reserve/engineer line definitions.
- Deployment includes an `出撃前自律方針` panel for selected deployed brigades.
- The player can choose assigned frontline segment, formation-facing preset, posture preset, target priority, ammo policy, fallback preset, and facility assignment before starting the mandatory battle.
- Deployment saves the configured draft into `CampaignState.standingOrderTemplates` through the same versioned save path used by battle-time saving.
- Battle creation applies the saved Deployment plan on start; verified values include right-flank assignment, aggressive screen posture, officer priority, conserve-ammo policy, careful fallback, and structure-defense duty.
- Desktop 1440px and mobile 390px QA confirmed console errors 0, broken images 0, and overflow candidates 0 for this slice.

## Implemented Sector Frontline Slice - 2026-07-02

The fourth command slice makes the tactical frontage depend on the current strategic sector instead of using one fixed line layout everywhere.

Implemented:

- `src/game/battle/frontlineDefaults.ts` now generates sector/terrain-driven frontline profiles while preserving stable segment IDs for save compatibility.
- Current profile families include home-core fortress defense, bridge/rail choke defense, active-front forest/marsh/trench defense, enemy-vanguard swamp advance, enemy-heartland open advance, and standard fallback defense.
- Deployment displays the current `戦線型` and a clickable `戦区戦線プレビュー` using the same generated segments that Battle uses.
- Battle creation uses the sector-specific segment geometry for unit default positions, StandingOrder anchors, fallback points, and Battle UI segment boxes.
- Saved StandingOrder templates are realigned to the current sector's same segment ID when their stored anchor does not fit the generated segment zone. This keeps old brigade preferences useful without forcing coordinates from a different battlefield.
- Desktop 1440px and mobile 390px QA confirmed the Active Front profile `森林泥濘塹壕線`, Deployment preview segment names, saved right-flank anchor/fallback, Battle segment rendering, console errors 0, broken images 0, and overflow candidates 0.

## Implemented Terrain Effects Slice - 2026-07-02

The fifth command slice makes sector terrain affect battle logic rather than only map labels.

Implemented:

- `BattleState.terrainZones` stores generated tactical terrain zones for the current scenario.
- `src/game/battle/terrainEffects.ts` converts terrain tags into zones with cover, fatigue, movement, range, and fire modifiers.
- `resolveTick` applies local terrain to player movement, undead movement, firing range, fire output, fatigue/condition loss, and casualty cover.
- Battle Command renders the terrain zones from BattleState and shows selected brigades' current terrain and effective range.
- Current Active Front QA verified `森林遮蔽帯 移動72%`, `泥濘低地 移動48%`, `塹壕掩体線 移動72%`, selected unit terrain `森林遮蔽帯`, and `射程 30 有効28`.
- Desktop 1440px and mobile 390px QA confirmed console errors 0, broken images 0, and overflow candidates 0 for this slice.

## Implemented Observation / Visibility Slice - 2026-07-02

The sixth command slice makes observation posts and concealment affect the RTS battle loop.

Implemented:

- `observationPost` is now a buildable fortification with `visibility` effect.
- `src/game/battle/visibility.ts` computes durability-scaled spotting range, terrain/type concealment, and per-enemy `isSpotted` state.
- `resolveTick` updates enemy visibility after wave movement and restricts player/structure target selection to spotted enemies. Undead movement still proceeds so hidden threats can keep advancing.
- Battle Command shows topbar/objective visibility range, spotted/total enemy counts, selected-panel observation summary, and hidden enemy shadows on the map/minimap.
- Engineering shows observation-post effect text as `視界 +18`; Deployment and Battle receive the built observation post from campaign sector structures.
- Desktop and mobile 390px QA confirmed observation-post build flow, battle visibility HUD, spotted/hidden enemy state, mobile horizontal map scroll, page horizontal overflow false, broken images 0, and console errors 0.

## Implemented Field Hospital Recovery Slice - 2026-07-02

The seventh command slice makes field hospitals matter in the long-term army growth loop.

Implemented:

- `fieldHospital` is now a buildable fortification with `casualtyRecovery` effect.
- Battle result generation separates raw battle casualties, recovered wounded, and permanent casualties.
- Recovery rate is durability/status dependent through fortification effects and is reduced on withdrawal or collapse.
- After Action shows `医療補給`, `負傷兵収容率`, total recovered wounded, and per-unit raw/recovered/permanent casualty rows.
- Campaign application subtracts permanent casualties only and records both permanent losses and recovered wounded in unit battle history.
- Desktop and mobile 390px QA confirmed build flow, Deployment/Battle structure presence, After Action medical recovery display, page horizontal overflow false, broken images 0, and console errors 0.

## Implemented Bridge Choke Slice - 2026-07-02

The eighth command slice makes bridge and rail chokepoints affect the RTS battle loop instead of staying as terrain labels.

Implemented:

- `BattleState.chokePoints` stores generated chokepoint nodes for bridge terrain.
- `src/game/battle/chokePoints.ts` creates the `鉄道橋隘路` node, gives it radius, lane width, flow limit, base slow multiplier, current pressure, and delay percent.
- `resolveTick` routes enemy movement through the bridge lane until the unit has crossed the chokepoint, then returns it to its normal destination.
- Enemy groups near the bridge compute congestion pressure; pressure above the flow limit increases movement delay.
- Built/damaged structures near the chokepoint add extra delay, making barricades/trenches more meaningful around bridge approaches.
- Battle Command shows chokepoint pressure/delay in the topbar, selected command panel, objective strip, map overlay, minimap, and alert cards.
- Source-module smoke verified bridge-sector BattleState generation for `アイゼンブルック鉄道集積地`; after 54 ticks the bridge choke reached pressure `1763` and delay `73%`.
- Browser QA confirmed the normal Strategic Map -> Camp -> Deployment -> Battle -> tick flow still works after the change, with desktop and mobile 390px console errors 0, broken images 0, and page horizontal overflow false.

## Implemented Formation Frontage Slice - 2026-07-02

The ninth command slice makes player brigades behave more like battle lines than map points.

Implemented:

- `BattleUnit.formation` stores frontage width, depth, fire arc, density, and overlap pressure.
- `src/game/battle/formations.ts` computes formation size by unit type, current soldiers, posture, and immediate order.
- Infantry and jaegers form wider lines, artillery and engineers use narrower formations.
- Formation overlap pressure detects brigades stacked too closely on the same line.
- Player target selection now checks whether spotted enemies are inside the brigade's formation fire arc.
- Enemy contact uses distance to the brigade formation footprint instead of only distance to the center point.
- Formation fire/exposure modifiers make overcrowded formations less efficient and more vulnerable.
- Battle Command renders formation frontage lines, the selected brigade's fire arc, formation stats in the selected panel and unit cards, and overcrowding alert cards.
- Source-module smoke verified initial formation widths and 36 tick formation updates; browser QA verified 6 frontage lines, 1 selected fire arc, overcrowding alerts, 8 engagement lines at 86 seconds, desktop and mobile 390px console errors 0, broken images 0, and page horizontal overflow false.

## Implemented Frontline Geometry Slice - 2026-07-02

The tenth command slice gives the player pre-battle control over the shape of the whole frontline without requiring precision dragging.

Implemented:

- `FrontlineGeometryAdjustment` stores the selected deployment shape: sector default, forward line, defense-in-depth, wide screen, compressed choke, refused-left, or refused-right.
- `src/game/battle/frontlineDefaults.ts` now applies geometry presets to sector-generated frontline segments while preserving stable segment IDs.
- Geometry transforms adjust segment anchors, zones, fallback points, control radius, lateral spread, and depth spacing.
- `CampaignState.deploymentPlan` stores the chosen geometry for the current mandatory battle, with save migration support through local save v4.
- Deployment adds a `戦線ジオメトリ` planner. Selecting a preset updates the tactical preview and snaps existing StandingOrder drafts to the adjusted segment anchors/fallback points.
- Battle creation applies the saved deploymentPlan before terrain zones, chokepoints, default positions, StandingOrders, and Battle UI segment boxes are built.
- Battle Command shows the active geometry label in the topbar, selected brigade panel, and map badge.
- Browser QA verified Deployment preset selection, Battle geometry label propagation, localStorage save v4, desktop and mobile 390px console errors 0, broken images 0, and page horizontal overflow false.

## Implemented Frontline Handle Slice - 2026-07-02

The eleventh command slice adds segment-level frontline adjustment without requiring fragile drag controls.

Implemented:

- `FrontlineSegmentGeometryOverride` stores per-segment manual offsets for anchor, fallback, zone, zone size, and control radius.
- `FrontlineGeometryAdjustment.segmentOverrides` now carries custom handle changes on top of a preset layout.
- `src/game/battle/frontlineDefaults.ts` applies preset geometry first, then applies per-segment overrides while clamping values inside the logical battlefield.
- Deployment adds a `戦線ハンドル` panel for the selected segment.
- The player can move the selected segment's main line forward/back/north/south, deepen or shallow the fallback line, widen or narrow the command area, and change control radius.
- The preview marks adjusted segments with `調整`, and the geometry label displays values such as `戦区標準+手動1`.
- Existing StandingOrder drafts are snapped to adjusted segment anchors/fallback points when handle changes are made.
- Battle creation receives the same adjusted segments through `deploymentPlan`, so Battle Command topbar, selected panel, map badge, frontline boxes, assignment radii, and fallback routes reflect the custom plan.
- Desktop QA verified reset -> Deployment -> handle edits -> reload persistence -> Battle -> 3x tick with console errors 0, broken images 0, and page horizontal overflow false.
- Mobile 390px QA verified Battle map horizontal scroll, Deployment handle controls in 2 columns, console errors 0, broken images 0, and page horizontal overflow false.

## Implemented Formation Facing Slice - 2026-07-02

The twelfth command slice gives brigade formations an explicit facing without requiring freehand rotation controls.

Implemented:

- `StandingOrder.facingDeg` stores the brigade's saved or active facing. It is optional, so old saved templates default to `正面`.
- `BattleFormation.facingDeg` stores the active facing used by target filtering, formation distance, and Battle Command overlays.
- `src/game/battle/formations.ts` projects map points into the unit's facing frame, so `targetWithinFormationArc` no longer assumes every unit fires due east.
- Deployment adds a `射界向き` preset group: `北東拒止`, `北東斜行`, `正面`, `南東斜行`, and `南東拒止`.
- Battle Command adds selected-brigade `射界` buttons and Japanese log entries for facing changes.
- Battle Command draws oriented frontage lines, facing lines, and selected oblique fire-arc polygons from the same frame used by battle logic.
- Segment reassignment sets a sensible default facing for left, center, right, reserve, or engineer lines.
- Desktop QA verified reset -> Deployment -> save `北東拒止` -> Battle saved facing -> change to `射界南東` -> 3x tick with console errors 0, broken images 0, and page horizontal overflow false.
- Mobile 390px QA verified the same battle state, active `射界南東` button, formation overlays, console errors 0, broken images 0, and page horizontal overflow false.

## Implemented Enemy Assault Group Slice - 2026-07-02

The thirteenth command slice makes enemy waves behave more like assault groups than point targets.

Implemented:

- `EnemyAssaultPlan` stores each enemy group's assault mode, target segment or fortification, Japanese target label, frontage width, depth, lane spread, cohesion, and movement vector.
- `src/game/battle/waves.ts` assigns assault plans when waves spawn. Mob groups press broad segments or fortifications, riflemen screen from range, brutes act as breachers, and officers use a command-drive mode.
- `resolveTick` uses enemy frontage when checking contact range against player formations.
- Enemy cohesion affects movement, structure threat, and line pressure; incoming fire can reduce cohesion.
- Enemy groups use lane spread around the assault vector, reducing point-stacking and making multiple waves read more like lines or columns.
- Battle Command renders enemy assault footprints and axis lines, and enemy cards show mode, width, and target such as `群集29 / 圧迫 / 幅25 集団圧迫:塹壕線`.
- Desktop 1440px and mobile 390px QA confirmed enemy assault footprints/axes, Japanese target labels, no internal map node IDs, console errors 0, broken images 0, and page horizontal overflow false.

Still deferred:

- direct drag placement
- freehand line drawing
- deeper elevation-specific line-of-sight beyond current hill/reverse-slope rectangles
- deeper enemy staff hierarchy beyond current officer command and morale routing
- freehand drag-style formation rotation

## Implemented Enemy Command Slice - 2026-07-02

The fourteenth command slice makes undead officers tactically meaningful instead of only another enemy token.

Implemented:

- `EnemyAssaultPlan` now stores `commandState`, `commandInfluence`, and `commandSourceId`.
- `src/game/battle/waves.ts` spawns undead officers on command waves from wave 3 onward, rather than every wave. This makes officer appearances more readable and gives officer kills a clearer tactical payoff.
- `resolveTick` computes command influence from living undead officers, then applies that factor to enemy movement, enemy attacks, structure threat, and line pressure.
- If a non-officer group had a previous officer command source and that source disappears, the group can enter `指揮崩壊`, lose cohesion, and remain disrupted until a strong enough command influence restores it.
- Battle Command renders commanded/disrupted enemy assault footprints, shows `敵指揮網` and `敵指揮崩壊` alerts, and enemy cards show command state, cohesion, and command influence.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x tick, `敵指揮網`, `指揮下`, later `敵指揮崩壊`, 2 disrupted groups, broken images 0, recent console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified the same command/collapse state remains readable with intentional map horizontal scroll, broken images 0, recent console errors 0, and page horizontal overflow false.

Still deferred:

- explicit enemy staff hierarchy beyond local officer influence
- enemy doctrine or staff behavior that changes morale recovery by wave/commander type
- richer staff-level fire-control rules beyond the first doctrine-linked fire discipline profile

## Implemented Enemy Facility-Targeting Slice - 2026-07-05

The current slice makes defensive works an explicit enemy target, not only an object that takes incidental nearby damage.

Implemented:

- `src/game/battle/waves.ts` now evaluates active structures when spawning enemy groups, skipping ranged rifle screens but allowing mobs, brutes, and officers to select facilities.
- Structure choice is weighted by structure type, damaged state, live facility state, assigned defender count, distance from the wave's approach, and enemy type. Supply depots, observation posts, field hospitals, trenches, and barricades can therefore draw different pressure.
- Facility-targeted assault plans use structure command groups and Japanese intent labels such as `塹壕破砕:塹壕線`, `障害排除:バリケード`, `補給遮断:補給所`, `観測潰し:観測所`, and `救護線破壊:野戦病院`.
- Battle Command marks those enemies with `施設襲撃` text and `structure-raider` map-token styling while preserving existing command-intent, morale, phase, and hidden/spotted behavior.
- Facility cards can show `targeting` at the same time as live facility state, assigned defenders, repair rate, and threat pressure, so the player can see the relationship between defensive works and enemy intention.

Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x wave pressure. The battle showed `塹壕破砕:塹壕線`, `施設襲撃`, `第1波塹壕線襲撃群`, 12 `structure-raider` enemies, 1 targeted structure, console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA was skipped because it is outside the current target. QA report: `outputs/takawasi-enemy-facility-targeting-qa-report.json`.

## Implemented Enemy Morale Routing Slice - 2026-07-03

The twenty-first command slice separates enemy morale from enemy officer command/collapse.

Implemented:

- `EnemyAssaultPlan` now stores `morale` and `moraleState`.
- `src/game/battle/waves.ts` gives each enemy type an initial morale profile. Mobs are easier to shake, riflemen are steadier, brutes are harder to rout, and officers are resilient command nodes.
- `resolveTick` applies morale shock when player or structure fire damages an enemy group. Sustained losses, low cohesion, and disrupted command can move a group from `維持` to `動揺` and then `潰走`.
- `潰走` and `再集結` are not just labels. Those groups clear their current target, move rearward, contribute reduced pressure, and skip attacks while rallying.
- Routed groups can recover through `再集結` before returning to `維持`; they no longer snap directly from rout to normal pressure.
- Battle Command shows enemy morale state in alert cards, enemy map-token text, morale-state CSS, and battle logs such as `アンデッド群集 動揺 -> 潰走。` and `アンデッド群集 潰走 -> 再集結。`
- Desktop QA verified reset/reload -> Camp -> Deployment -> Battle -> 3x tick, visible alert `敵潰走/再集結1群 / 群集 再集結`, 1 current `regrouping` map enemy, battle-log route/regroup transitions, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified the same paused battle state, intentional battle-map horizontal scroll, morale alert text, 1 current `regrouping` enemy, broken images 0, console errors 0, and page horizontal overflow false.

## Implemented Deployment Depth Limit Slice - 2026-07-03

The twenty-second command slice makes the strategic sector constrain where brigades can start.

Implemented:

- `FrontlineSegment.deploymentLimit` stores a sector-specific allowed deployment band for each line segment.
- `src/game/battle/frontlineDefaults.ts` derives deployment bands such as `本国堡塁出撃帯`, `橋頭堡出撃帯`, `森林泥濘出撃帯`, `敵前衛出撃帯`, and `敵本国遠征帯` from theater band, terrain, structures, and segment role.
- Deployment shows `出撃深度`, `許可帯 X/Y`, and 5 translucent deployment-limit overlays behind the segment buttons.
- Frontline geometry presets and manual segment handles can still move lines, but final anchors are clamped to the deployment band.
- Saved StandingOrder templates and Deployment-side drafts are aligned through the same deployment band before BattleState is created.
- Battle creation clamps default player starting positions to the same segment deployment band, so UI planning and runtime positions match.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> `前進主線` -> Battle, visible `森林泥濘出撃帯`, 5 deployment-limit overlays, active `許可帯 X6-62 / Y11-36`, Battle log `出撃戦線を前進主線で展開`, 6 player units, max logical initial X 54 within the active-front deployment cap, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified Deployment `出撃深度 森林泥濘出撃帯`, `許可帯 X6-62 / Y11-36`, 5 deployment-limit overlays, Battle start with 6 player units, intentional battle-map horizontal scroll, broken images 0, console errors 0, and page horizontal overflow false.

## Implemented In-Battle Target Priority Slice - 2026-07-02

The fifteenth command slice connects enemy command units to player tactical judgment.

Implemented:

- `src/game/battle/orders.ts` now exposes `setStandingOrderTargetPriority` and `setStandingOrderAmmoPolicy`.
- Battle Command selected-brigade panel now shows current `優先` and `弾薬` values and exposes `優先目標` and `弾薬方針` button rows during the battle.
- A selected brigade can be switched to `敵指揮`, `大型敵`, `最大集団`, or other target priorities without returning to Deployment.
- A selected brigade can switch between `通常射撃`, `弾薬節約`, and `集中射撃` during combat.
- Changes write to the active unit's StandingOrder, are reflected in the selected unit card, and produce Japanese battle log messages.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> selected unit `敵指揮` + `集中射撃`, active button state, selected card state, Japanese logs, 3x tick persistence after `敵指揮網`, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified the two command-control rows remain present, active `敵指揮` and `集中射撃` states remain readable, battle map horizontal scroll is intentional, broken images 0, recent console errors 0, and page horizontal overflow false.

## Implemented Focus-Fire Target Slice - 2026-07-02

The sixteenth command slice gives the player one precise fire-control intervention without turning the battle into full micro-control.

Implemented:

- `BattleUnit.focusTargetId` stores a battle-only enemy target. It is intentionally not stored on `StandingOrder`, so invalid enemy IDs are not saved into future battles.
- `src/game/battle/orders.ts` exposes `setUnitFocusTarget` and `clearUnitFocusTarget`, both with Japanese battle log messages.
- Battle Command selected-brigade panel adds `敵を指名` and `指名解除`.
- In focus-target mode, the player clicks a spotted enemy group on the tactical map to assign that group as the selected brigade's focus-fire target.
- `resolveTick` tries the focus target first only when it remains alive, spotted, inside weapon range, and inside formation fire arc. If the target is gone or invalid, the unit falls back to normal target priority.
- The selected panel and selected unit card show `集中 <target>`; the focused enemy card receives a visible map highlight.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x enemy spawn -> `敵を指名` -> spotted enemy click, Japanese focus log, selected panel/card `集中 アンデッド群集`, focused enemy styling, actual current target alignment, clear command, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified the focus controls remain visible, focus assign log/display updates after tapping a spotted enemy, battle map horizontal scroll remains intentional, broken images 0, console errors 0, and page horizontal overflow false.

## Implemented Volley Fire Mission Slice - 2026-07-02

The seventeenth command slice turns focus-fire into a short fire-control commitment.

Implemented:

- `BattleFireMission` stores battle-only fire missions with target, scope, unit IDs, expiry, fire multiplier, ammo multiplier, and condition cost.
- `issueFireMission` adds `旅団斉射` and `戦線斉射`. The line version includes same frontline segment and same-facility defenders, so trench/fortification assignments matter.
- Participating units receive `fireMissionId`, `volleyUntilSeconds`, `volleyCooldownUntilSeconds`, and the same focus target.
- `resolveTick` applies temporary fire-output, ammunition-spend, and condition-cost modifiers while the mission is active, then prunes expired/dead-target missions.
- Battle Command adds `火力管制`, active mission strip, `火力` status chips, and volleying map-token highlight.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> enemy spawn -> focus target -> `戦線斉射`, active mission strip `戦線斉射アンデッド群集 / 4旅団 / 残り4秒`, selected panel/card `火力 戦線斉射 4秒`, volleying unit styling, Japanese log, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified the same line volley flow, visible fire-control controls, mission strip, selected panel fire status, intentional map horizontal scroll, broken images 0, console errors 0, and page horizontal overflow false.

## Implemented Fine Formation Facing Slice - 2026-07-02

The eighteenth command slice makes oblique fire arcs adjustable without introducing fragile drag rotation.

Implemented:

- `formationFacingDisplayLabel` shows both tactical label and exact clamped angle, such as `南東斜行 +9度`.
- Deployment keeps the five preset facing buttons and adds `北へ15度`, `正面0度`, and `南へ15度` controls for selected deployed brigades.
- Saved StandingOrder templates now preserve those fine angles through the existing `facingDeg` field and battle creation applies them.
- Battle Command adds the same fine-facing controls during combat, with an inline status pill and Japanese log entries.
- `formations.ts` already uses `facingDeg` for oriented projection, so the fine angle changes the actual fire arc and formation distance logic rather than only text.
- Desktop QA verified Deployment `+24度 -> +9度`, template save, Battle initial saved `+9度`, in-battle `北へ15度 -> 正面 -6度`, tick persistence at 3 seconds, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified fine-facing controls visible, selected command panel readable, intentional battle-map horizontal scroll, `南へ15度 -> 南東斜行 +9度`, broken images 0, console errors 0, and page horizontal overflow false.

## Implemented Coordinated Fire Plan Slice - 2026-07-02

The nineteenth command slice turns one-off volley commands into a staged fire-control plan.

Implemented:

- `BattleFirePlan` and `BattleFirePlanStage` are battle-only runtime entities. They do not enter StandingOrder templates or saves because their target IDs and timing belong to the current battle.
- Battle Command lets the selected brigade add the current focused/current target as `段追加:旅団` or `段追加:戦線`. Plan depth and spacing now come from fire discipline: command-only starts at 3 staged entries with 7-second spacing, while logistics doctrine permits 4 stages.
- `計画開始` stores the staged plan in BattleState. While paused, the strip shows pending stages such as `第1段 戦線斉射 アンデッド群集 待機 0秒`.
- `resolveTick` converts due stages into planned `BattleFireMission` entries, applies temporary fire/ammo/condition modifiers, sets participating units to volleying state, and logs each stage.
- Invalid stages are skipped if the target is gone/unspotted or no participating brigade remains available.
- Desktop QA verified reset -> Camp -> Deployment -> Battle -> 3x enemy spawn -> pause -> focus target -> add two `戦線` stages -> `計画開始` -> 1x tick. Evidence included pending strip, stage 1 active strip, stage 2 log, selected panel `火力 戦線斉射`, volleying map tokens, broken images 0, console errors 0, and page horizontal overflow false.
- Mobile 390px QA verified the fire-plan controls are visible, page horizontal overflow false, intentional battle-map horizontal scroll, focus target assignment, `段追加:旅団`, visible draft row, broken images 0, and console errors 0.

## Implemented Doctrine Fire Discipline Slice - 2026-07-03

The twentieth command slice connects campaign doctrine to tactical fire-control behavior.

Implemented:

- `FireDisciplineProfile` is derived from campaign doctrine through `fireDisciplineFromDoctrine`.
- `command` doctrine improves volley duration, cooldown, and fire-plan spacing.
- `logistics` doctrine reduces fire mission ammunition cost and permits 4-stage fire plans.
- `training` is prepared to improve fire efficiency and fatigue cost when unlocked.
- `createBattleState` stores the derived profile in `BattleState` and logs the active `火力規律`.
- `issueFireMission`, `issueFirePlan`, and `resolveTick` use the profile for duration, cooldown, fire/ammo/condition multipliers, staged-plan spacing, and maximum stage count.
- Battle Command displays a persistent `火力規律` strip and includes the discipline label in active fire mission strips and selected-unit status.
- Doctrine screen shows `現在の火力規律`, plan depth, stage spacing, and cooldown effect so the Camp decision visibly connects to the next battle.
- Runtime fallback to `即席火力規律` prevents HMR or old in-memory battle states from crashing when `fireDiscipline` is absent.
- Desktop QA verified Doctrine `参謀統制射撃`, 4-stage plan after logistics investment, Battle `火力規律` strip, battle log profile, focus target, 4 `戦線` stages at `0/7/14/21秒`, pending strip, active FireMission strip with `参謀統制射撃`, broken images 0, and page horizontal overflow false.
- Mobile 390px QA verified `火力規律` visible, selected command panel visible, intentional battle-map horizontal scroll, broken images 0, page horizontal overflow false, and no console errors after the clean reload QA timestamp.

## Implemented Basic LOS Blocker Slice - 2026-07-03

The twenty-third command slice makes terrain shape who can see and shoot, not only how quickly units move.

Implemented:

- `src/game/battle/terrainEffects.ts` now exposes a shared line-of-sight model based on existing `BattleTerrainZone` rectangles.
- Forest and village terrain are strong `射線遮蔽`; hills and marshes are partial `射線減衰`; trenches remain cover without becoming hard LOS walls.
- The LOS helper samples the line between observer/shooter and target, reduces obstruction when the shooter or target is inside the same terrain edge, and returns blocker names for UI display.
- `src/game/battle/visibility.ts` now uses the nearest friendly observer and terrain LOS blockage, so long-range spotting can be blocked while close contact still reveals enemies.
- `src/game/battle/resolveTick.ts` now requires clear line of fire for player brigade target selection and structure fire, including focus-fire fallback.
- Battle Command terrain callouts show `射線遮蔽`, `射線減衰`, or `射線影響なし`, and brigade cards show `射線 待機/良好/減衰/遮断`.
- Fire-discipline fallback was hardened through `fireDisciplineWithDefaults`, preventing old/HMR in-memory battle states from crashing Battle Command when `fireDiscipline` is absent or partial.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x tick, terrain labels, LOS class counts, 3 enemy groups, 5 engagement lines, 2/3 spotted enemies, page horizontal overflow false, broken images 0, and console errors 0.
- Mobile 390px QA verified terrain LOS labels, six unit cards, six command preset buttons, line-of-sight card text, intentional battle-map horizontal scroll, page horizontal overflow false, broken images 0, and console errors 0.

## Implemented Segment Click Command Slice - 2026-07-03

The latest command slice makes frontline assignment more map-native without requiring fragile drag controls.

Implemented:

- Battle Command adds `戦線をクリック` to the selected-brigade command panel.
- While this mode is active, a click/tap on the wide tactical map is converted into logical battle coordinates and matched to the containing or nearest `frontlineSegment`.
- The selected brigade is reassigned through the existing `assignFrontlineSegment` command, so anchor, fallback point, control radius, facing defaults, battle log, and StandingOrder UI all update through the same domain path used by card buttons.
- Segment rectangles stay as visual overlays; the assignment no longer depends on clicking overlapping DOM boxes. This avoids mobile and dense-map cases where a nearby unit token or later segment box steals the click.
- The selected command panel now shows a compact autonomous-command summary: anchor coordinates/control radius, fallback coordinates/enabled state, and current action reason.
- Alert clicks now choose a relevant unit when possible: pressured-segment alerts select the weakest assigned brigade, while damaged-structure alerts select an assigned defender or nearest engineer candidate.
- Mobile QA verified horizontal map scroll plus map-coordinate segment assignment to `中央塹壕線`, updated summary `基準 X38 Y47 / 半径18`, battle log `第4戦列歩兵大隊を中央塹壕線へ配置転換。`, broken images 0, console errors 0, and page horizontal overflow 0.

## Implemented Alert Recommendation Slice - 2026-07-03

The latest command slice turns battlefield alerts into command shortcuts instead of passive notifications.

Implemented:

- Battle alerts now carry a short recommendation label such as `阻止射撃へ`, `敵指揮優先`, `後退守備へ`, `弾性防御へ`, `弾薬節約`, or `修理担当`.
- Each alert card separates the main card click from the recommendation button. Main click still selects/scrolls to the relevant map area; recommendation applies an immediate standing-order adjustment.
- Recommendation routing uses the same existing domain commands as manual controls:
  - enemy wave -> `aggressive_screen`
  - enemy command net -> `aggressive_screen` plus officer target priority
  - line integrity, morale danger, or severe segment pressure -> `fallback_guard`
  - moderate segment pressure or formation crowding -> `elastic_defense`
  - ammunition danger -> conserve ammo plus rest/resupply immediate order
  - damaged structures -> facility assignment plus engineer support or hold-line defense
- Alert recommendations choose an appropriate unit: explicit unit alerts use that unit, segment alerts choose the weakest assigned brigade, and structure alerts choose assigned defenders or the nearest engineer candidate.
- Battle log now records the actual applied command label, avoiding stale alert-label confusion when severity escalates while the battle is running.
- Desktop QA verified enemy-wave alert `阻止射撃へ` changes the selected brigade to `阻止射撃`, target priority `大型敵`, ammo policy `集中射撃`, and logs `警報対応: 第4戦列歩兵大隊へ阻止射撃を適用。`; broken images 0, console errors 0, page overflow 0.
- Mobile 390px QA verified alert cards/action buttons remain readable, action buttons are about 73px x 34px, panel stacks vertically, broken images 0, console errors 0, and page overflow 0.

## Implemented Group Alert Response Slice - 2026-07-03

The latest command slice makes alert response useful at brigade scale, not only selected-unit scale.

Implemented:

- Alert cards can now show a secondary group-response button when the alert resolves to multiple units.
- `戦線突破危険` resolves to all non-retreating player brigades and exposes labels such as `全線6旅団`.
- Segment pressure alerts can resolve all brigades assigned to that `frontlineSegment` when more than one brigade is present.
- Structure alerts can resolve assigned defenders plus the nearest engineer candidate when multiple units are involved.
- Group response still uses existing domain commands instead of a separate shortcut path:
  - all-line collapse -> `fallback_guard` for all involved brigades
  - segment warning -> `elastic_defense`
  - segment danger -> `fallback_guard`
  - structure damage -> assign facility and use engineer support/hold-line as appropriate
- Desktop QA verified `戦線突破危険` exposes `全線6旅団`; clicking it applies `後退守備` to all 6 unit cards and logs `警報一括対応: 6部隊へ全線後退守備を適用。`; broken images 0, console errors 0, page overflow 0.
- Mobile 390px QA verified `全線6旅団` button remains readable at about 70px x 34px, all 6 unit cards stay in `後退守備`, broken images 0, console errors 0, and page overflow 0.

## Implemented Drag Order Handle Slice - 2026-07-03

The next command slice adds direct manipulation for selected-brigade autonomous order points.

Implemented:

- Battle Command now renders draggable `基準` and `後退` handles for the selected brigade on the wide tactical map.
- Dragging `基準` updates the selected brigade's StandingOrder anchor through `setStandingOrderAnchor`, preserving the existing domain path, segment reassignment, action reason, and battle log.
- Dragging `後退` updates the selected brigade's fallback destination through `setStandingOrderFallbackDestination`, enabling fallback if needed.
- Existing click/tap command modes remain in place for mobile and coarse command use.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle, visible `基準`/`後退` handles, dragging `基準` moved the handle and logged `第4戦列歩兵大隊の基準位置をX39 Y29へ指定。`; broken images 0 and console errors 0.
- Mobile 390px QA verified the handles remain readable at 38px x 24px, the tactical map remains intentionally horizontally scrollable, 6 unit cards remain visible, broken images 0, console errors 0, and page overflow false.

## Implemented Autonomous Reason Detail Slice - 2026-07-03

The latest command slice makes autonomous brigade behavior explain itself more clearly.

Implemented:

- Battle Command now derives a detailed Japanese reason string from each brigade's `actionReason`, StandingOrder, current target, assigned facility, fallback thresholds, terrain, and line-of-sight state.
- The selected command summary shows `判断理由 ...` under the anchor/fallback/current-action summary.
- Each brigade command card shows a two-line reason detail below the short action label.
- Each player map token shows a compact reason badge so the wide map explains why units are holding, repairing, resupplying, falling back, or firing.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle, `判断理由` in the selected panel, 6 card-level reason details, 6 map-token reason badges, examples `保持判断: 森林左翼線 / 基準距離0 / 地形森林遮蔽帯` and `修理判断: 塹壕線 修理または損傷施設へ移動`, broken images 0, console errors 0, and page overflow false.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Enemy Intent Inspection Slice - 2026-07-03

The latest battle-readability slice gives the player a clear inspection surface for enemy assault groups.

Implemented:

- Clicking an enemy group outside `敵を指名` mode opens an enemy intent inspection panel instead of only scrolling the map.
- The panel shows the enemy group's display name, threat label, assault mode, target name, assault axis, frontage width, depth, cohesion, command state/influence, morale state/value, count, range, pressure, and current coordinates.
- Unspotted enemy groups can still be inspected, but show only limited hidden-contact information and concealment instead of full intent detail.
- The inspected enemy token receives a separate map highlight, distinct from the yellow focus-fire target highlight.
- The panel's `選択旅団の集中目標` button assigns the inspected spotted enemy to the selected brigade through the existing battle-only focus target command path.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x enemy wave, spotted enemy click opens the panel, the inspected map state appears, the focus-target button produces one focused enemy, broken images 0, console errors 0, and overflow outside the tactical map scroll 0.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Enemy Threat Response Slice - 2026-07-03

The latest command slice connects inspected enemy intent to responsible frontline response.

Implemented:

- The enemy inspection panel now infers a responsible frontline from the enemy assault plan's target segment, target structure, or projected assault axis.
- The panel lists `推定担当戦線`, `対応旅団`, and `推奨対応` so the player can see which line should react before issuing a command.
- Recommended response is derived from enemy type, assault mode, command state, morale state, and threat score:
  - officers and commanded groups bias toward `阻止射撃` plus `敵指揮`.
  - brutes and breachers bias toward `阻止射撃` plus `大型敵`.
  - rifle screens bias toward `敵銃兵`.
  - routed/regrouping groups bias toward line holding rather than overcommitting.
- `担当戦線で対応` applies the recommended standing-order preset, target priority, and battle-only focus target to the responsible brigade group.
- `担当戦線斉射` uses the responsible brigade as issuer and creates a battle-only `戦線斉射` FireMission against the inspected spotted enemy.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x enemy wave, enemy panel response fields, `担当戦線で対応` changing a responsible brigade to the recommended posture/priority/focus target, `担当戦線斉射` creating `戦線斉射アンデッド群集 / 3旅団 / 残り8秒 / 軍団斉射規律`, broken images 0, console errors 0, and overflow outside the tactical map scroll 0.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Frontline Pressure Strip Slice - 2026-07-03

The latest battlefield overview slice makes line pressure readable before an alert threshold is crossed.

Implemented:

- Battle Command now always renders five frontline pressure cards, one per `FrontlineSegment`.
- Each card shows pressure level, numeric enemy pressure, enemy group count, defender count, main threat, and recommended response.
- Pressure is derived from spotted enemy groups whose assault plan targets that segment or whose current position is close enough to the segment anchor/control radius.
- Pressure levels are `平常`, `接敵`, `圧迫`, and `危険`; `圧迫/危険` visually stand out while still preserving the existing alert-card system for threshold warnings.
- Clicking a pressure card inspects the lead enemy or scrolls to the segment when no enemy is present.
- The pressure-card response button applies the recommended StandingOrder preset to the segment's defenders and assigns the main spotted threat as focus target when available.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle, initial five `平常` cards, 3x enemy waves changing cards to `接敵/圧迫`, and a pressure-card action logging `戦線圧力対応: 中央塹壕線の1旅団を固守監視へ移行。`; broken images 0, console errors 0, and overflow outside tactical map/pressure strip 0.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Direct Frontline Command Slice - 2026-07-03

The latest command slice lets the player edit the battlefield line itself during Battle Command, not only individual brigade orders.

Implemented:

- Battle Command now keeps a selected frontline segment in addition to the selected brigade and selected enemy.
- Pressure-card inspection now syncs the selected frontline segment, the command panel, and the map segment highlight.
- A selected-frontline command panel shows pressure state, enemy pressure, defender count, anchor, fallback point, and control radius.
- `戦線前進` / `戦線後退` move the selected segment anchor and fallback point together.
- `幅拡大` / `幅圧縮` adjust the selected segment's control radius and zone width.
- The selected line renders draggable `戦線` and `後退線` handles on the wide tactical map.
- `src/game/battle/orders.ts` now exposes Battle-time segment edit commands that update the runtime `FrontlineSegment` and assigned brigade StandingOrders together, so the tick reacts through normal autonomous movement rather than a UI-only overlay.
- Desktop 1440px QA verified Strategic Map -> Camp -> Deployment -> Battle, five pressure cards, selected-frontline panel, two line handles, central pressure-card selection syncing to `中央塹壕線`, line forward/width edits, assigned brigade `基準位置へ復帰` reaction, broken images 0, console errors 0, and overflow candidates 0.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Enemy Breakthrough Pressure Slice - 2026-07-03

Direct line editing needs an enemy model that cares about the line, not only nearest-unit contact.

Implemented:

- Each enemy assault group now carries a runtime assault phase:
  - `接近`: moving toward its planned segment or facility.
  - `交戦`: close enough to the assigned line to pin defenders.
  - `側面圧`: offset outside the segment's main control radius while still threatening it.
  - `突破`: past the segment anchor/fallback relation and damaging line integrity heavily.
  - `突出`: deep but low-cohesion or wavering, creating a counterattack opportunity.
- Breakthrough and flank pressure now affect:
  - `lineIntegrity`
  - alert cards
  - pressure summaries
  - enemy map labels and inspection panel
- This is Battle runtime state only. It should not be written into campaign saves because it depends on current positions and current line geometry.
- Desktop 1440px QA verified Strategic Map -> Camp -> Deployment -> Battle, 3x enemy waves producing phase counts `approach 9 / engaged 2 / flanking 1`, visible `側面圧` labels with `深0 側153`, frontline pressure escalation, `戦線維持 64%`, broken images 0, console errors 0, and page overflow 0. QA report: `outputs/takawasi-enemy-breakthrough-pressure-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Reserve And Counterstroke Response Slice - 2026-07-03

Enemy flanking/breakthrough pressure must become a player decision, not only a warning.

Implemented:

- `側面圧`: the threatened line calls a reserve or adjacent brigade into the segment, keeps current defenders in elastic defense, and focuses the lead flanking group.
- `突破`: the threatened line seals the breach by putting current defenders into fallback guard while pulling reserve/nearby brigades toward the segment anchor/fallback corridor.
- `突出`: a low-cohesion deep enemy invites a local counterstroke by putting eligible defenders into aggressive screen, focusing the overextended group, and starting a line volley when possible.
- This response layer is Battle-runtime only for now. It is a command affordance over existing StandingOrders, not a new permanent doctrine tree.
- Battle Command pressure cards show reserve counts and response labels such as `予備投入`, `突破封鎖`, and `局地反撃`; relevant alert-card group actions route to the same response logic.
- Desktop 1440px QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x enemy waves. `予備投入` appeared for a flanking pressure card and reassigned `衛戍予備歩兵大隊` to `森林左翼線` with elastic defense, fallback point, and focus target. `突破封鎖` appeared for a pressured line and moved nearby/reserve units into fallback guard with fallback points and focus target. Broken images 0, console errors 0, and page overflow 0. QA report: `outputs/takawasi-reserve-counterstroke-response-qa-report.json`.
- Follow-up desktop 1440px QA verified `突出` and `局地反撃`: a wavering `群集21` was marked `突出`, the `右翼泥濘線` pressure card showed `局地反撃`, and clicking it applied `阻止射撃`, `集中射撃`, focus target, and `戦線斉射 9秒` to eligible defenders. QA report: `outputs/takawasi-local-counterstroke-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Reserve Readiness Slice - 2026-07-03

Reserve and fire-support units now have a battle-runtime readiness value instead of being treated as merely nearby spare brigades.

Implemented:

- `BattleUnit.reserveReadiness` is initialized from battle role: reserve-line and fire-support units start higher, fallback guards start partially ready, ordinary line troops start low.
- The battle tick raises readiness when a unit is alive, stationary, not firing, not moving, and has acceptable morale/condition/ammo.
- Readiness falls when a unit is retreating, moving, firing, under close threat, in FireMission, or otherwise being spent.
- Frontline pressure cards show reserve count plus total readiness and ready reserve count, for example `予備 1 / 即応 58(1)`.
- Pressure-card reserve selection now prefers units with higher readiness in addition to distance and reserve-line/fire-support role.
- Readiness can create earlier counterstroke recommendations when a spotted engaged/flanking enemy is wavering, disrupted, or low cohesion; this makes prepared reserves tactically valuable before a clean breakthrough/collapse.
- Applying reserve commitment or local counterstroke consumes readiness from committed units, so repeated emergency responses have an opportunity cost.
- Selected brigade panels and brigade cards show `予備即応`, making the command layer explainable instead of hidden.
- Desktop 1440px QA verified Strategic Map -> Camp -> Deployment -> Battle, initial pressure cards with `即応 58(1)`, selected/unit-card `予備即応`, 3x battle ticks consuming readiness during contact, visible `局地反撃`, `予備投入` applying line response, and exact `局地反撃` click applying `阻止射撃`, `集中射撃`, focus target, and `戦線斉射 9秒`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-reserve-readiness-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Deployment Reserve Doctrine Slice - 2026-07-03

Reserve readiness is now a pre-battle planning choice, not only an emergent battle value.

Implemented:

- `DeploymentBattlePlan.reserveDoctrine` stores the current reserve doctrine alongside frontline geometry.
- Deployment shows a `予備運用` panel with four modes:
  - `標準予備`: balanced reserve commitment and counterstroke behavior.
  - `反撃準備`: higher initial reserve readiness, faster readiness gain, and lower counterstroke threshold.
  - `弾性予備`: lower hold pressure and earlier reserve commitment to threatened lines.
  - `火力予備`: stronger artillery/fire-support readiness and later counterstroke threshold.
- BattleState carries the selected reserve doctrine as battle-runtime state; it is not a permanent campaign doctrine tree yet.
- `createBattleState` uses the selected doctrine to initialize reserve readiness and logs the doctrine summary at battle start.
- `resolveTick` uses the doctrine to modify readiness gain/spend.
- Battle Command displays the current reserve doctrine beside fire discipline and uses its counterstroke threshold when recommending pressure-card responses.
- Desktop 1440px QA verified Deployment selection `反撃準備`, ledger/panel display `温存圧 760 / 反撃閾値 46`, Battle HUD display of the same doctrine, battle log inclusion, initial pressure cards with raised readiness such as `即応 74(1)`, and 3x tick pressure cards still showing readiness/actions without console errors, broken images, or page overflow. QA report: `outputs/takawasi-reserve-doctrine-deployment-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Deployment Reserve Slot Slice - 2026-07-03

Reserve doctrine now has a concrete pre-battle unit selection surface.

Implemented:

- `DeploymentBattlePlan.reserveUnitIds` stores selected main-battle brigades that should start as designated reserves.
- Deployment separates unselected roster reserves from `指定予備`: a designated reserve is still deployed into the mandatory battle, but begins on the reserve line.
- The Deployment ledger and reserve doctrine panel show `指定予備 X/Y`.
- Selected deployment slots show `指定予備`, and the planner action toggles a selected brigade between `指定予備にする` and `主線運用へ戻す`.
- `createBattleState` moves designated reserve brigades to the reserve segment, sets reserve-style posture/target priority/ammo policy/fallback, and removes frontline facility assignment unless a supply depot can be used for resupply.
- The battle log records the number of designated reserve brigades at deployment.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> `反撃準備` -> designate `第1戦列歩兵大隊` -> Battle -> 3x tick. Deployment showed `指定予備 1/3`, Battle showed `指定予備: 1旅団を予備線で待機。`, the selected brigade started on `後方砲兵線` with `後退守備`, `弾薬節約`, `施設 未指定`, and `予備即応 62`, then ticked to `防衛時間 13/150秒` with console errors 0, broken images 0, and page overflow false. QA report: `outputs/takawasi-deployment-reserve-slots-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Reserve Command Panel Slice - 2026-07-03

Reserve units can now be managed during Battle Command, not only consumed by pressure-card responses.

Implemented:

- Battle Command renders a `予備指揮` panel below fire discipline and above frontline pressure cards.
- The panel lists reserve candidates:
  - reserve-line brigades
  - fire-support brigades
  - fallback-guard brigades
  - artillery
  - high-readiness units
- Each reserve card shows unit name, type, current line, posture, reserve readiness, and ammo policy.
- Card actions:
  - `予備線へ`: returns the brigade to the reserve segment as fallback guard, clears focus target, conserves ammo, sets reserve fallback, and rebuilds readiness floor.
  - `火力予備`: returns the brigade to the reserve segment as fire support reserve with largest-mass target priority and readiness floor.
- `src/game/battle/orders.ts` exposes `returnUnitToReserveLine` so this is a reusable battle command rather than UI-only state mutation.
- Supply-depot resupply assignment is attached only when a supply depot exists; otherwise the returning reserve stays facility-unassigned.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> `反撃準備` -> designate `第1戦列歩兵大隊` -> Battle. Initial reserve panel showed `第3砲兵` and `第1歩兵`; `火力予備` changed the infantry reserve to `火力支援 / 最大集団 / 弾薬節約 / 即応64`; `予備線へ` changed it back to `後退守備 / 敵指揮 / 弾薬節約 / 施設未指定 / 即応100`; 3x tick reached `防衛時間 10/150秒`, console errors 0, broken images 0, and page overflow false. QA report: `outputs/takawasi-reserve-command-panel-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented After Action Role History Slice - 2026-07-03

Battle jobs now carry into the army-growth layer instead of disappearing when the tactical battle ends.

Implemented:

- `BattleResult` stores `battleRoleByUnit` and `commendationsByUnit`.
- Result generation derives roles from final unit type, posture, line, facility duty, and readiness: `予備保持`, `火力支援`, `工兵支援`, `阻止反撃`, `弾性防御`, and `戦線固守`.
- Role-aware XP bonuses reward prepared reserves, sustained fire support, engineer facility duty, active screening/counterstroke, and line-holding under pressure.
- Commendations record readable tactical accomplishments such as `即応予備を維持`, `支援火力を継続`, `陣地勤務を遂行`, `敵集団へ集中対応`, `損耗下で戦線維持`, and `弾薬限界まで交戦`.
- After Action displays each brigade's role and commendations beside casualty, recovery, XP, and equipment-wear results.
- Campaign application writes the role and commendations into each unit's `battleHistory`, so the long-term unit attachment loop can distinguish a held reserve from a spent line brigade.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> `反撃準備` -> designate `第1戦列歩兵大隊` -> Battle -> 3x tick -> withdraw -> After Action -> apply result. After Action showed rows including `任務 予備保持 / 即応予備を維持`, `任務 火力支援`, and `任務 工兵支援 / 陣地勤務を遂行`; Camp unit history retained `戦闘撤退、予備保持、永久損耗0、収容0、経験+2、装備摩耗-0.01、即応予備を維持`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-after-action-role-history-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Officer Battle Results Slice - 2026-07-03

Main-battle officers now receive battle-result carryover instead of only side-operation auto-resolve history.

Implemented:

- `BattleResult` stores `officerXpById`, `woundedOfficerIds`, `officerRiskById`, and `officerUnitNamesById`.
- Officer risk is deterministic and reproducible. It is derived from outcome, casualty ratio, close-action posture, retreat/collapse pressure, low morale/ammo, and unit destruction.
- Officer XP is role-aware. Fire support, engineer support, screening/counterstroke, elastic defense, kept-ready reserves, and battle commendations can raise command experience.
- After Action shows a `将校戦果` block with each commander's brigade role, command XP, risk, and wound state.
- `applyBattleResult` writes officer XP/risk/wound history into campaign officer state after ordinary wound recovery is processed, so newly wounded officers retain their recovery timer.
- The Officers tab shows assigned brigade and latest command history, making officer attachment visible in the camp loop.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x tick -> withdraw -> After Action -> apply result -> Officers. After Action showed lines such as `第1戦列歩兵大隊指揮官: 戦線固守、指揮経験+2、危険度17、負傷なし`, `第4戦列歩兵大隊指揮官: 弾性防御、指揮経験+4、危険度21、負傷なし`, and `第2工兵中隊指揮官: 工兵支援、指揮経験+4、危険度17、負傷なし`. Officers tab retained histories such as `東方辺境防衛線防衛戦: 第1戦列歩兵大隊指揮、経験+2、危険度17`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-officer-battle-results-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Officer Command UI Slice - 2026-07-03

Officer growth can now be acted on in camp instead of only accumulating as history text.

Implemented:

- `src/game/officers/progression.ts` owns promotion thresholds, next-rank calculation, Japanese promotion history, and brigade reassignment/swap logic.
- Officers tab shows `次部隊へ配属` and rank-promotion actions for each officer.
- Promotion consumes the rank threshold from officer experience and updates rank/history.
- Reassignment updates both `Officer.assignedUnitId` and the target `ArmyUnit.officerId`, swapping the displaced officer back to the previous post when needed.
- Unit battle history records incoming commander changes, so Army tab and Officers tab stay consistent.
- Desktop 1440px Playwright QA verified reset -> Camp -> Officers, initial promotion actions enabled for `フォス: 大佐へ昇進`, `ケラー: 少佐へ昇進`, and `アルンハイム: 将軍へ昇進`; `フォス` reassignment moved him from `第1戦列歩兵大隊` to `第4戦列歩兵大隊` and swapped `クルーガー` to `第1戦列歩兵大隊`; `アルンハイム` promoted from `大佐` to `将軍`, consumed experience `46 -> 0`, and recorded `将軍へ昇進`; Army tab reflected the swapped commander. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-officer-command-ui-qa-report.json`.
- In-app browser connection timed out during this pass, so the final desktop flow was verified with local Playwright against the same dev server.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Officer Trait Effects Slice - 2026-07-03

Officer promotion and assignment now influence the next mandatory battle, instead of stopping at roster text.

Implemented:

- `src/game/officers/effects.ts` derives `OfficerCommandProfile` from rank, traits, and unit type.
- Rank effects provide baseline command bonuses such as morale, condition, ammo, control radius, and reserve readiness.
- Trait effects are branch-sensitive: discipline delays fallback, skirmisher traits improve jaeger range/fire-rate, artillery traits improve firepower/range, engineer traits improve condition/control, and reserve traits raise reserve readiness.
- `src/game/battle/createBattleState.ts` applies the profile at battle creation to BattleUnit morale, condition, ammo, range, firepower, fire-rate, StandingOrder control radius, fallback morale threshold, and reserve readiness.
- Army Camp previews the selected unit's `指揮効果`; Battle Command displays the applied `指揮` and `指揮効果` lines on unit cards.
- Desktop 1440px Playwright QA verified reset -> Camp -> Officers promotion action -> Deployment -> Battle. Army Camp showed `指揮効果 階級指揮 士気+2 即応+4 / 規律: 士気+3 後退遅延`, and Battle Command showed `指揮 フォス` with the same command-effect summary. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-officer-trait-effects-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Officer Command Capacity Slice - 2026-07-03

Large brigades now create a command-capacity problem, making officer rank and matching traits matter more as the army scales.

Implemented:

- `OfficerCommandProfile` now stores `commandCapacity`, `commandLoad`, and `commandOverload`.
- Rank sets baseline capacity: captains can manage small formations, while majors, colonels, and generals scale upward.
- Unit-fitting traits increase capacity along with their normal effects, so artillery, skirmisher, trench, engineer, discipline, and reserve specialists are easier to attach to the right brigade type.
- When brigade soldiers exceed command capacity, battle creation applies deterministic overload penalties to morale, condition, control radius, reserve readiness, and fallback morale threshold.
- Army Camp and Battle Command show capacity inside the existing `指揮効果` summary, keeping the UI dense rather than adding another large panel.
- Desktop 1440px Playwright QA verified reset -> Camp -> Deployment -> Battle. Army Camp showed `指揮容量 760/810`, and Battle Command showed both normal and overloaded examples such as `指揮容量 640/530 / 塹壕: 統制+2 容量+110 後退遅延 / 指揮過負荷 110 士気-2`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-officer-command-capacity-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Deployment Command Warning Slice - 2026-07-03

Deployment now exposes command-capacity problems before the player commits to the mandatory battle.

Implemented:

- Deployment reuses `OfficerCommandProfile`, so the pre-battle warning uses the same calculation as battle creation.
- The briefing ledger summarizes whether the selected force is within capacity or has overloaded brigades.
- Each selected deployment slot shows its own command load/capacity.
- The planner shows a `指揮過負荷警告` block when any selected brigade exceeds capacity, including the affected unit names and overload amounts.
- The warning is advisory rather than a hard gate. The player can still start battle, but now sees the cost before committing.
- Desktop 1440px Playwright QA verified reset -> Camp -> Deployment -> Battle. Deployment showed `指揮容量 / 過負荷 1旅団 / 最大110`, six slot-level capacity rows, and warning text `第6塹壕歩兵大隊: 640/530 過負荷110`; Battle Command still showed applied `指揮容量`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-deployment-command-capacity-warning-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Deployment Officer Fix Route Slice - 2026-07-03

Pre-battle command overload now has an immediate correction route instead of only a warning.

Implemented:

- The Deployment overload warning includes a `将校調整へ` action.
- `App.tsx` routes that action directly to the Camp Officers tab.
- The player can promote or reassign officers, then use the existing camp tabs to return to Deployment.
- This connects problem detection, officer management, and renewed deployment planning into one loop.
- Desktop 1440px Playwright QA verified reset -> Camp -> Deployment -> `将校調整へ` -> Officers -> Deployment. The active tab became `将校`, promotion/reassignment actions were visible, and returning to Deployment preserved the command-capacity warning path. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-deployment-officer-fix-route-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Officer Overload Recommendation Slice - 2026-07-03

The Officers tab can now suggest a concrete commander swap to reduce pre-battle command overload.

Implemented:

- Officers tab computes the current total command overload across the army.
- For each overloaded brigade, it evaluates active officer candidates by simulating the assignment swap.
- The scorer uses total post-swap overload, so it avoids recommendations that merely move the problem to another brigade.
- Recommended rows show the target brigade, current overload, recommended officer, predicted total overload change, and candidate capacity.
- `推奨配属` applies the same `assignOfficerToUnit` path as manual reassignment, preserving officer/unit history.
- Desktop 1440px Playwright QA verified reset -> Camp -> Deployment -> `将校調整へ` -> Officers -> `推奨配属` -> Deployment. The recommendation `アルンハイム 大佐 / 予測 110 -> 0 / 容量 980` applied successfully, and Deployment changed to `全旅団 指揮容量内`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-officer-overload-recommendation-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Corps Headquarters Staff Slice - 2026-07-03

Army organization now has a headquarters layer between officer management and deployment.

Implemented:

- `ArmyState` formations can now carry Formation-backed divisions and corps staff assignments.
- `src/game/army/headquarters.ts` owns staff-slot definitions, normalization, staff assignment updates, and derived headquarters effects.
- Army Camp shows `参謀長`, `兵站主任`, `工兵主任`, and `砲兵主任` slots with officer selectors, preferred traits, and a compact headquarters effect summary.
- Headquarters profile currently adds deployment slots, army-wide command-capacity support, reserve-readiness support, and a repair-support field reserved for deeper engineering integration.
- Deployment uses the headquarters deployment-slot bonus and displays the headquarters deployment/reserve contribution in the briefing ledger.
- Officer command-capacity profiles accept headquarters capacity support, so Army Camp, Deployment warnings, and Battle creation use the same command-capacity baseline.
- Battle creation applies headquarters reserve-readiness support to initial BattleUnit readiness, making staff appointments matter for reserve/counterstroke play.
- `migrateSave` backfills divisions, staff assignments, and officer command fatigue for existing save v4/v5 campaigns without resetting the campaign.
- `npm run build` passed after implementation.
- Desktop 1440px browser QA verified existing save migration with empty staff slots, reset new campaign with initial staff assignments, staff selector changes, Army effect `出撃枠+1 / 指揮容量+233 / 予備即応+23`, Deployment `7/7` and `軍団司令部 出撃+1 / 予備+23`, Battle command summaries with `司令部 容量+233`, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-corps-headquarters-staff-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Staff Duty Burden Slice - 2026-07-03

Corps staff now creates a command tradeoff instead of being a free parallel buff.

Implemented:

- `normalizeStaffAssignments` now clears duplicate staff assignment during normalization, preserving one staff role per officer.
- Assigning an officer to a staff slot clears that officer from any other staff slot.
- Each staff role has a `staffDutyLoad`: `参謀長 120`, `兵站主任 80`, `工兵主任 70`, and `砲兵主任 70`.
- `staffDutyLoadByOfficer` and `staffDutySummaryForOfficer` expose per-officer burden for Army Camp, Officers, Deployment, and battle creation.
- `OfficerCommandProfile` now subtracts staff-duty load after headquarters support, and includes a Japanese summary line such as `参謀兼任 負荷-120`.
- Army Camp shows staff-duty load on staff rows and shows selected unit commander staff-duty burden in the unit inspector.
- Officers tab shows staff-duty burden beside the officer's brigade assignment.
- Deployment command-capacity rows and warnings use the same staff-duty burden calculation.
- Battle creation applies staff-duty burden to BattleUnit command profiles, so the Battle Command unit cards match Deployment.
- Desktop 1440px browser QA verified reset -> Army Camp, duplicate assignment of `ヴェーバー` to `参謀長` clears `兵站主任`, duplicate Weber staff slots = 1, Army effect changes to `出撃枠+1 / 指揮容量+189 / 予備即応+15`, Weber's brigade shows `参謀兼任 参謀長 / 負荷120` and `指揮容量 580/949 / 司令部 容量+189 / 参謀兼任 負荷-120`, Officers tab shows staff burden, Deployment shows `軍団司令部 出撃+1 / 予備+15`, Battle cards show Weber and Metz staff-duty burdens, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-staff-duty-burden-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Division Command Slice - 2026-07-03

Division rows now create a tactical command layer above individual brigade officers.

Implemented:

- `ArmyDivision` can carry `commanderOfficerId` and `directive`.
- `src/game/army/divisions.ts` owns division normalization, commander assignment, directive assignment, derived division command profile, and directive-to-StandingOrder conversion.
- Active division rows in Army Camp expose `師団長` and `師団命令` controls.
- Initial directives are `第1師団: 戦線固守` and `第2師団: 予備守備`.
- Directives currently include `戦線固守`, `弾性防御`, `火力支援`, `予備守備`, and `工兵支援`.
- Deployment displays the division command summary on each deployable brigade slot.
- Battle creation applies division directive effects before officer/headquarters modifiers: posture, target priority, ammo policy, fallback threshold, control radius, morale bonus, and reserve readiness.
- Battle Command selected-unit panels show the applied division command summary beside officer command effects.
- Desktop 1440px browser QA verified reset -> Army Camp -> change 第1師団 to `弾性防御` -> Deployment -> Battle. Deployment rows showed `第1師団 弾性防御`; Battle cards showed 第1師団 units with `待機姿勢 弾性防御` and `目標 最大集団`; 第2師団 reserve showed `後退守備`, `敵指揮`, and `弾薬節約`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-division-command-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is no longer a current gate.

## Implemented Division Duty Burden Slice - 2026-07-03

Division commander assignment now has a command tradeoff like corps staff duty.

Implemented:

- `normalizeArmyDivisions` distinguishes explicit unassigned commanders from old saves missing the field, so clearing a commander does not silently restore the fallback commander.
- Assigning one officer as a division commander clears that officer from any other active division commander slot.
- Each active division commander role currently adds `師団長負荷 140`.
- `src/game/army/commandDuty.ts` combines corps staff-duty and division-command-duty load into one per-officer command-duty profile.
- `OfficerCommandProfile` accepts the combined load and a Japanese duty summary, then subtracts that load from command capacity.
- Army Camp shows division commander load labels and selected-unit `師団長兼任` burden.
- Officers tab shows staff burden and division-command burden separately.
- Deployment command-capacity preview uses the combined staff/division duty load.
- Battle creation uses the same combined duty load, so Battle Command cards match Deployment capacity.
- Desktop 1440px browser QA verified reset -> Army Camp -> assign `フォス` from 第1師団 to 第2師団 -> Officers -> Deployment -> Battle. 第1師団 commander cleared, duplicate フォス division commander count was 1, Officers showed `師団長兼任: 第2師団 / 負荷140`, Deployment showed フォス brigade `初期指揮容量 760/913`, and Battle summaries included `兼任負荷-140 (師団長兼任 第2師団 負荷140)`. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-division-duty-burden-qa-report.json`.
- Mobile-specific QA was intentionally skipped because mobile is not a current target.

## Implemented Division Commander After Action Slice - 2026-07-03

Division commanders now participate in the battle growth loop instead of only modifying initial orders.

Implemented:

- `BattleUnit` carries the active division commander officer id and name at battle creation.
- `BattleResult` carries division commander events, XP, risk, and division names separately from brigade-command officer results.
- `createBattleResult` aggregates each division commander's subordinate brigade count, role variety, reserve readiness, pressure, and battle outcome into division-command XP and risk.
- After Action shows a `師団指揮` subsection below brigade officer results.
- Applying battle results adds division-command XP to the same officer experience total used for promotion.
- Officer histories receive a separate line such as `第1師団師団指揮、経験+6、危険度12`.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> withdraw -> After Action -> apply result -> Officers. After Action showed 第1師団 and 第2師団 commander events, and Officers retained the division-command history lines. Broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-division-commander-after-action-qa-report.json`.
- Division-command political backlash events remain deferred.

## Implemented Division Command Wound Slice - 2026-07-03

Division-command risk now has a campaign consequence instead of staying only as display text.

Implemented:

- `BattleResult` carries `divisionCommanderWoundedOfficerIds` separately from brigade-command `woundedOfficerIds`.
- `createBattleResult` appends `指揮所負傷` to the division commander event when collapse/withdraw/hold thresholds are crossed by risk, casualty pressure, and low-state subordinate brigades.
- After Action counts brigade wounds and division-command wounds as one officer set, so an officer holding both roles is not double-counted.
- `applyBattleResult` marks division-wounded officers as wounded, sets recovery turns, and writes `指揮所負傷` into the division-command officer history line.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 3x tick -> withdraw -> After Action -> apply result -> Officers. The short smoke path correctly stayed below the wound threshold, showed no accidental `指揮所負傷`, retained `第1師団師団指揮、経験+6` and `第2師団師団指揮、経験+3` in Officers, and had broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-division-command-wound-qa-report.json`.

## Implemented Command Fatigue Slice - 2026-07-03

Staff and division command burden now persists as a readiness problem instead of only reducing one battle's command capacity.

Implemented:

- `Officer.commandFatigue` is a persistent campaign stat, introduced by save v5 normalization and still normalized under the current save path.
- Initial officers start at `指揮疲労 0`; Army Camp and Officers show the current value.
- `recoverOfficers` reduces command fatigue each recovery pass.
- `applyBattleResult` adds command fatigue from brigade command, division command, battle outcome pressure, officer risk, division risk, and staff/division duty load.
- `officerCommandProfile` applies fatigue penalties to morale, condition, control radius, reserve readiness, and fallback timing at the next battle creation.
- Officers now show multiple recent history lines, so `指揮疲労+...` does not hide division-command history such as `第1師団師団指揮、経験+6`.
- Desktop 1440px browser QA for the original slice verified reset -> Camp -> Deployment -> Battle -> 3x tick -> withdraw -> After Action -> apply result -> Officers -> Army. Observed save v5 at the time, initial fatigue 0, post-battle fatigue values including フォス15 and ヴェーバー15, visible fatigue and division-command history, Army selected commander fatigue display, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-command-fatigue-qa-report.json`.

## Implemented Officer Rest Rotation Slice - 2026-07-03

Command fatigue now has a player-facing recovery loop instead of only being a passive penalty.

Implemented:

- `OfficerStatus` now includes `resting` alongside `active`, `wounded`, and `dead`.
- Officers tab can send fatigued active officers into rest and manually return resting officers to duty.
- Resting clears side-operation assignment, records `指揮疲労回復のため休養入り`, and return records `休養を切り上げ任務復帰`.
- `recoverOfficers` reduces command fatigue faster for resting officers and automatically returns them to active duty at fatigue 0.
- Resting officers are inactive for battle/staff/division command effects and do not gain passive staff/division duty fatigue while resting.
- Officers tab shows rest recommendations for clearly fatigued active officers, while per-officer command buttons expose rest/return controls.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 3x tick -> withdraw -> After Action -> apply result -> Officers -> rest fatigued officer -> Deployment -> Camp -> Officers -> return officer. Observed post-battle fatigue values, rest and return buttons, `休養中` status, resting officer excluded from active Deployment command text, return history `休養を切り上げ任務復帰`, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-officer-rest-rotation-qa-report.json`.

## Implemented Staff/Division Political Cost Slice - 2026-07-03

Corps staff and division command changes now have a political opportunity cost instead of being free reshuffles.

Implemented:

- `src/game/army/politicalCost.ts` estimates 威信 cost for corps staff and division commander changes.
- Staff assignment cost increases for chief-of-staff roles, replacing occupied slots, moving officers already in staff work, line command, or division command.
- Division commander cost increases for replacing an existing commander, transferring a current division commander, and using officers already holding line command or staff duty.
- No-op assignment changes cost 0, and unaffordable changes are rejected with a Japanese feedback message.
- Army Camp shows current `政治余力` and candidate-specific 威信 costs inside staff/division commander select options.
- The existing resource label remains `威信`; the UI avoids mixing it with a separate `名声` label.
- Desktop 1440px browser QA verified reload -> reset campaign -> Army Camp -> assign `ケラー` as `参謀長` -> assign `アルンハイム` as `第1師団` commander. Observed initial 威信 52, final 威信 42, visible cost labels, final message `アルンハイムを第1師団師団長へ任命。威信-5。`, changed staff/division state, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-political-cost-qa-report.json`.

## Implemented Staff/Division Replacement Recommendation Slice - 2026-07-03

Political cost is now paired with a recommendation surface so reshuffling command staff is a legible tradeoff.

Implemented:

- `recommendStaffAssignments` scores projected headquarters value against 威信 cost.
- `recommendDivisionCommanderAssignments` scores projected division morale/control/readiness value against 威信 cost.
- Army Camp shows `参謀部推奨` cards with reason, improvement, cost, projected summary, and apply buttons.
- Recommendation buttons call the same staff/division assignment handlers as manual select changes, preserving centralized political-cost payment and duplicate-slot cleanup.
- Desktop 1440px browser QA verified reload -> reset campaign -> Army Camp, initial `推奨師団長` buttons, manual degradation by assigning `ケラー` as `参謀長`, recommendation cards such as `参謀長をアルンハイムへ変更 改善+27 / 威信-5`, applying the first recommendation, 威信 47 -> 42, first staff slot returning to `大佐 アルンハイム / 威信0`, projected summary visible, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-staff-division-recommendation-qa-report.json`.

## Implemented Contextual Command Recommendation Slice - 2026-07-03

Army Camp recommendations now read current mandatory battle context instead of only generic command value.

Implemented:

- `CommandRecommendationContext` carries sector name, terrain tags, enemy pressure, risk, and structure count.
- Staff recommendation scoring adds battlefield value for chief-of-staff, quartermaster, engineer chief, and artillery chief based on risk, pressure, terrain, and existing structures.
- Division commander scoring changes morale/control/reserve-readiness weights based on terrain and risk, and adds directive-context bonuses.
- Army Camp passes the current mandatory battle sector context into staff/division recommendation scoring.
- Recommendation cards display `戦場補正` such as `東方辺境防衛線 / 塹壕 / 敵圧42 / 危険78%`.
- Risk is formatted as an integer percent instead of a raw floating point value.
- Desktop 1440px browser QA verified reload -> reset campaign -> Army Camp. Observed context-aware division commander recommendations such as `アルンハイム 改善+47 / 威信-6`, degraded staff recommendations after assigning `ケラー` as `参謀長`, formatted risk label `危険78%`, no raw floating value, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-contextual-command-recommendation-qa-report.json`.

## Implemented Enemy Composition Command Recommendation Slice - 2026-07-03

Army Camp recommendations now consider likely enemy composition, not only abstract pressure and terrain.

Implemented:

- `EnemyCompositionThreat` models inferred undead mob, riflemen, brute, and officer threats for command-recommendation scoring.
- `forecastEnemyCompositionThreats` derives a first-pass forecast from mandatory battle risk, sector enemy pressure, terrain tags, and structure count.
- `CommandRecommendationContext` carries the inferred threats and `戦場補正` displays `主敵`.
- Staff recommendation scoring now values roles differently by threat: artillery and line control against mobs, engineering/reserve against brutes, logistics and scouts against riflemen, and command/control against undead officers.
- Division commander scoring now changes morale/control/reserve-readiness weight by enemy composition and adds officer-trait fit against the inferred threat mix.
- Desktop 1440px browser QA verified Strategic Map -> Camp. Observed `戦場補正: 東方辺境防衛線 / 塹壕 / 敵圧42 / 危険78% / 主敵群集+銃兵+突破体`, recommendations such as `工兵主任をシュタインへ変更 改善+72 / 威信-4` and `第2師団師団長をアルンハイムへ変更 改善+101 / 威信-6`, applying the first recommendation with 威信 52 -> 48, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-enemy-composition-command-recommendation-qa-report.json`.

## Implemented Enemy Intel Briefing Slice - 2026-07-03

The enemy composition forecast is now visible before Army Camp decisions and before Deployment, not only inside command recommendations.

Implemented:

- `src/game/theater/enemyIntel.ts` owns the shared enemy composition forecast and intel-confidence labels.
- Army command recommendations now import the shared forecast instead of keeping the logic inside `politicalCost.ts`.
- Theater main-battle briefing shows `敵編成` with inferred enemy mix and confidence, such as `群集+銃兵+突破体 / 敵情信頼中`.
- Theater side-operation cards show per-operation enemy briefings, so support missions also have a visible enemy-read.
- Deployment briefing ledger shows `敵編成` before the player starts battle, next to terrain, enemy pressure, frontage type, and spoils forecast.
- The confidence text reads existing operation spoils intel confidence/recon-effect state, so future recon updates and misinformation states can use the same display path.
- Desktop 1440px browser QA verified Strategic Map main briefing, side-operation cards, and Deployment briefing. Observed `敵編成 群集+銃兵+突破体 / 敵情信頼中`, side-operation variants with `敵情信頼低/高`, spoils/recovery briefing still visible, broken images 0, console errors 0, and page overflow false. QA report: `outputs/takawasi-enemy-intel-briefing-qa-report.json`.

## Implemented Persisted Enemy Intel Slice - 2026-07-03

Enemy composition is no longer display-only inference. Strategic operations now carry their own enemy-composition intel object, so recon and save migration can change the same operation facts that Theater, Deployment, and Army recommendations read.

Implemented:

- `StrategicOperation.enemyCompositionIntel` stores summary, confidence, mob/riflemen/brute/officer threats, per-type uncertainty ranges, recon quality, recon effect, and revision source.
- `generateStrategicTurn` creates enemy-composition intel for the mandatory battle and each side operation when the strategic turn is generated.
- `enemyIntel.ts` normalizes old/missing ranges, labels confidence/recon effect, and provides `enemyCompositionIntelForOperation` so screens use persisted operation intel before fallback forecasts.
- Recon auto-resolve now updates both spoils intel and enemy-composition intel on linked same-turn operations. Victory can produce `精密照合` or `偵察照合済み`; partial results can produce `部分照合`; failed recon can mark `誤情報疑い`.
- Save migration v6 backfills/normalizes enemy-composition intel on theater active operations, mandatory battles, and active strategic turn side operations.
- Theater and Deployment now show per-type ranges such as `群集2-4 / 銃兵2-4 / 突破体1-3`, and Army Camp command recommendations read the same persisted threats.
- Desktop 1440px Playwright QA verified Theater main briefing and Deployment display `敵編成 群集+銃兵+突破体 / 敵情信頼中 / 群集2-4 / 銃兵2-4 / 突破体1-3`; recon auto-resolve with `東方辺境猟兵隊` + `ケラー` changed linked operation enemy intel to `精密照合` and adjusted side-operation ranges such as `群集4-6`; localStorage `takawasi-game-save` showed envelope/campaign saveVersion 6, mandatoryBattle enemyCompositionIntel present, and 4 side operations with enemyCompositionIntel. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-persisted-enemy-intel-qa-report.json`.

## Implemented Enemy Wave Intel Slice - 2026-07-03

Persisted enemy-composition intel now changes tactical battle pressure, not only pre-battle text.

Implemented:

- `BattleScenario.waveIntel` stores first-wave second, spawn interval, command-wave start/chance, enemy-type pressure multipliers, and a compact Japanese summary.
- `src/game/battle/waveIntel.ts` derives that profile from the operation's persisted enemy-composition intel, terrain pressure, risk, and structure count.
- `src/game/battle/waves.ts` uses the profile for deterministic wave timing, mob/riflemen/brute counts, and command-wave officer spawning probability instead of a fixed 18-second/every-third-wave pattern.
- Deployment shows `戦術波` beside the enemy-composition briefing, and Battle Command shows the same profile as `波計画` in the HUD. Battle logs also record the wave forecast at battle creation.
- Desktop 1440px Playwright QA verified Deployment shows `戦術波 初波1秒 / 間隔12秒 / 指揮波82%` beside `敵編成 群集+銃兵+突破体 / 敵情信頼中 / 群集2-4 / 銃兵2-4 / 突破体1-3`; Battle HUD shows the same `波計画`; after 22 seconds at 3x the battle reached enemy wave 6 and displayed command signals. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-enemy-wave-intel-qa-report.json`.

## Implemented Enemy Wave Timeline UI Slice - 2026-07-03

Enemy-wave intelligence is now visible as a small pre-battle timeline, so deployment decisions can react to expected pressure timing instead of only a single summary line.

Implemented:

- `BattleWaveIntel.timeline` stores six predicted entries with wave number, second, likely enemy mix, command likelihood, pressure label, and compact summary.
- Deployment shows `敵波タイムライン` with six entries below the battle ledger.
- Battle Command shows the next four compact timeline markers near the battle HUD and marks passed waves after the battle wave count advances.
- Desktop 1440px Playwright QA verified Deployment shows `敵波タイムライン` with 6 entries, first entry `第1波 / 1秒 / 群集+銃兵`, tactical wave summary `初波1秒 / 間隔12秒 / 指揮波82%`, Battle HUD shows 4 compact timeline markers `第1波 1秒 接近 / 第2波 13秒 接近 / 第3波 25秒 強圧 / 第4波 37秒 強圧`, and after 16 seconds at 3x all 4 compact markers were marked passed while battle enemy wave reached 4. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-enemy-wave-timeline-qa-report.json`.

## Implemented Recon-Confidence Timeline Slice - 2026-07-03

The enemy-wave timeline now reflects intel quality instead of always showing exact operational truth.

Implemented:

- `BattleWaveTimelineEntry` now stores display labels for timing, enemy mix, command likelihood, and intel certainty.
- Medium confidence shows approximate timing and less certain command information, such as `約1秒` and `指揮不明`.
- High, confirmed, or precise intel shows exact timing and concrete command likelihood labels.
- Misleading intel has a separate certainty state and now receives dedicated warning styling in Deployment and Battle HUD.
- Desktop 1440px Playwright QA verified initial medium intel shows `第1波 / 約1秒 / 群集+銃兵 / 接近 / 指揮不明`; after side-operation auto-resolve, enemy composition changed to `精密照合` and the timeline showed exact `第1波 / 1秒 / 群集+銃兵 / 接近 / 指揮なし`; Battle HUD showed `第1波 1秒 接近 / 第2波 13秒 接近 / 第3波 25秒 強圧 / 第4波 37秒 強圧`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-recon-confidence-wave-timeline-qa-report.json`.

## Implemented Misinformation Timeline Styling Slice - 2026-07-03

Misleading enemy-composition intel is now treated as a visible command risk rather than only a data state.

Implemented:

- `BattleWaveIntel.summary` now avoids exact-looking timing when intel is not confirmed.
- Misleading intel summarizes as `敵波情報に誤情報疑い / 実波要警戒`.
- Deployment shows a warning that wave timing, enemy type, and command-wave information may be wrong.
- Timeline cards and Battle HUD markers receive `certainty-misleading` classes and display `誤情報疑い`.
- Misleading entries show `時刻不明`, `敵種誤情報疑い`, and `指揮誤報疑い` instead of precise-looking values.
- Desktop 1440px Playwright QA verified normal medium intel shows `第1波 / 約1秒 / 群集+銃兵 / 接近 / 指揮不明 / 推定`; forced misleading intel shows `第1波 / 時刻不明 / 敵種誤情報疑い / 接近 / 指揮誤報疑い / 誤情報疑い`; Battle HUD shows `第1波 時刻不明 接近 誤情報疑い` through the first four compact markers. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-misinformation-wave-timeline-qa-report.json`.

## Implemented Misinformation Wave Surprise Slice - 2026-07-03

Misleading enemy intel now affects the actual battle, not only the text shown before battle.

Implemented:

- `BattleWaveIntel` separates predicted timing/multipliers from actual timing/multipliers.
- Normal and confirmed intel keep predicted and actual wave fields aligned.
- Misleading intel worsens actual wave behavior: shorter spawn interval, earlier command-wave start, higher command-wave chance, and stronger enemy-type pressure multipliers.
- Battle setup logs `敵情警告` when a misleading-intel surprise profile exists.
- Battle Command HUD shows `実波警戒` with the actual surprise summary.
- `resolveTick` adds a surprise note to early wave-arrival logs when misleading intel is active.
- Desktop 1440px Playwright QA forced misleading intel and verified Deployment summary `敵波情報に誤情報疑い / 実波要警戒`; Battle HUD showed `実波警戒 誤情報補正: 実波間隔8秒 / 指揮波95%へ悪化`; after 34 battle seconds the battle reached enemy wave 5 with `発見 10/17`, broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-misinformation-wave-surprise-qa-report.json`.

## Implemented Misinformation After Action Slice - 2026-07-03

Bad enemy intel now feeds the growth and reflection loop after battle.

Implemented:

- `BattleResult` stores `intelligenceEvents` and `intelligenceLessonOfficerIds`.
- `createBattleResult` compares predicted wave count against actual spawned waves when misleading intel was active.
- After Action shows an `敵情評価` block with the bad-intel summary, predicted-vs-actual wave gap, and lesson count.
- `applyBattleResult` writes bad-intel context into campaign history, affected unit battle histories, and relevant officer histories.
- Desktop 1440px Playwright QA forced misleading intel, fought to 34 seconds, withdrew, and verified After Action entries `敵情誤認: 誤情報補正: 実波間隔8秒 / 指揮波95%へ悪化`, `予測波3に対して実波5、追加圧力2波。`, and `教訓記録 1名`; after applying the result, Officers retained `敵情誤認対応、偵察教訓を記録`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-misinformation-after-action-qa-report.json`.

## Implemented Recon Lesson Quality Slice - 2026-07-03

The bad-intel lesson loop now feeds later recon quality instead of stopping at After Action text.

Implemented:

- `src/game/theater/reconQuality.ts` reads prior bad-intel unit and officer histories when scoring assigned recon side-operation forces.
- Units with `敵情誤認下` battle-history entries receive a capped recon bonus.
- Officers with `偵察教訓` or `敵情誤認対応` history entries receive a capped recon bonus.
- The same `calculateReconQuality` path powers Theater recon previews and recon side-operation auto-resolve, so the lesson affects both visible planning and the operation result path.
- Desktop 1440px Playwright QA injected lesson histories into a recon-assigned jaeger/officer pair and verified the Theater recon preview score increased from baseline to the lesson-adjusted value with no console errors. QA report: `outputs/takawasi-recon-lesson-quality-qa-report.json`.

## Implemented Recon Quality Breakdown UI Slice - 2026-07-03

Recon quality is now visible as more than a single number.

Implemented:

- `src/game/theater/reconQuality.ts` exposes a breakdown alongside the final score.
- Theater recon side-operation cards display unit score, officer score, doctrine support, and bad-intel lesson bonus chips.
- This makes the scouting growth loop readable: after misinformation lessons, the player can see `部隊教訓` and `将校教訓` contributions instead of only a higher total score.
- Desktop 1440px browser QA verified baseline `精密偵察90` with `部隊72 / 将校12 / 参謀支援+6`, then bad-intel lesson history `精密偵察100` with `部隊76 / 将校18 / 参謀支援+6 / 部隊教訓+4 / 将校教訓+6`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-recon-quality-breakdown-ui-qa-report.json`.

## Implemented Strategic Intel Preparation Slice - 2026-07-03

Bad-intel lessons now affect the next strategic turn, not only the next recon assignment.

Implemented:

- `calculateStrategicIntelPreparation` derives a strategic lesson score from unit `敵情誤認下` histories and officer `偵察教訓` / `敵情誤認対応` histories.
- `applyBattleResult` passes that preparation profile into the next `generateStrategicTurn` call after battle result application.
- `generateStrategicTurn` can upgrade initial spoils and enemy-composition confidence, mark new operation intel as `部分照合` or `偵察照合済み`, append `参謀偵察教訓を反映`, and add a campaign-facing preparation message.
- Desktop 1440px browser QA reset the campaign, injected jaeger/engineer/officer lesson history, started the mandatory battle, withdrew, applied After Action, and verified turn 2 message `過去の敵情誤認教訓を参謀部が整理。初期敵情+1、教訓値9。`; Theater main battle and recon side operation displayed `部分照合`, and the main spoils summary showed `参謀偵察教訓を反映`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-strategic-intel-preparation-qa-report.json`.

## Implemented Enemy-Intelligence Doctrine Slice - 2026-07-04

The intelligence loop is now a player-facing staff choice, not only a passive history effect.

Implemented:

- Doctrine adds `敵情分析`, using the existing threat-intel icon.
- `strategicDoctrineFromDoctrine` gives `敵情分析` +4 side-operation/recon quality, +6 strategic intel preparation value, and +1 next-turn initial enemy-intel confidence shift.
- Doctrine UI shows the new row and the effective `敵情分析 +N / 教訓値+N` values.
- Recon side-operation previews use the increased doctrine support immediately.
- Next-turn strategic generation can display `敵情分析班が戦区情報を整理` and improve initial operation intel even without manually injected misinformation lessons.
- Desktop 1440px browser QA invested the starting doctrine point into `敵情分析`, verified `敵情分析運用`, `小任務+10`, `敵情分析 +1 / 教訓値+6`, confirmed recon preview `精密偵察94` with `参謀支援+10`, then applied a withdrawn mandatory battle and verified turn 2 `敵情分析班が戦区情報を整理。初期敵情+2、教訓値6。` with operation intel `偵察照合済み`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-enemy-intelligence-doctrine-qa-report.json`.

## Implemented Staff Intelligence Directive Slice - 2026-07-04

The intelligence loop now has a turn-level staff assignment, so the player can choose what the staff prioritizes even before buying more permanent doctrine.

Implemented:

- `DoctrineState.staffIntelligenceDirective` stores the active directive with default `標準参謀整理`.
- Directive profiles cover `敵情分析`, `防諜警戒`, `兵站偵察`, and `工兵測量`.
- `strategicDoctrineFromDoctrine` folds the selected directive into the same strategic support profile used by recon previews, side-operation auto-resolve, next-turn intel preparation, battle supply spend, engineering cost, and repair amount.
- Doctrine UI shows a `ターン参謀任務` board and uses Japanese labels instead of raw mode keys.
- Desktop 1440px browser QA selected `敵情分析`, verified `小任務+8`, assigned `東方辺境猟兵隊` + `ケラー` to recon and saw `精密偵察92` with `参謀支援+8`, then withdrew from the mandatory battle and verified turn 2 message `敵情分析班が戦区情報を整理。初期敵情+2、教訓値4。` with `偵察照合済み`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-staff-intelligence-directive-qa-report.json`.

## Implemented Staff-Directive Recommendation Slice - 2026-07-04

The turn staff directive now affects the Army Camp command-recommendation layer, not only recon and next-turn intel.

Implemented:

- `CommandRecommendationContext` carries the active staff directive mode and label.
- Staff replacement scoring adds directive-specific weight: enemy analysis favors enemy-reading command choices, counter-intelligence favors steadier command control, logistics recon favors quartermaster/reserve handling, and engineer survey favors engineer staff.
- Division commander recommendation scoring also receives directive-specific morale/control/reserve weights and directive-matched division-order bonuses.
- Army Camp `参謀部推奨` shows the active directive in the battlefield context and displays a `参謀任務補正` explanation line.
- Desktop 1440px browser QA selected `敵情分析` and verified Army Camp recommendations displayed `参謀任務敵情分析` plus `参謀任務補正: 敵情分析`; then switched to `工兵測量` and verified the same recommendation context changed to `参謀任務工兵測量`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-staff-directive-recommendation-qa-report.json`.

## Implemented Enemy Intel Readability Slice - 2026-07-04

Enemy-composition intel is now easier to read before deployment and side-operation assignment.

Implemented:

- `src/components/shared/EnemyIntelPanel.tsx` centralizes enemy-intel card rendering.
- Theater main battle and side operations show confidence/recon state, composition, per-type uncertainty ranges, main threat role, and compact threat bars.
- Deployment shows `出撃前敵情` next to the existing wave timeline so the player can compare composition pressure and timing pressure in one briefing.
- `src/game/theater/enemyIntel.ts` exports enemy threat labels, role labels, and severity labels for shared UI.
- Desktop 1440px browser QA verified 5 Theater enemy-intel panels, including `主戦場敵情` and four `小任務敵情` cards, plus one Deployment `出撃前敵情` card beside `敵波タイムライン`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-enemy-intel-readability-qa-report.json`.

## Implemented Frontline Doctrine Command Slice - 2026-07-04

Battle Command now has a line-level command layer above individual brigade orders.

Implemented:

- `src/game/battle/orders.ts` adds frontline doctrine presets for `戦線固守`, `弾性拒止`, `殺傷地帯`, `遅滞節約`, and `工兵修理線`.
- Applying a doctrine preset updates every active defender assigned to the selected frontline segment, setting posture, target priority, ammo policy, fallback behavior, and in the engineer-repair case local damaged-facility intent.
- The selected-frontline panel now shows a `戦線指揮` board with pressure state, average morale, average ammo, local facility count, damaged facility count, and lead threat.
- The doctrine buttons are not separate permanent doctrine unlocks; they are battle-runtime command presets built on top of `StandingOrder`.
- Desktop 1440px browser QA verified Theater -> Camp -> Deployment -> Battle, one doctrine board, five enabled doctrine buttons, and `殺傷地帯` changing a selected defender to `阻止射撃`, `優先 最大集団`, and `弾薬 集中射撃`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-frontline-doctrine-command-qa-report.json`.

## Implemented Frontline Doctrine Assessment Slice - 2026-07-04

The line-level command buttons now explain their tactical tradeoffs before the player clicks them.

Implemented:

- Each frontline doctrine button displays a forecast row: `損耗`, `弾薬`, and `突破` risk.
- Each button also displays a short reason derived from current pressure level, lead enemy type/phase, average ammo, average morale, or damaged facilities.
- Example: `殺傷地帯` on an unpressured line can show `予測 損耗低 / 弾薬高 / 突破低` with `接敵前の強射準備`.
- Recommended/caution coloring now follows the forecast when it has stronger context than the simple pressure-level fallback.
- The forecast is a command aid, not a separate simulation branch; actual behavior still comes from applying `StandingOrder` changes to assigned defenders.
- Desktop 1440px browser QA verified Theater -> Camp -> Deployment -> Battle, visible prediction/reason text, five doctrine buttons, and `殺傷地帯` still applying `優先 最大集団` plus `弾薬 集中射撃`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-frontline-doctrine-assessment-qa-report.json`.

## Implemented Staff Frontline Advisory Slice - 2026-07-04

Battle Command now surfaces a staff-style warning layer for the whole line, not only the currently selected segment.

Implemented:

- `参謀警告` cards are derived from current frontline pressure, lead enemy phase/type, defender count, reserve candidates, average ammo, average morale, and damaged facilities.
- Advisories are ranked by urgency and show the target frontline, recommended doctrine preset, pressure/defender/reserve detail, forecast, and reason.
- The `適用` command reuses the same frontline doctrine path, selects the advised frontline/unit, scrolls toward the threat, and writes `参謀警告対応` into the battle log.
- Accepted advisories are stored on `BattleState.staffAdvisoryResponses`, then converted into `BattleResult.staffAdvisoryOutcomes` with segment, preset, reason, involved units, pressure-at-issue, final line integrity, and result label.
- After Action now shows the accepted staff advisory result in the main report and on involved unit rows. Involved units also receive a small XP bonus, and campaign application records the advisory outcome into unit `battleHistory`.
- Those unit-history entries now become next-battle tactical lessons. `tacticalLessonProfileForUnit` reads `参謀警告対応` outcomes and grants small bonuses to reserve readiness, control radius, and fallback morale timing. It also counts prior advisory doctrine labels and exposes a preferred doctrine such as `得意殺傷地帯`. After Action previews the lesson before result application as `次戦教訓`, Deployment and Battle Command both show the Japanese `戦術教訓` summary after application, Deployment can apply the learned doctrine into the pre-battle StandingOrder draft with `教訓方針を適用`, or apply and persist it as a per-brigade StandingOrderTemplate with `教訓方針を保存`. Army Camp displays the saved standard order, lists saved-template brigades in `標準方針台帳`, and can clear only the template while keeping the brigade's lesson/history. Battle creation logs deployed lesson summaries, and staff advisory recommendation can add `教訓殺傷地帯` when that learned preference is still tactically usable.
- This keeps the player in a commander role: the UI points out which line needs attention and what tradeoff is being recommended, while the battle model still resolves through StandingOrders.
- Desktop 1440px browser QA verified Theater -> Camp -> Deployment -> Battle -> 3x tick -> pause, two active advisories, `右翼泥濘線: 殺傷地帯`, `敵圧920 / 守備1 / 予備1 / 群集 接近`, `予測 損耗低 / 弾薬高 / 突破低`, and advisory application changing the selected unit to `優先 最大集団` plus `弾薬 集中射撃`. Broken images 0, console errors 0, page overflow false. QA report: `outputs/takawasi-staff-frontline-advisory-qa-report.json`.
- Follow-up desktop 1440px QA verified Battle -> After Action carryover: applied `右翼泥濘線: 殺傷地帯`, After Action showed `右翼泥濘線で殺傷地帯を採用。群集を突破前に削る / 対応及ばず / 敵圧1522 / 戦線7%`, the involved unit row showed `参謀警告 右翼泥濘線 / 殺傷地帯 / 対応及ばず`, the campaign message included the advisory summary, broken images 0, console errors 0, page overflow false. Mobile QA remains outside the current target. QA report: `outputs/takawasi-staff-advisory-after-action-qa-report.json`.
- Tactical-lesson desktop 1440px QA injected a local dev save history entry containing `参謀警告対応 右翼泥濘線/殺傷地帯/対応及ばず`, then verified Deployment displayed `戦術教訓 参謀警告1件 / 即応+3 / 統制+1 / 後退判断+3`; Battle Command showed the same summary, `予備即応 56`, `基準 X34 Y23 / 半径22`, and `後退 士気35以下`. The injected QA save was removed after verification. QA report: `outputs/takawasi-tactical-lesson-carryover-qa-report.json`.
- Preferred-doctrine desktop 1440px QA injected the same advisory history with `殺傷地帯`, verified Deployment displayed `得意殺傷地帯`, started battle, ran at 3x, paused, and verified staff advisory detail `森林左翼線: 殺傷地帯` with `教訓殺傷地帯`. Broken images 0, console errors 0, page overflow false. The injected QA save was removed after verification. QA report: `outputs/takawasi-tactical-lesson-preferred-doctrine-qa-report.json`.
- After Action lesson-preview desktop 1440px QA reset the campaign, ran Theater -> Camp -> Deployment -> Battle, applied `中央塹壕線: 殺傷地帯`, withdrew, and verified After Action `次戦教訓`, including `第4戦列歩兵大隊: 次戦教訓 参謀警告1件 / 得意殺傷地帯 / 即応+5 / 統制+2` plus involved-unit row previews. Broken images 0, console errors 0, page overflow false. The QA campaign was reset from UI afterward. QA report: `outputs/takawasi-after-action-tactical-lesson-preview-qa-report.json`.
- Deployment lesson-recommendation desktop 1440px QA used the full flow reset -> Theater -> Camp -> Deployment -> Battle -> apply `中央塹壕線: 殺傷地帯` -> withdraw -> After Action -> apply result -> next-turn Deployment. Selecting `第4戦列歩兵大隊` showed `戦術教訓推奨` and `次戦初動は殺傷地帯を推奨`; `教訓方針を適用` changed the draft to `姿勢 阻止射撃`, `優先 最大集団`, `弾薬 集中射撃`, and `後退 士気34`. Broken images 0, console errors 0, page overflow false. The QA campaign was reset from UI afterward. QA report: `outputs/takawasi-deployment-tactical-lesson-recommendation-qa-report.json`.
- Deployment lesson-save desktop 1440px QA used the same full flow, then clicked `教訓方針を保存` for `第4戦列歩兵大隊`. The slot changed to `方針 保存済`, the draft showed `姿勢 阻止射撃`, `優先 最大集団`, `弾薬 集中射撃`, `後退 士気34`, and `保存済み自律方針` listed `殺傷地帯教訓から保存した自律指揮方針。次回主戦場の初期配置へ適用する。`. Broken images 0, console errors 0, page overflow false. The QA campaign was reset from UI afterward. QA report: `outputs/takawasi-deployment-tactical-lesson-save-qa-report.json`.
- Army Camp lesson-standard-order desktop QA used the full flow reset -> Camp -> Deployment -> Battle -> apply staff advisory -> withdraw -> After Action -> apply result -> next-turn Deployment -> save `第4戦列歩兵大隊` lesson order -> Army Camp. The selected-unit inspector showed `戦術教訓 参謀警告1件 / 得意弾性拒止 / 即応+4 / 統制+1 / 後退判断+2`, `得意方針 弾性拒止`, `弾性拒止教訓から保存した自律指揮方針。次回主戦場の初期配置へ適用する。`, and `姿勢 弾性防御 / 優先 最接近 / 弾薬 弾薬節約`. Broken images 0, console errors 0, page overflow false. Mobile QA remains outside the current target. QA report: `outputs/takawasi-army-camp-tactical-lesson-standard-order-qa-report.json`.
- Army Camp standard-order-clear desktop QA used the full flow reset -> Camp -> Deployment -> Battle -> apply staff advisory -> withdraw -> After Action -> apply result -> next-turn Deployment -> save `東方辺境猟兵隊` lesson order -> Army Camp -> `標準方針を解除`. Before clearing, the selected-unit inspector showed `戦術教訓 参謀警告1件 / 得意殺傷地帯`, the saved standard-order description, `姿勢 阻止射撃 / 優先 最大集団 / 弾薬 集中射撃`, and the clear button. After clearing, the tactical lesson and `得意方針 殺傷地帯` remained, the saved-order description/button disappeared, and the fallback text returned. Broken images 0, console errors 0, page overflow false. The QA campaign was reset afterward. Mobile QA remains outside the current target. QA report: `outputs/takawasi-army-camp-standard-order-clear-qa-report.json`.
- Army Camp standard-order-ledger desktop QA verified the left-panel `標準方針台帳`. Empty state showed `保存済み標準方針なし`; after saving `東方辺境猟兵隊`'s lesson order, the ledger row showed `東方辺境猟兵隊 / 猟兵 / 阻止射撃 / 最大集団 / 集中射撃`; clicking it selected the Jaeger unit in the inspector with lesson and saved-order details; clearing the standard order returned the ledger to empty while preserving the lesson. Broken images 0, console errors 0, page overflow false. The QA campaign was reset afterward. Mobile QA remains outside the current target. QA report: `outputs/takawasi-army-camp-standing-order-ledger-qa-report.json`.

## Implemented Selected-Unit Target Audit Slice - 2026-07-04

Battle Command now makes the selected brigade's autonomous target choice inspectable before and during manual intervention.

Implemented:

- The selected-brigade command panel includes `射撃判断監査`.
- The panel shows the accepted target candidate, target priority, effective range, fallback margin, and facility assignment/distance/durability state.
- Spotted enemy candidates are evaluated with the same player-fire gates used by the tick: formation fire arc, effective range, and terrain line-of-sight blockage.
- Candidate rows show `射撃可能`, `射界外/遠距離`, `射線遮断`, or `指名目標`, plus distance, formation distance, enemy phase, morale state, and count.
- Clicking a fireable candidate assigns it through the existing battle-only focus-target path, so the UI moves from audit to command without creating another order model.
- The battle map now draws selected-unit target-candidate lines on a non-click-blocking SVG layer. The layer distinguishes accepted/focused/clear/out-of-range candidates and labels lines with short statuses such as `指名目標`, `射撃可能`, and `射界外/遠距離`.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle, initial no-enemy empty state, Jaeger selected at 1x, enabled fireable `群集` candidate, disabled out-of-range candidates, candidate click changing the row to `指名目標` and selected brigade text to `集中 アンデッド群集`, battle still running, broken images 0, console errors 0, page overflow false. Mobile QA remains outside the current target. QA report: `outputs/takawasi-target-audit-panel-qa-report.json`.
- Desktop 1440px browser QA also verified the map-line layer: five candidate lines after focus assignment, accepted line count 1, focused line count 1, out-of-range line count 2, labels including `指名目標`, `射撃可能`, and `射界外/遠距離`, broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA remains outside the current target. QA report: `outputs/takawasi-target-audit-map-lines-qa-report.json`.

## Implemented Tactical Map Layer Controls Slice - 2026-07-04

The Battle Command map now treats dense tactical information as readable layers instead of an always-on overlay stack.

Implemented:

- A `戦術表示` control panel with eight toggles: `戦線`, `指揮圏`, `射撃判断`, `隊形`, `敵突撃`, `交戦線`, `地形/目標`, and `施設`.
- A compact legend for common line semantics: `射撃可`, `遮断`, `射程外`, `交戦`, and `突撃軸`.
- Layer state is UI-only and does not alter battle simulation, StandingOrders, target choice, enemy movement, or facility assignment data.
- Command modes force the layer needed for the command to remain visible while preserving the player's toggle state. Example: `施設をクリック` shows structures even when the `施設` layer button is off.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle, initial 8/8 layer state, toggling `戦線 / 指揮圏 / 地形/目標 / 施設` to 4/8 hides frontline segments, assignment layer, terrain callouts, objective nodes, and structures while leaving formation/engagement layers visible. It also verified facility-command forced structure visibility, all-layer restore to 8/8, live 1x coexistence of target-audit and enemy-assault layers, `射撃判断` toggle removing target-audit lines, broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA remains outside the current target. QA report: `outputs/takawasi-battle-map-layer-controls-qa-report.json`.

## Implemented Terrain LOS Tactical Modifiers Slice - 2026-07-04

Terrain now affects shooting decisions beyond a binary blocked/clear line.

Implemented:

- `lineOfSightBlockage` returns display modifiers and range/fire multipliers in addition to blockers and blockage amount.
- High-ground firing lanes are modeled as `高地射界`: a firing unit on hill terrain reduces intervening blockage and gains range/fire modifiers.
- Cover-edge firing is modeled for forest, village, and trench zones. Units near the edge of cover can fire out with reduced self-blockage, while enemies on a cover edge impose a smaller fire penalty.
- Enemy ridge cases are represented as an enemy-side LOS modifier so shooting uphill can be worse than shooting from high ground.
- `resolveTick` uses the same LOS range/fire multipliers for brigade target selection and player fire damage, so the UI audit and tick behavior stay aligned.
- Battle Command target-audit rows show per-candidate `有効射程` and LOS labels; selected brigade panels also show the current `射線` text.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 1x tick, terrain callouts such as `森林遮蔽帯 移動72% / 射線遮蔽 / 遮蔽端` and `塹壕掩体線 移動72% / 射線減衰 / 遮蔽端`, selected brigade `射線 減衰 森林遮蔽帯`, target-audit rows with `有効射程`, target-audit layer visible, broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. The current generated battlefield did not include hill terrain, so high-ground runtime text was not present in this seed. Mobile QA remains outside the current target. QA report: `outputs/takawasi-terrain-los-tactical-modifiers-qa-report.json`.

## Implemented High-Ground LOS QA Profile Slice - 2026-07-04

High-ground LOS can now be verified deterministically instead of waiting for a random/generated battlefield seed.

Implemented:

- `createBattleScenario` accepts an optional tactical terrain profile.
- `App.tsx` reads `?takawasiTerrainProfile=high-ground` and starts the main battle with the `高地射線検証` profile.
- The profile appends `hill` and `open` terrain to the current sector battle scenario without changing campaign save state or normal campaign terrain.
- `waves.ts` gives this profile forward enemy entry points so the selected hill-side brigade can produce a fireable high-ground target-audit candidate within the first live tick window.
- Battle Command shows the tactical profile label in the top HUD and logs the profile summary during battle creation.
- Desktop 1440px browser QA verified `http://127.0.0.1:5173/?takawasiTerrainProfile=high-ground` through reset -> Camp -> Deployment -> Battle -> 1x tick. The battle showed `高地稜線 移動84% / 高地射界`, selected sight `射線 減衰 森林遮蔽帯/高地稜線 / 高地射界 高地稜線`, action reason `射撃判断: アンデッド群集 / 優先最接近 / 減衰 森林遮蔽帯/高地稜線 / 高地射界 高地稜線`, and target audit `射線減衰 森林遮蔽帯/高地稜線 高地射界 高地稜線 / 距離33 / 戦列距離31 / 有効射程34`. Broken images 0, console errors 0, horizontal overflow false. Mobile QA remains outside the current target. QA report: `outputs/takawasi-high-ground-los-profile-qa-report.json`.

## Implemented Defilade / Covered Position LOS Slice - 2026-07-05

LOS now distinguishes a target using deep cover or the reverse side of a ridge from a target merely touching a cover edge.

Implemented:

- `lineOfSightBlockage` detects `低姿勢遮蔽` when the target sits inside forest, village, or trench terrain away from the edge.
- Deep-cover targets increase effective blockage, reduce fire output, and slightly reduce effective range rather than acting as only display text.
- `lineOfSightBlockage` also detects reverse-slope hill targets as `逆斜面遮蔽` when the shooter is not on high ground and the target is across the hill centerline.
- Reverse-slope targets apply a stronger fire/range penalty than the previous generic `敵稜線` case while preserving the older uphill modifier for non-reverse-slope hill targets.
- Battle Command target-audit rows now include LOS modifiers even when the result is blocked, so `遮断` rows can still explain whether the problem is forest, trench, low posture, or ridge geometry.
- Desktop 1440px browser QA verified `http://127.0.0.1:5173/?takawasiTerrainProfile=high-ground` through reset -> Camp -> Deployment -> Battle -> 1x and 3x movement. The battle still showed `高地射線検証` and `高地稜線 移動84% / 高地射界`; after enemy movement, target audit showed `低姿勢遮蔽 塹壕掩体線` with reduced effective range (`有効射程33`) while high-ground firing labels remained visible. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`. Mobile QA remains outside the current target. QA report: `outputs/takawasi-defilade-covered-position-los-qa-report.json`.

## Implemented Reverse-Slope LOS QA Profile Slice - 2026-07-05

Reverse-slope LOS can now be verified deterministically instead of depending on enemy movement drifting into a suitable ridge position.

Implemented:

- `App.tsx` reads `?takawasiTerrainProfile=reverse-slope` and starts the main battle with the `逆斜面射線検証` profile.
- `createBattleScenario` appends QA-only `reverseSlopeDrill` terrain plus open ground without changing normal campaign terrain or save state.
- `terrainEffects.ts` converts that tag into a deterministic `逆斜面稜線` hill zone placed in front of the player line.
- `waves.ts` gives the profile early enemy entry points on the far side of that ridge, close enough for selected brigades to produce fireable target-audit candidates.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 1x. Battle Command showed live target-audit/action reason text including `射線遮断 森林遮蔽帯/逆斜面稜線 逆斜面遮蔽 逆斜面稜線` and `射撃判断: アンデッド銃兵 / 優先最接近 / 減衰 逆斜面稜線 / 逆斜面遮蔽 逆斜面稜線`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`. Mobile QA remains outside the current target. QA report: `outputs/takawasi-reverse-slope-los-profile-qa-report.json`.

## Implemented Frontline Terrain Assessment Slice - 2026-07-04

Frontline placement now has a readable tactical evaluation before and during battle.

Implemented:

- `src/game/battle/frontlineTerrainAssessment.ts` scores a frontline segment from overlapping terrain zones and nearby structures.
- The score is split into fire advantage, cover value, mobility risk, and support value.
- The assessment returns Japanese tags such as `高地火線`, `森林遮蔽`, `塹壕防衛`, `泥濘遅滞`, `施設防衛`, and a suggested frontline doctrine such as `戦線固守`, `殺傷地帯`, or `遅滞節約`.
- Deployment creates the same terrain zones used by battle preview logic, assesses every frontline segment, and shows the result on the map preview plus a five-card `frontline-terrain-assessment-grid`.
- The active Deployment segment handle panel shows the selected line's score, suggested doctrine, and short reason, so the player can adjust anchor/fallback/width while reading terrain consequences.
- Battle Command assesses the selected frontline from live `BattleState.terrainZones` and `BattleState.structures`, then shows `地形評価`, `地形推奨`, and `地形判断` above the frontline doctrine board.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment and saw five assessment cards such as `森林左翼線 / 森林遮蔽 / 塹壕防衛 / 施設防衛 / 評価96 / 推奨 戦線固守`; after starting Battle, the selected frontline panel showed `地形評価 96`, `火力1 / 遮蔽9 / 機動リスク0 / 施設2`, and reason `森林遮蔽帯で遮蔽端射撃を作れる。塹壕掩体線で主線を保持しやすい`. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA remains outside the current target. QA report: `outputs/takawasi-frontline-terrain-assessment-qa-report.json`.

## Implemented Frontline Geometry Terrain Comparison Slice - 2026-07-04

Deployment can now evaluate the terrain consequences of the whole frontline shape before the player commits to a geometry preset.

Implemented:

- `assessFrontlineGeometryTerrain` evaluates every geometry preset by applying the preset to the sector frontline, rebuilding battle terrain zones, and aggregating all segment assessments.
- The aggregate records average score, weakest line score, fire advantage, cover value, mobility risk, support value, tags, tone, summary, reason, and recommended doctrine.
- Deployment's `戦線ジオメトリ` buttons now show `平均` and `最低` terrain scores. The best preset is marked `地形推奨`, while the currently selected preset shows a note such as `現プリセット: ... / 推奨方針戦線固守。平均評価93で遮蔽/施設利得が厚い。`
- This keeps preset selection from being a pure layout toggle: `戦区標準`, `前進主線`, `縦深防御`, `広域警戒線`, `隘路圧縮`, `左翼拒否`, and `右翼拒否` can be compared by tactical ground before battle.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment, 7 geometry buttons, 1 best-preset marker, initial `戦区標準 平均93 / 最低82 / 地形推奨`, then clicking `広域警戒線` updated the active preset to `平均89 / 最低59` while keeping 5 per-frontline terrain assessment cards. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA remains outside the current target. QA report: `outputs/takawasi-frontline-geometry-terrain-comparison-qa-report.json`.

## Implemented Frontline Terrain Mitigation Slice - 2026-07-04

Deployment now turns terrain scoring into an actionable pre-battle staff note instead of only showing numbers.

Implemented:

- `createFrontlineTerrainMitigationAdvisory` identifies the lowest-scoring frontline segment, compares the active geometry against the best terrain geometry, and assigns a severity of `stable`, `caution`, or `critical`.
- The advisory records the focus segment, recommended geometry label, whether the whole-line geometry should change, and up to four action hints.
- Hints are generated from the actual assessment shape: low cover suggests trench/barricade or reserve support, low support suggests supply/engineer/reserve support, high mobility risk suggests deeper fallback and economical delay, and high fire advantage suggests fire-posture exploitation.
- Deployment shows the advisory under `戦線ジオメトリ`. `弱線を選択` selects the lowest-scoring line in both the preview and terrain card grid; `推奨形へ変更` appears only when the recommended geometry materially improves the active shape.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment, initial stable advisory `右翼泥濘線が最低評価82 / 現戦線は平均93 / 最低82`, switching to `広域警戒線` produced caution advisory `右翼泥濘線が最低評価59` and `戦区標準へ切替: 平均+4 / 最低+23`, `弱線を選択` selected `右翼泥濘線`, and `推奨形へ変更` returned the active geometry to `戦区標準 平均93 / 最低82 / 地形推奨`. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA remains outside the current target. QA report: `outputs/takawasi-frontline-terrain-mitigation-qa-report.json`.

## Implemented Frontline Mitigation StandingOrder Slice - 2026-07-04

The weak-line advisory can now alter the actual pre-battle autonomous plan instead of remaining a read-only note.

Implemented:

- Deployment adds `是正方針を保存` to the terrain mitigation card.
- The action chooses a suitable frontline unit, assigns it to the focus weak line, and saves a StandingOrderTemplate with terrain-driven posture, target priority, ammo policy, fallback threshold, and facility assignment.
- If reserve capacity exists, the action also chooses a support brigade, saves it as a fallback-guard reserve template, and writes the unit to `deploymentPlan.reserveUnitIds`.
- This intentionally uses the existing template/save path because Battle creation already reads `standingOrderTemplates` and `deploymentPlan.reserveUnitIds`; the mitigation therefore reaches the actual BattleState without introducing another transient draft-only path.
- Desktop 1440px browser QA verified `広域警戒線` -> `是正方針を保存`, Deployment message `東方辺境猟兵隊を右翼泥濘線へ再方針化し、第1戦列歩兵大隊を支援予備に指定した。`, `保存方針2/7旅団`, `指定予備1/3旅団`, planner state `右翼泥濘線 / 弾性防御 / 大型敵 / 弾薬節約 / 後退 士気55 / 弾薬18 / 塹壕線 防衛`, and BattleState start with `猟兵隊 / 右翼泥濘線 / 弾性防御 / 弾薬節約 / 塹壕線 防衛` plus `第1歩兵 / 後方砲兵線 / 後退守備 / 弾薬節約`. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA remains outside the current target. QA report: `outputs/takawasi-frontline-mitigation-standing-orders-qa-report.json`.

## Implemented Frontline Mitigation After Action Slice - 2026-07-04

The weak-line mitigation duty now survives the battle-result boundary.

Implemented:

- `BattleUnit` carries `deploymentMitigationRole` from saved StandingOrderTemplate descriptions generated by the Deployment mitigation action.
- `BattleResult` maps those markers into Japanese battle roles: `弱線是正` for the focus brigade and `弱線支援予備` for the supporting reserve.
- After Action displays the same roles and generated commendations through the existing per-unit role summary path.
- Campaign application writes the role and commendations into unit history, so Army Camp can show that the brigade actually fought or waited under that pre-battle duty.
- Desktop 1440px browser QA verified `広域警戒線` -> `是正方針を保存` -> Battle -> withdraw -> After Action. After Action showed `東方辺境猟兵隊 / 任務 弱線是正 / 弱線を受け持つ、施設支援を活用` and `第1戦列歩兵大隊 / 任務 弱線支援予備 / 弱線支援予備を維持`. After applying results and selecting the Jaeger in Army Camp, the unit history retained `戦闘撤退、弱線是正、永久損耗0、収容0、経験+2、装備摩耗-0.01、弱線を受け持つ・施設支援を活用`. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-frontline-mitigation-after-action-qa-report.json`.

## Implemented Deployment Band Editing Slice - 2026-07-04

Deployment can now edit the allowed starting band itself, not only the frontline anchor/fallback.

Implemented:

- `FrontlineSegmentGeometryOverride` supports `deploymentLimitOffset` and `deploymentLimitSizeOffset`.
- `frontlineDefaults` applies those offsets through the same `FrontlineGeometryAdjustment` path used by preset and handle edits, so the plan persists in `deploymentPlan.frontlineGeometry`.
- Deployment's active-line handle editor adds `出撃帯前進`, `出撃帯後退`, `出撃帯広げる`, and `出撃帯絞る`.
- The UI explains that deployment-band edits affect battle-start initial-position limits.
- Battle creation already consumes adjusted frontline geometry, so the edited deployment band reaches BattleState without a second save path.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment, initial `森林左翼線` band `X6-62 / Y11-36`, `出撃帯前進` + `出撃帯広げる` changed it to `X6-65 / Y9-38` with `手動調整 1線`, reload -> Camp -> Deployment restored it, and Battle start showed `展開 戦区標準+手動1`, selected brigade `戦線 森林左翼線`, and frontline panel `森林左翼線 / 基準 X34 Y24`. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-deployment-band-editing-qa-report.json`.

## Implemented Enemy Command Hierarchy Slice - 2026-07-04

Enemy command is now a first command-node/intent model, not only a morale or generic command-state modifier.

Implemented:

- `EnemyAssaultPlan` carries `commandRole`, `commandIntent`, `commandGroupId`, and `commandLabel`.
- `waves.ts` assigns each assault group to a wave/segment command group. Undead officers are `command_node`; other enemies are `assault_group`.
- Command intents are currently `戦線圧迫`, `側面迂回`, `陣地突破`, `銃列支援`, and `再集結`.
- Undead officers project their command intent to same-group or same-target assault groups. Same-group influence is stronger than loose same-target influence.
- `resolveTick` uses command intent for pressure, movement, breakthrough threshold, flanking pressure, and rally recovery. This means a command-wave officer can materially change how the undead wave behaves, not only how it is labeled.
- Battle Command shows `敵指揮網`, `指揮下`, the Japanese command intent, and labels such as `第2波指揮核` on the command alert and enemy-group cards.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves, `敵指揮網`, `19群 / 最大100% / 第2波指揮核`, enemy cards with `指揮下` and `陣地突破 / 第2波指揮核`, broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-enemy-command-hierarchy-qa-report.json`.

## Implemented Battle Objective Node Control Slice - 2026-07-04

Victory, supply, and visibility markers now participate in battle state instead of being fixed tactical-board decoration.

Implemented:

- `BattleState.objectiveNodes` holds three tactical objectives: `勝利地点`, `補給点`, and `視界点`.
- Each node has a map position, radius, `保持/争奪/喪失` control state, control progress, and local player/enemy presence values.
- `createBattleState` places objective nodes from the current frontline and available supply depot/observation post structures.
- `resolveTick` updates node control from nearby brigade strength and enemy pressure.
- Victory control modifies line integrity pressure, supply control gives local ammunition recovery, and visibility control gives a small enemy-suppression gain.
- Battle Command renders objective node state and top HUD percentages from `BattleState`, with generated objective icons retained as readable markers.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle, initial nodes `勝利地点保持 72%`, `補給点保持 62%`, `視界点争奪 48% / 視界76`, then 3x tick to `防衛時間 73/150秒` with `勝利地点喪失 0%`, `補給点保持 100%`, and `視界点喪失 0% / 視界76`. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-battle-objective-node-control-qa-report.json`.

## Implemented Objective Response Command Slice - 2026-07-04

Objective nodes now expose direct response commands that alter autonomous brigade behavior instead of remaining passive map labels.

Implemented:

- Battle Command renders a state-specific action on each objective node: held nodes become hold/defend commands, contested nodes become reinforce/secure/suppress commands, and enemy-held nodes become retake commands.
- `applyObjectiveNodeResponse` in `src/game/battle/orders.ts` chooses nearby defenders and reserve-capable brigades, then writes StandingOrders with the objective as anchor.
- Victory responses favor line-holding or aggressive retake, supply responses favor depot defense/resupply or engineer repair when a depot is damaged, and visibility responses favor screening or officer-focused suppression.
- The command sets frontline segment, posture, target priority, ammo policy, fallback destination, control radius, reserve readiness cost, and facility assignment where applicable.
- The UI selects a newly assigned brigade and scrolls toward the objective, so the player can see which unit accepted the response.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle. Initial objective buttons were `勝利点保持`, `補給点防衛`, and `視界点制圧`; clicking `補給点防衛` logged `目標対応: 補給点防衛`. After 3x pressure, buttons changed to `勝利点奪回`, `補給点防衛`, and `視界点奪回`; clicking `勝利点奪回` logged the retake response and selected a brigade with `阻止` posture near the objective. Broken images 0, console errors 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-objective-response-command-qa-report.json`.

## Implemented Objective Response After Action Slice - 2026-07-04

Objective response is now part of unit growth instead of disappearing when the battle ends.

Implemented:

- `BattleUnit.objectiveResponseRole` records battle-only duties such as `victory_hold`, `victory_retake`, `supply_defense`, `supply_retake`, `visibility_secure`, and `visibility_retake`.
- `applyObjectiveNodeResponse` sets that marker when it retasks a brigade through StandingOrder.
- `BattleResult` converts those markers into Japanese battle roles: `勝利点保持`, `勝利点奪回`, `補給点防衛`, `補給点奪回`, `視界点確保`, and `視界点奪回`.
- Objective-response roles now affect brigade XP, officer XP, and commendations. Examples include `補給線を防衛`, `補給施設を活用`, `勝利地点奪回に投入`, and `敵指揮を制圧`.
- Campaign application already writes battle role and commendations into unit history, so Army Camp records the objective duty without adding a save migration.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> `補給点防衛` -> withdraw -> After Action. The result showed `東方辺境猟兵隊 / 任務 補給点防衛 / 補給線を防衛` and `第3野戦砲兵中隊 / 任務 補給点防衛 / 補給線を防衛`. After applying results and selecting the Jaeger in Army Camp, unit history retained `戦闘撤退、補給点防衛、永久損耗0、収容0、経験+2、装備摩耗-0.01、補給線を防衛`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-objective-response-after-action-qa-report.json`.

## Implemented Objective Outcome Strategic Effects Slice - 2026-07-04

Final objective control now changes the campaign layer instead of only producing battle UI state.

Implemented:

- `ObjectiveBattleOutcome` records final victory/supply/visibility control, Japanese labels, supply/resource deltas, theater pressure deltas, visibility intel shift, and player-readable result events.
- `createBattleResult` derives that outcome from `BattleState.objectiveState`.
- After Action shows a `戦術目標` box with objective percentages and consequence lines.
- Victory point control adjusts current-sector enemy pressure, theater enemy momentum, and global threat.
- Supply point control adjusts supply consumption and can return ammunition/supplies when the point is held.
- Visibility point control can add a next-turn initial enemy-intel confidence shift through the existing strategic intel preparation path.
- Campaign application writes the objective-effect summary into sector history, strategic history, battle summary, and `lastMessage`.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> `補給点防衛` -> withdraw -> After Action. The result showed `戦術目標 / 勝利点保持 72% / 補給点係争 62% / 視界点係争 48%`, `勝利地点保持: 敵圧-3 / 敵勢-1`, `補給点係争: 補給効果なし`, and `視界点係争: 敵情補正なし`. After applying results, the campaign advanced to `第2戦略ターン` and the top message retained the objective-effect summary. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-objective-outcome-strategic-effects-qa-report.json`.

## Implemented Battle Command Queue Slice - 2026-07-04

Battle Command now supports paused order planning instead of forcing every selected-brigade command to apply immediately.

Implemented:

- `BattleCommandScreen` owns a local `予約指揮` queue. This is battle-UI state only and is not persisted into campaign saves.
- `停止して予約` enables queue mode and sets battle speed to `停止`, so the player can issue several planned instructions while reading the wide battle screen.
- While queue mode is active, selected-brigade posture presets, target priority, ammo policy, formation facing, immediate orders, fire missions, and staged fire-plan start commands are queued instead of immediately mutating `BattleState`.
- Alert-card recommendations and frontline-pressure responses can also be queued. This lets the player pause, stack responses such as `警報 阻止射撃` and `中央塹壕線 予備投入`, then issue them together.
- Queued commands retain brigade name, summary, and detail text. The player can delete individual queued items or discard the whole queue.
- `一括発令` applies queued commands to the current battle through the same `orders.ts` functions used by direct commands. The queue does not create a parallel command model.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle, queue mode `予約中`, speed `停止`, queued `阻止射撃 / 優先 敵指揮 / 弾薬節約 / 後退`, selected brigade remained unchanged before apply, deleting one queued item reduced the queue to 3, and applying the queue changed the selected brigade to `撤退中`, `優先 敵指揮`, and `弾薬 弾薬節約`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is intentionally outside the current target. QA report: `outputs/takawasi-command-queue-qa-report.json`.
- Follow-up desktop 1440px browser QA verified 3x battle pressure -> queue mode -> queued `第1戦列歩兵大隊 警報 阻止射撃` from an enemy-wave alert and `中央塹壕線 予備投入` from the frontline pressure card. `一括発令` cleared the queue, applied `姿勢 阻止射撃 / 目標 大型敵 / 弾薬 集中射撃` to 第1戦列歩兵大隊, moved 衛戍予備歩兵大隊 to `戦線 中央塹壕線`, and raised central defenders from 2 to 3. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. QA report: `outputs/takawasi-command-queue-alert-frontline-qa-report.json`.
- Tactical-map command queue follow-up: the same queue now accepts `基準位置を指定`, `後退地点を指定`, `戦線をクリック`, `施設をクリック`, `敵を指名`, and selected-brigade anchor/fallback handle drag completion. Direct mode still applies map commands immediately. Queue mode creates readable order cards and applies through existing `orders.ts` functions, preserving a single command model.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> `停止して予約`; queued a map anchor command `基準 X48 Y35 / マップ指定`, queued a frontline click command `戦線 塹壕補修線`, applied both with `一括発令`, then queued and applied a facility click command `塹壕線担当`. Logs showed `予約指揮: 2件を一括発令`, `第1戦列歩兵大隊を塹壕補修線へ配置転換`, `第1戦列歩兵大隊の基準位置をX48 Y35へ指定`, `予約指揮: 1件を一括発令`, and `第1戦列歩兵大隊を塹壕線の担当に指定`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. QA report: `outputs/takawasi-map-command-queue-qa-report.json`.

## Implemented Enemy Command Response Queue Slice - 2026-07-04

- The enemy-intent panel is no longer a direct-only command surface. `選択旅団の集中目標`, `担当戦線で対応`, and `担当戦線斉射` route through `予約指揮` when queue mode is active.
- Battle Command now exposes a compact enemy command-network summary. It shows command groups, command labels, command intent, command state, influence %, influenced groups, total force, total pressure, lead threat, and target line without opening every enemy token.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x until command groups appear -> `停止して予約` -> enemy command detail -> queued `敵群対応 阻止射撃 / 最大集団` and `担当戦線斉射` -> `一括発令`. Logs showed `予約指揮: 2件を一括発令`, `敵群対応斉射`, `戦線斉射: 5旅団がアンデッド群集 65体へ9秒斉射`, and `敵群対応: 2旅団を森林左翼線で阻止射撃 / 最大集団へ移行`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. QA report: `outputs/takawasi-enemy-command-response-queue-qa-report.json`.

## Implemented Enemy Command Group Action Slice - 2026-07-04

The enemy command-network summary is now an actionable command surface, not only a status strip.

Implemented:

- Each enemy command group card now exposes `指揮核射撃`, `崩壊追撃`, and `予備投入` next to `詳細`.
- `指揮核射撃` resolves the current command node/officer/most-influential target at execution time, retasks nearby responsible brigades to `優先 敵指揮` and `集中射撃`, sets focus target, and issues a battle-only `戦線斉射`.
- `崩壊追撃` is only enabled when the group is disrupted, wavering, routing, regrouping, overextended, or cohesion-broken. It retasks nearby brigades to aggressive screening, weakest-target priority, intense fire, and a line volley against the collapsing target.
- `予備投入` resolves the target frontline at execution time, moves reserve-capable units into that segment, assigns anchor/fallback, sets focus target and response priority, and spends reserve readiness.
- All three group actions route through `予約指揮` when queue mode is active. They reuse existing battle order functions instead of adding a parallel enemy-command model.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> enable queue mode -> 3x until command groups appear -> stop -> queue `第4波指揮核 指揮核射撃` and `第4波指揮核 指揮網へ予備投入` -> `一括発令`. The queue showed `敵指揮 / 2旅団 / 中央塹壕線` and `中央塹壕線 / 予備1旅団 / 群集`; applying produced `予約指揮: 2件を一括発令` and active fire mission `戦線斉射 敵指揮体 / 5旅団 / 残り9秒 / 軍団斉射規律`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. QA report: `outputs/takawasi-enemy-command-group-actions-qa-report.json`.

## Implemented Enemy Command Action After Action Slice - 2026-07-04

Enemy command-network actions now feed the growth loop instead of disappearing after the battle.

Implemented:

- `BattleUnit.enemyCommandActionRole` records battle-only duty from enemy command-network actions: `command_node_fire`, `collapse_pursuit`, or `command_reserve_commit`.
- `指揮核射撃` marks participating brigades as `敵指揮核制圧`.
- `崩壊追撃` marks participating brigades as `敵崩壊追撃`.
- `予備投入` marks committed reserves as `指揮網予備投入`.
- `createBattleResult` converts those markers into Japanese battle roles, XP bonuses, officer XP, and commendations such as `敵指揮核を射撃制圧`, `戦線斉射に参加`, `敵指揮網への予備投入`, and `即応予備を消費`.
- Campaign application already writes battle role and commendations into unit history, so no save migration is needed.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> queue mode -> command group `指揮核射撃` and `予備投入` -> withdraw -> After Action. After Action showed 第4戦列歩兵大隊 and 第6塹壕歩兵大隊 as `任務 敵指揮核制圧 / 敵指揮核を射撃制圧、戦線斉射に参加`, and 衛戍予備歩兵大隊 as `任務 指揮網予備投入 / 敵指揮網への予備投入、即応予備を消費`. After applying the result, Army Camp unit history retained both role entries. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. QA report: `outputs/takawasi-enemy-command-action-after-action-qa-report.json`.

## Implemented Enemy Command Tactical Lesson Slice - 2026-07-04

Enemy command-network battle roles now become next-battle tactical lessons, not only history text.

Implemented:

- `tacticalLessonProfileForUnit` reads unit history entries for `敵指揮核制圧`, `敵崩壊追撃`, and `指揮網予備投入`.
- Enemy command lessons add small reserve-readiness, control-radius, and fallback-judgment modifiers through the same `TacticalLessonProfile` used by staff-advisory lessons.
- When no staff-advisory doctrine is stronger, enemy command lessons map to the closest existing frontline doctrine: command-node fire -> `遅滞節約`, collapse pursuit -> `殺傷地帯`, and command-network reserve commitment -> `弾性拒止`.
- Deployment now shows `戦術教訓推奨` when a selected brigade has enemy command-action lessons even if it has no `参謀警告対応` history.
- `教訓方針を適用` and `教訓方針を保存` reuse the existing learned-doctrine StandingOrder path, so enemy command experience can change the next pre-battle posture, target priority, and ammo policy.
- Desktop 1440px browser QA verified Theater -> Camp -> Deployment -> Battle -> queue mode -> enemy command `指揮核射撃` and `予備投入` -> withdraw -> After Action -> apply result -> next-turn Deployment. Selecting 第4戦列歩兵大隊 showed `戦術教訓 敵指揮核制圧1件 / 得意遅滞節約 / 即応+1 / 統制+2`, `戦術教訓推奨`, and `次戦初動は遅滞節約を推奨`; pressing `教訓方針を適用` changed the draft to `姿勢 後退守備 / 優先 敵指揮 / 弾薬 弾薬節約`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-enemy-command-tactical-lesson-qa-report.json`.

## Implemented Enemy Command Collapse Pursuit Usability Slice - 2026-07-04

`崩壊追撃` is now a visible tactical opportunity instead of a mostly hidden button state.

Implemented:

- Enemy command-network cards now derive a `追撃候補` from the command group, same command label, or same target frontline segment.
- The card shows the target type, reason, and cohesion, e.g. `追撃候補 銃兵 / 小集団 / 凝集100%` or `追撃候補 群集 / 側撃 / 凝集100%`.
- Pursuit opportunity scoring covers command disruption, routing, regrouping, wavering, breakthrough, flanking, overextension, low cohesion, and small-group cleanup.
- The `崩壊追撃` button uses the same opportunity score as the visible card, and the issued command detail uses the same Japanese reason helper.
- Desktop 1440px browser QA verified Theater -> Camp -> Deployment -> Battle -> 3x until enemy command-network cards -> stop -> `崩壊追撃`. The battle log showed `敵指揮網対応: 第4波指揮核へ崩壊追撃。2旅団が弱敵掃討へ移行。`; After Action showed `任務 敵崩壊追撃 / 崩れた敵群を追撃、弱敵掃討を担当`; next-turn Deployment for 第4戦列歩兵大隊 showed `戦術教訓 敵崩壊追撃1件 / 得意殺傷地帯 / 即応+1 / 統制+1`, and `教訓方針を適用` changed the draft to `姿勢 阻止射撃 / 優先 最大集団 / 弾薬 集中射撃`. Console errors 0, broken images 0, horizontal overflow false. Mobile QA is outside the current target. QA report: `outputs/takawasi-enemy-command-collapse-pursuit-qa-report.json`.

## Implemented Frontline Rotation Slice - 2026-07-04

Frontline pressure cards now support fighting withdrawal and unit rotation, not only holding harder or committing reserves.

Implemented:

- `BattleUnit.frontlineRotationRole` records battle-runtime rotation duty without changing the save schema.
- `applyFrontlineRotation` chooses the most stressed defender on the selected pressured segment, orders it to the fallback line, and assigns a reserve unit to cover that same segment.
- Battle Command frontline pressure cards now show a `戦闘交代` preview such as tired unit morale/strength -> reserve readiness, plus a secondary `戦闘交代` action button.
- After Action maps the withdrawn unit to `任務 戦闘交代 / 損耗旅団を後退線へ整理` and the covering unit to `任務 後衛援護 / 交代旅団を援護、即応予備を投入`.
- Desktop 1440px browser QA verified reset -> Theater -> Camp -> Deployment -> Battle -> 3x pressure -> enabled `戦闘交代` buttons -> click `戦闘交代`. The battle log showed `戦闘交代: 衛戍予備歩兵大隊を後退線へ下げ、第3野戦砲兵中隊が森林左翼線を引き継ぐ。`; After Action showed both `任務 戦闘交代` and `任務 後衛援護`; console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-rotation-qa-report.json`.

## Implemented Frontline Rotation Candidate Selection Slice - 2026-07-04

The selected-frontline command panel now lets the player inspect and choose the exact fighting-rotation pair instead of accepting only the automatic pressure-card choice.

Implemented:

- `applyFrontlineRotation` accepts optional `tiredUnitId` and `reserveUnitId`. If the selected IDs are valid candidates, the command uses them; otherwise it falls back to the existing automatic stressed-defender/reserve selection.
- Battle Command now computes a rotation candidate list for the selected pressured segment. `交代対象` candidates are sorted by stress from morale, condition, ammo, and strength ratio. `援護予備` candidates are sorted by reserve readiness.
- The selected-frontline `戦闘交代` panel shows candidate counts, the current selected preview, candidate buttons with stress/readiness details, and `選択交代を実行`.
- The pressure-card one-click `戦闘交代` remains available and still uses the automatic default pair.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x pressure. On `森林左翼線`, the panel showed `候補 守備2 / 予備1`; the tester manually selected `第1歩兵` instead of the default `予備歩兵`, executed `選択交代を実行`, and the battle log showed `戦闘交代: 第1戦列歩兵大隊を後退線へ下げ、第4戦列歩兵大隊が森林左翼線を引き継ぐ。` After Action showed `第1戦列歩兵大隊 / 任務 戦闘交代` and `第4戦列歩兵大隊 / 任務 後衛援護`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-rotation-selection-qa-report.json`.

## Implemented Frontline Rotation Reserve-Source Risk Slice - 2026-07-04

Fighting rotation now exposes the operational cost of pulling a unit from another line.

Implemented:

- Reserve candidates are classified as `予備線`, `火力予備`, `後退守備`, `静穏線転用`, `戦線転用`, or `危険転用`.
- Candidate sorting now favors true reserve/rear-guard/fire-support units and penalizes pulling ordinary defenders from another active line. Emergency transfer remains allowed; it is a player-visible risk, not a hard ban.
- Pressure-card previews append the reserve-source label, e.g. `即応0 / 危険転用`.
- The selected-frontline `援護予備` list shows source detail such as `中央塹壕線を薄くする` or `中央塹壕線も危険`, plus a computed evaluation score.
- CSS adds ready/caution/danger left-edge treatment to reserve candidates so line-transfer risk is readable at a glance.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x pressure. Pressure cards displayed `戦線転用` and `危険転用`; the selected-frontline reserve candidate displayed `危険転用 / 中央塹壕線も危険 / 評価 -56`; executing rotation still logged a valid `戦闘交代`, and After Action retained `任務 戦闘交代` plus `任務 後衛援護`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-rotation-source-risk-qa-report.json`.

## Implemented Frontline Objective Support Slice - 2026-07-04

Selected frontlines can now coordinate directly with tactical objective nodes instead of relying only on the objective-node button itself.

Implemented:

- `applyFrontlineObjectiveSupport` assigns all living defenders on the selected frontline to support a chosen victory, supply, or visibility node.
- The command reuses objective-response posture, target priority, ammo policy, fallback, supply-depot assignment, and After Action role logic.
- Battle Command selected-frontline panel now shows a `目標連携` section with nearest objective, each objective's control state, distance, defender count, and tactical reason.
- Objective cards use ready/warning/danger styling so contested or lost objectives are visible from the frontline command panel.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle. The selected `森林左翼線` panel displayed `目標連携` cards for `勝利地点`, `補給点`, and contested `視界点`. Clicking `視界点` logged `戦線目標連携: 森林左翼線の2旅団を視界点確保へ寄せる。`; selected-unit orders changed to the objective anchor with `弾性防御` and `敵指揮`; After Action retained `任務 視界点確保` for 第1戦列歩兵大隊 and 衛戍予備歩兵大隊. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-objective-support-qa-report.json`.

## Implemented Objective Staff Recommendation Slice - 2026-07-04

Battle Command now recommends which frontline should support each tactical objective.

Implemented:

- `objectiveStaffRecommendations` scores every victory/supply/visibility node against every frontline segment.
- Scoring accounts for objective urgency, objective control progress, distance, defender count, reserve readiness, and current frontline pressure.
- The `目標参謀判断` panel appears near battle alerts and shows one recommended frontline per objective, including control state, distance, defender count, transfer risk, reason, and evaluation score.
- The `戦線を寄せる` action calls the same `applyFrontlineObjectiveSupport` path as the selected-frontline panel, so After Action role carryover remains unified.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle. The panel showed three cards. `視界点` was prioritized with `視界点制圧 / 争奪 48%`, `推奨 中央塹壕線`, `守備2旅団`, `支援可`, and `評価723`; pressing `戦線を寄せる` logged `戦線目標連携: 中央塹壕線の2旅団を視界点確保へ寄せる。`; After Action retained `任務 視界点確保` for 第4戦列歩兵大隊 and 第6塹壕歩兵大隊. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-staff-recommendation-qa-report.json`.

## Implemented Objective Transfer Forecast Slice - 2026-07-04

Objective staff cards now show the operational cost of pulling a frontline toward an objective.

Implemented:

- `objectiveTransferForecast` estimates the source-line cost of each recommended objective support action.
- The forecast accounts for current source-line pressure, pressure per defender, ready reserve cover, and distance from the line anchor to the objective node.
- Recommendation scoring now applies an additional penalty for dangerous or cautionary transfers, so an urgent objective can still be recommended while showing the cost clearly.
- Each `目標参謀判断` card displays `転用予測` with labels such as `転用許容`, `転用注意`, or `原戦線空白`.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle. The panel showed three cards with transfer forecasts; the first card showed `転用予測 転用注意 / 平常 / 敵圧0 / 1旅団圧0 / 即応予備1 / 移動40`. Pressing the first `戦線を寄せる` still logged `戦線目標連携: 中央塹壕線の2旅団を視界点確保へ寄せる。`; After Action retained two `任務 視界点確保 / 観測線を確保、敵指揮を制圧` role lines. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-transfer-forecast-qa-report.json`.

## Implemented Tactical Objective Runtime Effects Slice - 2026-07-04

Victory, supply, and visibility objectives now affect the live battle, not only After Action.

Implemented:

- `BattleObjectiveState.tacticalEffects` stores live objective-derived battle effects.
- `resolveTick` recalculates tactical effects from current victory/supply/visibility control each tick.
- Victory point control modifies line integrity, making the central point a real battle-pressure stabilizer or liability.
- Supply point control modifies ammunition recovery for non-retreating units while contested/lost supply reduces the value of resting near a failed supply line.
- Visibility point control modifies spotting range and enemy-suppression gain, so losing visibility can hide enemies sooner while holding it improves fire coordination.
- Battle Command HUD now shows `目標効果` beside objective percentages, e.g. `勝利点+4戦線 / 補給+0.16弾薬 / 視界-14 / 制圧-0.08`.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks -> withdraw -> After Action. The HUD changed from initial evaluation to concrete effects; after several ticks it showed `目標効果 勝利点+4戦線 / 補給+0.16弾薬 / 視界-14 / 制圧-0.08`, with `視界 62` and `発見 1/5` reflecting the visibility penalty. After Action still showed tactical objective outcome lines for `勝利点`, `補給点`, and `視界点`. Console errors 0, broken images 0, horizontal overflow false, and QA campaign reset. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-tactical-effects-qa-report.json`.

## Implemented Objective Fire/Intel Runtime Effects Slice - 2026-07-04

Supply and visibility objectives now affect fire-control cost and enemy-wave readability.

Implemented:

- `BattleObjectiveTacticalEffects` now includes `fireMissionAmmoMultiplier`, `waveIntelClarity`, and `waveIntelLabel`.
- `resolveTick` derives the fire-mission ammo multiplier from supply control. A well-held supply point can lower volley/fire-plan ammunition cost, while losing the point makes fire control more expensive.
- `resolveTick` also derives enemy-wave clarity from visibility control. Lost visibility now becomes a readable `敵波不明瞭` state instead of only changing spotting range.
- Manual `issueFireMission` and staged fire-plan activation both multiply their stored ammo cost by the current objective supply multiplier. The multiplier is captured when the fire mission is issued or the plan stage activates.
- Battle Command shows `目標補給 斉射弾薬x...` and `敵波判読 ...` in the selected-unit panel, and also shows `敵波判読` near the battle objective HUD.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks -> withdraw -> After Action. Initial battle showed `斉射弾薬x1.00` and `敵波推定`; after ticks it showed `目標効果 勝利点+4戦線 / 補給+0.16弾薬 / 斉射弾薬x0.86 / 視界-14 / 制圧-0.08 / 敵波不明瞭`, plus `発見 1/5`. After Action still showed tactical objective outcome lines for `勝利点`, `補給点`, and `視界点`. Console errors 0, broken images 0, horizontal overflow false. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-fire-intel-effects-qa-report.json`.

## Implemented Tactical Objective Scenario Roles Slice - 2026-07-04

Tactical objectives now have battlefield identities rather than being only generic victory/supply/visibility circles.

Implemented:

- `BattleObjectiveNode` now carries `scenario`, including label, tagline, effect summary, player/enemy presence multipliers, control drift multiplier, and objective-pressure multiplier.
- Battle creation assigns scenario roles from terrain and facility context. Current examples include `指揮小丘`, `塹壕交差点`, `荷車補給点`, `前線弾薬集積所`, `林縁観測丘`, and `観測塔前哨`.
- `resolveTick` applies scenario multipliers to objective control: some points are easier to hold, some are more vulnerable to enemy pressure, and some contribute more or less to objective-pressure collapse.
- Battle Command objective staff cards, selected-frontline objective-support cards, and map objective nodes now show the scenario label and effect explanation.
- Battle creation log now records objective scenario assignments, e.g. `勝利地点/指揮小丘、補給点/荷車補給点、視界点/林縁観測丘`.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks -> withdraw -> After Action. The battle UI showed `指揮小丘`, `荷車補給点`, and `林縁観測丘`; staff/objective cards showed effect lines such as `保持で発見距離が伸び、喪失で敵波判読が不明瞭になる`; tick progression kept objective effects stable; After Action showed `勝利点保持 71% / 補給点保持 100% / 視界点喪失 8%`. Console errors 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-scenario-roles-qa-report.json`.

## Implemented Tactical Objective Scenario Variants Slice - 2026-07-05

Objective scenario roles now branch by battlefield terrain and structure context instead of only choosing the first generic label per objective type.

Implemented:

- `createBattleState` now picks terrain/structure-specific objective scenario labels and effect text for bridge/rail, village, trench, marsh, hill, supply depot, and observation post contexts.
- Victory objectives can become `鉄道橋頭堡`, `村役場広場`, `塹壕交差点`, `泥濘堤道堡`, or the fallback `指揮小丘`.
- Supply objectives can become `前線弾薬集積所`, `鉄道側線補給所`, `村倉庫補給点`, `板道荷車列`, or the fallback `荷車補給点`.
- Visibility objectives can become `観測塔前哨`, `稜線信号所`, `築堤監視所`, `教会塔観測点`, `葦原監視線`, or the fallback `林縁観測丘`.
- The battle log, objective staff recommendation cards, selected-frontline objective-support cards, map objective nodes, and HUD use the same scenario labels/effect text.
- Desktop browser QA verified Strategic Map -> Camp -> Deployment -> Battle. The default Active Front `forest/marsh/trench` battle showed `目標地形: 勝利地点/塹壕交差点、補給点/板道荷車列、視界点/葦原監視線。`, plus matching map nodes and objective staff/support card labels. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, visible save v8, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-objective-scenario-variants-qa-report.json`.

## Implemented Tactical Objective Scenario Events Slice - 2026-07-04

Tactical objectives now emit live battlefield events when control degrades.

Implemented:

- `BattleObjectiveNode.eventState` stores stable, strained, or critical objective events.
- Victory objectives can degrade from `信号維持` to `信号線混乱` or `指揮信号途絶`, affecting line integrity.
- Supply objectives can degrade from `補給整理` to `補給路混乱` or `補給点炎上`, affecting ammunition recovery.
- Visibility objectives can degrade from `観測継続` to `観測線乱れ` or `観測点沈黙`, affecting spotting.
- `resolveTick` logs event transitions separately from generic control changes, for example `視界点/林縁観測丘: 観測点沈黙。視界-8`.
- `BattleObjectiveState.tacticalEffects` includes event modifiers and a compact `eventSummary`.
- Battle Command shows event state on map objective nodes, selected-frontline objective-support cards, `目標効果`, and a dedicated `目標イベント` HUD item.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks. Initial battle showed `目標イベント 安定` with objective nodes `信号維持`, `補給整理`, and `観測継続`. After ticks, the visibility objective showed `観測点沈黙`, HUD showed `目標イベント 観測点沈黙`, `目標効果 ... イベント 観測点沈黙`, `視界 54`, and `発見 1/8`. Console errors 0, console warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-scenario-events-qa-report.json`.

## Implemented Tactical Objective Event Alert Response Slice - 2026-07-04

Objective events now become actionable battle alerts.

Implemented:

- `BattleAlert` can reference `objectiveNodeId`.
- `createBattleAlerts` adds warning/danger cards for strained or critical objective events before enemy-wave cards can crowd them out.
- Objective alert titles use the battlefield event, e.g. `勝利地点: 指揮信号途絶` or `視界点: 観測点沈黙`.
- Alert details include the scenario role, event effect, control state, and control percentage.
- Clicking an objective alert selects the nearest living brigade and scrolls to the objective position.
- The alert action button uses the existing `applyObjectiveNodeResponse` path, so objective response roles, StandingOrders, and After Action carryover remain consistent.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks -> objective alert action. Alerts showed `勝利地点: 指揮信号途絶 ... 勝利点奪回 目標3部隊` and `視界点: 観測点沈黙 ... 視界点奪回 目標3部隊`; pressing `視界点奪回` logged `警報対応: 第2工兵中隊へ視界点奪回を適用。` and `目標対応: 視界点奪回へ3旅団を投入。担当戦線 塹壕補修線。`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-event-alert-response-qa-report.json`.

## Implemented Objective Event Response Assessment Slice - 2026-07-04

Objective event responses now become evaluated battle lessons rather than only visible alerts.

Implemented:

- `BattleResult.objectiveEventResponseOutcomes` records event-response assessments for units with objective-response duties.
- Each assessment compares final objective control and final event severity, then labels the response as `再確保`, `遅滞`, or `未回復`.
- After Action shows a dedicated `目標イベント対応` box and per-unit objective-event rows.
- `applyBattleResult` writes the first objective-event response summary into the campaign message and writes per-unit `目標イベント対応 ... / 再確保・遅滞・未回復` entries into brigade history.
- `tacticalLessons.ts` reads objective-event response histories and can generate small next-battle readiness/control lesson previews, so failed retakes still become operational learning instead of pure dead text.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks -> `視界点奪回` alert action -> withdraw -> After Action -> apply result. After Action showed `目標イベント対応` entries for 第4戦列歩兵大隊, 東方辺境猟兵隊, and 第2工兵中隊 as `観測点沈黙に対応、未回復（支配0%）`, per-unit rows showed `目標イベント 視界地点/林縁観測丘 / 観測点沈黙 / 未回復`, and `次戦教訓 目標イベント対応1件 / 即応+2`. Applying the result advanced to `第2戦略ターン` and the top campaign message retained the first objective-event response summary. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-event-response-assessment-qa-report.json`.

## Implemented Objective Event Lesson Deployment Recommendation Slice - 2026-07-04

Objective-event response histories now affect the next Deployment standing-order planner.

Implemented:

- `TacticalLessonProfile` stores objective-event response counts split into `再確保`, `遅滞`, and `未回復`.
- `tacticalLessons.ts` infers a preferred doctrine from objective-event type and result. Supply-event lessons can prefer `工兵修理線`; visibility-event failures can prefer `遅滞節約`; recovered visibility events can prefer `殺傷地帯`; victory-event failures can prefer `弾性拒止`.
- Deployment treats objective-event-only lessons as actionable when a preferred doctrine is inferred, so `戦術教訓推奨`, `教訓方針を適用`, and `教訓方針を保存` appear even without a staff-advisory or enemy command-action history.
- Applying the lesson maps into the same StandingOrder draft path as other learned doctrines, and saving writes a lesson-derived StandingOrderTemplate instead of a one-off UI state.
- Desktop 1440px browser QA used an existing post-assessment save where `第4戦列歩兵大隊` had `視界地点/林縁観測丘で観測点沈黙に対応、未回復`. Deployment showed `戦術教訓 目標イベント対応1件 / 得意遅滞節約 / 即応+2 / 統制+0 / 後退判断+2`; applying changed the draft to `姿勢 後退守備 / 優先 敵指揮 / 弾薬 弾薬節約 / 後退 士気54`; saving created a lesson-derived standard order. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-event-lesson-deployment-qa-report.json`.

## Implemented Objective Event Assessment Reason Slice - 2026-07-04

Objective-event responses now explain why the unit succeeded or failed, then preserve that lesson as a machine-readable tag.

Implemented:

- `ObjectiveEventResponseOutcome` now carries `assessmentReason` and `lessonTag`.
- `createBattleResult` derives the reason from final objective control, final event severity, distance to the objective node, morale, ammunition, and remaining strength.
- After Action shows both the high-level summary and per-unit row with the reason, e.g. `未回復（支配0%、到着が遅く目標圏外に留まった）`, plus `教訓 到着遅延`.
- `applyBattleResult` writes the lesson tag into unit history as `目標イベント対応 ... / lessonTag / 支配...`, so Army Camp and later Deployment lesson inference can read the same cause rather than only `未回復`.
- `tacticalLessons.ts` uses lesson tags before generic objective-type fallback: delay/ammo tags bias toward `遅滞節約`, while morale/strength shortage tags bias toward `弾性拒止`.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks -> `視界点奪回・観測復旧` alert action -> After Action -> apply result -> Army Camp. After Action showed `到着が遅く目標圏外に留まった` and `教訓 到着遅延`; after applying results, selecting `第4戦列歩兵大隊` in Army Camp showed the objective-event lesson carryover and `目標イベント対応1件 / 得意遅滞節約`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-event-assessment-reasons-qa-report.json`.

## Implemented Objective Event Response Variants Slice - 2026-07-04

Objective-event response no longer stays a single generic retask button.

Implemented:

- `objectiveResponseTacticalProfile` derives an event-response profile from objective type, event severity, event label, current control, and nearby structure state.
- `applyObjectiveNodeResponse` and selected-frontline objective support use that profile when choosing posture, target priority, ammo policy, unit order, control radius, fallback threshold, reserve-readiness cost, and supply-depot repair/resupply assignment.
- Battle Command surfaces the same profile in objective-node buttons, objective-event alert-card actions, objective staff recommendation cards, and selected-frontline `目標連携` cards.
- The existing carryover path remains unchanged: units still receive objective-response roles, After Action still evaluates `再確保 / 遅滞 / 未回復`, and Deployment lessons still read the resulting history.

Profile rules:

| Event | Tactical response |
| --- | --- |
| `指揮信号途絶` / enemy-held victory point | aggressive retake, intense ammo, largest mass or officer priority, wider control radius, later fallback. |
| `補給点炎上` / supply disruption | engineer/support response, conserve ammo, supply-depot repair or resupply assignment, earlier fallback if ammo is low. |
| `観測点沈黙` / visibility disruption | officer/riflemen priority, aggressive screen on retake or elastic defense on secure, wider control radius, visibility restoration role. |
| Strained event | smaller version of the same response with lower reserve drain and less aggressive ammo use. |

Desktop 1440px QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x objective events -> `視界点奪回・観測復旧` alert action. The battle showed `勝利点奪回・指揮線奪回` and `視界点奪回・観測復旧` on warning cards, objective staff cards, map objective buttons, and selected-frontline objective-support cards. Applying the visibility event response logged both `警報対応` and `目標対応: 視界点奪回・観測復旧`, selected the responding engineer, and showed the resulting StandingOrder as `優先 敵指揮`, `弾薬 通常射撃`, enlarged response radius, and objective anchor. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-objective-event-response-variants-qa-report.json`.

## Implemented Staff Accountability After Action Slice - 2026-07-04

Corps staff assignments now produce post-battle accountability, not only pre-battle stat modifiers.

Implemented:

- `BattleState.staffAccountabilityContext` snapshots the current `参謀長`, `兵站主任`, `工兵主任`, and `砲兵主任` assignments at battle creation.
- `BattleResult.staffAccountabilityEvents` evaluates each staff slot deterministically:
  - `参謀長`: line integrity, outcome, and victory-point state.
  - `兵站主任`: supply objective state, average ammunition, and low-ammo brigade count.
  - `工兵主任`: structure damage, damaged facilities, and overrun facilities.
  - `砲兵主任`: enemy suppression, wave count, and fire-support use.
- After Action shows a `参謀責任` block with `功績 / 警告 / 責任`, trigger, reason, lesson tag, XP, and fatigue.
- `applyBattleResult` writes the same entry into assigned officer history and adds the staff XP/fatigue to persistent officer records.
- Desktop 1440px browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> withdraw -> After Action -> apply result -> Officers. After Action showed four staff-slot lines, e.g. `参謀長 アルンハイム: 警告 / 戦線整理不足`, `兵站主任 ヴェーバー: 功績 / 補給維持`, `工兵主任 メッツ: 功績 / 築城線維持`, and `砲兵主任 バウアー: 警告 / 火力効果限定`. After applying the result, Officers history retained those entries with `経験+...` and `疲労+...`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-staff-accountability-after-action-qa-report.json`.

## Implemented Staff Accountability Recommendation Slice - 2026-07-04

Staff accountability now feeds the next Army Camp recommendation loop.

Implemented:

- `politicalCost.ts` reads officer history entries that match each staff slot label.
- Recent `責任` and `警告` reduce the current staff-slot value, while recent `功績` increases it with recency decay.
- `recommendStaffAssignments` includes the current officer's accountability summary and the proposed candidate's summary in `accountabilitySummary`.
- Army Camp `参謀部推奨` cards show `前戦評価`, so the player can see why a warned staff officer should be replaced or why a merited officer is being retained.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> withdraw -> After Action -> apply result -> Army Camp. After Action produced `参謀長 アルンハイム: 警告 / 戦線整理不足` and `砲兵主任 バウアー: 警告 / 火力効果限定`; Army Camp then showed staff recommendations including `前戦評価: 参謀長警告 / 戦線整理不足 / 戦線整理警告 -> 候補評価なし` and `工兵主任功績 / 築城線維持 / 築城維持`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and no duplicate `前戦評価` prefix. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-staff-accountability-recommendation-qa-report.json`.

## Implemented Frontline Sketch Command Slice - 2026-07-04

Battle Command now has a multi-point spatial sketch tool for frontline-level command.

Implemented:

- Selected frontline command panel has `戦線スケッチ`.
- The first map click sets the selected frontline anchor, the second map click sets the fallback point, and points 3-5 add bend/width intent for the selected line.
- The sketch preview renders a polyline plus visible point markers, then `スケッチ確定` applies the command.
- `sketchFrontlineSegmentPolyline` updates the frontline anchor, fallback point, translated/expanded zone, control radius, and assigned brigade fallback destinations in one domain operation.
- Assigned brigades receive `returning_anchor`, so the next tick explains that they are moving back toward the newly sketched line instead of silently teleporting intent.
- While sketching, map unit tokens, facilities, and objective nodes are pointer-transparent so tactical icons do not swallow command clicks.
- This is still an intent sketch, not yet full freehand curved-line drawing: points 3-5 expand the line's operating zone and control radius rather than storing a true curved geometry.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> `戦線スケッチ` -> map point X52 Y28 -> map point X24 Y34 -> map point X58 Y42 -> `スケッチ確定`. The sketch readout showed `追加点または確定 / 3点指定`, the SVG preview rendered one polyline plus three points, the selected `森林左翼線` panel showed the new anchor and fallback, and the battle log showed `森林左翼線を多点スケッチ更新。3点 / 基準X52 Y28 / 後退X24 Y34 / 幅39。所属旅団は新線へ再整列。`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-polyline-sketch-qa-report.json`.

## Implemented Frontline Plan Save Slice - 2026-07-04

Battle Command can now turn a sketched or manually adjusted line into reusable StandingOrder templates.

Implemented:

- The selected frontline command panel has `戦線方針保存`.
- The action saves every living, non-retreating defender assigned to the selected frontline through the existing per-brigade `StandingOrderTemplate` path.
- The saved template description includes the frontline name plus current anchor and fallback coordinates, for example `森林左翼線で戦闘中に保存した戦線方針。基準X50 Y42 / 後退X24 Y46。次回主戦場の初期配置へ適用する。`.
- The template still remains per-brigade in campaign state, so Deployment, Army Camp, and next-battle creation reuse the same existing saved-standard-order machinery instead of adding a second save format.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> `戦線スケッチ` -> map point X50 Y42 -> map point X24 Y46 -> `戦線方針保存`. The battle log showed saves for `第1戦列歩兵大隊` and `衛戍予備歩兵大隊`, and CDP localStorage inspection found two `standingOrderTemplates` with `frontlineSegmentId: left-flank` and the expected `森林左翼線` description. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-plan-save-qa-report.json`.

## Implemented Frontline Sketch Template Shape Slice - 2026-07-04

Battle-time multi-point sketches now survive as readable saved battle-plan data instead of only changing the current BattleState.

Implemented:

- `FrontlineSegment.sketchPoints` stores the confirmed compacted sketch inside BattleState. Current curve rendering supports up to 8 control points; older QA rows below may still mention the earlier 2-5 point slice as historical evidence.
- `StandingOrderTemplate.frontlineSketchPoints` stores a copy of those points when the selected frontline is saved through `戦線方針保存`.
- Battle Command renders confirmed sketch geometry as a low-contrast saved polyline while the frontline layer is visible.
- Army Camp selected-unit standard-order display shows `戦線形状 N点` plus coordinate preview when a saved template came from a multi-point battle sketch.
- Deployment `保存方針比較` and `保存済み自律方針` rows show the same shape summary, so the player can tell which saved standard orders came from a sketched battle line.
- This is a persistence step for per-brigade standard orders. It is not yet a full campaign-level curved frontline geometry system; `deploymentPlan.frontlineGeometry` still owns the actual pre-battle segment geometry.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 3-point `戦線スケッチ` -> `スケッチ確定` -> `戦線方針保存` -> reload -> Camp -> Deployment. Battle rendered one saved-sketch polyline, Army Camp showed `戦線形状 3点`, and Deployment showed `形状3点` plus `戦線形状 3点 / X52 Y28 -> X24 Y34 -> X58 Y42` in both `保存方針比較` and saved-order list rows. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-frontline-sketch-template-shape-qa-report.json`.

## Implemented Plan-Set Sketch Geometry Slice - 2026-07-04

Saved Battle Command sketch lines can now become Deployment plan-set geometry rather than only per-brigade reminder text.

Implemented:

- `FrontlineGeometryAdjustment.sketchLines` stores segment-scoped sketch point arrays keyed by frontline segment id.
- `applyFrontlineGeometryAdjustment` applies saved sketch lines to segment anchor, fallback, zone height, control radius, and `FrontlineSegment.sketchPoints`.
- Deployment plan-set save/overwrite promotes selected units' saved `StandingOrderTemplate.frontlineSketchPoints` into `frontlineGeometry.sketchLines`.
- Plan-set row descriptions include `形状N線` when the set contains saved sketch frontage.
- Plan-set content preview shows `保存戦線形状 ...`, for example `保存戦線形状 森林左翼線 3点`.
- Applying the plan set rehydrates Deployment preview segments and selected-unit saved-order summaries so `形状3点` / `戦線形状 3点` remain visible after the set is restored.
- This is still segment-scoped polyline intent, not a full arbitrary freehand terrain-painting editor or direct Deployment drag/freehand line editor.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> 3-point `戦線スケッチ` -> `スケッチ確定` -> `戦線方針保存` -> withdraw -> After Action apply -> reload -> Deployment -> `計画セット保存` -> `内容確認` -> `一括適用`. Deployment showed `戦線形状 3点 / X52 Y28 -> X24 Y34 -> X58 Y42`, the plan-set save note showed `計画セット保存時に戦線形状 1線を含める。`, the saved plan row showed `形状1線`, the preview showed `保存戦線形状 森林左翼線 3点`, and applying the plan preserved `形状3点` / `戦線形状 3点`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-frontline-sketch-plan-set-geometry-qa-report.json`.

## Implemented Deployment Frontline Sketch Editor Slice - 2026-07-04

Deployment can now create plan-set sketch frontage without forcing the player to enter Battle Command first.

Implemented:

- The selected-frontline handle editor exposes `現線を形状化`, `北寄せ形状`, `南寄せ形状`, and `形状解除`.
- `現線を形状化` builds a 3-point segment-scoped sketch line from the current segment anchor, fallback, and zone width point.
- `北寄せ形状` and `南寄せ形状` create simple lateral variants for the same segment-scoped sketch model.
- The Deployment frontage preview renders saved sketch lines through `.deployment-sketch-overlay` as a dashed polyline with point markers.
- The existing plan-set save path sees the Deployment-created `frontlineGeometry.sketchLines`, so plan rows show `形状1線` and content preview shows `保存戦線形状 森林左翼線 3点`.
- `形状解除` removes the current segment sketch line, clears the preview overlay, and removes the plan-save shape note.
- This is a button-driven line editor. Full drag/freehand drawing directly on the Deployment map remains a future improvement.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> `現線を形状化` -> `計画セット保存` -> `内容確認` -> `形状解除`. Deployment showed `形状3点`, rendered one sketch overlay polyline, showed `計画セット保存時に戦線形状 1線を含める。`, saved a plan row with `形状1線`, previewed `保存戦線形状 森林左翼線 3点`, then cleared to `形状未保存` / `計画セット用の形状線なし` with overlay count 0. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-frontline-sketch-editor-qa-report.json`.

## Implemented Deployment Map-Click Sketch Editing Slice - 2026-07-04

Deployment can now create and revise a plan-set sketch frontage directly on the tactical frontage preview.

Implemented:

- `地図で描画` toggles a Deployment preview drawing mode for the selected frontline.
- While drawing, the frontage preview shows the current point budget, uses crosshair styling, and renders draft points/line separately from saved sketch geometry.
- The player can place up to 8 points: point 1 becomes anchor intent, point 2 becomes fallback intent, and later points shape the width/curve intent.
- `描画確定` commits the draft into `frontlineGeometry.sketchLines[segmentId]`, exits drawing mode, and reuses the existing `applyFrontlineGeometryAdjustment`/plan-set save path.
- `1点戻す` removes the latest draft point, so the player can correct a mistaken click before committing.
- `既存線を編集` loads the current saved segment sketch back into the draft, allowing point additions and re-confirmation without clearing the line first.
- Existing quick actions (`現線を形状化`, `北寄せ形状`, `南寄せ形状`, `形状解除`) remain available for non-click editing.
- This click-to-place editor was later extended with desktop drag capture and smooth SVG curve rendering while preserving the same segment-scoped point-list save format.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> `地図で描画` -> preview clicks at X78 Y10, X28 Y88, X96 Y48 -> `計画セット保存` -> `内容確認`. The third click auto-confirmed `形状3点`, rendered one saved sketch overlay polyline, showed `計画セット保存時に戦線形状 1線を含める。`, saved a plan row with `形状1線`, and previewed `保存戦線形状 森林左翼線 3点` with `X78 Y10 -> X28 Y88 -> X96 Y48`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-map-click-sketch-editor-qa-report.json`.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> `地図で描画` -> 2 point draft -> `1点戻す` -> 3 point confirm -> `既存線を編集` -> 4 point confirm -> `計画セット保存` -> `内容確認`. The UI showed `戦線描画 2/5`, then `戦線描画 1/5` with `描画確定` disabled, then `形状3点`, then reloaded the existing 3 draft points, saved `形状4点`, showed `計画セット保存時に戦線形状 1線を含める。`, saved a plan row with `形状1線`, and previewed `保存戦線形状 森林左翼線 4点`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-map-click-sketch-editing-qa-report.json`.

## Implemented Deployment Saved Plan Compare Slice - 2026-07-04

Deployment can now treat saved battle plans as something the player can inspect and restore, not only a hidden next-battle modifier.

Implemented:

- The selected brigade planner now shows `保存方針比較`.
- The panel compares `現在ドラフト` against `保存済み標準` using compact chips for frontline, anchor, fallback, posture, target priority, ammo policy, facing, control radius, and facility duty.
- The comparison lists changed areas such as `姿勢 / 弾薬方針 / 後退線`.
- `保存方針へ戻す` restores the current Deployment draft from the saved `StandingOrderTemplate`; it disables itself again when the draft matches the saved template.
- The right-side `保存済み自律方針` list now has `比較` buttons for templates whose unit is currently deployed, selecting that brigade in the planner.
- Saved templates are still aligned to the current sector deployment limits before comparison, so the chips show legal pre-battle placement while the template description keeps the original battle-sketch coordinates.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> `戦線スケッチ` -> `戦線方針保存` -> reload -> Deployment. The planner showed `保存方針比較`, `現在ドラフト`, `保存済み標準`, two saved-list rows, and `比較` buttons. Changing the draft to `弾性防御` produced `差分 姿勢 / 弾薬方針 / 後退線`; clicking `保存方針へ戻す` returned the diff to `なし` and disabled the restore button. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-deployment-saved-plan-compare-qa-report.json`.

## Implemented Standing Order Plan Set Slice - 2026-07-04

Deployment now supports named multi-brigade battle plans rather than only per-brigade standard orders.

Implemented:

- `CampaignState.standingOrderPlanSets` stores named plan sets from save v7; save v8 adds plan-set withdrawal rear-guard ids.
- A plan set contains operation id, sector id, frontline geometry, reserve doctrine, designated reserve ids, and each selected brigade's StandingOrder.
- Deployment has `計画セット保存`, which saves the current selected deployment as `戦線計画 N`.
- The right-side `戦線計画セット` panel lists saved sets with matched selected-unit count, for example `合致 7/7旅団`, plus changed-order count for the current deployment draft.
- `内容確認` previews whether the set was saved for the current battlefield, its saved frontline geometry, reserve doctrine, designated reserve count versus current reserves, and up to three missing brigade names.
- The expanded preview now includes a readiness label (`即適用可 / 差分あり / 欠員あり / 別戦場計画`) and per-brigade changed-field rows. Each row names the brigade, lists changed fields such as `担当戦線 / 基準位置 / 姿勢 / 優先目標 / 弾薬方針 / 後退線 / 統制半径 / 施設担当 / 射界`, and shows the saved posture/target/ammo summary before the player commits to `一括適用`.
- `名前編集`, `上書き`, and `削除` are implemented. Overwrite refreshes the saved StandingOrders/frontline/reserve data from the current Deployment draft while preserving the plan-set name. Delete removes the set from persisted storage.
- `一括適用` restores matching deployed brigades' drafts from the saved plan set, applies the saved frontline geometry, reserve doctrine, and designated reserves, and writes the deployment plan through the normal DeploymentPlan path.
- Per-brigade `StandingOrderTemplate` records are not overwritten by plan-set apply. The player still uses `方針保存` when a restored draft should become a brigade standard order.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> `計画セット保存`, localStorage `saveVersion: 7`, `standingOrderPlanSets.length: 1`, 7 plan entries, then changed the selected brigade to `弾性防御` and clicked `一括適用`. The selected summary returned to `姿勢 固守` and `通常射撃`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. The QA campaign was reset afterward. Mobile QA is outside the current target. QA report: `outputs/takawasi-standing-order-plan-set-qa-report.json`.
- Desktop 1440px browser QA then verified plan-set management: `内容確認`, rename from `戦線計画 1` to `東方標準防衛線`, changed current posture to create `差分 1`, `上書き` returned it to `差分 0` while preserving the name, `一括適用` restored `姿勢 弾性防御`, and `削除` returned the panel to empty-state copy with persisted plan-set count 0. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile QA is outside the current target. QA report: `outputs/takawasi-standing-order-plan-set-management-qa-report.json`.
- Desktop 1440px browser QA then verified detailed apply preview: after saving `戦線計画 1`, changing the selected brigade to `弾性防御` and `集中射撃`, and opening `内容確認`, the row showed `差分 1 / 差分あり`; the expanded preview showed `第1戦列歩兵大隊` with `姿勢 / 弾薬方針 / 後退線` and the saved summary `固守 / 最接近 / 通常射撃`. Pressing `一括適用` returned it to `差分 0 / 即適用可` and showed `旅団方針差分なし`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile QA is outside the current target. QA report: `outputs/takawasi-standing-order-plan-set-diff-preview-qa-report.json`.

## Implemented Battle Withdrawal Forecast Slice - 2026-07-04

Battle Command now treats withdrawal as a tactical judgment instead of only a panic button.

Implemented:

- A `撤退予測` panel appears below the battle command ribbon.
- The panel derives a staff estimate from line integrity, objective pressure, active soldiers, current casualties, hospital support, low-state brigades, damaged/overrun structures, objective control, and enemy suppression.
- It shows a tone (`秩序撤退可能`, `撤退で古参温存`, or `即時撤退推奨`), a recommendation, and compact chips for `戦線維持`, `崩壊圧`, `残存`, `永久損耗見込`, `戦利品効率 46%`, and `補給消費 中`.
- The forecast explains why withdrawal is becoming attractive or dangerous, e.g. low-state units, abandoned facilities, objective loss such as `視界点喪失`, or low enemy suppression.
- `撤退` is renamed `撤退実行` and disables once the battle is finished, while the existing `createBattleResult` remains the authoritative result generator.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle. Initial battle showed `撤退予測 / 秩序撤退可能 / 戦線維持 100% / 戦利品効率 46%`; after running at 3x, the panel changed to `withdrawal-forecast-panel warning` with `撤退で古参温存`, `戦線維持 87%`, and `視界点喪失`. A late press after collapse still produced `戦果報告へ`; a second immediate-withdrawal pass produced `戦闘撤退`, disabled `撤退実行`, opened After Action, and showed `東方辺境防衛線から戦闘撤退した。`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-battle-withdrawal-forecast-qa-report.json`.

## Implemented Withdrawal Rear-Guard After Action Slice - 2026-07-04

Withdrawal now produces a readable rear-guard story instead of only a lower reward outcome.

Implemented:

- `BattleResult.withdrawalRearGuard` records the brigades that covered the withdrawal.
- Rear-guard candidates are scored from reserve readiness, ammo, morale, current battle role, `fallback_guard`/reserve-line posture, fire-support posture, and casualty pressure.
- Each entry records the unit, a role label (`後衛援護`, `支援射撃`, or `離脱掩護`), a deterministic `追撃被害...抑止` value, and a reason string.
- Rear-guard units gain a small XP bonus and a commendation such as `後衛援護で追撃被害15抑止`.
- After Action shows a `撤退後衛` section, and applying the result carries the pursuit-prevention summary into the campaign message plus each rear-guard unit's battle history.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> Battle -> `撤退実行` -> After Action -> `結果を反映して幕舎へ`. After Action showed `撤退後衛`, `後衛3部隊が追撃被害32相当を抑止。追撃圧18。`, and per-unit lines for `第3野戦砲兵中隊`, `衛戍予備歩兵大隊`, and `第1戦列歩兵大隊`; after applying the result, Army Camp carried `後衛3部隊が追撃被害32相当を抑止。` in the last message and unit history contained `撤退後衛` / `追撃被害`. Console errors/warnings 0, broken images 0, horizontal overflow false, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-withdrawal-rearguard-after-action-qa-report.json`.

## Implemented Withdrawal Rear-Guard Loss Slice - 2026-07-04

Withdrawal rear guards now pay a visible cost.

Implemented:

- `BattleResult.withdrawalRearGuard` entries now include `rearGuardCasualties`, `riskLabel`, and `eventLabel`.
- `createBattleResult` adds rear-guard casualties into `rawCasualtiesByUnit`; field-hospital recovery then produces the final permanent casualty count from that combined loss.
- Rear-guard commendations now include both pursuit prevention and rear-guard loss, e.g. `後衛援護で追撃被害12抑止・後衛損耗17`.
- After Action shows the withdrawal summary as `追撃被害...抑止、後衛損耗...` and each rear-guard unit line includes `後衛損耗` plus `軽微 / 消耗 / 危険`.
- Campaign application writes the same loss/risk text into unit battle history, so the cost remains visible in Army Camp after result application.
- Desktop browser QA verified reset -> Camp -> Deployment -> assign `第1戦列歩兵大隊` as `撤退後衛` -> Battle -> `撤退実行` -> After Action -> apply result -> reset. After Action showed `後衛3部隊が追撃被害39相当を抑止、後衛損耗38。追撃圧18。`; `第1戦列歩兵大隊` showed `追撃被害12抑止 / 後衛損耗17 / 消耗` and casualty line `戦闘損耗 17 / 収容 0 / 永久損耗 17`; Army Camp carried `後衛損耗38` in the last message and `撤退後衛 ... 後衛損耗17/消耗` in unit history. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-withdrawal-rearguard-loss-qa-report.json`.

## Implemented Withdrawal Rear-Guard Officer Risk Slice - 2026-07-04

Withdrawal rear guards now also create command risk.

Implemented:

- Brigade officer risk now counts rear-guard casualties in the casualty ratio used by `officerRiskForUnit`.
- Rear-guard `riskLabel` adds deterministic officer-risk pressure: `危険` costs more than `消耗`, and both cost more than `軽微`.
- Officer wound checks use the same rear-guard-adjusted casualty ratio and risk score.
- After Action `将校戦果` appends `撤退後衛消耗/危険` and `後衛損耗...` to officers commanding rear-guard brigades.
- Campaign application writes the same rear-guard officer-risk text into the Officers tab history, so repeated use of the same commander as rear guard remains visible.
- Desktop browser QA verified reset -> Camp -> Deployment -> assign `第1戦列歩兵大隊` as `撤退後衛` -> Battle -> `撤退実行` -> After Action -> apply result -> Officers tab -> reset. After Action showed `第1戦列歩兵大隊指揮官: 後衛援護、指揮経験+3、危険度41、撤退後衛消耗、後衛損耗17、負傷なし`, `第3野戦砲兵中隊指揮官: 火力支援、指揮経験+4、危険度60、撤退後衛危険、後衛損耗7、負傷、復帰まで2ターン`, and `負傷将校 1名`; Officers tab history carried `危険度41、撤退後衛消耗、後衛損耗17` and `危険度60、撤退後衛危険、後衛損耗7、負傷`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-withdrawal-rearguard-officer-risk-qa-report.json`.

## Implemented Deployment Rear-Guard Plan Slice - 2026-07-04

Withdrawal rear guard is now a pre-battle plan, not only an automatic after-action interpretation.

Implemented:

- `DeploymentBattlePlan.rearGuardUnitIds` stores selected main-battle brigades assigned to cover withdrawal.
- `StandingOrderPlanSet.rearGuardUnitIds` stores the same rear-guard designation in named battle plans, previews saved/current rear-guard count, and restores it through plan-set apply.
- Deployment shows `撤退後衛 N/3`, adds a `撤退後衛にする` / `後衛指定を解除` planner action, and marks assigned cards with a `撤退後衛` badge.
- Battle creation moves designated rear guards to the reserve/rear line, gives them `fallback_guard` or artillery fire-support posture, ammo conservation, rear fallback, officer/largest-mass priority, higher readiness, and `frontlineRotationRole: rear_guard_cover`.
- Withdrawal After Action then favors those planned units for `撤退後衛` pursuit-damage prevention, XP, commendations, officer/division result text, and unit-history carryover.
- Save migration is now v8; old saves normalize missing deployment-plan and plan-set rear-guard arrays to empty arrays.
- Desktop 1440px browser QA verified reset -> Camp -> Deployment -> select `撤退後衛にする` for `第1戦列歩兵大隊` -> Battle -> immediate `撤退実行` -> After Action -> apply result -> reset. Deployment showed `撤退後衛 1/3` and a rear-guard-planned card; Battle log showed `撤退後衛計画: 1旅団を離脱援護に指定。`; the selected brigade started on `後方砲兵線` with `姿勢 後退守備`, `目標 敵指揮`, `弾薬 弾薬節約`, and `予備即応 81`; After Action showed `第1戦列歩兵大隊: 後衛援護 / 追撃被害12抑止`; Army Camp carried `後衛3部隊が追撃被害39相当を抑止。追撃圧18。` plus unit history containing `撤退後衛` / `追撃被害12抑止`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, visible save `v8`, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-rearguard-plan-qa-report.json`.

## Implemented Deployment Rear-Guard Advisor Slice - 2026-07-04

Deployment now warns the player before making a withdrawal rear-guard assignment.

Implemented:

- Deployment computes a `撤退後衛判断` advisor from selected brigades, current enemy pressure, operation risk, command-wave chance, draft StandingOrder role, reserve/rear-guard status, ammunition, morale, command overload, and engineer burden.
- The selected-unit planner shows rear-guard suitability, estimated casualties, officer risk, and a short Japanese reason such as `通常戦線から抽出` or `後衛指定済み`.
- The advisor ranks up to four candidate brigades with `推奨 / 注意 / 危険`, suitability, expected loss, and officer-risk values; clicking a candidate switches the selected planner unit before pressing `撤退後衛にする`.
- Pressing `撤退後衛にする` updates the same advisor immediately, raises the chosen unit's suitability for rear-guard duty, changes the reason to `後衛指定済み`, and keeps the `撤退後衛 N/3` count in sync.
- Desktop browser QA verified reset -> Camp -> Deployment. The initial advisor showed four candidates including `第3野戦砲兵中隊 危険 / 適性88 / 損耗8 / 将校危険54`; selecting `衛戍予備歩兵大隊` changed the planner line to `適性74 / 予測損耗30 / 将校危険50`; assigning it changed the line to `適性96 / 予測損耗32 / 将校危険51 / 後衛指定済み`; starting battle produced `撤退後衛計画: 1旅団を離脱援護に指定。` and the unit entered as `後衛` with `後退守備`, `敵指揮`, and `弾薬節約`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-rearguard-advisor-qa-report.json`.

## Implemented Deployment Rear-Guard Comparison Slice - 2026-07-04

The rear-guard advisor now exposes the tradeoff instead of only showing raw risk.

Implemented:

- Each candidate has `推奨度`, `追撃抑止`, and `温存余地` in addition to suitability, predicted loss, and officer risk.
- Candidate rows now show a tradeoff label such as `追撃抑止高・将校危険`, `均衡候補`, `将校温存寄り`, `追撃抑止寄り`, or `限定投入`.
- `推奨候補を後衛指定` selects and assigns the current best candidate through the same `deploymentPlan.rearGuardUnitIds` path used by manual rear-guard designation.
- Desktop browser QA verified reset -> Camp -> Deployment -> `推奨候補を後衛指定` -> Battle. The initial advisor showed `第1戦列歩兵大隊: 適性65 / 予測損耗32 / 将校危険48`, comparison `推奨度38 / 追撃抑止30 / 温存余地30`, and recommended `第3野戦砲兵中隊 / 追撃抑止高・将校危険`; pressing the recommendation button changed the planner to `第3野戦砲兵中隊: 適性100 / 予測損耗8 / 将校危険54`, comparison `推奨度76 / 追撃抑止95 / 温存余地37`, reason `後衛指定済み / 予備線適性 / 火力支援可`, and `撤退後衛 1/3`. Battle start logged `撤退後衛計画: 1旅団を離脱援護に指定。`. Desktop 1440x900 QA also verified the advisor, recommendation button, tradeoff values, no horizontal overflow, broken images 0, console errors/warnings 0, and no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-rearguard-comparison-qa-report.json`.

## Implemented Withdrawal Rear-Guard Prediction Review Slice - 2026-07-04

Rear-guard planning now creates an after-action learning loop instead of ending at assignment.

Implemented:

- `BattleState.withdrawalRearGuardPlanAssessments` stores a battle-start snapshot for planned rear guards: predicted casualties, predicted officer risk, pursuit cover, preservation score, recommendation score, tradeoff label, and reason.
- `createBattleState` writes a `後衛予測` battle log entry for planned rear guards, so the prediction is visible before the withdrawal result exists.
- `BattleResult.withdrawalRearGuardPlanAssessments` carries the prediction snapshot into After Action.
- After Action now shows `撤退後衛照合`, comparing `予測損耗 -> 実損耗`, `予測将校危険`, `追撃抑止`, `温存`, tradeoff label, and a short result label such as `損耗予測内`.
- Campaign application writes the same prediction-vs-actual rear-guard note into the planned rear-guard unit history.
- Desktop browser QA verified reset -> Camp -> Deployment -> `推奨候補を後衛指定` -> Battle -> `撤退実行` -> `戦果報告へ` -> apply result. Battle log showed `後衛予測: 第3野戦砲兵中隊 損耗8/将校危険54/抑止85。`; After Action showed `撤退後衛照合`, `予測損耗8 -> 実損耗7`, `予測将校危険54`, `追撃抑止85`, `温存37`, and `損耗予測内`; Army Camp retained `予測損耗` and `->実` for the rear-guard unit. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, visible save v8, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-withdrawal-rearguard-prediction-after-action-qa-report.json`.

## Implemented Field Hospital Evacuation-Line Slice - 2026-07-05

Field hospitals now matter at unit-position level, not only as a global post-battle recovery modifier.

Implemented:

- `BattleResult.medicalRecoveryDetails` stores base recovered, bonus recovered, effective recovery rate, source label, and reason for each brigade.
- `createBattleResult` checks functioning `fieldHospital` structures and compares their support radius against each unit's standing-order fallback destination and final battle position.
- Units close to the hospital support line receive extra recovered wounded; fallback-guard/retreating context can add a small evacuation-route bonus.
- After Action shows a `救護線` box with rows such as `第2工兵中隊: 追加収容+2 / 実効収容率22% / 野戦病院支援圏 / 後退点20 / 現位置45`, and each affected unit casualty row repeats the bonus.
- Campaign application writes the same rescue-line note into the selected brigade's `battleHistory`, so Army Camp preserves why permanent casualties were lower.
- Desktop browser QA verified reset -> Camp -> Engineering -> build `野戦病院` -> Deployment -> Battle -> 3x -> withdraw -> After Action -> apply -> select `第2工兵中隊`. After Action showed `救護線`, `追加収容+`, and `実効収容率`; Army Camp unit history retained `救護線 追加収容+2/野戦病院支援圏 / 後退点20 / 現位置45`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, visible save v8, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-field-hospital-evacuation-line-qa-report.json`.

## Implemented Facility Tactical-State Slice - 2026-07-05

Defensive works now expose battlefield state directly, so facilities are easier to command around before they are already destroyed.

Implemented:

- `BattleStructure` carries runtime `tacticalPressure`, `repairRate`, `assignedUnitIds`, `facilityState`, and `facilityStateLabel`.
- `resolveTick` recalculates those values every tick from nearby enemy pressure, assigned facility defenders, and engineer repair output.
- Facility states currently read as `安定`, `接敵`, `修理中`, `危険`, or `制圧`.
- Battle Command map-structure cards show facility state, durability, threat, repair rate, assigned count, and assigned brigade names.
- Facility alert cards can now fire for pressure, repair lag, or missing assignment before waiting for a structure to become damaged/overrun.
- The alert action still uses the existing StandingOrder path: repair pressure routes engineers toward `工兵支援`, while defense pressure assigns defenders to the facility.
- Desktop browser QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x ticks. The trench structure card showed `安定 / 稼働中`, `脅威0 / 修理0.2 / 担当5`, a `facility-secure` class, and assigned brigade names. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, visible save v8, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-facility-tactical-state-qa-report.json`.

## Implemented Facility Assault Response Slice - 2026-07-05

Facility raids now have a player-side counter-command instead of only becoming a visible enemy intention.

Implemented:

- Battle Command raises `施設即応` alerts when spotted enemies have `assaultPlan.targetStructureId`.
- Facility assault alerts are sorted above generic warnings, so a targeted trench/depot/hospital does not get hidden behind line or wave alerts.
- `applyFacilityDefenseResponse` retasks selected/group candidates through StandingOrders: assigned defenders, a nearby engineer, and reserve candidates can be moved to the threatened structure.
- The response sets facility duty to `defend`, `repair`, or `resupply`, chooses target priority from the raiding enemy mix, focuses a spotted assailant when possible, and spends reserve readiness from committed units.
- Engineers assigned to a damaged or contested structure switch to `工兵支援`; other defenders hold the structure with a larger control radius and fallback route.
- Desktop QA verified Strategic Map -> Camp -> Deployment -> Battle -> 3x wave pressure. The alert row showed `施設即応`, clicking the group response logged `警報一括対応: 6部隊へ施設即応を適用。` and `施設即応: 塹壕線へ6部隊を投入。アンデッド群集を指名。`; unit cards then showed `行動: 担当施設へ移動`, `施設 塹壕線 防衛`, an engineer on `施設 塹壕線 修理`, and target priority/focus updates. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`. The battle collapsed later under high 3x QA pressure, and the campaign was reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-facility-assault-response-qa-report.json`.

## Implemented Facility Duty After-Action Carryover Slice - 2026-07-05

Facility response now feeds the growth loop instead of ending as a temporary map order.

Implemented:

- `BattleUnit.facilityResponseRole` marks player-triggered facility intervention as battle-runtime state only.
- `assignFacilityToUnit` and `applyFacilityDefenseResponse` set that marker from the chosen duty: defense, repair, or resupply.
- BattleResult converts the marker into roles `施設防衛`, `施設修理`, or `補給拠点勤務`.
- Facility roles now receive role XP, officer XP, and commendations such as `防衛施設へ即応`, `施設襲撃群を指名`, `損傷施設を修復`, or `補給拠点を維持`.
- After Action shows those roles in the per-unit result rows, and campaign application writes the same role/commendation text into each brigade's `battleHistory`.
- Desktop QA verified reset -> Camp -> Deployment -> Battle -> `施設即応6部隊` -> `戦果報告へ` -> apply result. After Action showed multiple `任務 施設防衛 / 防衛施設へ即応、施設襲撃群を指名` rows and one engineer row `任務 施設修理 / 損傷施設を修復`; officer result lines also used `施設防衛` and `施設修理`. After applying the result, Army Camp unit history retained `東方辺境防衛線防衛戦: 戦線崩壊、施設防衛、... 防衛施設へ即応・施設襲撃群を指名`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and the campaign was reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-facility-duty-after-action-qa-report.json`.

## Implemented Facility Duty Tactical-Lesson Slice - 2026-07-05

Facility duty history now changes the next battle's pre-battle advice instead of staying as a passive diary line.

Implemented:

- `tacticalLessonProfileForUnit` counts `施設防衛`, `施設修理`, and `補給拠点勤務` battle-history entries.
- Facility defense contributes to reserve readiness/control radius and prefers `戦線固守`.
- Facility repair and resupply contribute to readiness/control/fallback judgment and prefer `工兵修理線`.
- After Action previews facility lessons before result application, such as `次戦教訓 施設襲撃対応 / 得意戦線固守 / 即応+2 / 統制+1` and `次戦教訓 損傷施設修理 / 得意工兵修理線 / 即応+1 / 統制+1 / 後退判断+1`.
- Deployment treats facility duty as actionable, so `戦術教訓推奨`, `教訓方針を適用`, and `教訓方針を保存` appear for facility-learned brigades.
- Desktop QA verified reset -> Camp -> Deployment -> Battle -> `施設即応6部隊` -> `戦果報告へ` -> apply result -> next-turn Deployment. After Action showed facility next-battle lessons for line brigades and the engineer. Next-turn Deployment showed `戦術教訓 施設任務1件 / 得意戦線固守 / 即応+1 / 統制+1`, `戦術教訓推奨`, and `次戦初動は戦線固守を推奨`; pressing `教訓方針を適用` kept the draft at `姿勢 固守 / 優先 最接近 / 弾薬 通常射撃`. Selecting `第2工兵中隊` showed `戦術教訓 施設任務1件 / 得意工兵修理線 / 即応+1 / 統制+1 / 後退判断+1` and `次戦初動は工兵修理線を推奨`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and QA campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-facility-duty-tactical-lesson-qa-report.json`.

## Implemented Deployment Drag Freehand Sketch Slice - 2026-07-05

Deployment line planning now supports direct desktop drag drawing in addition to point-by-point sketch entry.

Implemented:

- `DeploymentScreen` keeps the existing `FrontlineGeometryAdjustment.sketchLines` save format, but `地図で描画` now accepts pointer drag on the deployment preview.
- Dragged paths are sampled and simplified into 2-5 tactical control points, so the result remains readable as a command frontage rather than an unbounded freehand blob.
- Click point-editing, `1点戻す`, `描画確定`, `既存線を編集`, button-generated variants, saved-template sketch carryover, and plan-set `sketchLines` remain compatible because the stored shape is still the same point list.
- During sketch mode, deployment segment buttons stop capturing pointer events, allowing the map surface to receive drag input. Outside sketch mode, segment buttons still select/assign frontlines normally.
- Desktop QA verified reset -> Camp -> Deployment -> `地図で描画` -> drag across the preview. The draft showed `クリック/ドラッグ 5/5` with five SVG points; `描画確定` saved `形状5点`; the plan note showed `計画セット保存時に戦線形状`; starting battle showed `展開 戦区標準+手動1` and a battle-map polyline. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, viewport reset, and campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-drag-sketch-qa-report.json`.

## Implemented Curved Frontline Sketch Slice - 2026-07-05

Deployment and Battle Command now render multi-point frontage as a smooth command curve while keeping the existing point-list save format.

Implemented:

- `src/game/battle/sketchLines.ts` centralizes sketch-line compaction, the 8-point cap, SVG polyline serialization, and smooth SVG path generation.
- Deployment drag paths now compact to up to 8 tactical control points instead of 5, making a drawn line feel closer to freehand while still remaining bounded and readable.
- Deployment draft/saved sketches and Battle Command saved frontline sketches render 3+ points as SVG `<path>` curves; 2-point sketches still render as straight polylines.
- `frontlineDefaults.ts` and `orders.ts` use the same compaction cap, so BattleState creation, Battle-time sketching, and Deployment plan-set sketch carryover agree on the same point budget.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> `地図で描画` -> drag curved frontage -> draft `クリック/ドラッグ 8/8` with 8 points and one draft path -> `描画確定` -> saved `形状8点` with one saved path -> battle start with one `.frontline-saved-sketch-layer path`. Console errors 0, broken images 0, horizontal overflow false, no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-curved-frontline-sketch-qa-report.json`.

## Implemented Enemy Command-Tier Slice - 2026-07-05

Enemy command is now a small hierarchy instead of only commanded/disrupted state and a shared intent label.

Implemented:

- `EnemyAssaultPlan` carries `commandTier` and optional `commandParentId` in addition to role, intent, group id, and label.
- `waves.ts` assigns four visible tiers: `波指揮核` for undead officers, `突撃先導` for brutes or facility raiders, `支援節` for riflemen, and `前衛群` for mass infantry groups.
- `resolveTick` applies tier-specific pressure and morale-recovery modifiers. `突撃先導` increases directed pressure while commanded, `支援節` helps morale sustainment, and disrupted assault leads lose more effective pressure.
- Battle Command enemy command-network cards show a tier summary such as `階梯 突撃先導2` or `階梯 支援節1`. Enemy map labels and the inspected enemy panel show the specific tier plus parent/group context.
- Desktop QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves. Enemy command cards showed `階梯 突撃先導2`, `階梯 支援節1`, and `階梯 前衛群1`; enemy labels showed `波指揮核`, `突撃先導`, `支援節`, and `前衛群`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, viewport reset, and campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-enemy-command-tier-qa-report.json`.

## Implemented Enemy Command-Tier Recommendation Slice - 2026-07-05

Enemy command hierarchy now points to a player action instead of only exposing labels and raw command-network buttons.

Implemented:

- Battle Command enemy command-network cards derive `推奨 指揮核射撃/崩壊追撃/予備投入` from command tier counts, total pressure, pursuit opportunity, lead threat, and breakthrough/facility context.
- `突撃先導` under breakthrough or heavy pressure recommends reserve commitment, `支援節` or wave command nodes recommend command-node fire, and clear collapse opportunities recommend pursuit.
- The new `推奨実行` button dispatches the existing `指揮核射撃`, `崩壊追撃`, or `予備投入` functions, so battle logs, queued-command compatibility, and After Action/unit-history roles remain on the established command-network path.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves. Cards showed recommendations for `突撃先導2`, `支援節1`, and `前衛群1`; pressing `推奨実行` produced `敵指揮網対応: 第2波指揮核へ予備投入。中央塹壕線に1旅団を接続。`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, viewport reset, and campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-enemy-command-tier-recommendation-qa-report.json`.

## Implemented Enemy Command Response-Forecast Slice - 2026-07-05

Enemy command recommendations now show the expected tactical cost/effect before the player commits.

Implemented:

- Each enemy command-network card adds a `予測` row below the recommendation.
- `指揮核射撃` forecasts command disruption, participating brigades, high ammo spend, and the likely command target.
- `崩壊追撃` forecasts regroup-prevention, participating brigades, mobility pressure, and the pursuit opportunity score.
- `予備投入` forecasts breach sealing, reserve count, `即応-32` cost per committed reserve, current defender count, line name, and lead threat.
- Forecast rows use `effect/cost/risk` tones while keeping all execution on the existing `推奨実行` and explicit command-network action paths.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves. Cards showed `予測 突破封鎖 / 予備1 / 即応-32` and `予測 指揮低下 / 2旅団 / 弾薬高`; pressing `推奨実行` still produced `敵指揮網対応: 第2波指揮核へ予備投入。中央塹壕線に1旅団を接続。`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, viewport reset, and campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-enemy-command-response-forecast-qa-report.json`.

## Implemented Enemy Command Response-Status Slice - 2026-07-05

Enemy command cards now tell the player whether a response is still available or already in effect.

Implemented:

- Cards read battle-runtime `enemyCommandActionRole`, `focusTargetId`, and frontline assignment to display `未対応`, `効果中 指揮核射撃`, `効果中 崩壊追撃`, or `効果中 予備接続`.
- Matching actions lock while active. For example, a reserve commitment disables both `推奨実行` when the recommendation is `予備投入` and the explicit `予備投入` button.
- Status rows use `idle/active/locked` tones and keep all execution/result carryover on the existing battle-only command action roles.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves. Cards initially showed `未対応 / 推奨または個別対応を選択可能。`; pressing `推奨実行` produced `効果中 予備接続 / 1旅団が中央塹壕線へ接続中。予備即応を消費済み。`, with `推奨実行` and `予備投入` disabled on the active card. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, viewport reset, and campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-enemy-command-response-status-qa-report.json`.

## Implemented Enemy Command Response-Effect Slice - 2026-07-05

Enemy command cards now measure what the chosen response is doing after execution, not only whether it is active.

Implemented:

- Each command-network card adds a `効果` row below response status.
- Before a response is chosen, the card shows `効果 未測定` and explains that command collapse, cohesion, and line reinforcement will be measured after execution.
- `指揮核射撃` reports disrupted command groups and average remaining command influence.
- `崩壊追撃` reports regrouping/routing suppression, remaining enemies, and average cohesion.
- `予備投入` reports the reinforced frontline, defender count, and current pressure per brigade (`1旅団圧`) so the player can see whether the reserve commitment stabilized the line.
- Effect rows use `idle/effect/cost/risk` tones while keeping execution and carryover on the existing command-action path.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves. Cards initially showed `効果 未測定 / 対応実行後に指揮崩壊、凝集、戦線補強を測定する。`; pressing `推奨実行` produced measured rows such as `効果 戦線補強 / 守備3旅団 / 1旅団圧637` and `効果 戦線補強 / 守備3旅団 / 1旅団圧105`, while active cards showed `効果中 予備接続`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`, and campaign reset afterward. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-enemy-command-response-effect-qa-report.json`.

## Implemented Enemy Command Effect After-Action Slice - 2026-07-05

Battle-time enemy command response effects now survive into the result/growth loop, instead of staying as temporary card text.

Implemented:

- `BattleResult.enemyCommandEffectOutcomes` records command-node fire, collapse pursuit, and command-network reserve commitment outcomes with participating brigade IDs, result label, measured metric, lesson tag, and assessment reason.
- `createBattleResult` evaluates response effects from the same final battle-role source used by After Action roles, with a position-based fallback for reserve commitments whose frontline assignment is not explicit at result time.
- After Action displays `敵指揮網対応評価`, per-brigade `敵指揮網 ... 教訓 ...` rows, and `次戦教訓 指揮網効果...` previews.
- `applyCampaignDelta` writes `指揮網効果 ...` entries into brigade history and includes the first enemy command effect in the campaign result message.
- `tacticalLessonProfileForUnit` counts `指揮網効果` history as small reserve-readiness/control-radius growth, so measured effects reinforce later StandingOrder planning.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x command waves -> `推奨実行` -> withdraw -> After Action. Battle Command showed `効果 戦線補強 / 守備3旅団 / 1旅団圧637`, `1旅団圧105`, and `1旅団圧103`; After Action showed `敵指揮網対応評価 指揮網予備投入: 封鎖安定`, per-unit `指揮網効果 封鎖安定`, and `次戦教訓 指揮網効果1件 / 予備封鎖成功 / 即応+4 / 統制+2`. Console errors 0, broken images 0, horizontal overflow false, no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-enemy-command-effect-after-action-qa-report.json`.

## Implemented Deployment Depth Drag Handle Slice - 2026-07-05

Deployment-depth bands are now directly adjustable on the Deployment frontage preview instead of only through text buttons.

Implemented:

- The active frontline's deployment band shows four compact handles: `後`, `前`, `北`, and `南`.
- Dragging the handles changes `deploymentLimitOffset` and `deploymentLimitSizeOffset` through the existing `adjustFrontlineSegmentGeometry` path, so no new save format is introduced.
- Mouse, pointer, and click-step handling share the same delta path. The click-step fallback keeps the control usable when a browser/device does not deliver continuous drag events.
- Releasing the drag is guarded by pointer/mouse/window release handlers, preventing stuck `dragging` UI state.
- The edited band still appears as `戦区標準+手動1`, updates the visible `許可帯`, persists through `deploymentPlan.frontlineGeometry`, and is consumed by Battle creation through the same deployment-depth clamp path.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> CDP mouse drag on `.deployment-depth-handle.forward`; the planner changed from `許可帯 X6-62 / Y11-36` and `展開 戦区標準` to `許可帯 X6-70 / Y11-36` and `展開 戦区標準+手動1`, with 4 handles visible and no stuck dragging class. Starting battle showed `参加 7旅団`, `展開 戦区標準+手動1`, 7 map units, and 7 unit cards. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-deployment-depth-drag-handle-qa-report.json`.

## Implemented Objective Event Chain Slice - 2026-07-05

Objective events now worsen when the player leaves a critical objective unrecovered, instead of remaining a single static event label.

Implemented:

- `BattleObjectiveEventState` now stores `degradationSeconds`, `chainStage`, `chainLabel`, `chainDetail`, and `chainEffectSummary`.
- `resolveTick` increments the chain timer while the same strained/critical event remains active and resets it when the objective stabilizes or changes event state.
- Victory events can chain into `命令混線` or `指揮崩壊拡大`, supply events can chain into `補給路寸断` or `弾薬誘爆`, and visibility events can chain into `死角拡大` or `霧中突破`.
- Chain stages add extra line-integrity, ammo-recovery, or spotting penalties through `BattleObjectiveState.tacticalEffects`, so the HUD effect is not only text.
- Battle Command alert cards, objective nodes, selected-frontline objective support cards, `目標効果`, and `目標イベント` HUD rows show both event and chain labels.
- `BattleResult.objectiveEventResponseOutcomes` carries `eventChainLabel` and `eventChainStage`; unresolved chained responses can now produce lesson tags such as `連鎖抑止失敗` or `連鎖悪化`.
- `applyBattleResult` writes the event chain label into brigade history so later lesson inference can distinguish a late response from a simple low-control event.
- Desktop 1440px QA verified reset -> Camp -> Deployment -> Battle -> 3x ticks -> objective-event response -> After Action. Battle HUD showed `目標イベント 指揮信号途絶:命令混線 / 観測点沈黙:霧中突破`; `目標効果` showed the added chain penalties; alert cards showed chain labels; After Action showed `目標イベント対応` rows such as `指揮信号途絶/命令混線に対応、未回復` with `教訓 連鎖抑止失敗`. Console errors/warnings 0, broken images 0, horizontal overflow false, no `NaN`. Mobile/cellphone QA is outside the current target. QA report: `outputs/takawasi-objective-event-chain-qa-report.json`.

## Current Known Gap

The current battle map and Deployment scene now support click/tap anchor and fallback assignment, direct drag adjustment of selected-brigade anchor/fallback handles, Battle-time selected-frontline direct adjustment, up-to-8-point `戦線スケッチ` with smooth curve rendering/confirm, Deployment-side map-click and desktop drag sketch drawing with undo, explicit confirm, existing-line re-edit, drag-path simplification into bounded curved frontage, plus button-driven sketch-line creation/variant/clear controls, sketch-point carryover into per-brigade StandingOrderTemplates, plan-set persisted segment-scoped sketch frontage via `FrontlineGeometryAdjustment.sketchLines`, selected-frontline plan save into per-brigade StandingOrderTemplates, Deployment saved-plan comparison/restore selection, named multi-brigade StandingOrder plan sets with preview/rename/overwrite/apply/delete management, battle-only paused command queue, map-coordinate frontline segment assignment, facility assignment, facility tactical-state pressure/repair/assignment display, enemy facility targeting, facility assault-response alerts, facility duty after-action carryover, facility duty tactical lessons, objective-node response commands, objective-event-specific response profiles, selected-frontline objective support commands, objective staff recommendation cards with source-line transfer forecasts, terrain/facility-specific objective scenario variants, objective-response after-action carryover, objective-event response assessment into After Action/unit history/next-battle lessons, objective-event lessons that feed Deployment apply/save recommendations, live tactical objective effects for victory/supply/visibility control, objective-outcome strategic effects, alert-card relevant-unit selection plus single-unit and group recommendation shortcuts, minimap panning, detailed autonomous reason display, selected-unit target audit, selected-unit target-candidate map lines, tactical map layer toggles/legend, frontline terrain assessment, frontline geometry terrain comparison, pre-battle weak-line mitigation advice, mitigation-to-StandingOrder save action, mitigation-to-after-action carryover, Deployment-side deployment-band handle editing plus direct edge drag/click controls, terrain LOS tactical modifiers for high ground and cover edges, deterministic high-ground LOS QA profile, direct focus-target assignment from fireable candidates, battle-time withdrawal forecast for line integrity/collapse pressure/permanent-casualty estimate/objective loss/facility abandonment/spoils and supply tradeoff, Deployment-side withdrawal rear-guard designation/advisor/comparison, and withdrawal rear-guard after-action carryover with pursuit-damage prevention into unit history, field-hospital evacuation-line bonus recovery into After Action/unit history, always-visible frontline pressure summary/response commands, pressure-card fighting rotation plus selected-frontline rotation candidate comparison for withdrawing chosen defenders behind chosen reserve cover with reserve-source risk labels, staff-advisory after-action carryover into unit XP/history and next-battle tactical lesson bonuses, enemy command-action after-action carryover into unit history and next-battle tactical lessons, reserve-readiness-aware pressure responses, Deployment-side reserve doctrine planning, Deployment-side designated reserve unit selection, Deployment-side command-capacity warnings with route back to Officers, Officers-tab overload-fix recommendations, officer rest/return-to-duty rotation, corps-headquarters staff slots with deployment/capacity/readiness effects and staff-duty command burden, staff/division political cost, staff/division replacement recommendation scoring with current battlefield, active staff directive, and persisted enemy-composition context, Theater/Deployment enemy-intel briefings with per-type uncertainty ranges, main-threat role cards, and threat bars, persisted `StrategicOperation.enemyCompositionIntel`, enemy-composition-derived tactical wave timing/command-wave probability, wave timeline UI, recon-confidence-based timeline ambiguity, misinformation-specific timeline styling, first-pass misleading-intel actual wave consequences, misinformation after-action lesson loop, recon-lesson quality bonus, division commander/directive effects, one-division-per-officer commander assignment, division command-duty burden, persistent command fatigue, division commander after-action XP/risk/wound outcomes, Battle Command reserve command panel, battle-role/commendation carryover into unit history, main-battle officer XP/risk/wound carryover into officer history, Officers-tab reassignment/promotion commands, first-pass officer rank/trait battle effects, officer command-capacity/overload effects, enemy intent inspection plus responsible-frontline response/line-volley commands, enemy command hierarchy with command nodes/intents/tiers/tier recommendations/response forecasts/response status/response effect/group labels, enemy command-network group actions for command-node fire, visible collapse-pursuit candidates, and reserve commitment plus After Action/unit-history carryover, tactical objective-node control and response commands for victory/supply/visibility, saved per-brigade standing-order templates, pre-battle standing-order editing, in-battle target-priority/ammo-policy overrides, battle-only focus-fire target marking, battle-only volley fire missions, coordinated multi-step fire plans, doctrine-linked fire discipline, sector-specific frontline profiles, sector-specific deployment depth limits, preset-based frontline geometry editing, point-by-point frontline handle controls, terrain-modified movement/range/fatigue/cover, bridge/rail chokepoint pathing, brigade formation frontage/fire arcs/overlap, preset and fine formation facing/oblique fire arcs, enemy assault groups with frontage/cohesion/officer command collapse, enemy morale routing/regrouping, runtime enemy assault phases with flanking/breakthrough/overextended pressure, pressure-card reserve commitment/breach sealing/local counterstroke responses, observation-post visibility, basic hidden/spotted enemy targeting, and field-hospital casualty recovery. The next improvement should add deeper elevation/defilade rules beyond rectangle hill zones, deeper enemy staff hierarchy beyond the current command-node/intent/tier recommendation/forecast/status/effect model, deeper reserve pool/officer/staff roles, deeper political backlash/loyalty events, richer enemy-intel UI affordances beyond compact cards, richer doctrine/staff unlocks for intelligence lessons, or staff-level doctrine chains beyond the first fire-discipline profile. Mobile QA is not a current target.
