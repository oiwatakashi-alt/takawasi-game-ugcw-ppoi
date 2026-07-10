import { battleStateDigest, ensureBattleAudit, type BattleReplayInput } from "./audit";
import { resolveTick } from "./resolveTick";
import type { BattleState } from "./types";

export interface BattleReplayFixture {
  seed: number;
  initialDigest: string;
  inputs: BattleReplayInput[];
  expectedDigest: string;
  expectedElapsedSeconds: number;
  expectedStatus: BattleState["status"];
}

export interface BattleReplayVerification {
  pass: boolean;
  sameInputResult: boolean;
  initialDigest: string;
  firstDigest: string;
  secondDigest: string;
  expectedDigest: string;
  replayedElapsedSeconds: number;
  expectedElapsedSeconds: number;
  reason: string;
}

export const replayBattleInputs = (initialState: BattleState, inputs: BattleReplayInput[]): BattleState => {
  let state = ensureBattleAudit(initialState);
  for (const input of inputs) {
    if (state.elapsedSeconds !== input.elapsedSeconds) {
      throw new Error(
        `Replay input mismatch: expected elapsed ${state.elapsedSeconds}, received ${input.elapsedSeconds}`,
      );
    }
    state = resolveTick(state);
  }
  return state;
};

export const createBattleReplayFixture = (
  initialState: BattleState,
  inputs: BattleReplayInput[],
): BattleReplayFixture => {
  const normalizedInitialState = ensureBattleAudit(initialState);
  const replayed = replayBattleInputs(normalizedInitialState, inputs);
  return {
    seed: normalizedInitialState.audit?.seed ?? 0,
    initialDigest: battleStateDigest(normalizedInitialState),
    inputs,
    expectedDigest: battleStateDigest(replayed),
    expectedElapsedSeconds: replayed.elapsedSeconds,
    expectedStatus: replayed.status,
  };
};

export const verifyBattleReplayFixture = (
  initialState: BattleState,
  fixture: BattleReplayFixture,
): BattleReplayVerification => {
  const normalizedInitialState = ensureBattleAudit(initialState);
  const initialDigest = battleStateDigest(normalizedInitialState);
  if (initialDigest !== fixture.initialDigest) {
    return {
      pass: false,
      sameInputResult: false,
      initialDigest,
      firstDigest: "",
      secondDigest: "",
      expectedDigest: fixture.expectedDigest,
      replayedElapsedSeconds: normalizedInitialState.elapsedSeconds,
      expectedElapsedSeconds: fixture.expectedElapsedSeconds,
      reason: "初期状態digestがfixtureと一致しない",
    };
  }
  const first = replayBattleInputs(normalizedInitialState, fixture.inputs);
  const second = replayBattleInputs(normalizedInitialState, fixture.inputs);
  const firstDigest = battleStateDigest(first);
  const secondDigest = battleStateDigest(second);
  const sameInputResult = firstDigest === secondDigest;
  const pass =
    sameInputResult &&
    firstDigest === fixture.expectedDigest &&
    first.elapsedSeconds === fixture.expectedElapsedSeconds &&
    first.status === fixture.expectedStatus;
  return {
    pass,
    sameInputResult,
    initialDigest,
    firstDigest,
    secondDigest,
    expectedDigest: fixture.expectedDigest,
    replayedElapsedSeconds: first.elapsedSeconds,
    expectedElapsedSeconds: fixture.expectedElapsedSeconds,
    reason: pass ? "同じtick入力列の結果digestが一致" : "同じtick入力列の結果が一致しない",
  };
};
