import type { ArmyUnit } from "./types";

export const assignUnitsToOperation = (
  units: ArmyUnit[],
  operationId: string,
  unitIds: string[],
): ArmyUnit[] =>
  units.map((unit) => ({
    ...unit,
    assignedOperationId: unitIds.includes(unit.id) ? operationId : unit.assignedOperationId,
  }));

export const clearOperationAssignments = (units: ArmyUnit[], operationId: string): ArmyUnit[] =>
  units.map((unit) => ({
    ...unit,
    assignedOperationId: unit.assignedOperationId === operationId ? undefined : unit.assignedOperationId,
  }));
