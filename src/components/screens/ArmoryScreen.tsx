import { useState } from "react";
import { weaponDefinitions } from "../../content/baseGame/weapons";
import { assetRegistry } from "../../assets/manifest";
import {
  estimateRearm,
  estimateWeaponSwitch,
  getUnitWeaponKey,
  getWeaponAssetKey,
  type WeaponKey,
} from "../../game/army/equipment";
import type { CampaignState } from "../../game/campaign/types";
import { unitTypeLabels, weaponLabels } from "../shared/labels";

interface WeaponRow {
  key: WeaponKey;
  className: string;
}

const weaponRows: WeaponRow[] = [
  { key: "reserveRifle", className: "standard" },
  { key: "dreyse", className: "rifle" },
  { key: "mauser71", className: "rifle" },
  { key: "jaegerRifle", className: "rifle" },
  { key: "fieldGun", className: "gun" },
  { key: "tools", className: "tools" },
];

export function ArmoryScreen({
  campaign,
  onRearm,
  onSwitchWeapon,
}: {
  campaign: CampaignState;
  onRearm: (unitId: string) => void;
  onSwitchWeapon: (unitId: string, weaponKey: WeaponKey) => void;
}) {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponKey>("dreyse");
  const selected = weaponRows.find((weapon) => weapon.key === selectedWeapon) ?? weaponRows[0];
  const selectedDefinition = weaponDefinitions[selected.key];
  const assignedUnits = campaign.army.units.filter((unit) => getUnitWeaponKey(unit) === selected.key);
  const compatibleUnits = campaign.army.units.filter((unit) =>
    (selectedDefinition.compatibleTypes as readonly string[]).includes(unit.type),
  );
  const demand = compatibleUnits.reduce((sum, unit) => sum + unit.maxSoldiers, 0);
  const stock = campaign.resources.weapons[selected.key];
  const shortage = Math.max(0, demand - stock);

  return (
    <section className="armory-layout">
      <div className="armory-list panel">
        <div className="section-title">
          <span>幕舎: 兵站・装備</span>
          <strong>武器庫</strong>
        </div>
        <div className="weapon-table">
          <div className="weapon-row header">
            <span>武器</span>
            <span>兵種</span>
            <span>在庫</span>
            <span>配備</span>
          </div>
          {weaponRows.map((weapon) => {
            const definition = weaponDefinitions[weapon.key];
            const equippedSoldiers = campaign.army.units
              .filter((unit) => getUnitWeaponKey(unit) === weapon.key)
              .reduce((sum, unit) => sum + unit.soldiers, 0);
            return (
              <button
                key={weapon.key}
                className={`weapon-row ${selectedWeapon === weapon.key ? "selected" : ""}`}
                type="button"
                onClick={() => setSelectedWeapon(weapon.key)}
              >
                <span>{weaponLabels[weapon.key]}</span>
                <span>{definition.compatibleTypes.map((type) => unitTypeLabels[type]).join("/")}</span>
                <span>{campaign.resources.weapons[weapon.key] ?? 0}</span>
                <span>{equippedSoldiers}</span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="weapon-inspector">
        <div className={`weapon-silhouette ${selected.className}`}>
          <img src={assetRegistry.army.weapons[getWeaponAssetKey(selected.key)].src128} alt="" aria-hidden="true" />
        </div>
        <div className="section-title">
          <span>{weaponLabels[selected.key]}</span>
          <strong>{selectedDefinition.compatibleTypes.map((type) => unitTypeLabels[type]).join("/")}</strong>
        </div>
        <dl className="weapon-stat-grid">
          <dt>品質</dt>
          <dd>{selectedDefinition.quality.toFixed(2)}</dd>
          <dt>射程</dt>
          <dd>{selectedDefinition.range}</dd>
          <dt>火力</dt>
          <dd>{selectedDefinition.firepower.toFixed(2)}</dd>
          <dt>発射</dt>
          <dd>{selectedDefinition.fireRate.toFixed(2)}</dd>
          <dt>役割</dt>
          <dd>{selectedDefinition.role}</dd>
          <dt>在庫</dt>
          <dd>{stock ?? 0}</dd>
          <dt>不足</dt>
          <dd>{shortage}</dd>
        </dl>
        <div className="armory-logistics">
          <span>弾薬 {Math.round(campaign.resources.ammunition)}</span>
          <span>補給 {campaign.resources.supplies}</span>
          <span>資材 {campaign.resources.materials}</span>
        </div>
      </aside>

      <div className="equipped-units panel">
        <div className="section-title">
          <span>装備中部隊</span>
          <strong>{assignedUnits.length}部隊 / 換装候補{compatibleUnits.length}部隊</strong>
        </div>
        {compatibleUnits.map((unit) => {
          const estimate = estimateRearm(unit, campaign.resources);
          const switchEstimate = estimateWeaponSwitch(unit, campaign.resources, selected.key);
          const currentWeaponKey = getUnitWeaponKey(unit);
          return (
            <article key={unit.id} className="equipment-unit-row">
              <img
                className={`unit-token unit-token-image ${unit.type}`}
                src={assetRegistry.army.unitTokens[unit.type].src64}
                alt=""
                aria-hidden="true"
              />
              <div>
                <h3>{unit.name}</h3>
                <p>
                  {unit.soldiers}/{unit.maxSoldiers} 名 / 現装 {weaponLabels[currentWeaponKey]} / 品質{" "}
                  {unit.weaponQuality.toFixed(2)}
                  {currentWeaponKey === selected.key && estimate.neededWeapons > 0
                    ? ` -> ${Math.min(estimate.targetQuality, unit.weaponQuality + estimate.qualityGain).toFixed(2)}`
                    : ""}{" "}
                  / 弾薬 {Math.round(unit.ammo)}
                </p>
                <small>
                  {currentWeaponKey === selected.key
                    ? `再装備見積: 必要${estimate.neededWeapons} / 在庫${estimate.availableWeapons}`
                    : `換装: 必要${switchEstimate.requiredWeapons} / 在庫${switchEstimate.availableWeapons} / 旧装備回収${switchEstimate.returnedWeapons}`}
                </small>
              </div>
              <div className="equipment-actions">
                {currentWeaponKey === selected.key ? (
                  <button type="button" disabled={!estimate.canImprove} onClick={() => onRearm(unit.id)}>
                    再装備
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!switchEstimate.canSwitch}
                    onClick={() => onSwitchWeapon(unit.id, selected.key)}
                  >
                    換装
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
