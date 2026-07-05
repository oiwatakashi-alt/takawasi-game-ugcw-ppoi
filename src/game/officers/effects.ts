import type { UnitType } from "../army/types";
import type { Officer, OfficerRank } from "./types";

export interface OfficerCommandProfile {
  officerName: string;
  rank: OfficerRank;
  commandCapacity: number;
  commandLoad: number;
  commandOverload: number;
  moraleBonus: number;
  conditionBonus: number;
  ammoBonus: number;
  controlRadiusBonus: number;
  reserveReadinessBonus: number;
  rangeMultiplier: number;
  firepowerMultiplier: number;
  fireRateMultiplier: number;
  fallbackMoraleModifier: number;
  summary: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const rankProfile: Record<
  OfficerRank,
  Pick<
    OfficerCommandProfile,
    "commandCapacity" | "moraleBonus" | "conditionBonus" | "ammoBonus" | "controlRadiusBonus" | "reserveReadinessBonus"
  >
> = {
  Captain: { commandCapacity: 420, moraleBonus: 1, conditionBonus: 1, ammoBonus: 0, controlRadiusBonus: 0, reserveReadinessBonus: 2 },
  Major: { commandCapacity: 720, moraleBonus: 2, conditionBonus: 2, ammoBonus: 1, controlRadiusBonus: 1, reserveReadinessBonus: 4 },
  Colonel: { commandCapacity: 980, moraleBonus: 3, conditionBonus: 3, ammoBonus: 2, controlRadiusBonus: 2, reserveReadinessBonus: 7 },
  General: { commandCapacity: 1400, moraleBonus: 4, conditionBonus: 4, ammoBonus: 3, controlRadiusBonus: 3, reserveReadinessBonus: 10 },
};

const unitMatchesTrait = (unitType: UnitType, trait: string): boolean => {
  if (trait === "散兵指揮" || trait === "哨戒") {
    return unitType === "jaeger";
  }
  if (trait === "砲兵運用" || trait === "火力支援") {
    return unitType === "artillery";
  }
  if (trait === "工兵指揮" || trait === "野戦架橋") {
    return unitType === "engineer";
  }
  if (trait === "戦列保持" || trait === "塹壕戦" || trait === "規律重視" || trait === "予備指揮") {
    return unitType === "infantry" || unitType === "engineer";
  }
  return true;
};

export const officerCommandProfile = (
  officer: Officer | undefined,
  unitType: UnitType,
  commandLoad = 0,
  headquartersCommandCapacityBonus = 0,
  commandDutyLoad = 0,
  commandDutySummary?: string,
): OfficerCommandProfile | undefined => {
  if (!officer || officer.status !== "active") {
    return undefined;
  }
  const rank = rankProfile[officer.rank];
  const profile: OfficerCommandProfile = {
    officerName: officer.name,
    rank: officer.rank,
    commandCapacity: Math.max(120, rank.commandCapacity + headquartersCommandCapacityBonus - commandDutyLoad),
    commandLoad,
    commandOverload: 0,
    moraleBonus: rank.moraleBonus,
    conditionBonus: rank.conditionBonus,
    ammoBonus: rank.ammoBonus,
    controlRadiusBonus: rank.controlRadiusBonus,
    reserveReadinessBonus: rank.reserveReadinessBonus,
    rangeMultiplier: 1,
    firepowerMultiplier: 1,
    fireRateMultiplier: 1,
    fallbackMoraleModifier: 0,
    summary: [`階級指揮 士気+${rank.moraleBonus} 即応+${rank.reserveReadinessBonus}`],
  };

  if (headquartersCommandCapacityBonus > 0) {
    profile.summary.push(`司令部 容量+${headquartersCommandCapacityBonus}`);
  }
  if (commandDutyLoad > 0) {
    profile.summary.push(commandDutySummary ?? `参謀兼任 負荷-${commandDutyLoad}`);
  }

  const fatiguePenalty = clamp(Math.floor((officer.commandFatigue ?? 0) / 18), 0, 5);
  if (fatiguePenalty > 0) {
    profile.moraleBonus -= fatiguePenalty;
    profile.conditionBonus -= fatiguePenalty;
    profile.controlRadiusBonus -= Math.ceil(fatiguePenalty / 2);
    profile.reserveReadinessBonus -= fatiguePenalty;
    profile.fallbackMoraleModifier += Math.ceil(fatiguePenalty / 2);
    profile.summary.push(`指揮疲労 ${officer.commandFatigue} 士気-${fatiguePenalty}`);
  }

  for (const trait of officer.traits) {
    if (!unitMatchesTrait(unitType, trait)) {
      continue;
    }
    if (trait === "規律重視") {
      profile.moraleBonus += 3;
      profile.commandCapacity += 90;
      profile.fallbackMoraleModifier -= 3;
      profile.summary.push("規律: 士気+3 容量+90 後退遅延");
    } else if (trait === "散兵指揮") {
      profile.commandCapacity += 70;
      profile.rangeMultiplier *= 1.06;
      profile.fireRateMultiplier *= 1.03;
      profile.summary.push("散兵: 射程+6% 連射+3% 容量+70");
    } else if (trait === "砲兵運用") {
      profile.commandCapacity += 80;
      profile.firepowerMultiplier *= 1.08;
      profile.rangeMultiplier *= 1.04;
      profile.summary.push("砲兵: 火力+8% 射程+4% 容量+80");
    } else if (trait === "工兵指揮") {
      profile.commandCapacity += 80;
      profile.conditionBonus += 3;
      profile.controlRadiusBonus += 2;
      profile.summary.push("工兵: 疲労回復+3 統制+2 容量+80");
    } else if (trait === "戦列保持") {
      profile.commandCapacity += 120;
      profile.moraleBonus += 3;
      profile.conditionBonus += 2;
      profile.summary.push("戦列: 士気+3 疲労回復+2 容量+120");
    } else if (trait === "塹壕戦") {
      profile.commandCapacity += 110;
      profile.controlRadiusBonus += 2;
      profile.fallbackMoraleModifier -= 4;
      profile.summary.push("塹壕: 統制+2 容量+110 後退遅延");
    } else if (trait === "火力支援") {
      profile.commandCapacity += 70;
      profile.fireRateMultiplier *= 1.06;
      profile.reserveReadinessBonus += 4;
      profile.summary.push("火力支援: 連射+6% 即応+4 容量+70");
    } else if (trait === "哨戒") {
      profile.commandCapacity += 60;
      profile.rangeMultiplier *= 1.04;
      profile.reserveReadinessBonus += 2;
      profile.summary.push("哨戒: 射程+4% 即応+2 容量+60");
    } else if (trait === "予備指揮") {
      profile.commandCapacity += 160;
      profile.reserveReadinessBonus += 12;
      profile.controlRadiusBonus += 2;
      profile.summary.push("予備: 即応+12 統制+2 容量+160");
    } else if (trait === "野戦架橋") {
      profile.commandCapacity += 60;
      profile.conditionBonus += 3;
      profile.controlRadiusBonus += 1;
      profile.summary.push("架橋: 疲労回復+3 統制+1 容量+60");
    }
  }

  const commandOverload = Math.max(0, commandLoad - profile.commandCapacity);
  if (commandLoad > 0) {
    profile.summary.splice(1, 0, `指揮容量 ${commandLoad}/${profile.commandCapacity}`);
  }
  if (commandOverload > 0) {
    const overloadPenalty = clamp(Math.ceil(commandOverload / 85), 1, 12);
    profile.commandOverload = commandOverload;
    profile.moraleBonus -= overloadPenalty;
    profile.conditionBonus -= Math.ceil(overloadPenalty / 2);
    profile.controlRadiusBonus -= Math.ceil(overloadPenalty / 4);
    profile.reserveReadinessBonus -= overloadPenalty;
    profile.fallbackMoraleModifier += Math.ceil(overloadPenalty / 2);
    profile.summary.push(`指揮過負荷 ${commandOverload} 士気-${overloadPenalty}`);
  }

  return {
    ...profile,
    rangeMultiplier: Number(profile.rangeMultiplier.toFixed(3)),
    firepowerMultiplier: Number(profile.firepowerMultiplier.toFixed(3)),
    fireRateMultiplier: Number(profile.fireRateMultiplier.toFixed(3)),
    summary: profile.summary.slice(0, 5),
  };
};

export const officerCommandSummary = (profile: OfficerCommandProfile | undefined): string =>
  profile ? profile.summary.join(" / ") : "指揮効果なし";
