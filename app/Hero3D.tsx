"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function NeuralSphere() {
  const group = useRef<THREE.Group>(null);
  const orbitRef = useRef<THREE.Group>(null);

  const { particles, connections } = useMemo(() => {
    const count = 250;
    const radius = 1;

    const positions: number[] = [];
    const lines: number[][] = [];

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      positions.push(x, y, z);
    }

    // simple neural connections
    for (let i = 0; i < count - 1; i += 8) {
      lines.push([
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      ]);

      lines.push([
        positions[(i + 1) * 3],
        positions[(i + 1) * 3 + 1],
        positions[(i + 1) * 3 + 2],
      ]);
    }

    return {
      particles: new Float32Array(positions),
      connections: lines,
    };
  }, []);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.4;
      group.current.rotation.x += delta * 0.08;
    }

    if (orbitRef.current) {
      orbitRef.current.rotation.y -= delta * 0.6;
    }
  });

  return (
    <group ref={group} scale={1.5}>
      {/* Sphere particles */}
      <Points positions={particles} stride={3}>
        <PointMaterial
          transparent
          color="#60a5fa"
          size={0.04}
          sizeAttenuation
          depthWrite={false}
        />
      </Points>

      {/* Neural network lines */}
      <Line
        points={connections as any}
        color="#3b82f6"
        lineWidth={1}
        transparent
        opacity={0.4}
      />

      {/* Orbit ring */}
      <group ref={orbitRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.01, 16, 100]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>

        {/* Orbiting satellite */}
        <mesh position={[1.6, 0, 0]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
      </group>
    </group>
  );
}

export default function Hero3D() {
  return (
    <div className="h-12 w-12">
      <Canvas camera={{ position: [0, 0, 2.5] }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[2, 2, 2]} intensity={1.2} />

        <NeuralSphere />
      </Canvas>
    </div>
  );
}