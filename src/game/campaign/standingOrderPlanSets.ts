import type { FrontlineGeometryAdjustment, StandingOrder } from "../battle/types";
import { cloneStandingOrder } from "../battle/standingOrderDrafts";
import type { CampaignState, ReserveDoctrinePlan, StandingOrderPlanSet, StandingOrderPlanSetEntry } from "./types";

interface SaveStandingOrderPlanSetInput {
  operationId: string;
  sectorId: string;
  frontlineGeometry: FrontlineGeometryAdjustment;
  reserveDoctrine?: ReserveDoctrinePlan;
  reserveUnitIds: string[];
  rearGuardUnitIds?: string[];
  entries: StandingOrderPlanSetEntry[];
}

const planSetName = (campaign: CampaignState): string => `戦線計画 ${campaign.standingOrderPlanSets.length + 1}`;

const describePlanSet = (
  entries: StandingOrderPlanSetEntry[],
  reserveUnitIds: string[],
  rearGuardUnitIds: string[] = [],
  frontlineGeometry: FrontlineGeometryAdjustment,
): string => {
  const frontlineNames = new Set(entries.map((entry) => entry.standingOrder.frontlineSegmentId ?? "未指定"));
  const sketchLineCount = Object.keys(frontlineGeometry.sketchLines ?? {}).length;
  const sketchSummary = sketchLineCount > 0 ? ` / 形状${sketchLineCount}線` : "";
  const rearGuardSummary = rearGuardUnitIds.length > 0 ? ` / ${rearGuardUnitIds.length}撤退後衛` : "";
  return `${entries.length}旅団 / ${frontlineNames.size}戦線 / ${reserveUnitIds.length}指定予備${rearGuardSummary}${sketchSummary}。出撃配置で保存した一括戦線計画。`;
};

const clonedPlanSetEntries = (entries: StandingOrderPlanSetEntry[]): StandingOrderPlanSetEntry[] =>
  entries.map((entry) => ({
    unitId: entry.unitId,
    unitName: entry.unitName,
    standingOrder: cloneStandingOrder(entry.standingOrder),
  }));

const cloneFrontlineGeometry = (frontlineGeometry: FrontlineGeometryAdjustment): FrontlineGeometryAdjustment => ({
  ...frontlineGeometry,
  segmentOverrides: frontlineGeometry.segmentOverrides
    ? Object.fromEntries(
        Object.entries(frontlineGeometry.segmentOverrides).map(([segmentId, override]) => [
          segmentId,
          {
            ...override,
            anchorOffset: override.anchorOffset ? { ...override.anchorOffset } : undefined,
            fallbackOffset: override.fallbackOffset ? { ...override.fallbackOffset } : undefined,
            zoneOffset: override.zoneOffset ? { ...override.zoneOffset } : undefined,
            zoneSizeOffset: override.zoneSizeOffset ? { ...override.zoneSizeOffset } : undefined,
            deploymentLimitOffset: override.deploymentLimitOffset ? { ...override.deploymentLimitOffset } : undefined,
            deploymentLimitSizeOffset: override.deploymentLimitSizeOffset
              ? { ...override.deploymentLimitSizeOffset }
              : undefined,
          },
        ]),
      )
    : undefined,
  sketchLines: frontlineGeometry.sketchLines
    ? Object.fromEntries(
        Object.entries(frontlineGeometry.sketchLines).map(([segmentId, points]) => [
          segmentId,
          points.map((point) => ({ ...point })),
        ]),
      )
    : undefined,
});

const buildPlanSet = (
  campaign: CampaignState,
  input: SaveStandingOrderPlanSetInput,
  existing?: StandingOrderPlanSet,
): StandingOrderPlanSet => {
  const now = new Date().toISOString();
  const entries = clonedPlanSetEntries(input.entries);
  return {
    id: existing?.id ?? `standing-plan-${campaign.turnNumber}-${Date.now()}`,
    name: existing?.name ?? planSetName(campaign),
    description: describePlanSet(entries, input.reserveUnitIds, input.rearGuardUnitIds, input.frontlineGeometry),
    operationId: input.operationId,
    sectorId: input.sectorId,
    frontlineGeometry: cloneFrontlineGeometry(input.frontlineGeometry),
    reserveDoctrine: input.reserveDoctrine,
    reserveUnitIds: [...input.reserveUnitIds],
    rearGuardUnitIds: [...(input.rearGuardUnitIds ?? [])],
    entries,
    updatedAt: now,
  };
};

export const saveStandingOrderPlanSet = (
  campaign: CampaignState,
  input: SaveStandingOrderPlanSetInput,
): CampaignState => {
  const planSet = buildPlanSet(campaign, input);

  return {
    ...campaign,
    standingOrderPlanSets: [planSet, ...(campaign.standingOrderPlanSets ?? [])].slice(0, 8),
    saveVersion: Math.max(campaign.saveVersion, 7),
    lastMessage: `${planSet.name}を保存した。`,
  };
};

export const overwriteStandingOrderPlanSet = (
  campaign: CampaignState,
  planSetId: string,
  input: SaveStandingOrderPlanSetInput,
): CampaignState => {
  const existing = campaign.standingOrderPlanSets.find((planSet) => planSet.id === planSetId);
  if (!existing) {
    return campaign;
  }
  const planSet = buildPlanSet(campaign, input, existing);
  return {
    ...campaign,
    standingOrderPlanSets: campaign.standingOrderPlanSets.map((candidate) =>
      candidate.id === planSetId ? planSet : candidate,
    ),
    saveVersion: Math.max(campaign.saveVersion, 7),
    lastMessage: `${planSet.name}を現在の出撃計画で上書きした。`,
  };
};

export const renameStandingOrderPlanSet = (
  campaign: CampaignState,
  planSetId: string,
  nextName: string,
): CampaignState => {
  const cleanName = nextName.trim();
  if (!cleanName) {
    return campaign;
  }
  let renamed = false;
  const standingOrderPlanSets = campaign.standingOrderPlanSets.map((planSet) => {
    if (planSet.id !== planSetId) {
      return planSet;
    }
    renamed = true;
    return {
      ...planSet,
      name: cleanName,
      updatedAt: new Date().toISOString(),
    };
  });
  return renamed
    ? {
        ...campaign,
        standingOrderPlanSets,
        saveVersion: Math.max(campaign.saveVersion, 7),
        lastMessage: `${cleanName}へ戦線計画名を変更した。`,
      }
    : campaign;
};

export const deleteStandingOrderPlanSet = (campaign: CampaignState, planSetId: string): CampaignState => {
  const target = campaign.standingOrderPlanSets.find((planSet) => planSet.id === planSetId);
  if (!target) {
    return campaign;
  }
  return {
    ...campaign,
    standingOrderPlanSets: campaign.standingOrderPlanSets.filter((planSet) => planSet.id !== planSetId),
    saveVersion: Math.max(campaign.saveVersion, 7),
    lastMessage: `${target.name}を削除した。`,
  };
};

export const standingOrderPlanSetEntryForUnit = (
  entries: StandingOrderPlanSetEntry[],
  unitId: string,
): StandingOrder | undefined => entries.find((entry) => entry.unitId === unitId)?.standingOrder;
