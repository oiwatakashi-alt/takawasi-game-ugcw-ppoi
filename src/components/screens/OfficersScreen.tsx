import type { CampaignState } from "../../game/campaign/types";
import {
  armyHeadquartersProfile,
  staffDutyLoadByOfficer,
  staffDutySummaryForOfficer,
} from "../../game/army/headquarters";
import { commandDutyLoadByOfficer, commandDutyProfileForOfficer } from "../../game/army/commandDuty";
import { divisionCommandLoadByOfficer, divisionCommandSummaryForOfficer } from "../../game/army/divisions";
import { officerCommandProfile } from "../../game/officers/effects";
import { nextOfficerRank, officerPromotionCost } from "../../game/officers/progression";
import { officerRankLabels, officerStatusLabels } from "../shared/labels";

interface OfficersScreenProps {
  campaign: CampaignState;
  onPromoteOfficer: (officerId: string) => void;
  onCycleOfficerAssignment: (officerId: string) => void;
  onAssignOfficerToUnit: (officerId: string, unitId: string) => void;
  onRestOfficer: (officerId: string) => void;
  onReturnOfficer: (officerId: string) => void;
}

const totalCommandOverload = (campaign: CampaignState, replacement?: { officerId: string; unitId: string }): number => {
  const headquartersProfile = armyHeadquartersProfile(campaign.army, campaign.officers);
  const commandDutyLoads = commandDutyLoadByOfficer(campaign.army);
  const targetOfficer = replacement
    ? campaign.officers.find((officer) => officer.id === replacement.officerId)
    : undefined;
  const targetUnit = replacement
    ? campaign.army.units.find((unit) => unit.id === replacement.unitId)
    : undefined;
  const displacedOfficerId = targetUnit?.officerId;
  const previousUnitId = targetOfficer?.assignedUnitId;

  return campaign.army.units.reduce((total, unit) => {
    let officerId = unit.officerId;
    if (replacement && unit.id === replacement.unitId) {
      officerId = replacement.officerId;
    } else if (replacement && previousUnitId && unit.id === previousUnitId && displacedOfficerId) {
      officerId = displacedOfficerId;
    }
    const officer = campaign.officers.find((candidate) => candidate.id === officerId);
    return (
      total +
      (officerCommandProfile(
        officer,
        unit.type,
        unit.soldiers,
        headquartersProfile.commandCapacityBonus,
        officer ? commandDutyLoads[officer.id] ?? 0 : 0,
        officer ? commandDutyProfileForOfficer(campaign.army, officer.id).summary : undefined,
      )?.commandOverload ?? unit.soldiers)
    );
  }, 0);
};

const commandProfileForAssignedUnit = (campaign: CampaignState, unitId: string) => {
  const headquartersProfile = armyHeadquartersProfile(campaign.army, campaign.officers);
  const unit = campaign.army.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return undefined;
  }
  const officer = campaign.officers.find((candidate) => candidate.id === unit.officerId);
  const dutyProfile = officer ? commandDutyProfileForOfficer(campaign.army, officer.id) : undefined;
  return officerCommandProfile(
    officer,
    unit.type,
    unit.soldiers,
    headquartersProfile.commandCapacityBonus,
    dutyProfile?.load ?? 0,
    dutyProfile?.summary,
  );
};

export function OfficersScreen({
  campaign,
  onPromoteOfficer,
  onCycleOfficerAssignment,
  onAssignOfficerToUnit,
  onRestOfficer,
  onReturnOfficer,
}: OfficersScreenProps) {
  const headquartersProfile = armyHeadquartersProfile(campaign.army, campaign.officers);
  const commandDutyLoads = commandDutyLoadByOfficer(campaign.army);
  const staffDutyLoads = staffDutyLoadByOfficer(campaign.army);
  const divisionCommandLoads = divisionCommandLoadByOfficer(campaign.army);
  const currentTotalOverload = totalCommandOverload(campaign);
  const overloadedUnits = campaign.army.units
    .map((unit) => ({ unit, profile: commandProfileForAssignedUnit(campaign, unit.id) }))
    .filter((entry) => (entry.profile?.commandOverload ?? 0) > 0);
  const recommendedAssignments = overloadedUnits
    .map(({ unit, profile }) => {
      const candidates = campaign.officers
        .filter((officer) => officer.status === "active" && officer.id !== unit.officerId)
        .map((officer) => {
          const afterTotal = totalCommandOverload(campaign, { officerId: officer.id, unitId: unit.id });
          const candidateProfile = officerCommandProfile(
            officer,
            unit.type,
            unit.soldiers,
            headquartersProfile.commandCapacityBonus,
            commandDutyLoads[officer.id] ?? 0,
            commandDutyProfileForOfficer(campaign.army, officer.id).summary,
          );
          return { officer, afterTotal, profile: candidateProfile };
        })
        .sort((a, b) => a.afterTotal - b.afterTotal || (b.profile?.commandCapacity ?? 0) - (a.profile?.commandCapacity ?? 0));
      const best = candidates[0];
      if (!best || best.afterTotal >= currentTotalOverload) {
        return { unit, profile, best: undefined };
      }
      return { unit, profile, best };
    })
    .filter((entry) => entry.best);
  const fatiguedOfficers = campaign.officers.filter(
    (officer) => officer.status === "active" && (officer.commandFatigue ?? 0) >= 18,
  );

  return (
    <section className="panel">
      <div className="section-title">
        <span>幕舎: 将校</span>
        <strong>指揮容量と負傷リスク</strong>
      </div>
      {overloadedUnits.length > 0 && (
        <div className="officer-overload-panel">
          <div>
            <strong>指揮過負荷 {overloadedUnits.length}旅団</strong>
            <span>総過負荷 {currentTotalOverload}</span>
          </div>
          <p>過負荷旅団は出撃時に士気、疲労回復、統制半径、予備即応、後退判断で不利を受ける。</p>
          {recommendedAssignments.length > 0 ? (
            <div className="officer-recommendation-list">
              {recommendedAssignments.map(({ unit, profile, best }) => (
                <article key={unit.id}>
                  <span>
                    {unit.name}: {profile?.commandLoad}/{profile?.commandCapacity} 過負荷
                    {profile?.commandOverload}
                  </span>
                  <strong>
                    推奨 {best?.officer.name} {best ? officerRankLabels[best.officer.rank] : ""}
                  </strong>
                  <small>
                    予測 {currentTotalOverload} {"->"} {best?.afterTotal} / 容量 {best?.profile?.commandCapacity}
                  </small>
                  <button type="button" onClick={() => best && onAssignOfficerToUnit(best.officer.id, unit.id)}>
                    推奨配属
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>現在の将校配置では交換だけで総過負荷を下げられない。昇進や補充規模の調整が必要。</p>
          )}
        </div>
      )}
      {fatiguedOfficers.length > 0 && (
        <div className="officer-overload-panel">
          <div>
            <strong>休養推奨 {fatiguedOfficers.length}名</strong>
            <span>指揮疲労18以上</span>
          </div>
          <p>休養中の将校は次戦の指揮に出ないが、次ターン以降の指揮疲労回復が速い。</p>
          <div className="officer-recommendation-list">
            {fatiguedOfficers.slice(0, 4).map((officer) => (
              <article key={officer.id}>
                <span>
                  {officerRankLabels[officer.rank]} {officer.name}: 指揮疲労 {officer.commandFatigue}
                </span>
                <strong>{officer.assignedUnitId ? "前線指揮を一時停止" : "司令部で休養"}</strong>
                <small>休養回復 +22/ターン。疲労0で自動復帰。</small>
                <button type="button" onClick={() => onRestOfficer(officer.id)}>
                  休養入り
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="card-grid">
        {campaign.officers.map((officer) => {
          const assignedUnit = campaign.army.units.find((unit) => unit.id === officer.assignedUnitId);
          const nextRank = nextOfficerRank(officer.rank);
          const promotionCost = officerPromotionCost(officer);
          const canPromote = officer.status === "active" && Boolean(nextRank) && officer.experience >= promotionCost;
          const canReassign = officer.status === "active" && campaign.army.units.length > 1;
          const canRest = officer.status === "active" && (officer.commandFatigue ?? 0) > 0;
          const canReturn = officer.status === "resting";
          return (
            <article key={officer.id} className={`officer-card ${officer.status}`}>
              <h3>{officerRankLabels[officer.rank]} {officer.name}</h3>
              <p>
                {officerStatusLabels[officer.status]} / 経験 {officer.experience} / 指揮疲労{" "}
                {officer.commandFatigue ?? 0}
              </p>
              <p>{officer.traits.join("、")}</p>
              <p>配属: {assignedUnit?.name ?? "軍司令部"}</p>
              {staffDutySummaryForOfficer(campaign.army, officer.id) && (
                <p>
                  参謀兼任: {staffDutySummaryForOfficer(campaign.army, officer.id)} / 負荷
                  {staffDutyLoads[officer.id] ?? 0}
                </p>
              )}
              {divisionCommandSummaryForOfficer(campaign.army, officer.id) && (
                <p>
                  師団長兼任: {divisionCommandSummaryForOfficer(campaign.army, officer.id)} / 負荷
                  {divisionCommandLoads[officer.id] ?? 0}
                </p>
              )}
              <div className="officer-command-row">
                <button type="button" onClick={() => onCycleOfficerAssignment(officer.id)} disabled={!canReassign}>
                  次部隊へ配属
                </button>
                <button type="button" onClick={() => onRestOfficer(officer.id)} disabled={!canRest}>
                  休養入り
                </button>
                <button type="button" onClick={() => onReturnOfficer(officer.id)} disabled={!canReturn}>
                  任務復帰
                </button>
                <button type="button" onClick={() => onPromoteOfficer(officer.id)} disabled={!canPromote}>
                  {nextRank ? `${officerRankLabels[nextRank]}へ昇進` : "最高位"}
                </button>
              </div>
              {nextRank && (
                <small>
                  昇進条件: 経験 {officer.experience}/{promotionCost}
                </small>
              )}
              <div className="officer-history-lines">
                {officer.history.slice(0, 3).map((history) => (
                  <small key={history}>{history}</small>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
