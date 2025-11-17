// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationPolicyPage } from '../../support/pages/TransformationPolicyPage';
import { TransformationPolicyFactory } from '../../support/factories/TransformationPolicyFactory';

describe('Transformation Policy Types - Creation Tests', { tags: ['@smoke', '@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    TransformationPolicyPage.navigateToTransformationPolicies();
  });
  
  it('[@smoke] should create a simple transformation policy', () => {
    const policyData = TransformationPolicyFactory.createBasicPolicy();
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });
  

  it('[@crud] should create a policy with output optimizations only', () => {
    const policyData = TransformationPolicyFactory.createPolicyWithOutputsOnly();
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });

  it('[@crud] should create a policy with basic transformations only', () => {
    const policyData = TransformationPolicyFactory.createBasicTransformationsPolicy();
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });
  
  it('[@crud] should create a policy with effects transformations', () => {
    const policyData = TransformationPolicyFactory.createEffectsTransformationsPolicy();
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });
  
  it('[@crud] should create a policy with advanced transformations', () => {
    const policyData = TransformationPolicyFactory.createAdvancedTransformationsPolicy();
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });
});
