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
    const originData = OriginFactory.createBasicOrigin({ name: 'Edit Test Origin' });
    
    // Create origin
    cy.get('button').contains('Create origin').click();
    OriginPage.fillOriginForm(originData);
    OriginPage.submitCreateOrigin();

    // Verify creation (user sees origin in list)
    cy.url().should('include', '/origins');
    cy.contains(originData.name).should('be.visible');
    
    // Edit origin
    OriginPage.editOrigin(originData.name);
    
    // Wait for edit form to load
    cy.url().should('include', '/edit');
    
    // Add origin path
    const originPath = '/images';
    OriginPage.getOriginPathInput().type(originPath);
    OriginPage.submitUpdateOrigin();
    
    // Verify update (user sees they're back on origins page with same origin)
    cy.url().should('include', '/origins');
    cy.contains(originData.name).should('be.visible');
  });
});
