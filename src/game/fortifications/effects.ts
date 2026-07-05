import { fortificationDefinitions } from "../../content/baseGame/structures";
import type { StrategicDoctrineProfile } from "../doctrine/types";
import type { FortificationEffect, FortificationInstance } from "./types";

export const emptyFortificationEffect: FortificationEffect = {
  cover: 0,
  morale: 0,
  ammoRecovery: 0,
  enemySlow: 0,
  visibility: 0,
  casualtyRecovery: 0,
};

export const summarizeFortificationEffects = (
  structures: FortificationInstance[],
  doctrine?: StrategicDoctrineProfile,
): FortificationEffect => {
  const doctrineMultiplier = doctrine?.fortificationEffectMultiplier ?? 1;
  const rawEffects = structures
    .filter((structure) => structure.status === "built" || structure.status === "damaged")
    .reduce(
      (total, structure) => {
        const effect = fortificationDefinitions[structure.type].effects;
        const durabilityFactor = Math.max(0.25, structure.durability / structure.maxDurability);
        return {
          cover: total.cover + effect.cover * durabilityFactor,
          morale: total.morale + effect.morale * durabilityFactor,
          ammoRecovery: total.ammoRecovery + effect.ammoRecovery * durabilityFactor,
          enemySlow: total.enemySlow + effect.enemySlow * durabilityFactor,
          visibility: total.visibility + effect.visibility * durabilityFactor,
          casualtyRecovery: total.casualtyRecovery + effect.casualtyRecovery * durabilityFactor,
        };
      },
      { ...emptyFortificationEffect },
    );
  return {
    cover: rawEffects.cover * doctrineMultiplier,
    morale: rawEffects.morale * doctrineMultiplier,
    ammoRecovery: rawEffects.ammoRecovery * doctrineMultiplier,
    enemySlow: rawEffects.enemySlow * doctrineMultiplier,
    visibility: rawEffects.visibility * doctrineMultiplier,
    casualtyRecovery: rawEffects.casualtyRecovery * doctrineMultiplier,
  };
};
