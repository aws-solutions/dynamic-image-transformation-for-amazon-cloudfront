// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingPage } from '../../support/pages/MappingPage';
import { MappingFactory } from '../../support/factories/MappingFactory';

describe('Mapping Types - Creation Tests', { tags: ['@smoke', '@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    MappingPage.navigateToMappings();
  });

  it('[@smoke] should create a mapping with host header pattern', () => {
    const mappingData = MappingFactory.createHostHeaderPatternMapping();
    
    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify user sees mapping in list
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });
  
  
  it('[@crud] should create a mapping with path pattern only', () => {
    const mappingData = MappingFactory.createPathPatternMapping();
    
    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify user sees mapping in list
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });
  
  
  it('[@crud] should create a mapping with policy', () => {
    const mappingData = MappingFactory.createPolicyMapping();
    
    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify user sees mapping in list
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });
  
});
