import type { SaveEnvelope } from "./types";
import { normalizeArmyDivisions } from "../army/divisions";
import { defaultStaffAssignments, normalizeStaffAssignments } from "../army/headquarters";
import { createCampaign } from "../campaign/createCampaign";
import { defaultCommandIssuePlan } from "../campaign/deploymentPlan";
import { createInitialResources } from "../logistics/types";
import { createEnemyCompositionIntel, normalizeEnemyCompositionIntel } from "../theater/enemyIntel";
import type { Sector, StrategicOperation } from "../theater/types";

export const CURRENT_SAVE_VERSION = 8;

const normalizeOperationEnemyIntel = (
  operation: StrategicOperation,
  sectors: Sector[],
): StrategicOperation => {
  const sector = sectors.find((candidate) => candidate.id === operation.sectorId);
  const context = {
    terrainTags: sector?.terrainTags ?? [],
    enemyPressure: sector?.enemyPressure ?? 0,
    risk: operation.risk,
    structureCount: sector?.structures.length ?? 0,
  };
  return {
    ...operation,
    enemyCompositionIntel: operation.enemyCompositionIntel
      ? normalizeEnemyCompositionIntel(operation.enemyCompositionIntel)
      : createEnemyCompositionIntel(context, operation.spoilsIntel?.confidence ?? "medium"),
  };
};

const normalizeCurrentCampaign = (campaignState: SaveEnvelope["campaignState"]): SaveEnvelope["campaignState"] => {
  const defaultWeapons = createInitialResources().weapons;
  const firstFormation = campaignState.army.formations[0];
  const normalizedFormations = campaignState.army.formations.map((formation, index) =>
    index === 0
      ? {
          ...formation,
          staffAssignments: normalizeStaffAssignments(formation.staffAssignments ?? defaultStaffAssignments()),
          divisions: normalizeArmyDivisions(campaignState.army.units, formation.divisions),
        }
      : formation,
  );
  return {
    ...campaignState,
    resources: {
      ...campaignState.resources,
      weapons: {
        ...defaultWeapons,
        ...campaignState.resources.weapons,
      },
    },
    officers: campaignState.officers.map((officer) => ({
      ...officer,
      commandFatigue: officer.commandFatigue ?? 0,
    })),
    army: {
      ...campaignState.army,
      formations: firstFormation ? normalizedFormations : campaignState.army.formations,
    },
    theater: {
      ...campaignState.theater,
      activeOperations: campaignState.theater.activeOperations.map((operation) =>
        normalizeOperationEnemyIntel(operation, campaignState.theater.sectors),
      ),
      mandatoryBattle: campaignState.theater.mandatoryBattle
        ? normalizeOperationEnemyIntel(campaignState.theater.mandatoryBattle, campaignState.theater.sectors)
        : campaignState.theater.mandatoryBattle,
    },
    activeStrategicTurn: {
      ...campaignState.activeStrategicTurn,
      mandatoryBattle: normalizeOperationEnemyIntel(
        campaignState.activeStrategicTurn.mandatoryBattle,
        campaignState.theater.sectors,
      ),
      sideOperations: campaignState.activeStrategicTurn.sideOperations.map((operation) =>
        normalizeOperationEnemyIntel(operation, campaignState.theater.sectors),
      ),
    },
    standingOrderTemplates: campaignState.standingOrderTemplates ?? [],
    standingOrderPlanSets: (campaignState.standingOrderPlanSets ?? []).map((planSet) => ({
      ...planSet,
      commandIssuePlan: planSet.commandIssuePlan ?? defaultCommandIssuePlan,
      rearGuardUnitIds: planSet.rearGuardUnitIds ?? [],
    })),
    deploymentPlan: campaignState.deploymentPlan
      ? {
          ...campaignState.deploymentPlan,
          commandIssuePlan: campaignState.deploymentPlan.commandIssuePlan ?? defaultCommandIssuePlan,
          rearGuardUnitIds: campaignState.deploymentPlan.rearGuardUnitIds ?? [],
        }
      : campaignState.deploymentPlan,
    saveVersion: CURRENT_SAVE_VERSION,
  };
};

export const migrateSave = (save: SaveEnvelope): SaveEnvelope => {
  if (save.saveVersion === CURRENT_SAVE_VERSION) {
    return {
      ...save,
      campaignState: normalizeCurrentCampaign(save.campaignState),
    };
  }
  if (save.saveVersion < 2) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(createCampaign()),
      updatedAt: new Date().toISOString(),
    };
  }
  if (save.saveVersion < 3) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(save.campaignState),
      updatedAt: new Date().toISOString(),
    };
  }
  if (save.saveVersion < 4) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(save.campaignState),
      updatedAt: new Date().toISOString(),
    };
  }
  if (save.saveVersion < 5) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(save.campaignState),
      updatedAt: new Date().toISOString(),
    };
  }
  if (save.saveVersion < 6) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(save.campaignState),
      updatedAt: new Date().toISOString(),
    };
  }
  if (save.saveVersion < 7) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(save.campaignState),
      updatedAt: new Date().toISOString(),
    };
  }
  if (save.saveVersion < 8) {
    return {
      ...save,
      saveVersion: CURRENT_SAVE_VERSION,
      campaignState: normalizeCurrentCampaign(save.campaignState),
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...save,
    saveVersion: CURRENT_SAVE_VERSION,
    campaignState: normalizeCurrentCampaign(save.campaignState),
  };
};
