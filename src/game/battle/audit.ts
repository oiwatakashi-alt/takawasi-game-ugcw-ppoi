import type { BattleState } from "./types";

export type BattleAuditEventKind = "battle_started" | "command" | "tick" | "battle_finished";

export interface BattleReplayInput {
  type: "tick";
  elapsedSeconds: number;
}

export interface BattleAuditEvent {
  id: string;
  kind: BattleAuditEventKind;
  tick: number;
  elapsedSeconds: number;
  label: string;
  digest: string;
  changedUnitIds: string[];
  changedEnemyIds: string[];
}

export interface BattleAudit {
  seed: number;
  tickCount: number;
  lastDigest: string;
  events: BattleAuditEvent[];
  replayInputs: BattleReplayInput[];
}

const hashText = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const roundedPosition = (position: { x: number; y: number }) => ({
  x: Math.round(position.x * 100) / 100,
  y: Math.round(position.y * 100) / 100,
});

const battleDigestProjection = (state: BattleState) => ({
  scenarioId: state.scenario.id,
  elapsedSeconds: state.elapsedSeconds,
  status: state.status,
  wavesSpawned: state.wavesSpawned,
  playerUnits: state.playerUnits.map((unit) => ({
    id: unit.unitId,
    soldiers: Math.round(unit.soldiers),
    morale: Math.round(unit.morale * 100) / 100,
    ammo: Math.round(unit.ammo * 100) / 100,
    position: roundedPosition(unit.position),
    order: unit.order,
    actionReason: unit.actionReason,
    casualties: Math.round(unit.casualtiesThisBattle),
    targetId: unit.currentTargetId,
    damage: Math.round(unit.lastDamageDealt * 100) / 100,
  })),
  enemyUnits: state.enemyUnits.map((enemy) => ({
    id: enemy.id,
    count: Math.round(enemy.count),
    morale: Math.round(enemy.assaultPlan.morale * 100) / 100,
    position: roundedPosition(enemy.position),
    state: enemy.assaultPlan.moraleState,
    commandState: enemy.assaultPlan.commandState,
    targetId: enemy.currentTargetId,
  })),
  structures: state.structures.map((structure) => ({
    id: structure.id,
    status: structure.status,
    facilityState: structure.facilityState,
    durability: Math.round(structure.durability),
  })),
  objectiveState: {
    lineIntegrity: Math.round(state.objectiveState.lineIntegrity * 100) / 100,
    enemySuppression: Math.round(state.objectiveState.enemySuppression * 100) / 100,
    victoryControl: Math.round(state.objectiveState.victoryControl * 100) / 100,
    supplyControl: Math.round(state.objectiveState.supplyControl * 100) / 100,
    visibilityControl: Math.round(state.objectiveState.visibilityControl * 100) / 100,
  },
});

export const battleStateDigest = (state: BattleState): string =>
  hashText(JSON.stringify(battleDigestProjection(state))).toString(16).padStart(8, "0");

const changedIds = <T extends { id: string }>(
  previous: T[],
  next: T[],
  projection: (entry: T) => string,
): string[] => {
  const previousById = new Map(previous.map((entry) => [entry.id, projection(entry)]));
  return next
    .filter((entry) => previousById.get(entry.id) !== projection(entry))
    .map((entry) => entry.id);
};

const changedUnitIds = (previous: BattleState, next: BattleState): string[] => {
  const previousById = new Map(
    previous.playerUnits.map((unit) => [
      unit.unitId,
      JSON.stringify({
        soldiers: unit.soldiers,
        morale: unit.morale,
        ammo: unit.ammo,
        position: unit.position,
        order: unit.order,
        actionReason: unit.actionReason,
        casualties: unit.casualtiesThisBattle,
      }),
    ]),
  );
  return next.playerUnits
    .filter((unit) => previousById.get(unit.unitId) !== JSON.stringify({
      soldiers: unit.soldiers,
      morale: unit.morale,
      ammo: unit.ammo,
      position: unit.position,
      order: unit.order,
      actionReason: unit.actionReason,
      casualties: unit.casualtiesThisBattle,
    }))
    .map((unit) => unit.unitId);
};

const changedEnemyIds = (previous: BattleState, next: BattleState): string[] =>
  changedIds(previous.enemyUnits, next.enemyUnits, (enemy) =>
    JSON.stringify({
      count: enemy.count,
      morale: enemy.assaultPlan.morale,
      position: enemy.position,
      moraleState: enemy.assaultPlan.moraleState,
      commandState: enemy.assaultPlan.commandState,
    }),
  );

const isFinished = (state: BattleState): boolean =>
  state.status === "held" || state.status === "withdrawn" || state.status === "collapsed";

export const initializeBattleAudit = (state: BattleState): BattleState => {
  const digest = battleStateDigest(state);
  const seed = hashText(`${state.scenario.id}|${state.scenario.operation.id}|${state.scenario.sectorId}`);
  return {
    ...state,
    audit: {
      seed,
      tickCount: 0,
      lastDigest: digest,
      events: [
        {
          id: "battle-started-0",
          kind: "battle_started",
          tick: 0,
          elapsedSeconds: state.elapsedSeconds,
          label: `${state.scenario.title} 戦闘状態を作成`,
          digest,
          changedUnitIds: state.playerUnits.map((unit) => unit.unitId),
          changedEnemyIds: [],
        },
      ],
      replayInputs: [],
    },
  };
};

export const ensureBattleAudit = (state: BattleState): BattleState =>
  state.audit ? state : initializeBattleAudit(state);

export const recordBattleTransition = (previous: BattleState, next: BattleState): BattleState => {
  const base = ensureBattleAudit(previous).audit;
  if (!base) {
    return initializeBattleAudit(next);
  }
  const tickAdvanced = next.elapsedSeconds > previous.elapsedSeconds;
  const becameFinished = !isFinished(previous) && isFinished(next);
  const kind: BattleAuditEventKind = becameFinished
    ? "battle_finished"
    : tickAdvanced
      ? "tick"
      : "command";
  const digest = battleStateDigest(next);
  const event: BattleAuditEvent = {
    id: `${kind}-${base.events.length}`,
    kind,
    tick: base.tickCount + (tickAdvanced ? 1 : 0),
    elapsedSeconds: next.elapsedSeconds,
    label:
      next.log[0] && next.log[0] !== previous.log[0]
        ? next.log[0]
        : kind === "tick"
          ? `戦闘tick ${next.elapsedSeconds}秒を適用`
          : kind === "battle_finished"
            ? `戦闘終了: ${next.status}`
            : "戦闘状態を更新",
    digest,
    changedUnitIds: changedUnitIds(previous, next),
    changedEnemyIds: changedEnemyIds(previous, next),
  };
  const replayInputs = tickAdvanced
    ? [...base.replayInputs, { type: "tick" as const, elapsedSeconds: previous.elapsedSeconds }].slice(-240)
    : base.replayInputs;
  return {
    ...next,
    audit: {
      seed: base.seed,
      tickCount: base.tickCount + (tickAdvanced ? 1 : 0),
      lastDigest: digest,
      events: [...base.events, event].slice(-240),
      replayInputs,
    },
  };
};
