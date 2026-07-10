import type { FortificationInstance } from "../game/fortifications/types";
import type { ResourceCost } from "../game/logistics/spend";
import type {
  OperationEffects,
  OperationSpoilsIntel,
  OperationType,
  SectorControl,
  TheaterBand,
} from "../game/theater/types";

export const SCENARIO_PACK_SCHEMA_VERSION = 1 as const;
export type ScenarioPackSchemaVersion = typeof SCENARIO_PACK_SCHEMA_VERSION;

export type ScenarioCarryoverField =
  | "enemyPressure"
  | "enemyMomentum"
  | "resources"
  | "battleHistory"
  | "tacticalLessons";

export interface ScenarioSectorDefinition {
  id: string;
  name: string;
  band: TheaterBand;
  control: SectorControl;
  terrainTags: string[];
  fortificationSlots: number;
  initialStructures?: FortificationInstance[];
  supplyValue: number;
  railValue: number;
  medicalValue: number;
  engineerValue: number;
  enemyPressure: number;
  corruptionLevel: number;
  battleTemplates: string[];
  linkedSectors: string[];
  history: string[];
}

export interface ScenarioOperationTemplate {
  id: string;
  titleTemplate: string;
  type: OperationType;
  sectorId: string;
  isMandatory: boolean;
  canAutoResolve: boolean;
  risk: number;
  cost: ResourceCost;
  victoryEffects: OperationEffects;
  drawEffects: OperationEffects;
  defeatEffects: OperationEffects;
  spoilsIntel?: OperationSpoilsIntel;
}

export interface ScenarioPackDefinition {
  schemaVersion: ScenarioPackSchemaVersion;
  id: string;
  name: string;
  chapter: string;
  strategic: {
    currentSectorId: string;
    rearPressureSectorIds: string[];
    forwardPressureSectorIds: string[];
    globalThreat: number;
    enemyMomentum: number;
    playerStrategicInitiative: number;
    sectors: ScenarioSectorDefinition[];
  };
  tactical: {
    battleTemplateIds: string[];
    mainBattleTemplateId: string;
    description: string;
  };
  operations: {
    mandatoryBattle: ScenarioOperationTemplate;
    sideOperations: ScenarioOperationTemplate[];
  };
  carryover: {
    visibleResultFields: ScenarioCarryoverField[];
    requiredBattlePersistence: boolean;
    nextTurnSummaryFields: string[];
  };
}

const duplicateIds = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
};

export const validateScenarioPack = (pack: ScenarioPackDefinition): string[] => {
  const issues: string[] = [];
  const sectors = pack.strategic.sectors;
  const sectorIds = sectors.map((sector) => sector.id);
  const sectorIdSet = new Set(sectorIds);
  const operations = [pack.operations.mandatoryBattle, ...pack.operations.sideOperations];

  if (pack.schemaVersion !== SCENARIO_PACK_SCHEMA_VERSION) {
    issues.push(`schemaVersion must be ${SCENARIO_PACK_SCHEMA_VERSION}`);
  }
  if (!pack.id.trim() || !pack.name.trim() || !pack.chapter.trim()) {
    issues.push("id, name, and chapter are required");
  }
  for (const id of duplicateIds(sectorIds)) {
    issues.push(`duplicate sector id: ${id}`);
  }
  for (const sector of sectors) {
    for (const linkedId of sector.linkedSectors) {
      if (!sectorIdSet.has(linkedId)) {
        issues.push(`sector ${sector.id} links unknown sector ${linkedId}`);
      }
    }
    for (const structure of sector.initialStructures ?? []) {
      if (structure.sectorId !== sector.id) {
        issues.push(`structure ${structure.id} belongs to ${structure.sectorId}, not ${sector.id}`);
      }
    }
  }
  for (const sectorId of [
    pack.strategic.currentSectorId,
    ...pack.strategic.rearPressureSectorIds,
    ...pack.strategic.forwardPressureSectorIds,
  ]) {
    if (!sectorIdSet.has(sectorId)) {
      issues.push(`strategic position references unknown sector ${sectorId}`);
    }
  }
  if (pack.tactical.battleTemplateIds.length === 0) {
    issues.push("at least one tactical battle template is required");
  }
  if (!pack.tactical.battleTemplateIds.includes(pack.tactical.mainBattleTemplateId)) {
    issues.push(`main battle template is not registered: ${pack.tactical.mainBattleTemplateId}`);
  }
  for (const id of duplicateIds(operations.map((operation) => operation.id))) {
    issues.push(`duplicate operation template id: ${id}`);
  }

  const mandatoryBattle = pack.operations.mandatoryBattle;
  if (mandatoryBattle.type !== "holdSector" || !mandatoryBattle.isMandatory || mandatoryBattle.canAutoResolve) {
    issues.push("mandatory battle must be holdSector, mandatory, and not auto-resolvable");
  }
  for (const operation of pack.operations.sideOperations) {
    if (operation.isMandatory || !operation.canAutoResolve || operation.type === "holdSector") {
      issues.push(`side operation ${operation.id} must be optional and auto-resolvable`);
    }
  }
  for (const operation of operations) {
    if (!sectorIdSet.has(operation.sectorId)) {
      issues.push(`operation ${operation.id} references unknown sector ${operation.sectorId}`);
    }
    if (operation.risk < 0 || operation.risk > 1) {
      issues.push(`operation ${operation.id} risk must be between 0 and 1`);
    }
  }
  if (pack.carryover.visibleResultFields.length === 0 || pack.carryover.nextTurnSummaryFields.length === 0) {
    issues.push("carryover must define visible result and next-turn summary fields");
  }
  if (!pack.carryover.visibleResultFields.includes("battleHistory")) {
    issues.push("carryover must expose battleHistory");
  }

  return issues;
};

export const assertScenarioPackValid = (pack: ScenarioPackDefinition): ScenarioPackDefinition => {
  const issues = validateScenarioPack(pack);
  if (issues.length > 0) {
    throw new Error(`Invalid scenario pack ${pack.id}: ${issues.join("; ")}`);
  }
  return pack;
};
