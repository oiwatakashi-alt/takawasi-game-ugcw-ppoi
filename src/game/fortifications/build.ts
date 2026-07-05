import { fortificationDefinitions } from "../../content/baseGame/structures";
import type { FortificationInstance, FortificationType } from "./types";
import type { StrategicDoctrineProfile } from "../doctrine/types";
import type { ResourceBundle, ResourceKey } from "../logistics/types";
import { canAfford, spendResources } from "../logistics/spend";

export interface BuildFortificationResult {
  structure?: FortificationInstance;
  resources: ResourceBundle;
  message: string;
}

export const applyEngineeringDoctrineCost = (
  cost: Partial<ResourceBundle>,
  doctrine?: StrategicDoctrineProfile,
): Partial<ResourceBundle> => {
  const multiplier = doctrine?.engineeringCostMultiplier ?? 1;
  if (multiplier === 1) {
    return cost;
  }
  const scaledCost: Partial<ResourceBundle> = {};
  (Object.keys(cost) as ResourceKey[]).forEach((key) => {
    const value = cost[key];
    if (typeof value === "number" && value > 0) {
      scaledCost[key] = Math.max(1, Math.ceil(value * multiplier));
    }
  });
  return scaledCost;
};

export const buildFortification = (
  sectorId: string,
  type: FortificationType,
  resources: ResourceBundle,
  doctrine?: StrategicDoctrineProfile,
): BuildFortificationResult => {
  const definition = fortificationDefinitions[type];
  const buildCost = applyEngineeringDoctrineCost(definition.buildCost, doctrine);
  if (!canAfford(resources, buildCost)) {
    return { resources, message: `${definition.name}の建設資源が足りない。` };
  }

  return {
    resources: spendResources(resources, buildCost),
    structure: {
      id: `${type}-${sectorId}-${Date.now()}`,
      type,
      sectorId,
      mapNodeId: `${sectorId}-line-${type}`,
      durability: definition.maxDurability,
      maxDurability: definition.maxDurability,
      level: 1,
      status: "built",
      history: [`${definition.name}を建設`],
    },
    message: `${definition.name}を建設した${doctrine?.engineeringCostMultiplier && doctrine.engineeringCostMultiplier < 1 ? "（野戦工兵で資源節約）" : ""}。`,
  };
};

export const repairFortification = (
  structure: FortificationInstance,
  resources: ResourceBundle,
  doctrine?: StrategicDoctrineProfile,
): { structure: FortificationInstance; resources: ResourceBundle; message: string } => {
  const definition = fortificationDefinitions[structure.type];
  if (structure.status === "overrun" || structure.status === "abandoned") {
    return { structure, resources, message: `${definition.name}は現在修理できない。` };
  }
  const repairCost = applyEngineeringDoctrineCost(definition.repairCost, doctrine);
  if (!canAfford(resources, repairCost)) {
    return { structure, resources, message: `${definition.name}の修理資源が足りない。` };
  }
  const repairAmount = 30 + (doctrine?.repairAmountBonus ?? 0);
  return {
    structure: {
      ...structure,
      durability: Math.min(structure.maxDurability, structure.durability + repairAmount),
      status: "built",
      history: [`${definition.name}を修理`, ...structure.history].slice(0, 6),
    },
    resources: spendResources(resources, repairCost),
    message: `${definition.name}を修理した${repairAmount > 30 ? `（耐久+${repairAmount}）` : ""}。`,
  };
};
