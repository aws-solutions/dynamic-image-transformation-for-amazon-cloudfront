// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingPage } from '../../support/pages/MappingPage';
import { MappingFactory } from '../../support/factories/MappingFactory';
import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';
import { TIMEOUTS } from '../../utils/constants';

describe('Mapping Flow - Create Edit Tests', { tags: ['@crud'] }, () => {
  let originData: ReturnType<typeof OriginFactory.createBasicOrigin>;

  before(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    originData = OriginFactory.createBasicOrigin();
    OriginPage.provisionOrigin(originData);
  });

  after(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    OriginPage.deleteOrigin(originData.name);
  });

  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    MappingPage.navigateToMappings();
  });

  it('[@crud] should create and edit a basic mapping', () => {
    const mappingData = MappingFactory.createBasicMapping({ origin: originData.name });

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

    // Wait for form data to load from API before interacting
    cy.get('input[placeholder*="mapping name"], input[placeholder*="Mapping name"]').should('have.value', mappingData.name);

    // Update description — no external data dependencies
    MappingPage.getMappingDescriptionInput().clear().type('Updated description');

    MappingPage.submitUpdateMapping();

    // Verify update — wait for list page (not just any /mappings/* URL)
    cy.url({ timeout: TIMEOUTS.REDIRECT }).should('match', /\/mappings$/);
    cy.contains(mappingData.name).should('be.visible');
  });
});
