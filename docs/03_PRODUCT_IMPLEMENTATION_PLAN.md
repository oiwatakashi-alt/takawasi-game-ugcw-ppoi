# Product Implementation Plan

Last updated: 2026-06-30

## Implementation Policy

Implement with full product boundaries from the beginning.

The first playable route can be content-thin, but the architecture should already contain the domains needed for the full base game and the first expansion:

- campaign/theater
- army organization
- officers
- units
- battle simulation
- fortifications
- logistics
- doctrine/career
- content definitions
- save/versioning
- UI screens
- art asset manifest

Do not hard-code a narrow demo loop that later requires a rewrite.

## Tranche 0 - Product Foundation

Goal:

Create the game shell and domain model that can support the full game.

Tasks:

- Scaffold Vite + TypeScript + React.
- Define versioned save schema.
- Define domain models for strategic campaign map, theater bands, theater sectors, army, officers, units, equipment, logistics, fortifications, battle, doctrine, and content definitions.
- Define data registries for unit types, enemy types, terrain, structures, weapons, orders, doctrines, battle templates, and events.
- Define dynamic operation generation from current army position and adjacent sector pressure.
- Define auto-resolve model for side operations.
- Create deterministic tick simulation entrypoint.
- Create initial UI shell with main screens wired to domain state.
- Use the UGCW-derived scene split as the base UI flow: strategic map, camp tabs, deployment, battle, after-action.
- Add FILEMAP entries before or alongside implementation.

Exit criteria:

- App boots.
- New campaign creates full product-shaped state.
- Save/load roundtrip preserves versioned state.
- UI routes/screens exist even if content is thin.

## Tranche 1 - Base Campaign Loop

Goal:

Make a complete campaign loop using product-shaped systems.

Tasks:

- Theater Command screen.
- Strategic campaign map with the five major bands.
- Dynamic main battlefield generation from current army position.
- 3-4 generated side operations per strategic turn.
- Auto-resolve for side operations.
- Army Camp screen.
- Engineering Works screen.
- Deployment screen between camp preparation and tactical battle.
- Battle Command screen.
- After Action Report screen.
- Initial officer roster.
- Initial unit roster.
- Initial sector/battle templates.
- Initial operation types: hold sector, counterattack, recon patrol, engineer works.
- Initial defensive structures: trench, barricade, supply depot.
- Initial resources: manpower, gold, materials, ammunition, supplies, engineer labor, reputation.
- Battle result application to army, officers, resources, and structures.

Exit criteria:

- Player can go from theater planning to battle to report to recovery to next sector.
- Losses, experience, officer events, resource spend, and structure damage persist.
- Defensive construction visibly changes battle results and consumes resources.
- Strategic operation results alter sector pressure, resources, or future battle conditions.
- Mandatory main battlefield cannot be skipped.
- Side operation auto-resolve produces real consequences.

## Tranche 2 - UGCW Baseline Parity Systems

Goal:

Bring the core UGCW-like depth online.

Tasks:

- Larger army hierarchy.
- Officer rank/capacity and command efficiency.
- Unit quality, perks, battle history, and veteran identity.
- Rookie/veteran replacement quality logic.
- Weapon stock, equipment distribution, and weapon quality.
- Morale, fatigue, cover, flank, ammo, and supply depth.
- Optional/side battles or strategic actions.
- UGCW-style side-operation modifiers that alter future grand/sector battles.
- Deeper operation generation rules based on player position, rear pressure, forward pressure, ignored operations, and enemy momentum.
- Reconnaissance/intelligence preview.
- Career/doctrine upgrades.
- Battle outcome grades and long-term consequences.

Exit criteria:

- Campaign feels like army management, not isolated battles.
- Player must make hard choices across replenishment, weapons, officers, supply, and defenses.

## Tranche 3 - Defensive War Differentiator

Goal:

Make fortification and theater defense the thing this game does beyond UGCW.

Tasks:

- Full structure list: trench, barricade, wire/stakes, redoubt, artillery pit, supply depot, field hospital, observation post, fallback line.
- Structure placement constraints by terrain and sector.
- Structure levels/upgrades.
- Repair and abandonment.
- Overrun consequences.
- Engineer units and engineer labor.
- Enemy units that target or counter defenses.
- Hold/withdraw/fallback decision model.
- Named sectors and defensive-line history.

Exit criteria:

- Player remembers not only veteran units, but also positions and lines they invested in.
- Abandoning a fortified line hurts, but can be the correct decision.

## Tranche 4 - Base Game Content Pass

Goal:

Turn the systems into a full base game campaign.

Tasks:

- Multiple campaign chapters.
- Multiple sector types: forest, marsh, village, rail bridge, open field, fortified town.
- Escalating enemy roster.
- Named officers and unit name generation.
- Medals, commendations, memorials.
- Campaign events.
- Balance pass.
- Browser QA and regression scenarios.

Exit criteria:

- Base game has enough campaign length, variety, and long-term identity to stand as a product.

## Tranche 5 - Art / Generated Asset Integration

Goal:

Replace placeholder UI with generated and processed retro tactical assets.

Tasks:

- Art direction lock.
- Prompt library.
- Source/processed asset folders.
- Asset manifest.
- Unit token art.
- Terrain tile art.
- Structure icons.
- UI panels.
- Battle report visuals.

Exit criteria:

- Art improves readability and identity without forcing logic rewrites.

## Tranche 6 - DLC 1 Readiness

Goal:

Ensure the base game can accept expansion content without major rewrites.

Tasks:

- Content-pack metadata.
- Battle-pack registration.
- Enemy-pack registration.
- Doctrine-pack registration.
- Structure-pack registration.
- Save compatibility strategy.
- Feature flags or content availability rules.

Exit criteria:

- DLC 1 can add campaign sectors, units, structures, doctrines, enemies, and events through content definitions plus isolated logic hooks.

## First Code Structure Target

```text
src/
  app/
    App.tsx
    routes.ts
  content/
    registries.ts
    baseGame/
      battles.ts
      doctrines.ts
      enemies.ts
      events.ts
      structures.ts
      terrain.ts
      units.ts
      weapons.ts
  game/
    army/
    battle/
    campaign/
    doctrine/
    fortifications/
    logistics/
    officers/
    save/
    theater/
  components/
    screens/
      AfterActionScreen.tsx
      ArmyCampScreen.tsx
      ArmoryScreen.tsx
      BattleCommandScreen.tsx
      DeploymentScreen.tsx
      DoctrineScreen.tsx
      EngineeringWorksScreen.tsx
      OfficersScreen.tsx
      TheaterCommandScreen.tsx
    shared/
      labels.ts
  styles/
  assets/
    generated/
    manifest.ts
```

## First Data Flow

```text
CampaignState
  -> StrategicCampaignMap
  -> SideOperationAutoResolve optional
  -> CampPreparation
  -> DeploymentCheck
  -> BattleScenario
  -> BattleState
  -> BattleTickResult[]
  -> BattleResult
  -> CampaignDelta
  -> RecoveryAndConstruction
  -> VersionedSave
```
