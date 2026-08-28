import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type EstadoLuki = 'quieta' | 'pensando' | 'contenta' | 'sorprendida';
export type GestoLuki = 'reposo' | 'presume' | 'saluda' | 'idea' | 'equilibrio' | 'mareada';

interface LukiProps {
  className?: string;
  size?: number;
  estado?: EstadoLuki;
  gesto?: GestoLuki;
  mirarCursor?: boolean;
  reaccionaAlTocar?: boolean;
  autoAnimar?: boolean;
  alt?: string;
}

type Punto3D = readonly [number, number, number];

const MORADO = '#7040bf';
const MORADO_CLARO = '#834ed4';
const MORADO_OSCURO = '#35146d';
const LILA_BARRIGA = '#b898e8';

/** Perfil torneado del torso: silueta orgánica y suave de mascota. */
const PERFIL_TORSO = [
  new THREE.Vector2(0.18, -0.84),
  new THREE.Vector2(0.34, -0.76),
  new THREE.Vector2(0.42, -0.54),
  new THREE.Vector2(0.43, -0.20),
  new THREE.Vector2(0.39, 0.16),
  new THREE.Vector2(0.32, 0.46),
  new THREE.Vector2(0.24, 0.70),
  new THREE.Vector2(0.16, 0.82),
];

/** Textura procedural de piel para darle microrelieve y calidez al material. */
const crearTexturaPiel = () => {
  const lado = 64;
  const datos = new Uint8Array(lado * lado);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const onda = Math.sin(x * 1.71 + y * 0.43) * 9 + Math.sin(y * 2.07 - x * 0.29) * 7;
      datos[y * lado + x] = Math.round(128 + onda);
    }
  }
  const textura = new THREE.DataTexture(datos, lado, lado, THREE.RedFormat);
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(4, 6);
  textura.needsUpdate = true;
  return textura;
};

/** Genera la malla 3D de la cola con disminución progresiva hacia la punta fina. */
const crearGeometriaCola = (curva: THREE.CatmullRomCurve3) => {
  const tramos = 56;
  const lados = 20;
  const marcos = curva.computeFrenetFrames(tramos, false);
  const posiciones: number[] = [];
  const indices: number[] = [];
  const centro = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let tramo = 0; tramo <= tramos; tramo += 1) {
    const t = tramo / tramos;
    curva.getPointAt(t, centro);
    const radio = 0.008 + 0.21 * Math.pow(1 - t, 0.76);
    for (let lado = 0; lado <= lados; lado += 1) {
      const angulo = (lado / lados) * Math.PI * 2;
      normal.copy(marcos.normals[tramo]).multiplyScalar(Math.cos(angulo));
      normal.addScaledVector(marcos.binormals[tramo], Math.sin(angulo));
      posiciones.push(
        centro.x + normal.x * radio,
        centro.y + normal.y * radio,
        centro.z + normal.z * radio,
      );
    }
  }

  for (let tramo = 1; tramo <= tramos; tramo += 1) {
    for (let lado = 1; lado <= lados; lado += 1) {
      const a = (lados + 1) * (tramo - 1) + lado - 1;
      const b = (lados + 1) * tramo + lado - 1;
      const c = (lados + 1) * tramo + lado;
      const d = (lados + 1) * (tramo - 1) + lado;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setIndex(indices);
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geometria.computeVertexNormals();
  return geometria;
};

const distancia = (inicio: Punto3D, final: Punto3D) =>
  new THREE.Vector3(...inicio).distanceTo(new THREE.Vector3(...final));

const orientacionEntre = (inicio: Punto3D, final: Punto3D) => {
  const vector = new THREE.Vector3(...final).sub(new THREE.Vector3(...inicio)).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector);
};

/** Segmento cilíndrico cónico para extremidades anatómicas continuas. */
const Segmento: React.FC<{
  inicio: Punto3D;
  final: Punto3D;
  radioInicio: number;
  radioFinal: number;
  color?: string;
  oscuro?: boolean;
}> = ({ inicio, final, radioInicio, radioFinal, color = MORADO, oscuro = false }) => {
  const configuracion = useMemo(() => {
    const medio = new THREE.Vector3(...inicio).add(new THREE.Vector3(...final)).multiplyScalar(0.5);
    return { medio, giro: orientacionEntre(inicio, final), largo: distancia(inicio, final) };
  }, [inicio, final]);

  return (
    <mesh position={configuracion.medio} quaternion={configuracion.giro} castShadow receiveShadow>
      <cylinderGeometry args={[radioFinal, radioInicio, configuracion.largo, 20]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.4}
        metalness={0.01}
        clearcoat={0.14}
        clearcoatRoughness={0.55}
        emissive={oscuro ? MORADO_OSCURO : '#16002d'}
        emissiveIntensity={oscuro ? 0.08 : 0.02}
      />
    </mesh>
  );
};

/** Ojo 3D con esclerótica brillante, pupila responsiva y reflejo de luz. */
const Ojo3D: React.FC<{
  posicion: Punto3D;
  seguirCursor: boolean;
  escala?: number;
  rotacionY?: number;
}> = ({ posicion, seguirCursor, escala = 1, rotacionY = 0 }) => {
  const ojo = useRef<THREE.Group>(null);
  const pupila = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const ciclo = clock.elapsedTime % 4.2;
    const parpadeo = ciclo > 3.92 && ciclo < 4.06;
    if (ojo.current) ojo.current.scale.y = parpadeo ? 0.12 : 1;
    if (pupila.current && seguirCursor) {
      pupila.current.position.x = THREE.MathUtils.lerp(pupila.current.position.x, pointer.x * 0.045, 0.12);
      pupila.current.position.y = THREE.MathUtils.lerp(pupila.current.position.y, pointer.y * 0.032, 0.12);
    }
  });

  return (
    <group ref={ojo} position={posicion} rotation={[0, rotacionY, 0]}>
      <group scale={escala}>
        {/* Esclerótica */}
        <mesh castShadow>
          <sphereGeometry args={[0.152, 32, 24]} />
          <meshPhysicalMaterial
            color="#fffdf8"
            roughness={0.12}
            clearcoat={0.92}
            clearcoatRoughness={0.1}
            emissive="#3a3048"
            emissiveIntensity={0.04}
          />
        </mesh>
        {/* Pupila */}
        <mesh ref={pupila} position={[0, 0, 0.15]} castShadow>
          <sphereGeometry args={[0.072, 28, 20]} />
          <meshPhysicalMaterial color="#110a1a" roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        {/* Brillo especular */}
        <mesh position={[-0.024, 0.032, 0.202]}>
          <sphereGeometry args={[0.02, 12, 10]} />
          <meshBasicMaterial color="white" />
        </mesh>
        {/* Segundo brillo pequeño */}
        <mesh position={[0.03, -0.025, 0.198]}>
          <sphereGeometry args={[0.01, 10, 8]} />
          <meshBasicMaterial color="white" />
        </mesh>
      </group>
    </group>
  );
};

/** Sonrisa trazada en 3D para el hocico. */
const Boca3D: React.FC = () => {
  const curva = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.38, 0.02, 0.68),
        new THREE.Vector3(-0.14, -0.07, 0.72),
        new THREE.Vector3(0.16, 0.01, 0.68),
      ]),
    [],
  );

  return (
    <mesh position={[0, 0, 0]}>
      <tubeGeometry args={[curva, 24, 0.017, 8, false]} />
      <meshPhysicalMaterial color="#21103f" roughness={0.36} clearcoat={0.35} clearcoatRoughness={0.35} />
    </mesh>
  );
};

/** Cola curva dinámica con balanceo orgánico. */
const Cola3D: React.FC<{ gesto: GestoLuki }> = ({ gesto }) => {
  const cola = useRef<THREE.Group>(null);
  const curva = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.2, -0.42, -0.22),
        new THREE.Vector3(0.52, -0.54, -0.32),
        new THREE.Vector3(0.82, -0.52, -0.36),
        new THREE.Vector3(1.22, -0.26, -0.38),
        new THREE.Vector3(1.32, 0.16, -0.32),
        new THREE.Vector3(1.34, 0.44, -0.26),
        new THREE.Vector3(1.24, 0.68, -0.2),
      ]),
    [],
  );
  const geometria = useMemo(() => crearGeometriaCola(curva), [curva]);

  useEffect(() => () => geometria.dispose(), [geometria]);

  useFrame(({ clock }) => {
    if (!cola.current) return;
    const intensidad = gesto === 'equilibrio' ? 0.28 : gesto === 'mareada' ? 0.22 : 0.075;
    cola.current.rotation.z = Math.sin(clock.elapsedTime * (gesto === 'mareada' ? 5.2 : 2.2)) * intensidad;
    cola.current.rotation.y = Math.cos(clock.elapsedTime * 1.8) * (intensidad * 0.5);
  });

  return (
    <group ref={cola}>
      <mesh geometry={geometria} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#7542c0"
          roughness={0.38}
          metalness={0.01}
          clearcoat={0.15}
          clearcoatRoughness={0.54}
          emissive="#28104e"
          emissiveIntensity={0.08}
        />
      </mesh>
    </group>
  );
};

/** Mano 3D anatómica con palma y dedos definidos. */
const Mano3D: React.FC<{ lado: -1 | 1; posicion: Punto3D }> = ({ lado, posicion }) => (
  <group position={posicion}>
    {/* Palma */}
    <mesh scale={[0.15, 0.14, 0.13]} castShadow>
      <sphereGeometry args={[1, 24, 18]} />
      <meshPhysicalMaterial color="#7a48c6" roughness={0.36} clearcoat={0.18} clearcoatRoughness={0.52} />
    </mesh>
    {/* Dedos frontales */}
    {[-0.052, 0, 0.052].map((desfase, indice) => (
      <mesh
        key={desfase}
        position={[desfase, 0.1 - Math.abs(indice - 1) * 0.018, 0.095]}
        scale={[0.052, 0.062, 0.052]}
        castShadow
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color="#8553ce" roughness={0.38} clearcoat={0.14} />
      </mesh>
    ))}
    {/* Pulgar */}
    <mesh position={[-lado * 0.095, -0.015, 0.095]} scale={[0.07, 0.062, 0.062]} castShadow>
      <sphereGeometry args={[1, 16, 12]} />
      <meshPhysicalMaterial color="#6935b3" roughness={0.4} clearcoat={0.12} />
    </mesh>
  </group>
);

/** Brazo 3D curvo con articulación de hombro, flexión y mano. */
const Brazo3D: React.FC<{ lado: -1 | 1; gesto: GestoLuki }> = ({ lado, gesto }) => {
  const brazo = useRef<THREE.Group>(null);
  // Asimetría natural entre brazo izquierdo y derecho
  const elevacion = lado === -1 ? 0.06 : -0.03;
  const amplitudX = lado === -1 ? 0.98 : 0.88;

  const curva = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(lado * 0.36, 0.7, 0.04),
        new THREE.Vector3(lado * 0.74, 0.52, 0.1),
        new THREE.Vector3(lado * amplitudX, 0.64, 0.12),
        new THREE.Vector3(lado * (amplitudX + 0.02), 0.89 + elevacion, 0.14),
        new THREE.Vector3(lado * 0.88, 1.1 + elevacion, 0.18),
      ]),
    [amplitudX, elevacion, lado],
  );

  useFrame(({ clock }) => {
    if (!brazo.current) return;
    const saludo = gesto === 'saluda' && lado === 1 ? Math.sin(clock.elapsedTime * 7.2) * 0.34 : 0;
    const equilibrio = gesto === 'equilibrio' ? lado * Math.sin(clock.elapsedTime * 3) * 0.22 : 0;
    const idea = gesto === 'idea' && lado === 1 ? 0.25 : 0;
    brazo.current.rotation.z = saludo + equilibrio + idea;
  });

  const muneca: Punto3D = [lado * 0.88, 1.1 + elevacion, 0.18];

  return (
    <group ref={brazo}>
      {/* Articulación de hombro para suavizar la unión al torso */}
      <mesh position={[lado * 0.36, 0.7, 0.04]} scale={[0.15, 0.15, 0.15]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color={MORADO} roughness={0.4} />
      </mesh>
      {/* Cuerpo del brazo en tubo continuo */}
      <mesh castShadow>
        <tubeGeometry args={[curva, 32, 0.13, 16, false]} />
        <meshPhysicalMaterial
          color={MORADO}
          roughness={0.38}
          metalness={0.01}
          clearcoat={0.14}
          clearcoatRoughness={0.55}
        />
      </mesh>
      <Mano3D lado={lado} posicion={muneca} />
    </group>
  );
};

/** Pierna 3D con muslo cilíndrico, pie anatómico y 3 dedos redondeados. */
const Pierna3D: React.FC<{ lado: -1 | 1 }> = ({ lado }) => {
  const x = lado * 0.23;
  const pieX = lado * 0.38;
  return (
    <group>
      {/* Articulación de cadera */}
      <mesh position={[x, -0.6, 0.02]} scale={[0.16, 0.16, 0.16]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color={MORADO} roughness={0.4} />
      </mesh>
      {/* Tramo de pierna */}
      <Segmento
        inicio={[x, -0.6, 0.02]}
        final={[pieX, -0.93, 0.15]}
        radioInicio={0.155}
        radioFinal={0.115}
      />
      {/* Empeine / Base del pie */}
      <mesh position={[pieX, -0.98, 0.3]} scale={[0.24, 0.11, 0.18]} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
        <meshPhysicalMaterial color={MORADO} roughness={0.4} clearcoat={0.1} />
      </mesh>
      {/* Tres dedos separados y definidos */}
      {[-0.095, 0, 0.095].map((desfase) => (
        <mesh key={desfase} position={[pieX + desfase, -0.99, 0.46]} scale={[0.068, 0.046, 0.098]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshPhysicalMaterial color="#7a48c6" roughness={0.4} clearcoat={0.1} />
        </mesh>
      ))}
    </group>
  );
};

/** Modelo central compuesto con pose asimétrica, jerarquía visual y animaciones. */
const ModeloLuki: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
}> = ({ estado, gesto, mirarCursor }) => {
  const luki = useRef<THREE.Group>(null);
  const cabeza = useRef<THREE.Group>(null);
  const texturaPiel = useMemo(crearTexturaPiel, []);

  useEffect(() => () => texturaPiel.dispose(), [texturaPiel]);

  useFrame(({ clock, pointer }) => {
    if (!luki.current) return;
    const respirar = Math.sin(clock.elapsedTime * 2.1) * 0.016;
    luki.current.scale.set(1 + respirar * 0.3, 1 + respirar, 1 + respirar * 0.3);
    luki.current.rotation.z =
      gesto === 'mareada'
        ? Math.sin(clock.elapsedTime * 5.2) * 0.12
        : gesto === 'idea'
          ? -0.06
          : -0.018;
    luki.current.position.y =
      -0.12 + (estado === 'contenta' ? Math.abs(Math.sin(clock.elapsedTime * 5.2)) * 0.06 : 0);

    if (cabeza.current && mirarCursor) {
      cabeza.current.rotation.y = THREE.MathUtils.lerp(
        cabeza.current.rotation.y,
        -0.15 + pointer.x * 0.13,
        0.08,
      );
      cabeza.current.rotation.x = THREE.MathUtils.lerp(
        cabeza.current.rotation.x,
        0.02 - pointer.y * 0.075,
        0.08,
      );
    }
  });

  const bocaAbierta = estado === 'contenta' || estado === 'sorprendida';

  return (
    <group ref={luki} rotation={[0.02, -0.16, 0]}>
      {/* Cola trasera */}
      <Cola3D gesto={gesto} />

      {/* Brazos */}
      <Brazo3D lado={-1} gesto={gesto} />
      <Brazo3D lado={1} gesto={gesto} />

      {/* Cuello / hombros continuo para transición suave a la cabeza */}
      <mesh position={[0, 0.66, -0.02]} scale={[0.48, 0.4, 0.4]} castShadow>
        <capsuleGeometry args={[0.46, 0.4, 10, 20]} />
        <meshPhysicalMaterial
          color="#7442bf"
          roughness={0.4}
          clearcoat={0.12}
          clearcoatRoughness={0.58}
        />
      </mesh>

      {/* Torso principal torneado */}
      <mesh position={[0, -0.02, 0]} scale={[1, 1, 0.88]} castShadow receiveShadow>
        <latheGeometry args={[PERFIL_TORSO, 56]} />
        <meshPhysicalMaterial
          color={MORADO}
          roughness={0.4}
          metalness={0.01}
          clearcoat={0.16}
          clearcoatRoughness={0.56}
          sheen={0.22}
          sheenColor="#c2a7e8"
          bumpMap={texturaPiel}
          bumpScale={0.014}
        />
      </mesh>

      {/* Parche de barriga en lila suave */}
      <mesh position={[-0.08, -0.06, 0.49]} scale={[0.41, 0.62, 0.08]}>
        <capsuleGeometry args={[0.6, 0.52, 12, 20]} />
        <meshPhysicalMaterial
          color={LILA_BARRIGA}
          roughness={0.46}
          clearcoat={0.08}
          bumpMap={texturaPiel}
          bumpScale={0.007}
        />
      </mesh>

      {/* Piernas izquierda y derecha */}
      <Pierna3D lado={-1} />
      <Pierna3D lado={1} />

      {/* Sombra de contacto en el suelo */}
      <mesh position={[0, -1.08, -0.16]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.74, 32]} />
        <meshBasicMaterial color="#291146" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* Cabeza con ojos, hocico y boca */}
      <group ref={cabeza} position={[-0.09, 1.14, 0]} rotation={[0.02, -0.14, -0.07]}>
        {/* Cráneo */}
        <mesh scale={[1.12, 0.72, 0.62]} castShadow>
          <sphereGeometry args={[0.72, 32, 24]} />
          <meshPhysicalMaterial
            color="#7945c4"
            roughness={0.38}
            metalness={0.01}
            clearcoat={0.18}
            clearcoatRoughness={0.52}
            sheen={0.26}
            sheenColor="#d2b9ed"
            bumpMap={texturaPiel}
            bumpScale={0.012}
          />
        </mesh>

        {/* Hocico suave adelantado */}
        <mesh position={[-0.32, -0.04, 0.34]} scale={[0.88, 0.35, 0.29]} castShadow>
          <sphereGeometry args={[0.58, 28, 20]} />
          <meshPhysicalMaterial
            color={MORADO_CLARO}
            roughness={0.37}
            clearcoat={0.16}
            clearcoatRoughness={0.54}
            sheen={0.22}
            sheenColor="#d1b5ec"
            bumpMap={texturaPiel}
            bumpScale={0.01}
          />
        </mesh>

        {/* Ojos expresivos colocados en ángulo de tres cuartos */}
        <Ojo3D posicion={[-0.41, 0.28, 0.92]} seguirCursor={mirarCursor} escala={0.92} rotacionY={-0.08} />
        <Ojo3D posicion={[-0.09, 0.32, 0.95]} seguirCursor={mirarCursor} escala={1} rotacionY={0.05} />

        {/* Expresión de boca */}
        {bocaAbierta ? (
          <mesh position={[-0.14, -0.11, 0.85]} scale={[0.29, 0.14, 0.04]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#24113f" roughness={0.45} />
          </mesh>
        ) : (
          <Boca3D />
        )}
      </group>
    </group>
  );
};

/** Personaje interactivo WebGL en Three.js con sombras, luces y animación nativa. */
export const Luki: React.FC<LukiProps> = ({
  className = '',
  size = 160,
  estado = 'quieta',
  gesto = 'presume',
  mirarCursor = true,
  reaccionaAlTocar = true,
  autoAnimar = true,
  alt = 'Luki, la mascota de LukApp',
}) => {
  const [estadoTemporal, setEstadoTemporal] = useState<EstadoLuki | null>(null);
  const [gestoTemporal, setGestoTemporal] = useState<GestoLuki | null>(null);
  const estadoVisible = estadoTemporal ?? estado;
  const gestoVisible = gestoTemporal ?? gesto;

  useEffect(() => {
    if (!autoAnimar) return undefined;
    const acciones: readonly GestoLuki[] = ['saluda', 'idea', 'equilibrio', 'mareada'];
    let indice = 0;
    const intervalo = window.setInterval(() => {
      setGestoTemporal(acciones[indice % acciones.length]);
      indice += 1;
      window.setTimeout(() => setGestoTemporal(null), 1600);
    }, 6800);
    return () => window.clearInterval(intervalo);
  }, [autoAnimar]);

  const celebrar = () => {
    if (!reaccionaAlTocar) return;
    setEstadoTemporal('contenta');
    setGestoTemporal('saluda');
    window.setTimeout(() => {
      setEstadoTemporal(null);
      setGestoTemporal(null);
    }, 900);
  };

  return (
    <div
      className={`luki-3d ${className}`}
      style={{ '--tamano-luki': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={alt}
      data-gesto={gestoVisible}
    >
      <Canvas
        camera={{ position: [0, 0.32, 6.4], fov: 31 }}
        dpr={[1.5, 2]}
        gl={{ alpha: true, antialias: true }}
        shadows
        onClick={celebrar}
      >
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#f6edff', '#2a0c59', 1.18]} />
        <directionalLight position={[-3.2, 4.5, 5]} intensity={3.15} color="#fff8ff" castShadow />
        <directionalLight position={[4, 1, 2]} intensity={0.48} color="#bba0ff" />
        <directionalLight position={[2.5, 3, -4]} intensity={2.25} color="#7e3ff2" />
        <pointLight position={[-1.5, -0.5, 3.5]} intensity={0.4} color="#ffffff" />
        <ModeloLuki estado={estadoVisible} gesto={gestoVisible} mirarCursor={mirarCursor} />
      </Canvas>
    </div>
  );
};
