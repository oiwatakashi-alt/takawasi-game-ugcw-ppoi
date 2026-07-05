import type { CampaignState } from "../campaign/types";
import { CURRENT_SAVE_VERSION, migrateSave } from "./migrations";
import type { SaveEnvelope } from "./types";

const SAVE_KEY = "takawasi-game-save";
const GAME_VERSION = "0.1.0";

export const createSaveEnvelope = (campaignState: CampaignState, existing?: SaveEnvelope): SaveEnvelope => {
  const now = new Date().toISOString();
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    gameVersion: GAME_VERSION,
    enabledContentPacks: ["baseGame"],
    campaignState,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
};

export const saveCampaign = (campaignState: CampaignState): void => {
  const existing = loadSaveEnvelope();
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(createSaveEnvelope(campaignState, existing ?? undefined)));
};

export const loadSaveEnvelope = (): SaveEnvelope | null => {
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return migrateSave(JSON.parse(raw) as SaveEnvelope);
  } catch {
    return null;
  }
};

export const loadCampaign = (): CampaignState | null => loadSaveEnvelope()?.campaignState ?? null;

export const clearSave = (): void => {
  window.localStorage.removeItem(SAVE_KEY);
};
