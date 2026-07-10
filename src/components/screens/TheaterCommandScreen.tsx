import { assetRegistry } from "../../assets/manifest";
import type { CampaignState } from "../../game/campaign/types";
import { strategicDoctrineFromDoctrine } from "../../game/doctrine/applyDoctrine";
import {
  enemyCompositionBrief,
  enemyCompositionIntelForOperation,
  enemyThreatRangeLabel,
} from "../../game/theater/enemyIntel";
import { calculateReconQuality, calculateReconQualityBreakdown, reconQualityLabel } from "../../game/theater/reconQuality";
import { EnemyIntelPanel } from "../shared/EnemyIntelPanel";
import { formatTerrainTags, officerRankLabels, operationOutcomeLabels, unitTypeLabels, weaponLabels } from "../shared/labels";
import type { OperationEffects, OperationSpoilsIntel, StrategicOperation } from "../../game/theater/types";

interface TheaterCommandScreenProps {
  campaign: CampaignState;
  onOpenCamp: () => void;
  onAutoResolve: (operationId: string) => void;
  onAssignOperationForce: (operationId: string, kind: "unit" | "officer", id?: string) => void;
}

const bandLabels: Record<string, string> = {
  homeCoreDefense: "本国中枢近接防衛圏",
  forwardDefense: "前線防衛地帯",
  activeFront: "前線地帯",
  enemyVanguard: "敵前衛防衛地域",
  enemyHeartland: "敵本国中枢地域",
};

const controlLabels: Record<string, string> = {
  player: "自軍保持",
  contested: "係争中",
  enemy: "敵支配",
};

const operationTypeLabels: Record<string, string> = {
  holdSector: "主戦場防衛",
  counterattack: "限定反撃",
  reconPatrol: "偵察任務",
  engineerWorks: "工兵作業",
  raidEnemyNest: "敵巣襲撃",
  railRepair: "鉄道復旧",
};

const describeEffects = (effects: OperationEffects) => {
  const entries = [];
  if (effects.enemyPressureDelta) entries.push(`敵圧 ${effects.enemyPressureDelta > 0 ? "+" : ""}${effects.enemyPressureDelta}`);
  if (effects.enemyMomentumDelta) entries.push(`敵勢 ${effects.enemyMomentumDelta > 0 ? "+" : ""}${effects.enemyMomentumDelta}`);
  if (effects.waveBudgetDelta) entries.push(`敵波 ${effects.waveBudgetDelta > 0 ? "+" : ""}${effects.waveBudgetDelta}`);
  if (effects.initiativeDelta) entries.push(`主導権 ${effects.initiativeDelta > 0 ? "+" : ""}${effects.initiativeDelta}`);
  if (effects.reputationDelta) entries.push(`威信 ${effects.reputationDelta > 0 ? "+" : ""}${effects.reputationDelta}`);
  if (effects.resourceDelta?.supplies) entries.push(`補給 +${effects.resourceDelta.supplies}`);
  if (effects.resourceDelta?.ammunition) entries.push(`弾薬 +${effects.resourceDelta.ammunition}`);
  if (effects.structureRepair) entries.push(`陣地修理 +${effects.structureRepair}`);
  return entries.length > 0 ? entries : ["変化なし"];
};

const confidenceLabels: Record<OperationSpoilsIntel["confidence"], string> = {
  low: "信頼低",
  medium: "信頼中",
  high: "信頼高",
};

const reconEffectLabels: Record<NonNullable<OperationSpoilsIntel["reconEffect"]>, string> = {
  precise: "精密照合",
  confirmed: "照合済み",
  partial: "部分照合",
  misleading: "誤情報疑い",
};

const describeSpoils = (operation: CampaignState["activeStrategicTurn"]["mandatoryBattle"]) => {
  const intel = operation.spoilsIntel;
  const entries = Object.entries(operation.spoilsIntel?.expectedWeapons ?? {})
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => {
      const range = intel?.expectedWeaponRange?.[key];
      return `${weaponLabels[key] ?? key} ${range ? `${range.min}-${range.max}` : `予測${amount}`}`;
    });
  const cache = intel?.supplyCache;
  if (cache?.ammunition) {
    const range = intel?.supplyCacheRange?.ammunition;
    entries.push(`弾薬箱 ${range ? `${range.min}-${range.max}` : cache.ammunition}`);
  }
  if (cache?.supplies) {
    const range = intel?.supplyCacheRange?.supplies;
    entries.push(`補給箱 ${range ? `${range.min}-${range.max}` : cache.supplies}`);
  }
  if (cache?.materials) {
    const range = intel?.supplyCacheRange?.materials;
    entries.push(`資材 ${range ? `${range.min}-${range.max}` : cache.materials}`);
  }
  if (intel) entries.unshift(confidenceLabels[intel.confidence]);
  if (intel?.reconQualityScore) entries.push(`偵察${intel.reconQualityScore}`);
  if (intel?.reconEffect) entries.push(reconEffectLabels[intel.reconEffect]);
  if ((intel?.recoveryMultiplier ?? 1) > 1) entries.push(`回収効率 x${intel?.recoveryMultiplier?.toFixed(2)}`);
  if ((intel?.recoveryMultiplier ?? 1) < 1) entries.push(`回収不確実 x${intel?.recoveryMultiplier?.toFixed(2)}`);
  return entries.length > 0 ? entries : ["戦利品不明"];
};

const forceLabel = (operation: StrategicOperation, campaign: CampaignState) => {
  const unit = campaign.army.units.find((candidate) => candidate.id === operation.assignedForces.unitIds[0]);
  const officer = campaign.officers.find((candidate) => candidate.id === operation.assignedForces.officerIds[0]);
  return {
    unit: unit ? `${unit.name} / ${unitTypeLabels[unit.type]} / Lv${unit.level}` : "部隊未割当",
    officer: officer ? `${officer.name} ${officerRankLabels[officer.rank]}` : "将校未割当",
  };
};

const reconPreview = (operation: StrategicOperation, campaign: CampaignState) => {
  if (operation.type !== "reconPatrol" || operation.assignedForces.unitIds.length === 0) {
    return undefined;
  }
  const score = calculateReconQuality(campaign, operation, strategicDoctrineFromDoctrine(campaign.doctrines).autoResolveQualityBonus);
  return `${reconQualityLabel(score)}${score}`;
};

const reconBreakdown = (operation: StrategicOperation, campaign: CampaignState) => {
  if (operation.type !== "reconPatrol" || operation.assignedForces.unitIds.length === 0) {
    return undefined;
  }
  return calculateReconQualityBreakdown(
    campaign,
    operation,
    strategicDoctrineFromDoctrine(campaign.doctrines).autoResolveQualityBonus,
  );
};

const uniqueById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

const enemyBrief = (operation: StrategicOperation, campaign: CampaignState) => {
  const { context } = enemyIntelForOperation(operation, campaign);
  const intel = enemyCompositionIntelForOperation(operation, context);
  return `${enemyCompositionBrief(operation, context)} / ${enemyThreatRangeLabel(intel)}`;
};

const enemyIntelForOperation = (operation: StrategicOperation, campaign: CampaignState) => {
  const sector = campaign.theater.sectors.find((candidate) => candidate.id === operation.sectorId);
  const context = {
    terrainTags: sector?.terrainTags ?? [],
    enemyPressure: sector?.enemyPressure ?? 0,
    risk: operation.risk,
    structureCount: sector?.structures.length ?? 0,
  };
  return { context };
};

export function TheaterCommandScreen({ campaign, onOpenCamp, onAutoResolve, onAssignOperationForce }: TheaterCommandScreenProps) {
  const { theater, activeStrategicTurn } = campaign;
  const currentSector = theater.sectors.find((sector) => sector.id === theater.playerArmyPositionSectorId);
  const availableUnits = campaign.army.units.filter((unit) => !unit.assignedOperationId);
  const availableOfficers = campaign.officers.filter((officer) => officer.status === "active" && !officer.assignedOperationId);

  return (
    <section className="screen-grid theater-screen">
      <div className="panel map-panel">
        <div className="section-title">
          <span>戦略キャンペーンマップ</span>
          <strong>
            <img className="section-title-icon" src={assetRegistry.theater.fiveBandFront.src64} alt="" aria-hidden="true" />
            5層戦線
          </strong>
        </div>
        <div className="band-stack">
          {theater.sectors.map((sector) => (
            <div
              key={sector.id}
              className={`band ${sector.band} ${sector.id === theater.playerArmyPositionSectorId ? "current" : ""}`}
            >
              <img className="band-icon" src={assetRegistry.theater.enemyPressure.src64} alt="" aria-hidden="true" />
              <span>{bandLabels[sector.band]}</span>
              <strong>{sector.name}</strong>
              <em>{controlLabels[sector.control]} / 敵圧 {sector.enemyPressure}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="panel main-operation">
        <div className="section-title">
          <span>今ターン主戦場</span>
          <strong>スキップ不可</strong>
        </div>
        <div className="battle-flag">
          <img src={assetRegistry.theater.mainBattleFlag.src64} alt="" aria-hidden="true" />
          <span>主戦場</span>
          <strong>{activeStrategicTurn.mandatoryBattle.title}</strong>
        </div>
        <div className="theater-primary-action">
          <button className="primary-button" type="button" onClick={onOpenCamp}>
            幕舎で準備する
          </button>
        </div>
        <p>{activeStrategicTurn.threatForecast}</p>
        <p>
          現在位置: <strong>{currentSector?.name}</strong> / 地形{" "}
          {currentSector ? formatTerrainTags(currentSector.terrainTags) : "不明"}
        </p>
        <div className="battle-map-brief">
          <span>投入枠 6旅団</span>
          <span>防衛目標 {currentSector?.structures.length ?? 0}施設</span>
          <span>危険度 {Math.round(activeStrategicTurn.mandatoryBattle.risk * 100)}%</span>
          <span>敵編成 {enemyBrief(activeStrategicTurn.mandatoryBattle, campaign)}</span>
        </div>
        <EnemyIntelPanel
          context={enemyIntelForOperation(activeStrategicTurn.mandatoryBattle, campaign).context}
          operation={activeStrategicTurn.mandatoryBattle}
          title="主戦場敵情"
        />
        <div className="effect-chip-row">
          {describeEffects(activeStrategicTurn.mandatoryBattle.victoryEffects).map((effect) => (
            <span key={effect}>{effect}</span>
          ))}
        </div>
        <div className="effect-chip-row spoils-intel-row">
          <span>{activeStrategicTurn.mandatoryBattle.spoilsIntel?.summary ?? "戦利品情報なし"}</span>
          {describeSpoils(activeStrategicTurn.mandatoryBattle).map((effect) => (
            <span key={effect}>{effect}</span>
          ))}
        </div>
      </div>

      <div className="panel side-ops">
        <div className="section-title">
          <span>小任務</span>
          <strong>自動解決可</strong>
        </div>
        {activeStrategicTurn.sideOperations.map((operation) => {
          const assignment = forceLabel(operation, campaign);
          const assignedUnit = campaign.army.units.find((unit) => unit.id === operation.assignedForces.unitIds[0]);
          const assignedOfficer = campaign.officers.find((officer) => officer.id === operation.assignedForces.officerIds[0]);
          const unitCandidates = uniqueById(assignedUnit ? [assignedUnit, ...availableUnits] : availableUnits);
          const officerCandidates = uniqueById(assignedOfficer ? [assignedOfficer, ...availableOfficers] : availableOfficers);
          const recon = reconPreview(operation, campaign);
          const reconDetails = reconBreakdown(operation, campaign);
          return (
          <article key={operation.id} className={`operation ${operation.resolved ? "resolved" : ""}`}>
            <img className="operation-tag-art" src={assetRegistry.theater.sideOperationTag.src64} alt="" aria-hidden="true" />
            <div>
              <h3>{operation.title}</h3>
              <p>{operationTypeLabels[operation.type]} / 危険度 {Math.round(operation.risk * 100)}%</p>
              <div className="operation-assignment">
                <span>{assignment.unit}</span>
                <span>{assignment.officer}</span>
                {recon ? <strong>{recon}</strong> : undefined}
                <span>敵情 {enemyBrief(operation, campaign)}</span>
              </div>
              <EnemyIntelPanel
                compact
                context={enemyIntelForOperation(operation, campaign).context}
                operation={operation}
                title="小任務敵情"
              />
              {reconDetails ? (
                <div className="recon-breakdown" aria-label="偵察品質内訳">
                  <span>部隊{reconDetails.unitScore}</span>
                  <span>将校{reconDetails.officerScore}</span>
                  {reconDetails.doctrineBonus > 0 ? <span>参謀支援+{reconDetails.doctrineBonus}</span> : undefined}
                  {reconDetails.lessonSummary.map((entry) => (
                    <strong key={entry}>{entry}</strong>
                  ))}
                </div>
              ) : undefined}
              <div className="effect-chip-row compact">
                {describeEffects(operation.victoryEffects).map((effect) => (
                  <span key={effect}>{effect}</span>
                ))}
              </div>
              <div className="effect-chip-row compact spoils-intel-row">
                <span>{operation.spoilsIntel?.summary ?? "戦利品情報なし"}</span>
                {describeSpoils(operation).slice(0, 3).map((effect) => (
                  <span key={effect}>{effect}</span>
                ))}
              </div>
              {!operation.resolved && (
                <div className="operation-force-picker">
                  <div>
                    <strong>部隊</strong>
                    {unitCandidates.slice(0, 5).map((unit) => (
                      <button
                        key={unit.id}
                        className={operation.assignedForces.unitIds.includes(unit.id) ? "selected" : ""}
                        type="button"
                        onClick={() => onAssignOperationForce(operation.id, "unit", unit.id)}
                      >
                        {unit.name}
                      </button>
                    ))}
                  </div>
                  <div>
                    <strong>将校</strong>
                    {officerCandidates.slice(0, 5).map((officer) => (
                      <button
                        key={officer.id}
                        className={operation.assignedForces.officerIds.includes(officer.id) ? "selected" : ""}
                        type="button"
                        onClick={() => onAssignOperationForce(operation.id, "officer", officer.id)}
                      >
                        {officer.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={operation.resolved}
              onClick={() => onAutoResolve(operation.id)}
            >
              {operation.resolved && operation.outcome ? operationOutcomeLabels[operation.outcome] : "自動解決"}
            </button>
          </article>
        )})}
      </div>
    </section>
  );
}
