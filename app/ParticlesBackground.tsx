"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function ParticlesBackground() {
  const [init, setInit] = useState(false);

  // This initializes the particle engine once when the page loads
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine); // Slim is a lightweight version for better performance
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (!init) return null;

  return (
    <Particles
      id="tsparticles"
      className="absolute inset-0 pointer-events-none"
      options={{
        background: { color: { value: "transparent" } },
        fpsLimit: 120,
        particles: {
          color: { value: "#3b82f6" }, // Hackathon Blue dots
          links: { 
            color: "#ffffff", 
            distance: 150, // Draw lines if dots are within 150px of each other
            enable: true, 
            opacity: 0.15, 
            width: 1 
          },
          move: { 
            enable: true, 
            speed: 0.8, // Slow, elegant movement
            direction: "none", 
            outModes: { default: "bounce" } 
          },
          number: { 
            density: { enable: true, width: 800, height: 800 }, 
            value: 60 // Number of dots on screen
          },
          opacity: { value: 0.4 },
          shape: { type: "circle" },
          size: { value: { min: 1, max: 3 } },
        },
        detectRetina: true,
      }}
    />
  );
}