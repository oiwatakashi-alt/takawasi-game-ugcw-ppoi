import type { ArmyState, ArmyStaffAssignment, StaffSlotId } from "./types";
import type { Officer } from "../officers/types";

export interface StaffSlotDefinition {
  id: StaffSlotId;
  label: string;
  role: string;
  preferredTraits: string[];
  staffDutyLoad: number;
  baseEffect: {
    deploymentSlots: number;
    commandCapacity: number;
    reserveReadiness: number;
    repairBonus: number;
  };
}

export interface ArmyHeadquartersProfile {
  deploymentSlotBonus: number;
  commandCapacityBonus: number;
  reserveReadinessBonus: number;
  repairBonus: number;
  activeSlots: number;
  summary: string[];
}

export const staffSlotDefinitions: StaffSlotDefinition[] = [
  {
    id: "chiefOfStaff",
    label: "参謀長",
    role: "出撃枠と全軍統制",
    preferredTraits: ["規律重視", "戦列保持", "予備指揮"],
    staffDutyLoad: 120,
    baseEffect: { deploymentSlots: 1, commandCapacity: 80, reserveReadiness: 4, repairBonus: 0 },
  },
  {
    id: "quartermaster",
    label: "兵站主任",
    role: "予備即応と補給整理",
    preferredTraits: ["予備指揮", "哨戒", "規律重視"],
    staffDutyLoad: 80,
    baseEffect: { deploymentSlots: 0, commandCapacity: 45, reserveReadiness: 8, repairBonus: 0 },
  },
  {
    id: "engineerChief",
    label: "工兵主任",
    role: "築城・修理連携",
    preferredTraits: ["工兵指揮", "野戦架橋", "塹壕戦"],
    staffDutyLoad: 70,
    baseEffect: { deploymentSlots: 0, commandCapacity: 35, reserveReadiness: 3, repairBonus: 8 },
  },
  {
    id: "artilleryChief",
    label: "砲兵主任",
    role: "火力支援計画",
    preferredTraits: ["砲兵運用", "火力支援", "予備指揮"],
    staffDutyLoad: 70,
    baseEffect: { deploymentSlots: 0, commandCapacity: 50, reserveReadiness: 6, repairBonus: 0 },
  },
];

export const defaultStaffAssignments = (): ArmyStaffAssignment[] =>
  staffSlotDefinitions.map((slot) => ({ slotId: slot.id }));

export const normalizeStaffAssignments = (assignments?: ArmyStaffAssignment[]): ArmyStaffAssignment[] => {
  const usedOfficerIds = new Set<string>();
  return staffSlotDefinitions.map((slot) => {
    const officerId = assignments?.find((assignment) => assignment.slotId === slot.id)?.officerId;
    if (!officerId || usedOfficerIds.has(officerId)) {
      return { slotId: slot.id };
    }
    usedOfficerIds.add(officerId);
    return { slotId: slot.id, officerId };
  });
};

export const staffDutyLoadByOfficer = (army: ArmyState): Record<string, number> => {
  const formation = army.formations[0];
  const assignments = normalizeStaffAssignments(formation?.staffAssignments);
  return assignments.reduce<Record<string, number>>((loads, assignment) => {
    if (!assignment.officerId) {
      return loads;
    }
    const slot = staffSlotDefinitions.find((candidate) => candidate.id === assignment.slotId);
    if (!slot) {
      return loads;
    }
    return {
      ...loads,
      [assignment.officerId]: (loads[assignment.officerId] ?? 0) + slot.staffDutyLoad,
    };
  }, {});
};

export const staffDutySummaryForOfficer = (army: ArmyState, officerId: string): string | undefined => {
  const formation = army.formations[0];
  const assignments = normalizeStaffAssignments(formation?.staffAssignments).filter(
    (assignment) => assignment.officerId === officerId,
  );
  if (assignments.length === 0) {
    return undefined;
  }
  return assignments
    .map((assignment) => staffSlotDefinitions.find((slot) => slot.id === assignment.slotId)?.label)
    .filter(Boolean)
    .join("、");
};

const officerStaffFit = (officer: Officer | undefined, slot: StaffSlotDefinition): number => {
  if (!officer || officer.status !== "active") {
    return 0;
  }
  const traitMatches = officer.traits.filter((trait) => slot.preferredTraits.includes(trait)).length;
  const rankBonus = officer.rank === "General" ? 3 : officer.rank === "Colonel" ? 2 : officer.rank === "Major" ? 1 : 0;
  return 1 + traitMatches + rankBonus;
};

export const armyHeadquartersProfile = (army: ArmyState, officers: Officer[]): ArmyHeadquartersProfile => {
  const formation = army.formations[0];
  const assignments = normalizeStaffAssignments(formation?.staffAssignments);
  const summary: string[] = [];
  const profile: ArmyHeadquartersProfile = {
    deploymentSlotBonus: 0,
    commandCapacityBonus: 0,
    reserveReadinessBonus: 0,
    repairBonus: 0,
    activeSlots: 0,
    summary,
  };

  for (const slot of staffSlotDefinitions) {
    const officer = officers.find((candidate) => candidate.id === assignments.find((item) => item.slotId === slot.id)?.officerId);
    const fit = officerStaffFit(officer, slot);
    if (fit <= 0) {
      continue;
    }
    const multiplier = Math.min(1.45, 0.85 + fit * 0.12);
    profile.activeSlots += 1;
    profile.deploymentSlotBonus += slot.baseEffect.deploymentSlots;
    profile.commandCapacityBonus += Math.round(slot.baseEffect.commandCapacity * multiplier);
    profile.reserveReadinessBonus += Math.round(slot.baseEffect.reserveReadiness * multiplier);
    profile.repairBonus += Math.round(slot.baseEffect.repairBonus * multiplier);
    summary.push(`${slot.label}:${officer?.name ?? "未任命"} 統制+${Math.round(slot.baseEffect.commandCapacity * multiplier)}`);
  }

  return {
    ...profile,
    summary: summary.length > 0 ? summary.slice(0, 4) : ["軍団参謀未整備"],
  };
};

export const assignArmyStaffOfficer = (
  army: ArmyState,
  slotId: StaffSlotId,
  officerId: string | undefined,
): ArmyState => ({
  ...army,
  formations: army.formations.map((formation, index) =>
    index === 0
      ? {
          ...formation,
          staffAssignments: normalizeStaffAssignments(formation.staffAssignments).map((assignment) =>
            assignment.slotId === slotId
              ? { ...assignment, officerId }
              : assignment.officerId && assignment.officerId === officerId
                ? { ...assignment, officerId: undefined }
                : assignment,
          ),
        }
      : formation,
  ),
});
