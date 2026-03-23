"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

// This silences the specific Three.js deprecation warning in the console
if (typeof window !== 'undefined') {
  const warn = console.warn;
  console.warn = (...args) => {
    if (args[0]?.includes?.('THREE.Clock: This module has been deprecated')) return;
    warn(...args);
  };
}
function NeuralSphere() {
  const group = useRef<THREE.Group>(null);
  const orbitRef = useRef<THREE.Group>(null);

  // Pre-calculate geometries once to avoid memory leaks
  const { particles, connections } = useMemo(() => {
    const count = 250;
    const radius = 1;
    const positions: number[] = [];
    const lines: [number, number, number][] = []; // Explicit type for Line component

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      positions.push(x, y, z);

      // Better line logic: connect point to a neighbor
      if (i % 8 === 0) {
        lines.push([x, y, z]);
      }
    }

    return {
      particles: new Float32Array(positions),
      connections: lines,
    };
  }, []);

  useFrame((state, delta) => {
    // Instead of state.clock.getElapsedTime(),
    // we increment rotation based on the time between frames (delta).

    if (group.current) {
      // 0.2 and 0.05 are your speed multipliers
      group.current.rotation.y += delta * 0.2;
      group.current.rotation.x += delta * 0.05;
    }

    if (orbitRef.current) {
      // Negative for counter-rotation
      orbitRef.current.rotation.y -= delta * 0.4;
    }
  });

  return (
    <group ref={group} scale={1.5}>
      <Points positions={particles} stride={3}>
        <PointMaterial
          transparent
          color="#60a5fa"
          size={0.04}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending} // Makes it look "glowy"
        />
      </Points>

      {/* Optimized Line: Pass flat Vector3 array if possible */}
      <Line
        points={connections}
        color="#3b82f6"
        lineWidth={0.5}
        transparent
        opacity={0.3}
      />

      <group ref={orbitRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          {/* Use 'args' carefully to avoid re-generating geometry */}
          <torusGeometry args={[1.6, 0.005, 16, 64]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export default function Hero3D() {
  return (
    <div className="h-12 w-12 flex items-center justify-center">
      <Canvas
        camera={{ position: [0, 0, 3] }}
        shadows={false}
        gl={{ 
          antialias: false,
          powerPreference: "high-performance" 
        }}
      >
        <NeuralSphere />
      </Canvas>
    </div>
  );
}
