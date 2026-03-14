import type { ScenarioState, ZoneState } from "./types";

const zones: ZoneState[] = [
  {
    id: "financial-core",
    label: "Financial Core",
    districtType: "financial",
    position: [-4.4, 1.8],
    trafficLevel: 0.84,
    transitLevel: 0.65,
    peakEnergy: 0.88,
    carbonLevel: 0.8,
    heatRisk: 0.53,
    vulnerableCoverage: 0.31,
    foodWaste: 0.3,
    coolingCenters: 0,
  },
  {
    id: "mixed-residential",
    label: "Mixed Residential",
    districtType: "residential",
    position: [-0.6, 2.5],
    trafficLevel: 0.58,
    transitLevel: 0.44,
    peakEnergy: 0.61,
    carbonLevel: 0.57,
    heatRisk: 0.48,
    vulnerableCoverage: 0.41,
    foodWaste: 0.18,
    coolingCenters: 0,
  },
  {
    id: "retail-strip",
    label: "Retail Strip",
    districtType: "retail",
    position: [3.4, 2.3],
    trafficLevel: 0.74,
    transitLevel: 0.39,
    peakEnergy: 0.58,
    carbonLevel: 0.63,
    heatRisk: 0.45,
    vulnerableCoverage: 0.34,
    foodWaste: 0.64,
    coolingCenters: 0,
  },
  {
    id: "transit-corridor",
    label: "Transit Corridor",
    districtType: "transit",
    position: [-3.5, -1.2],
    trafficLevel: 0.69,
    transitLevel: 0.82,
    peakEnergy: 0.54,
    carbonLevel: 0.46,
    heatRisk: 0.38,
    vulnerableCoverage: 0.52,
    foodWaste: 0.22,
    coolingCenters: 0,
  },
  {
    id: "high-heat-plaza",
    label: "High-Heat Plaza",
    districtType: "plaza",
    position: [0.2, -1.1],
    trafficLevel: 0.41,
    transitLevel: 0.3,
    peakEnergy: 0.34,
    carbonLevel: 0.35,
    heatRisk: 0.92,
    vulnerableCoverage: 0.19,
    foodWaste: 0.12,
    coolingCenters: 0,
  },
  {
    id: "charger-cluster",
    label: "Charger Cluster",
    districtType: "charging",
    position: [4.2, -0.9],
    trafficLevel: 0.66,
    transitLevel: 0.31,
    peakEnergy: 0.82,
    carbonLevel: 0.71,
    heatRisk: 0.47,
    vulnerableCoverage: 0.26,
    foodWaste: 0.16,
    coolingCenters: 0,
  },
  {
    id: "food-quarter",
    label: "Food Quarter",
    districtType: "food",
    position: [1.6, -4],
    trafficLevel: 0.55,
    transitLevel: 0.37,
    peakEnergy: 0.36,
    carbonLevel: 0.41,
    heatRisk: 0.43,
    vulnerableCoverage: 0.36,
    foodWaste: 0.88,
    coolingCenters: 0,
  },
];

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregate(nextZones: ZoneState[]) {
  return {
    emissions: Math.round(average(nextZones.map((zone) => zone.carbonLevel)) * 100),
    congestion: Math.round(average(nextZones.map((zone) => zone.trafficLevel)) * 100),
    cost: 180000,
    peakDemand: Math.round(average(nextZones.map((zone) => zone.peakEnergy)) * 100),
    equityScore: Math.round(average(nextZones.map((zone) => zone.vulnerableCoverage)) * 100),
  };
}

export const baselineScenario: ScenarioState = {
  zones,
  aggregate: aggregate(zones),
  activePolicies: {
    evOffPeakShift: 0,
    transitSubsidy: 0,
    addedCoolingCenters: 0,
    foodWasteReduction: 0,
  },
};

export function deriveAggregate(zonesToAggregate: ZoneState[]) {
  return aggregate(zonesToAggregate);
}
