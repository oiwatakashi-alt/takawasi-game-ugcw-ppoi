import { useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { assetRegistry } from "../../assets/manifest";
import { divisionCommandProfile, divisionForUnit } from "../../game/army/divisions";
import { commandDutyLoadByOfficer, commandDutyProfileForOfficer } from "../../game/army/commandDuty";
import { armyHeadquartersProfile } from "../../game/army/headquarters";
import {
  adjustFrontlineSegmentGeometry,
  applyFrontlineGeometryAdjustment,
  createFrontlineSegmentsForSector,
  defaultBattleMapBounds,
  defaultFrontlineGeometryAdjustment,
  deploymentDepthDescription,
  deploymentDepthLabel,
  deploymentLimitStyleSummary,
  frontlineGeometryCustomCount,
  frontlineGeometryDisplayLabel,
  frontlineGeometryPresetById,
  frontlineGeometryPresets,
  frontlineProfileLabel,
  resetFrontlineSegmentGeometry,
} from "../../game/battle/frontlineDefaults";
import {
  assessFrontlineGeometryTerrain,
  assessFrontlineTerrain,
  createFrontlineTerrainMitigationAdvisory,
} from "../../game/battle/frontlineTerrainAssessment";
import {
  defaultFormationFacingForSegment,
  formationFacingDisplayLabel,
  formationFacingOptions,
  normalizeFormationFacingDeg,
} from "../../game/battle/formations";
import { standingOrderPresets } from "../../game/battle/orders";
import { frontlineDoctrinePresets } from "../../game/battle/orders";
import {
  alignStandingOrderToFrontlineSegments,
  createDeploymentStandingOrderDraft,
  snapStandingOrderToFrontlineSegment,
} from "../../game/battle/standingOrderDrafts";
import { createTerrainZonesForBattle } from "../../game/battle/terrainEffects";
import { createBattleWaveIntel } from "../../game/battle/waveIntel";
import {
  compactSketchPoints,
  maxFrontlineSketchPoints,
  svgPolylinePoints,
  svgSmoothSketchPath,
} from "../../game/battle/sketchLines";
import type {
  AmmoPolicy,
  BattlePosition,
  BattleWaveTimelineEntry,
  FrontlineSegment,
  FrontlineGeometryAdjustment,
  FrontlineGeometryPreset,
  StandingOrder,
  TargetPriority,
} from "../../game/battle/types";
import {
  defaultReserveDoctrinePlan,
  reserveDoctrineLabels,
  reserveDoctrinePlans,
} from "../../game/campaign/deploymentPlan";
import { tacticalLessonProfileForUnit } from "../../game/campaign/tacticalLessons";
import type {
  CampaignState,
  ReserveDoctrineMode,
  ReserveDoctrinePlan,
  StandingOrderPlanSet,
  StandingOrderPlanSetEntry,
} from "../../game/campaign/types";
import { strategicDoctrineFromDoctrine } from "../../game/doctrine/applyDoctrine";
import { officerCommandProfile, officerCommandSummary } from "../../game/officers/effects";
import {
  enemyCompositionBrief,
  enemyCompositionIntelForOperation,
  enemyThreatRangeLabel,
} from "../../game/theater/enemyIntel";
import type { OperationSpoilsIntel } from "../../game/theater/types";
import {
  ammoPolicyLabels,
  facilityAssignmentModeLabels,
  formatTerrainTags,
  fortificationStatusLabels,
  fortificationTypeLabels,
  standingPostureLabels,
  targetPriorityLabels,
  unitTypeLabels,
  weaponLabels,
} from "../shared/labels";
import { EnemyIntelPanel } from "../shared/EnemyIntelPanel";

interface DeploymentScreenProps {
  campaign: CampaignState;
  onBackToCamp: () => void;
  onOpenOfficerManagement: () => void;
  onStartBattle: (
    unitIds: string[],
    frontlineGeometry?: FrontlineGeometryAdjustment,
    reserveDoctrine?: ReserveDoctrinePlan,
    reserveUnitIds?: string[],
    rearGuardUnitIds?: string[],
  ) => void;
  onSaveStandingOrderTemplate: (unitId: string, standingOrder: StandingOrder, description?: string) => void;
  onSaveStandingOrderPlanSet: (
    operationId: string,
    sectorId: string,
    frontlineGeometry: FrontlineGeometryAdjustment,
    reserveDoctrine: ReserveDoctrinePlan | undefined,
    reserveUnitIds: string[],
    rearGuardUnitIds: string[],
    entries: StandingOrderPlanSetEntry[],
  ) => void;
  onOverwriteStandingOrderPlanSet: (
    planSetId: string,
    operationId: string,
    sectorId: string,
    frontlineGeometry: FrontlineGeometryAdjustment,
    reserveDoctrine: ReserveDoctrinePlan | undefined,
    reserveUnitIds: string[],
    rearGuardUnitIds: string[],
    entries: StandingOrderPlanSetEntry[],
  ) => void;
  onRenameStandingOrderPlanSet: (planSetId: string, nextName: string) => void;
  onDeleteStandingOrderPlanSet: (planSetId: string) => void;
  onSaveDeploymentPlan: (
    operationId: string,
    sectorId: string,
    frontlineGeometry: FrontlineGeometryAdjustment,
    reserveDoctrine?: ReserveDoctrinePlan,
    reserveUnitIds?: string[],
    rearGuardUnitIds?: string[],
  ) => void;
}

const baseDeploymentLimit = 6;
const targetPriorities: TargetPriority[] = ["nearest", "brute", "officer", "riflemen", "largest_mass", "weakest"];
const ammoPolicies: AmmoPolicy[] = ["normal", "conserve", "intense"];
const reserveDoctrineModes: ReserveDoctrineMode[] = [
  "balanced",
  "prepared_counterstroke",
  "elastic_reserve",
  "fire_support_pool",
];

const confidenceLabels: Record<OperationSpoilsIntel["confidence"], string> = {
  low: "信頼低",
  medium: "信頼中",
  high: "信頼高",
};

const reconEffectLabels: Record<NonNullable<OperationSpoilsIntel["reconEffect"]>, string> = {
  precise: "精密照合",
  confirmed: "照合済み",
  partial: "部分照合",
  misleading: "誤情報疑い",
};

const timelineCertaintyLabels: Record<BattleWaveTimelineEntry["intelCertainty"], string> = {
  vague: "偵察不足",
  estimated: "推定",
  confirmed: "確定",
  misleading: "誤情報疑い",
};

type RearGuardAdviceTone = "recommended" | "caution" | "danger";

interface RearGuardAdvice {
  unitId: string;
  unitName: string;
  tone: RearGuardAdviceTone;
  toneLabel: string;
  suitability: number;
  recommendationScore: number;
  pursuitCover: number;
  preservationScore: number;
  estimatedCasualties: number;
  officerRisk: number;
  reason: string;
  tradeoffLabel: string;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const rearGuardToneLabel: Record<RearGuardAdviceTone, string> = {
  recommended: "推奨",
  caution: "注意",
  danger: "危険",
};

const rearGuardRiskPressureLabel = (estimatedCasualties: number, maxSoldiers: number): RearGuardAdviceTone => {
  const casualtyRatio = maxSoldiers > 0 ? estimatedCasualties / maxSoldiers : 0;
  if (casualtyRatio >= 0.026 || estimatedCasualties >= 18) {
    return "danger";
  }
  if (casualtyRatio >= 0.015 || estimatedCasualties >= 9) {
    return "caution";
  }
  return "recommended";
};

const rearGuardTradeoffLabel = (pursuitCover: number, preservationScore: number, officerRisk: number): string => {
  if (pursuitCover >= 72 && officerRisk >= 50) {
    return "追撃抑止高・将校危険";
  }
  if (pursuitCover >= 70 && preservationScore >= 55) {
    return "均衡候補";
  }
  if (preservationScore >= 68) {
    return "将校温存寄り";
  }
  if (pursuitCover >= 62) {
    return "追撃抑止寄り";
  }
  return "限定投入";
};

const describeOperationSpoils = (operation: CampaignState["activeStrategicTurn"]["mandatoryBattle"]) => {
  const intel = operation.spoilsIntel;
  const entries = Object.entries(operation.spoilsIntel?.expectedWeapons ?? {})
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => {
      const range = intel?.expectedWeaponRange?.[key];
      return `${weaponLabels[key] ?? key} ${range ? `${range.min}-${range.max}` : amount}`;
    });
  const cache = intel?.supplyCache;
  if (cache?.ammunition) {
    const range = intel?.supplyCacheRange?.ammunition;
    entries.push(`弾薬箱 ${range ? `${range.min}-${range.max}` : cache.ammunition}`);
  }
  if (cache?.supplies) {
    const range = intel?.supplyCacheRange?.supplies;
    entries.push(`補給箱 ${range ? `${range.min}-${range.max}` : cache.supplies}`);
  }
  if (cache?.materials) {
    const range = intel?.supplyCacheRange?.materials;
    entries.push(`資材 ${range ? `${range.min}-${range.max}` : cache.materials}`);
  }
  if (intel) entries.unshift(confidenceLabels[intel.confidence]);
  if (intel?.reconQualityScore) entries.push(`偵察${intel.reconQualityScore}`);
  if (intel?.reconEffect) entries.push(reconEffectLabels[intel.reconEffect]);
  if ((intel?.recoveryMultiplier ?? 1) > 1) entries.push(`回収効率 x${intel?.recoveryMultiplier?.toFixed(2)}`);
  if ((intel?.recoveryMultiplier ?? 1) < 1) entries.push(`回収不確実 x${intel?.recoveryMultiplier?.toFixed(2)}`);
  return entries.length > 0 ? entries.join(" / ") : "不明";
};

const previewSegmentStyle = (segment: ReturnType<typeof createFrontlineSegmentsForSector>[number]): CSSProperties => ({
  left: `${(segment.zone.x / defaultBattleMapBounds.width) * 100}%`,
  top: `${(segment.zone.y / defaultBattleMapBounds.height) * 100}%`,
  width: `${(segment.zone.width / defaultBattleMapBounds.width) * 100}%`,
  height: `${(segment.zone.height / defaultBattleMapBounds.height) * 100}%`,
});

const previewDeploymentLimitStyle = (segment: ReturnType<typeof createFrontlineSegmentsForSector>[number]): CSSProperties => {
  const zone = segment.deploymentLimit?.zone ?? segment.zone;
  return {
    left: `${(zone.x / defaultBattleMapBounds.width) * 100}%`,
    top: `${(zone.y / defaultBattleMapBounds.height) * 100}%`,
    width: `${(zone.width / defaultBattleMapBounds.width) * 100}%`,
    height: `${(zone.height / defaultBattleMapBounds.height) * 100}%`,
  };
};

export function DeploymentScreen({
  campaign,
  onBackToCamp,
  onOpenOfficerManagement,
  onStartBattle,
  onSaveStandingOrderTemplate,
  onSaveStandingOrderPlanSet,
  onOverwriteStandingOrderPlanSet,
  onRenameStandingOrderPlanSet,
  onDeleteStandingOrderPlanSet,
  onSaveDeploymentPlan,
}: DeploymentScreenProps) {
  const operation = campaign.theater.mandatoryBattle ?? campaign.activeStrategicTurn.mandatoryBattle;
  const sector = campaign.theater.sectors.find((candidate) => candidate.id === operation.sectorId);
  const assignedSideUnits = new Set(
    campaign.activeStrategicTurn.sideOperations.flatMap((sideOperation) =>
      sideOperation.resolved ? sideOperation.assignedForces.unitIds : [],
    ),
  );
  const deployableUnits = campaign.army.units.filter((unit) => !assignedSideUnits.has(unit.id));
  const strategicDoctrine = strategicDoctrineFromDoctrine(campaign.doctrines);
  const headquartersProfile = armyHeadquartersProfile(campaign.army, campaign.officers);
  const commandDutyLoads = commandDutyLoadByOfficer(campaign.army);
  const deploymentLimit = baseDeploymentLimit + strategicDoctrine.deploymentSlotBonus + headquartersProfile.deploymentSlotBonus;
  const savedGeometry =
    campaign.deploymentPlan?.operationId === operation.id && campaign.deploymentPlan.sectorId === operation.sectorId
      ? campaign.deploymentPlan.frontlineGeometry
      : defaultFrontlineGeometryAdjustment;
  const [frontlineGeometry, setFrontlineGeometry] = useState<FrontlineGeometryAdjustment>(savedGeometry);
  const savedReserveDoctrine =
    campaign.deploymentPlan?.operationId === operation.id && campaign.deploymentPlan.sectorId === operation.sectorId
      ? campaign.deploymentPlan.reserveDoctrine ?? defaultReserveDoctrinePlan
      : defaultReserveDoctrinePlan;
  const [reserveDoctrine, setReserveDoctrine] = useState<ReserveDoctrinePlan>(savedReserveDoctrine);
  const baseFrontlineSegments = useMemo(() => createFrontlineSegmentsForSector(sector), [sector]);
  const frontlineSegments = useMemo(
    () => applyFrontlineGeometryAdjustment(baseFrontlineSegments, frontlineGeometry),
    [baseFrontlineSegments, frontlineGeometry],
  );
  const frontlineTerrainZones = useMemo(
    () => createTerrainZonesForBattle(sector?.terrainTags ?? [], frontlineSegments),
    [frontlineSegments, sector?.terrainTags],
  );
  const frontlineTerrainAssessments = useMemo(
    () =>
      new Map(
        frontlineSegments.map((segment) => [
          segment.id,
          assessFrontlineTerrain(segment, frontlineTerrainZones, sector?.structures ?? []),
        ]),
      ),
    [frontlineSegments, frontlineTerrainZones, sector?.structures],
  );
  const frontlineGeometryTerrainAssessments = useMemo(
    () =>
      new Map(
        frontlineGeometryPresets.map((preset) => {
          const presetSegments = applyFrontlineGeometryAdjustment(
            baseFrontlineSegments,
            frontlineGeometryPresetById(preset.preset),
          );
          const presetTerrainZones = createTerrainZonesForBattle(sector?.terrainTags ?? [], presetSegments);
          return [
            preset.preset,
            assessFrontlineGeometryTerrain(presetSegments, presetTerrainZones, sector?.structures ?? []),
          ];
        }),
      ),
    [baseFrontlineSegments, sector?.structures, sector?.terrainTags],
  );
  const recommendedFrontlineGeometryPreset = useMemo(
    () =>
      [...frontlineGeometryTerrainAssessments.entries()].sort(
        (a, b) =>
          b[1].averageScore - a[1].averageScore ||
          b[1].weakestScore - a[1].weakestScore ||
          a[1].mobilityRisk - b[1].mobilityRisk,
      )[0]?.[0] ?? defaultFrontlineGeometryAdjustment.preset,
    [frontlineGeometryTerrainAssessments],
  );
  const defaultSelection = useMemo(
    () => deployableUnits.slice(0, deploymentLimit).map((unit) => unit.id),
    [deployableUnits, deploymentLimit],
  );
  const [selectedUnitIds, setSelectedUnitIds] = useState(defaultSelection);
  const savedReserveUnitIds =
    campaign.deploymentPlan?.operationId === operation.id && campaign.deploymentPlan.sectorId === operation.sectorId
      ? campaign.deploymentPlan.reserveUnitIds ?? []
      : [];
  const [reserveUnitIds, setReserveUnitIds] = useState(() =>
    savedReserveUnitIds.filter((unitId) => defaultSelection.includes(unitId)),
  );
  const savedRearGuardUnitIds =
    campaign.deploymentPlan?.operationId === operation.id && campaign.deploymentPlan.sectorId === operation.sectorId
      ? campaign.deploymentPlan.rearGuardUnitIds ?? []
      : [];
  const [rearGuardUnitIds, setRearGuardUnitIds] = useState(() =>
    savedRearGuardUnitIds.filter((unitId) => defaultSelection.includes(unitId)),
  );
  const [plannerUnitId, setPlannerUnitId] = useState(defaultSelection[0] ?? "");
  const [draftOrders, setDraftOrders] = useState<Record<string, StandingOrder>>({});
  const [mitigationApplicationMessage, setMitigationApplicationMessage] = useState("");
  const [inspectedPlanSetId, setInspectedPlanSetId] = useState("");
  const [renamingPlanSetId, setRenamingPlanSetId] = useState("");
  const [planSetRenameDraft, setPlanSetRenameDraft] = useState("");
  const [deploymentSketchMode, setDeploymentSketchMode] = useState(false);
  const [deploymentSketchDraftPoints, setDeploymentSketchDraftPoints] = useState<BattlePosition[]>([]);
  const [deploymentSketchDragActive, setDeploymentSketchDragActive] = useState(false);
  const deploymentSketchWasDraggedRef = useRef(false);
  const selectedUnits = deployableUnits.filter((unit) => selectedUnitIds.includes(unit.id));
  const reserveUnits = deployableUnits.filter((unit) => !selectedUnitIds.includes(unit.id));
  const reserveUnitIdSet = new Set(reserveUnitIds);
  const reserveSlotLimit = Math.max(1, Math.min(3, Math.floor(Math.max(1, selectedUnitIds.length) / 2)));
  const rearGuardUnitIdSet = new Set(rearGuardUnitIds);
  const rearGuardSlotLimit = Math.max(1, Math.min(3, reserveSlotLimit));
  const templateUnitIds = new Set(
    campaign.standingOrderTemplates.map((template) => template.createdFromUnitId).filter(Boolean),
  );
  const plannerUnit = selectedUnits.find((unit) => unit.id === plannerUnitId) ?? selectedUnits[0];
  const divisionSummaryForUnit = (unitId: string): string => {
    const division = divisionForUnit(campaign.army, unitId);
    return divisionCommandProfile(division, campaign.officers)?.summary ?? "師団未設定";
  };
  const plannerUnitIndex = Math.max(
    0,
    selectedUnits.findIndex((unit) => unit.id === plannerUnit?.id),
  );
  const plannerSavedTemplate = plannerUnit
    ? campaign.standingOrderTemplates.find((template) => template.createdFromUnitId === plannerUnit.id)
    : undefined;
  const plannerOrder = plannerUnit
    ? draftOrders[plannerUnit.id] ??
      createDeploymentStandingOrderDraft(plannerUnit, plannerUnitIndex, plannerSavedTemplate, frontlineSegments)
    : undefined;
  const deploymentCommandProfiles = useMemo(
    () =>
      new Map(
        selectedUnits.map((unit) => {
          const officer = campaign.officers.find((candidate) => candidate.id === unit.officerId);
          return [
            unit.id,
            officerCommandProfile(
              officer,
              unit.type,
              unit.soldiers,
              headquartersProfile.commandCapacityBonus,
              officer ? commandDutyLoads[officer.id] ?? 0 : 0,
              officer ? commandDutyProfileForOfficer(campaign.army, officer.id).summary : undefined,
            ),
          ];
        }),
      ),
    [campaign.army, campaign.officers, commandDutyLoads, headquartersProfile.commandCapacityBonus, selectedUnits],
  );
  const commandCapacityReport = useMemo(() => {
    const profiles = selectedUnits
      .map((unit) => ({ unit, profile: deploymentCommandProfiles.get(unit.id) }))
      .filter((entry) => entry.profile);
    const overloaded = profiles.filter((entry) => (entry.profile?.commandOverload ?? 0) > 0);
    const maxOverload = overloaded.reduce((max, entry) => Math.max(max, entry.profile?.commandOverload ?? 0), 0);
    const uncovered = selectedUnits.length - profiles.length;
    return {
      overloaded,
      maxOverload,
      uncovered,
      summary:
        overloaded.length > 0
          ? `過負荷 ${overloaded.length}旅団 / 最大${maxOverload}`
          : uncovered > 0
            ? `未任命 ${uncovered}旅団`
            : "全旅団 指揮容量内",
    };
  }, [deploymentCommandProfiles, selectedUnits]);
  const plannerOfficerProfile = plannerUnit ? deploymentCommandProfiles.get(plannerUnit.id) : undefined;
  const plannerTacticalLessonProfile = plannerUnit ? tacticalLessonProfileForUnit(plannerUnit) : undefined;
  const plannerLessonDoctrine = plannerTacticalLessonProfile?.preferredDoctrineId
    ? frontlineDoctrinePresets.find((preset) => preset.id === plannerTacticalLessonProfile.preferredDoctrineId)
    : undefined;
  const plannerHasActionableLesson = Boolean(
    (plannerTacticalLessonProfile?.advisoryCount ?? 0) > 0 ||
      (plannerTacticalLessonProfile?.enemyCommandActionCount ?? 0) > 0 ||
      (plannerTacticalLessonProfile?.objectiveEventResponseCount ?? 0) > 0 ||
      (plannerTacticalLessonProfile?.facilityDutyCount ?? 0) > 0,
  );
  const activeSegment = plannerOrder
    ? frontlineSegments.find((segment) => segment.id === plannerOrder.frontlineSegmentId)
    : undefined;
  const activeSegmentSketchLine = activeSegment?.sketchPoints ?? frontlineGeometry.sketchLines?.[activeSegment?.id ?? ""];
  const plannerSavedOrder =
    plannerUnit && plannerSavedTemplate
      ? createDeploymentStandingOrderDraft(plannerUnit, plannerUnitIndex, plannerSavedTemplate, frontlineSegments)
      : undefined;
  const plannerSavedSegment = plannerSavedOrder
    ? frontlineSegments.find((segment) => segment.id === plannerSavedOrder.frontlineSegmentId)
    : undefined;
  const assignedFacility = plannerOrder?.facilityAssignment
    ? sector?.structures.find((structure) => structure.id === plannerOrder.facilityAssignment?.structureId)
      : undefined;
  const plannerSavedFacility = plannerSavedOrder?.facilityAssignment
    ? sector?.structures.find((structure) => structure.id === plannerSavedOrder.facilityAssignment?.structureId)
    : undefined;
  const orderSummaryChips = (standingOrder: StandingOrder, segmentName?: string, facilityName?: string): string[] => [
    `戦線 ${segmentName ?? standingOrder.frontlineSegmentId}`,
    `基準 X${Math.round(standingOrder.anchor.x)} Y${Math.round(standingOrder.anchor.y)}`,
    `後退 ${
      standingOrder.fallback.enabled
        ? `士気${standingOrder.fallback.moraleBelow ?? "-"} / X${Math.round(standingOrder.fallback.destination.x)} Y${Math.round(
            standingOrder.fallback.destination.y,
          )}`
        : "なし"
    }`,
    `姿勢 ${standingPostureLabels[standingOrder.posture]}`,
    `優先 ${targetPriorityLabels[standingOrder.targetPriority]}`,
    `弾薬 ${ammoPolicyLabels[standingOrder.ammoPolicy]}`,
    `射界 ${formationFacingDisplayLabel(standingOrder.facingDeg)}`,
    `半径 ${Math.round(standingOrder.controlRadius)}`,
    `施設 ${
      standingOrder.facilityAssignment && facilityName
        ? `${facilityName} ${facilityAssignmentModeLabels[standingOrder.facilityAssignment.mode]}`
        : "未指定"
      }`,
  ];
  const sketchShapeSummary = (points?: { x: number; y: number }[]): string | undefined => {
    if (!points || points.length < 2) {
      return undefined;
    }
    const labels = points.slice(0, 3).map((point) => `X${Math.round(point.x)} Y${Math.round(point.y)}`);
    const suffix = points.length > 3 ? ` -> 他${points.length - 3}点` : "";
    return `戦線形状 ${points.length}点 / ${labels.join(" -> ")}${suffix}`;
  };
  const savedSketchLinesForSelectedUnits = (): FrontlineGeometryAdjustment["sketchLines"] => {
    const sketchLines: NonNullable<FrontlineGeometryAdjustment["sketchLines"]> = {};
    selectedUnits.forEach((unit) => {
      const template = campaign.standingOrderTemplates.find((candidate) => candidate.createdFromUnitId === unit.id);
      const segmentId = template?.standingOrder.frontlineSegmentId;
      if (!segmentId || !template.frontlineSketchPoints || template.frontlineSketchPoints.length < 2 || sketchLines[segmentId]) {
        return;
      }
      sketchLines[segmentId] = template.frontlineSketchPoints.map((point) => ({ ...point }));
    });
    return Object.keys(sketchLines).length > 0 ? sketchLines : undefined;
  };
  const frontlineGeometryWithSavedSketchLines = (): FrontlineGeometryAdjustment => {
    const sketchLines = savedSketchLinesForSelectedUnits();
    return {
      ...frontlineGeometry,
      sketchLines:
        sketchLines || frontlineGeometry.sketchLines
          ? {
              ...(frontlineGeometry.sketchLines ?? {}),
              ...(sketchLines ?? {}),
            }
          : undefined,
    };
  };
  const savedTemplateDiffs =
    plannerOrder && plannerSavedOrder
      ? [
          plannerOrder.frontlineSegmentId !== plannerSavedOrder.frontlineSegmentId ? "担当戦線" : "",
          Math.round(plannerOrder.anchor.x) !== Math.round(plannerSavedOrder.anchor.x) ||
          Math.round(plannerOrder.anchor.y) !== Math.round(plannerSavedOrder.anchor.y)
            ? "基準位置"
            : "",
          plannerOrder.posture !== plannerSavedOrder.posture ? "姿勢" : "",
          plannerOrder.targetPriority !== plannerSavedOrder.targetPriority ? "優先目標" : "",
          plannerOrder.ammoPolicy !== plannerSavedOrder.ammoPolicy ? "弾薬方針" : "",
          plannerOrder.fallback.enabled !== plannerSavedOrder.fallback.enabled ||
          plannerOrder.fallback.moraleBelow !== plannerSavedOrder.fallback.moraleBelow ||
          Math.round(plannerOrder.fallback.destination.x) !== Math.round(plannerSavedOrder.fallback.destination.x) ||
          Math.round(plannerOrder.fallback.destination.y) !== Math.round(plannerSavedOrder.fallback.destination.y)
            ? "後退線"
            : "",
          plannerOrder.facilityAssignment?.structureId !== plannerSavedOrder.facilityAssignment?.structureId ||
          plannerOrder.facilityAssignment?.mode !== plannerSavedOrder.facilityAssignment?.mode
            ? "施設担当"
            : "",
        ].filter(Boolean)
      : [];
  const frontlineGeometryLabel = frontlineGeometryDisplayLabel(frontlineGeometry);
  const activeSegmentOverride = activeSegment ? frontlineGeometry.segmentOverrides?.[activeSegment.id] : undefined;
  const activeSegmentHasManualAdjustment = Boolean(activeSegmentOverride);
  const activeDeploymentLimit = activeSegment?.deploymentLimit;
  const planSetOrderDiffs = (currentOrder: StandingOrder | undefined, savedOrder: StandingOrder): string[] => {
    if (!currentOrder) {
      return ["現行ドラフトなし"];
    }
    return [
      currentOrder.frontlineSegmentId !== savedOrder.frontlineSegmentId ? "担当戦線" : "",
      Math.round(currentOrder.anchor.x) !== Math.round(savedOrder.anchor.x) ||
      Math.round(currentOrder.anchor.y) !== Math.round(savedOrder.anchor.y)
        ? "基準位置"
        : "",
      currentOrder.posture !== savedOrder.posture ? "姿勢" : "",
      currentOrder.targetPriority !== savedOrder.targetPriority ? "優先目標" : "",
      currentOrder.ammoPolicy !== savedOrder.ammoPolicy ? "弾薬方針" : "",
      currentOrder.fallback.enabled !== savedOrder.fallback.enabled ||
      currentOrder.fallback.moraleBelow !== savedOrder.fallback.moraleBelow ||
      Math.round(currentOrder.fallback.destination.x) !== Math.round(savedOrder.fallback.destination.x) ||
      Math.round(currentOrder.fallback.destination.y) !== Math.round(savedOrder.fallback.destination.y)
        ? "後退線"
        : "",
      currentOrder.controlRadius !== savedOrder.controlRadius ? "統制半径" : "",
      currentOrder.facilityAssignment?.structureId !== savedOrder.facilityAssignment?.structureId ||
      currentOrder.facilityAssignment?.mode !== savedOrder.facilityAssignment?.mode
        ? "施設担当"
        : "",
      normalizeFormationFacingDeg(currentOrder.facingDeg) !== normalizeFormationFacingDeg(savedOrder.facingDeg)
        ? "射界"
        : "",
    ].filter(Boolean);
  };
  const activeDeploymentLimitSummary = activeSegment ? deploymentLimitStyleSummary(activeSegment) : "-";
  const activeTerrainAssessment = activeSegment ? frontlineTerrainAssessments.get(activeSegment.id) : undefined;
  const activeGeometryTerrainAssessment = frontlineGeometryTerrainAssessments.get(frontlineGeometry.preset);
  const recommendedFrontlineGeometry = frontlineGeometryPresetById(recommendedFrontlineGeometryPreset);
  const recommendedGeometryTerrainAssessment = frontlineGeometryTerrainAssessments.get(recommendedFrontlineGeometryPreset);
  const terrainMitigationAdvisory =
    activeGeometryTerrainAssessment && recommendedGeometryTerrainAssessment
      ? createFrontlineTerrainMitigationAdvisory(
          frontlineSegments,
          [...frontlineTerrainAssessments.values()],
          activeGeometryTerrainAssessment,
          recommendedGeometryTerrainAssessment,
          frontlineGeometry.label,
          recommendedFrontlineGeometry.label,
        )
      : undefined;
  const enemyCompositionContext = {
    terrainTags: sector?.terrainTags ?? [],
    enemyPressure: sector?.enemyPressure ?? 0,
    risk: operation.risk,
    structureCount: sector?.structures.length ?? 0,
  };
  const enemyCompositionIntel = enemyCompositionIntelForOperation(operation, enemyCompositionContext);
  const enemyCompositionSummary = `${enemyCompositionBrief(operation, enemyCompositionContext)} / ${enemyThreatRangeLabel(
    enemyCompositionIntel,
  )}`;
  const battleWaveIntel = createBattleWaveIntel({
    operation,
    terrainTags: enemyCompositionContext.terrainTags,
    enemyPressure: enemyCompositionContext.enemyPressure,
    structureCount: enemyCompositionContext.structureCount,
  });
  const rearGuardAdvice = useMemo(() => {
    const operationRisk = operation.risk <= 1 ? operation.risk * 100 : operation.risk;
    const pursuitPressure = clamp(
      18 + operationRisk * 0.18 + (sector?.enemyPressure ?? 0) * 0.24 + battleWaveIntel.actualCommandWaveChance * 0.08,
      12,
      62,
    );
    const advice = selectedUnits.map<RearGuardAdvice>((unit, index) => {
      const savedTemplate = campaign.standingOrderTemplates.find((template) => template.createdFromUnitId === unit.id);
      const order =
        draftOrders[unit.id] ?? createDeploymentStandingOrderDraft(unit, index, savedTemplate, frontlineSegments);
      const profile = deploymentCommandProfiles.get(unit.id);
      const isReserve = reserveUnitIdSet.has(unit.id);
      const isPlannedRearGuard = rearGuardUnitIdSet.has(unit.id);
      const reserveLine = order.frontlineSegmentId?.includes("reserve") ?? false;
      const fallbackGuard = order.posture === "fallback_guard";
      const fireSupport = unit.type === "artillery" || order.posture === "fire_support";
      const engineerBurden = unit.type === "engineer" && order.facilityAssignment ? 7 : 0;
      const readiness =
        (isReserve ? 18 : 0) +
        (isPlannedRearGuard ? 22 : 0) +
        (reserveLine || fallbackGuard ? 16 : 0) +
        (profile?.reserveReadinessBonus ?? 0) +
        Math.min(14, unit.ammo * 0.12) +
        Math.min(12, unit.morale * 0.1);
      const roleFit = (fireSupport ? 15 : 0) + (unit.type === "infantry" ? 8 : 0) + (unit.type === "jaeger" ? 5 : 0);
      const overloadPenalty = Math.min(18, (profile?.commandOverload ?? 0) / 10);
      const suitability = clamp(Math.round(34 + readiness + roleFit - overloadPenalty - engineerBurden), 0, 100);
      const exposure = fireSupport ? 0.34 : fallbackGuard || isPlannedRearGuard ? 0.46 : 0.4;
      const scaleCost = Math.max(7, unit.maxSoldiers * 0.016);
      const estimatedCasualties = Math.max(
        1,
        Math.min(
          Math.max(1, Math.round(unit.maxSoldiers * 0.05)),
          Math.round(scaleCost + pursuitPressure * exposure + Math.max(0, 60 - suitability) * 0.11 - readiness * 0.035),
        ),
      );
      const casualtyRatio = unit.maxSoldiers > 0 ? estimatedCasualties / unit.maxSoldiers : 0;
      const rearGuardRiskTone = rearGuardRiskPressureLabel(estimatedCasualties, unit.maxSoldiers);
      const officerRisk = clamp(
        Math.round(
          casualtyRatio * 420 +
            14 +
            (rearGuardRiskTone === "danger" ? 18 : rearGuardRiskTone === "caution" ? 10 : 4) +
            (profile?.commandOverload ?? 0) / 14,
        ),
        0,
        100,
      );
      const pursuitCover = clamp(
        Math.round(
          suitability * 0.48 +
            (fireSupport ? 20 : 0) +
            (isReserve || reserveLine ? 10 : 0) +
            (fallbackGuard || isPlannedRearGuard ? 10 : 0) +
            battleWaveIntel.actualCommandWaveChance * 0.12 -
            estimatedCasualties * 0.36,
        ),
        0,
        100,
      );
      const preservationScore = clamp(
        Math.round(100 - officerRisk - casualtyRatio * 160 - Math.max(0, estimatedCasualties - 10) * 0.7),
        0,
        100,
      );
      const recommendationScore = clamp(
        Math.round(suitability * 0.42 + pursuitCover * 0.34 + preservationScore * 0.3 - officerRisk * 0.18),
        0,
        100,
      );
      const tone: RearGuardAdviceTone =
        officerRisk >= 56 || rearGuardRiskTone === "danger"
          ? "danger"
          : officerRisk >= 38 || rearGuardRiskTone === "caution"
            ? "caution"
            : "recommended";
      const reasons = [
        isPlannedRearGuard ? "後衛指定済み" : undefined,
        isReserve || reserveLine ? "予備線適性" : undefined,
        fireSupport ? "火力支援可" : undefined,
        fallbackGuard ? "後退守備" : undefined,
        (profile?.commandOverload ?? 0) > 0 ? `指揮過負荷${profile?.commandOverload}` : undefined,
        engineerBurden > 0 ? "工兵任務あり" : undefined,
      ].filter(Boolean);
      return {
        unitId: unit.id,
        unitName: unit.name,
        tone,
        toneLabel: rearGuardToneLabel[tone],
        suitability,
        recommendationScore,
        pursuitCover,
        preservationScore,
        estimatedCasualties,
        officerRisk,
        reason: reasons.length > 0 ? reasons.join(" / ") : "通常戦線から抽出",
        tradeoffLabel: rearGuardTradeoffLabel(pursuitCover, preservationScore, officerRisk),
      };
    });
    return advice.sort((a, b) => b.recommendationScore - a.recommendationScore || b.suitability - a.suitability);
  }, [
    battleWaveIntel.actualCommandWaveChance,
    campaign.standingOrderTemplates,
    deploymentCommandProfiles,
    draftOrders,
    frontlineSegments,
    operation.risk,
    rearGuardUnitIdSet,
    reserveUnitIdSet,
    sector?.enemyPressure,
    selectedUnits,
  ]);
  const plannerRearGuardAdvice = plannerUnit ? rearGuardAdvice.find((entry) => entry.unitId === plannerUnit.id) : undefined;
  const recommendedRearGuardAdvice = rearGuardAdvice[0];

  const applyFrontlineGeometry = (nextGeometry: FrontlineGeometryAdjustment) => {
    const nextSegments = applyFrontlineGeometryAdjustment(baseFrontlineSegments, nextGeometry);
    setFrontlineGeometry(nextGeometry);
    setDraftOrders((current) => {
      const next: Record<string, StandingOrder> = {};
      for (const [unitId, standingOrder] of Object.entries(current)) {
        next[unitId] = snapStandingOrderToFrontlineSegment(standingOrder, nextSegments);
      }
      if (plannerUnit && plannerOrder) {
        next[plannerUnit.id] = snapStandingOrderToFrontlineSegment(plannerOrder, nextSegments);
      }
      return next;
    });
    onSaveDeploymentPlan(operation.id, operation.sectorId, nextGeometry, reserveDoctrine, reserveUnitIds, rearGuardUnitIds);
  };

  const applyReserveDoctrine = (mode: ReserveDoctrineMode) => {
    const nextDoctrine = reserveDoctrinePlans[mode];
    setReserveDoctrine(nextDoctrine);
    onSaveDeploymentPlan(operation.id, operation.sectorId, frontlineGeometry, nextDoctrine, reserveUnitIds, rearGuardUnitIds);
  };

  const applyFrontlinePreset = (preset: FrontlineGeometryPreset) => {
    applyFrontlineGeometry(frontlineGeometryPresetById(preset));
  };

  const adjustSegmentHandle = (
    segmentId: string,
    delta: Parameters<typeof adjustFrontlineSegmentGeometry>[2],
  ) => {
    applyFrontlineGeometry(adjustFrontlineSegmentGeometry(frontlineGeometry, segmentId, delta));
  };

  const resetSegmentHandle = (segmentId: string) => {
    applyFrontlineGeometry(resetFrontlineSegmentGeometry(frontlineGeometry, segmentId));
  };

  const clampSketchPoint = (point: BattlePosition): BattlePosition => ({
    x: Math.max(4, Math.min(defaultBattleMapBounds.width - 4, point.x)),
    y: Math.max(4, Math.min(defaultBattleMapBounds.height - 4, point.y)),
  });

  const pointFromPreviewEvent = (
    event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>,
  ): BattlePosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampSketchPoint({
      x: ((event.clientX - rect.left) / rect.width) * defaultBattleMapBounds.width,
      y: ((event.clientY - rect.top) / rect.height) * defaultBattleMapBounds.height,
    });
  };

  const simplifySketchPoints = (points: BattlePosition[]): BattlePosition[] => {
    const clamped = points.map(clampSketchPoint);
    return compactSketchPoints(clamped, maxFrontlineSketchPoints);
  };

  const appendDeploymentSketchDragPoint = (point: BattlePosition) => {
    setDeploymentSketchDraftPoints((current) => {
      const nextPoint = clampSketchPoint(point);
      const previousPoint = current[current.length - 1];
      if (previousPoint && Math.hypot(previousPoint.x - nextPoint.x, previousPoint.y - nextPoint.y) < 3.5) {
        return current;
      }
      const raw = [...current, nextPoint];
      return raw.length > maxFrontlineSketchPoints ? simplifySketchPoints(raw) : raw;
    });
  };

  const deploymentSketchPointsForSegment = (
    segment: FrontlineSegment,
    variant: "current" | "north" | "south",
  ): BattlePosition[] => {
    const lateralShift = variant === "north" ? -8 : variant === "south" ? 8 : 0;
    const widthPoint = {
      x: segment.zone.x + segment.zone.width * 0.84,
      y: segment.zone.y + segment.zone.height * 0.5 + lateralShift,
    };
    return [
      clampSketchPoint(segment.anchor),
      clampSketchPoint(segment.fallbackPoint),
      clampSketchPoint(widthPoint),
    ];
  };

  const applyDeploymentSketchPoints = (segmentId: string, points: BattlePosition[]) => {
    if (points.length < 2) {
      return;
    }
    const nextSketchLines = {
      ...(frontlineGeometry.sketchLines ?? {}),
      [segmentId]: simplifySketchPoints(points).map(clampSketchPoint),
    };
    applyFrontlineGeometry({
      ...frontlineGeometry,
      sketchLines: nextSketchLines,
    });
  };

  const applyDeploymentSketchLine = (
    segment: FrontlineSegment,
    variant: "current" | "north" | "south",
  ) => {
    applyDeploymentSketchPoints(segment.id, deploymentSketchPointsForSegment(segment, variant));
    setDeploymentSketchMode(false);
    setDeploymentSketchDraftPoints([]);
  };

  const clearDeploymentSketchLine = (segmentId: string) => {
    if (!frontlineGeometry.sketchLines?.[segmentId]) {
      return;
    }
    const { [segmentId]: _removed, ...remaining } = frontlineGeometry.sketchLines;
    applyFrontlineGeometry({
      ...frontlineGeometry,
      sketchLines: Object.keys(remaining).length > 0 ? remaining : undefined,
    });
    setDeploymentSketchMode(false);
    setDeploymentSketchDraftPoints([]);
  };

  const startDeploymentSketchMode = (points?: BattlePosition[]) => {
    setDeploymentSketchMode(true);
    setDeploymentSketchDraftPoints(simplifySketchPoints(points ?? []));
    setDeploymentSketchDragActive(false);
    deploymentSketchWasDraggedRef.current = false;
  };

  const cancelDeploymentSketchMode = () => {
    setDeploymentSketchMode(false);
    setDeploymentSketchDraftPoints([]);
    setDeploymentSketchDragActive(false);
    deploymentSketchWasDraggedRef.current = false;
  };

  const confirmDeploymentSketchLine = () => {
    if (!activeSegment || deploymentSketchDraftPoints.length < 2) {
      return;
    }
    applyDeploymentSketchPoints(activeSegment.id, deploymentSketchDraftPoints);
    cancelDeploymentSketchMode();
  };

  const undoDeploymentSketchPoint = () => {
    setDeploymentSketchDraftPoints((current) => current.slice(0, -1));
  };

  const handleDeploymentSketchPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!deploymentSketchMode || !activeSegment) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("button")) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    deploymentSketchWasDraggedRef.current = false;
    setDeploymentSketchDragActive(true);
    setDeploymentSketchDraftPoints([pointFromPreviewEvent(event)]);
  };

  const handleDeploymentSketchPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!deploymentSketchMode || !deploymentSketchDragActive || !activeSegment) {
      return;
    }
    event.preventDefault();
    deploymentSketchWasDraggedRef.current = true;
    appendDeploymentSketchDragPoint(pointFromPreviewEvent(event));
  };

  const finishDeploymentSketchPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!deploymentSketchDragActive) {
      return;
    }
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDeploymentSketchDraftPoints((current) => simplifySketchPoints(current));
    setDeploymentSketchDragActive(false);
  };

  const handleDeploymentPreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!deploymentSketchMode || !activeSegment) {
      return;
    }
    if (deploymentSketchWasDraggedRef.current) {
      deploymentSketchWasDraggedRef.current = false;
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("button")) {
      return;
    }
    const nextPoint = pointFromPreviewEvent(event);
    if (deploymentSketchDraftPoints.length >= maxFrontlineSketchPoints) {
      return;
    }
    setDeploymentSketchDraftPoints((current) => [...current, nextPoint].slice(0, maxFrontlineSketchPoints));
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds((current) => {
      let next = current;
      if (current.includes(unitId)) {
        next = current.filter((id) => id !== unitId);
        setReserveUnitIds((currentReserve) => {
          const nextReserve = currentReserve.filter((id) => id !== unitId);
          const nextRearGuard = rearGuardUnitIds.filter((id) => id !== unitId);
          setRearGuardUnitIds(nextRearGuard);
          onSaveDeploymentPlan(operation.id, operation.sectorId, frontlineGeometry, reserveDoctrine, nextReserve, nextRearGuard);
          return nextReserve;
        });
      } else if (current.length < deploymentLimit) {
        next = [...current, unitId];
      }
      setPlannerUnitId((currentPlanner) => (next.includes(currentPlanner) ? currentPlanner : next[0] ?? ""));
      return next;
    });
  };

  const toggleReserveDesignation = (unitId: string) => {
    if (!selectedUnitIds.includes(unitId)) {
      return;
    }
    setReserveUnitIds((current) => {
      const next = current.includes(unitId)
        ? current.filter((id) => id !== unitId)
        : current.length < reserveSlotLimit
          ? [...current, unitId]
          : current;
      onSaveDeploymentPlan(operation.id, operation.sectorId, frontlineGeometry, reserveDoctrine, next, rearGuardUnitIds);
      return next;
    });
  };

  const toggleRearGuardDesignation = (unitId: string) => {
    if (!selectedUnitIds.includes(unitId)) {
      return;
    }
    setRearGuardUnitIds((current) => {
      const next = current.includes(unitId)
        ? current.filter((id) => id !== unitId)
        : current.length < rearGuardSlotLimit
          ? [...current, unitId]
          : current;
      onSaveDeploymentPlan(operation.id, operation.sectorId, frontlineGeometry, reserveDoctrine, reserveUnitIds, next);
      return next;
    });
  };

  const assignRearGuardDesignation = (unitId: string) => {
    if (!selectedUnitIds.includes(unitId)) {
      return;
    }
    setPlannerUnitId(unitId);
    setRearGuardUnitIds((current) => {
      if (current.includes(unitId)) {
        return current;
      }
      const next = current.length < rearGuardSlotLimit ? [...current, unitId] : current;
      onSaveDeploymentPlan(operation.id, operation.sectorId, frontlineGeometry, reserveDoctrine, reserveUnitIds, next);
      return next;
    });
  };

  const updatePlannerOrder = (update: (standingOrder: StandingOrder) => StandingOrder) => {
    if (!plannerUnit || !plannerOrder) {
      return;
    }
    setDraftOrders((current) => ({
      ...current,
      [plannerUnit.id]: update(plannerOrder),
    }));
  };

  const orderForSelectedUnit = (unitId: string): StandingOrder | undefined => {
    const unit = selectedUnits.find((candidate) => candidate.id === unitId);
    if (!unit) {
      return undefined;
    }
    const index = Math.max(0, selectedUnits.findIndex((candidate) => candidate.id === unit.id));
    const savedTemplate = campaign.standingOrderTemplates.find((template) => template.createdFromUnitId === unit.id);
    return draftOrders[unit.id] ?? createDeploymentStandingOrderDraft(unit, index, savedTemplate, frontlineSegments);
  };

  const assignSegment = (segmentId: string) => {
    const segment = frontlineSegments.find((candidate) => candidate.id === segmentId);
    if (!segment) {
      return;
    }
    updatePlannerOrder((standingOrder) => ({
      ...standingOrder,
      anchor: { ...segment.anchor },
      controlRadius: segment.controlRadius,
      frontlineSegmentId: segment.id,
      facingDeg: defaultFormationFacingForSegment(segment.id, plannerUnit?.type),
      fallback: {
        ...standingOrder.fallback,
        destination: { ...segment.fallbackPoint },
      },
    }));
  };

  const applyTerrainMitigationToStandingOrders = () => {
    if (!terrainMitigationAdvisory) {
      return;
    }
    const focusSegment = frontlineSegments.find((segment) => segment.id === terrainMitigationAdvisory.focusSegmentId);
    if (!focusSegment) {
      return;
    }
    const focusAssessment = frontlineTerrainAssessments.get(focusSegment.id);
    const frontlineCandidates = selectedUnits.filter(
      (unit) => unit.type !== "artillery" && unit.type !== "engineer" && !reserveUnitIds.includes(unit.id),
    );
    const targetUnit =
      frontlineCandidates.find((unit) => orderForSelectedUnit(unit.id)?.frontlineSegmentId === focusSegment.id) ??
      (plannerUnit && frontlineCandidates.some((unit) => unit.id === plannerUnit.id) ? plannerUnit : undefined) ??
      frontlineCandidates[0] ??
      selectedUnits.find((unit) => !reserveUnitIds.includes(unit.id)) ??
      selectedUnits[0];
    if (!targetUnit) {
      return;
    }
    const baseOrder = orderForSelectedUnit(targetUnit.id);
    if (!baseOrder) {
      return;
    }
    const supportStructure = sector?.structures.find((structure) => structure.type === "supplyDepot") ??
      sector?.structures.find((structure) => structure.type === "trench" || structure.type === "barricade") ??
      sector?.structures[0];
    const needsSupport = (focusAssessment?.supportValue ?? 0) <= 1 || (focusAssessment?.coverValue ?? 0) <= 2;
    const fireOpportunity = (focusAssessment?.fireAdvantage ?? 0) >= (focusAssessment?.coverValue ?? 0) + 2;
    const cautiousFallback = (focusAssessment?.score ?? 100) <= 72 || (focusAssessment?.mobilityRisk ?? 0) >= 4;
    const targetOrder: StandingOrder = {
      ...baseOrder,
      anchor: { ...focusSegment.anchor },
      controlRadius: focusSegment.controlRadius,
      frontlineSegmentId: focusSegment.id,
      facingDeg: defaultFormationFacingForSegment(focusSegment.id, targetUnit.type),
      posture: fireOpportunity ? "aggressive_screen" : cautiousFallback || needsSupport ? "elastic_defense" : "hold_line",
      targetPriority: fireOpportunity ? "largest_mass" : needsSupport ? "brute" : "nearest",
      ammoPolicy: fireOpportunity && !cautiousFallback ? "intense" : "conserve",
      fallback: {
        ...baseOrder.fallback,
        enabled: true,
        moraleBelow: cautiousFallback || needsSupport ? 55 : 42,
        soldiersBelowRatio: cautiousFallback || needsSupport ? 0.72 : 0.58,
        ammoBelow: cautiousFallback || needsSupport ? 18 : 12,
        destination: { ...focusSegment.fallbackPoint },
      },
      facilityAssignment:
        needsSupport && supportStructure
          ? {
              structureId: supportStructure.id,
              mode: supportStructure.type === "supplyDepot" ? "resupply" : "defend",
            }
          : baseOrder.facilityAssignment,
    };

    const reserveCandidate = selectedUnits.find(
      (unit) => unit.id !== targetUnit.id && !reserveUnitIds.includes(unit.id) && unit.type !== "artillery",
    );
    const reserveSegment = frontlineSegments.find((segment) => segment.id === "reserve-line");
    const reserveOrder =
      reserveCandidate && reserveSegment
        ? ({
            ...(orderForSelectedUnit(reserveCandidate.id) ?? targetOrder),
            anchor: { ...reserveSegment.anchor },
            controlRadius: reserveSegment.controlRadius,
            frontlineSegmentId: reserveSegment.id,
            facingDeg: defaultFormationFacingForSegment(reserveSegment.id, reserveCandidate.type),
            posture: "fallback_guard",
            targetPriority: "officer",
            ammoPolicy: "conserve",
            fallback: {
              enabled: true,
              moraleBelow: 55,
              soldiersBelowRatio: 0.72,
              ammoBelow: 18,
              destination: { ...reserveSegment.fallbackPoint },
            },
            facilityAssignment: supportStructure?.type === "supplyDepot"
              ? { structureId: supportStructure.id, mode: "resupply" as const }
              : undefined,
          } satisfies StandingOrder)
        : undefined;

    setDraftOrders((current) => ({
      ...current,
      [targetUnit.id]: targetOrder,
      ...(reserveCandidate && reserveOrder ? { [reserveCandidate.id]: reserveOrder } : {}),
    }));
    setPlannerUnitId(targetUnit.id);
    onSaveStandingOrderTemplate(
      targetUnit.id,
      targetOrder,
      `${terrainMitigationAdvisory.focusSegmentName}の弱線是正から保存。地形評価${focusAssessment?.score ?? "-"}を受け、後退条件と施設/火力方針を調整した。`,
    );
    let nextReserveUnitIds = reserveUnitIds;
    if (reserveCandidate && reserveOrder && reserveUnitIds.length < reserveSlotLimit) {
      nextReserveUnitIds = [...reserveUnitIds, reserveCandidate.id];
      setReserveUnitIds(nextReserveUnitIds);
      onSaveStandingOrderTemplate(
        reserveCandidate.id,
        reserveOrder,
        `${terrainMitigationAdvisory.focusSegmentName}支援予備として保存。突破時の後退守備と再配置を優先する。`,
      );
    }
    onSaveDeploymentPlan(operation.id, operation.sectorId, frontlineGeometry, reserveDoctrine, nextReserveUnitIds, rearGuardUnitIds);
    setMitigationApplicationMessage(
      reserveCandidate && nextReserveUnitIds.includes(reserveCandidate.id)
        ? `${targetUnit.name}を${terrainMitigationAdvisory.focusSegmentName}へ再方針化し、${reserveCandidate.name}を支援予備に指定した。`
        : `${targetUnit.name}を${terrainMitigationAdvisory.focusSegmentName}へ再方針化した。`,
    );
  };

  const applyFallbackPreset = (preset: "none" | "careful" | "standard" | "last") => {
    updatePlannerOrder((standingOrder) => {
      if (preset === "none") {
        return {
          ...standingOrder,
          fallback: {
            ...standingOrder.fallback,
            enabled: false,
          },
        };
      }
      const values = {
        careful: { moraleBelow: 55, soldiersBelowRatio: 0.72, ammoBelow: 18 },
        standard: { moraleBelow: 42, soldiersBelowRatio: 0.56, ammoBelow: 12 },
        last: { moraleBelow: 28, soldiersBelowRatio: 0.42, ammoBelow: 5 },
      }[preset];
      const fallbackSegment =
        frontlineSegments.find((segment) => segment.id === standingOrder.frontlineSegmentId) ??
        frontlineSegments[0];
      return {
        ...standingOrder,
        fallback: {
          ...standingOrder.fallback,
          enabled: true,
          ...values,
          destination: { ...fallbackSegment.fallbackPoint },
        },
      };
    });
  };

  const assignFacility = (structureId: string) => {
    const structure = sector?.structures.find((candidate) => candidate.id === structureId);
    if (!structure) {
      return;
    }
    updatePlannerOrder((standingOrder) => ({
      ...standingOrder,
      facilityAssignment: {
        structureId,
        mode:
          plannerUnit?.type === "engineer"
            ? "repair"
            : structure.type === "supplyDepot"
              ? "resupply"
              : "defend",
      },
    }));
  };

  const savePlannerOrder = () => {
    if (!plannerUnit || !plannerOrder) {
      return;
    }
    onSaveStandingOrderTemplate(plannerUnit.id, plannerOrder);
    setDraftOrders((current) => ({
      ...current,
      [plannerUnit.id]: plannerOrder,
    }));
  };

  const restorePlannerSavedOrder = () => {
    if (!plannerUnit || !plannerSavedOrder) {
      return;
    }
    setDraftOrders((current) => ({
      ...current,
      [plannerUnit.id]: plannerSavedOrder,
    }));
  };

  const currentPlanSetEntries = (): StandingOrderPlanSetEntry[] =>
    selectedUnits
      .map((unit) => {
        const standingOrder = orderForSelectedUnit(unit.id);
        return standingOrder
          ? {
              unitId: unit.id,
              unitName: unit.name,
              standingOrder,
            }
          : undefined;
      })
      .filter((entry): entry is StandingOrderPlanSetEntry => Boolean(entry));

  const planSetPreview = (planSet: StandingOrderPlanSet) => {
    const matchedEntries = planSet.entries.filter((entry) => selectedUnitIds.includes(entry.unitId));
    const missingUnitNames = planSet.entries
      .filter((entry) => !selectedUnitIds.includes(entry.unitId))
      .map((entry) => entry.unitName);
    const unitDiffs = matchedEntries.map((entry) => {
      const currentOrder = orderForSelectedUnit(entry.unitId);
      const diffs = planSetOrderDiffs(currentOrder, entry.standingOrder);
      return {
        unitName: entry.unitName,
        diffs,
        savedSummary: `${standingPostureLabels[entry.standingOrder.posture]} / ${targetPriorityLabels[entry.standingOrder.targetPriority]} / ${
          ammoPolicyLabels[entry.standingOrder.ammoPolicy]
        }`,
      };
    });
    const changedUnits = unitDiffs.filter((entry) => entry.diffs.length > 0);
    const savedReserveCount = planSet.reserveUnitIds.filter((unitId) => selectedUnitIds.includes(unitId)).length;
    const currentReserveCount = reserveUnitIds.length;
    const savedRearGuardCount = (planSet.rearGuardUnitIds ?? []).filter((unitId) => selectedUnitIds.includes(unitId)).length;
    const currentRearGuardCount = rearGuardUnitIds.length;
    const isSameOperation = planSet.operationId === operation.id && planSet.sectorId === operation.sectorId;
    const geometryChanged = JSON.stringify(planSet.frontlineGeometry) !== JSON.stringify(frontlineGeometry);
    const reserveDoctrineChanged = planSet.reserveDoctrine
      ? planSet.reserveDoctrine.mode !== reserveDoctrine.mode ||
        planSet.reserveDoctrine.holdReadinessUntilPressure !== reserveDoctrine.holdReadinessUntilPressure ||
        planSet.reserveDoctrine.counterstrokeReadinessThreshold !== reserveDoctrine.counterstrokeReadinessThreshold
      : false;
    const reserveUnitChanged = planSet.reserveUnitIds.join(",") !== reserveUnitIds.join(",");
    const rearGuardUnitChanged = (planSet.rearGuardUnitIds ?? []).join(",") !== rearGuardUnitIds.join(",");
    const sketchLineEntries = Object.entries(planSet.frontlineGeometry.sketchLines ?? {});
    const sketchLineSummaries = sketchLineEntries.map(([segmentId, points]) => {
      const segmentName =
        frontlineSegments.find((segment) => segment.id === segmentId)?.name ??
        baseFrontlineSegments.find((segment) => segment.id === segmentId)?.name ??
        segmentId;
      return `${segmentName} ${points.length}点`;
    });
    const readinessTone = !isSameOperation || missingUnitNames.length > 0 ? "danger" : changedUnits.length > 0 ? "warning" : "stable";
    const readinessLabel = !isSameOperation
      ? "別戦場計画"
      : missingUnitNames.length > 0
        ? "欠員あり"
        : changedUnits.length > 0
          ? "差分あり"
          : "即適用可";
    return {
      matchedEntries,
      matchedCount: matchedEntries.length,
      missingUnitNames,
      changedCount: changedUnits.length,
      changedUnits,
      geometryChanged,
      reserveDoctrineChanged,
      reserveUnitChanged,
      rearGuardUnitChanged,
      readinessTone,
      readinessLabel,
      savedReserveCount,
      currentReserveCount,
      savedRearGuardCount,
      currentRearGuardCount,
      isSameOperation,
      geometryLabel: frontlineGeometryDisplayLabel(planSet.frontlineGeometry),
      reserveLabel: planSet.reserveDoctrine ? reserveDoctrineLabels[planSet.reserveDoctrine.mode] : "現行予備方針",
      sketchLineCount: sketchLineEntries.length,
      sketchLineSummaries,
    };
  };

  const saveCurrentPlanSet = () => {
    const entries = currentPlanSetEntries();
    if (entries.length === 0) {
      return;
    }
    onSaveStandingOrderPlanSet(
      operation.id,
      operation.sectorId,
      frontlineGeometryWithSavedSketchLines(),
      reserveDoctrine,
      reserveUnitIds,
      rearGuardUnitIds,
      entries,
    );
  };

  const overwriteCurrentPlanSet = (planSetId: string) => {
    const entries = currentPlanSetEntries();
    if (entries.length === 0) {
      return;
    }
    onOverwriteStandingOrderPlanSet(
      planSetId,
      operation.id,
      operation.sectorId,
      frontlineGeometryWithSavedSketchLines(),
      reserveDoctrine,
      reserveUnitIds,
      rearGuardUnitIds,
      entries,
    );
    setInspectedPlanSetId(planSetId);
  };

  const startRenamePlanSet = (planSet: StandingOrderPlanSet) => {
    setRenamingPlanSetId(planSet.id);
    setPlanSetRenameDraft(planSet.name);
    setInspectedPlanSetId(planSet.id);
  };

  const commitRenamePlanSet = (planSetId: string) => {
    onRenameStandingOrderPlanSet(planSetId, planSetRenameDraft);
    setRenamingPlanSetId("");
    setPlanSetRenameDraft("");
    setInspectedPlanSetId(planSetId);
  };

  const deletePlanSet = (planSetId: string) => {
    onDeleteStandingOrderPlanSet(planSetId);
    if (inspectedPlanSetId === planSetId) {
      setInspectedPlanSetId("");
    }
    if (renamingPlanSetId === planSetId) {
      setRenamingPlanSetId("");
      setPlanSetRenameDraft("");
    }
  };

  const applyStandingOrderPlanSet = (planSet: StandingOrderPlanSet) => {
    const nextSegments = applyFrontlineGeometryAdjustment(baseFrontlineSegments, planSet.frontlineGeometry);
    const matchedEntries = planSet.entries.filter((entry) => selectedUnitIds.includes(entry.unitId));
    if (matchedEntries.length === 0) {
      return;
    }
    const nextReserveDoctrine = planSet.reserveDoctrine ?? reserveDoctrine;
    const nextReserveUnitIds = planSet.reserveUnitIds.filter((unitId) => selectedUnitIds.includes(unitId));
    const nextRearGuardUnitIds = (planSet.rearGuardUnitIds ?? []).filter((unitId) => selectedUnitIds.includes(unitId));
    setFrontlineGeometry(planSet.frontlineGeometry);
    setReserveDoctrine(nextReserveDoctrine);
    setReserveUnitIds(nextReserveUnitIds);
    setRearGuardUnitIds(nextRearGuardUnitIds);
    setDraftOrders((current) => ({
      ...current,
      ...Object.fromEntries(
        matchedEntries.map((entry) => [
          entry.unitId,
          alignStandingOrderToFrontlineSegments(entry.standingOrder, nextSegments),
        ]),
      ),
    }));
    setPlannerUnitId(matchedEntries[0]?.unitId ?? plannerUnitId);
    onSaveDeploymentPlan(
      operation.id,
      operation.sectorId,
      planSet.frontlineGeometry,
      nextReserveDoctrine,
      nextReserveUnitIds,
      nextRearGuardUnitIds,
    );
  };

  const lessonDoctrineStandingOrder = (): StandingOrder | undefined => {
    if (!plannerLessonDoctrine || !plannerOrder) {
      return undefined;
    }
    return {
      ...plannerOrder,
      posture: plannerLessonDoctrine.posture,
      targetPriority: plannerLessonDoctrine.targetPriority,
      ammoPolicy: plannerLessonDoctrine.ammoPolicy,
      fallback: {
        ...plannerOrder.fallback,
        enabled: plannerLessonDoctrine.fallbackEnabled,
        moraleBelow: plannerLessonDoctrine.moraleBelow ?? plannerOrder.fallback.moraleBelow,
        soldiersBelowRatio: plannerLessonDoctrine.soldiersBelowRatio ?? plannerOrder.fallback.soldiersBelowRatio,
      },
    };
  };

  const applyTacticalLessonDoctrine = () => {
    const nextOrder = lessonDoctrineStandingOrder();
    if (!nextOrder) {
      return;
    }
    updatePlannerOrder(() => nextOrder);
  };

  const saveTacticalLessonDoctrine = () => {
    if (!plannerUnit || !plannerLessonDoctrine) {
      return;
    }
    const nextOrder = lessonDoctrineStandingOrder();
    if (!nextOrder) {
      return;
    }
    onSaveStandingOrderTemplate(
      plannerUnit.id,
      nextOrder,
      `${plannerLessonDoctrine.label}教訓から保存した自律指揮方針。次回主戦場の初期配置へ適用する。`,
    );
    setDraftOrders((current) => ({
      ...current,
      [plannerUnit.id]: nextOrder,
    }));
  };

  const adjustPlannerFacing = (delta: number) => {
    updatePlannerOrder((standingOrder) => ({
      ...standingOrder,
      facingDeg: normalizeFormationFacingDeg((standingOrder.facingDeg ?? 0) + delta),
    }));
  };

  return (
    <section className="deployment-layout">
      <aside className="deployment-briefing">
        <div className="section-title">
          <span>出撃配置</span>
          <strong>{selectedUnitIds.length}/{deploymentLimit}</strong>
        </div>
        <h2>{operation.title}</h2>
        <p>主戦場へ投入する旅団を上限枠内で選ぶ。ここで選んだ部隊だけが前線配置に入る。</p>
        <dl className="deployment-ledger">
          <dt>戦区</dt>
          <dd>{sector?.name}</dd>
          <dt>地形</dt>
          <dd>{sector ? formatTerrainTags(sector.terrainTags) : "不明"}</dd>
          <dt>敵圧</dt>
          <dd>{sector?.enemyPressure ?? 0}</dd>
          <dt>敵波予測</dt>
          <dd>{campaign.activeStrategicTurn.threatForecast}</dd>
          <dt>戦術波</dt>
          <dd>{battleWaveIntel.summary}</dd>
          <dt>敵編成</dt>
          <dd>{enemyCompositionSummary}</dd>
          <dt>戦線型</dt>
          <dd>{frontlineProfileLabel(sector)}</dd>
          <dt>出撃深度</dt>
          <dd>{deploymentDepthLabel(sector)}</dd>
          <dt>予備運用</dt>
          <dd>{reserveDoctrineLabels[reserveDoctrine.mode]}</dd>
          <dt>軍団司令部</dt>
          <dd>出撃+{headquartersProfile.deploymentSlotBonus} / 予備+{headquartersProfile.reserveReadinessBonus}</dd>
          <dt>指定予備</dt>
          <dd>{reserveUnitIds.length}/{reserveSlotLimit}旅団</dd>
          <dt>撤退後衛</dt>
          <dd>{rearGuardUnitIds.length}/{rearGuardSlotLimit}旅団</dd>
          <dt>指揮容量</dt>
          <dd>{commandCapacityReport.summary}</dd>
          <dt>保存方針</dt>
          <dd>{selectedUnitIds.filter((unitId) => templateUnitIds.has(unitId)).length}/{selectedUnitIds.length}旅団</dd>
          <dt>戦利品予測</dt>
          <dd>{operation.spoilsIntel?.summary ?? "情報なし"}</dd>
          <dt>回収候補</dt>
          <dd>{describeOperationSpoils(operation)}</dd>
        </dl>
        <EnemyIntelPanel context={enemyCompositionContext} operation={operation} title="出撃前敵情" />
        <div className="wave-timeline-panel" aria-label="敵波タイムライン">
          <div className="section-title">
            <span>敵波タイムライン</span>
            <strong>{battleWaveIntel.timeline.length}波予測</strong>
          </div>
          {battleWaveIntel.timeline.some((entry) => entry.intelCertainty === "misleading") && (
            <p className="wave-intel-warning">
              偵察報告に誤情報疑い。敵波の時刻・敵種・指揮波は表示通りとは限らない。
            </p>
          )}
          <div className="wave-timeline">
            {battleWaveIntel.timeline.map((entry) => (
              <div
                key={entry.waveNumber}
                className={`wave-timeline-entry ${entry.pressureLabel} certainty-${entry.intelCertainty}`}
              >
                <strong>第{entry.waveNumber}波</strong>
                <span>{entry.secondLabel}</span>
                <em>{entry.enemyTypesLabel}</em>
                <small>
                  {entry.pressureLabel} / {entry.commandLikelihoodLabel} / {timelineCertaintyLabels[entry.intelCertainty]}
                </small>
              </div>
            ))}
          </div>
        </div>
        <div className="button-row">
          <button type="button" onClick={onBackToCamp}>
            幕舎へ戻る
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={selectedUnitIds.length === 0}
            onClick={() => onStartBattle(selectedUnitIds, frontlineGeometry, reserveDoctrine, reserveUnitIds, rearGuardUnitIds)}
          >
            選抜部隊で戦闘開始
          </button>
        </div>
        <div className="reserve-doctrine-panel">
          <div className="section-title">
            <span>予備運用</span>
            <strong>{reserveDoctrineLabels[reserveDoctrine.mode]}</strong>
          </div>
          <p>{reserveDoctrine.notes}</p>
          <div className="reserve-doctrine-stats">
            <span>温存圧 {reserveDoctrine.holdReadinessUntilPressure}</span>
            <span>反撃閾値 {reserveDoctrine.counterstrokeReadinessThreshold}</span>
            <span>指定予備 {reserveUnitIds.length}/{reserveSlotLimit}</span>
            <span>撤退後衛 {rearGuardUnitIds.length}/{rearGuardSlotLimit}</span>
          </div>
          <div className="planner-button-grid reserve-doctrine">
            {reserveDoctrineModes.map((mode) => (
              <button
                key={mode}
                className={reserveDoctrine.mode === mode ? "active" : ""}
                type="button"
                onClick={() => applyReserveDoctrine(mode)}
              >
                {reserveDoctrineLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="deployment-board">
        <div className="deployment-zone">
          <img className="deployment-zone-corner top-left" src={assetRegistry.deployment.zoneCorner.src64} alt="" aria-hidden="true" />
          <img className="deployment-zone-corner top-right" src={assetRegistry.deployment.zoneCorner.src64} alt="" aria-hidden="true" />
          <img className="deployment-zone-corner bottom-left" src={assetRegistry.deployment.zoneCorner.src64} alt="" aria-hidden="true" />
          <img className="deployment-zone-corner bottom-right" src={assetRegistry.deployment.zoneCorner.src64} alt="" aria-hidden="true" />
          <div className="deployment-zone-title">
            <span>開始配置枠</span>
            <strong>{selectedUnitIds.length}/{deploymentLimit}</strong>
          </div>
          <div className="deployment-slot-grid">
            {Array.from({ length: deploymentLimit }).map((_, index) => {
              const unit = selectedUnits[index];
              return unit ? (
                <button
                  key={unit.id}
                  className={`deployment-slot ${unit.type} ${plannerUnit?.id === unit.id ? "planning" : ""} ${
                    reserveUnitIdSet.has(unit.id) ? "reserve-planned" : ""
                  } ${rearGuardUnitIdSet.has(unit.id) ? "rear-guard-planned" : ""
                  }`}
                  type="button"
                  onClick={() => setPlannerUnitId(unit.id)}
                >
                  <img className="deployment-selected-marker" src={assetRegistry.deployment.selectedMarker.src64} alt="" aria-hidden="true" />
                  <img className="deployment-unit-art" src={assetRegistry.army.unitTokens[unit.type].src64} alt="" aria-hidden="true" />
                  <strong>{unit.name}</strong>
                  <span>{unitTypeLabels[unit.type]}</span>
                  <em>
                    {unit.soldiers}名 / 士気 {Math.round(unit.morale)} /{" "}
                    {rearGuardUnitIdSet.has(unit.id)
                      ? "撤退後衛"
                      : reserveUnitIdSet.has(unit.id)
                        ? "指定予備"
                        : `方針 ${templateUnitIds.has(unit.id) ? "保存済" : "初期"}`}
                  </em>
                  <small className={(deploymentCommandProfiles.get(unit.id)?.commandOverload ?? 0) > 0 ? "command-overload" : ""}>
                    {deploymentCommandProfiles.get(unit.id)
                      ? `指揮容量 ${deploymentCommandProfiles.get(unit.id)?.commandLoad}/${deploymentCommandProfiles.get(unit.id)?.commandCapacity}`
                      : "将校未任命"}
                  </small>
                  <small>{divisionSummaryForUnit(unit.id)}</small>
                </button>
              ) : (
                <div key={`empty-${index}`} className="deployment-slot empty">
                  <strong>空き投入枠</strong>
                  <span>予備から選択</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="deployment-planner">
          <div className="section-title">
            <span>出撃前自律方針</span>
            <strong>{plannerUnit ? plannerUnit.name : "未選択"}</strong>
          </div>
          {plannerUnit && plannerOrder ? (
            <>
              <div className="planner-unit-strip">
                {selectedUnits.map((unit) => (
                  <button
                    key={unit.id}
                    className={unit.id === plannerUnit.id ? "active" : ""}
                    type="button"
                    onClick={() => setPlannerUnitId(unit.id)}
                  >
                    <img src={assetRegistry.army.unitTokens[unit.type].src64} alt="" aria-hidden="true" />
                    <span>{unit.name}</span>
                  </button>
                ))}
              </div>
              <div className="planner-summary">
                <span>戦線型 {frontlineProfileLabel(sector)}</span>
                <span>出撃深度 {deploymentDepthLabel(sector)}</span>
                <span>展開 {frontlineGeometryLabel}</span>
                <span>{reserveUnitIdSet.has(plannerUnit.id) ? "指定予備" : "主線配置"}</span>
                <span>{rearGuardUnitIdSet.has(plannerUnit.id) ? "撤退後衛計画" : "通常離脱"}</span>
                <span>戦線 {activeSegment?.name ?? "未指定"}</span>
                <span>許可帯 {activeDeploymentLimitSummary}</span>
                <span>射界 {formationFacingDisplayLabel(plannerOrder.facingDeg)}</span>
                <span>姿勢 {standingPostureLabels[plannerOrder.posture]}</span>
                <span>指揮 {officerCommandSummary(plannerOfficerProfile)}</span>
                <span>{plannerTacticalLessonProfile?.summary ?? "戦術教訓なし"}</span>
                <span>優先 {targetPriorityLabels[plannerOrder.targetPriority]}</span>
                <span>弾薬 {ammoPolicyLabels[plannerOrder.ammoPolicy]}</span>
                <span>
                  後退{" "}
                  {plannerOrder.fallback.enabled
                    ? `士気${plannerOrder.fallback.moraleBelow ?? "-"} / 弾薬${plannerOrder.fallback.ammoBelow ?? "-"}`
                    : "なし"}
                </span>
                <span>
                  施設{" "}
                  {assignedFacility && plannerOrder.facilityAssignment
                    ? `${fortificationTypeLabels[assignedFacility.type]} ${facilityAssignmentModeLabels[plannerOrder.facilityAssignment.mode]}`
                  : "未指定"}
                </span>
              </div>
              <div className="saved-order-compare">
                <div className="section-title compact">
                  <span>保存方針比較</span>
                  <strong>{plannerSavedTemplate ? "保存済み" : "未保存"}</strong>
                </div>
                {plannerSavedTemplate && plannerSavedOrder ? (
                  <>
                    <div className="saved-order-columns">
                      <div>
                        <h3>現在ドラフト</h3>
                        <div className="saved-order-chip-grid">
                          {orderSummaryChips(
                            plannerOrder,
                            activeSegment?.name,
                            assignedFacility ? fortificationTypeLabels[assignedFacility.type] : undefined,
                          ).map((label) => (
                            <span key={`draft-${label}`}>{label}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3>保存済み標準</h3>
                        <div className="saved-order-chip-grid">
                          {orderSummaryChips(
                            plannerSavedOrder,
                            plannerSavedSegment?.name,
                            plannerSavedFacility ? fortificationTypeLabels[plannerSavedFacility.type] : undefined,
                          ).map((label) => (
                            <span key={`saved-${label}`}>{label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p>{plannerSavedTemplate.description}</p>
                    {sketchShapeSummary(plannerSavedTemplate.frontlineSketchPoints) && (
                      <p className="sketch-shape-note">
                        {sketchShapeSummary(plannerSavedTemplate.frontlineSketchPoints)}
                      </p>
                    )}
                    <div className="saved-order-compare-actions">
                      <small>
                        差分 {savedTemplateDiffs.length > 0 ? savedTemplateDiffs.join(" / ") : "なし"}
                      </small>
                      <button type="button" disabled={savedTemplateDiffs.length === 0} onClick={restorePlannerSavedOrder}>
                        保存方針へ戻す
                      </button>
                    </div>
                  </>
                ) : (
                  <p>この旅団はまだ標準方針を持っていない。戦闘中または出撃配置で方針保存すると比較できる。</p>
                )}
              </div>
              {commandCapacityReport.overloaded.length > 0 && (
                <div className="deployment-command-warning">
                  <strong>指揮過負荷警告</strong>
                  <span>{commandCapacityReport.summary}</span>
                  <p>
                    過負荷旅団は戦闘開始時に士気、疲労回復、統制半径、予備即応、後退判断で不利を受ける。
                    将校昇進、適性ある将校への配属、旅団規模調整で緩和する。
                  </p>
                  <div>
                    {commandCapacityReport.overloaded.slice(0, 4).map(({ unit, profile }) => (
                      <small key={unit.id}>
                        {unit.name}: {profile?.commandLoad}/{profile?.commandCapacity} 過負荷{profile?.commandOverload}
                      </small>
                    ))}
                  </div>
                  <button type="button" onClick={onOpenOfficerManagement}>
                    将校調整へ
                  </button>
                </div>
              )}
              <div className={`rear-guard-advisor ${plannerRearGuardAdvice?.tone ?? "recommended"}`}>
                <div className="section-title compact">
                  <span>撤退後衛判断</span>
                  <strong>{plannerRearGuardAdvice?.toneLabel ?? "推奨"}</strong>
                </div>
                {plannerRearGuardAdvice ? (
                  <>
                    <p>
                      {plannerUnit.name}: 適性{plannerRearGuardAdvice.suitability} / 予測損耗
                      {plannerRearGuardAdvice.estimatedCasualties} / 将校危険{plannerRearGuardAdvice.officerRisk}
                    </p>
                    <div className="rear-guard-tradeoff-grid">
                      <span>
                        推奨度<strong>{plannerRearGuardAdvice.recommendationScore}</strong>
                      </span>
                      <span>
                        追撃抑止<strong>{plannerRearGuardAdvice.pursuitCover}</strong>
                      </span>
                      <span>
                        温存余地<strong>{plannerRearGuardAdvice.preservationScore}</strong>
                      </span>
                    </div>
                    <small>{plannerRearGuardAdvice.reason}</small>
                  </>
                ) : (
                  <p>投入旅団を選ぶと、後衛適性と将校危険を事前に見積もる。</p>
                )}
                {recommendedRearGuardAdvice && (
                  <div className="rear-guard-recommendation">
                    <span>
                      推奨候補: {recommendedRearGuardAdvice.unitName} / {recommendedRearGuardAdvice.tradeoffLabel}
                    </span>
                    <button
                      type="button"
                      disabled={
                        rearGuardUnitIdSet.has(recommendedRearGuardAdvice.unitId)
                          ? false
                          : rearGuardUnitIds.length >= rearGuardSlotLimit
                      }
                      onClick={() => assignRearGuardDesignation(recommendedRearGuardAdvice.unitId)}
                    >
                      推奨候補を後衛指定
                    </button>
                  </div>
                )}
                <div className="rear-guard-advisor-list">
                  {rearGuardAdvice.slice(0, 4).map((entry) => (
                    <button
                      key={entry.unitId}
                      type="button"
                      className={`${entry.tone} ${entry.unitId === plannerUnit?.id ? "active" : ""}`}
                      onClick={() => setPlannerUnitId(entry.unitId)}
                    >
                      <strong>{entry.unitName}</strong>
                      <span>
                        {entry.toneLabel} / 推奨{entry.recommendationScore} / 抑止{entry.pursuitCover} / 温存
                        {entry.preservationScore}
                      </span>
                      <small>
                        損耗{entry.estimatedCasualties} / 将校危険{entry.officerRisk} / {entry.tradeoffLabel}
                      </small>
                      <em>
                        {entry.reason}
                      </em>
                    </button>
                  ))}
                </div>
              </div>
              {plannerHasActionableLesson ? (
                <div className="deployment-lesson-recommendation">
                  <strong>戦術教訓推奨</strong>
                  <span>{plannerTacticalLessonProfile?.summary ?? "戦術教訓なし"}</span>
                  {plannerLessonDoctrine ? (
                    <>
                      <p>
                        次戦初動は{plannerLessonDoctrine.label}を推奨。{plannerLessonDoctrine.summary}
                      </p>
                      <small>
                        適用内容: 姿勢 {standingPostureLabels[plannerLessonDoctrine.posture]} / 優先{" "}
                        {targetPriorityLabels[plannerLessonDoctrine.targetPriority]} / 弾薬{" "}
                        {ammoPolicyLabels[plannerLessonDoctrine.ammoPolicy]}
                      </small>
                      <button type="button" onClick={applyTacticalLessonDoctrine}>
                        教訓方針を適用
                      </button>
                      <button type="button" onClick={saveTacticalLessonDoctrine}>
                        教訓方針を保存
                      </button>
                    </>
                  ) : (
                    <p>即応、統制、後退判断の補正だけを次戦へ反映する。</p>
                  )}
                </div>
              ) : null}
              <div
                className={`deployment-frontline-preview ${deploymentSketchMode ? "sketch-drawing" : ""} ${
                  deploymentSketchDragActive ? "dragging-sketch" : ""
                }`}
                aria-label="戦区戦線プレビュー"
                onClick={handleDeploymentPreviewClick}
                onPointerDown={handleDeploymentSketchPointerDown}
                onPointerMove={handleDeploymentSketchPointerMove}
                onPointerUp={finishDeploymentSketchPointer}
                onPointerCancel={finishDeploymentSketchPointer}
              >
                <span className="preview-enemy-pressure">敵波</span>
                <span className="preview-fallback-line">後退線</span>
                <span className={`preview-geometry-pill ${frontlineGeometry.preset}`}>{frontlineGeometryLabel}</span>
                {deploymentSketchMode && (
                  <span className="preview-sketch-instruction">
                    {deploymentSketchDragActive ? "ドラッグ中" : "クリック/ドラッグ"} {deploymentSketchDraftPoints.length}/
                    {maxFrontlineSketchPoints}
                  </span>
                )}
                {(frontlineSegments.some((segment) => segment.sketchPoints && segment.sketchPoints.length > 1) ||
                  deploymentSketchDraftPoints.length > 0) && (
                  <svg
                    className="deployment-sketch-overlay"
                    viewBox={`0 0 ${defaultBattleMapBounds.width} ${defaultBattleMapBounds.height}`}
                    aria-hidden="true"
                  >
                    {frontlineSegments
                      .filter((segment) => segment.sketchPoints && segment.sketchPoints.length > 1)
                      .map((segment) => (
                        <g key={`${segment.id}-sketch-preview`}>
                          {segment.sketchPoints && segment.sketchPoints.length > 2 ? (
                            <path d={svgSmoothSketchPath(segment.sketchPoints)} />
                          ) : (
                            <polyline points={svgPolylinePoints(segment.sketchPoints ?? [])} />
                          )}
                          {(segment.sketchPoints ?? []).map((point, pointIndex) => (
                            <circle
                              key={`${segment.id}-sketch-point-${pointIndex}`}
                              cx={point.x}
                              cy={point.y}
                              r={pointIndex === 0 ? 1.7 : 1.25}
                            />
                          ))}
                        </g>
                      ))}
                    {deploymentSketchDraftPoints.length > 0 && (
                      <g className="draft-sketch">
                        {deploymentSketchDraftPoints.length > 1 && (
                          deploymentSketchDraftPoints.length > 2 ? (
                            <path d={svgSmoothSketchPath(deploymentSketchDraftPoints)} />
                          ) : (
                            <polyline points={svgPolylinePoints(deploymentSketchDraftPoints)} />
                          )
                        )}
                        {deploymentSketchDraftPoints.map((point, pointIndex) => (
                          <circle
                            key={`deployment-draft-sketch-point-${pointIndex}`}
                            cx={point.x}
                            cy={point.y}
                            r={pointIndex === 0 ? 1.9 : 1.35}
                          />
                        ))}
                      </g>
                    )}
                  </svg>
                )}
                {frontlineSegments.map((segment) => (
                  <span
                    key={`${segment.id}-deployment-limit`}
                    className={`preview-deployment-limit ${plannerOrder.frontlineSegmentId === segment.id ? "active" : ""}`}
                    style={previewDeploymentLimitStyle(segment)}
                  >
                    {segment.deploymentLimit?.label ?? "出撃帯"}
                  </span>
                ))}
                {frontlineSegments.map((segment) => (
                  <button
                    key={segment.id}
                    className={`${segment.id} ${plannerOrder.frontlineSegmentId === segment.id ? "active" : ""} ${
                      frontlineGeometry.segmentOverrides?.[segment.id] ? "customized" : ""
                    }`}
                    type="button"
                    style={previewSegmentStyle(segment)}
                    onClick={() => assignSegment(segment.id)}
                    title={`${segment.name} / 基準 X${segment.anchor.x} Y${segment.anchor.y}`}
                  >
                    <strong>{segment.name}</strong>
                    <span>基準 {Math.round(segment.anchor.x)}:{Math.round(segment.anchor.y)}</span>
                    {segment.sketchPoints && segment.sketchPoints.length > 1 && (
                      <em>形状{segment.sketchPoints.length}点</em>
                    )}
                    <small>{frontlineTerrainAssessments.get(segment.id)?.summary ?? "地形評価なし"}</small>
                  </button>
                ))}
              </div>
              <div className="planner-control-group">
                <h3>戦線ジオメトリ</h3>
                <p className="planner-control-note">{frontlineGeometry.description}</p>
                {(frontlineGeometry.sketchLines || savedSketchLinesForSelectedUnits()) && (
                  <p className="planner-control-note sketch-shape-note">
                    計画セット保存時に戦線形状{" "}
                    {Object.keys({
                      ...(frontlineGeometry.sketchLines ?? {}),
                      ...(savedSketchLinesForSelectedUnits() ?? {}),
                    }).length}
                    線を含める。
                  </p>
                )}
                <div className="planner-button-grid geometry">
                  {frontlineGeometryPresets.map((preset) => {
                    const assessment = frontlineGeometryTerrainAssessments.get(preset.preset);
                    const isRecommended = preset.preset === recommendedFrontlineGeometryPreset;
                    return (
                      <button
                        key={preset.preset}
                        className={`${frontlineGeometry.preset === preset.preset ? "active" : ""} ${
                          isRecommended ? "best-preset" : ""
                        } tone-${assessment?.tone ?? "stable"}`}
                        type="button"
                        onClick={() => applyFrontlinePreset(preset.preset)}
                      >
                        <strong>{preset.label}</strong>
                        <span>
                          平均{assessment?.averageScore ?? 0} / 最低{assessment?.weakestScore ?? 0}
                        </span>
                        <small>{isRecommended ? "地形推奨" : assessment?.summary ?? "地形評価なし"}</small>
                      </button>
                    );
                  })}
                </div>
                {activeGeometryTerrainAssessment && (
                  <p className="planner-control-note">
                    現プリセット: {activeGeometryTerrainAssessment.summary} / 推奨方針
                    {activeGeometryTerrainAssessment.recommendedDoctrine}。{activeGeometryTerrainAssessment.reason}
                  </p>
                )}
                {terrainMitigationAdvisory && (
                  <div className={`terrain-mitigation-card ${terrainMitigationAdvisory.severity}`}>
                    <div>
                      <strong>{terrainMitigationAdvisory.title}</strong>
                      <span>{terrainMitigationAdvisory.summary}</span>
                    </div>
                    <ul>
                      {terrainMitigationAdvisory.actionHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                    <div className="terrain-mitigation-actions">
                      <button type="button" onClick={() => assignSegment(terrainMitigationAdvisory.focusSegmentId)}>
                        弱線を選択
                      </button>
                      <button type="button" onClick={applyTerrainMitigationToStandingOrders}>
                        是正方針を保存
                      </button>
                      {terrainMitigationAdvisory.shouldChangeGeometry && (
                        <button type="button" onClick={() => applyFrontlinePreset(recommendedFrontlineGeometryPreset)}>
                          推奨形へ変更
                        </button>
                      )}
                    </div>
                    {mitigationApplicationMessage && (
                      <p className="terrain-mitigation-result">{mitigationApplicationMessage}</p>
                    )}
                  </div>
                )}
                <div className="frontline-terrain-assessment-grid">
                  {frontlineSegments.map((segment) => {
                    const assessment = frontlineTerrainAssessments.get(segment.id);
                    return (
                      <button
                        key={`${segment.id}-terrain-assessment`}
                        className={plannerOrder?.frontlineSegmentId === segment.id ? "active" : ""}
                        type="button"
                        onClick={() => assignSegment(segment.id)}
                      >
                        <strong>{segment.name}</strong>
                        <span>{assessment?.summary ?? "標準地形 / 評価45"}</span>
                        <small>
                          火力{assessment?.fireAdvantage ?? 0} / 遮蔽{assessment?.coverValue ?? 0} / 機動リスク
                          {assessment?.mobilityRisk ?? 0} / 施設{assessment?.supportValue ?? 0}
                        </small>
                        <em>推奨 {assessment?.suggestedDoctrine ?? "弾性拒止"}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
              {activeSegment && (
                <div className="planner-control-group frontline-handle-editor">
                  <h3>戦線ハンドル</h3>
                  <p className="planner-control-note">
                    {activeSegment.name}の基準点、後退線、担当幅、出撃許可帯を微調整する。手動調整 {frontlineGeometryCustomCount(frontlineGeometry)}線。
                  </p>
                  <div className="planner-handle-summary">
                    <span>対象 {activeSegment.name}</span>
                    <span>{activeDeploymentLimit?.label ?? deploymentDepthLabel(sector)}</span>
                    <span>{activeDeploymentLimitSummary}</span>
                    <span>
                      基準 {Math.round(activeSegment.anchor.x)}:{Math.round(activeSegment.anchor.y)}
                    </span>
                    <span>
                      後退 {Math.round(activeSegment.fallbackPoint.x)}:{Math.round(activeSegment.fallbackPoint.y)}
                    </span>
                    <span>半径 {Math.round(activeSegment.controlRadius)}</span>
                    <span>{activeSegmentHasManualAdjustment ? "手動調整あり" : "未調整"}</span>
                    {activeTerrainAssessment && (
                      <span>
                        地形評価 {activeTerrainAssessment.score} / 推奨{activeTerrainAssessment.suggestedDoctrine}
                      </span>
                    )}
                    <span>{activeSegmentSketchLine && activeSegmentSketchLine.length > 1 ? `形状${activeSegmentSketchLine.length}点` : "形状未保存"}</span>
                  </div>
                  {activeTerrainAssessment && (
                    <p className="planner-control-note">{activeTerrainAssessment.reason}</p>
                  )}
                  <p className="planner-control-note">
                    {activeDeploymentLimit?.description ?? deploymentDepthDescription(sector)}
                    出撃帯調整は戦闘開始時の初期位置制限に反映される。
                  </p>
                  <div className="planner-sketch-editor">
                    <div>
                      <strong>戦線形状</strong>
                      <span>
                        {activeSegmentSketchLine && activeSegmentSketchLine.length > 1
                          ? activeSegmentSketchLine
                              .slice(0, 3)
                              .map((point) => `X${Math.round(point.x)} Y${Math.round(point.y)}`)
                              .join(" -> ")
                          : "計画セット用の形状線なし"}
                      </span>
                      {deploymentSketchMode && (
                        <em>
                          戦区プレビュー上でクリック点打ち、またはドラッグで線を引く。ドラッグ線は戦線計画用に最大
                          {maxFrontlineSketchPoints}点へ要約し、3点以上は曲線戦線として保存する。現在{" "}
                          {deploymentSketchDraftPoints.length}/{maxFrontlineSketchPoints}点。
                        </em>
                      )}
                    </div>
                    <div className="planner-button-grid compact">
                      <button
                        type="button"
                        onClick={() => (deploymentSketchMode ? cancelDeploymentSketchMode() : startDeploymentSketchMode())}
                      >
                        {deploymentSketchMode ? "描画中止" : "地図で描画"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startDeploymentSketchMode(activeSegmentSketchLine)}
                        disabled={!activeSegmentSketchLine || activeSegmentSketchLine.length < 2}
                      >
                        既存線を編集
                      </button>
                      {deploymentSketchMode && (
                        <>
                          <button
                            type="button"
                            onClick={undoDeploymentSketchPoint}
                            disabled={deploymentSketchDraftPoints.length < 1}
                          >
                            1点戻す
                          </button>
                          <button
                            type="button"
                            onClick={confirmDeploymentSketchLine}
                            disabled={deploymentSketchDraftPoints.length < 2}
                          >
                            描画確定
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => applyDeploymentSketchLine(activeSegment, "current")}>
                        現線を形状化
                      </button>
                      <button type="button" onClick={() => applyDeploymentSketchLine(activeSegment, "north")}>
                        北寄せ形状
                      </button>
                      <button type="button" onClick={() => applyDeploymentSketchLine(activeSegment, "south")}>
                        南寄せ形状
                      </button>
                      <button type="button" onClick={() => clearDeploymentSketchLine(activeSegment.id)}>
                        形状解除
                      </button>
                    </div>
                  </div>
                  <div className="planner-button-grid handle">
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          anchorDelta: { x: 3, y: 0 },
                          fallbackDelta: { x: 3, y: 0 },
                          zoneDelta: { x: 3, y: 0 },
                        })
                      }
                    >
                      主線前へ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          anchorDelta: { x: -3, y: 0 },
                          fallbackDelta: { x: -3, y: 0 },
                          zoneDelta: { x: -3, y: 0 },
                        })
                      }
                    >
                      主線後ろへ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          anchorDelta: { x: 0, y: -3 },
                          fallbackDelta: { x: 0, y: -3 },
                          zoneDelta: { x: 0, y: -3 },
                        })
                      }
                    >
                      北へ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          anchorDelta: { x: 0, y: 3 },
                          fallbackDelta: { x: 0, y: 3 },
                          zoneDelta: { x: 0, y: 3 },
                        })
                      }
                    >
                      南へ
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustSegmentHandle(activeSegment.id, { fallbackDelta: { x: -3, y: 0 } })}
                    >
                      後退線深く
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustSegmentHandle(activeSegment.id, { fallbackDelta: { x: 3, y: 0 } })}
                    >
                      後退線浅く
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          zoneDelta: { x: 0, y: -2 },
                          zoneSizeDelta: { width: 0, height: 4 },
                          controlRadiusDelta: 1,
                        })
                      }
                    >
                      担当幅広げる
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          zoneDelta: { x: 0, y: 2 },
                          zoneSizeDelta: { width: 0, height: -4 },
                          controlRadiusDelta: -1,
                        })
                      }
                    >
                      担当幅絞る
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustSegmentHandle(activeSegment.id, { controlRadiusDelta: 1 })}
                    >
                      統制+
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustSegmentHandle(activeSegment.id, { controlRadiusDelta: -1 })}
                    >
                      統制-
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          deploymentLimitSizeDelta: { width: 3, height: 0 },
                        })
                      }
                    >
                      出撃帯前進
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          deploymentLimitSizeDelta: { width: -3, height: 0 },
                        })
                      }
                    >
                      出撃帯後退
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          deploymentLimitDelta: { x: 0, y: -2 },
                          deploymentLimitSizeDelta: { width: 0, height: 4 },
                        })
                      }
                    >
                      出撃帯広げる
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adjustSegmentHandle(activeSegment.id, {
                          deploymentLimitDelta: { x: 0, y: 2 },
                          deploymentLimitSizeDelta: { width: 0, height: -4 },
                        })
                      }
                    >
                      出撃帯絞る
                    </button>
                    <button type="button" onClick={() => resetSegmentHandle(activeSegment.id)}>
                      この線を戻す
                    </button>
                  </div>
                </div>
              )}
              <div className="planner-control-group">
                <h3>担当戦線</h3>
                <div className="planner-button-grid">
                  {frontlineSegments.map((segment) => (
                    <button
                      key={segment.id}
                      className={plannerOrder.frontlineSegmentId === segment.id ? "active" : ""}
                      type="button"
                      onClick={() => assignSegment(segment.id)}
                    >
                      {segment.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="planner-control-group">
                <h3>射界向き</h3>
                <p className="planner-control-note">旅団の正面方向を事前指定する。斜行射界は戦闘中の目標選定にも効く。</p>
                <div className="planner-button-grid compact">
                  {formationFacingOptions.map((option) => (
                    <button
                      key={option.facingDeg}
                      className={Math.round(plannerOrder.facingDeg ?? 0) === option.facingDeg ? "active" : ""}
                      type="button"
                      onClick={() =>
                        updatePlannerOrder((standingOrder) => ({
                          ...standingOrder,
                          facingDeg: option.facingDeg,
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="planner-button-grid compact">
                  <button type="button" onClick={() => adjustPlannerFacing(-15)}>
                    北へ15度
                  </button>
                  <button
                    type="button"
                    className={normalizeFormationFacingDeg(plannerOrder.facingDeg) === 0 ? "active" : ""}
                    onClick={() =>
                      updatePlannerOrder((standingOrder) => ({
                        ...standingOrder,
                        facingDeg: 0,
                      }))
                    }
                  >
                    正面0度
                  </button>
                  <button type="button" onClick={() => adjustPlannerFacing(15)}>
                    南へ15度
                  </button>
                </div>
                <p className="planner-control-note">現在 {formationFacingDisplayLabel(plannerOrder.facingDeg)}</p>
              </div>
              <div className="planner-control-group">
                <h3>姿勢プリセット</h3>
                <div className="planner-button-grid">
                  {standingOrderPresets.map((preset) => (
                    <button
                      key={preset.id}
                      className={plannerOrder.posture === preset.id ? "active" : ""}
                      type="button"
                      onClick={() =>
                        updatePlannerOrder((standingOrder) => ({
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
                        }))
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="planner-two-controls">
                <div className="planner-control-group">
                  <h3>優先目標</h3>
                  <div className="planner-button-grid compact">
                    {targetPriorities.map((priority) => (
                      <button
                        key={priority}
                        className={plannerOrder.targetPriority === priority ? "active" : ""}
                        type="button"
                        onClick={() =>
                          updatePlannerOrder((standingOrder) => ({ ...standingOrder, targetPriority: priority }))
                        }
                      >
                        {targetPriorityLabels[priority]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="planner-control-group">
                  <h3>弾薬方針</h3>
                  <div className="planner-button-grid compact">
                    {ammoPolicies.map((policy) => (
                      <button
                        key={policy}
                        className={plannerOrder.ammoPolicy === policy ? "active" : ""}
                        type="button"
                        onClick={() => updatePlannerOrder((standingOrder) => ({ ...standingOrder, ammoPolicy: policy }))}
                      >
                        {ammoPolicyLabels[policy]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="planner-control-group">
                <h3>後退規則</h3>
                <div className="planner-button-grid">
                  <button type="button" onClick={() => applyFallbackPreset("none")}>
                    後退なし
                  </button>
                  <button type="button" onClick={() => applyFallbackPreset("careful")}>
                    慎重後退
                  </button>
                  <button type="button" onClick={() => applyFallbackPreset("standard")}>
                    標準後退
                  </button>
                  <button type="button" onClick={() => applyFallbackPreset("last")}>
                    限界保持
                  </button>
                </div>
              </div>
              <div className="planner-control-group">
                <h3>施設担当</h3>
                <div className="planner-button-grid">
                  {sector?.structures.map((structure) => (
                    <button
                      key={structure.id}
                      className={plannerOrder.facilityAssignment?.structureId === structure.id ? "active" : ""}
                      type="button"
                      onClick={() => assignFacility(structure.id)}
                    >
                      {fortificationTypeLabels[structure.type]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updatePlannerOrder((standingOrder) => ({
                        ...standingOrder,
                        facilityAssignment: undefined,
                      }))
                    }
                  >
                    施設なし
                  </button>
                </div>
              </div>
              <div className="planner-actions">
                <button
                  type="button"
                  className={reserveUnitIdSet.has(plannerUnit.id) ? "active" : ""}
                  disabled={!reserveUnitIdSet.has(plannerUnit.id) && reserveUnitIds.length >= reserveSlotLimit}
                  onClick={() => toggleReserveDesignation(plannerUnit.id)}
                >
                  {reserveUnitIdSet.has(plannerUnit.id) ? "主線運用へ戻す" : "指定予備にする"}
                </button>
                <button
                  type="button"
                  className={rearGuardUnitIdSet.has(plannerUnit.id) ? "active" : ""}
                  disabled={!rearGuardUnitIdSet.has(plannerUnit.id) && rearGuardUnitIds.length >= rearGuardSlotLimit}
                  onClick={() => toggleRearGuardDesignation(plannerUnit.id)}
                >
                  {rearGuardUnitIdSet.has(plannerUnit.id) ? "後衛指定を解除" : "撤退後衛にする"}
                </button>
                <button type="button" onClick={() => toggleUnit(plannerUnit.id)}>
                  投入解除
                </button>
                <button className="primary-button" type="button" onClick={savePlannerOrder}>
                  方針保存
                </button>
                <button type="button" onClick={saveCurrentPlanSet}>
                  計画セット保存
                </button>
              </div>
            </>
          ) : (
            <p>投入枠に旅団を選ぶと、戦線・姿勢・後退規則を事前に設定できる。</p>
          )}
        </div>

        <div className="reserve-roster">
          <div className="section-title">
            <img className="section-title-icon" src={assetRegistry.deployment.reserveStrip.src64} alt="" aria-hidden="true" />
            <span>予備旅団</span>
            <strong>クリックで投入/解除</strong>
          </div>
          <div className="reserve-unit-list">
            {reserveUnits.map((unit) => (
              <button
                key={unit.id}
                className={`reserve-unit ${unit.type}`}
                type="button"
                disabled={selectedUnitIds.length >= deploymentLimit}
                onClick={() => toggleUnit(unit.id)}
              >
                <img
                  className={`unit-token unit-token-image ${unit.type}`}
                  src={assetRegistry.army.unitTokens[unit.type].src64}
                  alt=""
                  aria-hidden="true"
                />
                <strong>{unit.name}</strong>
                <em>
                  {unitTypeLabels[unit.type]} / 弾薬 {Math.round(unit.ammo)} / 方針 {templateUnitIds.has(unit.id) ? "保存済" : "初期"}
                </em>
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="deployment-field-panel">
        <div className="section-title">
          <span>戦場陣地</span>
          <strong>{sector?.structures.length ?? 0}施設</strong>
        </div>
        {sector?.structures.map((structure) => (
          <article key={structure.id} className={`structure-row ${structure.status}`}>
            <img
              className={`structure-icon structure-icon-image ${structure.type}`}
              src={assetRegistry.engineering.structures[structure.type].src64}
              alt=""
              aria-hidden="true"
            />
            <div>
              <h3>{fortificationTypeLabels[structure.type]}</h3>
              <p>
                {fortificationStatusLabels[structure.status]} / 耐久 {Math.round(structure.durability)}/
                {structure.maxDurability}
              </p>
            </div>
          </article>
        ))}
        <div className="deployment-modifier-box">
          <h3>小任務の影響</h3>
          {campaign.activeStrategicTurn.sideOperations.map((sideOperation) => (
            <p key={sideOperation.id}>
              {sideOperation.title}: {sideOperation.resolved && sideOperation.outcome ? "反映済み" : "未解決"}
            </p>
          ))}
        </div>
        <div className="deployment-modifier-box">
          <h3>保存済み自律方針</h3>
          {campaign.standingOrderTemplates.length > 0 ? (
            campaign.standingOrderTemplates.slice(0, 8).map((template) => {
              const templateUnitId = template.createdFromUnitId;
              const canCompareTemplate = Boolean(templateUnitId && selectedUnitIds.includes(templateUnitId));
              return (
                <div key={template.id} className="saved-order-list-row">
                  <p>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                    {sketchShapeSummary(template.frontlineSketchPoints) && (
                      <span className="sketch-shape-note">{sketchShapeSummary(template.frontlineSketchPoints)}</span>
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={!canCompareTemplate}
                    onClick={() => {
                      if (templateUnitId) {
                        setPlannerUnitId(templateUnitId);
                      }
                    }}
                  >
                    比較
                  </button>
                </div>
              );
            })
          ) : (
            <p>戦闘中に方針保存すると、次回主戦場の初期配置へ適用される。</p>
          )}
        </div>
        <div className="deployment-modifier-box">
          <h3>戦線計画セット</h3>
          {campaign.standingOrderPlanSets.length > 0 ? (
            campaign.standingOrderPlanSets.slice(0, 6).map((planSet) => {
              const preview = planSetPreview(planSet);
              const isInspected = inspectedPlanSetId === planSet.id;
              const isRenaming = renamingPlanSetId === planSet.id;
              return (
                <div
                  key={planSet.id}
                  className={`plan-set-list-row ${isInspected ? "inspected" : ""} tone-${preview.readinessTone}`}
                >
                  <p>
                    {isRenaming ? (
                      <input
                        aria-label={`${planSet.name} 名称`}
                        value={planSetRenameDraft}
                        onChange={(event) => setPlanSetRenameDraft(event.currentTarget.value)}
                      />
                    ) : (
                      <strong>{planSet.name}</strong>
                    )}
                    <span>
                      {planSet.description} / 合致 {preview.matchedCount}/{planSet.entries.length}旅団 / 差分{" "}
                      {preview.changedCount} / {preview.readinessLabel}
                    </span>
                    {isInspected ? (
                      <div className="plan-set-preview-detail">
                        <span>
                          戦場 {preview.isSameOperation ? "現主戦場" : "別戦場保存"} / 戦線 {preview.geometryLabel}
                          {preview.geometryChanged ? "（現行と差分）" : "（現行一致）"} / 予備 {preview.reserveLabel}
                          {preview.reserveDoctrineChanged ? "（方針差分）" : ""} / 指定予備 {preview.savedReserveCount}
                          保存・現行{preview.currentReserveCount}
                          {preview.reserveUnitChanged ? "（指定差分）" : ""}
                          / 撤退後衛 {preview.savedRearGuardCount}保存・現行{preview.currentRearGuardCount}
                          {preview.rearGuardUnitChanged ? "（後衛差分）" : ""}
                        </span>
                        {preview.sketchLineCount > 0 && (
                          <span className="sketch-shape-note">
                            保存戦線形状 {preview.sketchLineSummaries.join(" / ")}
                          </span>
                        )}
                        {preview.missingUnitNames.length > 0 ? (
                          <span>未投入 {preview.missingUnitNames.slice(0, 4).join("、")}</span>
                        ) : (
                          <span>未投入なし</span>
                        )}
                        <div className="plan-set-diff-list">
                          {preview.changedUnits.length > 0 ? (
                            preview.changedUnits.slice(0, 4).map((entry) => (
                              <span key={`${planSet.id}-${entry.unitName}`}>
                                <strong>{entry.unitName}</strong>
                                {entry.diffs.join(" / ")}
                                <em>{entry.savedSummary}</em>
                              </span>
                            ))
                          ) : (
                            <span>旅団方針差分なし。現行ドラフトと同じ戦線計画。</span>
                          )}
                          {preview.changedUnits.length > 4 ? <span>他 {preview.changedUnits.length - 4}旅団に差分</span> : null}
                        </div>
                      </div>
                    ) : null}
                  </p>
                  <div className="plan-set-actions">
                    <button type="button" onClick={() => setInspectedPlanSetId(isInspected ? "" : planSet.id)}>
                      {isInspected ? "閉じる" : "内容確認"}
                    </button>
                    <button type="button" disabled={preview.matchedCount === 0} onClick={() => applyStandingOrderPlanSet(planSet)}>
                      一括適用
                    </button>
                    <button type="button" disabled={selectedUnits.length === 0} onClick={() => overwriteCurrentPlanSet(planSet.id)}>
                      上書き
                    </button>
                    {isRenaming ? (
                      <button type="button" disabled={planSetRenameDraft.trim().length === 0} onClick={() => commitRenamePlanSet(planSet.id)}>
                        名前保存
                      </button>
                    ) : (
                      <button type="button" onClick={() => startRenamePlanSet(planSet)}>
                        名前編集
                      </button>
                    )}
                    <button type="button" onClick={() => deletePlanSet(planSet.id)}>
                      削除
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p>現在の投入旅団、戦線形状、予備方針をまとめて保存すると、次回以降に一括適用できる。</p>
          )}
        </div>
      </aside>
    </section>
  );
}
