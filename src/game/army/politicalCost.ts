import type { ResourceBundle } from "../logistics/types";
import type { Officer } from "../officers/types";
import type { StaffIntelligenceDirectiveMode } from "../doctrine/types";
import {
  assignDivisionCommander,
  divisionCommandProfile,
  divisionCommandSummaryForOfficer,
  normalizeArmyDivisions,
} from "./divisions";
import {
  armyHeadquartersProfile,
  assignArmyStaffOfficer,
  normalizeStaffAssignments,
  staffDutySummaryForOfficer,
  staffSlotDefinitions,
} from "./headquarters";
import { enemyCompositionLabel, riskPercentValue, type EnemyCompositionThreat, type EnemyCompositionThreatType } from "../theater/enemyIntel";
import type { ArmyDivision, ArmyState, StaffSlotId } from "./types";

export interface PoliticalCostEstimate {
  reputationCost: number;
  canPay: boolean;
  summary: string;
}

export interface CommandReplacementRecommendation {
  id: string;
  targetId: string;
  officerId: string;
  officerName: string;
  currentSummary: string;
  projectedSummary: string;
  accountabilitySummary?: string;
  reputationCost: number;
  improvement: number;
  netScore: number;
  reason: string;
  contextSummary: string;
}

export interface CommandRecommendationContext {
  sectorName: string;
  terrainTags: string[];
  enemyPressure: number;
  risk: number;
  structureCount: number;
  enemyThreats: EnemyCompositionThreat[];
  staffDirectiveMode?: StaffIntelligenceDirectiveMode;
  staffDirectiveLabel?: string;
}

const estimate = (resources: ResourceBundle, reputationCost: number, summary: string): PoliticalCostEstimate => ({
  reputationCost,
  canPay: resources.reputation >= reputationCost,
  summary,
});

const isLineCommander = (officer: Officer | undefined): boolean => Boolean(officer?.assignedUnitId);

const slotLabel = (slotId: StaffSlotId): string =>
  staffSlotDefinitions.find((slot) => slot.id === slotId)?.label ?? "参謀";

export const estimateStaffAssignmentPoliticalCost = (
  army: ArmyState,
  officers: Officer[],
  resources: ResourceBundle,
  slotId: StaffSlotId,
  officerId?: string,
): PoliticalCostEstimate => {
  const assignments = normalizeStaffAssignments(army.formations[0]?.staffAssignments);
  const current = assignments.find((assignment) => assignment.slotId === slotId);
  if ((current?.officerId ?? "") === (officerId ?? "")) {
    return estimate(resources, 0, "配置変更なし");
  }

  if (!officerId) {
    return estimate(resources, current?.officerId ? 1 : 0, `${slotLabel(slotId)}の任命解除`);
  }

  const officer = officers.find((candidate) => candidate.id === officerId);
  const baseCost = slotId === "chiefOfStaff" ? 3 : 2;
  const replacingCost = current?.officerId ? 1 : 0;
  const oldStaffCost = staffDutySummaryForOfficer(army, officerId) ? 1 : 0;
  const lineCommandCost = isLineCommander(officer) ? 1 : 0;
  const divisionCost = divisionCommandSummaryForOfficer(army, officerId) ? 1 : 0;
  const reputationCost = baseCost + replacingCost + oldStaffCost + lineCommandCost + divisionCost;
  return estimate(resources, reputationCost, `${officer?.name ?? "将校"}を${slotLabel(slotId)}へ任命`);
};

export const estimateDivisionCommanderPoliticalCost = (
  army: ArmyState,
  officers: Officer[],
  resources: ResourceBundle,
  divisionId: string,
  officerId?: string,
): PoliticalCostEstimate => {
  const divisions = normalizeArmyDivisions(army.units, army.formations[0]?.divisions);
  const division = divisions.find((candidate) => candidate.id === divisionId);
  if (!division || division.locked) {
    return estimate(resources, 0, "師団長変更不可");
  }
  if ((division.commanderOfficerId ?? "") === (officerId ?? "")) {
    return estimate(resources, 0, "配置変更なし");
  }

  if (!officerId) {
    return estimate(resources, division.commanderOfficerId ? 1 : 0, `${division.name}師団長の任命解除`);
  }

  const officer = officers.find((candidate) => candidate.id === officerId);
  const currentlyCommandsOtherDivision = divisions.some(
    (candidate) => candidate.id !== divisionId && candidate.commanderOfficerId === officerId,
  );
  const replacingCost = division.commanderOfficerId ? 1 : 0;
  const lineCommandCost = isLineCommander(officer) ? 1 : 0;
  const staffCost = staffDutySummaryForOfficer(army, officerId) ? 1 : 0;
  const transferCost = currentlyCommandsOtherDivision ? 1 : 0;
  const reputationCost = 3 + replacingCost + lineCommandCost + staffCost + transferCost;
  return estimate(resources, reputationCost, `${officer?.name ?? "将校"}を${division.name}師団長へ任命`);
};

export const spendPoliticalCost = (
  resources: ResourceBundle,
  cost: PoliticalCostEstimate,
): ResourceBundle => ({
  ...resources,
  reputation: Math.max(0, resources.reputation - cost.reputationCost),
});

const defaultCommandRecommendationContext: CommandRecommendationContext = {
  sectorName: "現戦場",
  terrainTags: [],
  enemyPressure: 0,
  risk: 0,
  structureCount: 0,
  enemyThreats: [{ type: "undeadMob", intensity: 1 }],
  staffDirectiveMode: "balanced",
  staffDirectiveLabel: "標準参謀整理",
};

const rankFit = (officer: Officer | undefined): number =>
  officer?.rank === "General" ? 4 : officer?.rank === "Colonel" ? 3 : officer?.rank === "Major" ? 2 : officer ? 1 : 0;

const traitFit = (officer: Officer | undefined, traits: string[]): number =>
  officer ? officer.traits.filter((trait) => traits.includes(trait)).length : 0;

const enemyThreatIntensity = (context: CommandRecommendationContext, type: EnemyCompositionThreatType): number =>
  context.enemyThreats.find((threat) => threat.type === type)?.intensity ?? 0;

const contextLabel = (context: CommandRecommendationContext): string => {
  const terrain =
    context.terrainTags.includes("bridge")
      ? "橋梁"
      : context.terrainTags.includes("trench")
        ? "塹壕"
        : context.terrainTags.includes("marsh")
          ? "泥濘"
          : context.terrainTags.includes("forest")
            ? "森林"
            : context.terrainTags.includes("open")
              ? "開豁地"
              : "通常地形";
  const riskPercent = riskPercentValue(context.risk);
  return `${context.sectorName} / ${terrain} / 敵圧${context.enemyPressure} / 危険${riskPercent}% / 主敵${enemyCompositionLabel(context.enemyThreats)} / 参謀任務${context.staffDirectiveLabel ?? "標準参謀整理"}`;
};

const staffDirectiveStaffWeight = (slotId: StaffSlotId, context: CommandRecommendationContext): number => {
  if (context.staffDirectiveMode === "enemy_analysis") {
    return slotId === "chiefOfStaff" ? 20 : slotId === "artilleryChief" ? 8 : 0;
  }
  if (context.staffDirectiveMode === "counter_intelligence") {
    return slotId === "chiefOfStaff" ? 16 : slotId === "quartermaster" ? 8 : 0;
  }
  if (context.staffDirectiveMode === "logistics_recon") {
    return slotId === "quartermaster" ? 24 : slotId === "chiefOfStaff" ? 6 : 0;
  }
  if (context.staffDirectiveMode === "engineer_survey") {
    return slotId === "engineerChief" ? 26 : slotId === "quartermaster" ? 5 : 0;
  }
  return 0;
};

const staffDirectiveDivisionWeights = (
  context: CommandRecommendationContext,
): { morale: number; control: number; reserve: number } => {
  if (context.staffDirectiveMode === "enemy_analysis") {
    return { morale: 2, control: 5, reserve: 1 };
  }
  if (context.staffDirectiveMode === "counter_intelligence") {
    return { morale: 3, control: 4, reserve: 2 };
  }
  if (context.staffDirectiveMode === "logistics_recon") {
    return { morale: 0, control: 1, reserve: 6 };
  }
  if (context.staffDirectiveMode === "engineer_survey") {
    return { morale: 1, control: 5, reserve: 1 };
  }
  return { morale: 0, control: 0, reserve: 0 };
};

const staffDirectiveDivisionDirectiveBonus = (
  division: ArmyDivision | undefined,
  context: CommandRecommendationContext,
): number => {
  if (context.staffDirectiveMode === "engineer_survey" && division?.directive === "engineer_support") {
    return 18;
  }
  if (context.staffDirectiveMode === "logistics_recon" && division?.directive === "reserve_guard") {
    return 16;
  }
  if (context.staffDirectiveMode === "enemy_analysis" && division?.directive === "fire_support") {
    return 10;
  }
  if (context.staffDirectiveMode === "counter_intelligence" && division?.directive === "elastic_defense") {
    return 10;
  }
  return 0;
};

const enemyThreatTraitValue = (officer: Officer | undefined, context: CommandRecommendationContext): number => {
  if (!officer) {
    return 0;
  }
  const traitThreats: Record<string, EnemyCompositionThreatType[]> = {
    規律重視: ["undeadMob", "undeadOfficer"],
    戦列保持: ["undeadMob", "brute"],
    予備指揮: ["brute", "undeadOfficer"],
    砲兵運用: ["undeadMob", "brute"],
    火力支援: ["undeadMob", "undeadRiflemen"],
    工兵指揮: ["brute"],
    野戦架橋: ["brute"],
    塹壕戦: ["brute", "undeadMob"],
    哨戒: ["undeadRiflemen", "undeadOfficer"],
    散兵指揮: ["undeadRiflemen"],
  };
  return officer.traits.reduce((sum, trait) => {
    const threats = traitThreats[trait] ?? [];
    return sum + threats.reduce((inner, type) => inner + enemyThreatIntensity(context, type), 0);
  }, 0);
};

const staffEnemyThreatWeight = (slotId: StaffSlotId, context: CommandRecommendationContext): number => {
  const mob = enemyThreatIntensity(context, "undeadMob");
  const riflemen = enemyThreatIntensity(context, "undeadRiflemen");
  const brute = enemyThreatIntensity(context, "brute");
  const officer = enemyThreatIntensity(context, "undeadOfficer");
  if (slotId === "chiefOfStaff") {
    return mob * 5 + brute * 4 + officer * 7 + riflemen * 2;
  }
  if (slotId === "quartermaster") {
    return mob * 3 + riflemen * 5 + brute * 3 + officer * 2;
  }
  if (slotId === "engineerChief") {
    return brute * 7 + mob * 2 + officer * 2;
  }
  if (slotId === "artilleryChief") {
    return mob * 7 + riflemen * 4 + brute * 5;
  }
  return 0;
};

const staffContextWeight = (slotId: StaffSlotId, context: CommandRecommendationContext): number => {
  const has = (tag: string) => context.terrainTags.includes(tag);
  const riskPercent = riskPercentValue(context.risk);
  if (slotId === "chiefOfStaff") {
    return riskPercent >= 75 || context.enemyPressure >= 55 ? 18 : 10;
  }
  if (slotId === "quartermaster") {
    return riskPercent >= 70 || context.enemyPressure >= 50 ? 16 : 7;
  }
  if (slotId === "engineerChief") {
    return has("trench") || has("bridge") || context.structureCount > 0 ? 18 : has("marsh") || has("forest") ? 10 : 5;
  }
  if (slotId === "artilleryChief") {
    return has("open") || has("hill") ? 16 : context.enemyPressure >= 60 ? 12 : 6;
  }
  return 0;
};

const staffContextValue = (army: ArmyState, officers: Officer[], context: CommandRecommendationContext): number => {
  const assignments = normalizeStaffAssignments(army.formations[0]?.staffAssignments);
  return assignments.reduce((sum, assignment) => {
    if (!assignment.officerId) {
      return sum;
    }
    const slot = staffSlotDefinitions.find((candidate) => candidate.id === assignment.slotId);
    const officer = officers.find((candidate) => candidate.id === assignment.officerId && candidate.status === "active");
    if (!slot || !officer) {
      return sum;
    }
    const fit = rankFit(officer) + traitFit(officer, slot.preferredTraits) * 2;
    return (
      sum +
      (staffContextWeight(slot.id, context) + staffDirectiveStaffWeight(slot.id, context)) * Math.max(1, fit) +
      staffEnemyThreatWeight(slot.id, context) * Math.max(1, enemyThreatTraitValue(officer, context)) +
      staffAccountabilityValue(officer, slot.id)
    );
  }, 0);
};

const staffAccountabilityLabel = (slotId: StaffSlotId): string => slotLabel(slotId);

const staffAccountabilityEntriesFor = (officer: Officer | undefined, slotId: StaffSlotId): string[] => {
  if (!officer) {
    return [];
  }
  const label = staffAccountabilityLabel(slotId);
  return officer.history.filter((entry) => entry.includes(label)).slice(0, 3);
};

const staffAccountabilityValue = (officer: Officer | undefined, slotId: StaffSlotId): number =>
  staffAccountabilityEntriesFor(officer, slotId).reduce((sum, entry, index) => {
    const recency = index === 0 ? 1 : index === 1 ? 0.58 : 0.34;
    const result =
      entry.includes("責任") ? -54 : entry.includes("警告") ? -26 : entry.includes("功績") ? 18 : 0;
    const fatiguePressure = entry.includes("疲労+8") ? -8 : entry.includes("疲労+4") ? -3 : 0;
    return sum + Math.round((result + fatiguePressure) * recency);
  }, 0);

const staffAccountabilitySummary = (officer: Officer | undefined, slotId: StaffSlotId): string | undefined => {
  const first = staffAccountabilityEntriesFor(officer, slotId)[0];
  if (!first) {
    return undefined;
  }
  const label = staffAccountabilityLabel(slotId);
  const result = first.includes(`${label} 責任`)
    ? "責任"
    : first.includes(`${label} 警告`)
      ? "警告"
      : first.includes(`${label} 功績`)
        ? "功績"
        : "記録";
  const body = first.includes(": ") ? first.split(": ").slice(1).join(": ") : first;
  const parts = body.split("、");
  const trigger = parts[1];
  const lesson = parts[2];
  return `${label}${result}${trigger ? ` / ${trigger}` : ""}${lesson ? ` / ${lesson}` : ""}`;
};

const headquartersValue = (
  army: ArmyState,
  officers: Officer[],
  context = defaultCommandRecommendationContext,
): number => {
  const profile = armyHeadquartersProfile(army, officers);
  return (
    profile.commandCapacityBonus +
    profile.reserveReadinessBonus * 8 +
    profile.deploymentSlotBonus * 70 +
    profile.repairBonus * 5 +
    staffContextValue(army, officers, context)
  );
};

export const recommendStaffAssignments = (
  army: ArmyState,
  officers: Officer[],
  resources: ResourceBundle,
  context = defaultCommandRecommendationContext,
  limit = 3,
): CommandReplacementRecommendation[] => {
  const activeOfficers = officers.filter((officer) => officer.status === "active");
  const currentValue = headquartersValue(army, officers, context);
  return staffSlotDefinitions
    .flatMap((slot) =>
      activeOfficers.map((officer): CommandReplacementRecommendation | undefined => {
        const cost = estimateStaffAssignmentPoliticalCost(army, officers, resources, slot.id, officer.id);
        if (cost.reputationCost === 0 || !cost.canPay) {
          return undefined;
        }
        const projectedArmy = assignArmyStaffOfficer(army, slot.id, officer.id);
        const projectedValue = headquartersValue(projectedArmy, officers, context);
        const improvement = projectedValue - currentValue;
        const netScore = improvement - cost.reputationCost * 4;
        if (improvement <= 0 || netScore <= 0) {
          return undefined;
        }
        const projectedProfile = armyHeadquartersProfile(projectedArmy, officers);
        const currentOfficerId = normalizeStaffAssignments(army.formations[0]?.staffAssignments).find(
          (assignment) => assignment.slotId === slot.id,
        )?.officerId;
        const currentOfficer = officers.find((candidate) => candidate.id === currentOfficerId);
        const currentAccountability = staffAccountabilitySummary(currentOfficer, slot.id);
        const projectedAccountability = staffAccountabilitySummary(officer, slot.id);
        const accountabilitySummary =
          currentAccountability || projectedAccountability
            ? `${currentAccountability ?? "現任評価なし"} -> ${projectedAccountability ?? "候補評価なし"}`
            : undefined;
        return {
          id: `staff-${slot.id}-${officer.id}`,
          targetId: slot.id,
          officerId: officer.id,
          officerName: officer.name,
          currentSummary: `現司令部 価値${currentValue}`,
          projectedSummary: `出撃+${projectedProfile.deploymentSlotBonus} / 統制+${projectedProfile.commandCapacityBonus} / 予備+${projectedProfile.reserveReadinessBonus}`,
          accountabilitySummary,
          reputationCost: cost.reputationCost,
          improvement,
          netScore,
          reason: `${slot.label}を${officer.name}へ変更`,
          contextSummary: contextLabel(context),
        };
      }),
    )
    .filter((item): item is CommandReplacementRecommendation => Boolean(item))
    .sort((a, b) => b.netScore - a.netScore)
    .slice(0, limit);
};

const divisionContextWeights = (context: CommandRecommendationContext): { morale: number; control: number; reserve: number } => {
  const has = (tag: string) => context.terrainTags.includes(tag);
  const mob = enemyThreatIntensity(context, "undeadMob");
  const riflemen = enemyThreatIntensity(context, "undeadRiflemen");
  const brute = enemyThreatIntensity(context, "brute");
  const officer = enemyThreatIntensity(context, "undeadOfficer");
  const directive = staffDirectiveDivisionWeights(context);
  return {
    morale: (has("open") || has("hill") ? 19 : context.enemyPressure >= 60 ? 18 : 16) + mob * 2 + brute + directive.morale,
    control: (has("forest") || has("marsh") || has("trench") || has("bridge") ? 17 : 12) + riflemen * 2 + officer * 3 + directive.control,
    reserve: (riskPercentValue(context.risk) >= 70 || context.enemyPressure >= 50 ? 11 : 7) + brute * 3 + officer * 2 + directive.reserve,
  };
};

const divisionValue = (
  division: ArmyDivision | undefined,
  officers: Officer[],
  context = defaultCommandRecommendationContext,
): number => {
  const profile = divisionCommandProfile(division, officers);
  if (!profile) {
    return 0;
  }
  const weights = divisionContextWeights(context);
  const directiveBonus =
    division?.directive === "engineer_support" && (context.terrainTags.includes("trench") || context.structureCount > 0)
      ? 18
      : division?.directive === "reserve_guard" && (riskPercentValue(context.risk) >= 70 || enemyThreatIntensity(context, "brute") > 0)
        ? 16
        : division?.directive === "fire_support" && (context.terrainTags.includes("open") || context.terrainTags.includes("hill") || enemyThreatIntensity(context, "undeadMob") >= 2 || enemyThreatIntensity(context, "undeadRiflemen") > 0)
          ? 14
          : division?.directive === "elastic_defense" && (context.terrainTags.includes("marsh") || context.enemyPressure >= 55 || enemyThreatIntensity(context, "brute") > 0)
            ? 12
            : 0;
  return (
    profile.moraleBonus * weights.morale +
    profile.controlRadiusBonus * weights.control +
    profile.reserveReadinessBonus * weights.reserve +
    directiveBonus +
    staffDirectiveDivisionDirectiveBonus(division, context) +
    enemyThreatTraitValue(officers.find((officer) => officer.id === division?.commanderOfficerId), context) * 6
  );
};

export const recommendDivisionCommanderAssignments = (
  army: ArmyState,
  officers: Officer[],
  resources: ResourceBundle,
  context = defaultCommandRecommendationContext,
  limit = 3,
): CommandReplacementRecommendation[] => {
  const divisions = normalizeArmyDivisions(army.units, army.formations[0]?.divisions).filter((division) => !division.locked);
  const activeOfficers = officers.filter((officer) => officer.status === "active");
  return divisions
    .flatMap((division) => {
      const currentValue = divisionValue(division, officers, context);
      return activeOfficers.map((officer) => {
        const cost = estimateDivisionCommanderPoliticalCost(army, officers, resources, division.id, officer.id);
        if (cost.reputationCost === 0 || !cost.canPay) {
          return undefined;
        }
        const projectedArmy = assignDivisionCommander(army, division.id, officer.id);
        const projectedDivision = normalizeArmyDivisions(projectedArmy.units, projectedArmy.formations[0]?.divisions).find(
          (candidate) => candidate.id === division.id,
        );
        const projectedValue = divisionValue(projectedDivision, officers, context);
        const improvement = projectedValue - currentValue;
        const netScore = improvement - cost.reputationCost * 4;
        if (improvement <= 0 || netScore <= 0 || !projectedDivision) {
          return undefined;
        }
        const projectedProfile = divisionCommandProfile(projectedDivision, officers);
        return {
          id: `division-${division.id}-${officer.id}`,
          targetId: division.id,
          officerId: officer.id,
          officerName: officer.name,
          currentSummary: `${division.name} 価値${currentValue}`,
          projectedSummary: projectedProfile?.summary ?? `${division.name} 指揮改善`,
          reputationCost: cost.reputationCost,
          improvement,
          netScore,
          reason: `${division.name}師団長を${officer.name}へ変更`,
          contextSummary: contextLabel(context),
        };
      });
    })
    .filter((item): item is CommandReplacementRecommendation => Boolean(item))
    .sort((a, b) => b.netScore - a.netScore)
    .slice(0, limit);
};
