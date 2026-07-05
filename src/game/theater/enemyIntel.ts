import type { OperationSpoilsIntel, StrategicOperation } from "./types";

export type EnemyCompositionThreatType = "undeadMob" | "undeadRiflemen" | "brute" | "undeadOfficer";

export interface EnemyCompositionThreat {
  type: EnemyCompositionThreatType;
  intensity: number;
}

export interface EnemyCompositionIntel {
  summary: string;
  confidence: OperationSpoilsIntel["confidence"];
  threats: EnemyCompositionThreat[];
  threatRanges: Record<EnemyCompositionThreatType, { min: number; max: number }>;
  revisedByOperationId?: string;
  reconQualityScore?: number;
  reconEffect?: OperationSpoilsIntel["reconEffect"];
}

export interface EnemyCompositionForecastInput {
  terrainTags: string[];
  enemyPressure: number;
  risk: number;
  structureCount: number;
}

export const riskPercentValue = (risk: number): number => Math.round(risk <= 1 ? risk * 100 : risk);

export const forecastEnemyCompositionThreats = (context: EnemyCompositionForecastInput): EnemyCompositionThreat[] => {
  const riskPercent = riskPercentValue(context.risk);
  const has = (tag: string) => context.terrainTags.includes(tag);
  const threats: EnemyCompositionThreat[] = [
    {
      type: "undeadMob",
      intensity: Math.max(1, Math.round(context.enemyPressure / 18) + (riskPercent >= 65 ? 1 : 0)),
    },
  ];

  if (riskPercent >= 44 || context.enemyPressure >= 36 || has("forest") || has("open") || has("hill")) {
    threats.push({
      type: "undeadRiflemen",
      intensity: Math.max(1, Math.round(context.enemyPressure / 28) + (has("forest") || has("hill") ? 1 : 0)),
    });
  }

  if (riskPercent >= 62 || context.enemyPressure >= 48 || has("trench") || has("bridge") || context.structureCount > 0) {
    threats.push({
      type: "brute",
      intensity: Math.max(1, Math.round(context.enemyPressure / 34) + (has("trench") || has("bridge") ? 1 : 0)),
    });
  }

  if (riskPercent >= 70 || context.enemyPressure >= 58) {
    threats.push({
      type: "undeadOfficer",
      intensity: Math.max(1, Math.round((riskPercent + context.enemyPressure) / 70)),
    });
  }

  return threats.sort((a, b) => b.intensity - a.intensity);
};

const confidenceSpread: Record<OperationSpoilsIntel["confidence"], number> = {
  low: 0.55,
  medium: 0.32,
  high: 0.16,
};

const confidenceRank: Record<OperationSpoilsIntel["confidence"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const threatRange = (intensity: number, confidence: OperationSpoilsIntel["confidence"]) => {
  const spread = confidenceSpread[confidence];
  return {
    min: Math.max(0, Math.floor(intensity * (1 - spread))),
    max: Math.max(1, Math.ceil(intensity * (1 + spread))),
  };
};

const emptyThreatRanges = (): Record<EnemyCompositionThreatType, { min: number; max: number }> => ({
  undeadMob: { min: 0, max: 0 },
  undeadRiflemen: { min: 0, max: 0 },
  brute: { min: 0, max: 0 },
  undeadOfficer: { min: 0, max: 0 },
});

export const normalizeEnemyCompositionIntel = (intel: EnemyCompositionIntel): EnemyCompositionIntel => {
  const ranges = emptyThreatRanges();
  for (const threat of intel.threats) {
    const existingRange = intel.threatRanges?.[threat.type];
    ranges[threat.type] =
      existingRange && existingRange.max > 0 ? existingRange : threatRange(threat.intensity, intel.confidence);
  }
  return {
    ...intel,
    threats: intel.threats
      .filter((threat) => threat.intensity > 0)
      .sort((a, b) => b.intensity - a.intensity),
    threatRanges: ranges,
  };
};

export const createEnemyCompositionIntel = (
  context: EnemyCompositionForecastInput,
  confidence: OperationSpoilsIntel["confidence"],
): EnemyCompositionIntel => {
  const threats = forecastEnemyCompositionThreats(context);
  return normalizeEnemyCompositionIntel({
    summary: enemyCompositionLabel(threats),
    confidence,
    threats,
    threatRanges: emptyThreatRanges(),
  });
};

export const enemyThreatLabels: Record<EnemyCompositionThreatType, string> = {
  undeadMob: "群集",
  undeadRiflemen: "銃兵",
  brute: "突破体",
  undeadOfficer: "死霊士官",
};

export const enemyThreatRoleLabels: Record<EnemyCompositionThreatType, string> = {
  undeadMob: "数量圧",
  undeadRiflemen: "射撃圧",
  brute: "突破圧",
  undeadOfficer: "指揮圧",
};

export const enemyThreatSeverityLabel = (intensity: number): string =>
  intensity >= 5 ? "極大" : intensity >= 4 ? "大" : intensity >= 3 ? "中" : intensity >= 2 ? "小" : "微";

export const enemyCompositionLabel = (threats: EnemyCompositionThreat[]): string =>
  threats
    .filter((threat) => threat.intensity > 0)
    .slice(0, 3)
    .map((threat) => enemyThreatLabels[threat.type])
    .join("+") || "群集";

export const enemyIntelBaseConfidenceLabels: Record<OperationSpoilsIntel["confidence"], string> = {
  low: "敵情信頼低",
  medium: "敵情信頼中",
  high: "敵情信頼高",
};

export const enemyIntelConfidenceLabel = (operation: StrategicOperation): string => {
  const reconEffect = operation.enemyCompositionIntel?.reconEffect ?? operation.spoilsIntel?.reconEffect;
  const confidence = operation.enemyCompositionIntel?.confidence ?? operation.spoilsIntel?.confidence;
  if (reconEffect === "precise") {
    return "精密照合";
  }
  if (reconEffect === "confirmed") {
    return "偵察照合済み";
  }
  if (reconEffect === "partial") {
    return "部分照合";
  }
  if (reconEffect === "misleading") {
    return "誤情報疑い";
  }
  return confidence ? enemyIntelBaseConfidenceLabels[confidence] : "敵情未照合";
};

export const enemyThreatRangeLabel = (intel: EnemyCompositionIntel): string =>
  intel.threats
    .slice(0, 3)
    .map((threat) => {
      const range = intel.threatRanges[threat.type];
      return `${enemyThreatLabels[threat.type]}${range.min}-${range.max}`;
    })
    .join(" / ");

export const enemyCompositionIntelForOperation = (
  operation: StrategicOperation,
  context: EnemyCompositionForecastInput,
): EnemyCompositionIntel =>
  operation.enemyCompositionIntel
    ? normalizeEnemyCompositionIntel(operation.enemyCompositionIntel)
    : createEnemyCompositionIntel(context, operation.spoilsIntel?.confidence ?? "medium");

const adjustThreats = (
  threats: EnemyCompositionThreat[],
  multiplier: number,
  minimumForKnownThreats = 1,
): EnemyCompositionThreat[] =>
  threats.map((threat) => ({
    ...threat,
    intensity: Math.max(minimumForKnownThreats, Math.round(threat.intensity * multiplier)),
  }));

export const improveEnemyCompositionIntelByRecon = (
  intel: EnemyCompositionIntel,
  sourceOperationId: string,
  outcome: "victory" | "draw",
  reconQualityScore: number,
): EnemyCompositionIntel => {
  const strongRecon = reconQualityScore >= 82;
  const competentRecon = reconQualityScore >= 64;
  const confidence: OperationSpoilsIntel["confidence"] =
    outcome === "victory"
      ? strongRecon || competentRecon
        ? "high"
        : "medium"
      : confidenceRank[intel.confidence] >= confidenceRank.medium || competentRecon
        ? "medium"
        : "low";
  const reconEffect: OperationSpoilsIntel["reconEffect"] =
    outcome === "victory" ? (strongRecon ? "precise" : "confirmed") : "partial";
  const multiplier = outcome === "victory" ? (strongRecon ? 1.14 : competentRecon ? 1.08 : 1.04) : competentRecon ? 1.02 : 1;
  const threats = adjustThreats(intel.threats, multiplier);
  return normalizeEnemyCompositionIntel({
    ...intel,
    summary: enemyCompositionLabel(threats),
    confidence,
    threats,
    threatRanges: emptyThreatRanges(),
    revisedByOperationId: sourceOperationId,
    reconQualityScore: Math.round(reconQualityScore),
    reconEffect,
  });
};

export const markEnemyCompositionIntelAsMisinformed = (
  intel: EnemyCompositionIntel,
  sourceOperationId: string,
  reconQualityScore: number,
): EnemyCompositionIntel => {
  const drift = reconQualityScore >= 58 ? 0.96 : 0.84;
  const threats = adjustThreats(intel.threats, drift);
  return normalizeEnemyCompositionIntel({
    ...intel,
    summary: enemyCompositionLabel(threats),
    confidence: "low",
    threats,
    threatRanges: emptyThreatRanges(),
    revisedByOperationId: sourceOperationId,
    reconQualityScore: Math.round(reconQualityScore),
    reconEffect: "misleading",
  });
};

export const enemyCompositionBrief = (
  operation: StrategicOperation,
  context: EnemyCompositionForecastInput,
): string => {
  const intel = enemyCompositionIntelForOperation(operation, context);
  return `${enemyCompositionLabel(intel.threats)} / ${enemyIntelConfidenceLabel({ ...operation, enemyCompositionIntel: intel })}`;
};
