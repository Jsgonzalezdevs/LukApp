-- El mensaje que el equipo escribe al regalar Premium se le muestra a la persona
-- en la celebración. Vive aparte de `nota` porque esa columna se sobrescribe al
-- editar la vigencia o al retirar Premium, y esas notas sí son internas: una
-- edición no debe cambiar ni filtrar lo que la persona va a leer.
alter table public.suscripciones
  add column if not exists mensaje_regalo text
    check (mensaje_regalo is null or char_length(mensaje_regalo) <= 280);
