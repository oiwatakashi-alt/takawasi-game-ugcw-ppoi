# Base Game And DLC 1 Roadmap

Last updated: 2026-06-30

## Planning Assumption

Plan at product scale now.

The base game should already be larger than a UGCW clone because it adds defensive infrastructure and undead pressure. DLC 1 should be planned early so base-game architecture does not block future expansion.

## Base Game Fantasy

The player commands a fictional German-inspired army trying to hold an eastern frontier against an endless Russian-inspired undead imperial force.

The player is not simply winning battles. The player is preserving:

- trained units
- officer corps
- weapons
- ammunition
- defensive positions
- logistics network
- field hospitals
- fallback lines
- morale and reputation

## Base Game Campaign Arc

The campaign arc sits on top of a five-band strategic map:

```text
Home Core Defense Zone
  -> Forward Defense Belt
  -> Active Front Zone
  -> Enemy Vanguard Defense Zone
  -> Enemy Heartland Zone
```

Chapters should move the front back and forth across these bands, not just unlock a fixed list of battles.

The campaign should not be a fixed historical mission list. Each turn should generate one non-skippable main battlefield around the player's current position and 3-4 side operations around adjacent front/rear pressure. Side operations can be manually fought where appropriate or auto-resolved with assigned forces and real risk.

| Chapter | Focus | New Pressure |
| --- | --- | --- |
| I. Border Alarm | Basic field defense, first undead waves, first named units. | Mob waves, low ammo stress. |
| II. Forest Line | Skirmishers, forests, visibility, observation posts. | Flank emergence and hidden approaches. |
| III. Mud And Villages | Marsh, mud, villages, supply friction. | Fatigue and supply pressure. |
| IV. Rail Bridge | Chokepoints, bridge defense, demolition/repair choices. | Brutes and breakthrough risk. |
| V. Redoubt Winter | Strong defensive works, field hospitals, artillery pits. | Night assaults and structure damage. |
| VI. The Long Withdrawal | Fallback lines, preserving the army, abandoning positions. | Multi-stage retreat and reputation pressure. |
| VII. Counterstroke | Limited offensive action to relieve pressure. | Enemy officers and fortified undead nests. |
| VIII. Final Line | Full theater defense using all systems. | Sustained multi-wave escalation. |

## Base Game System Targets

### Army And Officers

- Multiple corps/division/brigade-style organization.
- Officer rank and command capacity.
- Officer injury, death, recovery, promotion, traits.
- Veteran unit identity, history, medals, and fatigue from repeated deployment.

### Fortifications

- Trench
- Barricade
- Wire/stakes
- Redoubt
- Artillery pit
- Supply depot
- Field hospital
- Observation post
- Fallback line
- Bridge demolition/repair point

### Enemy Families

- Undead mob
- Undead riflemen
- Brute line-breakers
- Undead officer/bannerman
- Siege mass
- Night horde
- Swamp emergence enemy
- Horror morale-breaker

### Doctrine Trees

- Command
- Infantry discipline
- Artillery
- Engineering
- Logistics
- Medicine
- Reconnaissance
- Morale/propaganda

## DLC 1 Concept

Working title:

`DLC 1: Iron Winter`

Theme:

Winter siege, frozen rivers, rail logistics, disease pressure, and advanced undead siege behavior.

DLC 1 should add content and mechanics without replacing base systems.

## DLC 1 Additions

### New Campaign

- Winter defensive campaign.
- Frozen river crossings.
- Railhead defense.
- Isolated fortress sectors.
- Ammunition starvation.
- Medical collapse risk.

### New Player Systems

- Winterization upgrades.
- Heated field hospitals.
- Rail supply scheduling.
- Heavy redoubt upgrades.
- Signal posts.
- Frozen-ground construction penalties.
- Emergency evacuation of wounded.

### New Structures

- Blockhouse
- Rail supply hub
- Signal tower
- Heated hospital
- Heavy artillery bunker
- Ice barricade
- Minefield equivalent using period/fantasy-safe obstacles

### New Enemy Types

- Frozen horde
- Siege brute
- Corpse artillery equivalent
- Burrower / under-snow emergence unit
- Lich-officer command unit
- Plague carrier morale/medical threat

### New Doctrine Branches

- Winter logistics
- Siege engineering
- Rail command
- Medical evacuation
- Anti-horde artillery

## DLC 1 Architecture Requirements

Base game must support:

- content packs
- new terrain tags
- new structure definitions
- new enemy definitions
- new battle template types
- new doctrine branches
- new event chains
- save version migration
- campaign-specific rules

No DLC system should require rewriting battle tick, campaign state, or UI screen foundations.
