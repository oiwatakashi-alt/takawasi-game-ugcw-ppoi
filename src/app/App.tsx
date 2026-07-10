import { useCallback, useEffect, useMemo, useState } from "react";
import { CAMP_SCREENS } from "./routes";
import type { ScreenId } from "./routes";
import { ResourceBar } from "../components/shared/ResourceBar";
import { ScreenTabs } from "../components/shared/ScreenTabs";
import { TheaterCommandScreen } from "../components/screens/TheaterCommandScreen";
import { ArmyCampScreen } from "../components/screens/ArmyCampScreen";
import { OfficersScreen } from "../components/screens/OfficersScreen";
import { ArmoryScreen } from "../components/screens/ArmoryScreen";
import { EngineeringWorksScreen } from "../components/screens/EngineeringWorksScreen";
import { DoctrineScreen } from "../components/screens/DoctrineScreen";
import { DeploymentScreen } from "../components/screens/DeploymentScreen";
import { BattleCommandScreen } from "../components/screens/BattleCommandScreen";
import { AfterActionScreen } from "../components/screens/AfterActionScreen";
import { rearmUnit, switchUnitWeapon, type WeaponKey } from "../game/army/equipment";
import { assignDivisionCommander, setDivisionDirective } from "../game/army/divisions";
import { assignArmyStaffOfficer } from "../game/army/headquarters";
import {
  estimateDivisionCommanderPoliticalCost,
  estimateStaffAssignmentPoliticalCost,
  spendPoliticalCost,
} from "../game/army/politicalCost";
import type { DivisionDirective, StaffSlotId } from "../game/army/types";
import { replenishUnit } from "../game/army/replenishment";
import { autoResolveSideOperation } from "../game/battle/autoResolve";
import { createBattleScenario } from "../game/battle/createBattleScenario";
import { createBattleState } from "../game/battle/createBattleState";
import { createBattleResult } from "../game/battle/results";
import type {
  BattlePosition,
  BattleResult,
  BattleState,
  BattleUnit,
  FrontlineGeometryAdjustment,
  StandingOrder,
} from "../game/battle/types";
import { applyBattleResult } from "../game/campaign/applyCampaignDelta";
import { createCampaign } from "../game/campaign/createCampaign";
import { saveDeploymentBattlePlan } from "../game/campaign/deploymentPlan";
import { assignSideOperationForce } from "../game/campaign/operationAssignments";
import {
  clearStandingOrderTemplateForUnit,
  saveStandingOrderTemplateDraftForUnit,
  saveStandingOrderTemplateForUnit,
} from "../game/campaign/standingOrderTemplates";
import {
  deleteStandingOrderPlanSet,
  overwriteStandingOrderPlanSet,
  renameStandingOrderPlanSet,
  saveStandingOrderPlanSet,
} from "../game/campaign/standingOrderPlanSets";
import type { CampaignState, CommandIssuePlan, ReserveDoctrinePlan } from "../game/campaign/types";
import type { StandingOrderPlanSetEntry } from "../game/campaign/types";
import { strategicDoctrineFromDoctrine } from "../game/doctrine/applyDoctrine";
import type { StaffIntelligenceDirectiveMode } from "../game/doctrine/types";
import { buildFortification, repairFortification } from "../game/fortifications/build";
import type { FortificationType } from "../game/fortifications/types";
import { assignOfficerToUnit, promoteOfficer, restOfficer, returnOfficerToDuty } from "../game/officers/progression";
import { clearSave, loadCampaign, saveCampaign } from "../game/save/localStorageProvider";

const tacticalTerrainProfileFromUrl = (): "high_ground_los_drill" | "reverse_slope_los_drill" | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  const profile = new URLSearchParams(window.location.search).get("takawasiTerrainProfile");
  if (profile === "high-ground") {
    return "high_ground_los_drill";
  }
  if (profile === "reverse-slope") {
    return "reverse_slope_los_drill";
  }
  return undefined;
};

export function App() {
  const [campaign, setCampaign] = useState<CampaignState>(() => loadCampaign() ?? createCampaign());
  const [screen, setScreen] = useState<ScreenId>("campaign-map");
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [lastResult, setLastResult] = useState<BattleResult | null>(null);
  const activeTacticalTerrainProfile = tacticalTerrainProfileFromUrl();

  useEffect(() => {
    saveCampaign(campaign);
  }, [campaign]);

  const currentSector = useMemo(
    () => campaign.theater.sectors.find((sector) => sector.id === campaign.theater.playerArmyPositionSectorId),
    [campaign.theater.playerArmyPositionSectorId, campaign.theater.sectors],
  );

  const startMainBattle = useCallback((
    deployedUnitIds?: string[],
    frontlineGeometry?: FrontlineGeometryAdjustment,
    reserveDoctrine?: ReserveDoctrinePlan,
    commandIssuePlan?: CommandIssuePlan,
    reserveUnitIds?: string[],
    rearGuardUnitIds?: string[],
  ) => {
    const operation = campaign.theater.mandatoryBattle ?? campaign.activeStrategicTurn.mandatoryBattle;
    const scenario = createBattleScenario(campaign, operation, {
      tacticalTerrainProfile: activeTacticalTerrainProfile,
    });
    const battleCampaign = frontlineGeometry || reserveDoctrine || commandIssuePlan || reserveUnitIds || rearGuardUnitIds
      ? saveDeploymentBattlePlan(
          campaign,
          operation.id,
          operation.sectorId,
          frontlineGeometry ?? campaign.deploymentPlan?.frontlineGeometry,
          reserveDoctrine,
          commandIssuePlan,
          reserveUnitIds,
          rearGuardUnitIds,
        )
      : campaign;
    if (frontlineGeometry || reserveDoctrine || commandIssuePlan || reserveUnitIds || rearGuardUnitIds) {
      setCampaign(battleCampaign);
    }
    setBattle(createBattleState(battleCampaign, scenario, deployedUnitIds));
    setScreen("battle");
  }, [activeTacticalTerrainProfile, campaign]);

  const completeBattle = useCallback(() => {
    if (!battle) {
      return;
    }
    setLastResult(createBattleResult(battle, campaign.turnNumber));
    setScreen("after-action");
  }, [battle, campaign.turnNumber]);

  const saveStandingOrderTemplate = useCallback((unit: BattleUnit, description?: string, frontlineSketchPoints?: BattlePosition[]) => {
    setCampaign((current) => saveStandingOrderTemplateForUnit(current, unit, description, frontlineSketchPoints));
    setBattle((current) =>
      current
        ? {
            ...current,
            log: [`${unit.name}の自律指揮方針を戦役記録へ保存。`, ...current.log].slice(0, 12),
          }
        : current,
    );
  }, []);

  const saveDeploymentStandingOrderTemplate = useCallback((unitId: string, standingOrder: StandingOrder, description?: string) => {
    setCampaign((current) => {
      const unit = current.army.units.find((candidate) => candidate.id === unitId);
      if (!unit) {
        return current;
      }
      return saveStandingOrderTemplateDraftForUnit(current, unit, standingOrder, description);
    });
  }, []);

  const saveDeploymentStandingOrderPlanSet = useCallback((
    operationId: string,
    sectorId: string,
    frontlineGeometry: FrontlineGeometryAdjustment,
    reserveDoctrine: ReserveDoctrinePlan | undefined,
    commandIssuePlan: CommandIssuePlan | undefined,
    reserveUnitIds: string[],
    rearGuardUnitIds: string[],
    entries: StandingOrderPlanSetEntry[],
  ) => {
    setCampaign((current) =>
      saveStandingOrderPlanSet(current, {
        operationId,
        sectorId,
        frontlineGeometry,
        reserveDoctrine,
        commandIssuePlan,
        reserveUnitIds,
        rearGuardUnitIds,
        entries,
      }),
    );
  }, []);

  const overwriteDeploymentStandingOrderPlanSet = useCallback((
    planSetId: string,
    operationId: string,
    sectorId: string,
    frontlineGeometry: FrontlineGeometryAdjustment,
    reserveDoctrine: ReserveDoctrinePlan | undefined,
    commandIssuePlan: CommandIssuePlan | undefined,
    reserveUnitIds: string[],
    rearGuardUnitIds: string[],
    entries: StandingOrderPlanSetEntry[],
  ) => {
    setCampaign((current) =>
      overwriteStandingOrderPlanSet(current, planSetId, {
        operationId,
        sectorId,
        frontlineGeometry,
        reserveDoctrine,
        commandIssuePlan,
        reserveUnitIds,
        rearGuardUnitIds,
        entries,
      }),
    );
  }, []);

  const renameDeploymentStandingOrderPlanSet = useCallback((planSetId: string, nextName: string) => {
    setCampaign((current) => renameStandingOrderPlanSet(current, planSetId, nextName));
  }, []);

  const deleteDeploymentStandingOrderPlanSet = useCallback((planSetId: string) => {
    setCampaign((current) => deleteStandingOrderPlanSet(current, planSetId));
  }, []);

  const clearStandingOrderTemplate = useCallback((unitId: string) => {
    setCampaign((current) => clearStandingOrderTemplateForUnit(current, unitId));
  }, []);

  const saveDeploymentBattlePlanFromScreen = useCallback((
    operationId: string,
    sectorId: string,
    frontlineGeometry: FrontlineGeometryAdjustment,
    reserveDoctrine?: ReserveDoctrinePlan,
    commandIssuePlan?: CommandIssuePlan,
    reserveUnitIds?: string[],
    rearGuardUnitIds?: string[],
  ) => {
    setCampaign((current) =>
      saveDeploymentBattlePlan(
        current,
        operationId,
        sectorId,
        frontlineGeometry,
        reserveDoctrine,
        commandIssuePlan,
        reserveUnitIds,
        rearGuardUnitIds,
      ),
    );
  }, []);

  const applyResultAndContinue = useCallback(() => {
    if (!lastResult) {
      return;
    }
    setCampaign((current) => applyBattleResult(current, lastResult));
    setBattle(null);
    setLastResult(null);
    setScreen("camp-army");
  }, [lastResult]);

  const autoResolve = useCallback((operationId: string) => {
    setCampaign((current) => autoResolveSideOperation(current, operationId).campaign);
  }, []);

  const assignSideOperation = useCallback((operationId: string, kind: "unit" | "officer", id?: string) => {
    setCampaign((current) => assignSideOperationForce(current, operationId, kind, id));
  }, []);

  const replenish = useCallback((unitId: string, mode: "rookie" | "veteran") => {
    setCampaign((current) => {
      const unit = current.army.units.find((candidate) => candidate.id === unitId);
      if (!unit) {
        return current;
      }
      const result = replenishUnit(unit, current.resources, mode, strategicDoctrineFromDoctrine(current.doctrines));
      return {
        ...current,
        resources: result.resources,
        army: {
          ...current.army,
          units: current.army.units.map((candidate) => (candidate.id === unitId ? result.unit : candidate)),
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const rearm = useCallback((unitId: string) => {
    setCampaign((current) => {
      const unit = current.army.units.find((candidate) => candidate.id === unitId);
      if (!unit) {
        return current;
      }
      const result = rearmUnit(unit, current.resources);
      return {
        ...current,
        resources: result.resources,
        army: {
          ...current.army,
          units: current.army.units.map((candidate) => (candidate.id === unitId ? result.unit : candidate)),
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const switchWeapon = useCallback((unitId: string, weaponKey: WeaponKey) => {
    setCampaign((current) => {
      const unit = current.army.units.find((candidate) => candidate.id === unitId);
      if (!unit) {
        return current;
      }
      const result = switchUnitWeapon(unit, current.resources, weaponKey);
      return {
        ...current,
        resources: result.resources,
        army: {
          ...current.army,
          units: current.army.units.map((candidate) => (candidate.id === unitId ? result.unit : candidate)),
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const promoteOfficerInCamp = useCallback((officerId: string) => {
    setCampaign((current) => {
      const result = promoteOfficer(current.officers, officerId);
      return {
        ...current,
        officers: result.officers,
        lastMessage: result.message,
      };
    });
  }, []);

  const cycleOfficerAssignment = useCallback((officerId: string) => {
    setCampaign((current) => {
      const officer = current.officers.find((candidate) => candidate.id === officerId);
      if (!officer || current.army.units.length === 0) {
        return current;
      }
      const currentIndex = Math.max(
        0,
        current.army.units.findIndex((unit) => unit.id === officer.assignedUnitId),
      );
      const nextUnit = current.army.units[(currentIndex + 1) % current.army.units.length];
      const result = assignOfficerToUnit(current.officers, current.army.units, officerId, nextUnit.id);
      return {
        ...current,
        officers: result.officers,
        army: {
          ...current.army,
          units: result.units,
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const assignOfficerInCamp = useCallback((officerId: string, unitId: string) => {
    setCampaign((current) => {
      const result = assignOfficerToUnit(current.officers, current.army.units, officerId, unitId);
      return {
        ...current,
        officers: result.officers,
        army: {
          ...current.army,
          units: result.units,
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const restOfficerInCamp = useCallback((officerId: string) => {
    setCampaign((current) => {
      const result = restOfficer(current.officers, officerId);
      return {
        ...current,
        officers: result.officers,
        lastMessage: result.message,
      };
    });
  }, []);

  const returnOfficerInCamp = useCallback((officerId: string) => {
    setCampaign((current) => {
      const result = returnOfficerToDuty(current.officers, officerId);
      return {
        ...current,
        officers: result.officers,
        lastMessage: result.message,
      };
    });
  }, []);

  const assignStaffOfficerInCamp = useCallback((slotId: StaffSlotId, officerId?: string) => {
    setCampaign((current) => {
      const cost = estimateStaffAssignmentPoliticalCost(current.army, current.officers, current.resources, slotId, officerId);
      if (!cost.canPay) {
        return {
          ...current,
          lastMessage: `${cost.summary}には威信${cost.reputationCost}が必要。現在威信${current.resources.reputation}。`,
        };
      }
      return {
        ...current,
        resources: spendPoliticalCost(current.resources, cost),
        army: assignArmyStaffOfficer(current.army, slotId, officerId),
        lastMessage: `${cost.summary}。威信-${cost.reputationCost}。`,
      };
    });
  }, []);

  const setDivisionDirectiveInCamp = useCallback((divisionId: string, directive: DivisionDirective) => {
    setCampaign((current) => ({
      ...current,
      army: setDivisionDirective(current.army, divisionId, directive),
      lastMessage: "師団命令を更新した。",
    }));
  }, []);

  const assignDivisionCommanderInCamp = useCallback((divisionId: string, officerId?: string) => {
    setCampaign((current) => {
      const cost = estimateDivisionCommanderPoliticalCost(
        current.army,
        current.officers,
        current.resources,
        divisionId,
        officerId,
      );
      if (!cost.canPay) {
        return {
          ...current,
          lastMessage: `${cost.summary}には威信${cost.reputationCost}が必要。現在威信${current.resources.reputation}。`,
        };
      }
      return {
        ...current,
        resources: spendPoliticalCost(current.resources, cost),
        army: assignDivisionCommander(current.army, divisionId, officerId),
        lastMessage: `${cost.summary}。威信-${cost.reputationCost}。`,
      };
    });
  }, []);

  const build = useCallback((type: FortificationType) => {
    setCampaign((current) => {
      const sectorId = current.theater.playerArmyPositionSectorId;
      const result = buildFortification(sectorId, type, current.resources, strategicDoctrineFromDoctrine(current.doctrines));
      if (!result.structure) {
        return { ...current, lastMessage: result.message };
      }
      return {
        ...current,
        resources: result.resources,
        theater: {
          ...current.theater,
          sectors: current.theater.sectors.map((sector) =>
            sector.id === sectorId
              ? { ...sector, structures: [...sector.structures, result.structure!] }
              : sector,
          ),
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const repair = useCallback((structureId: string) => {
    setCampaign((current) => {
      const sectorId = current.theater.playerArmyPositionSectorId;
      const sector = current.theater.sectors.find((candidate) => candidate.id === sectorId);
      const structure = sector?.structures.find((candidate) => candidate.id === structureId);
      if (!sector || !structure) {
        return current;
      }
      const result = repairFortification(structure, current.resources, strategicDoctrineFromDoctrine(current.doctrines));
      return {
        ...current,
        resources: result.resources,
        theater: {
          ...current.theater,
          sectors: current.theater.sectors.map((candidate) =>
            candidate.id === sectorId
              ? {
                  ...candidate,
                  structures: candidate.structures.map((existing) =>
                    existing.id === structureId ? result.structure : existing,
                  ),
                }
              : candidate,
          ),
        },
        lastMessage: result.message,
      };
    });
  }, []);

  const investDoctrine = useCallback((doctrineId: string) => {
    setCampaign((current) => {
      if (current.doctrines.points <= 0 || current.doctrines.unlocked.includes(doctrineId)) {
        return current;
      }
      return {
        ...current,
        doctrines: {
          ...current.doctrines,
          points: current.doctrines.points - 1,
          unlocked: [...current.doctrines.unlocked, doctrineId],
        },
        lastMessage: "参謀方針を更新した。",
      };
    });
  }, []);

  const setStaffIntelligenceDirective = useCallback((mode: StaffIntelligenceDirectiveMode) => {
    setCampaign((current) => ({
      ...current,
      doctrines: {
        ...current.doctrines,
        staffIntelligenceDirective: mode,
      },
      lastMessage: `参謀任務を更新した。`,
    }));
  }, []);

  const reset = useCallback(() => {
    clearSave();
    setCampaign(createCampaign());
    setBattle(null);
    setLastResult(null);
    setScreen("campaign-map");
  }, []);

  const renderScreen = () => {
    if (screen === "battle" && battle) {
      return (
        <BattleCommandScreen
          battle={battle}
          standingOrderTemplates={campaign.standingOrderTemplates}
          onChange={setBattle}
          onComplete={completeBattle}
          onSaveStandingOrderTemplate={saveStandingOrderTemplate}
        />
      );
    }
    if (screen === "after-action" && lastResult) {
      return <AfterActionScreen result={lastResult} onContinue={applyResultAndContinue} />;
    }
    if (screen === "deployment") {
      return (
        <DeploymentScreen
          campaign={campaign}
          tacticalTerrainProfile={activeTacticalTerrainProfile}
          onBackToCamp={() => setScreen("camp-army")}
          onOpenOfficerManagement={() => setScreen("camp-officers")}
          onStartBattle={startMainBattle}
          onSaveStandingOrderTemplate={saveDeploymentStandingOrderTemplate}
          onSaveStandingOrderPlanSet={saveDeploymentStandingOrderPlanSet}
          onOverwriteStandingOrderPlanSet={overwriteDeploymentStandingOrderPlanSet}
          onRenameStandingOrderPlanSet={renameDeploymentStandingOrderPlanSet}
          onDeleteStandingOrderPlanSet={deleteDeploymentStandingOrderPlanSet}
          onSaveDeploymentPlan={saveDeploymentBattlePlanFromScreen}
        />
      );
    }
    if (screen === "camp-army") {
      return (
        <ArmyCampScreen
          campaign={campaign}
          onRookie={(unitId) => replenish(unitId, "rookie")}
          onVeteran={(unitId) => replenish(unitId, "veteran")}
          onRearm={rearm}
          onAssignStaffOfficer={assignStaffOfficerInCamp}
          onSetDivisionDirective={setDivisionDirectiveInCamp}
          onAssignDivisionCommander={assignDivisionCommanderInCamp}
          onClearStandingOrderTemplate={clearStandingOrderTemplate}
        />
      );
    }
    if (screen === "camp-officers") {
      return (
        <OfficersScreen
          campaign={campaign}
          onPromoteOfficer={promoteOfficerInCamp}
          onCycleOfficerAssignment={cycleOfficerAssignment}
          onAssignOfficerToUnit={assignOfficerInCamp}
          onRestOfficer={restOfficerInCamp}
          onReturnOfficer={returnOfficerInCamp}
        />
      );
    }
    if (screen === "camp-armory") {
      return <ArmoryScreen campaign={campaign} onRearm={rearm} onSwitchWeapon={switchWeapon} />;
    }
    if (screen === "camp-engineering") {
      return <EngineeringWorksScreen campaign={campaign} onBuild={build} onRepair={repair} />;
    }
    if (screen === "camp-doctrine") {
      return (
        <DoctrineScreen
          campaign={campaign}
          onInvest={investDoctrine}
          onSetStaffIntelligenceDirective={setStaffIntelligenceDirective}
        />
      );
    }
    return (
      <TheaterCommandScreen
        campaign={campaign}
        onOpenCamp={() => setScreen("camp-army")}
        onAutoResolve={autoResolve}
        onAssignOperationForce={assignSideOperation}
      />
    );
  };

  return (
    <div className="app-shell">
      <ResourceBar campaign={campaign} onReset={reset} />
      {CAMP_SCREENS.includes(screen) && (
        <ScreenTabs
          current={screen}
          onChange={setScreen}
          onBackToMap={() => setScreen("campaign-map")}
          onDeployment={() => setScreen("deployment")}
        />
      )}
      <main className={`screen-host screen-host-${screen}`}>{renderScreen()}</main>
      <footer className="app-footer">
        <span>現在戦区: {currentSector?.name}</span>
        <span>保存 v{campaign.saveVersion} / ローカル保存</span>
      </footer>
    </div>
  );
}
