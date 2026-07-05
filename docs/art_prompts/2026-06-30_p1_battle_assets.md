# P1 Battle Asset Prompts

Date: 2026-06-30
Mode: built-in image generation, then local chroma-key removal and resizing.

## Processing

Generated source images were copied into `assets/source/`.

Processed outputs:

- alpha PNGs in `assets/processed/`
- review/thumb PNGs in `assets/thumbs/`
- Vite-consumed PNGs in `src/assets/generated/`

Local processing used bundled Python/Pillow to remove the flat `#00ff00` chroma-key background, trim alpha bounds, center on square canvases, and export `128x128` and `64x64` variants.

## Shared Style

```text
Use case: stylized-concept
Style/medium: slightly pop retro wargame illustration, crisp painted token, high readability at 64x64.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal.
Constraints: no text, no watermark, no modern weapons or objects, no real insignia, no cast shadow, no contact shadow, no reflection.
```

## Generated Assets

### player-infantry-token

Fictional 1880s German-inspired infantry brigade token. Compact group silhouette of disciplined infantry with pickelhaube-like helmets and long rifles, facing right/east. Muted Prussian blue-gray uniforms, tan straps, dark rifles.

### player-jaeger-token

Fictional 1880s German-inspired jaeger/skirmisher brigade token. Light infantry with long rifles, kneeling and standing poses, facing right/east. Muted blue-gray and brown uniforms.

### player-artillery-token

Fictional 1880s German-inspired field artillery brigade token. Compact field gun with two or three crew silhouettes, barrel facing right/east. Muted blue-gray uniforms, brass/iron gun, wood wheels.

### player-engineer-token

Fictional 1880s German-inspired combat engineer brigade token. Engineers with shovels, tool satchels, timber stakes, and one short carbine, facing right/east. Muted blue-gray uniforms, tan tool straps, brown timber.

### undead-mob-token

Fictional Russian-inspired undead infantry mob token. Clustered shambling infantry silhouettes in tattered late-19th-century coats and caps, mass pressure, facing left/west. Desaturated brown, gray, dull red accents, no gore focus.

### trench-token

Prepared trench line tile. Short section of late-19th-century field trench with sandbags, timber revetments, muddy earth, firing parapet direction facing right/east.

### supply-depot-icon

Late-19th-century field supply depot icon with stacked wooden crates, ammunition boxes, canvas sacks, and wagon-wheel detail.

### objective-icon-set

Three tactical UI icons in one row, then split after processing:

- victory point flag
- supply crate
- observation/visibility tower

## Current Limitations

- Enemy types currently share the same undead mob token.
- Barricade currently reuses the trench token.
- No generated terrain tiles are active yet.
- Army Camp and Deployment still mostly use CSS tokens; this pass prioritizes Battle Command readability.
