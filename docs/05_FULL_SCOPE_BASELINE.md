# Full Scope Baseline

Last updated: 2026-06-30

## Product Bar

`Ultimate General: Civil War`-level campaign depth is the baseline, not the ceiling.

The initial code path can be content-thin, but the target game should assume that the core UGCW-style systems are expected to exist in full form over time:

- persistent army
- corps/division/brigade-style organization
- officer growth, rank, injury, death, reassignment
- unit experience, quality, perks, and veteran identity
- rookie/veteran replenishment tradeoff
- weapon quality and equipment stock
- supply/ammo/logistics
- morale, fatigue, terrain, cover, flank pressure
- battle result carryover
- campaign resources
- optional side battles or strategic choices
- battle-to-battle consequence

The differentiator should be what this game adds on top of that baseline.

## Core Additions Beyond UGCW

### 1. Defensive Construction / Fortification

The German-inspired player side should not only move units. It should prepare the battlefield.

Defensive construction is rational for the setting:

- the enemy is numerically overwhelming
- the undead do not tire or fear losses like humans
- the player side has discipline, engineers, staff planning, and industrial organization
- the campaign is about holding, delaying, withdrawing, and preserving a trained army

Fortifications make the player feel like a commander managing a defensive war, not only a battlefield clicker.

### 2. Long War Defensive Infrastructure

The campaign should include a layer where the player improves positions between battles:

- trenches
- redoubts
- barricades
- wire/obstacle equivalents
- artillery pits
- supply depots
- field hospitals
- observation posts
- fallback lines
- rail/road repair

These should create strategic identity. One campaign can become a fortified attrition war, another a mobile retreat campaign.

### 3. Engineering As A Growth Track

Engineers should matter as a unit type or campaign staff function.

Possible growth:

- faster construction
- stronger trenches
- better obstacle placement
- faster bridge repair/demolition
- improved supply depots
- better field hospitals
- improved fallback-line survival

This gives Germany-side play a distinctive advantage that is not just "better infantry."

### 4. Defense As A Resource Sink

Construction should compete with army recovery.

The player should ask:

- Do I spend materials on trenches or artillery shells?
- Do I assign labor to build a redoubt or replenish a battered brigade?
- Do I fortify the current line or prepare the fallback line?
- Do I hold this position because I invested in it, or abandon it before losing the army?

This adds a new layer of attachment: not only beloved units, but also beloved positions.

### 5. Undead Pressure Should Exploit Static Defense

Fortifications must not become an automatic win.

The undead side should threaten defenses through:

- mass saturation
- night assaults
- brute units that damage obstacles
- undead officers that coordinate waves
- burrowing/swamp emergence in later systems
- ammo exhaustion
- disease/terror pressure
- forcing the player to choose when to abandon a line

The fun is not "build wall and win." The fun is "this line buys time, but time still costs men and supplies."

## Fortification System Targets

| Structure | Role |
| --- | --- |
| Trench | Main defensive cover. Improves survival and morale while holding. |
| Barricade | Cheap obstacle. Slows mobs, degrades under pressure. |
| Redoubt | Strong point. Anchors a line, expensive, limited placement. |
| Wire / Stakes | Slows enemy approach, weak to brutes or repeated waves. |
| Artillery Pit | Protects artillery and improves sustained fire. |
| Supply Depot | Improves local ammo recovery; vulnerable if overrun. |
| Field Hospital | Improves post-battle casualty recovery. |
| Observation Post | Improves enemy wave warning and accuracy. |
| Fallback Line | Pre-prepared retreat position that reduces withdrawal losses. |

## Campaign Identity

UGCW is about managing an army through historical battles.

This game should be about managing an army and a defensive theater against an impossible, recurring enemy.

That means the campaign is not just:

```text
battle -> replenish -> next battle
```

It should become:

```text
recon threat
  -> allocate resources between army, logistics, and fortifications
  -> choose hold/withdraw/raid/prepare
  -> fight battle
  -> preserve units and positions if possible
  -> repair/rebuild/reorganize
  -> decide whether the line is still worth holding
```

## Implementation Implication

Even the first playable route should use the same domain boundaries expected by the full product.

Do not hard-code the game as pure mobile-unit combat. `BattleState` and `CampaignState` should support:

- prepared positions
- structures on map nodes
- structure durability
- construction cost
- repair cost
- structure effects on combat
- abandoned or overrun structures
