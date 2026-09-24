-- Consumo exacto y última cuota conocida del proveedor de IA.
--
-- Esta migración requiere que 0013_telemetria_ia.sql ya esté aplicada. Las
-- cabeceras de Groq son una fotografía de su cuota por minuto y por día en el
-- momento de cada respuesta; guardarlas permite que Superadmin no vuelva a
-- inventar una cuota diaria fija después de que Render se reinicie.

alter table public.telemetria_ia
  add column if not exists limite_tokens_minuto integer check (limite_tokens_minuto is null or limite_tokens_minuto >= 0),
  add column if not exists tokens_restantes_minuto integer check (tokens_restantes_minuto is null or tokens_restantes_minuto >= 0),
  add column if not exists limite_solicitudes_dia integer check (limite_solicitudes_dia is null or limite_solicitudes_dia >= 0),
  add column if not exists solicitudes_restantes_dia integer check (solicitudes_restantes_dia is null or solicitudes_restantes_dia >= 0),
  add column if not exists cuota_proveedor_observada_en timestamptz;

-- La pantalla resume las consultas de un día y después busca la última cuota
-- conocida. Este índice cubre ambas lecturas sin indexar las preguntas ni las
-- respuestas, que siguen siendo datos privados.
create index if not exists telemetria_ia_cuota_reciente_idx
  on public.telemetria_ia (cuota_proveedor_observada_en desc)
  where cuota_proveedor_observada_en is not null;
