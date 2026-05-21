# DIAGNOTEST — Plataforma Operativa

Sistema de gestión para laboratorio veterinario de análisis clínicos.

**Stack:** Next.js 14 · Supabase · Tailwind CSS · PWA offline-first · Vercel

---

## Inicio rápido (~30 minutos)

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd diagnotest
npm install
```

### 2. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New project → región South America (São Paulo)

### 3. Ejecutar el schema

Supabase → **SQL Editor** → New query → pegar `supabase/schema.sql` → Run.

### 4. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Completar con los valores de Supabase → **Settings → API**.

### 5. Ejecutar el seed

```bash
npx ts-node --project tsconfig.json supabase/seed.ts
```

**Credenciales de prueba:**

| Email | Contraseña | Rol |
|-------|-----------|-----|
| agustin.torres@diagnotest.com | Diagnotest2024! | Personal logística |
| ignacio.peralta@diagnotest.com | Diagnotest2024! | Jefe logística |
| carlos.gomez@diagnotest.com | Diagnotest2024! | Preanalítica |
| laura.mendez@diagnotest.com | Diagnotest2024! | Cobranzas |
| direccion@diagnotest.com | Diagnotest2024! | Dueño |
| admin@diagnotest.com | Diagnotest2024! | Super Admin |

### 6. Desarrollo local

```bash
npm run dev
```

### 7. Deploy en Vercel

Conectar el repo en vercel.com, agregar las env vars del `.env.local.example`, deploy automático.

---

## Estructura

```
src/app/(dashboard)/   — Páginas por rol (retiros, pedidos, gastos, pre, cob, admin)
src/components/        — UI, layout, forms, offline
src/lib/               — Supabase, IndexedDB, hooks, utils
src/types/index.ts     — Tipos TypeScript completos
supabase/schema.sql    — DDL con RLS y triggers
supabase/seed.ts       — Datos de prueba
```

## Original Next.js docs

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
