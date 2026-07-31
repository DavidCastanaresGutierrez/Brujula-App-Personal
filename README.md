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

## Configuración local

1. Crea un proyecto gratuito en Supabase.
2. Ejecuta `supabase/migrations/202607310001_initial_schema.sql` desde el SQL
   Editor de Supabase.
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

## Datos

El esquema usa tablas relacionales para bloques, hábitos y registros. El
guardado se ejecuta mediante `replace_tracker_state`, una función transaccional
protegida por la sesión de Supabase.
