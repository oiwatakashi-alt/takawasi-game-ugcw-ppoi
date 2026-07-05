# Requirements - takawasi game

Last updated: 2026-06-30

## Goal

Create a full browser tactical-campaign game under the `takawasi game` folder, planned at product scale from the beginning.

The game is a logic-first tactical campaign inspired by `Ultimate General: Civil War`: a trained army survives repeated battles against a larger undead force, while unit losses, officer events, experience, morale, fatigue, ammo, replenishment, logistics, and defensive works carry forward between battles.

UGCW-level campaign/battle/army-management depth is the baseline target, not the final ceiling. This game should exceed that baseline through fortification, defensive construction, engineers, supply positions, field hospitals, observation posts, and fallback-line planning.

## Product Scope

### Product Must Have

- A game that can be launched locally.
- Browser-based app built with Vite + TypeScript + React.
- Tick-based real-time battle simulation with pause/speed controls.
- Separate UGCW-style scene flow: strategic campaign map, camp tabs, deployment screen, battle screen, and after-action report screen.
- Player units with persistent soldiers, experience, morale, fatigue/condition, ammo, officer, and weapon quality.
- Undead enemy waves that create escalating pressure.
- Terrain that affects battle outcomes.
- Defensive construction that affects battle outcomes.
- Battle results that persist into the next battle.
- Rookie/veteran replenishment tradeoff.
- Versioned local save abstraction; first provider can use `localStorage`.
- No dependency on real user data or external production services.

### Product Should Have

- Simple restart or replay flow.
- Clear placeholder UI before generated art.
- Multi-battle campaign structure.
- Officer injury/death events.
- Build/repair choice for at least one defensive structure.
- Retreat/withdraw option.
- Battle outcome categories such as hold, withdraw, and collapse.
- Corps/division/brigade-style organization over the product roadmap.
- Data-driven battle, unit, structure, doctrine, enemy, event, and terrain definitions.
- Expansion-safe save schema and content-pack model.

### Not Product Goals

- Real-money payment.
- Online multiplayer.
- User account registration.
- External production API integration.
- Collection or storage of real personal data.
- Direct historical simulation requiring exact real-world units, flags, commanders, or battle names.

## Open Decisions

| Item | Current Decision |
| --- | --- |
| Game genre | Tactical campaign / attrition-management war game. |
| Target platform | Local browser game. |
| Tech stack | Vite + TypeScript + React. |
| Art style | Early placeholder UI; later retro, slightly pop, readable tactical-board style. |
| Input method | Mouse-first UI with buttons/panels; keyboard shortcuts optional later. |
| Save data | Versioned save abstraction; initial provider can use `localStorage`. |
| Battle model | Tick-based real-time simulation. |
| Setting | Fictional 1880s German-inspired army vs Russian-inspired undead horde. |
| First priority | Game logic, campaign carryover, unit growth, attrition, replenishment decisions, defensive construction tradeoffs. |

## Acceptance Criteria

Implementation should not be treated as complete until:

- The game starts from a documented command or file.
- The main play loop works end to end.
- The user can clearly move through `戦略マップ -> 幕舎 -> 出撃配置 -> 戦闘 -> 戦果報告` without those scenes being collapsed into one screen.
- The user can understand the current state without reading source code.
- At least two battles can be played in one campaign.
- Unit losses and experience carry between battles.
- Replenishment decisions visibly change resources and/or unit quality.
- Defensive construction or repair visibly changes battle outcomes and consumes resources.
- Restart/reset behavior is verified.
- Browser or runtime verification has been performed and recorded in `FILEMAP.md`.

## QA Checklist

- Launch succeeds.
- No blocking console/runtime errors.
- Main input works.
- Battle tick runs, pauses, and resumes.
- Enemy waves spawn.
- Unit orders change battle state.
- Morale/fatigue/ammo/casualties update coherently.
- Battle result is produced.
- Campaign state persists after battle.
- Save/reset behavior works.
- Reload behavior is understood and documented.
- UI text fits on the target screen size.
- No unintended external network or production service usage.
