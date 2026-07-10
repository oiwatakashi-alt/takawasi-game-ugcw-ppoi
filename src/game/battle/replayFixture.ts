import { createCampaign } from "../campaign/createCampaign";
import { createBattleScenario } from "./createBattleScenario";
import { createBattleState } from "./createBattleState";
import { createBattleReplayFixture, verifyBattleReplayFixture, type BattleReplayVerification } from "./replay";

export const createDefaultBattleReplayFixture = () => {
  const campaign = createCampaign();
  const operation = campaign.theater.mandatoryBattle ?? campaign.activeStrategicTurn.mandatoryBattle;
  const scenario = createBattleScenario(campaign, operation);
  const initialState = createBattleState(campaign, scenario);
  const inputs = Array.from({ length: 5 }, (_, index) => ({
    type: "tick" as const,
    elapsedSeconds: index,
  }));
  return {
    initialState,
    fixture: createBattleReplayFixture(initialState, inputs),
  };
};

export const verifyDefaultBattleReplayFixture = (): BattleReplayVerification => {
  const { initialState, fixture } = createDefaultBattleReplayFixture();
  return verifyBattleReplayFixture(initialState, fixture);
};
