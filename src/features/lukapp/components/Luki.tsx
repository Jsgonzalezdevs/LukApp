import React, { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

export type EstadoLuki = 'quieta' | 'pensando' | 'contenta' | 'sorprendida';
export type GestoLuki = 'reposo' | 'presume' | 'saluda' | 'idea' | 'equilibrio' | 'mareada' | 'pensando';

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

/* Paleta oficial de color de Luki (Gecko violeta 3D idéntico a la referencia) */
const MORADO_BASE = '#7034dc';
const MORADO_OSCURO = '#2a0a54';
const LILA_BARRIGA = '#9f70ee';
const OJO_BLANCO = '#fefeff';
const PUPILA_NEGRA = '#120e1e';

/** Perfil anatómico esbelto y fluido para el torso de Luki */
const PERFIL_TORSO = [
  new THREE.Vector2(0.12, -0.66),
  new THREE.Vector2(0.20, -0.60),
  new THREE.Vector2(0.28, -0.46),
  new THREE.Vector2(0.31, -0.28),
  new THREE.Vector2(0.32, -0.06),
  new THREE.Vector2(0.31, 0.14),
  new THREE.Vector2(0.28, 0.34),
  new THREE.Vector2(0.24, 0.50),
  new THREE.Vector2(0.18, 0.66),
  new THREE.Vector2(0.15, 0.82),
  new THREE.Vector2(0.13, 0.92),
];

/** Textura procedural mate muy suave tipo arcilla / vinilo de estudio 3D */
const crearTexturaPiel = () => {
  const lado = 256;
  const datos = new Uint8Array(lado * lado);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const onda =
        Math.sin(x * 0.7 + y * 0.35) * 3 +
        Math.sin(y * 0.9 - x * 0.25) * 2 +
        Math.sin((x + y) * 1.2) * 1.5;
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

/** Genera la cola de gecko con curvatura suave y adelgazamiento continuo hacia la punta */
const crearGeometriaCola = (curva: THREE.CatmullRomCurve3) => {
  const tramos = 96;
  const lados = 32;
  const marcos = curva.computeFrenetFrames(tramos, false);
  const posiciones: number[] = [];
  const indices: number[] = [];
  const centro = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let tramo = 0; tramo <= tramos; tramo += 1) {
    const t = tramo / tramos;
    curva.getPointAt(t, centro);
    // Disminución cónica suave hacia la punta fina
    const radio = 0.004 + 0.21 * Math.pow(1 - t, 0.74);
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

/** Genera tubos continuos de alta resolución para extremidades */
const crearGeometriaTubo = (curva: THREE.CatmullRomCurve3, radioBase: number, radioPunta: number) => {
  const tramos = 48;
  const lados = 32;
  const marcos = curva.computeFrenetFrames(tramos, false);
  const posiciones: number[] = [];
  const indices: number[] = [];
  const centro = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let tramo = 0; tramo <= tramos; tramo += 1) {
    const t = tramo / tramos;
    curva.getPointAt(t, centro);
    const radio = THREE.MathUtils.lerp(radioBase, radioPunta, t);
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

/** Dedo suave con almohadilla de succión redondeada */
const DedoGecko: React.FC<{
  inicio: Punto3D;
  direccion: Punto3D;
  largo: number;
  grosor: number;
  radioPunta: number;
  color?: string;
}> = ({ inicio, direccion, largo, grosor, radioPunta, color = MORADO_BASE }) => {
  const dirNorm = useMemo(() => new THREE.Vector3(...direccion).normalize(), [direccion]);
  const fin = useMemo(() => {
    const start = new THREE.Vector3(...inicio);
    const end = start.clone().addScaledVector(dirNorm, largo);
    return [end.x, end.y, end.z] as const;
  }, [dirNorm, inicio, largo]);

  const curva = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(...inicio), new THREE.Vector3(...fin)]),
    [fin, inicio],
  );
  const geo = useMemo(() => crearGeometriaTubo(curva, grosor, grosor * 0.8), [curva, grosor]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={color}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
        />
      </mesh>
      {/* Almohadilla esférica en la punta del dedo */}
      <mesh position={fin} scale={[1, 1, 1]} castShadow>
        <sphereGeometry args={[radioPunta, 32, 24]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.76}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.14}
          sheenColor="#8a4ee0"
        />
      </mesh>
    </group>
  );
};

/** Ojo tierno de gecko montado sobre la bóveda craneal (idéntico a la referencia) */
const OjoGecko: React.FC<{
  posicion: Punto3D;
  rotacion: Punto3D;
  pupilaOffset: Punto3D;
  escala?: number;
}> = ({ posicion, rotacion, pupilaOffset, escala = 1 }) => {
  return (
    <group position={posicion} rotation={[rotacion[0], rotacion[1], rotacion[2]]} scale={[escala, escala, escala]}>
      {/* Párpado / Cuenca posterior suave */}
      <mesh position={[0, -0.015, -0.02]} scale={[1.1, 1.06, 1.08]} castShadow>
        <sphereGeometry args={[0.136, 48, 36, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
        />
      </mesh>

      {/* Globo ocular blanco esférico */}
      <mesh castShadow>
        <sphereGeometry args={[0.136, 64, 48]} />
        <meshPhysicalMaterial
          color={OJO_BLANCO}
          roughness={0.18}
          metalness={0.0}
          clearcoat={0.25}
          clearcoatRoughness={0.15}
          emissive="#241a30"
          emissiveIntensity={0.015}
        />
      </mesh>

      {/* Pupila negra redonda mirando hacia arriba/izquierda como en la referencia */}
      <mesh position={pupilaOffset} castShadow>
        <sphereGeometry args={[0.062, 48, 36]} />
        <meshPhysicalMaterial color={PUPILA_NEGRA} roughness={0.12} metalness={0.0} clearcoat={0.25} />
      </mesh>

      {/* Destello de luz suave */}
      <mesh position={[pupilaOffset[0] - 0.02, pupilaOffset[1] + 0.028, pupilaOffset[2] + 0.045]}>
        <sphereGeometry args={[0.018, 20, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

/** Cabeza achatada tipo gecko con hocico ancho, sonrisa continua y ojos elevados */
const CabezaGecko: React.FC<{ texturaPiel: THREE.DataTexture }> = ({ texturaPiel }) => {
  // Sonrisa amplia y alegre trazada de extremo a extremo del hocico
  const curvaSonrisa = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.36, -0.02, 0.14),
        new THREE.Vector3(-0.24, -0.06, 0.32),
        new THREE.Vector3(0.0, -0.07, 0.40),
        new THREE.Vector3(0.24, -0.06, 0.32),
        new THREE.Vector3(0.36, 0.02, 0.14),
      ]),
    [],
  );

  return (
    // Cabeza inclinada alegremente hacia la derecha y arriba como en la foto de referencia
    <group position={[0, 0.92, 0.06]} rotation={[0.06, 0.14, -0.08]}>
      {/* Bóveda craneal ancha y aplanada (forma de espátula/gecko) */}
      <mesh scale={[1.34, 0.50, 1.08]} castShadow>
        <sphereGeometry args={[0.38, 64, 48]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
          bumpMap={texturaPiel}
          bumpScale={0.003}
        />
      </mesh>

      {/* Fosas nasales sutiles en el hocico */}
      <mesh position={[-0.042, 0.04, 0.44]}>
        <sphereGeometry args={[0.011, 16, 12]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>
      <mesh position={[0.042, 0.04, 0.44]}>
        <sphereGeometry args={[0.011, 16, 12]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>

      {/* Línea tallada de la sonrisa */}
      <mesh position={[0, 0, 0.02]}>
        <tubeGeometry args={[curvaSonrisa, 64, 0.014, 12, false]} />
        <meshPhysicalMaterial color={MORADO_OSCURO} roughness={0.7} />
      </mesh>

      {/* Ojos elevados y juntos sobre la coronilla de la cabeza (como en la imagen 1) */}
      <OjoGecko
        posicion={[-0.092, 0.18, -0.02]}
        rotacion={[-0.24, -0.12, 0.14]}
        pupilaOffset={[-0.032, 0.042, 0.124]}
        escala={1.04}
      />
      <OjoGecko
        posicion={[0.092, 0.18, -0.02]}
        rotacion={[-0.24, 0.12, -0.14]}
        pupilaOffset={[-0.032, 0.042, 0.124]}
        escala={1.04}
      />
    </group>
  );
};

/** Brazo en pose de flexión de bíceps (como la imagen oficial de referencia) */
const BrazoFlex: React.FC<{ lado: -1 | 1 }> = ({ lado }) => {
  const puntosBrazo = useMemo(() => {
    const hombro = new THREE.Vector3(lado * 0.22, 0.46, 0.0);
    const codo = new THREE.Vector3(lado * 0.64, 0.42, 0.04);
    const antebrazo = new THREE.Vector3(lado * 0.60, 0.70, 0.08);
    const muneca = new THREE.Vector3(lado * 0.52, 0.82, 0.12);
    return [hombro, codo, antebrazo, muneca];
  }, [lado]);

  const curva = useMemo(() => new THREE.CatmullRomCurve3(puntosBrazo), [puntosBrazo]);
  const geo = useMemo(() => crearGeometriaTubo(curva, 0.092, 0.076), [curva]);
  useEffect(() => () => geo.dispose(), [geo]);

  const posMuneca = puntosBrazo[puntosBrazo.length - 1];

  return (
    <group>
      {/* Tubo del brazo en L fuerte */}
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
        />
      </mesh>

      {/* Puño cerrado con 4 nudillos redondos en lo alto */}
      <group position={[posMuneca.x, posMuneca.y, posMuneca.z]} rotation={[0.2, 0, lado === 1 ? -0.3 : 0.3]}>
        {/* Base de la mano */}
        <mesh scale={[0.08, 0.07, 0.07]} castShadow>
          <sphereGeometry args={[1, 24, 18]} />
          <meshPhysicalMaterial color={MORADO_BASE} roughness={0.78} />
        </mesh>
        {/* 4 dedos recogidos en flexión */}
        {[-0.038, -0.012, 0.014, 0.040].map((x, i) => (
          <mesh key={i} position={[x, 0.04, 0.03]} scale={[0.026, 0.032, 0.028]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
            <meshPhysicalMaterial color={MORADO_BASE} roughness={0.76} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

/** Pata de gecko en postura ancha y firme con 4 dedos y ventosas planas */
const PiernaGecko: React.FC<{ lado: -1 | 1 }> = ({ lado }) => {
  const caderaX = lado * 0.20;
  const rodillaX = lado * 0.38;
  const pieX = lado * 0.34;

  const puntosPierna = useMemo(
    () => [
      new THREE.Vector3(caderaX, -0.42, 0.0),
      new THREE.Vector3(rodillaX, -0.66, 0.08),
      new THREE.Vector3(pieX, -0.96, 0.14),
    ],
    [caderaX, pieX, rodillaX],
  );

  const curva = useMemo(() => new THREE.CatmullRomCurve3(puntosPierna), [puntosPierna]);
  const geo = useMemo(() => crearGeometriaTubo(curva, 0.128, 0.086), [curva]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
        />
      </mesh>

      {/* Empeine / Talón suave */}
      <mesh position={[pieX, -0.98, 0.20]} scale={[0.13, 0.045, 0.16]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.78} />
      </mesh>

      {/* 4 dedos de la pata con ventosas circulares */}
      {[-0.076, -0.026, 0.026, 0.076].map((desfase, indice) => {
        const angulo = (indice - 1.5) * 0.28;
        const largo = 0.082 + Math.cos(angulo) * 0.02;
        return (
          <group key={desfase}>
            <DedoGecko
              inicio={[pieX + desfase * 0.5, -0.98, 0.22]}
              direccion={[Math.sin(angulo) * 0.38, 0, Math.cos(angulo)]}
              largo={largo}
              grosor={0.022}
              radioPunta={0.034}
            />
          </group>
        );
      })}
    </group>
  );
};

/** Cola dinámica con silueta fluida de gecko curvada hacia arriba */
const ColaGecko: React.FC = () => {
  const curvaCola = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, -0.42, -0.10),
        new THREE.Vector3(0.24, -0.56, -0.16),
        new THREE.Vector3(0.58, -0.44, -0.12),
        new THREE.Vector3(0.72, -0.12, -0.06),
        new THREE.Vector3(0.76, 0.26, 0.0),
        new THREE.Vector3(0.68, 0.62, 0.04),
        new THREE.Vector3(0.56, 0.78, 0.06),
      ]),
    [],
  );

  const geometria = useMemo(() => crearGeometriaCola(curvaCola), [curvaCola]);
  useEffect(() => () => geometria.dispose(), [geometria]);

  return (
    <group>
      <mesh geometry={geometria} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.14}
          sheenColor="#8a4ee0"
        />
      </mesh>
    </group>
  );
};

/** Modelo completo estático y fiel de Luki (Idéntico al render 3D oficial) */
const ModeloLuki: React.FC = () => {
  const texturaPiel = useMemo(crearTexturaPiel, []);

  useEffect(() => {
    return () => {
      texturaPiel.dispose();
    };
  }, [texturaPiel]);

  return (
    // Pose en tres cuartos dinámica con leve giro
    <group rotation={[0.02, -0.14, -0.02]}>
      {/* Cola de gecko en arco ascendente detrás del brazo derecho */}
      <ColaGecko />

      {/* Brazos flexionando bíceps con fuerza y orgullo */}
      <BrazoFlex lado={-1} />
      <BrazoFlex lado={1} />

      {/* Patas con postura ancha y dedos con ventosas planas */}
      <PiernaGecko lado={-1} />
      <PiernaGecko lado={1} />

      {/* Torso esbelto torneado en alta definición (128 sectores) */}
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <latheGeometry args={[PERFIL_TORSO, 128]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.78}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
          bumpMap={texturaPiel}
          bumpScale={0.003}
        />
      </mesh>

      {/* Barriga en lila mate continuo desde el pecho hasta abajo */}
      <mesh position={[0, 0.04, 0.22]} scale={[0.48, 0.80, 0.12]}>
        <capsuleGeometry args={[0.38, 0.44, 32, 64]} />
        <meshPhysicalMaterial
          color={LILA_BARRIGA}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.1}
          sheenColor="#b594f8"
          bumpMap={texturaPiel}
          bumpScale={0.002}
        />
      </mesh>

      {/* Cabeza ancha de gecko con ojos elevados e inclinación alegre */}
      <CabezaGecko texturaPiel={texturaPiel} />

      {/* Sombra de contacto suave en el suelo */}
      <mesh position={[0, -1.02, 0.08]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.72, 48]} />
        <meshBasicMaterial color="#1a0632" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** Componente principal de Luki en WebGL nativo de ultra-alta definición */
export const Luki: React.FC<LukiProps> = ({
  className = '',
  size = 160,
  estado = 'quieta',
  gesto = 'presume',
  alt = 'Luki, la mascota de LukApp',
}) => {
  return (
    <div
      className={`luki-3d ${className}`}
      style={{ '--tamano-luki': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={alt}
      data-gesto={gesto}
      data-estado={estado}
    >
      <Canvas
        camera={{ position: [0, 0.16, 5.8], fov: 32 }}
        dpr={[2, 3]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        shadows
      >
        {/* Iluminación de estudio suave difusa idéntica al render oficial */}
        <ambientLight intensity={1.1} color="#f6f0ff" />
        <hemisphereLight args={['#f8f2ff', '#1a0438', 0.85]} />
        <directionalLight position={[-2.2, 3.8, 4.2]} intensity={1.8} color="#fffbfa" castShadow />
        <directionalLight position={[3.2, 1.2, 2.2]} intensity={0.7} color="#d4c0fa" />
        <directionalLight position={[0.0, 3.2, -3.8]} intensity={1.3} color="#8a4bf5" />
        <ModeloLuki />
      </Canvas>
    </div>
  );
};
