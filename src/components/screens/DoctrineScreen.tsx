import { assetRegistry, type DoctrineIconId } from "../../assets/manifest";
import type { CampaignState } from "../../game/campaign/types";
import {
  defaultStaffIntelligenceDirectiveMode,
  fireDisciplineFromDoctrine,
  staffIntelligenceDirectiveFromDoctrine,
  staffIntelligenceDirectiveProfiles,
  strategicDoctrineFromDoctrine,
} from "../../game/doctrine/applyDoctrine";
import type { StaffIntelligenceDirectiveMode } from "../../game/doctrine/types";

const careerRows = [
  { id: "command", name: "軍団指揮", level: 1, effect: "命令伝達/火力計画", note: "斉射時間、再装填、計画間隔を改善する。" },
  { id: "organization", name: "軍制拡張", level: 0, effect: "師団/旅団枠", note: "新しい旅団枠と予備編成を開く。" },
  { id: "training", name: "訓練", level: 0, effect: "射撃統制/新兵品質", note: "火力任務の射撃効率と疲労負荷を改善する。" },
  { id: "logistics", name: "兵站", level: 0, effect: "補給/弾薬/4段計画", note: "火力任務の弾薬消費を抑え、長い計画を許可する。" },
  { id: "engineering", name: "野戦工兵", level: 0, effect: "築城/修理", note: "陣地構築速度と耐久回復を上げる。" },
  { id: "medicine", name: "野戦医療", level: 0, effect: "損耗回復", note: "戦後の兵員損失を一部回収する。" },
  { id: "intelligence", name: "敵情分析", level: 0, effect: "偵察/教訓反映", note: "敵情誤認の教訓を整理し、次ターン初期敵情と偵察任務を改善する。" },
] satisfies Array<{ id: DoctrineIconId; name: string; level: number; effect: string; note: string }>;

interface StaffLessonAdvisory {
  id: string;
  title: string;
  summary: string;
  evidence: string;
  directiveMode: StaffIntelligenceDirectiveMode;
  doctrineId?: DoctrineIconId;
  doctrineLabel?: string;
}

const countHistoryMatches = (entries: string[], patterns: string[]): number =>
  entries.filter((entry) => patterns.some((pattern) => entry.includes(pattern))).length;

const buildStaffLessonAdvisories = (campaign: CampaignState): StaffLessonAdvisory[] => {
  const officerHistory = campaign.officers.flatMap((officer) => officer.history);
  const unitHistory = campaign.army.units.flatMap((unit) => unit.battleHistory);
  const allHistory = [...officerHistory, ...unitHistory, ...campaign.battleHistory.map((entry) => entry.summary)];
  const hasDoctrine = (id: string) => campaign.doctrines.unlocked.includes(id);
  const commandFrictionCount =
    countHistoryMatches(officerHistory, ["伝令混線", "参謀長 警告、伝令混線"]) +
    countHistoryMatches(unitHistory, ["伝令評価"]);
  const misinformationCount = countHistoryMatches(allHistory, ["敵情誤認", "偵察教訓", "連鎖抑止失敗"]);
  const supplyCount = countHistoryMatches(allHistory, ["補給点", "補給路寸断", "弾薬不足", "兵站主任 警告"]);
  const engineeringCount = countHistoryMatches(allHistory, ["施設修理", "施設防衛", "築城線", "工兵主任 警告"]);

  const advisories: StaffLessonAdvisory[] = [];
  if (commandFrictionCount > 0) {
    const doctrineId = hasDoctrine("command") ? (!hasDoctrine("organization") ? "organization" : undefined) : "command";
    advisories.push({
      id: "command-transmission",
      title: "司令部伝達の再訓練",
      summary:
        doctrineId === "organization"
          ? "前戦で命令集中時の混線が出た。軍制拡張で処理容量と部隊整理の余裕を増やす。"
          : doctrineId === "command"
            ? "前戦で伝令遅延が目立った。軍団指揮を整備して伝達時間と一括発令処理を改善する。"
            : "前戦で伝令混線が出たが、主要な指揮系方針は採用済み。次戦は命令を束ねすぎない運用を優先する。",
      evidence: `伝令/混線記録 ${commandFrictionCount}件`,
      directiveMode: "balanced",
      doctrineId,
      doctrineLabel: doctrineId === "organization" ? "軍制拡張" : doctrineId === "command" ? "軍団指揮" : undefined,
    });
  }
  if (misinformationCount > 0) {
    advisories.push({
      id: "counter-intelligence",
      title: "偵察教訓の整理",
      summary: "敵情誤認や目標イベントの連鎖失敗がある。次ターンは防諜警戒で教訓値を厚くする。",
      evidence: `敵情/偵察教訓 ${misinformationCount}件`,
      directiveMode: "counter_intelligence",
      doctrineId: hasDoctrine("intelligence") ? undefined : "intelligence",
      doctrineLabel: hasDoctrine("intelligence") ? undefined : "敵情分析",
    });
  }
  if (supplyCount > 0) {
    advisories.push({
      id: "logistics-recon",
      title: "補給路の再点検",
      summary: "補給点や弾薬不足の記録がある。兵站偵察で小任務判断と戦闘補給を安定させる。",
      evidence: `補給/弾薬記録 ${supplyCount}件`,
      directiveMode: "logistics_recon",
      doctrineId: hasDoctrine("logistics") ? undefined : "logistics",
      doctrineLabel: hasDoctrine("logistics") ? undefined : "兵站",
    });
  }
  if (engineeringCount > 0) {
    advisories.push({
      id: "engineer-survey",
      title: "陣地線の測量",
      summary: "施設任務や築城線の警告がある。工兵測量で修理と陣地整備を優先する。",
      evidence: `施設/築城記録 ${engineeringCount}件`,
      directiveMode: "engineer_survey",
      doctrineId: hasDoctrine("engineering") ? undefined : "engineering",
      doctrineLabel: hasDoctrine("engineering") ? undefined : "野戦工兵",
    });
  }

  return advisories.slice(0, 3);
};

export function DoctrineScreen({
  campaign,
  onInvest,
  onSetStaffIntelligenceDirective,
}: {
  campaign: CampaignState;
  onInvest: (id: string) => void;
  onSetStaffIntelligenceDirective: (mode: StaffIntelligenceDirectiveMode) => void;
}) {
  const fireDiscipline = fireDisciplineFromDoctrine(campaign.doctrines);
  const strategicDoctrine = strategicDoctrineFromDoctrine(campaign.doctrines);
  const staffDirective = staffIntelligenceDirectiveFromDoctrine(campaign.doctrines);
  const staffDirectiveModes = Object.keys(staffIntelligenceDirectiveProfiles) as StaffIntelligenceDirectiveMode[];
  const staffLessonAdvisories = buildStaffLessonAdvisories(campaign);

  return (
    <section className="career-layout">
      <aside className="career-summary">
        <div className="section-title">
          <span>幕舎: 参謀方針</span>
          <strong>{campaign.doctrines.points} 点</strong>
        </div>
        <h2>参謀会議</h2>
        <p>戦役全体の軍制、訓練、兵站、築城方針を決める。取得済み方針は次の戦闘準備と戦後回復に影響する。</p>
        <div className="career-token">
          <img src={assetRegistry.doctrine.command.src128} alt="" aria-hidden="true" />
          <strong>{campaign.doctrines.points}</strong>
          <span>使用可能方針点</span>
        </div>
        <div className="career-effect-card">
          <strong>現在の火力規律</strong>
          <span>{fireDiscipline.label}</span>
          <p>{fireDiscipline.summary}</p>
          <small>
            火力計画 {fireDiscipline.maxPlannedStages}段 / 段間隔 {fireDiscipline.plannedStageSpacingSeconds}秒 /
            再装填 -{fireDiscipline.cooldownReductionSeconds}秒
          </small>
        </div>
        <div className="career-effect-card">
          <strong>現在の戦役参謀支援</strong>
          <span>{strategicDoctrine.label}</span>
          <p>{strategicDoctrine.summary}</p>
          <small>
            出撃枠 +{strategicDoctrine.deploymentSlotBonus} / 築城費用{" "}
            {Math.round(strategicDoctrine.engineeringCostMultiplier * 100)}% / 修理+
            {strategicDoctrine.repairAmountBonus} / 陣地効果{" "}
            {Math.round(strategicDoctrine.fortificationEffectMultiplier * 100)}%
          </small>
          <small>
            補給消費 {Math.round(strategicDoctrine.supplySpendMultiplier * 100)}% / 医療回復+
            {Math.round(strategicDoctrine.medicalRecoveryBonus * 100)}% / 小任務+
            {strategicDoctrine.autoResolveQualityBonus}
          </small>
          <small>
            敵情分析 +{strategicDoctrine.initialIntelConfidenceShiftBonus} / 教訓値+
            {strategicDoctrine.strategicIntelPreparationBonus}
          </small>
        </div>
        <div className="career-effect-card">
          <strong>現在の参謀任務</strong>
          <span>{staffDirective.label}</span>
          <p>{staffDirective.summary}</p>
          <small>
            小任務+{staffDirective.autoResolveQualityBonus} / 初期敵情+
            {staffDirective.initialIntelConfidenceShiftBonus} / 教訓値+
            {staffDirective.strategicIntelPreparationBonus}
          </small>
          <small>
            補給消費 {Math.round(staffDirective.supplySpendMultiplier * 100)}% / 築城費用{" "}
            {Math.round(staffDirective.engineeringCostMultiplier * 100)}% / 修理+{staffDirective.repairAmountBonus}
          </small>
        </div>
      </aside>

      <div className="career-board">
        <div className="staff-directive-board">
          <div className="section-title">
            <span>ターン参謀任務</span>
            <strong>{staffDirective.label}</strong>
          </div>
          {staffLessonAdvisories.length > 0 && (
            <div className="staff-lesson-advisory">
              <strong>前戦参謀教訓</strong>
              {staffLessonAdvisories.map((advisory) => {
                const directive = staffIntelligenceDirectiveProfiles[advisory.directiveMode];
                const advisoryDoctrineId = advisory.doctrineId;
                const canInvest =
                  advisoryDoctrineId !== undefined &&
                  !campaign.doctrines.unlocked.includes(advisoryDoctrineId) &&
                  campaign.doctrines.points > 0;
                return (
                  <article key={advisory.id}>
                    <span>{advisory.title}</span>
                    <p>{advisory.summary}</p>
                    <small>
                      根拠: {advisory.evidence} / 推奨任務: {directive.label}
                      {advisory.doctrineLabel ? ` / 推奨方針: ${advisory.doctrineLabel}` : ""}
                    </small>
                    <div className="staff-lesson-actions">
                      <button type="button" onClick={() => onSetStaffIntelligenceDirective(advisory.directiveMode)}>
                        {directive.label}に切替
                      </button>
                      {advisoryDoctrineId && (
                        <button type="button" disabled={!canInvest} onClick={() => onInvest(advisoryDoctrineId)}>
                          {campaign.doctrines.unlocked.includes(advisoryDoctrineId)
                            ? "採用済み"
                            : campaign.doctrines.points <= 0
                              ? "方針点不足"
                              : `${advisory.doctrineLabel}を採用`}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="staff-directive-grid">
            {staffDirectiveModes.map((mode) => {
              const profile = staffIntelligenceDirectiveProfiles[mode];
              const active = staffDirective.mode === mode;
              return (
                <button
                  key={mode}
                  className={active ? "active" : ""}
                  type="button"
                  onClick={() => onSetStaffIntelligenceDirective(mode)}
                >
                  <strong>{profile.label}</strong>
                  <span>{profile.summary}</span>
                  <small>
                    小任務+{profile.autoResolveQualityBonus} / 初期敵情+
                    {profile.initialIntelConfidenceShiftBonus} / 教訓値+{profile.strategicIntelPreparationBonus}
                  </small>
                </button>
              );
            })}
          </div>
          <p>
            {staffIntelligenceDirectiveProfiles[
              campaign.doctrines.staffIntelligenceDirective ?? defaultStaffIntelligenceDirectiveMode
            ].label}を保存中。主戦場後の次ターン生成と偵察任務評価へ反映する。
          </p>
        </div>
        {careerRows.map((row) => {
          const unlocked = campaign.doctrines.unlocked.includes(row.id);
          const level = unlocked ? Math.max(1, row.level) : row.level;
          return (
            <article key={row.id} className={`career-row ${unlocked ? "unlocked" : ""}`}>
              <img className="career-row-icon" src={assetRegistry.doctrine[row.id].src64} alt="" aria-hidden="true" />
              <div className="career-row-title">
                <h3>{row.name}</h3>
                <span>{row.effect}</span>
              </div>
              <div className="career-pips" aria-label={`${row.name} ${level}`}>
                {[0, 1, 2, 3, 4].map((pip) => (
                  <i key={pip} className={pip < level ? "filled" : ""} />
                ))}
              </div>
              <p>{row.note}</p>
              <button
                type="button"
                disabled={unlocked || campaign.doctrines.points <= 0}
                onClick={() => onInvest(row.id)}
              >
                {unlocked ? "採用済み" : "方針点を投入"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
