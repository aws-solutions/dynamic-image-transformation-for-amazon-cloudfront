// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import './commands/auth.commands';
import './commands/setup.commands';

// Handle harmless browser errors that don't affect functionality
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver loop completed') || 
      err.message.includes('Minified React error')) {
    return false;
  }
  return true;
});

before(() => {
  cy.setupTestUser();
});

after(() => {
  cy.cleanupTestUser();
});

beforeEach(() => {
});

afterEach(() => {
});