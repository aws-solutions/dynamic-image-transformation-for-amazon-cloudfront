// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { FormHelpers } from '../../utils/form-helpers';
import { Navigation } from '../../utils/navigation';
import { Validations } from '../../utils/validations';
import { URLS } from '../../utils/urls';
import { MainPageSelectors } from '../selectors';

declare global {
  namespace Cypress {
    interface Chainable {
      authenticateUser(userType?: string): Chainable<void>;
      loginAttempt(userType: string): Chainable<void>;
      logoutUser(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('authenticateUser', (userType = 'testUser') => {
  cy.session([userType], () => {
    cy.visit(Cypress.env('appUrl'));
    
    cy.origin(Cypress.env('cognitoOrigin'), { args: { userType } }, ({ userType }) => {
      Cypress.on('uncaught:exception', (err) => {
        if (err.message.includes('Minified React error')) {
          return false;
        }
        return true;
      });
      
      cy.url({ timeout: 15000 }).should('include', 'amazoncognito.com');
      cy.get('body').should('be.visible');
      
      cy.get('input[name="username"]', { timeout: 15000 }).should('be.visible');
      
      cy.fixture('seeds/users').then((users) => {
        const user = users[userType];
        
        cy.get('input[name="username"]')
          .should('be.enabled')
          .clear()
          .type(user.email, { delay: 50 });
        
        cy.get('input[name="password"]')
          .should('be.visible')
          .should('be.enabled')
          .clear()
          .type(userType === 'testUser' ? (Cypress.env('USER_PASSWORD') || user.password) : user.password, { delay: 50 });
      });
      
      cy.get('button[type="submit"]').should('be.visible').click();
    });
    
    Navigation.waitForAuthenticatedApp();
    Validations.loginSuccess();
    Navigation.ensureNotOnUrl(URLS.COGNITO_DOMAIN);
  });
});

Cypress.Commands.add('loginAttempt', (userType) => {
  cy.visit(Cypress.env('appUrl'));
  
  cy.origin(Cypress.env('cognitoOrigin'), { args: { userType } }, ({ userType }) => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('Minified React error')) {
        return false;
      }
      return true;
    });
    
    cy.url({ timeout: 15000 }).should('include', 'amazoncognito.com');
    cy.get('body').should('be.visible');
    
    cy.get('input[name="username"]', { timeout: 15000 }).should('be.visible');
    
    cy.fixture('seeds/users').then((users) => {
      const user = users[userType];
      
      cy.get('input[name="username"]')
        .should('be.enabled')
        .clear()
        .type(user.email, { delay: 50 });
      
      cy.get('input[name="password"]')
        .should('be.visible')
        .should('be.enabled')
        .clear()
        .type(userType === 'testUser' ? (Cypress.env('USER_PASSWORD') || user.password) : user.password, { delay: 50 });
    });
    
    cy.get('button[type="submit"]').should('be.visible').click();
  });
});

Cypress.Commands.add('logoutUser', () => {
  Navigation.visitAndWait(Cypress.env('appUrl'));
  
  FormHelpers.clickButton(MainPageSelectors.USER_DROPDOWN, { force: true });
  
  FormHelpers.clickButton(MainPageSelectors.SIGN_OUT_MENU, { force: true });
  
  Validations.logoutSuccess();
});
