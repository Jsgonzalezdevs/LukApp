-- Ejecutar después de la migración. Ningún dato de prueba queda guardado.
begin;
insert into auth.users (id,email,raw_user_meta_data) values
 ('f72b7b47-e9b4-47aa-b196-7a7340608971','prueba-atomica-1@example.invalid','{}'),
 ('f72b7b47-e9b4-47aa-b196-7a7340608972','prueba-atomica-2@example.invalid','{}');
insert into public.cajitas(id,user_id,nombre,tipo) values ('f72b7b47-e9b4-47aa-b196-7a7340608999','f72b7b47-e9b4-47aa-b196-7a7340608972','Ajena de prueba','cuenta');
select set_config('request.jwt.claim.sub','f72b7b47-e9b4-47aa-b196-7a7340608971',true);
set local role authenticated;
do $$
declare
  cuenta constant uuid := 'f72b7b47-e9b4-47aa-b196-7a7340608901';
  mov constant uuid := 'f72b7b47-e9b4-47aa-b196-7a7340608902';
  operacion constant uuid := 'f72b7b47-e9b4-47aa-b196-7a7340608903';
  datos jsonb;
  restauracion uuid := gen_random_uuid();
  rechazado boolean := false;
begin
  datos := jsonb_build_object('guardar',jsonb_build_object(
    'cajitas',jsonb_build_array(jsonb_build_object('id',cuenta,'nombre','Cuenta de prueba','tipo','cuenta')),
    'cajita_movimientos',jsonb_build_array(jsonb_build_object('id',mov,'cajita_id',cuenta,'kind','deposito','delta_cop',500000,'occurred_on','2026-10-20'))));
  perform public.aplicar_cambios_financieros(datos,operacion);
  assert (select count(*) from public.cajitas where id=cuenta)=1, 'No guardó la cuenta';
  assert (select sum(delta_cop) from public.cajita_movimientos where cajita_id=cuenta)=500000, 'No guardó la apertura';
  perform public.aplicar_cambios_financieros(datos,operacion);
  assert (select count(*) from public.cajita_movimientos where id=mov)=1, 'Duplicó el reintento';
  begin
    perform public.aplicar_cambios_financieros(jsonb_build_object('guardar',jsonb_build_object(
      'cajitas',jsonb_build_array(jsonb_build_object('id','f72b7b47-e9b4-47aa-b196-7a7340608904','nombre','Debe revertirse','tipo','cuenta')),
      'transacciones',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','gasto','amount_cop',-1,'category','otros','occurred_on','2026-10-20')))),gen_random_uuid());
  exception when check_violation then rechazado := true; end;
  assert rechazado, 'Aceptó un importe inválido';
  assert not exists(select 1 from public.cajitas where id='f72b7b47-e9b4-47aa-b196-7a7340608904'), 'Dejó una operación parcial';
  rechazado := false;
  begin
    perform public.aplicar_cambios_financieros(jsonb_build_object('guardar',jsonb_build_object('cajita_movimientos',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'cajita_id','f72b7b47-e9b4-47aa-b196-7a7340608999','kind','retiro','delta_cop',-1,'occurred_on','2026-10-20')))),gen_random_uuid());
  exception when insufficient_privilege then rechazado := true; end;
  assert rechazado, 'Aceptó una cuenta ajena';
  rechazado := false;
  begin
    perform public.aplicar_cambios_financieros('{"guardar":{"perfiles":[]}}',gen_random_uuid());
  exception when insufficient_privilege then rechazado := true; end;
  assert rechazado, 'Aceptó una tabla no financiera';
  rechazado := false;
  begin
    perform public.aplicar_cambios_financieros('{"guardar":{}}',operacion);
  exception when others then rechazado := true; end;
  assert rechazado, 'Reutilizó el identificador con otro contenido';
  perform public.aplicar_cambios_financieros('{"reemplazar":true,"guardar":{}}',restauracion);
  perform public.aplicar_cambios_financieros(jsonb_build_object('guardar',jsonb_build_object('transacciones',jsonb_build_array(jsonb_build_object('id',mov,'kind','ingreso','amount_cop',2000,'category','ingreso','occurred_on','2026-10-20')))),gen_random_uuid());
  perform public.aplicar_cambios_financieros('{"reemplazar":true,"guardar":{}}',restauracion);
  assert exists(select 1 from public.transacciones where id=mov), 'El reintento de una restauración eliminó un registro posterior';
  assert not has_function_privilege('anon','public.aplicar_cambios_financieros(jsonb,uuid)','EXECUTE'), 'La función permite acceso anónimo';
end $$;
select 'Guardado, reversión completa, aislamiento, lista de tablas e idempotencia verificados' as resultado;
rollback;
