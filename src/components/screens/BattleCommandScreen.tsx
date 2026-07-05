import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { battleAssetUrls } from "../../assets/manifest";
import type { UnitOrder } from "../../game/army/types";
import {
  commandIssuePlanLabels,
  defaultCommandIssuePlan,
  defaultReserveDoctrinePlan,
  reserveDoctrineLabels,
} from "../../game/campaign/deploymentPlan";
import { fireDisciplineWithDefaults } from "../../game/doctrine/applyDoctrine";
import {
  applyFrontlineObjectiveSupport,
  applyFrontlineRotation,
  applyCommandCongestionToPendingOrders,
  applyFrontlineDoctrinePreset,
  applyFacilityDefenseResponse,
  applyObjectiveNodeResponse,
  applyStandingOrderPreset,
  applySavedStandingOrderTemplate,
  assignFacilityToUnit,
  assignFrontlineSegment,
  clearUnitFocusTarget,
  commandCongestionReport,
  commandTransmissionReport,
  frontlineDoctrinePresets,
  issueFirePlan,
  issueFireMission,
  objectiveResponseTacticalProfile,
  requestWithdrawal,
  repositionFrontlineSegment,
  returnUnitToReserveLine,
  resizeFrontlineSegmentControl,
  setBattleSpeed,
  setFrontlineSegmentFallback,
  setStandingOrderAnchor,
  setStandingOrderAmmoPolicy,
  setStandingOrderFallbackDestination,
  setStandingOrderFacing,
  setStandingOrderTargetPriority,
  setUnitFocusTarget,
  setUnitOrder,
  sketchFrontlineSegmentPolyline,
  standingOrderPresets,
  type CommandCongestionReport,
  type CommandTransmissionReport,
  type FrontlineDoctrinePreset,
  type FrontlineDoctrinePresetId,
} from "../../game/battle/orders";
import { frontlineGeometryDisplayLabel } from "../../game/battle/frontlineDefaults";
import { maxFrontlineSketchPoints, svgPolylinePoints, svgSmoothSketchPath } from "../../game/battle/sketchLines";
import { assessFrontlineTerrain } from "../../game/battle/frontlineTerrainAssessment";
import {
  formationDistanceToPoint,
  formationFacingDisplayLabel,
  formationFacingOptions,
  formationSummary,
  normalizeFormationFacingDeg,
  pointFromFormationFrame,
  targetWithinFormationArc,
} from "../../game/battle/formations";
import { resolveTick } from "../../game/battle/resolveTick";
import {
  lineOfSightBlockage,
  lineOfSightTerrainClass,
  lineOfSightTerrainLabel,
  localTerrainEffect,
} from "../../game/battle/terrainEffects";
import { enemyConcealmentAt, spottingRangeForStructures } from "../../game/battle/visibility";
import type {
  BattleChokePoint,
  BattleObjectiveNode,
  BattlePosition,
  BattleState,
  BattleStructure,
  BattleWaveTimelineEntry,
  BattleUnit,
  AmmoPolicy,
  EnemyBattleUnit,
  EnemyAssaultMode,
  EnemyAssaultPhase,
  EnemyCommandIntent,
  EnemyCommandState,
  EnemyCommandTier,
  EnemyMoraleState,
  FireMissionScope,
  TargetPriority,
} from "../../game/battle/types";
import type { StandingOrderTemplate } from "../../game/battle/types";
import {
  ammoPolicyLabels,
  battleActionReasonLabels,
  battleStatusLabels,
  facilityAssignmentModeLabels,
  fortificationStatusLabels,
  fortificationTypeLabels,
  standingPostureLabels,
  targetPriorityLabels,
  unitOrderLabels,
  unitTypeLabels,
} from "../shared/labels";

interface BattleCommandScreenProps {
  battle: BattleState;
  standingOrderTemplates?: StandingOrderTemplate[];
  onChange: (battle: BattleState) => void;
  onComplete: () => void;
  onSaveStandingOrderTemplate?: (unit: BattleUnit, description?: string, frontlineSketchPoints?: BattlePosition[]) => void;
}

type MapCommandMode = "none" | "select" | "anchor" | "fallback" | "facility" | "focusTarget" | "segment";
type DragOrderHandleKind = "anchor" | "fallback";
type DragFrontlineHandleKind = "frontline-anchor" | "frontline-fallback";
type TacticalMapLayerId =
  | "frontlines"
  | "orders"
  | "targetAudit"
  | "formations"
  | "enemyAssault"
  | "engagements"
  | "terrain"
  | "facilities";

interface DragOrderHandleState {
  unitId: string;
  kind: DragOrderHandleKind;
  position: BattlePosition;
}

interface DragFrontlineHandleState {
  segmentId: string;
  kind: DragFrontlineHandleKind;
  position: BattlePosition;
}

interface FrontlineSketchDraft {
  segmentId: string;
  points: BattlePosition[];
}

interface BattleViewportRange {
  left: number;
  width: number;
}

const mapCommandModeLabels: Record<MapCommandMode, string> = {
  none: "通常選択",
  select: "選択確認",
  anchor: "基準位置指定",
  fallback: "後退地点指定",
  facility: "施設担当指定",
  focusTarget: "集中目標指定",
  segment: "担当戦線指定",
};

interface FrontlineObjectiveSupportOption {
  node: BattleObjectiveNode;
  distance: number;
  defenders: number;
  tone: "ready" | "warning" | "danger";
  reason: string;
}

interface ObjectiveStaffRecommendation {
  id: string;
  node: BattleObjectiveNode;
  segment: BattleState["frontlineSegments"][number];
  report: FrontlinePressureReport | undefined;
  defenders: number;
  distance: number;
  score: number;
  tone: "ready" | "warning" | "danger";
  riskLabel: string;
  reason: string;
  transferForecast: ObjectiveTransferForecast;
}

interface ObjectiveTransferForecast {
  label: string;
  detail: string;
  tone: "ready" | "warning" | "danger";
  pressurePerDefender: number;
  reserveCover: number;
  anchorShift: number;
}

interface BattleAlert {
  id: string;
  severity: "warning" | "danger" | "info";
  title: string;
  detail: string;
  position?: BattlePosition;
  unitId?: string;
  structureId?: string;
  segmentId?: string;
  objectiveNodeId?: string;
  recommendation?: string;
}

const battleAlertPriority = (alert: BattleAlert): number => {
  if (alert.structureId && alert.recommendation === "施設即応") {
    return 0;
  }
  if (alert.severity === "danger") {
    return 1;
  }
  if (alert.structureId) {
    return 2;
  }
  if (alert.objectiveNodeId) {
    return 3;
  }
  if (alert.id === "line-integrity") {
    return 4;
  }
  if (alert.segmentId) {
    return 5;
  }
  if (alert.id === "enemy-wave" || alert.id === "enemy-command") {
    return 6;
  }
  return alert.severity === "warning" ? 7 : 8;
};

interface WithdrawalForecast {
  tone: "ready" | "warning" | "danger";
  title: string;
  recommendation: string;
  chips: string[];
  reasons: string[];
}

interface FrontlinePressureReport {
  segment: BattleState["frontlineSegments"][number];
  pressure: number;
  enemyCount: number;
  defenders: BattleUnit[];
  reserves: BattleUnit[];
  readyReserves: BattleUnit[];
  reserveReadiness: number;
  leadEnemy?: EnemyBattleUnit;
  level: "quiet" | "watch" | "warning" | "danger";
  posture: BattleUnit["standingOrder"]["posture"];
  responseType: "hold" | "reserve_commit" | "seal_breach" | "counterstroke" | "elastic";
  recommendationLabel: string;
}

interface FrontlineRotationPreview {
  tiredUnit: BattleUnit;
  reserveUnit: BattleUnit;
  label: string;
  detail: string;
}

interface FrontlineRotationOptions {
  tiredUnits: BattleUnit[];
  reserveUnits: BattleUnit[];
  defaultTiredUnit?: BattleUnit;
  defaultReserveUnit?: BattleUnit;
}

interface FrontlineRotationReserveReadout {
  label: string;
  detail: string;
  tone: "ready" | "caution" | "danger";
  scoreModifier: number;
}

interface EnemyCommandGroupReport {
  id: string;
  label: string;
  intent: EnemyBattleUnit["assaultPlan"]["commandIntent"];
  state: EnemyBattleUnit["assaultPlan"]["commandState"];
  source?: EnemyBattleUnit;
  units: EnemyBattleUnit[];
  targetName: string;
  targetSegment?: BattleState["frontlineSegments"][number];
  totalCount: number;
  totalPressure: number;
  averageInfluence: number;
  commandTierSummary: string;
  recommendedAction: "fire" | "pursuit" | "reserve";
  recommendationLabel: string;
  recommendationReason: string;
  forecastLabel: string;
  forecastDetail: string;
  forecastTone: "effect" | "cost" | "risk";
  activeResponseAction?: "fire" | "pursuit" | "reserve";
  responseStatusLabel: string;
  responseStatusDetail: string;
  responseStatusTone: "idle" | "active" | "locked";
  responseEffectLabel: string;
  responseEffectDetail: string;
  responseEffectTone: "idle" | "effect" | "cost" | "risk";
  leadThreat: EnemyBattleUnit;
  pursuitTarget?: EnemyBattleUnit;
  pursuitReason: string;
  pursuitOpportunityScore: number;
}

interface FirePlanDraftStage {
  id: string;
  targetId: string;
  targetName: string;
  scope: FireMissionScope;
  delaySeconds: number;
}

interface TargetAuditEntry {
  enemy: EnemyBattleUnit;
  distance: number;
  formationDistance: number;
  effectiveRange: number;
  inArcAndRange: boolean;
  lineOfSight: ReturnType<typeof lineOfSightBlockage>;
  isFocusTarget: boolean;
  priorityRank: number;
}

interface QueuedBattleCommand {
  id: string;
  subjectId: string;
  subjectName: string;
  summary: string;
  detail: string;
  transmissionPreview?: CommandTransmissionReport;
  apply: (state: BattleState) => BattleState;
}

const orders: UnitOrder[] = ["hold", "advance", "flank", "rest", "build", "retreat"];
const targetPriorities: TargetPriority[] = ["nearest", "brute", "officer", "riflemen", "largest_mass", "weakest"];
const ammoPolicies: AmmoPolicy[] = ["normal", "conserve", "intense"];
const fireMissionScopes: FireMissionScope[] = ["selected_unit", "frontline_segment"];
const defaultTacticalMapLayers: Record<TacticalMapLayerId, boolean> = {
  frontlines: true,
  orders: true,
  targetAudit: true,
  formations: true,
  enemyAssault: true,
  engagements: true,
  terrain: true,
  facilities: true,
};
const tacticalMapLayerLabels: Record<TacticalMapLayerId, string> = {
  frontlines: "戦線",
  orders: "指揮圏",
  targetAudit: "射撃判断",
  formations: "隊形",
  enemyAssault: "敵突撃",
  engagements: "交戦線",
  terrain: "地形/目標",
  facilities: "施設",
};
const tacticalMapLayerDescriptions: Record<TacticalMapLayerId, string> = {
  frontlines: "担当戦線、戦線基準、後退線",
  orders: "旅団の基準位置、指揮半径、後退経路",
  targetAudit: "選択旅団から敵候補への射撃判断線",
  formations: "旅団の正面幅、向き、射界",
  enemyAssault: "敵群の突撃幅、軸、突破段階",
  engagements: "現在発生している射撃/砲撃/近接線",
  terrain: "地形効果、敵接近方向、勝利/補給/視界目標",
  facilities: "塹壕、バリケード、補給所などの状態",
};
const tacticalMapLayerOrder: TacticalMapLayerId[] = [
  "frontlines",
  "orders",
  "targetAudit",
  "formations",
  "enemyAssault",
  "engagements",
  "terrain",
  "facilities",
];
const fireMissionScopeLabels: Record<FireMissionScope, string> = {
  selected_unit: "旅団斉射",
  frontline_segment: "戦線斉射",
};
const firePlanStageStatusLabels = {
  pending: "待機",
  active: "射撃中",
  completed: "完了",
  skipped: "中止",
};
const objectiveNodeAssets: Record<BattleObjectiveNode["type"], string> = {
  victory: battleAssetUrls.objectives.victory,
  supply: battleAssetUrls.objectives.supply,
  visibility: battleAssetUrls.objectives.visibility,
};
const objectiveNodeClassNames: Record<BattleObjectiveNode["type"], string> = {
  victory: "victory",
  supply: "supply",
  visibility: "visibility",
};
const objectiveControlLabels: Record<BattleObjectiveNode["control"], string> = {
  player: "保持",
  contested: "争奪",
  enemy: "喪失",
};
const objectiveResponseLabels: Record<BattleObjectiveNode["type"], Record<BattleObjectiveNode["control"], string>> = {
  victory: {
    player: "勝利点保持",
    contested: "勝利点増援",
    enemy: "勝利点奪回",
  },
  supply: {
    player: "補給点防衛",
    contested: "補給点確保",
    enemy: "補給点奪回",
  },
  visibility: {
    player: "視界点確保",
    contested: "視界点制圧",
    enemy: "視界点奪回",
  },
};
const enemyApproaches = [
  { id: "north", label: "敵北進路", position: { x: 116, y: 13 } },
  { id: "east", label: "敵主波", position: { x: 126, y: 46 } },
  { id: "south", label: "沼地迂回", position: { x: 113, y: 84 } },
];

const targetName = (battle: BattleState, targetId?: string): string => {
  if (!targetId) {
    return "未捕捉";
  }
  return (
    battle.enemyUnits.find((unit) => unit.id === targetId)?.name ??
    battle.playerUnits.find((unit) => unit.unitId === targetId)?.name ??
    battle.structures.find((structure) => structure.id === targetId)?.mapNodeId ??
    "不明"
  );
};

const focusTargetName = (battle: BattleState, targetId?: string): string =>
  targetId ? targetName(battle, targetId) : "なし";

const activeFireMissionForUnit = (battle: BattleState, unit: BattleUnit | undefined) =>
  unit
    ? (battle.fireMissions ?? []).find((mission) => mission.unitIds.includes(unit.unitId) && mission.expiresAt > battle.elapsedSeconds)
    : undefined;

const fireMissionStatus = (battle: BattleState, unit: BattleUnit): string => {
  const mission = activeFireMissionForUnit(battle, unit);
  if (mission) {
    return `${fireMissionScopeLabels[mission.scope]} ${Math.max(0, Math.ceil(mission.expiresAt - battle.elapsedSeconds))}秒`;
  }
  const cooldown = Math.max(0, Math.ceil((unit.volleyCooldownUntilSeconds ?? 0) - battle.elapsedSeconds));
  return cooldown > 0 ? `再装填 ${cooldown}秒` : "待機";
};

const enemyAssaultModeLabels: Record<EnemyAssaultMode, string> = {
  mass_push: "圧迫",
  rifle_screen: "銃列",
  breacher: "突破",
  command_drive: "指揮",
};

const enemyAssaultPhaseLabels: Record<EnemyAssaultPhase, string> = {
  approach: "接近",
  engaged: "交戦",
  flanking: "側面圧",
  breakthrough: "突破",
  overextended: "突出",
};

const enemyCommandStateLabels: Record<EnemyCommandState, string> = {
  none: "独走",
  commanded: "指揮下",
  disrupted: "指揮崩壊",
};

const enemyCommandIntentLabels: Record<EnemyCommandIntent, string> = {
  press_line: "戦線圧迫",
  flank_line: "側面迂回",
  breach_works: "陣地突破",
  fire_support: "銃列支援",
  rally_wave: "再集結",
};

const enemyCommandTierLabels: Record<EnemyCommandTier, string> = {
  none: "指揮外",
  wave_command: "波指揮核",
  assault_lead: "突撃先導",
  support_node: "支援節",
  line_group: "前衛群",
};

const enemyMoraleStateLabels: Record<EnemyMoraleState, string> = {
  steady: "維持",
  wavering: "動揺",
  routing: "潰走",
  regrouping: "再集結",
};

const timelineCertaintyLabels: Record<BattleWaveTimelineEntry["intelCertainty"], string> = {
  vague: "偵察不足",
  estimated: "推定",
  confirmed: "確定",
  misleading: "誤情報疑い",
};

const mapUnitDisplayName = (unit: BattleUnit): string =>
  unit.name
    .replace(/^第(\d+)戦列歩兵大隊$/, "第$1歩兵")
    .replace(/^第(\d+)塹壕歩兵大隊$/, "第$1塹壕")
    .replace(/^第(\d+)野戦砲兵中隊$/, "第$1砲兵")
    .replace(/^第(\d+)工兵中隊$/, "第$1工兵")
    .replace("東方辺境", "")
    .replace("衛戍予備", "予備")
    .replace("大隊", "")
    .replace("中隊", "")
    .replace("分遣隊", "");

const mapEnemyDisplayName = (unit: EnemyBattleUnit): string => {
  const names: Record<EnemyBattleUnit["type"], string> = {
    undeadMob: "群集",
    undeadRiflemen: "銃兵",
    brute: "破砕体",
    undeadOfficer: "敵指揮",
  };
  return names[unit.type];
};

const enemyAssaultAngleDeg = (unit: EnemyBattleUnit): number =>
  Math.atan2(unit.assaultPlan.vector.y, unit.assaultPlan.vector.x) * (180 / Math.PI);

const enemyAssaultAxisEnd = (battle: BattleState, unit: EnemyBattleUnit): BattlePosition => ({
  x: Math.max(0, Math.min(battle.mapBounds.width, unit.position.x + unit.assaultPlan.vector.x * Math.min(14, unit.assaultPlan.frontageWidth))),
  y: Math.max(0, Math.min(battle.mapBounds.height, unit.position.y + unit.assaultPlan.vector.y * Math.min(14, unit.assaultPlan.frontageWidth))),
});

const enemyVectorLabel = (unit: EnemyBattleUnit): string => {
  const horizontal = unit.assaultPlan.vector.x < -0.16 ? "西進" : unit.assaultPlan.vector.x > 0.16 ? "東進" : "縦深保持";
  const vertical = unit.assaultPlan.vector.y < -0.16 ? "北寄り" : unit.assaultPlan.vector.y > 0.16 ? "南寄り" : "正面";
  return `${horizontal}/${vertical}`;
};

const enemyThreatScore = (unit: EnemyBattleUnit): number => {
  const modeFactor: Record<EnemyAssaultMode, number> = {
    mass_push: 1.05,
    rifle_screen: 0.82,
    breacher: 1.34,
    command_drive: 1.22,
  };
  const moraleFactor: Record<EnemyMoraleState, number> = {
    steady: 1,
    wavering: 0.7,
    routing: 0.32,
    regrouping: 0.48,
  };
  return (
    unit.count *
    unit.assaultPlan.cohesion *
    modeFactor[unit.assaultPlan.mode] *
    moraleFactor[unit.assaultPlan.moraleState ?? "steady"] *
    (0.82 + unit.assaultPlan.commandInfluence) *
    (unit.assaultPlan.phase === "breakthrough"
      ? 1.42
      : unit.assaultPlan.phase === "flanking"
        ? 1.2
        : unit.assaultPlan.phase === "overextended"
          ? 0.82
          : 1)
  );
};

const enemyThreatLabel = (unit: EnemyBattleUnit): string => {
  const score = enemyThreatScore(unit);
  if (score >= 120) {
    return "突破危険";
  }
  if (score >= 74) {
    return "高脅威";
  }
  if (score >= 38) {
    return "中脅威";
  }
  return "低脅威";
};

const enemyPursuitOpportunityScore = (unit: EnemyBattleUnit): number => {
  const moraleScore: Record<EnemyMoraleState, number> = {
    steady: 0,
    wavering: 28,
    routing: 46,
    regrouping: 34,
  };
  const phaseScore: Record<EnemyAssaultPhase, number> = {
    approach: 0,
    engaged: 0,
    flanking: 8,
    breakthrough: 16,
    overextended: 36,
  };
  const cohesionScore = unit.assaultPlan.cohesion < 0.62 ? Math.round((0.62 - unit.assaultPlan.cohesion) * 100) : 0;
  const commandScore = unit.assaultPlan.commandState === "disrupted" ? 48 : 0;
  const weakCountScore = unit.count <= 18 ? 6 : 0;
  return commandScore + moraleScore[unit.assaultPlan.moraleState ?? "steady"] + phaseScore[unit.assaultPlan.phase] + cohesionScore + weakCountScore;
};

const enemyPursuitReason = (unit?: EnemyBattleUnit): string => {
  if (!unit) {
    return "追撃機会なし";
  }
  if (unit.assaultPlan.commandState === "disrupted") {
    return "指揮崩壊";
  }
  if (unit.assaultPlan.moraleState === "routing") {
    return "潰走";
  }
  if (unit.assaultPlan.moraleState === "regrouping") {
    return "再集結";
  }
  if (unit.assaultPlan.moraleState === "wavering") {
    return "動揺";
  }
  if (unit.assaultPlan.phase === "breakthrough") {
    return "突破";
  }
  if (unit.assaultPlan.phase === "flanking") {
    return "側撃";
  }
  if (unit.assaultPlan.phase === "overextended") {
    return "突出";
  }
  if (unit.assaultPlan.cohesion < 0.62) {
    return `凝集${Math.round(unit.assaultPlan.cohesion * 100)}%`;
  }
  if (unit.count <= 18) {
    return "小集団";
  }
  return "追撃機会なし";
};

const enemyPressureLeadScore = (unit: EnemyBattleUnit): number => {
  const phasePriority: Record<EnemyAssaultPhase, number> = {
    approach: 0,
    engaged: 18,
    flanking: 36,
    breakthrough: 58,
    overextended: 52,
  };
  return (
    phasePriority[unit.assaultPlan.phase] +
    enemyThreatScore(unit) * 0.2 +
    unit.assaultPlan.penetrationDepth * 1.4 +
    unit.assaultPlan.flankPressure * 0.045
  );
};

const enemyIntentDetail = (unit: EnemyBattleUnit): string => {
  if (!unit.isSpotted) {
    return `未確認敵影: 隠蔽${Math.round(unit.concealment)} / 推定${enemyVectorLabel(unit)} / 詳細偵察待ち`;
  }
  return `意図 ${enemyAssaultModeLabels[unit.assaultPlan.mode]} / 指令 ${
    enemyCommandIntentLabels[unit.assaultPlan.commandIntent]
  } / 目標 ${unit.assaultPlan.targetName} / ${enemyVectorLabel(
    unit,
  )} / ${enemyAssaultPhaseLabels[unit.assaultPlan.phase]} 深度${Math.round(
    unit.assaultPlan.penetrationDepth,
  )} 側面${Math.round(unit.assaultPlan.flankPressure)} / 幅${Math.round(unit.assaultPlan.frontageWidth)} 深さ${Math.round(unit.assaultPlan.depth)} / 凝集${Math.round(
    unit.assaultPlan.cohesion * 100,
  )}%`;
};

const enemyResponsePriority = (unit: EnemyBattleUnit): TargetPriority => {
  if (unit.type === "undeadOfficer") {
    return "officer";
  }
  if (unit.type === "brute" || unit.assaultPlan.mode === "breacher") {
    return "brute";
  }
  if (unit.type === "undeadRiflemen" || unit.assaultPlan.mode === "rifle_screen") {
    return "riflemen";
  }
  return unit.count >= 42 || unit.assaultPlan.frontageWidth >= 28 ? "largest_mass" : "nearest";
};

const enemyResponsePosture = (unit: EnemyBattleUnit): BattleUnit["standingOrder"]["posture"] => {
  if (unit.assaultPlan.phase === "breakthrough") {
    return "fallback_guard";
  }
  if (unit.assaultPlan.phase === "flanking" || unit.assaultPlan.phase === "overextended") {
    return "elastic_defense";
  }
  if (unit.assaultPlan.moraleState === "routing" || unit.assaultPlan.moraleState === "regrouping") {
    return "hold_line";
  }
  if (enemyThreatScore(unit) >= 120 || unit.assaultPlan.mode === "breacher") {
    return "aggressive_screen";
  }
  if (unit.assaultPlan.commandState === "commanded" || unit.type === "undeadOfficer") {
    return "aggressive_screen";
  }
  return "elastic_defense";
};

const enemyThreatSegment = (battle: BattleState, unit: EnemyBattleUnit): BattleState["frontlineSegments"][number] | undefined => {
  const targetSegment = unit.assaultPlan.targetSegmentId
    ? battle.frontlineSegments.find((segment) => segment.id === unit.assaultPlan.targetSegmentId)
    : undefined;
  if (targetSegment) {
    return targetSegment;
  }

  const targetStructure = unit.assaultPlan.targetStructureId
    ? battle.structures.find((structure) => structure.id === unit.assaultPlan.targetStructureId)
    : undefined;
  const targetPosition = targetStructure?.position ?? enemyAssaultAxisEnd(battle, unit);
  return [...battle.frontlineSegments].sort((a, b) => distance(targetPosition, a.anchor) - distance(targetPosition, b.anchor))[0];
};

const enemyResponseUnits = (battle: BattleState, unit: EnemyBattleUnit): BattleUnit[] => {
  const segment = enemyThreatSegment(battle, unit);
  const sameSegment = battle.playerUnits
    .filter((playerUnit) => playerUnit.soldiers > 0 && playerUnit.order !== "retreat" && playerUnit.standingOrder.frontlineSegmentId === segment?.id)
    .sort((a, b) => distance(a.position, unit.position) - distance(b.position, unit.position));
  if (sameSegment.length > 0) {
    return sameSegment;
  }
  return [...battle.playerUnits]
    .filter((playerUnit) => playerUnit.soldiers > 0 && playerUnit.order !== "retreat")
    .sort((a, b) => distance(a.position, unit.position) - distance(b.position, unit.position))
    .slice(0, 2);
};

const facilityInspectionResponseUnits = (battle: BattleState, structure: BattleStructure): BattleUnit[] => {
  const assignedUnits = battle.playerUnits.filter(
    (unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.standingOrder.facilityAssignment?.structureId === structure.id,
  );
  const nearestEngineer = battle.playerUnits
    .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.type === "engineer")
    .sort((a, b) => distance(a.position, structure.position) - distance(b.position, structure.position))[0];
  const nearestDefenders = battle.playerUnits
    .filter(
      (unit) =>
        unit.soldiers > 0 &&
        unit.order !== "retreat" &&
        unit.type !== "artillery" &&
        unit.unitId !== nearestEngineer?.unitId &&
        !assignedUnits.some((assigned) => assigned.unitId === unit.unitId),
    )
    .sort((a, b) => {
      const reserveBiasA = a.standingOrder.frontlineSegmentId === "reserve-line" ? -8 : 0;
      const reserveBiasB = b.standingOrder.frontlineSegmentId === "reserve-line" ? -8 : 0;
      return distance(a.position, structure.position) + reserveBiasA - (distance(b.position, structure.position) + reserveBiasB);
    })
    .slice(0, Math.max(1, 3 - assignedUnits.length - (nearestEngineer ? 1 : 0)));
  const responseUnits = nearestEngineer ? [...assignedUnits, nearestEngineer, ...nearestDefenders] : [...assignedUnits, ...nearestDefenders];
  return responseUnits
    .filter((unit, index) => responseUnits.findIndex((candidate) => candidate.unitId === unit.unitId) === index)
    .slice(0, 4);
};

const enemyResponseLabel = (unit: EnemyBattleUnit): string =>
  `${standingPostureLabels[enemyResponsePosture(unit)]} / ${targetPriorityLabels[enemyResponsePriority(unit)]}`;

const enemyCommandTierCount = (units: EnemyBattleUnit[], tier: EnemyCommandTier): number =>
  units.filter((unit) => (unit.assaultPlan.commandTier ?? "none") === tier).length;

const enemyCommandGroupRecommendation = (
  units: EnemyBattleUnit[],
  leadThreat: EnemyBattleUnit,
  pursuitOpportunityScore: number,
  totalPressure: number,
): Pick<EnemyCommandGroupReport, "recommendedAction" | "recommendationLabel" | "recommendationReason"> => {
  const assaultLeadCount = enemyCommandTierCount(units, "assault_lead");
  const supportNodeCount = enemyCommandTierCount(units, "support_node");
  const waveCommandCount = enemyCommandTierCount(units, "wave_command");
  if (pursuitOpportunityScore >= 42) {
    return {
      recommendedAction: "pursuit",
      recommendationLabel: "崩壊追撃",
      recommendationReason: `追撃機会${Math.round(pursuitOpportunityScore)}。崩れた指揮群を掃討して再集結を防ぐ。`,
    };
  }
  if (
    assaultLeadCount > 0 &&
    (leadThreat.assaultPlan.phase === "breakthrough" ||
      leadThreat.assaultPlan.phase === "flanking" ||
      totalPressure >= 980 ||
      leadThreat.assaultPlan.targetStructureId)
  ) {
    return {
      recommendedAction: "reserve",
      recommendationLabel: "予備投入",
      recommendationReason: `突撃先導${assaultLeadCount}群。突破・施設襲撃を止めるため担当線へ予備を接続する。`,
    };
  }
  if (waveCommandCount > 0 || supportNodeCount > 0) {
    return {
      recommendedAction: "fire",
      recommendationLabel: "指揮核射撃",
      recommendationReason:
        supportNodeCount > 0
          ? `支援節${supportNodeCount}群。敵の士気維持と銃列支援を指揮核射撃で切る。`
          : "波指揮核あり。指揮源を叩いて同群の凝集と再集結を崩す。",
    };
  }
  return {
    recommendedAction: "reserve",
    recommendationLabel: "予備投入",
    recommendationReason: "前衛群中心。最も近い担当線へ予備を接続し、圧力を受け止める。",
  };
};

const enemyCommandGroupForecast = (
  battle: BattleState,
  units: EnemyBattleUnit[],
  source: EnemyBattleUnit | undefined,
  leadThreat: EnemyBattleUnit,
  targetSegment: BattleState["frontlineSegments"][number] | undefined,
  recommendation: Pick<EnemyCommandGroupReport, "recommendedAction">,
  pursuitTarget: EnemyBattleUnit | undefined,
  pursuitOpportunityScore: number,
): Pick<EnemyCommandGroupReport, "forecastLabel" | "forecastDetail" | "forecastTone"> => {
  if (recommendation.recommendedAction === "fire") {
    const commandTarget =
      source ??
      units.find((unit) => unit.assaultPlan.commandRole === "command_node") ??
      [...units].sort((a, b) => b.assaultPlan.commandInfluence - a.assaultPlan.commandInfluence || enemyThreatScore(b) - enemyThreatScore(a))[0] ??
      leadThreat;
    const responseCount = enemyResponseUnits(battle, commandTarget).slice(0, 3).length;
    return {
      forecastLabel: `予測 指揮低下 / ${responseCount}旅団 / 弾薬高`,
      forecastDetail: `${mapEnemyDisplayName(commandTarget)}を集中射撃。命中すれば同群の再集結と士気維持を崩す。`,
      forecastTone: responseCount >= 2 ? "effect" : "risk",
    };
  }
  if (recommendation.recommendedAction === "pursuit") {
    const target = pursuitTarget ?? leadThreat;
    const responseCount = enemyResponseUnits(battle, target).slice(0, 3).length;
    return {
      forecastLabel: `予測 再集結阻止 / ${responseCount}旅団 / 機動高`,
      forecastDetail: `${mapEnemyDisplayName(target)}を掃討。追撃機会${Math.round(pursuitOpportunityScore)}、低凝集なら戦線圧を早く落とせる。`,
      forecastTone: pursuitOpportunityScore >= 64 ? "effect" : "cost",
    };
  }
  const segment = targetSegment ?? enemyThreatSegment(battle, leadThreat);
  const defenders = segment
    ? battle.playerUnits.filter(
        (unit) =>
          unit.soldiers > 0 &&
          unit.order !== "retreat" &&
          unit.standingOrder.frontlineSegmentId === segment.id,
      )
    : [];
  const reserveCandidates = segment
    ? battle.playerUnits
        .filter(
          (unit) =>
            unit.soldiers > 0 &&
            unit.order !== "retreat" &&
            unit.standingOrder.frontlineSegmentId !== segment.id,
        )
        .sort((a, b) => distance(a.position, leadThreat.position) - distance(b.position, leadThreat.position))
        .slice(0, leadThreat.assaultPlan.phase === "breakthrough" ? 2 : 1)
    : [];
  const readinessCost = reserveCandidates.length * 32;
  return {
    forecastLabel: `予測 突破封鎖 / 予備${reserveCandidates.length} / 即応-${readinessCost}`,
    forecastDetail: `${segment?.name ?? "近接戦線"}へ接続。現守備${defenders.length}旅団、主脅威${mapEnemyDisplayName(leadThreat)}を受け止める。`,
    forecastTone: reserveCandidates.length > 0 ? "cost" : "risk",
  };
};

const enemyCommandGroupResponseStatus = (
  battle: BattleState,
  units: EnemyBattleUnit[],
  targetSegment: BattleState["frontlineSegments"][number] | undefined,
): Pick<
  EnemyCommandGroupReport,
  "activeResponseAction" | "responseStatusLabel" | "responseStatusDetail" | "responseStatusTone"
> => {
  const unitIds = new Set(units.map((unit) => unit.id));
  const actionUnits = battle.playerUnits.filter((unit) => unit.soldiers > 0 && unit.enemyCommandActionRole);
  const fireUnits = actionUnits.filter(
    (unit) => unit.enemyCommandActionRole === "command_node_fire" && !!unit.focusTargetId && unitIds.has(unit.focusTargetId),
  );
  if (fireUnits.length > 0) {
    return {
      activeResponseAction: "fire",
      responseStatusLabel: "効果中 指揮核射撃",
      responseStatusDetail: `${fireUnits.length}旅団が同指揮群を集中射撃中。再投入不可、対象変更は詳細から行う。`,
      responseStatusTone: "locked",
    };
  }
  const pursuitUnits = actionUnits.filter(
    (unit) => unit.enemyCommandActionRole === "collapse_pursuit" && !!unit.focusTargetId && unitIds.has(unit.focusTargetId),
  );
  if (pursuitUnits.length > 0) {
    return {
      activeResponseAction: "pursuit",
      responseStatusLabel: "効果中 崩壊追撃",
      responseStatusDetail: `${pursuitUnits.length}旅団が同指揮群を掃討中。再投入不可、追撃先の変化を待つ。`,
      responseStatusTone: "locked",
    };
  }
  const reserveUnits = actionUnits.filter(
    (unit) =>
      unit.enemyCommandActionRole === "command_reserve_commit" &&
      (!!unit.focusTargetId && unitIds.has(unit.focusTargetId) || unit.standingOrder.frontlineSegmentId === targetSegment?.id),
  );
  if (reserveUnits.length > 0) {
    return {
      activeResponseAction: "reserve",
      responseStatusLabel: "効果中 予備接続",
      responseStatusDetail: `${reserveUnits.length}旅団が${targetSegment?.name ?? "担当戦線"}へ接続中。予備即応を消費済み。`,
      responseStatusTone: "active",
    };
  }
  return {
    responseStatusLabel: "未対応",
    responseStatusDetail: "推奨または個別対応を選択可能。",
    responseStatusTone: "idle",
  };
};

const enemyCommandGroupResponseEffect = (
  battle: BattleState,
  units: EnemyBattleUnit[],
  targetSegment: BattleState["frontlineSegments"][number] | undefined,
  responseStatus: Pick<EnemyCommandGroupReport, "activeResponseAction">,
): Pick<EnemyCommandGroupReport, "responseEffectLabel" | "responseEffectDetail" | "responseEffectTone"> => {
  if (!responseStatus.activeResponseAction) {
    return {
      responseEffectLabel: "効果 未測定",
      responseEffectDetail: "対応実行後に指揮崩壊、凝集、戦線補強を測定する。",
      responseEffectTone: "idle",
    };
  }
  const disruptedCount = units.filter((unit) => unit.assaultPlan.commandState === "disrupted").length;
  const routingCount = units.filter(
    (unit) => unit.assaultPlan.moraleState === "routing" || unit.assaultPlan.moraleState === "regrouping",
  ).length;
  const averageCohesion =
    units.length > 0 ? units.reduce((sum, unit) => sum + unit.assaultPlan.cohesion, 0) / units.length : 1;
  const totalPressure = units.reduce(
    (sum, unit) => sum + unit.count * unit.pressure * (0.75 + unit.assaultPlan.commandInfluence),
    0,
  );
  if (responseStatus.activeResponseAction === "fire") {
    const averageInfluence =
      units.length > 0 ? units.reduce((sum, unit) => sum + unit.assaultPlan.commandInfluence, 0) / units.length : 0;
    return {
      responseEffectLabel: `効果 指揮崩壊${disruptedCount}群 / 影響${Math.round(averageInfluence * 100)}%`,
      responseEffectDetail: `凝集${Math.round(averageCohesion * 100)}%。指揮影響が下がるほど同群の再集結と突撃圧が鈍る。`,
      responseEffectTone: disruptedCount > 0 || averageInfluence < 0.45 ? "effect" : "cost",
    };
  }
  if (responseStatus.activeResponseAction === "pursuit") {
    const remainingCount = Math.round(units.reduce((sum, unit) => sum + unit.count, 0));
    return {
      responseEffectLabel: `効果 再集結抑止${routingCount}群 / 残敵${remainingCount}`,
      responseEffectDetail: `凝集${Math.round(averageCohesion * 100)}%。低凝集なら追撃で圧力を早く戦線外へ流せる。`,
      responseEffectTone: routingCount > 0 || averageCohesion < 0.58 ? "effect" : "cost",
    };
  }
  const defenders = targetSegment
    ? battle.playerUnits.filter(
        (unit) =>
          unit.soldiers > 0 &&
          unit.order !== "retreat" &&
          unit.standingOrder.frontlineSegmentId === targetSegment.id,
      ).length
    : 0;
  const pressurePerDefender = defenders > 0 ? totalPressure / defenders : totalPressure;
  return {
    responseEffectLabel: `効果 戦線補強 / 守備${defenders}旅団 / 1旅団圧${Math.round(pressurePerDefender)}`,
    responseEffectDetail: `${targetSegment?.name ?? "担当戦線"}の受け止め量を測定中。1旅団圧が下がるほど突破封鎖が安定する。`,
    responseEffectTone: defenders <= 0 ? "risk" : pressurePerDefender <= 520 ? "effect" : "cost",
  };
};

const enemyCommandGroupReports = (battle: BattleState): EnemyCommandGroupReport[] => {
  const groups = new Map<string, EnemyBattleUnit[]>();
  for (const enemy of battle.enemyUnits.filter((unit) => unit.count > 0 && unit.isSpotted)) {
    const key = enemy.assaultPlan.commandGroupId ?? enemy.assaultPlan.commandSourceId ?? enemy.id;
    groups.set(key, [...(groups.get(key) ?? []), enemy]);
  }

  return [...groups.entries()]
    .map(([id, units]) => {
      const source =
        units.find((unit) => unit.assaultPlan.commandRole === "command_node") ??
        units.find((unit) => unit.type === "undeadOfficer") ??
        units.find((unit) => unit.id === units[0]?.assaultPlan.commandSourceId);
      const leadThreat = [...units].sort((a, b) => enemyThreatScore(b) - enemyThreatScore(a))[0];
      const targetSegment = leadThreat ? enemyThreatSegment(battle, leadThreat) : undefined;
      const totalCount = units.reduce((sum, unit) => sum + unit.count, 0);
      const totalPressure = units.reduce((sum, unit) => sum + unit.count * unit.pressure * (0.75 + unit.assaultPlan.commandInfluence), 0);
      const averageInfluence =
        units.length > 0
          ? units.reduce((sum, unit) => sum + unit.assaultPlan.commandInfluence, 0) / units.length
          : 0;
      const commandTierCounts = units.reduce<Partial<Record<EnemyCommandTier, number>>>((counts, unit) => {
        const tier = unit.assaultPlan.commandTier ?? "none";
        counts[tier] = (counts[tier] ?? 0) + 1;
        return counts;
      }, {});
      const commandTierSummary = (["wave_command", "assault_lead", "support_node", "line_group"] as EnemyCommandTier[])
        .filter((tier) => (commandTierCounts[tier] ?? 0) > 0)
        .map((tier) => `${enemyCommandTierLabels[tier]}${commandTierCounts[tier]}`)
        .join(" / ");
      const commandedCount = units.filter((unit) => unit.assaultPlan.commandState === "commanded").length;
      const disruptedCount = units.filter((unit) => unit.assaultPlan.commandState === "disrupted").length;
      const state =
        disruptedCount > commandedCount
          ? "disrupted"
          : commandedCount > 0
            ? "commanded"
            : (leadThreat?.assaultPlan.commandState ?? "none");
      const pursuitCandidates = battle.enemyUnits.filter(
        (unit) =>
          unit.count > 0 &&
          unit.isSpotted &&
          (units.some((groupUnit) => groupUnit.id === unit.id) ||
            unit.assaultPlan.commandGroupId === id ||
            unit.assaultPlan.commandLabel === (source?.assaultPlan.commandLabel ?? leadThreat?.assaultPlan.commandLabel) ||
            (!!targetSegment?.id && unit.assaultPlan.targetSegmentId === targetSegment.id)) &&
          enemyPursuitOpportunityScore(unit) > 0,
      );
      const pursuitTarget = [...pursuitCandidates].sort(
        (a, b) =>
          enemyPursuitOpportunityScore(b) - enemyPursuitOpportunityScore(a) ||
          a.assaultPlan.cohesion - b.assaultPlan.cohesion ||
          enemyThreatScore(b) - enemyThreatScore(a),
      )[0];
      const pursuitOpportunityScore = pursuitTarget ? enemyPursuitOpportunityScore(pursuitTarget) : 0;
      const recommendation = enemyCommandGroupRecommendation(units, leadThreat, pursuitOpportunityScore, totalPressure);
      const forecast = enemyCommandGroupForecast(
        battle,
        units,
        source,
        leadThreat,
        targetSegment,
        recommendation,
        pursuitTarget,
        pursuitOpportunityScore,
      );
      const responseStatus = enemyCommandGroupResponseStatus(battle, units, targetSegment);
      const responseEffect = enemyCommandGroupResponseEffect(battle, units, targetSegment, responseStatus);
      return {
        id,
        label: source?.assaultPlan.commandLabel ?? leadThreat?.assaultPlan.commandLabel ?? `${leadThreat?.assaultPlan.targetName ?? "敵群"}指揮`,
        intent: source?.assaultPlan.commandIntent ?? leadThreat?.assaultPlan.commandIntent ?? "press_line",
        state,
        source,
        units,
        targetName: leadThreat?.assaultPlan.targetName ?? "不明",
        targetSegment,
        totalCount,
        totalPressure,
        averageInfluence,
        commandTierSummary,
        ...recommendation,
        ...forecast,
        ...responseStatus,
        ...responseEffect,
        leadThreat,
        pursuitTarget,
        pursuitReason: enemyPursuitReason(pursuitTarget),
        pursuitOpportunityScore,
      };
    })
    .filter((report) => report.units.length > 1 || report.source || report.averageInfluence >= 0.1)
    .sort((a, b) => b.totalPressure - a.totalPressure)
    .slice(0, 5);
};

const enemyCommandGroupUnitsInState = (battle: BattleState, group: EnemyCommandGroupReport): EnemyBattleUnit[] => {
  const groupIds = new Set(group.units.map((unit) => unit.id));
  return battle.enemyUnits.filter((unit) => groupIds.has(unit.id) && unit.count > 0 && unit.isSpotted);
};

const enemyCommandGroupRelatedUnitsInState = (battle: BattleState, group: EnemyCommandGroupReport): EnemyBattleUnit[] => {
  const groupIds = new Set(group.units.map((unit) => unit.id));
  return battle.enemyUnits.filter(
    (unit) =>
      unit.count > 0 &&
      unit.isSpotted &&
      (groupIds.has(unit.id) ||
        unit.assaultPlan.commandGroupId === group.id ||
        unit.assaultPlan.commandLabel === group.label ||
        (!!group.targetSegment?.id && unit.assaultPlan.targetSegmentId === group.targetSegment.id)),
  );
};

const enemyCommandGroupPrimaryTarget = (
  battle: BattleState,
  group: EnemyCommandGroupReport,
  mode: "command_node" | "pursuit" | "lead",
): EnemyBattleUnit | undefined => {
  const units = enemyCommandGroupUnitsInState(battle, group);
  if (units.length === 0) {
    return undefined;
  }
  if (mode === "command_node") {
    return (
      units.find((unit) => unit.assaultPlan.commandRole === "command_node") ??
      units.find((unit) => unit.type === "undeadOfficer") ??
      units.find((unit) => unit.id === group.source?.id) ??
      [...units].sort((a, b) => b.assaultPlan.commandInfluence - a.assaultPlan.commandInfluence || enemyThreatScore(b) - enemyThreatScore(a))[0]
    );
  }
  if (mode === "pursuit") {
    const candidates = enemyCommandGroupRelatedUnitsInState(battle, group);
    return [...candidates]
      .filter((unit) => enemyPursuitOpportunityScore(unit) > 0)
      .sort(
        (a, b) =>
          enemyPursuitOpportunityScore(b) - enemyPursuitOpportunityScore(a) ||
          a.assaultPlan.cohesion - b.assaultPlan.cohesion ||
          enemyThreatScore(b) - enemyThreatScore(a),
      )[0];
  }
  return units.find((unit) => unit.id === group.leadThreat.id) ?? [...units].sort((a, b) => enemyThreatScore(b) - enemyThreatScore(a))[0];
};

const enemyCommandGroupCanPursue = (group: EnemyCommandGroupReport): boolean =>
  group.pursuitOpportunityScore > 0;

const enemyCommandGroupActionLocked = (
  group: EnemyCommandGroupReport,
  action: EnemyCommandGroupReport["recommendedAction"],
): boolean => group.activeResponseAction === action;

const frontlineResponseType = (
  level: FrontlinePressureReport["level"],
  leadEnemy?: EnemyBattleUnit,
  reserveReadiness = 0,
  battleReserveDoctrine = defaultReserveDoctrinePlan,
): FrontlinePressureReport["responseType"] => {
  if (!leadEnemy || level === "quiet") {
    return "hold";
  }
  if (leadEnemy.assaultPlan.phase === "breakthrough") {
    return "seal_breach";
  }
  if (leadEnemy.assaultPlan.phase === "overextended") {
    return "counterstroke";
  }
  if (
    reserveReadiness >= battleReserveDoctrine.counterstrokeReadinessThreshold &&
    (leadEnemy.assaultPlan.phase === "engaged" || leadEnemy.assaultPlan.phase === "flanking") &&
    (leadEnemy.assaultPlan.moraleState === "wavering" ||
      leadEnemy.assaultPlan.commandState === "disrupted" ||
      leadEnemy.assaultPlan.cohesion < 0.54)
  ) {
    return "counterstroke";
  }
  if (leadEnemy.assaultPlan.phase === "flanking") {
    return reserveReadiness >= battleReserveDoctrine.holdReadinessUntilPressure * 0.08 ||
      battleReserveDoctrine.mode === "elastic_reserve"
      ? "reserve_commit"
      : level === "danger"
        ? "reserve_commit"
        : "elastic";
  }
  return level === "danger" ? "seal_breach" : level === "warning" ? "elastic" : "hold";
};

const frontlineResponseLabel = (responseType: FrontlinePressureReport["responseType"], level: FrontlinePressureReport["level"]) => {
  const labels: Record<FrontlinePressureReport["responseType"], string> = {
    hold: level === "watch" ? "固守監視" : "維持",
    reserve_commit: "予備投入",
    seal_breach: "突破封鎖",
    counterstroke: "局地反撃",
    elastic: "弾性防御",
  };
  return labels[responseType];
};

const frontlineResponsePosture = (
  responseType: FrontlinePressureReport["responseType"],
): BattleUnit["standingOrder"]["posture"] => {
  const posture: Record<FrontlinePressureReport["responseType"], BattleUnit["standingOrder"]["posture"]> = {
    hold: "hold_line",
    reserve_commit: "elastic_defense",
    seal_breach: "fallback_guard",
    counterstroke: "aggressive_screen",
    elastic: "elastic_defense",
  };
  return posture[responseType];
};

const frontlineReserveUnits = (
  battle: BattleState,
  segment: BattleState["frontlineSegments"][number],
  defenders: BattleUnit[],
  leadEnemy?: EnemyBattleUnit,
): BattleUnit[] => {
  const defenderIds = new Set(defenders.map((unit) => unit.unitId));
  const target = leadEnemy?.position ?? segment.anchor;
  return battle.playerUnits
    .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && !defenderIds.has(unit.unitId))
    .sort((a, b) => {
      const aReserveScore =
        a.standingOrder.frontlineSegmentId?.includes("reserve") || a.standingOrder.posture === "fire_support" ? -18 : 0;
      const bReserveScore =
        b.standingOrder.frontlineSegmentId?.includes("reserve") || b.standingOrder.posture === "fire_support" ? -18 : 0;
      return (
        aReserveScore +
        distance(a.position, target) +
        distance(a.standingOrder.anchor, segment.anchor) * 0.35 -
        (a.reserveReadiness ?? 0) * 0.22 -
        (bReserveScore + distance(b.position, target) + distance(b.standingOrder.anchor, segment.anchor) * 0.35 - (b.reserveReadiness ?? 0) * 0.22)
      );
    })
    .slice(0, leadEnemy?.assaultPlan.phase === "breakthrough" ? 2 : 1);
};

const frontlinePressureLevelLabels: Record<FrontlinePressureReport["level"], string> = {
  quiet: "平常",
  watch: "接敵",
  warning: "圧迫",
  danger: "危険",
};

interface FrontlineDoctrineAssessment {
  tone: "recommended" | "caution" | "neutral";
  casualtyRisk: "低" | "中" | "高";
  ammoBurn: "低" | "中" | "高";
  lineRisk: "低" | "中" | "高";
  reason: string;
}

interface StaffFrontlineAdvisory {
  id: string;
  severity: "danger" | "warning" | "info";
  urgencyScore: number;
  segment: BattleState["frontlineSegments"][number];
  report: FrontlinePressureReport;
  preset: FrontlineDoctrinePreset;
  assessment: FrontlineDoctrineAssessment;
  title: string;
  detail: string;
}

const frontlineDoctrineTone = (
  presetId: FrontlineDoctrinePresetId,
  report?: FrontlinePressureReport,
): "recommended" | "caution" | "neutral" => {
  if (!report) {
    return "neutral";
  }
  if (report.level === "danger" && (presetId === "elastic_refuse" || presetId === "ammo_delay")) {
    return "recommended";
  }
  if (report.level === "warning" && (presetId === "kill_zone" || presetId === "elastic_refuse")) {
    return "recommended";
  }
  if (report.level === "watch" && (presetId === "line_hold" || presetId === "ammo_delay")) {
    return "recommended";
  }
  if (presetId === "engineer_repair" && report.segment) {
    return "neutral";
  }
  if (report.level === "danger" && presetId === "line_hold") {
    return "caution";
  }
  return "neutral";
};

const frontlineDoctrineAssessment = (
  preset: FrontlineDoctrinePreset,
  report: FrontlinePressureReport | undefined,
  preview: ReturnType<typeof frontlineDoctrinePreview>,
): FrontlineDoctrineAssessment => {
  const pressure = report?.pressure ?? 0;
  const level = report?.level ?? "quiet";
  const leadEnemy = report?.leadEnemy;
  const lowAmmo = preview.ammo > 0 && preview.ammo < 35;
  const lowMorale = preview.morale > 0 && preview.morale < 48;
  const damagedFacility = preview.damagedStructures > 0;
  const breakthrough =
    leadEnemy?.assaultPlan.phase === "breakthrough" || leadEnemy?.assaultPlan.phase === "flanking";

  if (preset.id === "kill_zone") {
    return {
      tone: lowAmmo ? "caution" : level === "warning" || level === "danger" || leadEnemy?.type === "brute" ? "recommended" : "neutral",
      casualtyRisk: breakthrough ? "中" : "低",
      ammoBurn: "高",
      lineRisk: lowAmmo ? "中" : "低",
      reason: lowAmmo
        ? "弾薬不足で長続きしない"
        : leadEnemy
          ? `${mapEnemyDisplayName(leadEnemy)}を突破前に削る`
          : "接敵前の強射準備",
    };
  }

  if (preset.id === "elastic_refuse") {
    return {
      tone: level === "danger" || lowMorale || breakthrough ? "recommended" : "neutral",
      casualtyRisk: "中",
      ammoBurn: "低",
      lineRisk: pressure > 900 ? "中" : "低",
      reason: lowMorale
        ? "士気低下時に後退線へ逃がす"
        : breakthrough
          ? "側面/突破圧を受け流す"
          : "圧迫下で兵力を残す",
    };
  }

  if (preset.id === "ammo_delay") {
    return {
      tone: lowAmmo || level === "watch" ? "recommended" : breakthrough ? "caution" : "neutral",
      casualtyRisk: pressure > 700 ? "高" : "中",
      ammoBurn: "低",
      lineRisk: breakthrough ? "高" : "中",
      reason: lowAmmo ? "弾薬を温存して時間を買う" : "敵接近まで射撃を抑える",
    };
  }

  if (preset.id === "engineer_repair") {
    return {
      tone: damagedFacility ? "recommended" : "neutral",
      casualtyRisk: pressure > 620 ? "中" : "低",
      ammoBurn: "低",
      lineRisk: pressure > 900 ? "中" : "低",
      reason: damagedFacility ? "損傷施設を修理して戦線支点を戻す" : "損傷施設なし、施設防衛寄り",
    };
  }

  return {
    tone: level === "quiet" || level === "watch" ? "recommended" : level === "danger" ? "caution" : "neutral",
    casualtyRisk: pressure > 900 ? "高" : pressure > 420 ? "中" : "低",
    ammoBurn: "中",
    lineRisk: breakthrough ? "高" : pressure > 900 ? "中" : "低",
    reason: level === "quiet" ? "現配置を崩さず敵を待つ" : "戦線を動かさず射撃を継続",
  };
};

const frontlinePresetById = (presetId: FrontlineDoctrinePresetId): FrontlineDoctrinePreset =>
  frontlineDoctrinePresets.find((preset) => preset.id === presetId) ?? frontlineDoctrinePresets[0];

const doctrineLessonPreferenceForReport = (report: FrontlinePressureReport): FrontlineDoctrinePresetId | undefined => {
  const counts = new Map<FrontlineDoctrinePresetId, number>();
  for (const unit of report.defenders) {
    const preferred = unit.tacticalLessonPreferredDoctrineId as FrontlineDoctrinePresetId | undefined;
    if (!preferred || !frontlineDoctrinePresets.some((preset) => preset.id === preferred)) {
      continue;
    }
    counts.set(preferred, (counts.get(preferred) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const doctrineLessonPreferenceIsUsable = (
  preferred: FrontlineDoctrinePresetId,
  report: FrontlinePressureReport,
  preview: ReturnType<typeof frontlineDoctrinePreview>,
): boolean => {
  const leadEnemy = report.leadEnemy;
  const breakthrough =
    leadEnemy?.assaultPlan.phase === "breakthrough" || leadEnemy?.assaultPlan.phase === "flanking";
  if (preferred === "engineer_repair") {
    return preview.damagedStructures > 0;
  }
  if (preferred === "ammo_delay") {
    return preview.ammo > 0 && preview.ammo < 45;
  }
  if (preferred === "elastic_refuse") {
    return report.level === "danger" || breakthrough || (preview.morale > 0 && preview.morale < 55);
  }
  if (preferred === "kill_zone") {
    return report.pressure >= 360 || !!leadEnemy;
  }
  return report.level === "quiet" || report.level === "watch";
};

const recommendedDoctrineForReport = (
  report: FrontlinePressureReport,
  preview: ReturnType<typeof frontlineDoctrinePreview>,
): FrontlineDoctrinePreset => {
  const leadEnemy = report.leadEnemy;
  const lowAmmo = preview.ammo > 0 && preview.ammo < 35;
  const lowMorale = preview.morale > 0 && preview.morale < 48;
  const damagedFacility = preview.damagedStructures > 0;
  const lessonPreference = doctrineLessonPreferenceForReport(report);

  if (damagedFacility && report.pressure < 700) {
    return frontlinePresetById("engineer_repair");
  }
  if (lowAmmo) {
    return frontlinePresetById("ammo_delay");
  }
  if (lowMorale || leadEnemy?.assaultPlan.phase === "flanking" || leadEnemy?.assaultPlan.phase === "breakthrough") {
    return frontlinePresetById("elastic_refuse");
  }
  if (lessonPreference && doctrineLessonPreferenceIsUsable(lessonPreference, report, preview)) {
    return frontlinePresetById(lessonPreference);
  }
  if (
    report.level === "warning" ||
    report.level === "danger" ||
    leadEnemy?.type === "brute" ||
    leadEnemy?.assaultPlan.mode === "breacher"
  ) {
    return frontlinePresetById("kill_zone");
  }
  if (report.level === "watch") {
    return frontlinePresetById("line_hold");
  }
  return damagedFacility ? frontlinePresetById("engineer_repair") : frontlinePresetById("line_hold");
};

const staffFrontlineAdvisories = (
  battle: BattleState,
  reports: FrontlinePressureReport[],
): StaffFrontlineAdvisory[] =>
  reports
    .flatMap((report) => {
      const preview = frontlineDoctrinePreview(battle, report.segment, report);
      const lowAmmo = preview.ammo > 0 && preview.ammo < 35;
      const lowMorale = preview.morale > 0 && preview.morale < 48;
      const damagedFacility = preview.damagedStructures > 0;
      const leadPhase = report.leadEnemy?.assaultPlan.phase;
      const seriousPhase = leadPhase === "flanking" || leadPhase === "breakthrough";
      const shouldShow =
        report.level !== "quiet" || lowAmmo || lowMorale || damagedFacility || report.defenders.length === 0;
      if (!shouldShow) {
        return [];
      }

      const preset = recommendedDoctrineForReport(report, preview);
      const assessment = frontlineDoctrineAssessment(preset, report, preview);
      const lessonPreference = doctrineLessonPreferenceForReport(report);
      const severity: StaffFrontlineAdvisory["severity"] =
        report.level === "danger" || seriousPhase || report.defenders.length === 0
          ? "danger"
          : report.level === "warning" || lowAmmo || lowMorale || damagedFacility
            ? "warning"
            : "info";
      const urgencyScore =
        (severity === "danger" ? 1000 : severity === "warning" ? 620 : 260) +
        report.pressure +
        (lowAmmo ? 160 : 0) +
        (lowMorale ? 180 : 0) +
        (damagedFacility ? 140 : 0) +
        (report.defenders.length === 0 ? 300 : 0);
      const threat = report.leadEnemy
        ? `${mapEnemyDisplayName(report.leadEnemy)} ${enemyAssaultPhaseLabels[report.leadEnemy.assaultPlan.phase]}`
        : "主脅威なし";
      const detail = [
        `敵圧${Math.round(report.pressure)}`,
        `守備${report.defenders.length}`,
        `予備${report.reserves.length}`,
        lowAmmo ? `弾薬${preview.ammo}` : undefined,
        lowMorale ? `士気${preview.morale}` : undefined,
        damagedFacility ? `損傷施設${preview.damagedStructures}` : undefined,
        lessonPreference ? `教訓${frontlinePresetById(lessonPreference).label}` : undefined,
        threat,
      ]
        .filter(Boolean)
        .join(" / ");
      return [
        {
          id: `staff-${report.segment.id}`,
          severity,
          urgencyScore,
          segment: report.segment,
          report,
          preset,
          assessment,
          title: `${report.segment.name}: ${preset.label}`,
          detail,
        },
      ];
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 4);

const frontlineDoctrinePreview = (
  battle: BattleState,
  segment: BattleState["frontlineSegments"][number] | undefined,
  report: FrontlinePressureReport | undefined,
) => {
  if (!segment) {
    return {
      morale: 0,
      ammo: 0,
      damagedStructures: 0,
      facilityCount: 0,
      leadThreat: "なし",
      pressureLevel: "平常",
    };
  }
  const defenders = report?.defenders ?? [];
  const morale =
    defenders.length > 0 ? Math.round(defenders.reduce((sum, unit) => sum + unit.morale, 0) / defenders.length) : 0;
  const ammo =
    defenders.length > 0 ? Math.round(defenders.reduce((sum, unit) => sum + unit.ammo, 0) / defenders.length) : 0;
  const localStructures = battle.structures.filter(
    (structure) =>
      structure.position.x >= segment.zone.x &&
      structure.position.x <= segment.zone.x + segment.zone.width &&
      structure.position.y >= segment.zone.y &&
      structure.position.y <= segment.zone.y + segment.zone.height,
  );
  const damagedStructures = localStructures.filter(
    (structure) => structure.status === "damaged" || structure.status === "overrun",
  ).length;
  return {
    morale,
    ammo,
    damagedStructures,
    facilityCount: localStructures.length,
    leadThreat: report?.leadEnemy
      ? `${mapEnemyDisplayName(report.leadEnemy)} ${enemyAssaultPhaseLabels[report.leadEnemy.assaultPlan.phase]}`
      : "なし",
    pressureLevel: report?.level ? frontlinePressureLevelLabels[report.level] : "平常",
  };
};

const frontlinePressureReports = (battle: BattleState): FrontlinePressureReport[] =>
  battle.frontlineSegments.map((segment) => {
    const enemies = battle.enemyUnits.filter((enemy) => {
      if (!enemy.isSpotted || enemy.count <= 0) {
        return false;
      }
      const assignedSegment = enemyThreatSegment(battle, enemy);
      return assignedSegment?.id === segment.id || distance(enemy.position, segment.anchor) <= segment.controlRadius + 18;
    });
    const pressure = enemies.reduce((sum, enemy) => {
      const phaseFactor =
        enemy.assaultPlan.phase === "breakthrough"
          ? 1.48
          : enemy.assaultPlan.phase === "flanking"
            ? 1.22
            : enemy.assaultPlan.phase === "overextended"
              ? 0.92
              : 1;
      return sum + enemy.count * enemy.pressure * phaseFactor + enemy.assaultPlan.flankPressure * 0.16;
    }, 0);
    const defenders = battle.playerUnits
      .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.standingOrder.frontlineSegmentId === segment.id)
      .sort((a, b) => a.morale - b.morale || distance(a.position, segment.anchor) - distance(b.position, segment.anchor));
    const leadEnemy = [...enemies].sort((a, b) => enemyPressureLeadScore(b) - enemyPressureLeadScore(a))[0];
    const level: FrontlinePressureReport["level"] =
      pressure > 1100 ? "danger" : pressure > 620 ? "warning" : pressure > 0 ? "watch" : "quiet";
    const reserves = frontlineReserveUnits(battle, segment, defenders, leadEnemy);
    const readyReserves = reserves.filter((unit) => (unit.reserveReadiness ?? 0) >= 52);
    const reserveReadiness = reserves.reduce((sum, unit) => sum + (unit.reserveReadiness ?? 0), 0);
    const responseType = frontlineResponseType(level, leadEnemy, reserveReadiness, battle.reserveDoctrine);
    const posture = frontlineResponsePosture(responseType);
    return {
      segment,
      pressure,
      enemyCount: enemies.length,
      defenders,
      reserves,
      readyReserves,
      reserveReadiness,
      leadEnemy,
      level,
      posture,
      responseType,
      recommendationLabel: frontlineResponseLabel(responseType, level),
    };
  });

const frontlineRotationStressScore = (unit: BattleUnit): number => {
  const soldierRatio = unit.maxSoldiers > 0 ? unit.soldiers / unit.maxSoldiers : 0;
  return (100 - unit.morale) * 0.9 + (100 - unit.condition) * 0.35 + (100 - unit.ammo) * 0.18 + (1 - soldierRatio) * 48;
};

const frontlineRotationReserveReadout = (
  unit: BattleUnit,
  report: FrontlinePressureReport,
  allReports: FrontlinePressureReport[] = [],
): FrontlineRotationReserveReadout => {
  const segmentId = unit.standingOrder.frontlineSegmentId ?? "";
  const sourceReport = allReports.find((candidate) => candidate.segment.id === segmentId);
  if (segmentId.includes("reserve")) {
    return {
      label: "予備線",
      detail: "主戦線を薄くしない",
      tone: "ready",
      scoreModifier: 34,
    };
  }
  if (unit.standingOrder.posture === "fire_support" || unit.type === "artillery") {
    return {
      label: "火力予備",
      detail: "火力穴埋め向き",
      tone: "ready",
      scoreModifier: 18,
    };
  }
  if (unit.standingOrder.posture === "fallback_guard") {
    return {
      label: "後退守備",
      detail: "交代援護向き",
      tone: "ready",
      scoreModifier: 16,
    };
  }
  if (!sourceReport) {
    return {
      label: "戦線外",
      detail: "出所不明の転用",
      tone: "caution",
      scoreModifier: -12,
    };
  }
  if (sourceReport.segment.id === report.segment.id) {
    return {
      label: "同戦線",
      detail: "局地再配置",
      tone: "caution",
      scoreModifier: -8,
    };
  }
  if (sourceReport.level === "danger" || sourceReport.pressure > 1100) {
    return {
      label: "危険転用",
      detail: `${sourceReport.segment.name}も危険`,
      tone: "danger",
      scoreModifier: -72,
    };
  }
  if (sourceReport.level === "warning" || sourceReport.level === "watch") {
    return {
      label: "戦線転用",
      detail: `${sourceReport.segment.name}を薄くする`,
      tone: "caution",
      scoreModifier: -42,
    };
  }
  return {
    label: "静穏線転用",
    detail: `${sourceReport.segment.name}から抽出`,
    tone: "caution",
    scoreModifier: -22,
  };
};

const frontlineRotationReserveScore = (
  unit: BattleUnit,
  report: FrontlinePressureReport,
  allReports: FrontlinePressureReport[] = [],
): number =>
  (unit.reserveReadiness ?? 0) +
  frontlineRotationReserveReadout(unit, report, allReports).scoreModifier +
  unit.morale * 0.12 +
  unit.condition * 0.08;

const frontlineRotationOptions = (
  report: FrontlinePressureReport,
  allReports: FrontlinePressureReport[] = [],
): FrontlineRotationOptions => {
  if (report.level === "quiet") {
    return { tiredUnits: [], reserveUnits: [] };
  }
  const tiredUnits = [...report.defenders].sort(
    (a, b) => frontlineRotationStressScore(b) - frontlineRotationStressScore(a),
  );
  const reserveUnits = [...report.reserves].sort(
    (a, b) => frontlineRotationReserveScore(b, report, allReports) - frontlineRotationReserveScore(a, report, allReports),
  );
  return {
    tiredUnits,
    reserveUnits,
    defaultTiredUnit: tiredUnits[0],
    defaultReserveUnit: reserveUnits[0],
  };
};

const frontlineRotationPreview = (
  report: FrontlinePressureReport,
  tiredUnitId?: string,
  reserveUnitId?: string,
  allReports: FrontlinePressureReport[] = [],
): FrontlineRotationPreview | undefined => {
  const options = frontlineRotationOptions(report, allReports);
  const tiredUnit = options.tiredUnits.find((unit) => unit.unitId === tiredUnitId) ?? options.defaultTiredUnit;
  const reserveUnit = options.reserveUnits.find((unit) => unit.unitId === reserveUnitId) ?? options.defaultReserveUnit;
  if (!tiredUnit || !reserveUnit) {
    return undefined;
  }
  const tiredRatio = tiredUnit.maxSoldiers > 0 ? Math.round((tiredUnit.soldiers / tiredUnit.maxSoldiers) * 100) : 0;
  return {
    tiredUnit,
    reserveUnit,
    label: "戦闘交代",
    detail: `${mapUnitDisplayName(tiredUnit)} 士気${Math.round(tiredUnit.morale)} / 兵力${tiredRatio}% -> ${mapUnitDisplayName(
      reserveUnit,
    )} 即応${Math.round(reserveUnit.reserveReadiness ?? 0)} / ${frontlineRotationReserveReadout(
      reserveUnit,
      report,
      allReports,
    ).label}`,
  };
};

const mapPostureLabel = (unit: BattleUnit): string => {
  const labels: Record<BattleUnit["standingOrder"]["posture"], string> = {
    hold_line: "固守",
    elastic_defense: "弾防",
    aggressive_screen: "阻止",
    fire_support: "支援",
    engineer_support: "工兵",
    fallback_guard: "後衛",
  };
  return labels[unit.standingOrder.posture];
};

const fieldStyle = (battle: BattleState, position: BattlePosition): CSSProperties => ({
  left: `${(position.x / battle.mapBounds.width) * 100}%`,
  top: `${(position.y / battle.mapBounds.height) * 100}%`,
});

const segmentStyle = (battle: BattleState, segment: BattleState["frontlineSegments"][number]): CSSProperties => ({
  left: `${(segment.zone.x / battle.mapBounds.width) * 100}%`,
  top: `${(segment.zone.y / battle.mapBounds.height) * 100}%`,
  width: `${(segment.zone.width / battle.mapBounds.width) * 100}%`,
  height: `${(segment.zone.height / battle.mapBounds.height) * 100}%`,
});

const terrainZoneStyle = (battle: BattleState, zone: BattleState["terrainZones"][number]): CSSProperties => ({
  left: `${((zone.zone.x + zone.zone.width / 2) / battle.mapBounds.width) * 100}%`,
  top: `${((zone.zone.y + zone.zone.height / 2) / battle.mapBounds.height) * 100}%`,
});

const chokePointStyle = (battle: BattleState, choke: BattleChokePoint): CSSProperties => ({
  left: `${((choke.position.x - choke.radius) / battle.mapBounds.width) * 100}%`,
  top: `${((choke.position.y - choke.radius) / battle.mapBounds.height) * 100}%`,
  width: `${((choke.radius * 2) / battle.mapBounds.width) * 100}%`,
  height: `${((choke.radius * 2) / battle.mapBounds.height) * 100}%`,
});

const chokePointLabelStyle = (battle: BattleState, choke: BattleChokePoint): CSSProperties => ({
  left: `${(choke.position.x / battle.mapBounds.width) * 100}%`,
  top: `${(choke.position.y / battle.mapBounds.height) * 100}%`,
});

const mapFieldStyle = (battle: BattleState): CSSProperties => ({
  minWidth: `${Math.max(1280, battle.mapBounds.width * 12)}px`,
});

const segmentName = (battle: BattleState, segmentId?: string): string =>
  battle.frontlineSegments.find((segment) => segment.id === segmentId)?.name ?? "未指定";

const segmentForCommandPosition = (battle: BattleState, position: BattlePosition) => {
  const containingSegments = battle.frontlineSegments.filter(
    (segment) =>
      position.x >= segment.zone.x &&
      position.x <= segment.zone.x + segment.zone.width &&
      position.y >= segment.zone.y &&
      position.y <= segment.zone.y + segment.zone.height,
  );
  const candidates = containingSegments.length > 0 ? containingSegments : battle.frontlineSegments;
  return [...candidates].sort((a, b) => distance(position, a.anchor) - distance(position, b.anchor))[0];
};

const facilityModeForUnit = (unit: BattleUnit, structure: BattleStructure) => {
  if (unit.type === "engineer") {
    return "repair" as const;
  }
  if (structure.type === "supplyDepot") {
    return "resupply" as const;
  }
  return "defend" as const;
};

const facilityLabel = (battle: BattleState, unit: BattleUnit): string => {
  const assignment = unit.standingOrder.facilityAssignment;
  if (!assignment) {
    return "未指定";
  }
  const structure = battle.structures.find((candidate) => candidate.id === assignment.structureId);
  if (!structure) {
    return "未指定";
  }
  return `${fortificationTypeLabels[structure.type]} ${facilityAssignmentModeLabels[assignment.mode]}`;
};

const reserveCommandUnits = (battle: BattleState): BattleUnit[] =>
  [...battle.playerUnits]
    .filter(
      (unit) =>
        unit.soldiers > 0 &&
        unit.order !== "retreat" &&
        (unit.standingOrder.frontlineSegmentId?.includes("reserve") ||
          unit.standingOrder.posture === "fallback_guard" ||
          unit.standingOrder.posture === "fire_support" ||
          unit.type === "artillery" ||
          (unit.reserveReadiness ?? 0) >= 40),
    )
    .sort((a, b) => {
      const aReserveLine = a.standingOrder.frontlineSegmentId?.includes("reserve") ? 1 : 0;
      const bReserveLine = b.standingOrder.frontlineSegmentId?.includes("reserve") ? 1 : 0;
      return bReserveLine - aReserveLine || (b.reserveReadiness ?? 0) - (a.reserveReadiness ?? 0);
    });

const assignedFacilityName = (battle: BattleState, unit: BattleUnit): string => {
  const assignment = unit.standingOrder.facilityAssignment;
  if (!assignment) {
    return "施設未指定";
  }
  const structure = battle.structures.find((candidate) => candidate.id === assignment.structureId);
  if (!structure) {
    return "施設不明";
  }
  return `${fortificationTypeLabels[structure.type]} ${facilityAssignmentModeLabels[assignment.mode]}`;
};

const terrainLabelForPosition = (battle: BattleState, position: BattlePosition): string => {
  const terrain = localTerrainEffect(position, battle.terrainZones);
  return terrain.zoneNames.length > 0 ? terrain.zoneNames.join(" / ") : "開豁地";
};

const effectiveRangeForUnit = (battle: BattleState, unit: BattleUnit): number =>
  unit.range * localTerrainEffect(unit.position, battle.terrainZones).rangeMultiplier;

const lineOfSightLabelForUnit = (battle: BattleState, unit: BattleUnit): string => {
  const target = battle.enemyUnits.find((enemy) => enemy.id === (unit.currentTargetId ?? unit.focusTargetId));
  if (target) {
    const sight = lineOfSightBlockage(unit.position, target.position, battle.terrainZones);
    const modifier = sight.modifiers.length > 0 ? ` / ${sight.modifiers.join("/")}` : "";
    if (sight.blocked) {
      return `遮断 ${sight.blockers.join("/")}${modifier}`;
    }
    return sight.blockage > 0 ? `減衰 ${sight.blockers.join("/")}${modifier}` : `良好${modifier}`;
  }

  const blockedEnemy = battle.enemyUnits
    .filter((enemy) => enemy.isSpotted)
    .map((enemy) => lineOfSightBlockage(unit.position, enemy.position, battle.terrainZones))
    .find((sight) => sight.blocked);
  return blockedEnemy ? `遮断候補 ${blockedEnemy.blockers.join("/")}` : "待機";
};

const targetPriorityRank = (unit: BattleUnit, enemy: EnemyBattleUnit): number => {
  if (unit.focusTargetId === enemy.id) {
    return 0;
  }
  if (unit.standingOrder.targetPriority === "brute" && enemy.type === "brute") {
    return 1;
  }
  if (unit.standingOrder.targetPriority === "officer" && enemy.type === "undeadOfficer") {
    return 1;
  }
  if (unit.standingOrder.targetPriority === "riflemen" && enemy.type === "undeadRiflemen") {
    return 1;
  }
  if (unit.standingOrder.targetPriority === "largest_mass") {
    return 2 - Math.min(1, (enemy.count * enemy.pressure) / 900);
  }
  if (unit.standingOrder.targetPriority === "weakest") {
    return 2 + enemy.count / 1000;
  }
  return 3;
};

const targetAuditForUnit = (battle: BattleState, unit: BattleUnit): TargetAuditEntry[] => {
  const range = effectiveRangeForUnit(battle, unit);
  return battle.enemyUnits
    .filter((enemy) => enemy.count > 0 && enemy.isSpotted)
    .map((enemy) => {
      const lineOfSight = lineOfSightBlockage(unit.position, enemy.position, battle.terrainZones);
      const effectiveRange = range * lineOfSight.rangeMultiplier;
      return {
        enemy,
        distance: distance(unit.position, enemy.position),
        formationDistance: formationDistanceToPoint(unit, enemy.position),
        effectiveRange,
        inArcAndRange: targetWithinFormationArc(unit, enemy.position, effectiveRange),
        lineOfSight,
        isFocusTarget: unit.focusTargetId === enemy.id,
        priorityRank: targetPriorityRank(unit, enemy),
      };
    })
    .sort((a, b) => {
      const aCandidate = a.inArcAndRange && !a.lineOfSight.blocked ? 0 : 1;
      const bCandidate = b.inArcAndRange && !b.lineOfSight.blocked ? 0 : 1;
      return (
        aCandidate - bCandidate ||
        a.priorityRank - b.priorityRank ||
        (unit.standingOrder.targetPriority === "largest_mass"
          ? b.enemy.count * b.enemy.pressure - a.enemy.count * a.enemy.pressure
          : unit.standingOrder.targetPriority === "weakest"
            ? a.enemy.count - b.enemy.count
            : a.formationDistance - b.formationDistance)
      );
    });
};

const targetAuditStatus = (entry: TargetAuditEntry): string => {
  if (!entry.inArcAndRange) {
    return "射界外/遠距離";
  }
  const modifier = entry.lineOfSight.modifiers.length > 0 ? ` ${entry.lineOfSight.modifiers.join("/")}` : "";
  if (entry.lineOfSight.blocked) {
    return `射線遮断 ${entry.lineOfSight.blockers.join("/")}${modifier}`;
  }
  if (entry.isFocusTarget) {
    return "指名目標";
  }
  return entry.lineOfSight.blockage > 0
    ? `射線減衰 ${entry.lineOfSight.blockers.join("/")}${modifier}`
    : `射撃可能${modifier}`;
};

const targetAuditLineClass = (entry: TargetAuditEntry, accepted?: TargetAuditEntry): string => {
  const states = ["target-audit-line"];
  if (accepted?.enemy.id === entry.enemy.id) {
    states.push("accepted");
  }
  if (entry.isFocusTarget) {
    states.push("focused");
  }
  if (!entry.inArcAndRange) {
    states.push("out-of-range");
  } else if (entry.lineOfSight.blocked) {
    states.push("blocked");
  } else if (entry.lineOfSight.blockage > 0) {
    states.push("degraded");
  } else {
    states.push("clear");
  }
  return states.join(" ");
};

const selectedTargetAudit = (battle: BattleState, unit: BattleUnit): TargetAuditEntry | undefined =>
  targetAuditForUnit(battle, unit).find((entry) => entry.inArcAndRange && !entry.lineOfSight.blocked);

const fallbackAuditLabel = (unit: BattleUnit): string => {
  const fallback = unit.standingOrder.fallback;
  if (!fallback.enabled) {
    return "自動後退なし";
  }
  const soldierRatio = unit.soldiers / Math.max(1, unit.maxSoldiers);
  const margins = [
    fallback.moraleBelow !== undefined ? `士気余裕${Math.round(unit.morale - fallback.moraleBelow)}` : undefined,
    fallback.soldiersBelowRatio !== undefined
      ? `兵力余裕${Math.round((soldierRatio - fallback.soldiersBelowRatio) * 100)}%`
      : undefined,
    fallback.ammoBelow !== undefined ? `弾薬余裕${Math.round(unit.ammo - fallback.ammoBelow)}` : undefined,
  ].filter(Boolean);
  return margins.length > 0 ? margins.join(" / ") : "条件未設定";
};

const facilityAuditLabel = (battle: BattleState, unit: BattleUnit): string => {
  const assignment = unit.standingOrder.facilityAssignment;
  if (!assignment) {
    return "施設担当なし";
  }
  const structure = battle.structures.find((candidate) => candidate.id === assignment.structureId);
  if (!structure) {
    return "担当施設不明";
  }
  return `${fortificationTypeLabels[structure.type]} ${facilityAssignmentModeLabels[assignment.mode]} / 距離${Math.round(
    distance(unit.position, structure.position),
  )} / 耐久${Math.round(structure.durability)}`;
};

const commandTransmissionLabel = (battle: BattleState, unit: BattleUnit): string => {
  if (!unit.pendingOrder) {
    return "伝令 待機";
  }
  const remaining = Math.max(0, Math.ceil(unit.pendingOrder.arrivesAt - battle.elapsedSeconds));
  return `伝令 ${remaining}秒 / ${unit.pendingOrder.label}`;
};

const commandTransmissionDetail = (unit: BattleUnit): string =>
  unit.pendingOrder?.reasons?.length
    ? unit.pendingOrder.reasons.join(" / ")
    : unit.pendingOrder?.detail
      ? unit.pendingOrder.detail
      : "発令待機。";

const formationLabel = (unit: BattleUnit): string => formationSummary(unit);

const activeFacingDegForUnit = (unit: BattleUnit): number =>
  normalizeFormationFacingDeg(unit.standingOrder.facingDeg ?? unit.formation.facingDeg);

const clampBattlePoint = (battle: BattleState, point: BattlePosition): BattlePosition => ({
  x: Math.max(0, Math.min(battle.mapBounds.width, point.x)),
  y: Math.max(0, Math.min(battle.mapBounds.height, point.y)),
});

const formationFramePoint = (
  battle: BattleState,
  unit: BattleUnit,
  forwardDistance: number,
  lateralDistance: number,
): BattlePosition => clampBattlePoint(
  battle,
  pointFromFormationFrame(unit.position, unit.formation.facingDeg, forwardDistance, lateralDistance),
);

const formationArcPoints = (battle: BattleState, unit: BattleUnit): string => {
  const range = effectiveRangeForUnit(battle, unit);
  const halfFront = unit.formation.frontageWidth / 2;
  const arcRadians = (unit.formation.fireArcDeg / 2) * (Math.PI / 180);
  const lateral = Math.min(42, halfFront + range * Math.tan(arcRadians));
  const points = [
    formationFramePoint(battle, unit, 0, -halfFront),
    formationFramePoint(battle, unit, range, -lateral),
    formationFramePoint(battle, unit, range, lateral),
    formationFramePoint(battle, unit, 0, halfFront),
  ];
  return points.map((point) => `${point.x},${point.y}`).join(" ");
};

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

const mapCoordinateLabel = (position: BattlePosition): string =>
  `X${Math.round(position.x)} Y${Math.round(position.y)}`;

const frontlineObjectiveSupportOptions = (
  battle: BattleState,
  segment?: BattleState["frontlineSegments"][number],
): FrontlineObjectiveSupportOption[] => {
  if (!segment) {
    return [];
  }
  const defenders = battle.playerUnits.filter(
    (unit) => unit.soldiers > 0 && unit.order !== "retreat" && unit.standingOrder.frontlineSegmentId === segment.id,
  ).length;
  return [...battle.objectiveNodes]
    .sort((a, b) => distance(segment.anchor, a.position) - distance(segment.anchor, b.position))
    .map((node) => {
      const nodeDistance = distance(segment.anchor, node.position);
      const tone = node.control === "enemy" ? "danger" : node.control === "contested" ? "warning" : "ready";
      const reason = node.scenario.effectSummary;
      return {
        node,
        distance: nodeDistance,
        defenders,
        tone,
        reason,
      };
    });
};

const objectiveStaffUrgency = (node: BattleObjectiveNode): number => {
  const base = node.control === "enemy" ? 880 : node.control === "contested" ? 560 : 260;
  const progressPenalty = Math.max(0, 72 - node.controlProgress) * 5;
  const typeBonus = node.type === "victory" ? 90 : node.type === "supply" ? 70 : 55;
  return base + progressPenalty + typeBonus;
};

const objectiveTransferForecast = (
  segment: BattleState["frontlineSegments"][number],
  node: BattleObjectiveNode,
  report: FrontlinePressureReport | undefined,
  defenders: number,
): ObjectiveTransferForecast => {
  const anchorShift = distance(segment.anchor, node.position);
  const reserveCover = report?.readyReserves.length ?? 0;
  const pressure = report?.pressure ?? 0;
  const pressurePerDefender = defenders > 0 ? pressure / defenders : pressure;
  const outsideLine = anchorShift > segment.controlRadius * 1.35;
  const highPressure = report?.level === "danger" || pressurePerDefender > 520;
  const warningPressure = report?.level === "warning" || report?.level === "watch" || pressurePerDefender > 260;
  const noReserveCover = reserveCover === 0 && anchorShift > segment.controlRadius;

  const tone: ObjectiveTransferForecast["tone"] =
    defenders === 0 || (outsideLine && highPressure) || (highPressure && noReserveCover)
      ? "danger"
      : outsideLine || warningPressure || noReserveCover
        ? "warning"
        : "ready";
  const label =
    defenders === 0
      ? "実行不能"
      : tone === "danger"
        ? "原戦線空白"
        : tone === "warning"
          ? "転用注意"
          : "転用許容";
  const detail =
    `${frontlinePressureLevelLabels[report?.level ?? "quiet"]} / ` +
    `敵圧${Math.round(pressure)} / ` +
    `1旅団圧${Math.round(pressurePerDefender)} / ` +
    `即応予備${reserveCover} / ` +
    `移動${Math.round(anchorShift)}`;

  return {
    label,
    detail,
    tone,
    pressurePerDefender,
    reserveCover,
    anchorShift,
  };
};

const objectiveStaffRecommendations = (
  battle: BattleState,
  reports: FrontlinePressureReport[],
): ObjectiveStaffRecommendation[] =>
  battle.objectiveNodes
    .map((node) => {
      const urgency = objectiveStaffUrgency(node);
      const candidates = battle.frontlineSegments.map((segment) => {
        const report = reports.find((candidate) => candidate.segment.id === segment.id);
        const defenders =
          report?.defenders.length ??
          battle.playerUnits.filter(
            (unit) =>
              unit.soldiers > 0 &&
              unit.order !== "retreat" &&
              unit.standingOrder.frontlineSegmentId === segment.id,
          ).length;
        const readyReserve = report?.readyReserves.length ?? 0;
        const segmentPressure = report?.pressure ?? 0;
        const pressurePenalty =
          report?.level === "danger" ? 360 : report?.level === "warning" ? 180 : report?.level === "watch" ? 80 : 0;
        const defenderBonus = defenders > 0 ? Math.min(260, defenders * 95) : -260;
        const reserveBonus = Math.min(80, readyReserve * 40);
        const nodeDistance = distance(segment.anchor, node.position);
        const transferForecast = objectiveTransferForecast(segment, node, report, defenders);
        const transferPenalty =
          transferForecast.tone === "danger" ? 220 : transferForecast.tone === "warning" ? 90 : 0;
        const score = urgency + defenderBonus + reserveBonus - nodeDistance * 6 - pressurePenalty - transferPenalty;
        return {
          id: `objective-staff-${node.id}-${segment.id}`,
          node,
          segment,
          report,
          defenders,
          distance: nodeDistance,
          score,
          tone:
            node.control === "enemy" || report?.level === "danger"
              ? "danger"
              : node.control === "contested" || report?.level === "warning" || report?.level === "watch"
                ? "warning"
                : "ready",
          riskLabel:
            transferForecast.tone === "danger"
              ? transferForecast.label
              : report?.level === "danger"
              ? "転用危険"
              : transferForecast.tone === "warning" || report?.level === "warning" || report?.level === "watch"
                ? "戦線注意"
                : defenders === 0
                  ? "守備なし"
                  : "支援可",
          reason: node.scenario.effectSummary,
          transferForecast,
        } satisfies ObjectiveStaffRecommendation;
      });
      return candidates.sort((a, b) => b.score - a.score)[0];
    })
    .filter((recommendation): recommendation is ObjectiveStaffRecommendation => Boolean(recommendation))
    .sort((a, b) => objectiveStaffUrgency(b.node) - objectiveStaffUrgency(a.node));

const nearestVisibleEnemyForUnit = (battle: BattleState, unit: BattleUnit): EnemyBattleUnit | undefined =>
  [...battle.enemyUnits]
    .filter((enemy) => enemy.count > 0 && enemy.isSpotted)
    .sort((a, b) => distance(unit.position, a.position) - distance(unit.position, b.position))[0];

const fallbackThresholdSummary = (unit: BattleUnit): string => {
  const thresholds = [
    unit.standingOrder.fallback.moraleBelow !== undefined ? `士気${unit.standingOrder.fallback.moraleBelow}` : undefined,
    unit.standingOrder.fallback.soldiersBelowRatio !== undefined
      ? `兵力${Math.round(unit.standingOrder.fallback.soldiersBelowRatio * 100)}%`
      : undefined,
    unit.standingOrder.fallback.ammoBelow !== undefined ? `弾薬${unit.standingOrder.fallback.ammoBelow}` : undefined,
  ].filter(Boolean);
  return thresholds.length > 0 ? thresholds.join("/") : "条件未設定";
};

const actionReasonDetail = (battle: BattleState, unit: BattleUnit): string => {
  const anchorDistance = Math.round(distance(unit.position, unit.standingOrder.anchor));
  const fallback = unit.standingOrder.fallback.destination;
  const target = unit.currentTargetId ? targetName(battle, unit.currentTargetId) : focusTargetName(battle, unit.focusTargetId);
  const nearestEnemy = nearestVisibleEnemyForUnit(battle, unit);
  const nearestEnemyLabel = nearestEnemy
    ? `${mapEnemyDisplayName(nearestEnemy)} 距離${Math.round(distance(unit.position, nearestEnemy.position))}`
    : "発見敵なし";
  const segment = segmentName(battle, unit.standingOrder.frontlineSegmentId);
  const terrain = terrainLabelForPosition(battle, unit.position);

  switch (unit.actionReason) {
    case "firing_target":
      return `射撃判断: ${target} / 優先${targetPriorityLabels[unit.standingOrder.targetPriority]} / ${lineOfSightLabelForUnit(battle, unit)}`;
    case "returning_anchor":
      return `復帰判断: ${segment}の基準から${anchorDistance}離脱 / 半径${unit.standingOrder.controlRadius}`;
    case "holding_anchor":
      return `保持判断: ${segment} / 基準距離${anchorDistance} / 地形${terrain}`;
    case "falling_back":
      return `後退判断: ${fallbackThresholdSummary(unit)}到達 / 後退X${Math.round(fallback.x)} Y${Math.round(fallback.y)}`;
    case "retreating":
      return `撤退命令: 後退X${Math.round(fallback.x)} Y${Math.round(fallback.y)}へ離脱`;
    case "advancing":
      return `前進判断: ${nearestEnemyLabel} / 射程${Math.round(effectiveRangeForUnit(battle, unit))}`;
    case "flanking":
      return `側面判断: ${nearestEnemyLabel} / 戦列${formationLabel(unit)}`;
    case "moving_to_facility":
      return `施設判断: ${assignedFacilityName(battle, unit)}へ近接保持`;
    case "moving_to_supply":
      return `補給判断: ${assignedFacilityName(battle, unit)}へ移動 / 弾薬${Math.round(unit.ammo)}`;
    case "resupplying":
      return `補給中: ${assignedFacilityName(battle, unit)} / 弾薬${Math.round(unit.ammo)}`;
    case "moving_to_repair":
      return `修理判断: ${assignedFacilityName(battle, unit)}または損傷施設へ移動`;
    case "repairing_structure":
      return `修理中: ${assignedFacilityName(battle, unit)} / 工兵支援`;
    case "recovering":
      return `再編判断: 休息/補給命令 / 士気${Math.round(unit.morale)} 弾薬${Math.round(unit.ammo)}`;
    case "destroyed":
      return "戦闘不能: 指揮対象外";
    case "awaiting_orders":
    default:
      return `指示待機: ${segment} / 姿勢${standingPostureLabels[unit.standingOrder.posture]}`;
  }
};

const actionReasonBadge = (battle: BattleState, unit: BattleUnit): string => {
  const detail = actionReasonDetail(battle, unit);
  return detail.length > 30 ? `${detail.slice(0, 30)}...` : detail;
};

const createWithdrawalForecast = (battle: BattleState): WithdrawalForecast => {
  const totalMaxSoldiers = battle.playerUnits.reduce((sum, unit) => sum + unit.maxSoldiers, 0);
  const activeSoldiers = battle.playerUnits.reduce((sum, unit) => sum + Math.max(0, unit.soldiers), 0);
  const rawCasualties = battle.playerUnits.reduce((sum, unit) => sum + Math.round(unit.casualtiesThisBattle), 0);
  const hospitalSupport = battle.structures.reduce((sum, structure) => {
    if (structure.type !== "fieldHospital") {
      return sum;
    }
    if (structure.status === "built") {
      return sum + 0.12;
    }
    if (structure.status === "damaged") {
      return sum + 0.07;
    }
    return sum;
  }, 0);
  const estimatedRecoveryRate = Math.min(
    0.42,
    hospitalSupport * 0.72 + (battle.strategicDoctrine?.medicalRecoveryBonus ?? 0),
  );
  const estimatedPermanentCasualties = Math.max(0, Math.round(rawCasualties * (1 - estimatedRecoveryRate)));
  const activeRatio = totalMaxSoldiers > 0 ? activeSoldiers / totalMaxSoldiers : 0;
  const lowStateUnits = battle.playerUnits.filter(
    (unit) =>
      unit.soldiers > 0 &&
      (unit.morale < 28 || unit.condition < 28 || unit.ammo < 16 || unit.soldiers / Math.max(1, unit.maxSoldiers) < 0.48),
  );
  const damagedStructures = battle.structures.filter((structure) => structure.status === "damaged" || structure.status === "overrun");
  const objectiveLosses = [
    battle.objectiveState.victoryControl < 46 ? "勝利点放棄" : "",
    battle.objectiveState.supplyControl < 42 ? "補給点低下" : "",
    battle.objectiveState.visibilityControl < 42 ? "視界点喪失" : "",
  ].filter(Boolean);
  const lineIntegrity = battle.objectiveState.lineIntegrity;
  const enemySuppression = battle.objectiveState.enemySuppression;
  const collapseRisk = Math.max(0, Math.round(100 - lineIntegrity + battle.objectiveState.objectivePressure * 0.4));
  const tone: WithdrawalForecast["tone"] =
    lineIntegrity < 28 || activeRatio < 0.52 || lowStateUnits.length >= 3
      ? "danger"
      : lineIntegrity < 55 || objectiveLosses.length > 0 || damagedStructures.length >= 2
        ? "warning"
        : "ready";
  const title =
    tone === "danger"
      ? "即時撤退推奨"
      : tone === "warning"
        ? "撤退で古参温存"
        : "秩序撤退可能";
  const recommendation =
    tone === "danger"
      ? "崩壊前に戦果報告へ移る"
      : tone === "warning"
        ? "予備と後衛を残し主力を逃がす"
        : "目標を維持できるなら継戦余地あり";
  const chips = [
    `戦線維持 ${Math.round(lineIntegrity)}%`,
    `崩壊圧 ${collapseRisk}`,
    `残存 ${Math.round(activeRatio * 100)}%`,
    `永久損耗見込 ${estimatedPermanentCasualties}`,
    `戦利品効率 46%`,
    `補給消費 中`,
  ];
  const reasons = [
    lowStateUnits.length > 0
      ? `危険部隊 ${lowStateUnits.slice(0, 3).map((unit) => unit.name).join(" / ")}`
      : "危険部隊なし",
    damagedStructures.length > 0
      ? `放棄施設 ${damagedStructures.slice(0, 3).map((structure) => fortificationTypeLabels[structure.type]).join(" / ")}`
      : "施設放棄小",
    objectiveLosses.length > 0
      ? objectiveLosses.join(" / ")
      : `目標維持 勝利${Math.round(battle.objectiveState.victoryControl)} 補給${Math.round(
          battle.objectiveState.supplyControl,
        )} 視界${Math.round(battle.objectiveState.visibilityControl)}`,
    enemySuppression >= 55 ? `敵制圧${Math.round(enemySuppression)}で離脱余地` : `敵制圧${Math.round(enemySuppression)}で追撃警戒`,
  ];
  return { tone, title, recommendation, chips, reasons };
};

const createBattleAlerts = (battle: BattleState): BattleAlert[] => {
  const alerts: BattleAlert[] = [];

  if (battle.objectiveState.lineIntegrity < 62) {
    alerts.push({
      id: "line-integrity",
      severity: battle.objectiveState.lineIntegrity < 34 ? "danger" : "warning",
      title: "戦線突破危険",
      detail: `戦線維持 ${Math.round(battle.objectiveState.lineIntegrity)}%`,
      position: { x: 39, y: 50 },
      recommendation: battle.objectiveState.lineIntegrity < 34 ? "後退守備へ" : "弾性防御へ",
    });
  }

  for (const node of battle.objectiveNodes) {
    if (node.eventState.severity === "stable") {
      continue;
    }
    alerts.push({
      id: `objective-event-${node.id}-${node.eventState.id}`,
      severity: node.eventState.severity === "critical" ? "danger" : "warning",
      title: `${node.label}: ${node.eventState.label}${node.eventState.chainStage > 0 ? ` / ${node.eventState.chainLabel}` : ""}`,
      detail: `${node.scenario.label} / ${node.eventState.effectSummary}${
        node.eventState.chainStage > 0 ? ` / ${node.eventState.chainEffectSummary}` : ""
      } / ${objectiveControlLabels[node.control]} ${Math.round(
        node.controlProgress,
      )}%`,
      position: node.position,
      objectiveNodeId: node.id,
      recommendation: objectiveResponseTacticalProfile(node, battle.structures).actionLabel,
    });
  }

  if (battle.enemyUnits.length > 0) {
    const spottedEnemies = battle.enemyUnits.filter((enemy) => enemy.isSpotted);
    const hiddenEnemyCount = battle.enemyUnits.length - spottedEnemies.length;
    const leadEnemy = [...(spottedEnemies.length > 0 ? spottedEnemies : battle.enemyUnits)].sort(
      (a, b) => a.position.x - b.position.x,
    )[0];
    alerts.push({
      id: "enemy-wave",
      severity: leadEnemy.position.x < 70 ? "warning" : "info",
      title: leadEnemy.isSpotted ? "敵波接近" : "未確認敵影",
      detail: leadEnemy.isSpotted
        ? `${mapEnemyDisplayName(leadEnemy)} ${Math.round(leadEnemy.count)}体 / ${leadEnemy.assaultPlan.targetName}`
        : `未発見反応 ${hiddenEnemyCount}群`,
      position: leadEnemy.position,
      recommendation: leadEnemy.isSpotted ? "阻止射撃へ" : "警戒固守",
    });

    const commandedEnemies = battle.enemyUnits.filter((enemy) => enemy.assaultPlan.commandInfluence >= 0.18);
    if (commandedEnemies.length > 0) {
      const strongest = [...commandedEnemies].sort(
        (a, b) => b.assaultPlan.commandInfluence - a.assaultPlan.commandInfluence,
      )[0];
      alerts.push({
        id: "enemy-command",
        severity: "warning",
        title: "敵指揮網",
        detail: `${commandedEnemies.length}群 / 最大${Math.round(strongest.assaultPlan.commandInfluence * 100)}% / ${
          strongest.assaultPlan.commandLabel ?? "指揮源不明"
        }`,
        position: strongest.position,
        recommendation: "敵指揮優先",
      });
    }

    const disruptedEnemies = battle.enemyUnits.filter((enemy) => enemy.assaultPlan.commandState === "disrupted");
    if (disruptedEnemies.length > 0) {
      const leadDisrupted = [...disruptedEnemies].sort((a, b) => a.position.x - b.position.x)[0];
      alerts.push({
        id: "enemy-disrupted",
        severity: "info",
        title: "敵指揮崩壊",
        detail: `${disruptedEnemies.length}群の凝集低下 / ${mapEnemyDisplayName(leadDisrupted)}`,
        position: leadDisrupted.position,
      });
    }

    const routingEnemies = battle.enemyUnits.filter((enemy) =>
      enemy.assaultPlan.moraleState === "routing" || enemy.assaultPlan.moraleState === "regrouping",
    );
    if (routingEnemies.length > 0) {
      const leadRouting = [...routingEnemies].sort((a, b) => b.position.x - a.position.x)[0];
      alerts.push({
        id: "enemy-routing",
        severity: "info",
        title: "敵潰走/再集結",
        detail: `${routingEnemies.length}群 / ${mapEnemyDisplayName(leadRouting)} ${enemyMoraleStateLabels[leadRouting.assaultPlan.moraleState ?? "steady"]}`,
        position: leadRouting.position,
      });
    }

    const breakthroughEnemies = battle.enemyUnits.filter(
      (enemy) => enemy.isSpotted && enemy.assaultPlan.phase === "breakthrough",
    );
    if (breakthroughEnemies.length > 0) {
      const leadBreakthrough = [...breakthroughEnemies].sort(
        (a, b) => b.assaultPlan.penetrationDepth - a.assaultPlan.penetrationDepth,
      )[0];
      alerts.push({
        id: "enemy-breakthrough",
        severity: "danger",
        title: "敵突破",
        detail: `${mapEnemyDisplayName(leadBreakthrough)} 深度${Math.round(
          leadBreakthrough.assaultPlan.penetrationDepth,
        )} / ${leadBreakthrough.assaultPlan.targetName}`,
        position: leadBreakthrough.position,
        segmentId: leadBreakthrough.assaultPlan.targetSegmentId,
        recommendation: "後退守備へ",
      });
    }

    const flankingEnemies = battle.enemyUnits.filter(
      (enemy) => enemy.isSpotted && enemy.assaultPlan.phase === "flanking",
    );
    if (flankingEnemies.length > 0) {
      const leadFlanking = [...flankingEnemies].sort((a, b) => b.assaultPlan.flankPressure - a.assaultPlan.flankPressure)[0];
      alerts.push({
        id: "enemy-flanking",
        severity: "warning",
        title: "側面圧上昇",
        detail: `${mapEnemyDisplayName(leadFlanking)} 側面圧${Math.round(
          leadFlanking.assaultPlan.flankPressure,
        )} / ${leadFlanking.assaultPlan.targetName}`,
        position: leadFlanking.position,
        segmentId: leadFlanking.assaultPlan.targetSegmentId,
        recommendation: "弾性防御へ",
      });
    }

    const overextendedEnemies = battle.enemyUnits.filter(
      (enemy) => enemy.isSpotted && enemy.assaultPlan.phase === "overextended",
    );
    if (overextendedEnemies.length > 0) {
      const leadOverextended = [...overextendedEnemies].sort(
        (a, b) => b.assaultPlan.penetrationDepth - a.assaultPlan.penetrationDepth,
      )[0];
      alerts.push({
        id: "enemy-overextended",
        severity: "info",
        title: "敵突出",
        detail: `${mapEnemyDisplayName(leadOverextended)} 深度${Math.round(
          leadOverextended.assaultPlan.penetrationDepth,
        )} / 凝集${Math.round(leadOverextended.assaultPlan.cohesion * 100)}`,
        position: leadOverextended.position,
        segmentId: leadOverextended.assaultPlan.targetSegmentId,
        recommendation: "阻止射撃へ",
      });
    }
  }

  for (const segment of battle.frontlineSegments) {
    const pressure = battle.enemyUnits
      .filter((enemy) => enemy.isSpotted)
      .filter((enemy) => distance(enemy.position, segment.anchor) <= segment.controlRadius + 18)
      .reduce((sum, enemy) => sum + enemy.count * enemy.pressure, 0);
    if (pressure > 620) {
      alerts.push({
        id: `segment-${segment.id}`,
        severity: pressure > 1100 ? "danger" : "warning",
        title: `${segment.name}圧迫`,
        detail: `敵圧 ${Math.round(pressure)}`,
        position: segment.anchor,
        segmentId: segment.id,
        recommendation: pressure > 1100 ? "後退守備へ" : "弾性防御へ",
      });
    }
  }

  for (const choke of battle.chokePoints ?? []) {
    if (choke.currentPressure > choke.flowLimit * 0.75 || choke.delayPercent >= 42) {
      alerts.push({
        id: `choke-${choke.id}`,
        severity: choke.currentPressure > choke.flowLimit * 1.15 ? "danger" : "warning",
        title: `${choke.name}混雑`,
        detail: `通行圧 ${choke.currentPressure} / 遅滞 ${choke.delayPercent}%`,
        position: choke.position,
        recommendation: "隘路固守",
      });
    }
  }

  for (const structure of battle.structures) {
    const structureRaiders = battle.enemyUnits.filter(
      (enemy) => enemy.assaultPlan.targetStructureId === structure.id && enemy.count > 0 && enemy.isSpotted,
    );
    const unassignedPressure = structure.tacticalPressure >= 3 && structure.assignedUnitIds.length === 0;
    const repairLag = structure.status === "damaged" && structure.repairRate + 1 < structure.tacticalPressure;
    const needsFacilityAlert =
      structureRaiders.length > 0 ||
      structure.status === "damaged" ||
      structure.status === "overrun" ||
      structure.facilityState === "contested" ||
      unassignedPressure ||
      repairLag;
    if (needsFacilityAlert) {
      alerts.push({
        id: `structure-${structure.id}`,
        severity: structure.status === "overrun" || structure.facilityState === "contested" || repairLag ? "danger" : "warning",
        title: `${fortificationTypeLabels[structure.type]}${structure.facilityStateLabel}`,
        detail: `耐久 ${Math.round(structure.durability)}/${structure.maxDurability} / 脅威${Math.round(
          structure.tacticalPressure,
        )} / 襲撃${structureRaiders.length} / 修理${structure.repairRate.toFixed(1)} / 担当${structure.assignedUnitIds.length}`,
        position: structure.position,
        structureId: structure.id,
        recommendation:
          structureRaiders.length > 0
            ? "施設即応"
            : structure.status === "overrun" || structure.facilityState === "contested"
            ? "奪回守備"
            : structure.status === "damaged" || repairLag
              ? "修理担当"
              : "施設防衛",
      });
    }
  }

  for (const unit of battle.playerUnits) {
    if (unit.formation.overlapPressure >= 0.42) {
      alerts.push({
        id: `formation-${unit.unitId}`,
        severity: unit.formation.overlapPressure >= 0.86 ? "danger" : "warning",
        title: `${mapUnitDisplayName(unit)} 戦列過密`,
        detail: formationLabel(unit),
        position: unit.position,
        unitId: unit.unitId,
        recommendation: "弾性防御へ",
      });
    }
    if (unit.morale <= 35) {
      alerts.push({
        id: `morale-${unit.unitId}`,
        severity: unit.morale <= 24 ? "danger" : "warning",
        title: `${mapUnitDisplayName(unit)} 士気低下`,
        detail: `士気 ${Math.round(unit.morale)} / ${battleActionReasonLabels[unit.actionReason]}`,
        position: unit.position,
        unitId: unit.unitId,
        recommendation: "後退守備へ",
      });
    }
    if ((unit.type === "artillery" && unit.ammo <= 30) || unit.ammo <= 18) {
      alerts.push({
        id: `ammo-${unit.unitId}`,
        severity: unit.ammo <= 10 ? "danger" : "info",
        title: `${mapUnitDisplayName(unit)} 弾薬低下`,
        detail: `弾薬 ${Math.round(unit.ammo)} / ${battleActionReasonLabels[unit.actionReason]}`,
        position: unit.position,
        unitId: unit.unitId,
        recommendation: "弾薬節約",
      });
    }
  }

  return [...alerts].sort((a, b) => battleAlertPriority(a) - battleAlertPriority(b)).slice(0, 6);
};

export function BattleCommandScreen({
  battle,
  standingOrderTemplates = [],
  onChange,
  onComplete,
  onSaveStandingOrderTemplate,
}: BattleCommandScreenProps) {
  const mapScrollRef = useRef<HTMLDivElement | null>(null);
  const mapFieldRef = useRef<HTMLDivElement | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState(() => battle.playerUnits[0]?.unitId ?? "");
  const [commandMode, setCommandMode] = useState<MapCommandMode>("none");
  const [viewportRange, setViewportRange] = useState<BattleViewportRange>({ left: 0, width: 100 });
  const [minimapFocusPosition, setMinimapFocusPosition] = useState<BattlePosition | null>(null);
  const [firePlanDraft, setFirePlanDraft] = useState<FirePlanDraftStage[]>([]);
  const [dragOrderHandle, setDragOrderHandle] = useState<DragOrderHandleState | null>(null);
  const [dragFrontlineHandle, setDragFrontlineHandle] = useState<DragFrontlineHandleState | null>(null);
  const [frontlineSketchDraft, setFrontlineSketchDraft] = useState<FrontlineSketchDraft | null>(null);
  const [selectedEnemyId, setSelectedEnemyId] = useState("");
  const [inspectedStructureId, setInspectedStructureId] = useState("");
  const [selectedFrontlineSegmentId, setSelectedFrontlineSegmentId] = useState(() => battle.frontlineSegments[0]?.id ?? "");
  const [rotationTiredUnitIdBySegment, setRotationTiredUnitIdBySegment] = useState<Record<string, string>>({});
  const [rotationReserveUnitIdBySegment, setRotationReserveUnitIdBySegment] = useState<Record<string, string>>({});
  const [commandQueueMode, setCommandQueueMode] = useState(false);
  const [queuedCommands, setQueuedCommands] = useState<QueuedBattleCommand[]>([]);
  const [tacticalMapLayers, setTacticalMapLayers] = useState<Record<TacticalMapLayerId, boolean>>(
    () => defaultTacticalMapLayers,
  );
  const dragOrderHandleRef = useRef<DragOrderHandleState | null>(null);
  const dragFrontlineHandleRef = useRef<DragFrontlineHandleState | null>(null);

  useEffect(() => {
    if (battle.status !== "running" || battle.speed === 0) {
      return;
    }
    const interval = window.setInterval(() => {
      onChange(resolveTick(battle));
    }, Math.max(250, 1000 / battle.speed));
    return () => window.clearInterval(interval);
  }, [battle, onChange]);

  useEffect(() => {
    if (!battle.playerUnits.some((unit) => unit.unitId === selectedUnitId)) {
      setSelectedUnitId(battle.playerUnits[0]?.unitId ?? "");
    }
  }, [battle.playerUnits, selectedUnitId]);

  useEffect(() => {
    if (selectedEnemyId && !battle.enemyUnits.some((unit) => unit.id === selectedEnemyId && unit.count > 0)) {
      setSelectedEnemyId("");
    }
  }, [battle.enemyUnits, selectedEnemyId]);

  useEffect(() => {
    if (!battle.frontlineSegments.some((segment) => segment.id === selectedFrontlineSegmentId)) {
      setSelectedFrontlineSegmentId(battle.frontlineSegments[0]?.id ?? "");
    }
  }, [battle.frontlineSegments, selectedFrontlineSegmentId]);

  useEffect(() => {
    setFirePlanDraft([]);
  }, [selectedUnitId]);

  useEffect(() => {
    setQueuedCommands((current) => {
      const filtered = current.filter((command) =>
        !command.subjectId.startsWith("unit:") ||
        battle.playerUnits.some((unit) => `unit:${unit.unitId}` === command.subjectId && unit.soldiers > 0),
      );
      return filtered.length === current.length ? current : filtered;
    });
  }, [battle.playerUnits]);

  useEffect(() => {
    dragOrderHandleRef.current = dragOrderHandle;
  }, [dragOrderHandle]);

  useEffect(() => {
    dragFrontlineHandleRef.current = dragFrontlineHandle;
  }, [dragFrontlineHandle]);

  const updateViewportRange = () => {
    const scroll = mapScrollRef.current;
    if (!scroll || scroll.scrollWidth <= 0) {
      return;
    }
    setViewportRange({
      left: (scroll.scrollLeft / scroll.scrollWidth) * 100,
      width: Math.min(100, (scroll.clientWidth / scroll.scrollWidth) * 100),
    });
  };

  useEffect(() => {
    updateViewportRange();
  }, [battle.mapBounds.width, battle.playerUnits.length]);

  const progress = Math.min(100, Math.round((battle.elapsedSeconds / battle.objectiveState.holdSecondsRequired) * 100));
  const finished = battle.status === "held" || battle.status === "withdrawn" || battle.status === "collapsed";
  const selectedUnit = battle.playerUnits.find((unit) => unit.unitId === selectedUnitId) ?? battle.playerUnits[0];
  const selectedFrontlineSegment =
    battle.frontlineSegments.find((segment) => segment.id === selectedFrontlineSegmentId) ?? battle.frontlineSegments[0];
  const selectedStandingTemplate = selectedUnit
    ? standingOrderTemplates.find((template) => template.createdFromUnitId === selectedUnit.unitId)
    : undefined;
  const selectedStructure = selectedUnit?.standingOrder.facilityAssignment
    ? battle.structures.find((structure) => structure.id === selectedUnit.standingOrder.facilityAssignment?.structureId)
    : undefined;
  const inspectedStructure = inspectedStructureId
    ? battle.structures.find((structure) => structure.id === inspectedStructureId)
    : undefined;
  const selectedFocusTarget = selectedUnit?.focusTargetId
    ? battle.enemyUnits.find((enemy) => enemy.id === selectedUnit.focusTargetId)
    : undefined;
  const selectedEnemy = selectedEnemyId ? battle.enemyUnits.find((enemy) => enemy.id === selectedEnemyId) : undefined;
  const selectedEnemySegment = selectedEnemy ? enemyThreatSegment(battle, selectedEnemy) : undefined;
  const selectedEnemyResponseUnits = selectedEnemy ? enemyResponseUnits(battle, selectedEnemy) : [];
  const selectedFireMission = activeFireMissionForUnit(battle, selectedUnit);
  const fireDiscipline = fireDisciplineWithDefaults(battle.fireDiscipline);
  const reserveDoctrine = battle.reserveDoctrine ?? defaultReserveDoctrinePlan;
  const commandIssuePlan = battle.commandIssuePlan ?? defaultCommandIssuePlan;
  const maxFirePlanStages = fireDiscipline.maxPlannedStages;
  const firePlanStageSpacingSeconds = fireDiscipline.plannedStageSpacingSeconds;
  const selectedVolleyCooldown = selectedUnit
    ? Math.max(0, Math.ceil((selectedUnit.volleyCooldownUntilSeconds ?? 0) - battle.elapsedSeconds))
    : 0;
  const canIssueFireMission =
    !!selectedUnit &&
    !!(selectedUnit.focusTargetId || selectedUnit.currentTargetId) &&
    !selectedFireMission &&
    selectedVolleyCooldown <= 0 &&
    !finished;
  const alerts = useMemo(() => createBattleAlerts(battle), [battle]);
  const withdrawalForecast = useMemo(() => createWithdrawalForecast(battle), [battle]);
  const pressureReports = useMemo(() => frontlinePressureReports(battle), [battle]);
  const enemyCommandGroups = useMemo(() => enemyCommandGroupReports(battle), [battle]);
  const staffAdvisories = useMemo(() => staffFrontlineAdvisories(battle, pressureReports), [battle, pressureReports]);
  const objectiveStaffRecommendationsList = useMemo(
    () => objectiveStaffRecommendations(battle, pressureReports),
    [battle, pressureReports],
  );
  const selectedFrontlinePressure = pressureReports.find(
    (report) => report.segment.id === selectedFrontlineSegment?.id,
  );
  const selectedFrontlineDefenders = selectedFrontlineSegment
    ? battle.playerUnits.filter(
        (unit) =>
          unit.soldiers > 0 &&
          unit.order !== "retreat" &&
          unit.standingOrder.frontlineSegmentId === selectedFrontlineSegment.id,
      )
    : [];
  const selectedFrontlineDoctrinePreview = frontlineDoctrinePreview(
    battle,
    selectedFrontlineSegment,
    selectedFrontlinePressure,
  );
  const selectedFrontlineTerrainAssessment = selectedFrontlineSegment
    ? assessFrontlineTerrain(selectedFrontlineSegment, battle.terrainZones, battle.structures)
    : undefined;
  const selectedFrontlineObjectiveOptions = useMemo(
    () => frontlineObjectiveSupportOptions(battle, selectedFrontlineSegment),
    [battle, selectedFrontlineSegment],
  );
  const selectedFrontlineNearestObjective = selectedFrontlineObjectiveOptions[0];
  const selectedFrontlineRotationOptions = selectedFrontlinePressure
    ? frontlineRotationOptions(selectedFrontlinePressure, pressureReports)
    : { tiredUnits: [], reserveUnits: [] };
  const selectedRotationTiredUnitId = selectedFrontlineSegment
    ? rotationTiredUnitIdBySegment[selectedFrontlineSegment.id] ??
      selectedFrontlineRotationOptions.defaultTiredUnit?.unitId ??
      ""
    : "";
  const selectedRotationReserveUnitId = selectedFrontlineSegment
    ? rotationReserveUnitIdBySegment[selectedFrontlineSegment.id] ??
      selectedFrontlineRotationOptions.defaultReserveUnit?.unitId ??
      ""
    : "";
  const selectedFrontlineRotationPreview = selectedFrontlinePressure
    ? frontlineRotationPreview(
        selectedFrontlinePressure,
        selectedRotationTiredUnitId,
        selectedRotationReserveUnitId,
        pressureReports,
      )
    : undefined;
  const selectedFrontlineAllDefenderDiagnostics = selectedFrontlineDefenders
    .map((unit) => {
      const soldierRatio = unit.maxSoldiers > 0 ? Math.round((unit.soldiers / unit.maxSoldiers) * 100) : 0;
      const stress = Math.round(frontlineRotationStressScore(unit));
      const distanceToAnchor = selectedFrontlineSegment ? Math.round(distance(unit.position, selectedFrontlineSegment.anchor)) : 0;
      const warnings = [
        unit.morale < 48 ? `士気${Math.round(unit.morale)}` : undefined,
        unit.condition < 45 ? `疲労${Math.round(100 - unit.condition)}` : undefined,
        unit.ammo < 35 ? `弾薬${Math.round(unit.ammo)}` : undefined,
        soldierRatio < 62 ? `兵力${soldierRatio}%` : undefined,
        distanceToAnchor > unit.standingOrder.controlRadius ? `基準外${distanceToAnchor}` : undefined,
      ]
        .filter(Boolean)
        .join(" / ");
      const isOutsideControl = distanceToAnchor > unit.standingOrder.controlRadius;
      const tone = stress >= 96 || isOutsideControl ? "danger" : stress >= 68 || warnings ? "warning" : "stable";
      const recommendedAction: "fallback" | "rest" | "hold" =
        isOutsideControl || unit.morale < 34 || soldierRatio < 48
          ? "fallback"
          : unit.ammo < 35 || unit.condition < 45 || unit.morale < 48
            ? "rest"
            : "hold";
      const recommendationLabel =
        recommendedAction === "fallback" ? "推奨 後退守備" : recommendedAction === "rest" ? "推奨 休息補給" : "推奨 維持";
      const recommendationReason =
        recommendedAction === "fallback"
          ? isOutsideControl
            ? `基準線外 ${distanceToAnchor}`
            : soldierRatio < 48
              ? `兵力${soldierRatio}%`
              : `士気${Math.round(unit.morale)}`
          : recommendedAction === "rest"
            ? unit.ammo < 35
              ? `弾薬${Math.round(unit.ammo)}`
              : unit.condition < 45
                ? `疲労${Math.round(100 - unit.condition)}`
                : `士気${Math.round(unit.morale)}`
            : "現戦線を維持";
      return {
        unit,
        soldierRatio,
        stress,
        distanceToAnchor,
        warnings,
        tone,
        recommendedAction,
        recommendationLabel,
        recommendationReason,
      };
    })
    .sort((a, b) => b.stress - a.stress);
  const selectedFrontlineDefenderDiagnostics = selectedFrontlineAllDefenderDiagnostics.slice(0, 6);
  const selectedFrontlineRestRecommendations = selectedFrontlineAllDefenderDiagnostics
    .filter((entry) => entry.recommendedAction === "rest")
    .map((entry) => entry.unit);
  const selectedFrontlineFallbackRecommendations = selectedFrontlineAllDefenderDiagnostics
    .filter((entry) => entry.recommendedAction === "fallback")
    .map((entry) => entry.unit);
  const selectedFrontlineStaffAdvisory = selectedFrontlineSegment
    ? staffAdvisories.find((advisory) => advisory.segment.id === selectedFrontlineSegment.id)
    : undefined;
  const selectedFrontlineSuggestionCards =
    selectedFrontlineSegment && selectedFrontlinePressure
      ? [
          {
            id: "pressure",
            tone: selectedFrontlinePressure.level,
            title: selectedFrontlinePressure.recommendationLabel,
            detail: `敵圧${Math.round(selectedFrontlinePressure.pressure)} / 守備${selectedFrontlinePressure.defenders.length} / 予備${selectedFrontlinePressure.reserves.length}`,
            reason: selectedFrontlinePressure.leadEnemy
              ? `${mapEnemyDisplayName(selectedFrontlinePressure.leadEnemy)} / ${enemyAssaultPhaseLabels[selectedFrontlinePressure.leadEnemy.assaultPlan.phase]}`
              : "主脅威なし",
            disabled:
              finished ||
              selectedFrontlinePressure.level === "quiet" ||
              (selectedFrontlinePressure.defenders.length === 0 && selectedFrontlinePressure.reserves.length === 0),
            actionLabel: commandQueueMode ? "圧力対応を予約" : "圧力対応",
            onApply: () => applyFrontlinePressureResponse(selectedFrontlinePressure),
          },
          {
            id: "rotation",
            tone: selectedFrontlineRotationPreview ? selectedFrontlinePressure.level : "quiet",
            title: selectedFrontlineRotationPreview?.label ?? "戦闘交代なし",
            detail: selectedFrontlineRotationPreview?.detail ?? "交代可能な守備/予備不足",
            reason: `候補 守備${selectedFrontlineRotationOptions.tiredUnits.length} / 予備${selectedFrontlineRotationOptions.reserveUnits.length}`,
            disabled: finished || !selectedFrontlineRotationPreview,
            actionLabel: commandQueueMode ? "交代を予約" : "交代実行",
            onApply: () =>
              applyFrontlineRotationResponse(
                selectedFrontlinePressure,
                selectedRotationTiredUnitId,
                selectedRotationReserveUnitId,
              ),
          },
          {
            id: "staff",
            tone: selectedFrontlineStaffAdvisory?.severity ?? "quiet",
            title: selectedFrontlineStaffAdvisory
              ? `参謀 ${selectedFrontlineStaffAdvisory.preset.label}`
              : "参謀警告なし",
            detail: selectedFrontlineStaffAdvisory
              ? selectedFrontlineStaffAdvisory.detail
              : `${selectedFrontlineSegment.name}に緊急参謀警告なし`,
            reason: selectedFrontlineStaffAdvisory?.assessment.reason ?? "現方針維持",
            disabled: finished || !selectedFrontlineStaffAdvisory || selectedFrontlineStaffAdvisory.report.defenders.length === 0,
            actionLabel: commandQueueMode ? "参謀案を予約" : "参謀案適用",
            onApply: () => selectedFrontlineStaffAdvisory && applyStaffAdvisory(selectedFrontlineStaffAdvisory),
          },
        ]
      : [];
  const reserveUnits = useMemo(() => reserveCommandUnits(battle), [battle]);
  const readyReserveUnits = reserveUnits.filter((unit) => (unit.reserveReadiness ?? 0) >= 52);
  const reserveAverageReadiness =
    reserveUnits.length > 0
      ? Math.round(reserveUnits.reduce((sum, unit) => sum + (unit.reserveReadiness ?? 0), 0) / reserveUnits.length)
      : 0;
  const activeFireMissions = (battle.fireMissions ?? []).filter((mission) => mission.expiresAt > battle.elapsedSeconds);
  const activeFirePlans = (battle.firePlans ?? []).filter((plan) =>
    plan.stages.some((stage) => stage.status === "pending" || stage.status === "active"),
  );
  const currentFirePlanTarget = selectedUnit
    ? battle.enemyUnits.find(
        (enemy) =>
          enemy.id === (selectedUnit.focusTargetId ?? selectedUnit.currentTargetId) &&
          enemy.count > 0 &&
          enemy.isSpotted,
      )
    : undefined;
  const selectedFacingDeg = selectedUnit ? activeFacingDegForUnit(selectedUnit) : 0;
  const selectedTransmissionPreview = selectedUnit
    ? commandTransmissionReport(battle, selectedUnit, "standard")
    : undefined;
  const commandCongestionPreview: CommandCongestionReport | undefined =
    queuedCommands.length > 0 ? commandCongestionReport(battle, queuedCommands.length) : undefined;
  const commandIssueCompliance = (() => {
    if (queuedCommands.length === 0) {
      return {
        tone: "stable",
        label: "方針待機",
        detail: "予約命令なし。方針に合わせて命令を積む。",
      };
    }
    if (commandIssuePlan.mode === "strict_direct" && queuedCommands.length > 1) {
      return {
        tone: "danger",
        label: "逐次違反",
        detail: `逐次発令方針で${queuedCommands.length}件を一括発令しようとしている。分けて発令するか方針変更が必要。`,
      };
    }
    if (commandIssuePlan.mode === "split_batches" && queuedCommands.length > commandIssuePlan.maxBatchSize) {
      return {
        tone: commandCongestionPreview?.delayPenaltySeconds ? "warning" : "stable",
        label: "分割適用",
        detail: `${queuedCommands.length}件を${commandIssuePlan.maxBatchSize}件単位として扱う。混線計算は分割後の有効件数で見る。`,
      };
    }
    if (commandCongestionPreview?.delayPenaltySeconds) {
      return {
        tone: "warning",
        label: "混線注意",
        detail: commandCongestionPreview.detail,
      };
    }
    return {
      tone: "stable",
      label: "方針適合",
      detail: `${commandIssuePlanLabels[commandIssuePlan.mode]}で処理可能。${commandCongestionPreview?.detail ?? "混線なし"}`,
    };
  })();
  const commandIssuePolicyBatchSize =
    commandIssuePlan.mode === "standard_queue"
      ? queuedCommands.length
      : Math.min(queuedCommands.length, Math.max(1, commandIssuePlan.maxBatchSize));
  const canApplyCommandIssuePolicyBatch =
    queuedCommands.length > 0 && commandIssuePlan.mode !== "standard_queue" && commandIssuePolicyBatchSize < queuedCommands.length;
  const commandIssuePolicyBatchLabel =
    commandIssuePlan.mode === "strict_direct" ? "1件だけ発令" : `${commandIssuePolicyBatchSize}件ずつ発令`;
  const selectedTargetAudits = selectedUnit ? targetAuditForUnit(battle, selectedUnit).slice(0, 5) : [];
  const selectedAuditTarget = selectedUnit ? selectedTargetAudit(battle, selectedUnit) : undefined;
  const selectedUnitFrontlinePressure = selectedUnit
    ? pressureReports.find((report) => report.segment.id === selectedUnit.standingOrder.frontlineSegmentId)
    : undefined;
  const selectedUnitFrontlineDistance =
    selectedUnit && selectedUnitFrontlinePressure
      ? Math.round(distance(selectedUnit.position, selectedUnitFrontlinePressure.segment.anchor))
      : 0;
  const selectedUnitFrontlineRole =
    selectedUnit && selectedUnitFrontlinePressure?.defenders.some((unit) => unit.unitId === selectedUnit.unitId)
      ? "守備中"
      : selectedUnit && selectedUnitFrontlinePressure?.reserves.some((unit) => unit.unitId === selectedUnit.unitId)
        ? "予備候補"
        : selectedUnit?.standingOrder.posture === "fire_support"
          ? "火力支援"
          : "戦線外";
  const selectedUnitReadinessWarning = selectedUnit
    ? [
        selectedUnit.morale < 48 ? `士気${Math.round(selectedUnit.morale)}` : undefined,
        selectedUnit.condition < 45 ? `疲労${Math.round(100 - selectedUnit.condition)}` : undefined,
        selectedUnit.ammo < 35 ? `弾薬${Math.round(selectedUnit.ammo)}` : undefined,
        selectedUnit.soldiers < selectedUnit.maxSoldiers * 0.62 ? `兵力${selectedUnit.soldiers}` : undefined,
      ]
        .filter(Boolean)
        .join(" / ")
    : "";
  const spottedEnemyCount = battle.enemyUnits.filter((enemy) => enemy.isSpotted).length;
  const hiddenEnemyCount = battle.enemyUnits.length - spottedEnemyCount;
  const objectiveEffects = battle.objectiveState.tacticalEffects;
  const spottingRange = Math.round(
    spottingRangeForStructures(battle.structures, battle.strategicDoctrine, objectiveEffects.visibilitySpottingBonus),
  );
  const observationPostCount = battle.structures.filter(
    (structure) =>
      structure.type === "observationPost" && (structure.status === "built" || structure.status === "damaged"),
  ).length;
  const chokeSummary =
    (battle.chokePoints ?? []).length > 0
      ? `${battle.chokePoints.map((choke) => `${choke.name} 遅滞${choke.delayPercent}%`).join(" / ")}`
      : "なし";
  const frontlineGeometryLabel = frontlineGeometryDisplayLabel(battle.frontlineGeometry);
  const isMapCommandMode =
    commandMode !== "none" && commandMode !== "select";
  const selectedCommandInstruction =
    selectedUnit && isMapCommandMode
      ? commandMode === "anchor"
        ? `${selectedUnit.name}の基準位置を戦術マップでクリック`
        : commandMode === "fallback"
          ? `${selectedUnit.name}の後退地点を戦術マップでクリック`
          : commandMode === "facility"
            ? `${selectedUnit.name}の担当施設をクリック`
          : commandMode === "focusTarget"
            ? `${selectedUnit.name}の集中射撃目標をクリック`
            : `${selectedUnit.name}の担当戦線区画をクリック`
      : selectedUnit && commandMode === "select"
        ? "選択モード: 部隊、敵、施設、戦線をクリックして詳細確認"
      : selectedUnit
        ? "部隊、敵、施設、戦線を選択して状況を確認"
        : "旅団を選択";
  const selectedCommandCompass = selectedUnit
    ? [
        {
          id: "anchor",
          label: "基準",
          value: mapCoordinateLabel(selectedUnit.standingOrder.anchor),
          detail: `半径${selectedUnit.standingOrder.controlRadius} / ${standingPostureLabels[selectedUnit.standingOrder.posture]}`,
        },
        {
          id: "fallback",
          label: "後退",
          value: mapCoordinateLabel(selectedUnit.standingOrder.fallback.destination),
          detail: selectedUnit.standingOrder.fallback.enabled ? fallbackThresholdSummary(selectedUnit) : "自動後退なし",
        },
        {
          id: "segment",
          label: "戦線",
          value: segmentName(battle, selectedUnit.standingOrder.frontlineSegmentId),
          detail: selectedFrontlineSegment?.id === selectedUnit.standingOrder.frontlineSegmentId ? "表示中" : "クリックで再指定",
        },
        {
          id: "facility",
          label: "施設",
          value: selectedStructure ? fortificationTypeLabels[selectedStructure.type] : "未指定",
          detail: selectedStructure
            ? `${fortificationStatusLabels[selectedStructure.status]} / ${facilityLabel(battle, selectedUnit)}`
            : "施設クリックで担当",
        },
        {
          id: "focusTarget",
          label: "集中",
          value: focusTargetName(battle, selectedUnit.focusTargetId),
          detail: selectedFocusTarget ? `${Math.round(selectedFocusTarget.count)}体 / ${enemyThreatLabel(selectedFocusTarget)}` : "敵クリックで指名",
        },
      ]
    : [];
  const selectedMapInspectionItems = [
    selectedUnit
      ? {
          label: "選択旅団",
          value: mapUnitDisplayName(selectedUnit),
          detail: `${unitTypeLabels[selectedUnit.type]} / ${mapCoordinateLabel(selectedUnit.position)}`,
        }
      : undefined,
    selectedEnemy
      ? {
          label: "確認敵群",
          value: selectedEnemy.isSpotted ? mapEnemyDisplayName(selectedEnemy) : "未確認敵影",
          detail: `${mapCoordinateLabel(selectedEnemy.position)} / ${
            selectedEnemy.isSpotted
              ? enemyAssaultPhaseLabels[selectedEnemy.assaultPlan.phase]
              : `隠蔽${Math.round(selectedEnemy.concealment || enemyConcealmentAt(selectedEnemy, battle.terrainZones))}`
          }`,
        }
      : undefined,
    selectedFrontlineSegment
      ? {
          label: "選択戦線",
          value: selectedFrontlineSegment.name,
          detail: `${mapCoordinateLabel(selectedFrontlineSegment.anchor)} / 半径${Math.round(selectedFrontlineSegment.controlRadius)}`,
        }
      : undefined,
    inspectedStructure
      ? {
          label: "確認施設",
          value: fortificationTypeLabels[inspectedStructure.type],
          detail: `${fortificationStatusLabels[inspectedStructure.status]} / ${inspectedStructure.facilityStateLabel}`,
        }
      : selectedStructure
        ? {
            label: "担当施設",
            value: fortificationTypeLabels[selectedStructure.type],
            detail: `${fortificationStatusLabels[selectedStructure.status]} / ${selectedStructure.facilityStateLabel}`,
        }
      : undefined,
  ].filter((item): item is { label: string; value: string; detail: string } => Boolean(item));
  const inspectedOrAssignedStructure = inspectedStructure ?? selectedStructure;
  const inspectedFacilityResponseUnits = inspectedOrAssignedStructure
    ? facilityInspectionResponseUnits(battle, inspectedOrAssignedStructure)
    : [];
  const selectedMapActionForecasts = [
    selectedEnemy
      ? {
          tone:
            selectedEnemy.assaultPlan.phase === "breakthrough" || selectedEnemy.assaultPlan.phase === "flanking"
              ? "danger"
              : selectedEnemy.assaultPlan.commandState === "commanded" || selectedEnemy.type === "brute"
                ? "warning"
                : "ready",
          title: "敵群対応予測",
          summary: `${selectedEnemyResponseUnits.length}旅団 / ${selectedEnemySegment?.name ?? "近接戦線"} / ${enemyResponseLabel(selectedEnemy)}`,
          detail: `${mapEnemyDisplayName(selectedEnemy)} ${Math.round(selectedEnemy.count)}体 / ${enemyAssaultPhaseLabels[selectedEnemy.assaultPlan.phase]} / 優先 ${targetPriorityLabels[enemyResponsePriority(selectedEnemy)]}`,
        }
      : undefined,
    selectedEnemy && selectedEnemyResponseUnits.length > 0
      ? {
          tone: selectedEnemyResponseUnits[0].ammo < 36 ? "warning" : "ready",
          title: "戦線斉射予測",
          summary: `${selectedEnemyResponseUnits[0].name}基準 / 弾薬${Math.round(selectedEnemyResponseUnits[0].ammo)}`,
          detail: `${selectedEnemySegment?.name ?? "近接戦線"}の射撃可能旅団で短時間火力集中 / 再装填と弾薬を消費`,
        }
      : undefined,
    selectedEnemy && selectedUnit
      ? {
          tone: selectedEnemy.isSpotted ? "ready" : "warning",
          title: "選択旅団集中予測",
          summary: `${selectedUnit.name} / ${selectedEnemy.isSpotted ? "指名可能" : "未発見"}`,
          detail: `${mapEnemyDisplayName(selectedEnemy)}へ単独集中 / 現在弾薬${Math.round(selectedUnit.ammo)} / 伝令遅延あり`,
        }
      : undefined,
    inspectedOrAssignedStructure
      ? {
          tone:
            inspectedOrAssignedStructure.status === "overrun" || inspectedOrAssignedStructure.facilityState === "contested"
              ? "danger"
              : inspectedOrAssignedStructure.status === "damaged" || inspectedOrAssignedStructure.tacticalPressure > 0
                ? "warning"
                : "ready",
          title: "施設即応予測",
          summary: `${inspectedFacilityResponseUnits.length}部隊 / ${fortificationTypeLabels[inspectedOrAssignedStructure.type]} / ${inspectedOrAssignedStructure.facilityStateLabel}`,
          detail: `脅威${Math.round(inspectedOrAssignedStructure.tacticalPressure)} / 修理率${inspectedOrAssignedStructure.repairRate.toFixed(1)} / 候補 ${inspectedFacilityResponseUnits.map((unit) => mapUnitDisplayName(unit)).join("、") || "なし"}`,
        }
      : undefined,
    inspectedOrAssignedStructure
      ? {
          tone:
            inspectedOrAssignedStructure.status === "damaged" ||
            inspectedOrAssignedStructure.status === "overrun" ||
            inspectedOrAssignedStructure.facilityState === "contested"
              ? "warning"
              : "ready",
          title: "修理優先予測",
          summary: `${inspectedFacilityResponseUnits.some((unit) => unit.type === "engineer") ? "工兵あり" : "工兵なし"} / 耐久${Math.round(inspectedOrAssignedStructure.durability)}`,
          detail: `損傷または接敵なら工兵は築城/修理へ移行 / 周辺部隊は防衛または補給を担当`,
        }
      : undefined,
    selectedFrontlinePressure
      ? {
          tone:
            selectedFrontlinePressure.level === "danger"
              ? "danger"
              : selectedFrontlinePressure.level === "warning"
                ? "warning"
                : "ready",
          title: "戦線対応予測",
          summary: `${selectedFrontlinePressure.recommendationLabel} / 守備${selectedFrontlinePressure.defenders.length} / 予備${selectedFrontlinePressure.reserves.length}`,
          detail: `敵圧${Math.round(selectedFrontlinePressure.pressure)} / ${frontlinePressureLevelLabels[selectedFrontlinePressure.level]} / 主脅威 ${
            selectedFrontlinePressure.leadEnemy ? mapEnemyDisplayName(selectedFrontlinePressure.leadEnemy) : "なし"
          }`,
        }
      : undefined,
  ].filter(
    (item): item is { tone: "ready" | "warning" | "danger"; title: string; summary: string; detail: string } => Boolean(item),
  );
  const selectedTacticalSuggestions = selectedUnit
    ? alerts
        .map((alert) => {
          const alertPosition =
            alert.position ??
            battle.playerUnits.find((unit) => unit.unitId === alert.unitId)?.position ??
            battle.structures.find((structure) => structure.id === alert.structureId)?.position ??
            battle.objectiveNodes.find((node) => node.id === alert.objectiveNodeId)?.position ??
            selectedUnit.position;
          const isDirectUnit = alert.unitId === selectedUnit.unitId;
          const isSameSegment = !!alert.segmentId && alert.segmentId === selectedUnit.standingOrder.frontlineSegmentId;
          const isAssignedFacility =
            !!alert.structureId && alert.structureId === selectedUnit.standingOrder.facilityAssignment?.structureId;
          const isFocusTarget =
            !!selectedUnit.focusTargetId &&
            battle.enemyUnits.some(
              (enemy) => enemy.id === selectedUnit.focusTargetId && alert.position && distance(enemy.position, alert.position) <= 16,
            );
          const proximity = distance(selectedUnit.position, alertPosition);
          const relevance =
            (isDirectUnit ? 90 : 0) +
            (isSameSegment ? 34 : 0) +
            (isAssignedFacility ? 42 : 0) +
            (isFocusTarget ? 24 : 0) +
            Math.max(0, 30 - proximity * 0.4) +
            (alert.severity === "danger" ? 24 : alert.severity === "warning" ? 12 : 0);
          const reason = [
            isDirectUnit ? "対象部隊" : undefined,
            isSameSegment ? "同じ戦線" : undefined,
            isAssignedFacility ? "担当施設" : undefined,
            isFocusTarget ? "集中目標付近" : undefined,
            `距離${Math.round(proximity)}`,
          ]
            .filter(Boolean)
            .join(" / ");
          return { alert, relevance, reason };
        })
        .filter((entry) => entry.alert.recommendation && entry.relevance >= 18)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)
    : [];
  const effectiveMapLayers: Record<TacticalMapLayerId, boolean> = {
    ...tacticalMapLayers,
    frontlines: tacticalMapLayers.frontlines || commandMode === "segment" || commandMode === "select" || !!dragFrontlineHandle,
    orders:
      tacticalMapLayers.orders ||
      commandMode === "anchor" ||
      commandMode === "fallback" ||
      !!dragOrderHandle,
    targetAudit: tacticalMapLayers.targetAudit || commandMode === "focusTarget",
    facilities: tacticalMapLayers.facilities || commandMode === "facility" || commandMode === "select",
  };
  const visibleMapLayerCount = tacticalMapLayerOrder.filter((layerId) => tacticalMapLayers[layerId]).length;

  const toggleTacticalMapLayer = (layerId: TacticalMapLayerId) => {
    setTacticalMapLayers((current) => ({
      ...current,
      [layerId]: !current[layerId],
    }));
  };

  const showAllTacticalMapLayers = () => {
    setTacticalMapLayers(defaultTacticalMapLayers);
  };

  const toggleCommandQueueMode = () => {
    const nextMode = !commandQueueMode;
    setCommandQueueMode(nextMode);
    if (nextMode && battle.speed !== 0 && !finished) {
      onChange(setBattleSpeed(battle, 0));
    }
  };

  const issueOrQueueCommand = (
    unit: BattleUnit,
    summary: string,
    detail: string,
    apply: (state: BattleState) => BattleState,
  ) => {
    const transmissionPreview = commandTransmissionReport(battle, unit, "standard");
    if (!commandQueueMode) {
      onChange(apply(battle));
      return;
    }
    setQueuedCommands((current) =>
      [
        ...current,
        {
          id: `queued-${battle.elapsedSeconds}-${unit.unitId}-${Date.now()}-${current.length}`,
          subjectId: `unit:${unit.unitId}`,
          subjectName: unit.name,
          summary,
          detail,
          transmissionPreview,
          apply,
        },
      ].slice(-16),
    );
  };

  const issueOrQueueBattleCommand = (
    subjectId: string,
    subjectName: string,
    summary: string,
    detail: string,
    apply: (state: BattleState) => BattleState,
  ) => {
    if (!commandQueueMode) {
      onChange(apply(battle));
      return;
    }
    setQueuedCommands((current) =>
      [
        ...current,
        {
          id: `queued-${battle.elapsedSeconds}-${subjectId}-${Date.now()}-${current.length}`,
          subjectId,
          subjectName,
          summary,
          detail,
          apply,
        },
      ].slice(-16),
    );
  };

  const selectFrontlineDefender = (unit: BattleUnit) => {
    setSelectedUnitId(unit.unitId);
    scrollToPosition(unit.position);
  };

  const issueFrontlineDefenderRest = (unit: BattleUnit) => {
    selectFrontlineDefender(unit);
    issueOrQueueCommand(
      unit,
      "守備休息補給",
      `士気${Math.round(unit.morale)} / 弾薬${Math.round(unit.ammo)} / ${segmentName(battle, unit.standingOrder.frontlineSegmentId)}`,
      (state) => setUnitOrder(state, unit.unitId, "rest"),
    );
  };

  const issueFrontlineDefenderFallbackGuard = (unit: BattleUnit) => {
    selectFrontlineDefender(unit);
    issueOrQueueCommand(
      unit,
      "守備後退",
      `後退守備 / 士気${Math.round(unit.morale)} / 兵力${unit.soldiers}`,
      (state) => applyStandingOrderPreset(state, unit.unitId, "fallback_guard"),
    );
  };

  const issueFrontlineDefenderRecommendation = (
    unit: BattleUnit,
    action: "fallback" | "rest" | "hold",
  ) => {
    if (action === "fallback") {
      issueFrontlineDefenderFallbackGuard(unit);
      return;
    }
    if (action === "rest") {
      issueFrontlineDefenderRest(unit);
      return;
    }
    selectFrontlineDefender(unit);
  };

  const issueFrontlineDefenderBulkRecommendation = (
    action: "fallback" | "rest",
    units: BattleUnit[],
  ) => {
    if (!selectedFrontlineSegment || units.length === 0) {
      return;
    }
    const firstUnit = units[0];
    const actionLabel = action === "rest" ? "休息補給" : "後退守備";
    selectFrontlineDefender(firstUnit);
    issueOrQueueBattleCommand(
      `frontline-defender-${selectedFrontlineSegment.id}-${action}`,
      selectedFrontlineSegment.name,
      action === "rest" ? "疲弊守備休息" : "危険守備後退",
      `${selectedFrontlineSegment.name} / ${units.length}旅団 / ${actionLabel}`,
      (state) =>
        units.reduce(
          (nextBattle, unit) =>
            action === "rest"
              ? setUnitOrder(nextBattle, unit.unitId, "rest")
              : applyStandingOrderPreset(nextBattle, unit.unitId, "fallback_guard"),
          state,
        ),
    );
  };

  const applyQueuedCommandBatch = (batchSize: number, issueLabel: string) => {
    const issuedCommands = queuedCommands.slice(0, batchSize);
    const remainingCommands = queuedCommands.slice(batchSize);
    if (issuedCommands.length === 0) {
      return;
    }
    const issuedAt = battle.elapsedSeconds;
    const nextBattle = applyCommandCongestionToPendingOrders(
      issuedCommands.reduce((currentBattle, command) => command.apply(currentBattle), battle),
      issuedCommands.length,
      issuedAt,
    );
    const remainingLabel = remainingCommands.length > 0 ? `残り${remainingCommands.length}件。` : "";
    onChange({
      ...nextBattle,
      log: [`予約指揮: ${issuedCommands.length}/${queuedCommands.length}件を${issueLabel}。${remainingLabel}`, ...nextBattle.log].slice(
        0,
        12,
      ),
    });
    setQueuedCommands(remainingCommands);
    if (remainingCommands.length === 0) {
      setCommandQueueMode(false);
    }
  };

  const applyQueuedCommands = () => {
    applyQueuedCommandBatch(queuedCommands.length, "一括発令");
  };

  const removeQueuedCommand = (commandId: string) => {
    setQueuedCommands((current) => current.filter((command) => command.id !== commandId));
  };

  const scrollToPosition = (position: BattlePosition) => {
    const scroll = mapScrollRef.current;
    if (!scroll) {
      return;
    }
    setMinimapFocusPosition(position);
    const ratio = position.x / battle.mapBounds.width;
    scroll.scrollTo({
      left: Math.max(0, ratio * scroll.scrollWidth - scroll.clientWidth / 2),
      behavior: "smooth",
    });
    window.setTimeout(updateViewportRange, 250);
  };

  const currentViewportCenterPosition = (): BattlePosition => {
    const scroll = mapScrollRef.current;
    if (!scroll || scroll.scrollWidth <= 0) {
      return {
        x: ((viewportRange.left + viewportRange.width / 2) / 100) * battle.mapBounds.width,
        y: battle.mapBounds.height / 2,
      };
    }
    const xRatio = Math.max(0, Math.min(1, (scroll.scrollLeft + scroll.clientWidth / 2) / scroll.scrollWidth));
    return {
      x: xRatio * battle.mapBounds.width,
      y: minimapFocusPosition?.y ?? battle.mapBounds.height / 2,
    };
  };

  const positionFromClientPoint = (clientX: number, clientY: number): BattlePosition | null => {
    const field = mapFieldRef.current;
    if (!field) {
      return null;
    }
    const rect = field.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(battle.mapBounds.width, ((clientX - rect.left) / rect.width) * battle.mapBounds.width)),
      y: Math.max(0, Math.min(battle.mapBounds.height, ((clientY - rect.top) / rect.height) * battle.mapBounds.height)),
    };
  };

  const positionFromMapClick = (event: MouseEvent<HTMLElement>): BattlePosition | null =>
    positionFromClientPoint(event.clientX, event.clientY);

  const orderHandlePosition = (kind: DragOrderHandleKind): BattlePosition | undefined => {
    if (!selectedUnit) {
      return undefined;
    }
    if (dragOrderHandle?.unitId === selectedUnit.unitId && dragOrderHandle.kind === kind) {
      return dragOrderHandle.position;
    }
    return kind === "anchor" ? selectedUnit.standingOrder.anchor : selectedUnit.standingOrder.fallback.destination;
  };

  const frontlineHandlePosition = (
    kind: DragFrontlineHandleKind,
    segment = selectedFrontlineSegment,
  ): BattlePosition | undefined => {
    if (!segment) {
      return undefined;
    }
    if (dragFrontlineHandle?.segmentId === segment.id && dragFrontlineHandle.kind === kind) {
      return dragFrontlineHandle.position;
    }
    return kind === "frontline-anchor" ? segment.anchor : segment.fallbackPoint;
  };

  const startOrderHandleDrag = (event: PointerEvent<HTMLButtonElement>, kind: DragOrderHandleKind) => {
    if (!selectedUnit) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCommandMode("none");
    const nextDrag = {
      unitId: selectedUnit.unitId,
      kind,
      position: positionFromClientPoint(event.clientX, event.clientY) ?? orderHandlePosition(kind) ?? selectedUnit.position,
    };
    dragOrderHandleRef.current = nextDrag;
    setDragOrderHandle(nextDrag);
  };

  const startOrderHandleMouseDrag = (event: MouseEvent<HTMLButtonElement>, kind: DragOrderHandleKind) => {
    if (!selectedUnit) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextDrag = {
      unitId: selectedUnit.unitId,
      kind,
      position: positionFromClientPoint(event.clientX, event.clientY) ?? orderHandlePosition(kind) ?? selectedUnit.position,
    };
    dragOrderHandleRef.current = nextDrag;
    setCommandMode("none");
    setDragOrderHandle(nextDrag);
  };

  const startFrontlineHandleDrag = (
    event: PointerEvent<HTMLButtonElement>,
    segmentId: string,
    kind: DragFrontlineHandleKind,
  ) => {
    const segment = battle.frontlineSegments.find((candidate) => candidate.id === segmentId);
    if (!segment) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCommandMode("none");
    setSelectedFrontlineSegmentId(segment.id);
    const nextDrag = {
      segmentId: segment.id,
      kind,
      position: positionFromClientPoint(event.clientX, event.clientY) ?? frontlineHandlePosition(kind, segment) ?? segment.anchor,
    };
    dragFrontlineHandleRef.current = nextDrag;
    setDragFrontlineHandle(nextDrag);
  };

  const startFrontlineHandleMouseDrag = (
    event: MouseEvent<HTMLButtonElement>,
    segmentId: string,
    kind: DragFrontlineHandleKind,
  ) => {
    const segment = battle.frontlineSegments.find((candidate) => candidate.id === segmentId);
    if (!segment) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setCommandMode("none");
    setSelectedFrontlineSegmentId(segment.id);
    const nextDrag = {
      segmentId: segment.id,
      kind,
      position: positionFromClientPoint(event.clientX, event.clientY) ?? frontlineHandlePosition(kind, segment) ?? segment.anchor,
    };
    dragFrontlineHandleRef.current = nextDrag;
    setDragFrontlineHandle(nextDrag);
  };

  const moveOrderHandleDragTo = (clientX: number, clientY: number) => {
    const currentDrag = dragOrderHandleRef.current;
    if (!currentDrag) {
      return;
    }
    const position = positionFromClientPoint(clientX, clientY);
    if (!position) {
      return;
    }
    const nextDrag = { ...currentDrag, position };
    dragOrderHandleRef.current = nextDrag;
    setDragOrderHandle(nextDrag);
  };

  const moveFrontlineHandleDragTo = (clientX: number, clientY: number) => {
    const currentDrag = dragFrontlineHandleRef.current;
    if (!currentDrag) {
      return;
    }
    const position = positionFromClientPoint(clientX, clientY);
    if (!position) {
      return;
    }
    const nextDrag = { ...currentDrag, position };
    dragFrontlineHandleRef.current = nextDrag;
    setDragFrontlineHandle(nextDrag);
  };

  const finishOrderHandleDragAt = (clientX: number, clientY: number) => {
    const currentDrag = dragOrderHandleRef.current;
    if (!currentDrag) {
      return;
    }
    const position = positionFromClientPoint(clientX, clientY) ?? currentDrag.position;
    const draggedUnit = battle.playerUnits.find((unit) => unit.unitId === currentDrag.unitId);
    dragOrderHandleRef.current = null;
    setSelectedUnitId(currentDrag.unitId);
    setDragOrderHandle(null);
    if (!draggedUnit) {
      return;
    }
    issueOrQueueCommand(
      draggedUnit,
      currentDrag.kind === "anchor" ? "基準位置" : "後退地点",
      `${currentDrag.kind === "anchor" ? "基準" : "後退"} ${mapCoordinateLabel(position)} / ドラッグ指定`,
      (state) =>
        currentDrag.kind === "anchor"
          ? setStandingOrderAnchor(state, currentDrag.unitId, position)
          : setStandingOrderFallbackDestination(state, currentDrag.unitId, position),
    );
  };

  const finishFrontlineHandleDragAt = (clientX: number, clientY: number) => {
    const currentDrag = dragFrontlineHandleRef.current;
    if (!currentDrag) {
      return;
    }
    const position = positionFromClientPoint(clientX, clientY) ?? currentDrag.position;
    const nextBattle =
      currentDrag.kind === "frontline-anchor"
        ? repositionFrontlineSegment(battle, currentDrag.segmentId, position)
        : setFrontlineSegmentFallback(battle, currentDrag.segmentId, position);
    dragFrontlineHandleRef.current = null;
    onChange(nextBattle);
    setSelectedFrontlineSegmentId(currentDrag.segmentId);
    setDragFrontlineHandle(null);
  };

  const startFrontlineSketch = () => {
    if (!selectedFrontlineSegment || finished) {
      return;
    }
    setFrontlineSketchDraft({ segmentId: selectedFrontlineSegment.id, points: [] });
    setCommandMode("none");
    window.setTimeout(() => {
      mapScrollRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  };

  const cancelFrontlineSketch = () => {
    setFrontlineSketchDraft(null);
  };

  const completeFrontlineSketch = () => {
    if (!frontlineSketchDraft || frontlineSketchDraft.points.length < 2) {
      return;
    }
    const segment = battle.frontlineSegments.find((candidate) => candidate.id === frontlineSketchDraft.segmentId);
    if (!segment) {
      setFrontlineSketchDraft(null);
      return;
    }
    onChange(sketchFrontlineSegmentPolyline(battle, segment.id, frontlineSketchDraft.points));
    setSelectedFrontlineSegmentId(segment.id);
    setFrontlineSketchDraft(null);
    scrollToPosition(frontlineSketchDraft.points[0]);
  };

  const saveSelectedFrontlineStandingOrders = () => {
    if (!selectedFrontlineSegment || !onSaveStandingOrderTemplate || selectedFrontlineDefenders.length === 0) {
      return;
    }
    const sketchPoints = selectedFrontlineSegment.sketchPoints ?? [
      selectedFrontlineSegment.anchor,
      selectedFrontlineSegment.fallbackPoint,
    ];
    const sketchSummary =
      selectedFrontlineSegment.sketchPoints && selectedFrontlineSegment.sketchPoints.length > 2
        ? ` / 形状${selectedFrontlineSegment.sketchPoints.length}点`
        : "";
    const description = `${selectedFrontlineSegment.name}で戦闘中に保存した戦線方針。基準X${Math.round(
      selectedFrontlineSegment.anchor.x,
    )} Y${Math.round(selectedFrontlineSegment.anchor.y)} / 後退X${Math.round(
      selectedFrontlineSegment.fallbackPoint.x,
    )} Y${Math.round(selectedFrontlineSegment.fallbackPoint.y)}${sketchSummary}。次回主戦場の初期配置へ適用する。`;
    selectedFrontlineDefenders.forEach((unit) => onSaveStandingOrderTemplate(unit, description, sketchPoints));
  };

  const applyFrontlineSketchPoint = (position: BattlePosition): boolean => {
    if (!frontlineSketchDraft) {
      return false;
    }
    const segment = battle.frontlineSegments.find((candidate) => candidate.id === frontlineSketchDraft.segmentId);
    if (!segment) {
      setFrontlineSketchDraft(null);
      return true;
    }
    const nextPoints = [...frontlineSketchDraft.points, position].slice(0, maxFrontlineSketchPoints);
    setFrontlineSketchDraft({ ...frontlineSketchDraft, points: nextPoints });
    setSelectedFrontlineSegmentId(segment.id);
    scrollToPosition(position);
    return true;
  };

  const moveOrderHandleDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragOrderHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    moveOrderHandleDragTo(event.clientX, event.clientY);
  };

  const moveFrontlineHandleDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragFrontlineHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    moveFrontlineHandleDragTo(event.clientX, event.clientY);
  };

  const finishOrderHandleDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragOrderHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    finishOrderHandleDragAt(event.clientX, event.clientY);
  };

  const finishFrontlineHandleDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragFrontlineHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    finishFrontlineHandleDragAt(event.clientX, event.clientY);
  };

  const moveOrderHandleMouseDrag = (event: MouseEvent<HTMLButtonElement>) => {
    if (!dragOrderHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    moveOrderHandleDragTo(event.clientX, event.clientY);
  };

  const moveFrontlineHandleMouseDrag = (event: MouseEvent<HTMLButtonElement>) => {
    if (!dragFrontlineHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    moveFrontlineHandleDragTo(event.clientX, event.clientY);
  };

  const finishOrderHandleMouseDrag = (event: MouseEvent<HTMLButtonElement>) => {
    if (!dragOrderHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    finishOrderHandleDragAt(event.clientX, event.clientY);
  };

  const finishFrontlineHandleMouseDrag = (event: MouseEvent<HTMLButtonElement>) => {
    if (!dragFrontlineHandleRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    finishFrontlineHandleDragAt(event.clientX, event.clientY);
  };

  useEffect(() => {
    if (!dragOrderHandle) {
      return;
    }
    const handleMouseMove = (event: globalThis.MouseEvent) => moveOrderHandleDragTo(event.clientX, event.clientY);
    const handleMouseUp = (event: globalThis.MouseEvent) => finishOrderHandleDragAt(event.clientX, event.clientY);
    const handlePointerMove = (event: globalThis.PointerEvent) => moveOrderHandleDragTo(event.clientX, event.clientY);
    const handlePointerUp = (event: globalThis.PointerEvent) => finishOrderHandleDragAt(event.clientX, event.clientY);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [battle, dragOrderHandle, onChange]);

  useEffect(() => {
    if (!dragFrontlineHandle) {
      return;
    }
    const handleMouseMove = (event: globalThis.MouseEvent) => moveFrontlineHandleDragTo(event.clientX, event.clientY);
    const handleMouseUp = (event: globalThis.MouseEvent) => finishFrontlineHandleDragAt(event.clientX, event.clientY);
    const handlePointerMove = (event: globalThis.PointerEvent) => moveFrontlineHandleDragTo(event.clientX, event.clientY);
    const handlePointerUp = (event: globalThis.PointerEvent) => finishFrontlineHandleDragAt(event.clientX, event.clientY);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [battle, dragFrontlineHandle, onChange]);

  const applyMapCommand = (event: MouseEvent<HTMLElement>) => {
    if (frontlineSketchDraft) {
      const position = positionFromMapClick(event);
      if (!position) {
        return;
      }
      applyFrontlineSketchPoint(position);
      return;
    }
    if (
      !selectedUnit ||
      commandMode === "none" ||
      commandMode === "select" ||
      commandMode === "facility" ||
      commandMode === "focusTarget"
    ) {
      return;
    }
    const position = positionFromMapClick(event);
    if (!position) {
      return;
    }
    if (commandMode === "segment") {
      const segment = segmentForCommandPosition(battle, position);
      if (!segment) {
        return;
      }
      issueOrQueueCommand(
        selectedUnit,
        `戦線 ${segment.name}`,
        `担当戦線を${segment.name}へ / 基準 ${mapCoordinateLabel(segment.anchor)}`,
        (state) => assignFrontlineSegment(state, selectedUnit.unitId, segment.id),
      );
      setCommandMode("none");
      setSelectedUnitId(selectedUnit.unitId);
      scrollToPosition(segment.anchor);
      return;
    }
    issueOrQueueCommand(
      selectedUnit,
      commandMode === "anchor" ? "基準位置" : "後退地点",
      `${commandMode === "anchor" ? "基準" : "後退"} ${mapCoordinateLabel(position)} / マップ指定`,
      (state) =>
        commandMode === "anchor"
          ? setStandingOrderAnchor(state, selectedUnit.unitId, position)
          : setStandingOrderFallbackDestination(state, selectedUnit.unitId, position),
    );
    setCommandMode("none");
  };

  const toggleCommandMode = (mode: Exclude<MapCommandMode, "none">) => {
    const nextMode = commandMode === mode ? "none" : mode;
    setCommandMode(nextMode);
    if (nextMode !== "none") {
      window.setTimeout(() => {
        mapScrollRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
    }
  };

  const assignSelectedFacility = (event: MouseEvent<HTMLElement>, structure: BattleStructure) => {
    if (commandMode === "select") {
      event.stopPropagation();
      setInspectedStructureId(structure.id);
      setSelectedEnemyId("");
      scrollToPosition(structure.position);
      return;
    }
    if (!selectedUnit || commandMode !== "facility") {
      return;
    }
    event.stopPropagation();
    const mode = facilityModeForUnit(selectedUnit, structure);
    issueOrQueueCommand(
      selectedUnit,
      `${fortificationTypeLabels[structure.type]}担当`,
      `${fortificationStatusLabels[structure.status]} / ${facilityAssignmentModeLabels[mode]} / ${mapCoordinateLabel(structure.position)}`,
      (state) => assignFacilityToUnit(state, selectedUnit.unitId, structure.id, mode),
    );
    setCommandMode("none");
    setSelectedUnitId(selectedUnit.unitId);
  };

  const assignSelectedFocusTarget = (event: MouseEvent<HTMLElement>, enemy: EnemyBattleUnit) => {
    event.stopPropagation();
    setSelectedEnemyId(enemy.id);
    if (commandMode === "select") {
      setInspectedStructureId("");
    }
    if (commandMode !== "focusTarget") {
      scrollToPosition(enemy.position);
      return;
    }
    if (!selectedUnit || !enemy.isSpotted) {
      scrollToPosition(enemy.position);
      return;
    }
    issueOrQueueCommand(
      selectedUnit,
      `集中 ${mapEnemyDisplayName(enemy)}`,
      `${Math.round(enemy.count)}体 / ${enemyAssaultPhaseLabels[enemy.assaultPlan.phase]} / ${mapCoordinateLabel(enemy.position)}`,
      (state) => setUnitFocusTarget(state, selectedUnit.unitId, enemy.id),
    );
    setCommandMode("none");
    setSelectedUnitId(selectedUnit.unitId);
    scrollToPosition(enemy.position);
  };

  const focusSelectedEnemy = () => {
    if (!selectedUnit || !selectedEnemy || !selectedEnemy.isSpotted) {
      return;
    }
    setCommandMode("none");
    scrollToPosition(selectedEnemy.position);
    issueOrQueueCommand(
      selectedUnit,
      `集中 ${mapEnemyDisplayName(selectedEnemy)}`,
      `${Math.round(selectedEnemy.count)}体 / ${enemyAssaultPhaseLabels[selectedEnemy.assaultPlan.phase]} / 敵パネル指定`,
      (state) => setUnitFocusTarget(state, selectedUnit.unitId, selectedEnemy.id),
    );
  };

  const applyObjectiveResponse = (event: MouseEvent<HTMLButtonElement>, node: BattleObjectiveNode) => {
    event.stopPropagation();
    const nextBattle = applyObjectiveNodeResponse(battle, node.id);
    const assignedUnit =
      nextBattle.playerUnits.find(
        (unit) =>
          unit.soldiers > 0 &&
          distance(unit.standingOrder.anchor, node.position) <= node.radius + 14 &&
          unit.order !== "retreat",
      ) ?? nextBattle.playerUnits.find((unit) => unit.soldiers > 0 && unit.order !== "retreat");
    if (assignedUnit) {
      setSelectedUnitId(assignedUnit.unitId);
    }
    setSelectedEnemyId("");
    setCommandMode("none");
    scrollToPosition(node.position);
    onChange(nextBattle);
  };

  const applySelectedFrontlineObjectiveSupport = (node: BattleObjectiveNode) => {
    if (!selectedFrontlineSegment || finished) {
      return;
    }
    const nextBattle = applyFrontlineObjectiveSupport(battle, selectedFrontlineSegment.id, node.id);
    const assignedUnit =
      nextBattle.playerUnits.find(
        (unit) =>
          unit.soldiers > 0 &&
          unit.order !== "retreat" &&
          unit.standingOrder.frontlineSegmentId === selectedFrontlineSegment.id &&
          distance(unit.standingOrder.anchor, node.position) <= node.radius + 18,
      ) ??
      nextBattle.playerUnits.find(
        (unit) =>
          unit.soldiers > 0 &&
          unit.order !== "retreat" &&
          unit.standingOrder.frontlineSegmentId === selectedFrontlineSegment.id,
      );
    if (assignedUnit) {
      setSelectedUnitId(assignedUnit.unitId);
    }
    setSelectedEnemyId("");
    setCommandMode("none");
    scrollToPosition(node.position);
    onChange(nextBattle);
  };

  const applyObjectiveStaffRecommendation = (recommendation: ObjectiveStaffRecommendation) => {
    if (finished || recommendation.defenders === 0) {
      return;
    }
    setSelectedFrontlineSegmentId(recommendation.segment.id);
    setSelectedEnemyId("");
    setCommandMode("none");
    scrollToPosition(recommendation.node.position);
    issueOrQueueBattleCommand(
      recommendation.id,
      `${recommendation.node.label}/${recommendation.segment.name}`,
      `目標連携 ${objectiveResponseTacticalProfile(recommendation.node, battle.structures).actionLabel}`,
      `${recommendation.segment.name} / ${recommendation.riskLabel} / 評価${Math.round(recommendation.score)}`,
      (state) => applyFrontlineObjectiveSupport(state, recommendation.segment.id, recommendation.node.id),
    );
  };

  const applySelectedEnemyResponse = () => {
    if (!selectedEnemy || !selectedEnemy.isSpotted || selectedEnemyResponseUnits.length === 0) {
      return;
    }

    const posture = enemyResponsePosture(selectedEnemy);
    const priority = enemyResponsePriority(selectedEnemy);
    const responseUnitIds = selectedEnemyResponseUnits.map((unit) => unit.unitId);
    const applyResponse = (state: BattleState): BattleState => {
      let nextBattle = state;
      for (const unitId of responseUnitIds) {
        nextBattle = applyStandingOrderPreset(nextBattle, unitId, posture);
        nextBattle = setStandingOrderTargetPriority(nextBattle, unitId, priority);
        nextBattle = setUnitFocusTarget(nextBattle, unitId, selectedEnemy.id);
      }
      return {
        ...nextBattle,
        log: [
          `敵群対応: ${responseUnitIds.length}旅団を${selectedEnemySegment?.name ?? "近接戦線"}で${enemyResponseLabel(
            selectedEnemy,
          )}へ移行。`,
          ...nextBattle.log,
        ].slice(0, 12),
      };
    };
    setSelectedUnitId(selectedEnemyResponseUnits[0].unitId);
    setCommandMode("none");
    scrollToPosition(selectedEnemy.position);
    issueOrQueueBattleCommand(
      `enemy-response:${selectedEnemy.id}`,
      selectedEnemySegment?.name ?? mapEnemyDisplayName(selectedEnemy),
      `敵群対応 ${enemyResponseLabel(selectedEnemy)}`,
      `${mapEnemyDisplayName(selectedEnemy)} ${Math.round(selectedEnemy.count)}体 / ${responseUnitIds.length}旅団`,
      applyResponse,
    );
  };

  const inspectFrontlinePressure = (report: FrontlinePressureReport) => {
    setSelectedFrontlineSegmentId(report.segment.id);
    if (report.defenders[0]) {
      setSelectedUnitId(report.defenders[0].unitId);
    }
    if (report.leadEnemy) {
      setSelectedEnemyId(report.leadEnemy.id);
      scrollToPosition(report.leadEnemy.position);
      return;
    }
    setSelectedEnemyId("");
    scrollToPosition(report.segment.anchor);
  };

  const applyFrontlinePressureResponse = (report: FrontlinePressureReport) => {
    if ((report.defenders.length === 0 && report.reserves.length === 0) || report.level === "quiet") {
      inspectFrontlinePressure(report);
      return;
    }

    const reserveCount =
      report.responseType === "reserve_commit" || report.responseType === "seal_breach" ? report.reserves.length : 0;
    const applyResponse = (state: BattleState): BattleState => {
      let nextBattle = state;
      const counterstrokeUnits =
        report.responseType === "counterstroke"
          ? [...report.defenders, ...report.reserves].slice(0, Math.max(2, Math.min(3, report.defenders.length + report.reserves.length)))
          : [];

      for (const unit of report.defenders) {
        nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, report.posture);
        if (report.leadEnemy?.isSpotted) {
          nextBattle = setUnitFocusTarget(nextBattle, unit.unitId, report.leadEnemy.id);
          nextBattle = setStandingOrderTargetPriority(nextBattle, unit.unitId, enemyResponsePriority(report.leadEnemy));
        }
      }

      if (report.responseType === "reserve_commit" || report.responseType === "seal_breach") {
        for (const reserve of report.reserves) {
          nextBattle = assignFrontlineSegment(nextBattle, reserve.unitId, report.segment.id);
          nextBattle = applyStandingOrderPreset(
            nextBattle,
            reserve.unitId,
            report.responseType === "seal_breach" ? "fallback_guard" : "elastic_defense",
          );
          nextBattle = setStandingOrderAnchor(nextBattle, reserve.unitId, report.segment.anchor);
          nextBattle = setStandingOrderFallbackDestination(nextBattle, reserve.unitId, report.segment.fallbackPoint);
          if (report.leadEnemy?.isSpotted) {
            nextBattle = setUnitFocusTarget(nextBattle, reserve.unitId, report.leadEnemy.id);
            nextBattle = setStandingOrderTargetPriority(nextBattle, reserve.unitId, enemyResponsePriority(report.leadEnemy));
          }
        }
      }

      if (report.responseType === "counterstroke") {
        for (const unit of counterstrokeUnits) {
          nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "aggressive_screen");
          nextBattle = setStandingOrderAmmoPolicy(nextBattle, unit.unitId, "intense");
          if (report.leadEnemy?.isSpotted) {
            nextBattle = setUnitFocusTarget(nextBattle, unit.unitId, report.leadEnemy.id);
            nextBattle = setStandingOrderTargetPriority(nextBattle, unit.unitId, enemyResponsePriority(report.leadEnemy));
          }
        }
        const issuer = counterstrokeUnits[0];
        if (issuer && report.leadEnemy?.isSpotted) {
          nextBattle = issueFireMission(nextBattle, issuer.unitId, "frontline_segment");
        }
      }

      const committedUnitIds = new Set(
        report.responseType === "counterstroke"
          ? counterstrokeUnits.map((unit) => unit.unitId)
          : report.reserves.map((unit) => unit.unitId),
      );
      if (committedUnitIds.size > 0) {
        nextBattle = {
          ...nextBattle,
          playerUnits: nextBattle.playerUnits.map((unit) =>
            committedUnitIds.has(unit.unitId)
              ? { ...unit, reserveReadiness: Math.max(0, (unit.reserveReadiness ?? 0) - 34) }
              : unit,
          ),
        };
      }

      return {
        ...nextBattle,
        log: [
          `戦線圧力対応: ${report.segment.name}で${report.recommendationLabel}。守備${report.defenders.length}旅団 / 予備${reserveCount}旅団。`,
          ...nextBattle.log,
        ].slice(0, 12),
      };
    };

    const counterstrokeUnits =
      report.responseType === "counterstroke"
        ? [...report.defenders, ...report.reserves].slice(0, Math.max(2, Math.min(3, report.defenders.length + report.reserves.length)))
        : [];

    const selectedResponseUnit =
      report.responseType === "reserve_commit" || report.responseType === "seal_breach"
        ? report.reserves[0] ?? report.defenders[0]
        : counterstrokeUnits[0] ?? report.defenders[0] ?? report.reserves[0];
    if (selectedResponseUnit) {
      setSelectedUnitId(selectedResponseUnit.unitId);
    }
    setSelectedFrontlineSegmentId(report.segment.id);
    if (report.leadEnemy) {
      setSelectedEnemyId(report.leadEnemy.id);
      scrollToPosition(report.leadEnemy.position);
    } else {
      scrollToPosition(report.segment.anchor);
    }
    setCommandMode("none");
    issueOrQueueBattleCommand(
      `frontline:${report.segment.id}`,
      report.segment.name,
      report.recommendationLabel,
      `守備${report.defenders.length}旅団 / 予備${reserveCount}旅団 / 敵圧${Math.round(report.pressure)}`,
      applyResponse,
    );
  };

  const applyFrontlineRotationResponse = (
    report: FrontlinePressureReport,
    tiredUnitId?: string,
    reserveUnitId?: string,
  ) => {
    const preview = frontlineRotationPreview(report, tiredUnitId, reserveUnitId, pressureReports);
    if (!preview) {
      inspectFrontlinePressure(report);
      return;
    }
    setSelectedFrontlineSegmentId(report.segment.id);
    setSelectedUnitId(preview.reserveUnit.unitId);
    setSelectedEnemyId(report.leadEnemy?.id ?? "");
    setCommandMode("none");
    scrollToPosition(report.segment.anchor);
    issueOrQueueBattleCommand(
      `frontline-rotation:${report.segment.id}`,
      report.segment.name,
      preview.label,
      `${preview.detail} / 敵圧${Math.round(report.pressure)}`,
      (state) =>
        applyFrontlineRotation(state, report.segment.id, {
          tiredUnitId: preview.tiredUnit.unitId,
          reserveUnitId: preview.reserveUnit.unitId,
        }),
    );
  };

  const applySelectedFrontlineDoctrine = (presetId: FrontlineDoctrinePresetId) => {
    if (!selectedFrontlineSegment || finished) {
      return;
    }
    const nextBattle = applyFrontlineDoctrinePreset(battle, selectedFrontlineSegment.id, presetId);
    const nextSegment = nextBattle.frontlineSegments.find((segment) => segment.id === selectedFrontlineSegment.id);
    const firstDefender = nextBattle.playerUnits.find(
      (unit) => unit.standingOrder.frontlineSegmentId === selectedFrontlineSegment.id && unit.soldiers > 0,
    );
    if (firstDefender) {
      setSelectedUnitId(firstDefender.unitId);
    }
    if (nextSegment) {
      setSelectedFrontlineSegmentId(nextSegment.id);
      scrollToPosition(nextSegment.anchor);
    }
    setCommandMode("none");
    onChange(nextBattle);
  };

  const inspectStaffAdvisory = (advisory: StaffFrontlineAdvisory) => {
    setSelectedFrontlineSegmentId(advisory.segment.id);
    if (advisory.report.defenders[0]) {
      setSelectedUnitId(advisory.report.defenders[0].unitId);
    }
    if (advisory.report.leadEnemy) {
      setSelectedEnemyId(advisory.report.leadEnemy.id);
      scrollToPosition(advisory.report.leadEnemy.position);
      return;
    }
    setSelectedEnemyId("");
    scrollToPosition(advisory.segment.anchor);
  };

  const applyStaffAdvisory = (advisory: StaffFrontlineAdvisory) => {
    if (finished) {
      return;
    }
    setSelectedFrontlineSegmentId(advisory.segment.id);
    setSelectedEnemyId(advisory.report.leadEnemy?.id ?? "");
    setCommandMode("none");
    scrollToPosition(advisory.report.leadEnemy?.position ?? advisory.segment.anchor);
    const firstDefender = advisory.report.defenders[0];
    if (firstDefender) {
      setSelectedUnitId(firstDefender.unitId);
    }
    issueOrQueueBattleCommand(
      `staff-advisory:${advisory.segment.id}:${advisory.preset.id}`,
      advisory.segment.name,
      `参謀 ${advisory.preset.label}`,
      `${advisory.detail} / ${advisory.assessment.reason}`,
      (state) => {
        const nextBattle = applyFrontlineDoctrinePreset(state, advisory.segment.id, advisory.preset.id);
        const unitIds = nextBattle.playerUnits
          .filter((unit) => unit.standingOrder.frontlineSegmentId === advisory.segment.id && unit.soldiers > 0)
          .map((unit) => unit.unitId);
        const leadThreatLabel = advisory.report.leadEnemy
          ? `${mapEnemyDisplayName(advisory.report.leadEnemy)} ${enemyAssaultPhaseLabels[advisory.report.leadEnemy.assaultPlan.phase]}`
          : undefined;
        return {
          ...nextBattle,
          staffAdvisoryResponses: [
            {
              id: `staff-advisory-${state.elapsedSeconds}-${advisory.segment.id}-${advisory.preset.id}`,
              issuedAt: state.elapsedSeconds,
              segmentId: advisory.segment.id,
              segmentName: advisory.segment.name,
              presetId: advisory.preset.id,
              presetLabel: advisory.preset.label,
              reason: advisory.assessment.reason,
              unitIds,
              pressureAtIssue: Math.round(advisory.report.pressure),
              leadThreatLabel,
              forecast: {
                casualtyRisk: advisory.assessment.casualtyRisk,
                ammoBurn: advisory.assessment.ammoBurn,
                lineRisk: advisory.assessment.lineRisk,
              },
            },
            ...(nextBattle.staffAdvisoryResponses ?? []),
          ].slice(0, 12),
          log: [
            `参謀警告対応: ${advisory.segment.name}へ${advisory.preset.label}。${advisory.assessment.reason}`,
            ...nextBattle.log,
          ].slice(0, 12),
        };
      },
    );
  };

  const selectReserveUnit = (unit: BattleUnit) => {
    setSelectedUnitId(unit.unitId);
    setSelectedFrontlineSegmentId(unit.standingOrder.frontlineSegmentId ?? selectedFrontlineSegment?.id ?? "");
    scrollToPosition(unit.position);
  };

  const returnReserveUnit = (unit: BattleUnit, posture: "fallback_guard" | "fire_support" = "fallback_guard") => {
    setSelectedUnitId(unit.unitId);
    setSelectedEnemyId("");
    setCommandMode("none");
    const nextBattle = returnUnitToReserveLine(battle, unit.unitId, {
      posture: posture === "fire_support" || unit.type === "artillery" ? "fire_support" : "fallback_guard",
      readinessFloor: posture === "fire_support" ? 64 : 58,
    });
    const reserveSegment = nextBattle.frontlineSegments.find((segment) => segment.id === "reserve-line");
    if (reserveSegment) {
      setSelectedFrontlineSegmentId(reserveSegment.id);
      scrollToPosition(reserveSegment.anchor);
    }
    onChange(nextBattle);
  };

  const volleySelectedEnemyResponse = () => {
    if (!selectedEnemy || !selectedEnemy.isSpotted || selectedEnemyResponseUnits.length === 0) {
      return;
    }
    const issuer = selectedEnemyResponseUnits[0];
    setSelectedUnitId(issuer.unitId);
    setCommandMode("none");
    scrollToPosition(selectedEnemy.position);
    issueOrQueueBattleCommand(
      `enemy-volley:${selectedEnemy.id}:${issuer.unitId}`,
      selectedEnemySegment?.name ?? issuer.name,
      "担当戦線斉射",
      `${issuer.name}基準 / ${mapEnemyDisplayName(selectedEnemy)} ${Math.round(selectedEnemy.count)}体`,
      (state) => {
        let nextBattle = setUnitFocusTarget(state, issuer.unitId, selectedEnemy.id);
        nextBattle = issueFireMission(nextBattle, issuer.unitId, "frontline_segment");
        return {
          ...nextBattle,
          log: [
            `敵群対応斉射: ${issuer.name}基準で${selectedEnemySegment?.name ?? "近接戦線"}の斉射を要請。`,
            ...nextBattle.log,
          ].slice(0, 12),
        };
      },
    );
  };

  const inspectEnemyCommandGroup = (group: EnemyCommandGroupReport) => {
    setSelectedEnemyId(group.leadThreat.id);
    if (group.targetSegment) {
      setSelectedFrontlineSegmentId(group.targetSegment.id);
    }
    setCommandMode("none");
    scrollToPosition(group.leadThreat.position);
  };

  const applyEnemyCommandGroupFire = (group: EnemyCommandGroupReport) => {
    const currentTarget = enemyCommandGroupPrimaryTarget(battle, group, "command_node");
    if (!currentTarget) {
      return;
    }
    const initialUnits = enemyResponseUnits(battle, currentTarget).slice(0, 3);
    inspectEnemyCommandGroup(group);
    if (initialUnits[0]) {
      setSelectedUnitId(initialUnits[0].unitId);
    }
    issueOrQueueBattleCommand(
      `enemy-command-fire:${group.id}`,
      group.label,
      "指揮核射撃",
      `${mapEnemyDisplayName(currentTarget)} / ${initialUnits.length}旅団 / ${group.targetSegment?.name ?? group.targetName}`,
      (state) => {
        const target = enemyCommandGroupPrimaryTarget(state, group, "command_node");
        if (!target) {
          return {
            ...state,
            log: [`敵指揮網対応: ${group.label}の指揮核を見失った。`, ...state.log].slice(0, 12),
          };
        }
        const responseUnits = enemyResponseUnits(state, target).slice(0, 3);
        let nextBattle = state;
        for (const unit of responseUnits) {
          nextBattle = setStandingOrderTargetPriority(nextBattle, unit.unitId, "officer");
          nextBattle = setStandingOrderAmmoPolicy(nextBattle, unit.unitId, "intense");
          nextBattle = setUnitFocusTarget(nextBattle, unit.unitId, target.id);
        }
        if (responseUnits[0]) {
          nextBattle = issueFireMission(nextBattle, responseUnits[0].unitId, "frontline_segment");
        }
        const responseUnitIds = new Set(responseUnits.map((unit) => unit.unitId));
        return {
          ...nextBattle,
          playerUnits: nextBattle.playerUnits.map((unit) =>
            responseUnitIds.has(unit.unitId) ? { ...unit, enemyCommandActionRole: "command_node_fire" } : unit,
          ),
          log: [
            `敵指揮網対応: ${group.label}へ指揮核射撃。${responseUnits.length}旅団が${mapEnemyDisplayName(target)}を優先。`,
            ...nextBattle.log,
          ].slice(0, 12),
        };
      },
    );
  };

  const applyEnemyCommandGroupPursuit = (group: EnemyCommandGroupReport) => {
    const currentTarget = enemyCommandGroupPrimaryTarget(battle, group, "pursuit");
    if (!currentTarget) {
      return;
    }
    const initialUnits = enemyResponseUnits(battle, currentTarget).slice(0, 3);
    inspectEnemyCommandGroup(group);
    if (initialUnits[0]) {
      setSelectedUnitId(initialUnits[0].unitId);
    }
    issueOrQueueBattleCommand(
      `enemy-command-pursuit:${group.id}`,
      group.label,
      "崩壊追撃",
      `${mapEnemyDisplayName(currentTarget)} / ${enemyPursuitReason(currentTarget)} / ${initialUnits.length}旅団`,
      (state) => {
        const target = enemyCommandGroupPrimaryTarget(state, group, "pursuit");
        if (!target) {
          return {
            ...state,
            log: [`敵指揮網対応: ${group.label}の追撃目標を見失った。`, ...state.log].slice(0, 12),
          };
        }
        const pursuitUnits = enemyResponseUnits(state, target).slice(0, 3);
        let nextBattle = state;
        for (const unit of pursuitUnits) {
          nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "aggressive_screen");
          nextBattle = setStandingOrderTargetPriority(nextBattle, unit.unitId, "weakest");
          nextBattle = setStandingOrderAmmoPolicy(nextBattle, unit.unitId, "intense");
          nextBattle = setUnitFocusTarget(nextBattle, unit.unitId, target.id);
        }
        if (pursuitUnits[0]) {
          nextBattle = issueFireMission(nextBattle, pursuitUnits[0].unitId, "frontline_segment");
        }
        const pursuitUnitIds = new Set(pursuitUnits.map((unit) => unit.unitId));
        return {
          ...nextBattle,
          playerUnits: nextBattle.playerUnits.map((unit) =>
            pursuitUnitIds.has(unit.unitId) ? { ...unit, enemyCommandActionRole: "collapse_pursuit" } : unit,
          ),
          log: [
            `敵指揮網対応: ${group.label}へ崩壊追撃。${pursuitUnits.length}旅団が弱敵掃討へ移行。`,
            ...nextBattle.log,
          ].slice(0, 12),
        };
      },
    );
  };

  const applyEnemyCommandGroupReserveCommit = (group: EnemyCommandGroupReport) => {
    const currentTarget = enemyCommandGroupPrimaryTarget(battle, group, "lead");
    const currentSegment = currentTarget ? enemyThreatSegment(battle, currentTarget) : group.targetSegment;
    if (!currentTarget || !currentSegment) {
      return;
    }
    const currentDefenders = enemyResponseUnits(battle, currentTarget).filter(
      (unit) => unit.standingOrder.frontlineSegmentId === currentSegment.id,
    );
    const currentReserves = frontlineReserveUnits(battle, currentSegment, currentDefenders, currentTarget).slice(0, 2);
    inspectEnemyCommandGroup(group);
    if (currentReserves[0]) {
      setSelectedUnitId(currentReserves[0].unitId);
    }
    issueOrQueueBattleCommand(
      `enemy-command-reserve:${group.id}`,
      group.label,
      "指揮網へ予備投入",
      `${currentSegment.name} / 予備${currentReserves.length}旅団 / ${mapEnemyDisplayName(currentTarget)}`,
      (state) => {
        const target = enemyCommandGroupPrimaryTarget(state, group, "lead");
        const segment = target ? enemyThreatSegment(state, target) : group.targetSegment;
        if (!target || !segment) {
          return {
            ...state,
            log: [`敵指揮網対応: ${group.label}の予備投入先を見失った。`, ...state.log].slice(0, 12),
          };
        }
        const defenders = enemyResponseUnits(state, target).filter((unit) => unit.standingOrder.frontlineSegmentId === segment.id);
        const reserves = frontlineReserveUnits(state, segment, defenders, target).slice(0, 2);
        let nextBattle = state;
        for (const reserve of reserves) {
          nextBattle = assignFrontlineSegment(nextBattle, reserve.unitId, segment.id);
          nextBattle = applyStandingOrderPreset(
            nextBattle,
            reserve.unitId,
            target.assaultPlan.phase === "breakthrough" ? "fallback_guard" : "elastic_defense",
          );
          nextBattle = setStandingOrderAnchor(nextBattle, reserve.unitId, segment.anchor);
          nextBattle = setStandingOrderFallbackDestination(nextBattle, reserve.unitId, segment.fallbackPoint);
          nextBattle = setStandingOrderTargetPriority(nextBattle, reserve.unitId, enemyResponsePriority(target));
          nextBattle = setUnitFocusTarget(nextBattle, reserve.unitId, target.id);
        }
        const reserveIds = new Set(reserves.map((unit) => unit.unitId));
        nextBattle = {
          ...nextBattle,
          playerUnits: nextBattle.playerUnits.map((unit) =>
            reserveIds.has(unit.unitId)
              ? {
                  ...unit,
                  reserveReadiness: Math.max(0, (unit.reserveReadiness ?? 0) - 32),
                  enemyCommandActionRole: "command_reserve_commit",
                }
              : unit,
          ),
        };
        return {
          ...nextBattle,
          log: [
            `敵指揮網対応: ${group.label}へ予備投入。${segment.name}に${reserves.length}旅団を接続。`,
            ...nextBattle.log,
          ].slice(0, 12),
        };
      },
    );
  };

  const applyEnemyCommandGroupRecommendation = (group: EnemyCommandGroupReport) => {
    if (group.recommendedAction === "pursuit") {
      applyEnemyCommandGroupPursuit(group);
      return;
    }
    if (group.recommendedAction === "fire") {
      applyEnemyCommandGroupFire(group);
      return;
    }
    applyEnemyCommandGroupReserveCommit(group);
  };

  const assignSelectedSegment = (
    event: MouseEvent<HTMLElement>,
    segment: BattleState["frontlineSegments"][number],
  ) => {
    event.stopPropagation();
    const sketchPosition = positionFromMapClick(event);
    if (frontlineSketchDraft && sketchPosition) {
      applyFrontlineSketchPoint(sketchPosition);
      return;
    }
    setSelectedFrontlineSegmentId(segment.id);
    scrollToPosition(segment.anchor);
    if (!selectedUnit || commandMode !== "segment") {
      return;
    }
    issueOrQueueCommand(
      selectedUnit,
      `戦線 ${segment.name}`,
      `担当戦線を${segment.name}へ / 基準 ${mapCoordinateLabel(segment.anchor)}`,
      (state) => assignFrontlineSegment(state, selectedUnit.unitId, segment.id),
    );
    setCommandMode("none");
    setSelectedUnitId(selectedUnit.unitId);
    scrollToPosition(segment.anchor);
  };

  const handleMinimapClick = (event: MouseEvent<HTMLDivElement>) => {
    const minimap = event.currentTarget;
    const rect = minimap.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    scrollToPosition({
      x: xRatio * battle.mapBounds.width,
      y: yRatio * battle.mapBounds.height,
    });
  };

  const handleMinimapKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = currentViewportCenterPosition();
    const horizontalStep = battle.mapBounds.width * 0.18;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollToPosition({
        ...current,
        x: Math.max(
          0,
          Math.min(
            battle.mapBounds.width,
            current.x + (event.key === "ArrowLeft" ? -horizontalStep : horizontalStep),
          ),
        ),
      });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      scrollToPosition({
        ...current,
        x: event.key === "Home" ? 0 : battle.mapBounds.width,
      });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setMinimapFocusPosition(current);
    }
  };

  const handleAlertClick = (alert: BattleAlert) => {
    if (alert.unitId) {
      setSelectedUnitId(alert.unitId);
    }
    if (alert.segmentId && !alert.unitId) {
      const segmentUnit = battle.playerUnits
        .filter((unit) => unit.standingOrder.frontlineSegmentId === alert.segmentId)
        .sort((a, b) => a.morale - b.morale || a.soldiers - b.soldiers)[0];
      if (segmentUnit) {
        setSelectedUnitId(segmentUnit.unitId);
      }
    }
    if (alert.structureId && !alert.unitId) {
      const assignedUnit =
        battle.playerUnits.find((unit) => unit.standingOrder.facilityAssignment?.structureId === alert.structureId) ??
        battle.playerUnits
          .filter((unit) => unit.type === "engineer")
          .sort((a, b) => {
            const structure = battle.structures.find((candidate) => candidate.id === alert.structureId);
            if (!structure) {
              return 0;
            }
            return distance(a.position, structure.position) - distance(b.position, structure.position);
          })[0];
      if (assignedUnit) {
        setSelectedUnitId(assignedUnit.unitId);
      }
    }
    if (alert.objectiveNodeId && !alert.unitId) {
      const node = battle.objectiveNodes.find((candidate) => candidate.id === alert.objectiveNodeId);
      const assignedUnit = node
        ? [...battle.playerUnits]
            .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat")
            .sort((a, b) => distance(a.position, node.position) - distance(b.position, node.position))[0]
        : undefined;
      if (assignedUnit) {
        setSelectedUnitId(assignedUnit.unitId);
      }
    }
    const target =
      alert.position ??
      battle.playerUnits.find((unit) => unit.unitId === alert.unitId)?.position ??
      battle.structures.find((structure) => structure.id === alert.structureId)?.position ??
      battle.objectiveNodes.find((node) => node.id === alert.objectiveNodeId)?.position;
    if (target) {
      scrollToPosition(target);
    }
  };

  const unitForAlert = (alert: BattleAlert): BattleUnit | undefined => {
    if (alert.unitId) {
      return battle.playerUnits.find((unit) => unit.unitId === alert.unitId);
    }
    if (alert.segmentId) {
      return battle.playerUnits
        .filter((unit) => unit.standingOrder.frontlineSegmentId === alert.segmentId)
        .sort((a, b) => a.morale - b.morale || a.soldiers - b.soldiers)[0];
    }
    if (alert.structureId) {
      const assigned = battle.playerUnits.find(
        (unit) => unit.standingOrder.facilityAssignment?.structureId === alert.structureId,
      );
      if (assigned) {
        return assigned;
      }
      const structure = battle.structures.find((candidate) => candidate.id === alert.structureId);
      return battle.playerUnits
        .filter((unit) => unit.type === "engineer")
        .sort((a, b) => {
          if (!structure) {
            return 0;
          }
          return distance(a.position, structure.position) - distance(b.position, structure.position);
        })[0];
    }
    if (alert.objectiveNodeId) {
      const node = battle.objectiveNodes.find((candidate) => candidate.id === alert.objectiveNodeId);
      return node
        ? [...battle.playerUnits]
            .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat")
            .sort((a, b) => distance(a.position, node.position) - distance(b.position, node.position))[0]
        : undefined;
    }
    return selectedUnit;
  };

  const unitsForAlertGroup = (alert: BattleAlert): BattleUnit[] => {
    if (alert.id === "line-integrity") {
      return battle.playerUnits
        .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat")
        .sort((a, b) => a.morale - b.morale || a.position.x - b.position.x);
    }
    if (alert.segmentId) {
      return battle.playerUnits
        .filter((unit) => unit.soldiers > 0 && unit.standingOrder.frontlineSegmentId === alert.segmentId)
        .sort((a, b) => a.morale - b.morale || a.soldiers - b.soldiers);
    }
    if (alert.structureId) {
      const assignedUnits = battle.playerUnits.filter(
        (unit) => unit.soldiers > 0 && unit.standingOrder.facilityAssignment?.structureId === alert.structureId,
      );
      const structure = battle.structures.find((candidate) => candidate.id === alert.structureId);
      const nearestEngineer = battle.playerUnits
        .filter((unit) => unit.soldiers > 0 && unit.type === "engineer")
        .sort((a, b) => {
          if (!structure) {
            return 0;
          }
          return distance(a.position, structure.position) - distance(b.position, structure.position);
        })[0];
      const nearestDefenders = battle.playerUnits
        .filter(
          (unit) =>
            unit.soldiers > 0 &&
            unit.order !== "retreat" &&
            unit.type !== "artillery" &&
            unit.unitId !== nearestEngineer?.unitId &&
            !assignedUnits.some((assigned) => assigned.unitId === unit.unitId),
        )
        .sort((a, b) => {
          if (!structure) {
            return 0;
          }
          const reserveBiasA = a.standingOrder.frontlineSegmentId === "reserve-line" ? -8 : 0;
          const reserveBiasB = b.standingOrder.frontlineSegmentId === "reserve-line" ? -8 : 0;
          return distance(a.position, structure.position) + reserveBiasA - (distance(b.position, structure.position) + reserveBiasB);
        })
        .slice(0, Math.max(1, 3 - assignedUnits.length - (nearestEngineer ? 1 : 0)));
      const units = nearestEngineer ? [...assignedUnits, nearestEngineer, ...nearestDefenders] : [...assignedUnits, ...nearestDefenders];
      return units.filter((unit, index) => units.findIndex((candidate) => candidate.unitId === unit.unitId) === index);
    }
    if (alert.objectiveNodeId) {
      const node = battle.objectiveNodes.find((candidate) => candidate.id === alert.objectiveNodeId);
      if (!node) {
        return [];
      }
      return [...battle.playerUnits]
        .filter((unit) => unit.soldiers > 0 && unit.order !== "retreat")
        .sort((a, b) => distance(a.position, node.position) - distance(b.position, node.position))
        .slice(0, 3);
    }
    return [];
  };

  const alertGroupActionLabel = (alert: BattleAlert): string | undefined => {
    if (alert.segmentId && (alert.id === "enemy-flanking" || alert.id === "enemy-breakthrough" || alert.id === "enemy-overextended")) {
      const report = pressureReports.find((candidate) => candidate.segment.id === alert.segmentId);
      if (report && report.level !== "quiet" && (report.defenders.length > 0 || report.reserves.length > 0)) {
        return report.recommendationLabel;
      }
    }
    const count = unitsForAlertGroup(alert).length;
    if (count <= 1) {
      return undefined;
    }
    if (alert.segmentId) {
      return `戦線${count}旅団`;
    }
    if (alert.id === "line-integrity") {
      return `全線${count}旅団`;
    }
    if (alert.structureId) {
      return `施設即応${count}部隊`;
    }
    if (alert.objectiveNodeId) {
      return `目標${count}部隊`;
    }
    return undefined;
  };

  const applyAlertRecommendationCommand = (alert: BattleAlert) => {
    const unit = unitForAlert(alert);
    if (!unit) {
      return;
    }

    let appliedRecommendation = alert.recommendation ?? "推奨方針";
    if (alert.objectiveNodeId) {
      const node = battle.objectiveNodes.find((candidate) => candidate.id === alert.objectiveNodeId);
      appliedRecommendation = node ? objectiveResponseTacticalProfile(node, battle.structures).actionLabel : "目標対応";
    } else if (alert.structureId) {
      appliedRecommendation =
        alert.recommendation === "施設即応"
          ? "施設即応"
          : unit.type === "engineer" || alert.recommendation === "修理担当"
            ? "工兵支援"
            : "固守";
    } else if (alert.id.startsWith("ammo-")) {
      appliedRecommendation = "弾薬節約/休息補給";
    } else if (alert.id.startsWith("morale-") || alert.id === "line-integrity" || alert.recommendation === "後退守備へ") {
      appliedRecommendation = "後退守備";
    } else if (alert.id === "enemy-command") {
      appliedRecommendation = "阻止射撃/敵指揮優先";
    } else if (alert.id === "enemy-wave") {
      appliedRecommendation = "阻止射撃";
    } else if (alert.segmentId || alert.id.startsWith("choke-") || alert.id.startsWith("formation-")) {
      appliedRecommendation = alert.severity === "danger" ? "後退守備" : "弾性防御";
    } else {
      appliedRecommendation = "弾性防御";
    }

    const applyRecommendation = (state: BattleState): BattleState => {
      let nextBattle = state;
      if (alert.objectiveNodeId) {
        nextBattle = applyObjectiveNodeResponse(nextBattle, alert.objectiveNodeId);
      } else if (alert.structureId) {
        nextBattle = applyFacilityDefenseResponse(nextBattle, alert.structureId, {
          unitIds: [unit.unitId],
          forceRepair: alert.recommendation === "修理担当",
        });
      } else if (alert.id.startsWith("ammo-")) {
        nextBattle = setStandingOrderAmmoPolicy(nextBattle, unit.unitId, "conserve");
        nextBattle = setUnitOrder(nextBattle, unit.unitId, "rest");
      } else if (alert.id.startsWith("morale-") || alert.id === "line-integrity" || alert.recommendation === "後退守備へ") {
        nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "fallback_guard");
      } else if (alert.id === "enemy-command") {
        nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "aggressive_screen");
        nextBattle = setStandingOrderTargetPriority(nextBattle, unit.unitId, "officer");
      } else if (alert.id === "enemy-wave") {
        nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "aggressive_screen");
      } else if (alert.segmentId || alert.id.startsWith("choke-") || alert.id.startsWith("formation-")) {
        nextBattle = applyStandingOrderPreset(
          nextBattle,
          unit.unitId,
          alert.severity === "danger" ? "fallback_guard" : "elastic_defense",
        );
      } else {
        nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "elastic_defense");
      }

      return {
        ...nextBattle,
        log: [`警報対応: ${unit.name}へ${appliedRecommendation}を適用。`, ...nextBattle.log].slice(0, 12),
      };
    };

    setSelectedUnitId(unit.unitId);
    const target =
      alert.position ??
      battle.playerUnits.find((candidate) => candidate.unitId === unit.unitId)?.position ??
      battle.structures.find((structure) => structure.id === alert.structureId)?.position ??
      battle.objectiveNodes.find((node) => node.id === alert.objectiveNodeId)?.position;
    if (target) {
      scrollToPosition(target);
    }
    setCommandMode("none");
    issueOrQueueBattleCommand(
      `alert:${alert.id}:${unit.unitId}`,
      unit.name,
      `警報 ${appliedRecommendation}`,
      `${alert.title} / ${alert.detail}`,
      applyRecommendation,
    );
  };

  const applyAlertRecommendation = (event: MouseEvent<HTMLButtonElement>, alert: BattleAlert) => {
    event.stopPropagation();
    applyAlertRecommendationCommand(alert);
  };

  const applyAlertGroupRecommendation = (event: MouseEvent<HTMLButtonElement>, alert: BattleAlert) => {
    event.stopPropagation();
    if (alert.segmentId && (alert.id === "enemy-flanking" || alert.id === "enemy-breakthrough" || alert.id === "enemy-overextended")) {
      const report = pressureReports.find((candidate) => candidate.segment.id === alert.segmentId);
      if (report && report.level !== "quiet") {
        applyFrontlinePressureResponse(report);
        return;
      }
    }
    const units = unitsForAlertGroup(alert);
    if (units.length <= 1) {
      return;
    }

    let appliedRecommendation = "一括対応";
    if (alert.objectiveNodeId) {
      const node = battle.objectiveNodes.find((candidate) => candidate.id === alert.objectiveNodeId);
      if (!node) {
        return;
      }
      appliedRecommendation = objectiveResponseTacticalProfile(node, battle.structures).actionLabel;
    } else if (alert.structureId) {
      const structure = battle.structures.find((candidate) => candidate.id === alert.structureId);
      if (!structure) {
        return;
      }
      appliedRecommendation = alert.recommendation === "修理担当" ? "施設修理/防衛" : "施設即応";
    } else if (alert.segmentId) {
      appliedRecommendation = alert.severity === "danger" ? "後退守備" : "弾性防御";
    } else if (alert.id === "line-integrity") {
      appliedRecommendation = "全線後退守備";
    }

    const applyGroupRecommendation = (state: BattleState): BattleState => {
      let nextBattle = state;
      if (alert.objectiveNodeId) {
        nextBattle = applyObjectiveNodeResponse(nextBattle, alert.objectiveNodeId);
      } else if (alert.structureId) {
        nextBattle = applyFacilityDefenseResponse(nextBattle, alert.structureId, {
          unitIds: units.map((unit) => unit.unitId),
          forceRepair: alert.recommendation === "修理担当",
        });
      } else if (alert.segmentId) {
        const preset = alert.severity === "danger" ? "fallback_guard" : "elastic_defense";
        for (const unit of units) {
          nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, preset);
        }
      } else if (alert.id === "line-integrity") {
        for (const unit of units) {
          nextBattle = applyStandingOrderPreset(nextBattle, unit.unitId, "fallback_guard");
        }
      }

      return {
        ...nextBattle,
        log: [`警報一括対応: ${units.length}部隊へ${appliedRecommendation}を適用。`, ...nextBattle.log].slice(0, 12),
      };
    };

    setSelectedUnitId(units[0].unitId);
    const target = alert.position ?? units[0].position;
    scrollToPosition(target);
    setCommandMode("none");
    issueOrQueueBattleCommand(
      `alert-group:${alert.id}`,
      alert.segmentId ? segmentName(battle, alert.segmentId) : alert.structureId ? "施設警報" : alert.objectiveNodeId ? "目標警報" : "戦場警報",
      `一括 ${appliedRecommendation}`,
      `${alert.title} / ${units.length}部隊`,
      applyGroupRecommendation,
    );
  };

  const applyInspectedFacilityResponse = (forceRepair: boolean) => {
    const structure = inspectedStructure ?? selectedStructure;
    if (!structure || finished) {
      return;
    }
    const responseUnits = facilityInspectionResponseUnits(battle, structure);
    if (responseUnits[0]) {
      setSelectedUnitId(responseUnits[0].unitId);
    }
    setInspectedStructureId(structure.id);
    setSelectedEnemyId("");
    setCommandMode("none");
    scrollToPosition(structure.position);
    issueOrQueueBattleCommand(
      `map-inspect-facility:${structure.id}:${forceRepair ? "repair" : "defend"}`,
      fortificationTypeLabels[structure.type],
      forceRepair ? "施設修理" : "施設即応",
      `${fortificationStatusLabels[structure.status]} / ${structure.facilityStateLabel} / ${responseUnits.length}部隊`,
      (state) =>
        applyFacilityDefenseResponse(state, structure.id, {
          unitIds: responseUnits.map((unit) => unit.unitId),
          forceRepair,
        }),
    );
  };

  const applyInspectedFrontlineResponse = () => {
    if (!selectedFrontlinePressure || finished) {
      return;
    }
    applyFrontlinePressureResponse(selectedFrontlinePressure);
  };

  const addFirePlanStage = (scope: FireMissionScope) => {
    if (!currentFirePlanTarget || !selectedUnit) {
      return;
    }
    setFirePlanDraft((current) => {
      if (current.length >= maxFirePlanStages) {
        return current;
      }
      return [
        ...current,
        {
          id: `draft-${selectedUnit.unitId}-${current.length + 1}-${currentFirePlanTarget.id}`,
          targetId: currentFirePlanTarget.id,
          targetName: mapEnemyDisplayName(currentFirePlanTarget),
          scope,
          delaySeconds: current.length * firePlanStageSpacingSeconds,
        },
      ];
    });
  };

  const startFirePlan = () => {
    if (!selectedUnit || firePlanDraft.length === 0) {
      return;
    }
    const stages = firePlanDraft.map((stage) => ({
      targetId: stage.targetId,
      scope: stage.scope,
      delaySeconds: stage.delaySeconds,
    }));
    issueOrQueueCommand(
      selectedUnit,
      `火力計画 ${firePlanDraft.length}段`,
      firePlanDraft.map((stage, index) => `第${index + 1}段 ${fireMissionScopeLabels[stage.scope]}`).join(" / "),
      (state) => issueFirePlan(state, selectedUnit.unitId, stages),
    );
    setFirePlanDraft([]);
  };

  return (
    <section className="battle-layout">
      <div className="battle-topbar">
        <div>
          <strong>{battle.scenario.title}</strong>
          <span>{battle.scenario.sectorName}</span>
          {battle.scenario.tacticalTerrainProfileLabel && (
            <span>地形 {battle.scenario.tacticalTerrainProfileLabel}</span>
          )}
          <span>{battleStatusLabels[battle.status]}</span>
          <span>参加 {battle.playerUnits.length}旅団</span>
          <span>展開 {frontlineGeometryLabel}</span>
          <span>視界 {spottingRange}</span>
          <span>発見 {spottedEnemyCount}/{battle.enemyUnits.length}</span>
          <span>隘路 {chokeSummary}</span>
          {battle.commandPost && <span>司令部 {battle.commandPost.label}</span>}
        </div>
        <div className="button-row">
          {[0, 1, 2, 3].map((speed) => (
            <button
              key={speed}
              className={battle.speed === speed ? "active" : ""}
              type="button"
              onClick={() => onChange(setBattleSpeed(battle, speed as 0 | 1 | 2 | 3))}
            >
              {speed === 0 ? "停止" : `${speed}倍`}
            </button>
          ))}
          <button type="button" disabled={finished} onClick={() => onChange(requestWithdrawal(battle))}>
            撤退実行
          </button>
          {finished && (
            <button className="primary-button" type="button" onClick={onComplete}>
              戦果報告へ
            </button>
          )}
        </div>
      </div>

      <div className="battle-command-ribbon">
        {orders.map((order) => (
          <span key={order}>{unitOrderLabels[order]}</span>
        ))}
      </div>

      <div className={`withdrawal-forecast-panel ${withdrawalForecast.tone}`} aria-label="撤退予測">
        <div className="withdrawal-forecast-main">
          <strong>撤退予測</strong>
          <span>{withdrawalForecast.title}</span>
          <em>{withdrawalForecast.recommendation}</em>
        </div>
        <div className="withdrawal-forecast-chips">
          {withdrawalForecast.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <div className="withdrawal-forecast-reasons">
          {withdrawalForecast.reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      </div>

      <div className={`command-queue-panel ${commandQueueMode ? "active" : ""}`} aria-label="予約指揮">
        <div className="command-queue-summary">
          <strong>予約指揮</strong>
          <span>{commandQueueMode ? "予約中" : "直接発令"}</span>
          <span>{queuedCommands.length}件</span>
          <span>
            {commandIssuePlanLabels[commandIssuePlan.mode]} {commandIssuePlan.maxBatchSize}件単位
          </span>
          {commandCongestionPreview && (
            <span className={commandCongestionPreview.delayPenaltySeconds > 0 ? "command-congestion-warning" : ""}>
              {commandCongestionPreview.label}
            </span>
          )}
          {battle.commandPost && (
            <span
              className={
                battle.commandPost.commandCapacityModifier < 0 || battle.commandPost.transmissionDelayModifier > 0
                  ? "command-congestion-warning"
                  : ""
              }
            >
              {battle.commandPost.reasons.join(" / ")}
            </span>
          )}
          <span>
            {commandQueueMode
              ? "停止中に命令を積み、一括発令後は伝令遅延が発生する"
              : "発令後は部隊ごとに数秒の伝令遅延が発生する"}
          </span>
        </div>
        <div className={`command-issue-compliance ${commandIssueCompliance.tone}`}>
          <strong>{commandIssueCompliance.label}</strong>
          <span>{commandIssueCompliance.detail}</span>
        </div>
        <div className="button-row compact">
          <button className={commandQueueMode ? "active" : ""} type="button" disabled={finished} onClick={toggleCommandQueueMode}>
            {commandQueueMode ? "予約モード解除" : "停止して予約"}
          </button>
          <button type="button" disabled={queuedCommands.length === 0 || finished} onClick={applyQueuedCommands}>
            一括発令
          </button>
          {canApplyCommandIssuePolicyBatch && (
            <button
              type="button"
              disabled={finished}
              onClick={() => applyQueuedCommandBatch(commandIssuePolicyBatchSize, commandIssuePolicyBatchLabel)}
            >
              方針通り{commandIssuePolicyBatchLabel}
            </button>
          )}
          <button type="button" disabled={queuedCommands.length === 0} onClick={() => setQueuedCommands([])}>
            予約破棄
          </button>
        </div>
        {queuedCommands.length > 0 && (
          <div className="command-queue-list">
            {queuedCommands.map((command, index) => (
              <article key={command.id} className="command-queue-item">
                <span>#{index + 1}</span>
                <strong>{command.subjectName}</strong>
                <em>{command.summary}</em>
                <small>{command.detail}</small>
                {command.transmissionPreview && (
                  <small className="command-transmission-preview">
                    {command.transmissionPreview.label}
                    {commandCongestionPreview?.delayPenaltySeconds
                      ? ` + 混線${commandCongestionPreview.delayPenaltySeconds}秒`
                      : ""}{" "}
                    / {command.transmissionPreview.detail}
                  </small>
                )}
                <button type="button" onClick={() => removeQueuedCommand(command.id)}>
                  削除
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="battle-alerts" aria-label="戦場警報">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`battle-alert ${alert.severity}`}
            >
              <button className="battle-alert-body" type="button" onClick={() => handleAlertClick(alert)}>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </button>
              {alert.recommendation && (
                <div className="battle-alert-actions">
                  <button
                    className="battle-alert-action"
                    type="button"
                    onClick={(event) => applyAlertRecommendation(event, alert)}
                  >
                    {alert.recommendation}
                  </button>
                  {alertGroupActionLabel(alert) && (
                    <button
                      className="battle-alert-action secondary"
                      type="button"
                      onClick={(event) => applyAlertGroupRecommendation(event, alert)}
                    >
                      {alertGroupActionLabel(alert)}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {objectiveStaffRecommendationsList.length > 0 && (
        <div className="objective-staff-panel" aria-label="目標参謀判断">
          <div className="objective-staff-heading">
            <strong>目標参謀判断</strong>
            <span>{objectiveStaffRecommendationsList.length}件</span>
            <em>各目標に対し、寄せる戦線と転用リスクを比較する。</em>
          </div>
          <div className="objective-staff-list">
            {objectiveStaffRecommendationsList.map((recommendation) => (
              <article key={recommendation.id} className={`objective-staff-card ${recommendation.tone}`}>
                <button
                  className="objective-staff-main"
                  type="button"
                  onClick={() => {
                    setSelectedFrontlineSegmentId(recommendation.segment.id);
                    scrollToPosition(recommendation.node.position);
                  }}
                >
                  <strong>{recommendation.node.label}</strong>
                  <span>{recommendation.node.scenario.label}</span>
                  <small>{objectiveResponseTacticalProfile(recommendation.node, battle.structures).intentLabel}</small>
                  <span>
                    {objectiveResponseTacticalProfile(recommendation.node, battle.structures).actionLabel} /{" "}
                    {objectiveControlLabels[recommendation.node.control]} {Math.round(recommendation.node.controlProgress)}%
                  </span>
                  <small>
                    推奨 {recommendation.segment.name} / 距離{Math.round(recommendation.distance)} / 守備
                    {recommendation.defenders}旅団 / {recommendation.riskLabel}
                  </small>
                  <small className={`objective-staff-transfer ${recommendation.transferForecast.tone}`}>
                    転用予測 {recommendation.transferForecast.label} / {recommendation.transferForecast.detail}
                  </small>
                  <em>{recommendation.reason} / 評価{Math.round(recommendation.score)}</em>
                </button>
                <button
                  className="objective-staff-action"
                  type="button"
                  disabled={finished || recommendation.defenders === 0}
                  onClick={() => applyObjectiveStaffRecommendation(recommendation)}
                >
                  戦線を寄せる
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="fire-discipline-strip" aria-label="火力規律">
        <strong>火力規律</strong>
        <span>{fireDiscipline.label}</span>
        <span>{fireDiscipline.summary}</span>
        <span>
          計画 {maxFirePlanStages}段 / 間隔 {firePlanStageSpacingSeconds}秒 / 再装填-
          {fireDiscipline.cooldownReductionSeconds}秒
        </span>
        <strong>予備運用</strong>
        <span>{reserveDoctrineLabels[reserveDoctrine.mode]}</span>
        <span>温存圧 {reserveDoctrine.holdReadinessUntilPressure} / 反撃閾値 {reserveDoctrine.counterstrokeReadinessThreshold}</span>
      </div>

      {activeFireMissions.length > 0 && (
        <div className="fire-mission-strip" aria-label="火力任務">
          {activeFireMissions.map((mission) => (
            <span key={mission.id}>
              <strong>{fireMissionScopeLabels[mission.scope]}</strong>
              {mission.targetName} / {mission.unitIds.length}旅団 / 残り
              {Math.max(0, Math.ceil(mission.expiresAt - battle.elapsedSeconds))}秒
              {mission.disciplineLabel ? ` / ${mission.disciplineLabel}` : ""}
            </span>
          ))}
        </div>
      )}

      {activeFirePlans.length > 0 && (
        <div className="fire-plan-strip" aria-label="火力計画">
          {activeFirePlans.map((plan) => (
            <span key={plan.id}>
              <strong>火力計画</strong>
              {plan.stages
                .map(
                  (stage, index) =>
                    `第${index + 1}段 ${fireMissionScopeLabels[stage.scope]} ${stage.targetName} ${firePlanStageStatusLabels[stage.status]}${
                      stage.status === "pending" ? ` ${Math.max(0, Math.ceil(stage.startAt - battle.elapsedSeconds))}秒` : ""
                    }`,
                )
                .join(" / ")}
            </span>
          ))}
        </div>
      )}

      {enemyCommandGroups.length > 0 && (
        <div className="enemy-command-network-panel" aria-label="敵指揮網サマリー">
          <div className="enemy-command-network-heading">
            <strong>敵指揮網</strong>
            <span>{enemyCommandGroups.length}群</span>
            <span>発見敵 {spottedEnemyCount}/{battle.enemyUnits.length}</span>
          </div>
          <div className="enemy-command-network-list">
            {enemyCommandGroups.map((group) => {
              const linkedPressureReport = group.targetSegment
                ? pressureReports.find((report) => report.segment.id === group.targetSegment?.id)
                : undefined;
              return (
              <article key={group.id} className={`enemy-command-group-card ${group.state} ${group.responseStatusTone}`}>
                <button
                  className="enemy-command-group-main"
                  type="button"
                  onClick={() => inspectEnemyCommandGroup(group)}
                >
                  <strong>{group.label}</strong>
                  <span>
                    {enemyCommandStateLabels[group.state]} / {enemyCommandIntentLabels[group.intent]} / 影響
                    {Math.round(group.averageInfluence * 100)}%
                  </span>
                  <span>
                    {group.units.length}群 / 戦力 {Math.round(group.totalCount)} / 圧力
                    {Math.round(group.totalPressure)}
                  </span>
                  <span>階梯 {group.commandTierSummary || "指揮外"}</span>
                  <small className="enemy-command-recommendation">
                    推奨 {group.recommendationLabel} / {group.recommendationReason}
                  </small>
                  <small className={`enemy-command-forecast ${group.forecastTone}`}>
                    {group.forecastLabel} / {group.forecastDetail}
                  </small>
                  <small className={`enemy-command-response-status ${group.responseStatusTone}`}>
                    {group.responseStatusLabel} / {group.responseStatusDetail}
                  </small>
                  <small className={`enemy-command-response-effect ${group.responseEffectTone}`}>
                    {group.responseEffectLabel} / {group.responseEffectDetail}
                  </small>
                  <small>
                    主脅威 {mapEnemyDisplayName(group.leadThreat)} {enemyAssaultPhaseLabels[group.leadThreat.assaultPlan.phase]} /{" "}
                    {group.targetSegment?.name ?? group.targetName}
                  </small>
                  {linkedPressureReport && (
                    <small className={`enemy-command-frontline-link ${linkedPressureReport.level}`}>
                      対応戦線 {linkedPressureReport.segment.name} / {frontlinePressureLevelLabels[linkedPressureReport.level]} / 敵圧
                      {Math.round(linkedPressureReport.pressure)} / 守備{linkedPressureReport.defenders.length} / 予備
                      {linkedPressureReport.reserves.length} / 推奨{linkedPressureReport.recommendationLabel}
                    </small>
                  )}
                  {group.pursuitTarget ? (
                    <small>
                      追撃候補 {mapEnemyDisplayName(group.pursuitTarget)} / {group.pursuitReason} / 凝集
                      {Math.round(group.pursuitTarget.assaultPlan.cohesion * 100)}%
                    </small>
                  ) : (
                    <small>追撃候補 なし</small>
                  )}
                </button>
                <div className="enemy-command-group-actions">
                  <button
                    className="enemy-command-group-action recommended"
                    type="button"
                    disabled={enemyCommandGroupActionLocked(group, group.recommendedAction)}
                    onClick={() => applyEnemyCommandGroupRecommendation(group)}
                  >
                    推奨実行
                  </button>
                  <button className="enemy-command-group-action" type="button" onClick={() => inspectEnemyCommandGroup(group)}>
                    詳細
                  </button>
                  <button
                    className="enemy-command-group-action"
                    type="button"
                    disabled={!linkedPressureReport || linkedPressureReport.level === "quiet"}
                    onClick={() => linkedPressureReport && applyFrontlinePressureResponse(linkedPressureReport)}
                  >
                    対応戦線
                  </button>
                  <button
                    className="enemy-command-group-action"
                    type="button"
                    disabled={enemyCommandGroupActionLocked(group, "fire")}
                    onClick={() => applyEnemyCommandGroupFire(group)}
                  >
                    指揮核射撃
                  </button>
                  <button
                    className="enemy-command-group-action"
                    type="button"
                    disabled={!enemyCommandGroupCanPursue(group) || enemyCommandGroupActionLocked(group, "pursuit")}
                    onClick={() => applyEnemyCommandGroupPursuit(group)}
                  >
                    崩壊追撃
                  </button>
                  <button
                    className="enemy-command-group-action"
                    type="button"
                    disabled={enemyCommandGroupActionLocked(group, "reserve")}
                    onClick={() => applyEnemyCommandGroupReserveCommit(group)}
                  >
                    予備投入
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="reserve-command-panel" aria-label="予備指揮">
        <div className="reserve-command-summary">
          <strong>予備指揮</strong>
          <span>候補 {reserveUnits.length}旅団</span>
          <span>即応 {readyReserveUnits.length}旅団</span>
          <span>平均 {reserveAverageReadiness}</span>
        </div>
        <div className="reserve-command-list">
          {reserveUnits.map((unit) => (
            <article
              key={unit.unitId}
              className={`reserve-command-card ${unit.unitId === selectedUnit?.unitId ? "selected" : ""}`}
            >
              <button className="reserve-command-main" type="button" onClick={() => selectReserveUnit(unit)}>
                <strong>{mapUnitDisplayName(unit)}</strong>
                <span>{unitTypeLabels[unit.type]} / {segmentName(battle, unit.standingOrder.frontlineSegmentId)}</span>
                <span>
                  {standingPostureLabels[unit.standingOrder.posture]} / 即応 {Math.round(unit.reserveReadiness ?? 0)} /{" "}
                  {ammoPolicyLabels[unit.standingOrder.ammoPolicy]}
                </span>
              </button>
              <div className="reserve-command-actions">
                <button type="button" onClick={() => returnReserveUnit(unit)}>
                  予備線へ
                </button>
                <button type="button" onClick={() => returnReserveUnit(unit, "fire_support")}>
                  火力予備
                </button>
              </div>
            </article>
          ))}
          {reserveUnits.length === 0 && <span className="reserve-command-empty">予備候補なし</span>}
        </div>
      </div>

      <div className="frontline-pressure-strip" aria-label="戦線圧力サマリー">
        {pressureReports.map((report) => {
          const rotationPreview = frontlineRotationPreview(report, undefined, undefined, pressureReports);
          return (
            <article
              key={report.segment.id}
              className={`frontline-pressure-card ${report.level} ${
                selectedFrontlineSegment?.id === report.segment.id ? "selected-frontline" : ""
              }`}
            >
              <button className="frontline-pressure-main" type="button" onClick={() => inspectFrontlinePressure(report)}>
                <strong>{report.segment.name}</strong>
                <span>
                  {frontlinePressureLevelLabels[report.level]} / 敵圧 {Math.round(report.pressure)}
                </span>
                <span>
                  敵 {report.enemyCount}群 / 守備 {report.defenders.length}旅団 / 予備 {report.reserves.length}
                  {report.reserves.length > 0
                    ? ` / 即応 ${Math.round(report.reserveReadiness)}(${report.readyReserves.length})`
                    : ""}
                </span>
                <span>
                  {report.leadEnemy
                    ? `主脅威 ${mapEnemyDisplayName(report.leadEnemy)} ${enemyAssaultPhaseLabels[report.leadEnemy.assaultPlan.phase]} ${enemyThreatLabel(report.leadEnemy)}`
                    : "主脅威 なし"}
                </span>
                <small>{rotationPreview ? rotationPreview.detail : "戦闘交代 予備または守備なし"}</small>
              </button>
              <button
                className="frontline-pressure-action"
                type="button"
                disabled={(report.defenders.length === 0 && report.reserves.length === 0) || report.level === "quiet"}
                onClick={() => applyFrontlinePressureResponse(report)}
              >
                {report.recommendationLabel}
              </button>
              <button
                className="frontline-pressure-action secondary"
                type="button"
                disabled={!rotationPreview}
                onClick={() => applyFrontlineRotationResponse(report)}
              >
                戦闘交代
              </button>
            </article>
          );
        })}
      </div>

      {staffAdvisories.length > 0 && (
        <div className="staff-advisory-panel" aria-label="参謀警告">
          <div className="staff-advisory-heading">
            <strong>参謀警告</strong>
            <span>{staffAdvisories.length}件</span>
          </div>
          <div className="staff-advisory-list">
            {staffAdvisories.map((advisory) => (
              <article key={advisory.id} className={`staff-advisory-card ${advisory.severity}`}>
                <button className="staff-advisory-main" type="button" onClick={() => inspectStaffAdvisory(advisory)}>
                  <strong>{advisory.title}</strong>
                  <span>{advisory.detail}</span>
                  <small>
                    予測 損耗{advisory.assessment.casualtyRisk} / 弾薬{advisory.assessment.ammoBurn} / 突破
                    {advisory.assessment.lineRisk}
                  </small>
                  <em>{advisory.assessment.reason}</em>
                </button>
                <button
                  className="staff-advisory-action"
                  type="button"
                  disabled={finished || advisory.report.defenders.length === 0}
                  onClick={() => applyStaffAdvisory(advisory)}
                >
                  適用
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {selectedFrontlineSegment && (
        <div className="frontline-command-panel">
          <div>
            <strong>{selectedFrontlineSegment.name}</strong>
            <span>{selectedFrontlinePressure?.level ? frontlinePressureLevelLabels[selectedFrontlinePressure.level] : "平常"}</span>
            <span>敵圧 {Math.round(selectedFrontlinePressure?.pressure ?? 0)}</span>
            <span>守備 {selectedFrontlinePressure?.defenders.length ?? 0}旅団</span>
            <span>
              基準 X{Math.round(selectedFrontlineSegment.anchor.x)} Y{Math.round(selectedFrontlineSegment.anchor.y)}
            </span>
            <span>
              後退 X{Math.round(selectedFrontlineSegment.fallbackPoint.x)} Y
              {Math.round(selectedFrontlineSegment.fallbackPoint.y)}
            </span>
            <span>半径 {Math.round(selectedFrontlineSegment.controlRadius)}</span>
            {selectedFrontlineTerrainAssessment && (
              <span>
                地形評価 {selectedFrontlineTerrainAssessment.score} / {selectedFrontlineTerrainAssessment.summary}
              </span>
            )}
            {selectedFrontlineTerrainAssessment && (
              <span>地形推奨 {selectedFrontlineTerrainAssessment.suggestedDoctrine}</span>
            )}
          </div>
          {selectedFrontlineSuggestionCards.length > 0 && (
            <div className="frontline-suggestion-board" aria-label="選択戦線の戦術提案">
              <div className="frontline-suggestion-heading">
                <strong>戦線提案</strong>
                <span>{commandQueueMode ? "推奨は予約指揮へ積む" : "推奨は即時発令"}</span>
                <span>圧力 / 交代 / 参謀案</span>
              </div>
              <div className="frontline-suggestion-list">
                {selectedFrontlineSuggestionCards.map((suggestion) => (
                  <article key={suggestion.id} className={`frontline-suggestion-card ${suggestion.tone}`}>
                    <button
                      className="frontline-suggestion-main"
                      type="button"
                      onClick={() => selectedFrontlinePressure && inspectFrontlinePressure(selectedFrontlinePressure)}
                    >
                      <strong>{suggestion.title}</strong>
                      <span>{suggestion.detail}</span>
                      <small>{suggestion.reason}</small>
                    </button>
                    <button
                      className="frontline-suggestion-action"
                      type="button"
                      disabled={suggestion.disabled}
                      onClick={suggestion.onApply}
                    >
                      {suggestion.actionLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
          <div className="frontline-defender-diagnosis" aria-label="選択戦線の守備旅団診断">
            <div className="frontline-defender-diagnosis-heading">
              <strong>守備旅団診断</strong>
              <span>
                守備 {selectedFrontlineAllDefenderDiagnostics.length} / 表示{" "}
                {selectedFrontlineDefenderDiagnostics.length} / 圧力 {Math.round(selectedFrontlinePressure?.pressure ?? 0)}
              </span>
              <em>ストレス、弾薬、士気、基準線距離から危険な旅団を先に表示。</em>
            </div>
            <div className="frontline-defender-bulk-actions" aria-label="選択戦線の守備旅団一括指揮">
              <button
                type="button"
                disabled={finished || selectedFrontlineRestRecommendations.length === 0}
                onClick={() =>
                  issueFrontlineDefenderBulkRecommendation("rest", selectedFrontlineRestRecommendations)
                }
              >
                疲弊を休息補給 {selectedFrontlineRestRecommendations.length}
              </button>
              <button
                className="fallback"
                type="button"
                disabled={finished || selectedFrontlineFallbackRecommendations.length === 0}
                onClick={() =>
                  issueFrontlineDefenderBulkRecommendation(
                    "fallback",
                    selectedFrontlineFallbackRecommendations,
                  )
                }
              >
                危険を後退守備 {selectedFrontlineFallbackRecommendations.length}
              </button>
              <span>
                {commandQueueMode ? "予約指揮に積む" : "即時発令"} / 推奨対象のみ
              </span>
            </div>
            <div className="frontline-defender-diagnosis-list">
              {selectedFrontlineDefenderDiagnostics.map(
                ({
                  unit,
                  soldierRatio,
                  stress,
                  distanceToAnchor,
                  warnings,
                  tone,
                  recommendedAction,
                  recommendationLabel,
                  recommendationReason,
                }) => (
                <article key={`frontline-defender-${unit.unitId}`} className={`frontline-defender-card ${tone}`}>
                  <button
                    className="frontline-defender-main"
                    type="button"
                    onClick={() => {
                      setSelectedUnitId(unit.unitId);
                      scrollToPosition(unit.position);
                    }}
                  >
                    <strong>{mapUnitDisplayName(unit)}</strong>
                    <span>
                      ストレス{stress} / 士気{Math.round(unit.morale)} / 弾薬{Math.round(unit.ammo)} / 兵力{soldierRatio}%
                    </span>
                    <small>
                      {standingPostureLabels[unit.standingOrder.posture]} / {targetPriorityLabels[unit.standingOrder.targetPriority]} /{" "}
                      距離{distanceToAnchor} / {warnings || "余力維持"}
                    </small>
                    <small className={`frontline-defender-recommendation ${recommendedAction}`}>
                      {recommendationLabel} / {recommendationReason}
                    </small>
                  </button>
                  <div className="frontline-defender-actions">
                    <button
                      type="button"
                      disabled={finished || recommendedAction === "hold"}
                      onClick={() => issueFrontlineDefenderRecommendation(unit, recommendedAction)}
                    >
                      推奨実行
                    </button>
                    <button type="button" onClick={() => selectFrontlineDefender(unit)}>
                      選択
                    </button>
                    <button type="button" disabled={finished} onClick={() => issueFrontlineDefenderRest(unit)}>
                      休息補給
                    </button>
                    <button type="button" disabled={finished} onClick={() => issueFrontlineDefenderFallbackGuard(unit)}>
                      後退守備
                    </button>
                  </div>
                </article>
                ),
              )}
              {selectedFrontlineDefenderDiagnostics.length === 0 && (
                <span className="frontline-defender-empty">この戦線に守備旅団なし</span>
              )}
            </div>
          </div>
          <div className="frontline-command-actions">
            <button
              type="button"
              onClick={() =>
                onChange(
                  repositionFrontlineSegment(battle, selectedFrontlineSegment.id, {
                    x: selectedFrontlineSegment.anchor.x + 4,
                    y: selectedFrontlineSegment.anchor.y,
                  }),
                )
              }
            >
              戦線前進
            </button>
            <button
              type="button"
              onClick={() =>
                onChange(
                  repositionFrontlineSegment(battle, selectedFrontlineSegment.id, {
                    x: selectedFrontlineSegment.anchor.x - 4,
                    y: selectedFrontlineSegment.anchor.y,
                  }),
                )
              }
            >
              戦線後退
            </button>
            <button
              type="button"
              onClick={() => onChange(resizeFrontlineSegmentControl(battle, selectedFrontlineSegment.id, 2, 8))}
            >
              幅拡大
            </button>
            <button
              type="button"
              onClick={() => onChange(resizeFrontlineSegmentControl(battle, selectedFrontlineSegment.id, -2, -8))}
            >
              幅圧縮
            </button>
            <button type="button" onClick={() => scrollToPosition(selectedFrontlineSegment.anchor)}>
              戦線へ移動
            </button>
            <button
              className={frontlineSketchDraft?.segmentId === selectedFrontlineSegment.id ? "active" : ""}
              type="button"
              disabled={finished}
              onClick={frontlineSketchDraft ? cancelFrontlineSketch : startFrontlineSketch}
            >
              {frontlineSketchDraft?.segmentId === selectedFrontlineSegment.id ? "スケッチ中止" : "戦線スケッチ"}
            </button>
            <button
              type="button"
              disabled={!onSaveStandingOrderTemplate || selectedFrontlineDefenders.length === 0}
              onClick={saveSelectedFrontlineStandingOrders}
            >
              戦線方針保存
            </button>
          </div>
          <div className={`frontline-sketch-readout ${frontlineSketchDraft?.segmentId === selectedFrontlineSegment.id ? "active" : ""}`}>
            <strong>戦線スケッチ</strong>
            <span>
              {frontlineSketchDraft?.segmentId === selectedFrontlineSegment.id
                ? frontlineSketchDraft.points.length === 0
                  ? "1点目: 新しい基準点をクリック"
                  : frontlineSketchDraft.points.length === 1
                    ? `2点目: 後退点をクリック / 基準 ${mapCoordinateLabel(frontlineSketchDraft.points[0])}`
                    : `追加点または確定 / ${frontlineSketchDraft.points.length}点指定`
                : `2-${maxFrontlineSketchPoints}点指定で選択戦線の基準、後退、幅、曲線を再配置`}
            </span>
            {frontlineSketchDraft?.segmentId === selectedFrontlineSegment.id && (
              <button type="button" disabled={frontlineSketchDraft.points.length < 2} onClick={completeFrontlineSketch}>
                スケッチ確定
              </button>
            )}
            <em>所属旅団は新しい基準線へ自律復帰する。守備{selectedFrontlineDefenders.length}旅団を戦線方針として保存可能。</em>
          </div>
          {selectedFrontlineTerrainAssessment && (
            <div className="frontline-terrain-readout">
              <strong>地形判断</strong>
              <span>
                火力{selectedFrontlineTerrainAssessment.fireAdvantage} / 遮蔽
                {selectedFrontlineTerrainAssessment.coverValue} / 機動リスク
                {selectedFrontlineTerrainAssessment.mobilityRisk} / 施設
                {selectedFrontlineTerrainAssessment.supportValue}
              </span>
              <em>{selectedFrontlineTerrainAssessment.reason}</em>
            </div>
          )}
          {selectedFrontlineObjectiveOptions.length > 0 && (
            <div className="frontline-objective-support" aria-label="戦線目標連携">
              <div className="frontline-objective-support-heading">
                <strong>目標連携</strong>
                <span>
                  最寄 {selectedFrontlineNearestObjective?.node.label ?? "なし"} / 距離
                  {Math.round(selectedFrontlineNearestObjective?.distance ?? 0)}
                </span>
                <em>この戦線の守備旅団を、勝利点・補給点・視界点の支援へ寄せる。</em>
              </div>
              <div className="frontline-objective-support-list">
                {selectedFrontlineObjectiveOptions.map((option) => (
                  <button
                    key={option.node.id}
                    className={`frontline-objective-support-card ${option.tone}`}
                    type="button"
                    disabled={finished || option.defenders === 0}
                    onClick={() => applySelectedFrontlineObjectiveSupport(option.node)}
                  >
                    <strong>{option.node.label}</strong>
                    <span>{option.node.scenario.label}</span>
                    <small className={`objective-event-text ${option.node.eventState.severity}`}>
                      {option.node.eventState.label}
                      {option.node.eventState.chainStage > 0 ? ` / ${option.node.eventState.chainLabel}` : ""} /{" "}
                      {option.node.eventState.effectSummary}
                      {option.node.eventState.chainStage > 0 ? ` / ${option.node.eventState.chainEffectSummary}` : ""}
                    </small>
                    <small>{objectiveResponseTacticalProfile(option.node, battle.structures).intentLabel}</small>
                    <span>
                      {objectiveResponseTacticalProfile(option.node, battle.structures).actionLabel} /{" "}
                      {objectiveControlLabels[option.node.control]} {Math.round(option.node.controlProgress)}%
                    </span>
                    <small>
                      距離{Math.round(option.distance)} / 守備{option.defenders}旅団 / {option.reason}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="frontline-rotation-panel" aria-label="戦闘交代候補">
            <div className="frontline-rotation-heading">
              <strong>戦闘交代</strong>
              <span>
                候補 守備{selectedFrontlineRotationOptions.tiredUnits.length} / 予備
                {selectedFrontlineRotationOptions.reserveUnits.length}
              </span>
              <em>
                {selectedFrontlineRotationPreview
                  ? selectedFrontlineRotationPreview.detail
                  : "交代可能な守備旅団または予備旅団が不足"}
              </em>
            </div>
            <div className="frontline-rotation-columns">
              <div className="frontline-rotation-column">
                <span className="frontline-rotation-column-title">交代対象</span>
                <div className="frontline-rotation-list">
                  {selectedFrontlineRotationOptions.tiredUnits.map((unit) => {
                    const soldierRatio = unit.maxSoldiers > 0 ? Math.round((unit.soldiers / unit.maxSoldiers) * 100) : 0;
                    return (
                      <button
                        key={unit.unitId}
                        className={`frontline-rotation-option ${
                          unit.unitId === selectedRotationTiredUnitId ? "active" : ""
                        }`}
                        type="button"
                        onClick={() =>
                          setRotationTiredUnitIdBySegment((current) => ({
                            ...current,
                            [selectedFrontlineSegment.id]: unit.unitId,
                          }))
                        }
                      >
                        <strong>{mapUnitDisplayName(unit)}</strong>
                        <span>
                          ストレス{Math.round(frontlineRotationStressScore(unit))} / 士気{Math.round(unit.morale)} / 兵力
                          {soldierRatio}%
                        </span>
                        <small>
                          弾薬{Math.round(unit.ammo)} / {standingPostureLabels[unit.standingOrder.posture]} /{" "}
                          {ammoPolicyLabels[unit.standingOrder.ammoPolicy]}
                        </small>
                      </button>
                    );
                  })}
                  {selectedFrontlineRotationOptions.tiredUnits.length === 0 && (
                    <span className="frontline-rotation-empty">守備旅団なし</span>
                  )}
                </div>
              </div>
              <div className="frontline-rotation-column">
                <span className="frontline-rotation-column-title">援護予備</span>
                <div className="frontline-rotation-list">
                  {selectedFrontlineRotationOptions.reserveUnits.map((unit) => {
                    const reserveReadout = selectedFrontlinePressure
                      ? frontlineRotationReserveReadout(unit, selectedFrontlinePressure, pressureReports)
                      : undefined;
                    return (
                      <button
                        key={unit.unitId}
                        className={`frontline-rotation-option reserve-${reserveReadout?.tone ?? "caution"} ${
                          unit.unitId === selectedRotationReserveUnitId ? "active" : ""
                        }`}
                        type="button"
                        onClick={() =>
                          setRotationReserveUnitIdBySegment((current) => ({
                            ...current,
                            [selectedFrontlineSegment.id]: unit.unitId,
                          }))
                        }
                      >
                        <strong>{mapUnitDisplayName(unit)}</strong>
                        <span>
                          即応{Math.round(unit.reserveReadiness ?? 0)} / {unitTypeLabels[unit.type]} /{" "}
                          {segmentName(battle, unit.standingOrder.frontlineSegmentId)}
                        </span>
                        <small>
                          {reserveReadout?.label ?? "転用"} / {reserveReadout?.detail ?? "出所未評価"} / 士気
                          {Math.round(unit.morale)}
                        </small>
                        <small>
                          弾薬{Math.round(unit.ammo)} / {standingPostureLabels[unit.standingOrder.posture]} / 評価
                          {selectedFrontlinePressure
                            ? Math.round(frontlineRotationReserveScore(unit, selectedFrontlinePressure, pressureReports))
                            : 0}
                        </small>
                      </button>
                    );
                  })}
                  {selectedFrontlineRotationOptions.reserveUnits.length === 0 && (
                    <span className="frontline-rotation-empty">予備旅団なし</span>
                  )}
                </div>
              </div>
            </div>
            <button
              className="frontline-rotation-execute"
              type="button"
              disabled={finished || !selectedFrontlinePressure || !selectedFrontlineRotationPreview}
              onClick={() => {
                if (!selectedFrontlinePressure) {
                  return;
                }
                applyFrontlineRotationResponse(
                  selectedFrontlinePressure,
                  selectedRotationTiredUnitId,
                  selectedRotationReserveUnitId,
                );
              }}
            >
              選択交代を実行
            </button>
          </div>
          <div className="frontline-doctrine-board" aria-label="戦線一括指揮">
            <div className="frontline-doctrine-status">
              <strong>戦線指揮</strong>
              <span>状態 {selectedFrontlineDoctrinePreview.pressureLevel}</span>
              <span>平均士気 {selectedFrontlineDoctrinePreview.morale}</span>
              <span>平均弾薬 {selectedFrontlineDoctrinePreview.ammo}</span>
              <span>
                施設 {selectedFrontlineDoctrinePreview.facilityCount} / 損傷
                {selectedFrontlineDoctrinePreview.damagedStructures}
              </span>
              <span>主脅威 {selectedFrontlineDoctrinePreview.leadThreat}</span>
            </div>
            <div className="frontline-doctrine-actions">
              {frontlineDoctrinePresets.map((preset) => {
                const assessment = frontlineDoctrineAssessment(
                  preset,
                  selectedFrontlinePressure,
                  selectedFrontlineDoctrinePreview,
                );
                const tone =
                  assessment.tone === "neutral" ? frontlineDoctrineTone(preset.id, selectedFrontlinePressure) : assessment.tone;
                return (
                  <button
                    key={preset.id}
                    className={tone}
                    type="button"
                    disabled={finished || (selectedFrontlinePressure?.defenders.length ?? 0) === 0}
                    onClick={() => applySelectedFrontlineDoctrine(preset.id)}
                    title={preset.summary}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.summary}</span>
                    <small>
                      予測 損耗{assessment.casualtyRisk} / 弾薬{assessment.ammoBurn} / 突破{assessment.lineRisk}
                    </small>
                    <em>{assessment.reason}</em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedUnit && (
        <div className="selected-command-panel">
          <div className="selected-command-main">
            <strong>{selectedUnit.name}</strong>
            <span>{unitTypeLabels[selectedUnit.type]}</span>
            <span>{battleActionReasonLabels[selectedUnit.actionReason]}</span>
            <span>戦線 {segmentName(battle, selectedUnit.standingOrder.frontlineSegmentId)}</span>
            <span>展開 {frontlineGeometryLabel}</span>
            <span>地形 {terrainLabelForPosition(battle, selectedUnit.position)}</span>
            <span>射線 {lineOfSightLabelForUnit(battle, selectedUnit)}</span>
            <span>戦列 {formationLabel(selectedUnit)}</span>
            <span>施設 {selectedStructure ? fortificationTypeLabels[selectedStructure.type] : "未指定"}</span>
            <span>優先 {targetPriorityLabels[selectedUnit.standingOrder.targetPriority]}</span>
            <span>弾薬 {ammoPolicyLabels[selectedUnit.standingOrder.ammoPolicy]}</span>
            <span className={selectedUnit.pendingOrder ? "pending-order-chip active" : "pending-order-chip"}>
              {commandTransmissionLabel(battle, selectedUnit)}
            </span>
            {selectedTransmissionPreview && !selectedUnit.pendingOrder && (
              <span className="pending-order-chip forecast">{selectedTransmissionPreview.label}</span>
            )}
            <span>集中 {focusTargetName(battle, selectedUnit.focusTargetId)}</span>
            <span>火力 {fireMissionStatus(battle, selectedUnit)}</span>
            <span>目標補給 斉射弾薬x{objectiveEffects.fireMissionAmmoMultiplier.toFixed(2)}</span>
            <span>敵波判読 {objectiveEffects.waveIntelLabel}</span>
            <span>予備即応 {Math.round(selectedUnit.reserveReadiness ?? 0)}</span>
            <span>{selectedUnit.tacticalLessonSummary ?? "戦術教訓なし"}</span>
            <span>規律 {fireDiscipline.label}</span>
            <span>観測所 {observationPostCount} / 未発見 {hiddenEnemyCount}</span>
            <span>隘路 {chokeSummary}</span>
            <span>保存方針 {selectedStandingTemplate ? "あり" : "なし"}</span>
          </div>
          <div className="selected-command-compass" aria-label="選択部隊の指揮コンパス">
            <div className="command-compass-status">
              <strong>指揮コンパス</strong>
              <span>現在 {mapCommandModeLabels[commandMode]}</span>
              <span>{selectedCommandInstruction}</span>
              <span>{commandQueueMode ? `予約中 ${queuedCommands.length}件` : "即時発令"}</span>
            </div>
            <div className="command-compass-grid">
              {selectedCommandCompass.map((item) => {
                const mode = item.id as Exclude<MapCommandMode, "none">;
                return (
                  <button
                    key={item.id}
                    className={commandMode === mode ? "active" : ""}
                    type="button"
                    onClick={() => toggleCommandMode(mode)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                    <small>{item.detail}</small>
                  </button>
                );
              })}
              <button
                className={commandMode === "select" ? "active selection" : "selection"}
                type="button"
                onClick={() => toggleCommandMode("select")}
              >
                <strong>選択</strong>
                <span>調査</span>
                <small>部隊/敵/施設/戦線</small>
              </button>
            </div>
            <div className="map-selection-inspector" aria-label="戦術マップ選択状況">
              {selectedMapInspectionItems.map((item) => (
                <span key={`${item.label}-${item.value}`}>
                  <strong>{item.label}</strong>
                  {item.value} / {item.detail}
                </span>
              ))}
              {selectedMapActionForecasts.length > 0 && (
                <div className="map-selection-forecasts" aria-label="選択対象への指揮予測">
                  {selectedMapActionForecasts.map((forecast) => (
                    <article key={`${forecast.title}-${forecast.summary}`} className={`map-selection-forecast ${forecast.tone}`}>
                      <strong>{forecast.title}</strong>
                      <span>{forecast.summary}</span>
                      <small>{forecast.detail}</small>
                    </article>
                  ))}
                </div>
              )}
              {(selectedEnemy || inspectedStructure || selectedStructure || selectedFrontlinePressure) && (
                <div className="map-selection-actions" aria-label="選択対象への即応指揮">
                  {selectedEnemy && (
                    <>
                      <button
                        type="button"
                        disabled={!selectedEnemy.isSpotted || selectedEnemyResponseUnits.length === 0 || finished}
                        onClick={applySelectedEnemyResponse}
                      >
                        敵群対応
                      </button>
                      <button
                        type="button"
                        disabled={!selectedEnemy.isSpotted || selectedEnemyResponseUnits.length === 0 || finished}
                        onClick={volleySelectedEnemyResponse}
                      >
                        戦線斉射
                      </button>
                      <button
                        type="button"
                        disabled={!selectedEnemy.isSpotted || !selectedUnit || finished}
                        onClick={focusSelectedEnemy}
                      >
                        選択旅団集中
                      </button>
                    </>
                  )}
                  {(inspectedStructure || selectedStructure) && (
                    <>
                      <button type="button" disabled={finished} onClick={() => applyInspectedFacilityResponse(false)}>
                        施設即応
                      </button>
                      <button type="button" disabled={finished} onClick={() => applyInspectedFacilityResponse(true)}>
                        修理優先
                      </button>
                    </>
                  )}
                  {selectedFrontlinePressure && (
                    <button
                      type="button"
                      disabled={
                        finished ||
                        selectedFrontlinePressure.level === "quiet" ||
                        (selectedFrontlinePressure.defenders.length === 0 && selectedFrontlinePressure.reserves.length === 0)
                      }
                      onClick={applyInspectedFrontlineResponse}
                    >
                      戦線対応
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {selectedUnitFrontlinePressure && (
            <div className={`selected-frontline-diagnosis ${selectedUnitFrontlinePressure.level}`} aria-label="選択部隊の担当戦線診断">
              <div className="selected-frontline-diagnosis-main">
                <strong>担当戦線診断</strong>
                <span>
                  {selectedUnitFrontlinePressure.segment.name} / {frontlinePressureLevelLabels[selectedUnitFrontlinePressure.level]} /{" "}
                  {selectedUnitFrontlineRole}
                </span>
                <small>
                  敵圧{Math.round(selectedUnitFrontlinePressure.pressure)} / 守備{selectedUnitFrontlinePressure.defenders.length} / 予備
                  {selectedUnitFrontlinePressure.reserves.length} / 距離{selectedUnitFrontlineDistance}
                </small>
                <small>
                  {selectedUnitFrontlinePressure.leadEnemy
                    ? `主脅威 ${mapEnemyDisplayName(selectedUnitFrontlinePressure.leadEnemy)} ${enemyAssaultPhaseLabels[selectedUnitFrontlinePressure.leadEnemy.assaultPlan.phase]}`
                    : "主脅威なし"}
                  {selectedUnitReadinessWarning ? ` / 注意 ${selectedUnitReadinessWarning}` : " / 余力維持"}
                </small>
              </div>
              <div className="selected-frontline-diagnosis-actions">
                <button type="button" onClick={() => inspectFrontlinePressure(selectedUnitFrontlinePressure)}>
                  戦線表示
                </button>
                <button
                  type="button"
                  disabled={
                    finished ||
                    selectedUnitFrontlinePressure.level === "quiet" ||
                    (selectedUnitFrontlinePressure.defenders.length === 0 && selectedUnitFrontlinePressure.reserves.length === 0)
                  }
                  onClick={() => applyFrontlinePressureResponse(selectedUnitFrontlinePressure)}
                >
                  {commandQueueMode ? "圧力対応を予約" : selectedUnitFrontlinePressure.recommendationLabel}
                </button>
              </div>
            </div>
          )}
          <div className="selected-tactical-suggestions" aria-label="選択部隊の戦術提案">
            <div className="tactical-suggestion-heading">
              <strong>戦術提案</strong>
              <span>{selectedTacticalSuggestions.length > 0 ? `関連警報 ${selectedTacticalSuggestions.length}件` : "関連警報なし"}</span>
              <span>{commandQueueMode ? "推奨は予約指揮へ積む" : "推奨は即時発令"}</span>
            </div>
            <div className="tactical-suggestion-list">
              {selectedTacticalSuggestions.length === 0 && (
                <p>この旅団に近い警報はない。現在の戦線、施設、集中目標を維持。</p>
              )}
              {selectedTacticalSuggestions.map(({ alert, relevance, reason }) => (
                <article key={`selected-suggestion-${alert.id}`} className={`tactical-suggestion-card ${alert.severity}`}>
                  <button className="tactical-suggestion-main" type="button" onClick={() => handleAlertClick(alert)}>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                    <small>
                      関連{Math.round(relevance)} / {reason}
                    </small>
                  </button>
                  <button
                    className="tactical-suggestion-action"
                    type="button"
                    disabled={finished}
                    onClick={() => applyAlertRecommendationCommand(alert)}
                  >
                    {alert.recommendation}
                  </button>
                </article>
              ))}
            </div>
          </div>
          <div className="button-row compact">
            <button
              className={commandMode === "select" ? "active" : ""}
              type="button"
              onClick={() => toggleCommandMode("select")}
            >
              選択モード
            </button>
            <button
              className={commandMode === "anchor" ? "active" : ""}
              type="button"
              onClick={() => toggleCommandMode("anchor")}
            >
              基準位置を指定
            </button>
            <button
              className={commandMode === "fallback" ? "active" : ""}
              type="button"
              onClick={() => toggleCommandMode("fallback")}
            >
              後退地点を指定
            </button>
            <button
              className={commandMode === "facility" ? "active" : ""}
              type="button"
              onClick={() => toggleCommandMode("facility")}
            >
              施設をクリック
            </button>
            <button
              className={commandMode === "segment" ? "active" : ""}
              type="button"
              onClick={() => toggleCommandMode("segment")}
            >
              戦線をクリック
            </button>
            <button
              className={commandMode === "focusTarget" || !!selectedFocusTarget ? "active" : ""}
              type="button"
              onClick={() => toggleCommandMode("focusTarget")}
            >
              敵を指名
            </button>
            <button
              type="button"
              disabled={!selectedUnit.focusTargetId}
              onClick={() => onChange(clearUnitFocusTarget(battle, selectedUnit.unitId))}
            >
              指名解除
            </button>
            <button type="button" onClick={() => scrollToPosition(selectedUnit.position)}>
              部隊へ移動
            </button>
            <button
              type="button"
              disabled={!onSaveStandingOrderTemplate}
              onClick={() => onSaveStandingOrderTemplate?.(selectedUnit)}
            >
              方針保存
            </button>
            {selectedStandingTemplate && (
              <button
                type="button"
                onClick={() => onChange(applySavedStandingOrderTemplate(battle, selectedUnit.unitId, selectedStandingTemplate))}
              >
                保存方針へ戻す
              </button>
            )}
          </div>
          <div className="selected-command-summary" aria-label="選択部隊の自律指揮サマリー">
            <span>
              基準 X{Math.round(selectedUnit.standingOrder.anchor.x)} Y{Math.round(selectedUnit.standingOrder.anchor.y)} / 半径
              {selectedUnit.standingOrder.controlRadius}
            </span>
            <span>
              後退 X{Math.round(selectedUnit.standingOrder.fallback.destination.x)} Y
              {Math.round(selectedUnit.standingOrder.fallback.destination.y)} /{" "}
              {selectedUnit.standingOrder.fallback.enabled ? "自動後退あり" : "自動後退なし"}
            </span>
            <span>現在行動 {battleActionReasonLabels[selectedUnit.actionReason]}</span>
            <span>{commandTransmissionLabel(battle, selectedUnit)}</span>
            <span className="autonomy-reason-detail">
              伝令判断 {selectedUnit.pendingOrder ? commandTransmissionDetail(selectedUnit) : selectedTransmissionPreview?.detail}
            </span>
            <span className="autonomy-reason-detail">
              伝令影響 {selectedUnit.pendingOrder ? "到達まで移動/射撃低下中" : selectedTransmissionPreview?.penaltySummary}
            </span>
            <span className="autonomy-reason-detail">判断理由 {actionReasonDetail(battle, selectedUnit)}</span>
          </div>
          <div className="target-audit-panel" aria-label="選択部隊の射撃判断監査">
            <div className="target-audit-heading">
              <strong>射撃判断監査</strong>
              <span>
                採用候補 {selectedAuditTarget ? mapEnemyDisplayName(selectedAuditTarget.enemy) : "なし"} / 優先
                {targetPriorityLabels[selectedUnit.standingOrder.targetPriority]} / 射程
                {Math.round(effectiveRangeForUnit(battle, selectedUnit))}
              </span>
              <span>後退 {fallbackAuditLabel(selectedUnit)}</span>
              <span>施設 {facilityAuditLabel(battle, selectedUnit)}</span>
            </div>
            <div className="target-audit-list">
              {selectedTargetAudits.length === 0 && <p>発見済み敵なし。観測所、戦線前進、偵察圧力が必要。</p>}
              {selectedTargetAudits.map((entry) => {
                const isCurrent =
                  selectedUnit.currentTargetId === entry.enemy.id ||
                  selectedUnit.focusTargetId === entry.enemy.id ||
                  selectedAuditTarget?.enemy.id === entry.enemy.id;
                return (
                  <button
                    key={entry.enemy.id}
                    className={isCurrent ? "selected" : ""}
                    type="button"
                    disabled={finished || !entry.inArcAndRange || entry.lineOfSight.blocked}
                    onClick={() => {
                      setSelectedEnemyId(entry.enemy.id);
                      onChange(setUnitFocusTarget(battle, selectedUnit.unitId, entry.enemy.id));
                      scrollToPosition(entry.enemy.position);
                    }}
                  >
                    <strong>{mapEnemyDisplayName(entry.enemy)}</strong>
                    <span>
                      {targetAuditStatus(entry)} / 距離{Math.round(entry.distance)} / 戦列距離
                      {Math.round(entry.formationDistance)} / 有効射程{Math.round(entry.effectiveRange)}
                    </span>
                    <small>
                      {enemyAssaultPhaseLabels[entry.enemy.assaultPlan.phase]} / {enemyMoraleStateLabels[entry.enemy.assaultPlan.moraleState]} / 数
                      {Math.round(entry.enemy.count)}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="button-row compact">
            {standingOrderPresets.map((preset) => (
              <button
                key={preset.id}
                className={selectedUnit.standingOrder.posture === preset.id ? "active" : ""}
                type="button"
                onClick={() =>
                  issueOrQueueCommand(
                    selectedUnit,
                    preset.label,
                    `姿勢 ${preset.label} / 優先 ${targetPriorityLabels[preset.targetPriority]} / 弾薬 ${ammoPolicyLabels[preset.ammoPolicy]}`,
                    (state) => applyStandingOrderPreset(state, selectedUnit.unitId, preset.id),
                  )
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="button-row compact">
            {formationFacingOptions.map((option) => (
              <button
                key={option.facingDeg}
                className={selectedFacingDeg === option.facingDeg ? "active" : ""}
                type="button"
                onClick={() =>
                  issueOrQueueCommand(
                    selectedUnit,
                    `射界${option.shortLabel}`,
                    formationFacingDisplayLabel(option.facingDeg),
                    (state) => setStandingOrderFacing(state, selectedUnit.unitId, option.facingDeg),
                  )
                }
              >
                射界{option.shortLabel}
              </button>
            ))}
          </div>
          <div className="command-control-row">
            <span>射界微調整</span>
            <div className="button-row compact">
              <button
                type="button"
                disabled={selectedFacingDeg <= -65}
                onClick={() =>
                  issueOrQueueCommand(
                    selectedUnit,
                    "射界微調整",
                    formationFacingDisplayLabel(selectedFacingDeg - 15),
                    (state) => setStandingOrderFacing(state, selectedUnit.unitId, selectedFacingDeg - 15),
                  )
                }
              >
                北へ15度
              </button>
              <button
                type="button"
                className={selectedFacingDeg === 0 ? "active" : ""}
                onClick={() =>
                  issueOrQueueCommand(selectedUnit, "射界正面", "正面0度", (state) =>
                    setStandingOrderFacing(state, selectedUnit.unitId, 0),
                  )
                }
              >
                正面0度
              </button>
              <button
                type="button"
                disabled={selectedFacingDeg >= 65}
                onClick={() =>
                  issueOrQueueCommand(
                    selectedUnit,
                    "射界微調整",
                    formationFacingDisplayLabel(selectedFacingDeg + 15),
                    (state) => setStandingOrderFacing(state, selectedUnit.unitId, selectedFacingDeg + 15),
                  )
                }
              >
                南へ15度
              </button>
              <span className="inline-status-pill">{formationFacingDisplayLabel(selectedFacingDeg)}</span>
            </div>
          </div>
          <div className="command-control-row">
            <span>優先目標</span>
            <div className="button-row compact">
              {targetPriorities.map((priority) => (
                <button
                  key={priority}
                  className={selectedUnit.standingOrder.targetPriority === priority ? "active" : ""}
                  type="button"
                  onClick={() =>
                    issueOrQueueCommand(
                      selectedUnit,
                      `優先 ${targetPriorityLabels[priority]}`,
                      `目標優先を${targetPriorityLabels[priority]}へ`,
                      (state) => setStandingOrderTargetPriority(state, selectedUnit.unitId, priority),
                    )
                  }
                >
                  {targetPriorityLabels[priority]}
                </button>
              ))}
            </div>
          </div>
          <div className="command-control-row">
            <span>弾薬方針</span>
            <div className="button-row compact">
              {ammoPolicies.map((policy) => (
                <button
                  key={policy}
                  className={selectedUnit.standingOrder.ammoPolicy === policy ? "active" : ""}
                  type="button"
                  onClick={() =>
                    issueOrQueueCommand(
                      selectedUnit,
                      ammoPolicyLabels[policy],
                      `弾薬方針を${ammoPolicyLabels[policy]}へ`,
                      (state) => setStandingOrderAmmoPolicy(state, selectedUnit.unitId, policy),
                    )
                  }
                >
                  {ammoPolicyLabels[policy]}
                </button>
              ))}
            </div>
          </div>
          <div className="command-control-row">
            <span>火力管制</span>
            <div className="button-row compact">
              {fireMissionScopes.map((scope) => (
                <button
                  key={scope}
                  className={selectedFireMission?.scope === scope ? "active" : ""}
                  type="button"
                  disabled={!canIssueFireMission}
                  onClick={() =>
                    issueOrQueueCommand(
                      selectedUnit,
                      fireMissionScopeLabels[scope],
                      `捕捉目標へ${fireMissionScopeLabels[scope]}`,
                      (state) => issueFireMission(state, selectedUnit.unitId, scope),
                    )
                  }
                >
                  {fireMissionScopeLabels[scope]}
                </button>
              ))}
            </div>
          </div>
          <div className="command-control-row">
            <span>火力計画</span>
            <div className="button-row compact">
              <button
                type="button"
                disabled={!currentFirePlanTarget || firePlanDraft.length >= maxFirePlanStages || finished}
                onClick={() => addFirePlanStage("selected_unit")}
              >
                段追加:旅団
              </button>
              <button
                type="button"
                disabled={!currentFirePlanTarget || firePlanDraft.length >= maxFirePlanStages || finished}
                onClick={() => addFirePlanStage("frontline_segment")}
              >
                段追加:戦線
              </button>
              <button type="button" disabled={firePlanDraft.length === 0 || finished} onClick={startFirePlan}>
                計画開始
              </button>
              <button type="button" disabled={firePlanDraft.length === 0} onClick={() => setFirePlanDraft([])}>
                計画破棄
              </button>
            </div>
          </div>
          {firePlanDraft.length > 0 && (
            <div className="fire-plan-draft">
              {firePlanDraft.map((stage, index) => (
                <span key={stage.id}>
                  第{index + 1}段 +{stage.delaySeconds}秒 / {fireMissionScopeLabels[stage.scope]} / {stage.targetName}
                </span>
              ))}
            </div>
          )}
          <div className="button-row compact">
            {orders.map((order) => (
              <button
                key={order}
                className={selectedUnit.order === order ? "active" : ""}
                type="button"
                onClick={() =>
                  issueOrQueueCommand(
                    selectedUnit,
                    unitOrderLabels[order],
                    `即時命令 ${unitOrderLabels[order]}`,
                    (state) => setUnitOrder(state, selectedUnit.unitId, order),
                  )
                }
              >
                {unitOrderLabels[order]}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedEnemy && (
        <div className={`enemy-intent-panel ${selectedEnemy.isSpotted ? "spotted" : "hidden"}`} aria-label="敵群偵察報告">
          <div className="enemy-intent-heading">
            <strong>{selectedEnemy.isSpotted ? selectedEnemy.name : "未確認敵影"}</strong>
            <span>{selectedEnemy.isSpotted ? mapEnemyDisplayName(selectedEnemy) : "未発見"}</span>
            <span>{enemyThreatLabel(selectedEnemy)}</span>
          </div>
          <div className="enemy-intent-summary">
            <span>{enemyIntentDetail(selectedEnemy)}</span>
            {selectedEnemy.isSpotted ? (
              <>
                <span>
                  指揮 {enemyCommandStateLabels[selectedEnemy.assaultPlan.commandState]} / 影響
                  {Math.round(selectedEnemy.assaultPlan.commandInfluence * 100)}%
                </span>
                <span>
                  指令 {enemyCommandIntentLabels[selectedEnemy.assaultPlan.commandIntent]} /{" "}
                  {selectedEnemy.assaultPlan.commandLabel ?? "単独行動"}
                </span>
                <span>
                  階梯 {enemyCommandTierLabels[selectedEnemy.assaultPlan.commandTier ?? "none"]} / 親系統{" "}
                  {selectedEnemy.assaultPlan.commandParentId ?? selectedEnemy.assaultPlan.commandGroupId ?? "なし"}
                </span>
                <span>
                  士気 {enemyMoraleStateLabels[selectedEnemy.assaultPlan.moraleState ?? "steady"]} /{" "}
                  {Math.round((selectedEnemy.assaultPlan.morale ?? 0.7) * 100)}%
                </span>
                <span>
                  戦力 {Math.round(selectedEnemy.count)} / 射程 {selectedEnemy.range} / 圧力
                  {Math.round(selectedEnemy.pressure)}
                </span>
                <span>
                  突破 {enemyAssaultPhaseLabels[selectedEnemy.assaultPlan.phase]} / 深度
                  {Math.round(selectedEnemy.assaultPlan.penetrationDepth)} / 側面圧
                  {Math.round(selectedEnemy.assaultPlan.flankPressure)}
                </span>
                <span>
                  座標 X{Math.round(selectedEnemy.position.x)} Y{Math.round(selectedEnemy.position.y)} / 目標
                  {selectedEnemy.assaultPlan.targetName}
                </span>
                <span>推定担当戦線 {selectedEnemySegment?.name ?? "近接戦線"}</span>
                <span>
                  対応旅団{" "}
                  {selectedEnemyResponseUnits.length > 0
                    ? selectedEnemyResponseUnits.map((unit) => mapUnitDisplayName(unit)).join("、")
                    : "なし"}
                </span>
                <span>推奨対応 {enemyResponseLabel(selectedEnemy)}</span>
              </>
            ) : (
              <span>座標 X{Math.round(selectedEnemy.position.x)} Y{Math.round(selectedEnemy.position.y)} / 偵察不足</span>
            )}
          </div>
          <div className="button-row compact">
            <button type="button" onClick={() => scrollToPosition(selectedEnemy.position)}>
              敵位置へ移動
            </button>
            <button type="button" disabled={!selectedEnemy.isSpotted || !selectedUnit} onClick={focusSelectedEnemy}>
              選択旅団の集中目標
            </button>
            <button
              type="button"
              disabled={!selectedEnemy.isSpotted || selectedEnemyResponseUnits.length === 0}
              onClick={applySelectedEnemyResponse}
            >
              担当戦線で対応
            </button>
            <button
              type="button"
              disabled={!selectedEnemy.isSpotted || selectedEnemyResponseUnits.length === 0}
              onClick={volleySelectedEnemyResponse}
            >
              担当戦線斉射
            </button>
            <button type="button" onClick={() => setSelectedEnemyId("")}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {isMapCommandMode && selectedUnit && (
        <div className="map-command-hint">
          {commandMode === "anchor" && `${selectedUnit.name}の基準位置をマップ上でクリック`}
          {commandMode === "fallback" && `${selectedUnit.name}の後退地点をマップ上でクリック`}
          {commandMode === "facility" && `${selectedUnit.name}に担当させる施設をクリック`}
          {commandMode === "focusTarget" && `${selectedUnit.name}に集中射撃させる発見済み敵群をクリック`}
          {commandMode === "segment" && `${selectedUnit.name}に担当させる戦線区画をクリック`}
          {(commandMode === "anchor" || commandMode === "fallback") && "。基準/後退ハンドルはドラッグでも微調整可能"}
        </div>
      )}

      {frontlineSketchDraft && selectedFrontlineSegment && (
        <div className="map-command-hint">
          {frontlineSketchDraft.points.length === 0
            ? `${selectedFrontlineSegment.name}の新しい基準点をマップ上でクリック`
            : frontlineSketchDraft.points.length === 1
              ? `${selectedFrontlineSegment.name}の後退点をマップ上でクリック`
              : `${selectedFrontlineSegment.name}の曲げ点を追加、またはスケッチ確定`}
        </div>
      )}

      <div className="map-layer-control-panel" aria-label="戦術マップ表示レイヤー">
        <div className="map-layer-control-heading">
          <strong>戦術表示</strong>
          <span>
            {visibleMapLayerCount}/{tacticalMapLayerOrder.length} 表示
          </span>
          <button type="button" onClick={showAllTacticalMapLayers}>
            全表示
          </button>
        </div>
        <div className="map-layer-buttons">
          {tacticalMapLayerOrder.map((layerId) => (
            <button
              key={layerId}
              className={tacticalMapLayers[layerId] ? "active" : ""}
              type="button"
              onClick={() => toggleTacticalMapLayer(layerId)}
              title={tacticalMapLayerDescriptions[layerId]}
              aria-pressed={tacticalMapLayers[layerId]}
            >
              {tacticalMapLayerLabels[layerId]}
            </button>
          ))}
        </div>
        <div className="map-layer-legend" aria-label="戦術表示凡例">
          <span className="legend-swatch target-clear">射撃可</span>
          <span className="legend-swatch target-blocked">遮断</span>
          <span className="legend-swatch target-range">射程外</span>
          <span className="legend-swatch engagement">交戦</span>
          <span className="legend-swatch assault">突撃軸</span>
        </div>
      </div>

      <div
        ref={mapScrollRef}
        className="battle-map-scroll"
        aria-label="広域戦術マップ"
        onScroll={updateViewportRange}
      >
        <div
          ref={mapFieldRef}
          className={`battle-map battle-map-field command-${commandMode} ${frontlineSketchDraft ? "sketching-frontline" : ""}`}
          style={mapFieldStyle(battle)}
          onClick={applyMapCommand}
        >
          {effectiveMapLayers.frontlines && <div className="battle-front-line" />}
          {effectiveMapLayers.frontlines && battle.frontlineGeometry && (
            <div className={`battle-geometry-badge ${battle.frontlineGeometry.preset}`}>
              <strong>{frontlineGeometryLabel}</strong>
              <span>{battle.frontlineGeometry.description}</span>
            </div>
          )}
          {effectiveMapLayers.frontlines &&
            battle.frontlineSegments.map((segment) => (
              <button
                key={segment.id}
                className={`frontline-segment ${
                  selectedUnit?.standingOrder.frontlineSegmentId === segment.id ? "selected" : ""
                } ${selectedFrontlineSegment?.id === segment.id ? "command-selected" : ""}`}
                style={segmentStyle(battle, segment)}
                type="button"
                onClick={(event) => assignSelectedSegment(event, segment)}
              >
                <strong>{segment.name}</strong>
              </button>
            ))}
          {effectiveMapLayers.frontlines && battle.frontlineSegments.some((segment) => (segment.sketchPoints?.length ?? 0) > 1) && (
            <svg
              className="frontline-saved-sketch-layer"
              viewBox={`0 0 ${battle.mapBounds.width} ${battle.mapBounds.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {battle.frontlineSegments.map((segment) =>
                segment.sketchPoints && segment.sketchPoints.length > 1 ? (
                  segment.sketchPoints.length > 2 ? (
                    <path
                      key={`${segment.id}-saved-sketch`}
                      className={`frontline-saved-sketch-line ${
                        selectedFrontlineSegment?.id === segment.id ? "selected" : ""
                      }`}
                      d={svgSmoothSketchPath(segment.sketchPoints)}
                    />
                  ) : (
                    <polyline
                      key={`${segment.id}-saved-sketch`}
                      className={`frontline-saved-sketch-line ${
                        selectedFrontlineSegment?.id === segment.id ? "selected" : ""
                      }`}
                      points={svgPolylinePoints(segment.sketchPoints)}
                    />
                  )
                ) : null,
              )}
            </svg>
          )}
          {frontlineSketchDraft && (
            <svg
              className="frontline-sketch-layer"
              viewBox={`0 0 ${battle.mapBounds.width} ${battle.mapBounds.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {frontlineSketchDraft.points.length > 0 && (
                <>
                  {frontlineSketchDraft.points.length > 1 &&
                    (frontlineSketchDraft.points.length > 2 ? (
                      <path className="frontline-sketch-line" d={svgSmoothSketchPath(frontlineSketchDraft.points)} />
                    ) : (
                      <polyline className="frontline-sketch-line" points={svgPolylinePoints(frontlineSketchDraft.points)} />
                    ))}
                  {frontlineSketchDraft.points.map((point, index) => (
                    <circle
                      key={`${point.x}-${point.y}-${index}`}
                      className={index === 0 ? "frontline-sketch-anchor" : "frontline-sketch-point"}
                      cx={point.x}
                      cy={point.y}
                      r={index === 0 ? "2.2" : "1.8"}
                    />
                  ))}
                </>
              )}
            </svg>
          )}
          {effectiveMapLayers.terrain && (battle.chokePoints ?? []).map((choke) => (
            <div key={choke.id} className="choke-point" style={chokePointStyle(battle, choke)}>
              <span className="choke-point-label" style={chokePointLabelStyle(battle, choke)}>
                <strong>{choke.name}</strong>
                <em>通行圧 {choke.currentPressure}</em>
                <em>遅滞 {choke.delayPercent}%</em>
              </span>
            </div>
          ))}
          {effectiveMapLayers.orders && (
            <svg
              className="assignment-layer"
              viewBox={`0 0 ${battle.mapBounds.width} ${battle.mapBounds.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {battle.playerUnits.map((unit) => (
                <g key={unit.unitId} className={unit.unitId === selectedUnit?.unitId ? "assignment-set selected" : "assignment-set"}>
                  <circle
                    className={`assignment-radius ${unit.standingOrder.posture}`}
                    cx={unit.standingOrder.anchor.x}
                    cy={unit.standingOrder.anchor.y}
                    r={unit.standingOrder.controlRadius}
                  />
                  <line
                    className="fallback-route"
                    x1={unit.standingOrder.anchor.x}
                    y1={unit.standingOrder.anchor.y}
                    x2={unit.standingOrder.fallback.destination.x}
                    y2={unit.standingOrder.fallback.destination.y}
                  />
                  <circle className="anchor-point" cx={unit.standingOrder.anchor.x} cy={unit.standingOrder.anchor.y} r="1.5" />
                </g>
              ))}
            </svg>
          )}
          {effectiveMapLayers.targetAudit && selectedUnit && selectedTargetAudits.length > 0 && (
            <svg
              className="target-audit-map-layer"
              viewBox={`0 0 ${battle.mapBounds.width} ${battle.mapBounds.height}`}
              preserveAspectRatio="none"
              aria-label="選択部隊の射撃候補線"
            >
              {selectedTargetAudits.map((entry) => {
                const midpoint = {
                  x: (selectedUnit.position.x + entry.enemy.position.x) / 2,
                  y: (selectedUnit.position.y + entry.enemy.position.y) / 2,
                };
                return (
                  <g key={`target-audit-map-${entry.enemy.id}`} className="target-audit-map-entry">
                    <line
                      className={targetAuditLineClass(entry, selectedAuditTarget)}
                      x1={selectedUnit.position.x}
                      y1={selectedUnit.position.y}
                      x2={entry.enemy.position.x}
                      y2={entry.enemy.position.y}
                    />
                    <text className="target-audit-map-label" x={midpoint.x} y={midpoint.y}>
                      {targetAuditStatus(entry).split(" ")[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          {effectiveMapLayers.orders && selectedUnit && (["anchor", "fallback"] as const).map((kind) => {
            const position = orderHandlePosition(kind);
            if (!position) {
              return null;
            }
            return (
              <button
                key={`${selectedUnit.unitId}-${kind}-drag-handle`}
                className={`map-order-handle ${kind} ${
                  dragOrderHandle?.unitId === selectedUnit.unitId && dragOrderHandle.kind === kind ? "dragging" : ""
                }`}
                style={fieldStyle(battle, position)}
                type="button"
                onPointerDown={(event) => startOrderHandleDrag(event, kind)}
                onPointerMove={moveOrderHandleDrag}
                onPointerUp={finishOrderHandleDrag}
                onPointerCancel={() => setDragOrderHandle(null)}
                onMouseDown={(event) => startOrderHandleMouseDrag(event, kind)}
                onMouseMove={moveOrderHandleMouseDrag}
                onMouseUp={finishOrderHandleMouseDrag}
                onClick={(event) => event.stopPropagation()}
                title={kind === "anchor" ? "基準位置をドラッグ調整" : "後退地点をドラッグ調整"}
              >
                <span>{kind === "anchor" ? "基準" : "後退"}</span>
              </button>
            );
          })}
          {effectiveMapLayers.frontlines && selectedFrontlineSegment && (["frontline-anchor", "frontline-fallback"] as const).map((kind) => {
            const position = frontlineHandlePosition(kind, selectedFrontlineSegment);
            if (!position) {
              return null;
            }
            return (
              <button
                key={`${selectedFrontlineSegment.id}-${kind}-drag-handle`}
                className={`frontline-order-handle ${kind} ${
                  dragFrontlineHandle?.segmentId === selectedFrontlineSegment.id && dragFrontlineHandle.kind === kind
                    ? "dragging"
                    : ""
                }`}
                style={fieldStyle(battle, position)}
                type="button"
                onPointerDown={(event) => startFrontlineHandleDrag(event, selectedFrontlineSegment.id, kind)}
                onPointerMove={moveFrontlineHandleDrag}
                onPointerUp={finishFrontlineHandleDrag}
                onPointerCancel={() => setDragFrontlineHandle(null)}
                onMouseDown={(event) => startFrontlineHandleMouseDrag(event, selectedFrontlineSegment.id, kind)}
                onMouseMove={moveFrontlineHandleMouseDrag}
                onMouseUp={finishFrontlineHandleMouseDrag}
                onClick={(event) => event.stopPropagation()}
                title={kind === "frontline-anchor" ? "戦線基準位置" : "戦線後退位置"}
              >
                <span>{kind === "frontline-anchor" ? "戦線" : "後退線"}</span>
              </button>
            );
          })}
          {(effectiveMapLayers.formations || effectiveMapLayers.enemyAssault) && (
            <svg
              className="formation-layer"
              viewBox={`0 0 ${battle.mapBounds.width} ${battle.mapBounds.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
            {effectiveMapLayers.enemyAssault && battle.enemyUnits.map((unit) => {
              const axisEnd = enemyAssaultAxisEnd(battle, unit);
              return (
                <g
                  key={`enemy-assault-${unit.id}`}
                  className={`enemy-assault-set ${unit.type} ${unit.isSpotted ? "spotted" : "hidden"} ${unit.assaultPlan.commandState} ${unit.assaultPlan.moraleState ?? "steady"} phase-${unit.assaultPlan.phase}`}
                >
                  <ellipse
                    className="enemy-assault-footprint"
                    cx={unit.position.x}
                    cy={unit.position.y}
                    rx={Math.max(2.5, unit.assaultPlan.frontageWidth / 2)}
                    ry={Math.max(1.8, unit.assaultPlan.depth / 2)}
                    transform={`rotate(${enemyAssaultAngleDeg(unit)} ${unit.position.x} ${unit.position.y})`}
                  />
                  <line
                    className="enemy-assault-axis"
                    x1={unit.position.x}
                    y1={unit.position.y}
                    x2={axisEnd.x}
                    y2={axisEnd.y}
                  />
                </g>
              );
            })}
            {effectiveMapLayers.formations && selectedUnit && (
              <polygon className="formation-arc selected" points={formationArcPoints(battle, selectedUnit)} />
            )}
            {effectiveMapLayers.formations && battle.playerUnits.map((unit) => {
              const halfFront = unit.formation.frontageWidth / 2;
              const frontageStart = formationFramePoint(battle, unit, 0, -halfFront);
              const frontageEnd = formationFramePoint(battle, unit, 0, halfFront);
              const facingEnd = formationFramePoint(battle, unit, Math.min(12, effectiveRangeForUnit(battle, unit) * 0.28), 0);
              return (
                <g
                  key={unit.unitId}
                  className={`formation-set ${unit.unitId === selectedUnit?.unitId ? "selected" : ""} ${
                    unit.formation.overlapPressure >= 0.42 ? "crowded" : ""
                  }`}
                >
                  <line
                    className="formation-frontage"
                    x1={frontageStart.x}
                    y1={frontageStart.y}
                    x2={frontageEnd.x}
                    y2={frontageEnd.y}
                    strokeWidth={Math.max(0.45, unit.formation.depth * 0.26)}
                  />
                  <line
                    className="formation-facing"
                    x1={unit.position.x}
                    y1={unit.position.y}
                    x2={facingEnd.x}
                    y2={facingEnd.y}
                  />
                </g>
              );
            })}
            </svg>
          )}
          {effectiveMapLayers.engagements && (
            <svg
              className="engagement-layer"
              viewBox={`0 0 ${battle.mapBounds.width} ${battle.mapBounds.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {battle.engagements.map((engagement) => (
                <line
                  key={engagement.id}
                  className={`engagement-line ${engagement.kind}`}
                  x1={engagement.from.x}
                  y1={engagement.from.y}
                  x2={engagement.to.x}
                  y2={engagement.to.y}
                  opacity={0.35 + engagement.intensity * 0.5}
                />
              ))}
            </svg>
          )}
        {effectiveMapLayers.terrain && battle.terrainZones.map((terrain) => (
          <span
            key={terrain.id}
            className={`terrain-callout ${terrain.terrainTag} los-${lineOfSightTerrainClass(terrain)}`}
            style={terrainZoneStyle(battle, terrain)}
          >
            {terrain.name} 移動{Math.round(terrain.movement * 100)}% / {lineOfSightTerrainLabel(terrain)}
          </span>
        ))}
        {effectiveMapLayers.terrain && enemyApproaches.map((approach) => (
          <span key={approach.id} className="enemy-approach" style={fieldStyle(battle, approach.position)}>
            {approach.label}
          </span>
        ))}
        {effectiveMapLayers.terrain && (battle.objectiveNodes ?? []).map((node) => (
          <div
            key={node.id}
            className={`objective-node ${objectiveNodeClassNames[node.type]} control-${node.control}`}
            style={fieldStyle(battle, node.position)}
            title={`${node.label} ${node.scenario.label}: ${node.scenario.effectSummary} / ${node.eventState.label} ${node.eventState.effectSummary}${
              node.eventState.chainStage > 0 ? ` / ${node.eventState.chainLabel} ${node.eventState.chainEffectSummary}` : ""
            } / ${objectiveControlLabels[node.control]} ${Math.round(node.controlProgress)}%`}
          >
            <img src={objectiveNodeAssets[node.type]} alt="" aria-hidden="true" />
            <strong>{node.label}</strong>
            <small>{node.scenario.label}</small>
            <small className={`objective-event-text ${node.eventState.severity}`}>
              {node.eventState.label}
              {node.eventState.chainStage > 0 ? ` / ${node.eventState.chainLabel}` : ""}
            </small>
            <span>
              {objectiveControlLabels[node.control]} {Math.round(node.controlProgress)}%
              {node.type === "visibility" ? ` / 視界${spottingRange}` : ""}
            </span>
            <button className="objective-node-action" type="button" onClick={(event) => applyObjectiveResponse(event, node)}>
              {objectiveResponseTacticalProfile(node, battle.structures).actionLabel}
            </button>
            <small>{objectiveResponseTacticalProfile(node, battle.structures).intentLabel}</small>
          </div>
        ))}
        <div className="map-progress" style={{ width: `${progress}%` }} />
        {effectiveMapLayers.facilities && battle.structures.map((structure) => (
          <button
            key={structure.id}
            className={`map-structure ${structure.type} ${structure.status} facility-${structure.facilityState} ${structure.currentTargetId ? "targeting" : ""}`}
            style={fieldStyle(battle, structure.position)}
            type="button"
            onClick={(event) => assignSelectedFacility(event, structure)}
          >
            <img
              className="map-structure-art"
              src={battleAssetUrls.structures[structure.type]}
              alt=""
              aria-hidden="true"
            />
            <img
              className="map-status-art"
              src={battleAssetUrls.status[structure.status]}
              alt=""
              aria-hidden="true"
            />
            <span>{fortificationTypeLabels[structure.type]}</span>
            <em>
              {structure.facilityStateLabel} / {fortificationStatusLabels[structure.status]} {Math.round(structure.durability)} / 射程{structure.range}
            </em>
            <small>
              脅威{Math.round(structure.tacticalPressure)} / 修理{structure.repairRate.toFixed(1)} / 担当{structure.assignedUnitIds.length}
            </small>
            <small>
              担当{" "}
              {battle.playerUnits
                .filter((unit) => unit.standingOrder.facilityAssignment?.structureId === structure.id)
                .map((unit) => unit.name.replace(/^第/, ""))
                .join("、") || "なし"}
            </small>
          </button>
        ))}
        {battle.playerUnits.map((unit) => (
          <button
            key={unit.unitId}
            className={`map-unit player ${unit.type} ${unit.unitId === selectedUnit?.unitId ? "selected" : ""} ${unit.currentTargetId ? "targeting" : ""} ${unit.fireMissionId ? "volleying" : ""} ${unit.isMoving ? "moving" : ""}`}
            style={fieldStyle(battle, unit.position)}
            type="button"
            onClick={(event) => {
              if (commandMode === "anchor" || commandMode === "fallback" || commandMode === "segment") {
                return;
              }
              event.stopPropagation();
              setSelectedUnitId(unit.unitId);
              if (commandMode === "select") {
                setSelectedEnemyId("");
                setInspectedStructureId("");
                if (unit.standingOrder.frontlineSegmentId) {
                  setSelectedFrontlineSegmentId(unit.standingOrder.frontlineSegmentId);
                }
              }
              scrollToPosition(unit.position);
            }}
          >
            <i className="range-ring" style={{ width: `${unit.range * 1.7}%`, height: `${unit.range * 1.7}%` }} />
            {unit.currentTargetId && <img className="map-marker-art" src={battleAssetUrls.markers.target} alt="" aria-hidden="true" />}
            <img className="map-token-art" src={battleAssetUrls.unitTokens[unit.type]} alt="" aria-hidden="true" />
            <span title={unit.name}>{mapUnitDisplayName(unit)}</span>
            <em>
              {Math.round(unit.soldiers)} / {mapPostureLabel(unit)} / {unit.fireMissionId ? "斉射" : `幅${Math.round(unit.formation.frontageWidth)}`}
            </em>
            <small>{actionReasonBadge(battle, unit)}</small>
          </button>
        ))}
        {battle.enemyUnits.map((unit) => (
          <button
            key={unit.id}
            className={`map-unit enemy ${unit.type} ${unit.isSpotted ? "spotted" : "hidden"} ${unit.assaultPlan.commandState} ${unit.assaultPlan.moraleState ?? "steady"} phase-${unit.assaultPlan.phase} ${unit.assaultPlan.targetStructureId ? "structure-raider" : ""} ${unit.currentTargetId ? "targeting" : ""} ${selectedUnit?.focusTargetId === unit.id ? "focused" : ""} ${selectedEnemyId === unit.id ? "inspected" : ""} ${unit.isMoving ? "moving" : ""}`}
            style={fieldStyle(battle, unit.position)}
            type="button"
            onClick={(event) => assignSelectedFocusTarget(event, unit)}
            title={unit.isSpotted ? `${unit.name}の意図を確認` : "未確認敵影"}
          >
            {unit.currentTargetId && unit.isSpotted && (
              <img className="map-marker-art enemy-marker" src={battleAssetUrls.markers.target} alt="" aria-hidden="true" />
            )}
            {selectedUnit?.focusTargetId === unit.id && unit.isSpotted && (
              <img className="map-marker-art focus-marker" src={battleAssetUrls.markers.target} alt="" aria-hidden="true" />
            )}
            <img className="map-token-art" src={battleAssetUrls.enemyTokens[unit.type]} alt="" aria-hidden="true" />
            <span title={unit.isSpotted ? unit.name : "未確認敵影"}>{unit.isSpotted ? mapEnemyDisplayName(unit) : "敵影"}</span>
            <em>
              {unit.isSpotted
                ? `${Math.round(unit.count)} / ${enemyAssaultPhaseLabels[unit.assaultPlan.phase]} / ${enemyMoraleStateLabels[unit.assaultPlan.moraleState ?? "steady"]}`
                : `未確認 / 隠蔽${Math.round(unit.concealment || enemyConcealmentAt(unit, battle.terrainZones))}`}
            </em>
            {unit.isSpotted && (
              <small>
                {unit.assaultPlan.targetName} / 深{Math.round(unit.assaultPlan.penetrationDepth)} 側
                {Math.round(unit.assaultPlan.flankPressure)} / 凝集
                {Math.round(unit.assaultPlan.cohesion * 100)} / 士気
                {Math.round((unit.assaultPlan.morale ?? 0.7) * 100)} / {enemyCommandStateLabels[unit.assaultPlan.commandState]} 指揮
                {Math.round(unit.assaultPlan.commandInfluence * 100)}%
                {" / "}
                {enemyCommandIntentLabels[unit.assaultPlan.commandIntent]}
                {unit.assaultPlan.targetStructureId ? " / 施設襲撃" : ""}
                {" / "}
                {enemyCommandTierLabels[unit.assaultPlan.commandTier ?? "none"]}
                {" / "}
                {unit.assaultPlan.commandLabel ?? "単独行動"}
              </small>
            )}
          </button>
        ))}
        <div className="battle-objective">
          <span>防衛時間 {battle.elapsedSeconds}/{battle.objectiveState.holdSecondsRequired}秒</span>
          <span>戦線維持 {Math.round(battle.objectiveState.lineIntegrity)}%</span>
          <span>敵制圧 {Math.round(battle.objectiveState.enemySuppression)}%</span>
          <span>勝利点 {Math.round(battle.objectiveState.victoryControl)}%</span>
          <span>補給点 {Math.round(battle.objectiveState.supplyControl)}%</span>
          <span>視界点 {Math.round(battle.objectiveState.visibilityControl)}%</span>
          <span>目標効果 {objectiveEffects.summary}</span>
          <span>目標イベント {objectiveEffects.eventSummary}</span>
          <span>敵波 {battle.wavesSpawned}</span>
          <span>波計画 {battle.scenario.waveIntel.summary}</span>
          <span>敵波判読 {objectiveEffects.waveIntelLabel}</span>
          {battle.scenario.waveIntel.surpriseSummary && <span>実波警戒 {battle.scenario.waveIntel.surpriseSummary}</span>}
          <span>視界 {spottingRange}</span>
          <span>発見 {spottedEnemyCount}/{battle.enemyUnits.length}</span>
          {(battle.chokePoints ?? []).map((choke) => (
            <span key={choke.id}>
              隘路 {choke.currentPressure}/{choke.flowLimit} 遅滞{choke.delayPercent}%
            </span>
          ))}
        </div>
        <div className="battle-wave-timeline" aria-label="戦闘中敵波タイムライン">
          {(battle.scenario.waveIntel.timeline ?? []).slice(0, 4).map((entry) => (
            <span
              key={entry.waveNumber}
              className={`${battle.wavesSpawned >= entry.waveNumber ? "passed" : ""} ${entry.pressureLabel} certainty-${entry.intelCertainty}`}
              title={entry.summary}
            >
              第{entry.waveNumber}波 {entry.secondLabel} {entry.pressureLabel} {timelineCertaintyLabels[entry.intelCertainty]}
            </span>
          ))}
        </div>
        <div className="battle-minimap-panel" aria-label="戦術ミニマップ操作">
          <div
            className="battle-minimap"
            role="button"
            tabIndex={0}
            title="クリックで戦術マップを移動。左右キー/Home/Endでも移動。"
            onClick={handleMinimapClick}
            onKeyDown={handleMinimapKeyDown}
          >
            <span className="mini-front" />
            <span
              className="mini-viewport"
              style={{
                left: `${viewportRange.left}%`,
                width: `${viewportRange.width}%`,
              }}
            />
            {minimapFocusPosition && (
              <span
                className="mini-focus"
                style={{
                  left: `${(minimapFocusPosition.x / battle.mapBounds.width) * 100}%`,
                  top: `${(minimapFocusPosition.y / battle.mapBounds.height) * 100}%`,
                }}
              />
            )}
            {battle.structures.map((structure) => (
              <i
                key={structure.id}
                className={`mini-structure ${structure.status}`}
                style={{
                  left: `${(structure.position.x / battle.mapBounds.width) * 100}%`,
                  top: `${(structure.position.y / battle.mapBounds.height) * 100}%`,
                }}
              />
            ))}
            {(battle.chokePoints ?? []).map((choke) => (
              <i
                key={choke.id}
                className="mini-choke"
                style={{
                  left: `${(choke.position.x / battle.mapBounds.width) * 100}%`,
                  top: `${(choke.position.y / battle.mapBounds.height) * 100}%`,
                }}
              />
            ))}
            {battle.playerUnits.slice(0, 10).map((unit) => (
              <i
                key={unit.unitId}
                className={unit.unitId === selectedUnit?.unitId ? "mini-player selected" : "mini-player"}
                style={{
                  left: `${(unit.position.x / battle.mapBounds.width) * 100}%`,
                  top: `${(unit.position.y / battle.mapBounds.height) * 100}%`,
                }}
              />
            ))}
            {battle.enemyUnits.slice(0, 8).map((unit) => (
              <i
                key={unit.id}
                className={unit.isSpotted ? "mini-enemy" : "mini-enemy hidden"}
                style={{
                  left: `${(unit.position.x / battle.mapBounds.width) * 100}%`,
                  top: `${(unit.position.y / battle.mapBounds.height) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="battle-minimap-jumps">
            {battle.frontlineSegments.map((segment) => (
              <button
                key={segment.id}
                className={selectedFrontlineSegment?.id === segment.id ? "active" : ""}
                type="button"
                title={`${segment.name}へ移動`}
                onClick={() => {
                  setSelectedFrontlineSegmentId(segment.id);
                  scrollToPosition(segment.anchor);
                }}
              >
                {segment.name.slice(0, 2)}
              </button>
            ))}
          </div>
          <span className="battle-minimap-readout">
            視界 {Math.round(viewportRange.left)}-{Math.round(viewportRange.left + viewportRange.width)}%
            {minimapFocusPosition ? ` / ${mapCoordinateLabel(minimapFocusPosition)}` : ""}
          </span>
        </div>
        </div>
      </div>

      <div className="battle-hud">
        <div className="unit-command-list">
          {battle.playerUnits.map((unit) => (
            <article
              key={unit.unitId}
              className={unit.unitId === selectedUnit?.unitId ? "battle-unit-card selected" : "battle-unit-card"}
            >
              <div className="unit-card-heading">
                <h3>{unit.name}</h3>
                <button
                  className={unit.unitId === selectedUnit?.unitId ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setSelectedUnitId(unit.unitId);
                    scrollToPosition(unit.position);
                  }}
                >
                  選択
                </button>
              </div>
              <p>
                {unitTypeLabels[unit.type]} / 兵力 {Math.round(unit.soldiers)} / 士気{" "}
                {Math.round(unit.morale)} / 弾薬 {Math.round(unit.ammo)}
              </p>
              <p>
                {unit.weaponName} / 射程 {unit.range} 有効{Math.round(effectiveRangeForUnit(battle, unit))} / 目標 {targetName(battle, unit.currentTargetId)} / 損耗付与{" "}
                {unit.lastDamageDealt.toFixed(1)}
              </p>
              <p className="action-reason-line">行動: {battleActionReasonLabels[unit.actionReason]}</p>
              <p className="action-reason-detail">{actionReasonDetail(battle, unit)}</p>
              <div className="standing-order-panel">
                <span className={unit.pendingOrder ? "pending-order-chip active" : "pending-order-chip"}>
                  {commandTransmissionLabel(battle, unit)}
                </span>
                <span>戦線 {segmentName(battle, unit.standingOrder.frontlineSegmentId)}</span>
                <span>地形 {terrainLabelForPosition(battle, unit.position)}</span>
                <span>射線 {lineOfSightLabelForUnit(battle, unit)}</span>
                <span>姿勢 {standingPostureLabels[unit.standingOrder.posture]}</span>
                <span>目標 {targetPriorityLabels[unit.standingOrder.targetPriority]}</span>
                <span>集中 {focusTargetName(battle, unit.focusTargetId)}</span>
                <span>火力 {fireMissionStatus(battle, unit)}</span>
                <span>指揮 {unit.officerName ?? "未任命"}</span>
                <span>指揮効果 {unit.officerCommandSummary ?? "なし"}</span>
                <span>{unit.tacticalLessonSummary ?? "戦術教訓なし"}</span>
                <span>師団 {unit.divisionCommandSummary ?? unit.divisionName ?? "未設定"}</span>
                <span>予備即応 {Math.round(unit.reserveReadiness ?? 0)}</span>
                <span>弾薬 {ammoPolicyLabels[unit.standingOrder.ammoPolicy]}</span>
                <span>戦列 {formationLabel(unit)}</span>
                <span>
                  後退 {unit.standingOrder.fallback.enabled ? `士気${unit.standingOrder.fallback.moraleBelow ?? "-"}以下` : "禁止"}
                </span>
                <span>施設 {facilityLabel(battle, unit)}</span>
              </div>
              {unit.unitId === selectedUnit?.unitId && (
                <>
                  <div className="button-row compact">
                    {battle.frontlineSegments.map((segment) => (
                      <button
                        key={segment.id}
                        className={unit.standingOrder.frontlineSegmentId === segment.id ? "active" : ""}
                        type="button"
                        onClick={() => onChange(assignFrontlineSegment(battle, unit.unitId, segment.id))}
                      >
                        {segment.name}
                      </button>
                    ))}
                  </div>
                  {battle.structures.length > 0 && (
                    <div className="button-row compact">
                      {battle.structures.map((structure) => {
                        const mode = facilityModeForUnit(unit, structure);
                        return (
                          <button
                            key={structure.id}
                            className={unit.standingOrder.facilityAssignment?.structureId === structure.id ? "active" : ""}
                            type="button"
                            onClick={() => onChange(assignFacilityToUnit(battle, unit.unitId, structure.id, mode))}
                          >
                            {fortificationTypeLabels[structure.type]}:{facilityAssignmentModeLabels[mode]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="button-row">
                    {orders.map((order) => (
                      <button
                        key={order}
                        className={unit.order === order ? "active" : ""}
                        type="button"
                        onClick={() => onChange(setUnitOrder(battle, unit.unitId, order))}
                      >
                        {unitOrderLabels[order]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
        <div className="battle-log">
          {battle.log.map((entry, index) => (
            <p key={`${index}-${entry}`}>{entry}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
