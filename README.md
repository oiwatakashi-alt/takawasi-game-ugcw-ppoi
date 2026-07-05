# takawasi game

WIP tactical campaign game prototype.

This project is being built as a product-scale tactical campaign game inspired by the strategic flow and brigade-scale readability of classic campaign wargames. It is not affiliated with or endorsed by any referenced commercial game.

## Current Direction

- Dynamic five-band strategic campaign map
- UGCW-style separated scenes: theater command, camp/army management, deployment, tactical battle, after action
- Fictional 1880s German-inspired army versus Russian-inspired undead mass army
- Large brigade-scale tactical battles
- Semi-autonomous frontline command with StandingOrders, fallback rules, facilities, supply, repair, reserves, and enemy command-network responses
- Logic-first implementation with generated retro/pop tactical tokens and UI assets added where they improve readability

## Development

```bash
npm install
npm run dev
npm run build
```

## Repository Notes

- `FILEMAP.md` is the implementation address map and should be updated when major file responsibilities change.
- `docs/00_CONTEXT_SPINE.md` is the recovery entrypoint after context loss.
- `WEBリサーチ/` contains research notes used to translate reference-game ideas into this project's design.
- Generated art source/processed assets are kept in the repo while the project is still small enough to track them directly.

## License

No open-source license has been selected yet. Until a license is added, all rights are reserved by the project owner.
