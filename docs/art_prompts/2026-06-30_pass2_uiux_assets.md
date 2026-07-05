# Pass 2 UIUX Asset Prompts

Date: 2026-06-30
Mode: built-in image generation, then local chroma-key removal, trimming, square-canvas normalization, and resizing.

## Purpose

This pass expands generated images beyond Battle Command tokens. The goal is not decoration; the assets are small UI aids for UGCW-like army organization, deployment readability, fortification state, theater operation labels, and doctrine categories.

## Processing

Generated sheets were copied into `assets/source/` and preserved.

Source sheets:

- `assets/source/enemy-specials-sheet-source.png`
- `assets/source/fortification-status-sheet-source.png`
- `assets/source/army-ui-sheet-source.png`
- `assets/source/weapon-silhouettes-sheet-source.png`
- `assets/source/deployment-theater-ui-sheet-source.png`
- `assets/source/engineering-doctrine-icons-sheet-source.png`

Processed outputs:

- alpha PNGs in `assets/processed/`
- review/thumb PNGs in `assets/thumbs/`
- Vite-consumed PNGs in `src/assets/generated/`

Local processing used bundled Python/Pillow. The pipeline removed flat `#00ff00` chroma-key backgrounds, filtered small fragments, trimmed alpha bounds, centered icons on square canvases, and exported `128x128` and `64x64` variants.

QA artifact:

- `/Users/oiwa/Documents/Codex/2026-06-30/new-chat/outputs/takawasi-uiux-assets-pass2-contact.png`

## Shared Style

```text
Use case: stylized-concept
Style/medium: slightly pop retro tactical war-game UI asset, crisp readable painted icon, clear at 64x64.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for removal.
Constraints: no text, no watermark, no modern objects, no real national flags or real insignia, no photorealism, no dark unreadable detail.
```

## Generated Groups

### Group A - Battle補完

Generated assets:

- `undead-riflemen-token`
- `undead-brute-token`
- `undead-officer-token`
- `barricade-token`
- `status-damaged-icon`
- `status-overrun-icon`
- `target-marker-icon`
- `range-marker-icon`
- `repair-marker-icon`

Prompt summary:

```text
Create separate readable retro tactical board-game tokens for fictional Russian-inspired undead riflemen, a larger brute enemy, and an undead officer, plus barricade and fortification state overlays. Keep all icons small-token readable, no gore focus, no real insignia.
```

### Group B - Army UIUX

Generated assets:

- `brigade-flag-infantry`
- `brigade-flag-jaeger`
- `brigade-flag-artillery`
- `brigade-flag-engineer`
- `brigade-card-frame-icon`
- `corps-standard-icon`
- `officer-portrait-generic`
- `officer-silhouette`

Prompt summary:

```text
Create compact fictional brigade flags, corps paper-frame motifs, and officer portrait placeholders for a UGCW-like army camp board. Use muted 1880s German-inspired military styling without real flags or real emblems.
```

### Group C - Weapon Silhouettes

Generated assets:

- `weapon-dreyse-icon`
- `weapon-jaeger-rifle-icon`
- `weapon-field-gun-icon`
- `weapon-tools-icon`

Prompt summary:

```text
Create simple readable 1880s weapon silhouettes for infantry rifle, jaeger rifle, field gun, and engineer tools. Keep high contrast and avoid modern weapon shapes.
```

### Group D - Deployment / Theater UIUX

Generated assets:

- `deployment-zone-corner`
- `selected-unit-marker`
- `reserve-roster-strip`
- `deployment-route-arrow`
- `main-battle-flag-icon`
- `side-operation-tag-icon`
- `five-band-front-icon`
- `enemy-pressure-marker-icon`

Prompt summary:

```text
Create retro tactical UI markers for a deployment starting zone, selected unit state, reserve card strip, route arrow, main battle flag, side operation tag, five-band strategic front marker, and enemy pressure marker.
```

### Group E - Engineering / Doctrine UIUX

Generated assets:

- `facility-hospital-icon`
- `facility-observation-icon`
- `repair-supplies-icon`
- `doctrine-command-icon`
- `doctrine-organization-icon`
- `doctrine-training-icon`
- `doctrine-logistics-icon`
- `doctrine-engineering-icon`
- `doctrine-medicine-icon`
- `threat-intel-icon`

Prompt summary:

```text
Create small retro military staff and engineering icons: hospital, observation post, repair supplies, command medal, organization medal, training medal, logistics medal, engineering medal, medicine medal, and threat intelligence marker.
```

## Current Limitations

- This pass still avoids large background art and title visuals.
- Some generated icons are intentionally small and symbolic; they should be replaced later only if they fail gameplay readability.
- Terrain tile art remains mostly deferred because the current tactical map still uses CSS terrain bands and labels.
- Mobile battle map crowding is a tactical layout issue, not an image loading issue. Handle it in a later map/formation pass.
