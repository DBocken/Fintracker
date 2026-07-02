import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import type { LandscapeScene } from "./landscape-scene";

/**
 * Cineastische 3D-Finanzlandschaft (WebGL / three.js): stilisiertes
 * Low-Poly-Terrain mit echter Beleuchtung, weichen Schatten, Tiefen-Nebel
 * und ACES-Filmic-Tone-Mapping. Wie beim 2D-Renderer wird ALLES aus dem
 * Score-Modell (`LandscapeScene`) abgeleitet — kein Asset, keine Textur,
 * keine externen Downloads (local-first).
 *
 *   Aufbau (einmalig):  Berg erhebt sich, Baum wächst, Wasser steigt.
 *   Ambient (dauerhaft): Kamera atmet, Wolken ziehen, Wasser wogt, Baum
 *                       wiegt sich, Fensterlicht flackert, Rauch steigt,
 *                       Regen fällt bei Gewitter, Vögel kreisen bei
 *                       gutem Gesamtstatus.
 *
 * `prefers-reduced-motion`: ein statisches Bild (frameloop="demand",
 * fertiger Zielzustand, keine Ambient-Bewegung).
 */

const CROWN_BY_STAGE = ["#a8a29e", "#a3c96a", "#5fb877", "#37a35c", "#1f7a43"];
const WATER_BY_STAGE = ["#8fa3b8", "#6fc0e8", "#3aa5dd", "#1e8ecb", "#0f74b0"];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
/** Deterministisches Pseudo-Rauschen (kein Math.random → stabile Szene). */
const rnd = (i: number) => Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;

/** Einmaliger Aufbau: 0..1 ab `delay`, bei reduzierter Bewegung sofort 1. */
function useBuildUp(delay: number, dur: number, reduce: boolean) {
  const start = useRef<number | null>(null);
  const value = useRef(reduce ? 1 : 0);
  useFrame(({ clock }) => {
    if (reduce) return;
    if (start.current === null) start.current = clock.elapsedTime;
    value.current = easeOut((clock.elapsedTime - start.current - delay) / dur);
  });
  return value;
}

/** Sanfte Hügel; vor der Kamera (Wasser-/Haus-Bereich) bleibt es flach. */
function terrainHeight(x: number, z: number) {
  const front = clamp01((z + 1) / 5);
  return (Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.55 + Math.sin(x * 0.9 + z * 0.7) * 0.2) * (1 - front * 0.85);
}

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(42, 42, 56, 56);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#79c88f" flatShading roughness={0.95} />
    </mesh>
  );
}

/** Schulden → Bergmassiv: erhebt sich beim Aufbau, Höhe invers zum Score. */
function Mountain({ height, reduce }: { height: number; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const build = useBuildUp(0.3, 1.2, reduce);
  const peaks = useMemo(
    () =>
      [0, 1, 2].map((i) => ({
        x: -3.2 + i * 1.6 + rnd(i) * 0.6,
        z: -6.5 - rnd(i + 3) * 1.5,
        h: (2.5 + rnd(i + 7) * 2) * (0.5 + height),
        r: 1.6 + rnd(i + 11) * 0.9,
      })),
    [height],
  );
  useFrame(() => {
    if (group.current) group.current.scale.setY(Math.max(0.001, build.current));
  });
  return (
    <group ref={group} scale-y={reduce ? 1 : 0.001}>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh castShadow>
            <coneGeometry args={[p.r, p.h, 5]} />
            <meshStandardMaterial color="#5b6b7d" flatShading roughness={0.9} />
          </mesh>
          {/* Schneekappe erst bei schwerer Last: der Berg wird unübersehbar. */}
          {height > 0.5 && (
            <mesh position={[0, p.h * 0.32, 0]} castShadow>
              <coneGeometry args={[p.r * 0.42, p.h * 0.38, 5]} />
              <meshStandardMaterial color="#eef2f7" flatShading roughness={0.6} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Sparquote → Baum: wächst beim Aufbau, wiegt sich dauerhaft im Wind. */
function Tree({ growth, fruitCount, stage, reduce }: { growth: number; fruitCount: number; stage: number; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const build = useBuildUp(0.7, 1.3, reduce);
  const color = CROWN_BY_STAGE[stage - 1];
  const height = 0.9 + 1.6 * growth;
  const crownR = 0.45 + 0.75 * growth;
  const fruits = useMemo(
    () =>
      Array.from({ length: fruitCount }, (_, i) => {
        const a = (i / Math.max(1, fruitCount)) * Math.PI * 2 + 0.7;
        return [Math.cos(a) * crownR * 0.75, height + crownR * 0.4 + Math.sin(a * 2) * crownR * 0.3, Math.sin(a) * crownR * 0.75] as const;
      }),
    [fruitCount, crownR, height],
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    const s = Math.max(0.001, build.current);
    group.current.scale.set(s, s, s);
    if (!reduce) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.03 * s;
  });
  return (
    <group ref={group} position={[2.3, 0, 0.4]} scale={reduce ? 1 : 0.001}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, height, 7]} />
        <meshStandardMaterial color="#7c4a12" flatShading roughness={0.9} />
      </mesh>
      {[
        [0, height + crownR * 0.5, 0, crownR],
        [-crownR * 0.7, height + crownR * 0.15, 0.2, crownR * 0.7],
        [crownR * 0.7, height + crownR * 0.2, -0.15, crownR * 0.72],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={color} flatShading roughness={0.85} />
        </mesh>
      ))}
      {fruits.map((p, i) => (
        <mesh key={`f${i}`} position={[p[0], p[1], p[2]]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#e8554d" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Verträge → Haus: warm bewohnt bei gesunden Fixkosten (Licht + Rauch). */
function House({ litWindows, hasSmoke, condition, reduce }: { litWindows: number; hasSmoke: boolean; condition: number; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const build = useBuildUp(0.5, 1.1, reduce);
  const windowRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const smokeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const wall = condition < 0.4 ? "#b9b2a8" : "#f1ece4";
  const roof = condition < 0.4 ? "#6d6459" : "#a34f2a";
  useFrame(({ clock }) => {
    if (group.current) {
      const s = Math.max(0.001, build.current);
      group.current.scale.set(s, s, s);
    }
    if (reduce) return;
    const t = clock.elapsedTime;
    // Warmes Kerzenlicht-Flackern nur in beleuchteten Fenstern.
    windowRefs.current.forEach((m, i) => {
      if (m && i < litWindows) m.emissiveIntensity = 1.6 + Math.sin(t * 5 + i * 2) * 0.5;
    });
    smokeRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const phase = (t * 0.3 + i / 4) % 1;
      mesh.position.set(-0.32 + Math.sin(phase * 5 + i) * 0.12, 1.55 + phase * 1.4, 0.1);
      const s = 0.08 + phase * 0.22;
      mesh.scale.set(s, s, s);
      (mesh.material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - phase);
    });
  });
  return (
    <group ref={group} position={[-1.9, 0, 1.1]} rotation-y={0.5} scale={reduce ? 1 : 0.001}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.5, 1.1, 1.2]} />
        <meshStandardMaterial color={wall} flatShading roughness={0.9} />
      </mesh>
      {/* Vierseitiges Zeltdach: Kegel mit 4 Segmenten, 45° gedreht. */}
      <mesh position={[0, 1.42, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.18, 0.72, 4]} />
        <meshStandardMaterial color={roof} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.4, 0.61]}>
        <boxGeometry args={[0.34, 0.62, 0.03]} />
        <meshStandardMaterial color="#6d5442" roughness={0.9} />
      </mesh>
      {[-0.45, 0.45, 0].map((x, i) => (
        <mesh key={i} position={[x, i === 2 ? 0.9 : 0.68, 0.61]}>
          <boxGeometry args={[0.26, 0.26, 0.03]} />
          <meshStandardMaterial
            ref={(m) => (windowRefs.current[i] = m)}
            color={i < litWindows ? "#ffd27a" : "#3b4757"}
            emissive={i < litWindows ? "#ffb340" : "#000000"}
            emissiveIntensity={i < litWindows ? 1.6 : 0}
          />
        </mesh>
      ))}
      {hasSmoke && (
        <>
          <mesh position={[-0.32, 1.5, 0.1]} castShadow>
            <boxGeometry args={[0.22, 0.5, 0.22]} />
            <meshStandardMaterial color="#8a8078" flatShading />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} ref={(m) => (smokeRefs.current[i] = m)}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#e8e4de" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/** Liquidität → See: Pegel steigt mit dem Score, Oberfläche wogt dauerhaft. */
function Water({ level, stage, reduce }: { level: number; stage: number; reduce: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const build = useBuildUp(0.9, 1.4, reduce);
  const geometry = useMemo(() => new THREE.CircleGeometry(2.4, 48, 0, Math.PI * 2).rotateX(-Math.PI / 2), []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const rise = -0.32 + (0.06 + 0.34 * level) * build.current;
    mesh.current.position.y = rise + (reduce ? 0 : Math.sin(clock.elapsedTime * 1.1) * 0.015);
    if (!reduce) {
      const pos = (mesh.current.geometry as THREE.CircleGeometry).attributes.position;
      const t = clock.elapsedTime;
      for (let i = 1; i < pos.count; i++) {
        pos.setY(i, Math.sin(t * 1.6 + i * 0.7) * 0.02);
      }
      pos.needsUpdate = true;
    }
  });
  return (
    <group position={[0.4, 0, 3]}>
      {/* Uferbecken: bei niedrigem Pegel sichtbar trockener Rand. */}
      <mesh position={[0, -0.34, 0]}>
        <cylinderGeometry args={[2.55, 2.2, 0.1, 48]} />
        <meshStandardMaterial color="#c9beab" flatShading roughness={1} />
      </mesh>
      <mesh ref={mesh} geometry={geometry} position={[0, -0.3, 0]} receiveShadow>
        <meshStandardMaterial
          color={WATER_BY_STAGE[stage - 1]}
          transparent
          opacity={0.92}
          roughness={0.12}
          metalness={0.25}
        />
      </mesh>
    </group>
  );
}

/** Weiche Low-Poly-Wolken, die endlos über den Himmel ziehen. */
function Clouds({ count, stormy, reduce }: { count: number; stormy: boolean; reduce: boolean }) {
  const refs = useRef<Array<THREE.Group | null>>([]);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ y: 4.6 + rnd(i) * 1.6, z: -4 - rnd(i + 5) * 4, s: 0.8 + rnd(i + 9) * 0.7, v: 0.12 + rnd(i + 13) * 0.18, o: rnd(i + 17) * 20 })), [count]);
  useFrame(({ clock }) => {
    if (reduce) return;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const seed = seeds[i];
      g.position.x = ((clock.elapsedTime * seed.v + seed.o) % 22) - 11;
    });
  });
  return (
    <>
      {seeds.map((seed, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} position={[((seed.o % 22) - 11), seed.y, seed.z]} scale={seed.s}>
          {[
            [0, 0, 0, 0.55],
            [-0.5, -0.08, 0.1, 0.38],
            [0.5, -0.05, -0.1, 0.42],
          ].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]}>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color={stormy ? "#8b98a8" : "#ffffff"} flatShading transparent opacity={stormy ? 0.95 : 0.85} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Gewitterregen als Partikelfeld über der Szene. */
function Rain({ reduce }: { reduce: boolean }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(900);
    for (let i = 0; i < 300; i++) {
      positions[i * 3] = (rnd(i) - 0.5) * 16;
      positions[i * 3 + 1] = rnd(i + 300) * 7;
      positions[i * 3 + 2] = (rnd(i + 600) - 0.5) * 12;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  useFrame((_, delta) => {
    if (reduce || !points.current) return;
    const pos = points.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) - delta * 7;
      pos.setY(i, y < 0 ? 7 : y);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color="#b7d3ee" size={0.05} transparent opacity={0.7} />
    </points>
  );
}

/** Vögel kreisen als stille Belohnung, wenn insgesamt alles gut steht. */
function Birds({ reduce }: { reduce: boolean }) {
  const refs = useRef<Array<THREE.Group | null>>([]);
  const wings = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(({ clock }) => {
    if (reduce) return;
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const a = t * 0.25 + i * 2.1;
      g.position.set(Math.cos(a) * 3.2, 3.6 + i * 0.5 + Math.sin(t + i) * 0.2, -2 + Math.sin(a) * 2.2);
      g.rotation.y = -a + Math.PI / 2;
    });
    wings.current.forEach((w, i) => {
      if (w) w.rotation.x = Math.sin(t * 9 + i) * 0.6;
    });
  });
  return (
    <>
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} position={[Math.cos(i * 2.1) * 3.2, 3.6 + i * 0.5, -2]}>
          {[0, 1].map((side) => (
            <mesh key={side} ref={(w) => (wings.current[i * 2 + side] = w)} position={[side === 0 ? -0.09 : 0.09, 0, 0]}>
              <boxGeometry args={[0.18, 0.015, 0.05]} />
              <meshStandardMaterial color="#2f3a48" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Langsame, atmende Kamerafahrt für den cineastischen Eindruck. */
function CameraRig({ reduce }: { reduce: boolean }) {
  useFrame(({ camera, clock }) => {
    if (reduce) return;
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.09) * 0.6;
    camera.position.y = 2.4 + Math.sin(t * 0.2) * 0.12;
    camera.lookAt(0, 1.1, 0);
  });
  return null;
}

function SceneContents({ scene, reduce }: { scene: LandscapeScene; reduce: boolean }) {
  const { sun, mountain, tree, water, house } = scene;
  const sunniness = sun ? sun.size : 0.6;
  const stormy = sun?.stormy ?? false;
  // Sonnenstand & Atmosphäre folgen dem Notgroschen: tief und diesig bei
  // dünnem Puffer, hoch und klar bei solidem Polster.
  const sunPos: [number, number, number] = [4, 1.5 + 7 * sunniness, -6];
  const fogColor = stormy ? "#93a1b1" : "#dceefb";
  return (
    <>
      <fog attach="fog" args={[fogColor, 10, stormy ? 20 : 30]} />
      <Sky
        distance={450}
        sunPosition={sunPos}
        turbidity={stormy ? 14 : 5 - 3 * sunniness}
        rayleigh={stormy ? 0.4 : 1.6}
        mieCoefficient={stormy ? 0.06 : 0.004}
        mieDirectionalG={0.85}
      />
      <hemisphereLight args={["#cfe8ff", "#5e8f6a", stormy ? 0.35 : 0.55]} />
      <directionalLight
        position={sunPos}
        intensity={stormy ? 0.5 : 1.1 + sunniness * 0.9}
        color={stormy ? "#aeb8c4" : "#ffe0b0"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <Terrain />
      {sun && <Clouds count={sun.cloudCount + (stormy ? 2 : 0)} stormy={stormy} reduce={reduce} />}
      {stormy && <Rain reduce={reduce} />}
      {mountain && <Mountain height={mountain.height} reduce={reduce} />}
      {tree && scene.metrics.savings_rate && (
        <Tree growth={tree.growth} fruitCount={tree.fruitCount} stage={scene.metrics.savings_rate.stage} reduce={reduce} />
      )}
      {house && <House litWindows={house.litWindows} hasSmoke={house.hasSmoke} condition={house.condition} reduce={reduce} />}
      {water && scene.metrics.liquidity && (
        <Water level={water.level} stage={scene.metrics.liquidity.stage} reduce={reduce} />
      )}
      {(scene.overallBucket === "good" || scene.overallBucket === "excellent") && <Birds reduce={reduce} />}
      <CameraRig reduce={reduce} />
    </>
  );
}

interface Landscape3DProps {
  scene: LandscapeScene;
  /** Zugängliche Beschreibung der Illustration. */
  label: string;
  reduce: boolean;
  className?: string;
}

export default function Landscape3D({ scene, label, reduce, className }: Landscape3DProps) {
  return (
    <div role="img" aria-label={label} className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={reduce ? "demand" : "always"}
        camera={{ position: [0, 2.4, 8.5], fov: 42 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        style={{ width: "100%", height: "100%" }}
      >
        <SceneContents scene={scene} reduce={reduce} />
      </Canvas>
    </div>
  );
}
