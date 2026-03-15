"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

function useBuildingEffects(groupRef: React.RefObject<THREE.Group | null>, energyHealth: number, fiscalHealth: number, peakEnergy: number) {
  const stateRef = useRef({
    scaleY: 1.0,
    glitchProb: 0.0,
    staticWire: false,
    emissiveHex: "#ffc370",
    pulseSpeed: 0,
    flickerProb: 0.0,
  });

  useEffect(() => {
    let scaleY = 1.0;
    let glitchProb = 0.0;
    let staticWire = false;

    if (fiscalHealth <= 0.2) {
      scaleY = 0.40;
    } else if (fiscalHealth <= 0.4) {
      scaleY = 0.75;
    } else if (fiscalHealth <= 0.6) {
      scaleY = 1.0;
    } else if (fiscalHealth <= 0.8) {
      scaleY = 1.1;
    } else {
      scaleY = 1.25; // 40-100 tier (shine gloss handled in original props if desired, we stick to defaults)
    }

    let hex = "#ffc370";
    let speed = 0;
    let flick = 0;

    if (energyHealth <= 0.2) {
      hex = "#ff3300";
      speed = 4;
    } else if (energyHealth <= 0.4) {
      hex = "#ff7700";
      speed = 2;
    } else if (energyHealth <= 0.6) {
      hex = "#ffc370";
    } else if (energyHealth <= 0.8) {
      hex = "#ccffff";
      speed = 2;
    } else {
      hex = "#00ffff";
      speed = 4;
    }

    stateRef.current = { scaleY, glitchProb, staticWire, emissiveHex: hex, pulseSpeed: speed, flickerProb: flick };
  }, [energyHealth, fiscalHealth]);

  const colorCache = useRef(new THREE.Color());

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const s = stateRef.current;

    let targetScale = s.scaleY;
    if (fiscalHealth > 0.4 && fiscalHealth <= 0.6) {
      targetScale += Math.sin(t * 0.5) * 0.015; // Subtle breathing for steady state
    }
    groupRef.current.scale.y = THREE.MathUtils.damp(groupRef.current.scale.y, targetScale, 3, delta);

    colorCache.current.lerp(new THREE.Color(s.emissiveHex), delta * 4);

    let activeEmissive = peakEnergy * 0.4;
    if (s.flickerProb > 0) {
      activeEmissive = Math.random() > s.flickerProb ? peakEnergy * 0.4 : 0.05;
    } else if (s.pulseSpeed > 0) {
      activeEmissive = (peakEnergy * 0.4) + Math.sin(t * s.pulseSpeed) * 0.15;
    } else {
      if (energyHealth > 0.6 && energyHealth <= 0.8) activeEmissive = peakEnergy * 0.6;
    }

    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;

        if (s.glitchProb > 0) {
          mat.wireframe = Math.random() < s.glitchProb;
        } else {
          mat.wireframe = s.staticWire;
        }

        const roughnessTarget = fiscalHealth > 0.8 ? 0.1 : 0.6;
        mat.roughness = THREE.MathUtils.damp(mat.roughness, roughnessTarget, 2, delta);

        if (child.userData.isWindow) {
          mat.emissive.copy(colorCache.current);
          if (s.flickerProb > 0) {
            mat.emissiveIntensity = Math.max(0, activeEmissive);
          } else {
            mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, Math.max(0, activeEmissive), 4, delta);
          }
        }
      }
    });
  });
}

function Tower({
  position,
  size,
  peakEnergy,
  tint = "#9ea7ac",
  energyHealth = 0.5,
  fiscalHealth = 0.5,
}: {
  position: [number, number, number];
  size: [number, number, number];
  peakEnergy: number;
  tint?: string;
  energyHealth?: number;
  fiscalHealth?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useBuildingEffects(groupRef, energyHealth, fiscalHealth, peakEnergy);

  return (
    <group position={position} ref={groupRef}>
      <mesh position={[0, size[1] / 2, 0]} castShadow receiveShadow userData={{ isWindow: true }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={tint} />
      </mesh>
    </group>
  );
}

function CondoStack({
  x,
  z,
  height,
  peakEnergy,
  width = 0.8,
  energyHealth = 0.5,
  fiscalHealth = 0.5,
}: {
  x: number;
  z: number;
  height: number;
  peakEnergy: number;
  width?: number;
  energyHealth?: number;
  fiscalHealth?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useBuildingEffects(groupRef, energyHealth, fiscalHealth, peakEnergy);

  return (
    <group position={[x, 0, z]} ref={groupRef}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow userData={{ isWindow: true }}>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial color="#60707b" />
      </mesh>
    </group>
  );
}

function OfficeSlab({
  x,
  z,
  width,
  depth,
  height,
  peakEnergy,
  tint = "#84949b",
  energyHealth = 0.5,
  fiscalHealth = 0.5,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  peakEnergy: number;
  tint?: string;
  energyHealth?: number;
  fiscalHealth?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useBuildingEffects(groupRef, energyHealth, fiscalHealth, peakEnergy);

  return (
    <group position={[x, 0, z]} ref={groupRef}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow userData={{ isWindow: true }}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={tint} />
      </mesh>
    </group>
  );
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
    <group position={[4.5, 0, 2.2]}>
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

function AnimatedTraffic({ health }: { health: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 40;

  const cars = useRef(Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 18,
    z: (Math.random() - 0.5) * 0.3,
    speed: Math.random() * 0.4 + 0.8,
  })));

  const targetRef = useRef({ speedMult: 1, color: new THREE.Color(), density: 40 });
  const currentRef = useRef({ speedMult: 1, color: new THREE.Color() });

  useEffect(() => {
    let speedMult = 1.0;
    let colorHex = "#ffedd9";
    let density = 15;

    if (health <= 0.2) {
      speedMult = 0.0;
      colorHex = "#ff1100"; // Gridlock red
      density = 40;
    } else if (health <= 0.4) {
      speedMult = 0.15; // Stuttering
      colorHex = "#ff3311";
      density = 35;
    } else if (health <= 0.6) {
      speedMult = 0.4; // Steady default
      colorHex = "#ff6622";
      density = 25;
    } else if (health <= 0.8) {
      speedMult = 0.7; // Moderate
      colorHex = "#ffa366";
      density = 20;
    } else {
      speedMult = 1.6; // Fast flow
      colorHex = "#ffffff";
      density = 12;
    }

    targetRef.current = { speedMult, color: new THREE.Color(colorHex), density };
  }, [health]);

  const dummy = new THREE.Object3D();

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    currentRef.current.speedMult = THREE.MathUtils.damp(currentRef.current.speedMult, targetRef.current.speedMult, 3, delta);
    currentRef.current.color.lerp(targetRef.current.color, delta * 3);

    const stutterPhase = Math.sin(state.clock.elapsedTime * 3);
    let activeSpeed = currentRef.current.speedMult;
    if (targetRef.current.density === 35) {
      activeSpeed *= Math.max(0, stutterPhase); // stop and go
    }

    cars.current.forEach((car, i) => {
      if (i >= targetRef.current.density) {
        dummy.position.set(100, 100, 100);
      } else {
        car.x -= car.speed * activeSpeed * delta * 5;
        if (car.x < -9) car.x = 9;
        dummy.position.set(car.x, 0.08, car.z);
      }
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, currentRef.current.color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.3, 0.06, 0.12]} />
      <meshStandardMaterial emissiveIntensity={1.5} />
    </instancedMesh>
  );
}

function VitalityField({ equity: health }: { equity: number }) {
  const count = 150;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const particles = useRef(Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 26,
    z: (Math.random() - 0.5) * 18,
    y: Math.random() * 4,
    speed: Math.random() * 0.6 + 0.3,
    phase: Math.random() * Math.PI * 2,
  })));

  const targetRef = useRef({ density: 0, color: new THREE.Color(), emissiveIntensity: 1 });
  const currentRef = useRef({ color: new THREE.Color(), emissiveIntensity: 1 });

  useEffect(() => {
    let density = 0;
    let colorHex = "#ffffff";
    let emissiveInt = 1;

    if (health <= 0.2) {
      density = 150; // Dense low hovering grey
      colorHex = "#333333";
      emissiveInt = 0.2;
    } else if (health <= 0.4) {
      density = 0;
    } else if (health <= 0.6) {
      density = 0;
    } else if (health <= 0.8) {
      density = 60; // Sparse gold
      colorHex = "#ffaa00";
      emissiveInt = 1.4;
    } else {
      density = 150; // Abundant gold
      colorHex = "#ffcc00";
      emissiveInt = 1.8;
    }
    targetRef.current = { density, color: new THREE.Color(colorHex), emissiveIntensity: emissiveInt };
  }, [health]);

  const dummy = new THREE.Object3D();

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    currentRef.current.color.lerp(targetRef.current.color, delta * 2);
    currentRef.current.emissiveIntensity = THREE.MathUtils.damp(currentRef.current.emissiveIntensity, targetRef.current.emissiveIntensity, 3, delta);

    particles.current.forEach((p, i) => {
      if (i >= targetRef.current.density) {
        dummy.position.set(0, -10, 0);
      } else {
        if (health <= 0.2) {
          // Low hovering static noise
          p.x += Math.sin(p.phase + state.clock.elapsedTime) * 0.005;
          p.z += Math.cos(p.phase + state.clock.elapsedTime) * 0.005;
          dummy.position.set(p.x, p.y * 0.3 + 0.2, p.z);
        } else {
          // Rising golden particles
          p.y += p.speed * delta;
          if (p.y > 6) p.y = 0;
          const drift = Math.sin(p.phase + p.y) * 0.2;
          dummy.position.set(p.x + drift, p.y, p.z);
        }
      }
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, currentRef.current.color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = currentRef.current.emissiveIntensity;
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, count]} frustumCulled={false}>
      <sphereGeometry args={[0.18, 12, 12]} />
      <meshStandardMaterial transparent opacity={0.8} depthWrite={false} />
    </instancedMesh>
  );
}

function AnimatedBasePlane({ equity }: { equity: number }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const targetColor = useRef(new THREE.Color("#727d84"));

  useEffect(() => {
    let hex = "#727d84";
    if (equity <= 0.2) hex = "#444a4d";
    else if (equity <= 0.4) hex = "#5a6266";
    else if (equity <= 0.6) hex = "#727d84"; // Default
    else if (equity <= 0.8) hex = "#828980";
    else hex = "#959b8e";

    targetColor.current.set(hex);
  }, [equity]);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.color.lerp(targetColor.current, delta * 2);
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[28, 20]} />
      <meshStandardMaterial ref={matRef} color="#727d84" />
    </mesh>
  );
}

function AnimatedSky({ health }: { health: number }) {
  const { scene } = useThree();
  const targetColor = useRef(new THREE.Color("#f4d8b2"));
  const currentColor = useRef(new THREE.Color("#f4d8b2"));

  useEffect(() => {
    // 1.0 = blue clear sky, 0.0 = bright orange smog
    let hex = "#7ebdd4";
    if (health <= 0.2) hex = "#d9824c"; // heavy smog
    else if (health <= 0.4) hex = "#e1b37a";
    else if (health <= 0.6) hex = "#e0cba8"; // default neutral
    else if (health <= 0.8) hex = "#b8cfd6";
    else hex = "#7ebdd4";
    targetColor.current.set(hex);
  }, [health]);

  useFrame((_, delta) => {
    currentColor.current.lerp(targetColor.current, delta * 1.5);
    scene.background = currentColor.current;
  });

  return null;
}

function CnTower() {
  return (
    <group position={[0.55, 0, 0.9]}>
      {/* Main shaft */}
      <mesh position={[0, 6.4, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.32, 12.8, 18]} />
        <meshStandardMaterial color="#8f8d86" />
      </mesh>

      {/* Main Pod - Lower radome (slopes out) */}
      <mesh position={[0, 9.1, 0]}>
        <cylinderGeometry args={[1.05, 0.35, 0.8, 32]} />
        <meshStandardMaterial color="#d2cbc0" />
      </mesh>

      {/* Main Pod - Observation deck (dark with windows) */}
      <mesh position={[0, 9.65, 0]}>
        <cylinderGeometry args={[1.1, 1.05, 0.3, 32]} />
        <meshStandardMaterial color="#4a5a66" emissive="#ffd6a1" emissiveIntensity={0.2} />
      </mesh>

      {/* Main Pod - Roof (saucer) */}
      <mesh position={[0, 9.8, 0]} scale={[1, 0.25, 1]}>
        <sphereGeometry args={[1.1, 32, 16]} />
        <meshStandardMaterial color="#b5b0a7" />
      </mesh>

      {/* Skypod */}
      <mesh position={[0, 11.2, 0]}>
        <cylinderGeometry args={[0.3, 0.15, 0.45, 24]} />
        <meshStandardMaterial color="#d2cbc0" emissive="#ffd6a1" emissiveIntensity={0.15} />
      </mesh>

      {/* Antenna base */}
      <mesh position={[0, 12.8, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 2.0, 10]} />
        <meshStandardMaterial color="#2d3135" />
      </mesh>

      {/* Antenna spire */}
      <mesh position={[0, 14.5, 0]}>
        <cylinderGeometry args={[0.012, 0.04, 3.2, 8]} />
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

function GardinerFrontage({ congestion }: { congestion: number }) {
  return (
    <group position={[0, 0.5, 3.7]}>
      <mesh receiveShadow>
        <boxGeometry args={[18, 0.14, 0.5]} />
        <meshStandardMaterial color="#8b8c90" />
      </mesh>
      <AnimatedTraffic health={congestion} />
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

function ForegroundCondos({ peaks, energyHealth, fiscalHealth }: { peaks: number[], energyHealth: number, fiscalHealth: number }) {
  return (
    <group>
      {/* Far Left Condos */}
      <CondoStack x={-10.2} z={2.3} height={4.5} peakEnergy={peaks[1]} width={0.8} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-9.4} z={2.9} height={5.5} peakEnergy={peaks[0]} width={0.85} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-8.5} z={2.6} height={4.0} peakEnergy={peaks[2]} width={0.75} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />

      {/* Original Left */}
      <CondoStack x={-7.3} z={2.8} height={4.8} peakEnergy={peaks[0]} width={0.9} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-6.35} z={2.25} height={4.2} peakEnergy={peaks[0]} width={0.8} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-5.45} z={2.95} height={5.2} peakEnergy={peaks[1]} width={0.86} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />

      {/* Original Right */}
      <CondoStack x={3.9} z={2.75} height={5.9} peakEnergy={peaks[2]} width={0.92} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={5.0} z={2.5} height={5.5} peakEnergy={peaks[2]} width={0.86} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={6.0} z={2.3} height={4.9} peakEnergy={peaks[2]} width={0.78} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={7.0} z={2.0} height={4.3} peakEnergy={peaks[1]} width={0.74} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />

      {/* Far Right Condos */}
      <CondoStack x={8.2} z={2.4} height={5.8} peakEnergy={peaks[2]} width={0.88} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={9.1} z={2.7} height={4.9} peakEnergy={peaks[1]} width={0.82} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={10.0} z={2.1} height={4.2} peakEnergy={peaks[0]} width={0.75} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
    </group>
  );
}

function SkylineCore({ scenario, energyHealth, fiscalHealth }: { scenario: ScenarioState, energyHealth: number, fiscalHealth: number }) {
  const [financial, residential, retail, transit, plaza, charging, food] = scenario.zones;

  return (
    <group>
      {/* Far Left Core */}
      <OfficeSlab x={-9.0} z={0.2} width={1.2} depth={1.0} height={7.5} peakEnergy={residential.peakEnergy} tint="#60717a" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-8.0} z={0.5} height={6.5} peakEnergy={transit.peakEnergy} width={0.8} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />

      {/* Original Core Left */}
      <OfficeSlab x={-6.65} z={0.7} width={1.05} depth={1.0} height={7.6} peakEnergy={financial.peakEnergy} tint="#52606a" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-5.55} z={0.35} height={6.8} peakEnergy={residential.peakEnergy} width={0.92} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={-4.6} z={0.15} height={7.2} peakEnergy={residential.peakEnergy} width={0.84} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />

      <Tower
        position={[-2.45, 0, -1.8]}
        size={[0.95, 10.0, 0.95]}
        peakEnergy={retail.peakEnergy}
        tint="#76a5ae"
        energyHealth={energyHealth}
        fiscalHealth={fiscalHealth}
      />
      <Tower
        position={[-1.25, 0, -2.0]}
        size={[1.02, 12.3, 1.0]}
        peakEnergy={retail.peakEnergy}
        tint="#81b9c2"
        energyHealth={energyHealth}
        fiscalHealth={fiscalHealth}
      />

      {/* Original Core Right */}
      <OfficeSlab x={2.15} z={-0.15} width={1.2} depth={0.95} height={8.5} peakEnergy={financial.peakEnergy} tint="#6f848e" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <OfficeSlab x={3.55} z={-0.22} width={1.0} depth={0.9} height={7.6} peakEnergy={financial.peakEnergy} tint="#84949b" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <OfficeSlab x={4.95} z={0} width={1.55} depth={1.05} height={11.2} peakEnergy={financial.peakEnergy} tint="#6f8f9c" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <OfficeSlab x={6.75} z={0.22} width={1.2} depth={0.9} height={8.7} peakEnergy={charging.peakEnergy} tint="#8aa0a8" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />

      {/* Far Right Core */}
      <OfficeSlab x={8.2} z={0.1} width={1.4} depth={1.1} height={9.5} peakEnergy={financial.peakEnergy} tint="#6f8f9c" energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={9.5} z={0.4} height={8.0} peakEnergy={retail.peakEnergy} width={0.9} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />


      <CondoStack x={-0.35} z={1.4} height={4.9} peakEnergy={plaza.peakEnergy} width={0.72} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={1.55} z={1.7} height={4.4} peakEnergy={food.peakEnergy} width={0.74} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
      <CondoStack x={5.65} z={1.45} height={4.7} peakEnergy={charging.peakEnergy} width={0.74} energyHealth={energyHealth} fiscalHealth={fiscalHealth} />
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

function AnimatedFog({ health }: { health: number }) {
  const { scene } = useThree();
  const targetRef = useRef<{ near: number; far: number }>({ near: 34, far: 65 });
  const startRef = useRef<{ near: number; far: number }>({ near: 34, far: 65 });
  const timeRef = useRef<number>(1.5);

  useEffect(() => {
    let targetNear = 25;
    let targetFar = 85;

    if (health <= 0.2) {
      targetNear = 5;
      targetFar = 42;
    } else if (health <= 0.4) {
      targetNear = 10;
      targetFar = 50;
    } else if (health <= 0.6) {
      targetNear = 15;
      targetFar = 60;
    } else if (health <= 0.8) {
      targetNear = 20;
      targetFar = 70;
    }

    const fog = scene.fog as any;
    if (fog && fog.isFog) {
      startRef.current = { near: fog.near, far: fog.far };
      targetRef.current = { near: targetNear, far: targetFar };
      timeRef.current = 0;
    }
  }, [health, scene]);

  useFrame((_, delta) => {
    const fog = scene.fog as any;
    if (fog && fog.isFog && timeRef.current < 1.5) {
      timeRef.current += delta;
      const t = Math.min(timeRef.current / 1.5, 1.0);
      const ease = 1 - Math.pow(1 - t, 3); // Ease-out cubic

      fog.near = THREE.MathUtils.lerp(startRef.current.near, targetRef.current.near, ease);
      fog.far = THREE.MathUtils.lerp(startRef.current.far, targetRef.current.far, ease);
    }
  });

  return <fog attach="fog" args={["#f4d8b2", 30, 55]} />;
}

function DistrictScene({ scenario }: { scenario: ScenarioState }) {
  const averageTraffic = scenario.zones.reduce((sum, zone) => sum + zone.trafficLevel, 0) / scenario.zones.length;
  const averageTransit = scenario.zones.reduce((sum, zone) => sum + zone.transitLevel, 0) / scenario.zones.length;
  const chargerZone = scenario.zones.find((zone) => zone.districtType === "charging");
  const civicPeak = scenario.zones[0]?.peakEnergy ?? 0.5;

  const equityScore = scenario.aggregate.equityScore / 100;
  const congestionScore = scenario.aggregate.congestion / 100;
  const energyScore = scenario.aggregate.peakDemand / 100;
  const costScore = scenario.aggregate.cost / 100;
  const peaks = [scenario.zones[1].peakEnergy, scenario.zones[0].peakEnergy, scenario.zones[2].peakEnergy];

  return (
    <>
      <AnimatedSky health={scenario.aggregate.emissions / 100} />
      <AnimatedFog health={scenario.aggregate.emissions / 100} />
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
        target={[0.5, 4.1, 0.9]}
      />

      <AnimatedBasePlane equity={equityScore} />
      <VitalityField equity={equityScore} />

      <QuayWaterfront traffic={averageTraffic} transit={averageTransit} />
      <TorontoIslands />
      <GardinerFrontage congestion={congestionScore} />
      <RailCorridor traffic={averageTraffic} />
      <StreetcarAndTracks transit={averageTransit} />
      <HeatBands zones={scenario.zones} />
      <SkylineCore scenario={scenario} energyHealth={energyScore} fiscalHealth={costScore} />
      <ForegroundCondos peaks={peaks} energyHealth={energyScore} fiscalHealth={costScore} />
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
          <h2 className={styles.title}>Toronto Skyline</h2>
        </div>
        {/* <div className={styles.legend}>
          <span>Lake Ontario and the Islands frame the south edge</span>
          <span>CN Tower, Rogers Centre, Union shed, City Hall, and the Flatiron anchor the scene</span>
          <span>Streetcars, the Gardiner, and tower glow react to policy pressure</span>
        </div> */}
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
