import type { ResourceCost } from "../logistics/spend";

export type FortificationType = "trench" | "barricade" | "supplyDepot" | "observationPost" | "fieldHospital";
export type FortificationStatus = "planned" | "built" | "damaged" | "overrun" | "abandoned";

export interface FortificationEffect {
  cover: number;
  morale: number;
  ammoRecovery: number;
  enemySlow: number;
  visibility: number;
  casualtyRecovery: number;
}

export interface FortificationDefinition {
  id: FortificationType;
  name: string;
  buildCost: ResourceCost;
  repairCost: ResourceCost;
  maxDurability: number;
  effects: FortificationEffect;
}

export interface FortificationInstance {
  id: string;
  type: FortificationType;
  sectorId: string;
  mapNodeId: string;
  durability: number;
  maxDurability: number;
  level: number;
  status: FortificationStatus;
  history: string[];
}
