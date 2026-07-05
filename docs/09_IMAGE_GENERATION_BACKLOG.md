# Image Generation Backlog

Last updated: 2026-07-02

## Policy

Generated images are not the first implementation priority.

The game should be built around product-scale logic, campaign structure, army management, battle simulation, fortification, and UI readability first. Image generation should mostly happen after those systems are structurally in place.

However, if a specific visual asset becomes necessary to clarify UI layout, tactical readability, or art direction, it can be generated earlier and recorded here.

## Workflow

1. Add candidate asset to this backlog.
2. Mark its reason and target screen.
3. Generate only when the target UI/system exists or the asset is needed to unblock design.
4. Save generated originals under planned `assets/source/`.
5. Process into game-ready sizes under planned `assets/processed/`.
6. Add thumbnail/review versions under planned `assets/thumbs/`.
7. Register final asset in asset manifest and FILEMAP.

## Planned Asset Folders

```text
assets/
  source/
  processed/
  thumbs/
src/assets/
  generated/
  manifest.ts
docs/
  art_prompts/
  art_direction.md
```

## Art Direction Reminder

- Retro tactical war-game style.
- Slightly pop, readable, not photorealistic.
- Board-game/token clarity over cinematic chaos.
- No gore focus.
- No modern weapons.
- Fictional 1880s German-inspired army vs Russian-inspired undead horde.
- Eastern Front-like terrain: forests, mud, snow, marsh, villages, rail lines, bridges, trenches.

## Generation Backlog

Implementation note, 2026-06-30:

- Initial app implementation uses CSS symbolic tokens, terrain colors, and structure icons.
- P1 image generation is intentionally deferred until the first browser QA confirms the Battle Command and Engineering Works layouts are stable enough to size assets.
- Army Camp rework note: images alone will not make the UI UGCW-like. The Army screen now has a corps/division/brigade-slot structure, so generated images should target that structure: small brigade flags, officer portraits, weapon silhouettes, and UI frame textures.
- UI/UX gap pass note: Battle Map, Armory, Career, and Deployment now have denser GUI structures. Generated art should support these fixed UI surfaces rather than replace the layout.
- Army scale / tactical map note: battle map now has VP, supply point, visibility point, approach arrows, minimap, terrain callouts, and front-line placeholders. Generate tactical UI symbols before full background art.
- RTS combat note: battle units, enemies, and structures now have tactical positions, range, target IDs, and engagement lines. Generated assets should keep target/range readability clear rather than covering the map with illustration detail.
- First generation pass note: P1 Battle Command tokens/icons were generated and processed into `src/assets/generated/`. Prompt record: `docs/art_prompts/2026-06-30_p1_battle_assets.md`.
- Second generation pass note: UIUX assets were generated in sheets and processed into Battle, Army, Armory, Deployment, Engineering, Theater, and Doctrine screens. The manifest is now a shared registry instead of Battle-only. Prompt record: `docs/art_prompts/2026-06-30_pass2_uiux_assets.md`.
- Observation visibility note: the existing observation-post icon is now active in Engineering, Deployment structure lists, and Battle Command map structures. No new image generation was needed for the visibility slice.
- Field hospital recovery note: the existing field-hospital icon is now active as a buildable Engineering/Battle structure. No new image generation was needed for the casualty-recovery slice.

| ID | Priority | Asset | Target Screen | Timing | Notes | Status |
| --- | --- | --- | --- | --- | --- | --- |
| IMG-001 | P1 | Player infantry unit token | Battle Command | After battle UI shell exists | Needs readable facing/frontline silhouette. | processed/active |
| IMG-002 | P1 | Undead mob unit token | Battle Command | After battle UI shell exists | Should read as mass pressure, not detailed gore. | processed/active |
| IMG-003 | P1 | Trench / prepared line tile | Battle Command / Engineering Works | After fortification UI exists | Must clearly show cover direction and durability state. | processed/active |
| IMG-004 | P1 | Forest terrain tile | Battle Command / Theater sector preview | After map rendering approach chosen | Needs readable cover/visibility meaning. | planned |
| IMG-005 | P1 | Mud / marsh terrain tile | Battle Command / Theater sector preview | After map rendering approach chosen | Must communicate fatigue/movement penalty. | planned |
| IMG-006 | P1 | Hill / high ground tile | Battle Command | After map rendering approach chosen | Needs tactical height-readability. | planned |
| IMG-007 | P1 | Village sector tile | Battle Command / Theater Command | After sector rendering exists | Should support defense and urban friction. | planned |
| IMG-008 | P1 | Supply depot structure icon | Engineering Works / Battle Command | After logistics model exists | Must show local ammo/supply role. | processed/active in Battle Command |
| IMG-009 | P1 | Field hospital structure icon | Engineering Works / Battle Command / After Action | After casualty recovery model exists | Should communicate recovery, not modern medicine. | processed/active in Engineering and Battle |
| IMG-010 | P1 | Observation post icon | Engineering Works / Theater Command / Battle Command | After reconnaissance UI exists | Used for enemy wave warning/intel and Battle visibility range. | processed/active in Engineering and Battle |
| IMG-011 | P1 | Player officer portrait set | Officers / Army Camp | After officer roster UI exists | Retro portrait cards; generate as coherent set for right-side unit inspector. | planned |
| IMG-012 | P2 | Undead officer / enemy commander token | Battle Command / Intel | After special enemy model exists | Should be readable as command threat. | processed/active in Battle Command |
| IMG-013 | P2 | Artillery unit token | Battle Command | After artillery rules exist | Needs gun direction/crew readability. | processed/active |
| IMG-014 | P2 | Engineer unit token | Battle Command / Engineering Works | After engineer rules exist | Must read as construction/repair unit. | processed/active in Battle Command |
| IMG-015 | P2 | Strategic five-band campaign map background | Theater Command | After Theater Command layout exists | Should remain functional, not decorative. | planned |
| IMG-016 | P1 | Brigade slot flag and frame set | Army Camp | After corps board layout exists | Small unit flags, paper cards, brass/iron frames for brigade slots. | processed/active in Army Camp |
| IMG-017 | P2 | Doctrine / staff screen background motifs | Doctrine / Staff | After doctrine branches exist | Subtle UI texture only. | planned |
| IMG-018 | P3 | Title screen key visual | Main Menu | After core game loop is playable | Not needed until identity pass. | planned |
| IMG-019 | P3 | Base game chapter banner set | Theater Command / Chapter transition | After campaign chapter list stabilizes | Generate as a consistent set. | planned |
| IMG-020 | P3 | DLC 1 Iron Winter key visual | DLC planning | Much later | Winter siege/rail/fortress visual. | planned |
| IMG-021 | P1 | Weapon silhouettes for Army inspector | Army Camp / Armory | After Army Camp inspector exists | Small readable 1880s rifle, jaeger rifle, field gun, engineer tools silhouettes. | processed/active in Army Camp and Armory |
| IMG-022 | P1 | Battle Map operation flag set | Theater Command | After battle-map briefing exists | Main battle flag and side-operation tags with readable reward/effect slots. | processed/active in Theater Command |
| IMG-023 | P1 | Deployment starting-zone frame | Deployment | After 6-slot deployment board exists | Striped starting box frame, reserve roster paper labels, selected-unit markers. | processed/active in Deployment |
| IMG-024 | P2 | Career policy medal/pip set | Doctrine / Career | After doctrine category rows exist | Small medals/pips for command, organization, training, logistics, engineering, medicine. | processed/active in Doctrine |
| IMG-025 | P1 | Tactical objective icon set | Battle Command | After tactical nodes exist | VP flag, supply crate, visibility eye/tower, neutral/held/contested variants. | processed/active |
| IMG-026 | P1 | Enemy approach arrow set | Battle Command | After approach arrows exist | Red undead wave arrows, flank route markers, intensity variants. | planned |
| IMG-027 | P1 | Minimap marker set | Battle Command | After minimap exists | Player, enemy, objective, front line, fog/visibility markers. | planned |
| IMG-028 | P1 | Firing/engagement line VFX set | Battle Command | After RTS engagement lines exist | Rifle, artillery, melee, and structure-fire strokes; must remain readable over terrain. | planned |
| IMG-029 | P1 | Range ring / target marker UI set | Battle Command | After range/target state exists | Subtle rings, selected target pips, moving/targeting states for brigade tokens. | processed/active partial; CSS rings retained |
| IMG-030 | P2 | Fortification damage state overlays | Battle Command / Engineering Works | After structure durability loop exists | Built, damaged, overrun overlays for trench, barricade, supply depot. | processed/active partial |
| IMG-031 | P1 | Player jaeger / skirmisher token | Battle Command | After jaeger rules exist | Needs lighter infantry silhouette distinct from line infantry. | processed/active |
| IMG-032 | P1 | Undead riflemen and brute tokens | Battle Command | After enemy type rendering exists | Enemy types should read as separate formations on the tactical map. | processed/active |
| IMG-033 | P1 | Barricade token | Battle Command / Engineering Works | After fortification list exists | Distinguish barricade from trench while preserving small-map readability. | processed/active |
| IMG-034 | P2 | Corps standard and officer placeholders | Army Camp / Officers | After army inspector exists | Small identity aids for army board and selected-unit/officer panels. | processed/active in Army Camp |
| IMG-035 | P2 | Repair, threat, and reserve UI markers | Engineering / Theater / Deployment | After UI surfaces exist | Small supporting symbols only; text remains primary information. | processed/active |

## Prompt Seeds

Use these only as starting points. Record final prompts under `docs/art_prompts/` when generation begins.

### Unit Token Seed

```text
retro tactical war game unit token, readable 2D board-game style,
fictional 1880s German-inspired infantry, muted but slightly colorful,
clear silhouette, visible facing direction, no modern weapons, no photorealism
```

### Undead Token Seed

```text
retro tactical war game unit token, readable 2D board-game style,
fictional Russian-inspired undead infantry mob, mass pressure, no gore focus,
clear silhouette, muted colors, no modern weapons, no photorealism
```

### Terrain Tile Seed

```text
retro tactical war game terrain tile, readable top-down board-game style,
Eastern Front-inspired mud, forest, trench, village, bridge, muted colors,
clear gameplay readability, not photorealistic
```

## Processing Notes

Expected generated originals:

- Large PNG or WebP source.
- Keep source unmodified.
- Produce game sizes only after UI dimensions are known.

Likely processed sizes:

- `64x64` token/icon
- `128x128` token/icon
- `256x256` card image
- `512x288` banner
- `1024x576` large scene

Processing tools:

- ImageMagick if available.
- Python + Pillow if available.
- Node-based image tools if added to project.
