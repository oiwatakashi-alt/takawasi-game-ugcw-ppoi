import type { BattleResult } from "../battle/types";
import { commandDutyLoadByOfficer } from "../army/commandDuty";
import { normalizeStaffAssignments } from "../army/headquarters";
import { addResources } from "../logistics/spend";
import { recoverOfficers } from "../officers/progression";
import { strategicDoctrineFromDoctrine } from "../doctrine/applyDoctrine";
import { applyStrategicTurnToTheater, generateStrategicTurn } from "../theater/generateStrategicTurn";
import { calculateStrategicIntelPreparation } from "../theater/reconQuality";
import type { CampaignState } from "./types";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const outcomeLabel = (outcome: BattleResult["outcome"]) =>
  outcome === "hold" ? "防衛成功" : outcome === "withdraw" ? "戦闘撤退" : "戦線崩壊";

export const applyBattleResult = (campaign: CampaignState, result: BattleResult): CampaignState => {
  const intelligenceSummary = result.intelligenceEvents[0];
  const staffAccountabilitySummary = result.staffAccountabilityEvents[0]?.summary;
  const staffAdvisorySummary = result.staffAdvisoryOutcomes[0]?.summary;
  const enemyCommandEffectSummary = result.enemyCommandEffectOutcomes[0]?.effectLabel;
  const objectiveEventResponseSummary = result.objectiveEventResponseOutcomes[0]?.summary;
  const commandTransmissionSummary = result.commandTransmissionOutcomes[0]?.summary;
  const withdrawalPursuitSummary = result.withdrawalPursuitSummary;
  const objectiveSummary = result.objectiveOutcome.events.join(" ");
  const resources = addResources(
    addResources(
      {
        ...campaign.resources,
        weapons: {
          ...campaign.resources.weapons,
          ...Object.fromEntries(
            Object.entries(result.capturedWeapons).map(([key, value]) => [
              key,
              (campaign.resources.weapons[key] ?? 0) + value,
            ]),
          ),
        },
        ammunition: Math.max(0, campaign.resources.ammunition - Math.round(result.ammoSpent)),
        supplies: Math.max(0, campaign.resources.supplies - result.supplySpent - result.medicalSupplySpent),
      },
      result.objectiveOutcome.resourceDelta,
    ),
    {
      gold: result.outcome === "hold" ? 90 : result.outcome === "withdraw" ? 45 : 10,
      recruits: result.outcome === "hold" ? 80 : 35,
      reputation: result.outcome === "hold" ? 2 : result.outcome === "withdraw" ? 0 : -4,
    },
  );

  const units = campaign.army.units.map((unit) => {
    const casualties = result.casualtiesByUnit[unit.id] ?? 0;
    const xp = result.xpByUnit[unit.id] ?? 0;
    const equipmentWear = result.equipmentWearByUnit[unit.id] ?? 0;
    const medicalRecovery = result.medicalRecoveryDetails.find((entry) => entry.unitId === unit.id);
    const role = result.battleRoleByUnit[unit.id] ?? "戦線勤務";
    const commendations = result.commendationsByUnit[unit.id] ?? [];
    const staffAdvisoryEntries = result.staffAdvisoryOutcomes
      .filter((outcome) => outcome.unitIds.includes(unit.id))
      .map((outcome) => `参謀警告対応 ${outcome.segmentName}/${outcome.presetLabel}/${outcome.resultLabel}`);
    const objectiveEventEntries = result.objectiveEventResponseOutcomes
      .filter((outcome) => outcome.unitId === unit.id)
      .map(
        (outcome) =>
          `目標イベント対応 ${outcome.objectiveLabel}/${outcome.eventLabel}/${outcome.eventChainLabel}/${outcome.resultLabel}/${outcome.lessonTag}/支配${outcome.finalControl}%`,
      );
    const enemyCommandEffectEntries = result.enemyCommandEffectOutcomes
      .filter((outcome) => outcome.unitIds.includes(unit.id))
      .map(
        (outcome) =>
          `指揮網効果 ${outcome.roleLabel}/${outcome.resultLabel}/${outcome.lessonTag}/${outcome.metricLabel}`,
      );
    const commandTransmissionEntries = result.commandTransmissionOutcomes
      .filter((outcome) => outcome.unitId === unit.id)
      .map(
        (outcome) =>
          `伝令評価 ${outcome.orderLabel}/${outcome.delaySeconds}秒/${outcome.assessment}${
            outcome.congestionDelaySeconds > 0 ? `/混線+${outcome.congestionDelaySeconds}秒` : ""
          }/${outcome.arrived ? "到達" : "未着"}`,
      );
    const rearGuardPlan = result.withdrawalRearGuardPlanAssessments.find((entry) => entry.unitId === unit.id);
    const withdrawalRearGuardEntries = result.withdrawalRearGuard
      .filter((entry) => entry.unitId === unit.id)
      .map(
        (entry) =>
          `撤退後衛 ${entry.roleLabel}/追撃被害${entry.pursuitDamagePrevented}抑止/後衛損耗${entry.rearGuardCasualties}/${entry.riskLabel}${
            rearGuardPlan
              ? `/予測損耗${rearGuardPlan.predictedCasualties}->実${entry.rearGuardCasualties}/予測将校危険${rearGuardPlan.predictedOfficerRisk}/抑止${rearGuardPlan.pursuitCover}`
              : ""
          }/${entry.reason}`,
      );
    return {
      ...unit,
      soldiers: Math.max(0, unit.soldiers - casualties),
      experience: unit.experience + xp,
      level: unit.experience + xp >= unit.level * 55 ? unit.level + 1 : unit.level,
      weaponQuality: Number(Math.max(0.62, unit.weaponQuality - equipmentWear).toFixed(2)),
      morale: Math.max(20, Math.min(100, unit.morale + (result.outcome === "hold" ? 3 : result.outcome === "withdraw" ? -2 : -8))),
      condition: Math.max(25, unit.condition - (result.outcome === "hold" ? 10 : 16)),
      ammo: Math.max(0, unit.ammo - Math.round(result.ammoSpent / Math.max(1, campaign.army.units.length))),
      battleHistory: [
        `${result.title}: ${outcomeLabel(result.outcome)}、${role}、永久損耗${casualties}、収容${result.recoveredByUnit[unit.id] ?? 0}、経験+${xp}、装備摩耗-${equipmentWear.toFixed(2)}${
          commendations.length > 0 ? `、${commendations.join("・")}` : ""
        }${
          medicalRecovery && medicalRecovery.bonusRecovered > 0
            ? `、救護線 追加収容+${medicalRecovery.bonusRecovered}/${medicalRecovery.reason}`
            : ""
        }${staffAdvisoryEntries.length > 0 ? `、${staffAdvisoryEntries.join("・")}` : ""}${
          objectiveEventEntries.length > 0 ? `、${objectiveEventEntries.join("・")}` : ""
        }${
          enemyCommandEffectEntries.length > 0 ? `、${enemyCommandEffectEntries.join("・")}` : ""
        }${
          commandTransmissionEntries.length > 0 ? `、${commandTransmissionEntries.join("・")}` : ""
        }${
          withdrawalRearGuardEntries.length > 0 ? `、${withdrawalRearGuardEntries.join("・")}` : ""
        }${
          intelligenceSummary ? "、敵情誤認下で交戦" : ""
        }`,
        ...unit.battleHistory,
      ].slice(0, 8),
    };
  });

  const theaterBeforeTurn = {
    ...campaign.theater,
    turnNumber: campaign.theater.turnNumber + 1,
    enemyMomentum: Math.max(
      0,
      campaign.theater.enemyMomentum +
        (result.outcome === "hold" ? -1 : result.outcome === "withdraw" ? 1 : 4) +
        result.objectiveOutcome.enemyMomentumDelta,
    ),
    globalThreat: Math.max(
      0,
      campaign.theater.globalThreat +
        (result.outcome === "hold" ? -2 : result.outcome === "withdraw" ? 1 : 6) +
        result.objectiveOutcome.globalThreatDelta,
    ),
    sectors: campaign.theater.sectors.map((sector) => {
      if (sector.id !== campaign.theater.playerArmyPositionSectorId) {
        return sector;
      }
      return {
        ...sector,
        enemyPressure: Math.max(
          0,
          sector.enemyPressure +
            (result.outcome === "hold" ? -5 : result.outcome === "withdraw" ? 4 : 12) +
            result.objectiveOutcome.enemyPressureDelta,
        ),
        structures: sector.structures.map((structure) => {
          const damage = result.structureDamage[structure.id] ?? 0;
          const durability = Math.max(0, structure.durability - damage);
          return {
            ...structure,
            durability,
            status: durability <= 0 ? "overrun" : durability < structure.maxDurability * 0.5 ? "damaged" : structure.status,
            history: damage > 0 ? [`戦闘損傷 ${damage}`, ...structure.history].slice(0, 6) : structure.history,
          };
        }),
        history: [`${result.campaignMessage} ${objectiveSummary}`, ...sector.history].slice(0, 8),
      };
    }),
    strategicHistory: [`${result.campaignMessage} ${objectiveSummary}`, ...campaign.theater.strategicHistory].slice(0, 12),
  };

  const commandDutyLoads = commandDutyLoadByOfficer(campaign.army);
  const chiefOfStaffOfficerId = normalizeStaffAssignments(campaign.army.formations[0]?.staffAssignments).find(
    (assignment) => assignment.slotId === "chiefOfStaff",
  )?.officerId;
  const commandTransmissionCongestedCount = result.commandTransmissionOutcomes.filter(
    (outcome) => outcome.congestionDelaySeconds > 0,
  ).length;
  const commandTransmissionUnarrivedCount = result.commandTransmissionOutcomes.filter((outcome) => !outcome.arrived).length;
  const commandTransmissionMaxDelay = result.commandTransmissionOutcomes.reduce(
    (max, outcome) => Math.max(max, outcome.delaySeconds),
    0,
  );
  const officers = recoverOfficers(campaign.officers).map((officer) => {
    const brigadeXp = result.officerXpById[officer.id] ?? 0;
    const divisionXp = result.divisionCommanderXpById[officer.id] ?? 0;
    const staffAccountabilityEntries = result.staffAccountabilityEvents.filter((event) => event.officerId === officer.id);
    const staffAccountabilityXp = staffAccountabilityEntries.reduce((sum, event) => sum + event.xpDelta, 0);
    const wasBrigadeWounded = result.woundedOfficerIds.includes(officer.id);
    const wasDivisionWounded = result.divisionCommanderWoundedOfficerIds.includes(officer.id);
    const wasWounded = wasBrigadeWounded || wasDivisionWounded;
    const learnedFromMisinformation = result.intelligenceLessonOfficerIds.includes(officer.id);
    const unitName = result.officerUnitNamesById[officer.id] ?? "所属部隊";
    const commandedUnit = campaign.army.units.find((unit) => unit.officerId === officer.id);
    const commandTransmissionEntries = commandedUnit
      ? result.commandTransmissionOutcomes.filter((outcome) => outcome.unitId === commandedUnit.id)
      : [];
    const unitCommandTransmissionCongestedCount = commandTransmissionEntries.filter(
      (outcome) => outcome.congestionDelaySeconds > 0,
    ).length;
    const unitCommandTransmissionUnarrivedCount = commandTransmissionEntries.filter((outcome) => !outcome.arrived).length;
    const unitCommandTransmissionMaxDelay = commandTransmissionEntries.reduce(
      (max, outcome) => Math.max(max, outcome.delaySeconds),
      0,
    );
    const commandTransmissionFatigue =
      commandTransmissionEntries.length > 0
        ? Math.min(
            5,
            Math.ceil(unitCommandTransmissionCongestedCount / 2) + Math.min(2, unitCommandTransmissionUnarrivedCount),
          )
        : 0;
    const commandTransmissionXp = unitCommandTransmissionCongestedCount > 0 || unitCommandTransmissionUnarrivedCount > 0 ? 1 : 0;
    const staffCommandTransmissionFatigue =
      officer.id === chiefOfStaffOfficerId && result.commandTransmissionOutcomes.length > 0
        ? Math.min(6, Math.ceil(commandTransmissionCongestedCount / 2) + Math.min(3, commandTransmissionUnarrivedCount))
        : 0;
    const staffCommandTransmissionXp = staffCommandTransmissionFatigue > 0 ? 1 : 0;
    const xp = brigadeXp + divisionXp + staffAccountabilityXp + commandTransmissionXp + staffCommandTransmissionXp;
    const rearGuardEntry = commandedUnit
      ? result.withdrawalRearGuard.find((entry) => entry.unitId === commandedUnit.id)
      : undefined;
    const risk = result.officerRiskById[officer.id] ?? 0;
    const divisionName = result.divisionCommanderNamesById[officer.id];
    const divisionRisk = result.divisionCommanderRiskById[officer.id] ?? 0;
    const activeForBattleDuty = officer.status === "active";
    const dutyFatigue = activeForBattleDuty ? Math.ceil((commandDutyLoads[officer.id] ?? 0) / 45) : 0;
    const commandPressure = Math.ceil((risk + divisionRisk) / 18);
    const outcomeFatigue = xp > 0 ? (result.outcome === "collapse" ? 6 : result.outcome === "withdraw" ? 3 : 1) : 0;
    const staffAccountabilityFatigue = staffAccountabilityEntries.reduce((sum, event) => sum + event.fatigueDelta, 0);
    const fatigueGain =
      dutyFatigue +
      staffAccountabilityFatigue +
      commandTransmissionFatigue +
      staffCommandTransmissionFatigue +
      (xp > 0 ? Math.ceil(xp * 0.7) + commandPressure + outcomeFatigue : 0);
    const commandFatigue = clamp((officer.commandFatigue ?? 0) + fatigueGain, 0, 100);
    const history = [
      ...staffAccountabilityEntries.map(
        (event) =>
          `${result.title}: ${event.slotLabel} ${event.resultLabel}、${event.triggerLabel}、${event.lessonTag}、経験+${event.xpDelta}、疲労+${event.fatigueDelta}`,
      ),
      ...(staffCommandTransmissionFatigue > 0
        ? [
            `${result.title}: 参謀長 警告、伝令混線、全軍発令${result.commandTransmissionOutcomes.length}件、混線${commandTransmissionCongestedCount}件、未着${commandTransmissionUnarrivedCount}件、最長${commandTransmissionMaxDelay}秒、経験+${staffCommandTransmissionXp}、疲労+${staffCommandTransmissionFatigue}`,
          ]
        : []),
      ...(learnedFromMisinformation ? [`${result.title}: 敵情誤認対応、偵察教訓を記録`] : []),
      ...(commandTransmissionFatigue > 0
        ? [
            `${result.title}: 伝令混線 ${unitName}、発令${commandTransmissionEntries.length}件、混線${unitCommandTransmissionCongestedCount}件、未着${unitCommandTransmissionUnarrivedCount}件、最長${unitCommandTransmissionMaxDelay}秒、経験+${commandTransmissionXp}、疲労+${commandTransmissionFatigue}`,
          ]
        : []),
      ...(fatigueGain >= 4 ? [`${result.title}: 指揮疲労+${fatigueGain}（累積${commandFatigue}）`] : []),
      ...(divisionXp > 0 && divisionName
        ? [`${result.title}: ${divisionName}師団指揮、経験+${divisionXp}、危険度${divisionRisk}${wasDivisionWounded ? "、指揮所負傷" : ""}`]
        : []),
      ...(brigadeXp > 0
        ? [
            `${result.title}: ${unitName}指揮、経験+${brigadeXp}、危険度${risk}${
              rearGuardEntry ? `、撤退後衛${rearGuardEntry.riskLabel}、後衛損耗${rearGuardEntry.rearGuardCasualties}` : ""
            }${wasBrigadeWounded ? "、負傷" : ""}`,
          ]
        : []),
      ...officer.history,
    ].slice(0, 8);
    return {
      ...officer,
      status: wasWounded ? "wounded" : officer.status,
      recoveryTurns: wasWounded ? 2 : officer.recoveryTurns,
      assignedOperationId: fatigueGain > 0 || xp > 0 || wasWounded ? undefined : officer.assignedOperationId,
      experience: officer.experience + xp,
      commandFatigue,
      history,
    };
  });
  const strategicDoctrine = strategicDoctrineFromDoctrine(campaign.doctrines);
  const intelligencePreparation = calculateStrategicIntelPreparation(
    units,
    officers,
    strategicDoctrine.strategicIntelPreparationBonus,
    strategicDoctrine.initialIntelConfidenceShiftBonus + result.objectiveOutcome.intelConfidenceShift,
  );
  const nextTurn = generateStrategicTurn(theaterBeforeTurn, { intelligencePreparation });

  return {
    ...campaign,
    turnNumber: campaign.turnNumber + 1,
    resources,
    army: { ...campaign.army, units },
    officers,
    theater: applyStrategicTurnToTheater(theaterBeforeTurn, nextTurn),
    activeStrategicTurn: nextTurn,
    battleHistory: [
      {
        id: result.id,
        title: result.title,
        outcome: result.outcome,
        turnNumber: result.turnNumber,
        summary:
          intelligenceSummary ||
          staffAccountabilitySummary ||
          staffAdvisorySummary ||
          enemyCommandEffectSummary ||
          objectiveEventResponseSummary ||
          commandTransmissionSummary ||
          withdrawalPursuitSummary ||
          objectiveSummary
            ? `${result.campaignMessage} ${objectiveSummary}${
                staffAccountabilitySummary ? ` ${staffAccountabilitySummary}` : ""
              }${staffAdvisorySummary ? ` ${staffAdvisorySummary}` : ""}${
                enemyCommandEffectSummary ? ` 敵指揮網評価: ${enemyCommandEffectSummary}` : ""
              }${
                objectiveEventResponseSummary ? ` ${objectiveEventResponseSummary}` : ""
              }${
                commandTransmissionSummary ? ` 伝令評価: ${commandTransmissionSummary}` : ""
              }${
                withdrawalPursuitSummary ? ` ${withdrawalPursuitSummary}` : ""
              }${
                intelligenceSummary ? ` ${intelligenceSummary}` : ""
              }`
            : result.campaignMessage,
      },
      ...campaign.battleHistory,
    ].slice(0, 20),
    lastMessage:
      intelligenceSummary ||
      staffAccountabilitySummary ||
      staffAdvisorySummary ||
      enemyCommandEffectSummary ||
      objectiveEventResponseSummary ||
      commandTransmissionSummary ||
      withdrawalPursuitSummary ||
      objectiveSummary ||
      intelligencePreparation.confidenceShift > 0
        ? `${result.campaignMessage} ${objectiveSummary}${
            staffAccountabilitySummary ? ` ${staffAccountabilitySummary}` : ""
          }${staffAdvisorySummary ? ` ${staffAdvisorySummary}` : ""}${
            enemyCommandEffectSummary ? ` 敵指揮網評価: ${enemyCommandEffectSummary}` : ""
          }${
            objectiveEventResponseSummary ? ` ${objectiveEventResponseSummary}` : ""
          }${
            commandTransmissionSummary ? ` 伝令評価: ${commandTransmissionSummary}` : ""
          }${
            withdrawalPursuitSummary ? ` ${withdrawalPursuitSummary}` : ""
          }${
            intelligenceSummary ? ` ${intelligenceSummary}` : ""
          }${
            intelligencePreparation.confidenceShift > 0 ? ` ${intelligencePreparation.summary}` : ""
          }`
        : result.campaignMessage,
  };
};
