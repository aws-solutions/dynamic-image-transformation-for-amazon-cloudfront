// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';

describe('Origin Types - Creation Tests', { tags: ['@smoke', '@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
  });

  it('[@smoke] should create a basic origin', () => {
    const originData = OriginFactory.createBasicOrigin();
    
    cy.get('button').contains('Create origin').click();
    OriginPage.fillOriginForm(originData);
    OriginPage.submitCreateOrigin();

    // Verify user sees origin in list
    cy.url().should('include', '/origins');
    cy.contains(originData.name).should('be.visible');
  });

  it('[@crud] should create an S3 origin', () => {
    const originData = OriginFactory.createS3Origin();
    
    cy.get('button').contains('Create origin').click();
    OriginPage.fillOriginForm(originData);
    OriginPage.submitCreateOrigin();

    // Verify user sees origin in list
    cy.url().should('include', '/origins');
    cy.contains(originData.name).should('be.visible');
  });

  it('[@crud] should create an API origin with multiple headers', () => {
    const originData = OriginFactory.createApiOrigin();
    
    cy.get('button').contains('Create origin').click();
    OriginPage.fillOriginForm(originData);
    OriginPage.submitCreateOrigin();

    // Verify user sees origin in list
    cy.url().should('include', '/origins');
    cy.contains(originData.name).should('be.visible');
  });
});
