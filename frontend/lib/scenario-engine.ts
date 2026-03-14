import { baselineScenario, deriveAggregate } from "./scenario-data";
import type { ActivePolicies, PolicyPlan, ScenarioState, ZoneState } from "./types";

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function percentFromPrompt(input: string, fallback: number) {
  const match = input.match(/(\d+)\s*%/);
  return match ? Number(match[1]) / 100 : fallback;
}

function countFromPrompt(input: string, fallback: number) {
  const match = input.match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
}

export function parsePolicyPrompt(prompt: string): PolicyPlan {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("best") || normalized.includes("package") || normalized.includes("without worsening equity")) {
    return {
      intent: "optimize_bundle",
      label: "Optimization Bundle",
      summary: "Recommended a blended package that cuts emissions while preserving vulnerable coverage.",
      changes: {
        evOffPeakShift: 0.35,
        transitSubsidy: 0.28,
        addedCoolingCenters: 3,
        foodWasteReduction: 0.2,
      },
    };
  }

  if (normalized.includes("ev") || normalized.includes("off-peak") || normalized.includes("charging")) {
    const evShift = percentFromPrompt(normalized, 0.35);
    return {
      intent: "ev_shift",
      label: "EV Off-Peak Shift",
      summary: `Shifted ${(evShift * 100).toFixed(0)}% of EV charging away from the evening peak.`,
      changes: {
        evOffPeakShift: evShift,
      },
    };
  }

  if (normalized.includes("cooling center")) {
    const addedCoolingCenters = countFromPrompt(normalized, 3);
    return {
      intent: "cooling_centers",
      label: "Cooling Center Deployment",
      summary: `Placed ${addedCoolingCenters} cooling centers in the highest-risk public zones.`,
      changes: {
        addedCoolingCenters,
      },
    };
  }

  if (normalized.includes("transit") || normalized.includes("car traffic") || normalized.includes("congestion")) {
    const transitSubsidy = percentFromPrompt(normalized, 0.22);
    return {
      intent: "traffic_reduction",
      label: "Transit Incentive",
      summary: `Applied a ${(transitSubsidy * 100).toFixed(0)}% transit incentive to pull trips out of private vehicles.`,
      changes: {
        transitSubsidy,
      },
    };
  }

  if (normalized.includes("food waste") || normalized.includes("restaurant") || normalized.includes("waste")) {
    const foodWasteReduction = percentFromPrompt(normalized, 0.2);
    return {
      intent: "food_waste",
      label: "Food Waste Reduction",
      summary: `Reduced commercial food waste by ${(foodWasteReduction * 100).toFixed(0)}% in dining-heavy blocks.`,
      changes: {
        foodWasteReduction,
      },
    };
  }

  return {
    intent: "optimize_bundle",
    label: "Balanced Resilience Package",
    summary: "Interpreted the request as a balanced resilience package across mobility, cooling, and waste.",
    changes: {
      evOffPeakShift: 0.2,
      transitSubsidy: 0.16,
      addedCoolingCenters: 2,
      foodWasteReduction: 0.12,
    },
  };
}

function mergePolicies(current: ActivePolicies, changeSet: Partial<ActivePolicies>) {
  return {
    evOffPeakShift: clamp(changeSet.evOffPeakShift ?? current.evOffPeakShift),
    transitSubsidy: clamp(changeSet.transitSubsidy ?? current.transitSubsidy),
    addedCoolingCenters: Math.max(0, Math.round(changeSet.addedCoolingCenters ?? current.addedCoolingCenters)),
    foodWasteReduction: clamp(changeSet.foodWasteReduction ?? current.foodWasteReduction),
  };
}

function applyZonePolicies(zone: ZoneState, activePolicies: ActivePolicies, rankedHeatZones: string[]): ZoneState {
  const evImpact = activePolicies.evOffPeakShift;
  const transitImpact = activePolicies.transitSubsidy;
  const coolingImpact = activePolicies.addedCoolingCenters;
  const foodImpact = activePolicies.foodWasteReduction;
  const heatRank = rankedHeatZones.indexOf(zone.id);
  const receivesCooling = heatRank > -1 && heatRank < coolingImpact ? 1 : 0;
  const transitBoost = zone.districtType === "transit" ? 0.16 : zone.districtType === "financial" ? 0.08 : 0.04;
  const chargerSensitivity = zone.districtType === "charging" ? 1.2 : 0.65;
  const foodSensitivity = zone.districtType === "food" || zone.districtType === "retail" ? 1 : 0.25;

  return {
    ...zone,
    trafficLevel: clamp(zone.trafficLevel - transitImpact * (0.28 + transitBoost)),
    transitLevel: clamp(zone.transitLevel + transitImpact * (0.34 + transitBoost)),
    peakEnergy: clamp(zone.peakEnergy - evImpact * 0.24 * chargerSensitivity),
    carbonLevel: clamp(zone.carbonLevel - evImpact * 0.18 - transitImpact * 0.15 - foodImpact * 0.12),
    heatRisk: clamp(zone.heatRisk - receivesCooling * 0.24 - transitImpact * 0.04),
    vulnerableCoverage: clamp(zone.vulnerableCoverage + receivesCooling * 0.25 + transitImpact * 0.03),
    foodWaste: clamp(zone.foodWaste - foodImpact * 0.5 * foodSensitivity),
    coolingCenters: receivesCooling,
  };
}

export function simulateScenario(current: ScenarioState, changeSet: Partial<ActivePolicies>) {
  const activePolicies = mergePolicies(current.activePolicies, changeSet);
  const rankedHeatZones = [...current.zones]
    .sort((a, b) => b.heatRisk - a.heatRisk)
    .map((zone) => zone.id);
  const zones = current.zones.map((zone) => applyZonePolicies(zone, activePolicies, rankedHeatZones));
  const aggregate = deriveAggregate(zones);
  const cost =
    180000 +
    activePolicies.evOffPeakShift * 180000 +
    activePolicies.transitSubsidy * 280000 +
    activePolicies.addedCoolingCenters * 65000 +
    activePolicies.foodWasteReduction * 90000;

  return {
    zones,
    activePolicies,
    aggregate: {
      ...aggregate,
      cost: Math.round(cost),
    },
  };
}

export function explainScenario(plan: PolicyPlan, state: ScenarioState) {
  const { aggregate, activePolicies } = state;

  if (plan.intent === "ev_shift") {
    return `Peak demand falls to ${aggregate.peakDemand} with ${Math.round(activePolicies.evOffPeakShift * 100)}% of charging moved off-peak. Charger clusters cool down first, and the office towers lose their red stress glow.`;
  }

  if (plan.intent === "cooling_centers") {
    return `Cooling coverage rises to ${aggregate.equityScore} after adding ${activePolicies.addedCoolingCenters} centers. The highest-risk plaza and adjacent pedestrian zones visibly cool first.`;
  }

  if (plan.intent === "traffic_reduction") {
    return `Congestion drops to ${aggregate.congestion} while transit strength climbs. You should see fewer cars on the main corridor and stronger streetcar activity through the district.`;
  }

  if (plan.intent === "food_waste") {
    return `Food waste pressure eases across the dining blocks, helping emissions land at ${aggregate.emissions}. The retail and restaurant quarter should show cleaner waste flows and a healthier district score.`;
  }

  return `The blended package pushes emissions to ${aggregate.emissions}, congestion to ${aggregate.congestion}, and equity coverage to ${aggregate.equityScore} for an estimated cost of $${aggregate.cost.toLocaleString()}.`;
}

export function resetScenario() {
  return structuredClone(baselineScenario);
}
