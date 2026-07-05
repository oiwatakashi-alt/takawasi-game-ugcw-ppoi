import type { OperationSpoilsIntel, StrategicOperation } from "./types";
import {
  improveEnemyCompositionIntelByRecon,
  markEnemyCompositionIntelAsMisinformed,
} from "./enemyIntel";

const confidenceSpread: Record<OperationSpoilsIntel["confidence"], number> = {
  low: 0.42,
  medium: 0.24,
  high: 0.12,
};

const confidenceRank: Record<OperationSpoilsIntel["confidence"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const addRange = (value: number, spread: number) => ({
  min: Math.max(0, Math.floor(value * (1 - spread))),
  max: Math.max(0, Math.ceil(value * (1 + spread))),
});

const mapRange = (values: Record<string, number>, confidence: OperationSpoilsIntel["confidence"]) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, addRange(value, confidenceSpread[confidence])]),
  );

export const normalizeSpoilsIntel = (intel: OperationSpoilsIntel): OperationSpoilsIntel => ({
  ...intel,
  expectedWeaponRange: intel.expectedWeaponRange ?? mapRange(intel.expectedWeapons, intel.confidence),
  supplyCacheRange:
    intel.supplyCacheRange ??
    (intel.supplyCache
      ? Object.fromEntries(
          Object.entries(intel.supplyCache).map(([key, value]) => [
            key,
            addRange(value ?? 0, confidenceSpread[intel.confidence]),
          ]),
        )
      : undefined),
  recoveryMultiplier: intel.recoveryMultiplier ?? 1,
});

export const improveSpoilsIntelByRecon = (
  intel: OperationSpoilsIntel,
  sourceOperationId: string,
  outcome: "victory" | "draw",
  reconQualityScore: number,
): OperationSpoilsIntel => {
  const strongRecon = reconQualityScore >= 82;
  const competentRecon = reconQualityScore >= 64;
  const nextConfidence: OperationSpoilsIntel["confidence"] =
    outcome === "victory"
      ? strongRecon || competentRecon
        ? "high"
        : "medium"
      : confidenceRank[intel.confidence] >= confidenceRank.medium || competentRecon
        ? "medium"
        : "low";
  const multiplier =
    outcome === "victory" ? (strongRecon ? 1.16 : competentRecon ? 1.12 : 1.08) : competentRecon ? 1.06 : 1.02;
  const recoveryMultiplier = outcome === "victory" ? (strongRecon ? 1.16 : competentRecon ? 1.12 : 1.06) : competentRecon ? 1.06 : 1.02;
  const reconEffect: OperationSpoilsIntel["reconEffect"] =
    outcome === "victory" ? (strongRecon ? "precise" : "confirmed") : "partial";
  const expectedWeapons = Object.fromEntries(
    Object.entries(intel.expectedWeapons).map(([key, value]) => [key, Math.max(0, Math.round(value * multiplier))]),
  );
  const supplyCache = intel.supplyCache
    ? Object.fromEntries(
        Object.entries(intel.supplyCache).map(([key, value]) => [
          key,
          Math.max(0, Math.round((value ?? 0) * multiplier)),
        ]),
      )
    : undefined;

  return normalizeSpoilsIntel({
    ...intel,
    summary: intel.summary.includes("偵察照合済み") ? intel.summary : `${intel.summary} / 偵察照合済み`,
    confidence: nextConfidence,
    expectedWeapons,
    expectedWeaponRange: undefined,
    supplyCache,
    supplyCacheRange: undefined,
    recoveryMultiplier: Math.max(intel.recoveryMultiplier ?? 1, recoveryMultiplier),
    revisedByOperationId: sourceOperationId,
    reconQualityScore: Math.round(reconQualityScore),
    reconEffect,
  });
};

export const markSpoilsIntelAsMisinformed = (
  intel: OperationSpoilsIntel,
  sourceOperationId: string,
  reconQualityScore: number,
): OperationSpoilsIntel => {
  const drift = reconQualityScore >= 58 ? 0.98 : 0.9;
  const expectedWeapons = Object.fromEntries(
    Object.entries(intel.expectedWeapons).map(([key, value]) => [key, Math.max(0, Math.round(value * drift))]),
  );
  const supplyCache = intel.supplyCache
    ? Object.fromEntries(
        Object.entries(intel.supplyCache).map(([key, value]) => [
          key,
          Math.max(0, Math.round((value ?? 0) * drift)),
        ]),
      )
    : undefined;

  return normalizeSpoilsIntel({
    ...intel,
    summary: intel.summary.includes("誤情報疑い") ? intel.summary : `${intel.summary} / 誤情報疑い`,
    confidence: "low",
    expectedWeapons,
    expectedWeaponRange: undefined,
    supplyCache,
    supplyCacheRange: undefined,
    recoveryMultiplier: Math.min(intel.recoveryMultiplier ?? 1, reconQualityScore >= 58 ? 0.96 : 0.9),
    revisedByOperationId: sourceOperationId,
    reconQualityScore: Math.round(reconQualityScore),
    reconEffect: "misleading",
  });
};

export const applyReconIntelToOperation = (
  operation: StrategicOperation,
  sourceOperation: StrategicOperation,
  outcome: "victory" | "draw" | "defeat",
  reconQualityScore: number,
): StrategicOperation => {
  if (operation.id === sourceOperation.id || operation.resolved || (!operation.spoilsIntel && !operation.enemyCompositionIntel)) {
    return operation;
  }
  const sameSector = operation.sectorId === sourceOperation.sectorId;
  const sameMainBattle = operation.id === sourceOperation.linkedMainBattleId;
  const sameTurnCluster =
    Boolean(operation.linkedMainBattleId) && operation.linkedMainBattleId === sourceOperation.linkedMainBattleId;
  if (!sameSector && !sameMainBattle && !sameTurnCluster) {
    return operation;
  }

  if (outcome === "defeat") {
    return {
      ...operation,
      spoilsIntel: operation.spoilsIntel
        ? markSpoilsIntelAsMisinformed(operation.spoilsIntel, sourceOperation.id, reconQualityScore)
        : operation.spoilsIntel,
      enemyCompositionIntel: operation.enemyCompositionIntel
        ? markEnemyCompositionIntelAsMisinformed(operation.enemyCompositionIntel, sourceOperation.id, reconQualityScore)
        : operation.enemyCompositionIntel,
    };
  }

  return {
    ...operation,
    spoilsIntel: operation.spoilsIntel
      ? improveSpoilsIntelByRecon(operation.spoilsIntel, sourceOperation.id, outcome, reconQualityScore)
      : operation.spoilsIntel,
    enemyCompositionIntel: operation.enemyCompositionIntel
      ? improveEnemyCompositionIntelByRecon(operation.enemyCompositionIntel, sourceOperation.id, outcome, reconQualityScore)
      : operation.enemyCompositionIntel,
  };
};
