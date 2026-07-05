# Game System Spec

Last updated: 2026-07-05

## Core Loop / 正規シーン遷移

```text
戦略キャンペーンマップ
  -> 小任務確認/自動解決
  -> 主戦場確認
  -> 幕舎
       軍編成
       将校
       兵站・装備
       築城
       参謀方針
  -> 出撃配置
  -> 戦闘
  -> 戦果報告
  -> 結果反映
  -> 幕舎または次ターン戦略マップ
```

The loop should make the player manage persistent military strength rather than only win isolated fights.

The full target is not a reduced UGCW. UGCW-style army management is the baseline, and this game adds theater defense and construction as a core pillar.

UGCWの基本シーン変化は、`WEBリサーチ/08_ugcw_scene_flow_reference.md` を根拠にする。重要なのは、戦略判断、Camp準備、出撃配置、戦闘、戦果報告が別の役割を持つこと。主戦場ボタンから即戦闘へ入るUIにはしない。

The strategic campaign map and tactical battle map are separate layers. The strategic map owns front movement, sectors, side operations, logistics, reinforcements, and defense planning. The tactical battle map owns unit combat, terrain interaction, wave spawning, structure damage, and battle outcomes.

幕舎は戦略マップでも戦闘マップでもない。戦闘前後の「軍を育て、損耗を受け入れ、補充と装備と築城を決める」準備層として扱う。

The campaign is dynamic rather than historical. There is no fixed sequence of historical campaign battles. Each strategic turn generates a mandatory main battlefield from the player army's current position and adjacent front/rear pressure, plus 3-4 side operations around that situation.

Main battlefields are not skippable. Side operations can support auto-resolve.

## Strategic Map Bands

| Band | Purpose |
| --- | --- |
| Home Core Defense Zone | Thick player defenses near the national core. Breach here is near-catastrophic. |
| Forward Defense Belt | Main prepared defense line with fortifications, depots, hospitals, rail hubs, fallback lines. |
| Active Front Zone | Fluid contested zone with villages, forests, bridges, marshes, raids, and frequent battles. |
| Enemy Vanguard Defense Zone | Enemy forward nests, corrupted forts, undead staging points, risky counterattack targets. |
| Enemy Heartland Zone | Enemy core region for late campaign or expansion-grade offensives. |

The campaign should push and pull across these bands instead of being a simple mission list.

## Player Army Fantasy

The player commands a trained, disciplined army that begins under pressure and grows into a complex defensive force. It has better organization than the enemy, but cannot waste men, officers, ammunition, or prepared positions.

Design implications:

- player units should be fewer and more valuable
- veteran quality should matter
- officer loss should hurt
- supply/ammo should matter
- reckless victory should be punished by future weakness
- static defense should be valuable but never free
- abandoning prepared positions should be a real strategic pain

## Doctrine / Staff Directive

Doctrine is not only a permanent upgrade tree. The current implementation also has a per-turn staff intelligence directive selected from the Doctrine screen.

Current directive modes:

| Mode | Primary effect |
| --- | --- |
| 標準参謀整理 | Keeps the current doctrine profile unchanged. |
| 敵情分析 | Improves recon/side-operation quality and next-turn initial enemy-intel preparation. |
| 防諜警戒 | Emphasizes misinformation countermeasures and strategic lesson preparation. |
| 兵站偵察 | Improves side-operation evaluation and reduces battle supply spend. |
| 工兵測量 | Improves engineering cost/repair handling and adds a smaller recon-quality bonus. |

The selected directive is stored in `CampaignState.doctrines.staffIntelligenceDirective`, then folded into `StrategicDoctrineProfile`. This means the directive can affect side-operation auto-resolve quality, next-turn initial enemy-composition/spoils confidence, supply spend, engineering cost, and repair amount without creating a separate one-off UI state.

Army Camp recommendations also read the active directive. Staff/division replacement scoring already weighs current sector terrain, risk, structures, and enemy-composition threats; the directive now shifts that weighting so, for example, `敵情分析` favors stronger enemy-reading command choices, `兵站偵察` raises quartermaster/reserve value, and `工兵測量` raises engineer staff and engineer-support value. Recommendation cards must show the active directive in `戦場補正` so the player can see why the staff is recommending a change.

Desktop 1440px QA verified that selecting `敵情分析` shows `小任務+8`, recon preview `精密偵察92` with `参謀支援+8`, and the next generated strategic turn message `敵情分析班が戦区情報を整理。初期敵情+2、教訓値4。` with operation intel `偵察照合済み`. Mobile QA is not a current target.

Desktop 1440px QA also verified that Army Camp `参謀部推奨` follows the selected directive: `敵情分析` displayed `参謀任務敵情分析` and `参謀任務補正: 敵情分析`, then switching to `工兵測量` updated the same recommendation context to `参謀任務工兵測量`.

## Enemy Intel Readability

Enemy intel should not be only a compressed text string. The current UI keeps compact text labels for dense lists, but Theater and Deployment also show an `EnemyIntelPanel` summary card.

The card shows:

- confidence or recon effect
- enemy composition summary
- per-type uncertainty ranges
- main threat and tactical role such as `数量圧`, `射撃圧`, `突破圧`, or `指揮圧`
- compact threat bars for quick comparison

This makes the strategic map and deployment briefing closer to UGCW-style pre-battle intelligence: the player can quickly read whether the next fight is mass pressure, rifle pressure, breakthrough pressure, or command pressure before assigning units and staff.

Desktop 1440px QA verified 5 Theater enemy-intel panels, including one main battlefield panel and four side-operation panels, plus one Deployment `出撃前敵情` panel beside the wave timeline. Broken images 0, console errors 0, page overflow false. Mobile QA is not a current target.

## Enemy Fantasy

The enemy is an undead imperial horde inspired by a fictionalized Russian-style mass army.

Design implications:

- enemies can spawn in waves
- enemies should be individually weaker or less coordinated at first
- pressure should come from numbers and persistence
- the player should rarely think "I can kill them all forever"
- battle objectives should often be survival, delay, withdrawal, or hold-the-line
- later enemy types should pressure or degrade static defenses

## Battle Tick

Battle simulation should run on a fixed tick.

Recommended initial tick:

```text
1 tick = 1 simulated second
```

Controls:

- pause
- normal speed
- fast speed

Tick responsibilities:

- spawn enemy waves when due
- update unit orders
- update structure effects and damage
- calculate engagement
- apply casualties
- update morale
- update fatigue
- consume ammo
- check objective/end conditions

## Tactical RTS Model

Current battle logic is no longer a pure aggregate power comparison. It is an abstract RTS model with map positions.

Runtime entities:

- player brigades have `position`, `range`, `firepower`, `fireRate`, `weaponName`, `currentTargetId`
- player brigades can hold battle-only fire-control fields such as `focusTargetId`, `fireMissionId`, volley expiry, and volley cooldown
- enemy wave units have `position`, `destination`, `speed`, `range`, `currentTargetId`, and `assaultPlan` with morale and morale state
- battle structures have `position`, `range`, `firepower`, `blockedRadius`, `durability`
- battle state records recent `engagements` so the UI can draw firing/assault lines
- battle state can hold active battle-only `BattleFireMission` entries for short volley orders and `BattleFirePlan` entries for coordinated staged fire plans
- battle state can hold a derived `FireDisciplineProfile` from campaign doctrine so fire-control duration, cooldown, ammo cost, fatigue cost, and plan depth can vary by staff policy

Targeting rule:

```text
Each firing unit selects a spotted living enemy inside its weapon range, formation fire arc, and clear line of fire. A battle-only focus-fire target is used first when still valid; otherwise the unit uses StandingOrder target priority before falling back to nearest.
Enemy units select the nearest living player brigade inside their effective assault frontage and range.
Structures select the nearest enemy inside structure range and clear line of fire.
```

Fire mission rule:

```text
BattleFireMission is a battle-only short fire-control order.
旅団斉射 affects the selected brigade only.
戦線斉射 affects eligible same-segment or same-facility defenders that are not retreating or cooling down.
Active fire missions temporarily increase fire output and ammunition/condition cost, then enter a volley cooldown.
FireMission target IDs are not persisted into StandingOrderTemplate or saves.
BattleFirePlan is also battle-only. It can queue up to several timed stages from current spotted targets, then `resolveTick` converts each due stage into a BattleFireMission if the target is still valid.
FireDisciplineProfile is derived from campaign doctrine when the battle starts. `command` improves duration/cooldown/plan spacing, `logistics` reduces ammo cost and permits deeper staged plans, and `training` can improve fire efficiency/fatigue cost.
```

Movement rule:

- enemies enter from the eastern/right side of the tactical map and move toward an assault-plan destination, nearby player formation, or bridge/choke lane
- `BattleScenario.waveIntel` derives first-wave timing, spawn interval, command-wave probability/start, enemy-type pressure multipliers, and six predicted timeline entries from persisted operation enemy-composition intel; low/medium confidence uses approximate or unknown display labels, while high/confirmed/precise intel exposes exact timing
- enemy assault groups carry mode, target, frontage width, depth, lane spread, cohesion, and assault vector
- enemy frontage expands contact range, cohesion affects movement and line pressure, and fire damage can reduce cohesion
- command-wave undead officers now spawn through deterministic enemy-intel probability rather than a fixed every-third-wave rule; they project command influence to nearby assault groups, and commanded groups move, attack, and press structures/line integrity harder
- enemy command hierarchy now carries `commandRole`, `commandTier`, `commandParentId`, `commandIntent`, `commandGroupId`, and `commandLabel`; command-wave officers project intent to same-group or same-target assault groups, tiers separate `波指揮核`, `突撃先導`, `支援節`, and `前衛群`, and intent/tier can change pressure, movement, breakthrough threshold, flanking pressure, and rally recovery
- groups that lose their previous officer command source can enter `指揮崩壊`, losing cohesion and displaying reduced command state until re-commanded strongly enough
- enemy morale is separate from officer command: sustained losses and low cohesion can move a group through `動揺`, `潰走`, and `再集結`; routed/regrouping groups move rearward and stop attacking until they rally
- enemy assault groups carry runtime line-pressure phases: `接近`, `交戦`, `側面圧`, `突破`, and `突出`. Phase, penetration depth, flank pressure, low cohesion, and wavering morale now feed pressure cards, alert cards, enemy labels/inspection, and `lineIntegrity`.
- enemy waves can explicitly target defensive facilities instead of only frontline segments. `src/game/battle/waves.ts` scores built/damaged structures by type value, damage state, live facility state, assigned defenders, distance, and enemy type bias. When chosen, assault groups receive facility-specific labels such as `塹壕破砕:塹壕線`, `補給遮断:補給所`, or `観測潰し:観測所`, share a structure-based command group, and display `施設襲撃` on the tactical map. This makes trenches, depots, hospitals, and observation posts valid enemy intentions, not only passive objects damaged by proximity.
- pressure cards and relevant alerts can translate these phases into battle-runtime responses: `予備投入` for flanking pressure, `突破封鎖` for breach pressure, and `局地反撃` for overextended enemies. These reuse StandingOrders, focus targets, fallback points, reserve readiness, and line volley where possible rather than creating a separate permanent doctrine state.
- reserve and fire-support brigades carry battle-runtime `reserveReadiness`. It rises while a unit is stationary, fresh enough, and not firing, and falls when moving, firing, retreating, threatened, or committed to emergency response. Pressure cards show total/ready reserve readiness and can recommend earlier `局地反撃` when ready reserves face wavering, disrupted, or low-cohesion engaged/flanking enemies.
- DeploymentPlan can store a battle-runtime reserve doctrine (`標準予備`, `反撃準備`, `弾性予備`, `火力予備`). It changes initial readiness, readiness gain/spend, hold pressure, and counterstroke threshold, but is not yet a permanent doctrine tree.
- `Advance` moves a brigade toward firing distance
- `Flank` moves toward an offset lane around the nearest enemy and increases exposure
- `Retreat` moves a brigade toward the rear/left side
- `Build / Repair` moves engineers toward damaged structures
- `Hold` and `Rest / Resupply` mostly keep position

Weapon range defaults:

| Weapon | Range | Firepower | Fire rate | Role |
| --- | ---: | ---: | ---: | --- |
| 後装旧式銃 | 25 | 0.82 | 0.92 | Reserve line infantry |
| 針撃銃 | 30 | 1.0 | 1.0 | Standard line infantry |
| 改良針撃銃 | 36 | 1.12 | 0.9 | Scarce elite line infantry |
| 猟兵銃 | 42 | 0.9 | 0.85 | Longer skirmisher fire |
| 野戦砲 | 64 | 2.8 | 0.48 | Long support fire |
| 工兵器材 | 16 | 0.45 | 0.65 | Engineer self-defense |

Armory / equipment upkeep:

- Each brigade has `weaponQuality`.
- Each brigade can optionally hold `weaponKey`; missing or incompatible values fall back to the unit-type default weapon.
- Battle creation copies campaign `weaponKey` and `weaponQuality` into `BattleUnit`, and the assigned weapon's range/firepower/fire-rate plus quality drive battle fire.
- Current Armory reserve stock is used for rearm/upkeep and compatible weapon switching, not yet a full buy/sell shop.
- `estimateRearm` compares brigade `weaponQuality` against its weapon-class target quality and computes how many reserve weapons are needed to restore quality.
- `rearmUnit` consumes reserve weapons and raises brigade `weaponQuality` toward the weapon target.
- `switchUnitWeapon` consumes enough new weapons for the brigade, returns a portion of the previous weapons to reserve stock, sets brigade `weaponKey`, and resets quality to the new weapon's target quality.
- Army Camp and Armory both show rearm estimates. Armory lists per-unit needs for the selected weapon class.
- Armory now lists compatible switch candidates; the current implementation gives infantry the old/standard/improved rifle choice while keeping other branches on their class weapons.
- Strategic operations can carry `spoilsIntel`: expected captured weapon stock, supply-cache forecasts, confidence level, forecast ranges, and recovery multiplier. Theater and Deployment show this before the mandatory battle, so the player can weigh side operations and main battlefield risk against future Armory options.
- Recon side-operation success or draw improves same-turn unresolved operation intel. Recon quality is calculated from assigned unit type, experience, morale, condition, assigned officer rank/experience, strategic doctrine support, and bad-intel lesson history. `敵情分析` doctrine raises that doctrine support, so the same assigned scouts can produce a better visible preview and auto-resolve score. It marks forecasts as `偵察照合済み`, raises confidence, tightens visible ranges, records a quality score/effect such as `偵察90 / 精密照合`, and improves recovery efficiency for later side-operation auto-resolve or main battle captured-weapon recovery.
- Failed recon can mark linked intel as `誤情報疑い`, lower confidence, and reduce recovery certainty. The current default campaign usually resolves the first recon with the starting jaeger unit, so failure behavior is model-supported but needs manual assignment controls to expose intentionally weak recon choices.
- Theater Command now supports manual side-operation assignment. Each unresolved side operation can hold one assigned unit and one assigned officer; assigning a unit auto-pairs its current officer when available. Recon operations immediately preview the assigned-force recon quality before auto-resolve and show compact quality breakdown chips for unit score, officer score, doctrine support, and any bad-intel lesson bonuses.
- Accumulated bad-intel lessons also feed the next strategic turn. When battle results are applied, `applyBattleResult` reads unit histories containing `敵情誤認下` and officer histories containing `偵察教訓` / `敵情誤認対応`, adds any `敵情分析` doctrine bonus, calculates a strategic intelligence preparation score, and passes it to `generateStrategicTurn`. The next turn can upgrade initial spoils/enemy-composition intel by one or two confidence steps, mark it as `部分照合` or `偵察照合済み`, append `参謀偵察教訓を反映` to operation intel summaries, and add a Japanese campaign message such as `過去の敵情誤認教訓を参謀部が整理。初期敵情+1、教訓値9。` or `敵情分析班が戦区情報を整理。初期敵情+2、教訓値6。`.
- Resolved side-operation assignments are treated as committed detachments for the current turn. Deployment excludes those units from the mandatory main battle roster, so side operations create a real opportunity cost instead of being free pre-battle buttons.
- Side-operation auto-resolve scales `spoilsIntel` by result quality and recovery multiplier, then adds captured weapons/resources into campaign stock. This makes minor operations more than pressure modifiers; they can solve or worsen equipment scarcity.
- Main battle results now include `capturedWeapons` and `equipmentWearByUnit`.
- Main battle captured weapons are now modified by the operation's spoils intel, then `applyCampaignDelta` adds captured weapons to reserve stock and lowers brigade `weaponQuality` from battle wear before the next camp/armory decision.
- After Action displays `戦利品` and per-unit `装備摩耗`; Army Camp history then records the same wear entry.
- Expanded shop prices, selling, deeper alternate weapon trees per unit type, multi-unit/multi-officer side-operation task forces, and deeper multi-source scouting/intelligence upgrades remain later work.

Defensive structures:

- trenches and barricades provide local cover and slow enemies around them
- supply depots support ammo recovery through fortification effects
- observation posts add durability-scaled visibility and help reveal enemy groups earlier
- field hospitals add durability-scaled casualty recovery after battle if not overrun, plus per-unit evacuation-line bonuses when a brigade's fallback/current position is near a functioning hospital
- bridge/rail choke points force enemy waves through narrow lanes, compute congestion pressure, and slow movement further when pressure exceeds the flow limit
- operational structures can fire at nearby enemies
- enemies close to a structure damage its durability
- engineers on `Build / Repair` repair nearby damaged structures
- a structure at 0 durability becomes `overrun`

Current abstraction limits:

- terrain now exists as BattleState terrain zones with movement, fatigue, cover, range, and fire modifiers
- current Active Front battle renders forest, marsh, and trench zones; units and enemies use local terrain for movement, condition/fatigue, effective range, fire output, and casualty cover
- basic visibility/concealment exists: observation posts increase spotting range; terrain and enemy type add concealment; terrain line-of-sight blockers can prevent long-range spotting; player and structure fire select spotted targets with clear line of fire only
- field-hospital recovery exists: battle results split raw battle casualties, recovered wounded, and permanent casualties; campaign unit strength only loses permanent casualties
- field-hospital evacuation-line recovery exists: `BattleResult.medicalRecoveryDetails` stores base recovered, bonus recovered, effective recovery rate, source label, and reason per unit. `results.ts` evaluates functioning `fieldHospital` proximity against each unit's fallback destination and final position, then After Action shows `救護線` entries such as `追加収容+2 / 実効収容率22% / 野戦病院支援圏 / 後退点20 / 現位置45`. Campaign application writes the same rescue-line note into unit battle history.
- bridge choke pathing exists for bridge/rail sectors: `BattleState.chokePoints` creates a `鉄道橋隘路`, enemy movement routes through the lane until crossed, and choke pressure/delay is displayed in Battle Command
- facility tactical state exists: `BattleStructure` now stores runtime tactical pressure, repair rate, assigned unit ids, and a Japanese state label such as `安定`, `接敵`, `修理中`, `危険`, or `制圧`. `resolveTick` derives those values from nearby enemy pressure and engineer repair, while Battle Command shows threat/repair/assigned count on map structure cards and can raise facility alerts for pressure, repair lag, or missing assignment before the structure is fully overrun.
- enemy facility-targeting exists: wave generation can select valuable structures as explicit assault targets before they are already destroyed. Facility-targeted enemies are labeled as `塹壕破砕`, `障害排除`, `補給遮断`, `観測潰し`, or `救護線破壊` according to structure type, and Battle Command marks those groups as `施設襲撃` with structure-raider styling. The same `targetStructureId` then feeds enemy pathing, command intent, structure targeting state, and facility pressure display.
- facility assault response exists: Battle Command raises high-priority `施設即応` alerts when spotted enemies are actively targeting a structure. `applyFacilityDefenseResponse` assigns defenders, a nearby engineer, and reserve candidates to the threatened facility, sets defend/repair/resupply facility duties, chooses target priority from the attacking enemy mix, focuses a spotted assailant when available, and writes a `施設即応` battle log. Player-triggered facility assignments mark a battle-only `facilityResponseRole`, so BattleResult can convert the intervention into `施設防衛`, `施設修理`, or `補給拠点勤務`, with XP, officer XP, commendations, After Action role lines, and Army Camp unit-history carryover.
- tactical objective-node control exists: `BattleState.objectiveNodes` carries victory, supply, and visibility objectives with player/contested/enemy control. Each objective also carries a scenario role such as `指揮小丘`, `荷車補給点`, or `林縁観測丘`, including effect text and control/pressure multipliers. Scenario roles now branch by terrain/structure context: bridge/rail, village, trench, marsh, hill, supply depot, and observation post can produce labels such as `鉄道橋頭堡`, `村役場広場`, `塹壕交差点`, `板道荷車列`, `葦原監視線`, or `観測塔前哨` rather than using only generic objective names. `resolveTick` updates control from nearby brigade presence and enemy pressure; the scenario role changes player/enemy presence weight, control drift, and objective-pressure contribution. Battle Command renders node control, scenario role, effect summary, and HUD percentages from BattleState.
- tactical objective response commands exist: Battle Command exposes state- and event-specific buttons such as `勝利点保持`, `勝利点奪回・指揮線奪回`, `補給点防衛`, `補給点奪回・補給火消し`, and `視界点奪回・観測復旧`. `objectiveResponseTacticalProfile` derives intent from objective type, event severity, current control, and nearby supply-depot state, and `applyObjectiveNodeResponse` retasks nearby defenders or reserve brigades through StandingOrders, setting objective anchor, segment, posture, target priority, ammo policy, fallback, reserve-readiness cost, and supply/repair facility assignment where relevant.
- objective-response after-action carryover exists: units assigned by objective response carry a battle-only `objectiveResponseRole`. BattleResult converts that marker into roles such as `補給点防衛`, XP, officer XP, and commendations such as `補給線を防衛`, then campaign application writes the role into unit battle history.
- objective-event response assessment exists: BattleResult now evaluates units assigned to event-driven objective responses against the final objective control, final event severity, distance to objective, morale, ammo, and remaining strength. After Action shows `目標イベント対応` rows such as `観測点沈黙に対応、未回復（支配0%、到着が遅く目標圏外に留まった）`, per-unit result lines, deterministic assessment reasons, lesson tags such as `到着遅延`, and next-battle lesson previews. Campaign application writes `目標イベント対応 ... / 再確保・遅滞・未回復 / lessonTag` into unit history and the first summary into the turn message.
- tactical objective runtime effects exist: `BattleObjectiveState.tacticalEffects` recalculates from current victory/supply/visibility control during `resolveTick`. Victory point control modifies line integrity; supply point control modifies ammunition recovery and the ammo multiplier captured by manual fire missions and staged fire-plan activations; visibility point control modifies spotting range, suppression gain, and enemy-wave clarity. Each `BattleObjectiveNode` also carries a live `eventState`, so scenario roles can degrade into events such as `信号線混乱`, `指揮信号途絶`, `補給路混乱`, `補給点炎上`, `観測線乱れ`, or `観測点沈黙`. Battle Command shows these as `目標効果`, `目標イベント`, `斉射弾薬x...`, and `敵波判読`, and also raises strained/critical objective events as warning/danger alert cards whose action buttons call the existing objective-response StandingOrder path.
- tactical objective outcome strategic effects exist: `BattleResult.objectiveOutcome` records final victory/supply/visibility control. Victory point results adjust sector pressure, enemy momentum, and global threat; supply point results adjust supply consumption and can add ammunition/supplies when held; visibility point results can add next-turn initial enemy-intel preparation. After Action shows these as `戦術目標`, and campaign history/last message records the objective-effect summary plus the first objective-event response assessment when one exists.
- formation frontage exists: each brigade has frontage width, depth, fire arc, density, and overlap pressure; target selection and enemy contact use the formation footprint rather than only the unit point
- preset and fine formation facing exists: standing orders can store `facingDeg`, Deployment can save preset or 15-degree adjusted facing, Battle Command can change facing during combat, and fire-arc target filtering uses oriented projection instead of always firing due east
- enemy assault groups exist: each spawned enemy group has an assault mode, target label, frontage width, depth, lane spread, cohesion, command state, command intent, command group label, and vector; Battle Command renders enemy assault footprints/axes and shows mode/command state/command intent/command label/width/cohesion/target on enemy cards
- enemy officer command influence exists: command-wave officers project influence and command intent to same-group or same-target groups, raise their movement/attack/pressure factors, and previous-source loss can cause `指揮崩壊` with cohesion loss and UI alerts
- enemy morale routing exists: incoming fire and cohesion loss lower group morale, which can cause `動揺`, `潰走`, and `再集結`; routed/regrouping groups move away from the line, clear their current target, and display state on map tokens, alerts, logs, and enemy cards
- enemy flanking/breakthrough/overextended pressure exists: tick logic derives assault phase, penetration depth, flank pressure, low cohesion, and wavering morale from the enemy group position relative to its targeted frontline segment; flank/breakthrough/overextended state affects line integrity, frontline pressure reports, alerts, enemy map labels, and enemy inspection details
- reserve/counterstroke response exists: Battle Command pressure cards show reserve counts plus readiness and can apply `予備投入`, `突破封鎖`, or `局地反撃` responses, reassigning reserve/nearby brigades to threatened segments, setting posture/target priority/ammo/fallback, focusing the lead threat, consuming readiness from committed units, and starting line volley when possible
- sector-specific deployment depth limits exist: each frontline segment now has an allowed deployment band derived from the strategic sector, Deployment can manually push/widen/narrow that band per segment, and Deployment/Battle clamp starting anchors to the adjusted band
- preset-based frontline geometry editing exists: Deployment can choose sector default, forward line, defense-in-depth, wide screen, compressed choke, refused-left, or refused-right layouts; the choice is saved in campaign `deploymentPlan` and applied to BattleState segment anchors, zones, fallback points, and StandingOrder drafts. Deployment also compares the geometry presets by average terrain score, weakest line score, mobility risk, tone, and suggested doctrine before the player commits to a whole-line shape, then summarizes the weakest line with corrective hints for geometry, reserve, fallback, facility support, or fire posture. The mitigation action can now save those hints as actual StandingOrderTemplates and optional designated reserve support, so the next BattleState receives the adjusted line, posture, target priority, ammo policy, fallback, and facility assignment.
- point-by-point frontline handle controls exist: Deployment can manually adjust the selected segment's main line position, fallback depth, command width, and control radius; those segment overrides are stored under `deploymentPlan.frontlineGeometry.segmentOverrides` and applied to BattleState
- Deployment reserve doctrine exists: `deploymentPlan.reserveDoctrine` lets the player choose standard reserve, prepared counterstroke, elastic reserve, or fire-support pool before battle; BattleState displays and applies it to reserve readiness and pressure-card recommendations
- Deployment designated reserve slots exist: `deploymentPlan.reserveUnitIds` stores selected main-battle brigades that should begin on the reserve line; Battle creation places them on the reserve segment with reserve posture, ammo conservation, fallback point, and no frontline facility assignment unless a supply depot is available
- Deployment withdrawal rear-guard planning exists: `deploymentPlan.rearGuardUnitIds` stores selected main-battle brigades that should cover an organized withdrawal. Deployment also shows a `撤退後衛判断` advisor before assignment, ranking candidate brigades by suitability, recommendation score, pursuit-cover score, preservation score, predicted rear-guard casualties, officer risk, and a short reason such as `通常戦線から抽出` or `後衛指定済み`; candidate buttons switch the selected planner unit, and `推奨候補を後衛指定` applies the current best tradeoff directly so the player can compare officer-preservation and pursuit-cover costs before committing. Battle creation moves those brigades to the reserve/rear line, gives them `fallback_guard` or artillery `fire_support`, target priority toward enemy officers or largest mass, ammo conservation, high reserve readiness, `frontlineRotationRole: rear_guard_cover`, and a rear-guard plan assessment snapshot. Withdrawal After Action then strongly favors them for `撤退後衛` pursuit-damage prevention and compares planned loss/officer-risk/pursuit-cover estimates against actual rear-guard losses.
- Battle reserve command exists: Battle Command lists reserve-line/fire-support/fallback-guard/artillery/high-readiness candidates in a `予備指揮` panel and can return a brigade to the reserve line as fallback guard or fire-support reserve while clearing focus target and rebuilding readiness
- Battle command queue exists as local Battle Command UI state: `予約指揮` can pause the battle, queue selected-brigade posture/target/ammo/facing/immediate-order/fire-control changes, tactical-map commands for anchor/fallback/frontline/facility/focus-target assignment, enemy-intent panel commands for focus target/responsible-frontline response/line volley, enemy command-network group actions for command-node fire/collapse pursuit/reserve commitment, alert-card recommendations, frontline-pressure responses, and pressure-card/default fighting rotations, delete or discard queued items, and then apply them through existing `orders.ts` functions with `一括発令`. This is intentionally not part of campaign save state or StandingOrderTemplate.
- advanced elevation-specific line-of-sight, hill height advantage beyond a range/fire modifier, and freehand drag-style formation rotation are not implemented yet
- direct drag deployment/movement and full arbitrary freehand curved-line editing beyond segment-scoped plan-set sketch lines are not implemented yet; commands, preset geometry, handle controls, and the 2-5 point Battle Command `戦線スケッチ` mode drive automatic movement

Implementation note: see `WEBリサーチ/12_tactical_rts_combat_model.md` for the UGCW-derived rationale and source links.

## Tactical Autonomy / Standing Orders

The long-term battle design should not depend on full direct-control micro. This primarily supports brigade-scale desktop play now; mobile/cellphone work and QA are outside the current target until explicitly re-added.

Use two command layers:

| Layer | Purpose |
| --- | --- |
| Immediate order | A short tactical intervention such as Hold, Advance, Flank, Rest/Resupply, Build/Repair, or Retreat. |
| Standing order / frontline assignment | A persistent autonomous policy: assigned anchor, control radius, target priority, fallback threshold, and facility assignment. |

The player should define where a brigade is responsible for fighting, then the brigade should act autonomously around that area. On a wider tactical map, the core player action becomes:

```text
assign brigade to line/anchor/facility
  -> choose posture and target priority
  -> set fallback rule
  -> intervene only when the situation changes
```

This makes fortifications useful: trenches become line anchors, barricades become local choke tools, supply depots become resupply anchors, observation posts become warning assets, and fallback lines become planned tactical withdrawals instead of UI decoration.

Implementation note: the product-shaped design is recorded in `docs/10_TACTICAL_AUTONOMY_AND_FRONTLINE.md`.

Current implementation note, 2026-07-02:

- `StandingOrder` and `FrontlineSegment` are implemented as a first vertical slice.
- Battle Command shows five default frontline areas, anchor/control radius overlays, fallback routes, and standing-order controls.
- The tick uses target priority, ammo policy, fallback threshold, facility assignment, supply-depot resupply, and engineer-support repair behavior.
- Battle Command now supports selected brigade command, selected-frontline direct command, selected-frontline objective-support commands for pushing current line defenders toward victory/supply/visibility nodes, objective staff recommendation cards for choosing the best frontline per tactical objective with `転用予測` source-line cost, battle-only paused command queue, in-battle target-priority and ammo-policy overrides, battle-only focus-fire target marking, selected-unit `射撃判断監査` that shows fireable/blocked/out-of-range enemy candidates, draws selected-unit map lines for fireable/blocked/out-of-range/focused candidates, displays per-candidate terrain-adjusted effective range and LOS modifier labels, and can assign a fireable candidate as focus target, tactical map layer controls/legend for `戦線 / 指揮圏 / 射撃判断 / 隊形 / 敵突撃 / 交戦線 / 地形/目標 / 施設`, battle-only volley FireMissions, click/tap and drag anchor assignment, click/tap and drag fallback assignment, Battle-time frontline reposition/fallback/width adjustment that updates assigned brigade StandingOrders, facility click assignment, facility assault-response alerts, minimap click-to-scroll, detailed autonomous action-reason display, always-visible frontline pressure summary/response commands including `戦闘交代` for withdrawing a stressed defender behind reserve cover, selected-frontline rotation candidate comparison/selection for choosing the exact tired defender and cover reserve, reserve-source risk labels for `予備線 / 戦線転用 / 危険転用`, clicked-enemy intent inspection, enemy-panel responsible-frontline response/line-volley commands, and alert cards.
- Battle Command also supports frontline-level doctrine presets for assigned defenders. The selected-frontline panel shows pressure level, average morale, average ammo, local facilities, damaged facilities, and lead threat, then applies `戦線固守 / 弾性拒止 / 殺傷地帯 / 遅滞節約 / 工兵修理線` across that line's defenders. Each command also shows a lightweight forecast for `損耗 / 弾薬 / 突破` and a Japanese reason tied to pressure, lead threat, ammo, morale, or damaged facilities. This keeps large-army play closer to UGCW-scale command, where the player changes a line's intent instead of babysitting every brigade.
- Battle Command now has a `参謀警告` layer above the selected-frontline panel. It ranks urgent lines by pressure, lead enemy phase/type, defender count, reserve availability, average ammo, average morale, and damaged facilities, then recommends one of the same frontline doctrine presets. Applying an advisory reuses the StandingOrder update path, records a battle log entry such as `参謀警告対応`, stores `BattleState.staffAdvisoryResponses`, and carries the accepted advisory into After Action as `staffAdvisoryOutcomes`.
- Staff advisory outcomes are now part of the battle-to-campaign growth loop. `createBattleResult` evaluates accepted advisories as `戦線維持に寄与 / 撤退支援 / 対応及ばず`, gives involved units a small XP bonus, and After Action shows both the overall advisory result, per-unit advisory entries, and a `次戦教訓` preview for the involved units. `applyBattleResult` adds the first advisory summary to campaign history/message and records involved advisory outcomes into each unit's `battleHistory`.
- After Action now has staff-slot accountability. Battle creation snapshots the current corps staff roster into `BattleState.staffAccountabilityContext`; `createBattleResult` evaluates `参謀長`, `兵站主任`, `工兵主任`, and `砲兵主任` against deterministic battle evidence: line integrity/victory-point state, supply control/ammo state, structure damage/overrun state, and enemy suppression/fire-support state. After Action shows `参謀責任` lines with `功績 / 警告 / 責任`, trigger, reason, lesson tag, XP, and fatigue; campaign application writes those entries into the assigned officers' histories and adds the XP/fatigue to their persistent command record. Army Camp staff recommendations now read the matching staff-slot history: recent `責任`/`警告` lowers the current slot value, recent `功績` adds value, and recommendation cards show `前戦評価` comparing the current staff officer with the proposed candidate. This makes headquarters appointments part of the same growth/risk loop as brigade and division command instead of only pre-battle stat modifiers.
- Staff advisory, enemy command-action, objective-event response, and facility-duty lessons now feed the next battle directly. `src/game/campaign/tacticalLessons.ts` reads unit history entries containing `参謀警告対応`, enemy command-action roles such as `敵指揮核制圧`, `敵崩壊追撃`, and `指揮網予備投入`, `目標イベント対応` records such as `視界地点/林縁観測丘で観測点沈黙に対応、未回復/到着遅延`, plus facility roles such as `施設防衛`, `施設修理`, and `補給拠点勤務`. It then derives a tactical lesson profile: reserve-readiness bonus, control-radius bonus, earlier fallback morale judgment when prior advisory/objective/facility repair response failed or command-reserve lessons apply, and a preferred frontline doctrine parsed from labels, inferred from enemy command experience, inferred from objective-event type/result, biased by objective-event lesson tags, or inferred from facility duty (`施設防衛` -> `戦線固守`, `施設修理/補給拠点勤務` -> `工兵修理線`). After Action previews staff/objective/facility lessons as `次戦教訓 参謀警告1件 / 得意殺傷地帯 / 即応+... / 統制+...`, `次戦教訓 目標イベント対応1件 / 即応+...`, or `次戦教訓 施設襲撃対応 / 得意戦線固守`. Deployment then shows the applied profile as `戦術教訓 参謀警告1件 / 得意殺傷地帯 / ...`, `戦術教訓 敵指揮核制圧1件 / 得意遅滞節約 / ...`, `戦術教訓 目標イベント対応1件 / 得意遅滞節約 / ...`, or `戦術教訓 施設任務1件 / 得意工兵修理線 / ...` and a `戦術教訓推奨` panel. Pressing `教訓方針を適用` maps the learned doctrine into the planner StandingOrder draft, e.g. `殺傷地帯` becomes `姿勢 阻止射撃 / 優先 最大集団 / 弾薬 集中射撃`, command-node fire or failed visibility-event recovery maps to `遅滞節約`, supply/repair lessons can bias toward `工兵修理線`, and facility-defense lessons bias toward `戦線固守`. Pressing `教訓方針を保存` applies the same draft and saves it as the brigade's StandingOrderTemplate with a lesson-derived description, so the player can turn battle experience into a reusable standard operating order. Army Camp's selected-unit inspector also shows that brigade's tactical-lesson summary, preferred doctrine, and saved standard StandingOrder description/posture/target/ammo policy; the left-panel `標準方針台帳` lists saved-template brigades and selects them directly, and the player can clear the saved standard order there without deleting the underlying lesson or battle history. Battle creation applies the lesson profile to the generated `BattleUnit` StandingOrder/reserve readiness, and staff advisory recommendation can surface the same lesson as `教訓殺傷地帯` when it remains tactically usable after damaged-facility, low-ammo, morale, flanking, and breakthrough gates.
- `StandingOrderTemplate` is persisted in the campaign save path; current local saves are v8 after adding Deployment withdrawal rear-guard planning. Battle Command can save a selected brigade's autonomous order, and the selected-frontline panel can save all current defenders on that line as frontline-plan templates after direct line edits or 2-5 point `戦線スケッチ`. Confirmed battle sketches can also copy their 2-5 point `frontlineSketchPoints` into each saved per-brigade template, so Army Camp and Deployment can show `戦線形状 N点`. Deployment can promote those saved sketch points into `FrontlineGeometryAdjustment.sketchLines` when a plan set is saved, and plan-set apply rehydrates Deployment/Battle segments through `applyFrontlineGeometryAdjustment`. Deployment displays saved-order coverage, compares the selected brigade's current pre-battle draft against its saved standard order, shows changed areas, and can restore the draft from the saved template. Army Camp can clear a selected brigade's saved standard order, and battle creation applies saved brigade templates.
- `StandingOrderPlanSet` is persisted in the campaign save path from v7 and now uses save v8 for withdrawal rear-guard planning. Deployment can save the current selected battle plan as a named set containing frontline geometry, reserve doctrine, designated reserves, designated withdrawal rear guards, and all selected brigades' current StandingOrders. Plan sets now clone `frontlineGeometry.sketchLines`, show `形状N線` in their summary, and preview saved sketch frontage such as `保存戦線形状 森林左翼線 4点`. Deployment can create these segment-scoped sketch lines directly from the selected frontline handle editor with `地図で描画`, `1点戻す`, `描画確定`, `既存線を編集`, `現線を形状化`, `北寄せ形状`, `南寄せ形状`, and `形状解除`; map-click drawing accepts 2-5 points and renders both draft and saved frontage before saving. The `戦線計画セット` panel can preview matched/missing brigades, changed StandingOrders, saved battlefield, frontline geometry, reserve doctrine, designated reserves, designated rear guards, and saved segment-scoped sketch shapes; detailed preview rows show per-brigade changed fields plus saved posture/target/ammo summary. The player can rename, overwrite, apply, or delete each set. Applying a plan set restores matching deployed brigades into the pre-battle draft and updates the deployment plan, without overwriting per-brigade standard templates until the player explicitly saves those.
- Deployment now includes a pre-battle autonomous-order planner. Selected deployed brigades can set frontline segment, posture preset, target priority, ammo policy, fallback preset, and facility assignment before the mandatory battle starts; saving writes through the same campaign template path.
- Tactical frontage now depends on the strategic sector. Deployment and Battle share sector/terrain-driven frontline profiles such as fortress defense, bridge choke defense, active-front forest/marsh/trench defense, enemy-vanguard swamp advance, and enemy-heartland open advance.
- Saved standing-order templates are realigned to the current sector's same segment ID when the old anchor does not fit the generated segment zone.
- BattleState now stores generated terrain zones. `resolveTick` applies local terrain movement, fatigue, cover, range, and fire modifiers, and Battle Command displays terrain effect labels plus each selected unit's current terrain and effective range.
- Frontline terrain assessment now connects terrain/structures to line-placement decisions. `src/game/battle/frontlineTerrainAssessment.ts` scores each frontline segment for fire advantage, cover value, mobility risk, and support value, then returns Japanese tags, reasons, and a suggested frontline doctrine. The same module aggregates those assessments by frontline geometry preset, so Deployment can compare `戦区標準`, `前進主線`, `縦深防御`, `広域警戒線`, and other shapes by average score, weakest line score, tone, and recommended doctrine before applying a geometry. It also builds a weak-line mitigation advisory for Deployment, identifying the lowest-scoring line and recommending geometry changes, reserve support, deeper fallback, facility support, or fire posture where relevant. Deployment can apply that advisory into saved StandingOrderTemplates: the focus brigade is moved to the weak line with a fitting posture/ammo/fallback/facility assignment, and a support brigade can be designated as reserve. Battle creation marks those brigades as deployment-mitigation units, so After Action and unit history can later record `弱線是正` or `弱線支援予備` rather than losing the pre-battle duty after battle starts. Deployment shows segment assessments before battle as per-line cards and preview badges; Battle Command shows the selected line's live `地形評価` and `地形判断` next to the selected-frontline doctrine board.
- Observation posts now exist as buildable fortifications. `src/game/battle/visibility.ts` computes spotting range and enemy concealment; `resolveTick` gates player and structure target selection to spotted enemies; Battle Command shows visibility range, spotted/hidden counts, and hidden enemy shadows.
- Terrain line-of-sight now has tactical modifiers, not only blocked/clear states. `src/game/battle/terrainEffects.ts` classifies forest/village as blocking terrain and hill/marsh as partial attenuation, then adds `高地射界`, `遮蔽端射撃`, enemy cover-edge, and enemy ridge modifiers with range/fire multipliers. `visibility.ts` still reduces or blocks long-range spotting through those zones, while `resolveTick` excludes blocked targets and applies LOS range/fire multipliers to brigade target checks and damage. Battle Command labels terrain as `射線遮蔽`, `射線減衰`, `遮蔽端`, or `高地射界`, unit cards show current `射線` state, and target-audit rows show per-candidate `有効射程`. The URL-gated tactical terrain profile `?takawasiTerrainProfile=high-ground` creates a reproducible `高地射線検証` battle profile that appends hill/open terrain and forward QA enemy entry points, so high-ground LOS can be browser-verified without changing campaign save state.
- Field hospitals now exist as buildable fortifications. `BattleResult` stores raw casualties, recovered wounded, permanent casualties, medical supply spend, recovery rate, and per-unit `medicalRecoveryDetails`; After Action displays global medical recovery plus `救護線` bonus rows, and campaign application subtracts permanent casualties only while preserving bonus recovery notes in unit history.
- `BattleResult` also stores per-unit battle-role summaries and commendations. After Action shows each brigade's final role such as weak-line correction, weak-line support reserve, fighting rotation, rear-guard cover, reserve holding, fire support, engineer support, screening counterstroke, elastic defense, or line holding, then campaign application writes that role and any commendation into the unit's `battleHistory`. Role-aware XP bonuses reward pre-battle weak-line mitigation duties that reached the battlefield, kept-ready reserves, fighting rotation before collapse, sustained fire support, engineer facility duty, useful counterstroke/screening work, and line-holding under pressure.
- Main battle results now also carry officer command outcomes. `BattleResult` stores brigade-officer XP, deterministic risk, wound flags, and officer-to-unit labels; After Action shows `将校戦果`, and campaign application writes command XP/risk/wound history back into the Officers tab. Risk is derived from battle outcome, casualty pressure, close-action posture, rout/retreat pressure, and unit destruction rather than random dice, so QA and later balancing stay reproducible.
- Division commanders also receive after-action outcomes. `BattleResult` stores division commander events, XP, risk, division names, and separate division-command wound ids. `createBattleResult` derives this from subordinate brigade count, role variety, reserve readiness, casualty pressure, low-state units, and battle outcome. If thresholds are crossed, the result text appends `指揮所負傷`; applying the result marks the same officer wounded/recovering and writes the division-command wound into officer history.
- Misleading-intel battles now produce after-action intelligence outcomes. `BattleResult.intelligenceEvents` records the enemy-intel failure, predicted-vs-actual wave gap, and misinformation casualty/low-morale context. After Action shows this under `敵情評価`, and campaign application writes `敵情誤認対応、偵察教訓を記録` into relevant officer histories while marking unit/campaign records as fought under bad intelligence. Later recon side-operation quality reads those histories: officers with `偵察教訓` / `敵情誤認対応` entries and units with `敵情誤認下` battle records receive capped recon-quality bonuses, so bad intelligence can become a persistent scouting lesson rather than only a result-log penalty.
- The Officers tab now supports basic commander management. Eligible officers can be promoted by spending rank-threshold experience, active officers can cycle to the next brigade assignment, fatigued active officers can be sent to rest, and resting officers can be manually returned to duty. Reassignment updates both the officer's assigned unit and the unit's `officerId`, swapping the displaced commander back into the previous post and recording history on both sides. Resting clears the officer's operation assignment and records rest/return history.
- Officer rank/traits now derive an `OfficerCommandProfile` that modifies BattleUnit morale, condition, ammo, range, firepower, fire-rate, control radius, fallback morale threshold, and reserve readiness at battle creation. It also carries command capacity/load/overload, so oversized brigades under low-rank or poorly matched officers take command-overload penalties to morale, condition, control radius, reserve readiness, and fallback timing. Persistent `commandFatigue` also penalizes morale, condition, control radius, reserve readiness, and fallback timing when exhausted officers are kept in command. Resting officers recover command fatigue faster and are inactive for battle/staff/division command effects until returned to duty. Army Camp previews the selected unit's `指揮効果`; Deployment shows pre-battle command-capacity summaries and overload warnings with a direct route back to the Officers tab for promotion/reassignment/rest; Officers can recommend a swap that lowers total post-swap overload and recommend rest for fatigued commanders; Battle Command displays the applied commander/effect summary.
- Corps-headquarters staff slots now exist in Army Camp. `参謀長`, `兵站主任`, `工兵主任`, and `砲兵主任` can be assigned active officers as concurrent headquarters duties. The resulting headquarters profile adds deployment slots, army-wide command-capacity support, reserve-readiness support, and future repair support. Staff assignments are one-slot-per-officer: assigning the same officer to a new staff role clears the previous staff role. If a staff officer also commands a brigade, that staff duty subtracts command capacity from the officer's brigade profile, creating a real tradeoff between line command and headquarters work. Deployment includes the headquarters deployment/reserve contribution and staff-duty burden in command-capacity summaries; battle creation applies the same headquarters profile and staff-duty load. Staff and division duty now also create command fatigue after battle. Staff and division commander changes now spend reputation/威信 as political cost, with higher cost for replacements, transfers, and line-command or concurrent-duty officers. Army Camp recommends staff/division replacements by comparing projected headquarters or division command value against political cost plus the current mandatory battle sector context and the recent staff-accountability record for the same staff slot. The context carries sector name, terrain tags, enemy pressure, operation risk, structure count, persisted enemy-composition threats for mob/riflemen/brute/officer waves, and the active staff directive; recommendation cards display it as `戦場補正` with `主敵` and `参謀任務`, and staff cards additionally display `前戦評価` such as `参謀長警告 / 戦線整理不足 / 戦線整理警告 -> 候補評価なし`. The buttons use the same centralized assignment/payment path as manual selection. Drag/drop roster movement, deeper political backlash events, recon-quality uncertainty on command recommendations, and deeper staff-level consequence chains beyond the first accountability/recommendation pass remain later work.
- Bridge/rail choke points now exist for bridge terrain. `src/game/battle/chokePoints.ts` creates `鉄道橋隘路`, routes enemy movement through the lane, computes congestion pressure and delay, lets nearby structures add delay, and Battle Command shows choke pressure/delay overlays and alerts.
- Battle objective nodes now exist as tactical entities, not fixed decoration. `src/game/battle/createBattleState.ts` creates victory, supply, and visibility nodes, assigns terrain/structure-specific scenario variants, `resolveTick` shifts their control by local player/enemy presence, and Battle Command displays `保持/争奪/喪失` plus percentage values on the map and HUD.
- Battle objective response commands now exist as tactical interventions. `src/game/battle/orders.ts` exposes `objectiveResponseTacticalProfile` and `applyObjectiveNodeResponse`, and Battle Command renders objective-node action buttons that assign nearby defenders/reserves to hold, defend, suppress, or retake victory/supply/visibility points through the same StandingOrder path used by autonomous frontline command. Event-state profiles make `指揮信号途絶`, `補給点炎上`, and `観測点沈黙` produce different tactical responses instead of a single generic objective retask.
- Objective-response duties now survive into After Action and Army Camp. `BattleUnit.objectiveResponseRole` is battle-runtime only, but `src/game/battle/results.ts` maps it into Japanese battle roles, XP, officer XP, and commendations, and `applyBattleResult` records those roles in brigade history.
- Tactical objective outcomes now affect the campaign layer. `src/game/battle/results.ts` emits `ObjectiveBattleOutcome`, After Action displays it, and `src/game/campaign/applyCampaignDelta.ts` applies victory/supply/visibility effects to resources, theater pressure, strategic history, last message, and next-turn intel preparation.
- Objective-event response results now exist in the after-action growth loop. `BattleResult.objectiveEventResponseOutcomes` evaluates objective-response units against final objective control/event severity as `再確保`, `遅滞`, or `未回復`; After Action displays the summary and `tacticalLessons.ts` turns those records into next-battle readiness/control/fallback lessons. Deployment treats objective-event-only lessons as actionable when they infer a preferred doctrine, so the player can apply or save lessons from failed/delayed objective events before the next mandatory battle.
- Formation frontage now exists for player brigades. `src/game/battle/formations.ts` computes frontage width, depth, fire arc, density, overlap pressure, formation distance, fire/exposure modifiers, and formation-arc target filtering. Battle Command shows frontage lines, selected fire arc, and overcrowding alerts.
- Enemy assault groups now exist for undead waves. `src/game/battle/waves.ts` assigns each group an assault mode, target segment or fortification, frontage, depth, lane spread, cohesion, and movement vector. `resolveTick` uses frontage/cohesion for enemy movement, contact, structure threat, and line pressure. Battle Command shows enemy assault footprints, axes, mode, width, and Japanese target labels.
- Enemy officer command now exists for undead waves. `src/game/battle/waves.ts` spawns undead officers on command waves, assigns command roles/tiers/intents/groups/labels such as `第2波指揮核`, `波指揮核`, `突撃先導`, `支援節`, and `前衛群`. `resolveTick` calculates command influence, command-intent effects, command-tier pressure/recovery modifiers, and command-collapse state, and Battle Command shows `敵指揮網`, `指揮下`, tier summaries, `指令 戦線圧迫/側面迂回/陣地突破/銃列支援/再集結`, and `敵指揮崩壊` signals. The enemy command-network summary also provides `指揮核射撃`, `崩壊追撃`, and `予備投入` commands that can be queued through the same battle-only command queue, while the card-level `推奨実行` picks one of those actions from command tier, pressure, pursuit opportunity, lead threat, and breakthrough/facility context. Cards also show a pre-execution forecast such as `予測 指揮低下 / 2旅団 / 弾薬高` or `予測 突破封鎖 / 予備1 / 即応-32`, so the player can judge expected effect and cost before committing. Once an action is active, the same card can show `効果中 指揮核射撃`, `効果中 崩壊追撃`, or `効果中 予備接続` from the participating brigades' battle-runtime roles and disables the matching action to prevent accidental double commitment. The response-effect row then measures the action: command-node fire reports `効果 指揮崩壊...`, collapse pursuit reports `効果 再集結抑止...`, and reserve commitment reports `効果 戦線補強 / 守備... / 1旅団圧...`.
- Enemy command-network actions now carry into battle results. `BattleUnit.enemyCommandActionRole` maps command-node fire, collapse pursuit, and command-network reserve commitment into After Action roles `敵指揮核制圧`, `敵崩壊追撃`, and `指揮網予備投入`, with XP/officer XP and unit-history commendations. Battle Command's enemy command-network cards now expose `追撃候補` with target/reason/cohesion, so `崩壊追撃` is a readable battlefield opportunity for command-disrupted, wavering/routing/regrouping, breakthrough/flanking/overextended, low-cohesion, or small-group cleanup targets. `BattleResult.enemyCommandEffectOutcomes` separately records the measured response effect, such as `封鎖安定`, `指揮低下`, or `再集結抑止`, with metric labels, lesson tags, and assessment reasons.
- Enemy command-network action and effect history now feeds next-battle tactical lessons. `敵指揮核制圧` teaches a command-node suppression lesson that currently maps to `遅滞節約`, `敵崩壊追撃` maps toward `殺傷地帯`, and `指揮網予備投入` maps toward `弾性拒止`; measured `指揮網効果` entries add smaller reserve-readiness/control-radius growth and show as `次戦教訓 指揮網効果...` in After Action. Deployment can apply or save those lessons through the same `教訓方針` controls as staff-advisory lessons.
- In-battle target and ammo overrides now exist. `src/game/battle/orders.ts` can update a selected brigade's `targetPriority` and `ammoPolicy` during combat; Battle Command exposes `優先目標` and `弾薬方針` controls so the player can switch a unit to `敵指揮` or `集中射撃` without leaving the tactical battle.
- In-battle focus-fire marking now exists. `BattleUnit.focusTargetId` stores a runtime-only enemy target, `src/game/battle/orders.ts` can set or clear it with Japanese battle logs, and `resolveTick` tries that spotted enemy before falling back to normal target priority. This is deliberately not part of saved `StandingOrderTemplate`, because enemy IDs are battle-specific.
- In-battle volley fire missions now exist. `BattleFireMission` stores runtime-only `旅団斉射` or `戦線斉射`; `issueFireMission` assigns eligible brigades to a short fire mission after focus target assignment; `resolveTick` applies temporary fire, ammo, and condition modifiers while the mission remains active. This is battle-only and does not enter saved StandingOrder templates.
- Battle Command now has a `撤退予測` panel before the actual withdrawal button. It estimates withdrawal tone from line integrity, objective pressure, active soldiers, current casualties, hospital support, low-state brigades, damaged/overrun structures, objective control, and enemy suppression, then shows `戦線維持`, `崩壊圧`, `残存`, `永久損耗見込`, `戦利品効率 46%`, `補給消費 中`, and concrete reasons such as `視界点喪失` or `敵制圧0で追撃警戒`. The actual `撤退実行` still routes through `requestWithdrawal` and `createBattleResult`, so the forecast is a staff estimate rather than the authoritative result calculation.
- Withdrawal now has a rear-guard after-action loop. When `BattleResult.outcome` is `withdraw`, `createBattleResult` evaluates surviving brigades for rear-guard suitability from reserve readiness, ammo, morale, current role, `fallback_guard`/reserve-line posture, fire-support posture, casualty pressure, and any pre-battle `deploymentPlan.rearGuardUnitIds` assignment that entered BattleState as `frontlineRotationRole: rear_guard_cover`. The selected `撤退後衛` entries show `後衛援護`, `支援射撃`, or `離脱掩護`, estimate how much pursuit damage they prevented, add small XP bonuses, append commendations such as `後衛援護で追撃被害15抑止・後衛損耗17`, display in After Action, and carry into campaign last-message/unit `battleHistory`. Rear guards also now pay a deterministic rear-guard casualty cost with `軽微 / 消耗 / 危険` labels; that cost is added to raw battle losses and therefore permanent casualties after field-hospital recovery, so withdrawal cover is a tactical tradeoff rather than a free bonus. Planned rear guards also carry `WithdrawalRearGuardPlanAssessment` into `BattleResult`, so After Action displays `撤退後衛照合` with `予測損耗 -> 実損耗`, `予測将校危険`, `追撃抑止`, `温存`, and the tradeoff label; campaign application writes the same prediction-vs-actual note into the rear-guard unit history. Rear-guard casualty and risk also feed brigade officer risk/wound checks and officer history, making `誰に撤退後衛を任せるか` a commander-preservation decision rather than only a unit-loss decision.
- In-battle coordinated fire plans now exist. `BattleFirePlan` stores runtime-only staged fire orders created from current spotted targets. Battle Command can queue `旅団斉射` or `戦線斉射` stages, and `resolveTick` converts each due stage into a planned `BattleFireMission`, skipping invalid targets or unavailable units. This remains battle-only because enemy IDs and timing are specific to the current tactical fight.
- Doctrine-linked fire discipline now exists. `fireDisciplineFromDoctrine` derives a `FireDisciplineProfile` from campaign doctrine. Battle creation stores it in `BattleState`, Battle Command displays it as `火力規律`, and fire missions/fire plans use it for duration, cooldown, ammo cost, condition cost, plan stage spacing, and maximum plan stages.
- Doctrine-linked strategic staff support now exists. `strategicDoctrineFromDoctrine` derives a `StrategicDoctrineProfile` from campaign doctrine. It currently connects:
  - `organization`: deployment limit +1.
  - `training`: reduced rookie replenishment quality dilution and side-operation auto-resolve quality bonus.
  - `logistics`: reduced battle supply spend and veteran replenishment gold cost.
  - `engineering`: reduced build/repair cost, larger repair amount, and stronger fortification effects in visibility/cover/supply/casualty recovery calculations.
  - `medicine`: increased post-battle casualty recovery and reduced medical supply spend.
  - `command`: side-operation auto-resolve quality bonus.
  - `intelligence`: side-operation auto-resolve quality bonus, strategic intel preparation value, and next-turn initial enemy-intel confidence shift.
  Battle creation stores the strategic profile in `BattleState` and logs `参謀支援`; Doctrine and Engineering screens display the effective values.
- Armory rearm, weapon switching, and battle equipment loop now exist. `src/game/army/equipment.ts` maps each unit type to a default weapon, resolves the brigade's current `weaponKey`, estimates reserve weapon needs, consumes reserve stock, returns old weapons during switching, and restores brigade `weaponQuality`. Battle results generate captured weapons and per-unit equipment wear; `applyCampaignDelta` adds spoils to reserve stock and degrades brigade `weaponQuality`. Army Camp and Armory expose rearm/switch decisions, while After Action exposes spoils/wear, so scarce reserve weapons can be captured, spent, switched, and concentrated on valued brigades.
- Persisted enemy intelligence now exists for pre-battle decisions. `StrategicOperation.enemyCompositionIntel` stores the likely undead composition summary, confidence, mob/riflemen/brute/officer threats, per-type uncertainty ranges, recon revision metadata, and recon-effect labels. `src/game/theater/generateStrategicTurn.ts` creates this intel for the mandatory battle and side operations, `src/game/theater/enemyIntel.ts` normalizes/labels it, and `src/game/theater/spoilsIntel.ts` updates it when recon side operations improve or compromise same-turn intel. Theater main battles, Theater side operations, Deployment briefing, and Army Camp command recommendations now read the same persisted operation intel first, falling back to sector-derived forecast only for old/in-memory state. `src/game/battle/waveIntel.ts` also converts the same intel into tactical wave timing, command-wave probability, per-enemy-type pressure multipliers, six predicted timeline entries, confidence-sensitive display labels, misinformation-specific summaries, and actual-vs-predicted wave fields. Deployment displays this as `戦術波` plus `敵波タイムライン`; misleading intel shows `敵波情報に誤情報疑い / 実波要警戒`, `時刻不明`, `敵種誤情報疑い`, and a warning that timing/enemy type/command wave may be wrong. When intel is misleading, the visible timeline remains unreliable while `src/game/battle/waves.ts` uses the actual wave fields to worsen spawn interval, command-wave chance, and enemy-type pressure multipliers; Battle Command displays `実波警戒` and the battle log notes early/strong wave arrival. After Action now records the bad-intel result and writes officer lesson history. Save v6 backfills and normalizes the strategic intel field for existing campaigns. Later work should add richer enemy-intel UI beyond compact text ranges, per-staff-slot blame attribution, and doctrine/staff upgrades unlocked by repeated misinformation lessons.
- Fine formation-facing adjustment now exists. `StandingOrder.facingDeg` already stores arbitrary clamped angles, and Battle/Deployment now expose `北へ15度 / 正面0度 / 南へ15度` controls alongside the five UGCW-readable presets. The same value is saved in StandingOrder templates and reused by formation fire-arc checks.
- Preset-based frontline geometry now exists. `src/game/battle/frontlineDefaults.ts` transforms sector frontline profiles into forward, depth, wide, choke-compressed, refused-left, or refused-right layouts; Deployment saves the chosen layout into campaign `deploymentPlan`, and Battle creation applies it to frontline segments, default positions, terrain/choke generation, and StandingOrder realignment.
- Point-by-point frontline handle controls now exist. Deployment can adjust one segment's main line, fallback depth, command width, and control radius after choosing a geometry preset; adjusted segments are marked in the preview and Battle displays labels such as `戦区標準+手動1`.
- Deployment drag sketch drawing now exists for desktop. While `地図で描画` is active, the deployment preview accepts a dragged line, samples it, and simplifies it into the existing 2-5 point `FrontlineGeometryAdjustment.sketchLines` format. This keeps click point-editing, `既存線を編集`, plan-set save/apply, and Battle carryover compatible while making pre-battle frontline intent faster to express.
- Battle-time selected-frontline direct controls now exist. Battle Command can select a pressure card/segment, move the line forward/back, widen or compress its command area, and drag the selected line's anchor/fallback handles; these edits update the runtime `FrontlineSegment` and assigned brigades' StandingOrders so autonomous movement reacts immediately.
- Enemy morale routing/regrouping now exists. `EnemyAssaultPlan` stores morale and morale state; `resolveTick` applies morale shock from player/structure fire, moves low-morale groups into `動揺` or `潰走`, then lets routed groups rally through `再集結` before returning to normal pressure. Battle Command shows the state on enemy map tokens, alerts, and the battle log.
- Sector-specific deployment depth limits now exist. `FrontlineSegment.deploymentLimit` stores the allowed pre-battle deployment band; Deployment shows `出撃深度` and `許可帯`, and the active-line handle editor can push, pull, widen, or narrow that band as part of the saved `deploymentPlan.frontlineGeometry`. StandingOrder draft/template alignment and Battle creation clamp initial anchors to the adjusted sector-derived band.
- Arbitrary curved-line editing beyond the current 2-5 point frontage, deeper defilade/elevation handling, and richer objective-event chains remain later work.

## Unit Types

Base game player units:

| Unit Type | Role |
| --- | --- |
| Infantry | Main line holder. Good in trenches, hills, forests. |
| Jaeger / Skirmisher | Scout/flank unit. Better in forest, useful for harassment. |
| Artillery | High damage/support, ammo-hungry, vulnerable if overrun. |
| Engineer | Builds, repairs, improves, or demolishes defensive works. |

Additional product units:

- cavalry / mounted scouts
- guard infantry
- supply wagon

## Army Scale

UGCW-style army management assumes large-scale growth, not a permanent 4-unit party.

Scale target:

```text
Product ceiling: 5 corps x 4 divisions x 6 brigades = 120 brigades
Initial playable slice: I Corps with 4 division rows, 6 brigade slots per division, first 2 divisions usable.
```

The UI should show locked/empty future capacity early, even while the first implementation only fills part of the army. Army Organization and doctrine/career systems should eventually unlock more corps, divisions, brigade slots, and deployment capacity.

Current Army Camp reads Formation-backed divisions and corps-headquarters staff assignments instead of only slicing the unit list. The first corps starts with two active divisions, two locked future divisions, and four staff slots. Active divisions now have a division commander and a division directive. The directive is not cosmetic: battle creation applies it to each brigade's initial StandingOrder posture, target priority, ammo policy, fallback threshold, control radius, and reserve readiness before officer and headquarters modifiers. Division commanders are one-division-per-officer and carry command-duty load when they also command a brigade; this load is combined with corps-staff duty for command-capacity calculations in Army, Officers, Deployment, and Battle. Division commanders also gain after-action command XP, risk, wound, and command-fatigue records from subordinate brigade roles, so higher command becomes part of the officer growth loop. The Officers tab can now rotate fatigued commanders into rest and manually return them to duty, making command fatigue manageable. Army Camp now charges 威信 political cost for staff and division commander changes, so command-structure reshuffles are no longer free, and it recommends higher-value staff/division replacements when projected command improvement justifies the cost, current battlefield context, and persisted enemy composition. Theater and Deployment also show that enemy composition, per-type ranges, and intel confidence before the player commits to camp/deployment decisions. This keeps the UGCW-style army board visible while allowing later corps/division unlocks, deeper political events, deeper rest/rotation policy, richer enemy-intel UI, and DLC content packs without moving the current screen boundary.

Current implementation direction:

- initial army starts around 10 brigades
- main battlefield deployment cap starts at 6 brigades
- army screen displays product-scale ceiling and locked divisions
- active division rows expose commander/directive controls
- division commander duty load affects brigade-command capacity when the same officer also commands a brigade
- deployment and battle cards show division command summaries
- after-action reports and officer histories include division command XP/risk
- battle screen displays participating brigade count

Base game enemy units:

| Unit Type | Role |
| --- | --- |
| Undead Mob | Basic mass infantry. Weak but numerous. |
| Undead Riflemen | Slower ranged pressure. |
| Undead Brute | Morale shock / line breaker. |
| Undead Officer | Buffs nearby horde, priority target. |

## Unit Stats

Player brigade/unit:

```text
id
name
type
soldiers
maxSoldiers
experience
level
morale
condition
ammo
weaponQuality
officerId
traits
battleHistory
```

Officer:

```text
id
name
rank
experience
status: active | resting | wounded | dead
recoveryBattles
traits
```

Campaign resources:

```text
gold
recruits
veteranPool
supplies
materials
engineerLabor
reputation
weaponStock
campaignDayOrChapter
```

Theater sector:

```text
id
name
band
control
terrainTags
structures
linkedSectors
supplyValue
railValue
medicalValue
engineerValue
enemyPressure
corruptionLevel
battleTemplates
history
```

Strategic operation:

```text
id
type
sectorId
isMandatory
canAutoResolve
risk
cost
assignedForces
victoryEffects
drawEffects
defeatEffects
linkedMainBattleId
```

Defensive structure:

```text
id
type
mapNodeId
durability
maxDurability
level
status: planned | built | damaged | overrun | abandoned
effects
buildCost
repairCost
owner
history
```

## Orders

| Order | Effect |
| --- | --- |
| Hold | Defensive posture. Better cover/morale, lower movement. |
| Advance | Move toward target or pressure zone. Uses condition. |
| Flank | Attempts morale shock from side. Riskier, stronger if terrain allows. |
| Rest / Resupply | Recovers condition or ammo if supply is available. |
| Build / Repair | Engineer-focused order that improves or restores a defensive structure. |
| Retreat | Pulls unit back, reduces further casualties, may affect battle score. |

## Terrain Effects

| Terrain | Intended Effect |
| --- | --- |
| Open field | Fast movement, poor cover. |
| Forest | Better cover/concealment, slower movement, good for skirmishers. |
| Hill | Sight/accuracy/morale advantage. |
| Trench / cover | Strong defense, slow to assault. |
| Marsh / mud | Slow, fatigue-heavy, dangerous under pressure. |
| Bridge / choke | Limits numbers through a choke node, concentrates enemies into a lane, adds congestion delay, and is ideal for defense but dangerous if bypassed or overrun. |
| Village | Mixed cover, urban friction, useful defensive node. |

## Tactical Map Presentation

The tactical battle map must communicate battle decisions, not only place unit cards on a background.

Required visual layers:

- Brigade formation frontage and selected fire arc
- Victory / strategic point flags
- Supply points
- Visibility / reconnaissance points
- Terrain callouts for cover and movement penalties
- Defensive lines and fortification facing
- Enemy approach arrows
- Minimap
- Battle objective timer and line integrity
- Unit command palette
- Battle phase / wave counter

Current implementation uses CSS placeholders for these layers. Later image generation should replace symbols and textures without removing the information layers.

## Defensive Construction

Defensive construction is a core differentiator.

The player should prepare positions because the enemy is endless and numerically superior. Fortifications turn the campaign from a pure series of battles into a defensive theater.

### Structure Types

| Structure | Role |
| --- | --- |
| Trench | Main line cover. Improves defense and morale for holding infantry. |
| Barricade | Cheap obstacle that slows mobs and degrades under pressure. |
| Redoubt | Expensive strong point that anchors a line. |
| Wire / stakes | Slows or disrupts enemy approach. |
| Artillery pit | Protects artillery and improves sustained firing position. |
| Supply depot | Improves ammo recovery in a local zone. |
| Field hospital | Improves post-battle casualty recovery if not overrun. |
| Observation post | Improves warning time, accuracy, or enemy preview. |
| Fallback line | Reduces withdrawal losses and creates a second defensive position. |

### Construction Rules

Construction should compete with army recovery.

Costs can include:

- materials
- gold
- engineer labor
- time/battle preparation slots
- opportunity cost against replenishment or ammunition

Structures should:

- provide clear tactical value
- take damage under pressure
- be repairable between battles
- be abandonable during retreat
- be overrun if the line collapses
- carry history if they survive multiple battles

### Why Fortifications Matter

Fortifications add rationality to the setting:

- a trained but outnumbered army would prepare ground
- endless undead waves make static defenses valuable
- supply depots and fallback lines create strategic choices
- losing a prepared line should hurt even if the army escapes

## Battle Outcomes

Base game outcomes:

- `hold`: survived until timer or objective complete
- `withdraw`: player chose retreat after a valid operational threshold
- `collapse`: defensive line failed or army morale broke

Outcome should affect:

- gold/recruits/supplies reward
- materials/engineer labor recovery
- reputation
- enemy pressure in later battles
- officer/unit events
- damaged, abandoned, or preserved defensive works

## Growth Rules

Growth should come from use, but use creates risk.

Unit experience increases through:

- time engaged
- damage dealt
- holding objective
- surviving battle

Unit quality decreases or becomes harder to maintain through:

- casualties
- rookie replenishment
- officer death
- repeated overuse without recovery

Veteran replenishment should preserve quality but cost more.

Rookie replenishment should restore bodies but dilute experience.

## Full UGCW-Equivalent Baseline

Over time, assume the design needs parity with UGCW-like systems:

- multiple player formations
- officer hierarchy
- unit experience and perks
- army organization growth
- weapon stock and equipment quality
- supply/logistics
- side battles or strategic optional actions
- meaningful victory/draw/loss outcomes
- battle-to-battle casualty and morale consequences

The added layer is not replacing those systems. Fortification and theater defense sit on top of them.
