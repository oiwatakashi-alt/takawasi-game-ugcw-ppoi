import type { BattleChokePoint, BattlePosition, BattleStructure, EnemyBattleUnit, FrontlineSegment } from "./types";

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const centerSegment = (frontlineSegments: FrontlineSegment[]): FrontlineSegment | undefined =>
  frontlineSegments.find((segment) => segment.id === "center-line") ?? frontlineSegments[0];

export const createChokePointsForBattle = (
  terrainTags: string[],
  frontlineSegments: FrontlineSegment[],
): BattleChokePoint[] => {
  if (!terrainTags.includes("bridge")) {
    return [];
  }

  const center = centerSegment(frontlineSegments);
  const y = center?.anchor.y ?? 50;

  return [
    {
      id: "bridge-rail-crossing",
      name: "鉄道橋隘路",
      terrainTag: "bridge",
      position: { x: 63, y },
      radius: 23,
      laneWidth: 11,
      flowLimit: 760,
      slowMultiplier: 0.62,
      currentPressure: 0,
      delayPercent: 0,
    },
  ];
};

const enemyLaneOffset = (enemy: EnemyBattleUnit): number => {
  const typeOffset: Record<EnemyBattleUnit["type"], number> = {
    undeadMob: 0,
    undeadRiflemen: -4,
    brute: 4,
    undeadOfficer: -6,
  };
  const idJitter = [...enemy.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return typeOffset[enemy.type] + idJitter - 2;
};

export const destinationThroughChokePoints = (
  enemy: EnemyBattleUnit,
  directDestination: BattlePosition,
  chokePoints: BattleChokePoint[],
): BattlePosition => {
  const choke = chokePoints.find((candidate) => candidate.terrainTag === "bridge");
  if (!choke) {
    return directDestination;
  }

  const laneY = clamp(
    choke.position.y + enemyLaneOffset(enemy),
    choke.position.y - choke.laneWidth,
    choke.position.y + choke.laneWidth,
  );
  const hasCrossed = enemy.position.x < choke.position.x - choke.radius * 0.55;
  if (hasCrossed) {
    return directDestination;
  }

  if (enemy.position.x > choke.position.x + 2 || Math.abs(enemy.position.y - laneY) > choke.laneWidth * 0.55) {
    return { x: choke.position.x + 1.5, y: laneY };
  }

  return { x: choke.position.x - choke.radius * 0.75, y: laneY };
};

const structureDelayNearChoke = (choke: BattleChokePoint, structures: BattleStructure[]): number =>
  structures.reduce((delay, structure) => {
    if (structure.status !== "built" && structure.status !== "damaged") {
      return delay;
    }
    if (distance(structure.position, choke.position) > choke.radius + structure.blockedRadius + 8) {
      return delay;
    }
    const durability = clamp(structure.durability / structure.maxDurability, 0.2, 1);
    const value =
      structure.type === "barricade"
        ? 0.18
        : structure.type === "trench"
          ? 0.1
          : structure.type === "supplyDepot"
            ? 0.04
            : 0.02;
    return delay + value * durability;
  }, 0);

const pressureNearChoke = (choke: BattleChokePoint, enemies: EnemyBattleUnit[]): number =>
  enemies.reduce((pressure, enemy) => {
    if (distance(enemy.position, choke.position) > choke.radius + 10) {
      return pressure;
    }
    return pressure + enemy.count * enemy.pressure;
  }, 0);

export const chokePointMultiplierForEnemy = (
  enemy: EnemyBattleUnit,
  enemies: EnemyBattleUnit[],
  structures: BattleStructure[],
  chokePoints: BattleChokePoint[],
): number => {
  const choke = chokePoints.find((candidate) => candidate.terrainTag === "bridge");
  if (!choke || distance(enemy.position, choke.position) > choke.radius + 12) {
    return 1;
  }

  const pressure = pressureNearChoke(choke, enemies);
  const congestionMultiplier = clamp(choke.flowLimit / Math.max(choke.flowLimit, pressure), 0.36, 1);
  const structureDelay = clamp(structureDelayNearChoke(choke, structures), 0, 0.35);
  return clamp(choke.slowMultiplier * congestionMultiplier * (1 - structureDelay), 0.22, 1);
};

export const updateChokePointPressures = (
  chokePoints: BattleChokePoint[],
  enemies: EnemyBattleUnit[],
  structures: BattleStructure[],
): BattleChokePoint[] =>
  chokePoints.map((choke) => {
    const pressure = pressureNearChoke(choke, enemies);
    const congestionMultiplier = clamp(choke.flowLimit / Math.max(choke.flowLimit, pressure), 0.36, 1);
    const structureDelay = clamp(structureDelayNearChoke(choke, structures), 0, 0.35);
    const movementMultiplier = clamp(choke.slowMultiplier * congestionMultiplier * (1 - structureDelay), 0.22, 1);
    return {
      ...choke,
      currentPressure: Math.round(pressure),
      delayPercent: Math.round((1 - movementMultiplier) * 100),
    };
  });
