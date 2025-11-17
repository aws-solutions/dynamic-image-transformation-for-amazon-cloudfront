// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingPage } from '../../support/pages/MappingPage';
import { MappingFactory } from '../../support/factories/MappingFactory';

describe('Mapping Flow - Create Edit Tests', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    MappingPage.navigateToMappings();
  });

  it('[@crud] should create and edit a basic mapping', () => {
    const mappingData = MappingFactory.createBasicMapping({ 
      name: 'Test Edit Mapping'
    });
    
    // Create mapping
    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify creation (user sees mapping in list)
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
    
    // Edit mapping
    MappingPage.editMapping(mappingData.name);
    
    // Wait for edit form to load
    cy.url().should('include', '/edit');
    
    MappingPage.selectFirstPolicy()
    
    MappingPage.submitUpdateMapping();
    
    // Verify update (user sees they're back on mappings page with same mapping)
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });
});
