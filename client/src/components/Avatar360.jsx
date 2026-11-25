import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";

// This is a stylized, rotatable 3D fashion model, NOT a scan of the user's body.
// It reads the same `selections` prop as the original StyleCircle Avatar360.
const COLOR_WORDS = {
  black: "#29262a", white: "#f7eee5", ivory: "#f3e4d3",
  cream: "#ecdfcd", beige: "#d6baa0", brown: "#7c5341",
  red: "#a63849", burgundy: "#782d45", maroon: "#782d45",
  pink: "#db9aaa", blue: "#587ea8", navy: "#283c64",
  green: "#688b74", olive: "#77774f", yellow: "#e6bf79",
  orange: "#cf8a5c", purple: "#9276a5", gray: "#979394",
  grey: "#979394", denim: "#517fa8", gold: "#bc9761",
};

const SKIN_TONES = [
  { name: "Porcelain", value: "#e9c6ac" },
  { name: "Warm beige", value: "#d7a988" },
  { name: "Golden", value: "#bf8767" },
  { name: "Deep", value: "#875b48" },
];

const HAIR_COLORS = [
  { name: "Espresso", value: "#34231f" },
  { name: "Chocolate", value: "#604033" },
  { name: "Chestnut", value: "#96633e" },
  { name: "Blonde", value: "#c49c63" },
  { name: "Black", value: "#201d21" },
];

const FABRIC = { roughness: 0.82, metalness: 0.02 };

function garmentColor(item, fallback) {
  if (!item) return fallback;
  const explicit = String(item.color || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(explicit)) return explicit;
  const words = `${explicit} ${item.name || ""}`.toLowerCase();
  const match = Object.keys(COLOR_WORDS).find((key) =>
    new RegExp(`\\b${key}\\b`).test(words)
  );
  return match ? COLOR_WORDS[match] : fallback;
}

function Oval({ position, scale, color, roughness = 0.8, rotation }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      <sphereGeometry args={[1, 32, 24]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function Limb({ from, to, topRadius, bottomRadius, color, roughness = 0.86 }) {
  const { midpoint, rotation, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    return {
      midpoint: a.clone().add(b).multiplyScalar(0.5),
      rotation: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), direction.clone().normalize()
      ),
      length: direction.length(),
    };
  }, [from.join(","), to.join(",")]);
  return (
    <mesh position={midpoint} quaternion={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[topRadius, bottomRadius, length, 18]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

// Elliptical rings form a gently sculpted silhouette (bust, waist, hips).
function Silhouette({ rings, color, shininess = 0.83, open = false }) {
  const geometry = useMemo(() => {
    const sides = 64;
    const vertices = [];
    const indices = [];
    rings.forEach(([y, xRadius, zRadius], ringIndex) => {
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * xRadius,
          y,
          Math.sin(angle) * zRadius
        );
        if (ringIndex > 0 && i < sides) {
          const a = (ringIndex - 1) * (sides + 1) + i;
          const b = ringIndex * (sides + 1) + i;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    });
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    mesh.setIndex(indices);
    mesh.computeVertexNormals();
    return mesh;
  }, [JSON.stringify(rings)]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={shininess}
        metalness={0.02}
        side={open ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

function FaceAndHair({ skin, hair }) {
  return (
    <group>
      <Oval position={[0, 3.47, 0.018]} scale={[0.255, 0.326, 0.225]} color={skin} roughness={0.85} />
      <Oval position={[-0.256, 3.46, 0]} scale={[0.042, 0.075, 0.037]} color={skin} />
      <Oval position={[0.256, 3.46, 0]} scale={[0.042, 0.075, 0.037]} color={skin} />
      {/* Understated fashion-doll facial details (front faces +Z). */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Oval position={[side * 0.102, 3.49, 0.225]} scale={[0.060, 0.030, 0.014]} color="#f2e7e0" />
          <Oval position={[side * 0.102, 3.49, 0.240]} scale={[0.024, 0.027, 0.009]} color="#514039" />
          <Oval position={[side * 0.103, 3.538, 0.226]} scale={[0.071, 0.010, 0.015]} color={hair} />
        </group>
      ))}
      <Oval position={[0, 3.406, 0.236]} scale={[0.037, 0.068, 0.037]} color={skin} />
      <Oval position={[0, 3.321, 0.214]} scale={[0.079, 0.023, 0.017]} color="#ad716c" />
      {/* Hair cap, sleek side part, and a low bun for 360° visibility. */}
      <Oval position={[0, 3.645, -0.047]} scale={[0.263, 0.171, 0.235]} color={hair} roughness={0.96} />
      <Oval position={[-0.197, 3.556, 0.001]} scale={[0.082, 0.155, 0.201]} color={hair} />
      <Oval position={[0.202, 3.550, -0.018]} scale={[0.067, 0.136, 0.191]} color={hair} />
      <Oval position={[0, 3.515, -0.235]} scale={[0.168, 0.131, 0.145]} color={hair} />
      <Oval position={[0, 3.695, -0.254]} scale={[0.115, 0.112, 0.125]} color={hair} />
    </group>
  );
}

function Body({ skin, waist, hips, bust }) {
  const hip = 0.39 * hips;
  const chest = 0.393 * bust;
  const waistRadius = 0.286 * waist;
  return (
    <group>
      <Silhouette
        color={skin}
        rings={[
          [1.82, 0.20, 0.18],
          [1.92, hip * 0.92, 0.23],
          [2.04, hip, 0.268],
          [2.19, waistRadius * 1.1, 0.215],
          [2.36, waistRadius, 0.195],
          [2.52, chest * 0.92, 0.245],
          [2.70, chest, 0.254],
          [2.82, 0.37, 0.185],
          [2.88, 0.19, 0.12],
        ]}
      />
      <Oval position={[0, 3.01, 0]} scale={[0.119, 0.20, 0.11]} color={skin} />
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Long, gently tapered arms with shaped elbows and hands. */}
          <Oval position={[side * 0.427, 2.74, 0]} scale={[0.138, 0.145, 0.146]} color={skin} />
          <Limb from={[side * 0.43, 2.72, 0]} to={[side * 0.57, 2.22, 0.02]}
            topRadius={0.113} bottomRadius={0.132} color={skin} />
          <Oval position={[side * 0.57, 2.22, 0.02]} scale={[0.102, 0.107, 0.103]} color={skin} />
          <Limb from={[side * 0.57, 2.21, 0.02]} to={[side * 0.55, 1.74, 0.08]}
            topRadius={0.075} bottomRadius={0.099} color={skin} />
          <Oval position={[side * 0.55, 1.61, 0.09]} scale={[0.086, 0.163, 0.065]} color={skin} />
          {/* Legs have knees and calves instead of uniform tubes. */}
          <Oval position={[side * 0.209, 1.91, 0]} scale={[0.207 * hips, 0.23, 0.202]} color={skin} />
          <Limb from={[side * 0.215, 1.81, 0]} to={[side * 0.22, 1.09, 0.03]}
            topRadius={0.143} bottomRadius={0.185 * hips} color={skin} />
          <Oval position={[side * 0.22, 1.08, 0.03]} scale={[0.137, 0.145, 0.135]} color={skin} />
          <Limb from={[side * 0.22, 1.03, 0.03]} to={[side * 0.23, 0.36, 0.012]}
            topRadius={0.092} bottomRadius={0.127} color={skin} />
          <Oval position={[side * 0.23, 0.305, 0.108]} scale={[0.13, 0.09, 0.228]} color={skin} />
        </group>
      ))}
    </group>
  );
}

function Top({ color, item, bust, waist, outerwear = false }) {
  const title = `${item?.name || ""} ${item?.style || ""}`.toLowerCase();
  const hoodie = /hoodie|sweatshirt|pullover/.test(title);
  const buttonShirt = /shirt|blouse|cardigan|button/.test(title);
  const sleeveless = /tank|sleeveless|camisole|vest/.test(title);
  const longSleeves = outerwear || hoodie || buttonShirt || /long sleeve/.test(title);
  const radius = outerwear ? 1.16 : 1.05;
  const r = (v) => v * radius;
  return (
    <group>
      <Silhouette
        color={color}
        rings={[
          [1.91, r(0.335 * waist), r(0.235)],
          [2.05, r(0.351 * waist), r(0.237)],
          [2.23, r(0.299 * waist), r(0.219)],
          [2.42, r(0.315 * bust), r(0.238)],
          [2.63, r(0.401 * bust), r(0.278)],
          [2.77, r(0.383), r(0.204)],
          [2.82, r(0.285), r(0.176)],
        ]}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          {!sleeveless && (
            <>
              <Oval position={[side * 0.447, 2.70, 0]}
                scale={[0.158 * radius, 0.154, 0.16 * radius]} color={color} />
              <Limb from={[side * 0.46, 2.67, 0]} to={[side * 0.55, longSleeves ? 2.21 : 2.48, 0.02]}
                topRadius={0.129 * radius} bottomRadius={0.151 * radius} color={color} />
              {longSleeves && (
                <Limb from={[side * 0.55, 2.21, 0.02]} to={[side * 0.55, 1.78, 0.07]}
                  topRadius={0.096 * radius} bottomRadius={0.124 * radius} color={color} />
              )}
            </>
          )}
        </group>
      ))}
      {/* Neckline with fabric-colored trim. */}
      <mesh position={[0, 2.786, 0.181 * radius]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.155, 0.012, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#e8c7ac" roughness={0.9} />
      </mesh>
      {buttonShirt && !outerwear && [-1, 0, 1].map((i) => (
        <Oval key={i} position={[0, 2.45 + i * 0.16, 0.273 * radius]}
          scale={[0.012, 0.012, 0.008]} color="#d9b991" />
      ))}
      {hoodie && (
        <Oval position={[0, 2.02, 0.246 * radius]}
          scale={[0.20, 0.105, 0.012]} color={color} />
      )}
      {outerwear && (
        <>
          <mesh position={[0, 2.35, 0.306]}>
            <boxGeometry args={[0.013, 0.78, 0.010]} />
            <meshStandardMaterial color="#f1d7bd" />
          </mesh>
          <Oval position={[0, 2.62, 0.308]} scale={[0.03, 0.03, 0.015]} color="#d1ae82" />
        </>
      )}
    </group>
  );
}

function Bottom({ item, color, hips }) {
  const text = `${item?.name || ""} ${item?.style || ""}`.toLowerCase();
  const isSkirt = /skirt/.test(text);
  const isShort = /shorts|short/.test(text);
  if (isSkirt) {
    return (
      <Silhouette
        color={color}
        open
        rings={[
          [1.27, 0.53 * hips, 0.40],
          [1.45, 0.48 * hips, 0.35],
          [1.72, 0.412 * hips, 0.275],
          [2.04, 0.395 * hips, 0.28],
          [2.12, 0.35 * hips, 0.26],
        ]}
      />
    );
  }
  return (
    <group>
      <Silhouette color={color} rings={[
        [1.80, 0.22, 0.18],
        [1.93, 0.381 * hips, 0.26],
        [2.03, 0.401 * hips, 0.27],
        [2.13, 0.349 * hips, 0.235],
      ]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Limb
            from={[side * 0.215, 1.88, 0]}
            to={[side * 0.22, isShort ? 1.39 : 1.06, 0.016]}
            topRadius={isShort ? 0.165 : 0.153}
            bottomRadius={0.184 * hips}
            color={color}
          />
          {!isShort && (
            <Limb from={[side * 0.22, 1.06, 0.016]} to={[side * 0.23, 0.33, 0]}
              topRadius={0.100} bottomRadius={0.139} color={color} />
          )}
          <Oval position={[side * 0.278, 1.93, 0.262]}
            scale={[0.079, 0.06, 0.012]} color={color} />
        </group>
      ))}
      <mesh position={[0, 2.115, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.365 * hips, 0.018, 8, 48]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}

function Dress({ item, color, bust, waist }) {
  const title = String(item?.name || "").toLowerCase();
  const short = /mini|short/.test(title);
  return (
    <group>
      <Top color={color} item={{ name: "short sleeve" }} bust={bust} waist={waist} />
      <Silhouette color={color} open rings={[
        [short ? 1.33 : 0.83, short ? 0.62 : 0.72, short ? 0.45 : 0.51],
        [1.48, 0.53, 0.39],
        [1.78, 0.43, 0.31],
        [2.03, 0.34 * waist, 0.24],
      ]} />
      <mesh position={[0, 2.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34 * waist, 0.023, 10, 48]} />
        <meshStandardMaterial color="#c7a47f" roughness={0.65} />
      </mesh>
    </group>
  );
}

function Accessories({ selected }) {
  const bag = selected.bag;
  if (!bag) return null;
  const color = garmentColor(bag, "#876046");
  return (
    <group position={[0.79, 1.54, 0.11]}>
      <mesh castShadow>
        <boxGeometry args={[0.43, 0.33, 0.18]} />
        <meshStandardMaterial color={color} {...FABRIC} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.126, 0.029, 10, 32, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0, 0.098]}>
        <boxGeometry args={[0.086, 0.027, 0.012]} />
        <meshStandardMaterial color="#cfb17c" metalness={0.55} roughness={0.42} />
      </mesh>
    </group>
  );
}

function FashionModel({ selections, angle, appearance }) {
  const selected = useMemo(
    () => Object.fromEntries(selections.map((item) => [item.category, item])),
    [selections]
  );
  const hasDress = Boolean(selected.dress);
  const top = selected.top;
  const jacket = selected.outerwear;
  const topColor = garmentColor(top, "#823f55");
  const trouserColor = garmentColor(selected.bottom, "#e5d4bf");
  const dressColor = garmentColor(selected.dress, "#a44e62");
  const jacketColor = garmentColor(jacket, "#8d665b");
  const shoeColor = garmentColor(selected.shoes, "#573b37");
  const skin = appearance.skin;
  return (
    <group rotation={[0, angle, 0]}>
      <group scale={[1, appearance.height, 1]}>
        <Body skin={skin} waist={appearance.waist} hips={appearance.hips} bust={appearance.bust} />
        <FaceAndHair skin={skin} hair={appearance.hair} />
        {hasDress ? (
          <Dress color={dressColor} item={selected.dress}
            bust={appearance.bust} waist={appearance.waist} />
        ) : (
          <>
            <Bottom color={trouserColor} item={selected.bottom} hips={appearance.hips} />
            <Top color={topColor} item={top || { name: "short sleeve" }}
              bust={appearance.bust} waist={appearance.waist} />
          </>
        )}
        {jacket && <Top color={jacketColor} item={jacket}
          bust={appearance.bust} waist={appearance.waist} outerwear />}
        {[-1, 1].map((side) => (
          <Oval key={side} position={[side * 0.23, 0.306, 0.135]}
            scale={[0.143, 0.085, 0.264]} color={shoeColor} roughness={0.68} />
        ))}
        <Accessories selected={selected} />
      </group>
    </group>
  );
}

function Studio() {
  return (
    <group>
      {/* Floor and boutique-style glowing arch. All of this remains part of the 3D scene. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.125, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#e9ded6" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.02, 0.23, 72]} />
        <meshStandardMaterial color="#f5e8db" roughness={0.77} />
      </mesh>
      <mesh position={[0, -0.076, 0]}>
        <cylinderGeometry args={[1.023, 1.023, 0.018, 72]} />
        <meshStandardMaterial color="#bb927d" metalness={0.5} roughness={0.38} />
      </mesh>
      <mesh position={[0, 1.73, -0.98]} scale={[0.93, 1.30, 1]}>
        <torusGeometry args={[1.68, 0.019, 10, 90, Math.PI]} />
        <meshStandardMaterial color="#ccac98" metalness={0.29} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.55, -1.03]}>
        <planeGeometry args={[3.05, 3.84]} />
        <meshStandardMaterial color="#e8d5cb" roughness={1} />
      </mesh>
    </group>
  );
}

const INITIAL = {
  skin: SKIN_TONES[1].value,
  hair: HAIR_COLORS[0].value,
  bust: 1,
  waist: 1,
  hips: 1,
  height: 1,
};

const fieldStyle = {
  background: "#fffaf5",
  color: "#442b2a",
  border: "1px solid #e2d0c5",
  borderRadius: 8,
  padding: "7px 9px",
  width: "100%",
};

export default function Avatar360({ selections = [], profile = null }) {
  const [angle, setAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [appearance, setAppearance] = useState(() => profile ? ({ ...INITIAL,
    bust: profile.bust, waist: profile.waist, hips: profile.hips, height: profile.height
  }) : INITIAL);
  // A new photo-analysis result changes the visible 3D proportions automatically.
  // Later manual adjustments remain available through the existing controls.
  useEffect(() => {
    if (!profile) return;
    setAppearance((old) => ({
      ...old,
      bust: profile.bust,
      waist: profile.waist,
      hips: profile.hips,
      height: profile.height,
    }));
  }, [profile?.timestamp]);
  const [showCustom, setShowCustom] = useState(false);
  const controls = useRef(null);

  function update(field, value) {
    setAppearance((previous) => ({ ...previous, [field]: value }));
  }

  function reset() {
    setAppearance(INITIAL);
    setAngle(0);
    setAutoRotate(false);
    controls.current?.reset();
  }

  return (
    <section className="sc-avatar" aria-label="360 degree fashion studio">
      <div className="sc-avatar__canvas" aria-label="Interactive 3D fashion model">
        <Canvas shadows camera={{ position: [0.3, 2.00, 7.5], fov: 33 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
          <color attach="background" args={["#e9ded6"]} />
          <ambientLight intensity={1.25} />
          <hemisphereLight args={["#fffaf5", "#ad8d85", 1.9]} />
          <directionalLight position={[3, 6, 4]} intensity={2.7} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024}
            shadow-bias={-0.0001} />
          <directionalLight position={[-3, 3, -4]} intensity={1.55} color="#ffddd3" />
          <Studio />
          <FashionModel selections={selections} angle={angle} appearance={appearance} />
          <ContactShadows opacity={0.3} scale={5} blur={2.5} far={3.5}
            position={[0, 0.14, 0]} color="#7b5750" />
          <OrbitControls ref={controls} target={[0, 1.92, 0]}
            enablePan={false} enableZoom minDistance={4} maxDistance={10}
            minPolarAngle={0.42} maxPolarAngle={Math.PI * 0.68}
            autoRotate={autoRotate} autoRotateSpeed={1.5} />
        </Canvas>
      </div>

      <div className="sc-avatar__actions">
        <button type="button" onClick={() => setAngle((v) => v - Math.PI / 4)}>
          ↶ Turn 45°
        </button>
        <button type="button" onClick={() => setAutoRotate((v) => !v)}>
          {autoRotate ? "Pause rotation" : "Auto rotate"}
        </button>
        <button type="button" onClick={() => setAngle((v) => v + Math.PI / 4)}>
          Turn 45° ↷
        </button>
        <button type="button" onClick={() => setShowCustom((v) => !v)}>
          {showCustom ? "Hide customization" : "Customize model"}
        </button>
      </div>

      {showCustom && (
        <div style={{ border: "1px solid #e4cdc3", borderRadius: 12,
          background: "#fff8f3", padding: 14, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <label style={{ fontSize: 13 }}>
              Skin tone
              <select style={fieldStyle} value={appearance.skin}
                onChange={(e) => update("skin", e.target.value)}>
                {SKIN_TONES.map((tone) => <option key={tone.name} value={tone.value}>{tone.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              Hair color
              <select style={fieldStyle} value={appearance.hair}
                onChange={(e) => update("hair", e.target.value)}>
                {HAIR_COLORS.map((color) => <option key={color.name} value={color.value}>{color.name}</option>)}
              </select>
            </label>
            {[
              ["bust", "Bust", 0.85, 1.20],
              ["waist", "Waist", 0.78, 1.22],
              ["hips", "Hips", 0.85, 1.20],
              ["height", "Height", 0.91, 1.09],
            ].map(([field, label, min, max]) => (
              <label key={field} style={{ fontSize: 13 }}>
                {label} · {Math.round(appearance[field] * 100)}%
                <input type="range" min={min} max={max} step="0.01"
                  value={appearance[field]}
                  onChange={(e) => update(field, Number(e.target.value))}
                  style={{ display: "block", width: "100%", accentColor: "#884356" }} />
              </label>
            ))}
          </div>
          <button type="button" className="button-outline" onClick={reset}
            style={{ marginTop: 12 }}>Reset model</button>
        </div>
      )}

      <p className="sc-hint">
        Rotate by dragging and zoom with your scroll wheel.
        {selections.length === 0 ? " A sample outfit is shown until you select clothes from My Closet." : " Clothing colors and silhouettes are approximate."}
        {" "}{profile ? "Body dimensions were adjusted using approximate proportions detected in the two uploaded photos. Facial likeness and garment geometry are not reconstructed." : "This is the default editable avatar. Upload both photos and select Generate from photos to estimate its proportions."}
      </p>
    </section>
  );
}
