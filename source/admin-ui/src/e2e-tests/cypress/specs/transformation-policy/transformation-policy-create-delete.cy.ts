// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationPolicyPage } from '../../support/pages/TransformationPolicyPage';
import { TransformationPolicyFactory } from '../../support/factories/TransformationPolicyFactory';

describe('Transformation Policy Flow - Create Delete Tests', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    TransformationPolicyPage.navigateToTransformationPolicies();
  });

  it('[@crud] should create and delete a basic transformation policy', () => {
    const policyData = TransformationPolicyFactory.createBasicPolicy({ name: 'Simple Test Policy' });
    
    // Create policy
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    // Verify creation (user sees policy in list)
    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
    
    // Delete policy
    TransformationPolicyPage.deletePolicy(policyData.name);
    
    // Verify deletion (user no longer sees policy in list)
    cy.get('[role="dialog"]').should('not.be.visible');
    cy.get('table').within(() => {
      cy.contains(policyData.name).should('not.exist');
    });
  });
});
