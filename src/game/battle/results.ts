import { defaultWeaponByUnitType, isWeaponKey } from "../army/equipment";
import { summarizeFortificationEffects } from "../fortifications/effects";
import type { BattleResult, BattleState } from "./types";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const captureFactorForOutcome = (outcome: BattleResult["outcome"]): number =>
  outcome === "hold" ? 1 : outcome === "withdraw" ? 0.46 : 0.12;

const addWeaponRecords = (base: Record<string, number>, add: Record<string, number>): Record<string, number> => {
  const next = { ...base };
  for (const [key, value] of Object.entries(add)) {
    next[key] = Math.max(0, Math.round((next[key] ?? 0) + value));
  }
  return next;
};

const capturedWeaponsFromBattle = (state: BattleState, outcome: BattleResult["outcome"]): Record<string, number> => {
  const suppression = clamp(state.objectiveState.enemySuppression / 100, 0, 1.2);
  const waveFactor = Math.max(1, state.wavesSpawned);
  const factor = captureFactorForOutcome(outcome);
  const base = {
    dreyse: Math.max(0, Math.round((10 + suppression * 38 + waveFactor * 3) * factor)),
    jaegerRifle: Math.max(0, Math.round((2 + suppression * 12 + waveFactor) * factor)),
    fieldGun: Math.max(0, Math.floor((suppression * 2 + (outcome === "hold" ? 1 : 0)) * factor)),
    tools: Math.max(0, Math.round((3 + suppression * 8) * factor)),
  };
  const intel = state.scenario.operation.spoilsIntel?.expectedWeapons ?? {};
  const recoveryMultiplier = state.scenario.operation.spoilsIntel?.recoveryMultiplier ?? 1;
  const intelFactor = outcome === "hold" ? 0.72 : outcome === "withdraw" ? 0.32 : 0.08;
  const intelSpoils = Object.fromEntries(
    Object.entries(intel).map(([key, amount]) => [key, Math.round(amount * intelFactor * factor * recoveryMultiplier)]),
  );
  return addWeaponRecords(base, intelSpoils);
};

const equipmentWearForUnit = (
  unit: BattleState["playerUnits"][number],
  outcome: BattleResult["outcome"],
): number => {
  const casualtyPressure = unit.maxSoldiers > 0 ? unit.casualtiesThisBattle / unit.maxSoldiers : 0;
  const ammoUse = Math.max(0, 100 - unit.ammo) / 100;
  const outcomePressure = outcome === "hold" ? 0.006 : outcome === "withdraw" ? 0.012 : 0.024;
  const weaponKey = isWeaponKey(unit.weaponKey) ? unit.weaponKey : defaultWeaponByUnitType[unit.type];
  const typeFactor = weaponKey === "fieldGun" ? 1.35 : weaponKey === "tools" ? 0.82 : 1;
  return Number(clamp((casualtyPressure * 0.055 + ammoUse * 0.018 + outcomePressure) * typeFactor, 0, 0.075).toFixed(3));
};

const battleRoleForUnit = (unit: BattleState["playerUnits"][number]): string => {
  if (unit.deploymentMitigationRole === "weak_line_focus") {
    return "弱線是正";
  }
  if (unit.deploymentMitigationRole === "support_reserve") {
    return "弱線支援予備";
  }
  if (unit.objectiveResponseRole === "victory_hold") {
    return "勝利点保持";
  }
  if (unit.objectiveResponseRole === "victory_retake") {
    return "勝利点奪回";
  }
  if (unit.objectiveResponseRole === "supply_defense") {
    return "補給点防衛";
  }
  if (unit.objectiveResponseRole === "supply_retake") {
    return "補給点奪回";
  }
  if (unit.objectiveResponseRole === "visibility_secure") {
    return "視界点確保";
  }
  if (unit.objectiveResponseRole === "visibility_retake") {
    return "視界点奪回";
  }
  if (unit.enemyCommandActionRole === "command_node_fire") {
    return "敵指揮核制圧";
  }
  if (unit.enemyCommandActionRole === "collapse_pursuit") {
    return "敵崩壊追撃";
  }
  if (unit.enemyCommandActionRole === "command_reserve_commit") {
    return "指揮網予備投入";
  }
  if (unit.frontlineRotationRole === "rotated_out") {
    return "戦闘交代";
  }
  if (unit.frontlineRotationRole === "rear_guard_cover") {
    return "後衛援護";
  }
  if (unit.facilityResponseRole === "facility_repair") {
    return "施設修理";
  }
  if (unit.facilityResponseRole === "facility_resupply") {
    return "補給拠点勤務";
  }
  if (unit.facilityResponseRole === "facility_defense") {
    return "施設防衛";
  }
  if (unit.type === "engineer" || unit.standingOrder.posture === "engineer_support") {
    return "工兵支援";
  }
  if (unit.type === "artillery" || unit.standingOrder.posture === "fire_support") {
    return "火力支援";
  }
  if (unit.standingOrder.frontlineSegmentId?.includes("reserve") || unit.standingOrder.posture === "fallback_guard") {
    return "予備保持";
  }
  if (unit.standingOrder.posture === "aggressive_screen") {
    return "阻止反撃";
  }
  if (unit.standingOrder.posture === "elastic_defense") {
    return "弾性防御";
  }
  return "戦線固守";
};

const roleXpBonusForUnit = (unit: BattleState["playerUnits"][number], outcome: BattleResult["outcome"]): number => {
  const casualtyRatio = unit.maxSoldiers > 0 ? unit.casualtiesThisBattle / unit.maxSoldiers : 0;
  const readiness = unit.reserveReadiness ?? 0;
  const role = battleRoleForUnit(unit);
  const outcomeBonus = outcome === "hold" ? 1 : 0;
  if (role === "弱線是正") {
    return (unit.soldiers > 0 ? 2 : 1) + outcomeBonus + (casualtyRatio > 0.015 ? 1 : 0);
  }
  if (role === "弱線支援予備") {
    return (readiness >= 60 ? 2 : 1) + outcomeBonus;
  }
  if (role === "勝利点奪回") {
    return (unit.soldiers > 0 ? 3 : 1) + outcomeBonus + (casualtyRatio > 0.02 ? 1 : 0);
  }
  if (role === "勝利点保持") {
    return (unit.morale >= 45 ? 2 : 1) + outcomeBonus + (casualtyRatio > 0.018 ? 1 : 0);
  }
  if (role === "補給点防衛" || role === "補給点奪回") {
    return (unit.standingOrder.facilityAssignment ? 2 : 1) + outcomeBonus + (unit.ammo >= 35 ? 1 : 0);
  }
  if (role === "視界点確保" || role === "視界点奪回") {
    return 2 + outcomeBonus + (unit.xpGained >= 2 ? 1 : 0);
  }
  if (role === "敵指揮核制圧") {
    return 3 + outcomeBonus + (unit.focusTargetId ? 1 : 0);
  }
  if (role === "敵崩壊追撃") {
    return 3 + outcomeBonus + (unit.xpGained >= 2 || casualtyRatio > 0.015 ? 1 : 0);
  }
  if (role === "指揮網予備投入") {
    return 2 + outcomeBonus + (readiness >= 35 ? 1 : 0);
  }
  if (role === "戦闘交代") {
    return 1 + (unit.soldiers > 0 ? 1 : 0);
  }
  if (role === "後衛援護") {
    return 2 + outcomeBonus + (readiness <= 55 ? 1 : 0);
  }
  if (role === "施設防衛") {
    return 2 + outcomeBonus + (unit.focusTargetId ? 1 : 0);
  }
  if (role === "施設修理") {
    return 2 + outcomeBonus + (unit.actionReason === "repairing_structure" || unit.actionReason === "moving_to_repair" ? 1 : 0);
  }
  if (role === "補給拠点勤務") {
    return 2 + outcomeBonus + (unit.ammo >= 45 ? 1 : 0);
  }
  if (role === "予備保持") {
    return readiness >= 70 ? 2 + outcomeBonus : 1;
  }
  if (role === "火力支援") {
    return unit.xpGained >= 2 ? 3 + outcomeBonus : 1;
  }
  if (role === "工兵支援") {
    return unit.standingOrder.facilityAssignment ? 2 + outcomeBonus : 1;
  }
  if (role === "阻止反撃") {
    return unit.xpGained >= 2 || casualtyRatio > 0.02 ? 3 + outcomeBonus : 1;
  }
  if (role === "弾性防御") {
    return casualtyRatio > 0.015 ? 2 + outcomeBonus : 1;
  }
  return casualtyRatio > 0.01 ? 2 + outcomeBonus : outcomeBonus;
};

const withdrawalRearGuardForBattle = (
  state: BattleState,
  outcome: BattleResult["outcome"],
  battleRoleByUnit: Record<string, string>,
): { entries: BattleResult["withdrawalRearGuard"]; summary?: string } => {
  if (outcome !== "withdraw") {
    return { entries: [] };
  }
  const pursuitPressure = clamp(
    100 - state.objectiveState.lineIntegrity + state.objectiveState.objectivePressure * 0.35 + (100 - state.objectiveState.enemySuppression) * 0.18,
    8,
    96,
  );
  const candidates = state.playerUnits
    .filter((unit) => unit.soldiers > 0)
    .map((unit) => {
      const role = battleRoleByUnit[unit.unitId] ?? "戦線勤務";
      const reserve = unit.reserveReadiness ?? 0;
      const casualtyRatio = unit.maxSoldiers > 0 ? unit.casualtiesThisBattle / unit.maxSoldiers : 0;
      const rearGuardRole =
        role === "後衛援護" ||
        unit.frontlineRotationRole === "rear_guard_cover" ||
        unit.standingOrder.posture === "fallback_guard" ||
        unit.standingOrder.frontlineSegmentId?.includes("reserve");
      const fireSupport = unit.type === "artillery" || unit.standingOrder.posture === "fire_support";
      const score =
        (rearGuardRole ? 34 : 0) +
        (fireSupport ? 18 : 0) +
        Math.min(24, reserve * 0.22) +
        Math.min(16, unit.ammo * 0.12) +
        Math.min(14, unit.morale * 0.1) -
        casualtyRatio * 22;
      const roleLabel = rearGuardRole ? "後衛援護" : fireSupport ? "支援射撃" : "離脱掩護";
      return {
        unit,
        roleLabel,
        score,
        reason: `${roleLabel} / 即応${Math.round(reserve)} / 弾薬${Math.round(unit.ammo)} / 士気${Math.round(unit.morale)}`,
      };
    })
    .filter((candidate) => candidate.score > 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const entries = candidates.map((candidate) => {
    const rearGuardCasualties = rearGuardCasualtiesForCandidate(
      candidate.unit,
      candidate.score,
      pursuitPressure,
      candidate.roleLabel,
    );
    return {
      unitId: candidate.unit.unitId,
      unitName: candidate.unit.name,
      roleLabel: candidate.roleLabel,
      pursuitDamagePrevented: Math.max(1, Math.round((candidate.score * pursuitPressure) / 105)),
      rearGuardCasualties,
      riskLabel: rearGuardRiskLabel(rearGuardCasualties, candidate.unit),
      eventLabel: rearGuardEventLabel(rearGuardCasualties, candidate.roleLabel),
      reason: candidate.reason,
    };
  });
  const prevented = entries.reduce((sum, entry) => sum + entry.pursuitDamagePrevented, 0);
  const rearGuardCasualties = entries.reduce((sum, entry) => sum + entry.rearGuardCasualties, 0);
  return {
    entries,
    summary:
      entries.length > 0
        ? `後衛${entries.length}部隊が追撃被害${prevented}相当を抑止、後衛損耗${rearGuardCasualties}。追撃圧${Math.round(pursuitPressure)}。`
        : `組織的な後衛なし。追撃圧${Math.round(pursuitPressure)}。`,
  };
};

const rearGuardCasualtiesForCandidate = (
  unit: BattleState["playerUnits"][number],
  score: number,
  pursuitPressure: number,
  roleLabel: string,
): number => {
  const readiness = unit.reserveReadiness ?? 0;
  const exposure =
    roleLabel === "後衛援護"
      ? 0.44
      : roleLabel === "支援射撃"
        ? 0.32
        : 0.38;
  const unitScale = Math.max(12, unit.maxSoldiers * 0.018);
  const pressureCost = pursuitPressure * exposure * 0.42;
  const effortCost = Math.max(0, score - 30) * 0.09;
  const readinessMitigation = readiness * 0.055;
  const casualties = Math.round(unitScale + pressureCost + effortCost - readinessMitigation);
  return Math.max(1, Math.min(Math.max(1, Math.round(unit.maxSoldiers * 0.045)), casualties));
};

const rearGuardRiskLabel = (
  casualties: number,
  unit: BattleState["playerUnits"][number],
): BattleResult["withdrawalRearGuard"][number]["riskLabel"] => {
  const ratio = unit.maxSoldiers > 0 ? casualties / unit.maxSoldiers : 0;
  if (ratio >= 0.026 || casualties >= 18) {
    return "危険";
  }
  if (ratio >= 0.015 || casualties >= 9) {
    return "消耗";
  }
  return "軽微";
};

const rearGuardEventLabel = (casualties: number, roleLabel: string): string => {
  if (casualties >= 18) {
    return `${roleLabel}で強追撃を受け、後衛損耗${casualties}`;
  }
  if (casualties >= 9) {
    return `${roleLabel}で追撃を遅滞、後衛損耗${casualties}`;
  }
  return `${roleLabel}で整然離脱、後衛損耗${casualties}`;
};

const withdrawalRearGuardCasualtiesByUnit = (
  withdrawalRearGuard: BattleResult["withdrawalRearGuard"],
): Record<string, number> =>
  Object.fromEntries(withdrawalRearGuard.map((entry) => [entry.unitId, entry.rearGuardCasualties]));

const withdrawalRearGuardXpBonusForUnit = (
  withdrawalRearGuard: BattleResult["withdrawalRearGuard"],
  unitId: string,
): number => {
  const entry = withdrawalRearGuard.find((candidate) => candidate.unitId === unitId);
  if (!entry) {
    return 0;
  }
  return Math.min(3, Math.max(1, Math.ceil(entry.pursuitDamagePrevented / 16)));
};

const commendationsForUnit = (
  unit: BattleState["playerUnits"][number],
  role: string,
  outcome: BattleResult["outcome"],
): string[] => {
  const commendations: string[] = [];
  const casualtyRatio = unit.maxSoldiers > 0 ? unit.casualtiesThisBattle / unit.maxSoldiers : 0;
  if (role === "予備保持" && (unit.reserveReadiness ?? 0) >= 70) {
    commendations.push("即応予備を維持");
  }
  if (role === "弱線是正") {
    commendations.push(outcome === "collapse" ? "弱線崩壊下で戦闘" : "弱線を受け持つ");
    if (unit.standingOrder.facilityAssignment) {
      commendations.push("施設支援を活用");
    }
  }
  if (role === "弱線支援予備") {
    commendations.push((unit.reserveReadiness ?? 0) >= 60 ? "弱線支援予備を維持" : "弱線支援へ待機");
  }
  if (role === "勝利点保持") {
    commendations.push(outcome === "hold" ? "勝利地点を保持" : "勝利地点で遅滞");
  }
  if (role === "勝利点奪回") {
    commendations.push(outcome === "collapse" ? "崩壊下で勝利地点へ反撃" : "勝利地点奪回に投入");
    if (casualtyRatio >= 0.025) {
      commendations.push("反撃損耗を引受");
    }
  }
  if (role === "補給点防衛" || role === "補給点奪回") {
    commendations.push(role === "補給点奪回" ? "補給点奪回を担当" : "補給線を防衛");
    if (unit.standingOrder.facilityAssignment) {
      commendations.push("補給施設を活用");
    }
  }
  if (role === "視界点確保" || role === "視界点奪回") {
    commendations.push(role === "視界点奪回" ? "視界点奪回を担当" : "観測線を確保");
    if (unit.standingOrder.targetPriority === "officer") {
      commendations.push("敵指揮を制圧");
    }
  }
  if (role === "敵指揮核制圧") {
    commendations.push("敵指揮核を射撃制圧");
    if (unit.fireMissionId || unit.volleyUntilSeconds) {
      commendations.push("戦線斉射に参加");
    }
  }
  if (role === "敵崩壊追撃") {
    commendations.push(outcome === "collapse" ? "崩壊下で敵追撃を継続" : "崩れた敵群を追撃");
    if (unit.standingOrder.targetPriority === "weakest") {
      commendations.push("弱敵掃討を担当");
    }
  }
  if (role === "指揮網予備投入") {
    commendations.push("敵指揮網への予備投入");
    if ((unit.reserveReadiness ?? 0) <= 40) {
      commendations.push("即応予備を消費");
    }
  }
  if (role === "戦闘交代") {
    commendations.push("損耗旅団を後退線へ整理");
    if (unit.morale <= 42 || unit.ammo <= 24) {
      commendations.push("限界前に離脱");
    }
  }
  if (role === "後衛援護") {
    commendations.push("交代旅団を援護");
    if ((unit.reserveReadiness ?? 0) <= 55) {
      commendations.push("即応予備を投入");
    }
  }
  if (role === "火力支援" && unit.xpGained >= 2) {
    commendations.push("支援火力を継続");
  }
  if (role === "工兵支援" && unit.standingOrder.facilityAssignment) {
    commendations.push("陣地勤務を遂行");
  }
  if (role === "施設防衛") {
    commendations.push("防衛施設へ即応");
    if (unit.focusTargetId) {
      commendations.push("施設襲撃群を指名");
    }
  }
  if (role === "施設修理") {
    commendations.push("損傷施設を修復");
    if (unit.actionReason === "repairing_structure" || unit.actionReason === "moving_to_repair") {
      commendations.push("工兵修理を継続");
    }
  }
  if (role === "補給拠点勤務") {
    commendations.push("補給拠点を維持");
    if (unit.ammo >= 45) {
      commendations.push("弾薬補給線を保持");
    }
  }
  if (role === "阻止反撃" && unit.focusTargetId) {
    commendations.push("敵集団へ集中対応");
  }
  if (casualtyRatio >= 0.04) {
    commendations.push("損耗下で戦線維持");
  }
  if (unit.ammo <= 20) {
    commendations.push("弾薬限界まで交戦");
  }
  if (outcome === "hold" && unit.soldiers > 0 && commendations.length === 0) {
    commendations.push("防衛線維持に貢献");
  }
  return commendations;
};

const staffAdvisoryXpBonusForUnit = (state: BattleState, unitId: string, outcome: BattleResult["outcome"]): number => {
  const responseCount = (state.staffAdvisoryResponses ?? []).filter((response) => response.unitIds.includes(unitId)).length;
  if (responseCount <= 0) {
    return 0;
  }
  return clamp(responseCount + (outcome === "hold" ? 1 : 0), 1, 2);
};

const objectiveRoleType = (
  role: BattleState["playerUnits"][number]["objectiveResponseRole"],
): BattleState["objectiveNodes"][number]["type"] | undefined => {
  if (!role) {
    return undefined;
  }
  if (role.startsWith("victory")) {
    return "victory";
  }
  if (role.startsWith("supply")) {
    return "supply";
  }
  if (role.startsWith("visibility")) {
    return "visibility";
  }
  return undefined;
};

const objectiveTypeLabel: Record<BattleState["objectiveNodes"][number]["type"], string> = {
  victory: "勝利地点",
  supply: "補給地点",
  visibility: "視界地点",
};

const distance = (from: { x: number; y: number }, to: { x: number; y: number }): number =>
  Math.hypot(from.x - to.x, from.y - to.y);

const medicalRecoveryDetailForUnit = (
  state: BattleState,
  unit: BattleState["playerUnits"][number],
  rawCasualties: number,
  baseRecoveryRate: number,
  evacuationFactor: number,
): BattleResult["medicalRecoveryDetails"][number] => {
  const fieldHospitals = state.structures.filter(
    (structure) =>
      structure.type === "fieldHospital" && (structure.status === "built" || structure.status === "damaged") && structure.durability > 0,
  );
  if (rawCasualties <= 0 || fieldHospitals.length === 0) {
    const baseRecovered =
      rawCasualties > 0 && baseRecoveryRate > 0
        ? Math.min(rawCasualties, Math.max(1, Math.round(rawCasualties * baseRecoveryRate)))
        : 0;
    return {
      unitId: unit.unitId,
      unitName: unit.name,
      baseRecovered,
      bonusRecovered: 0,
      effectiveRecoveryRate: baseRecoveryRate,
      sourceLabel: fieldHospitals.length > 0 ? "救護線外" : "野戦病院なし",
      reason: fieldHospitals.length > 0 ? "後退線または現在位置が野戦病院支援圏外" : "野戦病院が配置されていない",
    };
  }
  const nearest = [...fieldHospitals]
    .map((hospital) => {
      const fallbackDistance = distance(unit.standingOrder.fallback.destination, hospital.position);
      const positionDistance = distance(unit.position, hospital.position);
      const supportDistance = Math.min(fallbackDistance, positionDistance);
      return { hospital, fallbackDistance, positionDistance, supportDistance };
    })
    .sort((a, b) => a.supportDistance - b.supportDistance)[0];
  const durabilityFactor = nearest.hospital.durability / nearest.hospital.maxDurability;
  const proximityFactor = clamp((34 - nearest.supportDistance) / 34, 0, 1);
  const fallbackLineBonus =
    nearest.fallbackDistance <= 22 ||
    unit.standingOrder.posture === "fallback_guard" ||
    unit.order === "retreat" ||
    unit.actionReason === "falling_back" ||
    unit.actionReason === "retreating"
      ? 0.035
      : 0;
  const proximityBonus = proximityFactor * durabilityFactor * 0.14 * evacuationFactor;
  const effectiveRecoveryRate = clamp(baseRecoveryRate + proximityBonus + fallbackLineBonus, 0, 0.56);
  const baseRecovered = Math.min(rawCasualties, Math.max(1, Math.round(rawCasualties * baseRecoveryRate)));
  const recovered = Math.min(rawCasualties, Math.max(baseRecovered, Math.round(rawCasualties * effectiveRecoveryRate)));
  const bonusRecovered = Math.max(0, recovered - baseRecovered);
  return {
    unitId: unit.unitId,
    unitName: unit.name,
    baseRecovered,
    bonusRecovered,
    effectiveRecoveryRate,
    sourceLabel: bonusRecovered > 0 ? "救護線接続" : "救護線外",
    reason:
      bonusRecovered > 0
        ? `野戦病院支援圏 / 後退点${Math.round(nearest.fallbackDistance)} / 現位置${Math.round(
            nearest.positionDistance,
          )}`
        : `野戦病院から遠い / 後退点${Math.round(nearest.fallbackDistance)} / 現位置${Math.round(
            nearest.positionDistance,
          )}`,
  };
};

const objectiveEventAssessmentDetail = (
  unit: BattleState["playerUnits"][number],
  node: BattleState["objectiveNodes"][number],
  resultLabel: BattleResult["objectiveEventResponseOutcomes"][number]["resultLabel"],
): { assessmentReason: string; lessonTag: string } => {
  const distanceToObjective = distance(unit.position, node.position);
  const soldierRatio = unit.maxSoldiers > 0 ? unit.soldiers / unit.maxSoldiers : 0;
  if (resultLabel === "再確保") {
    if (unit.ammo <= 24) {
      return { assessmentReason: "弾薬限界でも目標を戻した", lessonTag: "弾薬限界再確保" };
    }
    if (soldierRatio <= 0.62) {
      return { assessmentReason: "損耗下で目標圏を押し返した", lessonTag: "損耗下再確保" };
    }
    return { assessmentReason: "目標圏に十分な戦力を置けた", lessonTag: "目標圏再確保" };
  }
  if (distanceToObjective > node.radius + 18) {
    return { assessmentReason: "到着が遅く目標圏外に留まった", lessonTag: "到着遅延" };
  }
  if (unit.morale <= 34) {
    return { assessmentReason: "士気が崩れ押し返しきれなかった", lessonTag: "士気不足" };
  }
  if (unit.ammo <= 18) {
    return { assessmentReason: "弾薬不足で継続射撃できなかった", lessonTag: "弾薬不足" };
  }
  if (soldierRatio <= 0.48) {
    return { assessmentReason: "投入兵力が消耗し目標圧を支えられなかった", lessonTag: "兵力不足" };
  }
  if (node.eventState.severity === "critical") {
    return { assessmentReason: "敵圧を止めたが重大イベントは継続した", lessonTag: "イベント継続" };
  }
  return { assessmentReason: "敵圧を遅らせたが支配を戻しきれなかった", lessonTag: "支配未確定" };
};

const objectiveEventResponseOutcomesForBattle = (state: BattleState): BattleResult["objectiveEventResponseOutcomes"] =>
  state.playerUnits
    .filter((unit) => unit.objectiveResponseRole)
    .map((unit) => {
      const objectiveType = objectiveRoleType(unit.objectiveResponseRole);
      const node = objectiveType ? state.objectiveNodes.find((candidate) => candidate.type === objectiveType) : undefined;
      if (!node || !objectiveType) {
        return undefined;
      }
      const roleLabel = battleRoleForUnit(unit);
      const finalControl = Math.round(node.controlProgress);
      const finalSeverity = node.eventState.severity;
      const resultLabel: BattleResult["objectiveEventResponseOutcomes"][number]["resultLabel"] =
        finalControl >= 58 && finalSeverity !== "critical"
          ? "再確保"
          : finalControl >= 38 || finalSeverity === "strained"
            ? "遅滞"
            : "未回復";
      const objectiveLabel = `${objectiveTypeLabel[objectiveType]}/${node.scenario.label}`;
      const eventLabel = node.eventState.label;
      const { assessmentReason, lessonTag } = objectiveEventAssessmentDetail(unit, node, resultLabel);
      return {
        id: `${unit.unitId}-${node.id}-${unit.objectiveResponseRole}`,
        unitId: unit.unitId,
        unitName: unit.name,
        objectiveType,
        objectiveLabel,
        roleLabel,
        eventLabel,
        finalControl,
        finalSeverity,
        resultLabel,
        assessmentReason,
        lessonTag,
        summary: `${unit.name}: ${objectiveLabel}で${eventLabel}に対応、${resultLabel}（支配${finalControl}%、${assessmentReason}）`,
      };
    })
    .filter((outcome): outcome is BattleResult["objectiveEventResponseOutcomes"][number] => Boolean(outcome));

const objectiveEventResponseXpBonusForUnit = (
  objectiveEventResponseOutcomes: BattleResult["objectiveEventResponseOutcomes"],
  unitId: string,
): number => {
  const outcome = objectiveEventResponseOutcomes.find((candidate) => candidate.unitId === unitId);
  if (!outcome) {
    return 0;
  }
  if (outcome.resultLabel === "再確保") {
    return 2;
  }
  if (outcome.resultLabel === "遅滞") {
    return 1;
  }
  return 0;
};

const enemyCommandEffectOutcomesForBattle = (
  state: BattleState,
  battleRoleByUnit: Record<string, string>,
): BattleResult["enemyCommandEffectOutcomes"] => {
  const enemyById = Object.fromEntries(state.enemyUnits.map((enemy) => [enemy.id, enemy]));
  const frontlineById = Object.fromEntries(state.frontlineSegments.map((segment) => [segment.id, segment]));
  const playerUnitsBySegment = (segmentId: string) =>
    state.playerUnits.filter((unit) => unit.soldiers > 0 && unit.standingOrder.frontlineSegmentId === segmentId);
  const pressureForSegment = (segmentId: string) =>
    state.enemyUnits
      .filter((enemy) => enemy.count > 0 && enemy.assaultPlan.targetSegmentId === segmentId)
      .reduce((sum, enemy) => sum + enemy.pressure, 0);
  const nearestFrontlineSegmentId = (unit: BattleState["playerUnits"][number]): string | undefined =>
    state.frontlineSegments
      .map((segment) => ({ id: segment.id, distance: distance(unit.position, segment.anchor) }))
      .sort((a, b) => a.distance - b.distance)[0]?.id;

  const commandFireUnits = state.playerUnits.filter(
    (unit) =>
      (unit.enemyCommandActionRole === "command_node_fire" || battleRoleByUnit[unit.unitId] === "敵指揮核制圧") &&
      unit.soldiers > 0,
  );
  const pursuitUnits = state.playerUnits.filter(
    (unit) =>
      (unit.enemyCommandActionRole === "collapse_pursuit" || battleRoleByUnit[unit.unitId] === "敵崩壊追撃") &&
      unit.soldiers > 0,
  );
  const reserveUnits = state.playerUnits.filter(
    (unit) =>
      (unit.enemyCommandActionRole === "command_reserve_commit" || battleRoleByUnit[unit.unitId] === "指揮網予備投入") &&
      unit.soldiers > 0,
  );
  const outcomes: BattleResult["enemyCommandEffectOutcomes"] = [];

  const groupedCommandFire = new Map<string, typeof commandFireUnits>();
  for (const unit of commandFireUnits) {
    const targetId = unit.focusTargetId ?? "unknown-command-target";
    groupedCommandFire.set(targetId, [...(groupedCommandFire.get(targetId) ?? []), unit]);
  }
  for (const [targetId, units] of groupedCommandFire.entries()) {
    const target = enemyById[targetId];
    const influence = target ? clamp(target.assaultPlan.commandInfluence, 0, 1) : 0;
    const cohesion = target ? clamp(target.assaultPlan.cohesion, 0, 1) : 0;
    const resultLabel =
      !target || target.count <= 0
        ? "制圧完了"
        : target.assaultPlan.commandState === "disrupted" || influence <= 0.45
          ? "指揮低下"
          : "効果限定";
    outcomes.push({
      id: `enemy-command-fire-${targetId}`,
      unitIds: units.map((unit) => unit.unitId),
      unitNames: units.map((unit) => unit.name),
      roleLabel: "敵指揮核制圧",
      resultLabel,
      effectLabel:
        resultLabel === "制圧完了"
          ? "指揮核を戦闘外へ追い込んだ"
          : resultLabel === "指揮低下"
            ? "指揮影響を低下させた"
            : "射撃は届いたが指揮影響は残った",
      metricLabel: target
        ? `影響${Math.round(influence * 100)}% / 凝集${Math.round(cohesion * 100)}% / 残敵${target.count}`
        : "指揮核消滅",
      lessonTag:
        resultLabel === "制圧完了" ? "指揮核制圧完了" : resultLabel === "指揮低下" ? "指揮低下成功" : "指揮射撃効果限定",
      assessmentReason: `${units.length}旅団が${target?.name ?? "敵指揮核"}へ射撃を集中。`,
    });
  }

  const groupedPursuit = new Map<string, typeof pursuitUnits>();
  for (const unit of pursuitUnits) {
    const targetId = unit.focusTargetId ?? "unknown-pursuit-target";
    groupedPursuit.set(targetId, [...(groupedPursuit.get(targetId) ?? []), unit]);
  }
  for (const [targetId, units] of groupedPursuit.entries()) {
    const target = enemyById[targetId];
    const cohesion = target ? clamp(target.assaultPlan.cohesion, 0, 1) : 0;
    const moraleState = target?.assaultPlan.moraleState;
    const resultLabel =
      !target || target.count <= 0
        ? "掃討"
        : moraleState === "routing" || moraleState === "regrouping" || cohesion <= 0.58
          ? "再集結抑止"
          : "追撃継続";
    outcomes.push({
      id: `enemy-command-pursuit-${targetId}`,
      unitIds: units.map((unit) => unit.unitId),
      unitNames: units.map((unit) => unit.name),
      roleLabel: "敵崩壊追撃",
      resultLabel,
      effectLabel:
        resultLabel === "掃討"
          ? "崩れた敵群を掃討した"
          : resultLabel === "再集結抑止"
            ? "敵の再集結を抑えた"
            : "追撃中だが敵群はまだまとまっている",
      metricLabel: target
        ? `士気${moraleState ?? "不明"} / 凝集${Math.round(cohesion * 100)}% / 残敵${target.count}`
        : "追撃対象消滅",
      lessonTag: resultLabel === "掃討" ? "崩壊掃討" : resultLabel === "再集結抑止" ? "再集結抑止" : "追撃継続",
      assessmentReason: `${units.length}旅団が${target?.name ?? "崩壊敵群"}を追撃。`,
    });
  }

  const groupedReserve = new Map<string, typeof reserveUnits>();
  for (const unit of reserveUnits) {
    const segmentId = unit.standingOrder.frontlineSegmentId ?? nearestFrontlineSegmentId(unit) ?? "reserve-unknown";
    groupedReserve.set(segmentId, [...(groupedReserve.get(segmentId) ?? []), unit]);
  }
  for (const [segmentId, units] of groupedReserve.entries()) {
    const segment = frontlineById[segmentId];
    const defenders = playerUnitsBySegment(segmentId).length;
    const pressure = pressureForSegment(segmentId);
    const pressurePerDefender = defenders > 0 ? Math.round(pressure / defenders) : Math.round(pressure);
    const resultLabel = defenders <= 0 || pressurePerDefender > 850 ? "圧力過大" : pressurePerDefender <= 520 ? "封鎖安定" : "戦線保持";
    outcomes.push({
      id: `enemy-command-reserve-${segmentId}`,
      unitIds: units.map((unit) => unit.unitId),
      unitNames: units.map((unit) => unit.name),
      roleLabel: "指揮網予備投入",
      resultLabel,
      effectLabel:
        resultLabel === "封鎖安定"
          ? "予備投入で突破圧を安定化した"
          : resultLabel === "戦線保持"
            ? "予備投入で戦線を支えた"
            : "予備投入後も敵圧が過大",
      metricLabel: `${segment?.name ?? "担当戦線"} / 守備${defenders}旅団 / 1旅団圧${pressurePerDefender}`,
      lessonTag:
        resultLabel === "封鎖安定" ? "予備封鎖成功" : resultLabel === "戦線保持" ? "予備戦線保持" : "予備投入不足",
      assessmentReason: `${units.length}旅団が${segment?.name ?? "担当戦線"}へ接続。`,
    });
  }
  return outcomes;
};

const enemyCommandEffectXpBonusForUnit = (
  outcomes: BattleResult["enemyCommandEffectOutcomes"],
  unitId: string,
): number => {
  const outcome = outcomes.find((candidate) => candidate.unitIds.includes(unitId));
  if (!outcome) {
    return 0;
  }
  return outcome.resultLabel === "効果限定" || outcome.resultLabel === "追撃継続" || outcome.resultLabel === "圧力過大" ? 1 : 2;
};

const rearGuardOfficerRiskPressure = (rearGuard?: BattleResult["withdrawalRearGuard"][number]): number => {
  if (!rearGuard) {
    return 0;
  }
  const riskPressure = rearGuard.riskLabel === "危険" ? 18 : rearGuard.riskLabel === "消耗" ? 10 : 4;
  const rolePressure = rearGuard.roleLabel === "後衛援護" ? 5 : rearGuard.roleLabel === "離脱掩護" ? 4 : 2;
  return riskPressure + rolePressure;
};

const officerRiskForUnit = (
  unit: BattleState["playerUnits"][number],
  outcome: BattleResult["outcome"],
  rearGuard?: BattleResult["withdrawalRearGuard"][number],
): number => {
  const casualtyRatio =
    unit.maxSoldiers > 0 ? (unit.casualtiesThisBattle + (rearGuard?.rearGuardCasualties ?? 0)) / unit.maxSoldiers : 0;
  const collapsePressure = outcome === "collapse" ? 28 : outcome === "withdraw" ? 14 : 4;
  const closeActionPressure =
    unit.standingOrder.posture === "aggressive_screen" || unit.order === "flank"
      ? 10
      : unit.standingOrder.posture === "elastic_defense" || unit.order === "retreat"
        ? 7
        : 3;
  const spentUnitPressure = unit.soldiers <= 0 ? 35 : unit.morale < 30 ? 12 : unit.ammo <= 12 ? 5 : 0;
  return clamp(
    Math.round(casualtyRatio * 420 + collapsePressure + closeActionPressure + spentUnitPressure + rearGuardOfficerRiskPressure(rearGuard)),
    0,
    100,
  );
};

const officerXpForUnit = (
  unit: BattleState["playerUnits"][number],
  outcome: BattleResult["outcome"],
  role: string,
  commendations: string[],
): number => {
  const roleBonus =
    role === "予備保持"
      ? (unit.reserveReadiness ?? 0) >= 70
        ? 2
        : 1
      : role === "火力支援" ||
          role === "工兵支援" ||
          role === "施設修理" ||
          role === "補給拠点勤務" ||
          role === "弱線支援予備" ||
          role === "勝利点保持" ||
          role === "補給点防衛" ||
          role === "視界点確保"
        ? 2
        : role === "阻止反撃" ||
            role === "弾性防御" ||
            role === "弱線是正" ||
            role === "施設防衛" ||
            role === "勝利点奪回" ||
            role === "補給点奪回" ||
            role === "視界点奪回" ||
            role === "敵指揮核制圧" ||
            role === "敵崩壊追撃" ||
            role === "指揮網予備投入"
          ? 3
          : 1;
  const outcomeBonus = outcome === "hold" ? 2 : outcome === "withdraw" ? 1 : 0;
  const commendationBonus = commendations.length > 0 ? 1 : 0;
  return clamp(roleBonus + outcomeBonus + commendationBonus, 1, 7);
};

const officerWoundedForUnit = (
  unit: BattleState["playerUnits"][number],
  outcome: BattleResult["outcome"],
  risk: number,
  rearGuard?: BattleResult["withdrawalRearGuard"][number],
): boolean => {
  const casualtyRatio =
    unit.maxSoldiers > 0 ? (unit.casualtiesThisBattle + (rearGuard?.rearGuardCasualties ?? 0)) / unit.maxSoldiers : 0;
  if (unit.soldiers <= 0) {
    return true;
  }
  if (outcome === "collapse") {
    return risk >= 42 || casualtyRatio >= 0.035;
  }
  if (outcome === "withdraw") {
    return risk >= 55 || casualtyRatio >= 0.06;
  }
  return risk >= 78 || casualtyRatio >= 0.1;
};

const divisionCommanderSummaries = (
  state: BattleState,
  outcome: BattleResult["outcome"],
  battleRoleByUnit: Record<string, string>,
): {
  events: string[];
  xpById: Record<string, number>;
  riskById: Record<string, number>;
  namesById: Record<string, string>;
  woundedIds: string[];
} => {
  const groups = new Map<
    string,
    {
      officerId: string;
      officerName?: string;
      divisionName: string;
      units: BattleState["playerUnits"];
    }
  >();
  for (const unit of state.playerUnits) {
    if (!unit.divisionCommanderOfficerId || !unit.divisionName) {
      continue;
    }
    const existing = groups.get(unit.divisionCommanderOfficerId);
    if (existing) {
      existing.units.push(unit);
    } else {
      groups.set(unit.divisionCommanderOfficerId, {
        officerId: unit.divisionCommanderOfficerId,
        officerName: unit.divisionCommanderName,
        divisionName: unit.divisionName,
        units: [unit],
      });
    }
  }

  const events: string[] = [];
  const xpById: Record<string, number> = {};
  const riskById: Record<string, number> = {};
  const namesById: Record<string, string> = {};
  const woundedIds: string[] = [];
  for (const group of groups.values()) {
    const unitCount = group.units.length;
    const casualtyRatio =
      group.units.reduce(
        (sum, unit) => sum + (unit.maxSoldiers > 0 ? unit.casualtiesThisBattle / unit.maxSoldiers : 0),
        0,
      ) / Math.max(1, unitCount);
    const roleSet = new Set(group.units.map((unit) => battleRoleByUnit[unit.unitId] ?? "戦線勤務"));
    const avgReadiness =
      group.units.reduce((sum, unit) => sum + (unit.reserveReadiness ?? 0), 0) / Math.max(1, unitCount);
    const lowStateCount = group.units.filter((unit) => unit.morale < 45 || unit.soldiers <= unit.maxSoldiers * 0.55).length;
    const outcomeBonus = outcome === "hold" ? 2 : outcome === "withdraw" ? 1 : 0;
    const scaleBonus = unitCount >= 6 ? 2 : unitCount >= 3 ? 1 : 0;
    const roleBonus = roleSet.size >= 3 ? 2 : roleSet.size >= 2 ? 1 : 0;
    const readinessBonus = avgReadiness >= 70 ? 1 : 0;
    const pressureBonus = casualtyRatio >= 0.025 ? 1 : 0;
    const xp = clamp(1 + outcomeBonus + scaleBonus + roleBonus + readinessBonus + pressureBonus, 1, 9);
    const risk = clamp(
      Math.round(casualtyRatio * 260 + (outcome === "collapse" ? 24 : outcome === "withdraw" ? 12 : 3) + lowStateCount * 4),
      0,
      85,
    );
    const roleSummary = Array.from(roleSet).slice(0, 3).join("・");
    xpById[group.officerId] = (xpById[group.officerId] ?? 0) + xp;
    riskById[group.officerId] = Math.max(riskById[group.officerId] ?? 0, risk);
    namesById[group.officerId] = group.divisionName;
    const wounded =
      outcome === "collapse"
        ? risk >= 42 || lowStateCount >= Math.max(1, Math.ceil(unitCount * 0.45))
        : outcome === "withdraw"
          ? risk >= 55 || (casualtyRatio >= 0.065 && lowStateCount >= 1)
          : risk >= 78 || casualtyRatio >= 0.12;
    if (wounded) {
      woundedIds.push(group.officerId);
    }
    events.push(
      `${group.divisionName}師団長${group.officerName ? ` ${group.officerName}` : ""}: ${unitCount}旅団統制、${roleSummary}、師団指揮経験+${xp}、危険度${risk}${wounded ? "、指揮所負傷" : ""}`,
    );
  }
  return { events, xpById, riskById, namesById, woundedIds };
};

const predictedWaveCountAt = (state: BattleState): number => {
  const intel = state.scenario.waveIntel;
  if (state.elapsedSeconds < intel.firstWaveSecond) {
    return 0;
  }
  return Math.floor((state.elapsedSeconds - intel.firstWaveSecond) / Math.max(1, intel.spawnIntervalSeconds)) + 1;
};

const misinformationAfterAction = (
  state: BattleState,
): {
  events: string[];
  lessonOfficerIds: string[];
} => {
  const surpriseSummary = state.scenario.waveIntel.surpriseSummary;
  if (!surpriseSummary) {
    return { events: [], lessonOfficerIds: [] };
  }
  const predictedWaves = predictedWaveCountAt(state);
  const extraWaves = Math.max(0, state.wavesSpawned - predictedWaves);
  const rawCasualties = Math.round(state.playerUnits.reduce((sum, unit) => sum + unit.casualtiesThisBattle, 0));
  const lowMoraleUnits = state.playerUnits.filter((unit) => unit.morale < 45).length;
  const lessonOfficerIds = [
    ...new Set(
      state.playerUnits
        .filter((unit) => unit.officerId)
        .filter((unit) => unit.type === "jaeger" || unit.standingOrder.posture === "aggressive_screen" || unit.morale < 45)
        .map((unit) => unit.officerId),
    ),
  ];
  return {
    events: [
      `敵情誤認: ${surpriseSummary}`,
      `予測波${predictedWaves}に対して実波${state.wavesSpawned}、追加圧力${extraWaves}波。`,
      `誤情報下損耗 ${rawCasualties} / 低士気旅団 ${lowMoraleUnits}。偵察・参謀判断の反省対象。`,
    ],
    lessonOfficerIds,
  };
};

const staffAdvisoryOutcomesForBattle = (state: BattleState): BattleResult["staffAdvisoryOutcomes"] =>
  (state.staffAdvisoryResponses ?? []).map((response) => {
    const unitNames = response.unitIds.map((unitId) => state.playerUnits.find((unit) => unit.unitId === unitId)?.name ?? unitId);
    const resultLabel: BattleResult["staffAdvisoryOutcomes"][number]["resultLabel"] =
      state.objectiveState.lineIntegrity >= 55
        ? "戦線維持に寄与"
        : state.status === "collapsed"
          ? "対応及ばず"
          : "撤退支援";
    return {
      ...response,
      unitNames,
      finalLineIntegrity: Math.round(state.objectiveState.lineIntegrity),
      resultLabel,
      summary: `${response.segmentName}で${response.presetLabel}を採用。${response.reason}`,
    };
  });

const objectiveControlLabel = <T extends string>(value: number, held: T, contested: T, lost: T): T =>
  value >= 64 ? held : value <= 34 ? lost : contested;

const objectiveOutcomeForBattle = (state: BattleState): BattleResult["objectiveOutcome"] => {
  const victoryControl = Math.round(state.objectiveState.victoryControl);
  const supplyControl = Math.round(state.objectiveState.supplyControl);
  const visibilityControl = Math.round(state.objectiveState.visibilityControl);
  const victoryLabel = objectiveControlLabel(victoryControl, "勝利点保持", "勝利点係争", "勝利点喪失");
  const supplyLabel = objectiveControlLabel(supplyControl, "補給点保持", "補給点係争", "補給点喪失");
  const visibilityLabel = objectiveControlLabel(visibilityControl, "視界点保持", "視界点係争", "視界点喪失");

  const supplyHeld = supplyControl >= 64;
  const supplyLost = supplyControl <= 34;
  const visibilityHeld = visibilityControl >= 64;
  const visibilityLost = visibilityControl <= 34;
  const victoryHeld = victoryControl >= 64;
  const victoryLost = victoryControl <= 34;

  const supplySpentDelta = supplyHeld ? -8 : supplyLost ? 12 : 0;
  const resourceDelta = supplyHeld
    ? {
        ammunition: Math.round(24 + (supplyControl - 64) * 0.8),
        supplies: Math.round(16 + (supplyControl - 64) * 0.55),
      }
    : {};
  const enemyPressureDelta = victoryHeld ? -3 : victoryLost ? 6 : 1;
  const enemyMomentumDelta = victoryHeld ? -1 : victoryLost ? 2 : 0;
  const globalThreatDelta = victoryHeld ? -1 : victoryLost ? 3 : 0;
  const intelConfidenceShift: 0 | 1 = visibilityHeld ? 1 : 0;

  const events = [
    victoryHeld
      ? `勝利地点保持: 敵圧${enemyPressureDelta} / 敵勢${enemyMomentumDelta}`
      : victoryLost
        ? `勝利地点喪失: 敵圧+${enemyPressureDelta} / 敵勢+${enemyMomentumDelta}`
        : `勝利地点係争: 敵圧+${enemyPressureDelta}`,
    supplyHeld
      ? `補給点保持: 弾薬+${resourceDelta.ammunition ?? 0} / 補給+${resourceDelta.supplies ?? 0} / 補給消費${supplySpentDelta}`
      : supplyLost
        ? `補給点喪失: 補給消費+${supplySpentDelta}`
        : "補給点係争: 補給効果なし",
    visibilityHeld
      ? "視界点保持: 次ターン初期敵情+1"
      : visibilityLost
        ? "視界点喪失: 敵情補正なし"
        : "視界点係争: 敵情補正なし",
  ];

  return {
    victoryControl,
    supplyControl,
    visibilityControl,
    victoryLabel,
    supplyLabel,
    visibilityLabel,
    supplySpentDelta,
    resourceDelta,
    enemyPressureDelta,
    enemyMomentumDelta,
    globalThreatDelta,
    intelConfidenceShift,
    events,
  };
};

const staffAccountabilityEventsForBattle = (
  state: BattleState,
  outcome: BattleResult["outcome"],
  objectiveOutcome: BattleResult["objectiveOutcome"],
  structureDamage: Record<string, number>,
): BattleResult["staffAccountabilityEvents"] => {
  const contexts = state.staffAccountabilityContext ?? [];
  const averageAmmo =
    state.playerUnits.reduce((sum, unit) => sum + unit.ammo, 0) / Math.max(1, state.playerUnits.length);
  const lowAmmoUnits = state.playerUnits.filter((unit) => unit.ammo <= 22).length;
  const totalStructureDamage = Object.values(structureDamage).reduce((sum, damage) => sum + damage, 0);
  const overrunStructures = state.structures.filter((structure) => structure.status === "overrun" || structure.durability <= 0).length;
  const damagedStructures = state.structures.filter(
    (structure) => structure.durability > 0 && structure.durability < structure.maxDurability * 0.55,
  ).length;
  const suppression = Math.round(state.objectiveState.enemySuppression);

  const buildEvent = (
    context: BattleState["staffAccountabilityContext"][number],
    resultLabel: BattleResult["staffAccountabilityEvents"][number]["resultLabel"],
    triggerLabel: string,
    reason: string,
    lessonTag: string,
  ): BattleResult["staffAccountabilityEvents"][number] => {
    const xpDelta = resultLabel === "功績" ? 3 : resultLabel === "警告" ? 1 : 0;
    const fatigueDelta = resultLabel === "功績" ? 1 : resultLabel === "警告" ? 4 : 8;
    const officerLabel = context.officerName ?? "未任命";
    return {
      ...context,
      id: `${context.slotId}-${lessonTag}`,
      resultLabel,
      triggerLabel,
      reason,
      lessonTag,
      xpDelta: context.officerId ? xpDelta : 0,
      fatigueDelta: context.officerId ? fatigueDelta : 0,
      summary: `${context.slotLabel} ${officerLabel}: ${resultLabel} / ${triggerLabel} / ${reason}`,
    };
  };

  return contexts
    .map((context) => {
      if (context.slotId === "chiefOfStaff") {
        if (outcome === "collapse" || objectiveOutcome.victoryControl <= 34 || state.objectiveState.lineIntegrity < 42) {
          return buildEvent(
            context,
            "責任",
            "全軍統制不全",
            `戦線${Math.round(state.objectiveState.lineIntegrity)}% / ${objectiveOutcome.victoryLabel}`,
            "統制崩壊責任",
          );
        }
        if (outcome === "withdraw" || state.objectiveState.lineIntegrity < 58) {
          return buildEvent(
            context,
            "警告",
            "戦線整理不足",
            `戦線${Math.round(state.objectiveState.lineIntegrity)}%で撤退判断`,
            "戦線整理警告",
          );
        }
        return buildEvent(
          context,
          "功績",
          "戦線統制",
          `戦線${Math.round(state.objectiveState.lineIntegrity)}% / ${objectiveOutcome.victoryLabel}`,
          "統制維持",
        );
      }
      if (context.slotId === "quartermaster") {
        if (objectiveOutcome.supplyControl <= 34 || lowAmmoUnits >= 3 || averageAmmo <= 32) {
          return buildEvent(
            context,
            objectiveOutcome.supplyControl <= 34 ? "責任" : "警告",
            "補給計画不全",
            `${objectiveOutcome.supplyLabel} / 低弾薬${lowAmmoUnits}旅団 / 平均弾薬${Math.round(averageAmmo)}`,
            objectiveOutcome.supplyControl <= 34 ? "補給点喪失責任" : "弾薬配分警告",
          );
        }
        return buildEvent(
          context,
          "功績",
          "補給維持",
          `${objectiveOutcome.supplyLabel} / 平均弾薬${Math.round(averageAmmo)}`,
          "補給維持",
        );
      }
      if (context.slotId === "engineerChief") {
        if (overrunStructures > 0 || totalStructureDamage >= 80) {
          return buildEvent(
            context,
            overrunStructures > 0 ? "責任" : "警告",
            "施設防護不全",
            `損傷${totalStructureDamage} / 破壊${overrunStructures} / 半壊${damagedStructures}`,
            overrunStructures > 0 ? "施設破壊責任" : "修理遅延警告",
          );
        }
        return buildEvent(
          context,
          "功績",
          "築城線維持",
          `損傷${totalStructureDamage} / 稼働施設${state.structures.length - overrunStructures}`,
          "築城維持",
        );
      }
      if (context.slotId === "artilleryChief") {
        if (suppression < 35 && state.wavesSpawned >= 2) {
          return buildEvent(
            context,
            "警告",
            "火力集中不足",
            `敵制圧${suppression}% / 発生波${state.wavesSpawned}`,
            "火力集中警告",
          );
        }
        if (suppression >= 60 || state.playerUnits.some((unit) => unit.fireMissionId || unit.volleyUntilSeconds)) {
          return buildEvent(
            context,
            "功績",
            "火力支援成功",
            `敵制圧${suppression}% / 発生波${state.wavesSpawned}`,
            "火力支援功績",
          );
        }
        return buildEvent(
          context,
          "警告",
          "火力効果限定",
          `敵制圧${suppression}% / 発生波${state.wavesSpawned}`,
          "火力効果警告",
        );
      }
      return undefined;
    })
    .filter((event): event is BattleResult["staffAccountabilityEvents"][number] => Boolean(event));
};

export const createBattleResult = (state: BattleState, turnNumber: number): BattleResult => {
  const outcome = state.status === "held" ? "hold" : state.status === "withdrawn" ? "withdraw" : "collapse";
  const baseRawCasualtiesByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => [unit.unitId, Math.round(unit.casualtiesThisBattle)]),
  );
  const unitNamesById = Object.fromEntries(state.playerUnits.map((unit) => [unit.unitId, unit.name]));
  const battleRoleByUnit = Object.fromEntries(state.playerUnits.map((unit) => [unit.unitId, battleRoleForUnit(unit)]));
  const withdrawalRearGuardResult = withdrawalRearGuardForBattle(state, outcome, battleRoleByUnit);
  const rearGuardCasualtiesByUnit = withdrawalRearGuardCasualtiesByUnit(withdrawalRearGuardResult.entries);
  const rawCasualtiesByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => [
      unit.unitId,
      (baseRawCasualtiesByUnit[unit.unitId] ?? 0) + (rearGuardCasualtiesByUnit[unit.unitId] ?? 0),
    ]),
  );
  const strategicDoctrine = state.strategicDoctrine;
  const fortEffects = summarizeFortificationEffects(state.structures, strategicDoctrine);
  const evacuationFactor = outcome === "hold" ? 1 : outcome === "withdraw" ? 0.72 : 0.28;
  const medicalRecoveryRate = clamp(
    (fortEffects.casualtyRecovery / 100) * evacuationFactor + (strategicDoctrine?.medicalRecoveryBonus ?? 0),
    0,
    0.48,
  );
  const medicalRecoveryDetails = state.playerUnits.map((unit) =>
    medicalRecoveryDetailForUnit(state, unit, rawCasualtiesByUnit[unit.unitId] ?? 0, medicalRecoveryRate, evacuationFactor),
  );
  const medicalRecoveryDetailByUnit = Object.fromEntries(
    medicalRecoveryDetails.map((detail) => [detail.unitId, detail]),
  );
  const recoveredByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => {
      const rawCasualties = rawCasualtiesByUnit[unit.unitId] ?? 0;
      const detail = medicalRecoveryDetailByUnit[unit.unitId];
      const recovered = Math.min(rawCasualties, (detail?.baseRecovered ?? 0) + (detail?.bonusRecovered ?? 0));
      return [unit.unitId, recovered];
    }),
  );
  const casualtiesByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => {
      const rawCasualties = rawCasualtiesByUnit[unit.unitId] ?? 0;
      const recovered = recoveredByUnit[unit.unitId] ?? 0;
      return [unit.unitId, Math.max(0, rawCasualties - recovered)];
    }),
  );
  const objectiveEventResponseOutcomes = objectiveEventResponseOutcomesForBattle(state);
  const enemyCommandEffectOutcomes = enemyCommandEffectOutcomesForBattle(state, battleRoleByUnit);
  const roleXpBonusByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => [unit.unitId, roleXpBonusForUnit(unit, outcome)]),
  );
  const xpByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => [
      unit.unitId,
      Math.round(
        unit.xpGained +
          (roleXpBonusByUnit[unit.unitId] ?? 0) +
          withdrawalRearGuardXpBonusForUnit(withdrawalRearGuardResult.entries, unit.unitId) +
          staffAdvisoryXpBonusForUnit(state, unit.unitId, outcome) +
          objectiveEventResponseXpBonusForUnit(objectiveEventResponseOutcomes, unit.unitId) +
          enemyCommandEffectXpBonusForUnit(enemyCommandEffectOutcomes, unit.unitId),
      ),
    ]),
  );
  const commendationsByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => {
      const commendations = commendationsForUnit(unit, battleRoleByUnit[unit.unitId] ?? "戦線固守", outcome);
      const objectiveEventOutcome = objectiveEventResponseOutcomes.find((candidate) => candidate.unitId === unit.unitId);
      if (objectiveEventOutcome?.resultLabel === "再確保") {
        commendations.push(`${objectiveEventOutcome.objectiveLabel}を再確保`);
      } else if (objectiveEventOutcome?.resultLabel === "遅滞") {
        commendations.push(`${objectiveEventOutcome.objectiveLabel}で遅滞`);
      } else if (objectiveEventOutcome?.resultLabel === "未回復") {
        commendations.push(`${objectiveEventOutcome.objectiveLabel}未回復`);
      }
      const rearGuard = withdrawalRearGuardResult.entries.find((entry) => entry.unitId === unit.unitId);
      if (rearGuard) {
        commendations.push(
          `${rearGuard.roleLabel}で追撃被害${rearGuard.pursuitDamagePrevented}抑止・後衛損耗${rearGuard.rearGuardCasualties}`,
        );
      }
      const enemyCommandEffect = enemyCommandEffectOutcomes.find((outcome) => outcome.unitIds.includes(unit.unitId));
      if (enemyCommandEffect) {
        commendations.push(`指揮網効果 ${enemyCommandEffect.resultLabel}`);
      }
      return [unit.unitId, commendations];
    }),
  );
  const officerUnitNamesById = Object.fromEntries(
    state.playerUnits.filter((unit) => unit.officerId).map((unit) => [unit.officerId, unit.name]),
  );
  const withdrawalRearGuardByUnit = Object.fromEntries(
    withdrawalRearGuardResult.entries.map((entry) => [entry.unitId, entry]),
  );
  const officerRiskById = Object.fromEntries(
    state.playerUnits
      .filter((unit) => unit.officerId)
      .map((unit) => [unit.officerId, officerRiskForUnit(unit, outcome, withdrawalRearGuardByUnit[unit.unitId])]),
  );
  const officerXpById = Object.fromEntries(
    state.playerUnits.filter((unit) => unit.officerId).map((unit) => [
      unit.officerId,
      officerXpForUnit(
        unit,
        outcome,
        battleRoleByUnit[unit.unitId] ?? "戦線固守",
        commendationsByUnit[unit.unitId] ?? [],
      ),
    ]),
  );
  const woundedOfficerIds = state.playerUnits
    .filter((unit) => unit.officerId)
    .filter((unit) =>
      officerWoundedForUnit(unit, outcome, officerRiskById[unit.officerId] ?? 0, withdrawalRearGuardByUnit[unit.unitId]),
    )
    .map((unit) => unit.officerId);
  const officerEvents = state.playerUnits
    .filter((unit) => unit.officerId)
    .map((unit) => {
      const officerId = unit.officerId;
      const role = battleRoleByUnit[unit.unitId] ?? "戦線勤務";
      const xp = officerXpById[officerId] ?? 1;
      const risk = officerRiskById[officerId] ?? 0;
      const wound = woundedOfficerIds.includes(officerId) ? "負傷、復帰まで2ターン" : "負傷なし";
      const rearGuard = withdrawalRearGuardByUnit[unit.unitId];
      const rearGuardText = rearGuard
        ? `、撤退後衛${rearGuard.riskLabel}、後衛損耗${rearGuard.rearGuardCasualties}`
        : "";
      return `${unit.name}指揮官: ${role}、指揮経験+${xp}、危険度${risk}${rearGuardText}、${wound}`;
    });
  const divisionCommanderResult = divisionCommanderSummaries(state, outcome, battleRoleByUnit);
  const structureDamage = Object.fromEntries(
    state.structures.map((structure) => [structure.id, structure.maxDurability - structure.durability]),
  );
  const capturedWeapons = capturedWeaponsFromBattle(state, outcome);
  const equipmentWearByUnit = Object.fromEntries(
    state.playerUnits.map((unit) => [unit.unitId, equipmentWearForUnit(unit, outcome)]),
  );
  const intelligenceAfterAction = misinformationAfterAction(state);
  const staffAdvisoryOutcomes = staffAdvisoryOutcomesForBattle(state);
  const objectiveOutcome = objectiveOutcomeForBattle(state);
  const staffAccountabilityEvents = staffAccountabilityEventsForBattle(state, outcome, objectiveOutcome, structureDamage);
  const baseSupplySpent = Math.ceil(
    (outcome === "hold" ? 24 : outcome === "withdraw" ? 16 : 32) * (strategicDoctrine?.supplySpendMultiplier ?? 1),
  );

  return {
    id: `result-${state.scenario.id}-${Date.now()}`,
    title: state.scenario.title,
    outcome,
    turnNumber,
    rawCasualtiesByUnit,
    casualtiesByUnit,
    recoveredByUnit,
    unitNamesById,
    xpByUnit,
    battleRoleByUnit,
    commendationsByUnit,
    withdrawalRearGuard: withdrawalRearGuardResult.entries,
    withdrawalRearGuardPlanAssessments: state.withdrawalRearGuardPlanAssessments ?? [],
    withdrawalPursuitSummary: withdrawalRearGuardResult.summary,
    officerEvents,
    divisionCommanderEvents: divisionCommanderResult.events,
    intelligenceEvents: intelligenceAfterAction.events,
    staffAccountabilityEvents,
    staffAdvisoryOutcomes,
    enemyCommandEffectOutcomes,
    objectiveEventResponseOutcomes,
    objectiveOutcome,
    officerXpById,
    divisionCommanderXpById: divisionCommanderResult.xpById,
    intelligenceLessonOfficerIds: intelligenceAfterAction.lessonOfficerIds,
    woundedOfficerIds,
    divisionCommanderWoundedOfficerIds: divisionCommanderResult.woundedIds,
    officerRiskById,
    divisionCommanderRiskById: divisionCommanderResult.riskById,
    officerUnitNamesById,
    divisionCommanderNamesById: divisionCommanderResult.namesById,
    ammoSpent: state.playerUnits.reduce((sum, unit) => sum + Math.max(0, 100 - unit.ammo), 0),
    supplySpent: Math.max(0, baseSupplySpent + objectiveOutcome.supplySpentDelta),
    medicalSupplySpent: Math.ceil(
      Object.values(recoveredByUnit).reduce((sum, recovered) => sum + Math.ceil(recovered / 14), 0) *
        (strategicDoctrine?.medicalSupplyCostMultiplier ?? 1),
    ),
    medicalRecoveryRate,
    medicalRecoveryDetails,
    capturedWeapons,
    equipmentWearByUnit,
    enemySuppression: Math.round(state.objectiveState.enemySuppression),
    structureDamage,
    campaignMessage:
      outcome === "hold"
        ? `${state.scenario.sectorName}は${state.elapsedSeconds}秒の防衛に成功した。`
        : outcome === "withdraw"
          ? `${state.scenario.sectorName}から戦闘撤退した。`
          : `${state.scenario.sectorName}はアンデッドの圧力で崩壊した。`,
  };
};
