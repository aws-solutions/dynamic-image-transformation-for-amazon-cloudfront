// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingPage } from '../../support/pages/MappingPage';
import { MappingFactory } from '../../support/factories/MappingFactory';
import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';
import { TransformationPolicyPage } from '../../support/pages/TransformationPolicyPage';
import { TransformationPolicyFactory } from '../../support/factories/TransformationPolicyFactory';

describe('Mapping Types - Creation Tests', { tags: ['@smoke', '@crud'] }, () => {
  let originData: ReturnType<typeof OriginFactory.createBasicOrigin>;
  let policyData: ReturnType<typeof TransformationPolicyFactory.createBasicPolicy>;

  before(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));

    // Provision origin
    originData = OriginFactory.createBasicOrigin();
    OriginPage.provisionOrigin(originData);

    // Provision policy
    policyData = TransformationPolicyFactory.createBasicPolicy();
    cy.intercept('POST', '**/policies').as('provisionPolicy');
    TransformationPolicyPage.navigateToTransformationPolicies();
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();
    cy.wait('@provisionPolicy').its('response.statusCode').should('eq', 201);
    cy.url().should('match', /\/transformation-policies$/);
    cy.contains(policyData.name).should('be.visible');
  });

  after(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));

    // Clean up policy
    TransformationPolicyPage.navigateToTransformationPolicies();
    TransformationPolicyPage.deletePolicy(policyData.name);

    // Clean up origin
    cy.visit(Cypress.env('appUrl'));
    OriginPage.deleteOrigin(originData.name);
  });

  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    MappingPage.navigateToMappings();
  });

  it('[@smoke] should create a mapping with host header pattern', () => {
    const mappingData = MappingFactory.createHostHeaderPatternMapping({ origin: originData.name });

    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify user sees mapping in list
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });

  it('[@crud] should create a mapping with path pattern only', () => {
    const mappingData = MappingFactory.createPathPatternMapping({ origin: originData.name });

    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify user sees mapping in list
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });

  it('[@crud] should create a mapping with policy', () => {
    const mappingData = MappingFactory.createPolicyMapping({ origin: originData.name, policy: policyData.name });

    MappingPage.clickCreateMapping();
    MappingPage.fillMappingForm(mappingData);
    MappingPage.submitCreateMapping();

    // Verify user sees mapping in list
    cy.url().should('include', '/mappings');
    cy.contains(mappingData.name).should('be.visible');
  });
});
