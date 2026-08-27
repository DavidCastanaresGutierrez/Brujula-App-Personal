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

```bash
npm install
npm run dev
```

## Despliegue gratuito en Vercel

Importa este repositorio en Vercel, conserva el framework `Next.js` y añade las
dos variables de entorno anteriores para Production, Preview y Development.
Vercel ejecutará `npm run build`.

En Supabase Auth configura:

- **Site URL**: la URL de producción de Vercel.
- **Redirect URLs**: la URL de producción y `http://localhost:3000/**`.
- En **Authentication → Sign In / Providers**, desactiva **Allow new users to
  sign up** después de crear las cuentas autorizadas. La interfaz no ofrece
  registro público y esta opción impide también altas directas mediante la API.

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
