import type { UnitOrder } from "../army/types";
import { fireDisciplineWithDefaults } from "../doctrine/applyDoctrine";
import type {
  BattleObjectiveNode,
  BattlePosition,
  BattleState,
  BattleStructure,
  FacilityAssignmentMode,
  FireMissionScope,
  FrontlineSegment,
  ObjectiveResponseRole,
  StandingOrder,
  StandingOrderTemplate,
  StandingPosture,
  TargetPriority,
  AmmoPolicy,
} from "./types";
import { defaultFormationFacingForSegment, formationFacingDisplayLabel, normalizeFormationFacingDeg } from "./formations";
import { compactSketchPoints, maxFrontlineSketchPoints } from "./sketchLines";

const orderLabel = (order: UnitOrder) => {
  const labels: Record<UnitOrder, string> = {
    hold: "保持",
    advance: "前進",
    flank: "側面機動",
    rest: "休息/補給",
    build: "築城/修理",
    retreat: "後退",
  };
  return labels[order];
};

const targetPriorityLabel = (priority: TargetPriority) => {
  const labels: Record<TargetPriority, string> = {
    nearest: "最接近",
    brute: "大型敵",
    officer: "敵指揮",
    riflemen: "敵銃兵",
    largest_mass: "最大集団",
    weakest: "弱敵",
  };
  return labels[priority];
};

const ammoPolicyLabel = (policy: AmmoPolicy) => {
  const labels: Record<AmmoPolicy, string> = {
    normal: "通常射撃",
    conserve: "弾薬節約",
    intense: "集中射撃",
  };
  return labels[policy];
};

const structureLabel = (type: BattleState["structures"][number]["type"]) => {
  const labels: Record<BattleState["structures"][number]["type"], string> = {
    trench: "塹壕線",
    barricade: "バリケード",
    supplyDepot: "補給所",
    observationPost: "観測所",
    fieldHospital: "野戦病院",
  };
  return labels[type];
};

const enemyLabel = (enemy: BattleState["enemyUnits"][number]) => {
  const labels: Record<BattleState["enemyUnits"][number]["type"], string> = {
    undeadMob: "アンデッド群集",
    undeadRiflemen: "アンデッド銃兵",
    brute: "大型破砕体",
    undeadOfficer: "敵指揮体",
  };
  return labels[enemy.type];
};

const fireMissionScopeLabel = (scope: FireMissionScope) => {
  const labels: Record<FireMissionScope, string> = {
    selected_unit: "旅団斉射",
    frontline_segment: "戦線斉射",
  };
  return labels[scope];
};

const fireDisciplineForState = (state: BattleState) => fireDisciplineWithDefaults(state.fireDiscipline);

const fireMissionDurationSeconds = (state: BattleState, scope: FireMissionScope) =>
  (scope === "selected_unit" ? 8 : 7) + fireDisciplineForState(state).durationBonusSeconds;

const fireMissionCooldownSeconds = (state: BattleState, scope: FireMissionScope) =>
  Math.max(8, (scope === "selected_unit" ? 16 : 20) - fireDisciplineForState(state).cooldownReductionSeconds);

const fireMissionMultipliers = (state: BattleState, scope: FireMissionScope) => {
  const fireDiscipline = fireDisciplineForState(state);
  const objectiveAmmoMultiplier = state.objectiveState.tacticalEffects?.fireMissionAmmoMultiplier ?? 1;
  return {
    fireMultiplier: (scope === "selected_unit" ? 1.55 : 1.32) + fireDiscipline.fireMultiplierBonus,
    ammoMultiplier: (scope === "selected_unit" ? 1.72 : 1.54) * fireDiscipline.ammoCostMultiplier * objectiveAmmoMultiplier,
    conditionCost: (scope === "selected_unit" ? 0.18 : 0.14) * fireDiscipline.conditionCostMultiplier,
  };
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const clampPosition = (state: BattleState, position: BattlePosition): BattlePosition => ({
  x: clamp(position.x, 4, state.mapBounds.width - 4),
  y: clamp(position.y, 6, state.mapBounds.height - 6),
});

const clampSegmentZone = (
  state: BattleState,
  zone: FrontlineSegment["zone"],
): FrontlineSegment["zone"] => {
  const width = clamp(zone.width, 8, Math.max(8, state.mapBounds.width - 8));
  const height = clamp(zone.height, 8, Math.max(8, state.mapBounds.height - 8));
  return {
    x: clamp(zone.x, 0, Math.max(0, state.mapBounds.width - width)),
    y: clamp(zone.y, 0, Math.max(0, state.mapBounds.height - height)),
    width,
    height,
  };
};

const translatePoint = (point: BattlePosition, delta: BattlePosition): BattlePosition => ({
  x: point.x + delta.x,
  y: point.y + delta.y,
});

const samePoint = (a: BattlePosition, b: BattlePosition): boolean =>
  Math.round(a.x * 10) === Math.round(b.x * 10) && Math.round(a.y * 10) === Math.round(b.y * 10);

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

export type CommandTransmissionIntensity = "minor" | "standard" | "major";

export interface CommandTransmissionReport {
  delaySeconds: number;
  label: string;
  detail: string;
  reasons: string[];
  penaltySummary: string;
}

export interface CommandCongestionReport {
  commandCount: number;
  capacity: number;
  delayPenaltySeconds: number;
  label: string;
  detail: string;
  reasons: string[];
}

const nearestEnemyDistance = (state: BattleState, position: BattlePosition): number =>
  state.enemyUnits
    .filter((enemy) => enemy.count > 0 && enemy.isSpotted)
    .reduce((minimum, enemy) => Math.min(minimum, distance(position, enemy.position)), Number.POSITIVE_INFINITY);

const commandTransmissionIntensityLabel = (intensity: CommandTransmissionIntensity): string => {
  const labels: Record<CommandTransmissionIntensity, string> = {
    minor: "小命令",
    standard: "標準命令",
    major: "大命令",
  };
  return labels[intensity];
};

export const commandTransmissionReport = (
  state: BattleState,
  unit: BattleState["playerUnits"][number],
  intensity: CommandTransmissionIntensity,
): CommandTransmissionReport => {
  const baseDelay = intensity === "major" ? 5 : intensity === "standard" ? 3 : 2;
  const enemyDistance = nearestEnemyDistance(state, unit.position);
  const pressureDelay = enemyDistance <= 16 ? 3 : enemyDistance <= 30 ? 2 : enemyDistance <= 44 ? 1 : 0;
  const readinessDelay = unit.reserveReadiness < 32 ? 2 : unit.reserveReadiness < 58 ? 1 : 0;
  const moraleDelay = unit.morale < 42 ? 2 : unit.morale < 62 ? 1 : 0;
  const movementDelay = unit.isMoving ? 1 : 0;
  const commanderDelay = unit.officerCommandSummary?.includes("指揮過負荷") ? 2 : 0;
  const commandDoctrineReduction =
    state.strategicDoctrine?.activeDoctrineIds.includes("command") ||
    state.fireDiscipline?.activeDoctrineIds.includes("command")
      ? 1
      : 0;
  const organizationReduction = state.strategicDoctrine?.activeDoctrineIds.includes("organization") ? 1 : 0;
  const rawDelay =
    baseDelay +
    pressureDelay +
    readinessDelay +
    moraleDelay +
    movementDelay +
    commanderDelay -
    commandDoctrineReduction -
    organizationReduction;
  const delaySeconds = clamp(rawDelay, 1, 12);
  const reasons = [
    `${commandTransmissionIntensityLabel(intensity)} 基礎${baseDelay}秒`,
    pressureDelay > 0
      ? `接敵${Number.isFinite(enemyDistance) ? Math.round(enemyDistance) : "不明"}で+${pressureDelay}秒`
      : "接敵余裕",
    readinessDelay > 0 ? `即応${Math.round(unit.reserveReadiness ?? 0)}で+${readinessDelay}秒` : "即応良好",
    moraleDelay > 0 ? `士気${Math.round(unit.morale)}で+${moraleDelay}秒` : "士気安定",
    movementDelay > 0 ? "移動中+1秒" : undefined,
    commanderDelay > 0 ? "指揮過負荷+2秒" : undefined,
    commandDoctrineReduction > 0 ? "指揮幕僚-1秒" : undefined,
    organizationReduction > 0 ? "軍団編制-1秒" : undefined,
  ].filter(Boolean) as string[];
  return {
    delaySeconds,
    label: `伝令予測 ${delaySeconds}秒`,
    detail: reasons.join(" / "),
    reasons,
    penaltySummary: "到達まで移動0.62倍 / 射撃0.84倍",
  };
};

export const commandCongestionReport = (state: BattleState, commandCount: number): CommandCongestionReport => {
  const commandDoctrineBonus =
    state.strategicDoctrine?.activeDoctrineIds.includes("command") ||
    state.fireDiscipline?.activeDoctrineIds.includes("command")
      ? 1
      : 0;
  const organizationBonus = state.strategicDoctrine?.activeDoctrineIds.includes("organization") ? 1 : 0;
  const capacity = 2 + commandDoctrineBonus + organizationBonus;
  const overload = Math.max(0, commandCount - capacity);
  const delayPenaltySeconds = overload <= 0 ? 0 : clamp(Math.ceil(overload / 2), 1, 4);
  const reasons = [
    `一括${commandCount}件`,
    `処理容量${capacity}`,
    commandDoctrineBonus > 0 ? "指揮幕僚+1" : undefined,
    organizationBonus > 0 ? "軍団編制+1" : undefined,
    delayPenaltySeconds > 0 ? `混線+${delayPenaltySeconds}秒` : "混線なし",
  ].filter(Boolean) as string[];
  return {
    commandCount,
    capacity,
    delayPenaltySeconds,
    label: delayPenaltySeconds > 0 ? `一括混線 +${delayPenaltySeconds}秒` : "一括混線なし",
    detail: reasons.join(" / "),
    reasons,
  };
};

export const applyCommandCongestionToPendingOrders = (
  state: BattleState,
  commandCount: number,
  issuedAt: number,
): BattleState => {
  const report = commandCongestionReport(state, commandCount);
  if (report.delayPenaltySeconds <= 0) {
    return state;
  }
  return {
    ...state,
    playerUnits: state.playerUnits.map((unit) =>
      unit.pendingOrder && Math.abs(unit.pendingOrder.issuedAt - issuedAt) < 0.01
        ? {
            ...unit,
            pendingOrder: {
              ...unit.pendingOrder,
              reasons: [...(unit.pendingOrder.reasons ?? [unit.pendingOrder.detail]), ...report.reasons],
              arrivesAt: unit.pendingOrder.arrivesAt + report.delayPenaltySeconds,
              delaySeconds: unit.pendingOrder.delaySeconds + report.delayPenaltySeconds,
            },
          }
        : unit,
    ),
    log: [`予約指揮混線: ${report.detail}。`, ...state.log].slice(0, 12),
  };
};

const markCommandTransmission = (
  state: BattleState,
  unitId: string,
  label: string,
  detail: string,
  intensity: CommandTransmissionIntensity = "standard",
): BattleState => {
  const unit = state.playerUnits.find((candidate) => candidate.unitId === unitId);
  if (!unit || unit.soldiers <= 0) {
    return state;
  }
  const report = commandTransmissionReport(state, unit, intensity);
  return {
    ...state,
    playerUnits: state.playerUnits.map((candidate) =>
      candidate.unitId === unitId
        ? {
            ...candidate,
            pendingOrder: {
              id: `order-${state.elapsedSeconds}-${unitId}-${label}`,
              label,
              detail,
              reasons: report.reasons,
              issuedAt: state.elapsedSeconds,
              arrivesAt: state.elapsedSeconds + report.delaySeconds,
              delaySeconds: report.delaySeconds,
            },
          }
        : candidate,
    ),
  };
};

const segmentAtPosition = (state: BattleState, position: BattlePosition) =>
  state.frontlineSegments.find(
    (segment) =>
      position.x >= segment.zone.x &&
      position.x <= segment.zone.x + segment.zone.width &&
      position.y >= segment.zone.y &&
      position.y <= segment.zone.y + segment.zone.height,
  );

const fireMissionCandidateUnits = (
  state: BattleState,
  issuer: BattleState["playerUnits"][number],
  scope: FireMissionScope,
  options?: { ignoreCooldown?: boolean },
) => {
  const segmentId = issuer.standingOrder.frontlineSegmentId;
  const issuerFacilityId = issuer.standingOrder.facilityAssignment?.structureId;
  return state.playerUnits.filter((unit) => {
    if (unit.soldiers <= 0 || unit.order === "retreat") {
      return false;
    }
    if (!options?.ignoreCooldown && (unit.volleyCooldownUntilSeconds ?? 0) > state.elapsedSeconds) {
      return false;
    }
    if (scope === "selected_unit") {
      return unit.unitId === issuer.unitId;
    }
    return (
      (!!segmentId && unit.standingOrder.frontlineSegmentId === segmentId) ||
      (!!issuerFacilityId && unit.standingOrder.facilityAssignment?.structureId === issuerFacilityId)
    );
  });
};

export const setUnitOrder = (state: BattleState, unitId: string, order: UnitOrder): BattleState => markCommandTransmission({
  ...state,
  playerUnits: state.playerUnits.map((unit) =>
    unit.unitId === unitId ? { ...unit, order, actionReason: order === "retreat" ? "retreating" : unit.actionReason } : unit,
  ),
  log: [
    `${state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊"}に${orderLabel(order)}を命令。`,
    ...state.log,
  ].slice(0, 12),
}, unitId, orderLabel(order), "即時命令", order === "retreat" || order === "advance" || order === "flank" ? "major" : "minor");

export interface StandingOrderPreset {
  id: StandingPosture;
  label: string;
  targetPriority: TargetPriority;
  ammoPolicy: AmmoPolicy;
  fallbackEnabled: boolean;
  moraleBelow?: number;
  soldiersBelowRatio?: number;
}

export const standingOrderPresets: StandingOrderPreset[] = [
  {
    id: "hold_line",
    label: "固守",
    targetPriority: "nearest",
    ammoPolicy: "normal",
    fallbackEnabled: false,
  },
  {
    id: "elastic_defense",
    label: "弾性防御",
    targetPriority: "nearest",
    ammoPolicy: "conserve",
    fallbackEnabled: true,
    moraleBelow: 42,
    soldiersBelowRatio: 0.58,
  },
  {
    id: "aggressive_screen",
    label: "阻止射撃",
    targetPriority: "brute",
    ammoPolicy: "intense",
    fallbackEnabled: true,
    moraleBelow: 35,
    soldiersBelowRatio: 0.5,
  },
  {
    id: "fire_support",
    label: "火力支援",
    targetPriority: "largest_mass",
    ammoPolicy: "normal",
    fallbackEnabled: true,
    moraleBelow: 30,
    soldiersBelowRatio: 0.45,
  },
  {
    id: "engineer_support",
    label: "工兵支援",
    targetPriority: "nearest",
    ammoPolicy: "conserve",
    fallbackEnabled: true,
    moraleBelow: 38,
    soldiersBelowRatio: 0.55,
  },
  {
    id: "fallback_guard",
    label: "後退守備",
    targetPriority: "officer",
    ammoPolicy: "conserve",
    fallbackEnabled: true,
    moraleBelow: 55,
    soldiersBelowRatio: 0.72,
  },
];

const presetLabel = (presetId: StandingPosture) =>
  standingOrderPresets.find((preset) => preset.id === presetId)?.label ?? presetId;

export type FrontlineDoctrinePresetId =
  | "line_hold"
  | "elastic_refuse"
  | "kill_zone"
  | "ammo_delay"
  | "engineer_repair";

export interface FrontlineDoctrinePreset {
  id: FrontlineDoctrinePresetId;
  label: string;
  summary: string;
  posture: StandingPosture;
  targetPriority: TargetPriority;
  ammoPolicy: AmmoPolicy;
  order: UnitOrder;
  fallbackEnabled: boolean;
  moraleBelow?: number;
  soldiersBelowRatio?: number;
  preferDamagedFacility?: boolean;
}

export const frontlineDoctrinePresets: FrontlineDoctrinePreset[] = [
  {
    id: "line_hold",
    label: "戦線固守",
    summary: "現戦線を維持し、最接近敵を通常射撃で削る。",
    posture: "hold_line",
    targetPriority: "nearest",
    ammoPolicy: "normal",
    order: "hold",
    fallbackEnabled: false,
  },
  {
    id: "elastic_refuse",
    label: "弾性拒止",
    summary: "弾薬を節約しつつ、士気/兵力低下で後退線へ移る。",
    posture: "elastic_defense",
    targetPriority: "nearest",
    ammoPolicy: "conserve",
    order: "hold",
    fallbackEnabled: true,
    moraleBelow: 44,
    soldiersBelowRatio: 0.62,
  },
  {
    id: "kill_zone",
    label: "殺傷地帯",
    summary: "大型/密集敵を優先し、短時間の強射で突破前に止める。",
    posture: "aggressive_screen",
    targetPriority: "largest_mass",
    ammoPolicy: "intense",
    order: "hold",
    fallbackEnabled: true,
    moraleBelow: 34,
    soldiersBelowRatio: 0.5,
  },
  {
    id: "ammo_delay",
    label: "遅滞節約",
    summary: "弾薬を温存し、陣地から離れず敵の接近を待つ。",
    posture: "fallback_guard",
    targetPriority: "officer",
    ammoPolicy: "conserve",
    order: "hold",
    fallbackEnabled: true,
    moraleBelow: 54,
    soldiersBelowRatio: 0.72,
  },
  {
    id: "engineer_repair",
    label: "工兵修理線",
    summary: "工兵を損傷施設へ寄せ、非工兵は施設防衛を優先する。",
    posture: "engineer_support",
    targetPriority: "nearest",
    ammoPolicy: "conserve",
    order: "build",
    fallbackEnabled: true,
    moraleBelow: 38,
    soldiersBelowRatio: 0.58,
    preferDamagedFacility: true,
  },
];

const withUnitStandingOrder = (
  state: BattleState,
  unitId: string,
  update: (standingOrder: StandingOrder) => StandingOrder,
): BattleState => ({
  ...state,
  playerUnits: state.playerUnits.map((unit) => {
    if (unit.unitId !== unitId) {
      return unit;
    }
    const standingOrder = update(unit.standingOrder);
    return {
      ...unit,
      standingOrder,
      formation: {
        ...unit.formation,
        facingDeg: normalizeFormationFacingDeg(standingOrder.facingDeg ?? unit.formation.facingDeg),
      },
    };
  }),
});

export const assignFrontlineSegment = (state: BattleState, unitId: string, segmentId: string): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  const unit = state.playerUnits.find((candidate) => candidate.unitId === unitId);
  const unitName = unit?.name ?? "部隊";
  if (!segment) {
    return state;
  }
  return markCommandTransmission({
    ...withUnitStandingOrder(state, unitId, (standingOrder) => ({
      ...standingOrder,
      anchor: segment.anchor,
      controlRadius: segment.controlRadius,
      frontlineSegmentId: segment.id,
      facingDeg: defaultFormationFacingForSegment(segment.id, unit?.type),
      fallback: {
        ...standingOrder.fallback,
        destination: segment.fallbackPoint,
      },
    })),
    log: [`${unitName}を${segment.name}へ配置転換。`, ...state.log].slice(0, 12),
  }, unitId, `戦線 ${segment.name}`, "担当戦線変更", "major");
};

const structureInsideSegment = (structure: BattleState["structures"][number], segment: FrontlineSegment): boolean =>
  structure.position.x >= segment.zone.x &&
  structure.position.x <= segment.zone.x + segment.zone.width &&
  structure.position.y >= segment.zone.y &&
  structure.position.y <= segment.zone.y + segment.zone.height;

const facilityForFrontlineDoctrine = (
  state: BattleState,
  segment: FrontlineSegment,
  unit: BattleState["playerUnits"][number],
) => {
  const localStructures = state.structures.filter((structure) => structureInsideSegment(structure, segment));
  const damagedLocal = localStructures.find((structure) => structure.status === "damaged" || structure.status === "overrun");
  const supplyLocal = localStructures.find((structure) => structure.type === "supplyDepot");
  const nearestLocal = [...localStructures].sort(
    (a, b) =>
      Math.abs(a.position.x - unit.position.x) +
      Math.abs(a.position.y - unit.position.y) -
      (Math.abs(b.position.x - unit.position.x) + Math.abs(b.position.y - unit.position.y)),
  )[0];

  if (unit.type === "engineer") {
    return damagedLocal ?? nearestLocal;
  }
  if (supplyLocal && unit.ammo < 45) {
    return supplyLocal;
  }
  return nearestLocal;
};

export const applyFrontlineDoctrinePreset = (
  state: BattleState,
  segmentId: string,
  presetId: FrontlineDoctrinePresetId,
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  const preset = frontlineDoctrinePresets.find((candidate) => candidate.id === presetId);
  if (!segment || !preset) {
    return state;
  }

  const unitIds = new Set(
    state.playerUnits
      .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.standingOrder.frontlineSegmentId === segment.id)
      .map((unit) => unit.unitId),
  );
  if (unitIds.size === 0) {
    return {
      ...state,
      log: [`${segment.name}には一括指揮できる守備旅団がいない。`, ...state.log].slice(0, 12),
    };
  }

  return {
    ...state,
    playerUnits: state.playerUnits.map((unit) => {
      if (!unitIds.has(unit.unitId)) {
        return unit;
      }
      const facility = preset.preferDamagedFacility ? facilityForFrontlineDoctrine(state, segment, unit) : undefined;
      const isEngineerRepair = preset.id === "engineer_repair" && unit.type === "engineer";
      return {
        ...unit,
        order: isEngineerRepair ? "build" : preset.order,
        actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "awaiting_orders",
        standingOrder: {
          ...unit.standingOrder,
          anchor: facility?.position ?? segment.anchor,
          controlRadius: segment.controlRadius,
          frontlineSegmentId: segment.id,
          posture: isEngineerRepair ? "engineer_support" : preset.id === "engineer_repair" ? "hold_line" : preset.posture,
          targetPriority: preset.targetPriority,
          ammoPolicy: preset.ammoPolicy,
          fallback: {
            ...unit.standingOrder.fallback,
            enabled: preset.fallbackEnabled,
            moraleBelow: preset.moraleBelow ?? unit.standingOrder.fallback.moraleBelow,
            soldiersBelowRatio: preset.soldiersBelowRatio ?? unit.standingOrder.fallback.soldiersBelowRatio,
            destination: segment.fallbackPoint,
          },
          facilityAssignment: facility
            ? {
                structureId: facility.id,
                mode: unit.type === "engineer" && (facility.status === "damaged" || facility.status === "overrun")
                  ? "repair"
                  : facility.type === "supplyDepot"
                    ? "resupply"
                    : "defend",
              }
            : preset.id === "engineer_repair"
              ? unit.standingOrder.facilityAssignment
              : unit.standingOrder.facilityAssignment,
        },
      };
    }),
    log: [`戦線一括指揮: ${segment.name}の${unitIds.size}旅団へ${preset.label}を適用。`, ...state.log].slice(0, 12),
  };
};

export const returnUnitToReserveLine = (
  state: BattleState,
  unitId: string,
  options: { posture?: StandingPosture; readinessFloor?: number } = {},
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === "reserve-line");
  const unit = state.playerUnits.find((candidate) => candidate.unitId === unitId);
  if (!segment || !unit) {
    return state;
  }
  const supplyDepot = state.structures.find((structure) => structure.type === "supplyDepot");
  const posture = options.posture ?? (unit.type === "artillery" ? "fire_support" : "fallback_guard");
  const targetPriority: TargetPriority = posture === "fire_support" ? "largest_mass" : "officer";
  const readinessFloor = options.readinessFloor ?? 52;

  return {
    ...state,
    playerUnits: state.playerUnits.map((candidate) =>
      candidate.unitId === unitId
        ? {
            ...candidate,
            order: "hold",
            focusTargetId: undefined,
            actionReason: candidate.actionReason === "destroyed" ? candidate.actionReason : "returning_anchor",
            reserveReadiness: Math.max(candidate.reserveReadiness ?? 0, readinessFloor),
            standingOrder: {
              ...candidate.standingOrder,
              anchor: { ...segment.anchor },
              controlRadius: segment.controlRadius,
              frontlineSegmentId: segment.id,
              facingDeg: defaultFormationFacingForSegment(segment.id, candidate.type),
              posture,
              targetPriority,
              ammoPolicy: "conserve",
              fallback: {
                ...candidate.standingOrder.fallback,
                enabled: candidate.type !== "artillery",
                destination: { ...segment.fallbackPoint },
              },
              facilityAssignment: supplyDepot
                ? {
                    structureId: supplyDepot.id,
                    mode: "resupply",
                  }
                : undefined,
            },
          }
        : candidate,
    ),
    log: [`${unit.name}を予備線へ復帰。${presetLabel(posture)}で即応を再建する。`, ...state.log].slice(0, 12),
  };
};

const objectiveResponseLabel = (node: BattleObjectiveNode): string => {
  if (node.type === "victory") {
    return node.control === "enemy" ? "勝利点奪回" : "勝利点保持";
  }
  if (node.type === "supply") {
    return node.control === "enemy" ? "補給点奪回" : "補給点防衛";
  }
  return node.control === "enemy" ? "視界点奪回" : "視界点確保";
};

export interface ObjectiveResponseTacticalProfile {
  actionLabel: string;
  intentLabel: string;
  detail: string;
  posture: StandingPosture;
  targetPriority: TargetPriority;
  ammoPolicy: AmmoPolicy;
  fallbackMorale: number;
  fallbackSoldierRatio: number;
  controlRadiusBonus: number;
  reserveReadinessCost: number;
  engineerOrder?: UnitOrder;
  facilityMode?: FacilityAssignmentMode;
}

export const objectiveResponseTacticalProfile = (
  node: BattleObjectiveNode,
  structures: BattleStructure[] = [],
): ObjectiveResponseTacticalProfile => {
  const baseLabel = objectiveResponseLabel(node);
  const isCritical = node.eventState.severity === "critical";
  const isEnemyHeld = node.control === "enemy";
  const activeSupplyDepot = structures
    .filter((structure) => structure.type === "supplyDepot" && structure.status !== "abandoned")
    .sort((a, b) => distance(a.position, node.position) - distance(b.position, node.position))[0];
  const supplyNeedsRepair =
    activeSupplyDepot && (activeSupplyDepot.status === "damaged" || activeSupplyDepot.status === "overrun");

  if (node.type === "victory") {
    const posture: StandingPosture = isEnemyHeld || isCritical ? "aggressive_screen" : "hold_line";
    const targetPriority: TargetPriority = isCritical ? "officer" : isEnemyHeld ? "largest_mass" : "nearest";
    return {
      actionLabel: isCritical ? `${baseLabel}・指揮線奪回` : baseLabel,
      intentLabel: isCritical ? "指揮線奪回" : isEnemyHeld ? "勝利点反撃" : "主線保持",
      detail: isCritical
        ? "指揮信号途絶を止めるため、敵指揮核か最大圧力を強く叩いて主抵抗線を戻す。"
        : isEnemyHeld
          ? "勝利地点を失ったため、近接戦力を前に出して最大集団を押し返す。"
          : "勝利地点周辺を固め、無理な弾薬消費を避けて主線を維持する。",
      posture,
      targetPriority,
      ammoPolicy: isEnemyHeld || isCritical ? "intense" : "normal",
      fallbackMorale: isCritical ? 32 : isEnemyHeld ? 36 : 46,
      fallbackSoldierRatio: isCritical ? 0.46 : isEnemyHeld ? 0.5 : 0.58,
      controlRadiusBonus: isCritical ? 14 : isEnemyHeld ? 10 : 6,
      reserveReadinessCost: isCritical ? 34 : isEnemyHeld ? 28 : 18,
    };
  }

  if (node.type === "supply") {
    return {
      actionLabel: isCritical ? `${baseLabel}・補給火消し` : baseLabel,
      intentLabel: supplyNeedsRepair ? "補給所修理" : isCritical ? "補給火消し" : "補給線保持",
      detail: supplyNeedsRepair
        ? "損傷した補給所へ工兵を寄せ、他部隊は弾薬節約で周辺を守る。"
        : isCritical
          ? "炎上した補給点を守り、補給回復が戻るまで弾薬消費を抑える。"
          : "補給線周辺を守り、補給・休息が途切れない距離に部隊を置く。",
      posture: supplyNeedsRepair ? "engineer_support" : "fallback_guard",
      targetPriority: isCritical ? "riflemen" : "nearest",
      ammoPolicy: "conserve",
      fallbackMorale: isCritical ? 58 : 52,
      fallbackSoldierRatio: isCritical ? 0.72 : 0.68,
      controlRadiusBonus: isCritical ? 10 : 7,
      reserveReadinessCost: isCritical ? 22 : 16,
      engineerOrder: supplyNeedsRepair ? "build" : "hold",
      facilityMode: supplyNeedsRepair ? "repair" : "resupply",
    };
  }

  const posture: StandingPosture = isEnemyHeld || isCritical ? "aggressive_screen" : "elastic_defense";
  return {
    actionLabel: isCritical ? `${baseLabel}・観測復旧` : baseLabel,
    intentLabel: isCritical ? "観測復旧" : isEnemyHeld ? "視界奪回" : "観測線保持",
    detail: isCritical
      ? "観測点沈黙を解くため、敵指揮と銃兵を優先して視界線を押し戻す。"
      : isEnemyHeld
        ? "視界地点を奪回し、敵波判読を戻すために散兵的に前へ出る。"
        : "観測線を維持し、敵指揮と銃兵の接近を早めに止める。",
    posture,
    targetPriority: isCritical ? "officer" : isEnemyHeld ? "riflemen" : "officer",
    ammoPolicy: isCritical ? "normal" : "conserve",
    fallbackMorale: isCritical ? 42 : 48,
    fallbackSoldierRatio: isCritical ? 0.56 : 0.62,
    controlRadiusBonus: isCritical ? 16 : 10,
    reserveReadinessCost: isCritical ? 28 : 18,
  };
};

const nearestSegmentToObjective = (state: BattleState, node: BattleObjectiveNode): FrontlineSegment | undefined =>
  [...state.frontlineSegments].sort((a, b) => distance(a.anchor, node.position) - distance(b.anchor, node.position))[0];

const objectiveResponsePosture = (node: BattleObjectiveNode): StandingPosture => {
  if (node.type === "supply") {
    return "fallback_guard";
  }
  if (node.type === "visibility") {
    return node.control === "enemy" ? "aggressive_screen" : "elastic_defense";
  }
  return node.control === "enemy" ? "aggressive_screen" : "hold_line";
};

const objectiveResponseTargetPriority = (node: BattleObjectiveNode): TargetPriority => {
  if (node.type === "visibility") {
    return "officer";
  }
  if (node.type === "victory" && node.control === "enemy") {
    return "largest_mass";
  }
  return "nearest";
};

const objectiveResponseAmmoPolicy = (node: BattleObjectiveNode): AmmoPolicy => {
  if (node.type === "victory" && node.control === "enemy") {
    return "intense";
  }
  return node.type === "supply" ? "conserve" : "normal";
};

const objectiveResponseRole = (node: BattleObjectiveNode): ObjectiveResponseRole => {
  if (node.type === "victory") {
    return node.control === "enemy" ? "victory_retake" : "victory_hold";
  }
  if (node.type === "supply") {
    return node.control === "enemy" ? "supply_retake" : "supply_defense";
  }
  return node.control === "enemy" ? "visibility_retake" : "visibility_secure";
};

const objectiveResponseUnits = (
  state: BattleState,
  node: BattleObjectiveNode,
  segment: FrontlineSegment | undefined,
): BattleState["playerUnits"] => {
  const living = state.playerUnits.filter((unit) => unit.soldiers > 0 && unit.order !== "retreat");
  const defenders = living.filter((unit) => segment && unit.standingOrder.frontlineSegmentId === segment.id);
  const reserves = living.filter(
    (unit) =>
      unit.standingOrder.frontlineSegmentId?.includes("reserve") ||
      unit.standingOrder.posture === "fallback_guard" ||
      (unit.reserveReadiness ?? 0) >= 48,
  );
  const pool = [...defenders, ...reserves, ...living].filter(
    (unit, index, units) => units.findIndex((candidate) => candidate.unitId === unit.unitId) === index,
  );
  return pool
    .sort((a, b) => {
      const aReserveBonus = a.standingOrder.frontlineSegmentId?.includes("reserve") ? -12 : 0;
      const bReserveBonus = b.standingOrder.frontlineSegmentId?.includes("reserve") ? -12 : 0;
      return distance(a.position, node.position) + aReserveBonus - (distance(b.position, node.position) + bReserveBonus);
    })
    .slice(0, node.control === "enemy" ? 3 : 2);
};

export const applyObjectiveNodeResponse = (state: BattleState, nodeId: string): BattleState => {
  const node = state.objectiveNodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return state;
  }
  const segment = nearestSegmentToObjective(state, node);
  const units = objectiveResponseUnits(state, node, segment);
  if (units.length === 0) {
    return {
      ...state,
      log: [`${node.label}へ対応できる旅団がいない。`, ...state.log].slice(0, 12),
    };
  }
  const posture = objectiveResponsePosture(node);
  const targetPriority = objectiveResponseTargetPriority(node);
  const ammoPolicy = objectiveResponseAmmoPolicy(node);
  const tacticalProfile = objectiveResponseTacticalProfile(node, state.structures);
  const responseRole = objectiveResponseRole(node);
  const supplyDepot =
    node.type === "supply"
      ? state.structures
          .filter((structure) => structure.type === "supplyDepot" && structure.status !== "abandoned")
          .sort((a, b) => distance(a.position, node.position) - distance(b.position, node.position))[0]
      : undefined;

  return {
    ...state,
    playerUnits: state.playerUnits.map((unit) => {
      if (!units.some((candidate) => candidate.unitId === unit.unitId)) {
        return unit;
      }
      const isEngineerSupplyRepair =
        unit.type === "engineer" && supplyDepot && (supplyDepot.status === "damaged" || supplyDepot.status === "overrun");
      const profileFacilityMode = tacticalProfile.facilityMode ?? (isEngineerSupplyRepair ? "repair" : "resupply");
      return {
        ...unit,
        order: unit.type === "engineer" && tacticalProfile.engineerOrder ? tacticalProfile.engineerOrder : isEngineerSupplyRepair ? "build" : "hold",
        objectiveResponseRole: responseRole,
        focusTargetId: undefined,
        actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "returning_anchor",
        reserveReadiness: unit.standingOrder.frontlineSegmentId?.includes("reserve")
          ? Math.max(0, (unit.reserveReadiness ?? 0) - tacticalProfile.reserveReadinessCost)
          : unit.reserveReadiness,
        standingOrder: {
          ...unit.standingOrder,
          anchor: clampPosition(state, {
            x: node.position.x - (node.type === "supply" ? 5 : 8),
            y: node.position.y + (unit.type === "artillery" ? 6 : 0),
          }),
          controlRadius: Math.max(14, node.radius + tacticalProfile.controlRadiusBonus),
          frontlineSegmentId: segment?.id ?? unit.standingOrder.frontlineSegmentId,
          facingDeg: defaultFormationFacingForSegment(segment?.id, unit.type),
          posture: tacticalProfile.posture ?? posture,
          targetPriority: tacticalProfile.targetPriority ?? targetPriority,
          ammoPolicy: tacticalProfile.ammoPolicy ?? ammoPolicy,
          fallback: {
            ...unit.standingOrder.fallback,
            enabled: node.type !== "victory" || node.control === "enemy",
            moraleBelow: tacticalProfile.fallbackMorale,
            soldiersBelowRatio: tacticalProfile.fallbackSoldierRatio,
            destination: segment?.fallbackPoint ?? unit.standingOrder.fallback.destination,
          },
          facilityAssignment:
            supplyDepot && node.type === "supply"
              ? {
                  structureId: supplyDepot.id,
                  mode: profileFacilityMode,
                }
              : unit.standingOrder.facilityAssignment,
        },
      };
    }),
    log: [
      `目標対応: ${tacticalProfile.actionLabel}へ${units.length}旅団を投入。${tacticalProfile.intentLabel}。${segment ? `担当戦線 ${segment.name}。` : ""}`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const applyFrontlineObjectiveSupport = (
  state: BattleState,
  segmentId: string,
  nodeId: string,
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  const node = state.objectiveNodes.find((candidate) => candidate.id === nodeId);
  if (!segment || !node) {
    return state;
  }
  const units = state.playerUnits.filter(
    (unit) =>
      unit.soldiers > 0 &&
      unit.order !== "retreat" &&
      unit.standingOrder.frontlineSegmentId === segment.id,
  );
  if (units.length === 0) {
    return {
      ...state,
      log: [`戦線目標連携: ${segment.name}には${objectiveResponseLabel(node)}へ寄せる守備旅団がいない。`, ...state.log].slice(0, 12),
    };
  }

  const posture = objectiveResponsePosture(node);
  const targetPriority = objectiveResponseTargetPriority(node);
  const ammoPolicy = objectiveResponseAmmoPolicy(node);
  const tacticalProfile = objectiveResponseTacticalProfile(node, state.structures);
  const responseRole = objectiveResponseRole(node);
  const supplyDepot =
    node.type === "supply"
      ? state.structures
          .filter((structure) => structure.type === "supplyDepot" && structure.status !== "abandoned")
          .sort((a, b) => distance(a.position, node.position) - distance(b.position, node.position))[0]
      : undefined;

  return {
    ...state,
    playerUnits: state.playerUnits.map((unit) => {
      if (!units.some((candidate) => candidate.unitId === unit.unitId)) {
        return unit;
      }
      const isEngineerSupplyRepair =
        unit.type === "engineer" && supplyDepot && (supplyDepot.status === "damaged" || supplyDepot.status === "overrun");
      const profileFacilityMode = tacticalProfile.facilityMode ?? (isEngineerSupplyRepair ? "repair" : "resupply");
      const lateralOffset = (units.findIndex((candidate) => candidate.unitId === unit.unitId) - (units.length - 1) / 2) * 4;
      return {
        ...unit,
        order: unit.type === "engineer" && tacticalProfile.engineerOrder ? tacticalProfile.engineerOrder : isEngineerSupplyRepair ? "build" : "hold",
        objectiveResponseRole: responseRole,
        focusTargetId: undefined,
        actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "returning_anchor",
        standingOrder: {
          ...unit.standingOrder,
          anchor: clampPosition(state, {
            x: node.position.x - (node.control === "enemy" ? 4 : 8),
            y: node.position.y + lateralOffset,
          }),
          controlRadius: Math.max(segment.controlRadius, node.radius + tacticalProfile.controlRadiusBonus),
          frontlineSegmentId: segment.id,
          facingDeg: defaultFormationFacingForSegment(segment.id, unit.type),
          posture: tacticalProfile.posture ?? posture,
          targetPriority: tacticalProfile.targetPriority ?? targetPriority,
          ammoPolicy: tacticalProfile.ammoPolicy ?? ammoPolicy,
          fallback: {
            ...unit.standingOrder.fallback,
            enabled: node.type !== "victory" || node.control !== "player",
            moraleBelow: tacticalProfile.fallbackMorale,
            soldiersBelowRatio: tacticalProfile.fallbackSoldierRatio,
            destination: segment.fallbackPoint,
          },
          facilityAssignment:
            supplyDepot && node.type === "supply"
              ? {
                  structureId: supplyDepot.id,
                  mode: profileFacilityMode,
                }
              : unit.standingOrder.facilityAssignment,
        },
      };
    }),
    log: [
      `戦線目標連携: ${segment.name}の${units.length}旅団を${tacticalProfile.actionLabel}へ寄せる。${tacticalProfile.intentLabel}。`,
      ...state.log,
    ].slice(0, 12),
  };
};

const lineRotationFatigueScore = (unit: BattleState["playerUnits"][number]): number => {
  const soldierRatio = unit.maxSoldiers > 0 ? unit.soldiers / unit.maxSoldiers : 0;
  const casualtyRatio = unit.maxSoldiers > 0 ? unit.casualtiesThisBattle / unit.maxSoldiers : 0;
  return (
    unit.morale * 0.9 +
    unit.condition * 0.38 +
    unit.ammo * 0.2 +
    soldierRatio * 38 -
    casualtyRatio * 140 -
    (unit.order === "retreat" ? 40 : 0)
  );
};

const lineRotationReserveScore = (
  unit: BattleState["playerUnits"][number],
  segment: FrontlineSegment,
): number => {
  const reserveLineBonus = unit.standingOrder.frontlineSegmentId?.includes("reserve") ? 28 : 0;
  const postureBonus = unit.standingOrder.posture === "fallback_guard" || unit.standingOrder.posture === "fire_support" ? 12 : 0;
  const lineTransferPenalty =
    unit.standingOrder.frontlineSegmentId &&
    unit.standingOrder.frontlineSegmentId !== segment.id &&
    !unit.standingOrder.frontlineSegmentId.includes("reserve") &&
    unit.standingOrder.posture !== "fallback_guard" &&
    unit.standingOrder.posture !== "fire_support"
      ? 32
      : 0;
  return (
    (unit.reserveReadiness ?? 0) * 1.25 +
    reserveLineBonus +
    postureBonus +
    unit.morale * 0.24 +
    unit.condition * 0.18 -
    distance(unit.position, segment.anchor) * 0.35 -
    lineTransferPenalty
  );
};

export interface FrontlineRotationOptions {
  tiredUnitId?: string;
  reserveUnitId?: string;
}

export const applyFrontlineRotation = (
  state: BattleState,
  segmentId: string,
  options: FrontlineRotationOptions = {},
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  if (!segment) {
    return state;
  }
  const defenders = state.playerUnits
    .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.standingOrder.frontlineSegmentId === segment.id)
    .sort((a, b) => lineRotationFatigueScore(a) - lineRotationFatigueScore(b));
  const tiredUnit = defenders.find((unit) => unit.unitId === options.tiredUnitId) ?? defenders[0];
  if (!tiredUnit) {
    return {
      ...state,
      log: [`戦闘交代: ${segment.name}に交代対象の守備旅団がいない。`, ...state.log].slice(0, 12),
    };
  }
  const defenderIds = new Set(defenders.map((unit) => unit.unitId));
  const reserves = state.playerUnits
    .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && !defenderIds.has(unit.unitId))
    .sort((a, b) => lineRotationReserveScore(b, segment) - lineRotationReserveScore(a, segment));
  const reserveUnit = reserves.find((unit) => unit.unitId === options.reserveUnitId) ?? reserves[0];
  if (!reserveUnit) {
    return {
      ...state,
      log: [`戦闘交代: ${tiredUnit.name}を下げる予備がいない。`, ...state.log].slice(0, 12),
    };
  }

  return {
    ...state,
    playerUnits: state.playerUnits.map((unit) => {
      if (unit.unitId === tiredUnit.unitId) {
        return {
          ...unit,
          order: "retreat",
          frontlineRotationRole: "rotated_out",
          focusTargetId: undefined,
          actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "retreating",
          standingOrder: {
            ...unit.standingOrder,
            posture: "fallback_guard",
            targetPriority: "nearest",
            ammoPolicy: "conserve",
            fallback: {
              ...unit.standingOrder.fallback,
              enabled: true,
              moraleBelow: Math.max(unit.standingOrder.fallback.moraleBelow ?? 48, 56),
              soldiersBelowRatio: Math.max(unit.standingOrder.fallback.soldiersBelowRatio ?? 0.64, 0.7),
              destination: { ...segment.fallbackPoint },
            },
          },
        };
      }
      if (unit.unitId === reserveUnit.unitId) {
        return {
          ...unit,
          order: "hold",
          frontlineRotationRole: "rear_guard_cover",
          focusTargetId: undefined,
          actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "returning_anchor",
          reserveReadiness: Math.max(0, (unit.reserveReadiness ?? 0) - 38),
          standingOrder: {
            ...unit.standingOrder,
            anchor: { ...segment.anchor },
            controlRadius: Math.max(unit.standingOrder.controlRadius, segment.controlRadius),
            frontlineSegmentId: segment.id,
            facingDeg: defaultFormationFacingForSegment(segment.id, unit.type),
            posture: unit.type === "artillery" ? "fire_support" : "elastic_defense",
            targetPriority: unit.type === "artillery" ? "largest_mass" : "nearest",
            ammoPolicy: unit.type === "artillery" ? "normal" : "conserve",
            fallback: {
              ...unit.standingOrder.fallback,
              enabled: true,
              moraleBelow: unit.type === "artillery" ? 34 : 46,
              soldiersBelowRatio: unit.type === "artillery" ? 0.45 : 0.58,
              destination: { ...segment.fallbackPoint },
            },
          },
        };
      }
      return unit;
    }),
    log: [
      `戦闘交代: ${tiredUnit.name}を後退線へ下げ、${reserveUnit.name}が${segment.name}を引き継ぐ。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const repositionFrontlineSegment = (
  state: BattleState,
  segmentId: string,
  nextAnchorInput: BattlePosition,
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  if (!segment) {
    return state;
  }
  const nextAnchor = clampPosition(state, nextAnchorInput);
  if (samePoint(segment.anchor, nextAnchor)) {
    return state;
  }

  const delta = {
    x: nextAnchor.x - segment.anchor.x,
    y: nextAnchor.y - segment.anchor.y,
  };
  const nextFallback = clampPosition(state, translatePoint(segment.fallbackPoint, delta));
  const nextZone = clampSegmentZone(state, {
    ...segment.zone,
    x: segment.zone.x + delta.x,
    y: segment.zone.y + delta.y,
  });
  const nextSegments = state.frontlineSegments.map((candidate) =>
    candidate.id === segmentId
      ? {
          ...candidate,
          anchor: nextAnchor,
          fallbackPoint: nextFallback,
          zone: nextZone,
        }
      : candidate,
  );

  return {
    ...state,
    frontlineSegments: nextSegments,
    playerUnits: state.playerUnits.map((unit) =>
      unit.standingOrder.frontlineSegmentId === segmentId
        ? {
            ...unit,
            standingOrder: {
              ...unit.standingOrder,
              anchor: clampPosition(state, translatePoint(unit.standingOrder.anchor, delta)),
              fallback: {
                ...unit.standingOrder.fallback,
                destination: clampPosition(state, translatePoint(unit.standingOrder.fallback.destination, delta)),
              },
            },
            actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "returning_anchor",
          }
        : unit,
    ),
    log: [
      `${segment.name}をX${Math.round(nextAnchor.x)} Y${Math.round(nextAnchor.y)}へ再配置。所属旅団も新戦線へ追随。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const setFrontlineSegmentFallback = (
  state: BattleState,
  segmentId: string,
  nextFallbackInput: BattlePosition,
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  if (!segment) {
    return state;
  }
  const nextFallback = clampPosition(state, nextFallbackInput);
  return {
    ...state,
    frontlineSegments: state.frontlineSegments.map((candidate) =>
      candidate.id === segmentId ? { ...candidate, fallbackPoint: nextFallback } : candidate,
    ),
    playerUnits: state.playerUnits.map((unit) =>
      unit.standingOrder.frontlineSegmentId === segmentId
        ? {
            ...unit,
            standingOrder: {
              ...unit.standingOrder,
              fallback: {
                ...unit.standingOrder.fallback,
                enabled: true,
                destination: nextFallback,
              },
            },
          }
        : unit,
    ),
    log: [
      `${segment.name}の後退線をX${Math.round(nextFallback.x)} Y${Math.round(nextFallback.y)}へ再指定。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const sketchFrontlineSegment = (
  state: BattleState,
  segmentId: string,
  nextAnchorInput: BattlePosition,
  nextFallbackInput: BattlePosition,
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  if (!segment) {
    return state;
  }
  const nextAnchor = clampPosition(state, nextAnchorInput);
  const nextFallback = clampPosition(state, nextFallbackInput);
  const delta = {
    x: nextAnchor.x - segment.anchor.x,
    y: nextAnchor.y - segment.anchor.y,
  };
  const nextZone = clampSegmentZone(state, {
    ...segment.zone,
    x: segment.zone.x + delta.x,
    y: segment.zone.y + delta.y,
  });

  return {
    ...state,
    frontlineSegments: state.frontlineSegments.map((candidate) =>
      candidate.id === segmentId
        ? {
            ...candidate,
            anchor: nextAnchor,
            fallbackPoint: nextFallback,
            zone: nextZone,
          }
        : candidate,
    ),
    playerUnits: state.playerUnits.map((unit) =>
      unit.standingOrder.frontlineSegmentId === segmentId
        ? {
            ...unit,
            standingOrder: {
              ...unit.standingOrder,
              anchor: clampPosition(state, translatePoint(unit.standingOrder.anchor, delta)),
              fallback: {
                ...unit.standingOrder.fallback,
                enabled: true,
                destination: nextFallback,
              },
            },
            actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "returning_anchor",
          }
        : unit,
    ),
    log: [
      `${segment.name}をスケッチ更新。基準X${Math.round(nextAnchor.x)} Y${Math.round(
        nextAnchor.y,
      )} / 後退X${Math.round(nextFallback.x)} Y${Math.round(nextFallback.y)}。所属旅団は新線へ再整列。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const sketchFrontlineSegmentPolyline = (
  state: BattleState,
  segmentId: string,
  pointsInput: BattlePosition[],
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  if (!segment || pointsInput.length < 2) {
    return state;
  }
  const points = compactSketchPoints(
    pointsInput.map((point) => clampPosition(state, point)),
    maxFrontlineSketchPoints,
  );
  const [nextAnchor, nextFallback] = points;
  const linePoints = [nextAnchor, ...points.slice(2)];
  const xs = linePoints.map((point) => point.x);
  const ys = linePoints.map((point) => point.y);
  const minX = Math.min(...xs, nextAnchor.x);
  const maxX = Math.max(...xs, nextAnchor.x);
  const minY = Math.min(...ys, nextAnchor.y);
  const maxY = Math.max(...ys, nextAnchor.y);
  const delta = {
    x: nextAnchor.x - segment.anchor.x,
    y: nextAnchor.y - segment.anchor.y,
  };
  const sketchedWidth = Math.max(segment.zone.width, maxX - minX + 16);
  const sketchedHeight = Math.max(segment.zone.height, maxY - minY + 14);
  const nextZone = clampSegmentZone(state, {
    ...segment.zone,
    x: Math.min(segment.zone.x + delta.x, minX - 8),
    y: Math.min(segment.zone.y + delta.y, minY - 7),
    width: sketchedWidth,
    height: sketchedHeight,
  });
  const nextRadius = clamp(segment.controlRadius + Math.max(0, points.length - 2) * 2, 6, 28);

  return {
    ...state,
    frontlineSegments: state.frontlineSegments.map((candidate) =>
      candidate.id === segmentId
        ? {
            ...candidate,
            anchor: nextAnchor,
            fallbackPoint: nextFallback,
            sketchPoints: points,
            controlRadius: nextRadius,
            zone: nextZone,
          }
        : candidate,
    ),
    playerUnits: state.playerUnits.map((unit) =>
      unit.standingOrder.frontlineSegmentId === segmentId
        ? {
            ...unit,
            standingOrder: {
              ...unit.standingOrder,
              anchor: clampPosition(state, translatePoint(unit.standingOrder.anchor, delta)),
              controlRadius: nextRadius,
              fallback: {
                ...unit.standingOrder.fallback,
                enabled: true,
                destination: nextFallback,
              },
            },
            actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "returning_anchor",
          }
        : unit,
    ),
    log: [
      `${segment.name}を多点スケッチ更新。${points.length}点 / 基準X${Math.round(nextAnchor.x)} Y${Math.round(
        nextAnchor.y,
      )} / 後退X${Math.round(nextFallback.x)} Y${Math.round(nextFallback.y)} / 幅${Math.round(
        nextZone.width,
      )}。所属旅団は新線へ再整列。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const resizeFrontlineSegmentControl = (
  state: BattleState,
  segmentId: string,
  radiusDelta: number,
  widthDelta = 0,
): BattleState => {
  const segment = state.frontlineSegments.find((candidate) => candidate.id === segmentId);
  if (!segment) {
    return state;
  }
  const nextRadius = clamp(segment.controlRadius + radiusDelta, 6, 28);
  const nextZone = clampSegmentZone(state, {
    ...segment.zone,
    x: segment.zone.x - widthDelta / 2,
    width: segment.zone.width + widthDelta,
  });
  return {
    ...state,
    frontlineSegments: state.frontlineSegments.map((candidate) =>
      candidate.id === segmentId
        ? {
            ...candidate,
            controlRadius: nextRadius,
            zone: nextZone,
          }
        : candidate,
    ),
    playerUnits: state.playerUnits.map((unit) =>
      unit.standingOrder.frontlineSegmentId === segmentId
        ? {
            ...unit,
            standingOrder: {
              ...unit.standingOrder,
              controlRadius: nextRadius,
            },
          }
        : unit,
    ),
    log: [
      `${segment.name}の指揮半径を${Math.round(nextRadius)}、担当幅を${Math.round(nextZone.width)}へ調整。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const setStandingOrderFacing = (state: BattleState, unitId: string, facingDeg: number): BattleState => {
  const normalizedFacing = normalizeFormationFacingDeg(facingDeg);
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  return markCommandTransmission({
    ...withUnitStandingOrder(state, unitId, (standingOrder) => ({
      ...standingOrder,
      facingDeg: normalizedFacing,
    })),
    log: [`${unitName}の射界を${formationFacingDisplayLabel(normalizedFacing)}へ変更。`, ...state.log].slice(0, 12),
  }, unitId, "射界変更", formationFacingDisplayLabel(normalizedFacing), "minor");
};

export const setStandingOrderTargetPriority = (
  state: BattleState,
  unitId: string,
  targetPriority: TargetPriority,
): BattleState => {
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  return markCommandTransmission({
    ...withUnitStandingOrder(state, unitId, (standingOrder) => ({
      ...standingOrder,
      targetPriority,
    })),
    log: [`${unitName}の優先目標を${targetPriorityLabel(targetPriority)}へ変更。`, ...state.log].slice(0, 12),
  }, unitId, "優先目標", targetPriorityLabel(targetPriority), "minor");
};

export const setStandingOrderAmmoPolicy = (
  state: BattleState,
  unitId: string,
  ammoPolicy: AmmoPolicy,
): BattleState => {
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  return markCommandTransmission({
    ...withUnitStandingOrder(state, unitId, (standingOrder) => ({
      ...standingOrder,
      ammoPolicy,
    })),
    log: [`${unitName}の弾薬方針を${ammoPolicyLabel(ammoPolicy)}へ変更。`, ...state.log].slice(0, 12),
  }, unitId, "弾薬方針", ammoPolicyLabel(ammoPolicy), "minor");
};

export const setUnitFocusTarget = (state: BattleState, unitId: string, enemyId: string): BattleState => {
  const enemy = state.enemyUnits.find((candidate) => candidate.id === enemyId && candidate.count > 0);
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  if (!enemy || !enemy.isSpotted) {
    return {
      ...state,
      log: [`${unitName}は未発見または消滅した敵を指名できない。`, ...state.log].slice(0, 12),
    };
  }

  return markCommandTransmission({
    ...state,
    playerUnits: state.playerUnits.map((unit) =>
      unit.unitId === unitId
        ? {
            ...unit,
            focusTargetId: enemy.id,
          }
        : unit,
    ),
    log: [
      `${unitName}の集中射撃目標を${enemyLabel(enemy)} ${Math.round(enemy.count)}体へ指定。`,
      ...state.log,
    ].slice(0, 12),
  }, unitId, "集中射撃", enemyLabel(enemy), "standard");
};

export const clearUnitFocusTarget = (state: BattleState, unitId: string): BattleState => {
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  return markCommandTransmission({
    ...state,
    playerUnits: state.playerUnits.map((unit) =>
      unit.unitId === unitId
        ? {
            ...unit,
            focusTargetId: undefined,
          }
        : unit,
    ),
    log: [`${unitName}の集中射撃指定を解除。`, ...state.log].slice(0, 12),
  }, unitId, "指名解除", "集中射撃解除", "minor");
};

export const issueFireMission = (
  state: BattleState,
  unitId: string,
  scope: FireMissionScope,
): BattleState => {
  const issuer = state.playerUnits.find((unit) => unit.unitId === unitId);
  const fireDiscipline = fireDisciplineForState(state);
  const targetId = issuer?.focusTargetId ?? issuer?.currentTargetId;
  const target = targetId ? state.enemyUnits.find((enemy) => enemy.id === targetId && enemy.count > 0) : undefined;
  const scopeLabel = fireMissionScopeLabel(scope);

  if (!issuer) {
    return state;
  }
  if (!target || !target.isSpotted) {
    return {
      ...state,
      log: [`${issuer.name}は斉射目標を捕捉していない。先に敵を指名する必要がある。`, ...state.log].slice(0, 12),
    };
  }

  const candidates = fireMissionCandidateUnits(state, issuer, scope);

  if (candidates.length === 0) {
    return {
      ...state,
      log: [`${scopeLabel}を実行できる旅団がいない。再装填または後退状態を確認。`, ...state.log].slice(0, 12),
    };
  }

  const durationSeconds = fireMissionDurationSeconds(state, scope);
  const expiresAt = state.elapsedSeconds + durationSeconds;
  const missionId = `fire-${state.elapsedSeconds}-${scope}-${unitId}-${target.id}`;
  const multipliers = fireMissionMultipliers(state, scope);
  const mission = {
    id: missionId,
    targetId: target.id,
    targetName: enemyLabel(target),
    scope,
    unitIds: candidates.map((unit) => unit.unitId),
    issuedAt: state.elapsedSeconds,
    expiresAt,
    ...multipliers,
    disciplineLabel: fireDiscipline.label,
  };

  const activeMissions = (state.fireMissions ?? []).filter((candidate) => candidate.expiresAt > state.elapsedSeconds);
  return {
    ...state,
    fireMissions: [...activeMissions, mission].slice(-6),
    playerUnits: state.playerUnits.map((unit) =>
      mission.unitIds.includes(unit.unitId)
        ? {
            ...unit,
            focusTargetId: target.id,
            fireMissionId: mission.id,
            volleyUntilSeconds: expiresAt,
            volleyCooldownUntilSeconds: expiresAt + fireMissionCooldownSeconds(state, scope),
          }
        : unit,
    ),
    log: [
      `${scopeLabel}: ${candidates.length}旅団が${enemyLabel(target)} ${Math.round(target.count)}体へ${durationSeconds}秒斉射（${fireDiscipline.label}）。`,
      ...state.log,
    ].slice(0, 12),
  };
};

export interface FirePlanStageInput {
  targetId: string;
  scope: FireMissionScope;
  delaySeconds: number;
}

export const issueFirePlan = (
  state: BattleState,
  unitId: string,
  stages: FirePlanStageInput[],
): BattleState => {
  const issuer = state.playerUnits.find((unit) => unit.unitId === unitId);
  const fireDiscipline = fireDisciplineForState(state);
  if (!issuer) {
    return state;
  }
  const validStages = stages.slice(0, fireDiscipline.maxPlannedStages).flatMap((stage, index) => {
    const target = state.enemyUnits.find((enemy) => enemy.id === stage.targetId && enemy.count > 0 && enemy.isSpotted);
    if (!target) {
      return [];
    }
    const unitIds = fireMissionCandidateUnits(state, issuer, stage.scope, { ignoreCooldown: true }).map((unit) => unit.unitId);
    if (unitIds.length === 0) {
      return [];
    }
    return [
      {
        id: `stage-${index + 1}`,
        targetId: target.id,
        targetName: enemyLabel(target),
        scope: stage.scope,
        unitIds,
        startAt: state.elapsedSeconds + Math.max(0, Math.round(stage.delaySeconds)),
        durationSeconds: fireMissionDurationSeconds(state, stage.scope),
        status: "pending" as const,
      },
    ];
  });

  if (validStages.length === 0) {
    return {
      ...state,
      log: [`${issuer.name}は火力計画を組めない。発見済み目標と参加可能旅団を確認。`, ...state.log].slice(0, 12),
    };
  }

  const planId = `plan-${state.elapsedSeconds}-${unitId}-${validStages.length}`;
  const plan = {
    id: planId,
    name: `${issuer.name} 火力計画`,
    issuedByUnitId: unitId,
    issuedAt: state.elapsedSeconds,
    stages: validStages,
  };

  const stageSummary = validStages
    .map((stage, index) => `第${index + 1}段${stage.startAt - state.elapsedSeconds}秒:${stage.targetName}`)
    .join(" / ");

  return {
    ...state,
    firePlans: [...(state.firePlans ?? []).filter((candidate) => candidate.stages.some((stage) => stage.status === "pending" || stage.status === "active")), plan].slice(-4),
    log: [`${issuer.name}が${validStages.length}段の火力計画を開始（${fireDiscipline.label}）。${stageSummary}`, ...state.log].slice(0, 12),
  };
};

export const applyStandingOrderPreset = (
  state: BattleState,
  unitId: string,
  presetId: StandingPosture,
): BattleState => {
  const preset = standingOrderPresets.find((candidate) => candidate.id === presetId);
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  if (!preset) {
    return state;
  }
  return markCommandTransmission({
    ...withUnitStandingOrder(state, unitId, (standingOrder) => ({
      ...standingOrder,
      posture: preset.id,
      targetPriority: preset.targetPriority,
      ammoPolicy: preset.ammoPolicy,
      fallback: {
        ...standingOrder.fallback,
        enabled: preset.fallbackEnabled,
        moraleBelow: preset.moraleBelow ?? standingOrder.fallback.moraleBelow,
        soldiersBelowRatio: preset.soldiersBelowRatio ?? standingOrder.fallback.soldiersBelowRatio,
      },
    })),
    log: [`${unitName}の自律方針を${presetLabel(presetId)}へ変更。`, ...state.log].slice(0, 12),
  }, unitId, presetLabel(presetId), "自律方針変更", "standard");
};

export const assignFacilityToUnit = (
  state: BattleState,
  unitId: string,
  structureId: string,
  mode: FacilityAssignmentMode,
): BattleState => {
  const structure = state.structures.find((candidate) => candidate.id === structureId);
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  if (!structure) {
    return state;
  }
  const nextState = withUnitStandingOrder(state, unitId, (standingOrder) => ({
    ...standingOrder,
    facilityAssignment: { structureId, mode },
    anchor: structure.position,
  }));
  return markCommandTransmission({
    ...nextState,
    playerUnits: nextState.playerUnits.map((unit) =>
      unit.unitId === unitId
        ? {
            ...unit,
            facilityResponseRole:
              mode === "repair" ? "facility_repair" : mode === "resupply" ? "facility_resupply" : "facility_defense",
          }
        : unit,
    ),
    log: [`${unitName}を${structureLabel(structure.type)}の担当に指定。`, ...state.log].slice(0, 12),
  }, unitId, `${structureLabel(structure.type)}担当`, "施設担当変更", "standard");
};

const nearestSegmentForStructure = (state: BattleState, structure: BattleStructure): FrontlineSegment | undefined =>
  [...state.frontlineSegments].sort(
    (a, b) => distance(a.anchor, structure.position) - distance(b.anchor, structure.position),
  )[0];

const facilityDefensePriority = (state: BattleState, structureId: string): TargetPriority => {
  const assailants = state.enemyUnits.filter(
    (enemy) => enemy.count > 0 && enemy.assaultPlan.targetStructureId === structureId,
  );
  if (assailants.some((enemy) => enemy.type === "brute")) {
    return "brute";
  }
  if (assailants.some((enemy) => enemy.type === "undeadOfficer")) {
    return "officer";
  }
  if (assailants.some((enemy) => enemy.type === "undeadRiflemen")) {
    return "riflemen";
  }
  return assailants.reduce((sum, enemy) => sum + enemy.count, 0) >= 70 ? "largest_mass" : "nearest";
};

const facilityDefenseCandidates = (
  state: BattleState,
  structure: BattleStructure,
  preferredUnitIds?: string[],
): BattleState["playerUnits"] => {
  if (preferredUnitIds && preferredUnitIds.length > 0) {
    return state.playerUnits.filter((unit) => preferredUnitIds.includes(unit.unitId) && unit.soldiers > 0 && unit.order !== "retreat");
  }

  const assigned = state.playerUnits.filter(
    (unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.standingOrder.facilityAssignment?.structureId === structure.id,
  );
  const nearestEngineer = [...state.playerUnits]
    .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.type === "engineer")
    .sort((a, b) => distance(a.position, structure.position) - distance(b.position, structure.position))[0];
  const nearestLineUnits = [...state.playerUnits]
    .filter(
      (unit) =>
        unit.soldiers > 0 &&
        unit.order !== "retreat" &&
        unit.type !== "artillery" &&
        unit.unitId !== nearestEngineer?.unitId &&
        !assigned.some((assignedUnit) => assignedUnit.unitId === unit.unitId),
    )
    .sort((a, b) => {
      const reserveBiasA = a.standingOrder.posture === "fallback_guard" || a.standingOrder.frontlineSegmentId === "reserve-line" ? -8 : 0;
      const reserveBiasB = b.standingOrder.posture === "fallback_guard" || b.standingOrder.frontlineSegmentId === "reserve-line" ? -8 : 0;
      return distance(a.position, structure.position) + reserveBiasA - (distance(b.position, structure.position) + reserveBiasB);
    })
    .slice(0, Math.max(1, 3 - assigned.length - (nearestEngineer ? 1 : 0)));
  const units = [...assigned, ...(nearestEngineer ? [nearestEngineer] : []), ...nearestLineUnits];
  return units.filter((unit, index) => units.findIndex((candidate) => candidate.unitId === unit.unitId) === index).slice(0, 4);
};

export const applyFacilityDefenseResponse = (
  state: BattleState,
  structureId: string,
  options: { unitIds?: string[]; forceRepair?: boolean } = {},
): BattleState => {
  const structure = state.structures.find((candidate) => candidate.id === structureId);
  if (!structure) {
    return state;
  }

  const units = facilityDefenseCandidates(state, structure, options.unitIds);
  if (units.length === 0) {
    return {
      ...state,
      log: [`${structureLabel(structure.type)}へ即応できる部隊がいない。`, ...state.log].slice(0, 12),
    };
  }

  const segment = nearestSegmentForStructure(state, structure);
  const targetPriority = facilityDefensePriority(state, structureId);
  const leadAssailant = [...state.enemyUnits]
    .filter((enemy) => enemy.count > 0 && enemy.isSpotted && enemy.assaultPlan.targetStructureId === structureId)
    .sort((a, b) => distance(a.position, structure.position) - distance(b.position, structure.position))[0];
  const needsRepair =
    options.forceRepair ||
    structure.status === "damaged" ||
    structure.status === "overrun" ||
    structure.facilityState === "contested";
  const controlRadius = Math.max(segment?.controlRadius ?? 18, structure.blockedRadius + 14);

  return {
    ...state,
    playerUnits: state.playerUnits.map((unit) => {
      if (!units.some((candidate) => candidate.unitId === unit.unitId)) {
        return unit;
      }
      const isEngineer = unit.type === "engineer";
      const mode: FacilityAssignmentMode =
        isEngineer && needsRepair
          ? "repair"
          : structure.type === "supplyDepot" && unit.ammo < 55
            ? "resupply"
            : "defend";
      const facilityResponseRole =
        mode === "repair" ? "facility_repair" : mode === "resupply" ? "facility_resupply" : "facility_defense";
      return {
        ...unit,
        order: isEngineer && needsRepair ? "build" : "hold",
        focusTargetId: leadAssailant?.id ?? unit.focusTargetId,
        facilityResponseRole,
        actionReason: unit.actionReason === "destroyed" ? unit.actionReason : "moving_to_facility",
        reserveReadiness: Math.max(0, (unit.reserveReadiness ?? 0) - (unit.standingOrder.frontlineSegmentId === "reserve-line" ? 10 : 5)),
        standingOrder: {
          ...unit.standingOrder,
          anchor: { ...structure.position },
          controlRadius,
          frontlineSegmentId: segment?.id ?? unit.standingOrder.frontlineSegmentId,
          posture: isEngineer && needsRepair ? "engineer_support" : "hold_line",
          targetPriority,
          ammoPolicy: targetPriority === "brute" || targetPriority === "largest_mass" ? "intense" : "normal",
          fallback: {
            ...unit.standingOrder.fallback,
            enabled: true,
            moraleBelow: isEngineer ? 46 : 38,
            soldiersBelowRatio: isEngineer ? 0.68 : 0.54,
            destination: segment?.fallbackPoint ?? unit.standingOrder.fallback.destination,
          },
          facilityAssignment: {
            structureId,
            mode,
          },
        },
      };
    }),
    log: [
      `施設即応: ${structureLabel(structure.type)}へ${units.length}部隊を投入。${leadAssailant ? `${enemyLabel(leadAssailant)}を指名。` : "周辺防衛を開始。"}`,
      ...state.log,
    ].slice(0, 12),
  };
};

export const setStandingOrderAnchor = (
  state: BattleState,
  unitId: string,
  position: BattlePosition,
): BattleState => {
  const anchor = clampPosition(state, position);
  const segment = segmentAtPosition(state, anchor);
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  const nextState = withUnitStandingOrder(state, unitId, (standingOrder) => ({
    ...standingOrder,
    anchor,
    frontlineSegmentId: segment?.id ?? standingOrder.frontlineSegmentId,
    controlRadius: segment?.controlRadius ?? standingOrder.controlRadius,
  }));
  return markCommandTransmission({
    ...nextState,
    playerUnits: nextState.playerUnits.map((unit) =>
      unit.unitId === unitId ? { ...unit, actionReason: "returning_anchor" } : unit,
    ),
    log: [
      `${unitName}の基準位置をX${Math.round(anchor.x)} Y${Math.round(anchor.y)}へ指定。`,
      ...state.log,
    ].slice(0, 12),
  }, unitId, "基準位置", `X${Math.round(anchor.x)} Y${Math.round(anchor.y)}`, "standard");
};

export const setStandingOrderFallbackDestination = (
  state: BattleState,
  unitId: string,
  position: BattlePosition,
): BattleState => {
  const destination = clampPosition(state, position);
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  return markCommandTransmission({
    ...withUnitStandingOrder(state, unitId, (standingOrder) => ({
      ...standingOrder,
      fallback: {
        ...standingOrder.fallback,
        enabled: true,
        destination,
      },
    })),
    log: [
      `${unitName}の後退地点をX${Math.round(destination.x)} Y${Math.round(destination.y)}へ指定。`,
      ...state.log,
    ].slice(0, 12),
  }, unitId, "後退地点", `X${Math.round(destination.x)} Y${Math.round(destination.y)}`, "standard");
};

export const applySavedStandingOrderTemplate = (
  state: BattleState,
  unitId: string,
  template: StandingOrderTemplate,
): BattleState => {
  const unitName = state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? "部隊";
  const facilityAssignment =
    template.standingOrder.facilityAssignment &&
    state.structures.some((structure) => structure.id === template.standingOrder.facilityAssignment?.structureId)
      ? { ...template.standingOrder.facilityAssignment }
      : undefined;

  const nextState = withUnitStandingOrder(state, unitId, () => ({
    ...template.standingOrder,
    anchor: { ...template.standingOrder.anchor },
    fallback: {
      ...template.standingOrder.fallback,
      destination: { ...template.standingOrder.fallback.destination },
    },
    facilityAssignment,
  }));

  return {
    ...nextState,
    playerUnits: nextState.playerUnits.map((unit) =>
      unit.unitId === unitId ? { ...unit, actionReason: "returning_anchor" } : unit,
    ),
    log: [`${unitName}へ保存済み自律方針を再適用。`, ...state.log].slice(0, 12),
  };
};

export const setBattleSpeed = (state: BattleState, speed: 0 | 1 | 2 | 3): BattleState => ({
  ...state,
  speed,
  status: speed === 0 ? "paused" : state.status === "ready" || state.status === "paused" ? "running" : state.status,
});

export const requestWithdrawal = (state: BattleState): BattleState => ({
  ...state,
  status: "withdrawn",
  log: ["戦闘撤退を命令。", ...state.log].slice(0, 12),
});
