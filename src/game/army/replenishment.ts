import type { ArmyUnit } from "./types";
import type { StrategicDoctrineProfile } from "../doctrine/types";
import type { ResourceBundle } from "../logistics/types";

export type ReplenishmentMode = "rookie" | "veteran";

export interface ReplenishmentResult {
  unit: ArmyUnit;
  resources: ResourceBundle;
  message: string;
}

export const replenishUnit = (
  unit: ArmyUnit,
  resources: ResourceBundle,
  mode: ReplenishmentMode,
  doctrine?: StrategicDoctrineProfile,
): ReplenishmentResult => {
  const missing = Math.max(0, unit.maxSoldiers - unit.soldiers);
  if (missing === 0) {
    return { unit, resources, message: `${unit.name}はすでに定員に達している。` };
  }

  if (mode === "rookie") {
    const added = Math.min(missing, resources.recruits);
    const dilution = added / unit.maxSoldiers;
    const dilutionMultiplier = doctrine?.replenishmentDilutionMultiplier ?? 1;
    return {
      unit: {
        ...unit,
        soldiers: unit.soldiers + added,
        experience: Math.max(0, unit.experience - Math.round(dilution * 12 * dilutionMultiplier)),
        morale: Math.max(35, unit.morale - Math.round(dilution * 8 * dilutionMultiplier)),
      },
      resources: { ...resources, recruits: resources.recruits - added },
      message: `${unit.name}に新兵${added}名を補充。練度は${dilutionMultiplier < 1 ? "訓練方針で緩やかに" : ""}低下した。`,
    };
  }

  const added = Math.min(missing, resources.veterans);
  const cost = Math.ceil(added * 1.8 * (doctrine?.veteranReplenishmentGoldMultiplier ?? 1));
  if (resources.gold < cost) {
    return { unit, resources, message: "古参兵補充に必要な軍資金が足りない。" };
  }

  return {
    unit: {
      ...unit,
      soldiers: unit.soldiers + added,
      morale: Math.min(100, unit.morale + 2),
    },
    resources: {
      ...resources,
      veterans: resources.veterans - added,
      gold: resources.gold - cost,
    },
    message: `${unit.name}に古参兵${added}名を補充。練度は維持された。`,
  };
};
