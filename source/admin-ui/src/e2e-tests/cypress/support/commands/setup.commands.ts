// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

declare global {
  namespace Cypress {
    interface Chainable {
      setupTestUser(): Chainable<void>;
      cleanupTestUser(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('setupTestUser', () => {
  cy.task('setup:testUser', {
    userPoolId: Cypress.env('COGNITO_USER_POOL_ID')
  });
});

Cypress.Commands.add('cleanupTestUser', () => {
  cy.task('cleanup:testUser', {
    userPoolId: Cypress.env('COGNITO_USER_POOL_ID')
  });
});
