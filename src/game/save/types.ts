import type { CampaignState } from "../campaign/types";
import type { BattleState } from "../battle/types";

export interface SaveEnvelope {
  saveVersion: number;
  gameVersion: string;
  enabledContentPacks: string[];
  campaignState: CampaignState;
  activeBattle?: BattleState;
  createdAt: string;
  updatedAt: string;
}
