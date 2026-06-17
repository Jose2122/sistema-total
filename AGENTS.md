# AGENTS.md

## Project overview
This repository is a Vite + React + Supabase application for compras, solicitudes, and related internal workflows. The main app entry points are in [src/App.jsx](src/App.jsx) and [src/main.jsx](src/main.jsx). For a high-level project summary, see [README.md](README.md).

## Common commands
Run these from the repository root:
- `npm run dev` — start the local Vite development server
- `npm run build` — create a production build
- `npm run lint` — run ESLint checks

## Architecture and conventions
- Feature screens live as top-level React components in [src](src), such as [src/Dashboard.jsx](src/Dashboard.jsx), [src/SolicitudFondos.jsx](src/SolicitudFondos.jsx), and [src/Requisiciones.jsx](src/Requisiciones.jsx).
- Shared UI should go in [src/components](src/components) when it is reused across screens.
- Data access and business logic should stay in [src/services](src/services) and [src/store](src/store) rather than being scattered inside components.
- CSS is usually kept alongside the component that uses it (for example, a component and its `.css` file in the same folder).
- The app uses React Router and session handling in [src/App.jsx](src/App.jsx), so new routes should be added there and follow the existing auth-protected pattern.

## Implementation guidance
- Keep changes aligned with the existing JavaScript/JSX style and Spanish UI copy.
- Prefer existing service modules and state patterns over ad hoc Supabase calls in components.
- If you add a new feature screen, keep the route registration and auth behavior consistent with the current app structure.
- Avoid treating the root debug and scratch artifacts as source of truth; they are mostly local diagnostics.

## Verification
Before finishing UI or data-access changes, run `npm run lint` and `npm run build` to confirm that the update does not introduce regressions.
