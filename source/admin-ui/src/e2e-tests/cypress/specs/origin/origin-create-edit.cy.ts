// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';

describe('Origin Flow - Create Edit Tests', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
  });

  it('[@crud] should create and edit a basic origin', () => {
    const originData = OriginFactory.createBasicOrigin();

    OriginPage.provisionOrigin(originData);

    // Edit origin
    OriginPage.editOrigin(originData.name);
    
    // Wait for edit form to load
    cy.url().should('include', '/edit');
    cy.get('#origin-name').should('have.value', originData.name);
    
    // Add origin path
    const originPath = '/images';
    OriginPage.getOriginPathInput().clear().type(originPath);
    OriginPage.submitUpdateOrigin();
    
    // Verify update — wait for list page (not just any /origins/* URL)
    cy.url().should('match', /\/origins$/);
    cy.contains(originData.name).should('be.visible');
  });
});
