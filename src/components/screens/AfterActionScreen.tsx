import type { BattleResult } from "../../game/battle/types";
import {
  tacticalLessonPreviewForEnemyCommandEffects,
  tacticalLessonPreviewForFacilityDuties,
  tacticalLessonPreviewForObjectiveEventOutcomes,
  tacticalLessonPreviewForStaffOutcomes,
} from "../../game/campaign/tacticalLessons";
import { battleOutcomeLabels, weaponLabels } from "../shared/labels";

interface AfterActionScreenProps {
  result: BattleResult;
  onContinue: () => void;
}

const rearGuardComparisonLabel = (
  plan: BattleResult["withdrawalRearGuardPlanAssessments"][number] | undefined,
  actual: BattleResult["withdrawalRearGuard"][number] | undefined,
): string | undefined => {
  if (!plan || !actual) {
    return undefined;
  }
  const casualtyDelta = actual.rearGuardCasualties - plan.predictedCasualties;
  if (actual.pursuitDamagePrevented >= plan.pursuitCover * 0.45 && casualtyDelta <= 0) {
    return "低損耗で抑止";
  }
  if (casualtyDelta <= 2) {
    return "損耗予測内";
  }
  if (casualtyDelta >= 8 || actual.riskLabel === "危険") {
    return "予測超過";
  }
  return "消耗増";
};

export function AfterActionScreen({ result, onContinue }: AfterActionScreenProps) {
  const woundedOfficerCount = new Set([...result.woundedOfficerIds, ...result.divisionCommanderWoundedOfficerIds]).size;
  const rearGuardPlanByUnit = Object.fromEntries(
    result.withdrawalRearGuardPlanAssessments.map((entry) => [entry.unitId, entry]),
  );
  const rearGuardActualByUnit = Object.fromEntries(result.withdrawalRearGuard.map((entry) => [entry.unitId, entry]));
  const medicalRecoveryByUnit = Object.fromEntries(result.medicalRecoveryDetails.map((entry) => [entry.unitId, entry]));
  const medicalBonusDetails = result.medicalRecoveryDetails.filter((entry) => entry.bonusRecovered > 0);
  const commandTransmissionDelayedCount = result.commandTransmissionOutcomes.filter(
    (outcome) => outcome.assessment !== "円滑",
  ).length;
  const commandTransmissionCongestedCount = result.commandTransmissionOutcomes.filter(
    (outcome) => outcome.congestionDelaySeconds > 0,
  ).length;
  const commandTransmissionMaxDelay = result.commandTransmissionOutcomes.reduce(
    (maximum, outcome) => Math.max(maximum, outcome.delaySeconds),
    0,
  );
  const tacticalLessonPreviews = Object.keys(result.casualtiesByUnit)
    .map((unitId) => ({
      unitId,
      unitName: result.unitNamesById[unitId] ?? unitId,
      preview:
        tacticalLessonPreviewForStaffOutcomes(result.staffAdvisoryOutcomes, unitId) ??
        tacticalLessonPreviewForEnemyCommandEffects(result.enemyCommandEffectOutcomes, unitId) ??
        tacticalLessonPreviewForObjectiveEventOutcomes(result.objectiveEventResponseOutcomes, unitId) ??
        tacticalLessonPreviewForFacilityDuties(result.battleRoleByUnit, result.commendationsByUnit, unitId),
    }))
    .filter((item): item is { unitId: string; unitName: string; preview: string } => Boolean(item.preview));
  return (
    <section className="screen-grid two-column">
      <div className="panel">
        <div className="section-title">
          <span>戦果報告</span>
          <strong>{battleOutcomeLabels[result.outcome]}</strong>
        </div>
        <h2>{result.title}</h2>
        <p>{result.campaignMessage}</p>
        <p>敵制圧: {result.enemySuppression}%</p>
        <p>
          弾薬消費: {Math.round(result.ammoSpent)} / 補給消費: {result.supplySpent} / 医療補給:{" "}
          {result.medicalSupplySpent}
        </p>
        <p>
          負傷兵収容率: {Math.round(result.medicalRecoveryRate * 100)}% / 収容復帰{" "}
          {Object.values(result.recoveredByUnit).reduce((sum, recovered) => sum + recovered, 0)}名
        </p>
        {medicalBonusDetails.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>救護線</strong>
            {medicalBonusDetails.map((entry) => (
              <span key={entry.unitId}>
                {entry.unitName}: 追加収容+{entry.bonusRecovered} / 実効収容率
                {Math.round(entry.effectiveRecoveryRate * 100)}% / {entry.reason}
              </span>
            ))}
          </div>
        )}
        <div className="battle-spoils-box objective-outcome-box">
          <strong>戦術目標</strong>
          <span>
            {result.objectiveOutcome.victoryLabel} {result.objectiveOutcome.victoryControl}% /{" "}
            {result.objectiveOutcome.supplyLabel} {result.objectiveOutcome.supplyControl}% /{" "}
            {result.objectiveOutcome.visibilityLabel} {result.objectiveOutcome.visibilityControl}%
          </span>
          {result.objectiveOutcome.events.map((event) => (
            <span key={event}>{event}</span>
          ))}
        </div>
        <div className="battle-spoils-box">
          <strong>戦利品</strong>
          {Object.entries(result.capturedWeapons)
            .filter(([, amount]) => amount > 0)
            .map(([weaponKey, amount]) => (
              <span key={weaponKey}>
                {weaponLabels[weaponKey] ?? weaponKey} +{amount}
              </span>
            ))}
          {Object.values(result.capturedWeapons).every((amount) => amount <= 0) && <span>回収できる装備なし</span>}
        </div>
        {result.intelligenceEvents.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>敵情評価</strong>
            {result.intelligenceEvents.map((event) => (
              <span key={event}>{event}</span>
            ))}
            {result.intelligenceLessonOfficerIds.length > 0 && (
              <span>教訓記録 {result.intelligenceLessonOfficerIds.length}名</span>
            )}
          </div>
        )}
        {result.commandTransmissionOutcomes.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>伝令評価</strong>
            <span>
              発令{result.commandTransmissionOutcomes.length}件 / 遅延{commandTransmissionDelayedCount}件 / 混線
              {commandTransmissionCongestedCount}件 / 最長{commandTransmissionMaxDelay}秒
            </span>
            {result.commandTransmissionOutcomes.slice(0, 6).map((outcome) => (
              <span key={outcome.id}>
                {outcome.summary} / {outcome.reasons.slice(0, 4).join(" / ")}
              </span>
            ))}
          </div>
        )}
        {result.staffAccountabilityEvents.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>参謀責任</strong>
            {result.staffAccountabilityEvents.map((event) => (
              <span key={event.id}>
                {event.summary} / 教訓 {event.lessonTag} / 経験+{event.xpDelta} / 疲労+{event.fatigueDelta}
              </span>
            ))}
          </div>
        )}
        {result.staffAdvisoryOutcomes.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>参謀警告対応</strong>
            {result.staffAdvisoryOutcomes.map((outcome) => (
              <span key={outcome.id}>
                {outcome.summary} / {outcome.resultLabel} / 敵圧{outcome.pressureAtIssue} / 戦線
                {outcome.finalLineIntegrity}%
              </span>
            ))}
          </div>
        )}
        {result.enemyCommandEffectOutcomes.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>敵指揮網対応評価</strong>
            {result.enemyCommandEffectOutcomes.map((outcome) => (
              <span key={outcome.id}>
                {outcome.roleLabel}: {outcome.resultLabel} / {outcome.effectLabel} / {outcome.metricLabel} /{" "}
                {outcome.assessmentReason}
              </span>
            ))}
          </div>
        )}
        {result.objectiveEventResponseOutcomes.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>目標イベント対応</strong>
            {result.objectiveEventResponseOutcomes.map((outcome) => (
              <span key={outcome.id}>
                {outcome.summary} / {outcome.roleLabel} / 教訓 {outcome.lessonTag}
              </span>
            ))}
          </div>
        )}
        {result.withdrawalRearGuard.length > 0 && (
          <div className="battle-spoils-box intelligence-review-box">
            <strong>撤退後衛</strong>
            {result.withdrawalPursuitSummary && <span>{result.withdrawalPursuitSummary}</span>}
            {result.withdrawalRearGuard.map((entry) => (
              <span key={entry.unitId}>
                {entry.unitName}: {entry.roleLabel} / 追撃被害{entry.pursuitDamagePrevented}抑止 / 後衛損耗
                {entry.rearGuardCasualties} / {entry.riskLabel} / {entry.reason}
              </span>
            ))}
            {result.withdrawalRearGuardPlanAssessments.length > 0 && <strong>撤退後衛照合</strong>}
            {result.withdrawalRearGuardPlanAssessments.map((plan) => {
              const actual = rearGuardActualByUnit[plan.unitId];
              const comparison = rearGuardComparisonLabel(plan, actual);
              return (
                <span key={`rear-guard-plan-${plan.unitId}`}>
                  {plan.unitName}: 予測損耗{plan.predictedCasualties}
                  {actual ? ` -> 実損耗${actual.rearGuardCasualties}` : " -> 実績なし"} / 予測将校危険
                  {plan.predictedOfficerRisk} / 追撃抑止{plan.pursuitCover} / 温存{plan.preservationScore} /{" "}
                  {plan.tradeoffLabel}
                  {comparison ? ` / ${comparison}` : ""} / {plan.reason}
                </span>
              );
            })}
          </div>
        )}
        {tacticalLessonPreviews.length > 0 && (
          <div className="battle-spoils-box tactical-lesson-preview-box">
            <strong>次戦教訓</strong>
            {tacticalLessonPreviews.map((item) => (
              <span key={item.unitId}>
                {item.unitName}: {item.preview}
              </span>
            ))}
          </div>
        )}
        <button className="primary-button" type="button" onClick={onContinue}>
          結果を反映して幕舎へ
        </button>
      </div>
      <div className="panel">
        <div className="section-title">
          <span>損耗</span>
          <strong>次戦へ持ち越し</strong>
        </div>
        {Object.entries(result.casualtiesByUnit).map(([unitId, casualties]) => (
          <article key={unitId} className="history-item">
            <h3>{result.unitNamesById[unitId] ?? unitId}</h3>
            <p>
              戦闘損耗 {result.rawCasualtiesByUnit[unitId] ?? casualties} / 収容 {result.recoveredByUnit[unitId] ?? 0} /
              永久損耗 {casualties} / 経験 +{result.xpByUnit[unitId] ?? 0} / 装備摩耗 -
              {(result.equipmentWearByUnit[unitId] ?? 0).toFixed(2)}
            </p>
            {medicalRecoveryByUnit[unitId]?.bonusRecovered > 0 && (
              <p>
                救護線 追加収容+{medicalRecoveryByUnit[unitId].bonusRecovered} / 実効収容率
                {Math.round(medicalRecoveryByUnit[unitId].effectiveRecoveryRate * 100)}% /{" "}
                {medicalRecoveryByUnit[unitId].reason}
              </p>
            )}
            <p>
              任務 {result.battleRoleByUnit[unitId] ?? "戦線勤務"} /{" "}
              {(result.commendationsByUnit[unitId] ?? []).length > 0
                ? (result.commendationsByUnit[unitId] ?? []).join("、")
                : "特記事項なし"}
            </p>
            {result.staffAdvisoryOutcomes
              .filter((outcome) => outcome.unitIds.includes(unitId))
              .map((outcome) => (
                <p key={outcome.id}>
                  参謀警告 {outcome.segmentName} / {outcome.presetLabel} / {outcome.resultLabel}
                </p>
              ))}
            {result.objectiveEventResponseOutcomes
              .filter((outcome) => outcome.unitId === unitId)
              .map((outcome) => (
                <p key={outcome.id}>
                  目標イベント {outcome.objectiveLabel} / {outcome.eventLabel} / {outcome.eventChainLabel} / {outcome.resultLabel} /{" "}
                  {outcome.assessmentReason}
                </p>
              ))}
            {result.enemyCommandEffectOutcomes
              .filter((outcome) => outcome.unitIds.includes(unitId))
              .map((outcome) => (
                <p key={outcome.id}>
                  敵指揮網 {outcome.roleLabel} / {outcome.resultLabel} / {outcome.metricLabel} / 教訓 {outcome.lessonTag}
                </p>
              ))}
            {result.commandTransmissionOutcomes
              .filter((outcome) => outcome.unitId === unitId)
              .map((outcome) => (
                <p key={outcome.id}>
                  伝令 {outcome.orderLabel} / {outcome.delaySeconds}秒 / {outcome.assessment}
                  {outcome.congestionDelaySeconds > 0 ? ` / 混線+${outcome.congestionDelaySeconds}秒` : ""} /{" "}
                  {outcome.arrived ? "到達済み" : "未着"}
                </p>
              ))}
            {result.withdrawalRearGuard
              .filter((entry) => entry.unitId === unitId)
              .map((entry) => (
                <p key={`rear-guard-${entry.unitId}`}>
                  撤退後衛 {entry.roleLabel} / 追撃被害{entry.pursuitDamagePrevented}抑止 / 後衛損耗
                  {entry.rearGuardCasualties} / {entry.riskLabel} / {entry.eventLabel} / {entry.reason}
                </p>
              ))}
            {rearGuardPlanByUnit[unitId] && (
              <p>
                後衛予測 予測損耗{rearGuardPlanByUnit[unitId].predictedCasualties} / 実損耗
                {rearGuardActualByUnit[unitId]?.rearGuardCasualties ?? "-"} / 予測将校危険
                {rearGuardPlanByUnit[unitId].predictedOfficerRisk} / 追撃抑止{rearGuardPlanByUnit[unitId].pursuitCover} /
                温存{rearGuardPlanByUnit[unitId].preservationScore} / {rearGuardPlanByUnit[unitId].tradeoffLabel}
              </p>
            )}
            {tacticalLessonPreviewForStaffOutcomes(result.staffAdvisoryOutcomes, unitId) && (
              <p>{tacticalLessonPreviewForStaffOutcomes(result.staffAdvisoryOutcomes, unitId)}</p>
            )}
            {tacticalLessonPreviewForEnemyCommandEffects(result.enemyCommandEffectOutcomes, unitId) && (
              <p>{tacticalLessonPreviewForEnemyCommandEffects(result.enemyCommandEffectOutcomes, unitId)}</p>
            )}
            {tacticalLessonPreviewForObjectiveEventOutcomes(result.objectiveEventResponseOutcomes, unitId) && (
              <p>{tacticalLessonPreviewForObjectiveEventOutcomes(result.objectiveEventResponseOutcomes, unitId)}</p>
            )}
            {tacticalLessonPreviewForFacilityDuties(result.battleRoleByUnit, result.commendationsByUnit, unitId) && (
              <p>{tacticalLessonPreviewForFacilityDuties(result.battleRoleByUnit, result.commendationsByUnit, unitId)}</p>
            )}
          </article>
        ))}
        <div className="officer-after-action">
          <strong>将校戦果</strong>
          {result.officerEvents.map((event) => (
            <p key={event}>{event}</p>
          ))}
          {result.staffAccountabilityEvents.length > 0 && (
            <>
              <strong>参謀評価</strong>
              {result.staffAccountabilityEvents.map((event) => (
                <p key={event.id}>{event.summary}</p>
              ))}
            </>
          )}
          {result.divisionCommanderEvents.length > 0 && (
            <>
              <strong>師団指揮</strong>
              {result.divisionCommanderEvents.map((event) => (
                <p key={event}>{event}</p>
              ))}
            </>
          )}
          {woundedOfficerCount > 0 && (
            <small>負傷将校 {woundedOfficerCount}名。次ターン以降の幕舎で復帰を待つ。</small>
          )}
        </div>
      </div>
    </section>
  );
}
