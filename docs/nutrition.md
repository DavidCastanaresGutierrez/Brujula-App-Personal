# Nutrición

Acceso desde Salud en Resumen, Tu día y Hábitos, o desde la navegación Nutrición.
El módulo reutiliza la sesión autenticada de Supabase. Carga los últimos 365 días de comidas en páginas de 1.000 filas para los históricos y no añade polling. El único servicio externo es el análisis de fotos, que pasa por `/api/nutrition/analyze-photo` y se describe en el README.

## Estructura del código

- `lib/domain/nutrition.ts`: tipos, validación del JSON y cálculos básicos.
- `lib/domain/nutrition-analysis.ts`: consejos del día, nota corporal, objetivos sugeridos, series semanales y mensuales. Funciones puras con pruebas en `nutrition-analysis.test.ts`.
- `lib/supabase/nutrition-repository.ts`: todas las consultas a Supabase del módulo. Ningún componente habla con la base de datos directamente.
- `app/hooks/use-nutrition-data.ts`: carga inicial y copias editables de comidas, frecuentes, objetivos y composición corporal.
- `app/components/nutrition-view.tsx`: orquesta estado de edición y acciones.
- `app/components/nutrition/`: un componente por bloque de pantalla y por formulario.

## Datos y criterios

- `nutrition_goals`: objetivos manuales por usuario, con `goal_mode` opcional reservado para futuras modalidades.
- `nutrition_entries`: comidas con fecha local, macros y tipo. Índice por usuario y fecha.
- `frequent_meals`: plantillas editables antes de añadirlas al día.
- RLS de propiedad en las tres tablas y claves foráneas a `auth.users`.
- Calorías, carbohidratos y grasas: margen visual ±10 %. Proteína: objetivo alcanzado desde el 100 %; superar el objetivo no es un fallo.
- Medias semanales de lunes a domingo, excluyendo fechas futuras y días sin registros. Los días parcialmente registrados se incluyen y se advierte en pantalla.
- Los históricos se comparan con los objetivos actuales, como se indica en la interfaz; esta versión no guarda versiones históricas de objetivos.
- Los valores introducidos son estimaciones; no se infieren necesidades nutricionales ni se recalculan calorías desde los macros.

## Importación v1

Objeto JSON: `schema_version: 1`, `date: "AAAA-MM-DD"`, `meals: [...]`.

Cada comida mantiene calorías y macronutrientes por unidad. `quantity` y `unit` son opcionales y por defecto equivalen a `1 unidad`. Las unidades admitidas son `unit`, `serving`, `cup`, `glass`, `package`, `g` y `ml`. También son opcionales `fiber`, `sugars`, `saturated_fat` y `salt`, expresados en gramos y con valor cero cuando no se conocen.
Cada comida contiene `type`, `name`, `calories`, `protein`, `carbs`, `fat`.
Tipos admitidos: `breakfast`, `mid_morning`, `lunch`, `snack`, `dinner`, `other`.
Máximo 100 comidas, 100 KB de texto, nombres de 1–200 caracteres y números finitos entre 0 y 100.000.

Validación completa y vista previa antes de confirmar. Una sola operación PostgreSQL guarda el lote de forma atómica. El hash SHA-256 del documento normalizado y el índice de comida forman una clave única por usuario para que los reintentos no dupliquen registros. Las importaciones son aditivas; para corregir una comida ya importada se edita el registro existente. La clave de importación se conserva al editar. Borrar una comida permite que un reintento del mismo JSON la vuelva a añadir.

## Sin conexión

- `useNutritionData` guarda en el dispositivo la última instantánea del servidor y la muestra cuando no hay red, con el aviso «Sin conexión».
- Cada escritura es idempotente: `upsert` por `id` generado en el cliente (`crypto.randomUUID`) para comidas, frecuentes y mediciones, y `upsert` por usuario para los objetivos. Si la petición no llega a Supabase, la operación se guarda en una cola local (`lib/domain/nutrition-outbox.ts`), se aplica en pantalla y se reenvía al recuperar la conexión o al volver a la pestaña; después se recarga desde el servidor.
- La cola compacta guardados repetidos de la misma fila y conserva los borrados. Un cambio rechazado por el servidor (no por la red) se descarta con un error en consola para no bloquear el resto.
- La importación de JSON se encola completa y el servidor la deduplica por contenido; el análisis de fotos necesita red y lo indica.
- El E2E «nutrición sin red» cubre el ciclo completo: guardar sin red, indicador de pendientes, reenvío con el mismo `id` y recarga.

## Análisis de fotos

- Cliente: `lib/browser/photo.ts` reduce la foto a 1280 px JPEG con `createImageBitmap` y envía además el tipo de comida elegido (sugerido por la hora).
- Servidor: `app/api/nutrition/analyze-photo/route.ts` exige sesión de Supabase, acepta JPG/PNG/WEBP de hasta 4 MB y llama al proveedor definido por `resolveVisionProvider` en `lib/domain/photo-analysis.ts` con `response_format: json_object` y un tiempo máximo de 50 s.
- La respuesta se normaliza (`quantity` 1, `unit` serving, tipo forzado, números redondeados a un decimal) y pasa por `parseNutrition` antes de devolverse; la interfaz la muestra como vista previa de importación y nada se guarda sin confirmar.
- No hay límite propio por usuario: el tope lo pone el plan gratuito del proveedor y se comunica con el código 429.

## Comprobaciones

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
`npx playwright test -g 'nutrición:'` comprueba objetivos, alta/edición, frecuentes, validación, vista previa, confirmación e idempotencia con Supabase simulado en escritorio y móvil.
Las políticas y la atomicidad también se verifican sobre Supabase dentro de una transacción revertida, sin conservar datos de prueba.
