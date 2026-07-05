import { CAMP_SCREENS, SCREEN_LABELS, type ScreenId } from "../../app/routes";

interface ScreenTabsProps {
  current: ScreenId;
  onChange: (screen: ScreenId) => void;
  onBackToMap: () => void;
  onDeployment: () => void;
}

export function ScreenTabs({ current, onChange, onBackToMap, onDeployment }: ScreenTabsProps) {
  return (
    <nav className="screen-tabs" aria-label="幕舎タブ">
      <button type="button" onClick={onBackToMap}>
        戦略マップへ戻る
      </button>
      {CAMP_SCREENS.map((screen) => (
        <button
          key={screen}
          className={current === screen ? "active" : ""}
          type="button"
          onClick={() => onChange(screen)}
        >
          {SCREEN_LABELS[screen]}
        </button>
      ))}
      <button className="primary-button" type="button" onClick={onDeployment}>
        出撃配置へ
      </button>
    </nav>
  );
}
