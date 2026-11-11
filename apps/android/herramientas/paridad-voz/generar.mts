import { readFileSync, writeFileSync } from 'node:fs';
const RealDate = Date;
const FIJA = new RealDate('2026-11-11T12:00:00-05:00').getTime();
// @ts-ignore
globalThis.Date = class extends RealDate {
  constructor(...a: any[]) { if (a.length === 0) super(FIJA); else super(...(a as [])); }
  static now() { return FIJA; }
};
const L = '/Users/jsgonzalez/Documents/LukApp/src/features/lukapp/lib/';
const { parseTransaction, limpiarDescripcionFinanciera } = await import(L + 'parseTransaction.ts');
const { parseMultipleTransactions } = await import(L + 'parseMultipleTransactions.ts');
const { parseComandoVoz } = await import(L + 'parseComandoVoz.ts');
const { parseAmount } = await import(L + 'numerals.ts');
const { extraerContraparte } = await import(L + 'contraparte.ts');

const N = (v: any) => (v === null || v === undefined ? '∅' : String(v));
const f2 = (x: number) => x.toFixed(2);
const ser = (r: any) => [
  r.kind, N(r.amount), r.category, N(r.cuentaId), r.description, N(r.dateOverride), N(r.cuotasTotal), N(r.cuotaCop),
  f2(r.confidence), r.needsReview, r.signals.amountSource, r.signals.kindSource, r.signals.categorySource,
  r.signals.cuentaSource, r.signals.paymentMethod, r.signals.recurringPattern, r.signals.ambiguousAmount,
  N(r.signals.destinatario), N(r.signals.ubicacion), r.signals.tags.join(','), r.suggestedCategories.join(','),
  [r.confianzaGranular.monto, r.confianzaGranular.tipo, r.confianzaGranular.categoria, r.confianzaGranular.cuenta, r.confianzaGranular.metodo].map(f2).join(','),
].join('|');
const serCmd = (c: any) => c === null ? '∅' : [c.tipo, N(c.origenId), N(c.destinoId), N(c.deudaId), N(c.cuentaId), N(c.cajitaId), N(c.montoCop ?? c.saldoCop), N(c.occurredOn)].join('|');

const CUENTAS = [
  { id: 'nequi', nombre: 'Nequi' }, { id: 'banco', nombre: 'Bancolombia' }, { id: 'davi', nombre: 'Davivienda' },
  { id: 'efec', nombre: 'Efectivo' }, { id: 'bogota', nombre: 'Banco de Bogotá' }, { id: 'nu', nombre: 'Tarjeta Nu' },
];
const ENTIDADES = [
  ['nequi', 'Nequi', 'cuenta'], ['banco', 'Bancolombia', 'cuenta'], ['viaje', 'Viaje', 'cajita'],
  ['nu', 'Tarjeta Nu', 'tarjeta'], ['moto', 'Crédito de la moto', 'deuda'],
].map(([id, nombre, tipo]) => ({ id, nombre, tipo, archivedAt: null }));
const COMANDOS = [
  'Abona 200 mil a la tarjeta Nu desde Bancolombia', 'Ayer aboné 20 mil a la Nu desde Nequi',
  'Aboné 100 mil a la Nu desde Nequi', 'Paga 50 mil al crédito de la moto desde Bancolombia',
  'Paga 80 mil a la tarjeta', 'Pagué 80 mil de mercado con la tarjeta Nu', 'Actualiza el saldo de Nequi a 450 mil',
  'La deuda actual de la tarjeta Nu es cero', 'En Nequi tengo cuatrocientos mil', 'Modifica lo que tengo en el Neki',
  'Pasa 150 mil de Nequi a Viaje', 'Aparta 50 mil en Viaje', 'Saca 20 mil de Viaje', 'Transferí 50 mil de Nequi a Juan',
  'Registra 2 mil de rendimiento en Viaje', 'Mueve 30 mil de Bancolombia a Nequi', 'Transfiere 100 mil de Neki a Banco Colombia',
  'ayer pasé 40 mil de nequi a bancolombia', 'cuánto debo en la tarjeta Nu', 'el saldo de Viaje es 1.200.000',
  'gasté 20 mil en almuerzo', 'mete 10 mil a mis ahorros en Viaje', 'abona a la moto 300 mil',
];
const AMOUNTS = ['20 mil', 'veinte lucas', 'un millón doscientos mil', 'dos millones y medio', 'cuarto de millón', '1.250.000', "1'200.000", '45,5 mil', '2.5m', 'mil quinientos', 'treinta y cinco', 'novecientos noventa y nueve mil novecientos noventa y nueve', '20 mil 30 mil', 'medio', 'cero', '99999999999999', 'tres palos quinientos', 'media luca', 'un cuarto de millón', 'doscientas mil', 'veintiún mil', '5 millones 300', 'mil millones', 'dos mil y medio', '20 30', 'y cinco', 'cien mil y medio'];
const CONTRA = ['Envio con BRE-B a: JUAN PEREZ 123', 'Recibi por bre-b de: maria lopez', 'Transferencia a Carlos Gomez S.A.S.', 'Pago recibido de Ana', 'Pago en QR bre-b: Otra entidad', 'de La Tienda Ltda', 'para yo', 'Compra paquete', '', 'Transferencia de nequi app movil'];

const corpus = readFileSync('/private/tmp/claude-501/-Users-jsgonzalez-Documents-LukApp/179e6f79-bc23-4d7d-bd00-c2498b702467/scratchpad/corpus.txt', 'utf8').split('\n').filter((l) => l.length > 0);
const k = (s: string) => JSON.stringify(s).replace(/\$/g, '\\$');
const out: string[] = [];
out.push('package app.lukapp.dominio.voz\n');
out.push('// GENERADO desde el TS de la web (src/features/lukapp/lib) con hoy = 2026-11-11 en Bogotá.');
out.push('// Cada caso es la salida real del intérprete web; no editar a mano.\n');
out.push('internal object CorpusWeb {');
out.push('    val transaccionesSinCuentas: List<Pair<String, String>> = listOf(');
for (const t of corpus) out.push(`        ${k(t)} to ${k(ser(parseTransaction(t)))},`);
out.push('    )\n    val transaccionesConCuentas: List<Pair<String, String>> = listOf(');
for (const t of corpus) out.push(`        ${k(t)} to ${k(ser(parseTransaction(t, CUENTAS)))},`);
out.push('    )\n    val multiples: List<Pair<String, List<String>>> = listOf(');
for (const t of corpus) out.push(`        ${k(t)} to listOf(${parseMultipleTransactions(t).map((r: any) => k(ser(r) + '|' + r.raw)).join(', ')}),`);
out.push('    )\n    val limpiezas: List<Pair<String, String>> = listOf(');
for (const t of corpus) out.push(`        ${k(t)} to ${k(limpiarDescripcionFinanciera(t))},`);
out.push('    )\n    val comandos: List<Pair<String, String>> = listOf(');
for (const t of [...COMANDOS, ...corpus.slice(0, 40)]) out.push(`        ${k(t)} to ${k(serCmd(parseComandoVoz(t, ENTIDADES)))},`);
out.push('    )\n    val montos: List<Pair<String, String>> = listOf(');
for (const t of [...AMOUNTS, ...corpus]) out.push(`        ${k(t)} to ${k(N(parseAmount(t)))},`);
out.push('    )\n    val contrapartes: List<Pair<String, String>> = listOf(');
for (const t of CONTRA) out.push(`        ${k(t)} to ${k(N(extraerContraparte(t)))},`);
out.push('    )\n}\n');
writeFileSync('/Users/jsgonzalez/Documents/LukApp/apps/android/app/src/test/java/app/lukapp/dominio/voz/CorpusWeb.kt', out.join('\n'));
console.log('ok', corpus.length);
