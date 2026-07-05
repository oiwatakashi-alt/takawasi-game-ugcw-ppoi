import type { ArmyUnit } from "../army/types";
import type { CampaignState } from "../campaign/types";
import type { Officer, OfficerRank } from "../officers/types";
import type { StrategicOperation } from "./types";

const rankReconBonus: Record<OfficerRank, number> = {
  Captain: 4,
  Major: 8,
  Colonel: 12,
  General: 16,
};

export interface ReconQualityBreakdown {
  score: number;
  label: string;
  unitScore: number;
  officerScore: number;
  doctrineBonus: number;
  unitLessonBonus: number;
  officerLessonBonus: number;
  lessonSummary: string[];
}

export interface StrategicIntelPreparation {
  confidenceShift: 0 | 1 | 2;
  lessonScore: number;
  summary: string;
}

const countLessonEntries = (history: string[], patterns: string[]): number =>
  history.filter((entry) => patterns.some((pattern) => entry.includes(pattern))).length;

const unitLessonBonus = (unit: ArmyUnit) => {
  const badIntelExperience = countLessonEntries(unit.battleHistory, ["敵情誤認下"]);
  return Math.min(8, badIntelExperience * 4);
};

const officerLessonBonus = (officer: Officer) => {
  const lessonCount = countLessonEntries(officer.history, ["偵察教訓", "敵情誤認対応"]);
  return Math.min(12, lessonCount * 6);
};

export const calculateStrategicIntelPreparation = (
  units: ArmyUnit[],
  officers: Officer[],
  lessonScoreBonus = 0,
  confidenceShiftBonus = 0,
): StrategicIntelPreparation => {
  const unitLessonScore = units.reduce((sum, unit) => {
    const lessonCount = countLessonEntries(unit.battleHistory, ["敵情誤認下"]);
    const branchWeight = unit.type === "jaeger" ? 3 : unit.type === "engineer" ? 2 : unit.type === "infantry" ? 1 : 0;
    return sum + Math.min(6, lessonCount * branchWeight);
  }, 0);
  const officerLessonScore = officers.reduce((sum, officer) => {
    const lessonCount = countLessonEntries(officer.history, ["偵察教訓", "敵情誤認対応"]);
    return sum + Math.min(8, lessonCount * 4);
  }, 0);
  const recordedLessonScore = unitLessonScore + officerLessonScore;
  const lessonScore = Math.min(24, recordedLessonScore + lessonScoreBonus);
  const rawConfidenceShift = (lessonScore >= 14 ? 2 : lessonScore >= 4 ? 1 : 0) + confidenceShiftBonus;
  const confidenceShift = Math.min(2, rawConfidenceShift) as StrategicIntelPreparation["confidenceShift"];
  const sourceLabel =
    recordedLessonScore > 0
      ? "過去の敵情誤認教訓を参謀部が整理"
      : lessonScoreBonus > 0 || confidenceShiftBonus > 0
        ? "敵情分析班が戦区情報を整理"
        : "敵情誤認教訓なし";
  return {
    confidenceShift,
    lessonScore,
    summary:
      confidenceShift > 0
        ? `${sourceLabel}。初期敵情+${confidenceShift}、教訓値${lessonScore}。`
        : "敵情誤認教訓なし。初期敵情補正なし。",
  };
};

const unitReconScore = (unit: ArmyUnit) => {
  const branchBonus = unit.type === "jaeger" ? 16 : unit.type === "engineer" ? 7 : unit.type === "infantry" ? 2 : -4;
  return unit.experience * 0.55 + unit.morale * 0.2 + unit.condition * 0.2 + branchBonus + unitLessonBonus(unit);
};

const officerReconScore = (officer: Officer) => {
  return officer.experience * 0.45 + rankReconBonus[officer.rank] + officerLessonBonus(officer);
};

export const reconQualityLabel = (score: number) => (score >= 82 ? "精密偵察" : score >= 64 ? "堅実偵察" : "粗い偵察");

export const calculateReconQualityBreakdownForces = (
  units: ArmyUnit[],
  officers: Officer[],
  strategicDoctrineBonus: number,
): ReconQualityBreakdown => {
  const unitScore = units.reduce((sum, unit) => sum + unitReconScore(unit), 0) / Math.max(1, units.length);
  const officerScore =
    officers.reduce((sum, officer) => sum + officerReconScore(officer), 0) / Math.max(1, officers.length);
  const totalUnitLessonBonus =
    units.reduce((sum, unit) => sum + unitLessonBonus(unit), 0) / Math.max(1, units.length);
  const totalOfficerLessonBonus =
    officers.reduce((sum, officer) => sum + officerLessonBonus(officer), 0) / Math.max(1, officers.length);
  const score = Math.max(20, Math.min(100, Math.round(unitScore + officerScore + strategicDoctrineBonus)));
  const lessonSummary = [
    totalUnitLessonBonus > 0 ? `部隊教訓+${Math.round(totalUnitLessonBonus)}` : undefined,
    totalOfficerLessonBonus > 0 ? `将校教訓+${Math.round(totalOfficerLessonBonus)}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    score,
    label: reconQualityLabel(score),
    unitScore: Math.round(unitScore),
    officerScore: Math.round(officerScore),
    doctrineBonus: strategicDoctrineBonus,
    unitLessonBonus: Math.round(totalUnitLessonBonus),
    officerLessonBonus: Math.round(totalOfficerLessonBonus),
    lessonSummary,
  };
};

export const calculateReconQualityForces = (
  units: ArmyUnit[],
  officers: Officer[],
  strategicDoctrineBonus: number,
): number => {
  return calculateReconQualityBreakdownForces(units, officers, strategicDoctrineBonus).score;
};

export const calculateReconQualityBreakdown = (
  campaign: CampaignState,
  operation: StrategicOperation,
  strategicDoctrineBonus: number,
): ReconQualityBreakdown => {
  const units = campaign.army.units.filter((unit) => operation.assignedForces.unitIds.includes(unit.id));
  const officers = campaign.officers.filter((officer) => operation.assignedForces.officerIds.includes(officer.id));
  return calculateReconQualityBreakdownForces(units, officers, strategicDoctrineBonus);
};

export const calculateReconQuality = (
  campaign: CampaignState,
  operation: StrategicOperation,
  strategicDoctrineBonus: number,
): number => {
  return calculateReconQualityBreakdown(campaign, operation, strategicDoctrineBonus).score;
};
