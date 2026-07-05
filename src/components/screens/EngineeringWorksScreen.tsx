import { assetRegistry } from "../../assets/manifest";
import { fortificationDefinitions } from "../../content/baseGame/structures";
import { strategicDoctrineFromDoctrine } from "../../game/doctrine/applyDoctrine";
import { applyEngineeringDoctrineCost } from "../../game/fortifications/build";
import type { FortificationType } from "../../game/fortifications/types";
import type { CampaignState } from "../../game/campaign/types";
import { fortificationStatusLabels } from "../shared/labels";

interface EngineeringWorksScreenProps {
  campaign: CampaignState;
  onBuild: (type: FortificationType) => void;
  onRepair: (structureId: string) => void;
}

const effectSummary = (definition: (typeof fortificationDefinitions)[FortificationType]): string => {
  const entries = [
    definition.effects.cover > 0 ? `遮蔽 +${definition.effects.cover}` : "",
    definition.effects.morale > 0 ? `士気 +${definition.effects.morale}` : "",
    definition.effects.ammoRecovery > 0 ? `補給 +${definition.effects.ammoRecovery}` : "",
    definition.effects.enemySlow > 0 ? `遅滞 +${definition.effects.enemySlow}` : "",
    definition.effects.visibility > 0 ? `視界 +${definition.effects.visibility}` : "",
    definition.effects.casualtyRecovery > 0 ? `収容 +${definition.effects.casualtyRecovery}%` : "",
  ].filter(Boolean);
  return entries.join(" / ") || "直接効果なし";
};

const costSummary = (cost: ReturnType<typeof applyEngineeringDoctrineCost>): string =>
  [
    `資材${cost.materials ?? 0}`,
    `工兵力${cost.engineerLabor ?? 0}`,
    cost.supplies ? `補給${cost.supplies}` : "",
    cost.gold ? `軍資金${cost.gold}` : "",
  ]
    .filter(Boolean)
    .join(" / ");

export function EngineeringWorksScreen({ campaign, onBuild, onRepair }: EngineeringWorksScreenProps) {
  const sector = campaign.theater.sectors.find(
    (candidate) => candidate.id === campaign.theater.playerArmyPositionSectorId,
  );
  const strategicDoctrine = strategicDoctrineFromDoctrine(campaign.doctrines);

  return (
    <section className="screen-grid two-column">
      <div className="panel">
        <div className="section-title">
          <span>幕舎: 築城</span>
          <strong>{sector?.name}</strong>
        </div>
        <div className="card-grid">
          {(Object.keys(fortificationDefinitions) as FortificationType[]).map((type) => {
            const definition = fortificationDefinitions[type];
            const buildCost = applyEngineeringDoctrineCost(definition.buildCost, strategicDoctrine);
            return (
              <article key={type} className="structure-card">
                <img
                  className={`structure-icon structure-icon-image ${type}`}
                  src={assetRegistry.engineering.structures[type].src64}
                  alt=""
                  aria-hidden="true"
                />
                <h3>{definition.name}</h3>
                <p>{effectSummary(definition)}</p>
                <small>費用: {costSummary(buildCost)}</small>
                {strategicDoctrine.engineeringCostMultiplier < 1 && (
                  <small>野戦工兵: 築城費用{Math.round(strategicDoctrine.engineeringCostMultiplier * 100)}%</small>
                )}
                <button type="button" onClick={() => onBuild(type)}>
                  建設
                </button>
              </article>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="section-title">
          <span>既存防衛施設</span>
          <strong>{sector?.structures.length ?? 0}施設</strong>
        </div>
        {sector?.structures.map((structure) => {
          const definition = fortificationDefinitions[structure.type];
          const repairCost = applyEngineeringDoctrineCost(definition.repairCost, strategicDoctrine);
          return (
            <article key={structure.id} className={`structure-row ${structure.status}`}>
              <img
                className={`structure-icon structure-icon-image ${structure.type}`}
                src={assetRegistry.engineering.structures[structure.type].src64}
                alt=""
                aria-hidden="true"
              />
              <img
                className="structure-status-icon"
                src={assetRegistry.engineering.status[structure.status].src64}
                alt=""
                aria-hidden="true"
              />
              <div>
                <h3>{definition.name}</h3>
                <p>
                  {fortificationStatusLabels[structure.status]} / 耐久 {Math.round(structure.durability)}/
                  {structure.maxDurability}
                </p>
                <small>{structure.history[0]}</small>
                <small>
                  修理: {costSummary(repairCost)} / 耐久+{30 + strategicDoctrine.repairAmountBonus}
                </small>
              </div>
              <button type="button" onClick={() => onRepair(structure.id)}>
                修理
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
