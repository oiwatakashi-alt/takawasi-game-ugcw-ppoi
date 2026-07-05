import type { StandingOrder, StandingPosture, TargetPriority, AmmoPolicy } from "../battle/types";
import type { Officer } from "../officers/types";
import type { ArmyDivision, ArmyState, ArmyUnit, DivisionDirective, UnitType } from "./types";

export interface DivisionDirectiveDefinition {
  id: DivisionDirective;
  label: string;
  summary: string;
  posture: StandingPosture;
  targetPriority: TargetPriority;
  ammoPolicy: AmmoPolicy;
  reserveReadinessBonus: number;
  controlRadiusBonus: number;
}

export interface DivisionCommandProfile {
  divisionName: string;
  directiveLabel: string;
  commanderName?: string;
  moraleBonus: number;
  controlRadiusBonus: number;
  reserveReadinessBonus: number;
  summary: string;
}

export const divisionCommandDutyLoad = 140;

export const divisionDirectiveDefinitions: DivisionDirectiveDefinition[] = [
  {
    id: "line_hold",
    label: "戦線固守",
    summary: "正面を守り、近い敵を優先して通常射撃する。",
    posture: "hold_line",
    targetPriority: "nearest",
    ammoPolicy: "normal",
    reserveReadinessBonus: 2,
    controlRadiusBonus: 1,
  },
  {
    id: "elastic_defense",
    label: "弾性防御",
    summary: "戦線を保ちつつ、損耗時は後退線を使う。",
    posture: "elastic_defense",
    targetPriority: "largest_mass",
    ammoPolicy: "normal",
    reserveReadinessBonus: 4,
    controlRadiusBonus: 2,
  },
  {
    id: "fire_support",
    label: "火力支援",
    summary: "砲兵と支援部隊を中心に敵集団へ火力を寄せる。",
    posture: "fire_support",
    targetPriority: "largest_mass",
    ammoPolicy: "conserve",
    reserveReadinessBonus: 6,
    controlRadiusBonus: 1,
  },
  {
    id: "reserve_guard",
    label: "予備守備",
    summary: "後方で即応を維持し、敵指揮や突破へ対応する。",
    posture: "fallback_guard",
    targetPriority: "officer",
    ammoPolicy: "conserve",
    reserveReadinessBonus: 10,
    controlRadiusBonus: 2,
  },
  {
    id: "engineer_support",
    label: "工兵支援",
    summary: "施設修理と陣地勤務を優先する。",
    posture: "engineer_support",
    targetPriority: "nearest",
    ammoPolicy: "conserve",
    reserveReadinessBonus: 3,
    controlRadiusBonus: 3,
  },
];

export const divisionDirectiveLabels = Object.fromEntries(
  divisionDirectiveDefinitions.map((directive) => [directive.id, directive.label]),
) as Record<DivisionDirective, string>;

export const fallbackArmyDivisions = (units: ArmyUnit[]): ArmyDivision[] => [
  {
    id: "division-1",
    name: "第1師団",
    note: "主戦列",
    role: "line",
    directive: "line_hold",
    commanderOfficerId: units[0]?.officerId,
    maxBrigades: 6,
    unitIds: units.slice(0, 6).map((unit) => unit.id),
  },
  {
    id: "division-2",
    name: "第2師団",
    note: "予備・支援",
    role: "reserve",
    directive: "reserve_guard",
    commanderOfficerId: units[6]?.officerId,
    maxBrigades: 6,
    unitIds: units.slice(6, 12).map((unit) => unit.id),
  },
  {
    id: "division-3",
    name: "第3師団",
    note: "軍制拡張で解放",
    role: "locked",
    directive: "line_hold",
    maxBrigades: 6,
    unitIds: [],
    locked: true,
  },
  {
    id: "division-4",
    name: "第4師団",
    note: "軍制拡張で解放",
    role: "locked",
    directive: "line_hold",
    maxBrigades: 6,
    unitIds: [],
    locked: true,
  },
];

export const normalizeArmyDivisions = (units: ArmyUnit[], divisions?: ArmyDivision[]): ArmyDivision[] => {
  const fallback = fallbackArmyDivisions(units);
  const usedCommanderIds = new Set<string>();
  return fallback.map((defaultDivision) => {
    const existing = divisions?.find((division) => division.id === defaultDivision.id);
    const hasExistingCommanderField = existing ? "commanderOfficerId" in existing : false;
    const commanderOfficerId = hasExistingCommanderField
      ? existing?.commanderOfficerId
      : defaultDivision.commanderOfficerId;
    const normalizedCommanderOfficerId =
      commanderOfficerId && !usedCommanderIds.has(commanderOfficerId) ? commanderOfficerId : undefined;
    if (normalizedCommanderOfficerId) {
      usedCommanderIds.add(normalizedCommanderOfficerId);
    }
    return {
      ...defaultDivision,
      ...(existing ?? {}),
      directive: existing?.directive ?? defaultDivision.directive,
      commanderOfficerId: normalizedCommanderOfficerId,
      maxBrigades: existing?.maxBrigades ?? defaultDivision.maxBrigades,
      unitIds: existing?.unitIds ?? defaultDivision.unitIds,
    };
  });
};

export const divisionForUnit = (army: ArmyState, unitId: string): ArmyDivision | undefined =>
  normalizeArmyDivisions(army.units, army.formations[0]?.divisions).find((division) => division.unitIds.includes(unitId));

export const setDivisionDirective = (
  army: ArmyState,
  divisionId: string,
  directive: DivisionDirective,
): ArmyState => ({
  ...army,
  formations: army.formations.map((formation, index) =>
    index === 0
      ? {
          ...formation,
          divisions: normalizeArmyDivisions(army.units, formation.divisions).map((division) =>
            division.id === divisionId ? { ...division, directive } : division,
          ),
        }
      : formation,
  ),
});

export const assignDivisionCommander = (
  army: ArmyState,
  divisionId: string,
  officerId: string | undefined,
): ArmyState => ({
  ...army,
  formations: army.formations.map((formation, index) =>
    index === 0
      ? {
          ...formation,
          divisions: normalizeArmyDivisions(army.units, formation.divisions).map((division) =>
            division.id === divisionId
              ? { ...division, commanderOfficerId: officerId }
              : division.commanderOfficerId && division.commanderOfficerId === officerId
                ? { ...division, commanderOfficerId: undefined }
                : division,
          ),
        }
      : formation,
  ),
});

export const divisionCommandLoadByOfficer = (army: ArmyState): Record<string, number> => {
  const divisions = normalizeArmyDivisions(army.units, army.formations[0]?.divisions);
  return divisions.reduce<Record<string, number>>((loads, division) => {
    if (!division.commanderOfficerId || division.locked) {
      return loads;
    }
    return {
      ...loads,
      [division.commanderOfficerId]: (loads[division.commanderOfficerId] ?? 0) + divisionCommandDutyLoad,
    };
  }, {});
};

export const divisionCommandSummaryForOfficer = (army: ArmyState, officerId: string): string | undefined => {
  const divisions = normalizeArmyDivisions(army.units, army.formations[0]?.divisions).filter(
    (division) => !division.locked && division.commanderOfficerId === officerId,
  );
  if (divisions.length === 0) {
    return undefined;
  }
  return divisions.map((division) => division.name).join("、");
};

export const divisionCommandProfile = (
  division: ArmyDivision | undefined,
  officers: Officer[],
): DivisionCommandProfile | undefined => {
  if (!division || division.locked) {
    return undefined;
  }
  const directive = divisionDirectiveDefinitions.find((candidate) => candidate.id === division.directive) ?? divisionDirectiveDefinitions[0];
  const commander = officers.find((officer) => officer.id === division.commanderOfficerId && officer.status === "active");
  const rankBonus =
    commander?.rank === "General" ? 3 : commander?.rank === "Colonel" ? 2 : commander?.rank === "Major" ? 1 : 0;
  const moraleBonus = commander ? Math.max(1, rankBonus + 1) : 0;
  const reserveReadinessBonus = directive.reserveReadinessBonus + (commander ? 2 + rankBonus * 2 : 0);
  const controlRadiusBonus = directive.controlRadiusBonus + (commander ? Math.max(1, rankBonus) : 0);
  return {
    divisionName: division.name,
    directiveLabel: directive.label,
    commanderName: commander?.name,
    moraleBonus,
    controlRadiusBonus,
    reserveReadinessBonus,
    summary: `${division.name} ${directive.label}${commander ? ` / 師団長 ${commander.name}` : ""} / 統制+${controlRadiusBonus} 即応+${reserveReadinessBonus}`,
  };
};

export const applyDivisionDirectiveToStandingOrder = (
  order: StandingOrder,
  unitType: UnitType,
  division: ArmyDivision | undefined,
): StandingOrder => {
  const directive = divisionDirectiveDefinitions.find((candidate) => candidate.id === division?.directive);
  if (!directive || division?.locked) {
    return order;
  }
  const posture =
    directive.id === "engineer_support" && unitType !== "engineer"
      ? "hold_line"
      : directive.id === "fire_support" && unitType !== "artillery"
        ? "hold_line"
        : directive.posture;
  const targetPriority =
    directive.id === "engineer_support" && unitType !== "engineer" ? "nearest" : directive.targetPriority;
  return {
    ...order,
    posture,
    targetPriority,
    ammoPolicy: directive.ammoPolicy,
    controlRadius: order.controlRadius + directive.controlRadiusBonus,
    fallback:
      directive.id === "elastic_defense"
        ? {
            ...order.fallback,
            enabled: true,
            moraleBelow: Math.max(order.fallback.moraleBelow ?? 0, 42),
          }
        : order.fallback,
  };
};
