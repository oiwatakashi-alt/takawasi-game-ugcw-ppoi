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
