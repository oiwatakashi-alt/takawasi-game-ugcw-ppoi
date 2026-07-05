import { terrainDefinitions } from "../../content/baseGame/terrain";
import type { BattlePosition, BattleTerrainZone, FrontlineSegment } from "./types";

type TerrainDefinition = (typeof terrainDefinitions)[number];

const terrainById = new Map<string, TerrainDefinition>(terrainDefinitions.map((terrain) => [terrain.id, terrain]));
const lineOfSightBlockageByTerrainTag: Record<string, number> = {
  forest: 0.48,
  village: 0.44,
  hill: 0.34,
  marsh: 0.18,
};
const lineOfSightBlockedThreshold = 0.42;

const definition = (terrainTag: string): TerrainDefinition =>
  terrainById.get(terrainTag) ?? terrainDefinitions.find((terrain) => terrain.id === "open") ?? terrainDefinitions[0];

const lineZone = (
  id: string,
  terrainTag: string,
  name: string,
  zone: BattleTerrainZone["zone"],
  overrides: Partial<Pick<BattleTerrainZone, "cover" | "fatigue" | "movement" | "rangeMultiplier" | "fireMultiplier">> = {},
): BattleTerrainZone => {
  const terrain = definition(terrainTag);
  return {
    id,
    terrainTag,
    name,
    cover: overrides.cover ?? terrain.cover,
    fatigue: overrides.fatigue ?? terrain.fatigue,
    movement: overrides.movement ?? terrain.movement,
    rangeMultiplier: overrides.rangeMultiplier ?? 1,
    fireMultiplier: overrides.fireMultiplier ?? 1,
    zone,
  };
};

const segmentZone = (segments: FrontlineSegment[], id: string, fallback: BattleTerrainZone["zone"]) =>
  segments.find((segment) => segment.id === id)?.zone ?? fallback;

export const createTerrainZonesForBattle = (
  terrainTags: string[],
  frontlineSegments: FrontlineSegment[],
): BattleTerrainZone[] => {
  const zones: BattleTerrainZone[] = [];

  if (terrainTags.includes("forest")) {
    zones.push(
      lineZone("terrain-forest-left", "forest", "森林遮蔽帯", { x: 8, y: 8, width: 42, height: 30 }, {
        rangeMultiplier: 0.94,
        fireMultiplier: 0.96,
      }),
    );
  }

  if (terrainTags.includes("marsh")) {
    zones.push(
      lineZone("terrain-marsh-right", "marsh", "泥濘低地", { x: 58, y: 58, width: 50, height: 34 }, {
        rangeMultiplier: 0.88,
        fireMultiplier: 0.9,
      }),
    );
  }

  if (terrainTags.includes("trench")) {
    zones.push(
      lineZone("terrain-trench-center", "trench", "塹壕掩体線", segmentZone(frontlineSegments, "center-line", { x: 18, y: 36, width: 38, height: 28 }), {
        cover: 24,
        movement: 0.72,
        rangeMultiplier: 1.04,
        fireMultiplier: 1.04,
      }),
    );
  }

  if (terrainTags.includes("reverseSlopeDrill")) {
    zones.push(
      lineZone("terrain-reverse-slope-ridge", "hill", "逆斜面稜線", { x: 36, y: 14, width: 28, height: 28 }, {
        rangeMultiplier: 1.08,
        fireMultiplier: 1.03,
      }),
    );
  }

  if (terrainTags.includes("hill")) {
    zones.push(
      lineZone("terrain-hill-ridge", "hill", "高地稜線", { x: 18, y: 10, width: 38, height: 26 }, {
        rangeMultiplier: 1.12,
        fireMultiplier: 1.06,
      }),
    );
  }

  if (terrainTags.includes("bridge")) {
    zones.push(
      lineZone("terrain-bridge-choke", "bridge", "橋梁隘路", { x: 32, y: 34, width: 33, height: 32 }, {
        cover: 3,
        movement: 0.54,
        rangeMultiplier: 0.92,
        fireMultiplier: 0.94,
      }),
    );
  }

  if (terrainTags.includes("village")) {
    zones.push(
      lineZone("terrain-village-cover", "village", "村落遮蔽", { x: 20, y: 38, width: 36, height: 30 }, {
        cover: 13,
        rangeMultiplier: 0.96,
        fireMultiplier: 0.98,
      }),
    );
  }

  if (zones.length === 0 || terrainTags.includes("open")) {
    zones.push(
      lineZone("terrain-open-field", "open", "開豁地", { x: 46, y: 16, width: 52, height: 66 }, {
        cover: 0,
        fatigue: 1,
        movement: 1,
        rangeMultiplier: 1,
        fireMultiplier: 1,
      }),
    );
  }

  return zones;
};

export interface LocalTerrainEffect {
  cover: number;
  fatigue: number;
  movement: number;
  rangeMultiplier: number;
  fireMultiplier: number;
  zoneNames: string[];
}

export interface TerrainLineOfSightBlockage {
  blocked: boolean;
  blockage: number;
  blockers: string[];
  modifiers: string[];
  fireMultiplier: number;
  rangeMultiplier: number;
}

export const localTerrainEffect = (
  position: BattlePosition,
  terrainZones: BattleTerrainZone[],
): LocalTerrainEffect => {
  const activeZones = terrainZones.filter(
    (zone) =>
      position.x >= zone.zone.x &&
      position.x <= zone.zone.x + zone.zone.width &&
      position.y >= zone.zone.y &&
      position.y <= zone.zone.y + zone.zone.height,
  );

  if (activeZones.length === 0) {
    return {
      cover: 0,
      fatigue: 1,
      movement: 1,
      rangeMultiplier: 1,
      fireMultiplier: 1,
      zoneNames: [],
    };
  }

  return {
    cover: Math.max(...activeZones.map((zone) => zone.cover)),
    fatigue: Math.max(...activeZones.map((zone) => zone.fatigue)),
    movement: Math.min(...activeZones.map((zone) => zone.movement)),
    rangeMultiplier: activeZones.reduce((value, zone) => value * zone.rangeMultiplier, 1),
    fireMultiplier: activeZones.reduce((value, zone) => value * zone.fireMultiplier, 1),
    zoneNames: activeZones.map((zone) => zone.name),
  };
};

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

export const lineOfSightBlockageForTerrain = (zone: BattleTerrainZone): number =>
  lineOfSightBlockageByTerrainTag[zone.terrainTag] ?? 0;

export const lineOfSightTerrainClass = (zone: BattleTerrainZone): "blocker" | "partial" | "open" => {
  const blockage = lineOfSightBlockageForTerrain(zone);
  if (blockage >= lineOfSightBlockedThreshold) {
    return "blocker";
  }
  return blockage > 0 ? "partial" : "open";
};

export const lineOfSightTerrainLabel = (zone: BattleTerrainZone): string => {
  if (zone.terrainTag === "hill") {
    return "高地射界";
  }
  if (isCoverEdgeTerrain(zone)) {
    return `${lineOfSightTerrainClass(zone) === "blocker" ? "射線遮蔽" : "射線減衰"} / 遮蔽端`;
  }
  const terrainClass = lineOfSightTerrainClass(zone);
  if (terrainClass === "blocker") {
    return "射線遮蔽";
  }
  if (terrainClass === "partial") {
    return "射線減衰";
  }
  return "射線影響なし";
};

const containsPosition = (zone: BattleTerrainZone, position: BattlePosition): boolean =>
  position.x >= zone.zone.x &&
  position.x <= zone.zone.x + zone.zone.width &&
  position.y >= zone.zone.y &&
  position.y <= zone.zone.y + zone.zone.height;

const edgeDistance = (zone: BattleTerrainZone, position: BattlePosition): number => {
  if (!containsPosition(zone, position)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.min(
    position.x - zone.zone.x,
    zone.zone.x + zone.zone.width - position.x,
    position.y - zone.zone.y,
    zone.zone.y + zone.zone.height - position.y,
  );
};

const activeZonesAt = (position: BattlePosition, terrainZones: BattleTerrainZone[]): BattleTerrainZone[] =>
  terrainZones.filter((zone) => containsPosition(zone, position));

const isCoverEdgeTerrain = (zone: BattleTerrainZone): boolean =>
  zone.terrainTag === "forest" || zone.terrainTag === "village" || zone.terrainTag === "trench";

const zoneCenter = (zone: BattleTerrainZone): BattlePosition => ({
  x: zone.zone.x + zone.zone.width / 2,
  y: zone.zone.y + zone.zone.height / 2,
});

const isReverseSlopeTarget = (from: BattlePosition, to: BattlePosition, hill: BattleTerrainZone): boolean => {
  const center = zoneCenter(hill);
  const horizontalPass = from.x < center.x ? to.x > center.x + hill.zone.width * 0.16 : to.x < center.x - hill.zone.width * 0.16;
  const verticalPass = Math.abs(to.y - center.y) <= hill.zone.height * 0.58;
  return horizontalPass && verticalPass;
};

export const lineOfSightBlockage = (
  from: BattlePosition,
  to: BattlePosition,
  terrainZones: BattleTerrainZone[],
): TerrainLineOfSightBlockage => {
  const sampledZones = new Map<string, { zone: BattleTerrainZone; weight: number }>();
  const sampleCount = Math.max(8, Math.min(18, Math.ceil(distance(from, to) / 8)));
  const fromZones = activeZonesAt(from, terrainZones);
  const toZones = activeZonesAt(to, terrainZones);
  const fromHighGround = fromZones.find((zone) => zone.terrainTag === "hill");
  const toHighGround = toZones.find((zone) => zone.terrainTag === "hill");
  const fromCoverEdge = fromZones.find((zone) => isCoverEdgeTerrain(zone) && edgeDistance(zone, from) <= 7);
  const toCoverEdge = toZones.find((zone) => isCoverEdgeTerrain(zone) && edgeDistance(zone, to) <= 7);
  const toDeepCover = toZones.find((zone) => isCoverEdgeTerrain(zone) && edgeDistance(zone, to) > 7);
  const reverseSlopeTarget = !!toHighGround && !fromHighGround && isReverseSlopeTarget(from, to, toHighGround);

  for (let index = 1; index < sampleCount; index += 1) {
    const ratio = index / sampleCount;
    const sample = {
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    };

    for (const zone of terrainZones) {
      const baseWeight = lineOfSightBlockageForTerrain(zone);
      if (baseWeight <= 0 || !containsPosition(zone, sample)) {
        continue;
      }
      const fromInside = containsPosition(zone, from);
      const toInside = containsPosition(zone, to);
      if (fromInside && toInside) {
        continue;
      }
      const usesCoverEdge =
        (fromInside && fromCoverEdge?.id === zone.id) ||
        (toInside && toCoverEdge?.id === zone.id);
      const edgeWeight = usesCoverEdge
        ? baseWeight * 0.28
        : fromInside || toInside
          ? baseWeight * 0.45
          : baseWeight;
      const current = sampledZones.get(zone.id);
      if (!current || current.weight < edgeWeight) {
        sampledZones.set(zone.id, { zone, weight: edgeWeight });
      }
    }
  }

  const highGroundFactor = fromHighGround ? 0.62 : 1;
  const counterSlopeFactor = reverseSlopeTarget ? 1.26 : !fromHighGround && toHighGround ? 1.14 : 1;
  const deepCoverFactor = toDeepCover ? 1.12 : 1;
  const blockage = Array.from(sampledZones.values()).reduce(
    (sum, entry) => sum + entry.weight * highGroundFactor * counterSlopeFactor * deepCoverFactor,
    0,
  );
  const modifiers = [
    fromHighGround ? `高地射界 ${fromHighGround.name}` : undefined,
    fromCoverEdge ? `遮蔽端射撃 ${fromCoverEdge.name}` : undefined,
    toCoverEdge ? `敵遮蔽端 ${toCoverEdge.name}` : undefined,
    toDeepCover ? `低姿勢遮蔽 ${toDeepCover.name}` : undefined,
    reverseSlopeTarget ? `逆斜面遮蔽 ${toHighGround?.name}` : !fromHighGround && toHighGround ? `敵稜線 ${toHighGround.name}` : undefined,
  ].filter((modifier): modifier is string => !!modifier);
  const fireMultiplier =
    (fromHighGround ? 1.08 : 1) *
    (fromCoverEdge ? 1.04 : 1) *
    (toCoverEdge ? 0.92 : 1) *
    (toDeepCover ? 0.86 : 1) *
    (reverseSlopeTarget ? 0.88 : !fromHighGround && toHighGround ? 0.94 : 1);
  const rangeMultiplier =
    (fromHighGround ? 1.08 : 1) *
    (fromCoverEdge ? 1.02 : 1) *
    (toDeepCover ? 0.96 : 1) *
    (reverseSlopeTarget ? 0.96 : 1);
  return {
    blocked: blockage >= lineOfSightBlockedThreshold,
    blockage,
    blockers: Array.from(sampledZones.values())
      .filter((entry) => entry.weight > 0)
      .map((entry) => entry.zone.name),
    modifiers,
    fireMultiplier,
    rangeMultiplier,
  };
};
