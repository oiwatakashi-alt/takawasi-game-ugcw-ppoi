import type { UnitType } from "../army/types";
import type { Sector } from "../theater/types";
import type {
  BattleMapBounds,
  BattlePosition,
  FrontlineGeometryAdjustment,
  FrontlineGeometryPreset,
  FrontlineSegment,
  FrontlineSegmentGeometryOverride,
} from "./types";
import { compactSketchPoints, maxFrontlineSketchPoints } from "./sketchLines";

export const defaultBattleMapBounds: BattleMapBounds = { width: 140, height: 100 };

type TacticalSectorProfile = Pick<Sector, "band" | "terrainTags" | "structures" | "enemyPressure">;

const baseSegments: FrontlineSegment[] = [
  {
    id: "left-flank",
    name: "左翼線",
    anchor: { x: 34, y: 25 },
    fallbackPoint: { x: 16, y: 28 },
    controlRadius: 16,
    zone: { x: 12, y: 12, width: 38, height: 24 },
  },
  {
    id: "center-line",
    name: "中央塹壕線",
    anchor: { x: 38, y: 47 },
    fallbackPoint: { x: 17, y: 49 },
    controlRadius: 18,
    zone: { x: 16, y: 34, width: 42, height: 30 },
  },
  {
    id: "right-flank",
    name: "右翼湿地線",
    anchor: { x: 35, y: 70 },
    fallbackPoint: { x: 15, y: 72 },
    controlRadius: 16,
    zone: { x: 12, y: 62, width: 40, height: 25 },
  },
  {
    id: "reserve-line",
    name: "予備砲兵線",
    anchor: { x: 22, y: 56 },
    fallbackPoint: { x: 10, y: 58 },
    controlRadius: 14,
    zone: { x: 6, y: 42, width: 28, height: 34 },
  },
  {
    id: "engineer-line",
    name: "工兵支援線",
    anchor: { x: 43, y: 55 },
    fallbackPoint: { x: 18, y: 62 },
    controlRadius: 15,
    zone: { x: 30, y: 30, width: 28, height: 48 },
  },
];

const cloneSegments = (segments: FrontlineSegment[]): FrontlineSegment[] =>
  segments.map((segment) => ({
    ...segment,
    anchor: { ...segment.anchor },
    fallbackPoint: { ...segment.fallbackPoint },
    deploymentLimit: segment.deploymentLimit
      ? {
          ...segment.deploymentLimit,
          zone: { ...segment.deploymentLimit.zone },
        }
      : undefined,
    zone: { ...segment.zone },
    sketchPoints: segment.sketchPoints?.map((point) => ({ ...point })),
  }));

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const geometryPresetDescriptions: Record<FrontlineGeometryPreset, string> = {
  sector_default: "戦区標準の防衛線をそのまま使う。",
  forward_line: "全体を前に押し出し、早い接敵と火力集中を狙う。",
  defense_in_depth: "主線をやや下げ、後退先との距離を広げて消耗戦に備える。",
  wide_screen: "左右に大きく広げ、迂回や側面の敵影を拾いやすくする。",
  compressed_choke: "戦線を絞り、橋梁や街道の隘路へ火力を集中する。",
  refused_left: "左翼を下げて右翼を前に出し、斜めの防衛線を作る。",
  refused_right: "右翼を下げて左翼を前に出し、斜めの防衛線を作る。",
};

export const frontlineGeometryPresets: FrontlineGeometryAdjustment[] = [
  {
    preset: "sector_default",
    label: "戦区標準",
    description: geometryPresetDescriptions.sector_default,
    forwardOffset: 0,
    lateralSpread: 1,
    depthSpacing: 1,
    controlRadiusScale: 1,
  },
  {
    preset: "forward_line",
    label: "前進主線",
    description: geometryPresetDescriptions.forward_line,
    forwardOffset: 7,
    lateralSpread: 1,
    depthSpacing: 0.92,
    controlRadiusScale: 1.04,
  },
  {
    preset: "defense_in_depth",
    label: "縦深防御",
    description: geometryPresetDescriptions.defense_in_depth,
    forwardOffset: -5,
    lateralSpread: 1,
    depthSpacing: 1.28,
    controlRadiusScale: 1.14,
  },
  {
    preset: "wide_screen",
    label: "広域警戒線",
    description: geometryPresetDescriptions.wide_screen,
    forwardOffset: 1,
    lateralSpread: 1.18,
    depthSpacing: 1.04,
    controlRadiusScale: 1.08,
  },
  {
    preset: "compressed_choke",
    label: "隘路集中",
    description: geometryPresetDescriptions.compressed_choke,
    forwardOffset: 2,
    lateralSpread: 0.78,
    depthSpacing: 0.88,
    controlRadiusScale: 0.88,
  },
  {
    preset: "refused_left",
    label: "左翼拒止",
    description: geometryPresetDescriptions.refused_left,
    forwardOffset: 0,
    lateralSpread: 1.03,
    depthSpacing: 1.08,
    controlRadiusScale: 1.04,
  },
  {
    preset: "refused_right",
    label: "右翼拒止",
    description: geometryPresetDescriptions.refused_right,
    forwardOffset: 0,
    lateralSpread: 1.03,
    depthSpacing: 1.08,
    controlRadiusScale: 1.04,
  },
];

export const defaultFrontlineGeometryAdjustment = frontlineGeometryPresets[0];

const cloneFrontlineGeometryAdjustment = (
  adjustment: FrontlineGeometryAdjustment,
): FrontlineGeometryAdjustment => ({
  ...adjustment,
  sketchLines: adjustment.sketchLines
    ? Object.fromEntries(
        Object.entries(adjustment.sketchLines).map(([segmentId, points]) => [
          segmentId,
          points.map((point) => ({ ...point })),
        ]),
      )
    : undefined,
  segmentOverrides: adjustment.segmentOverrides
    ? Object.fromEntries(
        Object.entries(adjustment.segmentOverrides).map(([segmentId, override]) => [
          segmentId,
          {
            ...override,
            anchorOffset: override.anchorOffset ? { ...override.anchorOffset } : undefined,
            fallbackOffset: override.fallbackOffset ? { ...override.fallbackOffset } : undefined,
            zoneOffset: override.zoneOffset ? { ...override.zoneOffset } : undefined,
            zoneSizeOffset: override.zoneSizeOffset ? { ...override.zoneSizeOffset } : undefined,
            deploymentLimitOffset: override.deploymentLimitOffset ? { ...override.deploymentLimitOffset } : undefined,
            deploymentLimitSizeOffset: override.deploymentLimitSizeOffset
              ? { ...override.deploymentLimitSizeOffset }
              : undefined,
          },
        ]),
      )
    : undefined,
});

export const frontlineGeometryPresetById = (
  preset: FrontlineGeometryPreset,
): FrontlineGeometryAdjustment =>
  cloneFrontlineGeometryAdjustment(
    frontlineGeometryPresets.find((candidate) => candidate.preset === preset) ?? defaultFrontlineGeometryAdjustment,
  );

export const frontlineGeometryCustomCount = (adjustment?: FrontlineGeometryAdjustment): number =>
  (adjustment?.segmentOverrides
    ? Object.values(adjustment.segmentOverrides).filter((override) =>
        Boolean(
          override.anchorOffset ||
            override.fallbackOffset ||
            override.zoneOffset ||
            override.zoneSizeOffset ||
            override.deploymentLimitOffset ||
            override.deploymentLimitSizeOffset ||
            override.controlRadiusOffset,
        ),
      ).length
    : 0) + (adjustment?.sketchLines ? Object.keys(adjustment.sketchLines).length : 0);

export const frontlineGeometryDisplayLabel = (adjustment?: FrontlineGeometryAdjustment): string => {
  if (!adjustment) {
    return defaultFrontlineGeometryAdjustment.label;
  }
  const customCount = frontlineGeometryCustomCount(adjustment);
  return customCount > 0 ? `${adjustment.label}+手動${customCount}` : adjustment.label;
};

const refusedLineOffset = (preset: FrontlineGeometryPreset, segmentId: string): number => {
  if (preset === "refused_left") {
    if (segmentId === "left-flank") {
      return -8;
    }
    if (segmentId === "right-flank") {
      return 5;
    }
    if (segmentId === "engineer-line") {
      return 2;
    }
    return -2;
  }
  if (preset === "refused_right") {
    if (segmentId === "right-flank") {
      return -8;
    }
    if (segmentId === "left-flank") {
      return 5;
    }
    if (segmentId === "engineer-line") {
      return 2;
    }
    return -2;
  }
  return 0;
};

const transformY = (value: number, spread: number): number => clamp(50 + (value - 50) * spread, 6, defaultBattleMapBounds.height - 6);

const applySketchLine = (segment: FrontlineSegment, pointsInput?: BattlePosition[]): FrontlineSegment => {
  if (!pointsInput || pointsInput.length < 2) {
    return segment;
  }
  const points = compactSketchPoints(pointsInput, maxFrontlineSketchPoints).map((point) => ({
    x: clamp(point.x, 2, defaultBattleMapBounds.width - 2),
    y: clamp(point.y, 2, defaultBattleMapBounds.height - 2),
  }));
  const [anchor, fallbackPoint] = points;
  const linePoints = [anchor, ...points.slice(2)];
  const xs = linePoints.map((point) => point.x);
  const ys = linePoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(segment.zone.width, maxX - minX + 16);
  const height = Math.max(segment.zone.height, maxY - minY + 14);
  const zone = {
    x: clamp(Math.min(segment.zone.x, minX - 8), 2, defaultBattleMapBounds.width - width - 2),
    y: clamp(Math.min(segment.zone.y, minY - 7), 2, defaultBattleMapBounds.height - height - 2),
    width: clamp(width, 18, defaultBattleMapBounds.width - 4),
    height: clamp(height, 16, defaultBattleMapBounds.height - 4),
  };

  return {
    ...segment,
    anchor,
    fallbackPoint,
    sketchPoints: points,
    controlRadius: clamp(segment.controlRadius + Math.max(0, points.length - 2) * 2, 6, 28),
    zone,
    deploymentLimit: segment.deploymentLimit
      ? {
          ...segment.deploymentLimit,
          zone: {
            ...segment.deploymentLimit.zone,
            y: zone.y,
            height: zone.height,
          },
        }
      : undefined,
  };
};

const deploymentDepthModifierBySegment: Record<string, number> = {
  "left-flank": -2,
  "center-line": 0,
  "right-flank": -2,
  "reserve-line": -12,
  "engineer-line": 4,
};

const deploymentDepthForSector = (
  sector: TacticalSectorProfile | undefined,
): { label: string; description: string; rearX: number; forwardX: number } => {
  if (!sector) {
    return {
      label: "標準出撃帯",
      description: "標準防衛線の後方から主線直前まで配置できる。",
      rearX: 6,
      forwardX: 62,
    };
  }
  if (sector.band === "homeCoreDefense") {
    return {
      label: "本国堡塁出撃帯",
      description: "本国中枢近接の厚い陣地。初期配置は後方堡塁寄りに制限される。",
      rearX: 4,
      forwardX: 50,
    };
  }
  if (hasTerrain(sector, "bridge")) {
    return {
      label: "橋頭堡出撃帯",
      description: "鉄道橋周辺に集中展開できるが、砲兵と予備は後方に残る。",
      rearX: 5,
      forwardX: 60,
    };
  }
  if (sector.band === "enemyVanguard") {
    return {
      label: "敵前衛出撃帯",
      description: "敵前衛圏への前進配置。危険だが主線を深く押し出せる。",
      rearX: 12,
      forwardX: 76,
    };
  }
  if (sector.band === "enemyHeartland") {
    return {
      label: "敵本国遠征帯",
      description: "遠征反攻用の広い出撃帯。前進配置は広いが後退距離も長い。",
      rearX: 14,
      forwardX: 86,
    };
  }
  if (hasTerrain(sector, "forest") && hasTerrain(sector, "marsh")) {
    return {
      label: "森林泥濘出撃帯",
      description: "森林と泥濘で横移動が重い。中央主線は標準、砲兵は後方に置く。",
      rearX: 6,
      forwardX: 64,
    };
  }
  if (hasStructureType(sector, "supplyDepot")) {
    return {
      label: "補給拠点出撃帯",
      description: "補給拠点を中心に中深度へ展開する。",
      rearX: 5,
      forwardX: 58,
    };
  }
  return {
    label: "標準出撃帯",
    description: "標準防衛線の後方から主線直前まで配置できる。",
    rearX: 6,
    forwardX: 62,
  };
};

const withDeploymentDepthLimits = (
  segments: FrontlineSegment[],
  sector?: TacticalSectorProfile,
): FrontlineSegment[] => {
  const depth = deploymentDepthForSector(sector);
  return cloneSegments(segments).map((segment) => {
    const forwardX = clamp(
      depth.forwardX + (deploymentDepthModifierBySegment[segment.id] ?? 0),
      depth.rearX + 18,
      defaultBattleMapBounds.width - 10,
    );
    const rearX = clamp(
      segment.id === "reserve-line" ? Math.max(3, depth.rearX - 2) : depth.rearX,
      2,
      forwardX - 16,
    );
    const zone = {
      x: rearX,
      y: segment.zone.y,
      width: forwardX - rearX,
      height: segment.zone.height,
    };
    return {
      ...segment,
      anchor: {
        x: clamp(segment.anchor.x, zone.x, zone.x + zone.width),
        y: clamp(segment.anchor.y, zone.y, zone.y + zone.height),
      },
      fallbackPoint: {
        x: clamp(segment.fallbackPoint.x, zone.x, zone.x + zone.width),
        y: clamp(segment.fallbackPoint.y, 6, defaultBattleMapBounds.height - 6),
      },
      deploymentLimit: {
        label: depth.label,
        description: depth.description,
        zone,
      },
    };
  });
};

export const deploymentDepthLabel = (sector?: TacticalSectorProfile): string => deploymentDepthForSector(sector).label;

export const deploymentDepthDescription = (sector?: TacticalSectorProfile): string =>
  deploymentDepthForSector(sector).description;

export const deploymentLimitStyleSummary = (segment: FrontlineSegment): string => {
  const limit = segment.deploymentLimit?.zone ?? segment.zone;
  return `X${Math.round(limit.x)}-${Math.round(limit.x + limit.width)} / Y${Math.round(limit.y)}-${Math.round(limit.y + limit.height)}`;
};

export const clampPositionToDeploymentLimit = (
  segment: FrontlineSegment,
  position: BattlePosition,
): BattlePosition => {
  const limit = segment.deploymentLimit?.zone ?? segment.zone;
  return {
    x: clamp(position.x, limit.x, limit.x + limit.width),
    y: clamp(position.y, limit.y, limit.y + limit.height),
  };
};

const addPosition = (
  position: BattlePosition,
  offset: BattlePosition | undefined,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): BattlePosition => ({
  x: clamp(position.x + (offset?.x ?? 0), minX, maxX),
  y: clamp(position.y + (offset?.y ?? 0), minY, maxY),
});

const applySegmentOverride = (
  segment: FrontlineSegment,
  override?: FrontlineSegmentGeometryOverride,
): FrontlineSegment => {
  if (!override) {
    return segment;
  }
  const width = clamp(segment.zone.width + (override.zoneSizeOffset?.width ?? 0), 18, 62);
  const height = clamp(segment.zone.height + (override.zoneSizeOffset?.height ?? 0), 16, 64);
  const zoneX = clamp(segment.zone.x + (override.zoneOffset?.x ?? 0), 2, defaultBattleMapBounds.width - width - 2);
  const zoneY = clamp(segment.zone.y + (override.zoneOffset?.y ?? 0), 2, defaultBattleMapBounds.height - height - 2);
  const deploymentLimit = segment.deploymentLimit
    ? (() => {
        const base = segment.deploymentLimit.zone;
        const limitWidth = clamp(base.width + (override.deploymentLimitSizeOffset?.width ?? 0), 18, 96);
        const limitHeight = clamp(base.height + (override.deploymentLimitSizeOffset?.height ?? 0), 16, 68);
        const limitX = clamp(base.x + (override.deploymentLimitOffset?.x ?? 0), 2, defaultBattleMapBounds.width - limitWidth - 2);
        const limitY = clamp(
          zoneY + (override.deploymentLimitOffset?.y ?? 0),
          2,
          defaultBattleMapBounds.height - limitHeight - 2,
        );
        return {
          ...segment.deploymentLimit,
          zone: {
            x: limitX,
            y: limitY,
            width: limitWidth,
            height: limitHeight,
          },
        };
      })()
    : undefined;
  return {
    ...segment,
    anchor: addPosition(segment.anchor, override.anchorOffset, 6, defaultBattleMapBounds.width - 10, 6, defaultBattleMapBounds.height - 6),
    fallbackPoint: addPosition(segment.fallbackPoint, override.fallbackOffset, 4, defaultBattleMapBounds.width - 16, 6, defaultBattleMapBounds.height - 6),
    controlRadius: Math.round(clamp(segment.controlRadius + (override.controlRadiusOffset ?? 0), 8, 28)),
    deploymentLimit,
    zone: {
      x: zoneX,
      y: zoneY,
      width,
      height,
    },
  };
};

const clampFrontlineSegmentDeployment = (segment: FrontlineSegment): FrontlineSegment => {
  const anchor = clampPositionToDeploymentLimit(segment, segment.anchor);
  return {
    ...segment,
    anchor,
    fallbackPoint: segment.deploymentLimit
      ? {
          x: clamp(
            segment.fallbackPoint.x,
            segment.deploymentLimit.zone.x,
            Math.min(segment.deploymentLimit.zone.x + segment.deploymentLimit.zone.width, anchor.x),
          ),
          y: clamp(segment.fallbackPoint.y, 6, defaultBattleMapBounds.height - 6),
        }
      : segment.fallbackPoint,
  };
};

export const applyFrontlineGeometryAdjustment = (
  segments: FrontlineSegment[],
  adjustment: FrontlineGeometryAdjustment = defaultFrontlineGeometryAdjustment,
): FrontlineSegment[] => {
  const presetAdjustedSegments =
    adjustment.preset === "sector_default"
      ? cloneSegments(segments)
      : cloneSegments(segments).map((segment) => {
    const segmentForwardOffset = adjustment.forwardOffset + refusedLineOffset(adjustment.preset, segment.id);
    const anchor = {
      x: clamp(segment.anchor.x + segmentForwardOffset, 6, defaultBattleMapBounds.width - 18),
      y: transformY(segment.anchor.y, adjustment.lateralSpread),
    };
    const fallbackPoint = {
      x: clamp(segment.fallbackPoint.x + segmentForwardOffset - 6 * adjustment.depthSpacing, 4, defaultBattleMapBounds.width - 24),
      y: transformY(segment.fallbackPoint.y, adjustment.lateralSpread),
    };
    const zoneCenterY = segment.zone.y + segment.zone.height / 2;
    const nextZoneHeight = clamp(segment.zone.height * adjustment.lateralSpread, 18, 58);
    const nextZoneWidth = clamp(segment.zone.width * adjustment.depthSpacing, 22, 55);
    const zone = {
      x: clamp(segment.zone.x + segmentForwardOffset - (nextZoneWidth - segment.zone.width) * 0.3, 3, defaultBattleMapBounds.width - nextZoneWidth - 3),
      y: clamp(transformY(zoneCenterY, adjustment.lateralSpread) - nextZoneHeight / 2, 3, defaultBattleMapBounds.height - nextZoneHeight - 3),
      width: nextZoneWidth,
      height: nextZoneHeight,
    };
    const deploymentLimit = segment.deploymentLimit
      ? {
          ...segment.deploymentLimit,
          zone: {
            ...segment.deploymentLimit.zone,
            y: zone.y,
            height: zone.height,
          },
        }
      : undefined;

    return {
      ...segment,
      name: `${segment.name}`,
      anchor,
      fallbackPoint,
      controlRadius: Math.round(clamp(segment.controlRadius * adjustment.controlRadiusScale, 9, 24)),
      deploymentLimit,
      zone,
    };
  });

  return presetAdjustedSegments.map((segment) => {
    const withOverride = applySegmentOverride(segment, adjustment.segmentOverrides?.[segment.id]);
    const withSketch = applySketchLine(withOverride, adjustment.sketchLines?.[segment.id]);
    return clampFrontlineSegmentDeployment(withSketch);
  });
};

type FrontlineSegmentGeometryDelta = {
  anchorDelta?: BattlePosition;
  fallbackDelta?: BattlePosition;
  zoneDelta?: BattlePosition;
  zoneSizeDelta?: {
    width: number;
    height: number;
  };
  deploymentLimitDelta?: BattlePosition;
  deploymentLimitSizeDelta?: {
    width: number;
    height: number;
  };
  controlRadiusDelta?: number;
};

const addDeltaPosition = (
  current: BattlePosition | undefined,
  delta: BattlePosition | undefined,
): BattlePosition | undefined => {
  if (!delta) {
    return current ? { ...current } : undefined;
  }
  const next = {
    x: clamp((current?.x ?? 0) + delta.x, -26, 26),
    y: clamp((current?.y ?? 0) + delta.y, -26, 26),
  };
  return next.x === 0 && next.y === 0 ? undefined : next;
};

const addDeltaSize = (
  current: { width: number; height: number } | undefined,
  delta: { width: number; height: number } | undefined,
): { width: number; height: number } | undefined => {
  if (!delta) {
    return current ? { ...current } : undefined;
  }
  const next = {
    width: clamp((current?.width ?? 0) + delta.width, -18, 18),
    height: clamp((current?.height ?? 0) + delta.height, -18, 18),
  };
  return next.width === 0 && next.height === 0 ? undefined : next;
};

const overrideHasValue = (override: FrontlineSegmentGeometryOverride): boolean =>
  Boolean(
    override.anchorOffset ||
      override.fallbackOffset ||
      override.zoneOffset ||
      override.zoneSizeOffset ||
      override.deploymentLimitOffset ||
      override.deploymentLimitSizeOffset ||
      override.controlRadiusOffset,
  );

export const adjustFrontlineSegmentGeometry = (
  adjustment: FrontlineGeometryAdjustment,
  segmentId: string,
  delta: FrontlineSegmentGeometryDelta,
): FrontlineGeometryAdjustment => {
  const next = cloneFrontlineGeometryAdjustment(adjustment);
  const current = next.segmentOverrides?.[segmentId] ?? {};
  const override: FrontlineSegmentGeometryOverride = {
    ...current,
    anchorOffset: addDeltaPosition(current.anchorOffset, delta.anchorDelta),
    fallbackOffset: addDeltaPosition(current.fallbackOffset, delta.fallbackDelta),
    zoneOffset: addDeltaPosition(current.zoneOffset, delta.zoneDelta),
    zoneSizeOffset: addDeltaSize(current.zoneSizeOffset, delta.zoneSizeDelta),
    deploymentLimitOffset: addDeltaPosition(current.deploymentLimitOffset, delta.deploymentLimitDelta),
    deploymentLimitSizeOffset: addDeltaSize(current.deploymentLimitSizeOffset, delta.deploymentLimitSizeDelta),
    controlRadiusOffset: delta.controlRadiusDelta
      ? (() => {
          const nextRadiusOffset = clamp((current.controlRadiusOffset ?? 0) + delta.controlRadiusDelta, -6, 8);
          return nextRadiusOffset === 0 ? undefined : nextRadiusOffset;
        })()
      : current.controlRadiusOffset,
  };
  const currentOverrides = next.segmentOverrides ?? {};
  const { [segmentId]: _removed, ...remaining } = currentOverrides;
  return {
    ...next,
    segmentOverrides: overrideHasValue(override)
      ? { ...remaining, [segmentId]: override }
      : Object.keys(remaining).length > 0
        ? remaining
        : undefined,
  };
};

export const resetFrontlineSegmentGeometry = (
  adjustment: FrontlineGeometryAdjustment,
  segmentId: string,
): FrontlineGeometryAdjustment => {
  const next = cloneFrontlineGeometryAdjustment(adjustment);
  if (!next.segmentOverrides?.[segmentId]) {
    return next;
  }
  const { [segmentId]: _removed, ...remaining } = next.segmentOverrides;
  return {
    ...next,
    segmentOverrides: Object.keys(remaining).length > 0 ? remaining : undefined,
  };
};

const hasTerrain = (sector: TacticalSectorProfile | undefined, tag: string): boolean =>
  sector?.terrainTags.includes(tag) ?? false;

const hasStructureType = (sector: TacticalSectorProfile | undefined, type: Sector["structures"][number]["type"]): boolean =>
  sector?.structures.some((structure) => structure.type === type) ?? false;

export const frontlineProfileLabel = (sector?: TacticalSectorProfile): string => {
  if (!sector) {
    return "標準防衛線";
  }
  if (sector.band === "homeCoreDefense") {
    return "城塞近接防衛線";
  }
  if (hasTerrain(sector, "bridge")) {
    return "鉄道橋隘路防衛線";
  }
  if (sector.band === "enemyVanguard") {
    return "敵前衛沼沢前進線";
  }
  if (sector.band === "enemyHeartland") {
    return "荒野縦深反攻線";
  }
  if (hasTerrain(sector, "forest") && hasTerrain(sector, "marsh")) {
    return "森林泥濘塹壕線";
  }
  if (hasStructureType(sector, "supplyDepot")) {
    return "補給拠点防衛線";
  }
  return "標準防衛線";
};

export const createFrontlineSegmentsForSector = (sector?: TacticalSectorProfile): FrontlineSegment[] => {
  if (!sector) {
    return withDeploymentDepthLimits(baseSegments, sector);
  }

  if (sector.band === "homeCoreDefense") {
    return withDeploymentDepthLimits([
      {
        id: "left-flank",
        name: "城塞左翼高地",
        anchor: { x: 30, y: 23 },
        fallbackPoint: { x: 11, y: 24 },
        controlRadius: 18,
        zone: { x: 8, y: 10, width: 38, height: 25 },
      },
      {
        id: "center-line",
        name: "市街堡塁中央",
        anchor: { x: 33, y: 48 },
        fallbackPoint: { x: 10, y: 50 },
        controlRadius: 20,
        zone: { x: 9, y: 34, width: 42, height: 31 },
      },
      {
        id: "right-flank",
        name: "右翼稜線防衛",
        anchor: { x: 31, y: 73 },
        fallbackPoint: { x: 10, y: 76 },
        controlRadius: 17,
        zone: { x: 8, y: 64, width: 39, height: 25 },
      },
      {
        id: "reserve-line",
        name: "城塞予備砲列",
        anchor: { x: 18, y: 55 },
        fallbackPoint: { x: 7, y: 56 },
        controlRadius: 14,
        zone: { x: 5, y: 40, width: 27, height: 35 },
      },
      {
        id: "engineer-line",
        name: "堡塁工兵線",
        anchor: { x: 38, y: 54 },
        fallbackPoint: { x: 14, y: 59 },
        controlRadius: 15,
        zone: { x: 27, y: 30, width: 27, height: 49 },
      },
    ], sector);
  }

  if (hasTerrain(sector, "bridge")) {
    return withDeploymentDepthLimits([
      {
        id: "left-flank",
        name: "北岸遮蔽線",
        anchor: { x: 32, y: 21 },
        fallbackPoint: { x: 13, y: 24 },
        controlRadius: 15,
        zone: { x: 10, y: 9, width: 34, height: 24 },
      },
      {
        id: "center-line",
        name: "橋梁中央防衛",
        anchor: { x: 42, y: 48 },
        fallbackPoint: { x: 15, y: 50 },
        controlRadius: 13,
        zone: { x: 27, y: 34, width: 34, height: 30 },
      },
      {
        id: "right-flank",
        name: "南岸湿地線",
        anchor: { x: 33, y: 75 },
        fallbackPoint: { x: 13, y: 76 },
        controlRadius: 15,
        zone: { x: 10, y: 64, width: 35, height: 25 },
      },
      {
        id: "reserve-line",
        name: "鉄道砲兵線",
        anchor: { x: 20, y: 55 },
        fallbackPoint: { x: 9, y: 57 },
        controlRadius: 13,
        zone: { x: 6, y: 42, width: 27, height: 33 },
      },
      {
        id: "engineer-line",
        name: "架橋工兵線",
        anchor: { x: 47, y: 51 },
        fallbackPoint: { x: 18, y: 57 },
        controlRadius: 12,
        zone: { x: 35, y: 34, width: 25, height: 34 },
      },
    ], sector);
  }

  if (sector.band === "enemyVanguard") {
    return withDeploymentDepthLimits([
      {
        id: "left-flank",
        name: "黒沼左翼林",
        anchor: { x: 45, y: 24 },
        fallbackPoint: { x: 22, y: 28 },
        controlRadius: 15,
        zone: { x: 25, y: 11, width: 38, height: 25 },
      },
      {
        id: "center-line",
        name: "沼沢中央道",
        anchor: { x: 51, y: 49 },
        fallbackPoint: { x: 23, y: 51 },
        controlRadius: 16,
        zone: { x: 30, y: 34, width: 40, height: 30 },
      },
      {
        id: "right-flank",
        name: "腐泥右翼線",
        anchor: { x: 47, y: 74 },
        fallbackPoint: { x: 22, y: 75 },
        controlRadius: 14,
        zone: { x: 25, y: 64, width: 38, height: 24 },
      },
      {
        id: "reserve-line",
        name: "前進予備砲列",
        anchor: { x: 31, y: 57 },
        fallbackPoint: { x: 15, y: 59 },
        controlRadius: 13,
        zone: { x: 14, y: 42, width: 30, height: 34 },
      },
      {
        id: "engineer-line",
        name: "渡河工兵線",
        anchor: { x: 53, y: 58 },
        fallbackPoint: { x: 24, y: 63 },
        controlRadius: 14,
        zone: { x: 39, y: 36, width: 31, height: 44 },
      },
    ], sector);
  }

  if (sector.band === "enemyHeartland") {
    return withDeploymentDepthLimits([
      {
        id: "left-flank",
        name: "荒野左翼散兵線",
        anchor: { x: 54, y: 23 },
        fallbackPoint: { x: 26, y: 27 },
        controlRadius: 17,
        zone: { x: 32, y: 10, width: 43, height: 26 },
      },
      {
        id: "center-line",
        name: "中央反攻線",
        anchor: { x: 58, y: 50 },
        fallbackPoint: { x: 27, y: 51 },
        controlRadius: 18,
        zone: { x: 35, y: 34, width: 45, height: 31 },
      },
      {
        id: "right-flank",
        name: "右翼荒地線",
        anchor: { x: 55, y: 75 },
        fallbackPoint: { x: 26, y: 77 },
        controlRadius: 16,
        zone: { x: 32, y: 64, width: 43, height: 25 },
      },
      {
        id: "reserve-line",
        name: "遠征砲兵線",
        anchor: { x: 35, y: 57 },
        fallbackPoint: { x: 16, y: 60 },
        controlRadius: 14,
        zone: { x: 16, y: 42, width: 33, height: 34 },
      },
      {
        id: "engineer-line",
        name: "前進工兵線",
        anchor: { x: 62, y: 59 },
        fallbackPoint: { x: 29, y: 65 },
        controlRadius: 14,
        zone: { x: 47, y: 36, width: 34, height: 44 },
      },
    ], sector);
  }

  if (hasTerrain(sector, "forest") && hasTerrain(sector, "marsh")) {
    return withDeploymentDepthLimits([
      {
        id: "left-flank",
        name: "森林左翼線",
        anchor: { x: 34, y: 24 },
        fallbackPoint: { x: 16, y: 28 },
        controlRadius: 17,
        zone: { x: 12, y: 11, width: 39, height: 25 },
      },
      {
        id: "center-line",
        name: "中央塹壕線",
        anchor: { x: 38, y: 47 },
        fallbackPoint: { x: 17, y: 49 },
        controlRadius: 18,
        zone: { x: 16, y: 34, width: 42, height: 30 },
      },
      {
        id: "right-flank",
        name: "右翼泥濘線",
        anchor: { x: 35, y: 71 },
        fallbackPoint: { x: 15, y: 73 },
        controlRadius: 15,
        zone: { x: 12, y: 63, width: 40, height: 25 },
      },
      {
        id: "reserve-line",
        name: "後方砲兵線",
        anchor: { x: 22, y: 56 },
        fallbackPoint: { x: 10, y: 58 },
        controlRadius: 14,
        zone: { x: 6, y: 42, width: 28, height: 34 },
      },
      {
        id: "engineer-line",
        name: "塹壕補修線",
        anchor: { x: 43, y: 55 },
        fallbackPoint: { x: 18, y: 62 },
        controlRadius: 15,
        zone: { x: 30, y: 30, width: 28, height: 48 },
      },
    ], sector);
  }

  return withDeploymentDepthLimits(baseSegments, sector);
};

export const defaultFrontlineSegments: FrontlineSegment[] = createFrontlineSegmentsForSector();

export const frontlineSegmentForUnit = (
  type: UnitType,
  index: number,
  segments: FrontlineSegment[] = defaultFrontlineSegments,
): FrontlineSegment => {
  if (type === "artillery") {
    return segments.find((segment) => segment.id === "reserve-line") ?? segments[0];
  }
  if (type === "engineer") {
    return segments.find((segment) => segment.id === "engineer-line") ?? segments[0];
  }
  const lineSegments = segments.filter((segment) =>
    ["left-flank", "center-line", "right-flank"].includes(segment.id),
  );
  return lineSegments[index % lineSegments.length] ?? segments[0];
};
