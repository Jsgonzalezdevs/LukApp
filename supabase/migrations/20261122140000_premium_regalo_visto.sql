-- El aviso de "te regalaron Premium" sale una sola vez por regalo. Recordarlo
-- en la base (y no solo en el navegador) evita que vuelva a salir al abrir la
-- cuenta en otro teléfono o después de limpiar el navegador.
alter table public.suscripciones
  add column if not exists regalo_visto_en timestamptz;

-- Las cortesías que ya existían se otorgaron antes de que hubiera aviso. Sacar
-- de golpe una celebración por un regalo de hace semanas confundiría más de lo
-- que alegra, así que se dan por vistas.
update public.suscripciones
   set regalo_visto_en = coalesce(regalo_visto_en, now())
 where origen = 'manual';

-- La consulta del aviso busca justo esto en cada entrada a la app.
create index if not exists suscripciones_regalo_pendiente_idx
  on public.suscripciones (user_id)
  where origen = 'manual' and estado = 'activa' and regalo_visto_en is null;
