import React, { useEffect, useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { BrandWordmark } from './BrandWordmark';
import { apiUrl } from '../../../lib/api';

interface Props { onVolver: () => void; }
const FECHA = '16 de septiembre de 2026';
const Seccion: React.FC<{ id: string; titulo: string; children: React.ReactNode }> = ({ id, titulo, children }) => <section id={id} className="scroll-mt-20 border-t border-[var(--fin-line)] py-9 first:border-t-0 first:pt-0"><h2 className="text-xl font-black tracking-tight text-[var(--fin-ink)] sm:text-2xl">{titulo}</h2><div className="mt-4 space-y-4 text-sm leading-7 text-[var(--fin-ink-soft)]">{children}</div></section>;
const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => <h3 className="pt-2 text-base font-bold text-[var(--fin-ink)]">{children}</h3>;
const ListaOrdenada: React.FC<{ children: React.ReactNode }> = ({ children }) => <ol className="list-decimal space-y-3 pl-5 marker:font-bold marker:text-[var(--fin-ink)]">{children}</ol>;
const ListaVineta: React.FC<{ children: React.ReactNode }> = ({ children }) => <ul className="mt-3 list-disc space-y-2 pl-5">{children}</ul>;
const Correo: React.FC = () => <a className="font-semibold text-[var(--fin-accent)] underline underline-offset-2" href="mailto:jsgonzalezdevs@gmail.com"><code>jsgonzalezdevs@gmail.com</code></a>;

export const TerminosCondiciones: React.FC = () => <>
  <p>Bienvenido a Lukapp. Al acceder, aceptar los Terminos y Condiciones y utilizar nuestra plataforma, usted se allana a estar sujeto a los mismos. Si no está de acuerdo, le solicitamos manifestarlo al iniciar la app.</p>

  <p><strong className="text-[var(--fin-ink)]">Última actualización: 16 de septiembre de 2026</strong></p>

  <p>La presente documentacion la <strong className="text-[var(--fin-ink)]">relación jurídica</strong> entre los Usuarios (en adelante, el &quot;Usuario&quot;) y el Operador, (en adelante, &quot;LukApp&quot;), debidamente Identificado como JULIÁN SANTIAGO GONZÁLEZ REINA, persona natural identificada con NIT No. 1.104.547.389-6, quien actúa como creador, titular, representante de la junta directiva y desarrollador de la pagina web, aplicación web progresiva (PWA), SAAS denominada <strong className="text-[var(--fin-ink)]">LukApp</strong>.</p>
  <p>Para cualquier efecto legal, consulta, petición o reclamo relativo al uso de la plataforma o al tratamiento de datos personales, el canal de contacto oficial sera:</p>
  <p><strong className="text-[var(--fin-ink)]">Canal de Atención, Soporte y PQR:</strong> <Correo /></p>

  <p>LukApp es una herramienta de organización de finanzas personales orientada a Colombia. Permite registrar movimientos, presupuestos, metas, obligaciones, gastos compartidos y proyecciones. Algunas funciones pueden usar transcripciones de voz, procesamiento automatizado o un asesor basado en inteligencia artificial.</p>

  <Sub>ARTICULO PRIMERO: DEFINICIONES</Sub>
  <p>Para la correcta interpretación de este instrumento normativo, se fijan de manera las siguientes definiciones:</p>

  <p><strong className="text-[var(--fin-ink)]">LukApp / SAAS:</strong> Conjunto de código fuente, código objeto, software, interfaces, bases de datos, algoritmos, marcas, logos y funcionalidades accesibles mediante sitio web, o aplicación web progresiva (PWA).</p>

  <p><strong className="text-[var(--fin-ink)]">Usuario:</strong> Persona natural mayor de edad que accede, se registra, crea una cuenta o interactúa con las funcionalidades de LukApp.</p>

  <p><strong className="text-[var(--fin-ink)]">Servicio:</strong> Herramienta tecnológica de software como servicio (SaaS) destinada a la organización, registro personal, categorización y proyección de finanzas personales.</p>

  <p><strong className="text-[var(--fin-ink)]">Asesor IA:</strong> Módulo interactivo de soporte basado en modelos de procesamiento de lenguaje natural e inteligencia artificial integrada a través de interfaces de programación de aplicaciones (API).</p>

  <p><strong className="text-[var(--fin-ink)]">Mensaje de Datos:</strong> La información generada, enviada, recibida, almacenada o comunicada por medios electrónicos, ópticos o similares, en los términos de la Ley 527 de 1999.</p>

  <p><strong className="text-[var(--fin-ink)]">Credenciales de Acceso:</strong> Datos de autenticación (correo electrónico, contraseñas, tokens o validación mediante proveedores de autenticación de terceros como Supabase) que permiten el acceso exclusivo del Usuario.</p>

  <p><strong className="text-[var(--fin-ink)]">Aplicación Web Progresiva (PWA):</strong> Plataforma de software y canal de distribución de contenido de propiedad de Lukapp, desarrollada bajo estándares web estándar y accesible a través de navegadores de internet. Para efectos del presente documento, la PWA actúa como un sitio web optimizado que permite la funcionalidad interactiva, la instalación de un acceso directo en el dispositivo terminal del Usuario (sin mediación de tiendas de aplicaciones de terceros), y la ejecución de procesos técnicos automatizados de almacenamiento local de datos (caching) en dicho dispositivo, con el fin de permitir su operatividad parcial o total sin conexión activa a internet</p>

  <Sub>ARTICULO SEGUNDO: ACEPTACIÓN, CAPACIDAD LEGAL Y PERFECCIONAMIENTO DEL CONTRATO.</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Perfeccionamiento:</strong> El presente contrato se perfecciona mediante la manifestación del consentimiento libre, expreso e informado del Usuario a través del mecanismo electrónico de aceptación por clic (<em>Click-Wrap Agreement</em>), al momento de registrar una cuenta o usar cualquier funcionalidad de LukApp, produciendo plenos efectos jurídicos de conformidad con la Ley 527 de 1999.</li>
    <li><strong className="text-[var(--fin-ink)]">Capacidad:</strong> El Usuario declara ser mayor de dieciocho (18) años y gozar de plena capacidad legal para contratar según el Código Civil Colombiano.</li>
  </ListaOrdenada>

  <Sub>ARTICULO TERCERO: NATURALEZA JURÍDICA Y DELIMITACIÓN EXPRESA DEL SERVICIO.</Sub>

  <p>El Usuario acepta y reconoce de manera expresa, taxativa e irrevocable que:</p>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">No Intermediación Financiera:</strong> LukApp <strong className="text-[var(--fin-ink)]">NO</strong> es una entidad financiera, establecimiento de crédito, compañía de financiamiento, sociedad comisionista de bolsa, entidad aseguradora, operador de sistemas de pago, ni sociedad de depósito, en los términos del Estatuto Orgánico del Sistema Financiero de Colombia (Decreto 663 de 1993).</li>
    <li><strong className="text-[var(--fin-ink)]">No Custodia ni Captación:</strong> LukApp <strong className="text-[var(--fin-ink)]">NO</strong> capta, custodia, administra, transfiere, invierte ni maneja dinero, divisas, criptoactivos ni títulos valores del Usuario o de terceros.</li>
    <li><strong className="text-[var(--fin-ink)]">Inexistencia de Asesoría Profesional:</strong> Los cálculos, estimaciones, alertas, gráficos, proyecciones y respuestas emitidas por el Asesor IA o por la herramienta son meramente ilustrativos, automatizados e informativos. <strong className="text-[var(--fin-ink)]">NO</strong> constituyen ni sustituyen la asesoría financiera, contable, tributaria, bursátil ni jurídica prestada por un profesional autorizado por las autoridades competentes.</li>
    <li><strong className="text-[var(--fin-ink)]">Exclusión de la Ley 1266 de 2008:</strong> LukApp <strong className="text-[var(--fin-ink)]">NO</strong> actúa como operador, fuente ni usuario de información financiera o crediticia dentro del sistema de centrales de riesgo. La información ingresada por el Usuario es de carácter privado y personal, y se maneja de acuerdo con la <strong className="text-[var(--fin-ink)]">LEY ESTATUTARIA 1581 DE 2012 de HÁBEAS DATA</strong> y no se reporta a ningún banco de datos de solvencia patrimonial o crediticia.</li>
  </ListaOrdenada>

  <Sub>ARTICULO CUARTO: OBLIGACIONES Y CUENTA DEL USUARIO.</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Registro:</strong> El Usuario es responsable de proporcionar información exacta, veraz, actualizada y completa al momento del registro.</li>
    <li><strong className="text-[var(--fin-ink)]">Custodia de Credenciales:</strong> La seguridad y confidencialidad de las contraseñas, cuentas asociadas o claves de acceso recae de forma exclusiva sobre el Usuario. Cualquier acceso o transacción realizada con sus credenciales se presumirá efectuada directamente por él.</li>
    <li><strong className="text-[var(--fin-ink)]">Equivalencia a Firma Electrónica:</strong> En virtud de la Ley 527 de 1999 y el Decreto 1074 de 2015, los mecanismos de autenticación utilizados para ingresar a LukApp (incluyendo validaciones por correo, <em>OAuth</em> o biometría de dispositivo) constituyen una <strong className="text-[var(--fin-ink)]">Firma Electrónica</strong>.</li>
    <li><strong className="text-[var(--fin-ink)]">Notificación de Incidentes:</strong> El Usuario se obliga a notificar de forma inmediata al Operador a través del correo de soporte sobre cualquier uso no autorizado o vulneración de su cuenta.</li>
  </ListaOrdenada>

  <Sub>ARTICULO QUINTO: PROHIBICIONES TAXATIVAS Y USO ACEPTABLE</Sub>

  <p>Queda estrictamente prohibido al Usuario realizar cualquiera de las siguientes conductas, cuya comisión facultará al Operador para suspender o cancelar la cuenta de forma inmediata, y tomar las acciones legales pertinentes:</p>

  <ListaOrdenada>
    <li>Uso de la Plataforma para fines ilícitos, fraudulentos, de lavado de activos, financiación del terrorismo o contrarios a la buena fe contractual.</li>
    <li>Efectuar ingeniería inversa, descompilar, desmontar, copiar, traducir, modificar o intentar extraer el código fuente, algoritmos o estructura de LukApp.</li>
    <li>Utilizar dispositivos automatizados, <em>robots</em>, <em>spiders</em>, <em>scrapers</em> o herramientas de extracción masiva de datos (<em>data mining</em>) para acceder a la Plataforma.</li>
    <li>Ingresar intencionalmente virus, (troyanos, gusanos, bombas lógicas) o cualquier material tecnológicamente dañino.</li>
    <li>Suplantar la identidad de terceros o ingresar datos financieros de personas respecto de las cuales no posea autorización legal o contractual expresa.</li>
    <li>Saturar, colapsar o realizar ataques de denegación de servicio (<em>DoS/DDoS</em>) contra la infraestructura de la Plataforma o sus proveedores tecnológicos (ej. Supabase, APIs de IA).</li>
  </ListaOrdenada>

  <Sub>ARTICULO SEXTO: FUNCIONALIDADES DE INTELIGENCIA ARTIFICIAL Y RECONOCIMIENTO DE VOZ</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Naturaleza Probabilística:</strong> El Usuario reconoce que el Asesor IA opera mediante algoritmos probabilísticos y modelos generativos de lenguaje. Por tanto, las respuestas pueden ser imprecisas, incompletas, desactualizadas o erróneas (<em>alucinaciones de IA</em>).</li>
    <li><strong className="text-[var(--fin-ink)]">Obligación de Verificación:</strong> El Usuario asume el deber implícito de verificar y contrastar cualquier proyección o respuesta proporcionada por el Asesor IA antes de tomar cualquier decisión económica, endeudarse o realizar compras.</li>
    <li><strong className="text-[var(--fin-ink)]">Procesamiento de Voz:</strong> La funcionalidad de voz requiere la activación previa del micrófono del dispositivo por parte del Usuario. El Usuario declara conocer que el audio procesado para transcripción es enviado a proveedores externos (<em>APIs</em> de procesamiento), absteniéndose de transmitir audio que contenga datos de terceros sin autorización.</li>
  </ListaOrdenada>

  <Sub>ARTICULO SEPTIMO: PROPIEDAD INTELECTUAL Y LICENCIA DE USO</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Titularidad:</strong> LukApp, sus marcas, lemas comerciales, marcas de servicio, código fuente, código objeto, diseño de interfaz (<em>UI/UX</em>), textos, bases de datos y arquitectura de software son de propiedad exclusiva de LukApp, a traves de su representante <strong className="text-[var(--fin-ink)]">JULIÁN SANTIAGO GONZÁLEZ REINA</strong>, y la Junta directiva. protegidos por la Ley 23 de 1982, y demás normas de Propiedad Intelectual.</li>
    <li><strong className="text-[var(--fin-ink)]">Licencia Limitada:</strong> El Operador otorga al Usuario una licencia de uso personal, limitada, no exclusiva, revocable, intransferible y no sublicenciable, únicamente para acceder y utilizar la Plataforma conforme a estos Términos.</li>
    <li><strong className="text-[var(--fin-ink)]">Titularidad de los Datos Financieros:</strong> El Usuario conservará en todo momento la titularidad de los datos personales y registros financieros que ingrese en la herramienta.</li>
  </ListaOrdenada>

  <Sub>ARTICULO OCTAVO: RÉGIMEN DE RESPONSABILIDAD Y LIMITACIONES</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Garantía de Servicio:</strong> El Operador adoptará las medidas técnicas razonables para garantizar la disponibilidad, seguridad y correcto funcionamiento de LukApp.</li>
    <li><strong className="text-[var(--fin-ink)]">Exoneración de Responsabilidad:</strong> En la máxima medida permitida por la legislación colombiana imperativa, el usuario acepta y reconoce expresamente que el Operador <strong className="text-[var(--fin-ink)]">NO</strong> responderá por:
      <ListaVineta>
        <li>Pérdidas económicas, perjuicios directos, indirectos, incidentales, daño emergente o lucro cesante derivados de decisiones financieras, inversiones o deudas asumidas por el Usuario con base en la información o cálculos de LukApp.</li>
        <li>Fallas en el servicio derivadas de interrupciones en la red de internet, indisponibilidad de proveedores externos de infraestructura en la nube (Supabase, vercel, render, github.), fallas en las APIs de Inteligencia Artificial o de transcripción de voz.</li>
        <li>Pérdida de datos almacenados exclusivamente de manera local en el navegador o dispositivo del Usuario debido a borrado de caché, desinstalación o formateo del equipo sin sincronización previa.</li>
        <li>Acceso no autorizado a la cuenta del Usuario derivado del descuido, extravío o entrega de sus credenciales de acceso a terceros.</li>
        <li>Eventos de Fuerza Mayor o Caso Fortuito según la definición descrita en el Artículo 1 de la Ley 95 de 1890.</li>
      </ListaVineta>
    </li>
  </ListaOrdenada>

  <Sub>ARTICULO NOVENO: MODIFICACIONES AL SERVICIO Y A LOS TÉRMINOS</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Evolución del Software:</strong> El Operador se reserva la facultad de actualizar, modificar, añadir o retirar funcionalidades de LukApp para optimizar el servicio, corregir errores, atender cambios regulatorios o mejorar la seguridad.</li>
    <li><strong className="text-[var(--fin-ink)]">Modificación de Términos:</strong> El Operador podrá modificar los presentes Términos y Condiciones en cualquier momento. Los cambios sustanciales serán comunicados al Usuario mediante aviso en la pagina web con anticipación a su entrada en vigencia. El uso continuado de la herramienta tras la modificación implica la aceptación de los nuevos términos.</li>
  </ListaOrdenada>

  <Sub>ARTICULO DECIMO: TERMINACIÓN Y RESCISIÓN DEL CONTRATO</Sub>

  <ListaOrdenada>
    <li><strong className="text-[var(--fin-ink)]">Terminación Voluntaria:</strong> El Usuario podrá dar por terminado este contrato en cualquier momento procediendo con la eliminación de su cuenta y de la aplicación en su dispositivo.</li>
    <li><strong className="text-[var(--fin-ink)]">Terminación por el Operador:</strong> El Operador podrá bloquear, suspender o cancelar la cuenta del Usuario sin previo aviso en caso de detectarse un incumplimiento de las prohibiciones fijadas en el articulo quinto del presente contrato o requerimiento de autoridad judicial o administrativa.</li>
  </ListaOrdenada>

  <Sub>ARTICULO DECIMO PRIMERO: PROTECCIÓN DE DATOS PERSONALES (HABEAS DATA)</Sub>

  <p>El tratamiento de los datos personales recolectados por LukApp se regirá estrictamente por la <strong className="text-[var(--fin-ink)]">Política de Tratamiento de Datos Personales</strong> de la Plataforma, el Artículo 15 de la Constitución Política, la Ley 1581 de 2012, el Decreto 1074 de 2015 y demás normas complementarias.</p>

  <Sub>CLÁUSULA DÉCIMA SEGUNDA: PROCEDIMIENTO DE PETICIONES, QUEJAS Y RECLAMOS (PQR)</Sub>

  <p>De conformidad con la Ley 1480 de 2011,, para la presentación de cualquier reclamación sobre el servicio, a la luz del articulo 23 de la Constitucion Politica de 1991 el Usuario deberá enviar una comunicación al correo <Correo />.</p>

  <p>Segun la ley 1755 de 2015.</p>

  <ListaVineta>
    <li>Las <strong className="text-[var(--fin-ink)]">consultas</strong> serán atendidas en un término máximo de diez (10) días hábiles.</li>
    <li>Los <strong className="text-[var(--fin-ink)]">reclamos</strong> serán resueltos en un término máximo de quince (15) días hábiles.</li>
  </ListaVineta>

  <Sub>ARTICULO DECIMO TERCERO: LEY APLICABLE, JURISDICCION Y DISPOSICIONES LEGALES</Sub>

  <p>El presente contrato se rige íntegramente por las leyes de la República de Colombia. Cualquier controversia derivada del presente documento que no pueda ser resuelta mediante arreglo directo a traves de la conciliacion prejudicial y demas mecanismos alternativos de solucion de conflictos previstos por la ley será sometida a la jurisdicción ordinaria de los jueces de la República de Colombia. Si cualquier disposición de este contrato fuere declarada nula, ineficaz o inaplicable por un juez o autoridad competente, dicha nulidad no afectará la validez y exigibilidad de las demás cláusulas, las cuales mantendrán su plena vigencia.</p>
</>;

export const LegalLukApp: React.FC<Props> = ({ onVolver }) => {
  const [terminosPublicados, setTerminosPublicados] = useState<{ contenido: string; actualizadoEn: string | null } | null>(null);

  useEffect(() => { document.title = 'Términos, privacidad y datos | LukApp'; window.scrollTo({ top: 0, behavior: 'auto' }); }, []);
  useEffect(() => {
    let activo = true;
    const cargarTerminos = async () => {
      try {
        const respuesta = await fetch(apiUrl('/api/legal/terminos'), { cache: 'no-store' });
        const data = await respuesta.json();
        if (activo && respuesta.ok && typeof data.contenido === 'string') {
          setTerminosPublicados({ contenido: data.contenido, actualizadoEn: data.actualizadoEn ?? null });
        }
      } catch {
        // El documento incluido sigue disponible sin conexión o si el API aún
        // no está configurado; la página legal nunca queda vacía.
      }
    };
    void cargarTerminos();
    const intervalo = window.setInterval(cargarTerminos, 30000);
    return () => { activo = false; window.clearInterval(intervalo); };
  }, []);
  return <main className="min-h-[100dvh] bg-[var(--fin-bg)] px-4 py-5 text-[var(--fin-ink)] sm:px-6 sm:py-8"><div className="mx-auto max-w-4xl">
    <header className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm sm:p-9"><div className="flex items-center justify-between gap-4"><button type="button" onClick={onVolver} className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"><ArrowLeft size={17} aria-hidden /> Volver a LukApp</button><BrandWordmark className="h-7 w-auto" /></div><div className="mt-10 max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-[var(--fin-accent)]/10 px-3 py-1.5 text-xs font-bold text-[var(--fin-accent)]"><Scale size={14} aria-hidden /> Información legal</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Términos, privacidad y uso de datos</h1><p className="mt-4 text-base leading-7 text-[var(--fin-ink-soft)]">Estas son las reglas claras para usar LukApp y entender qué información se guarda, cuándo se usa, como se usa y sobre el ejercicio de tus derechos como usuario.</p><p className="mt-5 text-xs font-semibold text-[var(--fin-ink-faint)]">Última actualización: {FECHA}</p></div></header>
    <aside className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-sm leading-6 text-[var(--fin-ink-soft)]"><strong className="text-[var(--fin-ink)]">Dato pendiente antes de publicar.</strong><p className="mt-1">Ya identificamos al responsable y su canal de contacto. Falta incorporar la dirección de notificaciones judiciales o administrativas; no se incluye aquí porque no fue suministrada.</p></aside>
    <nav aria-label="Índice legal" className="sticky top-3 z-10 mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-2 text-xs font-bold shadow-sm">{[['terminos', 'Términos'], ['privacidad', 'Privacidad'], ['datos', 'Tus datos'], ['almacenamiento', 'Almacenamiento'], ['licencia', 'Licencia']].map(([id, texto]) => <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-xl px-3 py-2 text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]">{texto}</a>)}</nav>
    <article className="mt-5 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm sm:p-10">
      <Seccion id="terminos" titulo="1. Términos y condiciones de uso">
        {terminosPublicados ? <>
          {terminosPublicados.actualizadoEn && <p className="font-semibold text-[var(--fin-ink)]">Última actualización: {new Date(terminosPublicados.actualizadoEn).toLocaleDateString('es-CO')}</p>}
          <div className="whitespace-pre-wrap break-words">{terminosPublicados.contenido}</div>
        </> : <TerminosCondiciones />}
      </Seccion>
      <Seccion id="privacidad" titulo="2. Política de tratamiento de datos personales"><p>LukApp trata datos personales conforme a la Ley 1581 de 2012, el Decreto 1074 de 2015 y las demás normas colombianas aplicables.</p><Sub>Responsable y datos tratados</Sub><p><strong>Responsable:</strong> Julián Santiago González Reina, identificado con cédula de ciudadanía No. 1.104.547.389. <strong>Canal de protección de datos:</strong> <a className="font-semibold text-[var(--fin-accent)] underline underline-offset-2" href="mailto:jsgonzalezdevs@gmail.com">jsgonzalezdevs@gmail.com</a>. Tratamos correo, identificador técnico de usuario y credenciales administradas por el proveedor de autenticación; además de los datos que decides registrar: movimientos, montos, fechas, categorías, presupuestos, metas, deudas, tarjetas, cuentas, notas, contactos, conversaciones y recuerdos del Asesor cuando los habilitas, y audio únicamente cuando eliges transcribirlo.</p><Sub>Finalidades</Sub><p>Usamos la información para crear y proteger tu cuenta; almacenar, sincronizar y mostrar tus datos; prestar las funciones que solicitas; atender soporte; prevenir fraude, abuso y fallas; cumplir obligaciones legales; y mejorar el servicio con la analítica que aceptes expresamente. No vendemos tus datos financieros ni los usamos para perfiles publicitarios. Evita introducir datos sensibles. Si registras datos de otra persona, declaras que cuentas con autorización o una base legítima.</p><Sub>Encargados, seguridad y conservación</Sub><p>LukApp utiliza Supabase para autenticación y almacenamiento en la nube. Cuando usas transcripción, el audio se envía al proveedor configurado; cuando usas el Asesor, la consulta puede procesarse mediante servicios de inteligencia artificial a través de la API de LukApp. Estos proveedores pueden procesar datos fuera de Colombia. Aplicamos HTTPS/TLS, autenticación y reglas de acceso. Conservamos los datos mientras tu cuenta esté activa o sean necesarios para la finalidad informada, salvo obligación legal de conservarlos más tiempo.</p></Seccion>
      <Seccion id="datos" titulo="3. Tus derechos y cómo ejercerlos"><p>Como titular puedes conocer, actualizar, rectificar y solicitar prueba de la autorización sobre tus datos; ser informado sobre su uso; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización cuando proceda; y solicitar la supresión cuando no exista un deber legal o contractual de conservarlos.</p><p>Envía tu solicitud al canal de protección de datos del responsable indicando tu nombre, medio de respuesta, descripción clara de la petición y soportes para acreditar tu identidad. Las consultas y reclamos se atenderán dentro de los plazos previstos por la normativa colombiana. También puedes eliminar registros y exportar la información disponible desde la aplicación.</p></Seccion>
      <Seccion id="almacenamiento" titulo="4. Almacenamiento local, cookies y analítica"><Sub>Datos financieros y preferencias</Sub><p>Sin cuenta, la información se guarda en el almacenamiento de tu navegador o dispositivo. Si borras esos datos, cambias de dispositivo o desinstalas la aplicación, podrías perderlos. Con cuenta, LukApp puede sincronizarlos en la nube. Usamos almacenamiento local para recordar preferencias operativas, configuraciones, correo recordado cuando lo autorizas y tu decisión sobre analítica.</p><Sub>Analítica con consentimiento</Sub><p>Solo si aceptas la analítica detallada, LukApp registra categorías amplias de navegador, sistema operativo, idioma, tamaño de pantalla y zona horaria, junto con ruta y parámetros UTM. No guarda dirección IP, user-agent completo, cookies de terceros, contenido de tus finanzas ni identificadores persistentes para esa finalidad. Puedes rechazarla desde el aviso inicial o borrar la preferencia del navegador.</p><Sub>Voz e inteligencia artificial</Sub><p>La voz se activa solo tras conceder permiso al micrófono. Puedes detener una grabación; el audio cancelado no se envía a transcribir. La transcripción y el Asesor son opcionales: no introduzcas información que no quieras procesar para recibir esa respuesta. El Asesor puede guardar conversaciones o recuerdos únicamente según la configuración elegida.</p></Seccion>
      <Seccion id="licencia" titulo="5. Licencia, responsabilidad y ley aplicable"><p>La aplicación se entrega tal como está disponible, con las garantías que la ley no permita excluir. En la máxima medida permitida, LukApp no responde por pérdidas derivadas de decisiones basadas exclusivamente en proyecciones, respuestas automáticas, datos incorrectos, indisponibilidad de proveedores externos, pérdida de datos locales o descuido de credenciales. Esta cláusula no limita derechos irrenunciables de consumidores.</p><p>Si surge una diferencia, procuraremos resolverla primero por el canal de soporte. Estos términos se rigen por las leyes de Colombia, sin perjuicio de las normas imperativas de protección al consumidor y de datos. Podemos actualizar esta página por cambios del servicio, proveedores o normativa; publicaremos la fecha y comunicaremos los cambios materiales de forma razonable.</p></Seccion>
    </article><footer className="py-7 text-xs text-[var(--fin-ink-faint)]">© 2026 LukApp. Información legal y condiciones de uso.</footer>
  </div></main>;
};
