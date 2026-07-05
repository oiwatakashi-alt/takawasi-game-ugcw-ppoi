# Art / Image Generation Policy

Last updated: 2026-06-30

## Decision

Images and generated art come after the core product systems are structurally in place. Early builds can use placeholder shapes, colors, icons, and simple UI.

Reason:

- the game should win on logic first
- generated art can be expensive to iterate
- consistent assets require a stable UI and unit list
- art should support readable gameplay, not hide weak systems

## Target Art Direction

When art begins, use a retro, slightly pop, readable tactical-game style.

Avoid:

- photorealistic war horror
- overly dark images
- gore-focused undead design
- hard-to-read painterly battle chaos
- modern weapons

Prefer:

- readable 2D unit tokens
- board-game-like silhouettes
- retro PC war-game colors
- slightly colorful but muted palette
- simple terrain icons
- unit cards with clear role identity

## Asset Workflow

Planned folders:

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

Workflow:

1. Generate high-resolution source assets.
2. Save source images under `assets/source/`.
3. Process into game-ready sizes.
4. Save processed images under `assets/processed/`.
5. Generate thumbnails for review.
6. Record prompts and asset metadata.
7. Register assets in FILEMAP.

## Processing Capability

Codex can handle later asset processing from command line if the local tools are available.

Expected operations:

- resize
- crop
- convert PNG/JPEG/WebP
- create thumbnails
- make simple spritesheets
- organize filenames
- generate TypeScript asset manifests

Likely tools:

- ImageMagick if installed
- Python + Pillow if available
- Node image libraries if added later

## First Asset Targets

Do not start these until phase 1 logic is playable.

- player infantry token
- player officer token
- player artillery token
- undead mob token
- undead officer token
- forest tile
- hill tile
- trench tile
- marsh tile
- village tile
- unit card frame
- morale/ammo/fatigue/supply icons
