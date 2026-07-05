import type { CampaignState } from "./types";

type AssignmentKind = "unit" | "officer";

const setAssignedIds = (ids: string[], nextId?: string) => (nextId ? [nextId] : ids);

const removeId = (ids: string[], id?: string) => (id ? ids.filter((candidate) => candidate !== id) : ids);

export const assignSideOperationForce = (
  campaign: CampaignState,
  operationId: string,
  kind: AssignmentKind,
  id?: string,
): CampaignState => {
  const operation = campaign.activeStrategicTurn.sideOperations.find((candidate) => candidate.id === operationId);
  if (!operation || operation.resolved) {
    return campaign;
  }

  const unitId = kind === "unit" ? id : undefined;
  const officerId = kind === "officer" ? id : undefined;
  const selectedUnit = unitId ? campaign.army.units.find((unit) => unit.id === unitId) : undefined;
  const selectedOfficer =
    officerId ?? (kind === "unit" && selectedUnit?.officerId ? selectedUnit.officerId : undefined);

  const mapOperation = (candidate: typeof operation) => {
    if (candidate.id !== operationId) {
      return {
        ...candidate,
        assignedForces: {
          ...candidate.assignedForces,
          unitIds: removeId(candidate.assignedForces.unitIds, unitId),
          officerIds: removeId(candidate.assignedForces.officerIds, selectedOfficer),
        },
      };
    }

    return {
      ...candidate,
      assignedForces: {
        ...candidate.assignedForces,
        unitIds: kind === "unit" ? setAssignedIds(candidate.assignedForces.unitIds, unitId) : candidate.assignedForces.unitIds,
        officerIds:
          selectedOfficer && (kind === "unit" || kind === "officer")
            ? setAssignedIds(candidate.assignedForces.officerIds, selectedOfficer)
            : candidate.assignedForces.officerIds,
      },
    };
  };

  const sideOperations = campaign.activeStrategicTurn.sideOperations.map(mapOperation);
  const activeOperations = campaign.theater.activeOperations.map((candidate) =>
    candidate.id === campaign.activeStrategicTurn.mandatoryBattle.id
      ? candidate
      : mapOperation(candidate as typeof operation),
  );
  const assignedOperation = sideOperations.find((candidate) => candidate.id === operationId);
  const assignedUnitName = unitId ? campaign.army.units.find((unit) => unit.id === unitId)?.name : undefined;
  const assignedOfficerName = selectedOfficer ? campaign.officers.find((officer) => officer.id === selectedOfficer)?.name : undefined;

  return {
    ...campaign,
    army: {
      ...campaign.army,
      units: campaign.army.units.map((unit) => ({
        ...unit,
        assignedOperationId:
          unit.id === unitId ? operationId : unit.assignedOperationId === operationId ? undefined : unit.assignedOperationId,
      })),
    },
    officers: campaign.officers.map((officer) => ({
      ...officer,
      assignedOperationId:
        officer.id === selectedOfficer
          ? operationId
          : officer.assignedOperationId === operationId
            ? undefined
            : officer.assignedOperationId,
    })),
    theater: {
      ...campaign.theater,
      activeOperations,
    },
    activeStrategicTurn: {
      ...campaign.activeStrategicTurn,
      sideOperations,
    },
    lastMessage: `${operation.title}へ${assignedUnitName ?? assignedOfficerName ?? "戦力"}を割り当てた。${
      assignedOperation?.assignedForces.unitIds.length ? "" : "部隊未割当。"
    }`,
  };
};
