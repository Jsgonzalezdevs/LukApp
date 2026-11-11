package app.lukapp.dominio

// Fábricas compartidas por los tests, con los mismos valores por defecto que los *.test.ts.

fun mov(
    id: String = "m1",
    cajitaId: String = "c1",
    kind: String = "deposito",
    deltaCop: Long = 100_000,
    occurredOn: String = "2026-08-01",
    nota: String = "",
    createdAt: String = "2026-08-01T10:00:00.000Z",
    cuotasTotal: Int? = null,
    cuotaCop: Long? = null,
    interesPct: Double? = null,
    cuotaManejoCop: Long? = null,
) = CajitaMovimiento(
    id = id, cajitaId = cajitaId, kind = kind, deltaCop = deltaCop, categoria = null,
    occurredOn = occurredOn, nota = nota, createdAt = createdAt,
    cuotasTotal = cuotasTotal, cuotaCop = cuotaCop, interesPct = interesPct, cuotaManejoCop = cuotaManejoCop,
)

fun caj(
    id: String = "c1",
    nombre: String = "Vacaciones",
    tipo: String = "cajita",
    metaCop: Long? = null,
    tasaEaPct: Double? = null,
    archivedAt: String? = null,
    claseCuenta: String? = null,
    limiteCreditoCop: Long? = null,
    diaCorte: Int? = null,
    diaPago: Int? = null,
    icon: String = "🏖️",
    createdAt: String = "2026-08-01T00:00:00.000Z",
) = Cajita(
    id = id, nombre = nombre, icon = icon, tipo = tipo, claseCuenta = claseCuenta, metaCop = metaCop,
    tasaEaPct = tasaEaPct, createdAt = createdAt, archivedAt = archivedAt,
    limiteCreditoCop = limiteCreditoCop, diaCorte = diaCorte, diaPago = diaPago,
)

fun tx(
    id: String = "t1",
    kind: String = "gasto",
    amountCop: Long = 45_000,
    category: String = "mercado",
    description: String = "Mercado",
    occurredOn: String = "2026-08-10",
    cuentaId: String? = "c1",
    afectaSaldo: Boolean = true,
    rawTranscript: String = "",
    createdAt: String = "2026-08-10T00:00:00.000Z",
    cuotasTotal: Int? = null,
    cuotaCop: Long? = null,
) = Transaccion(
    id = id, kind = kind, amountCop = amountCop, category = category, description = description,
    occurredOn = occurredOn, cuentaId = cuentaId, afectaSaldo = afectaSaldo, rawTranscript = rawTranscript,
    cuotasTotal = cuotasTotal, cuotaCop = cuotaCop, createdAt = createdAt,
)
