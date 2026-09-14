-- Contexto técnico amplio, únicamente si la persona acepta analítica detallada.
-- No hay IP, user-agent, cookies de terceros, ciudad, correo ni ID persistente.
alter table public.visitas
  add column if not exists idioma text,
  add column if not exists sistema text,
  add column if not exists navegador text,
  add column if not exists pantalla text,
  add column if not exists zona_horaria text;

alter table public.visitas
  add constraint visitas_idioma_largo check (idioma is null or char_length(idioma) <= 16),
  add constraint visitas_sistema_largo check (sistema is null or char_length(sistema) <= 24),
  add constraint visitas_navegador_largo check (navegador is null or char_length(navegador) <= 24),
  add constraint visitas_pantalla_largo check (pantalla is null or char_length(pantalla) <= 24),
  add constraint visitas_zona_largo check (zona_horaria is null or char_length(zona_horaria) <= 48);
