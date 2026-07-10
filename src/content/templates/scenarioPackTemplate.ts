import {
  assertScenarioPackValid,
  SCENARIO_PACK_SCHEMA_VERSION,
  type ScenarioPackDefinition,
} from "../scenarioTypes";

export type ScenarioPackDraft = Omit<ScenarioPackDefinition, "schemaVersion">;

/** Authoring entry point: every scenario pack gets the same schema and boundary validation. */
export const createScenarioPackTemplate = (draft: ScenarioPackDraft): ScenarioPackDefinition =>
  assertScenarioPackValid({
    schemaVersion: SCENARIO_PACK_SCHEMA_VERSION,
    ...draft,
  });
