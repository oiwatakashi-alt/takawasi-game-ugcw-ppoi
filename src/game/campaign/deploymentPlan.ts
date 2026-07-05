import type { FrontlineGeometryAdjustment } from "../battle/types";
import type { CampaignState, ReserveDoctrineMode, ReserveDoctrinePlan } from "./types";

const fallbackFrontlineGeometry: FrontlineGeometryAdjustment = {
  preset: "sector_default",
  label: "戦区標準",
  description: "戦区標準の防衛線をそのまま使う。",
  forwardOffset: 0,
  lateralSpread: 1,
  depthSpacing: 1,
  controlRadiusScale: 1,
};

export const reserveDoctrinePlans: Record<ReserveDoctrineMode, ReserveDoctrinePlan> = {
  balanced: {
    mode: "balanced",
    holdReadinessUntilPressure: 520,
    counterstrokeReadinessThreshold: 58,
    notes: "標準予備。圧迫までは温存し、危険時に予備投入と局地反撃を使う。",
  },
  prepared_counterstroke: {
    mode: "prepared_counterstroke",
    holdReadinessUntilPressure: 760,
    counterstrokeReadinessThreshold: 46,
    notes: "反撃準備。予備の即応を高め、動揺/指揮崩壊した敵へ早めに局地反撃する。",
  },
  elastic_reserve: {
    mode: "elastic_reserve",
    holdReadinessUntilPressure: 380,
    counterstrokeReadinessThreshold: 64,
    notes: "弾性予備。即応より戦線穴埋めを優先し、側面圧や突破へ早めに予備投入する。",
  },
  fire_support_pool: {
    mode: "fire_support_pool",
    holdReadinessUntilPressure: 620,
    counterstrokeReadinessThreshold: 70,
    notes: "火力予備。砲兵/支援部隊を温存し、斉射支援と阻止火力を優先する。",
  },
};

export const defaultReserveDoctrinePlan = reserveDoctrinePlans.balanced;

export const reserveDoctrineLabels: Record<ReserveDoctrineMode, string> = {
  balanced: "標準予備",
  prepared_counterstroke: "反撃準備",
  elastic_reserve: "弾性予備",
  fire_support_pool: "火力予備",
};

export const saveDeploymentBattlePlan = (
  campaign: CampaignState,
  operationId: string,
  sectorId: string,
  frontlineGeometry: FrontlineGeometryAdjustment | undefined,
  reserveDoctrine: ReserveDoctrinePlan = campaign.deploymentPlan?.reserveDoctrine ?? defaultReserveDoctrinePlan,
  reserveUnitIds: string[] = [],
  rearGuardUnitIds: string[] = [],
): CampaignState => ({
  ...campaign,
  deploymentPlan: {
    operationId,
    sectorId,
    frontlineGeometry: { ...(frontlineGeometry ?? campaign.deploymentPlan?.frontlineGeometry ?? fallbackFrontlineGeometry) },
    reserveDoctrine: { ...reserveDoctrine },
    reserveUnitIds: [...new Set(reserveUnitIds)],
    rearGuardUnitIds: [...new Set(rearGuardUnitIds)],
    updatedAt: new Date().toISOString(),
  },
  saveVersion: Math.max(campaign.saveVersion, 8),
  lastMessage: `出撃戦線を${(frontlineGeometry ?? campaign.deploymentPlan?.frontlineGeometry ?? fallbackFrontlineGeometry).label}、予備運用を${reserveDoctrineLabels[reserveDoctrine.mode]}、指定予備${[...new Set(reserveUnitIds)].length}旅団、撤退後衛${[...new Set(rearGuardUnitIds)].length}旅団に調整した。`,
});

export const saveReserveDoctrinePlan = (
  campaign: CampaignState,
  operationId: string,
  sectorId: string,
  reserveDoctrine: ReserveDoctrinePlan,
): CampaignState =>
  saveDeploymentBattlePlan(
    campaign,
    operationId,
    sectorId,
    campaign.deploymentPlan?.frontlineGeometry ?? fallbackFrontlineGeometry,
    reserveDoctrine,
    campaign.deploymentPlan?.reserveUnitIds ?? [],
    campaign.deploymentPlan?.rearGuardUnitIds ?? [],
  );
