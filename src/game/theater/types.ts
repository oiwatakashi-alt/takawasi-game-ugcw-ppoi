import type { FortificationInstance } from "../fortifications/types";
import type { ResourceCost } from "../logistics/spend";
import type { EnemyCompositionIntel } from "./enemyIntel";

export type TheaterBand =
  | "homeCoreDefense"
  | "forwardDefense"
  | "activeFront"
  | "enemyVanguard"
  | "enemyHeartland";

export type SectorControl = "player" | "contested" | "enemy";

export interface Sector {
  id: string;
  name: string;
  band: TheaterBand;
  control: SectorControl;
  terrainTags: string[];
  fortificationSlots: number;
  structures: FortificationInstance[];
  supplyValue: number;
  railValue: number;
  medicalValue: number;
  engineerValue: number;
  enemyPressure: number;
  corruptionLevel: number;
  battleTemplates: string[];
  linkedSectors: string[];
  history: string[];
}

export type OperationType =
  | "holdSector"
  | "counterattack"
  | "reconPatrol"
  | "engineerWorks"
  | "raidEnemyNest"
  | "railRepair";

export interface OperationEffects {
  resourceDelta?: ResourceCost;
  enemyPressureDelta?: number;
  enemyMomentumDelta?: number;
  initiativeDelta?: number;
  reputationDelta?: number;
  waveBudgetDelta?: number;
  structureRepair?: number;
}

export interface OperationSpoilsIntel {
  summary: string;
  confidence: "low" | "medium" | "high";
  expectedWeapons: Record<string, number>;
  expectedWeaponRange?: Record<string, { min: number; max: number }>;
  supplyCache?: {
    ammunition?: number;
    supplies?: number;
    materials?: number;
  };
  supplyCacheRange?: {
    ammunition?: { min: number; max: number };
    supplies?: { min: number; max: number };
    materials?: { min: number; max: number };
  };
  recoveryMultiplier?: number;
  revisedByOperationId?: string;
  reconQualityScore?: number;
  reconEffect?: "precise" | "confirmed" | "partial" | "misleading";
}

export interface StrategicOperation {
  id: string;
  title: string;
  type: OperationType;
  sectorId: string;
  isMandatory: boolean;
  canAutoResolve: boolean;
  risk: number;
  cost: ResourceCost;
  assignedForces: {
    unitIds: string[];
    officerIds: string[];
    resources?: ResourceCost;
  };
  victoryEffects: OperationEffects;
  drawEffects: OperationEffects;
  defeatEffects: OperationEffects;
  spoilsIntel?: OperationSpoilsIntel;
  enemyCompositionIntel?: EnemyCompositionIntel;
  linkedMainBattleId?: string;
  resolved?: boolean;
  outcome?: "victory" | "draw" | "defeat";
}

export interface StrategicTurn {
  turnNumber: number;
  mandatoryBattle: StrategicOperation;
  sideOperations: StrategicOperation[];
  threatForecast: string;
}

export interface TheaterState {
  currentFrontBand: TheaterBand;
  playerArmyPositionSectorId: string;
  rearPressureSectorIds: string[];
  forwardPressureSectorIds: string[];
  sectors: Sector[];
  globalThreat: number;
  enemyMomentum: number;
  playerStrategicInitiative: number;
  campaignChapter: string;
  turnNumber: number;
  activeOperations: StrategicOperation[];
  mandatoryBattle?: StrategicOperation;
  strategicHistory: string[];
}
