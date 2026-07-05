import type { BattleUnit } from "./types";

export const applyMoraleShock = (unit: BattleUnit, shock: number): BattleUnit => ({
  ...unit,
  morale: Math.max(0, unit.morale - shock),
});

export const averageMorale = (units: BattleUnit[]): number => {
  if (units.length === 0) {
    return 0;
  }
  return units.reduce((sum, unit) => sum + unit.morale, 0) / units.length;
};
