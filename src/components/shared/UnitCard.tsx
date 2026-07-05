import { assetRegistry } from "../../assets/manifest";
import type { ArmyUnit } from "../../game/army/types";
import { unitTypeLabels } from "./labels";

interface UnitCardProps {
  unit: ArmyUnit;
  onRookie?: (unitId: string) => void;
  onVeteran?: (unitId: string) => void;
}

export function UnitCard({ unit, onRookie, onVeteran }: UnitCardProps) {
  const strength = Math.round((unit.soldiers / unit.maxSoldiers) * 100);

  return (
    <article className="unit-card">
      <img
        className={`unit-token unit-token-image ${unit.type}`}
        src={assetRegistry.army.unitTokens[unit.type].src64}
        alt=""
        aria-hidden="true"
      />
      <div>
        <h3>{unit.name}</h3>
        <p>{unitTypeLabels[unit.type]} / 練度L{unit.level}</p>
      </div>
      <dl>
        <dt>兵力</dt>
        <dd>{unit.soldiers}/{unit.maxSoldiers} ({strength}%)</dd>
        <dt>士気</dt>
        <dd>{Math.round(unit.morale)}</dd>
        <dt>疲労</dt>
        <dd>{Math.round(unit.condition)}</dd>
        <dt>弾薬</dt>
        <dd>{Math.round(unit.ammo)}</dd>
        <dt>経験</dt>
        <dd>{unit.experience}</dd>
      </dl>
      {(onRookie || onVeteran) && (
        <div className="button-row">
          {onRookie && (
            <button type="button" onClick={() => onRookie(unit.id)}>
              新兵補充
            </button>
          )}
          {onVeteran && (
            <button type="button" onClick={() => onVeteran(unit.id)}>
              古参兵補充
            </button>
          )}
        </div>
      )}
    </article>
  );
}
