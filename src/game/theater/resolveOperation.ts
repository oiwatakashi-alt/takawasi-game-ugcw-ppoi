import type { StrategicOperation, TheaterState } from "./types";

const outcomeLabel = (outcome: "victory" | "draw" | "defeat") =>
  outcome === "victory" ? "成功" : outcome === "draw" ? "痛み分け" : "失敗";

export const updateOperation = (
  theater: TheaterState,
  operation: StrategicOperation,
): TheaterState => ({
  ...theater,
  activeOperations: theater.activeOperations.map((existing) =>
    existing.id === operation.id ? operation : existing,
  ),
  mandatoryBattle: theater.mandatoryBattle?.id === operation.id ? operation : theater.mandatoryBattle,
});

export const applyOperationPressure = (
  theater: TheaterState,
  operation: StrategicOperation,
  outcome: "victory" | "draw" | "defeat",
): TheaterState => {
  const effects =
    outcome === "victory"
      ? operation.victoryEffects
      : outcome === "draw"
        ? operation.drawEffects
        : operation.defeatEffects;

  return {
    ...theater,
    enemyMomentum: Math.max(0, theater.enemyMomentum + (effects.enemyMomentumDelta ?? 0)),
    playerStrategicInitiative: Math.max(0, theater.playerStrategicInitiative + (effects.initiativeDelta ?? 0)),
    sectors: theater.sectors.map((sector) =>
      sector.id === operation.sectorId
        ? {
            ...sector,
            enemyPressure: Math.max(0, sector.enemyPressure + (effects.enemyPressureDelta ?? 0)),
            history: [`${operation.title}: ${outcomeLabel(outcome)}`, ...sector.history].slice(0, 8),
          }
        : sector,
    ),
    strategicHistory: [`${operation.title}は${outcomeLabel(outcome)}で解決`, ...theater.strategicHistory].slice(0, 12),
  };
};
