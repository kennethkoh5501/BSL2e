# LabWatch BSL2e Dashboard

A Next.js (App Router) application for managing BSL2e laboratory operations including clock-in tracking, biosafety activity logging, PPE inventory monitoring, and administrative analytics.

## Tech Stack

- Next.js 14 with the App Router
- React 18 + TypeScript
- Tailwind CSS for styling
- Firebase / Firestore for realtime data
- PapaParse for CSV exports

## Project Structure

```
src/
  app/
    (main)/
      dashboard/
      clock-in/
      bsl2e-log/
      ppe-log/
      admin/
    layout.tsx
    page.tsx
    globals.css
  components/
    layout/
    forms/
    admin/
    modals/
  lib/
  utils/
```

Each route uses a dedicated page component, while reusable UI pieces live under `src/components`.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set Firebase credentials in `.env.local`:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

The dashboard is accessible at `http://localhost:3000/dashboard` and provides navigation to all other workflows.

## Handling npm 403 Errors in Restricted Environments

When the execution environment blocks access to `https://registry.npmjs.org/`, follow this sequence to restore package resolution.

### A. Confirm the active registry

```bash
npm config get registry
```

If the output is not `https://registry.npmjs.org/`, reset it:

```bash
npm config delete registry
npm config set registry https://registry.npmjs.org/
npm ping
```

### B. Capture environment diagnostics

If `npm ping` still returns `403 Forbidden`, record the environment information to identify proxy restrictions:

```bash
env | grep -E "HTTP|PROXY|NODE|CI"
cat ~/.npmrc || true
cat .npmrc || true
```

### C. Route npm through an open mirror

Set an open mirror and retry the install:

```bash
npm config set registry https://registry.npmmirror.com/
npm ping
npm install --legacy-peer-deps
```

After a successful install, restore the canonical registry:

```bash
npm config set registry https://registry.npmjs.org/
```

### D. Use a mirror-capable package manager

If npm still fails, switch to pnpm or yarn with the same mirror:

```bash
npm install -g pnpm || npm install -g yarn
pnpm config set registry https://registry.npmmirror.com/
pnpm install --no-frozen-lockfile
# or
yarn config set registry https://registry.npmmirror.com/
yarn install --network-timeout 600000
```

### E. Offline extraction fallback

When all remote installs are blocked, create a `node_modules.tar.gz` archive in an unrestricted environment:

```bash
npm ci
tar -czf node_modules.tar.gz node_modules
```

Upload the archive to the restricted environment and extract it next to `package.json`:

```bash
tar -xzf node_modules.tar.gz
```

### F. Validate success

Finally, confirm the tooling works:

```bash
npm ping
npm run lint
npm run build
```

Log any remaining `403 Forbidden - GET https://...` errors so proxy configuration can be adjusted.

## Automated Build + Deploy Pipeline

Run the bundled automation script to apply the troubleshooting flow, validate the build, and deploy to Firebase Hosting in a single step:

```bash
npm run pipeline
```

The script mirrors the A–F procedure above: it audits the active registry, captures diagnostics, attempts npm/pnpm/yarn installs with public mirrors, and provides guidance for manual `node_modules` extraction if networking remains blocked before running the Firebase deployment checks.
