# Brújula

Aplicación personal para registrar hábitos diarios y semanales, organizarlos por
bloques y analizar la constancia mensual y anual.

## Arquitectura

- Next.js y React
- Supabase Auth + PostgreSQL con Row Level Security
- Vercel
- Persistencia local temporal cuando no hay conexión

La aplicación está diseñada para funcionar en los planes gratuitos de Supabase
y Vercel. Cada usuario solo puede leer y modificar sus propios datos.

## Instalación en el móvil

Brújula es una aplicación web instalable. En Android, Chrome ofrece «Instalar
aplicación» desde el menú; en iPhone, Safari → Compartir → «Añadir a pantalla
de inicio». Se abre a pantalla completa y, sin conexión, carga la última
pantalla con los datos guardados en el dispositivo; los cambios se sincronizan
al volver la red.

El manifiesto se genera en `app/manifest.ts` y el service worker vive en
`public/sw.js`: guarda la carcasa de la app y los ficheros estáticos, nunca
datos ni llamadas a la API. Solo se registra en producción.

## Galaxy Watch 6

La carpeta `wear` contiene la aplicación independiente para Wear OS. El usuario
genera un código temporal en `/watch-connect`; el reloj lo canjea por una
credencial revocable y solo solicita los hábitos del día actual. Consulta
[`wear/README.md`](wear/README.md) para compilar e instalar el APK.

## Configuración local

1. Crea un proyecto gratuito en Supabase.
2. Aplica **todas** las migraciones de `supabase/migrations` en orden
   cronológico. No basta con ejecutar la migración inicial: las migraciones
   posteriores incorporan objetivos, sincronización transaccional, revisiones
   semanales, nuevos calendarios y las políticas RLS actuales.
3. Copia `.env.example` como `.env.local` y rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Estas dos variables son públicas por diseño. La seguridad depende de las
políticas RLS incluidas en la migración; nunca debe utilizarse
`SUPABASE_SERVICE_ROLE_KEY` en el navegador.

Variables opcionales, solo de servidor:

- `SUPABASE_SERVICE_ROLE_KEY`: necesaria para emparejar y atender al reloj.
- `VISION_API_KEY`, `VISION_BASE_URL`, `VISION_MODEL`: análisis de fotos de
  comida. Ver [Análisis de fotos](#análisis-de-fotos-de-comida).

```bash
npm install
npm run dev
```

## Despliegue gratuito en Vercel

Importa este repositorio en Vercel, conserva el framework `Next.js` y añade las
variables de entorno anteriores para Production, Preview y Development. La ruta
de análisis de fotos declara `maxDuration = 60`, dentro del límite del plan
gratuito de Vercel.
Vercel ejecutará `npm run build`.

En Supabase Auth configura:

- **Site URL**: la URL de producción de Vercel.
- **Redirect URLs**: la URL de producción y `http://localhost:3000/**`.
- En **Authentication → Sign In / Providers**, desactiva **Allow new users to
  sign up** después de crear las cuentas autorizadas. El formulario «Crear una
  cuenta» y las altas directas mediante la API devolverán entonces un error de
  Supabase.

## Análisis de fotos de comida

En Nutrición, **Analizar foto** envía la imagen a un modelo con visión y
devuelve una estimación de comidas que se revisa antes de guardarla. La foto se
reduce en el navegador (lado mayor 1280 px) y no se almacena.

El servidor habla el formato de chat de OpenAI, así que vale cualquier
proveedor compatible. Opciones sin coste a fecha de octubre de 2026:

| Proveedor | `VISION_BASE_URL` | `VISION_MODEL` | Notas |
| --- | --- | --- | --- |
| Groq (por defecto) | `https://api.groq.com/openai/v1` | `meta-llama/llama-4-scout-17b-16e-instruct` | Sin tarjeta; unas 1.000 peticiones al día; no entrena con tus datos; procesa en EE. UU. |
| Mistral | `https://api.mistral.ai/v1` | `mistral-small-latest` | Plan Experiment gratuito con verificación por SMS; empresa de la UE; el plan gratuito permite usar los datos para entrenamiento. |
| OpenRouter | `https://openrouter.ai/api/v1` | cualquier modelo `:free` con visión | Unas 50 peticiones al día sin compra previa; disponibilidad variable. |
| Gemini | se configura con `GEMINI_API_KEY` | `gemini-3.8-flash` | Desde marzo de 2026 el nivel gratuito no está disponible en la UE, el Reino Unido ni Suiza. |

Los nombres de modelo cambian con frecuencia: confírmalos en la consola del
proveedor. Si el modelo no existe, la interfaz muestra el nombre rechazado.
Sin `VISION_API_KEY` ni `GEMINI_API_KEY` el botón responde que el análisis no
está configurado y el resto del módulo funciona igual.

## Datos

El esquema usa tablas relacionales para bloques, hábitos y registros. El
guardado se ejecuta mediante `apply_tracker_state_changes`, una función
transaccional protegida por la sesión de Supabase y control de revisiones para
detectar conflictos entre dispositivos.

## Comprobaciones antes de publicar

```bash
npm run validate
npm run test:e2e
```

`validate` ejecuta lint, comprobación de tipos, pruebas unitarias y compilación
de producción. Las pruebas E2E verifican los recorridos críticos en escritorio
y en un viewport móvil.
