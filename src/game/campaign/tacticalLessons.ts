import type { ArmyUnit } from "../army/types";
import type { FrontlineDoctrinePresetId } from "../battle/orders";
import type { ObjectiveEventResponseOutcome, StaffAdvisoryOutcome } from "../battle/types";

const countHistoryEntries = (history: string[], pattern: string): number =>
  history.filter((entry) => entry.includes(pattern)).length;

const doctrineLessonLabels: Record<FrontlineDoctrinePresetId, string> = {
  line_hold: "戦線固守",
  elastic_refuse: "弾性拒止",
  kill_zone: "殺傷地帯",
  ammo_delay: "遅滞節約",
  engineer_repair: "工兵修理線",
};

const doctrineLessonPatterns: Record<FrontlineDoctrinePresetId, string[]> = {
  line_hold: ["戦線固守"],
  elastic_refuse: ["弾性拒止"],
  kill_zone: ["殺傷地帯"],
  ammo_delay: ["遅滞節約"],
  engineer_repair: ["工兵修理線"],
};

export interface TacticalLessonProfile {
  advisoryCount: number;
  failedAdvisoryCount: number;
  heldAdvisoryCount: number;
  enemyCommandNodeFireCount: number;
  enemyCollapsePursuitCount: number;
  enemyCommandReserveCount: number;
  enemyCommandActionCount: number;
  objectiveEventResponseCount: number;
  objectiveEventRecoveredCount: number;
  objectiveEventDelayedCount: number;
  objectiveEventFailedCount: number;
  facilityDefenseCount: number;
  facilityRepairCount: number;
  facilityResupplyCount: number;
  facilityDutyCount: number;
  doctrineLessonCounts: Record<FrontlineDoctrinePresetId, number>;
  preferredDoctrineId?: FrontlineDoctrinePresetId;
  preferredDoctrineLabel?: string;
  reserveReadinessBonus: number;
  controlRadiusBonus: number;
  fallbackMoraleModifier: number;
  summary: string;
}

const doctrineLessonCountsForHistory = (history: string[]): Record<FrontlineDoctrinePresetId, number> =>
  Object.fromEntries(
    Object.entries(doctrineLessonPatterns).map(([doctrineId, patterns]) => [
      doctrineId,
      history.filter((entry) => entry.includes("参謀警告対応") && patterns.some((pattern) => entry.includes(pattern))).length,
    ]),
  ) as Record<FrontlineDoctrinePresetId, number>;

const preferredDoctrineFromCounts = (
  counts: Record<FrontlineDoctrinePresetId, number>,
): FrontlineDoctrinePresetId | undefined => {
  const [best] = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  return best?.[0] as FrontlineDoctrinePresetId | undefined;
};

const enemyCommandDoctrinePreference = (profile: {
  enemyCommandNodeFireCount: number;
  enemyCollapsePursuitCount: number;
  enemyCommandReserveCount: number;
}): FrontlineDoctrinePresetId | undefined => {
  // Enemy command-action lessons reuse the closest existing frontline doctrines.
  if (
    profile.enemyCommandNodeFireCount >= profile.enemyCollapsePursuitCount &&
    profile.enemyCommandNodeFireCount >= profile.enemyCommandReserveCount &&
    profile.enemyCommandNodeFireCount > 0
  ) {
    return "ammo_delay";
  }
  if (profile.enemyCollapsePursuitCount > 0 && profile.enemyCollapsePursuitCount >= profile.enemyCommandReserveCount) {
    return "kill_zone";
  }
  if (profile.enemyCommandReserveCount > 0) {
    return "elastic_refuse";
  }
  return undefined;
};

const objectiveEventDoctrinePreference = (history: string[]): FrontlineDoctrinePresetId | undefined => {
  const objectiveEntries = history.filter((entry) => entry.includes("目標イベント対応"));
  if (objectiveEntries.length === 0) {
    return undefined;
  }
  const victoryCount = objectiveEntries.filter((entry) => entry.includes("勝利地点")).length;
  const supplyCount = objectiveEntries.filter((entry) => entry.includes("補給地点")).length;
  const visibilityCount = objectiveEntries.filter((entry) => entry.includes("視界地点")).length;
  const recoveredCount = objectiveEntries.filter((entry) => entry.includes("再確保")).length;
  const failedCount = objectiveEntries.filter((entry) => entry.includes("未回復")).length;
  const timingOrAmmoLessonCount = objectiveEntries.filter(
    (entry) => entry.includes("到着遅延") || entry.includes("弾薬不足") || entry.includes("弾薬限界"),
  ).length;
  const forceOrMoraleLessonCount = objectiveEntries.filter(
    (entry) => entry.includes("士気不足") || entry.includes("兵力不足"),
  ).length;

  if (supplyCount >= victoryCount && supplyCount >= visibilityCount && supplyCount > 0) {
    return "engineer_repair";
  }
  if (timingOrAmmoLessonCount > 0 && timingOrAmmoLessonCount >= forceOrMoraleLessonCount) {
    return "ammo_delay";
  }
  if (forceOrMoraleLessonCount > 0) {
    return "elastic_refuse";
  }
  if (visibilityCount > 0 && visibilityCount >= victoryCount) {
    return failedCount > recoveredCount ? "ammo_delay" : "kill_zone";
  }
  if (victoryCount > 0) {
    return failedCount > recoveredCount ? "elastic_refuse" : "line_hold";
  }
  return undefined;
};

const facilityDutyDoctrinePreference = (profile: {
  facilityDefenseCount: number;
  facilityRepairCount: number;
  facilityResupplyCount: number;
}): FrontlineDoctrinePresetId | undefined => {
  if (profile.facilityRepairCount > 0 || profile.facilityResupplyCount > 0) {
    return "engineer_repair";
  }
  if (profile.facilityDefenseCount > 0) {
    return "line_hold";
  }
  return undefined;
};

export const tacticalLessonProfileForUnit = (unit: ArmyUnit): TacticalLessonProfile => {
  const advisoryCount = countHistoryEntries(unit.battleHistory, "参謀警告対応");
  const failedAdvisoryCount = countHistoryEntries(unit.battleHistory, "対応及ばず");
  const heldAdvisoryCount = countHistoryEntries(unit.battleHistory, "戦線維持に寄与");
  const withdrawalSupportCount = countHistoryEntries(unit.battleHistory, "撤退支援");
  const enemyCommandNodeFireCount = countHistoryEntries(unit.battleHistory, "敵指揮核制圧");
  const enemyCollapsePursuitCount = countHistoryEntries(unit.battleHistory, "敵崩壊追撃");
  const enemyCommandReserveCount = countHistoryEntries(unit.battleHistory, "指揮網予備投入");
  const enemyCommandActionCount = enemyCommandNodeFireCount + enemyCollapsePursuitCount + enemyCommandReserveCount;
  const objectiveEventResponseCount = countHistoryEntries(unit.battleHistory, "目標イベント対応");
  const objectiveEventRecoveredCount = unit.battleHistory.filter(
    (entry) => entry.includes("目標イベント対応") && entry.includes("再確保"),
  ).length;
  const objectiveEventDelayedCount = unit.battleHistory.filter(
    (entry) => entry.includes("目標イベント対応") && entry.includes("遅滞"),
  ).length;
  const objectiveEventFailedCount = unit.battleHistory.filter(
    (entry) => entry.includes("目標イベント対応") && entry.includes("未回復"),
  ).length;
  const facilityDefenseCount = countHistoryEntries(unit.battleHistory, "施設防衛");
  const facilityRepairCount = countHistoryEntries(unit.battleHistory, "施設修理");
  const facilityResupplyCount = countHistoryEntries(unit.battleHistory, "補給拠点勤務");
  const facilityDutyCount = facilityDefenseCount + facilityRepairCount + facilityResupplyCount;
  const doctrineLessonCounts = doctrineLessonCountsForHistory(unit.battleHistory);
  const preferredDoctrineId =
    preferredDoctrineFromCounts(doctrineLessonCounts) ??
    enemyCommandDoctrinePreference({
      enemyCommandNodeFireCount,
      enemyCollapsePursuitCount,
      enemyCommandReserveCount,
    }) ??
    objectiveEventDoctrinePreference(unit.battleHistory) ??
    facilityDutyDoctrinePreference({ facilityDefenseCount, facilityRepairCount, facilityResupplyCount });
  const preferredDoctrineLabel = preferredDoctrineId ? doctrineLessonLabels[preferredDoctrineId] : undefined;
  const reserveReadinessBonus = Math.min(
    14,
    advisoryCount * 3 +
      heldAdvisoryCount * 2 +
      withdrawalSupportCount +
      enemyCommandReserveCount * 5 +
      enemyCommandActionCount +
      objectiveEventResponseCount * 2 +
      facilityDutyCount,
  );
  const controlRadiusBonus = Math.min(
    6,
    advisoryCount +
      heldAdvisoryCount +
      enemyCommandNodeFireCount * 2 +
      enemyCollapsePursuitCount +
      objectiveEventRecoveredCount +
      facilityDefenseCount +
      facilityRepairCount,
  );
  const fallbackMoraleModifier = Math.min(
    9,
    failedAdvisoryCount * 3 +
      withdrawalSupportCount * 2 +
      enemyCommandReserveCount * 2 +
      objectiveEventFailedCount * 2 +
      objectiveEventDelayedCount +
      facilityRepairCount,
  );
  const lessonParts = [
    advisoryCount > 0 ? `参謀警告${advisoryCount}件` : undefined,
    enemyCommandNodeFireCount > 0 ? `敵指揮核制圧${enemyCommandNodeFireCount}件` : undefined,
    enemyCollapsePursuitCount > 0 ? `敵崩壊追撃${enemyCollapsePursuitCount}件` : undefined,
    enemyCommandReserveCount > 0 ? `指揮網予備投入${enemyCommandReserveCount}件` : undefined,
    objectiveEventResponseCount > 0 ? `目標イベント対応${objectiveEventResponseCount}件` : undefined,
    facilityDutyCount > 0 ? `施設任務${facilityDutyCount}件` : undefined,
  ].filter(Boolean);
  const summary =
    lessonParts.length > 0
      ? `戦術教訓 ${lessonParts.join(" / ")}${preferredDoctrineLabel ? ` / 得意${preferredDoctrineLabel}` : ""} / 即応+${reserveReadinessBonus} / 統制+${controlRadiusBonus}${
          fallbackMoraleModifier > 0 ? ` / 後退判断+${fallbackMoraleModifier}` : ""
        }`
      : "戦術教訓なし";

  return {
    advisoryCount,
    failedAdvisoryCount,
    heldAdvisoryCount,
    enemyCommandNodeFireCount,
    enemyCollapsePursuitCount,
    enemyCommandReserveCount,
    enemyCommandActionCount,
    objectiveEventResponseCount,
    objectiveEventRecoveredCount,
    objectiveEventDelayedCount,
    objectiveEventFailedCount,
    facilityDefenseCount,
    facilityRepairCount,
    facilityResupplyCount,
    facilityDutyCount,
    doctrineLessonCounts,
    preferredDoctrineId,
    preferredDoctrineLabel,
    reserveReadinessBonus,
    controlRadiusBonus,
    fallbackMoraleModifier,
    summary,
  };
};

export const tacticalLessonPreviewForObjectiveEventOutcomes = (
  outcomes: ObjectiveEventResponseOutcome[],
  unitId: string,
): string | undefined => {
  const unitOutcomes = outcomes.filter((outcome) => outcome.unitId === unitId);
  if (unitOutcomes.length === 0) {
    return undefined;
  }
  const recoveredCount = unitOutcomes.filter((outcome) => outcome.resultLabel === "再確保").length;
  const delayedCount = unitOutcomes.filter((outcome) => outcome.resultLabel === "遅滞").length;
  const reserveReadinessBonus = Math.min(8, unitOutcomes.length * 2 + recoveredCount * 2 + delayedCount);
  const controlRadiusBonus = Math.min(4, recoveredCount * 2 + delayedCount);
  return `次戦教訓 目標イベント対応${unitOutcomes.length}件 / 即応+${reserveReadinessBonus}${
    controlRadiusBonus > 0 ? ` / 統制+${controlRadiusBonus}` : ""
  }`;
};

export const tacticalLessonPreviewForFacilityDuties = (
  battleRoleByUnit: Record<string, string>,
  commendationsByUnit: Record<string, string[]>,
  unitId: string,
): string | undefined => {
  const role = battleRoleByUnit[unitId];
  if (role !== "施設防衛" && role !== "施設修理" && role !== "補給拠点勤務") {
    return undefined;
  }
  const commendations = commendationsByUnit[unitId] ?? [];
  const preferredDoctrineLabel = role === "施設修理" || role === "補給拠点勤務" ? "工兵修理線" : "戦線固守";
  const reserveReadinessBonus = role === "施設防衛" ? 2 : 1;
  const controlRadiusBonus = role === "施設防衛" || role === "施設修理" ? 1 : 0;
  const fallbackMoraleModifier = role === "施設修理" ? 1 : 0;
  const reason =
    role === "施設防衛"
      ? commendations.includes("施設襲撃群を指名")
        ? "施設襲撃対応"
        : "施設防衛"
      : role === "施設修理"
        ? "損傷施設修理"
        : "補給拠点維持";
  return `次戦教訓 ${reason} / 得意${preferredDoctrineLabel} / 即応+${reserveReadinessBonus}${
    controlRadiusBonus > 0 ? ` / 統制+${controlRadiusBonus}` : ""
  }${fallbackMoraleModifier > 0 ? ` / 後退判断+${fallbackMoraleModifier}` : ""}`;
};

export const tacticalLessonPreviewForStaffOutcomes = (
  outcomes: StaffAdvisoryOutcome[],
  unitId: string,
): string | undefined => {
  const unitOutcomes = outcomes.filter((outcome) => outcome.unitIds.includes(unitId));
  if (unitOutcomes.length === 0) {
    return undefined;
  }
  const failedAdvisoryCount = unitOutcomes.filter((outcome) => outcome.resultLabel === "対応及ばず").length;
  const heldAdvisoryCount = unitOutcomes.filter((outcome) => outcome.resultLabel === "戦線維持に寄与").length;
  const withdrawalSupportCount = unitOutcomes.filter((outcome) => outcome.resultLabel === "撤退支援").length;
  const preferredDoctrineLabel = unitOutcomes
    .map((outcome) => outcome.presetLabel)
    .sort((a, b) => {
      const bCount = unitOutcomes.filter((outcome) => outcome.presetLabel === b).length;
      const aCount = unitOutcomes.filter((outcome) => outcome.presetLabel === a).length;
      return bCount - aCount;
    })[0];
  const reserveReadinessBonus = Math.min(12, unitOutcomes.length * 3 + heldAdvisoryCount * 2 + withdrawalSupportCount);
  const controlRadiusBonus = Math.min(5, unitOutcomes.length + heldAdvisoryCount);
  const fallbackMoraleModifier = Math.min(8, failedAdvisoryCount * 3 + withdrawalSupportCount * 2);
  return `次戦教訓 参謀警告${unitOutcomes.length}件 / 得意${preferredDoctrineLabel} / 即応+${reserveReadinessBonus} / 統制+${controlRadiusBonus}${
    fallbackMoraleModifier > 0 ? ` / 後退判断+${fallbackMoraleModifier}` : ""
  }`;
};
