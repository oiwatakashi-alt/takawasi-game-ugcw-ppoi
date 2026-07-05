import { enemyTypeDefinitions } from "../../content/baseGame/enemies";
import type {
  BattlePosition,
  BattleStructure,
  EnemyAssaultMode,
  EnemyCommandIntent,
  EnemyCommandTier,
  FrontlineSegment,
} from "./types";
import type { BattleState, EnemyBattleUnit } from "./types";

export const shouldSpawnWave = (state: BattleState): boolean => {
  const waveIntel = state.scenario.waveIntel ?? {
    firstWaveSecond: 1,
    spawnIntervalSeconds: 18,
  };
  const firstWaveSecond = waveIntel.actualFirstWaveSecond ?? waveIntel.firstWaveSecond;
  const spawnIntervalSeconds = waveIntel.actualSpawnIntervalSeconds ?? waveIntel.spawnIntervalSeconds;
  if (state.elapsedSeconds === firstWaveSecond) {
    return true;
  }
  if (state.elapsedSeconds < firstWaveSecond) {
    return false;
  }
  return (state.elapsedSeconds - firstWaveSecond) % spawnIntervalSeconds === 0;
};

const enemyStats: Record<
  EnemyBattleUnit["type"],
  Pick<EnemyBattleUnit, "speed" | "range"> & { laneOffset: number; cohesion: number; morale: number; mode: EnemyAssaultMode }
> = {
  undeadMob: { speed: 2.2, range: 4, laneOffset: 0, cohesion: 0.68, morale: 0.66, mode: "mass_push" },
  undeadRiflemen: { speed: 1.15, range: 28, laneOffset: -8, cohesion: 0.82, morale: 0.74, mode: "rifle_screen" },
  brute: { speed: 1.55, range: 5, laneOffset: 9, cohesion: 0.9, morale: 0.9, mode: "breacher" },
  undeadOfficer: { speed: 1.0, range: 20, laneOffset: -14, cohesion: 0.86, morale: 0.88, mode: "command_drive" },
};

const assaultModeLabel: Record<EnemyAssaultMode, string> = {
  mass_push: "集団圧迫",
  rifle_screen: "銃兵支援",
  breacher: "突破体",
  command_drive: "指揮突進",
};

const commandIntentForEnemy = (
  type: EnemyBattleUnit["type"],
  wave: number,
  targetStructure: BattleStructure | undefined,
): EnemyCommandIntent => {
  if (type === "undeadRiflemen") {
    return "fire_support";
  }
  if (type === "brute" || targetStructure) {
    return "breach_works";
  }
  if (type === "undeadOfficer") {
    return wave % 2 === 0 ? "breach_works" : "rally_wave";
  }
  return wave % 3 === 0 ? "flank_line" : "press_line";
};

const commandTierForEnemy = (type: EnemyBattleUnit["type"], targetStructure: BattleStructure | undefined): EnemyCommandTier => {
  if (type === "undeadOfficer") {
    return "wave_command";
  }
  if (type === "brute" || targetStructure) {
    return "assault_lead";
  }
  if (type === "undeadRiflemen") {
    return "support_node";
  }
  return "line_group";
};

const commandTierLabel: Record<EnemyCommandTier, string> = {
  none: "指揮外",
  wave_command: "波指揮核",
  assault_lead: "突撃先導",
  support_node: "支援節",
  line_group: "前衛群",
};

const structureTypeLabel: Record<BattleStructure["type"], string> = {
  trench: "塹壕線",
  barricade: "バリケード",
  supplyDepot: "補給所",
  observationPost: "観測所",
  fieldHospital: "野戦病院",
};

const structureAssaultIntentLabel: Record<BattleStructure["type"], string> = {
  trench: "塹壕破砕",
  barricade: "障害排除",
  supplyDepot: "補給遮断",
  observationPost: "観測潰し",
  fieldHospital: "救護線破壊",
};

const waveEntryPosition = (
  state: BattleState,
  wave: number,
  laneOffset: number,
  targetY?: number,
): BattlePosition => {
  if (state.scenario.tacticalTerrainProfileId === "high_ground_los_drill") {
    return {
      x: 58 + (wave % 2) * 4,
      y: Math.max(12, Math.min(88, (targetY ?? 18 + ((wave * 17) % 58)) + laneOffset)),
    };
  }
  if (state.scenario.tacticalTerrainProfileId === "reverse_slope_los_drill") {
    return {
      x: 58 + (wave % 2) * 2,
      y: Math.max(18, Math.min(38, 25 + laneOffset * 0.25)),
    };
  }
  return {
    x: Math.max(94, state.mapBounds.width - 8),
    y: Math.max(12, Math.min(88, (targetY ?? 18 + ((wave * 17) % 58)) + laneOffset)),
  };
};

const fallbackDestination = (wave: number, laneOffset: number): BattlePosition => ({
  x: 31,
  y: Math.max(16, Math.min(84, 24 + ((wave * 19) % 52) + laneOffset * 0.5)),
});

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

const frontlineTargetForWave = (
  state: BattleState,
  wave: number,
  type: EnemyBattleUnit["type"],
): FrontlineSegment | undefined => {
  const primarySegments =
    state.frontlineSegments.filter((segment) =>
      ["left-flank", "center-line", "right-flank"].includes(segment.id),
    ) ?? [];
  if (primarySegments.length === 0) {
    return state.frontlineSegments[0];
  }
  if (type === "brute" || type === "undeadOfficer") {
    return primarySegments.find((segment) => segment.id === "center-line") ?? primarySegments[0];
  }
  const typeOffset = type === "undeadRiflemen" ? 1 : 0;
  return primarySegments[(wave + typeOffset) % primarySegments.length];
};

const structureTargetForWave = (
  state: BattleState,
  segment: FrontlineSegment | undefined,
  type: EnemyBattleUnit["type"],
) => {
  if (!segment || type === "undeadRiflemen") {
    return undefined;
  }
  return state.structures
    .filter((structure) => structure.status === "built" || structure.status === "damaged")
    .map((structure) => {
      const structureDistance = distance(structure.position, segment.anchor);
      const typePriority =
        structure.type === "supplyDepot"
          ? 34
          : structure.type === "observationPost"
            ? 30
            : structure.type === "fieldHospital"
              ? 28
              : structure.type === "trench"
                ? 26
                : 20;
      const statusPriority = structure.status === "damaged" ? 18 : 0;
      const pressurePriority =
        structure.facilityState === "contested"
          ? 24
          : structure.facilityState === "under_pressure"
            ? 12
            : structure.facilityState === "being_repaired"
              ? 10
              : 0;
      const assignedPriority = Math.min(18, (structure.assignedUnitIds?.length ?? 0) * 4);
      const distancePenalty = type === "brute" ? structureDistance * 0.18 : structureDistance * 0.72;
      const segmentReach = structureDistance <= segment.controlRadius + 18 || type === "brute" || type === "undeadOfficer";
      const waveBias = type === "undeadMob" ? 4 : type === "brute" ? 18 : type === "undeadOfficer" ? 12 : 0;
      return {
        structure,
        score: segmentReach ? typePriority + statusPriority + pressurePriority + assignedPriority + waveBias - distancePenalty : -999,
      };
    })
    .filter((entry) => entry.score > 12)
    .sort((a, b) => b.score - a.score)[0]?.structure;
};

const assaultShape = (
  type: EnemyBattleUnit["type"],
  count: number,
  wave: number,
): Pick<EnemyBattleUnit["assaultPlan"], "frontageWidth" | "depth" | "laneSpread"> => {
  const countFactor = Math.sqrt(Math.max(1, count));
  if (type === "undeadMob") {
    return {
      frontageWidth: Math.min(34, 14 + countFactor * 1.8),
      depth: Math.min(24, 8 + countFactor * 1.1),
      laneSpread: 8 + (wave % 4) * 2,
    };
  }
  if (type === "undeadRiflemen") {
    return {
      frontageWidth: Math.min(28, 12 + countFactor * 1.45),
      depth: 7,
      laneSpread: 6,
    };
  }
  if (type === "brute") {
    return {
      frontageWidth: Math.min(18, 8 + countFactor * 1.2),
      depth: 10,
      laneSpread: 4,
    };
  }
  return {
    frontageWidth: 10,
    depth: 6,
    laneSpread: 5,
  };
};

const createEnemy = (
  state: BattleState,
  wave: number,
  type: EnemyBattleUnit["type"],
  count: number,
  idSuffix: string,
): EnemyBattleUnit => {
  const definition = enemyTypeDefinitions[type];
  const stats = enemyStats[type];
  const targetSegment = frontlineTargetForWave(state, wave, type);
  const targetStructure = structureTargetForWave(state, targetSegment, type);
  const commandGroupId = `wave-${wave}-${targetStructure?.id ?? targetSegment?.id ?? "front"}`;
  const commandIntent = commandIntentForEnemy(type, wave, targetStructure);
  const commandTier = commandTierForEnemy(type, targetStructure);
  const targetPosition = targetStructure?.position ?? targetSegment?.anchor ?? fallbackDestination(wave, stats.laneOffset);
  const destination = {
    x: Math.max(20, targetPosition.x + (type === "undeadRiflemen" ? 18 : type === "undeadOfficer" ? 12 : 0)),
    y: Math.max(12, Math.min(88, targetPosition.y + stats.laneOffset * 0.28)),
  };
  const position = waveEntryPosition(state, wave, stats.laneOffset, destination.y);
  const shape = assaultShape(type, count, wave);
  return {
    id: `wave-${wave}-${idSuffix}`,
    type,
    name: definition.name,
    count,
    pressure: definition.pressure,
    moraleShock: definition.moraleShock,
    position,
    destination,
    assaultPlan: {
      mode: stats.mode,
      targetSegmentId: targetSegment?.id,
      targetStructureId: targetStructure?.id,
      targetName: targetStructure
        ? `${structureAssaultIntentLabel[targetStructure.type]}:${structureTypeLabel[targetStructure.type]}`
        : `${assaultModeLabel[stats.mode]}:${targetSegment?.name ?? "前線"}`,
      phase: "approach",
      penetrationDepth: 0,
      flankPressure: 0,
      commandState: type === "undeadOfficer" ? "commanded" : "none",
      commandInfluence: type === "undeadOfficer" ? 1 : 0,
      commandSourceId: type === "undeadOfficer" ? `wave-${wave}-${idSuffix}` : undefined,
      commandRole: type === "undeadOfficer" ? "command_node" : "assault_group",
      commandTier,
      commandParentId: type === "undeadOfficer" ? undefined : commandGroupId,
      commandIntent,
      commandGroupId,
      commandLabel:
        type === "undeadOfficer"
          ? `第${wave}波指揮核`
          : targetStructure
            ? `第${wave}波${structureTypeLabel[targetStructure.type]}${commandTierLabel[commandTier]}`
            : `第${wave}波${targetSegment?.name ?? "前線"}${commandTierLabel[commandTier]}`,
      morale: stats.morale,
      moraleState: "steady",
      frontageWidth: shape.frontageWidth,
      depth: shape.depth,
      laneSpread: shape.laneSpread,
      cohesion: stats.cohesion,
      vector: normalizeVector(position, destination),
    },
    speed: stats.speed,
    range: stats.range,
    isSpotted: false,
    concealment: 0,
    isMoving: true,
  };
};

const linkEnemyCommandHierarchy = (enemies: EnemyBattleUnit[]): EnemyBattleUnit[] => {
  const groups = new Map<string, EnemyBattleUnit[]>();
  for (const enemy of enemies) {
    const groupId = enemy.assaultPlan.commandGroupId ?? enemy.id;
    groups.set(groupId, [...(groups.get(groupId) ?? []), enemy]);
  }

  return enemies.map((enemy) => {
    const groupId = enemy.assaultPlan.commandGroupId ?? enemy.id;
    const group = groups.get(groupId) ?? [];
    const commandNode = group.find((unit) => unit.assaultPlan.commandTier === "wave_command");
    const assaultLead = group.find((unit) => unit.assaultPlan.commandTier === "assault_lead");
    const supportNode = group.find((unit) => unit.assaultPlan.commandTier === "support_node");

    if (enemy.assaultPlan.commandTier === "wave_command") {
      return enemy;
    }

    const parentId =
      enemy.assaultPlan.commandTier === "line_group"
        ? assaultLead?.id ?? supportNode?.id ?? commandNode?.id ?? enemy.assaultPlan.commandParentId
        : commandNode?.id ?? enemy.assaultPlan.commandParentId;

    return {
      ...enemy,
      assaultPlan: {
        ...enemy.assaultPlan,
        commandParentId: parentId,
      },
    };
  });
};

export const createEnemyWave = (state: BattleState): EnemyBattleUnit[] => {
  const wave = state.wavesSpawned + 1;
  const waveIntel = state.scenario.waveIntel ?? {
    commandWaveStart: 3,
    commandWaveChance: 34,
    actualCommandWaveStart: 3,
    actualCommandWaveChance: 34,
    mobPressureMultiplier: 1,
    riflemenPressureMultiplier: 1,
    brutePressureMultiplier: 1,
    officerPressureMultiplier: 1,
    actualMobPressureMultiplier: 1,
    actualRiflemenPressureMultiplier: 1,
    actualBrutePressureMultiplier: 1,
    actualOfficerPressureMultiplier: 1,
  };
  const commandWaveStart = waveIntel.actualCommandWaveStart ?? waveIntel.commandWaveStart;
  const commandWaveChance = waveIntel.actualCommandWaveChance ?? waveIntel.commandWaveChance;
  const mobPressureMultiplier = waveIntel.actualMobPressureMultiplier ?? waveIntel.mobPressureMultiplier;
  const riflemenPressureMultiplier = waveIntel.actualRiflemenPressureMultiplier ?? waveIntel.riflemenPressureMultiplier;
  const brutePressureMultiplier = waveIntel.actualBrutePressureMultiplier ?? waveIntel.brutePressureMultiplier;
  const officerPressureMultiplier = waveIntel.actualOfficerPressureMultiplier ?? waveIntel.officerPressureMultiplier;
  const pressureBase = Math.round(state.scenario.waveBudget / 8 + wave * 6);
  const commandRoll = (wave * 31 + Math.round(state.scenario.waveBudget) + Math.round(officerPressureMultiplier * 17)) % 100;
  const shouldSpawnCommandWave = wave >= commandWaveStart && commandRoll < commandWaveChance;
  const enemies: EnemyBattleUnit[] = [
    createEnemy(state, wave, "undeadMob", Math.round((pressureBase + 22) * mobPressureMultiplier), "mob"),
  ];

  if (wave >= 2 || riflemenPressureMultiplier >= 1.15) {
    enemies.push(
      createEnemy(state, wave, "undeadRiflemen", Math.max(4, Math.round(pressureBase * 0.5 * riflemenPressureMultiplier)), "riflemen"),
    );
  }

  if (wave >= 4 || (wave >= 3 && brutePressureMultiplier >= 1.12)) {
    enemies.push(createEnemy(state, wave, "brute", Math.max(2, Math.round((3 + wave) * brutePressureMultiplier)), "brute"));
  }

  if (shouldSpawnCommandWave) {
    enemies.push(createEnemy(state, wave, "undeadOfficer", Math.max(1, Math.round(officerPressureMultiplier)), "officer"));
  }

  return linkEnemyCommandHierarchy(enemies);
};
