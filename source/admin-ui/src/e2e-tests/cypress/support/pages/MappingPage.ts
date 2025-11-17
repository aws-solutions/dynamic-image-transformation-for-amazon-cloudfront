// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class MappingPage {
  // Navigation
  static navigateToMappings() {
    cy.get('a[href="/mappings"]').click();
  }

  static clickCreateMapping() {
    cy.get('button').contains('Create mapping').click();
  }

  // Form filling
  static fillMappingForm(data: {
    name: string;
    description?: string;
    hostHeaderPattern?: string;
    pathPattern?: string;
    origin?: string;
    policy?: string;
  }) {

    cy.get('input[placeholder*="mapping name"], input[placeholder*="Mapping name"]').type(data.name, { force: true });
    
    if (data.description) {
      cy.get('textarea[placeholder*="mapping"], textarea[placeholder*="Mapping"]').type(data.description, { force: true });
      cy.get('body').should('be.visible'); // Ensure DOM is stable
    }

    if (data.hostHeaderPattern) {
      cy.get('#mapping-host-pattern').type(data.hostHeaderPattern, { force: true });
    }

    if (data.pathPattern) {
      cy.get('#mapping-path-pattern').type(data.pathPattern, { force: true });
    }

    if (data.origin) {
      cy.get('body').then(() => {
        cy.log('DOM state after description entry');
        cy.get('.awsui_trigger_dwuol_1tb10_172').should('exist').first().click();
        cy.get('[role="option"]').first().click({ force: true });
      });      
    }

    // Select policy
    if (data.policy) {
      cy.log('Selecting policy:', data.policy);
      cy.get('.awsui_trigger_dwuol_1tb10_172').contains('Choose a policy').click();
      cy.get('[role="option"]').first().click({ force: true });
    } else {
      cy.log('No policy specified, skipping policy selection');
    }
  }

  // Actions
  static submitCreateMapping() {
    cy.get('button').contains('Create mapping').click();
  }

  static submitUpdateMapping() {
    cy.get('button').contains('Update mapping').click();
  }

  static editMapping(mappingName: string) {
    // Select the mapping by clicking its radio button - find the row containing the mapping name
    cy.contains('tr', mappingName).find('input[type="radio"]').click();
    
    // Click Edit button
    cy.get('button').contains('Edit').click();
  }

  static deleteMapping(mappingName: string) {
    // Select the mapping by clicking its radio button
    cy.contains('a span[style*="color: black"]', mappingName).closest('tr').find('input[type="radio"]').click();
    
    // Click Delete button
    cy.get('button').contains('Delete').click();
    
    // Confirm deletion in modal
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').within(() => {
      cy.get('button').contains('Delete').click();
    });
  }

  // Getters for direct access in tests
  static getMappingDescriptionInput() {
    return cy.get('textarea[placeholder*="mapping"], textarea[placeholder*="Mapping"]');
  }

  static getHostHeaderPatternInput() {
    return cy.get('input[placeholder*="host"], input[placeholder*="Host"]');
  }

  static getPathPatternInput() {
    return cy.get('input[placeholder*="path"], input[placeholder*="Path"]');
  }

  static selectFirstPolicy() {
    cy.get('.awsui_trigger_dwuol_1tb10_172').contains('Choose a policy').click();
    cy.get('[role="option"]').first().click({ force: true });
  }
}
