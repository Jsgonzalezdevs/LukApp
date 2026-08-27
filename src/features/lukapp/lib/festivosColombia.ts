/**
 * Calendario Laboral y Festivos de Colombia (Ley 51 de 1983 - Ley Emiliani).
 *
 * Determina días hábiles, festivos oficiales y cálculo de fechas reales de pago de nómina
 * (quincenas que se adelantan si caen en sábado, domingo o festivo).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Calcula la fecha del Domingo de Pascua para un año dado usando el algoritmo anónimo de Meeus/Jones/Butcher.
 */
export const calcularDomingoPascua = (anio: number): Date => {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
};

const sumarDias = (fechaBase: Date, dias: number): Date => {
  const f = new Date(fechaBase.getTime());
  f.setUTCDate(f.getUTCDate() + dias);
  return f;
};

/**
 * Aplica la Ley Emiliani: si la fecha cae en cualquier día distinto a lunes, se corre al siguiente lunes.
 */
const trasladarAlLunes = (fecha: Date): Date => {
  const diaSemana = fecha.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  if (diaSemana === 1) return fecha; // Ya es lunes
  const diasHastaLunes = diaSemana === 0 ? 1 : 8 - diaSemana;
  return sumarDias(fecha, diasHastaLunes);
};

const aFormatoIso = (fecha: Date): string => {
  return `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())}`;
};

/**
 * Devuelve todos los festivos oficiales de Colombia para un año específico (en formato YYYY-MM-DD).
 */
export const obtenerFestivosColombia = (anio: number): string[] => {
  const festivos: Date[] = [];

  // 1. Festivos fijos (no se trasladan)
  festivos.push(new Date(Date.UTC(anio, 0, 1))); // 1 Enero - Año Nuevo
  festivos.push(new Date(Date.UTC(anio, 4, 1))); // 1 Mayo - Día del Trabajo
  festivos.push(new Date(Date.UTC(anio, 6, 20))); // 20 Julio - Independencia de Colombia
  festivos.push(new Date(Date.UTC(anio, 7, 7))); // 7 Agosto - Batalla de Boyacá
  festivos.push(new Date(Date.UTC(anio, 11, 8))); // 8 Diciembre - Inmaculada Concepción
  festivos.push(new Date(Date.UTC(anio, 11, 25))); // 25 Diciembre - Navidad

  // 2. Festivos con Ley Emiliani (se trasladan al siguiente lunes)
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 0, 6)))); // 6 Enero - Reyes Magos
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 2, 19)))); // 19 Marzo - San José
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 5, 29)))); // 29 Junio - San Pedro y San Pablo
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 7, 15)))); // 15 Agosto - Asunción de la Virgen
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 9, 12)))); // 12 Octubre - Día de la Raza
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 10, 1)))); // 1 Noviembre - Todos los Santos
  festivos.push(trasladarAlLunes(new Date(Date.UTC(anio, 10, 11)))); // 11 Noviembre - Independencia de Cartagena

  // 3. Festivos dependientes de la Pascua
  const domingoPascua = calcularDomingoPascua(anio);
  festivos.push(sumarDias(domingoPascua, -3)); // Jueves Santo
  festivos.push(sumarDias(domingoPascua, -2)); // Viernes Santo
  festivos.push(trasladarAlLunes(sumarDias(domingoPascua, 43))); // Ascensión del Señor (40 días + lunes)
  festivos.push(trasladarAlLunes(sumarDias(domingoPascua, 64))); // Corpus Christi (60 días + lunes)
  festivos.push(trasladarAlLunes(sumarDias(domingoPascua, 71))); // Sagrado Corazón (68 días + lunes)

  return festivos.map(aFormatoIso).sort();
};

/**
 * Determina si una fecha dada ('YYYY-MM-DD') es día hábil laboral en Colombia
 * (no es sábado, ni domingo, ni festivo oficial).
 */
export const esDiaHabilColombia = (fechaIso: string): boolean => {
  const [a, m, d] = fechaIso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  const diaSemana = fecha.getUTCDay();

  // Sábado (6) o Domingo (0)
  if (diaSemana === 0 || diaSemana === 6) return false;

  const festivos = obtenerFestivosColombia(a);
  return !festivos.includes(fechaIso);
};

/**
 * Calcula la fecha real de pago de nómina quincenal o mensual en Colombia.
 * Si `ajustarAHabil` es true, y el día de corte (15 o último día de mes) cae en fin de semana
 * o festivo, se retrocede al día hábil inmediatamente anterior.
 */
export const calcularFechaPagoColombia = (
  anio: number,
  mes: number, // 1 - 12
  corte: 'quincena_1' | 'quincena_2' | 'fin_mes',
  ajustarAHabil: boolean = true,
): string => {
  let diaObjetivo: number;
  if (corte === 'quincena_1') {
    diaObjetivo = 15;
  } else {
    // Último día del mes
    diaObjetivo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  }

  let fecha = new Date(Date.UTC(anio, mes - 1, diaObjetivo));

  if (ajustarAHabil) {
    while (!esDiaHabilColombia(aFormatoIso(fecha))) {
      fecha = sumarDias(fecha, -1);
    }
  }

  return aFormatoIso(fecha);
};
