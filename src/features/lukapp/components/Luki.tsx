import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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

/* Paleta de color mate oficial de Luki (Gecko violeta 3D según manual de marca) */
const MORADO_BASE = '#6d2ed0';
const MORADO_OSCURO = '#2c0b5c';
const LILA_BARRIGA = '#9f73eb';
const ROSA_LENGUA = '#d4468a';
const BOCA_FONDO = '#260624';
const OJO_BLANCO = '#faf8fc';
const PUPILA_NEGRA = '#100e16';

/** Perfil anatómico de ultra-alta resolución para el torso torneado con LatheGeometry (128 sectores) */
const PERFIL_TORSO = [
  new THREE.Vector2(0.10, -0.64),
  new THREE.Vector2(0.20, -0.58),
  new THREE.Vector2(0.29, -0.46),
  new THREE.Vector2(0.34, -0.30),
  new THREE.Vector2(0.36, -0.10),
  new THREE.Vector2(0.36, 0.10),
  new THREE.Vector2(0.33, 0.30),
  new THREE.Vector2(0.28, 0.50),
  new THREE.Vector2(0.23, 0.68),
  new THREE.Vector2(0.18, 0.84),
  new THREE.Vector2(0.14, 0.94),
];

/** Textura procedural mate muy sutil tipo arcilla / plastilina de estudio de animación */
const crearTexturaPiel = () => {
  const lado = 256;
  const datos = new Uint8Array(lado * lado);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const onda =
        Math.sin(x * 0.75 + y * 0.35) * 3 +
        Math.sin(y * 0.95 - x * 0.28) * 2 +
        Math.sin((x + y) * 1.3) * 1.5;
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

/** Genera la cola de gecko con ultra-alta densidad poligonal y disminución continua */
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
    // Disminución cónica perfectamente suave hacia la punta fina
    const radio = 0.004 + 0.22 * Math.pow(1 - t, 0.74);
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

/** Genera tubos con 48 tramos y 32 lados para extremidades sin ninguna arista visible */
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

/** Ojo de gecko tierno con acabado satinado suave (sin brillos plásticos excesivos) */
const OjoGecko: React.FC<{
  posicion: Punto3D;
  rotacionY?: number;
  rotacionZ?: number;
  seguirCursor: boolean;
  escala?: number;
  asustado?: boolean;
}> = ({ posicion, rotacionY = 0, rotacionZ = 0, seguirCursor, escala = 1, asustado = false }) => {
  const ojoRef = useRef<THREE.Group>(null);
  const pupilaRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const ciclo = clock.elapsedTime % 4.4;
    const parpadeo = ciclo > 4.12 && ciclo < 4.26;
    if (ojoRef.current) {
      ojoRef.current.scale.y = parpadeo ? 0.08 : escala * (asustado ? 1.25 : 1);
      ojoRef.current.scale.x = escala * (asustado ? 1.25 : 1);
      ojoRef.current.scale.z = escala * (asustado ? 1.25 : 1);
    }
    if (pupilaRef.current && seguirCursor) {
      pupilaRef.current.position.x = THREE.MathUtils.lerp(pupilaRef.current.position.x, pointer.x * 0.035, 0.12);
      pupilaRef.current.position.y = THREE.MathUtils.lerp(pupilaRef.current.position.y, pointer.y * 0.03, 0.12);
    }
  });

  return (
    <group ref={ojoRef} position={posicion} rotation={[0, rotacionY, rotacionZ]}>
      {/* Párpado y cuenca suave integrada en morado mate */}
      <mesh position={[0, -0.015, -0.02]} rotation={[-0.18, 0, 0]} scale={[1.12, 1.08, 1.1]} castShadow>
        <sphereGeometry args={[0.132, 48, 36, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
        />
      </mesh>

      {/* Globo ocular blanco satinado suave */}
      <mesh castShadow>
        <sphereGeometry args={[0.132, 64, 48]} />
        <meshPhysicalMaterial
          color={OJO_BLANCO}
          roughness={0.24}
          metalness={0.0}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
          emissive="#241a30"
          emissiveIntensity={0.015}
        />
      </mesh>

      {/* Pupila negra suave */}
      <mesh ref={pupilaRef} position={[0, 0, 0.126]} castShadow>
        <sphereGeometry args={[0.066, 48, 36]} />
        <meshPhysicalMaterial color={PUPILA_NEGRA} roughness={0.18} metalness={0.0} clearcoat={0.25} />
      </mesh>

      {/* Destello de luz suave */}
      <mesh position={[-0.024, 0.032, 0.174]}>
        <sphereGeometry args={[0.02, 24, 18]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Segundo destello menor */}
      <mesh position={[0.026, -0.02, 0.17]}>
        <sphereGeometry args={[0.01, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
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
          roughness={0.82}
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
          roughness={0.80}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.14}
          sheenColor="#8a4ee0"
        />
      </mesh>
    </group>
  );
};

/** Mano de gecko con 4 dedos abiertos y almohadillas redondeadas */
const ManoGecko: React.FC<{
  lado: -1 | 1;
  posicion: Punto3D;
  rotacion: Punto3D;
  gesto: GestoLuki;
}> = ({ lado, posicion, rotacion, gesto }) => {
  const esPresume = gesto === 'presume';
  const esSaluda = gesto === 'saluda' && lado === 1;

  return (
    <group position={posicion} rotation={[rotacion[0], rotacion[1], rotacion[2]]}>
      {/* Palma suave */}
      <mesh scale={[0.1, 0.08, 0.08]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
        />
      </mesh>

      {esPresume ? (
        /* Puño en flexión */
        [-0.04, -0.01, 0.02, 0.05].map((x, i) => (
          <mesh key={i} position={[x, 0.045, 0.04]} scale={[0.03, 0.036, 0.032]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <meshPhysicalMaterial color={MORADO_BASE} roughness={0.82} metalness={0.0} />
          </mesh>
        ))
      ) : (
        /* 4 dedos extendidos de gecko con almohadillas */
        <>
          <DedoGecko
            inicio={[-lado * 0.042, 0.02, 0.02]}
            direccion={[-lado * 0.55, 0.75, 0.25]}
            largo={esSaluda ? 0.095 : 0.075}
            grosor={0.022}
            radioPunta={0.032}
          />
          <DedoGecko
            inicio={[-lado * 0.016, 0.03, 0.03]}
            direccion={[-lado * 0.2, 0.95, 0.2]}
            largo={esSaluda ? 0.11 : 0.088}
            grosor={0.024}
            radioPunta={0.035}
          />
          <DedoGecko
            inicio={[lado * 0.016, 0.03, 0.03]}
            direccion={[lado * 0.2, 0.95, 0.2]}
            largo={gesto === 'idea' && lado === 1 ? 0.13 : esSaluda ? 0.11 : 0.088}
            grosor={0.024}
            radioPunta={0.035}
          />
          <DedoGecko
            inicio={[lado * 0.042, 0.01, 0.02]}
            direccion={[lado * 0.65, 0.65, 0.25]}
            largo={esSaluda ? 0.085 : 0.07}
            grosor={0.022}
            radioPunta={0.032}
          />
        </>
      )}
    </group>
  );
};

/** Brazo fluido continuo con poses según el gesto activo */
const BrazoGecko: React.FC<{
  lado: -1 | 1;
  gesto: GestoLuki;
  estado: EstadoLuki;
}> = ({ lado, gesto, estado }) => {
  const brazoRef = useRef<THREE.Group>(null);

  const puntosBrazo = useMemo(() => {
    if (gesto === 'presume') {
      return [
        new THREE.Vector3(lado * 0.24, 0.52, 0.02),
        new THREE.Vector3(lado * 0.54, 0.48, 0.06),
        new THREE.Vector3(lado * 0.60, 0.64, 0.1),
        new THREE.Vector3(lado * 0.50, 0.86, 0.14),
      ];
    }
    if (gesto === 'idea' && lado === 1) {
      return [
        new THREE.Vector3(lado * 0.24, 0.52, 0.02),
        new THREE.Vector3(lado * 0.48, 0.44, 0.08),
        new THREE.Vector3(lado * 0.52, 0.70, 0.16),
        new THREE.Vector3(lado * 0.42, 0.96, 0.24),
      ];
    }
    if (gesto === 'saluda' && lado === 1) {
      return [
        new THREE.Vector3(lado * 0.24, 0.52, 0.02),
        new THREE.Vector3(lado * 0.52, 0.66, 0.1),
        new THREE.Vector3(lado * 0.58, 0.90, 0.16),
        new THREE.Vector3(lado * 0.50, 1.12, 0.2),
      ];
    }
    if ((gesto === 'pensando' || estado === 'pensando') && lado === -1) {
      return [
        new THREE.Vector3(lado * 0.24, 0.52, 0.02),
        new THREE.Vector3(lado * 0.46, 0.42, 0.08),
        new THREE.Vector3(lado * 0.34, 0.66, 0.2),
        new THREE.Vector3(lado * 0.14, 0.82, 0.28),
      ];
    }
    // Pose por defecto / reposo / tres cuartos
    return [
      new THREE.Vector3(lado * 0.24, 0.52, 0.02),
      new THREE.Vector3(lado * (lado === -1 ? 0.46 : 0.40), 0.32, 0.08),
      new THREE.Vector3(lado * (lado === -1 ? 0.50 : 0.36), 0.12, 0.14),
      new THREE.Vector3(lado * (lado === -1 ? 0.42 : 0.26), 0.02, 0.18),
    ];
  }, [estado, gesto, lado]);

  const curva = useMemo(() => new THREE.CatmullRomCurve3(puntosBrazo), [puntosBrazo]);
  const geo = useMemo(() => crearGeometriaTubo(curva, 0.094, 0.074), [curva]);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ clock }) => {
    if (!brazoRef.current) return;
    if (gesto === 'saluda' && lado === 1) {
      brazoRef.current.rotation.z = Math.sin(clock.elapsedTime * 6.5) * 0.28;
    } else if (gesto === 'equilibrio') {
      brazoRef.current.rotation.z = lado * Math.sin(clock.elapsedTime * 3) * 0.2;
    } else {
      brazoRef.current.rotation.z = 0;
    }
  });

  const posMuneca = puntosBrazo[puntosBrazo.length - 1];

  return (
    <group ref={brazoRef}>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
        />
      </mesh>
      <ManoGecko
        lado={lado}
        posicion={[posMuneca.x, posMuneca.y, posMuneca.z]}
        rotacion={[gesto === 'presume' ? 0.3 : 0, 0, lado === 1 ? -0.2 : 0.2]}
        gesto={gesto}
      />
    </group>
  );
};

/** Pata continua de gecko con 4 dedos y ventosas planas sobre el suelo */
const PiernaGecko: React.FC<{ lado: -1 | 1 }> = ({ lado }) => {
  const caderaX = lado * 0.20;
  const rodillaX = lado * 0.32;
  const pieX = lado * 0.32;

  const puntosPierna = useMemo(
    () => [
      new THREE.Vector3(caderaX, -0.42, 0.0),
      new THREE.Vector3(rodillaX, -0.68, 0.06),
      new THREE.Vector3(pieX, -0.96, 0.14),
    ],
    [caderaX, pieX, rodillaX],
  );

  const curva = useMemo(() => new THREE.CatmullRomCurve3(puntosPierna), [puntosPierna]);
  const geo = useMemo(() => crearGeometriaTubo(curva, 0.125, 0.088), [curva]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
        />
      </mesh>

      {/* Empeine / Talón suave */}
      <mesh position={[pieX, -0.98, 0.20]} scale={[0.13, 0.045, 0.16]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
        />
      </mesh>

      {/* 4 dedos de la pata con ventosas circulares */}
      {[-0.072, -0.024, 0.024, 0.072].map((desfase, indice) => {
        const angulo = (indice - 1.5) * 0.26;
        const largo = 0.08 + Math.cos(angulo) * 0.02;
        return (
          <group key={desfase}>
            <DedoGecko
              inicio={[pieX + desfase * 0.5, -0.98, 0.22]}
              direccion={[Math.sin(angulo) * 0.35, 0, Math.cos(angulo)]}
              largo={largo}
              grosor={0.022}
              radioPunta={0.032}
            />
          </group>
        );
      })}
    </group>
  );
};

/** Cola dinámica con silueta fluida de gecko curvada hacia arriba */
const ColaGecko: React.FC<{ gesto: GestoLuki }> = ({ gesto }) => {
  const colaRef = useRef<THREE.Group>(null);

  const curvaCola = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, -0.46, -0.12),
        new THREE.Vector3(0.18, -0.54, -0.28),
        new THREE.Vector3(0.48, -0.50, -0.34),
        new THREE.Vector3(0.76, -0.26, -0.32),
        new THREE.Vector3(0.90, 0.10, -0.26),
        new THREE.Vector3(0.92, 0.48, -0.18),
        new THREE.Vector3(0.82, 0.82, -0.12),
        new THREE.Vector3(0.70, 0.98, -0.08),
      ]),
    [],
  );

  const geometria = useMemo(() => crearGeometriaCola(curvaCola), [curvaCola]);
  useEffect(() => () => geometria.dispose(), [geometria]);

  useFrame(({ clock }) => {
    if (!colaRef.current) return;
    const intensidad = gesto === 'equilibrio' ? 0.32 : gesto === 'mareada' ? 0.26 : 0.08;
    colaRef.current.rotation.z = Math.sin(clock.elapsedTime * (gesto === 'mareada' ? 5.2 : 2.1)) * intensidad;
    colaRef.current.rotation.y = Math.cos(clock.elapsedTime * 1.7) * (intensidad * 0.6);
  });

  return (
    <group ref={colaRef}>
      <mesh geometry={geometria} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.14}
          sheenColor="#8a4ee0"
          emissive={MORADO_OSCURO}
          emissiveIntensity={0.03}
        />
      </mesh>
    </group>
  );
};

/** Cabeza de gecko esculpida con bóveda craneal, hocico achatado, ojos elevados y sonrisa viva */
const CabezaGecko: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
  texturaPiel: THREE.DataTexture;
}> = ({ estado, gesto, mirarCursor, texturaPiel }) => {
  const cabezaRef = useRef<THREE.Group>(null);

  useFrame(({ pointer }) => {
    if (!cabezaRef.current || !mirarCursor) return;
    cabezaRef.current.rotation.y = THREE.MathUtils.lerp(cabezaRef.current.rotation.y, pointer.x * 0.16, 0.08);
    cabezaRef.current.rotation.x = THREE.MathUtils.lerp(cabezaRef.current.rotation.x, -pointer.y * 0.10, 0.08);
  });

  const bocaAbierta = estado === 'contenta' || estado === 'sorprendida' || gesto === 'idea' || gesto === 'saluda';
  const asustado = estado === 'sorprendida';

  // Sonrisa trazada curvando hacia arriba
  const curvaSonrisa = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.32, -0.04, 0.12),
        new THREE.Vector3(-0.24, -0.08, 0.30),
        new THREE.Vector3(0.0, -0.09, 0.40),
        new THREE.Vector3(0.24, -0.08, 0.30),
        new THREE.Vector3(0.32, -0.04, 0.12),
      ]),
    [],
  );

  return (
    <group ref={cabezaRef} position={[0, 0.94, 0.08]} rotation={[0.04, 0, 0]}>
      {/* Bóveda craneal suave de alta resolución */}
      <mesh scale={[1.05, 0.68, 0.88]} castShadow>
        <sphereGeometry args={[0.38, 64, 48]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
          bumpMap={texturaPiel}
          bumpScale={0.003}
        />
      </mesh>

      {/* Hocico alargado y redondeado hacia el frente */}
      <mesh position={[0, -0.05, 0.24]} scale={[0.84, 0.38, 0.92]} castShadow>
        <sphereGeometry args={[0.36, 64, 48]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
          bumpMap={texturaPiel}
          bumpScale={0.003}
        />
      </mesh>

      {/* Fosas nasales en la punta del hocico */}
      <mesh position={[-0.046, 0.02, 0.54]}>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>
      <mesh position={[0.046, 0.02, 0.54]}>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>

      {/* Ojos elevados en cuencas superiores de la cabeza */}
      <OjoGecko
        posicion={[-0.14, 0.18, 0.12]}
        rotacionY={-0.16}
        rotacionZ={0.08}
        seguirCursor={mirarCursor}
        escala={1}
        asustado={asustado}
      />
      <OjoGecko
        posicion={[0.14, 0.18, 0.12]}
        rotacionY={0.16}
        rotacionZ={-0.08}
        seguirCursor={mirarCursor}
        escala={1}
        asustado={asustado}
      />

      {/* Expresión de boca */}
      {bocaAbierta ? (
        <group position={[0, -0.06, 0.30]}>
          <mesh scale={[0.42, asustado ? 0.32 : 0.22, 0.32]}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color={BOCA_FONDO} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.08, 0.04]} scale={[0.22, 0.07, 0.20]}>
            <sphereGeometry args={[1, 24, 18]} />
            <meshPhysicalMaterial color={ROSA_LENGUA} roughness={0.4} clearcoat={0.1} />
          </mesh>
        </group>
      ) : (
        <mesh>
          <tubeGeometry args={[curvaSonrisa, 48, 0.015, 12, false]} />
          <meshPhysicalMaterial color={MORADO_OSCURO} roughness={0.7} />
        </mesh>
      )}
    </group>
  );
};

/** Modelo completo orgánico y armónico de Luki */
const ModeloLuki: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
}> = ({ estado, gesto, mirarCursor }) => {
  const lukiRef = useRef<THREE.Group>(null);
  const texturaPiel = useMemo(crearTexturaPiel, []);

  useEffect(() => {
    return () => {
      texturaPiel.dispose();
    };
  }, [texturaPiel]);

  useFrame(({ clock }) => {
    if (!lukiRef.current) return;
    const respirar = Math.sin(clock.elapsedTime * 2.2) * 0.012;
    lukiRef.current.scale.set(1 + respirar * 0.25, 1 + respirar, 1 + respirar * 0.25);
    lukiRef.current.position.y =
      -0.06 + (estado === 'contenta' ? Math.abs(Math.sin(clock.elapsedTime * 5.4)) * 0.06 : 0);
  });

  return (
    <group ref={lukiRef} rotation={[0.02, -0.16, -0.02]}>
      {/* Cola fluida de gecko curvada hacia arriba */}
      <ColaGecko gesto={gesto} />

      {/* Brazos orgánicos continuos */}
      <BrazoGecko lado={-1} gesto={gesto} estado={estado} />
      <BrazoGecko lado={1} gesto={gesto} estado={estado} />

      {/* Patas con ventosas de succión planas */}
      <PiernaGecko lado={-1} />
      <PiernaGecko lado={1} />

      {/* Torso torneado con LatheGeometry (128 sectores de ultra-alta resolución) */}
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <latheGeometry args={[PERFIL_TORSO, 128]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.82}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.12}
          sheenColor="#8a4ee0"
          bumpMap={texturaPiel}
          bumpScale={0.003}
        />
      </mesh>

      {/* Barriga en lila mate suave ajustada al torso */}
      <mesh position={[0, 0.06, 0.23]} scale={[0.42, 0.74, 0.10]}>
        <capsuleGeometry args={[0.42, 0.44, 32, 64]} />
        <meshPhysicalMaterial
          color={LILA_BARRIGA}
          roughness={0.85}
          metalness={0.0}
          clearcoat={0.0}
          sheen={0.1}
          sheenColor="#b594f8"
          bumpMap={texturaPiel}
          bumpScale={0.002}
        />
      </mesh>

      {/* Cabeza de gecko esculpida con ojos, hocico y boca */}
      <CabezaGecko
        estado={estado}
        gesto={gesto}
        mirarCursor={mirarCursor}
        texturaPiel={texturaPiel}
      />

      {/* Sombra de contacto suave en el suelo */}
      <mesh position={[0, -1.02, 0.08]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.72, 48]} />
        <meshBasicMaterial color="#220a3b" transparent opacity={0.14} depthWrite={false} />
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
    const acciones: readonly GestoLuki[] = ['saluda', 'idea', 'presume', 'equilibrio', 'mareada'];
    let indice = 0;
    const intervalo = window.setInterval(() => {
      setGestoTemporal(acciones[indice % acciones.length]);
      indice += 1;
      window.setTimeout(() => setGestoTemporal(null), 1800);
    }, 7000);
    return () => window.clearInterval(intervalo);
  }, [autoAnimar]);

  const celebrar = () => {
    if (!reaccionaAlTocar) return;
    setEstadoTemporal('contenta');
    setGestoTemporal('saluda');
    window.setTimeout(() => {
      setEstadoTemporal(null);
      setGestoTemporal(null);
    }, 1000);
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
        camera={{ position: [0, 0.26, 6.2], fov: 31 }}
        dpr={[2, 3]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        shadows
        onClick={celebrar}
      >
        {/* Iluminación de estudio suave y difusa (acabado arcilla mate sin brillos agresivos) */}
        <ambientLight intensity={0.95} color="#f6f0ff" />
        <hemisphereLight args={['#f8f2ff', '#220644', 0.8]} />
        <directionalLight position={[-2.5, 3.5, 4.5]} intensity={1.6} color="#fffbfa" castShadow />
        <directionalLight position={[3.0, 1.0, 2.0]} intensity={0.7} color="#d6c5fa" />
        <directionalLight position={[0.0, 3.0, -4.0]} intensity={1.2} color="#8b4df5" />
        <ModeloLuki estado={estadoVisible} gesto={gestoVisible} mirarCursor={mirarCursor} />
      </Canvas>
    </div>
  );
};
