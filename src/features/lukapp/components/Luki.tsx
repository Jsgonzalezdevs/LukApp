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

/* Paleta oficial de Luki (Gecko violeta de LukApp según manual de marca) */
const MORADO_BASE = '#7332db';
const MORADO_CLARO = '#8c4ff5';
const MORADO_OSCURO = '#341066';
const LILA_BARRIGA = '#a77ef0';
const ROSA_LENGUA = '#d94b8e';
const BOCA_OSCURA = '#2a0c28';
const OJO_BLANCO = '#ffffff';
const PUPILA_NEGRA = '#0c0a12';

/** Textura procedural de piel tipo arcilla/vinilo para dar suavidad y calidez orgánica */
const crearTexturaPiel = () => {
  const lado = 128;
  const datos = new Uint8Array(lado * lado);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const onda =
        Math.sin(x * 0.9 + y * 0.45) * 5 +
        Math.sin(y * 1.1 - x * 0.35) * 4 +
        Math.sin((x + y) * 1.6) * 2;
      datos[y * lado + x] = Math.round(128 + onda);
    }
  }
  const textura = new THREE.DataTexture(datos, lado, lado, THREE.RedFormat);
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(6, 8);
  textura.needsUpdate = true;
  return textura;
};

/**
 * Genera la geometría continua y orgánica del cuerpo y la cabeza en UNA SOLA MALLA.
 * Elimina completamente los cortes, esferas sueltas y costuras rígidas.
 */
const crearGeometriaCuerpoYCabeza = () => {
  // Curva de la columna vertebral desde la pelvis hasta la punta del hocico
  const puntosEspina = [
    new THREE.Vector3(0, -0.62, -0.04), // 0.00: Base pelvis
    new THREE.Vector3(0, -0.46, -0.01), // 0.12: Caderas
    new THREE.Vector3(0, -0.22, 0.03),  // 0.28: Cintura
    new THREE.Vector3(0, 0.10, 0.05),   // 0.46: Pecho
    new THREE.Vector3(0, 0.42, 0.03),   // 0.62: Hombros
    new THREE.Vector3(0, 0.68, 0.02),   // 0.74: Cuello fluido
    new THREE.Vector3(0, 0.88, 0.06),   // 0.84: Base del cráneo
    new THREE.Vector3(0, 1.00, 0.18),   // 0.91: Bóveda superior
    new THREE.Vector3(0, 0.96, 0.36),   // 0.96: Hocico medio
    new THREE.Vector3(0, 0.90, 0.50),   // 1.00: Punta del hocico
  ];
  const curva = new THREE.CatmullRomCurve3(puntosEspina, false, 'catmullrom', 0.5);

  const tramos = 80;
  const lados = 36;
  const marcos = curva.computeFrenetFrames(tramos, false);

  const posiciones: number[] = [];
  const normales: number[] = [];
  const colores: number[] = [];
  const indices: number[] = [];

  const centro = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  const colorBase = new THREE.Color(MORADO_BASE);
  const colorBelly = new THREE.Color(LILA_BARRIGA);

  // Perfil anatómico continuo en cada sección t (0 a 1)
  const obtenerPerfil = (t: number) => {
    let rx = 0.2;
    let ry = 0.2;
    let zOff = 0;

    if (t < 0.12) {
      // Cierre inferior redondeado de la pelvis
      const k = Math.sin((t / 0.12) * (Math.PI / 2));
      rx = 0.32 * k;
      ry = 0.28 * k;
    } else if (t < 0.32) {
      // Pelvis a vientre bajo
      const f = (t - 0.12) / 0.2;
      rx = THREE.MathUtils.lerp(0.32, 0.36, f);
      ry = THREE.MathUtils.lerp(0.28, 0.34, f);
      zOff = f * 0.03;
    } else if (t < 0.56) {
      // Vientre a pecho
      const f = (t - 0.32) / 0.24;
      rx = THREE.MathUtils.lerp(0.36, 0.31, f);
      ry = THREE.MathUtils.lerp(0.34, 0.28, f);
      zOff = 0.03 + (1 - f) * 0.02;
    } else if (t < 0.72) {
      // Pecho a cuello esbelto continuo
      const f = (t - 0.56) / 0.16;
      rx = THREE.MathUtils.lerp(0.31, 0.21, f);
      ry = THREE.MathUtils.lerp(0.28, 0.21, f);
    } else if (t < 0.86) {
      // Cuello a cráneo
      const f = (t - 0.72) / 0.14;
      rx = THREE.MathUtils.lerp(0.21, 0.36, f);
      ry = THREE.MathUtils.lerp(0.21, 0.24, f);
      zOff = f * 0.04;
    } else if (t < 0.96) {
      // Cráneo a hocico alargado y aplanado
      const f = (t - 0.86) / 0.1;
      rx = THREE.MathUtils.lerp(0.36, 0.26, f);
      ry = THREE.MathUtils.lerp(0.24, 0.14, f);
      zOff = 0.04;
    } else {
      // Cierre suave de la punta del hocico
      const f = (t - 0.96) / 0.04;
      const k = Math.cos(f * (Math.PI / 2));
      rx = 0.26 * k;
      ry = 0.14 * k;
    }

    return { rx, ry, zOff };
  };

  for (let tramo = 0; tramo <= tramos; tramo += 1) {
    const t = tramo / tramos;
    curva.getPointAt(t, centro);
    const { rx, ry, zOff } = obtenerPerfil(t);

    for (let lado = 0; lado <= lados; lado += 1) {
      const angulo = (lado / lados) * Math.PI * 2;
      const cosA = Math.cos(angulo);
      const sinA = Math.sin(angulo);

      normal.copy(marcos.normals[tramo]).multiplyScalar(cosA * rx);
      binormal.copy(marcos.binormals[tramo]).multiplyScalar(sinA * ry);

      const vx = centro.x + normal.x + binormal.x;
      const vy = centro.y + normal.y + binormal.y;
      const vz = centro.z + normal.z + binormal.z + zOff * sinA;

      posiciones.push(vx, vy, vz);

      // Normales iniciales
      const nx = cosA;
      const ny = sinA;
      const nz = 0;
      normales.push(nx, ny, nz);

      // Gradiente suave de la barriga lila en el frente (sin cortes ni stickers)
      if (t >= 0.12 && t <= 0.72) {
        const frontFactor = Math.max(0, sinA); // +Z es el frente
        if (frontFactor > 0.32) {
          const blend = Math.pow((frontFactor - 0.32) / 0.68, 1.2);
          const c = colorBase.clone().lerp(colorBelly, blend);
          colores.push(c.r, c.g, c.b);
        } else {
          colores.push(colorBase.r, colorBase.g, colorBase.b);
        }
      } else {
        colores.push(colorBase.r, colorBase.g, colorBase.b);
      }
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
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  geometria.computeVertexNormals();
  return geometria;
};

/** Genera la cola de gecko con curvatura continua y punta afilada */
const crearGeometriaCola = (curva: THREE.CatmullRomCurve3) => {
  const tramos = 64;
  const lados = 24;
  const marcos = curva.computeFrenetFrames(tramos, false);
  const posiciones: number[] = [];
  const indices: number[] = [];
  const centro = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let tramo = 0; tramo <= tramos; tramo += 1) {
    const t = tramo / tramos;
    curva.getPointAt(t, centro);
    // Disminución cónica suave desde la base gruesa hasta la punta
    const radio = 0.005 + 0.22 * Math.pow(1 - t, 0.72);
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

/** Genera extremidades orgánicas continuas (sin cortes cilíndricos) */
const crearGeometriaTuboExtremidad = (
  curva: THREE.CatmullRomCurve3,
  radioBase: number,
  radioPunta: number,
) => {
  const tramos = 24;
  const lados = 16;
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

/** Ojo tierno y expresivo de gecko con cuenca integrada y brillo vivo */
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
      pupilaRef.current.position.x = THREE.MathUtils.lerp(pupilaRef.current.position.x, pointer.x * 0.038, 0.12);
      pupilaRef.current.position.y = THREE.MathUtils.lerp(pupilaRef.current.position.y, pointer.y * 0.032, 0.12);
    }
  });

  return (
    <group ref={ojoRef} position={posicion} rotation={[0, rotacionY, rotacionZ]}>
      {/* Cuenca y párpado suave posterior */}
      <mesh position={[0, -0.02, -0.02]} rotation={[-0.2, 0, 0]} scale={[1.14, 1.08, 1.1]} castShadow>
        <sphereGeometry args={[0.136, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.44}
          clearcoat={0.15}
          sheen={0.3}
          sheenColor={MORADO_CLARO}
        />
      </mesh>

      {/* Globo ocular blanco brillante */}
      <mesh castShadow>
        <sphereGeometry args={[0.136, 32, 24]} />
        <meshPhysicalMaterial
          color={OJO_BLANCO}
          roughness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.04}
          emissive="#2d2238"
          emissiveIntensity={0.02}
        />
      </mesh>

      {/* Pupila grande expresiva */}
      <mesh ref={pupilaRef} position={[0, 0, 0.13]} castShadow>
        <sphereGeometry args={[0.068, 28, 20]} />
        <meshPhysicalMaterial color={PUPILA_NEGRA} roughness={0.04} clearcoat={1} clearcoatRoughness={0.02} />
      </mesh>

      {/* Brillo especular principal */}
      <mesh position={[-0.025, 0.034, 0.178]}>
        <sphereGeometry args={[0.022, 12, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Segundo brillo especular pequeño */}
      <mesh position={[0.028, -0.022, 0.174]}>
        <sphereGeometry args={[0.011, 10, 8]} />
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
  const geo = useMemo(() => crearGeometriaTuboExtremidad(curva, grosor, grosor * 0.8), [curva, grosor]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={color}
          roughness={0.42}
          clearcoat={0.16}
          sheen={0.3}
          sheenColor={MORADO_CLARO}
        />
      </mesh>
      {/* Almohadilla de succión esférica */}
      <mesh position={fin} scale={[1, 1, 1]} castShadow>
        <sphereGeometry args={[radioPunta, 16, 12]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.4}
          clearcoat={0.2}
          sheen={0.35}
          sheenColor={MORADO_CLARO}
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
        <sphereGeometry args={[1, 20, 16]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} clearcoat={0.15} />
      </mesh>

      {esPresume ? (
        /* Puño en flexión */
        [-0.04, -0.01, 0.02, 0.05].map((x, i) => (
          <mesh key={i} position={[x, 0.045, 0.04]} scale={[0.03, 0.036, 0.032]} castShadow>
            <sphereGeometry args={[1, 12, 10]} />
            <meshPhysicalMaterial color={MORADO_BASE} roughness={0.4} />
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

/** Brazo fluido con tubo continuo (sin esferas de corte) */
const BrazoGecko: React.FC<{
  lado: -1 | 1;
  gesto: GestoLuki;
  estado: EstadoLuki;
}> = ({ lado, gesto, estado }) => {
  const brazoRef = useRef<THREE.Group>(null);

  const puntosBrazo = useMemo(() => {
    if (gesto === 'presume') {
      return [
        new THREE.Vector3(lado * 0.24, 0.54, 0.02),
        new THREE.Vector3(lado * 0.54, 0.50, 0.06),
        new THREE.Vector3(lado * 0.60, 0.64, 0.1),
        new THREE.Vector3(lado * 0.50, 0.86, 0.14),
      ];
    }
    if (gesto === 'idea' && lado === 1) {
      return [
        new THREE.Vector3(lado * 0.24, 0.54, 0.02),
        new THREE.Vector3(lado * 0.48, 0.44, 0.08),
        new THREE.Vector3(lado * 0.52, 0.70, 0.16),
        new THREE.Vector3(lado * 0.42, 0.96, 0.24),
      ];
    }
    if (gesto === 'saluda' && lado === 1) {
      return [
        new THREE.Vector3(lado * 0.24, 0.54, 0.02),
        new THREE.Vector3(lado * 0.52, 0.66, 0.1),
        new THREE.Vector3(lado * 0.58, 0.90, 0.16),
        new THREE.Vector3(lado * 0.50, 1.12, 0.2),
      ];
    }
    if ((gesto === 'pensando' || estado === 'pensando') && lado === -1) {
      return [
        new THREE.Vector3(lado * 0.24, 0.54, 0.02),
        new THREE.Vector3(lado * 0.46, 0.42, 0.08),
        new THREE.Vector3(lado * 0.34, 0.66, 0.2),
        new THREE.Vector3(lado * 0.14, 0.82, 0.28),
      ];
    }
    return [
      new THREE.Vector3(lado * 0.24, 0.54, 0.02),
      new THREE.Vector3(lado * (lado === -1 ? 0.46 : 0.40), 0.32, 0.08),
      new THREE.Vector3(lado * (lado === -1 ? 0.50 : 0.36), 0.12, 0.14),
      new THREE.Vector3(lado * (lado === -1 ? 0.42 : 0.26), 0.02, 0.18),
    ];
  }, [estado, gesto, lado]);

  const curva = useMemo(() => new THREE.CatmullRomCurve3(puntosBrazo), [puntosBrazo]);
  const geo = useMemo(() => crearGeometriaTuboExtremidad(curva, 0.096, 0.076), [curva]);
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
          roughness={0.42}
          metalness={0.01}
          clearcoat={0.16}
          sheen={0.3}
          sheenColor={MORADO_CLARO}
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

/** Pata fluida continua con 4 dedos y almohadillas planas */
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
  const geo = useMemo(() => crearGeometriaTuboExtremidad(curva, 0.125, 0.088), [curva]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          metalness={0.01}
          clearcoat={0.16}
          sheen={0.3}
          sheenColor={MORADO_CLARO}
        />
      </mesh>

      {/* Empeine / Talón suave */}
      <mesh position={[pieX, -0.98, 0.20]} scale={[0.13, 0.045, 0.16]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} />
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

/** Cola dinámica con silueta curvada hacia arriba */
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
          roughness={0.42}
          metalness={0.01}
          clearcoat={0.16}
          clearcoatRoughness={0.48}
          sheen={0.35}
          sheenColor={MORADO_CLARO}
          emissive={MORADO_OSCURO}
          emissiveIntensity={0.06}
        />
      </mesh>
    </group>
  );
};

/** Cara y detalles del hocico (ojos, fosas nasales y boca) */
const RasgosFaciales: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
}> = ({ estado, gesto, mirarCursor }) => {
  const bocaAbierta = estado === 'contenta' || estado === 'sorprendida' || gesto === 'idea' || gesto === 'saluda';
  const asustado = estado === 'sorprendida';

  // Sonrisa trazada a lo largo del contorno del hocico
  const curvaSonrisa = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.28, 0.90, 0.28),
        new THREE.Vector3(-0.20, 0.86, 0.44),
        new THREE.Vector3(0.0, 0.85, 0.51),
        new THREE.Vector3(0.20, 0.86, 0.44),
        new THREE.Vector3(0.28, 0.90, 0.28),
      ]),
    [],
  );

  return (
    <group>
      {/* Ojos elevados en la parte superior del cráneo */}
      <OjoGecko
        posicion={[-0.145, 1.10, 0.20]}
        rotacionY={-0.16}
        rotacionZ={0.08}
        seguirCursor={mirarCursor}
        escala={1}
        asustado={asustado}
      />
      <OjoGecko
        posicion={[0.145, 1.10, 0.20]}
        rotacionY={0.16}
        rotacionZ={-0.08}
        seguirCursor={mirarCursor}
        escala={1}
        asustado={asustado}
      />

      {/* Fosas nasales en la punta del hocico */}
      <mesh position={[-0.048, 0.93, 0.51]}>
        <sphereGeometry args={[0.012, 10, 8]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>
      <mesh position={[0.048, 0.93, 0.51]}>
        <sphereGeometry args={[0.012, 10, 8]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>

      {/* Expresión de boca */}
      {bocaAbierta ? (
        <group position={[0, 0.86, 0.40]}>
          <mesh scale={[0.38, asustado ? 0.30 : 0.20, 0.28]}>
            <sphereGeometry args={[1, 24, 18]} />
            <meshStandardMaterial color={BOCA_OSCURA} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.07, 0.04]} scale={[0.20, 0.07, 0.18]}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshPhysicalMaterial color={ROSA_LENGUA} roughness={0.25} clearcoat={0.5} />
          </mesh>
        </group>
      ) : (
        <mesh>
          <tubeGeometry args={[curvaSonrisa, 32, 0.015, 8, false]} />
          <meshPhysicalMaterial color={MORADO_OSCURO} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
};

/** Modelo completo orgánico y suave de Luki */
const ModeloLuki: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
}> = ({ estado, gesto, mirarCursor }) => {
  const lukiRef = useRef<THREE.Group>(null);
  const cabezaRef = useRef<THREE.Group>(null);
  const texturaPiel = useMemo(crearTexturaPiel, []);
  const geoCuerpo = useMemo(crearGeometriaCuerpoYCabeza, []);

  useEffect(() => {
    return () => {
      texturaPiel.dispose();
      geoCuerpo.dispose();
    };
  }, [geoCuerpo, texturaPiel]);

  useFrame(({ clock, pointer }) => {
    if (!lukiRef.current) return;
    const respirar = Math.sin(clock.elapsedTime * 2.2) * 0.012;
    lukiRef.current.scale.set(1 + respirar * 0.25, 1 + respirar, 1 + respirar * 0.25);
    lukiRef.current.position.y =
      -0.06 + (estado === 'contenta' ? Math.abs(Math.sin(clock.elapsedTime * 5.4)) * 0.06 : 0);

    if (cabezaRef.current && mirarCursor) {
      cabezaRef.current.rotation.y = THREE.MathUtils.lerp(cabezaRef.current.rotation.y, pointer.x * 0.15, 0.08);
      cabezaRef.current.rotation.x = THREE.MathUtils.lerp(cabezaRef.current.rotation.x, -pointer.y * 0.10, 0.08);
    }
  });

  return (
    <group ref={lukiRef} rotation={[0.02, -0.16, -0.02]}>
      {/* Cola fluida de gecko curvada hacia arriba */}
      <ColaGecko gesto={gesto} />

      {/* Brazos orgánicos sin juntas de bola */}
      <BrazoGecko lado={-1} gesto={gesto} estado={estado} />
      <BrazoGecko lado={1} gesto={gesto} estado={estado} />

      {/* Patas con ventosas de succión planas */}
      <PiernaGecko lado={-1} />
      <PiernaGecko lado={1} />

      {/* Malla unificada y suave de Cuerpo, Cuello y Cabeza */}
      <mesh geometry={geoCuerpo} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.44}
          metalness={0.01}
          clearcoat={0.16}
          clearcoatRoughness={0.46}
          sheen={0.34}
          sheenColor={MORADO_CLARO}
          bumpMap={texturaPiel}
          bumpScale={0.008}
        />
      </mesh>

      {/* Rasgos faciales, ojos elevados y boca en la cabeza */}
      <group ref={cabezaRef}>
        <RasgosFaciales estado={estado} gesto={gesto} mirarCursor={mirarCursor} />
      </group>

      {/* Sombra de contacto suave en el suelo */}
      <mesh position={[0, -1.02, 0.08]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color="#220a3b" transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** Componente principal de Luki */
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
        dpr={[1.5, 2]}
        gl={{ alpha: true, antialias: true }}
        shadows
        onClick={celebrar}
      >
        {/* Iluminación de estudio estilo Pixar */}
        <ambientLight intensity={0.58} color="#f5eeff" />
        <hemisphereLight args={['#f6edff', '#28084a', 0.95]} />
        <directionalLight position={[-2.8, 4.2, 4.8]} intensity={3.0} color="#fff8ff" castShadow />
        <directionalLight position={[3.6, 1.2, 2.4]} intensity={0.8} color="#cbb0ff" />
        <directionalLight position={[0.0, 3.6, -4.5]} intensity={2.8} color="#8c4ff5" />
        <pointLight position={[-1.2, -0.4, 3.2]} intensity={0.45} color="#ffffff" />
        <ModeloLuki estado={estadoVisible} gesto={gestoVisible} mirarCursor={mirarCursor} />
      </Canvas>
    </div>
  );
};
