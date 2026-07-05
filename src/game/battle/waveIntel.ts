import type { EnemyCompositionThreatType } from "../theater/enemyIntel";
import { enemyCompositionIntelForOperation, riskPercentValue } from "../theater/enemyIntel";
import type { StrategicOperation } from "../theater/types";
import type { BattleWaveIntel, BattleWaveTimelineEntry } from "./types";

export interface BattleWaveIntelContext {
  operation: StrategicOperation;
  terrainTags: string[];
  enemyPressure: number;
  structureCount: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const threatIntensity = (
  threats: { type: EnemyCompositionThreatType; intensity: number }[],
  type: EnemyCompositionThreatType,
): number => threats.find((threat) => threat.type === type)?.intensity ?? 0;

const rangeCeiling = (
  ranges: Record<EnemyCompositionThreatType, { min: number; max: number }>,
  type: EnemyCompositionThreatType,
): number => ranges[type]?.max ?? 0;

const commandLikelihood = (
  waveNumber: number,
  commandWaveStart: number,
  commandWaveChance: number,
): BattleWaveTimelineEntry["commandLikelihood"] => {
  if (waveNumber < commandWaveStart) {
    return "none";
  }
  if (commandWaveChance >= 70) {
    return "high";
  }
  if (commandWaveChance >= 45) {
    return "medium";
  }
  return "low";
};

const commandLikelihoodLabels: Record<BattleWaveTimelineEntry["commandLikelihood"], string> = {
  none: "指揮なし",
  low: "指揮低",
  medium: "指揮中",
  high: "指揮高",
};

const timelineCertainty = (intel: ReturnType<typeof enemyCompositionIntelForOperation>): BattleWaveTimelineEntry["intelCertainty"] => {
  if (intel.reconEffect === "misleading") {
    return "misleading";
  }
  if (intel.reconEffect === "precise" || intel.reconEffect === "confirmed" || intel.confidence === "high") {
    return "confirmed";
  }
  if (intel.confidence === "medium" || intel.reconEffect === "partial") {
    return "estimated";
  }
  return "vague";
};

const secondDisplay = (second: number, certainty: BattleWaveTimelineEntry["intelCertainty"]): string => {
  if (certainty === "confirmed") {
    return `${second}秒`;
  }
  if (certainty === "estimated") {
    return `約${Math.max(1, Math.round(second / 5) * 5)}秒`;
  }
  return "時刻不明";
};

const enemyTypesDisplay = (enemyTypes: string[], certainty: BattleWaveTimelineEntry["intelCertainty"]): string => {
  if (certainty === "confirmed") {
    return enemyTypes.join("+");
  }
  if (certainty === "estimated") {
    return enemyTypes.slice(0, 2).join("+") + (enemyTypes.length > 2 ? "+他" : "");
  }
  if (certainty === "misleading") {
    return "敵種誤情報疑い";
  }
  return `${enemyTypes[0]}中心`;
};

const commandDisplay = (
  likelihood: BattleWaveTimelineEntry["commandLikelihood"],
  certainty: BattleWaveTimelineEntry["intelCertainty"],
): string => {
  if (certainty === "confirmed") {
    return commandLikelihoodLabels[likelihood];
  }
  if (certainty === "estimated") {
    return likelihood === "high" || likelihood === "medium" ? "指揮兆候" : "指揮不明";
  }
  if (certainty === "misleading") {
    return "指揮誤報疑い";
  }
  return "指揮不明";
};

const summaryDisplay = (
  firstWaveSecond: number,
  spawnIntervalSeconds: number,
  commandWaveChance: number,
  certainty: BattleWaveTimelineEntry["intelCertainty"],
): string => {
  if (certainty === "confirmed") {
    return `初波${firstWaveSecond}秒 / 間隔${spawnIntervalSeconds}秒 / 指揮波${commandWaveChance}%`;
  }
  if (certainty === "estimated") {
    return `初波${secondDisplay(firstWaveSecond, certainty)} / 間隔約${Math.round(spawnIntervalSeconds / 5) * 5}秒 / 指揮波推定`;
  }
  if (certainty === "misleading") {
    return "敵波情報に誤情報疑い / 実波要警戒";
  }
  return "敵波時刻不明 / 偵察不足";
};

const surpriseSummaryDisplay = (
  certainty: BattleWaveTimelineEntry["intelCertainty"],
  actualSpawnIntervalSeconds: number,
  actualCommandWaveChance: number,
): string | undefined => {
  if (certainty !== "misleading") {
    return undefined;
  }
  return `誤情報補正: 実波間隔${actualSpawnIntervalSeconds}秒 / 指揮波${actualCommandWaveChance}%へ悪化`;
};

const pressureLabel = (waveNumber: number, mobMultiplier: number, bruteMultiplier: number): string => {
  const pressure = waveNumber * 0.18 + mobMultiplier * 0.4 + bruteMultiplier * 0.45;
  if (pressure >= 2.2) {
    return "危険";
  }
  if (pressure >= 1.6) {
    return "強圧";
  }
  return "接近";
};

const createWaveTimeline = (
  firstWaveSecond: number,
  spawnIntervalSeconds: number,
  commandWaveStart: number,
  commandWaveChance: number,
  certainty: BattleWaveTimelineEntry["intelCertainty"],
  multipliers: Pick<
    BattleWaveIntel,
    "mobPressureMultiplier" | "riflemenPressureMultiplier" | "brutePressureMultiplier" | "officerPressureMultiplier"
  >,
): BattleWaveTimelineEntry[] =>
  Array.from({ length: 6 }, (_, index) => {
    const waveNumber = index + 1;
    const enemyTypes = ["群集"];
    if (waveNumber >= 2 || multipliers.riflemenPressureMultiplier >= 1.15) {
      enemyTypes.push("銃兵");
    }
    if (waveNumber >= 4 || (waveNumber >= 3 && multipliers.brutePressureMultiplier >= 1.12)) {
      enemyTypes.push("突破体");
    }
    const likelihood = commandLikelihood(waveNumber, commandWaveStart, commandWaveChance);
    if (likelihood !== "none") {
      enemyTypes.push("死霊士官?");
    }
    const label = pressureLabel(waveNumber, multipliers.mobPressureMultiplier, multipliers.brutePressureMultiplier);
    const second = firstWaveSecond + index * spawnIntervalSeconds;
    const secondLabel = secondDisplay(second, certainty);
    const enemyTypesLabel = enemyTypesDisplay(enemyTypes, certainty);
    const commandLikelihoodLabel = commandDisplay(likelihood, certainty);
    return {
      waveNumber,
      second,
      secondLabel,
      enemyTypes,
      enemyTypesLabel,
      commandLikelihood: likelihood,
      commandLikelihoodLabel,
      pressureLabel: label,
      intelCertainty: certainty,
      summary: `${secondLabel}: ${enemyTypesLabel} / ${label} / ${commandLikelihoodLabel}`,
    };
  });

export const createBattleWaveIntel = (context: BattleWaveIntelContext): BattleWaveIntel => {
  const risk = riskPercentValue(context.operation.risk);
  const intel = enemyCompositionIntelForOperation(context.operation, {
    terrainTags: context.terrainTags,
    enemyPressure: context.enemyPressure,
    risk: context.operation.risk,
    structureCount: context.structureCount,
  });
  const certainty = timelineCertainty(intel);
  const mob = threatIntensity(intel.threats, "undeadMob");
  const riflemen = threatIntensity(intel.threats, "undeadRiflemen");
  const brute = threatIntensity(intel.threats, "brute");
  const officer = threatIntensity(intel.threats, "undeadOfficer");
  const mobRange = rangeCeiling(intel.threatRanges, "undeadMob");
  const rifleRange = rangeCeiling(intel.threatRanges, "undeadRiflemen");
  const bruteRange = rangeCeiling(intel.threatRanges, "brute");
  const officerRange = rangeCeiling(intel.threatRanges, "undeadOfficer");
  const pressureLevel = context.enemyPressure + risk * 0.4;
  const intervalPressure = mob * 1.7 + brute * 2.1 + pressureLevel / 34;
  const spawnIntervalSeconds = clamp(Math.round(21 - intervalPressure), 12, 22);
  const commandWaveChance = clamp(Math.round(18 + officer * 18 + officerRange * 5 + risk / 5), 22, 82);
  const commandWaveStart = officer > 0 || officerRange > 0 || risk >= 70 ? 2 : 3;
  const firstWaveSecond = context.terrainTags.includes("bridge") ? 2 : 1;
  const multipliers = {
    mobPressureMultiplier: clamp(0.82 + mob * 0.12 + mobRange * 0.035, 0.9, 1.7),
    riflemenPressureMultiplier: clamp(0.78 + riflemen * 0.13 + rifleRange * 0.04, 0.78, 1.65),
    brutePressureMultiplier: clamp(0.72 + brute * 0.16 + bruteRange * 0.06, 0.72, 1.85),
    officerPressureMultiplier: clamp(0.7 + officer * 0.2 + officerRange * 0.08, 0.7, 2),
  };
  const actualFirstWaveSecond = certainty === "misleading" ? Math.max(1, firstWaveSecond - 1) : firstWaveSecond;
  const actualSpawnIntervalSeconds =
    certainty === "misleading" ? clamp(spawnIntervalSeconds - 4, 8, spawnIntervalSeconds) : spawnIntervalSeconds;
  const actualCommandWaveStart = certainty === "misleading" ? Math.max(2, commandWaveStart - 1) : commandWaveStart;
  const actualCommandWaveChance =
    certainty === "misleading" ? clamp(commandWaveChance + 18, commandWaveChance, 95) : commandWaveChance;
  const actualMultipliers = {
    actualMobPressureMultiplier:
      certainty === "misleading" ? clamp(multipliers.mobPressureMultiplier + 0.18, 0.9, 1.9) : multipliers.mobPressureMultiplier,
    actualRiflemenPressureMultiplier:
      certainty === "misleading" ? clamp(multipliers.riflemenPressureMultiplier + 0.16, 0.78, 1.85) : multipliers.riflemenPressureMultiplier,
    actualBrutePressureMultiplier:
      certainty === "misleading" ? clamp(multipliers.brutePressureMultiplier + 0.2, 0.72, 2.05) : multipliers.brutePressureMultiplier,
    actualOfficerPressureMultiplier:
      certainty === "misleading" ? clamp(multipliers.officerPressureMultiplier + 0.22, 0.7, 2.25) : multipliers.officerPressureMultiplier,
  };
  const timeline = createWaveTimeline(
    firstWaveSecond,
    spawnIntervalSeconds,
    commandWaveStart,
    commandWaveChance,
    certainty,
    multipliers,
  );

  return {
    firstWaveSecond,
    spawnIntervalSeconds,
    commandWaveStart,
    commandWaveChance,
    actualFirstWaveSecond,
    actualSpawnIntervalSeconds,
    actualCommandWaveStart,
    actualCommandWaveChance,
    ...multipliers,
    ...actualMultipliers,
    timeline,
    summary: summaryDisplay(firstWaveSecond, spawnIntervalSeconds, commandWaveChance, certainty),
    surpriseSummary: surpriseSummaryDisplay(certainty, actualSpawnIntervalSeconds, actualCommandWaveChance),
  };
};
