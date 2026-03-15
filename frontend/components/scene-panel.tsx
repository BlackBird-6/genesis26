"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { ScenarioState, ZoneState } from "../lib/types";
import styles from "./scene-panel.module.css";

type ScenePanelProps = {
  scenario: ScenarioState;
};

function colorLerp(cold: string, hot: string, amount: number) {
  return new THREE.Color(cold).lerp(new THREE.Color(hot), amount);
}

function Tower({
  position,
  size,
  peakEnergy,
  tint = "#687781",
}: {
  position: [number, number, number];
  size: [number, number, number];
  peakEnergy: number;
  tint?: string;
}) {
  const emissive = colorLerp("#4f7083", "#ff9357", peakEnergy);

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.18 + peakEnergy * 0.65} />
    </mesh>
  );
}

function CondoStack({
  x,
  z,
  height,
  peakEnergy,
  width = 0.8,
}: {
  x: number;
  z: number;
  height: number;
  peakEnergy: number;
  width?: number;
}) {
  return <Tower position={[x, height / 2, z]} size={[width, height, width]} peakEnergy={peakEnergy} tint="#60707b" />;
}

function OfficeSlab({
  x,
  z,
  width,
  depth,
  height,
  peakEnergy,
  tint = "#6e7f88",
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  peakEnergy: number;
  tint?: string;
}) {
  return <Tower position={[x, height / 2, z]} size={[width, height, depth]} peakEnergy={peakEnergy} tint={tint} />;
}

function RogersCentre() {
  return (
    <group position={[-2.35, 0.12, 1.2]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.45, 2.75, 0.56, 48]} />
        <meshStandardMaterial color="#d7dddc" />
      </mesh>
      <mesh position={[0, 0.72, 0]} scale={[1, 0.42, 1]}>
        <sphereGeometry args={[2.18, 40, 26]} />
        <meshStandardMaterial color="#eef2f1" emissive="#d9e4e7" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 0.2, 2.1]}>
        <boxGeometry args={[3.5, 0.12, 0.18]} />
        <meshStandardMaterial color="#be2634" emissive="#e44350" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function UnionShed() {
  return (
    <group position={[0.2, 0.18, 2.34]}>
      <mesh receiveShadow>
        <boxGeometry args={[5.2, 0.22, 0.86]} />
        <meshStandardMaterial color="#71787d" />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[4.6, 0.08, 0.54]} />
        <meshStandardMaterial color="#5b6268" />
      </mesh>
    </group>
  );
}

function CityHallComplex({ peakEnergy }: { peakEnergy: number }) {
  const towerGlow = colorLerp("#50606c", "#ff9a63", peakEnergy);

  return (
    <group position={[-5.1, 0, -1.25]}>
      <mesh position={[0, 0.34, 0]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.65, 0.68, 40]} />
        <meshStandardMaterial color="#b7c0c7" />
      </mesh>
      <mesh position={[-0.5, 1.85, 0]} rotation={[0, 0, Math.PI / 18]} castShadow>
        <boxGeometry args={[0.62, 3.1, 0.76]} />
        <meshStandardMaterial color="#7c8f9e" emissive={towerGlow} emissiveIntensity={0.18 + peakEnergy * 0.4} />
      </mesh>
      <mesh position={[0.55, 2.2, -0.04]} rotation={[0, 0, -Math.PI / 16]} castShadow>
        <boxGeometry args={[0.7, 3.8, 0.82]} />
        <meshStandardMaterial color="#90a3b0" emissive={towerGlow} emissiveIntensity={0.16 + peakEnergy * 0.45} />
      </mesh>
      <mesh position={[0.08, 0.86, 0.42]} castShadow>
        <boxGeometry args={[0.22, 1.1, 0.22]} />
        <meshStandardMaterial color="#cfd7dd" emissive="#ffe1bb" emissiveIntensity={0.14} />
      </mesh>
    </group>
  );
}

function GooderhamFlatiron() {
  return (
    <group position={[-1.9, 0, 2.55]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 1.4, 1.25]} />
        <meshStandardMaterial color="#9d4930" />
      </mesh>
      <mesh position={[0.18, 0.7, 0.58]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.38, 1.4, 4]} />
        <meshStandardMaterial color="#b35b3c" />
      </mesh>
      <mesh position={[0, 1.46, 0]} castShadow>
        <boxGeometry args={[0.44, 0.1, 1.08]} />
        <meshStandardMaterial color="#d8c3ab" />
      </mesh>
    </group>
  );
}

function HarbourfrontCampus() {
  return (
    <group position={[3.3, 0, 3.15]}>
      <mesh position={[0, 0.34, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.68, 1.15]} />
        <meshStandardMaterial color="#d3cbbd" />
      </mesh>
      <mesh position={[-0.9, 1.0, -0.1]} castShadow>
        <boxGeometry args={[0.54, 1.35, 0.54]} />
        <meshStandardMaterial color="#7f8b93" />
      </mesh>
      <mesh position={[0.95, 1.22, 0.05]} castShadow>
        <boxGeometry args={[0.66, 1.8, 0.62]} />
        <meshStandardMaterial color="#8c969d" />
      </mesh>
    </group>
  );
}

function TorontoIslands() {
  return (
    <group position={[0, -0.02, 9.6]}>
      {[
        { pos: [-6.2, 0, 0.1] as [number, number, number], scale: [4.6, 0.16, 1.15] as [number, number, number] },
        { pos: [-0.8, 0, -0.25] as [number, number, number], scale: [5.2, 0.18, 1.35] as [number, number, number] },
        { pos: [5.1, 0, 0.05] as [number, number, number], scale: [3.8, 0.14, 0.95] as [number, number, number] },
      ].map((island, index) => (
        <mesh key={index} position={island.pos} receiveShadow>
          <boxGeometry args={island.scale} />
          <meshStandardMaterial color="#768b6b" emissive="#a6c08c" emissiveIntensity={0.05} />
        </mesh>
      ))}
    </group>
  );
}

function StreetcarAndTracks({ transit }: { transit: number }) {
  return (
    <group position={[4.95, 0.03, 4.12]}>
      {[-0.16, 0.16].map((x, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
          <planeGeometry args={[0.06, 12.2]} />
          <meshStandardMaterial color="#54585d" emissive="#ff9569" emissiveIntensity={transit * 0.06} />
        </mesh>
      ))}
      <mesh position={[0, 0.18, -0.55]} castShadow>
        <boxGeometry args={[0.34, 0.22, 1.1]} />
        <meshStandardMaterial color="#bb2436" emissive="#ff7787" emissiveIntensity={0.22 + transit * 0.38} />
      </mesh>
      <mesh position={[0, 0.28, -0.55]} castShadow>
        <boxGeometry args={[0.22, 0.16, 0.72]} />
        <meshStandardMaterial color="#e0e4e8" />
      </mesh>
    </group>
  );
}

function CnTower() {
  return (
    <group position={[0.55, 0, 0.9]}>
      <mesh position={[0, 6.4, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.26, 12.8, 18]} />
        <meshStandardMaterial color="#8f8d86" />
      </mesh>
      <mesh position={[0, 9.3, 0]}>
        <cylinderGeometry args={[0.84, 1.1, 0.44, 28]} />
        <meshStandardMaterial color="#d2cbc0" emissive="#ffd6a1" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 8.75, 0]}>
        <cylinderGeometry args={[0.38, 0.5, 0.88, 18]} />
        <meshStandardMaterial color="#7d796f" />
      </mesh>
      <mesh position={[0, 12.3, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 4.2, 10]} />
        <meshStandardMaterial color="#2d3135" />
      </mesh>
      <mesh position={[0, 13.85, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 1.05, 8]} />
        <meshStandardMaterial color="#1c2023" />
      </mesh>
    </group>
  );
}

function QuayWaterfront({ traffic, transit }: { traffic: number; transit: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 7.8]}>
        <planeGeometry args={[24, 8]} />
        <meshStandardMaterial color="#92a4ab" emissive="#b8c3c7" emissiveIntensity={0.04} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 4.9]} receiveShadow>
        <planeGeometry args={[24, 0.68]} />
        <meshStandardMaterial color="#746d67" />
      </mesh>
      <mesh position={[0, 0.48, 4.55]} receiveShadow>
        <boxGeometry args={[13.2, 0.18, 0.34]} />
        <meshStandardMaterial color="#8b8b88" />
      </mesh>
      {[-5.6, -3.2, -0.6, 2.2, 4.9].map((x, index) => (
        <mesh key={index} position={[x, 0.1, 5.18]} receiveShadow>
          <boxGeometry args={[1.1, 0.08, 0.54]} />
          <meshStandardMaterial color="#6f767a" emissive="#ff8553" emissiveIntensity={traffic * 0.18} />
        </mesh>
      ))}
      <mesh position={[4.8, 0.16, 4.05]}>
        <boxGeometry args={[1.6, 0.1, 0.26]} />
        <meshStandardMaterial color="#b41d2f" emissive="#ff6475" emissiveIntensity={0.16 + transit * 0.4} />
      </mesh>
    </group>
  );
}

function RailCorridor({ traffic }: { traffic: number }) {
  return (
    <group position={[0.2, 0.03, 2.7]}>
      {[-0.52, -0.12, 0.28, 0.68].map((z, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]}>
          <planeGeometry args={[14.5, 0.11]} />
          <meshStandardMaterial color="#61676c" emissive="#ff8150" emissiveIntensity={traffic * 0.08} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.16, 0.1]}>
        <boxGeometry args={[5.2, 0.18, 1.1]} />
        <meshStandardMaterial color="#7c8084" />
      </mesh>
    </group>
  );
}

function GardinerFrontage({ traffic }: { traffic: number }) {
  return (
    <group position={[0, 0.5, 3.7]}>
      <mesh receiveShadow>
        <boxGeometry args={[18, 0.14, 0.5]} />
        <meshStandardMaterial color="#8b8c90" emissive="#ff8852" emissiveIntensity={traffic * 0.14} />
      </mesh>
      {[-7.5, -4.5, -1.5, 1.6, 4.8, 7.4].map((x, index) => (
        <mesh key={index} position={[x, -0.42, 0]} receiveShadow>
          <boxGeometry args={[0.16, 0.84, 0.16]} />
          <meshStandardMaterial color="#7a7d81" />
        </mesh>
      ))}
    </group>
  );
}

function CoolingMarkers({ zones }: { zones: ZoneState[] }) {
  return (
    <group>
      {zones
        .filter((zone) => zone.coolingCenters > 0)
        .map((zone, index) => (
          <Float key={zone.id} speed={2 + index * 0.2} rotationIntensity={0.2} floatIntensity={0.5}>
            <group position={[zone.position[0] * 0.92, 0.95, zone.position[1] * 0.55 + 1.7]}>
              <mesh>
                <cylinderGeometry args={[0.09, 0.09, 1.2, 18]} />
                <meshStandardMaterial color="#d9fff6" emissive="#8af5dd" emissiveIntensity={1.6} />
              </mesh>
              <mesh position={[0, 0.76, 0]}>
                <sphereGeometry args={[0.18, 18, 18]} />
                <meshStandardMaterial color="#f1fff9" emissive="#9df7e4" emissiveIntensity={2.2} />
              </mesh>
            </group>
          </Float>
        ))}
    </group>
  );
}

function ChargerStrip({ zone }: { zone: ZoneState }) {
  const glow = 1 - zone.peakEnergy;

  return (
    <group position={[4.7, 0.18, 2.9]}>
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh key={index} position={[index * 0.28 - 0.56, 0, 0]}>
          <boxGeometry args={[0.11, 0.64, 0.11]} />
          <meshStandardMaterial color="#e2f3ff" emissive="#50ddff" emissiveIntensity={0.32 + glow * 1.4} />
        </mesh>
      ))}
    </group>
  );
}

function ForegroundCondos({ peaks }: { peaks: number[] }) {
  return (
    <group>
      <CondoStack x={-7.3} z={2.8} height={4.8} peakEnergy={peaks[0]} width={0.9} />
      <CondoStack x={-6.35} z={2.25} height={4.2} peakEnergy={peaks[0]} width={0.8} />
      <CondoStack x={-5.45} z={2.95} height={5.2} peakEnergy={peaks[1]} width={0.86} />
      <CondoStack x={3.9} z={2.75} height={5.9} peakEnergy={peaks[2]} width={0.92} />
      <CondoStack x={5.0} z={2.5} height={5.5} peakEnergy={peaks[2]} width={0.86} />
      <CondoStack x={6.0} z={2.3} height={4.9} peakEnergy={peaks[2]} width={0.78} />
      <CondoStack x={7.0} z={2.0} height={4.3} peakEnergy={peaks[1]} width={0.74} />
    </group>
  );
}

function SkylineCore({ scenario }: { scenario: ScenarioState }) {
  const [financial, residential, retail, transit, plaza, charging, food] = scenario.zones;

  return (
    <group>
      <OfficeSlab x={-6.65} z={0.7} width={1.05} depth={1.0} height={7.6} peakEnergy={financial.peakEnergy} tint="#52606a" />
      <CondoStack x={-5.55} z={0.35} height={6.8} peakEnergy={residential.peakEnergy} width={0.92} />
      <CondoStack x={-4.6} z={0.15} height={7.2} peakEnergy={residential.peakEnergy} width={0.84} />

      <Tower
        position={[-2.05, 5.0, 0.1]}
        size={[0.95, 10.0, 0.95]}
        peakEnergy={retail.peakEnergy}
        tint="#76a5ae"
      />
      <Tower
        position={[-1.05, 6.15, -0.05]}
        size={[1.02, 12.3, 1.0]}
        peakEnergy={retail.peakEnergy}
        tint="#81b9c2"
      />

      <OfficeSlab x={2.15} z={-0.15} width={1.2} depth={0.95} height={8.5} peakEnergy={financial.peakEnergy} tint="#6f848e" />
      <OfficeSlab x={3.55} z={-0.22} width={1.0} depth={0.9} height={7.6} peakEnergy={financial.peakEnergy} tint="#84949b" />
      <OfficeSlab x={4.95} z={0} width={1.55} depth={1.05} height={11.2} peakEnergy={financial.peakEnergy} tint="#6f8f9c" />
      <OfficeSlab x={6.75} z={0.22} width={1.2} depth={0.9} height={8.7} peakEnergy={charging.peakEnergy} tint="#8aa0a8" />

      <CondoStack x={-3.6} z={1.1} height={5.1} peakEnergy={transit.peakEnergy} width={0.76} />
      <CondoStack x={-0.35} z={1.4} height={4.9} peakEnergy={plaza.peakEnergy} width={0.72} />
      <CondoStack x={1.55} z={1.7} height={4.4} peakEnergy={food.peakEnergy} width={0.74} />
      <CondoStack x={5.65} z={1.45} height={4.7} peakEnergy={charging.peakEnergy} width={0.74} />
    </group>
  );
}

function HeatBands({ zones }: { zones: ZoneState[] }) {
  return (
    <group>
      {zones.map((zone) => {
        const color = colorLerp("#375b63", "#ff8c5a", zone.heatRisk);
        const x = zone.position[0] * 0.95;
        const z = zone.position[1] * 0.42 + 2.15;
        return (
          <mesh key={zone.id} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.15, 0.48]} />
            <meshStandardMaterial color={color} transparent opacity={0.26} emissive={color} emissiveIntensity={0.18} />
          </mesh>
        );
      })}
    </group>
  );
}

function DistrictScene({ scenario }: { scenario: ScenarioState }) {
  const averageTraffic = scenario.zones.reduce((sum, zone) => sum + zone.trafficLevel, 0) / scenario.zones.length;
  const averageTransit = scenario.zones.reduce((sum, zone) => sum + zone.transitLevel, 0) / scenario.zones.length;
  const chargerZone = scenario.zones.find((zone) => zone.districtType === "charging");
  const civicPeak = scenario.zones[0]?.peakEnergy ?? 0.5;

  return (
    <>
      <color attach="background" args={["#f4d8b2"]} />
      <fog attach="fog" args={["#f4d8b2", 30, 55]} />
      <ambientLight intensity={0.9} />
      <directionalLight intensity={2.7} position={[8, 16, 12]} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <PerspectiveCamera makeDefault position={[0, 11.8, 17.8]} fov={27} />
      <OrbitControls
        enablePan={false}
        minDistance={15}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2}  // Prevents panning below the surface
        minAzimuthAngle={-Math.PI / 2}  // Prevents camera from rotating too far to the left
        maxAzimuthAngle={Math.PI / 2}  // Prevents camera from rotating too far to the right
        target={[0.2, 5.1, 0.7]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 20]} />
        <meshStandardMaterial color="#727d84" />
      </mesh>

      <QuayWaterfront traffic={averageTraffic} transit={averageTransit} />
      <TorontoIslands />
      <GardinerFrontage traffic={averageTraffic} />
      <RailCorridor traffic={averageTraffic} />
      <StreetcarAndTracks transit={averageTransit} />
      <HeatBands zones={scenario.zones} />
      <SkylineCore scenario={scenario} />
      <ForegroundCondos peaks={[scenario.zones[1].peakEnergy, scenario.zones[0].peakEnergy, scenario.zones[2].peakEnergy]} />
      <CityHallComplex peakEnergy={civicPeak} />
      <GooderhamFlatiron />
      <HarbourfrontCampus />
      <RogersCentre />
      <UnionShed />
      <CnTower />
      {chargerZone ? <ChargerStrip zone={chargerZone} /> : null}
      <CoolingMarkers zones={scenario.zones} />

      {averageTransit > 0.45 ? (
        <mesh position={[5.05, 0.62, 4.1]}>
          <boxGeometry args={[1.55, 0.09, 0.24]} />
          <meshStandardMaterial color="#b71f30" emissive="#ff6777" emissiveIntensity={0.22 + averageTransit * 0.3} />
        </mesh>
      ) : null}

      {Array.from({ length: Math.max(3, Math.round(4 + averageTraffic * 8)) }).map((_, index) => (
        <mesh key={index} position={[-7.1 + index * 1.55, 0.63, 3.68]} castShadow>
          <boxGeometry args={[0.52, 0.14, 0.2]} />
          <meshStandardMaterial color={index % 3 === 0 ? "#f0d7b6" : "#7b8187"} emissive="#f57c4f" emissiveIntensity={averageTraffic * 0.18} />
        </mesh>
      ))}

      <Float speed={1.5} rotationIntensity={0.06} floatIntensity={0.16}>
        <group position={[0.55, 0, 0.9]}>
          <mesh position={[0, 9.24, 0]}>
            <torusGeometry args={[0.93, 0.055, 12, 28]} />
            <meshStandardMaterial color="#efe0c7" emissive="#ffd39e" emissiveIntensity={0.16} />
          </mesh>
        </group>
      </Float>

      <Environment preset="city" />
    </>
  );
}

export function ScenePanel({ scenario }: ScenePanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.overlay}>
        <div>
          <p className={styles.eyebrow}>District Visual Twin</p>
          <h2 className={styles.title}>Toronto skyline with civic core and waterfront</h2>
        </div>
        <div className={styles.legend}>
          <span>Lake Ontario and the Islands frame the south edge</span>
          <span>CN Tower, Rogers Centre, Union shed, City Hall, and the Flatiron anchor the scene</span>
          <span>Streetcars, the Gardiner, and tower glow react to policy pressure</span>
        </div>
      </div>
      <div className={styles.canvasWrap}>
        <Canvas shadows dpr={[1, 2]}>
          <Suspense fallback={null}>
            <DistrictScene scenario={scenario} />
          </Suspense>
        </Canvas>
      </div>
    </section>
  );
}
