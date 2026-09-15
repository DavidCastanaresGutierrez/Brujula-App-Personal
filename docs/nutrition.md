# Nutrición

Acceso desde Salud en Resumen, Tu día y Hábitos, o desde la navegación Nutrición.
El módulo reutiliza la sesión autenticada de Supabase y consulta únicamente la semana seleccionada. No añade polling ni servicios de IA.

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
Cada comida contiene `type`, `name`, `calories`, `protein`, `carbs`, `fat`.
Tipos admitidos: `breakfast`, `mid_morning`, `lunch`, `snack`, `dinner`, `other`.
Máximo 100 comidas, 100 KB de texto, nombres de 1–200 caracteres y números finitos entre 0 y 100.000.

Validación completa y vista previa antes de confirmar. Una sola operación PostgreSQL guarda el lote de forma atómica. El hash SHA-256 del documento normalizado y el índice de comida forman una clave única por usuario para que los reintentos no dupliquen registros. Las importaciones son aditivas; para corregir una comida ya importada se edita el registro existente. La clave de importación se conserva al editar. Borrar una comida permite que un reintento del mismo JSON la vuelva a añadir.

## Comprobaciones

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
`npx playwright test -g 'nutrición:'` comprueba objetivos, alta/edición, frecuentes, validación, vista previa, confirmación e idempotencia con Supabase simulado en escritorio y móvil.
Las políticas y la atomicidad también se verifican sobre Supabase dentro de una transacción revertida, sin conservar datos de prueba.
