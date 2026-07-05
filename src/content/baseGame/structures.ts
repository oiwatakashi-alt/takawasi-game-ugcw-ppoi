import type { FortificationDefinition, FortificationType } from "../../game/fortifications/types";

export const fortificationDefinitions: Record<FortificationType, FortificationDefinition> = {
  trench: {
    id: "trench",
    name: "塹壕線",
    buildCost: { materials: 80, engineerLabor: 18 },
    repairCost: { materials: 30, engineerLabor: 8 },
    maxDurability: 100,
    effects: { cover: 18, morale: 8, ammoRecovery: 0, enemySlow: 6, visibility: 0, casualtyRecovery: 0 },
  },
  barricade: {
    id: "barricade",
    name: "バリケード",
    buildCost: { materials: 42, engineerLabor: 10 },
    repairCost: { materials: 16, engineerLabor: 5 },
    maxDurability: 70,
    effects: { cover: 8, morale: 3, ammoRecovery: 0, enemySlow: 14, visibility: 0, casualtyRecovery: 0 },
  },
  supplyDepot: {
    id: "supplyDepot",
    name: "補給所",
    buildCost: { materials: 64, supplies: 35, engineerLabor: 12 },
    repairCost: { materials: 20, supplies: 12, engineerLabor: 6 },
    maxDurability: 85,
    effects: { cover: 2, morale: 2, ammoRecovery: 12, enemySlow: 0, visibility: 0, casualtyRecovery: 0 },
  },
  observationPost: {
    id: "observationPost",
    name: "観測所",
    buildCost: { materials: 54, engineerLabor: 14 },
    repairCost: { materials: 18, engineerLabor: 6 },
    maxDurability: 62,
    effects: { cover: 2, morale: 2, ammoRecovery: 0, enemySlow: 0, visibility: 18, casualtyRecovery: 0 },
  },
  fieldHospital: {
    id: "fieldHospital",
    name: "野戦病院",
    buildCost: { materials: 72, supplies: 44, engineerLabor: 16 },
    repairCost: { materials: 22, supplies: 18, engineerLabor: 7 },
    maxDurability: 74,
    effects: { cover: 1, morale: 4, ammoRecovery: 0, enemySlow: 0, visibility: 0, casualtyRecovery: 20 },
  },
};
