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

/* Paleta oficial de Luki (Gecko violeta de LukApp según manual de referencia) */
const MORADO_BASE = '#7435d8';
const MORADO_CLARO = '#8c4ff5';
const MORADO_OSCURO = '#38146e';
const LILA_BARRIGA = '#9e6feb';
const ROSA_LENGUA = '#c94388';
const BOCA_OSCURA = '#2e0e2e';
const OJO_BLANCO = '#ffffff';
const PUPILA_NEGRA = '#0e0c14';

/** Textura procedural de piel tipo arcilla/vinilo con microporos para dar acabado Pixar/3D */
const crearTexturaPiel = () => {
  const lado = 128;
  const datos = new Uint8Array(lado * lado);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const onda =
        Math.sin(x * 0.92 + y * 0.45) * 6 +
        Math.sin(y * 1.15 - x * 0.38) * 5 +
        Math.sin((x + y) * 1.8) * 3;
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

/** Genera la cola de gecko con curvatura dinámica hacia arriba y adelgazamiento cónico continuo */
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
    // Adelgazamiento suave desde la base gruesa del cuerpo hasta la punta afilada
    const radio = 0.006 + 0.22 * Math.pow(1 - t, 0.72);
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

/** Segmento cónico suave para extremidades y articulaciones */
const SegmentoCilindro: React.FC<{
  inicio: Punto3D;
  final: Punto3D;
  radioInicio: number;
  radioFinal: number;
  color?: string;
  materialPiel?: THREE.Material;
}> = ({ inicio, final, radioInicio, radioFinal, color = MORADO_BASE }) => {
  const config = useMemo(() => {
    const medio = new THREE.Vector3(...inicio).add(new THREE.Vector3(...final)).multiplyScalar(0.5);
    return { medio, giro: orientacionEntre(inicio, final), largo: distancia(inicio, final) };
  }, [inicio, final]);

  return (
    <mesh position={config.medio} quaternion={config.giro} castShadow receiveShadow>
      <cylinderGeometry args={[radioFinal, radioInicio, config.largo, 20]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.42}
        metalness={0.01}
        clearcoat={0.16}
        clearcoatRoughness={0.48}
        sheen={0.3}
        sheenColor={MORADO_CLARO}
      />
    </mesh>
  );
};

/** Ojo de gecko 3D montado sobre la bóveda craneal con párpado integrado y pupila reactiva */
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
    const ciclo = clock.elapsedTime % 4.3;
    const parpadeo = ciclo > 4.02 && ciclo < 4.16;
    if (ojoRef.current) {
      ojoRef.current.scale.y = parpadeo ? 0.1 : escala * (asustado ? 1.25 : 1);
      ojoRef.current.scale.x = escala * (asustado ? 1.25 : 1);
      ojoRef.current.scale.z = escala * (asustado ? 1.25 : 1);
    }
    if (pupilaRef.current && seguirCursor) {
      pupilaRef.current.position.x = THREE.MathUtils.lerp(pupilaRef.current.position.x, pointer.x * 0.04, 0.12);
      pupilaRef.current.position.y = THREE.MathUtils.lerp(pupilaRef.current.position.y, pointer.y * 0.035, 0.12);
    }
  });

  return (
    <group ref={ojoRef} position={posicion} rotation={[0, rotacionY, rotacionZ]}>
      {/* Cuenca / Reborde de párpado inferior y posterior en morado */}
      <mesh position={[0, -0.02, -0.03]} rotation={[-0.25, 0, 0]} scale={[1.16, 1.1, 1.12]} castShadow>
        <sphereGeometry args={[0.138, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
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
        <sphereGeometry args={[0.138, 32, 24]} />
        <meshPhysicalMaterial
          color={OJO_BLANCO}
          roughness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.04}
          emissive="#2d2238"
          emissiveIntensity={0.03}
        />
      </mesh>

      {/* Pupila negra redonda */}
      <mesh ref={pupilaRef} position={[0, 0, 0.132]} castShadow>
        <sphereGeometry args={[0.064, 28, 20]} />
        <meshPhysicalMaterial color={PUPILA_NEGRA} roughness={0.04} clearcoat={1} clearcoatRoughness={0.02} />
      </mesh>

      {/* Destello de luz principal */}
      <mesh position={[-0.026, 0.032, 0.18]}>
        <sphereGeometry args={[0.022, 12, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Segundo destello menor */}
      <mesh position={[0.028, -0.022, 0.176]}>
        <sphereGeometry args={[0.011, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

/** Cabeza de gecko alargada y aplanada con hocico redondeado, ojos elevados y boca expresiva */
const CabezaGecko: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
  texturaPiel: THREE.DataTexture;
}> = ({ estado, gesto, mirarCursor, texturaPiel }) => {
  const cabezaRef = useRef<THREE.Group>(null);

  useFrame(({ pointer }) => {
    if (!cabezaRef.current || !mirarCursor) return;
    cabezaRef.current.rotation.y = THREE.MathUtils.lerp(cabezaRef.current.rotation.y, pointer.x * 0.18, 0.08);
    cabezaRef.current.rotation.x = THREE.MathUtils.lerp(cabezaRef.current.rotation.x, -pointer.y * 0.12, 0.08);
  });

  const bocaAbierta = estado === 'contenta' || estado === 'sorprendida' || gesto === 'idea' || gesto === 'saluda';
  const asustado = estado === 'sorprendida';

  // Curva de la sonrisa en reposo/contenta
  const curvaSonrisa = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.36, 0.02, 0.08),
        new THREE.Vector3(-0.28, -0.05, 0.32),
        new THREE.Vector3(0.0, -0.07, 0.44),
        new THREE.Vector3(0.28, -0.05, 0.32),
        new THREE.Vector3(0.36, 0.02, 0.08),
      ]),
    [],
  );

  return (
    <group ref={cabezaRef} position={[0, 0.96, 0.06]} rotation={[0.04, 0, 0]}>
      {/* Bóveda craneal posterior */}
      <mesh scale={[0.92, 0.58, 0.78]} castShadow>
        <sphereGeometry args={[0.44, 32, 24]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          metalness={0.01}
          clearcoat={0.18}
          clearcoatRoughness={0.48}
          sheen={0.35}
          sheenColor={MORADO_CLARO}
          bumpMap={texturaPiel}
          bumpScale={0.01}
        />
      </mesh>

      {/* Hocico alargado y aplanado hacia el frente (característico de gecko) */}
      <mesh position={[0, -0.04, 0.26]} scale={[0.84, 0.36, 0.92]} castShadow>
        <sphereGeometry args={[0.42, 32, 24]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          clearcoat={0.18}
          sheen={0.35}
          sheenColor={MORADO_CLARO}
          bumpMap={texturaPiel}
          bumpScale={0.01}
        />
      </mesh>

      {/* Mandíbula inferior suave */}
      <mesh position={[0, -0.12, 0.22]} scale={[0.76, 0.26, 0.82]} castShadow>
        <sphereGeometry args={[0.38, 28, 20]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.44}
          clearcoat={0.16}
          sheen={0.3}
          sheenColor={MORADO_CLARO}
        />
      </mesh>

      {/* Fosas nasales sutiles en la punta del hocico */}
      <mesh position={[-0.055, 0.02, 0.6]}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>
      <mesh position={[0.055, 0.02, 0.6]}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshBasicMaterial color={MORADO_OSCURO} />
      </mesh>

      {/* Ojos de gecko elevados en la parte superior-frontal de la cabeza */}
      <OjoGecko
        posicion={[-0.155, 0.22, 0.12]}
        rotacionY={-0.18}
        rotacionZ={0.08}
        seguirCursor={mirarCursor}
        escala={1}
        asustado={asustado}
      />
      <OjoGecko
        posicion={[0.155, 0.22, 0.12]}
        rotacionY={0.18}
        rotacionZ={-0.08}
        seguirCursor={mirarCursor}
        escala={1}
        asustado={asustado}
      />

      {/* Expresión de boca: abierta o sonrisa trazada */}
      {bocaAbierta ? (
        <group position={[0, -0.06, 0.32]}>
          {/* Cavidad bucal profunda */}
          <mesh scale={[0.46, asustado ? 0.36 : 0.24, 0.36]} position={[0, 0, 0]}>
            <sphereGeometry args={[1, 24, 18]} />
            <meshStandardMaterial color={BOCA_OSCURA} roughness={0.4} />
          </mesh>
          {/* Lengua rosada linda */}
          <mesh position={[0, -0.09, 0.06]} scale={[0.24, 0.08, 0.22]}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshPhysicalMaterial color={ROSA_LENGUA} roughness={0.25} clearcoat={0.5} />
          </mesh>
        </group>
      ) : (
        <mesh>
          <tubeGeometry args={[curvaSonrisa, 32, 0.016, 8, false]} />
          <meshPhysicalMaterial color={MORADO_OSCURO} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
};

/** Dedo de gecko con almohadilla de succión redondeada en la punta */
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

  return (
    <group>
      <SegmentoCilindro
        inicio={inicio}
        final={fin}
        radioInicio={grosor}
        radioFinal={grosor * 0.85}
        color={color}
      />
      {/* Almohadilla esférica característica en la punta del dedo */}
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
      {/* Palma aplanada */}
      <mesh scale={[0.11, 0.08, 0.09]} castShadow>
        <sphereGeometry args={[1, 20, 16]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} clearcoat={0.15} />
      </mesh>

      {esPresume ? (
        /* Puño cerrado en flexión */
        [-0.04, -0.01, 0.02, 0.05].map((x, i) => (
          <mesh key={i} position={[x, 0.05, 0.04]} scale={[0.032, 0.038, 0.034]} castShadow>
            <sphereGeometry args={[1, 12, 10]} />
            <meshPhysicalMaterial color={MORADO_BASE} roughness={0.4} />
          </mesh>
        ))
      ) : (
        /* 4 dedos extendidos de gecko con almohadillas */
        <>
          {/* Dedo meñique */}
          <DedoGecko
            inicio={[-lado * 0.045, 0.02, 0.02]}
            direccion={[-lado * 0.55, 0.75, 0.25]}
            largo={esSaluda ? 0.095 : 0.075}
            grosor={0.024}
            radioPunta={0.034}
          />
          {/* Dedo anular */}
          <DedoGecko
            inicio={[-lado * 0.018, 0.03, 0.03]}
            direccion={[-lado * 0.2, 0.95, 0.2]}
            largo={esSaluda ? 0.11 : 0.088}
            grosor={0.025}
            radioPunta={0.036}
          />
          {/* Dedo medio/índice */}
          <DedoGecko
            inicio={[lado * 0.018, 0.03, 0.03]}
            direccion={[lado * 0.2, 0.95, 0.2]}
            largo={gesto === 'idea' && lado === 1 ? 0.13 : esSaluda ? 0.11 : 0.088}
            grosor={0.025}
            radioPunta={0.036}
          />
          {/* Dedo pulgar */}
          <DedoGecko
            inicio={[lado * 0.045, 0.01, 0.02]}
            direccion={[lado * 0.65, 0.65, 0.25]}
            largo={esSaluda ? 0.085 : 0.07}
            grosor={0.024}
            radioPunta={0.033}
          />
        </>
      )}
    </group>
  );
};

/** Brazo continuo de gecko con articulación en curva suave y poses según gesto */
const BrazoGecko: React.FC<{
  lado: -1 | 1;
  gesto: GestoLuki;
  estado: EstadoLuki;
}> = ({ lado, gesto, estado }) => {
  const brazoRef = useRef<THREE.Group>(null);

  // Configuración de la curva del brazo según el gesto o estado activo
  const puntosBrazo = useMemo(() => {
    if (gesto === 'presume') {
      // Pose de flexionar bíceps (como la referencia en esquina superior)
      return [
        new THREE.Vector3(lado * 0.26, 0.56, 0.0),
        new THREE.Vector3(lado * 0.58, 0.52, 0.06),
        new THREE.Vector3(lado * 0.64, 0.66, 0.1),
        new THREE.Vector3(lado * 0.52, 0.88, 0.14),
      ];
    }
    if (gesto === 'idea' && lado === 1) {
      // Brazo derecho señalando hacia arriba con el dedo
      return [
        new THREE.Vector3(lado * 0.26, 0.56, 0.0),
        new THREE.Vector3(lado * 0.52, 0.44, 0.08),
        new THREE.Vector3(lado * 0.56, 0.72, 0.16),
        new THREE.Vector3(lado * 0.44, 0.98, 0.24),
      ];
    }
    if (gesto === 'saluda' && lado === 1) {
      // Brazo derecho saludando arriba
      return [
        new THREE.Vector3(lado * 0.26, 0.56, 0.0),
        new THREE.Vector3(lado * 0.56, 0.68, 0.1),
        new THREE.Vector3(lado * 0.62, 0.92, 0.16),
        new THREE.Vector3(lado * 0.54, 1.14, 0.2),
      ];
    }
    if ((gesto === 'pensando' || estado === 'pensando') && lado === -1) {
      // Mano izquierda tocando el mentón
      return [
        new THREE.Vector3(lado * 0.26, 0.56, 0.0),
        new THREE.Vector3(lado * 0.48, 0.42, 0.08),
        new THREE.Vector3(lado * 0.36, 0.68, 0.2),
        new THREE.Vector3(lado * 0.14, 0.82, 0.28),
      ];
    }
    // Pose por defecto / reposo / tres cuartos
    return [
      new THREE.Vector3(lado * 0.26, 0.56, 0.0),
      new THREE.Vector3(lado * (lado === -1 ? 0.48 : 0.42), 0.32, 0.08),
      new THREE.Vector3(lado * (lado === -1 ? 0.52 : 0.38), 0.12, 0.14),
      new THREE.Vector3(lado * (lado === -1 ? 0.44 : 0.28), 0.02, 0.18),
    ];
  }, [estado, gesto, lado]);

  const curva = useMemo(() => new THREE.CatmullRomCurve3(puntosBrazo), [puntosBrazo]);

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
      {/* Hombro suave */}
      <mesh position={[puntosBrazo[0].x, puntosBrazo[0].y, puntosBrazo[0].z]} scale={[0.13, 0.13, 0.13]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} />
      </mesh>

      {/* Tubo continuo del brazo */}
      <mesh castShadow>
        <tubeGeometry args={[curva, 28, 0.092, 14, false]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          metalness={0.01}
          clearcoat={0.16}
          sheen={0.3}
          sheenColor={MORADO_CLARO}
        />
      </mesh>

      {/* Mano de gecko colocada en la muñeca */}
      <ManoGecko
        lado={lado}
        posicion={[posMuneca.x, posMuneca.y, posMuneca.z]}
        rotacion={[gesto === 'presume' ? 0.3 : 0, 0, lado === 1 ? -0.2 : 0.2]}
        gesto={gesto}
      />
    </group>
  );
};

/** Pata de gecko con 4 dedos extendidos y almohadillas redondeadas pegadas al piso */
const PiernaGecko: React.FC<{
  lado: -1 | 1;
}> = ({ lado }) => {
  const caderaX = lado * 0.2;
  const rodillaX = lado * 0.34;
  const pieX = lado * 0.34;

  return (
    <group>
      {/* Articulación de cadera */}
      <mesh position={[caderaX, -0.44, 0.0]} scale={[0.14, 0.14, 0.14]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} />
      </mesh>

      {/* Muslo */}
      <SegmentoCilindro
        inicio={[caderaX, -0.44, 0.0]}
        final={[rodillaX, -0.7, 0.06]}
        radioInicio={0.13}
        radioFinal={0.105}
      />

      {/* Rodilla */}
      <mesh position={[rodillaX, -0.7, 0.06]} scale={[0.11, 0.11, 0.11]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} />
      </mesh>

      {/* Pantorrilla */}
      <SegmentoCilindro
        inicio={[rodillaX, -0.7, 0.06]}
        final={[pieX, -0.96, 0.14]}
        radioInicio={0.105}
        radioFinal={0.088}
      />

      {/* Empeine / Talón del pie */}
      <mesh position={[pieX, -0.98, 0.22]} scale={[0.14, 0.05, 0.18]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
        <meshPhysicalMaterial color={MORADO_BASE} roughness={0.42} />
      </mesh>

      {/* 4 dedos de la pata con almohadillas circulares planas sobre el suelo */}
      {[-0.075, -0.025, 0.025, 0.075].map((desfase, indice) => {
        const angulo = (indice - 1.5) * 0.28;
        const largo = 0.08 + Math.cos(angulo) * 0.02;
        const xFin = pieX + desfase + Math.sin(angulo) * 0.03;
        const zFin = 0.32 + Math.cos(angulo) * largo;
        return (
          <group key={desfase}>
            {/* Tallo del dedo */}
            <SegmentoCilindro
              inicio={[pieX + desfase * 0.6, -0.98, 0.24]}
              final={[xFin, -0.99, zFin]}
              radioInicio={0.026}
              radioFinal={0.022}
            />
            {/* Almohadilla redonda de succión */}
            <mesh position={[xFin, -0.99, zFin]} scale={[1, 0.6, 1]} castShadow>
              <sphereGeometry args={[0.034, 14, 10]} />
              <meshPhysicalMaterial
                color={MORADO_BASE}
                roughness={0.42}
                clearcoat={0.15}
                sheen={0.3}
                sheenColor={MORADO_CLARO}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/** Cola dinámica con silueta de gecko curvada hacia arriba */
const ColaGecko: React.FC<{ gesto: GestoLuki }> = ({ gesto }) => {
  const colaRef = useRef<THREE.Group>(null);

  // Puntos de la curva de la cola que se arquea hacia arriba y a la derecha
  const curvaCola = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, -0.48, -0.16),
        new THREE.Vector3(0.18, -0.56, -0.32),
        new THREE.Vector3(0.48, -0.52, -0.38),
        new THREE.Vector3(0.78, -0.28, -0.36),
        new THREE.Vector3(0.92, 0.08, -0.3),
        new THREE.Vector3(0.94, 0.48, -0.22),
        new THREE.Vector3(0.84, 0.82, -0.15),
        new THREE.Vector3(0.72, 0.98, -0.1),
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

/** Cuerpo completo de Luki con cuello fluido, barriga lila continua y articulaciones */
const ModeloLuki: React.FC<{
  estado: EstadoLuki;
  gesto: GestoLuki;
  mirarCursor: boolean;
}> = ({ estado, gesto, mirarCursor }) => {
  const lukiRef = useRef<THREE.Group>(null);
  const texturaPiel = useMemo(crearTexturaPiel, []);
  useEffect(() => () => texturaPiel.dispose(), [texturaPiel]);

  useFrame(({ clock }) => {
    if (!lukiRef.current) return;
    const respirar = Math.sin(clock.elapsedTime * 2.2) * 0.014;
    lukiRef.current.scale.set(1 + respirar * 0.3, 1 + respirar, 1 + respirar * 0.3);
    lukiRef.current.position.y =
      -0.08 + (estado === 'contenta' ? Math.abs(Math.sin(clock.elapsedTime * 5.4)) * 0.06 : 0);
  });

  return (
    <group ref={lukiRef} rotation={[0.02, -0.18, -0.02]}>
      {/* Cola de gecko hacia arriba */}
      <ColaGecko gesto={gesto} />

      {/* Brazos izquierdo y derecho con manos de 4 dedos */}
      <BrazoGecko lado={-1} gesto={gesto} estado={estado} />
      <BrazoGecko lado={1} gesto={gesto} estado={estado} />

      {/* Patas con 4 dedos y ventosas planas sobre el piso */}
      <PiernaGecko lado={-1} />
      <PiernaGecko lado={1} />

      {/* Cuello orgánico que conecta fluidamente el torso con la cabeza */}
      <mesh position={[0, 0.72, 0.04]} scale={[0.42, 0.34, 0.4]} castShadow>
        <capsuleGeometry args={[0.34, 0.36, 10, 20]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          clearcoat={0.16}
          sheen={0.32}
          sheenColor={MORADO_CLARO}
        />
      </mesh>

      {/* Torso / Pecho esbelto de lagartija */}
      <mesh position={[0, 0.22, 0.02]} scale={[0.54, 0.72, 0.5]} castShadow receiveShadow>
        <sphereGeometry args={[0.56, 32, 24]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          metalness={0.01}
          clearcoat={0.16}
          clearcoatRoughness={0.48}
          sheen={0.35}
          sheenColor={MORADO_CLARO}
          bumpMap={texturaPiel}
          bumpScale={0.01}
        />
      </mesh>

      {/* Pelvis / Cadera inferior continua */}
      <mesh position={[0, -0.32, -0.02]} scale={[0.48, 0.52, 0.44]} castShadow receiveShadow>
        <sphereGeometry args={[0.52, 28, 20]} />
        <meshPhysicalMaterial
          color={MORADO_BASE}
          roughness={0.42}
          clearcoat={0.16}
          sheen={0.32}
          sheenColor={MORADO_CLARO}
        />
      </mesh>

      {/* Parche de barriga lila suave desde la garganta hasta la entrepierna */}
      <mesh position={[0, 0.16, 0.25]} scale={[0.38, 0.76, 0.08]}>
        <capsuleGeometry args={[0.48, 0.48, 12, 20]} />
        <meshPhysicalMaterial
          color={LILA_BARRIGA}
          roughness={0.46}
          clearcoat={0.1}
          sheen={0.25}
          sheenColor="#c9b0f8"
          bumpMap={texturaPiel}
          bumpScale={0.006}
        />
      </mesh>

      {/* Sombra de contacto en el suelo */}
      <mesh position={[0, -1.02, 0.08]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color="#220a3b" transparent opacity={0.14} depthWrite={false} />
      </mesh>

      {/* Cabeza de gecko completa */}
      <CabezaGecko
        estado={estado}
        gesto={gesto}
        mirarCursor={mirarCursor}
        texturaPiel={texturaPiel}
      />
    </group>
  );
};

/** Componente principal de Luki en WebGL nativo */
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
        camera={{ position: [0, 0.28, 6.2], fov: 31 }}
        dpr={[1.5, 2]}
        gl={{ alpha: true, antialias: true }}
        shadows
        onClick={celebrar}
      >
        {/* Iluminación de estudio estilo Pixar */}
        <ambientLight intensity={0.55} color="#f5eeff" />
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
