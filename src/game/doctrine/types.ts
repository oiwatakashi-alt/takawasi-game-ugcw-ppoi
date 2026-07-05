export type StaffIntelligenceDirectiveMode =
  | "balanced"
  | "enemy_analysis"
  | "counter_intelligence"
  | "logistics_recon"
  | "engineer_survey";

export interface DoctrineState {
  unlocked: string[];
  points: number;
  staffIntelligenceDirective?: StaffIntelligenceDirectiveMode;
}

export interface StaffIntelligenceDirectiveProfile {
  mode: StaffIntelligenceDirectiveMode;
  label: string;
  summary: string;
  autoResolveQualityBonus: number;
  strategicIntelPreparationBonus: number;
  initialIntelConfidenceShiftBonus: number;
  supplySpendMultiplier: number;
  engineeringCostMultiplier: number;
  repairAmountBonus: number;
}

export interface FireDisciplineProfile {
  id: string;
  label: string;
  summary: string;
  activeDoctrineIds: string[];
  durationBonusSeconds: number;
  cooldownReductionSeconds: number;
  fireMultiplierBonus: number;
  ammoCostMultiplier: number;
  conditionCostMultiplier: number;
  plannedStageSpacingSeconds: number;
  maxPlannedStages: number;
}

export interface StrategicDoctrineProfile {
  id: string;
  label: string;
  summary: string;
  activeDoctrineIds: string[];
  deploymentSlotBonus: number;
  replenishmentDilutionMultiplier: number;
  veteranReplenishmentGoldMultiplier: number;
  engineeringCostMultiplier: number;
  repairAmountBonus: number;
  fortificationEffectMultiplier: number;
  supplySpendMultiplier: number;
  medicalRecoveryBonus: number;
  medicalSupplyCostMultiplier: number;
  autoResolveQualityBonus: number;
  strategicIntelPreparationBonus: number;
  initialIntelConfidenceShiftBonus: number;
}
