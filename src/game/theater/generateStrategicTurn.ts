import type { OperationSpoilsIntel, StrategicOperation, StrategicTurn, TheaterState } from "./types";
import { createEnemyCompositionIntel, normalizeEnemyCompositionIntel } from "./enemyIntel";
import { normalizeSpoilsIntel } from "./spoilsIntel";
import type { StrategicIntelPreparation } from "./reconQuality";

const opId = (turn: number, type: string, sectorId: string) => `${turn}-${type}-${sectorId}`;

export interface StrategicTurnGenerationContext {
  intelligencePreparation?: StrategicIntelPreparation;
}

const confidenceOrder = ["low", "medium", "high"] as const;

const shiftConfidence = (
  confidence: OperationSpoilsIntel["confidence"],
  shift: number,
): OperationSpoilsIntel["confidence"] => {
  const nextIndex = Math.min(confidenceOrder.length - 1, confidenceOrder.indexOf(confidence) + shift);
  return confidenceOrder[nextIndex];
};

const applyIntelligencePreparationToSpoils = (
  spoilsIntel: OperationSpoilsIntel,
  context?: StrategicTurnGenerationContext,
): OperationSpoilsIntel => {
  const preparation = context?.intelligencePreparation;
  if (!preparation || preparation.confidenceShift <= 0) {
    return spoilsIntel;
  }
  return {
    ...spoilsIntel,
    summary: `${spoilsIntel.summary} / 参謀偵察教訓を反映`,
    confidence: shiftConfidence(spoilsIntel.confidence, preparation.confidenceShift),
    reconQualityScore: 58 + preparation.confidenceShift * 12 + Math.min(12, preparation.lessonScore),
    reconEffect: preparation.confidenceShift >= 2 ? "confirmed" : "partial",
  };
};

const makeOperation = (
  theater: TheaterState,
  type: StrategicOperation["type"],
  sectorId: string,
  title: string,
  isMandatory = false,
  risk = 0.35,
  context?: StrategicTurnGenerationContext,
): StrategicOperation => {
  const sector = theater.sectors.find((candidate) => candidate.id === sectorId);
  const pressureFactor = Math.max(1, Math.round((sector?.enemyPressure ?? 40) / 18));
  const hasBridge = sector?.terrainTags.includes("bridge") ?? false;
  const hasForest = sector?.terrainTags.includes("forest") ?? false;
  const spoilsIntel: OperationSpoilsIntel =
    type === "raidEnemyNest"
      ? {
          summary: "敵前進巣に改良銃と弾薬箱の集積あり",
          confidence: "medium",
          expectedWeapons: { mauser71: 18 + pressureFactor * 4, dreyse: 32 + pressureFactor * 6 },
          supplyCache: { ammunition: 24 },
        }
      : type === "railRepair"
        ? {
            summary: "破損列車に補給物資と旧式銃が残存",
            confidence: "high",
            expectedWeapons: { reserveRifle: 70 + pressureFactor * 8, tools: 10 + pressureFactor },
            supplyCache: { supplies: 24, ammunition: 18, materials: 12 },
          }
        : type === "engineerWorks"
          ? {
              summary: "前線資材置場から工具を回収可能",
              confidence: "high",
              expectedWeapons: { tools: 12 + pressureFactor },
              supplyCache: { materials: 10 },
            }
          : type === "reconPatrol"
            ? {
                summary: hasForest ? "森林哨戒で猟兵銃の小集積を発見見込み" : "敵弾薬列の位置を推定",
                confidence: "low",
                expectedWeapons: hasForest ? { jaegerRifle: 8 + pressureFactor } : { dreyse: 18 + pressureFactor * 3 },
                supplyCache: { ammunition: 10 },
              }
            : {
                summary: hasBridge ? "橋梁正面に鹵獲砲材と歩兵銃の回収余地" : "主戦場後の敵遺棄装備を回収可能",
                confidence: "medium",
                expectedWeapons: {
                  dreyse: 24 + pressureFactor * 5,
                  jaegerRifle: hasForest ? 8 + pressureFactor : 4,
                  fieldGun: hasBridge ? 1 : 0,
                  tools: 4 + pressureFactor,
                },
              };

  const normalizedSpoilsIntel = normalizeSpoilsIntel(applyIntelligencePreparationToSpoils(spoilsIntel, context));
  const enemyCompositionIntel = createEnemyCompositionIntel(
    {
      terrainTags: sector?.terrainTags ?? [],
      enemyPressure: sector?.enemyPressure ?? 0,
      risk,
      structureCount: sector?.structures.length ?? 0,
    },
    normalizedSpoilsIntel.confidence,
  );
  const preparedEnemyCompositionIntel =
    context?.intelligencePreparation && context.intelligencePreparation.confidenceShift > 0
      ? normalizeEnemyCompositionIntel({
          ...enemyCompositionIntel,
          reconQualityScore: normalizedSpoilsIntel.reconQualityScore,
          reconEffect: normalizedSpoilsIntel.reconEffect,
        })
      : enemyCompositionIntel;

  return {
    id: opId(theater.turnNumber, type, sectorId),
    title,
    type,
    sectorId,
    isMandatory,
    canAutoResolve: !isMandatory,
    risk,
    cost:
      type === "engineerWorks"
        ? { materials: 25, engineerLabor: 12 }
        : type === "railRepair"
          ? { materials: 22, engineerLabor: 8 }
          : type === "raidEnemyNest"
            ? { ammunition: 40, supplies: 12 }
            : {},
    assignedForces: { unitIds: [], officerIds: [], resources: {} },
    victoryEffects:
      type === "raidEnemyNest"
        ? { enemyPressureDelta: -12, enemyMomentumDelta: -2, waveBudgetDelta: -18, reputationDelta: 2 }
        : type === "engineerWorks"
          ? { structureRepair: 22, initiativeDelta: 1 }
          : type === "railRepair"
            ? { resourceDelta: { supplies: 30, ammunition: 35 }, initiativeDelta: 1 }
            : type === "reconPatrol"
              ? { waveBudgetDelta: -8, initiativeDelta: 2 }
              : { enemyPressureDelta: -6, reputationDelta: 1 },
    drawEffects: { enemyPressureDelta: -3, waveBudgetDelta: -4 },
    defeatEffects: { enemyPressureDelta: 6, enemyMomentumDelta: 1, reputationDelta: -1 },
    spoilsIntel: normalizedSpoilsIntel,
    enemyCompositionIntel: preparedEnemyCompositionIntel,
    linkedMainBattleId: isMandatory ? undefined : opId(theater.turnNumber, "holdSector", theater.playerArmyPositionSectorId),
  };
};

export const generateStrategicTurn = (theater: TheaterState, context?: StrategicTurnGenerationContext): StrategicTurn => {
  const current = theater.sectors.find((sector) => sector.id === theater.playerArmyPositionSectorId)!;
  const forward = theater.sectors.find((sector) => sector.id === theater.forwardPressureSectorIds[0]) ?? current;
  const rear = theater.sectors.find((sector) => sector.id === theater.rearPressureSectorIds[0]) ?? current;

  const mandatoryBattle = makeOperation(
    theater,
    "holdSector",
    current.id,
    `${current.name}防衛戦`,
    true,
    Math.min(0.9, 0.42 + current.enemyPressure / 150 + theater.enemyMomentum / 100),
    context,
  );

  const sideOperations = [
    makeOperation(theater, "reconPatrol", forward.id, `${forward.name}偵察`, false, 0.22, context),
    makeOperation(theater, "raidEnemyNest", forward.id, `${forward.name}襲撃`, false, 0.48, context),
    makeOperation(theater, "engineerWorks", current.id, `${current.name}増強工事`, false, 0.18, context),
    makeOperation(theater, "railRepair", rear.id, `${rear.name}復旧`, false, 0.28, context),
  ];
  const preparationMessage =
    context?.intelligencePreparation && context.intelligencePreparation.confidenceShift > 0
      ? ` ${context.intelligencePreparation.summary}`
      : "";

  return {
    turnNumber: theater.turnNumber,
    mandatoryBattle,
    sideOperations,
    threatForecast: `${current.name}には敵圧${current.enemyPressure + theater.enemyMomentum}が集中している。${forward.name}から次の波が供給されている。${preparationMessage}`,
  };
};

export const applyStrategicTurnToTheater = (theater: TheaterState, turn: StrategicTurn): TheaterState => ({
  ...theater,
  mandatoryBattle: turn.mandatoryBattle,
  activeOperations: [turn.mandatoryBattle, ...turn.sideOperations],
});
