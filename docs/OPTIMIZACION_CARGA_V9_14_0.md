# Carga y cuentas automáticas · V9.14.0

Revisión: 22 de octubre de 2026. Cambios locales; requiere publicar para que lleguen a los usuarios.

## Medición reproducible

Compilaciones Vite de V9.13.1 y V9.14.0 en el mismo equipo:

| Bloque principal | Antes | Después |
| --- | ---: | ---: |
| JavaScript de LukApp | 526,63 KB | 260,62 KB |
| Comprimido con gzip | 131,94 KB | 75,80 KB |

Reducción del bloque principal: 50,5 %; comprimido: 42,5 %. No representa una medición del tiempo total en un teléfono ni de todos los archivos descargados: React, Supabase y otros bloques compartidos siguen siendo necesarios. Las pantallas secundarias se descargan al abrirlas. No se eliminaron funciones financieras.

## Por qué podía aparecer otro Efectivo

1. Mientras se migraba el libro, `useAlmacen(undefined)` elegía el almacenamiento local genérico y podía sembrar una cuenta antes de abrir el repositorio correcto.
2. Un fallo de red con caché vacía devolvía una instantánea vacía, indistinguible de un usuario nuevo. La carga inicial sembraba otro Efectivo con un UUID aleatorio.
3. Dos dispositivos podían recibir a la vez un historial vacío y generar identificadores diferentes.
4. La migración del libro local se repetía en cada apertura aunque ya hubiera terminado correctamente.

## Protección aplicada

- El almacén no lee ni escribe hasta que termina la preparación del repositorio del usuario.
- Se abre primero una copia confirmada del mismo usuario y se refresca de fondo. Se mantienen las comprobaciones contra respuestas anteriores a un guardado.
- Una copia en caché no autoriza sembrados ni eliminaciones automáticas.
- Si no hay copia local válida y falla la red, se informa el fallo; no se crean cuentas ni se presentan ceros como resultado cargado.
- El Efectivo automático nuevo usa un UUID v8 derivado del usuario mediante SHA-256. Los dispositivos de la misma cuenta obtienen la misma clave primaria y el upsert evita filas distintas. No se cambian identificadores de cuentas existentes.
- La migración local completada queda marcada por usuario. Si falla alguna escritura, no se marca y se permite reintentar.
- Las rutas administrativas conservan su espera de permisos. Las finanzas dejan de depender de esa consulta; los controles de servidor y RLS siguen vigentes.

## Limpieza

Se retiraron nueve archivos sin consumidores del antiguo portafolio: contexto bilingüe y sus pruebas, desplazamiento suave, imágenes de plantilla y logos de proyectos antiguos. Se actualizaron los textos del panel de estadísticas. Se mantuvieron los datos del responsable legal de LukApp.

Se apartaron 35 archivos duplicados idénticos fuera del proyecto en `/Users/jsgonzalez/Documents/LukApp-respaldo-limpieza-20261022`. No se tocó la modificación previa de CLAUDE.md ni el documento duplicado cuyo contenido era diferente.

## Base de datos

Auditoría de lectura mediante Supabase: estadísticas de tablas, tamaños, consultas y asesor de rendimiento. Las consultas habituales de lectura de cajitas promedian aproximadamente 0,39–0,58 ms. Las tablas financieras actuales son pequeñas (transacciones: aproximadamente 408 KB; cajitas: 128 KB). No se encontró una tabla obsoleta del portafolio cuya eliminación fuera justificable. Visitas y visitas_diarias siguen alimentando estadísticas.

Se detectaron dos usuarios con una fila adicional de Efectivo cada uno mediante conteos agregados. No se borraron ni fusionaron datos de producción. La prevención de nuevas duplicaciones no equivale a consolidar historiales antiguos; cuentas con movimientos requieren revisión específica.

## Verificación

- 146 archivos de pruebas y 1.648 pruebas correctas, incluidos arranque diferido, fallo de primera descarga, caché válida con red lenta, reintento de migración y dos montajes simultáneos con una misma identidad.
- TypeScript y compilación de producción correctos.
- Revisión en navegador de la compilación local: Inicio, Dinero y Metas de ahorro.
- Lint sin errores, con advertencias que incluyen el estado de carga sincronizado con la preparación del almacén.
