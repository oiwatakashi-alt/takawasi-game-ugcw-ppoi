import type { CampaignState } from "../campaign/types";

export interface SaveEnvelope {
  saveVersion: number;
  gameVersion: string;
  enabledContentPacks: string[];
  campaignState: CampaignState;
  createdAt: string;
  updatedAt: string;
}
