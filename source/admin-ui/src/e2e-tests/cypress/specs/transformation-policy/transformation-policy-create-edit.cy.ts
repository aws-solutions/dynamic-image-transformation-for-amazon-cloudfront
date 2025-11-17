// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationPolicyPage } from '../../support/pages/TransformationPolicyPage';
import { TransformationPolicyFactory } from '../../support/factories/TransformationPolicyFactory';

describe('Transformation Policy Flow - Create Edit Tests', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    TransformationPolicyPage.navigateToTransformationPolicies();
  });

  it('[@crud] should create and edit a basic transformation policy with output optimization', () => {
    const policyData = TransformationPolicyFactory.createBasicPolicy({ 
      name: 'Test Edit Policy',
      outputs: [{ type: 'webp', config: { quality: 80 } }]
    });
    
    // Create policy
    TransformationPolicyPage.clickCreatePolicy();
    TransformationPolicyPage.fillPolicyForm(policyData);
    TransformationPolicyPage.submitCreatePolicy();

    // Verify creation (user sees policy in list)
    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
    
    // Edit policy
    TransformationPolicyPage.editPolicy(policyData.name);
    
    // Wait for edit form to load
    cy.url().should('include', '/edit');
    
    // Add quality transformation (similar to basic policy from policy-types)
    cy.get('button').contains('Add Transformation').click();
    
    // Wait for transformation selection modal
    cy.get('[role="dialog"]').should('be.visible');
    
    // Click on Quality transformation
    cy.get('[role="dialog"]').first().within(() => {
      cy.contains('strong', 'Quality').click();
    });
    
    // Wait for configuration modal
    cy.contains('Add Transformation - Step 2 of 2').should('be.visible');
    
    // Fill quality value (80)
    cy.get('input[type="number"]').type('80');
    
    // Add to policy
    cy.get('button').contains('Add to Policy').click();
    
    // Wait for modal to close
    cy.get('[role="dialog"]').should('not.be.visible');
    
    TransformationPolicyPage.submitUpdatePolicy();
    
    // Verify update (user sees they're back on policies page with same policy)
    cy.url().should('include', '/transformation-policies');
    cy.contains(policyData.name).should('be.visible');
  });
});
