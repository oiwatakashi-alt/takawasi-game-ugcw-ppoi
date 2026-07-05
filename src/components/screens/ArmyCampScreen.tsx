import { useMemo, useState } from "react";
import { weaponDefinitions } from "../../content/baseGame/weapons";
import { assetRegistry } from "../../assets/manifest";
import { estimateRearm, getUnitWeaponKey, getWeaponAssetKey } from "../../game/army/equipment";
import {
  divisionCommandProfile,
  divisionDirectiveDefinitions,
  divisionCommandLoadByOfficer,
  divisionCommandSummaryForOfficer,
  normalizeArmyDivisions,
} from "../../game/army/divisions";
import { commandDutyProfileForOfficer } from "../../game/army/commandDuty";
import {
  armyHeadquartersProfile,
  normalizeStaffAssignments,
  staffSlotDefinitions,
  staffDutyLoadByOfficer,
  staffDutySummaryForOfficer,
} from "../../game/army/headquarters";
import {
  estimateDivisionCommanderPoliticalCost,
  estimateStaffAssignmentPoliticalCost,
  recommendDivisionCommanderAssignments,
  recommendStaffAssignments,
} from "../../game/army/politicalCost";
import { savedTemplateForUnit } from "../../game/campaign/standingOrderTemplates";
import { tacticalLessonProfileForUnit } from "../../game/campaign/tacticalLessons";
import type { DivisionDirective, StaffSlotId } from "../../game/army/types";
import type { CampaignState } from "../../game/campaign/types";
import { staffIntelligenceDirectiveFromDoctrine } from "../../game/doctrine/applyDoctrine";
import { officerCommandProfile, officerCommandSummary } from "../../game/officers/effects";
import { enemyCompositionIntelForOperation } from "../../game/theater/enemyIntel";
import {
  ammoPolicyLabels,
  officerRankLabels,
  officerStatusLabels,
  standingPostureLabels,
  targetPriorityLabels,
  unitTypeLabels,
  weaponLabels,
} from "../shared/labels";

interface ArmyCampScreenProps {
  campaign: CampaignState;
  onRookie: (unitId: string) => void;
  onVeteran: (unitId: string) => void;
  onRearm: (unitId: string) => void;
  onAssignStaffOfficer: (slotId: StaffSlotId, officerId?: string) => void;
  onSetDivisionDirective: (divisionId: string, directive: DivisionDirective) => void;
  onAssignDivisionCommander: (divisionId: string, officerId?: string) => void;
  onClearStandingOrderTemplate: (unitId: string) => void;
}

const barPercent = (value: number, max = 100) => `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
const slotsPerDivision = 6;
const maxCorps = 5;
const maxDivisionsPerCorps = 4;
const maxBrigades = maxCorps * maxDivisionsPerCorps * slotsPerDivision;

export function ArmyCampScreen({
  campaign,
  onRookie,
  onVeteran,
  onRearm,
  onAssignStaffOfficer,
  onSetDivisionDirective,
  onAssignDivisionCommander,
  onClearStandingOrderTemplate,
}: ArmyCampScreenProps) {
  const [selectedUnitId, setSelectedUnitId] = useState(campaign.army.units[0]?.id ?? "");
  const selectedUnit =
    campaign.army.units.find((unit) => unit.id === selectedUnitId) ?? campaign.army.units[0];
  const selectedOfficer = campaign.officers.find((officer) => officer.id === selectedUnit?.officerId);
  const formation = campaign.army.formations[0];
  const unitById = useMemo(() => new Map(campaign.army.units.map((unit) => [unit.id, unit])), [campaign.army.units]);
  const divisions = useMemo(
    () => normalizeArmyDivisions(campaign.army.units, formation?.divisions),
    [campaign.army.units, formation],
  );
  const staffAssignments = normalizeStaffAssignments(formation?.staffAssignments);
  const headquartersProfile = armyHeadquartersProfile(campaign.army, campaign.officers);
  const staffDutyLoads = staffDutyLoadByOfficer(campaign.army);
  const divisionCommandLoads = divisionCommandLoadByOfficer(campaign.army);
  const selectedOfficerDuty = selectedOfficer
    ? commandDutyProfileForOfficer(campaign.army, selectedOfficer.id)
    : undefined;
  const selectedOfficerProfile = selectedUnit
    ? officerCommandProfile(
        selectedOfficer,
        selectedUnit.type,
        selectedUnit.soldiers,
        headquartersProfile.commandCapacityBonus,
        selectedOfficerDuty?.load ?? 0,
        selectedOfficerDuty?.summary,
      )
    : undefined;
  const activeOfficers = campaign.officers.filter((officer) => officer.status === "active");
  const totalSoldiers = campaign.army.units.reduce((sum, unit) => sum + unit.soldiers, 0);
  const maxSoldiers = campaign.army.units.reduce((sum, unit) => sum + unit.maxSoldiers, 0);
  const averageExperience =
    campaign.army.units.reduce((sum, unit) => sum + unit.experience, 0) / Math.max(1, campaign.army.units.length);
  const selectedRearmEstimate = selectedUnit ? estimateRearm(selectedUnit, campaign.resources) : undefined;
  const selectedWeaponKey = selectedUnit ? getUnitWeaponKey(selectedUnit) : "dreyse";
  const selectedWeapon = weaponDefinitions[selectedWeaponKey];
  const selectedTacticalLessonProfile = selectedUnit ? tacticalLessonProfileForUnit(selectedUnit) : undefined;
  const selectedStandingOrderTemplate = selectedUnit ? savedTemplateForUnit(campaign, selectedUnit.id) : undefined;
  const savedStandingOrderEntries = useMemo(
    () =>
      campaign.standingOrderTemplates
        .map((template) => {
          const unit = template.createdFromUnitId ? unitById.get(template.createdFromUnitId) : undefined;
          return unit ? { template, unit } : undefined;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [campaign.standingOrderTemplates, unitById],
  );
  const staffDirective = staffIntelligenceDirectiveFromDoctrine(campaign.doctrines);
  const commandRecommendationContext = useMemo(() => {
    const operation = campaign.theater.mandatoryBattle ?? campaign.activeStrategicTurn.mandatoryBattle;
    const sector = campaign.theater.sectors.find((candidate) => candidate.id === operation.sectorId);
    const baseContext = {
      sectorName: sector?.name ?? operation.title,
      terrainTags: sector?.terrainTags ?? [],
      enemyPressure: sector?.enemyPressure ?? 0,
      risk: operation.risk,
      structureCount: sector?.structures.length ?? 0,
    };
    return {
      ...baseContext,
      enemyThreats: enemyCompositionIntelForOperation(operation, baseContext).threats,
      staffDirectiveMode: staffDirective.mode,
      staffDirectiveLabel: staffDirective.label,
    };
  }, [
    campaign.activeStrategicTurn.mandatoryBattle,
    campaign.theater.mandatoryBattle,
    campaign.theater.sectors,
    staffDirective.label,
    staffDirective.mode,
  ]);
  const staffRecommendations = useMemo(
    () => recommendStaffAssignments(campaign.army, campaign.officers, campaign.resources, commandRecommendationContext, 3),
    [campaign.army, campaign.officers, campaign.resources, commandRecommendationContext],
  );
  const divisionCommanderRecommendations = useMemo(
    () => recommendDivisionCommanderAssignments(campaign.army, campaign.officers, campaign.resources, commandRecommendationContext, 3),
    [campaign.army, campaign.officers, campaign.resources, commandRecommendationContext],
  );

  return (
    <section className="army-management-screen">
      <aside className="army-side-panel">
        <div className="section-title">
          <span>幕舎: 軍編成</span>
          <strong>I軍団</strong>
        </div>
        <div className="corps-standard">
          <div className="standard-mark">
            <img src={assetRegistry.army.corpsStandard.src64} alt="" aria-hidden="true" />
          </div>
          <div>
            <h2>{formation?.name ?? "野戦軍団"}</h2>
            <p>戦闘投入可能な軍団、師団、旅団をここで整理する。</p>
          </div>
        </div>
        <dl className="corps-ledger">
          <dt>総兵力</dt>
          <dd>{Math.round(totalSoldiers)} / {maxSoldiers}</dd>
          <dt>平均経験</dt>
          <dd>{Math.round(averageExperience)}</dd>
          <dt>補給上限</dt>
          <dd>{campaign.resources.supplies}</dd>
          <dt>戦闘準備</dt>
          <dd>{campaign.activeStrategicTurn.mandatoryBattle.title}</dd>
          <dt>司令部</dt>
          <dd>参謀{headquartersProfile.activeSlots}/{staffSlotDefinitions.length} / 出撃+{headquartersProfile.deploymentSlotBonus}</dd>
          <dt>政治余力</dt>
          <dd>威信 {campaign.resources.reputation}</dd>
          <dt>最大軍制</dt>
          <dd>{maxCorps}軍団/{maxDivisionsPerCorps}師団/{slotsPerDivision}旅団</dd>
        </dl>
        <div className="headquarters-staff-box">
          <h3>軍団司令部</h3>
          {staffSlotDefinitions.map((slot) => {
            const assignment = staffAssignments.find((candidate) => candidate.slotId === slot.id);
            const officer = campaign.officers.find((candidate) => candidate.id === assignment?.officerId);
            return (
              <label key={slot.id} className="staff-slot-row">
                <span>
                  <strong>{slot.label}</strong>
                  <em>{slot.role}</em>
                </span>
                <select
                  value={assignment?.officerId ?? ""}
                  onChange={(event) => onAssignStaffOfficer(slot.id, event.target.value || undefined)}
                >
                  <option value="">
                    未任命 / 威信
                    {estimateStaffAssignmentPoliticalCost(campaign.army, campaign.officers, campaign.resources, slot.id).reputationCost}
                  </option>
                  {activeOfficers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {officerRankLabels[candidate.rank]} {candidate.name} / 威信
                      {
                        estimateStaffAssignmentPoliticalCost(
                          campaign.army,
                          campaign.officers,
                          campaign.resources,
                          slot.id,
                          candidate.id,
                        ).reputationCost
                      }
                    </option>
                  ))}
                </select>
                <small>{officer ? `特性 ${officer.traits.join("、")}` : `適性 ${slot.preferredTraits.join("、")}`}</small>
                <small>兼任負荷 {slot.staffDutyLoad} / 変更は威信を消費</small>
              </label>
            );
          })}
          <p>
            司令部効果: 出撃枠+{headquartersProfile.deploymentSlotBonus} / 指揮容量+
            {headquartersProfile.commandCapacityBonus} / 予備即応+{headquartersProfile.reserveReadinessBonus}
          </p>
        </div>
        {(staffRecommendations.length > 0 || divisionCommanderRecommendations.length > 0) && (
          <div className="command-recommendation-box">
            <h3>参謀部推奨</h3>
            <p>{staffRecommendations[0]?.contextSummary ?? divisionCommanderRecommendations[0]?.contextSummary}</p>
            <p>参謀任務補正: {staffDirective.label} - {staffDirective.summary}</p>
            {staffRecommendations.map((recommendation) => (
              <article key={recommendation.id}>
                <strong>{recommendation.reason}</strong>
                <span>
                  改善+{recommendation.improvement} / 威信-{recommendation.reputationCost}
                </span>
                <small>{recommendation.projectedSummary}</small>
                {recommendation.accountabilitySummary && <small>前戦評価: {recommendation.accountabilitySummary}</small>}
                <small>戦場補正: {recommendation.contextSummary}</small>
                <button
                  type="button"
                  onClick={() => onAssignStaffOfficer(recommendation.targetId as StaffSlotId, recommendation.officerId)}
                >
                  推奨任命
                </button>
              </article>
            ))}
            {divisionCommanderRecommendations.map((recommendation) => (
              <article key={recommendation.id}>
                <strong>{recommendation.reason}</strong>
                <span>
                  改善+{recommendation.improvement} / 威信-{recommendation.reputationCost}
                </span>
                <small>{recommendation.projectedSummary}</small>
                <small>戦場補正: {recommendation.contextSummary}</small>
                <button
                  type="button"
                  onClick={() => onAssignDivisionCommander(recommendation.targetId, recommendation.officerId)}
                >
                  推奨師団長
                </button>
              </article>
            ))}
          </div>
        )}
        <div className="army-pool-box">
          <h3>補充プール</h3>
          <span>新兵 {campaign.resources.recruits}</span>
          <span>古参兵 {campaign.resources.veterans}</span>
          <span>軍資金 {campaign.resources.gold}</span>
          <span>製品版上限 {maxBrigades}旅団</span>
        </div>
        <div className="standing-order-ledger">
          <h3>標準方針台帳</h3>
          <p>出撃配置や戦闘中に保存した旅団ごとの自律指揮方針。</p>
          {savedStandingOrderEntries.length > 0 ? (
            savedStandingOrderEntries.map(({ template, unit }) => (
              <button
                key={template.id}
                type="button"
                className={selectedUnit?.id === unit.id ? "selected" : ""}
                onClick={() => setSelectedUnitId(unit.id)}
              >
                <strong>{unit.name}</strong>
                <span>{unitTypeLabels[unit.type]}</span>
                <small>
                  {standingPostureLabels[template.standingOrder.posture]} /{" "}
                  {targetPriorityLabels[template.standingOrder.targetPriority]} /{" "}
                  {ammoPolicyLabels[template.standingOrder.ammoPolicy]}
                </small>
              </button>
            ))
          ) : (
            <small>保存済み標準方針なし。出撃配置または戦闘中に方針保存するとここへ並ぶ。</small>
          )}
        </div>
      </aside>

      <div className="army-board">
        <div className="army-board-header">
          <div>
            <span>軍団配置</span>
            <h2>I軍団 戦闘序列</h2>
          </div>
          <div className="corps-supply">
            <strong>{campaign.resources.supplies}</strong>
            <span>補給上限</span>
          </div>
        </div>

        {divisions.map((division) => (
          <section key={division.id} className={`division-row ${division.locked ? "locked" : ""}`}>
            <header className="division-heading">
              <div className="division-badge">{division.locked ? "封鎖" : division.name.replace("第", "").replace("師団", "")}</div>
              <div>
                <h3>{division.name}</h3>
                <p>{division.note}</p>
                {!division.locked && (
                  <small>
                    {divisionCommandProfile(division, campaign.officers)?.summary}
                    {division.commanderOfficerId
                      ? ` / 師団長負荷 ${divisionCommandLoads[division.commanderOfficerId] ?? 0}`
                      : ""}
                  </small>
                )}
              </div>
              {!division.locked && (
                <div className="division-command-controls">
                  <label>
                    師団長
                    <select
                      value={division.commanderOfficerId ?? ""}
                      onChange={(event) => onAssignDivisionCommander(division.id, event.target.value || undefined)}
                    >
                      <option value="">
                        未任命 / 威信
                        {
                          estimateDivisionCommanderPoliticalCost(
                            campaign.army,
                            campaign.officers,
                            campaign.resources,
                            division.id,
                          ).reputationCost
                        }
                      </option>
                      {activeOfficers.map((officer) => (
                        <option key={officer.id} value={officer.id}>
                          {officerRankLabels[officer.rank]} {officer.name} / 威信
                          {
                            estimateDivisionCommanderPoliticalCost(
                              campaign.army,
                              campaign.officers,
                              campaign.resources,
                              division.id,
                              officer.id,
                            ).reputationCost
                          }
                        </option>
                      ))}
                    </select>
                    <small>候補ごとの威信費用を表示。兼任や入替で増加。</small>
                  </label>
                  <label>
                    師団命令
                    <select
                      value={division.directive ?? "line_hold"}
                      onChange={(event) => onSetDivisionDirective(division.id, event.target.value as DivisionDirective)}
                    >
                      {divisionDirectiveDefinitions.map((directive) => (
                        <option key={directive.id} value={directive.id}>
                          {directive.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </header>
            <div className="brigade-grid">
              {Array.from({ length: division.maxBrigades }).map((_, slot) => {
                const unitId = division.unitIds[slot];
                const unit = unitId ? unitById.get(unitId) : undefined;
                if (!unit) {
                  return (
                    <div key={`${division.id}-empty-${slot}`} className={`brigade-slot empty ${division.locked ? "locked" : ""}`}>
                      <span>{division.locked ? "未解放" : "+"}</span>
                      <em>{division.locked ? "軍制不足" : "空き旅団枠"}</em>
                    </div>
                  );
                }
                const isSelected = selectedUnit.id === unit.id;
                return (
                  <button
                    key={unit.id}
                    className={`brigade-slot ${unit.type} ${isSelected ? "selected" : ""}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedUnitId(unit.id)}
                  >
                    <span className="unit-paper-flag">
                      <img src={assetRegistry.army.brigadeFlags[unit.type].src64} alt="" aria-hidden="true" />
                    </span>
                    <strong>{unit.name}</strong>
                    <em>{unitTypeLabels[unit.type]}</em>
                    <small>{Math.round(unit.soldiers)} 名 / Lv{unit.level}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selectedUnit && (
        <aside className="unit-inspector">
          <div className="section-title">
            <span>旅団詳細</span>
            <strong>{unitTypeLabels[selectedUnit.type]}</strong>
          </div>
          <div className="inspector-portrait">
            <img
              className={`unit-token large unit-token-image ${selectedUnit.type}`}
              src={assetRegistry.army.unitTokens[selectedUnit.type].src128}
              alt=""
              aria-hidden="true"
            />
            <div>
              <h2>{selectedUnit.name}</h2>
              <p>{selectedUnit.traits.join("、")}</p>
            </div>
          </div>

          <div className="officer-strip">
            <img
              className="officer-portrait-small"
              src={selectedOfficer ? assetRegistry.army.officerPortrait.src64 : assetRegistry.army.officerSilhouette.src64}
              alt=""
              aria-hidden="true"
            />
            <span>指揮官</span>
            <strong>
              {selectedOfficer
                ? `${officerRankLabels[selectedOfficer.rank]} ${selectedOfficer.name}`
                : "未任命"}
            </strong>
            <em>{selectedOfficer ? officerStatusLabels[selectedOfficer.status] : "空席"}</em>
            {selectedOfficer && <small>指揮疲労 {selectedOfficer.commandFatigue ?? 0}</small>}
            {selectedOfficer && staffDutySummaryForOfficer(campaign.army, selectedOfficer.id) && (
              <small>
                参謀兼任 {staffDutySummaryForOfficer(campaign.army, selectedOfficer.id)} / 負荷
                {staffDutyLoads[selectedOfficer.id] ?? 0}
              </small>
            )}
            {selectedOfficer && divisionCommandSummaryForOfficer(campaign.army, selectedOfficer.id) && (
              <small>
                師団長兼任 {divisionCommandSummaryForOfficer(campaign.army, selectedOfficer.id)} / 負荷
                {divisionCommandLoads[selectedOfficer.id] ?? 0}
              </small>
            )}
            <small>指揮効果 {officerCommandSummary(selectedOfficerProfile)}</small>
          </div>

          <div className="stat-meter-list">
            <Meter label="兵力" value={selectedUnit.soldiers} max={selectedUnit.maxSoldiers} />
            <Meter label="士気" value={selectedUnit.morale} />
            <Meter label="疲労回復" value={selectedUnit.condition} />
            <Meter label="弾薬" value={selectedUnit.ammo} />
            <Meter label="経験" value={selectedUnit.experience} />
          </div>

          <div className="equipment-box">
            <img
              className="equipment-art"
              src={assetRegistry.army.weapons[getWeaponAssetKey(selectedWeaponKey)].src128}
              alt=""
              aria-hidden="true"
            />
            <span>装備</span>
            <strong>{weaponLabels[selectedWeaponKey]}</strong>
            <em>
              射程 {selectedWeapon.range} / 火力 {selectedWeapon.firepower.toFixed(2)} / 品質{" "}
              {selectedUnit.weaponQuality.toFixed(2)}
              {selectedRearmEstimate && selectedRearmEstimate.neededWeapons > 0
                ? ` -> ${Math.min(
                    selectedRearmEstimate.targetQuality,
                    selectedUnit.weaponQuality + selectedRearmEstimate.qualityGain,
                  ).toFixed(2)}`
                : ""}{" "}
              / 在庫 {campaign.resources.weapons[selectedWeaponKey] ?? 0}
            </em>
            {selectedRearmEstimate && (
              <small>
                再装備: 必要{selectedRearmEstimate.neededWeapons} / 使用可能
                {Math.min(selectedRearmEstimate.neededWeapons, selectedRearmEstimate.availableWeapons)}
              </small>
            )}
          </div>

          <div className="unit-lesson-box">
            <h3>戦術教訓</h3>
            <p>{selectedTacticalLessonProfile?.summary ?? "戦術教訓なし"}</p>
            {selectedTacticalLessonProfile?.preferredDoctrineLabel && (
              <span>得意方針 {selectedTacticalLessonProfile.preferredDoctrineLabel}</span>
            )}
            {selectedStandingOrderTemplate ? (
              <div className="unit-standard-order">
                <strong>標準方針</strong>
                <span>{selectedStandingOrderTemplate.description}</span>
                <small>
                  姿勢 {standingPostureLabels[selectedStandingOrderTemplate.standingOrder.posture]} / 優先{" "}
                  {targetPriorityLabels[selectedStandingOrderTemplate.standingOrder.targetPriority]} / 弾薬{" "}
                  {ammoPolicyLabels[selectedStandingOrderTemplate.standingOrder.ammoPolicy]}
                </small>
                {selectedStandingOrderTemplate.frontlineSketchPoints &&
                  selectedStandingOrderTemplate.frontlineSketchPoints.length > 1 && (
                    <small className="sketch-shape-note">
                      戦線形状 {selectedStandingOrderTemplate.frontlineSketchPoints.length}点 /{" "}
                      {selectedStandingOrderTemplate.frontlineSketchPoints
                        .slice(0, 3)
                        .map((point) => `X${Math.round(point.x)} Y${Math.round(point.y)}`)
                        .join(" -> ")}
                    </small>
                  )}
                <button type="button" onClick={() => onClearStandingOrderTemplate(selectedUnit.id)}>
                  標準方針を解除
                </button>
              </div>
            ) : (
              <small>出撃配置または戦闘中に方針保存すると、この旅団の標準方針として残る。</small>
            )}
          </div>

          <div className="replacement-controls">
            <button
              type="button"
              disabled={!selectedRearmEstimate?.canImprove}
              onClick={() => onRearm(selectedUnit.id)}
            >
              予備武器で再装備
            </button>
            <button type="button" onClick={() => onRookie(selectedUnit.id)}>
              新兵で補充
            </button>
            <button type="button" onClick={() => onVeteran(selectedUnit.id)}>
              古参兵で補充
            </button>
          </div>

          <div className="battle-record-box">
            <h3>部隊史</h3>
            {selectedUnit.battleHistory.map((entry) => (
              <p key={entry}>{entry}</p>
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}

function Meter({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  return (
    <div className="stat-meter">
      <span>{label}</span>
      <div className="meter-track">
        <i style={{ width: barPercent(value, max) }} />
      </div>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}
