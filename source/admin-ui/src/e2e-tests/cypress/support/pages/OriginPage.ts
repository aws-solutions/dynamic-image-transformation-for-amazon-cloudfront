// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0


export class OriginPage {
  // Only keep getOriginPathInput as it's used directly in tests
  static getOriginPathInput() {
    return cy.get('#origin-path');
  }

  // Actions (only the methods actually used in tests)
  static fillOriginForm(data: {
    name: string;
    domain: string;
    path?: string;
    headers?: Array<{ name: string; value: string }>;
  }) {
    cy.get('#origin-name').type(data.name);
    // Blur the domain field after typing so the onBlur handler in CreateOrigin.tsx calls
    // validateField('originDomain', ...) synchronously, reaching its final stable state before
    // any subsequent button assertions or clicks.
    cy.get('#origin-domain').type(data.domain).blur();

    if (data.path) {
      cy.get('#origin-path').type(data.path);
    }

    if (data.headers) {
      data.headers.forEach((header, index) => {
        cy.get('button').contains('Add header').click();
        cy.get('input[placeholder="Enter header name"]').eq(index).type(header.name);
        cy.get('input[placeholder="Enter header value"]').eq(index).type(header.value);
      });
    }
  }

  static submitCreateOrigin() {
    cy.get('button').contains('Create origin').should('not.be.disabled').click();
  }

  /**
   * Self-contained origin provisioning helper. Registers the POST intercept BEFORE any
   * click so the network request is never missed. Flow: navigate to create form →
   * fill form (type name, type domain, blur) → assert not-disabled → click submit →
   * wait 201 → assert list URL.
   *
   * Callers MUST already be on the app home page (i.e. cy.visit(appUrl) done beforehand).
   */
  static provisionOrigin(data: {
    name: string;
    domain: string;
    path?: string;
    headers?: Array<{ name: string; value: string }>;
  }) {
    // Register intercept first — must precede the action that triggers the POST.
    cy.intercept('POST', '**/origins').as('provisionOrigin');
    cy.get('button').contains('Create origin').click();
    OriginPage.fillOriginForm(data);
    // submitCreateOrigin asserts not-disabled, then clicks.
    OriginPage.submitCreateOrigin();
    cy.wait('@provisionOrigin').its('response.statusCode').should('eq', 201);
    cy.url().should('match', /\/origins$/);
    cy.contains(data.name).should('be.visible');
  }

  static submitUpdateOrigin() {
    cy.get('button').contains('Update origin').click();
  }

  static editOrigin(originName: string) {
    // Select the origin by clicking its radio button
    cy.contains('a span[style*="color: black"]', originName).closest('tr').find('input[type="radio"]').click();
    
    // Click Edit button
    cy.get('button').contains('Edit').click();
  }

  static deleteOrigin(originName: string) {
    // Select the origin by clicking its radio button
    cy.contains('a span[style*="color: black"]', originName).closest('tr').find('input[type="radio"]').click();
    
    // Click Delete button
    cy.get('button').contains('Delete').click();
    
    // Confirm deletion in modal
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').within(() => {
      cy.get('button').contains('Delete').click();
    });
  }
}
