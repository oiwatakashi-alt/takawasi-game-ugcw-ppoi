import { fireDisciplineWithDefaults } from "../doctrine/applyDoctrine";
import { defaultReserveDoctrinePlan } from "../campaign/deploymentPlan";
import { summarizeFortificationEffects } from "../fortifications/effects";
import {
  chokePointMultiplierForEnemy,
  destinationThroughChokePoints,
  updateChokePointPressures,
} from "./chokePoints";
import {
  formationDistanceToPoint,
  formationExposureMultiplier,
  formationFireMultiplier,
  targetWithinFormationArc,
  updateFormationStates,
} from "./formations";
import { averageMorale } from "./morale";
import type {
  BattleMapBounds,
  BattleEngagement,
  BattleFireMission,
  BattleFirePlan,
  BattleObjectiveNode,
  BattleObjectiveTacticalEffects,
  BattlePosition,
  BattleState,
  BattleStructure,
  BattleTerrainZone,
  BattleUnit,
  EnemyBattleUnit,
  EnemyAssaultPhase,
  EnemyCommandIntent,
  EnemyMoraleState,
  FrontlineSegment,
  BattleObjectiveEventState,
  BattleObjectiveEventSeverity,
} from "./types";
import { lineOfSightBlockage, localTerrainEffect } from "./terrainEffects";
import { updateEnemyVisibility } from "./visibility";
import { createEnemyWave, shouldSpawnWave } from "./waves";

const orderFireMultiplier: Record<BattleUnit["order"], number> = {
  hold: 1.12,
  advance: 0.92,
  flank: 1.16,
  rest: 0.25,
  build: 0.52,
  retreat: 0.18,
};

const orderExposureMultiplier: Record<BattleUnit["order"], number> = {
  hold: 0.78,
  advance: 1.14,
  flank: 1.25,
  rest: 0.62,
  build: 0.88,
  retreat: 0.46,
};

const postureFireMultiplier: Record<BattleUnit["standingOrder"]["posture"], number> = {
  hold_line: 1.04,
  elastic_defense: 0.92,
  aggressive_screen: 1.1,
  fire_support: 1.18,
  engineer_support: 0.58,
  fallback_guard: 0.78,
};

const postureExposureMultiplier: Record<BattleUnit["standingOrder"]["posture"], number> = {
  hold_line: 0.82,
  elastic_defense: 0.72,
  aggressive_screen: 1.12,
  fire_support: 0.9,
  engineer_support: 0.76,
  fallback_guard: 0.62,
};

const ammoPolicyFireMultiplier: Record<BattleUnit["standingOrder"]["ammoPolicy"], number> = {
  normal: 1,
  conserve: 0.78,
  intense: 1.2,
};

const ammoPolicySpendMultiplier: Record<BattleUnit["standingOrder"]["ammoPolicy"], number> = {
  normal: 1,
  conserve: 0.58,
  intense: 1.42,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

const normalizeVector = (from: BattlePosition, to: BattlePosition): BattlePosition => {
  const currentDistance = Math.max(0.1, distance(from, to));
  return {
    x: (to.x - from.x) / currentDistance,
    y: (to.y - from.y) / currentDistance,
  };
};

const moveToward = (
  from: BattlePosition,
  to: BattlePosition,
  step: number,
  bounds: BattleMapBounds,
): { position: BattlePosition; isMoving: boolean } => {
  const currentDistance = distance(from, to);
  if (currentDistance <= 0.1 || step <= 0) {
    return { position: from, isMoving: false };
  }
  const ratio = Math.min(1, step / currentDistance);
  return {
    position: {
      x: clamp(from.x + (to.x - from.x) * ratio, 6, bounds.width - 4),
      y: clamp(from.y + (to.y - from.y) * ratio, 8, bounds.height - 8),
    },
    isMoving: ratio < 1,
  };
};

const clampToControlRadius = (position: BattlePosition, anchor: BattlePosition, radius: number): BattlePosition => {
  const currentDistance = distance(position, anchor);
  if (currentDistance <= radius) {
    return position;
  }
  const ratio = radius / currentDistance;
  return {
    x: anchor.x + (position.x - anchor.x) * ratio,
    y: anchor.y + (position.y - anchor.y) * ratio,
  };
};

const nearestEnemy = (
  from: BattlePosition,
  enemies: EnemyBattleUnit[],
  maximumRange = Number.POSITIVE_INFINITY,
  terrainZones?: BattleTerrainZone[],
): EnemyBattleUnit | undefined =>
  enemies
    .filter(
      (enemy) =>
        enemy.count > 0 &&
        distance(from, enemy.position) <= maximumRange &&
        (!terrainZones || !lineOfSightBlockage(from, enemy.position, terrainZones).blocked),
    )
    .sort((a, b) => distance(from, a.position) - distance(from, b.position))[0];

const enemyDistanceToPlayerFormation = (enemy: EnemyBattleUnit, unit: BattleUnit): number =>
  Math.max(0, formationDistanceToPoint(unit, enemy.position) - enemy.assaultPlan.frontageWidth * 0.22);

const nearestPlayerForEnemy = (
  enemy: EnemyBattleUnit,
  units: BattleUnit[],
  maximumRange = Number.POSITIVE_INFINITY,
): BattleUnit | undefined =>
  units
    .filter((unit) => unit.soldiers > 0 && enemyDistanceToPlayerFormation(enemy, unit) <= maximumRange)
    .sort((a, b) => enemyDistanceToPlayerFormation(enemy, a) - enemyDistanceToPlayerFormation(enemy, b))[0];

const enemyCommandInfluence = (
  enemy: EnemyBattleUnit,
  enemies: EnemyBattleUnit[],
): { influence: number; sourceId?: string; sourceIntent?: EnemyCommandIntent; sourceLabel?: string } => {
  if (enemy.type === "undeadOfficer") {
    return {
      influence: 1,
      sourceId: enemy.id,
      sourceIntent: enemy.assaultPlan.commandIntent,
      sourceLabel: enemy.assaultPlan.commandLabel,
    };
  }
  const commandRadius = 32;
  return (
    enemies
      .filter((candidate) => candidate.type === "undeadOfficer" && candidate.count > 0)
      .map((officer) => {
        const rangeFactor = clamp(1 - distance(enemy.position, officer.position) / commandRadius, 0, 1);
        const sameTarget =
          officer.assaultPlan.targetSegmentId &&
          officer.assaultPlan.targetSegmentId === enemy.assaultPlan.targetSegmentId;
        const sameGroup =
          officer.assaultPlan.commandGroupId &&
          officer.assaultPlan.commandGroupId === enemy.assaultPlan.commandGroupId;
        return {
          influence: rangeFactor * (sameGroup ? 1.32 : sameTarget ? 1.18 : 0.88),
          sourceId: officer.id,
          sourceIntent: officer.assaultPlan.commandIntent,
          sourceLabel: officer.assaultPlan.commandLabel,
        };
      })
      .sort((a, b) => b.influence - a.influence)[0] ?? { influence: 0 }
  );
};

const updateEnemyCommandInfluence = (enemies: EnemyBattleUnit[]): EnemyBattleUnit[] =>
  enemies.map((enemy) => {
    const command = enemyCommandInfluence(enemy, enemies);
    const influence = clamp(command.influence, 0, 1);
    const previousSourceLost =
      enemy.type !== "undeadOfficer" &&
      enemy.assaultPlan.commandInfluence > 0.22 &&
      !!enemy.assaultPlan.commandSourceId &&
      !enemies.some(
        (candidate) =>
          candidate.id === enemy.assaultPlan.commandSourceId &&
          candidate.type === "undeadOfficer" &&
          candidate.count > 0,
      );
    const lostCommand = previousSourceLost || (enemy.assaultPlan.commandInfluence > 0.22 && influence <= 0.08);
    const stillDisrupted = enemy.assaultPlan.commandState === "disrupted" && influence < 0.55;
    const commandState =
      lostCommand || stillDisrupted
        ? "disrupted"
        : influence > 0.12
          ? "commanded"
          : enemy.assaultPlan.commandState === "disrupted"
            ? "disrupted"
            : "none";
    const nextCommandSourceId =
      commandState === "disrupted"
        ? undefined
        : influence > 0.12
          ? command.sourceId
          : undefined;
    const cohesionDelta =
      lostCommand
        ? -0.11
        : commandState === "commanded"
          ? 0.014 + influence * 0.026
          : commandState === "disrupted"
            ? -0.006
            : 0;

    return {
      ...enemy,
      assaultPlan: {
        ...enemy.assaultPlan,
        commandInfluence: influence,
        commandSourceId: nextCommandSourceId,
        commandState,
        commandIntent:
          enemy.type === "undeadOfficer"
            ? enemy.assaultPlan.commandIntent
            : commandState === "commanded" && command.sourceIntent
              ? command.sourceIntent
              : enemy.assaultPlan.commandIntent,
        commandLabel:
          enemy.type === "undeadOfficer"
            ? enemy.assaultPlan.commandLabel
            : commandState === "commanded" && command.sourceLabel
              ? command.sourceLabel
              : enemy.assaultPlan.commandLabel,
        cohesion: clamp(enemy.assaultPlan.cohesion + cohesionDelta, 0.24, 1),
      },
    };
  });

const enemyCommandIntentPressureFactor = (enemy: EnemyBattleUnit): number => {
  if (enemy.assaultPlan.commandState === "disrupted") {
    return 0.9;
  }
  const factors: Record<EnemyCommandIntent, number> = {
    press_line: 1.08,
    flank_line: 1.12,
    breach_works: 1.16,
    fire_support: 0.98,
    rally_wave: 1.02,
  };
  return enemy.assaultPlan.commandState === "commanded" ? factors[enemy.assaultPlan.commandIntent] : 1;
};

const enemyCommandTierPressureFactor = (enemy: EnemyBattleUnit): number => {
  if (enemy.assaultPlan.commandState === "disrupted") {
    return enemy.assaultPlan.commandTier === "assault_lead" ? 0.82 : 0.9;
  }
  if (enemy.assaultPlan.commandState !== "commanded") {
    return 1;
  }
  const factors: Record<NonNullable<EnemyBattleUnit["assaultPlan"]["commandTier"]>, number> = {
    none: 1,
    wave_command: 1.05,
    assault_lead: 1.12,
    support_node: 1.04,
    line_group: 1.02,
  };
  return factors[enemy.assaultPlan.commandTier ?? "none"];
};

const enemyCommandIntentMovementFactor = (enemy: EnemyBattleUnit): number => {
  if (enemy.assaultPlan.commandState === "disrupted") {
    return 0.92;
  }
  const factors: Record<EnemyCommandIntent, number> = {
    press_line: 1.04,
    flank_line: 1.1,
    breach_works: 1.06,
    fire_support: 0.86,
    rally_wave: 0.96,
  };
  return enemy.assaultPlan.commandState === "commanded" ? factors[enemy.assaultPlan.commandIntent] : 1;
};

const enemyTypeMoraleResistance: Record<EnemyBattleUnit["type"], number> = {
  undeadMob: 1.12,
  undeadRiflemen: 0.96,
  brute: 0.58,
  undeadOfficer: 0.78,
};

const enemyMoraleStateLabel: Record<EnemyMoraleState, string> = {
  steady: "維持",
  wavering: "動揺",
  routing: "潰走",
  regrouping: "再集結",
};

const enemyMoraleFactor = (enemy: EnemyBattleUnit): number => {
  const factors: Record<EnemyMoraleState, number> = {
    steady: 1,
    wavering: 0.74,
    routing: 0.24,
    regrouping: 0.48,
  };
  return factors[enemy.assaultPlan.moraleState ?? "steady"];
};

const enemyCommandFactor = (enemy: EnemyBattleUnit): number =>
  clamp(
    1 +
      enemy.assaultPlan.commandInfluence * 0.18 -
      (enemy.assaultPlan.commandState === "disrupted" ? 0.18 : 0),
    0.7,
    1.2,
  );

const enemyPressureFactor = (enemy: EnemyBattleUnit): number =>
  (0.78 + enemy.assaultPlan.cohesion * 0.34) *
  enemyCommandFactor(enemy) *
  enemyCommandIntentPressureFactor(enemy) *
  enemyCommandTierPressureFactor(enemy) *
  enemyMoraleFactor(enemy);

const enemyAssaultPhasePressureFactor = (phase: EnemyAssaultPhase): number => {
  const factors: Record<EnemyAssaultPhase, number> = {
    approach: 0.82,
    engaged: 1,
    flanking: 1.18,
    breakthrough: 1.48,
    overextended: 0.86,
  };
  return factors[phase];
};

const enemyAssaultPhaseLabel: Record<EnemyAssaultPhase, string> = {
  approach: "接近",
  engaged: "交戦",
  flanking: "側面圧",
  breakthrough: "突破",
  overextended: "突出",
};

const targetSegmentForEnemy = (
  enemy: EnemyBattleUnit,
  segments: FrontlineSegment[],
  structures: BattleStructure[],
): FrontlineSegment | undefined => {
  const direct = enemy.assaultPlan.targetSegmentId
    ? segments.find((segment) => segment.id === enemy.assaultPlan.targetSegmentId)
    : undefined;
  if (direct) {
    return direct;
  }
  const targetStructure = enemy.assaultPlan.targetStructureId
    ? structures.find((structure) => structure.id === enemy.assaultPlan.targetStructureId)
    : undefined;
  if (targetStructure) {
    return [...segments].sort(
      (a, b) => distance(a.anchor, targetStructure.position) - distance(b.anchor, targetStructure.position),
    )[0];
  }
  return [...segments].sort((a, b) => distance(a.anchor, enemy.position) - distance(b.anchor, enemy.position))[0];
};

const evaluateEnemyAssaultPhases = (
  enemies: EnemyBattleUnit[],
  segments: FrontlineSegment[],
  structures: BattleStructure[],
): { enemies: EnemyBattleUnit[]; logEntries: string[] } => {
  const logEntries: string[] = [];
  const nextEnemies = enemies.map((enemy) => {
    if (enemy.assaultPlan.moraleState === "routing" || enemy.assaultPlan.moraleState === "regrouping") {
      return {
        ...enemy,
        assaultPlan: {
          ...enemy.assaultPlan,
          phase: "approach" as const,
          penetrationDepth: 0,
          flankPressure: 0,
        },
      };
    }

    const segment = targetSegmentForEnemy(enemy, segments, structures);
    if (!segment) {
      return enemy;
    }

    const penetrationDepth = clamp(segment.anchor.x - enemy.position.x, 0, 48);
    const fallbackDepth = clamp(segment.fallbackPoint.x - enemy.position.x, 0, 48);
    const flankOffset = Math.max(0, Math.abs(enemy.position.y - segment.anchor.y) - segment.controlRadius * 0.62);
    const flankPressure = clamp(
      flankOffset *
        enemy.count *
        enemy.pressure *
        0.012 *
        (0.76 + enemy.assaultPlan.cohesion) *
        (enemy.assaultPlan.commandIntent === "flank_line" && enemy.assaultPlan.commandState === "commanded" ? 1.24 : 1),
      0,
      1400,
    );
    const engagementDistance = distance(enemy.position, segment.anchor);
    const lowCohesion =
      enemy.assaultPlan.cohesion < 0.5 ||
      enemy.assaultPlan.moraleState === "wavering" ||
      enemy.assaultPlan.commandState === "disrupted";
    const counterstrokeOpportunity =
      lowCohesion &&
      (penetrationDepth > 7 ||
        fallbackDepth > 2 ||
        (flankPressure > 145 && enemy.position.x <= segment.anchor.x + 58) ||
        engagementDistance <= segment.controlRadius + enemy.assaultPlan.frontageWidth * 0.34);
    const phase: EnemyAssaultPhase =
      counterstrokeOpportunity
        ? "overextended"
        : penetrationDepth >
              (enemy.assaultPlan.commandIntent === "breach_works" && enemy.assaultPlan.commandState === "commanded"
                ? 11
                : 15) ||
            fallbackDepth > 5
          ? "breakthrough"
          : flankPressure > 120 && enemy.position.x <= segment.anchor.x + 86
            ? "flanking"
            : flankPressure > 160 && penetrationDepth > 2
            ? "flanking"
            : engagementDistance <= segment.controlRadius + enemy.assaultPlan.frontageWidth * 0.45 || penetrationDepth > 0
              ? "engaged"
              : "approach";

    if (enemy.assaultPlan.phase !== phase && (phase === "flanking" || phase === "breakthrough" || phase === "overextended")) {
      logEntries.push(
        `${enemy.name}が${segment.name}で${enemyAssaultPhaseLabel[phase]}。深度${Math.round(
          penetrationDepth,
        )} / 側面圧${Math.round(flankPressure)}。`,
      );
    }

    return {
      ...enemy,
      assaultPlan: {
        ...enemy.assaultPlan,
        phase,
        penetrationDepth,
        flankPressure,
      },
    };
  });
  return { enemies: nextEnemies, logEntries };
};

const moraleDestinationForEnemy = (enemy: EnemyBattleUnit, bounds: BattleMapBounds): BattlePosition => ({
  x: enemy.assaultPlan.moraleState === "routing" ? bounds.width - 5 : bounds.width - 18,
  y: clamp(enemy.position.y - enemy.assaultPlan.vector.y * 10, 12, bounds.height - 12),
});

const updateEnemyMoraleStates = (
  enemies: EnemyBattleUnit[],
  bounds: BattleMapBounds,
): { enemies: EnemyBattleUnit[]; logEntries: string[] } => {
  const logEntries: string[] = [];
  const nextEnemies = enemies.map((enemy) => {
    const currentMorale = enemy.assaultPlan.morale ?? 0.7;
    const commandTierRecovery =
      enemy.assaultPlan.commandTier === "wave_command"
        ? 0.008
        : enemy.assaultPlan.commandTier === "support_node"
          ? 0.005
          : enemy.assaultPlan.commandTier === "assault_lead"
            ? 0.003
            : 0;
    const commandRecovery =
      enemy.assaultPlan.commandState === "commanded"
        ? 0.012 +
          enemy.assaultPlan.commandInfluence * 0.018 +
          (enemy.assaultPlan.commandIntent === "rally_wave" ? 0.012 : 0) +
          commandTierRecovery
        : 0;
    const regroupRecovery =
      enemy.assaultPlan.moraleState === "regrouping" || enemy.assaultPlan.moraleState === "routing" ? 0.01 : 0;
    const disruptionDrain =
      enemy.assaultPlan.commandState === "disrupted" ? 0.007 : 0;
    const cohesionDrag = enemy.assaultPlan.cohesion < 0.42 ? 0.005 : 0;
    const morale = clamp(currentMorale + commandRecovery + regroupRecovery - disruptionDrain - cohesionDrag, 0, 1);

    const isCurrentlyRouting = enemy.assaultPlan.moraleState === "routing";
    const isCurrentlyRegrouping = enemy.assaultPlan.moraleState === "regrouping";
    const hasRallySpace =
      enemy.position.x >= bounds.width * 0.56 ||
      enemy.assaultPlan.commandInfluence >= 0.1 ||
      enemy.assaultPlan.commandState !== "disrupted";
    let moraleState: EnemyMoraleState = "steady";
    if (isCurrentlyRouting) {
      moraleState = morale >= 0.32 && enemy.assaultPlan.cohesion >= 0.28 && hasRallySpace ? "regrouping" : "routing";
    } else if (isCurrentlyRegrouping) {
      moraleState = morale >= 0.7 && enemy.assaultPlan.cohesion >= 0.62 ? "steady" : "regrouping";
    } else if (
      morale <= 0.3 ||
      (morale <= 0.46 && enemy.assaultPlan.cohesion <= 0.44) ||
      (enemy.assaultPlan.commandState === "disrupted" && enemy.assaultPlan.cohesion <= 0.46)
    ) {
      moraleState = "routing";
    } else if (
      morale <= 0.58 ||
      enemy.assaultPlan.cohesion <= 0.58 ||
      enemy.assaultPlan.moraleState === "regrouping" ||
      (enemy.assaultPlan.commandState === "disrupted" && enemy.assaultPlan.cohesion <= 0.52)
    ) {
      moraleState = "wavering";
    }

    if (enemy.assaultPlan.moraleState !== moraleState) {
      logEntries.push(
        `${enemy.name} ${enemyMoraleStateLabel[enemy.assaultPlan.moraleState ?? "steady"]} -> ${enemyMoraleStateLabel[moraleState]}。`,
      );
    }

    return {
      ...enemy,
      assaultPlan: {
        ...enemy.assaultPlan,
        morale,
        moraleState,
        cohesion:
          moraleState === "routing"
            ? clamp(enemy.assaultPlan.cohesion - 0.012, 0.18, 1)
            : moraleState === "regrouping"
              ? clamp(enemy.assaultPlan.cohesion + 0.009, 0.18, 1)
              : enemy.assaultPlan.cohesion,
      },
    };
  });

  return { enemies: nextEnemies, logEntries };
};

const suppressRoutedEnemyTargets = (enemies: EnemyBattleUnit[]): EnemyBattleUnit[] =>
  enemies.map((enemy) =>
    enemy.assaultPlan.moraleState === "routing" || enemy.assaultPlan.moraleState === "regrouping"
      ? { ...enemy, currentTargetId: undefined }
      : enemy,
  );

const laneOffsetForEnemy = (enemy: EnemyBattleUnit, index: number): BattlePosition => {
  const vector = enemy.assaultPlan.vector;
  const lateral = { x: -vector.y, y: vector.x };
  const lane = ((index % 3) - 1) * enemy.assaultPlan.laneSpread * (1.14 - enemy.assaultPlan.cohesion * 0.52);
  return {
    x: lateral.x * lane,
    y: lateral.y * lane,
  };
};

const enemyAssaultDestination = (
  enemy: EnemyBattleUnit,
  index: number,
  target: BattleUnit | undefined,
  bounds: BattleMapBounds,
): BattlePosition => {
  const vector = enemy.assaultPlan.vector;
  const offset = laneOffsetForEnemy(enemy, index);
  const base = target
    ? {
        x: target.position.x - vector.x * (enemy.range > 8 ? enemy.range * 0.62 : enemy.assaultPlan.depth * 0.32),
        y: target.position.y - vector.y * (enemy.range > 8 ? enemy.range * 0.62 : enemy.assaultPlan.depth * 0.32),
      }
    : enemy.destination;
  return {
    x: clamp(base.x + offset.x, 6, bounds.width - 4),
    y: clamp(base.y + offset.y, 8, bounds.height - 8),
  };
};

const targetByPriority = (
  unit: BattleUnit,
  enemies: EnemyBattleUnit[],
  maximumRange = Number.POSITIVE_INFINITY,
  terrainZones: BattleTerrainZone[] = [],
): EnemyBattleUnit | undefined => {
  const candidates = enemies.filter((enemy) => {
    if (enemy.count <= 0) {
      return false;
    }
    const sight = lineOfSightBlockage(unit.position, enemy.position, terrainZones);
    return targetWithinFormationArc(unit, enemy.position, maximumRange * sight.rangeMultiplier) && !sight.blocked;
  });
  const nearest = [...candidates].sort(
    (a, b) => formationDistanceToPoint(unit, a.position) - formationDistanceToPoint(unit, b.position),
  )[0];
  if (candidates.length === 0) {
    return undefined;
  }

  const focusedTarget = unit.focusTargetId
    ? candidates.find((enemy) => enemy.id === unit.focusTargetId)
    : undefined;
  if (focusedTarget) {
    return focusedTarget;
  }

  const byType = (type: EnemyBattleUnit["type"]) =>
    candidates
      .filter((enemy) => enemy.type === type)
      .sort((a, b) => formationDistanceToPoint(unit, a.position) - formationDistanceToPoint(unit, b.position))[0];

  if (unit.standingOrder.targetPriority === "brute") {
    return byType("brute") ?? nearest;
  }
  if (unit.standingOrder.targetPriority === "officer") {
    return byType("undeadOfficer") ?? nearest;
  }
  if (unit.standingOrder.targetPriority === "riflemen") {
    return byType("undeadRiflemen") ?? nearest;
  }
  if (unit.standingOrder.targetPriority === "largest_mass") {
    return [...candidates].sort((a, b) => b.count * b.pressure - a.count * a.pressure)[0] ?? nearest;
  }
  if (unit.standingOrder.targetPriority === "weakest") {
    return [...candidates].sort((a, b) => a.count - b.count)[0] ?? nearest;
  }
  return nearest;
};

const localCoverForUnit = (unit: BattleUnit, structures: BattleStructure[]): number =>
  structures
    .filter((structure) => structure.status === "built" || structure.status === "damaged")
    .reduce((cover, structure) => {
      const proximity = distance(unit.position, structure.position);
      if (proximity > structure.blockedRadius + 12) {
        return cover;
      }
      const typeCover =
        structure.type === "trench"
          ? 34
          : structure.type === "barricade"
            ? 22
            : structure.type === "observationPost"
              ? 6
              : structure.type === "fieldHospital"
                ? 4
                : 9;
      const durabilityFactor = clamp(structure.durability / structure.maxDurability, 0.15, 1);
      return cover + typeCover * durabilityFactor * (1 - proximity / (structure.blockedRadius + 12));
    }, 0);

const applyEnemyDamage = (
  enemies: EnemyBattleUnit[],
  targetId: string,
  damage: number,
  moraleShockMultiplier = 1,
): { enemies: EnemyBattleUnit[]; actualDamage: number } => {
  let actualDamage = 0;
  const nextEnemies = enemies
    .map((enemy) => {
      if (enemy.id !== targetId) {
        return enemy;
      }
      actualDamage = Math.min(enemy.count, Math.max(0, damage));
      const cohesionLoss = clamp(actualDamage / Math.max(12, enemy.count) * 0.16, 0, 0.12);
      const moraleLoss = clamp(
        (actualDamage / Math.max(10, enemy.count)) *
          0.44 *
          moraleShockMultiplier *
          enemyTypeMoraleResistance[enemy.type] +
          (enemy.assaultPlan.commandState === "disrupted" ? 0.014 : 0),
        0,
        0.28,
      );
      return {
        ...enemy,
        count: enemy.count - actualDamage,
        assaultPlan: {
          ...enemy.assaultPlan,
          morale: clamp((enemy.assaultPlan.morale ?? 0.7) - moraleLoss, 0, 1),
          cohesion: clamp(enemy.assaultPlan.cohesion - cohesionLoss, 0.32, 1),
        },
      };
    })
    .filter((enemy) => enemy.count > 0.5);

  return { enemies: nextEnemies, actualDamage };
};

const playerFireDamage = (unit: BattleUnit, target: EnemyBattleUnit, terrainZones: BattleTerrainZone[]): number => {
  const terrain = localTerrainEffect(unit.position, terrainZones);
  const sight = lineOfSightBlockage(unit.position, target.position, terrainZones);
  const commandTransmissionFactor = unit.pendingOrder && unit.pendingOrder.arrivesAt > unit.pendingOrder.issuedAt ? 0.84 : 1;
  const soldierFactor = Math.max(0.1, unit.soldiers / 720);
  const moraleFactor = clamp(unit.morale / 100, 0.18, 1.15);
  const conditionFactor = clamp(unit.condition / 100, 0.24, 1.05);
  const ammoFactor = clamp(unit.ammo / 100, 0.16, 1);
  return (
    soldierFactor *
    unit.weaponQuality *
    unit.firepower *
    unit.fireRate *
    moraleFactor *
    conditionFactor *
    ammoFactor *
    orderFireMultiplier[unit.order] *
    postureFireMultiplier[unit.standingOrder.posture] *
    ammoPolicyFireMultiplier[unit.standingOrder.ammoPolicy] *
    formationFireMultiplier(unit) *
    terrain.fireMultiplier *
    sight.fireMultiplier *
    commandTransmissionFactor
  );
};

const shouldUseFallback = (unit: BattleUnit): boolean => {
  const fallback = unit.standingOrder.fallback;
  if (!fallback.enabled) {
    return false;
  }
  const soldierRatio = unit.soldiers / Math.max(1, unit.maxSoldiers);
  return (
    (fallback.moraleBelow !== undefined && unit.morale <= fallback.moraleBelow) ||
    (fallback.soldiersBelowRatio !== undefined && soldierRatio <= fallback.soldiersBelowRatio) ||
    (fallback.ammoBelow !== undefined && unit.ammo <= fallback.ammoBelow)
  );
};

const assignedStructureForUnit = (unit: BattleUnit, structures: BattleStructure[]): BattleStructure | undefined =>
  unit.standingOrder.facilityAssignment
    ? structures.find((structure) => structure.id === unit.standingOrder.facilityAssignment?.structureId)
    : undefined;

const withMovementReason = (
  unit: BattleUnit,
  moved: { position: BattlePosition; isMoving: boolean },
  movingReason: BattleUnit["actionReason"],
  settledReason: BattleUnit["actionReason"],
): BattleUnit => ({
  ...unit,
  ...moved,
  actionReason: moved.isMoving ? movingReason : settledReason,
});

const firingReasonForUnit = (unit: BattleUnit): BattleUnit["actionReason"] =>
  ["falling_back", "retreating", "moving_to_supply", "resupplying", "moving_to_repair", "repairing_structure"].includes(
    unit.actionReason,
  )
    ? unit.actionReason
    : "firing_target";

const movePlayerUnit = (
  unit: BattleUnit,
  index: number,
  enemies: EnemyBattleUnit[],
  structures: BattleStructure[],
  bounds: BattleMapBounds,
  terrainZones: BattleTerrainZone[],
): BattleUnit => {
  if (unit.soldiers <= 0) {
    return { ...unit, isMoving: false, actionReason: "destroyed" };
  }

  const movementMultiplier =
    localTerrainEffect(unit.position, terrainZones).movement *
    (unit.pendingOrder && unit.pendingOrder.arrivesAt > unit.pendingOrder.issuedAt ? 0.62 : 1);
  const closestEnemy = nearestEnemy(unit.position, enemies);
  if (shouldUseFallback(unit) && unit.order !== "advance" && unit.order !== "flank") {
    const moved = moveToward(unit.position, unit.standingOrder.fallback.destination, 1.05 * movementMultiplier, bounds);
    return withMovementReason(
      { ...unit, order: unit.order === "retreat" ? "retreat" : unit.order },
      moved,
      "falling_back",
      "falling_back",
    );
  }

  if (unit.order === "advance" && closestEnemy && distance(unit.position, closestEnemy.position) > unit.range * 0.62) {
    const destination = {
      x: clamp(closestEnemy.position.x - unit.range * 0.55, 18, bounds.width * 0.56),
      y: closestEnemy.position.y,
    };
    const moved = moveToward(unit.position, destination, 0.72 * movementMultiplier, bounds);
    return withMovementReason(unit, moved, "advancing", "holding_anchor");
  }

  if (unit.order === "flank") {
    const flankDirection = index % 2 === 0 ? -1 : 1;
    const destination = closestEnemy
      ? {
          x: clamp(closestEnemy.position.x - unit.range * 0.48, 18, bounds.width * 0.58),
          y: clamp(closestEnemy.position.y + flankDirection * 18, 12, 88),
        }
      : { x: clamp(unit.position.x + 0.6, 14, bounds.width * 0.58), y: clamp(unit.position.y + flankDirection * 9, 12, 88) };
    const moved = moveToward(unit.position, destination, 0.86 * movementMultiplier, bounds);
    return withMovementReason(unit, moved, "flanking", "holding_anchor");
  }

  if (unit.order === "retreat") {
    const moved = moveToward(unit.position, unit.standingOrder.fallback.destination, 1.1 * movementMultiplier, bounds);
    return withMovementReason(unit, moved, "retreating", "retreating");
  }

  const assignedStructure = assignedStructureForUnit(unit, structures);
  const assignedMode = unit.standingOrder.facilityAssignment?.mode;
  if ((unit.order === "build" || unit.standingOrder.posture === "engineer_support") && unit.type === "engineer") {
    const damagedStructure =
      assignedStructure && (assignedStructure.status === "damaged" || assignedStructure.durability < assignedStructure.maxDurability)
        ? assignedStructure
        : structures
      .filter((structure) => structure.status === "damaged" || structure.durability < structure.maxDurability)
      .sort((a, b) => distance(unit.position, a.position) - distance(unit.position, b.position))[0];
    if (damagedStructure && distance(unit.position, damagedStructure.position) > 9) {
      const moved = moveToward(unit.position, damagedStructure.position, 0.64 * movementMultiplier, bounds);
      return withMovementReason(unit, moved, "moving_to_repair", "repairing_structure");
    }
    if (damagedStructure) {
      return { ...unit, isMoving: false, actionReason: "repairing_structure" };
    }
  }

  if (assignedStructure && (assignedMode === "defend" || assignedMode === "hold_near" || assignedMode === "resupply")) {
    const assignedAnchor = {
      x: assignedStructure.type === "supplyDepot" ? assignedStructure.position.x - 4 : assignedStructure.position.x - 6,
      y: assignedStructure.position.y,
    };
    if (distance(unit.position, assignedAnchor) > Math.max(7, unit.standingOrder.controlRadius * 0.55)) {
      const moved = moveToward(unit.position, assignedAnchor, (unit.order === "rest" ? 0.42 : 0.54) * movementMultiplier, bounds);
      return withMovementReason(
        unit,
        moved,
        assignedMode === "resupply" ? "moving_to_supply" : "moving_to_facility",
        assignedMode === "resupply" ? "resupplying" : "holding_anchor",
      );
    }
    if (assignedMode === "resupply" && assignedStructure.type === "supplyDepot") {
      return { ...unit, isMoving: false, actionReason: "resupplying" };
    }
  }

  if (closestEnemy && unit.standingOrder.posture === "aggressive_screen") {
    const desired = clampToControlRadius(
      {
        x: closestEnemy.position.x - unit.range * 0.64,
        y: closestEnemy.position.y + (index % 2 === 0 ? -7 : 7),
      },
      unit.standingOrder.anchor,
      unit.standingOrder.controlRadius,
    );
    if (distance(unit.position, desired) > 3) {
      const moved = moveToward(unit.position, desired, 0.5 * movementMultiplier, bounds);
      return withMovementReason(unit, moved, "advancing", "holding_anchor");
    }
  }

  if (distance(unit.position, unit.standingOrder.anchor) > unit.standingOrder.controlRadius) {
    const moved = moveToward(unit.position, unit.standingOrder.anchor, 0.5 * movementMultiplier, bounds);
    return withMovementReason(unit, moved, "returning_anchor", "holding_anchor");
  }

  if (unit.order === "rest") {
    return { ...unit, isMoving: false, actionReason: "recovering" };
  }

  return { ...unit, isMoving: false, actionReason: "holding_anchor" };
};

const engagementKindForUnit = (unit: BattleUnit): BattleEngagement["kind"] => {
  if (unit.type === "artillery") {
    return "artillery";
  }
  return unit.range <= 18 ? "melee" : "rifle";
};

const supplyRecoveryForUnit = (
  unit: BattleUnit,
  structures: BattleStructure[],
  fortAmmoRecovery: number,
  objectiveNodes: BattleObjectiveNode[],
  objectiveEffects: BattleObjectiveTacticalEffects,
): number => {
  const assignedStructure = assignedStructureForUnit(unit, structures);
  const hasAssignedSupply =
    assignedStructure?.type === "supplyDepot" &&
    unit.standingOrder.facilityAssignment?.mode === "resupply" &&
    distance(unit.position, assignedStructure.position) <= 11 &&
    assignedStructure.status !== "overrun" &&
    assignedStructure.status !== "abandoned";

  const restRecovery = unit.order === "rest" ? fortAmmoRecovery / 24 : 0;
  const supplyNode = objectiveNodes.find((node) => node.type === "supply");
  const nodeRecovery =
    supplyNode &&
    supplyNode.control === "player" &&
    distance(unit.position, supplyNode.position) <= supplyNode.radius + 7 &&
    unit.ammo < 86
      ? 0.18 + supplyNode.controlProgress / 900
      : 0;
  const routedSupplyRecovery =
    supplyNode && supplyNode.control === "player" && unit.ammo < 72 && unit.order !== "retreat"
      ? objectiveEffects.supplyAmmoRecoveryModifier
      : 0;
  const contestedPenalty = supplyNode?.control === "enemy" && unit.order === "rest" ? -0.08 : 0;
  return Math.max(0, restRecovery + (hasAssignedSupply ? 0.42 : 0) + nodeRecovery + routedSupplyRecovery + contestedPenalty);
};

const objectiveEventForNode = (node: BattleObjectiveNode): BattleObjectiveEventState => {
  const progress = node.controlProgress;
  if (node.type === "victory") {
    if (progress <= 28) {
      return {
        id: "signal-cut",
        label: "指揮信号途絶",
        detail: `${node.scenario.label}が敵圧で切断されています。`,
        severity: "critical",
        effectSummary: "戦線維持-4",
        degradationSeconds: 0,
        chainStage: 0,
        chainLabel: "連鎖なし",
        chainDetail: "指揮線の二次崩壊はまだ発生していません。",
        chainEffectSummary: "追加悪化なし",
      };
    }
    if (progress <= 42) {
      return {
        id: "signal-disrupted",
        label: "信号線混乱",
        detail: `${node.scenario.label}の信号線が乱れています。`,
        severity: "strained",
        effectSummary: "戦線維持-2",
        degradationSeconds: 0,
        chainStage: 0,
        chainLabel: "連鎖なし",
        chainDetail: "指揮線の二次崩壊はまだ発生していません。",
        chainEffectSummary: "追加悪化なし",
      };
    }
    return {
      id: "signal-stable",
      label: "信号維持",
      detail: `${node.scenario.label}の指揮信号は維持されています。`,
      severity: "stable",
      effectSummary: "追加影響なし",
      degradationSeconds: 0,
      chainStage: 0,
      chainLabel: "連鎖なし",
      chainDetail: "指揮線は安定しています。",
      chainEffectSummary: "追加悪化なし",
    };
  }
  if (node.type === "supply") {
    if (progress <= 28) {
      return {
        id: "supply-burning",
        label: "補給点炎上",
        detail: `${node.scenario.label}の補給物資が敵圧で燃えています。`,
        severity: "critical",
        effectSummary: "弾薬回復-0.08",
        degradationSeconds: 0,
        chainStage: 0,
        chainLabel: "連鎖なし",
        chainDetail: "補給崩壊の二次被害はまだ発生していません。",
        chainEffectSummary: "追加悪化なし",
      };
    }
    if (progress <= 42) {
      return {
        id: "supply-disrupted",
        label: "補給路混乱",
        detail: `${node.scenario.label}への連絡路が乱れています。`,
        severity: "strained",
        effectSummary: "弾薬回復-0.04",
        degradationSeconds: 0,
        chainStage: 0,
        chainLabel: "連鎖なし",
        chainDetail: "補給崩壊の二次被害はまだ発生していません。",
        chainEffectSummary: "追加悪化なし",
      };
    }
    return {
      id: "supply-stable",
      label: "補給整理",
      detail: `${node.scenario.label}の補給路は使用可能です。`,
      severity: "stable",
      effectSummary: "追加影響なし",
      degradationSeconds: 0,
      chainStage: 0,
      chainLabel: "連鎖なし",
      chainDetail: "補給路は安定しています。",
      chainEffectSummary: "追加悪化なし",
    };
  }
  if (progress <= 28) {
    return {
      id: "visibility-silenced",
      label: "観測点沈黙",
      detail: `${node.scenario.label}が沈黙し、敵群の接近が読みにくくなっています。`,
      severity: "critical",
      effectSummary: "視界-8",
      degradationSeconds: 0,
      chainStage: 0,
      chainLabel: "連鎖なし",
      chainDetail: "観測崩壊の二次被害はまだ発生していません。",
      chainEffectSummary: "追加悪化なし",
    };
  }
  if (progress <= 42) {
    return {
      id: "visibility-disrupted",
      label: "観測線乱れ",
      detail: `${node.scenario.label}の観測線が乱れています。`,
      severity: "strained",
      effectSummary: "視界-4",
      degradationSeconds: 0,
      chainStage: 0,
      chainLabel: "連鎖なし",
      chainDetail: "観測崩壊の二次被害はまだ発生していません。",
      chainEffectSummary: "追加悪化なし",
    };
  }
  return {
    id: "visibility-stable",
    label: "観測継続",
    detail: `${node.scenario.label}は観測機能を保っています。`,
    severity: "stable",
    effectSummary: "追加影響なし",
    degradationSeconds: 0,
    chainStage: 0,
    chainLabel: "連鎖なし",
    chainDetail: "観測線は安定しています。",
    chainEffectSummary: "追加悪化なし",
  };
};

const objectiveEventChainStage = (severity: BattleObjectiveEventSeverity, degradationSeconds: number): number => {
  if (severity === "stable") {
    return 0;
  }
  if (severity === "critical" && degradationSeconds >= 24) {
    return 2;
  }
  if (degradationSeconds >= 12) {
    return 1;
  }
  return 0;
};

const objectiveEventChainLabels = (
  type: BattleObjectiveNode["type"],
  chainStage: number,
): { chainLabel: string; chainDetail: string; chainEffectSummary: string } => {
  if (chainStage <= 0) {
    return {
      chainLabel: "連鎖なし",
      chainDetail: "二次被害はまだ発生していません。",
      chainEffectSummary: "追加悪化なし",
    };
  }
  if (type === "victory") {
    return chainStage >= 2
      ? {
          chainLabel: "指揮崩壊拡大",
          chainDetail: "命令の遅延が隣接戦線へ波及しています。",
          chainEffectSummary: "連鎖 戦線維持-4",
        }
      : {
          chainLabel: "命令混線",
          chainDetail: "予備と前線の命令伝達が遅れています。",
          chainEffectSummary: "連鎖 戦線維持-2",
        };
  }
  if (type === "supply") {
    return chainStage >= 2
      ? {
          chainLabel: "弾薬誘爆",
          chainDetail: "補給点の損傷が周辺弾薬と搬送路へ広がっています。",
          chainEffectSummary: "連鎖 弾薬回復-0.06",
        }
      : {
          chainLabel: "補給路寸断",
          chainDetail: "前線への弾薬搬送が滞り始めています。",
          chainEffectSummary: "連鎖 弾薬回復-0.03",
        };
  }
  return chainStage >= 2
    ? {
        chainLabel: "霧中突破",
        chainDetail: "敵群が観測死角を使って前進しています。",
        chainEffectSummary: "連鎖 視界-6",
      }
    : {
        chainLabel: "死角拡大",
        chainDetail: "観測線の穴が広がり、敵接近の判読が遅れています。",
        chainEffectSummary: "連鎖 視界-3",
      };
};

const objectiveEventWithChain = (
  node: BattleObjectiveNode,
  baseEventState: BattleObjectiveEventState,
): BattleObjectiveEventState => {
  if (baseEventState.severity === "stable") {
    return baseEventState;
  }
  const previousSeconds = node.eventState.id === baseEventState.id ? node.eventState.degradationSeconds : 0;
  const degradationSeconds = previousSeconds + 1;
  const chainStage = objectiveEventChainStage(baseEventState.severity, degradationSeconds);
  const chain = objectiveEventChainLabels(node.type, chainStage);
  return {
    ...baseEventState,
    degradationSeconds,
    chainStage,
    ...chain,
  };
};

const objectiveEventChainModifier = (node: BattleObjectiveNode): number => {
  if (node.eventState.chainStage <= 0) {
    return 0;
  }
  if (node.type === "victory") {
    return node.eventState.chainStage >= 2 ? -4 : -2;
  }
  if (node.type === "supply") {
    return node.eventState.chainStage >= 2 ? -0.06 : -0.03;
  }
  return node.eventState.chainStage >= 2 ? -6 : -3;
};

const objectiveTacticalEffects = (
  victoryControl: number,
  supplyControl: number,
  visibilityControl: number,
  objectiveNodes: BattleObjectiveNode[] = [],
): BattleObjectiveTacticalEffects => {
  const eventLineIntegrityModifier = objectiveNodes.reduce((sum, node) => {
    if (node.type !== "victory") {
      return sum;
    }
    return sum + (node.eventState.id === "signal-cut" ? -4 : node.eventState.id === "signal-disrupted" ? -2 : 0) + objectiveEventChainModifier(node);
  }, 0);
  const eventAmmoRecoveryModifier = objectiveNodes.reduce((sum, node) => {
    if (node.type !== "supply") {
      return sum;
    }
    return sum + (node.eventState.id === "supply-burning" ? -0.08 : node.eventState.id === "supply-disrupted" ? -0.04 : 0) + objectiveEventChainModifier(node);
  }, 0);
  const eventSpottingModifier = objectiveNodes.reduce((sum, node) => {
    if (node.type !== "visibility") {
      return sum;
    }
    return sum + (node.eventState.id === "visibility-silenced" ? -8 : node.eventState.id === "visibility-disrupted" ? -4 : 0) + objectiveEventChainModifier(node);
  }, 0);
  const victoryBaseModifier =
    victoryControl >= 70 ? 4 : victoryControl >= 62 ? 2 : victoryControl <= 28 ? -10 : victoryControl <= 38 ? -6 : 0;
  const supplyBaseModifier =
    supplyControl >= 72 ? 0.16 : supplyControl >= 62 ? 0.09 : supplyControl <= 28 ? -0.08 : supplyControl <= 38 ? -0.04 : 0;
  const fireMissionAmmoMultiplier =
    supplyControl >= 72 ? 0.86 : supplyControl >= 62 ? 0.94 : supplyControl <= 28 ? 1.18 : supplyControl <= 38 ? 1.1 : 1;
  const visibilityBaseBonus =
    visibilityControl >= 72 ? 14 : visibilityControl >= 62 ? 8 : visibilityControl <= 28 ? -14 : visibilityControl <= 38 ? -8 : 0;
  const visibilitySuppressionBonus =
    visibilityControl >= 72 ? 0.22 : visibilityControl >= 62 ? 0.12 : visibilityControl <= 32 ? -0.08 : 0;
  const victoryLineIntegrityModifier = victoryBaseModifier + eventLineIntegrityModifier;
  const supplyAmmoRecoveryModifier = supplyBaseModifier + eventAmmoRecoveryModifier;
  const visibilitySpottingBonus = visibilityBaseBonus + eventSpottingModifier;
  const waveIntelClarity = visibilityControl >= 62 ? "clear" : visibilityControl <= 34 ? "blind" : "strained";
  const waveIntelLabel =
    waveIntelClarity === "clear" ? "敵波明瞭" : waveIntelClarity === "blind" ? "敵波不明瞭" : "敵波推定";
  const activeEvents = objectiveNodes
    .map((node) => node.eventState)
    .filter((event) => event.severity !== "stable")
    .map((event) => (event.chainStage > 0 ? `${event.label}:${event.chainLabel}` : event.label));
  const eventSummary = activeEvents.length > 0 ? activeEvents.join(" / ") : "安定";
  const summary = [
    `勝利点${victoryLineIntegrityModifier >= 0 ? "+" : ""}${victoryLineIntegrityModifier}戦線`,
    `補給${supplyAmmoRecoveryModifier >= 0 ? "+" : ""}${supplyAmmoRecoveryModifier.toFixed(2)}弾薬`,
    `斉射弾薬x${fireMissionAmmoMultiplier.toFixed(2)}`,
    `視界${visibilitySpottingBonus >= 0 ? "+" : ""}${visibilitySpottingBonus}`,
    `制圧${visibilitySuppressionBonus >= 0 ? "+" : ""}${visibilitySuppressionBonus.toFixed(2)}`,
    waveIntelLabel,
    `イベント ${eventSummary}`,
  ].join(" / ");

  return {
    victoryLineIntegrityModifier,
    supplyAmmoRecoveryModifier,
    fireMissionAmmoMultiplier,
    visibilitySpottingBonus,
    visibilitySuppressionBonus,
    eventLineIntegrityModifier,
    eventAmmoRecoveryModifier,
    eventSpottingModifier,
    waveIntelClarity,
    waveIntelLabel,
    eventSummary,
    summary,
  };
};

const objectiveControlForProgress = (progress: number): BattleObjectiveNode["control"] => {
  if (progress >= 62) {
    return "player";
  }
  if (progress <= 34) {
    return "enemy";
  }
  return "contested";
};

const updateObjectiveNodes = (
  objectiveNodes: BattleObjectiveNode[],
  playerUnits: BattleUnit[],
  enemyUnits: EnemyBattleUnit[],
): { nodes: BattleObjectiveNode[]; logEntries: string[] } => {
  const logEntries: string[] = [];
  const nodes = objectiveNodes.map((node) => {
    const playerPresence = playerUnits.reduce((sum, unit) => {
      if (unit.soldiers <= 0 || distance(unit.position, node.position) > node.radius + unit.formation.frontageWidth * 0.12) {
        return sum;
      }
      const postureFactor = unit.standingOrder.posture === "fallback_guard" ? 0.82 : unit.order === "retreat" ? 0.35 : 1;
      return sum + (unit.soldiers / 90) * postureFactor * node.scenario.playerPresenceMultiplier;
    }, 0);
    const enemyPresence = enemyUnits.reduce((sum, enemy) => {
      if (enemy.count <= 0 || distance(enemy.position, node.position) > node.radius + enemy.assaultPlan.frontageWidth * 0.18) {
        return sum;
      }
      const commandFactor = enemy.assaultPlan.commandState === "commanded" ? 1.16 : enemy.assaultPlan.commandState === "disrupted" ? 0.72 : 1;
      return sum + enemy.count * enemy.pressure * 0.018 * commandFactor * enemyMoraleFactor(enemy) * node.scenario.enemyPresenceMultiplier;
    }, 0);
    const net = playerPresence - enemyPresence;
    const drift =
      (net > 0 ? Math.min(2.8, net * 0.34) : Math.max(-3.8, net * 0.42)) * node.scenario.controlDriftMultiplier;
    const previousControl = node.control;
    const previousEventId = node.eventState.id;
    const controlProgress = clamp(node.controlProgress + drift, 0, 100);
    const control = objectiveControlForProgress(controlProgress);
    const eventState = objectiveEventWithChain(node, objectiveEventForNode({ ...node, control, controlProgress }));
    if (control !== previousControl) {
      const label = control === "player" ? "保持" : control === "enemy" ? "喪失" : "争奪";
      logEntries.push(`${node.label}は${label}状態へ変化。`);
    }
    if (eventState.id !== previousEventId) {
      logEntries.push(`${node.label}/${node.scenario.label}: ${eventState.label}。${eventState.effectSummary}`);
    }
    if (eventState.chainStage > (node.eventState.chainStage ?? 0)) {
      logEntries.push(`${node.label}/${node.scenario.label}: ${eventState.chainLabel}。${eventState.chainEffectSummary}`);
    }
    return {
      ...node,
      control,
      eventState,
      controlProgress,
      playerPresence: Number(playerPresence.toFixed(2)),
      enemyPresence: Number(enemyPresence.toFixed(2)),
    };
  });
  return { nodes, logEntries };
};

const isReservePosture = (unit: BattleUnit): boolean =>
  !!unit.standingOrder.frontlineSegmentId?.includes("reserve") ||
  unit.standingOrder.posture === "fire_support" ||
  unit.standingOrder.posture === "fallback_guard";

const updateReserveReadinessForUnit = (
  unit: BattleUnit,
  enemies: EnemyBattleUnit[],
  reserveDoctrine = defaultReserveDoctrinePlan,
): BattleUnit => {
  const currentReadiness = unit.reserveReadiness ?? 0;
  if (unit.soldiers <= 0) {
    return { ...unit, reserveReadiness: 0 };
  }
  if (unit.order === "retreat") {
    return { ...unit, reserveReadiness: clamp(currentReadiness - 8, 0, 100) };
  }

  const closestThreat = nearestEnemy(unit.position, enemies.filter((enemy) => enemy.isSpotted));
  const closestThreatDistance = closestThreat ? distance(unit.position, closestThreat.position) : Number.POSITIVE_INFINITY;
  const hasCloseThreat = closestThreatDistance <= unit.range + 8;
  const canRestReady = !unit.currentTargetId && !unit.isMoving && unit.morale >= 45 && unit.condition >= 38 && unit.ammo >= 18;
  const reserveRole = isReservePosture(unit);
  const doctrineGain =
    reserveDoctrine.mode === "prepared_counterstroke"
      ? 0.95
      : reserveDoctrine.mode === "fire_support_pool" && unit.type === "artillery"
        ? 1.1
        : reserveDoctrine.mode === "elastic_reserve"
          ? 0.35
          : 0;
  const baseGain = reserveRole ? 2.2 + doctrineGain : 0.55 + doctrineGain * 0.35;
  const postureGain =
    unit.standingOrder.posture === "fire_support"
      ? 0.9
      : unit.standingOrder.posture === "fallback_guard"
        ? 0.7
        : unit.standingOrder.posture === "elastic_defense"
          ? 0.3
          : 0;
  const spending =
    unit.currentTargetId || unit.fireMissionId || unit.volleyUntilSeconds
      ? 4.4
      : hasCloseThreat
        ? reserveDoctrine.mode === "elastic_reserve" ? 1.35 : 1.8
        : unit.isMoving
          ? 1.2
          : 0;
  const readiness = canRestReady ? currentReadiness + baseGain + postureGain - spending : currentReadiness - spending - 0.8;
  return { ...unit, reserveReadiness: clamp(readiness, 0, 100) };
};

const activeFireMissionsForSecond = (
  missions: BattleFireMission[] | undefined,
  enemies: EnemyBattleUnit[],
  elapsedSeconds: number,
): BattleFireMission[] =>
  (missions ?? []).filter(
    (mission) =>
      mission.expiresAt > elapsedSeconds &&
      enemies.some((enemy) => enemy.id === mission.targetId && enemy.count > 0 && enemy.isSpotted),
  );

const fireMissionScopeLabel = (scope: BattleFireMission["scope"]) =>
  scope === "selected_unit" ? "旅団斉射" : "戦線斉射";

const fireDisciplineForState = (state: BattleState) => fireDisciplineWithDefaults(state.fireDiscipline);

const plannedFireMultipliers = (state: BattleState, scope: BattleFireMission["scope"]) => {
  const fireDiscipline = fireDisciplineForState(state);
  const objectiveAmmoMultiplier = state.objectiveState.tacticalEffects?.fireMissionAmmoMultiplier ?? 1;
  return {
    fireMultiplier: (scope === "selected_unit" ? 1.48 : 1.26) + fireDiscipline.fireMultiplierBonus,
    ammoMultiplier: (scope === "selected_unit" ? 1.58 : 1.42) * fireDiscipline.ammoCostMultiplier * objectiveAmmoMultiplier,
    conditionCost: (scope === "selected_unit" ? 0.12 : 0.1) * fireDiscipline.conditionCostMultiplier,
  };
};

const resolveFirePlansForSecond = (
  plans: BattleFirePlan[] | undefined,
  activeMissions: BattleFireMission[],
  enemies: EnemyBattleUnit[],
  units: BattleUnit[],
  elapsedSeconds: number,
  state: BattleState,
): {
  firePlans: BattleFirePlan[];
  newMissions: BattleFireMission[];
  playerUnits: BattleUnit[];
  logEntries: string[];
} => {
  const liveMissionIds = new Set(activeMissions.map((mission) => mission.id));
  const fireDiscipline = fireDisciplineForState(state);
  const newMissions: BattleFireMission[] = [];
  const logEntries: string[] = [];
  let playerUnits = units;

  const firePlans = (plans ?? [])
    .map((plan) => {
      const stages = plan.stages.map((stage, index) => {
        if (stage.status === "active") {
          return stage.fireMissionId && liveMissionIds.has(stage.fireMissionId)
            ? stage
            : { ...stage, status: "completed" as const };
        }
        if (stage.status !== "pending" || stage.startAt > elapsedSeconds) {
          return stage;
        }

        const target = enemies.find((enemy) => enemy.id === stage.targetId && enemy.count > 0 && enemy.isSpotted);
        if (!target) {
          logEntries.push(`${plan.name} 第${index + 1}段は目標を失い中止。`);
          return { ...stage, status: "skipped" as const };
        }

        const unitIds = stage.unitIds.filter((unitId) => {
          const unit = playerUnits.find((candidate) => candidate.unitId === unitId);
          return unit && unit.soldiers > 0 && unit.order !== "retreat" && !unit.fireMissionId;
        });
        if (unitIds.length === 0) {
          logEntries.push(`${plan.name} 第${index + 1}段は参加旅団がなく中止。`);
          return { ...stage, status: "skipped" as const };
        }

        const missionId = `${plan.id}-${stage.id}-${elapsedSeconds}`;
        const expiresAt = elapsedSeconds + stage.durationSeconds;
        const mission: BattleFireMission = {
          id: missionId,
          targetId: target.id,
          targetName: stage.targetName,
          scope: stage.scope,
          unitIds,
          issuedAt: elapsedSeconds,
          expiresAt,
          ...plannedFireMultipliers(state, stage.scope),
          disciplineLabel: fireDiscipline.label,
          sourcePlanId: plan.id,
          sourcePlanStageId: stage.id,
        };
        newMissions.push(mission);
        liveMissionIds.add(mission.id);
        playerUnits = playerUnits.map((unit) =>
          unitIds.includes(unit.unitId)
            ? {
                ...unit,
                focusTargetId: target.id,
                fireMissionId: mission.id,
                volleyUntilSeconds: expiresAt,
                volleyCooldownUntilSeconds: Math.max(
                  unit.volleyCooldownUntilSeconds ?? 0,
                  expiresAt + Math.max(8, 12 - fireDiscipline.cooldownReductionSeconds),
                ),
              }
            : unit,
        );
        logEntries.push(
          `${plan.name} 第${index + 1}段: ${fireMissionScopeLabel(stage.scope)} ${unitIds.length}旅団が${stage.targetName}へ射撃開始（${fireDiscipline.label}）。`,
        );
        return { ...stage, status: "active" as const, fireMissionId: mission.id };
      });
      return { ...plan, stages };
    })
    .filter((plan) => plan.stages.some((stage) => stage.status === "pending" || stage.status === "active"));

  return { firePlans, newMissions, playerUnits, logEntries };
};

export const resolveTick = (state: BattleState): BattleState => {
  if (state.status !== "running" && state.status !== "ready") {
    return state;
  }

  const elapsedSeconds = state.elapsedSeconds + 1;
  const mapBounds = state.mapBounds ?? { width: 100, height: 100 };
  let activeFireMissions = activeFireMissionsForSecond(state.fireMissions, state.enemyUnits, state.elapsedSeconds);
  let enemyUnits: EnemyBattleUnit[] = state.enemyUnits.map((enemy) => ({ ...enemy, currentTargetId: undefined }));
  let playerUnits: BattleUnit[] = state.playerUnits.map((unit) => ({
    ...unit,
    fireMissionId: activeFireMissions.some((mission) => mission.id === unit.fireMissionId && mission.unitIds.includes(unit.unitId))
      ? unit.fireMissionId
      : undefined,
    focusTargetId:
      activeFireMissions.find((mission) => mission.unitIds.includes(unit.unitId))?.targetId ??
      (state.enemyUnits.some((enemy) => enemy.id === unit.focusTargetId && enemy.count > 0)
        ? unit.focusTargetId
        : undefined),
    reserveReadiness: clamp(unit.reserveReadiness ?? 0, 0, 100),
    currentTargetId: undefined,
    lastDamageDealt: 0,
    isMoving: false,
  }));
  let structures: BattleStructure[] = state.structures.map((structure) => ({ ...structure, currentTargetId: undefined }));
  let objectiveNodes: BattleObjectiveNode[] = state.objectiveNodes ?? [];
  let firePlans: BattleFirePlan[] = state.firePlans ?? [];
  let wavesSpawned = state.wavesSpawned;
  let log = [...state.log];
  const engagements: BattleEngagement[] = [];
  let enemyLossThisTick = 0;

  if (shouldSpawnWave({ ...state, elapsedSeconds })) {
    const wave = createEnemyWave({ ...state, elapsedSeconds, wavesSpawned });
    enemyUnits = [...enemyUnits, ...wave];
    wavesSpawned += 1;
    const surpriseNote =
      state.scenario.waveIntel.surpriseSummary && wavesSpawned <= 2
        ? ` 誤情報のため実波が予測より早く/強く出現。`
        : "";
    log = [`第${wavesSpawned}波が${state.scenario.sectorName}へ侵入。${surpriseNote}`, ...log];
  }

  const fortEffects = summarizeFortificationEffects(structures, state.strategicDoctrine);
  const enemySlowFactor = clamp(1 - fortEffects.enemySlow / 160, 0.58, 1);
  const chokePoints = state.chokePoints ?? [];
  playerUnits = updateFormationStates(playerUnits);
  enemyUnits = updateEnemyCommandInfluence(enemyUnits);
  const firstMoralePass = updateEnemyMoraleStates(enemyUnits, state.mapBounds);
  enemyUnits = firstMoralePass.enemies;
  if (firstMoralePass.logEntries.length > 0) {
    log = [...firstMoralePass.logEntries, ...log];
  }

  enemyUnits = enemyUnits.map((enemy, index) => {
    const enemyTerrain = localTerrainEffect(enemy.position, state.terrainZones);
    const enemyTerrainMovement = clamp(enemyTerrain.movement + 0.14, 0.54, 1);
    if (enemy.assaultPlan.moraleState === "routing" || enemy.assaultPlan.moraleState === "regrouping") {
      const destination = moraleDestinationForEnemy(enemy, mapBounds);
      const moved = moveToward(
        enemy.position,
        destination,
        enemy.speed *
          enemyTerrainMovement *
          clamp(0.72 + enemy.assaultPlan.cohesion * 0.18, 0.58, 0.98) *
          (enemy.assaultPlan.moraleState === "routing" ? 1.2 : 0.72),
        mapBounds,
      );
      return {
        ...enemy,
        ...moved,
        currentTargetId: undefined,
        assaultPlan: {
          ...enemy.assaultPlan,
          vector: normalizeVector(enemy.position, destination),
        },
      };
    }
    const target = nearestPlayerForEnemy(enemy, playerUnits);
    const contactRange = enemy.range + Math.min(8, enemy.assaultPlan.frontageWidth * 0.18);
    if (target && enemyDistanceToPlayerFormation(enemy, target) <= contactRange) {
      return { ...enemy, currentTargetId: target.unitId, isMoving: false };
    }

    const assaultDestination = enemyAssaultDestination(enemy, index, target, mapBounds);
    const destination = destinationThroughChokePoints(enemy, assaultDestination, chokePoints);
    const nearObstacle = structures.some(
      (structure) =>
        (structure.status === "built" || structure.status === "damaged") &&
        distance(enemy.position, structure.position) <= structure.blockedRadius + 5,
    );
    const moved = moveToward(
      enemy.position,
      destination,
      enemy.speed *
        enemySlowFactor *
        enemyTerrainMovement *
        clamp(0.82 + enemy.assaultPlan.cohesion * 0.24, 0.72, 1.08) *
        enemyCommandFactor(enemy) *
        enemyCommandIntentMovementFactor(enemy) *
        enemyMoraleFactor(enemy) *
        chokePointMultiplierForEnemy(enemy, enemyUnits, structures, chokePoints) *
        (nearObstacle ? 0.55 : 1),
      mapBounds,
    );
    return {
      ...enemy,
      ...moved,
      currentTargetId: target?.unitId,
      assaultPlan: {
        ...enemy.assaultPlan,
        vector: normalizeVector(enemy.position, destination),
      },
    };
  });

  const firstAssaultPhasePass = evaluateEnemyAssaultPhases(enemyUnits, state.frontlineSegments, structures);
  enemyUnits = firstAssaultPhasePass.enemies;
  if (firstAssaultPhasePass.logEntries.length > 0) {
    log = [...firstAssaultPhasePass.logEntries, ...log];
  }

  const initialObjectiveEffects =
    state.objectiveState.tacticalEffects ??
    objectiveTacticalEffects(
      state.objectiveState.victoryControl,
      state.objectiveState.supplyControl,
      state.objectiveState.visibilityControl,
      objectiveNodes,
    );
  enemyUnits = updateEnemyVisibility(
    enemyUnits,
    playerUnits,
    structures,
    state.terrainZones,
    state.strategicDoctrine,
    initialObjectiveEffects.visibilitySpottingBonus,
  );
  activeFireMissions = activeFireMissionsForSecond(activeFireMissions, enemyUnits, elapsedSeconds);
  const plannedFire = resolveFirePlansForSecond(
    firePlans,
    activeFireMissions,
    enemyUnits,
    playerUnits,
    elapsedSeconds,
    state,
  );
  firePlans = plannedFire.firePlans;
  playerUnits = plannedFire.playerUnits;
  if (plannedFire.newMissions.length > 0) {
    activeFireMissions = [...activeFireMissions, ...plannedFire.newMissions].slice(-10);
  }
  if (plannedFire.logEntries.length > 0) {
    log = [...plannedFire.logEntries, ...log];
  }

  playerUnits = playerUnits.map((unit, index) =>
    movePlayerUnit(
      unit,
      index,
      enemyUnits.filter((enemy) => enemy.isSpotted),
      structures,
      mapBounds,
      state.terrainZones,
    ),
  );
  playerUnits = updateFormationStates(playerUnits);

  for (let index = 0; index < playerUnits.length; index += 1) {
    const unit = playerUnits[index];
    const terrain = localTerrainEffect(unit.position, state.terrainZones);
    const effectiveRange = unit.range * terrain.rangeMultiplier;
    const target = targetByPriority(
      unit,
      enemyUnits.filter((enemy) => enemy.isSpotted),
      effectiveRange,
      state.terrainZones,
    );
    const activeFireMission = activeFireMissions.find(
      (mission) => mission.unitIds.includes(unit.unitId) && mission.targetId === target?.id,
    );
    const supplyRecovery = supplyRecoveryForUnit(unit, structures, fortEffects.ammoRecovery, objectiveNodes, initialObjectiveEffects);
    if (!target || unit.soldiers <= 0 || unit.ammo <= 0) {
      playerUnits[index] = {
        ...unit,
        fireMissionId: activeFireMission?.id,
        ammo: clamp(unit.ammo + supplyRecovery, 0, 100),
        condition: clamp(unit.condition + (unit.order === "rest" ? 0.8 : -0.16 * terrain.fatigue), 0, 100),
        actionReason: supplyRecovery > 0.2 && unit.actionReason === "resupplying" ? "resupplying" : unit.actionReason,
      };
      continue;
    }

    const damage = playerFireDamage(unit, target, state.terrainZones) * (activeFireMission?.fireMultiplier ?? 1);
    const damageResult = applyEnemyDamage(enemyUnits, target.id, damage, activeFireMission ? 1.35 : 1);
    enemyUnits = damageResult.enemies;
    enemyLossThisTick += damageResult.actualDamage;
    const ammoSpent =
      (unit.type === "artillery" ? 0.48 : unit.type === "engineer" ? 0.11 : 0.22) *
      ammoPolicySpendMultiplier[unit.standingOrder.ammoPolicy] *
      (activeFireMission?.ammoMultiplier ?? 1);

    playerUnits[index] = {
      ...unit,
      fireMissionId: activeFireMission?.id,
      currentTargetId: target.id,
      actionReason: firingReasonForUnit(unit),
      lastDamageDealt: damageResult.actualDamage,
      ammo: clamp(unit.ammo - ammoSpent * unit.fireRate + supplyRecovery, 0, 100),
      condition: clamp(
        unit.condition - (unit.isMoving ? 0.34 : 0.12) * terrain.fatigue - (activeFireMission?.conditionCost ?? 0),
        0,
        100,
      ),
      xpGained: unit.xpGained + damageResult.actualDamage * 0.08,
    };

    engagements.push({
      id: `p-${elapsedSeconds}-${unit.unitId}-${target.id}`,
      fromId: unit.unitId,
      toId: target.id,
      from: unit.position,
      to: target.position,
      kind: engagementKindForUnit(unit),
      intensity: clamp(damageResult.actualDamage / 4, 0.2, 1),
    });
  }

  for (let index = 0; index < structures.length; index += 1) {
    const structure = structures[index];
    if (structure.status !== "built" && structure.status !== "damaged") {
      continue;
    }
    const target = nearestEnemy(
      structure.position,
      enemyUnits.filter((enemy) => enemy.isSpotted),
      structure.range,
      state.terrainZones,
    );
    if (!target || structure.durability <= 0) {
      continue;
    }
    const durabilityFactor = clamp(structure.durability / structure.maxDurability, 0.2, 1);
    const damageResult = applyEnemyDamage(enemyUnits, target.id, structure.firepower * durabilityFactor, 0.82);
    enemyUnits = damageResult.enemies;
    enemyLossThisTick += damageResult.actualDamage;
    structures[index] = { ...structure, currentTargetId: target.id };
    engagements.push({
      id: `s-${elapsedSeconds}-${structure.id}-${target.id}`,
      fromId: structure.id,
      toId: target.id,
      from: structure.position,
      to: target.position,
      kind: "structure",
      intensity: clamp(damageResult.actualDamage / 3, 0.18, 0.8),
    });
  }

  enemyUnits = updateEnemyCommandInfluence(enemyUnits);
  const secondMoralePass = updateEnemyMoraleStates(enemyUnits, state.mapBounds);
  enemyUnits = suppressRoutedEnemyTargets(secondMoralePass.enemies);
  if (secondMoralePass.logEntries.length > 0) {
    log = [...secondMoralePass.logEntries, ...log];
  }
  const secondAssaultPhasePass = evaluateEnemyAssaultPhases(enemyUnits, state.frontlineSegments, structures);
  enemyUnits = secondAssaultPhasePass.enemies;
  if (secondAssaultPhasePass.logEntries.length > 0) {
    log = [...secondAssaultPhasePass.logEntries, ...log];
  }

  for (let index = 0; index < enemyUnits.length; index += 1) {
    const enemy = enemyUnits[index];
    if (enemy.assaultPlan.moraleState === "routing" || enemy.assaultPlan.moraleState === "regrouping") {
      continue;
    }
    const target = nearestPlayerForEnemy(enemy, playerUnits, enemy.range + Math.min(8, enemy.assaultPlan.frontageWidth * 0.18));
    if (!target || enemy.count <= 0) {
      continue;
    }

    const unitIndex = playerUnits.findIndex((unit) => unit.unitId === target.unitId);
    if (unitIndex < 0) {
      continue;
    }

    const unit = playerUnits[unitIndex];
    const terrain = localTerrainEffect(unit.position, state.terrainZones);
    const coverReduction = clamp((fortEffects.cover * 0.25 + localCoverForUnit(unit, structures) + terrain.cover) / 100, 0, 0.78);
    const meleeMultiplier = enemy.range <= 5 ? 1.35 : 0.82;
    const rawCasualties =
      enemy.count *
      enemy.pressure *
      0.0075 *
      meleeMultiplier *
      orderExposureMultiplier[unit.order] *
      postureExposureMultiplier[unit.standingOrder.posture] *
      formationExposureMultiplier(unit) *
      enemyCommandFactor(enemy) *
      enemyMoraleFactor(enemy) *
      (1 - coverReduction);
    const casualties = Math.min(unit.soldiers, Math.max(0, rawCasualties));

    playerUnits[unitIndex] = {
      ...unit,
      soldiers: unit.soldiers - casualties,
      casualtiesThisBattle: unit.casualtiesThisBattle + casualties,
      morale: clamp(
        unit.morale - casualties / Math.max(32, unit.maxSoldiers / 16) - enemy.moraleShock * 0.025 + fortEffects.morale / 50,
        0,
        100,
      ),
      condition: clamp(unit.condition - casualties / Math.max(55, unit.maxSoldiers / 24) - 0.1 * terrain.fatigue, 0, 100),
    };
    enemyUnits[index] = { ...enemy, currentTargetId: unit.unitId, isSpotted: true, isMoving: false };
    engagements.push({
      id: `e-${elapsedSeconds}-${enemy.id}-${unit.unitId}`,
      fromId: enemy.id,
      toId: unit.unitId,
      from: enemy.position,
      to: unit.position,
      kind: enemy.range <= 5 ? "melee" : "rifle",
      intensity: clamp(casualties / 5, 0.16, 1),
    });
  }

  structures = structures.map((structure) => {
    const assignedUnitIds = playerUnits
      .filter((unit) => unit.standingOrder.facilityAssignment?.structureId === structure.id && unit.soldiers > 0)
      .map((unit) => unit.unitId);
    if (structure.status !== "built" && structure.status !== "damaged") {
      return {
        ...structure,
        tacticalPressure: 0,
        repairRate: 0,
        assignedUnitIds,
        facilityState: structure.status === "overrun" ? "overrun" : "secure",
        facilityStateLabel: structure.status === "overrun" ? "制圧" : "非稼働",
      };
    }
    const closeThreat = enemyUnits.reduce((sum, enemy) => {
      const threatRange = structure.blockedRadius + enemy.range + enemy.assaultPlan.frontageWidth * 0.14;
      if (distance(enemy.position, structure.position) > threatRange) {
        return sum;
      }
      return sum + enemy.count * enemy.pressure * 0.006 * enemyPressureFactor(enemy);
    }, 0);
    const nearbyEngineers = playerUnits.filter((unit) => {
      if (unit.type !== "engineer" || distance(unit.position, structure.position) > 12) {
        return false;
      }
      const assignment = unit.standingOrder.facilityAssignment;
      return (
        unit.order === "build" ||
        unit.standingOrder.posture === "engineer_support" ||
        (assignment?.structureId === structure.id && assignment.mode === "repair")
      );
    });
    const repair = nearbyEngineers.reduce((sum, unit) => sum + clamp(unit.soldiers / 950, 0.15, 1.8), 0);
    const durability = clamp(structure.durability - closeThreat + repair, 0, structure.maxDurability);
    const status: BattleStructure["status"] =
      durability <= 0 ? "overrun" : durability < structure.maxDurability * 0.5 ? "damaged" : "built";
    const facilityState: BattleStructure["facilityState"] =
      status === "overrun"
        ? "overrun"
        : closeThreat > repair + 5
          ? "contested"
          : repair > 0.1 && status === "damaged"
            ? "being_repaired"
            : closeThreat > 0.1
              ? "under_pressure"
              : "secure";
    const facilityStateLabel =
      facilityState === "overrun"
        ? "制圧"
        : facilityState === "contested"
          ? "危険"
          : facilityState === "being_repaired"
            ? "修理中"
            : facilityState === "under_pressure"
              ? "接敵"
              : "安定";
    const history =
      Math.round(closeThreat) > 0
        ? [`損傷 ${Math.round(closeThreat)}`, ...structure.history].slice(0, 6)
        : repair > 0.1
          ? [`工兵修理 ${repair.toFixed(1)}`, ...structure.history].slice(0, 6)
          : structure.history;
    return {
      ...structure,
      durability,
      status,
      history,
      tacticalPressure: closeThreat,
      repairRate: repair,
      assignedUnitIds,
      facilityState,
      facilityStateLabel,
    };
  });

  playerUnits = updateFormationStates(playerUnits);
  activeFireMissions = activeFireMissionsForSecond(activeFireMissions, enemyUnits, elapsedSeconds);

  playerUnits = playerUnits.map((unit) =>
    unit.focusTargetId && !enemyUnits.some((enemy) => enemy.id === unit.focusTargetId && enemy.count > 0)
      ? { ...unit, focusTargetId: undefined, fireMissionId: undefined, volleyUntilSeconds: undefined }
      : {
          ...unit,
          fireMissionId: activeFireMissions.some(
            (mission) => mission.id === unit.fireMissionId && mission.unitIds.includes(unit.unitId),
          )
            ? unit.fireMissionId
            : undefined,
          volleyUntilSeconds:
            (unit.volleyUntilSeconds ?? 0) > elapsedSeconds ? unit.volleyUntilSeconds : undefined,
        },
  );
  playerUnits = playerUnits.map((unit) => updateReserveReadinessForUnit(unit, enemyUnits, state.reserveDoctrine));
  const arrivedOrderLogs = playerUnits
    .filter((unit) => unit.pendingOrder && unit.pendingOrder.arrivesAt <= elapsedSeconds)
    .map((unit) => `${unit.name}へ${unit.pendingOrder?.label}が到達。`)
    .slice(0, 3);
  playerUnits = playerUnits.map((unit) =>
    unit.pendingOrder && unit.pendingOrder.arrivesAt <= elapsedSeconds
      ? {
          ...unit,
          commandTransmissionEvents: unit.commandTransmissionEvents?.map((event) =>
            event.id === unit.pendingOrder?.id
              ? {
                  ...event,
                  reasons: unit.pendingOrder?.reasons ?? event.reasons,
                  arrivesAt: unit.pendingOrder?.arrivesAt ?? event.arrivesAt,
                  delaySeconds: unit.pendingOrder?.delaySeconds ?? event.delaySeconds,
                  congestionDelaySeconds: unit.pendingOrder?.congestionDelaySeconds ?? event.congestionDelaySeconds,
                  arrivedAt: elapsedSeconds,
                }
              : event,
          ),
          pendingOrder: undefined,
        }
      : unit,
  );
  if (arrivedOrderLogs.length > 0) {
    log = [...arrivedOrderLogs, ...log];
  }

  const totalCasualties = playerUnits.reduce((sum, unit) => sum + unit.casualtiesThisBattle, 0);
  const penetrationPressure = enemyUnits.reduce(
    (sum, enemy) =>
      sum +
      Math.max(0, 39 - enemy.position.x) *
        enemy.count *
        enemy.pressure *
        0.016 *
        enemyPressureFactor(enemy),
    0,
  );
  const activeEnemyPressure = enemyUnits.reduce(
    (sum, enemy) =>
      sum +
      enemy.count *
        enemy.pressure *
        0.008 *
        enemyPressureFactor(enemy) *
        enemyAssaultPhasePressureFactor(enemy.assaultPlan.phase),
    0,
  );
  const breakthroughPressure = enemyUnits.reduce((sum, enemy) => {
    const flank = enemy.assaultPlan.flankPressure * 0.012;
    const penetration =
      enemy.assaultPlan.penetrationDepth *
      enemy.count *
      enemy.pressure *
      (enemy.assaultPlan.phase === "breakthrough" ? 0.032 : enemy.assaultPlan.phase === "overextended" ? 0.014 : 0.018) *
      enemyPressureFactor(enemy);
    return sum + flank + penetration;
  }, 0);
  const objectivePass = updateObjectiveNodes(objectiveNodes, playerUnits, enemyUnits);
  objectiveNodes = objectivePass.nodes;
  if (objectivePass.logEntries.length > 0) {
    log = [...objectivePass.logEntries, ...log];
  }
  const victoryControl = objectiveNodes.find((node) => node.type === "victory")?.controlProgress ?? 50;
  const supplyControl = objectiveNodes.find((node) => node.type === "supply")?.controlProgress ?? 50;
  const visibilityControl = objectiveNodes.find((node) => node.type === "visibility")?.controlProgress ?? 50;
  const victoryPressureMultiplier = objectiveNodes.find((node) => node.type === "victory")?.scenario.pressureMultiplier ?? 1;
  const supplyPressureMultiplier = objectiveNodes.find((node) => node.type === "supply")?.scenario.pressureMultiplier ?? 1;
  const visibilityPressureMultiplier = objectiveNodes.find((node) => node.type === "visibility")?.scenario.pressureMultiplier ?? 1;
  const tacticalEffects = objectiveTacticalEffects(victoryControl, supplyControl, visibilityControl, objectiveNodes);
  const objectivePressure = clamp(
    (50 - victoryControl) * 0.22 * victoryPressureMultiplier +
      (45 - supplyControl) * 0.08 * supplyPressureMultiplier +
      (48 - visibilityControl) * 0.06 * visibilityPressureMultiplier,
    -9,
    18,
  );
  const lineIntegrity = clamp(
    100 -
      totalCasualties / 28 -
      penetrationPressure -
      activeEnemyPressure -
      breakthroughPressure -
      objectivePressure +
      tacticalEffects.victoryLineIntegrityModifier,
    0,
    100,
  );
  const objectiveSuppressionBonus =
    (visibilityControl > 62 ? (visibilityControl - 62) / 220 : 0) + tacticalEffects.visibilitySuppressionBonus;
  const enemySuppression = clamp(
    state.objectiveState.enemySuppression + enemyLossThisTick / 5.5 + objectiveSuppressionBonus,
    0,
    100,
  );
  const morale = averageMorale(playerUnits);
  const activeSoldiers = playerUnits.reduce((sum, unit) => sum + Math.max(0, unit.soldiers), 0);
  const status =
    elapsedSeconds >= state.scenario.durationSeconds
      ? "held"
      : activeSoldiers <= 0 || morale < 20 || lineIntegrity < 10
        ? "collapsed"
        : "running";

  if (elapsedSeconds % 10 === 0 && engagements.length > 0) {
    const firingUnits = playerUnits.filter((unit) => unit.currentTargetId).length;
    log = [`${firingUnits}旅団が射程内目標へ交戦中。敵損耗 ${enemyLossThisTick.toFixed(1)}。`, ...log];
  }

  return {
    ...state,
    elapsedSeconds,
    status,
    enemyUnits,
    playerUnits,
    structures,
    objectiveNodes,
    chokePoints: updateChokePointPressures(chokePoints, enemyUnits, structures),
    engagements,
    fireMissions: activeFireMissions,
    firePlans,
    wavesSpawned,
    log: log.slice(0, 12),
    objectiveState: {
      ...state.objectiveState,
      lineIntegrity,
      enemySuppression,
      victoryControl,
      supplyControl,
      visibilityControl,
      objectivePressure,
      tacticalEffects,
    },
  };
};
