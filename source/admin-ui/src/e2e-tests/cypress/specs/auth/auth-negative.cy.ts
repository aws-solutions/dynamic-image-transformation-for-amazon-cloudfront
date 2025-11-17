// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

describe('Authentication - Negative Tests', { tags: ['@auth', '@negative'] }, () => {
  it('should show error for invalid credentials', () => {
    cy.loginAttempt('invalidUser');
    cy.origin(Cypress.env('cognitoOrigin'), () => {
      cy.contains('Invalid input: User does not exist.').should('be.visible');
    });
  });

  it('should show error for invalid password', () => {
    cy.loginAttempt('invalidPasswordUser');
    cy.origin(Cypress.env('cognitoOrigin'), () => {
      cy.contains('Invalid input: Incorrect username or password.').should('be.visible');
    });
  });

  it('should show error for empty username field', () => {
    cy.visit(Cypress.env('appUrl'));
    
    cy.origin(Cypress.env('cognitoOrigin'), () => {
      Cypress.on('uncaught:exception', (err) => {
        if (err.message.includes('Minified React error')) {
          return false;
        }
        return true;
      });
      
      cy.fixture('seeds/users').then((users) => {
        cy.get('input[name="password"]').type(users.testUser.password);
        cy.get('button[type="submit"]').click();
        
        cy.contains('Missing email address.').should('be.visible');
      });
    });
  });

  it('should show error for empty password field', () => {
    cy.visit(Cypress.env('appUrl'));
    
    cy.origin(Cypress.env('cognitoOrigin'), () => {
      Cypress.on('uncaught:exception', (err) => {
        if (err.message.includes('Minified React error')) {
          return false;
        }
        return true;
      });
      
      cy.fixture('seeds/users').then((users) => {
        cy.get('input[name="username"]').type(users.testUser.email);
        cy.get('button[type="submit"]').click();
        
        cy.contains('Missing password.').should('be.visible');
      });
    });
  });

  it('should show error for both fields empty', () => {
    cy.visit(Cypress.env('appUrl'));
    
    cy.origin(Cypress.env('cognitoOrigin'), () => {
      Cypress.on('uncaught:exception', (err) => {
        if (err.message.includes('Minified React error')) {
          return false;
        }
        return true;
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.contains('Missing email address.').should('be.visible');
      cy.contains('Missing password.').should('be.visible');
    });
  });

  it('should show error for invalid email format', () => {
    cy.loginAttempt('invalidEmailUser');
    cy.origin(Cypress.env('cognitoOrigin'), () => {
      cy.contains('Invalid email address.').should('be.visible');
    });
  });
});
