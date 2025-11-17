// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';

describe('Origin Flow - Create Delete Tests', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
  });

  it('[@crud] should create and delete a basic origin', () => {
    const originData = OriginFactory.createBasicOrigin({ name: 'Simple Test Origin' });
    
    // Create origin
    cy.get('button').contains('Create origin').click();
    OriginPage.fillOriginForm(originData);
    OriginPage.submitCreateOrigin();

    // Verify creation (user sees origin in list)
    cy.url().should('include', '/origins');
    cy.contains(originData.name).should('be.visible');
    
    // Delete origin
    OriginPage.deleteOrigin(originData.name);
    
    // Verify deletion (user no longer sees origin in list)
    cy.get('[role="dialog"]').should('not.be.visible');
    cy.get('table').within(() => {
      cy.contains(originData.name).should('not.exist');
    });
  });
});
