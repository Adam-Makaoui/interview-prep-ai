# InterviewIntel — Frontend

React SPA for InterviewIntel: Vite dev server, React Router, Supabase auth, and a FastAPI backend (proxied as `/api` in dev).

## Stack

- **React 19**, **Vite 8**, **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/vite` — entry stylesheet `src/index.css` (`@theme inline`, `@custom-variant dark` on `.dark`)
- **shadcn/ui** (registry style **radix-nova**): copied components in `src/components/ui`, **`cn()`** in `src/lib/utils.ts`, config in **`components.json`**
- **Radix** primitives from the unified **`radix-ui`** npm package; **Lucide** icons; **`tw-animate-css`** for motion utilities used by menus/dialogs
- **Framer Motion** — primarily the public **Landing** page (per root `CLAUDE.md`, keep heavy motion landing-only)

## Install

From this directory:

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required today because `@tailwindcss/vite@4` peer-lists Vite ≤7 while this app uses **Vite 8**; the stack still builds and runs.

## Scripts

| Command        | Purpose                    |
|----------------|----------------------------|
| `npm run dev`  | Vite dev server (port 5173) |
| `npm run build`| `tsc -b` + production bundle |
| `npm run lint` | ESLint                     |
| `npm run test` | Playwright (see `tests/`)  |

## Imports

Path alias **`@/`** → **`src/`** (see `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`).

## Adding UI

```bash
npx shadcn@latest add <component>
```

Optional: **`npx shadcn@latest mcp init --client claude`** on your machine only — configures MCP for AI-assisted registry browsing; it does not affect the running app.

## Docs

Repo root **[`README.md`](../README.md)** (overview, API table), **[`project_specs.md`](../project_specs.md)** (product + stack), **[`ARCHITECTURE.md`](../ARCHITECTURE.md)** (deployment and data flow).
