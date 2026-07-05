import { normalizeStaffAssignments } from "../army/headquarters";
import type { CampaignState } from "../campaign/types";

export interface BattleCommandPostProfile {
  label: string;
  chiefOfStaffName?: string;
  chiefOfStaffFatigue: number;
  commandCapacityModifier: number;
  transmissionDelayModifier: number;
  reasons: string[];
}

export const commandPostProfileForCampaign = (
  campaign: Pick<CampaignState, "army" | "officers">,
): BattleCommandPostProfile => {
  const chiefOfStaffOfficerId = normalizeStaffAssignments(campaign.army.formations[0]?.staffAssignments).find(
    (assignment) => assignment.slotId === "chiefOfStaff",
  )?.officerId;
  const chiefOfStaff = campaign.officers.find((candidate) => candidate.id === chiefOfStaffOfficerId);
  const chiefFatigue = chiefOfStaff?.status === "active" ? chiefOfStaff.commandFatigue ?? 0 : 100;

  return {
    label: chiefOfStaff ? `参謀長 ${chiefOfStaff.name} 疲労${chiefFatigue}` : "参謀長未任命",
    chiefOfStaffName: chiefOfStaff?.name,
    chiefOfStaffFatigue: chiefFatigue,
    commandCapacityModifier: !chiefOfStaff ? -1 : chiefFatigue >= 65 ? -2 : chiefFatigue >= 20 ? -1 : 0,
    transmissionDelayModifier: !chiefOfStaff ? 1 : chiefFatigue >= 70 ? 2 : chiefFatigue >= 20 ? 1 : 0,
    reasons: [
      chiefOfStaff ? `参謀長 ${chiefOfStaff.name}` : "参謀長未任命",
      chiefOfStaff?.status && chiefOfStaff.status !== "active" ? "参謀長不在扱い" : undefined,
      chiefFatigue >= 70
        ? `指揮疲労${chiefFatigue}で伝達+2秒/処理容量-2`
        : chiefFatigue >= 20
          ? `指揮疲労${chiefFatigue}で伝達+1秒/処理容量-1`
          : `指揮疲労${chiefFatigue}で支障なし`,
    ].filter(Boolean) as string[],
  };
};
