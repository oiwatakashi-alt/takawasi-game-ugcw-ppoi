export type UnitType = "infantry" | "jaeger" | "artillery" | "engineer";

export type UnitOrder = "hold" | "advance" | "flank" | "rest" | "build" | "retreat";

export interface ArmyUnit {
  id: string;
  name: string;
  type: UnitType;
  soldiers: number;
  maxSoldiers: number;
  experience: number;
  level: number;
  morale: number;
  condition: number;
  ammo: number;
  weaponKey?: string;
  weaponQuality: number;
  officerId: string;
  traits: string[];
  battleHistory: string[];
  assignedOperationId?: string;
}

export interface Formation {
  id: string;
  name: string;
  unitIds: string[];
  divisions?: ArmyDivision[];
  staffAssignments?: ArmyStaffAssignment[];
}

export interface ArmyState {
  formations: Formation[];
  units: ArmyUnit[];
}

export type StaffSlotId = "chiefOfStaff" | "quartermaster" | "engineerChief" | "artilleryChief";

export interface ArmyDivision {
  id: string;
  name: string;
  note: string;
  role: "line" | "reserve" | "support" | "locked";
  directive?: DivisionDirective;
  commanderOfficerId?: string;
  unitIds: string[];
  maxBrigades: number;
  locked?: boolean;
}

export type DivisionDirective =
  | "line_hold"
  | "elastic_defense"
  | "fire_support"
  | "reserve_guard"
  | "engineer_support";

export interface ArmyStaffAssignment {
  slotId: StaffSlotId;
  officerId?: string;
}
