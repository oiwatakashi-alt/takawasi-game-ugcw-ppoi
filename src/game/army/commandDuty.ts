import type { ArmyState } from "./types";
import { divisionCommandLoadByOfficer, divisionCommandSummaryForOfficer } from "./divisions";
import { staffDutyLoadByOfficer, staffDutySummaryForOfficer } from "./headquarters";

export interface CommandDutyProfile {
  load: number;
  summary?: string;
}

export const commandDutyLoadByOfficer = (army: ArmyState): Record<string, number> => {
  const staffLoads = staffDutyLoadByOfficer(army);
  const divisionLoads = divisionCommandLoadByOfficer(army);
  const officerIds = new Set([...Object.keys(staffLoads), ...Object.keys(divisionLoads)]);
  return Array.from(officerIds).reduce<Record<string, number>>(
    (loads, officerId) => ({
      ...loads,
      [officerId]: (staffLoads[officerId] ?? 0) + (divisionLoads[officerId] ?? 0),
    }),
    {},
  );
};

export const commandDutyProfileForOfficer = (army: ArmyState, officerId: string): CommandDutyProfile => {
  const staffLoads = staffDutyLoadByOfficer(army);
  const divisionLoads = divisionCommandLoadByOfficer(army);
  const parts: string[] = [];
  const staffSummary = staffDutySummaryForOfficer(army, officerId);
  if (staffSummary) {
    parts.push(`参謀兼任 ${staffSummary} 負荷${staffLoads[officerId] ?? 0}`);
  }
  const divisionSummary = divisionCommandSummaryForOfficer(army, officerId);
  if (divisionSummary) {
    parts.push(`師団長兼任 ${divisionSummary} 負荷${divisionLoads[officerId] ?? 0}`);
  }
  const load = (staffLoads[officerId] ?? 0) + (divisionLoads[officerId] ?? 0);
  return {
    load,
    summary: parts.length > 0 ? `兼任負荷-${load} (${parts.join(" / ")})` : undefined,
  };
};
