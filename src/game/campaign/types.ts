import type { ArmyState } from "../army/types";
import type { DoctrineState } from "../doctrine/types";
import type { ResourceBundle } from "../logistics/types";
import type { Officer } from "../officers/types";
import type { StrategicTurn, TheaterState } from "../theater/types";
import type { FrontlineGeometryAdjustment, StandingOrder, StandingOrderTemplate } from "../battle/types";

export type ReserveDoctrineMode = "balanced" | "prepared_counterstroke" | "elastic_reserve" | "fire_support_pool";
export type CommandIssueMode = "standard_queue" | "split_batches" | "strict_direct";

export interface ReserveDoctrinePlan {
  mode: ReserveDoctrineMode;
  holdReadinessUntilPressure: number;
  counterstrokeReadinessThreshold: number;
  notes: string;
}

export interface CommandIssuePlan {
  mode: CommandIssueMode;
  maxBatchSize: number;
  notes: string;
}

export interface BattleHistoryEntry {
  id: string;
  title: string;
  outcome: string;
  turnNumber: number;
  summary: string;
}

export interface DeploymentBattlePlan {
  operationId: string;
  sectorId: string;
  frontlineGeometry: FrontlineGeometryAdjustment;
  reserveDoctrine?: ReserveDoctrinePlan;
  commandIssuePlan?: CommandIssuePlan;
  reserveUnitIds?: string[];
  rearGuardUnitIds?: string[];
  updatedAt: string;
}

export interface StandingOrderPlanSetEntry {
  unitId: string;
  unitName: string;
  standingOrder: StandingOrder;
}

export interface StandingOrderPlanSet {
  id: string;
  name: string;
  description: string;
  operationId: string;
  sectorId: string;
  frontlineGeometry: FrontlineGeometryAdjustment;
  reserveDoctrine?: ReserveDoctrinePlan;
  commandIssuePlan?: CommandIssuePlan;
  reserveUnitIds: string[];
  rearGuardUnitIds?: string[];
  entries: StandingOrderPlanSetEntry[];
  updatedAt: string;
}

export interface CampaignState {
  id: string;
  turnNumber: number;
  resources: ResourceBundle;
  army: ArmyState;
  officers: Officer[];
  theater: TheaterState;
  doctrines: DoctrineState;
  standingOrderTemplates: StandingOrderTemplate[];
  standingOrderPlanSets: StandingOrderPlanSet[];
  deploymentPlan?: DeploymentBattlePlan;
  battleHistory: BattleHistoryEntry[];
  activeStrategicTurn: StrategicTurn;
  saveVersion: number;
  lastMessage: string;
}
