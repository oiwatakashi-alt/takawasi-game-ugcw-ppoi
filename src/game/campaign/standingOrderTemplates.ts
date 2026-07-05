import type { BattlePosition, BattleUnit, StandingOrder, StandingOrderTemplate } from "../battle/types";
import { cloneStandingOrder } from "../battle/standingOrderDrafts";
import type { CampaignState } from "./types";

export const savedTemplateForUnit = (
  campaign: CampaignState,
  unitId: string,
): StandingOrderTemplate | undefined =>
  campaign.standingOrderTemplates.find((template) => template.createdFromUnitId === unitId);

export const saveStandingOrderTemplateDraftForUnit = (
  campaign: CampaignState,
  unit: { id: string; name: string },
  standingOrder: StandingOrder,
  description = "出撃配置で調整した自律指揮方針。次回主戦場の初期配置へ適用する。",
  frontlineSketchPoints?: BattlePosition[],
): CampaignState => {
  const now = new Date().toISOString();
  const template: StandingOrderTemplate = {
    id: `standing-template-${unit.id}`,
    name: `${unit.name} 標準方針`,
    description,
    standingOrder: cloneStandingOrder(standingOrder),
    frontlineSketchPoints: frontlineSketchPoints?.map((point) => ({ ...point })),
    createdFromUnitId: unit.id,
    updatedAt: now,
  };

  return {
    ...campaign,
    standingOrderTemplates: [
      template,
      ...campaign.standingOrderTemplates.filter((existing) => existing.createdFromUnitId !== unit.id),
    ].slice(0, 32),
    saveVersion: Math.max(campaign.saveVersion, 6),
    lastMessage: `${unit.name}の自律指揮方針を保存した。`,
  };
};

export const saveStandingOrderTemplateForUnit = (
  campaign: CampaignState,
  unit: Pick<BattleUnit, "unitId" | "name" | "standingOrder">,
  description = "戦闘中に保存した自律指揮方針。次回主戦場の初期配置へ適用する。",
  frontlineSketchPoints?: BattlePosition[],
): CampaignState =>
  saveStandingOrderTemplateDraftForUnit(
    campaign,
    { id: unit.unitId, name: unit.name },
    unit.standingOrder,
    description,
    frontlineSketchPoints,
  );

export const clearStandingOrderTemplateForUnit = (
  campaign: CampaignState,
  unitId: string,
): CampaignState => {
  const unit = campaign.army.units.find((candidate) => candidate.id === unitId);
  const standingOrderTemplates = campaign.standingOrderTemplates.filter(
    (template) => template.createdFromUnitId !== unitId,
  );
  if (standingOrderTemplates.length === campaign.standingOrderTemplates.length) {
    return campaign;
  }

  return {
    ...campaign,
    standingOrderTemplates,
    saveVersion: Math.max(campaign.saveVersion, 6),
    lastMessage: `${unit?.name ?? "選択旅団"}の標準方針を解除した。戦術教訓と部隊史は保持される。`,
  };
};
