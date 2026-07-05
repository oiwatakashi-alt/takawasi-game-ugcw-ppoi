import { assetRegistry } from "../../assets/manifest";
import {
  enemyCompositionIntelForOperation,
  enemyCompositionLabel,
  enemyIntelConfidenceLabel,
  enemyThreatLabels,
  enemyThreatRangeLabel,
  enemyThreatRoleLabels,
  enemyThreatSeverityLabel,
  type EnemyCompositionForecastInput,
} from "../../game/theater/enemyIntel";
import type { StrategicOperation } from "../../game/theater/types";

interface EnemyIntelPanelProps {
  context: EnemyCompositionForecastInput;
  operation: StrategicOperation;
  title?: string;
  compact?: boolean;
}

export function EnemyIntelPanel({ context, operation, title = "敵情判断", compact = false }: EnemyIntelPanelProps) {
  const intel = enemyCompositionIntelForOperation(operation, context);
  const confidence = enemyIntelConfidenceLabel({ ...operation, enemyCompositionIntel: intel });
  const strongestThreat = intel.threats[0];
  const threatPeak = Math.max(1, ...intel.threats.map((threat) => threat.intensity));

  return (
    <div className={`enemy-intel-panel ${compact ? "compact" : ""} ${intel.reconEffect ? `effect-${intel.reconEffect}` : ""}`}>
      <div className="enemy-intel-heading">
        <span>
          <img src={assetRegistry.theater.enemyPressure.src64} alt="" aria-hidden="true" />
          {title}
        </span>
        <strong>{confidence}</strong>
      </div>
      <div className="enemy-intel-summary">
        <strong>{enemyCompositionLabel(intel.threats)}</strong>
        <span>{enemyThreatRangeLabel(intel) || "範囲不明"}</span>
      </div>
      {strongestThreat ? (
        <p>
          主脅威: {enemyThreatLabels[strongestThreat.type]} / {enemyThreatRoleLabels[strongestThreat.type]} /{" "}
          {enemyThreatSeverityLabel(strongestThreat.intensity)}
        </p>
      ) : undefined}
      <div className="enemy-threat-bars" aria-label="敵情脅威内訳">
        {intel.threats.map((threat) => {
          const range = intel.threatRanges[threat.type];
          return (
            <div key={threat.type} className={`enemy-threat-bar ${threat.type}`}>
              <span>{enemyThreatLabels[threat.type]}</span>
              <i style={{ width: `${Math.max(12, Math.round((threat.intensity / threatPeak) * 100))}%` }} />
              <em>
                {range.min}-{range.max}
              </em>
            </div>
          );
        })}
      </div>
      {!compact && intel.reconQualityScore ? (
        <small>
          偵察{intel.reconQualityScore}
          {intel.reconEffect ? ` / ${confidence}` : ""}
        </small>
      ) : undefined}
    </div>
  );
}
