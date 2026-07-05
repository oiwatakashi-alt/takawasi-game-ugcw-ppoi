import { weaponDefinitions } from "../../content/baseGame/weapons";
import type { UnitType } from "../army/types";
import {
  applyDivisionDirectiveToStandingOrder,
  divisionCommandProfile,
  divisionForUnit,
} from "../army/divisions";
import { getUnitWeaponKey } from "../army/equipment";
import { commandDutyLoadByOfficer, commandDutyProfileForOfficer } from "../army/commandDuty";
import { armyHeadquartersProfile, normalizeStaffAssignments, staffSlotDefinitions } from "../army/headquarters";
import type { CampaignState, ReserveDoctrinePlan } from "../campaign/types";
import { defaultReserveDoctrinePlan } from "../campaign/deploymentPlan";
import { tacticalLessonProfileForUnit } from "../campaign/tacticalLessons";
import { fireDisciplineFromDoctrine, strategicDoctrineFromDoctrine } from "../doctrine/applyDoctrine";
import { officerCommandProfile, officerCommandSummary } from "../officers/effects";
import type {
  BattleObjectiveEventState,
  BattleObjectiveNode,
  BattleObjectiveScenario,
  BattlePosition,
  BattleScenario,
  BattleState,
  BattleStructure,
  BattleUnit,
  FrontlineSegment,
  StandingOrder,
  StandingOrderTemplate,
  WithdrawalRearGuardPlanAssessment,
} from "./types";
import { createChokePointsForBattle } from "./chokePoints";
import { createFormationForUnit, defaultFormationFacingForSegment, updateFormationStates } from "./formations";
import {
  applyFrontlineGeometryAdjustment,
  clampPositionToDeploymentLimit,
  createFrontlineSegmentsForSector,
  defaultBattleMapBounds,
  frontlineSegmentForUnit,
} from "./frontlineDefaults";
import { alignStandingOrderToFrontlineSegments } from "./standingOrderDrafts";
import { createTerrainZonesForBattle } from "./terrainEffects";

const deploymentPositions: BattlePosition[] = [
  { x: 28, y: 25 },
  { x: 33, y: 39 },
  { x: 30, y: 56 },
  { x: 37, y: 70 },
  { x: 21, y: 43 },
  { x: 18, y: 63 },
  { x: 25, y: 78 },
  { x: 39, y: 31 },
];

const positionForUnit = (type: UnitType, index: number, segments: FrontlineSegment[]): BattlePosition => {
  const segment = frontlineSegmentForUnit(type, index, segments);
  const laneOffsets: BattlePosition[] = [
    { x: 0, y: 0 },
    { x: -4, y: 4 },
    { x: -3, y: -4 },
    { x: 4, y: 4 },
    { x: -7, y: 0 },
    { x: 3, y: -7 },
  ];
  const offset = laneOffsets[index % laneOffsets.length];
  if (type === "artillery") {
    return clampPositionToDeploymentLimit(segment, {
      x: Math.max(8, segment.anchor.x - 8 + offset.x * 0.4),
      y: Math.max(14, segment.anchor.y + offset.y * 0.35),
    });
  }
  if (type === "engineer") {
    return clampPositionToDeploymentLimit(segment, {
      x: Math.min(62, segment.anchor.x + 3 + offset.x * 0.35),
      y: Math.min(84, segment.anchor.y + 2 + offset.y * 0.4),
    });
  }
  if (type === "jaeger") {
    return clampPositionToDeploymentLimit(segment, {
      x: Math.min(70, segment.anchor.x + 3 + offset.x * 0.5),
      y: Math.max(12, segment.anchor.y - 5 + offset.y * 0.45),
    });
  }
  const slot = deploymentPositions[index % deploymentPositions.length];
  return clampPositionToDeploymentLimit(segment, {
    x: Math.max(8, Math.min(defaultBattleMapBounds.width - 8, segment.anchor.x + offset.x + (slot.x - 30) * 0.08)),
    y: Math.max(10, Math.min(defaultBattleMapBounds.height - 8, segment.anchor.y + offset.y + (slot.y - 50) * 0.04)),
  });
};

const structurePosition = (structure: { type: BattleStructure["type"]; mapNodeId: string }, index: number): BattlePosition => {
  if (structure.mapNodeId.includes("depot") || structure.type === "supplyDepot") {
    return { x: 22 + index * 4, y: 72 };
  }
  if (structure.type === "observationPost") {
    return { x: 49 + index * 3, y: 24 + index * 8 };
  }
  if (structure.type === "fieldHospital") {
    return { x: 18 + index * 3, y: 82 };
  }
  if (structure.type === "barricade") {
    return { x: 42, y: 42 + index * 12 };
  }
  return { x: 39, y: 34 + index * 18 };
};

const battleStructureStats: Record<BattleStructure["type"], Pick<BattleStructure, "range" | "firepower" | "blockedRadius">> = {
  trench: { range: 34, firepower: 0.55, blockedRadius: 11 },
  barricade: { range: 18, firepower: 0.25, blockedRadius: 9 },
  supplyDepot: { range: 22, firepower: 0.18, blockedRadius: 6 },
  observationPost: { range: 46, firepower: 0.08, blockedRadius: 5 },
  fieldHospital: { range: 12, firepower: 0.04, blockedRadius: 7 },
};

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const clampPosition = (position: BattlePosition): BattlePosition => ({
  x: clamp(position.x, 4, defaultBattleMapBounds.width - 4),
  y: clamp(position.y, 6, defaultBattleMapBounds.height - 6),
});

const nearestStructure = (position: BattlePosition, structures: BattleStructure[]): BattleStructure | undefined =>
  [...structures].sort((a, b) => distance(position, a.position) - distance(position, b.position))[0];

const hasObjectiveTerrain = (terrainTags: string[], tag: string): boolean =>
  terrainTags.includes(tag) || (tag === "trench" && terrainTags.includes("trench/cover"));

const objectiveScenario = (
  type: BattleObjectiveNode["type"],
  terrainTags: string[],
  structures: BattleStructure[],
): BattleObjectiveScenario => {
  if (type === "victory") {
    if (hasObjectiveTerrain(terrainTags, "bridge")) {
      return {
        id: "rail-bridgehead",
        label: "鉄道橋頭堡",
        tagline: "橋梁出口を押さえる唯一の退路",
        effectSummary: "保持で敵を隘路に縛り、喪失で後方線へなだれ込まれる",
        playerPresenceMultiplier: 1.12,
        enemyPresenceMultiplier: 1.24,
        controlDriftMultiplier: 1.16,
        pressureMultiplier: 1.28,
      };
    }
    if (hasObjectiveTerrain(terrainTags, "village")) {
      return {
        id: "village-square-command",
        label: "村役場広場",
        tagline: "村落内の道路と指揮伝令が集まる広場",
        effectSummary: "保持で市街遮蔽を使えるが、喪失で側背路が開く",
        playerPresenceMultiplier: 1.1,
        enemyPresenceMultiplier: 1.14,
        controlDriftMultiplier: 1.1,
        pressureMultiplier: 1.18,
      };
    }
    if (hasObjectiveTerrain(terrainTags, "trench")) {
      return {
        id: "trench-crossroad",
        label: "塹壕交差点",
        tagline: "主抵抗線を束ねる交通壕結節",
        effectSummary: "保持で戦線維持が安定、喪失で突破圧が増える",
        playerPresenceMultiplier: 1.08,
        enemyPresenceMultiplier: 1.12,
        controlDriftMultiplier: 1.04,
        pressureMultiplier: 1.16,
      };
    }
    if (hasObjectiveTerrain(terrainTags, "marsh")) {
      return {
        id: "causeway-redoubt",
        label: "泥濘堤道堡",
        tagline: "湿地を横切る細い堤道の防御支点",
        effectSummary: "保持で敵を湿地に滞留させ、喪失で迂回圧が強まる",
        playerPresenceMultiplier: 1.06,
        enemyPresenceMultiplier: 1.18,
        controlDriftMultiplier: 1.12,
        pressureMultiplier: 1.2,
      };
    }
    return {
      id: "command-knoll",
      label: "指揮小丘",
      tagline: "全線の退路と信号を見渡す小高地",
      effectSummary: "保持で士気線が持ち、喪失で全線後退が早まる",
      playerPresenceMultiplier: 1.04,
      enemyPresenceMultiplier: 1.08,
      controlDriftMultiplier: 1,
      pressureMultiplier: 1.12,
    };
  }
  if (type === "supply") {
    if (structures.some((structure) => structure.type === "supplyDepot")) {
      return {
        id: "forward-ammo-dump",
        label: "前線弾薬集積所",
        tagline: "砲兵と戦列へ弾薬を流す露出した補給結節",
        effectSummary: "保持で斉射弾薬効率が上がり、喪失で火力計画が重くなる",
        playerPresenceMultiplier: 0.96,
        enemyPresenceMultiplier: 1.18,
        controlDriftMultiplier: 1.12,
        pressureMultiplier: 1.08,
      };
    }
    if (hasObjectiveTerrain(terrainTags, "bridge")) {
      return {
        id: "rail-supply-siding",
        label: "鉄道側線補給所",
        tagline: "橋梁後方の弾薬貨車と予備弾薬線",
        effectSummary: "保持で補給が太く、喪失で橋頭堡の火力計画が詰まる",
        playerPresenceMultiplier: 0.94,
        enemyPresenceMultiplier: 1.2,
        controlDriftMultiplier: 1.16,
        pressureMultiplier: 1.12,
      };
    }
    if (hasObjectiveTerrain(terrainTags, "village")) {
      return {
        id: "village-storehouse",
        label: "村倉庫補給点",
        tagline: "村落内に積まれた弾薬箱と救護物資",
        effectSummary: "保持で市街戦の弾薬が続き、喪失で補給回復が急に鈍る",
        playerPresenceMultiplier: 0.98,
        enemyPresenceMultiplier: 1.14,
        controlDriftMultiplier: 1.12,
        pressureMultiplier: 1.08,
      };
    }
    if (hasObjectiveTerrain(terrainTags, "marsh")) {
      return {
        id: "plank-road-wagons",
        label: "板道荷車列",
        tagline: "泥濘地を通る補給荷車の細い列",
        effectSummary: "保持で補給が続くが、喪失で休息補給が湿地に飲まれる",
        playerPresenceMultiplier: 0.92,
        enemyPresenceMultiplier: 1.18,
        controlDriftMultiplier: 1.18,
        pressureMultiplier: 1.1,
      };
    }
    return {
      id: "wagon-supply-point",
      label: "荷車補給点",
      tagline: "後方道路から届く臨時補給所",
      effectSummary: "保持で休息補給が効き、喪失で補給回復が鈍る",
      playerPresenceMultiplier: 0.98,
      enemyPresenceMultiplier: 1.1,
      controlDriftMultiplier: 1.06,
      pressureMultiplier: 1,
    };
  }
  if (structures.some((structure) => structure.type === "observationPost")) {
    return {
      id: "observation-outpost",
      label: "観測塔前哨",
      tagline: "敵波と指揮核を早期に読む前進観測点",
      effectSummary: "保持で敵波判読が明瞭、喪失で敵群の接近が読みにくい",
      playerPresenceMultiplier: 1.12,
      enemyPresenceMultiplier: 0.96,
      controlDriftMultiplier: 1.08,
      pressureMultiplier: 0.92,
    };
  }
  if (hasObjectiveTerrain(terrainTags, "hill")) {
    return {
      id: "ridge-signal-post",
      label: "稜線信号所",
      tagline: "高地上から敵波と友軍信号をつなぐ地点",
      effectSummary: "保持で敵波判読と制圧が伸び、喪失で敵進路がぼやける",
      playerPresenceMultiplier: 1.16,
      enemyPresenceMultiplier: 0.94,
      controlDriftMultiplier: 1.08,
      pressureMultiplier: 0.9,
    };
  }
  if (hasObjectiveTerrain(terrainTags, "bridge")) {
    return {
      id: "embankment-lookout",
      label: "築堤監視所",
      tagline: "鉄道築堤沿いに敵の橋梁接近を読む監視点",
      effectSummary: "保持で隘路接近を早く読め、喪失で橋頭堡への敵圧を見失う",
      playerPresenceMultiplier: 1.12,
      enemyPresenceMultiplier: 1,
      controlDriftMultiplier: 1.1,
      pressureMultiplier: 0.94,
    };
  }
  if (hasObjectiveTerrain(terrainTags, "village")) {
    return {
      id: "church-tower-lookout",
      label: "教会塔観測点",
      tagline: "村落屋根越しに敵の迂回を読む高所",
      effectSummary: "保持で市街側面を読め、喪失で路地からの接近が遅れて見える",
      playerPresenceMultiplier: 1.12,
      enemyPresenceMultiplier: 0.98,
      controlDriftMultiplier: 1.08,
      pressureMultiplier: 0.94,
    };
  }
  if (hasObjectiveTerrain(terrainTags, "marsh")) {
    return {
      id: "reed-line-observation",
      label: "葦原監視線",
      tagline: "泥濘と葦原の切れ目に置かれた前進監視線",
      effectSummary: "保持で湿地の接近を読め、喪失で敵群が霧に紛れる",
      playerPresenceMultiplier: 1.1,
      enemyPresenceMultiplier: 1.02,
      controlDriftMultiplier: 1.1,
      pressureMultiplier: 0.96,
    };
  }
  return {
    id: "forest-lookout",
    label: "林縁観測丘",
    tagline: "森林の切れ目から敵進路を読む観測地点",
    effectSummary: "保持で発見距離が伸び、喪失で敵波判読が不明瞭になる",
    playerPresenceMultiplier: 1.08,
    enemyPresenceMultiplier: 0.98,
    controlDriftMultiplier: 1.04,
    pressureMultiplier: 0.96,
  };
};

const stableObjectiveEventState = (
  type: BattleObjectiveNode["type"],
  scenario: BattleObjectiveScenario,
): BattleObjectiveEventState => {
  if (type === "victory") {
    return {
      id: "signal-stable",
      label: "信号維持",
      detail: `${scenario.label}の指揮信号は維持されています。`,
      severity: "stable",
      effectSummary: "追加影響なし",
    };
  }
  if (type === "supply") {
    return {
      id: "supply-stable",
      label: "補給整理",
      detail: `${scenario.label}の補給路は使用可能です。`,
      severity: "stable",
      effectSummary: "追加影響なし",
    };
  }
  return {
    id: "visibility-stable",
    label: "観測継続",
    detail: `${scenario.label}は観測機能を保っています。`,
    severity: "stable",
    effectSummary: "追加影響なし",
  };
};

const createObjectiveNodes = (
  segments: FrontlineSegment[],
  structures: BattleStructure[],
  terrainTags: string[],
): BattleObjectiveNode[] => {
  const centerSegment =
    segments.find((segment) => segment.id === "center-line") ??
    segments.find((segment) => segment.id.includes("center")) ??
    segments[0];
  const supplyDepot = structures.find((structure) => structure.type === "supplyDepot");
  const observationPost = structures.find((structure) => structure.type === "observationPost");
  const victoryPosition = centerSegment
    ? {
        x: Math.min(defaultBattleMapBounds.width - 18, centerSegment.anchor.x + 24),
        y: centerSegment.anchor.y,
      }
    : { x: 58, y: 20 };
  const victoryScenario = objectiveScenario("victory", terrainTags, structures);
  const supplyScenario = objectiveScenario("supply", terrainTags, structures);
  const visibilityScenario = objectiveScenario("visibility", terrainTags, structures);

  return [
    {
      id: "objective-victory",
      type: "victory",
      label: "勝利地点",
      scenario: victoryScenario,
      eventState: stableObjectiveEventState("victory", victoryScenario),
      position: clampPosition(victoryPosition),
      radius: 16,
      control: "player",
      controlProgress: 72,
      playerPresence: 0,
      enemyPresence: 0,
    },
    {
      id: "objective-supply",
      type: "supply",
      label: "補給点",
      scenario: supplyScenario,
      eventState: stableObjectiveEventState("supply", supplyScenario),
      position: clampPosition(supplyDepot ? { x: supplyDepot.position.x + 3, y: supplyDepot.position.y - 5 } : { x: 25, y: 63 }),
      radius: 14,
      control: "player",
      controlProgress: supplyDepot ? 84 : 62,
      playerPresence: 0,
      enemyPresence: 0,
    },
    {
      id: "objective-visibility",
      type: "visibility",
      label: "視界点",
      scenario: visibilityScenario,
      eventState: stableObjectiveEventState("visibility", visibilityScenario),
      position: clampPosition(
        observationPost ? { x: observationPost.position.x + 20, y: observationPost.position.y + 5 } : { x: 78, y: 42 },
      ),
      radius: 15,
      control: observationPost ? "player" : "contested",
      controlProgress: observationPost ? 66 : 48,
      playerPresence: 0,
      enemyPresence: 0,
    },
  ];
};

const standingOrderForUnit = (
  type: UnitType,
  index: number,
  position: BattlePosition,
  structures: BattleStructure[],
  segments: FrontlineSegment[],
): StandingOrder => {
  const segment = frontlineSegmentForUnit(type, index, segments);
  const damagedStructure = structures.find(
    (structure) => structure.status === "damaged" || structure.durability < structure.maxDurability,
  );
  const supplyDepot = structures.find((structure) => structure.type === "supplyDepot");
  const closestStructure = nearestStructure(position, structures);
  const facility =
    type === "engineer" && (damagedStructure ?? closestStructure)
      ? {
          structureId: (damagedStructure ?? closestStructure)?.id ?? "",
          mode: "repair" as const,
        }
      : type === "artillery" && supplyDepot
        ? {
            structureId: supplyDepot.id,
            mode: "resupply" as const,
          }
        : closestStructure && distance(position, closestStructure.position) <= 26
          ? {
              structureId: closestStructure.id,
              mode: closestStructure.type === "supplyDepot" ? ("resupply" as const) : ("defend" as const),
            }
          : undefined;

  return {
    anchor: clampPositionToDeploymentLimit(segment, position),
    controlRadius: segment.controlRadius,
    frontlineSegmentId: segment.id,
    facingDeg: defaultFormationFacingForSegment(segment.id, type),
    posture:
      type === "engineer"
        ? "engineer_support"
        : type === "artillery"
          ? "fire_support"
          : type === "jaeger"
            ? "aggressive_screen"
            : index % 2 === 0
              ? "hold_line"
              : "elastic_defense",
    targetPriority: type === "artillery" ? "largest_mass" : type === "jaeger" ? "officer" : "nearest",
    ammoPolicy: type === "artillery" || type === "engineer" ? "conserve" : "normal",
    fallback: {
      enabled: type !== "artillery",
      moraleBelow: type === "jaeger" ? 42 : 35,
      soldiersBelowRatio: 0.56,
      ammoBelow: type === "engineer" ? 20 : 12,
      destination: segment.fallbackPoint,
    },
    facilityAssignment: facility?.structureId ? facility : undefined,
  };
};

const standingOrderFromTemplate = (
  template: StandingOrderTemplate | undefined,
  fallbackStandingOrder: StandingOrder,
  structures: BattleStructure[],
  segments: FrontlineSegment[],
): StandingOrder => {
  if (!template) {
    return fallbackStandingOrder;
  }
  const alignedTemplate = alignStandingOrderToFrontlineSegments(template.standingOrder, segments);
  const facilityAssignment =
    alignedTemplate.facilityAssignment &&
    structures.some((structure) => structure.id === alignedTemplate.facilityAssignment?.structureId)
      ? { ...alignedTemplate.facilityAssignment }
      : fallbackStandingOrder.facilityAssignment;

  return {
    ...alignedTemplate,
    anchor: clampPosition(alignedTemplate.anchor),
    fallback: {
      ...alignedTemplate.fallback,
      destination: clampPosition(alignedTemplate.fallback.destination),
    },
    facilityAssignment,
  };
};

const initialReserveReadiness = (
  type: UnitType,
  standingOrder: StandingOrder,
  reserveDoctrine = defaultReserveDoctrinePlan,
): number => {
  const doctrineBonus =
    reserveDoctrine.mode === "prepared_counterstroke"
      ? 16
      : reserveDoctrine.mode === "elastic_reserve"
        ? 8
        : reserveDoctrine.mode === "fire_support_pool" && type === "artillery"
          ? 18
          : reserveDoctrine.mode === "fire_support_pool"
            ? 4
            : 0;
  if (standingOrder.frontlineSegmentId?.includes("reserve") || standingOrder.posture === "fire_support") {
    return clamp(type === "artillery" ? 58 + doctrineBonus : 46 + doctrineBonus, 0, 100);
  }
  if (standingOrder.posture === "fallback_guard") {
    return clamp(40 + doctrineBonus * 0.8, 0, 100);
  }
  return clamp(18 + doctrineBonus * 0.35, 0, 100);
};

const reserveStandingOrderForUnit = (
  type: UnitType,
  fallbackStandingOrder: StandingOrder,
  structures: BattleStructure[],
  segments: FrontlineSegment[],
  reserveDoctrine: ReserveDoctrinePlan,
): StandingOrder => {
  const reserveSegment = segments.find((segment) => segment.id === "reserve-line") ?? segments[0];
  const supplyDepot = structures.find((structure) => structure.type === "supplyDepot");
  const posture =
    type === "artillery" || reserveDoctrine.mode === "fire_support_pool"
      ? "fire_support"
      : reserveDoctrine.mode === "elastic_reserve"
        ? "elastic_defense"
        : "fallback_guard";
  const targetPriority =
    reserveDoctrine.mode === "prepared_counterstroke"
      ? "officer"
      : reserveDoctrine.mode === "fire_support_pool"
        ? "largest_mass"
        : fallbackStandingOrder.targetPriority;

  return {
    ...fallbackStandingOrder,
    anchor: clampPositionToDeploymentLimit(reserveSegment, reserveSegment.anchor),
    controlRadius: Math.max(reserveSegment.controlRadius, fallbackStandingOrder.controlRadius),
    frontlineSegmentId: reserveSegment.id,
    facingDeg: defaultFormationFacingForSegment(reserveSegment.id, type),
    posture,
    targetPriority,
    ammoPolicy: reserveDoctrine.mode === "elastic_reserve" ? "normal" : "conserve",
    fallback: {
      ...fallbackStandingOrder.fallback,
      enabled: type !== "artillery",
      moraleBelow: reserveDoctrine.mode === "prepared_counterstroke" ? 48 : fallbackStandingOrder.fallback.moraleBelow,
      soldiersBelowRatio:
        reserveDoctrine.mode === "elastic_reserve" ? 0.62 : fallbackStandingOrder.fallback.soldiersBelowRatio,
      destination: { ...reserveSegment.fallbackPoint },
    },
    facilityAssignment: supplyDepot
      ? {
          structureId: supplyDepot.id,
          mode: "resupply",
        }
      : undefined,
  };
};

const rearGuardStandingOrderForUnit = (
  type: UnitType,
  fallbackStandingOrder: StandingOrder,
  structures: BattleStructure[],
  segments: FrontlineSegment[],
): StandingOrder => {
  const reserveSegment = segments.find((segment) => segment.id === "reserve-line") ?? segments[0];
  const supplyDepot = structures.find((structure) => structure.type === "supplyDepot");
  return {
    ...fallbackStandingOrder,
    anchor: clampPositionToDeploymentLimit(reserveSegment, {
      x: reserveSegment.anchor.x - 3,
      y: reserveSegment.anchor.y + (type === "artillery" ? 4 : 0),
    }),
    controlRadius: Math.max(reserveSegment.controlRadius + 2, fallbackStandingOrder.controlRadius),
    frontlineSegmentId: reserveSegment.id,
    facingDeg: defaultFormationFacingForSegment(reserveSegment.id, type),
    posture: type === "artillery" ? "fire_support" : "fallback_guard",
    targetPriority: type === "artillery" ? "largest_mass" : "officer",
    ammoPolicy: "conserve",
    fallback: {
      ...fallbackStandingOrder.fallback,
      enabled: type !== "artillery",
      moraleBelow: Math.max(52, fallbackStandingOrder.fallback.moraleBelow ?? 42),
      soldiersBelowRatio: Math.max(0.7, fallbackStandingOrder.fallback.soldiersBelowRatio ?? 0.58),
      ammoBelow: Math.max(18, fallbackStandingOrder.fallback.ammoBelow ?? 12),
      destination: { ...reserveSegment.fallbackPoint },
    },
    facilityAssignment: supplyDepot
      ? {
          structureId: supplyDepot.id,
          mode: "resupply",
        }
      : fallbackStandingOrder.facilityAssignment,
  };
};

const rearGuardTradeoffLabel = (pursuitCover: number, preservationScore: number, officerRisk: number): string => {
  if (pursuitCover >= 72 && officerRisk >= 48) {
    return "追撃抑止高・将校危険";
  }
  if (pursuitCover >= 58 && preservationScore >= 42) {
    return "均衡候補";
  }
  if (preservationScore >= 56) {
    return "将校温存寄り";
  }
  if (pursuitCover >= 60) {
    return "追撃抑止寄り";
  }
  return "限定投入";
};

const withdrawalRearGuardPlanAssessmentForUnit = (
  unit: BattleUnit,
  scenario: BattleScenario,
): WithdrawalRearGuardPlanAssessment => {
  const operationRisk = scenario.operation.risk <= 1 ? scenario.operation.risk * 100 : scenario.operation.risk;
  const pursuitPressure = clamp(18 + operationRisk * 0.18 + scenario.waveIntel.actualCommandWaveChance * 0.08, 12, 62);
  const reserveLine = unit.standingOrder.frontlineSegmentId?.includes("reserve") ?? false;
  const fallbackGuard = unit.standingOrder.posture === "fallback_guard";
  const fireSupport = unit.type === "artillery" || unit.standingOrder.posture === "fire_support";
  const readiness =
    22 +
    (reserveLine || fallbackGuard ? 16 : 0) +
    Math.min(18, unit.reserveReadiness * 0.18) +
    Math.min(14, unit.ammo * 0.12) +
    Math.min(12, unit.morale * 0.1);
  const roleFit = (fireSupport ? 15 : 0) + (unit.type === "infantry" ? 8 : 0) + (unit.type === "jaeger" ? 5 : 0);
  const suitability = clamp(Math.round(34 + readiness + roleFit), 0, 100);
  const exposure = fireSupport ? 0.34 : fallbackGuard ? 0.46 : 0.4;
  const scaleCost = Math.max(7, unit.maxSoldiers * 0.016);
  const predictedCasualties = Math.max(
    1,
    Math.min(
      Math.max(1, Math.round(unit.maxSoldiers * 0.05)),
      Math.round(scaleCost + pursuitPressure * exposure + Math.max(0, 60 - suitability) * 0.11 - readiness * 0.035),
    ),
  );
  const casualtyRatio = unit.maxSoldiers > 0 ? predictedCasualties / unit.maxSoldiers : 0;
  const rearGuardRiskPressure =
    casualtyRatio >= 0.026 || predictedCasualties >= 18
      ? 18
      : casualtyRatio >= 0.015 || predictedCasualties >= 9
        ? 10
        : 4;
  const predictedOfficerRisk = clamp(Math.round(casualtyRatio * 420 + 14 + rearGuardRiskPressure), 0, 100);
  const pursuitCover = clamp(
    Math.round(
      suitability * 0.48 +
        (fireSupport ? 20 : 0) +
        (reserveLine ? 10 : 0) +
        (fallbackGuard ? 10 : 0) +
        scenario.waveIntel.actualCommandWaveChance * 0.12 -
        predictedCasualties * 0.36,
    ),
    0,
    100,
  );
  const preservationScore = clamp(
    Math.round(100 - predictedOfficerRisk - casualtyRatio * 160 - Math.max(0, predictedCasualties - 10) * 0.7),
    0,
    100,
  );
  const recommendationScore = clamp(
    Math.round(suitability * 0.42 + pursuitCover * 0.34 + preservationScore * 0.3 - predictedOfficerRisk * 0.18),
    0,
    100,
  );
  const reasons = [
    "後衛指定済み",
    reserveLine ? "予備線適性" : undefined,
    fireSupport ? "火力支援可" : undefined,
    fallbackGuard ? "後退守備" : undefined,
  ].filter(Boolean);
  return {
    unitId: unit.unitId,
    unitName: unit.name,
    predictedCasualties,
    predictedOfficerRisk,
    pursuitCover,
    preservationScore,
    recommendationScore,
    tradeoffLabel: rearGuardTradeoffLabel(pursuitCover, preservationScore, predictedOfficerRisk),
    reason: reasons.join(" / "),
  };
};

export const createBattleState = (
  campaign: CampaignState,
  scenario: BattleScenario,
  deployedUnitIds?: string[],
): BattleState => {
  const activeSideAssignments = new Set(
    campaign.activeStrategicTurn.sideOperations.flatMap((operation) => operation.assignedForces.unitIds),
  );
  const deployedSet = deployedUnitIds && deployedUnitIds.length > 0 ? new Set(deployedUnitIds) : undefined;
  const standingOrderTemplates = campaign.standingOrderTemplates ?? [];
  const fireDiscipline = fireDisciplineFromDoctrine(campaign.doctrines);
  const strategicDoctrine = strategicDoctrineFromDoctrine(campaign.doctrines);
  const reserveDoctrine = campaign.deploymentPlan?.reserveDoctrine ?? defaultReserveDoctrinePlan;
  const headquartersProfile = armyHeadquartersProfile(campaign.army, campaign.officers);
  const commandDutyLoads = commandDutyLoadByOfficer(campaign.army);
  const staffAssignments = normalizeStaffAssignments(campaign.army.formations[0]?.staffAssignments);
  const staffAccountabilityContext = staffSlotDefinitions.map((slot) => {
    const officerId = staffAssignments.find((assignment) => assignment.slotId === slot.id)?.officerId;
    const officer = campaign.officers.find((candidate) => candidate.id === officerId);
    return {
      slotId: slot.id,
      slotLabel: slot.label,
      officerId,
      officerName: officer?.name,
    };
  });

  const sector = campaign.theater.sectors.find((candidate) => candidate.id === scenario.sectorId);
  const frontlineGeometry =
    campaign.deploymentPlan?.operationId === scenario.operation.id &&
    campaign.deploymentPlan.sectorId === scenario.sectorId
      ? campaign.deploymentPlan.frontlineGeometry
      : undefined;
  const plannedReserveUnitIds = new Set(
    campaign.deploymentPlan?.operationId === scenario.operation.id &&
    campaign.deploymentPlan.sectorId === scenario.sectorId
      ? campaign.deploymentPlan.reserveUnitIds ?? []
      : [],
  );
  const plannedRearGuardUnitIds = new Set(
    campaign.deploymentPlan?.operationId === scenario.operation.id &&
    campaign.deploymentPlan.sectorId === scenario.sectorId
      ? campaign.deploymentPlan.rearGuardUnitIds ?? []
      : [],
  );
  const frontlineSegments = applyFrontlineGeometryAdjustment(createFrontlineSegmentsForSector(sector), frontlineGeometry);
  const terrainZones = createTerrainZonesForBattle(scenario.terrainTags, frontlineSegments);
  const chokePoints = createChokePointsForBattle(scenario.terrainTags, frontlineSegments);
  const structures: BattleStructure[] =
    sector?.structures.map((structure, index) => ({
      ...structure,
      ...battleStructureStats[structure.type],
      position: structurePosition(structure, index),
      history: [...structure.history],
      tacticalPressure: 0,
      repairRate: 0,
      assignedUnitIds: [],
      facilityState: structure.status === "overrun" ? "overrun" : "secure",
      facilityStateLabel: structure.status === "overrun" ? "制圧" : "安定",
    })) ?? [];
  const objectiveNodes = createObjectiveNodes(frontlineSegments, structures, scenario.terrainTags);

  const playerUnits: BattleUnit[] = updateFormationStates(
    campaign.army.units
      .filter((unit) => !activeSideAssignments.has(unit.id))
      .filter((unit) => !deployedSet || deployedSet.has(unit.id))
      .map((unit, index) => {
      const officer = campaign.officers.find((candidate) => candidate.id === unit.officerId);
      const officerProfile = officerCommandProfile(
        officer,
        unit.type,
        unit.soldiers,
        headquartersProfile.commandCapacityBonus,
        officer ? commandDutyLoads[officer.id] ?? 0 : 0,
        officer ? commandDutyProfileForOfficer(campaign.army, officer.id).summary : undefined,
      );
      const weaponKey = getUnitWeaponKey(unit);
      const weapon = weaponDefinitions[weaponKey];
      const defaultPosition = positionForUnit(unit.type, index, frontlineSegments);
      const defaultStandingOrder = standingOrderForUnit(unit.type, index, defaultPosition, structures, frontlineSegments);
      const savedTemplate = standingOrderTemplates.find((template) => template.createdFromUnitId === unit.id);
      const deploymentMitigationRole = savedTemplate?.description.includes("弱線是正")
        ? "weak_line_focus"
        : savedTemplate?.description.includes("支援予備")
          ? "support_reserve"
          : undefined;
      const unitDivision = divisionForUnit(campaign.army, unit.id);
      const divisionProfile = divisionCommandProfile(unitDivision, campaign.officers);
      const divisionCommander = campaign.officers.find(
        (candidate) => candidate.id === unitDivision?.commanderOfficerId && candidate.status === "active",
      );
      const tacticalLessonProfile = tacticalLessonProfileForUnit(unit);
      const baseStandingOrder = standingOrderFromTemplate(
        savedTemplate,
        applyDivisionDirectiveToStandingOrder(defaultStandingOrder, unit.type, unitDivision),
        structures,
        frontlineSegments,
      );
      const standingOrder = plannedRearGuardUnitIds.has(unit.id)
        ? rearGuardStandingOrderForUnit(unit.type, baseStandingOrder, structures, frontlineSegments)
        : plannedReserveUnitIds.has(unit.id)
          ? reserveStandingOrderForUnit(unit.type, baseStandingOrder, structures, frontlineSegments, reserveDoctrine)
          : baseStandingOrder;
      const commandStandingOrder = officerProfile
        ? {
            ...standingOrder,
            controlRadius:
              standingOrder.controlRadius +
              officerProfile.controlRadiusBonus +
              (divisionProfile?.controlRadiusBonus ?? 0) +
              tacticalLessonProfile.controlRadiusBonus,
            fallback: {
              ...standingOrder.fallback,
              moraleBelow:
                standingOrder.fallback.moraleBelow !== undefined
                  ? clamp(
                      standingOrder.fallback.moraleBelow +
                        officerProfile.fallbackMoraleModifier +
                        tacticalLessonProfile.fallbackMoraleModifier,
                      12,
                      80,
                    )
                  : standingOrder.fallback.moraleBelow,
            },
          }
        : {
            ...standingOrder,
            controlRadius: standingOrder.controlRadius + tacticalLessonProfile.controlRadiusBonus,
            fallback: {
              ...standingOrder.fallback,
              moraleBelow:
                standingOrder.fallback.moraleBelow !== undefined
                  ? clamp(standingOrder.fallback.moraleBelow + tacticalLessonProfile.fallbackMoraleModifier, 12, 80)
                  : standingOrder.fallback.moraleBelow,
            },
          };
      const position = savedTemplate || plannedReserveUnitIds.has(unit.id) || plannedRearGuardUnitIds.has(unit.id)
        ? standingOrder.anchor
        : defaultPosition;
      const order = unit.type === "engineer" ? "build" : "hold";
      return {
        unitId: unit.id,
        name: unit.name,
        type: unit.type,
        soldiers: unit.soldiers,
        maxSoldiers: unit.maxSoldiers,
        morale: clamp(unit.morale + (officerProfile?.moraleBonus ?? 0) + (divisionProfile?.moraleBonus ?? 0), 0, 100),
        condition: clamp(unit.condition + (officerProfile?.conditionBonus ?? 0), 0, 100),
        ammo: clamp(unit.ammo + (officerProfile?.ammoBonus ?? 0), 0, 100),
        weaponKey,
        weaponQuality: unit.weaponQuality,
        officerId: unit.officerId,
        officerName: officer ? `${officer.name}` : undefined,
        officerCommandSummary: officerCommandSummary(officerProfile),
        tacticalLessonSummary: tacticalLessonProfile.summary,
        tacticalLessonPreferredDoctrineId: tacticalLessonProfile.preferredDoctrineId,
        tacticalLessonPreferredDoctrineLabel: tacticalLessonProfile.preferredDoctrineLabel,
        divisionName: unitDivision?.name,
        divisionCommanderOfficerId: divisionCommander?.id,
        divisionCommanderName: divisionCommander?.name,
        divisionCommandSummary: divisionProfile?.summary,
        deploymentMitigationRole,
        frontlineRotationRole: plannedRearGuardUnitIds.has(unit.id) ? "rear_guard_cover" : undefined,
        order,
        casualtiesThisBattle: 0,
        xpGained: 0,
        position,
        range: Math.round(weapon.range * (officerProfile?.rangeMultiplier ?? 1)),
        firepower: Number((weapon.firepower * (officerProfile?.firepowerMultiplier ?? 1)).toFixed(2)),
        fireRate: Number((weapon.fireRate * (officerProfile?.fireRateMultiplier ?? 1)).toFixed(2)),
        weaponName: weapon.name,
        formation: createFormationForUnit(
          unit.type,
          unit.soldiers,
          unit.maxSoldiers,
          commandStandingOrder.posture,
          order,
          commandStandingOrder.facingDeg,
	        ),
	        standingOrder: commandStandingOrder,
	        reserveReadiness: clamp(
            initialReserveReadiness(unit.type, commandStandingOrder, reserveDoctrine) +
              (officerProfile?.reserveReadinessBonus ?? 0) +
              (divisionProfile?.reserveReadinessBonus ?? 0) +
              headquartersProfile.reserveReadinessBonus +
              tacticalLessonProfile.reserveReadinessBonus,
            0,
            100,
          ),
	        actionReason: savedTemplate || plannedRearGuardUnitIds.has(unit.id)
            ? "holding_anchor"
            : unit.type === "engineer"
              ? "moving_to_repair"
              : "holding_anchor",
	        lastDamageDealt: 0,
	        isMoving: false,
      };
      }),
  );
  const withdrawalRearGuardPlanAssessments = playerUnits
    .filter((unit) => plannedRearGuardUnitIds.has(unit.unitId))
    .map((unit) => withdrawalRearGuardPlanAssessmentForUnit(unit, scenario));

  return {
    scenario,
    elapsedSeconds: 0,
    speed: 1,
    status: "ready",
    mapBounds: defaultBattleMapBounds,
    frontlineSegments,
    frontlineGeometry,
    terrainZones,
    chokePoints,
    playerUnits,
    enemyUnits: [],
    structures,
    objectiveNodes,
    engagements: [],
    fireDiscipline,
    strategicDoctrine,
    reserveDoctrine,
    staffAdvisoryResponses: [],
    staffAccountabilityContext,
    withdrawalRearGuardPlanAssessments,
    wavesSpawned: 0,
    log: [
      `火力規律: ${fireDiscipline.label}（${fireDiscipline.summary}）。`,
      `参謀支援: ${strategicDoctrine.label}（${strategicDoctrine.summary}）。`,
      `予備運用: ${reserveDoctrine.notes}`,
      ...(playerUnits.some((unit) => unit.tacticalLessonSummary && unit.tacticalLessonSummary !== "戦術教訓なし")
        ? [
            `戦術教訓: ${playerUnits
              .filter((unit) => unit.tacticalLessonSummary && unit.tacticalLessonSummary !== "戦術教訓なし")
              .slice(0, 3)
              .map((unit) => `${unit.name} ${unit.tacticalLessonSummary}`)
              .join(" / ")}。`,
          ]
        : []),
      `敵波予測: ${scenario.waveIntel.summary}。`,
      ...(scenario.waveIntel.surpriseSummary ? [`敵情警告: ${scenario.waveIntel.surpriseSummary}。`] : []),
      ...(scenario.tacticalTerrainProfileSummary ? [`戦術地形: ${scenario.tacticalTerrainProfileSummary}`] : []),
      ...(playerUnits.some((unit) => standingOrderTemplates.some((template) => template.createdFromUnitId === unit.unitId))
        ? ["保存済み自律指揮方針を投入部隊へ適用。"]
        : []),
      ...(frontlineGeometry ? [`出撃戦線を${frontlineGeometry.label}で展開。`] : []),
      ...(plannedReserveUnitIds.size > 0 ? [`指定予備: ${plannedReserveUnitIds.size}旅団を予備線で待機。`] : []),
      ...(plannedRearGuardUnitIds.size > 0 ? [`撤退後衛計画: ${plannedRearGuardUnitIds.size}旅団を離脱援護に指定。`] : []),
      ...(withdrawalRearGuardPlanAssessments.length > 0
        ? [
            `後衛予測: ${withdrawalRearGuardPlanAssessments
              .map(
                (entry) =>
                  `${entry.unitName} 損耗${entry.predictedCasualties}/将校危険${entry.predictedOfficerRisk}/抑止${entry.pursuitCover}`,
              )
              .join("、")}。`,
          ]
        : []),
      `戦術目標: 勝利地点・補給点・視界点を戦闘目標として設定。`,
      `目標地形: ${objectiveNodes.map((node) => `${node.label}/${node.scenario.label}`).join("、")}。`,
      `${scenario.sectorName}で${scenario.title}の配置を完了。`,
    ],
    objectiveState: {
      holdSecondsRequired: scenario.durationSeconds,
      lineIntegrity: 100,
      enemySuppression: 0,
      victoryControl: objectiveNodes.find((node) => node.type === "victory")?.controlProgress ?? 70,
      supplyControl: objectiveNodes.find((node) => node.type === "supply")?.controlProgress ?? 70,
      visibilityControl: objectiveNodes.find((node) => node.type === "visibility")?.controlProgress ?? 50,
      objectivePressure: 0,
      tacticalEffects: {
        victoryLineIntegrityModifier: 0,
        supplyAmmoRecoveryModifier: 0,
        fireMissionAmmoMultiplier: 1,
        visibilitySpottingBonus: 0,
        visibilitySuppressionBonus: 0,
        eventLineIntegrityModifier: 0,
        eventAmmoRecoveryModifier: 0,
        eventSpottingModifier: 0,
        waveIntelClarity: "strained",
        waveIntelLabel: "敵波推定",
        eventSummary: "安定",
        summary: "戦術目標効果: 初期評価中",
      },
    },
  };
};
