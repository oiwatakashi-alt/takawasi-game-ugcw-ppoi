import type { CampaignState } from "../campaign/types";
import type { StrategicOperation } from "../theater/types";
import type { BattleScenario } from "./types";
import { createBattleWaveIntel } from "./waveIntel";

export interface CreateBattleScenarioOptions {
  tacticalTerrainProfile?: BattleScenario["tacticalTerrainProfileId"];
}

const uniqueTerrainTags = (terrainTags: string[]): string[] => Array.from(new Set(terrainTags));

const terrainTagsForProfile = (
  terrainTags: string[],
  profile: CreateBattleScenarioOptions["tacticalTerrainProfile"],
): string[] => {
  if (profile === "high_ground_los_drill") {
    return uniqueTerrainTags([...terrainTags, "hill", "open"]);
  }
  if (profile === "reverse_slope_los_drill") {
    return uniqueTerrainTags([...terrainTags, "reverseSlopeDrill", "open"]);
  }
  return terrainTags;
};

const terrainProfileLabel = (
  profile: CreateBattleScenarioOptions["tacticalTerrainProfile"],
): string | undefined => {
  if (profile === "high_ground_los_drill") {
    return "高地射線検証";
  }
  if (profile === "reverse_slope_los_drill") {
    return "逆斜面射線検証";
  }
  return undefined;
};

const terrainProfileSummary = (
  profile: CreateBattleScenarioOptions["tacticalTerrainProfile"],
): string | undefined => {
  if (profile === "high_ground_los_drill") {
    return "高地稜線を必ず含め、丘上部隊の有効射程と射線補正を確認する戦術検証プロファイル。";
  }
  if (profile === "reverse_slope_los_drill") {
    return "丘の反対斜面に敵を出し、正面部隊から稜線裏の射線減衰を確認する戦術検証プロファイル。";
  }
  return undefined;
};

export const createBattleScenario = (
  campaign: CampaignState,
  operation: StrategicOperation,
  options: CreateBattleScenarioOptions = {},
): BattleScenario => {
  const sector = campaign.theater.sectors.find((candidate) => candidate.id === operation.sectorId);
  if (!sector) {
    throw new Error(`Unknown sector: ${operation.sectorId}`);
  }
  const terrainTags = terrainTagsForProfile(sector.terrainTags, options.tacticalTerrainProfile);
  const waveBudget = Math.max(
    70,
    sector.enemyPressure + campaign.theater.enemyMomentum + (operation.victoryEffects.waveBudgetDelta ?? 0),
  );
  const profileLabel = terrainProfileLabel(options.tacticalTerrainProfile);

  return {
    id: `battle-${operation.id}`,
    title: profileLabel ? `${operation.title} - ${profileLabel}` : operation.title,
    operation,
    sectorId: sector.id,
    sectorName: sector.name,
    terrainTags,
    tacticalTerrainProfileId: options.tacticalTerrainProfile,
    tacticalTerrainProfileLabel: profileLabel,
    tacticalTerrainProfileSummary: terrainProfileSummary(options.tacticalTerrainProfile),
    durationSeconds: terrainTags.includes("bridge") ? 135 : 150,
    waveBudget,
    waveIntel: createBattleWaveIntel({
      operation,
      terrainTags,
      enemyPressure: sector.enemyPressure,
      structureCount: sector.structures.length,
    }),
  };
};
