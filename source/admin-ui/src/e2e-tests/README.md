# E2E Tests for Dynamic Image Transformation Admin UI

This directory contains end-to-end (E2E) tests for the Dynamic Image Transformation Admin UI using Cypress with TypeScript.

## Prerequisites

1. The Dynamic Image Transformation stack must be deployed before running tests
2. Node.js Version 16 or higher
3. Local AWS credentials with permissions for DynamoDB, Cognito, and CloudFormation
4. Environment variables `CURRENT_STACK_REGION` and `CURRENT_STACK_NAME`

### Required Environment Variables

- **CURRENT_STACK_NAME** — name of the deployed CloudFormation stack
- **CURRENT_STACK_REGION** — AWS region where the stack is deployed
- **USER_PASSWORD** — password for the Cognito E2E test user

All other test configuration (`appUrl`, `cognitoOrigin`, `COGNITO_USER_POOL_ID`) is derived automatically from the CloudFormation stack outputs at test startup.


## Installation

```bash
# Navigate to the e2e-tests directory
cd source/admin-ui/src/e2e-tests

# Install dependencies
npm ci
```

## Running Tests

### Run All Tests (Headless)
```bash
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run cypress:run
```

### Run Tests with UI (Interactive)
```bash
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run cypress:open
```

### Run Specific Test Suites

#### Origins Tests
```bash
# Run all origin tests
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack  npx cypress run --spec "cypress/specs/origin/**/*.cy.ts"

# Run specific origin test
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npx cypress run --spec "cypress/specs/origin/origin-create-delete.cy.ts"
```

#### Mapping Tests
```bash
# Run all mapping tests
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack  npx cypress run --spec "cypress/specs/mapping/**/*.cy.ts"

# Run specific mapping test
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack  npx cypress run --spec "cypress/specs/mapping/mapping-types.cy.ts"
```

#### Transformation Policy Tests
```bash
# Run all transformation policy tests
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npx cypress run --spec "cypress/specs/transformation-policy/**/*.cy.ts"

# Run comprehensive transformation test
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npx cypress run --spec "cypress/specs/transformation-policy/transformation-all-options.cy.ts"
```

### Run Tests by Tags

Tests are tagged for easy filtering:

```bash
# Run only smoke tests
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npx cypress run --env TAGS="@smoke"

# Run only CRUD tests
USER_PASSWORD=<test-user-password> CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npx cypress run --env TAGS="@crud"
```

## Test Structure

### Directory Organization

```
cypress/
├── config/
│   ├── env.local.ts          # Local environment configuration
│   └── env.ci.ts             # CI environment configuration
├── fixtures/
│   └── seeds/
│       └── users.json        # Test user data
├── support/
│   ├── commands/
│   │   ├── auth.commands.ts  # Authentication helpers
│   │   └── setup.commands.ts # Test setup/cleanup
│   ├── pages/
│   │   ├── MappingPage.ts    # Mapping page object
│   │   ├── TransformationPolicyPage.ts  # Policy page object
│   │   └── OriginPage.ts     # Origin page object
│   ├── factories/
│   │   ├── MappingFactory.ts # Mapping test data factory
│   │   ├── TransformationPolicyFactory.ts  # Policy test data factory
│   │   └── OriginFactory.ts  # Origin test data factory
│   ├── selectors/
│   │   └── common.sel.ts     # Reusable selectors
│   ├── e2e.ts               # Global test configuration
│   └── types.d.ts           # TypeScript type definitions
├── specs/
│   ├── mapping/
│   │   ├── mapping-types.cy.ts           # Mapping creation tests
│   │   └── mapping-create-delete.cy.ts   # Mapping CRUD tests
│   ├── transformation-policy/
│   │   ├── transformation-all-options.cy.ts     # Comprehensive policy tests
│   │   ├── transformation-policy-create-delete.cy.ts  # Policy CRUD tests
│   │   └── transformation-policy-create-edit.cy.ts    # Policy edit tests
│   └── origins/
│       └── origin-create-delete.cy.ts    # Origin CRUD tests
└── cypress.config.ts        # Cypress configuration
```

### Page Object Pattern

Tests use the Page Object Model for maintainability:

```typescript
// Example: MappingPage.ts
export class MappingPage {
  static navigateToMappings() {
    cy.get('a[href="/mappings"]').click();
  }

  static clickCreateMapping() {
    cy.get('button').contains('Create mapping').click();
  }

  static fillMappingForm(data: MappingTestData) {
    // Form filling logic
  }
}
```

### Test Data Factories

Factories generate consistent test data:

```typescript
// Example: MappingFactory.ts
export class MappingFactory {
  static createBasicMapping(): MappingTestData {
    return {
      name: 'Test Mapping',
      description: 'Basic mapping for testing',
      hostHeaderPattern: 'example.com',
      origin: 'Test Origin'
    };
  }
}
```

## Authentication

Tests use automated authentication with test user management:

- **Test User Creation**: Automatically creates test users before test runs
- **Session Management**: Handles login/logout and session persistence
- **MFA Handling**: Temporarily disables MFA for testing
- **Cleanup**: Removes test users after test completion
- **Password**: Must be supplied via `USER_PASSWORD` env var — not stored in fixtures


## Troubleshooting

### Common Issues

#### Authentication Failures
```bash
# Verify environment variables are set
echo $CURRENT_STACK_NAME
echo $CURRENT_STACK_REGION

# Check AWS credentials
aws sts get-caller-identity
```

#### Test Timeouts
- Increase timeout in `cypress.config.ts`
- Check network connectivity to the app URL
- Verify stack is fully deployed and healthy

