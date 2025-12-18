// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationPolicyPage } from '../../support/pages/TransformationPolicyPage';
import { TransformationPolicyFactory } from '../../support/factories/TransformationPolicyFactory';

describe('Transformation Policy - Watermark Tests', { tags: ['@crud', '@watermark'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    TransformationPolicyPage.navigateToTransformationPolicies();
  });
  
  it('[@crud] should create a policy with commplete watermark configuration', () => {
    const policyData = TransformationPolicyFactory.createWatermarkPolicy({
      name: `Basic Watermark Policy`
    });
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });

  it('[@crud] should create a policy without opacity and widthRatio', () => {
    const policyData = TransformationPolicyFactory.createWatermarkPolicyWithoutOpacityWidthRatio({
      name: `Watermark Policy Without Opacity`
    });
    
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });
  
});