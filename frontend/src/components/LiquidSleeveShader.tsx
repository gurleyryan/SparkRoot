import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type ManaTheme = "white" | "blue" | "black" | "red" | "green" | "multicolor" | "colorless";
interface LiquidSleeveProps {
  intensity?: number;
  manaTheme?: ManaTheme;
  width: number;
  height: number;
}

const SleeveMesh: React.FC<LiquidSleeveProps> = ({
  intensity = 0.7,
  manaTheme = "blue",
  width,
  height,
}) => {
  const mesh = useRef<THREE.Mesh>(null);
  const colorMap: Record<ManaTheme, number> = {
    white: 0xffffff,
    blue: 0x8ecaff,
    black: 0x222222,
    red: 0xff6a4d,
    green: 0x6affb2,
    multicolor: 0xf8e7b9,
    colorless: 0xbbbbbb,
  };
  useFrame(({ clock }) => {
    if (mesh.current && (mesh.current.material as any).uniforms) {
      (mesh.current.material as any).uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  return (
    <mesh ref={mesh} position={[0, 0, 0]}>
      <planeGeometry args={[2.5, 2.5, 64, 64]} />
      <shaderMaterial
        attach="material"
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(colorMap[manaTheme] || 0x8ecaff) },
          uIntensity: { value: intensity },
        }}
        vertexShader={`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            float wave = sin(uv.x * 10.0 + uTime * 1.2) * 0.03 * uTime + sin(uv.y * 12.0 + uTime * 0.7) * 0.02;
            vec3 pos = position + normal * wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;
          void main() {
            float sleeve = 0.7 + 0.3 * sin(vUv.x * 20.0 + vUv.y * 20.0);
            float edge = smoothstep(0.05, 0.12, min(vUv.x, min(1.0-vUv.x, min(vUv.y, 1.0-vUv.y))));
            float alpha = 0.18 * uIntensity * sleeve * edge;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};

const LiquidSleeve: React.FC<LiquidSleeveProps> = (props) => (
  <Canvas
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 1,
    }}
    gl={{ alpha: true }}
    camera={{ position: [0, 0, 5], fov: 30 }}
  >
    <SleeveMesh {...props} />
  </Canvas>
);

export default LiquidSleeve;