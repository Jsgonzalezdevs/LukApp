import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  CreditCard,
  MessageCircle,
  User
} from 'lucide-react';
import { parseTransaction } from '../../lib/parseTransaction';
import { CATALOGO_BASE } from '../../categorias';
import { formatCop } from '../../lib/formatCop';
import { Reveal } from './primitivas';

const EJEMPLOS = [
  'gasté 45k en pizza',
  'uber a casa 12k ayer',
  'mercado en el éxito 180 mil',
  'le presté 50 lucas a Andrés',
  'me pagaron 2 millones',
  'netflix 38900'
];

const NOMBRE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta débito',
  transferencia: 'Transferencia'
};

/** "2026-08-19" -> "19 de agosto", que es como se lee una fecha en la app. */
const diaLegible = (iso: string): string => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long'
  });
};

export const DemoParser: React.FC = () => {
  const [texto, setTexto] = useState(EJEMPLOS[0]);
  const quieto = useReducedMotion();

  /* El mismo parseTransaction que corre dentro de la app. La landing no simula
     el resultado: lo calcula, así que lo que el visitante ve aquí es
     exactamente lo que va a pasar cuando escriba eso mismo adentro. */
  const leido = useMemo(() => parseTransaction(texto), [texto]);
  const categoria = CATALOGO_BASE.de(leido.category);

  const nombreCategoriaDinamico = useMemo(() => {
    const desc = (leido.description || '').toLowerCase();
    if (
      desc.includes('perro') ||
      desc.includes('gato') ||
      desc.includes('mascota') ||
      desc.includes('veterin') ||
      desc.includes('purina') ||
      desc.includes('whiskas') ||
      desc.includes('concentrado')
    ) {
      return 'Mascotas';
    }
    return categoria.nombre;
  }, [leido.description, categoria.nombre]);

  const insignias = [
    leido.dateOverride && {
      clave: 'fecha',
      Icono: Calendar,
      texto: diaLegible(leido.dateOverride)
    },
    leido.signals.paymentMethod !== 'desconocido' && {
      clave: 'pago',
      Icono: CreditCard,
      texto: NOMBRE_PAGO[leido.signals.paymentMethod] ?? leido.signals.paymentMethod
    },
    leido.signals.destinatario && {
      clave: 'quien',
      Icono: User,
      texto: leido.signals.destinatario
    }
  ].filter(Boolean) as { clave: string; Icono: typeof Calendar; texto: string }[];

  return (
    <section className="demo-parser" id="demo">
      <Reveal as="header" className="seccion-cabecera">
        <span className="seccion-etiqueta">Pruébalo aquí mismo</span>
        <h2>
          Dilo a tu manera.
          <span className="demo-titulo-acento"> LukApp lo deja claro.</span>
        </h2>
        <p className="seccion-sub">
          Prueba una frase o escribe la tuya. No está pregrabado: es el mismo
          motor que organiza tus movimientos dentro de la app.
        </p>
      </Reveal>

      <Reveal className="demo-caja" delay={0.1}>
        <div className="demo-entrada">
          <div className="demo-panel-cabecera">
            <span className="demo-paso"><b>01</b> Tú lo cuentas</span>
            <span className="demo-motor"><i aria-hidden /> Motor real</span>
          </div>

          <label className="demo-campo">
            <span className="demo-campo-etiqueta">Escribe como hablas</span>
            <span className="demo-campo-linea">
              <MessageCircle size={19} strokeWidth={1.75} aria-hidden />
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="gasté 30 mil en almuerzo"
                aria-label="Escribe un gasto en lenguaje natural"
                spellCheck={false}
              />
            </span>
          </label>

          <div className="demo-ejemplos">
            <span className="demo-ejemplos-titulo">O prueba otra forma de decirlo</span>
            <div className="demo-ejemplos-lista">
              {EJEMPLOS.map((frase, indice) => (
                <button
                  key={frase}
                  type="button"
                  className={`demo-chip ${frase === texto ? 'activo' : ''}`}
                  onClick={() => setTexto(frase)}
                  aria-pressed={frase === texto}
                >
                  <span>{String(indice + 1).padStart(2, '0')}</span>
                  {frase}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="demo-puente" aria-hidden>
          <span className="demo-puente-linea" />
          <span className="demo-puente-icono">
            <ArrowRight size={20} strokeWidth={1.8} />
          </span>
          <span className="demo-puente-texto">entiende</span>
        </div>

        <div className="demo-salida">
          <div className="demo-panel-cabecera">
            <span className="demo-paso"><b>02</b> LukApp lo ordena</span>
            {leido.amount !== null && (
              <span className="demo-confianza-texto">
                {Math.round(leido.confidence * 100)}% claro
              </span>
            )}
          </div>

          <div className="demo-resultado" aria-live="polite">
            {leido.amount === null ? (
              <p className="demo-vacio">
                Escribe un monto como «30 mil», «45k» o «50 lucas» y LukApp
                arma el movimiento aquí.
              </p>
            ) : (
              <>
                <div className="demo-fila">
                  <span className={`demo-icono ${leido.kind}`} aria-hidden="true">
                    {leido.kind === 'ingreso'
                      ? <ArrowUpRight size={22} strokeWidth={2} />
                      : <ArrowDownRight size={22} strokeWidth={2} />}
                  </span>

                  {/* Descripción, categoría y monto se pintan sin transición de
                      salida a propósito. Con una, el nodo viejo sigue montado
                      mientras el nuevo entra, y durante ese rato la tarjeta
                      enseña el monto de la frase anterior junto a la categoría de
                      la nueva — se lee como un error de cálculo. */}
                  <div className="demo-texto">
                    <span className="demo-categoria">{nombreCategoriaDinamico}</span>
                    <span className="demo-desc">{leido.description || 'Movimiento'}</span>
                  </div>

                  <span className={`demo-monto ${leido.kind}`}>
                    {leido.kind === 'ingreso' ? '+' : '−'}
                    {formatCop(leido.amount)}
                  </span>
                </div>

                {insignias.length > 0 && (
                  <div className="demo-insignias">
                    <AnimatePresence initial={false}>
                      {insignias.map(({ clave, Icono: Ins, texto: t }) => (
                        <motion.span
                          key={clave}
                          className="demo-insignia"
                          initial={quieto ? false : { opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={quieto ? undefined : { opacity: 0, y: 5 }}
                          transition={{ duration: 0.18 }}
                        >
                          <Ins size={13} strokeWidth={2} aria-hidden />
                          {t}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                <div className="demo-confianza">
                  <div className="demo-barra" aria-hidden="true">
                    <motion.span
                      className="demo-barra-lleno"
                      animate={{ width: `${Math.round(leido.confidence * 100)}%` }}
                      transition={{ duration: quieto ? 0 : 0.4, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="demo-listo">
                    <Check size={14} strokeWidth={2.2} aria-hidden />
                    Listo para confirmar
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
};
