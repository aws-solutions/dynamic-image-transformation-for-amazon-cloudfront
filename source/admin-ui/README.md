# Admin UI (v8)

The React web app for managing the v8 (ECS) deployment: origins, mappings, transformation policies, and the Playground for trying transformations against the live image distribution. It is built with [Vite](https://vite.dev/) and [Cloudscape](https://cloudscape.design/), signs users in with the Amazon Cognito hosted UI through AWS Amplify, and calls the [management API](../management-lambda/README.md).

The CDK stack deploys the built `build/` folder to an S3 bucket behind CloudFront, together with a generated `amplify-config.json` that holds the Cognito, API, and image distribution settings (`source/constructs/lib/v8/stacks/management-stack.ts`). The app fetches that file at startup (`src/index.tsx`).

## Layout

| Path | What it holds |
|------|---------------|
| `src/index.tsx` | Loads `/amplify-config.json`, configures Amplify, renders the app |
| `src/App.tsx` | Routes |
| `src/pages/` | One component per screen (origins, mappings, policies, Playground) |
| `src/components/` | Shared UI, grouped by feature (`transformationPolicy/`, `playground/`, `tables/`, ...) |
| `src/services/`, `src/utils/apiClient.ts` | Management API calls |
| `src/hooks/`, `src/contexts/` | Data loading hooks, sign-in state (`UserContext.tsx`) |
| `src/constants/` | Transformation catalog, routes, navigation |
| `src/mocks/` | [Mock Service Worker](https://mswjs.io/) handlers that fake the management API in dev mode |
| `src/e2e-tests/` | Cypress tests against a deployed stack |

Entity types and validation come from [data-models](../data-models/README.md) through the `@data-models` alias in `vite.config.ts`.

## Develop

```bash
cd source/admin-ui
npm ci
```

| Task | Command |
|------|---------|
| Unit tests (Vitest) | `npm test` (its `pretest` deletes `node_modules` and runs `npm ci`) |
| Type-check | `npm run type-check` |
| Production build | `npm run build`, output in `build/`. The CDK deploy reads this folder, so build before deploying |
| End-to-end tests | See [src/e2e-tests/README.md](./src/e2e-tests/README.md) (needs a deployed stack) |

### Run locally

`npm run dev` starts Vite on port 3000 with Mock Service Worker on, so management API calls get mock data. Sign-in is still real: the app redirects to the Cognito hosted UI, so it needs a deployed stack's Cognito settings. Without an `amplify-config.json` the page stays blank, because `src/index.tsx` fails to load the config.

1. Copy the deployed config into `public/`, which Vite serves at `/`. The file name is gitignored.

   ```bash
   curl -s https://<ADMIN_UI_DOMAIN>/amplify-config.json -o public/amplify-config.json
   ```

2. In that file, change `Auth.Cognito.loginWith.oauth.redirectSignIn` to `["http://localhost:3000/"]` and `redirectSignOut` to `["http://localhost:3000/auth/logout-complete"]`.
3. In the Amazon Cognito console, open the stack's user pool app client and add the same two URLs to its allowed callback and sign-out URLs. Without this step the hosted UI shows `redirect_mismatch`. Any stack update that modifies the app client resets its URLs to the CloudFront ones; re-add them if that happens.
4. Run `npm run dev` and open `http://localhost:3000`.

The Playground sends image requests to the deployed image distribution named in `amplify-config.json`, not to the mocks. The real management API only accepts requests from the admin UI's CloudFront origin (CORS), so a local UI keeps the mocks on. To test against real data, build and deploy.

The container's local server also defaults to port 3000. When running both, start one of them on another port (`npx vite --port 3002`, or `PORT=3002` for the container). Avoid 3001, which is the default target of Vite's `/api` proxy (`VITE_API_URL`).

## Common tasks

- **Add a transformation to the policy editor:** see the [data-models walkthrough](../data-models/README.md#add-a-transformation-parameter).
- **Add a screen:** a page in `src/pages/`, a route in `src/App.tsx` and `src/constants/routes.ts`, and a navigation entry in `src/constants/navigation.ts`.
- **Change a mock response:** `src/mocks/handlers.ts`.

## Related

- [management-lambda](../management-lambda/README.md): the API this UI calls
- [data-models](../data-models/README.md): the shared schemas
- [constructs/lib/v8](../constructs/lib/v8/README.md): the stack that hosts the UI
- [source/README.md](../README.md): workspace install and the full package list
