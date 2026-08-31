// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingPage } from '../../support/pages/MappingPage';
import { MappingFactory } from '../../support/factories/MappingFactory';
import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';

describe('Mapping Flow - Create Delete Tests', { tags: ['@crud'] }, () => {
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

  it('[@crud] should create and delete a basic mapping', () => {
    const mappingData = MappingFactory.createBasicMapping({ origin: originData.name });

    // Create mapping
    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify creation
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');

    // Delete mapping
    MappingPage.deleteMapping(mappingData.name);

    // Verify deletion
    cy.get('[role="dialog"]').should('not.be.visible');
    cy.get('table').within(() => {
      cy.contains(mappingData.name).should('not.exist');
    });
  });
});
