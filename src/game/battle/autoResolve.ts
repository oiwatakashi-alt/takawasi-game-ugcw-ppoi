import { weaponDefinitions } from "../../content/baseGame/weapons";
import type { CampaignState } from "../campaign/types";
import { strategicDoctrineFromDoctrine } from "../doctrine/applyDoctrine";
import { addResources, canAfford, spendResources } from "../logistics/spend";
import { woundOfficer } from "../officers/progression";
import { applyOperationPressure, updateOperation } from "../theater/resolveOperation";
import { calculateReconQuality, reconQualityLabel } from "../theater/reconQuality";
import { applyReconIntelToOperation } from "../theater/spoilsIntel";
import type { StrategicOperation } from "../theater/types";

export interface AutoResolveResult {
  campaign: CampaignState;
  message: string;
}

const chooseDefaultForces = (campaign: CampaignState, operation: StrategicOperation): StrategicOperation => {
  if (operation.assignedForces.unitIds.length > 0) {
    return operation;
  }

  const preferred =
    operation.type === "engineerWorks"
      ? "engineer"
      : operation.type === "reconPatrol"
        ? "jaeger"
        : operation.type === "railRepair"
          ? "engineer"
          : "infantry";

  const unit =
    campaign.army.units.find((candidate) => candidate.type === preferred && !candidate.assignedOperationId) ??
    campaign.army.units.find((candidate) => !candidate.assignedOperationId) ??
    campaign.army.units[0];
  const officer = campaign.officers.find((candidate) => candidate.id === unit.officerId);

  return {
    ...operation,
    assignedForces: {
      ...operation.assignedForces,
      unitIds: [unit.id],
      officerIds: officer ? [officer.id] : [],
    },
  };
};

const outcomeLabel = (outcome: "victory" | "draw" | "defeat") =>
  outcome === "victory" ? "成功" : outcome === "draw" ? "痛み分け" : "失敗";

const spoilsFactorForOutcome = (outcome: "victory" | "draw" | "defeat") =>
  outcome === "victory" ? 0.78 : outcome === "draw" ? 0.34 : 0;

const formatSpoilsMessage = (spoilsWeapons: Record<string, number>) =>
  Object.entries(spoilsWeapons)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key in weaponDefinitions ? weaponDefinitions[key as keyof typeof weaponDefinitions].name : key}+${value}`)
    .join(" / ") || "なし";

export const autoResolveSideOperation = (
  campaign: CampaignState,
  operationId: string,
): AutoResolveResult => {
  const operation = campaign.theater.activeOperations.find((candidate) => candidate.id === operationId);
  if (!operation) {
    return { campaign, message: "作戦が見つからない。" };
  }
  if (operation.isMandatory || !operation.canAutoResolve) {
    return { campaign, message: "主戦場は自動解決できない。" };
  }
  if (operation.resolved) {
    return { campaign, message: `${operation.title}はすでに解決済み。` };
  }
  if (!canAfford(campaign.resources, operation.cost)) {
    return { campaign, message: `${operation.title}に必要な資源が足りない。` };
  }

  const assignedOperation = chooseDefaultForces(campaign, operation);
  const assignedUnits = campaign.army.units.filter((unit) =>
    assignedOperation.assignedForces.unitIds.includes(unit.id),
  );
  const strategicDoctrine = strategicDoctrineFromDoctrine(campaign.doctrines);
  const reconQuality =
    assignedOperation.type === "reconPatrol"
      ? calculateReconQuality(campaign, assignedOperation, strategicDoctrine.autoResolveQualityBonus)
      : undefined;
  const quality =
    assignedUnits.reduce(
      (sum, unit) => sum + unit.experience + unit.morale + unit.condition + unit.soldiers / 20,
      0,
    ) /
      Math.max(1, assignedUnits.length) +
    strategicDoctrine.autoResolveQualityBonus;
  const riskScore = assignedOperation.risk * 220;
  const outcome = quality > riskScore + 28 ? "victory" : quality > riskScore - 20 ? "draw" : "defeat";
  const effects =
    outcome === "victory"
      ? assignedOperation.victoryEffects
      : outcome === "draw"
        ? assignedOperation.drawEffects
        : assignedOperation.defeatEffects;

  let resources = spendResources(campaign.resources, assignedOperation.cost);
  resources = addResources(resources, effects.resourceDelta ?? {});
  const spoilsFactor = spoilsFactorForOutcome(outcome);
  const recoveryMultiplier = assignedOperation.spoilsIntel?.recoveryMultiplier ?? 1;
  const spoilsWeapons = Object.fromEntries(
    Object.entries(assignedOperation.spoilsIntel?.expectedWeapons ?? {}).map(([key, value]) => [
      key,
      Math.max(0, Math.round(value * spoilsFactor * recoveryMultiplier)),
    ]),
  );
  const supplyCache = assignedOperation.spoilsIntel?.supplyCache;
  resources = {
    ...resources,
    ammunition: Math.max(0, resources.ammunition + Math.round((supplyCache?.ammunition ?? 0) * spoilsFactor * recoveryMultiplier)),
    supplies: Math.max(0, resources.supplies + Math.round((supplyCache?.supplies ?? 0) * spoilsFactor * recoveryMultiplier)),
    materials: Math.max(0, resources.materials + Math.round((supplyCache?.materials ?? 0) * spoilsFactor * recoveryMultiplier)),
    weapons: {
      ...resources.weapons,
      ...Object.fromEntries(
        Object.entries(spoilsWeapons).map(([key, value]) => [key, (resources.weapons[key] ?? 0) + value]),
      ),
    },
  };
  resources = {
    ...resources,
    reputation: Math.max(0, resources.reputation + (effects.reputationDelta ?? 0)),
  };

  const units = campaign.army.units.map((unit) => {
    if (!assignedOperation.assignedForces.unitIds.includes(unit.id)) {
      return unit;
    }
    const baseLossRate =
      outcome === "victory"
        ? assignedOperation.risk * 0.025
        : outcome === "draw"
          ? assignedOperation.risk * 0.045
          : assignedOperation.risk * 0.075;
    const lossRate = baseLossRate * (campaign.doctrines.unlocked.includes("medicine") ? 0.92 : 1);
    const losses = Math.round(unit.soldiers * lossRate);
    return {
      ...unit,
      soldiers: Math.max(0, unit.soldiers - losses),
      condition: Math.max(20, unit.condition - (outcome === "victory" ? 8 : 16)),
      morale: Math.max(20, unit.morale + (outcome === "victory" ? 2 : outcome === "draw" ? -2 : -6)),
      experience: unit.experience + (outcome === "victory" ? 4 : 2),
      assignedOperationId: undefined,
      battleHistory: [`${assignedOperation.title}: ${outcomeLabel(outcome)}、損耗${losses}`, ...unit.battleHistory].slice(0, 8),
    };
  });

  const officers = campaign.officers.map((officer) => {
    if (!assignedOperation.assignedForces.officerIds.includes(officer.id)) {
      return officer;
    }
    return outcome === "defeat" && assignedOperation.risk > 0.35
      ? woundOfficer(officer, 2)
      : {
          ...officer,
          assignedOperationId: undefined,
          experience: officer.experience + (outcome === "victory" ? 3 : 1),
          history: [`${assignedOperation.title}: ${outcomeLabel(outcome)}`, ...officer.history].slice(0, 8),
        };
  });

  const resolvedOperation: StrategicOperation = {
    ...assignedOperation,
    resolved: true,
    outcome,
  };

  let theater = updateOperation(campaign.theater, resolvedOperation);
  theater = applyOperationPressure(theater, resolvedOperation, outcome);
  if (resolvedOperation.type === "reconPatrol") {
    theater = {
      ...theater,
      activeOperations: theater.activeOperations.map((candidate) =>
        applyReconIntelToOperation(candidate, resolvedOperation, outcome, reconQuality ?? 50),
      ),
      mandatoryBattle: theater.mandatoryBattle
        ? applyReconIntelToOperation(theater.mandatoryBattle, resolvedOperation, outcome, reconQuality ?? 50)
        : theater.mandatoryBattle,
    };
  }

  const refreshedOperation = theater.activeOperations.find((candidate) => candidate.id === resolvedOperation.id) ?? resolvedOperation;

  return {
    campaign: {
      ...campaign,
      resources,
      army: { ...campaign.army, units },
      officers,
      theater,
      activeStrategicTurn: {
        ...campaign.activeStrategicTurn,
        mandatoryBattle:
          theater.mandatoryBattle?.id === campaign.activeStrategicTurn.mandatoryBattle.id
            ? theater.mandatoryBattle
            : campaign.activeStrategicTurn.mandatoryBattle,
        sideOperations: campaign.activeStrategicTurn.sideOperations.map((candidate) =>
          theater.activeOperations.find((operation) => operation.id === candidate.id) ?? candidate,
        ),
      },
      lastMessage: `${refreshedOperation.title}は自動解決で${outcomeLabel(outcome)}（${strategicDoctrine.label}）。戦利品 ${formatSpoilsMessage(spoilsWeapons)}。${
        resolvedOperation.type === "reconPatrol" && outcome !== "defeat"
          ? ` ${reconQualityLabel(reconQuality ?? 50)}${reconQuality ?? 50}: 同ターン作戦の戦利品情報を照合した。`
          : resolvedOperation.type === "reconPatrol"
            ? ` ${reconQualityLabel(reconQuality ?? 50)}${reconQuality ?? 50}: 偵察線が乱れ、同ターン作戦の情報に誤差が残った。`
            : ""
      }`,
    },
    message: `${refreshedOperation.title}は自動解決で${outcomeLabel(outcome)}（${strategicDoctrine.label}）。`,
  };
};
