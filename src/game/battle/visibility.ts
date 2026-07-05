import { summarizeFortificationEffects } from "../fortifications/effects";
import type { StrategicDoctrineProfile } from "../doctrine/types";
import type { BattlePosition, BattleStructure, BattleTerrainZone, BattleUnit, EnemyBattleUnit } from "./types";
import { lineOfSightBlockage, localTerrainEffect } from "./terrainEffects";

export const baseSpottingRange = 76;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

const enemyTypeConcealment: Record<EnemyBattleUnit["type"], number> = {
  undeadMob: 0,
  undeadRiflemen: 6,
  brute: -8,
  undeadOfficer: 10,
};

const activeStructure = (structure: BattleStructure): boolean =>
  structure.status === "built" || structure.status === "damaged";

interface FriendlyObserver {
  position: BattlePosition;
  distance: number;
}

export const spottingRangeForStructures = (
  structures: BattleStructure[],
  doctrine?: StrategicDoctrineProfile,
  objectiveSpottingBonus = 0,
): number => baseSpottingRange + summarizeFortificationEffects(structures, doctrine).visibility + objectiveSpottingBonus;

export const enemyConcealmentAt = (enemy: EnemyBattleUnit, terrainZones: BattleTerrainZone[]): number => {
  const terrain = localTerrainEffect(enemy.position, terrainZones);
  const terrainMask = terrain.cover * 0.36 + (terrain.movement < 0.66 ? 5 : 0);
  return Math.max(0, terrainMask + enemyTypeConcealment[enemy.type]);
};

const nearestFriendlyObserver = (
  enemy: EnemyBattleUnit,
  playerUnits: BattleUnit[],
  structures: BattleStructure[],
): FriendlyObserver | undefined => {
  const unitObservers = playerUnits
    .filter((unit) => unit.soldiers > 0)
    .map((unit) => ({
      position: unit.position,
      distance: distance(enemy.position, unit.position),
    }));
  const structureObservers = structures
    .filter(activeStructure)
    .map((structure) => ({
      position: structure.position,
      distance: distance(enemy.position, structure.position) + 4,
    }));
  return [...unitObservers, ...structureObservers].sort((a, b) => a.distance - b.distance)[0];
};

export const updateEnemyVisibility = (
  enemies: EnemyBattleUnit[],
  playerUnits: BattleUnit[],
  structures: BattleStructure[],
  terrainZones: BattleTerrainZone[],
  doctrine?: StrategicDoctrineProfile,
  objectiveSpottingBonus = 0,
): EnemyBattleUnit[] => {
  const spottingRange = spottingRangeForStructures(structures, doctrine, objectiveSpottingBonus);
  return enemies.map((enemy) => {
    const concealment = enemyConcealmentAt(enemy, terrainZones);
    const observer = nearestFriendlyObserver(enemy, playerUnits, structures);
    const friendlyDistance = observer?.distance ?? Number.POSITIVE_INFINITY;
    const sightBlockage = observer
      ? lineOfSightBlockage(observer.position, enemy.position, terrainZones)
      : { blocked: false, blockage: 0, blockers: [] };
    const closeContactRange = Math.max(18, enemy.range + 7);
    const forcedByLinePenetration = enemy.position.x <= 62;
    const effectiveSpottingRange = clamp(spottingRange - concealment - sightBlockage.blockage * 34, 20, 120);
    const spotted =
      forcedByLinePenetration ||
      friendlyDistance <= closeContactRange ||
      (!sightBlockage.blocked && friendlyDistance <= effectiveSpottingRange);
    return {
      ...enemy,
      concealment,
      isSpotted: spotted,
    };
  });
};
