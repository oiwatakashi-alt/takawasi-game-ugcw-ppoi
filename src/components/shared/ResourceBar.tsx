import type { CampaignState } from "../../game/campaign/types";

interface ResourceBarProps {
  campaign: CampaignState;
  onReset: () => void;
}

export function ResourceBar({ campaign, onReset }: ResourceBarProps) {
  const { resources } = campaign;

  return (
    <header className="resource-bar">
      <div>
        <strong>第{campaign.turnNumber}戦略ターン</strong>
        <span>{campaign.theater.campaignChapter}</span>
        <span>{campaign.lastMessage}</span>
      </div>
      <div className="resource-grid">
        <span>軍資金 {resources.gold}</span>
        <span>新兵 {resources.recruits}</span>
        <span>古参兵 {resources.veterans}</span>
        <span>弾薬 {Math.round(resources.ammunition)}</span>
        <span>補給 {resources.supplies}</span>
        <span>資材 {resources.materials}</span>
        <span>工兵力 {resources.engineerLabor}</span>
        <span>威信 {resources.reputation}</span>
      </div>
      <button className="ghost-button" type="button" onClick={onReset}>
        戦役をリセット
      </button>
    </header>
  );
}
