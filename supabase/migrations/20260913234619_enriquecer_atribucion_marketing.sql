-- Atribución de marketing de visitas públicas. Son etiquetas que LukApp pone
-- en sus propios enlaces (UTM), nunca búsquedas, correos ni identificadores.
alter table public.visitas
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text;

alter table public.visitas
  drop constraint if exists visitas_utm_source_largo,
  drop constraint if exists visitas_utm_medium_largo,
  drop constraint if exists visitas_utm_campaign_largo,
  drop constraint if exists visitas_utm_content_largo;

alter table public.visitas
  add constraint visitas_utm_source_largo check (utm_source is null or char_length(utm_source) <= 80),
  add constraint visitas_utm_medium_largo check (utm_medium is null or char_length(utm_medium) <= 80),
  add constraint visitas_utm_campaign_largo check (utm_campaign is null or char_length(utm_campaign) <= 120),
  add constraint visitas_utm_content_largo check (utm_content is null or char_length(utm_content) <= 120);

-- El panel ordena por fecha y agrupa estos campos; estos índices mantienen
-- útiles los filtros futuros sin indexar valores largos de campaña completos.
create index if not exists visitas_utm_source_creado_idx on public.visitas (utm_source, creado_en desc)
  where utm_source is not null;
create index if not exists visitas_utm_campaign_creado_idx on public.visitas (utm_campaign, creado_en desc)
  where utm_campaign is not null;
