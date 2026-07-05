export type OfficerStatus = "active" | "resting" | "wounded" | "dead";
export type OfficerRank = "Captain" | "Major" | "Colonel" | "General";

export interface Officer {
  id: string;
  name: string;
  rank: OfficerRank;
  experience: number;
  status: OfficerStatus;
  recoveryTurns: number;
  commandFatigue: number;
  traits: string[];
  assignedUnitId?: string;
  assignedOperationId?: string;
  history: string[];
}
