import type {
  DoctrineState,
  FireDisciplineProfile,
  StaffIntelligenceDirectiveMode,
  StaffIntelligenceDirectiveProfile,
  StrategicDoctrineProfile,
} from "./types";

export const hasDoctrine = (doctrine: DoctrineState, id: string): boolean => doctrine.unlocked.includes(id);

export const defaultStaffIntelligenceDirectiveMode: StaffIntelligenceDirectiveMode = "balanced";

export const staffIntelligenceDirectiveLabels: Record<StaffIntelligenceDirectiveMode, string> = {
  balanced: "標準参謀整理",
  enemy_analysis: "敵情分析",
  counter_intelligence: "防諜警戒",
  logistics_recon: "兵站偵察",
  engineer_survey: "工兵測量",
};

export const staffIntelligenceDirectiveProfiles: Record<
  StaffIntelligenceDirectiveMode,
  StaffIntelligenceDirectiveProfile
> = {
  balanced: {
    mode: "balanced",
    label: "標準参謀整理",
    summary: "全般を均等に整理し、既存の参謀支援をそのまま使う。",
    autoResolveQualityBonus: 0,
    strategicIntelPreparationBonus: 0,
    initialIntelConfidenceShiftBonus: 0,
    supplySpendMultiplier: 1,
    engineeringCostMultiplier: 1,
    repairAmountBonus: 0,
  },
  enemy_analysis: {
    mode: "enemy_analysis",
    label: "敵情分析",
    summary: "敵編成と敵波予測を優先する。次ターン初期敵情が読みやすくなる。",
    autoResolveQualityBonus: 2,
    strategicIntelPreparationBonus: 4,
    initialIntelConfidenceShiftBonus: 1,
    supplySpendMultiplier: 1,
    engineeringCostMultiplier: 1,
    repairAmountBonus: 0,
  },
  counter_intelligence: {
    mode: "counter_intelligence",
    label: "防諜警戒",
    summary: "偽情報対策を優先する。教訓整理を厚くし、小任務判断も少し安定する。",
    autoResolveQualityBonus: 2,
    strategicIntelPreparationBonus: 6,
    initialIntelConfidenceShiftBonus: 0,
    supplySpendMultiplier: 1,
    engineeringCostMultiplier: 1,
    repairAmountBonus: 0,
  },
  logistics_recon: {
    mode: "logistics_recon",
    label: "兵站偵察",
    summary: "補給路と敵物資集積を優先して読む。小任務と戦闘補給に効く。",
    autoResolveQualityBonus: 3,
    strategicIntelPreparationBonus: 2,
    initialIntelConfidenceShiftBonus: 0,
    supplySpendMultiplier: 0.96,
    engineeringCostMultiplier: 1,
    repairAmountBonus: 0,
  },
  engineer_survey: {
    mode: "engineer_survey",
    label: "工兵測量",
    summary: "地形と陣地予定地の測量を優先する。築城費用と修理に効く。",
    autoResolveQualityBonus: 1,
    strategicIntelPreparationBonus: 2,
    initialIntelConfidenceShiftBonus: 0,
    supplySpendMultiplier: 1,
    engineeringCostMultiplier: 0.95,
    repairAmountBonus: 5,
  },
};

export const staffIntelligenceDirectiveFromDoctrine = (
  doctrine: DoctrineState,
): StaffIntelligenceDirectiveProfile => {
  const mode = doctrine.staffIntelligenceDirective ?? defaultStaffIntelligenceDirectiveMode;
  return staffIntelligenceDirectiveProfiles[mode] ?? staffIntelligenceDirectiveProfiles[defaultStaffIntelligenceDirectiveMode];
};

export const defaultFireDisciplineProfile: FireDisciplineProfile = {
  id: "improvised",
  label: "即席火力規律",
  summary: "各旅団が現場判断で斉射する。火力計画は短く、再装填の混乱も残る。",
  activeDoctrineIds: [],
  durationBonusSeconds: 0,
  cooldownReductionSeconds: 0,
  fireMultiplierBonus: 0,
  ammoCostMultiplier: 1,
  conditionCostMultiplier: 1,
  plannedStageSpacingSeconds: 9,
  maxPlannedStages: 3,
};

export const fireDisciplineWithDefaults = (
  profile?: Partial<FireDisciplineProfile>,
): FireDisciplineProfile => ({
  ...defaultFireDisciplineProfile,
  ...(profile ?? {}),
  activeDoctrineIds: profile?.activeDoctrineIds ?? defaultFireDisciplineProfile.activeDoctrineIds,
});

export const fireDisciplineFromDoctrine = (doctrine: DoctrineState): FireDisciplineProfile => {
  const hasCommand = hasDoctrine(doctrine, "command");
  const hasLogistics = hasDoctrine(doctrine, "logistics");
  const hasTraining = hasDoctrine(doctrine, "training");
  const activeDoctrineIds = ["command", "logistics", "training"].filter((id) => hasDoctrine(doctrine, id));

  if (activeDoctrineIds.length === 0) {
    return defaultFireDisciplineProfile;
  }

  const label =
    hasCommand && hasLogistics && hasTraining
      ? "統合火力規律"
      : hasCommand && hasLogistics
        ? "参謀統制射撃"
        : hasCommand
          ? "軍団斉射規律"
          : hasLogistics
            ? "節約火力規律"
            : "訓練射撃規律";

  const summaryParts = [
    hasCommand ? "斉射時間+2秒/再装填-4秒/計画間隔短縮" : undefined,
    hasLogistics ? "弾薬消費14%軽減/4段計画許可" : undefined,
    hasTraining ? "射撃効率+4%/疲労負荷軽減" : undefined,
  ].filter(Boolean);

  return {
    id: activeDoctrineIds.join("-"),
    label,
    summary: summaryParts.join("、"),
    activeDoctrineIds,
    durationBonusSeconds: hasCommand ? 2 : 0,
    cooldownReductionSeconds: hasCommand ? 4 : 0,
    fireMultiplierBonus: hasTraining ? 0.04 : 0,
    ammoCostMultiplier: hasLogistics ? 0.86 : 1,
    conditionCostMultiplier: hasCommand || hasTraining ? 0.86 : 1,
    plannedStageSpacingSeconds: hasCommand ? 7 : 9,
    maxPlannedStages: hasLogistics ? 4 : 3,
  };
};

export const defaultStrategicDoctrineProfile: StrategicDoctrineProfile = {
  id: "field-expedient",
  label: "現地裁量の戦役運用",
  summary: "参謀方針は火力統制を中心に働き、築城・兵站・医療は標準手順で処理する。",
  activeDoctrineIds: [],
  deploymentSlotBonus: 0,
  replenishmentDilutionMultiplier: 1,
  veteranReplenishmentGoldMultiplier: 1,
  engineeringCostMultiplier: 1,
  repairAmountBonus: 0,
  fortificationEffectMultiplier: 1,
  supplySpendMultiplier: 1,
  medicalRecoveryBonus: 0,
  medicalSupplyCostMultiplier: 1,
  autoResolveQualityBonus: 0,
  strategicIntelPreparationBonus: 0,
  initialIntelConfidenceShiftBonus: 0,
};

export const strategicDoctrineWithDefaults = (
  profile?: Partial<StrategicDoctrineProfile>,
): StrategicDoctrineProfile => ({
  ...defaultStrategicDoctrineProfile,
  ...(profile ?? {}),
  activeDoctrineIds: profile?.activeDoctrineIds ?? defaultStrategicDoctrineProfile.activeDoctrineIds,
});

export const strategicDoctrineFromDoctrine = (doctrine: DoctrineState): StrategicDoctrineProfile => {
  const hasCommand = hasDoctrine(doctrine, "command");
  const hasOrganization = hasDoctrine(doctrine, "organization");
  const hasTraining = hasDoctrine(doctrine, "training");
  const hasLogistics = hasDoctrine(doctrine, "logistics");
  const hasEngineering = hasDoctrine(doctrine, "engineering");
  const hasMedicine = hasDoctrine(doctrine, "medicine");
  const hasIntelligence = hasDoctrine(doctrine, "intelligence");
  const staffDirective = staffIntelligenceDirectiveFromDoctrine(doctrine);
  const activeDoctrineIds = [
    "command",
    "organization",
    "training",
    "logistics",
    "engineering",
    "medicine",
    "intelligence",
  ].filter((id) => hasDoctrine(doctrine, id));

  if (activeDoctrineIds.length === 0) {
    return defaultStrategicDoctrineProfile;
  }

  const summaryParts = [
    hasOrganization ? "出撃枠+1" : undefined,
    hasTraining ? "新兵補充の練度低下25%軽減/自動解決+6" : undefined,
    hasLogistics ? "戦闘補給消費14%軽減/古参補充費10%軽減" : undefined,
    hasEngineering ? "築城修理費15%軽減/修理+15/陣地効果+12%" : undefined,
    hasMedicine ? "戦後収容+6%/医療補給20%軽減" : undefined,
    hasCommand ? "小任務判断+6" : undefined,
    hasIntelligence ? "敵情分析+1/偵察教訓+6/偵察任務+4" : undefined,
    staffDirective.mode !== "balanced" ? `参謀任務:${staffDirective.label}` : undefined,
  ].filter(Boolean);

  return {
    id: activeDoctrineIds.join("-"),
    label:
      activeDoctrineIds.length >= 4
        ? "統合参謀運用"
        : hasIntelligence
          ? "敵情分析運用"
          : hasEngineering
            ? "野戦築城運用"
            : "参謀支援運用",
    summary: summaryParts.join("、"),
    activeDoctrineIds,
    deploymentSlotBonus: hasOrganization ? 1 : 0,
    replenishmentDilutionMultiplier: hasTraining ? 0.75 : 1,
    veteranReplenishmentGoldMultiplier: hasLogistics ? 0.9 : 1,
    engineeringCostMultiplier: (hasEngineering ? 0.85 : 1) * staffDirective.engineeringCostMultiplier,
    repairAmountBonus: (hasEngineering ? 15 : 0) + staffDirective.repairAmountBonus,
    fortificationEffectMultiplier: hasEngineering ? 1.12 : 1,
    supplySpendMultiplier: (hasLogistics ? 0.86 : 1) * staffDirective.supplySpendMultiplier,
    medicalRecoveryBonus: hasMedicine ? 0.06 : 0,
    medicalSupplyCostMultiplier: hasMedicine ? 0.8 : 1,
    autoResolveQualityBonus:
      (hasCommand ? 6 : 0) +
      (hasTraining ? 6 : 0) +
      (hasIntelligence ? 4 : 0) +
      staffDirective.autoResolveQualityBonus,
    strategicIntelPreparationBonus: (hasIntelligence ? 6 : 0) + staffDirective.strategicIntelPreparationBonus,
    initialIntelConfidenceShiftBonus:
      (hasIntelligence ? 1 : 0) + staffDirective.initialIntelConfidenceShiftBonus,
  };
};
