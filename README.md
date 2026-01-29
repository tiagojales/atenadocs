# AtenasDocs (Frontend)

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Frontend application based on Nuxt. Quick reference for local development, building and deployment.

## Quick Start

Clone the repository and install dependencies. This project uses `pnpm` in the workspace, but the npm commands below work with the `scripts` defined in `package.json`.

Using pnpm (recommended):

```bash
pnpm install
pnpm dev
```

Using npm:

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` / `pnpm dev` — start development server (hot-reload) on http://localhost:3000
- `npm run build` / `pnpm build` — build for production
- `npm run preview` / `pnpm preview` — locally preview the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript type checks

Example (build + preview):

```bash
npm run build
npm run preview
```

## Environment

Runtime configuration is set in `nuxt.config.ts` under `runtimeConfig.public`. Example environment variable used by the app:

- `PDF_MERGE_API_BASE_URL` — base URL for the PDF merge backend API

Set environment variables in your hosting provider or locally before building/starting the server.

## Deployment

Recommended: deploy to a platform with first-class Nuxt support (Vercel or Netlify). Nuxt's automatic adapters will handle the server/output.

- Vercel: create a new project and point it to this repository. The default build command `npm run build` works; Vercel will detect Nuxt and configure the runtime. For static-friendly deployments, enable "Output Directory" if requested (.output/public).

- Netlify: use the `npm run build` command. In Netlify site settings set the build command to `npm run build` and the publish directory to `.output/public` (for Nuxt 3/4 Nitro output). If you need serverless functions, use the Nuxt adapter docs.

- Self-host / Docker: build with `npm run build` and run the server using the Nitro output or a Node server depending on your configuration. See Nuxt docs: https://nuxt.com/docs/getting-started/deployment

## Notes

- Prefer `pnpm` if you work across the monorepo/workspace, otherwise npm scripts are compatible.
- For edge deployments or serverless, review Nuxt Nitro output and platform adapter docs.

For full deployment instructions, see the official Nuxt docs: https://nuxt.com/docs/getting-started/deployment
