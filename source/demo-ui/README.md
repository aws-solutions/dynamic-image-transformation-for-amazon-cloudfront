# demo-ui (v7)

A static demo page for the v7 (Lambda) stack. It builds image request URLs from a form and shows the result. It is deployed to S3 and served by CloudFront when the stack's `DeployDemoUIParameter` is `Yes`.

| File | What it holds |
|------|---------------|
| `index.html`, `scripts.js`, `style.css` | The page |
| `demo-ui-manifest.json` | List of the page files |
| `demo-ui-config.js` | Not in the repository. Written to the bucket at deploy time by the v7 custom resource (`putConfigFile`) with the image API endpoint |

## Develop

```bash
cd source/demo-ui
npm ci
```

`npm ci` runs `postinstall`, which copies jQuery, Popper, and Bootstrap into `modules/`. There are no tests. To try the page against a deployed stack, deploy `v7-Stack` with `DeployDemoUIParameter=Yes` (see the [root README](../../README.md#3-build-and-deploy)).
