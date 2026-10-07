# E2E Tests for Dynamic Image Transformation Admin UI

Cypress end-to-end tests, written in TypeScript, that drive the admin UI of a deployed v8 stack.

**Run these only against a test stack.** At the end of every run they delete every item in the stack's config table (origins, mappings, and policies), not just the ones the tests created.

## Prerequisites

- A deployed v8 stack
- Node.js 24.x or later
- Local AWS credentials with permissions for DynamoDB, Cognito, CloudFormation, and S3

| Variable | What it is |
|----------|------------|
| `CURRENT_STACK_NAME` | Name of the deployed CloudFormation stack |
| `CURRENT_STACK_REGION` | Region the stack is deployed in |
| `USER_PASSWORD` | Password to give the Cognito test user. Required |

The app URL, Cognito origin and user pool ID are read from the stack outputs when the run starts.

## Running the tests

```bash
cd source/admin-ui/src/e2e-tests
npm ci
export USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack

npm run cypress:run                                          # all specs, headless
npm run cypress:open                                         # interactive
npx cypress run --spec "cypress/specs/origin/**/*.cy.ts"    # one folder
npx cypress run --spec "cypress/specs/mapping/mapping-types.cy.ts"   # one spec
npx cypress run --env TAGS="@smoke"                          # by tag
```

Specs are grouped by page under [cypress/specs/](./cypress/specs/): `auth`, `origin`, `mapping`, `transformation-policy`, and `playground`. Tags are defined in [cypress/config/testTags.ts](./cypress/config/testTags.ts); the auth specs also use `@auth`.

## What a run does

- **Before the run:** creates a Cognito test user with `USER_PASSWORD`, turning off the user pool's MFA for the run. If any playground spec is selected, it also creates an S3 bucket of test images and the config items that point at it.
- **After the run:** deletes the test user and restores the MFA setting, clears the config table, and deletes the playground bucket.

This setup lives in [cypress/plugins/](./cypress/plugins/). Specs use page objects from `cypress/support/pages/` and test data from `cypress/support/factories/`; follow those when adding a spec.

## Troubleshooting

- **Sign-in fails:** check that `CURRENT_STACK_NAME` and `CURRENT_STACK_REGION` are set, and that `aws sts get-caller-identity` returns the account the stack is in.
- **Timeouts:** check that the stack is fully deployed and the app URL loads in a browser. Timeouts are set in [cypress.config.ts](./cypress.config.ts).
