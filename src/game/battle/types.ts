import type { StaffSlotId, UnitOrder, UnitType } from "../army/types";
import type { CommandIssuePlan, ReserveDoctrinePlan } from "../campaign/types";
import type { BattleCommandPostProfile } from "./commandPost";
import type { FireDisciplineProfile, StrategicDoctrineProfile } from "../doctrine/types";
import type { FortificationInstance } from "../fortifications/types";
import type { ResourceCost } from "../logistics/spend";
import type { StrategicOperation } from "../theater/types";

export type BattleStatus = "ready" | "running" | "paused" | "held" | "withdrawn" | "collapsed";

export interface BattleScenario {
  id: string;
  title: string;
  operation: StrategicOperation;
  sectorId: string;
  sectorName: string;
  terrainTags: string[];
  tacticalTerrainProfileId?: "high_ground_los_drill" | "reverse_slope_los_drill";
  tacticalTerrainProfileLabel?: string;
  tacticalTerrainProfileSummary?: string;
  durationSeconds: number;
  waveBudget: number;
  waveIntel: BattleWaveIntel;
}

export interface BattleWaveIntel {
  firstWaveSecond: number;
  spawnIntervalSeconds: number;
  commandWaveStart: number;
  commandWaveChance: number;
  actualFirstWaveSecond: number;
  actualSpawnIntervalSeconds: number;
  actualCommandWaveStart: number;
  actualCommandWaveChance: number;
  mobPressureMultiplier: number;
  riflemenPressureMultiplier: number;
  brutePressureMultiplier: number;
  officerPressureMultiplier: number;
  actualMobPressureMultiplier: number;
  actualRiflemenPressureMultiplier: number;
  actualBrutePressureMultiplier: number;
  actualOfficerPressureMultiplier: number;
  timeline: BattleWaveTimelineEntry[];
  summary: string;
  surpriseSummary?: string;
}

export interface BattleWaveTimelineEntry {
  waveNumber: number;
  second: number;
  secondLabel: string;
  enemyTypes: string[];
  enemyTypesLabel: string;
  commandLikelihood: "none" | "low" | "medium" | "high";
  commandLikelihoodLabel: string;
  pressureLabel: string;
  intelCertainty: "vague" | "estimated" | "confirmed" | "misleading";
  summary: string;
}

export interface BattlePosition {
  x: number;
  y: number;
}

export interface BattleMapBounds {
  width: number;
  height: number;
}

export interface FrontlineSegment {
  id: string;
  name: string;
  anchor: BattlePosition;
  fallbackPoint: BattlePosition;
  sketchPoints?: BattlePosition[];
  controlRadius: number;
  deploymentLimit?: {
    label: string;
    description: string;
    zone: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  zone: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type FrontlineGeometryPreset =
  | "sector_default"
  | "forward_line"
  | "defense_in_depth"
  | "wide_screen"
  | "compressed_choke"
  | "refused_left"
  | "refused_right";

export interface FrontlineSegmentGeometryOverride {
  anchorOffset?: BattlePosition;
  fallbackOffset?: BattlePosition;
  zoneOffset?: BattlePosition;
  zoneSizeOffset?: {
    width: number;
    height: number;
  };
  deploymentLimitOffset?: BattlePosition;
  deploymentLimitSizeOffset?: {
    width: number;
    height: number;
  };
  controlRadiusOffset?: number;
}

export interface FrontlineGeometryAdjustment {
  preset: FrontlineGeometryPreset;
  label: string;
  description: string;
  forwardOffset: number;
  lateralSpread: number;
  depthSpacing: number;
  controlRadiusScale: number;
  segmentOverrides?: Record<string, FrontlineSegmentGeometryOverride>;
  sketchLines?: Record<string, BattlePosition[]>;
}

export interface BattleTerrainZone {
  id: string;
  terrainTag: string;
  name: string;
  cover: number;
  fatigue: number;
  movement: number;
  rangeMultiplier: number;
  fireMultiplier: number;
  zone: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface BattleChokePoint {
  id: string;
  name: string;
  terrainTag: string;
  position: BattlePosition;
  radius: number;
  laneWidth: number;
  flowLimit: number;
  slowMultiplier: number;
  currentPressure: number;
  delayPercent: number;
}

export type StandingPosture =
  | "hold_line"
  | "elastic_defense"
  | "aggressive_screen"
  | "fire_support"
  | "engineer_support"
  | "fallback_guard";

export type TargetPriority = "nearest" | "brute" | "officer" | "riflemen" | "largest_mass" | "weakest";

export type AmmoPolicy = "normal" | "conserve" | "intense";

export type FacilityAssignmentMode = "defend" | "repair" | "resupply" | "hold_near";

export type ObjectiveResponseRole =
  | "victory_hold"
  | "victory_retake"
  | "supply_defense"
  | "supply_retake"
  | "visibility_secure"
  | "visibility_retake";

export type EnemyCommandActionRole =
  | "command_node_fire"
  | "command_inheritance_cut"
  | "collapse_pursuit"
  | "command_reserve_commit";

export type FrontlineRotationRole = "rotated_out" | "rear_guard_cover";

export type FacilityResponseRole = "facility_defense" | "facility_repair" | "facility_resupply";

export type MapInspectionResponseRole =
  | "enemy_response"
  | "enemy_volley"
  | "enemy_focus"
  | "facility_defense"
  | "facility_repair"
  | "frontline_response"
  | "enemy_screen"
  | "frontline_transfer"
  | "facility_transfer"
  | "facility_anchor";

export type BattleActionReason =
  | "awaiting_orders"
  | "holding_anchor"
  | "returning_anchor"
  | "firing_target"
  | "advancing"
  | "flanking"
  | "falling_back"
  | "retreating"
  | "moving_to_facility"
  | "moving_to_supply"
  | "resupplying"
  | "moving_to_repair"
  | "repairing_structure"
  | "recovering"
  | "destroyed";

export interface StandingOrder {
  anchor: BattlePosition;
  controlRadius: number;
  frontlineSegmentId?: string;
  facingDeg?: number;
  posture: StandingPosture;
  targetPriority: TargetPriority;
  ammoPolicy: AmmoPolicy;
  fallback: {
    enabled: boolean;
    moraleBelow?: number;
    soldiersBelowRatio?: number;
    ammoBelow?: number;
    destination: BattlePosition;
  };
  facilityAssignment?: {
    structureId: string;
    mode: FacilityAssignmentMode;
  };
}

export interface StandingOrderTemplate {
  id: string;
  name: string;
  description: string;
  standingOrder: StandingOrder;
  frontlineSketchPoints?: BattlePosition[];
  createdFromUnitId?: string;
  updatedAt: string;
}

export type BattleEngagementKind = "rifle" | "artillery" | "melee" | "structure";

export interface BattleEngagement {
  id: string;
  fromId: string;
  toId: string;
  from: BattlePosition;
  to: BattlePosition;
  kind: BattleEngagementKind;
  intensity: number;
}

export type FireMissionScope = "selected_unit" | "frontline_segment";

export interface BattleFireMission {
  id: string;
  targetId: string;
  targetName: string;
  scope: FireMissionScope;
  unitIds: string[];
  issuedAt: number;
  expiresAt: number;
  fireMultiplier: number;
  ammoMultiplier: number;
  conditionCost: number;
  disciplineLabel?: string;
  sourcePlanId?: string;
  sourcePlanStageId?: string;
}

export type BattleFirePlanStageStatus = "pending" | "active" | "completed" | "skipped";

export interface BattleFirePlanStage {
  id: string;
  targetId: string;
  targetName: string;
  scope: FireMissionScope;
  unitIds: string[];
  startAt: number;
  durationSeconds: number;
  status: BattleFirePlanStageStatus;
  fireMissionId?: string;
}

export interface BattleFirePlan {
  id: string;
  name: string;
  issuedByUnitId: string;
  issuedAt: number;
  stages: BattleFirePlanStage[];
}

export interface BattleFormation {
  frontageWidth: number;
  depth: number;
  fireArcDeg: number;
  facingDeg: number;
  density: number;
  overlapPressure: number;
}

export type EnemyAssaultMode = "mass_push" | "rifle_screen" | "breacher" | "command_drive";
export type EnemyCommandState = "none" | "commanded" | "disrupted";
export type EnemyCommandRole = "none" | "assault_group" | "command_node";
export type EnemyCommandTier = "none" | "wave_command" | "assault_lead" | "support_node" | "line_group";
export type EnemyCommandIntent = "press_line" | "flank_line" | "breach_works" | "fire_support" | "rally_wave";
export type EnemyMoraleState = "steady" | "wavering" | "routing" | "regrouping";
export type EnemyAssaultPhase = "approach" | "engaged" | "flanking" | "breakthrough" | "overextended";

export interface EnemyAssaultPlan {
  mode: EnemyAssaultMode;
  targetSegmentId?: string;
  targetStructureId?: string;
  targetName: string;
  phase: EnemyAssaultPhase;
  penetrationDepth: number;
  flankPressure: number;
  commandState: EnemyCommandState;
  commandInfluence: number;
  commandSourceId?: string;
  commandRole: EnemyCommandRole;
  commandTier: EnemyCommandTier;
  commandParentId?: string;
  commandIntent: EnemyCommandIntent;
  commandGroupId?: string;
  commandLabel?: string;
  morale: number;
  moraleState: EnemyMoraleState;
  laneSpread: number;
  frontageWidth: number;
  depth: number;
  cohesion: number;
  vector: BattlePosition;
}

export interface BattleUnit {
  unitId: string;
  name: string;
  type: UnitType;
  soldiers: number;
  maxSoldiers: number;
  morale: number;
  condition: number;
  ammo: number;
  weaponKey?: string;
  weaponQuality: number;
  officerId: string;
  officerName?: string;
  officerCommandSummary?: string;
  tacticalLessonSummary?: string;
  tacticalLessonPreferredDoctrineId?: string;
  tacticalLessonPreferredDoctrineLabel?: string;
  divisionName?: string;
  divisionCommanderOfficerId?: string;
  divisionCommanderName?: string;
  divisionCommandSummary?: string;
  deploymentMitigationRole?: "weak_line_focus" | "support_reserve";
  objectiveResponseRole?: ObjectiveResponseRole;
  enemyCommandActionRole?: EnemyCommandActionRole;
  frontlineRotationRole?: FrontlineRotationRole;
  facilityResponseRole?: FacilityResponseRole;
  mapInspectionResponseRole?: MapInspectionResponseRole;
  order: UnitOrder;
  casualtiesThisBattle: number;
  xpGained: number;
  position: BattlePosition;
  range: number;
  firepower: number;
  fireRate: number;
  weaponName: string;
  formation: BattleFormation;
  standingOrder: StandingOrder;
  focusTargetId?: string;
  fireMissionId?: string;
  volleyUntilSeconds?: number;
  volleyCooldownUntilSeconds?: number;
  pendingOrder?: {
    id: string;
    label: string;
    detail: string;
    reasons?: string[];
    issuedAt: number;
    arrivesAt: number;
    delaySeconds: number;
    congestionDelaySeconds?: number;
  };
  commandTransmissionEvents?: BattleCommandTransmissionEvent[];
  reserveReadiness: number;
  currentTargetId?: string;
  actionReason: BattleActionReason;
  lastDamageDealt: number;
  isMoving: boolean;
}

export interface BattleCommandTransmissionEvent {
  id: string;
  label: string;
  detail: string;
  reasons: string[];
  issuedAt: number;
  arrivesAt: number;
  delaySeconds: number;
  congestionDelaySeconds: number;
  arrivedAt?: number;
}

export interface EnemyBattleUnit {
  id: string;
  type: "undeadMob" | "undeadRiflemen" | "brute" | "undeadOfficer";
  name: string;
  count: number;
  pressure: number;
  moraleShock: number;
  position: BattlePosition;
  destination: BattlePosition;
  assaultPlan: EnemyAssaultPlan;
  speed: number;
  range: number;
  isSpotted: boolean;
  concealment: number;
  currentTargetId?: string;
  isMoving: boolean;
}

export interface BattleStructure extends FortificationInstance {
  position: BattlePosition;
  range: number;
  firepower: number;
  blockedRadius: number;
  tacticalPressure: number;
  repairRate: number;
  assignedUnitIds: string[];
  facilityState: "secure" | "under_pressure" | "being_repaired" | "contested" | "overrun";
  facilityStateLabel: string;
  currentTargetId?: string;
}

export interface BattleObjectiveState {
  holdSecondsRequired: number;
  lineIntegrity: number;
  enemySuppression: number;
  victoryControl: number;
  supplyControl: number;
  visibilityControl: number;
  objectivePressure: number;
  tacticalEffects: BattleObjectiveTacticalEffects;
}

export interface BattleObjectiveTacticalEffects {
  victoryLineIntegrityModifier: number;
  supplyAmmoRecoveryModifier: number;
  fireMissionAmmoMultiplier: number;
  visibilitySpottingBonus: number;
  visibilitySuppressionBonus: number;
  eventLineIntegrityModifier: number;
  eventAmmoRecoveryModifier: number;
  eventSpottingModifier: number;
  waveIntelClarity: "clear" | "strained" | "blind";
  waveIntelLabel: string;
  eventSummary: string;
  summary: string;
}

export type BattleObjectiveNodeType = "victory" | "supply" | "visibility";
export type BattleObjectiveControl = "player" | "contested" | "enemy";
export type BattleObjectiveEventSeverity = "stable" | "strained" | "critical";

export interface BattleObjectiveScenario {
  id: string;
  label: string;
  tagline: string;
  effectSummary: string;
  playerPresenceMultiplier: number;
  enemyPresenceMultiplier: number;
  controlDriftMultiplier: number;
  pressureMultiplier: number;
}

export interface BattleObjectiveEventState {
  id: string;
  label: string;
  detail: string;
  severity: BattleObjectiveEventSeverity;
  effectSummary: string;
  degradationSeconds: number;
  chainStage: number;
  chainLabel: string;
  chainDetail: string;
  chainEffectSummary: string;
}

export interface BattleObjectiveNode {
  id: string;
  type: BattleObjectiveNodeType;
  label: string;
  scenario: BattleObjectiveScenario;
  eventState: BattleObjectiveEventState;
  position: BattlePosition;
  radius: number;
  control: BattleObjectiveControl;
  controlProgress: number;
  playerPresence: number;
  enemyPresence: number;
}

export interface StaffAdvisoryResponse {
  id: string;
  issuedAt: number;
  segmentId: string;
  segmentName: string;
  presetId: string;
  presetLabel: string;
  reason: string;
  unitIds: string[];
  pressureAtIssue: number;
  leadThreatLabel?: string;
  forecast: {
    casualtyRisk: "低" | "中" | "高";
    ammoBurn: "低" | "中" | "高";
    lineRisk: "低" | "中" | "高";
  };
}

export interface StaffAdvisoryOutcome extends StaffAdvisoryResponse {
  unitNames: string[];
  finalLineIntegrity: number;
  resultLabel: "戦線維持に寄与" | "撤退支援" | "対応及ばず";
  summary: string;
}

export interface ObjectiveEventResponseOutcome {
  id: string;
  unitId: string;
  unitName: string;
  objectiveType: BattleObjectiveNodeType;
  objectiveLabel: string;
  roleLabel: string;
  eventLabel: string;
  eventChainLabel: string;
  eventChainStage: number;
  finalControl: number;
  finalSeverity: BattleObjectiveEventSeverity;
  resultLabel: "再確保" | "遅滞" | "未回復";
  assessmentReason: string;
  lessonTag: string;
  summary: string;
}

export interface ObjectiveBattleOutcome {
  victoryControl: number;
  supplyControl: number;
  visibilityControl: number;
  victoryLabel: "勝利点保持" | "勝利点係争" | "勝利点喪失";
  supplyLabel: "補給点保持" | "補給点係争" | "補給点喪失";
  visibilityLabel: "視界点保持" | "視界点係争" | "視界点喪失";
  supplySpentDelta: number;
  resourceDelta: ResourceCost;
  enemyPressureDelta: number;
  enemyMomentumDelta: number;
  globalThreatDelta: number;
  intelConfidenceShift: 0 | 1;
  events: string[];
}

export interface BattleMedicalRecoveryDetail {
  unitId: string;
  unitName: string;
  baseRecovered: number;
  bonusRecovered: number;
  effectiveRecoveryRate: number;
  sourceLabel: string;
  reason: string;
}

export interface BattleStaffAccountabilityContext {
  slotId: StaffSlotId;
  slotLabel: string;
  officerId?: string;
  officerName?: string;
}

export interface StaffAccountabilityEvent extends BattleStaffAccountabilityContext {
  id: string;
  resultLabel: "功績" | "警告" | "責任";
  triggerLabel: string;
  reason: string;
  lessonTag: string;
  xpDelta: number;
  fatigueDelta: number;
  summary: string;
}

export interface WithdrawalRearGuardPlanAssessment {
  unitId: string;
  unitName: string;
  predictedCasualties: number;
  predictedOfficerRisk: number;
  pursuitCover: number;
  preservationScore: number;
  recommendationScore: number;
  tradeoffLabel: string;
  reason: string;
}

export interface BattleState {
  scenario: BattleScenario;
  elapsedSeconds: number;
  speed: 0 | 1 | 2 | 3;
  status: BattleStatus;
  mapBounds: BattleMapBounds;
  frontlineSegments: FrontlineSegment[];
  frontlineGeometry?: FrontlineGeometryAdjustment;
  terrainZones: BattleTerrainZone[];
  chokePoints: BattleChokePoint[];
  playerUnits: BattleUnit[];
  enemyUnits: EnemyBattleUnit[];
  structures: BattleStructure[];
  objectiveNodes: BattleObjectiveNode[];
  engagements: BattleEngagement[];
  fireDiscipline?: FireDisciplineProfile;
  strategicDoctrine?: StrategicDoctrineProfile;
  reserveDoctrine?: ReserveDoctrinePlan;
  commandIssuePlan?: CommandIssuePlan;
  commandPost?: BattleCommandPostProfile;
  fireMissions?: BattleFireMission[];
  firePlans?: BattleFirePlan[];
  staffAccountabilityContext: BattleStaffAccountabilityContext[];
  staffAdvisoryResponses: StaffAdvisoryResponse[];
  withdrawalRearGuardPlanAssessments?: WithdrawalRearGuardPlanAssessment[];
  wavesSpawned: number;
  log: string[];
  objectiveState: BattleObjectiveState;
}

export interface BattleResult {
  id: string;
  title: string;
  outcome: "hold" | "withdraw" | "collapse";
  turnNumber: number;
  rawCasualtiesByUnit: Record<string, number>;
  casualtiesByUnit: Record<string, number>;
  recoveredByUnit: Record<string, number>;
  unitNamesById: Record<string, string>;
  xpByUnit: Record<string, number>;
  battleRoleByUnit: Record<string, string>;
  commendationsByUnit: Record<string, string[]>;
  withdrawalRearGuard: {
    unitId: string;
    unitName: string;
    roleLabel: string;
    pursuitDamagePrevented: number;
    rearGuardCasualties: number;
    riskLabel: "軽微" | "消耗" | "危険";
    eventLabel: string;
    reason: string;
  }[];
  withdrawalRearGuardPlanAssessments: WithdrawalRearGuardPlanAssessment[];
  withdrawalPursuitSummary?: string;
  officerEvents: string[];
  divisionCommanderEvents: string[];
  intelligenceEvents: string[];
  commandTransmissionOutcomes: {
    id: string;
    unitId: string;
    unitName: string;
    orderLabel: string;
    delaySeconds: number;
    congestionDelaySeconds: number;
    arrived: boolean;
    reasons: string[];
    assessment: "円滑" | "遅延" | "混線";
    summary: string;
  }[];
  staffAccountabilityEvents: StaffAccountabilityEvent[];
  staffAdvisoryOutcomes: StaffAdvisoryOutcome[];
  enemyCommandEffectOutcomes: {
    id: string;
    unitIds: string[];
    unitNames: string[];
    roleLabel: "敵指揮核制圧" | "敵継承遮断" | "敵崩壊追撃" | "指揮網予備投入";
    resultLabel:
      | "指揮低下"
      | "制圧完了"
      | "継承遮断"
      | "効果限定"
      | "再集結抑止"
      | "掃討"
      | "追撃継続"
      | "封鎖安定"
      | "戦線保持"
      | "圧力過大";
    effectLabel: string;
    metricLabel: string;
    lessonTag: string;
    assessmentReason: string;
  }[];
  objectiveEventResponseOutcomes: ObjectiveEventResponseOutcome[];
  objectiveOutcome: ObjectiveBattleOutcome;
  officerXpById: Record<string, number>;
  divisionCommanderXpById: Record<string, number>;
  intelligenceLessonOfficerIds: string[];
  woundedOfficerIds: string[];
  divisionCommanderWoundedOfficerIds: string[];
  officerRiskById: Record<string, number>;
  divisionCommanderRiskById: Record<string, number>;
  officerUnitNamesById: Record<string, string>;
  divisionCommanderNamesById: Record<string, string>;
  ammoSpent: number;
  supplySpent: number;
  medicalSupplySpent: number;
  medicalRecoveryRate: number;
  medicalRecoveryDetails: BattleMedicalRecoveryDetail[];
  capturedWeapons: Record<string, number>;
  equipmentWearByUnit: Record<string, number>;
  enemySuppression: number;
  structureDamage: Record<string, number>;
  campaignMessage: string;
}
