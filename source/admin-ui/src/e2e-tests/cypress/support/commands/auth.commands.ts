// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { FormHelpers } from '../../utils/form-helpers';
import { Navigation } from '../../utils/navigation';
import { Validations } from '../../utils/validations';
import { URLS } from '../../utils/urls';
import { TIMEOUTS } from '../../utils/constants';
import { MainPageSelectors } from '../selectors';

/**
 * cy.session validate callback. A URL check alone can pass while the restored
 * Cognito token is silently dead, so we fire a real authenticated call against the Admin
 * API and assert 200. If this throws, Cypress silently re-runs the login setup, so an
 * expired token triggers a single invisible re-login at the spec boundary rather than a
 * hard redirect to the Cognito hosted UI that breaks the rest of the run.
 */
function validateAuthenticatedSession() {
  cy.visit(Cypress.env('appUrl'));
  // If the token is dead the app hard-redirects to the Cognito hosted UI; assert we stayed.
  cy.url({ timeout: TIMEOUTS.LONG }).should('include', 'cloudfront.net');

  cy.window().then((win) => {
    // The app pins Amplify's token store to sessionStorage (index.tsx:55 —
    // cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)), NOT localStorage.
    // Key format: CognitoIdentityServiceProvider.<clientId>.<user>.accessToken.
    const store = win.sessionStorage;
    const accessTokenKey = Object.keys(store).find((k) => k.endsWith('.accessToken'));
    if (!accessTokenKey) {
      throw new Error('No Amplify access token in sessionStorage — restored session is invalid');
    }
    const accessToken = store.getItem(accessTokenKey);
    const apiEndpoint = String(Cypress.env('apiEndpoint') || '').replace(/\/$/, '');

    return cy
      .request({
        method: 'GET',
        url: `${apiEndpoint}/origins`,
        headers: { Authorization: `Bearer ${accessToken}` },
        failOnStatusCode: false,
      })
      .then((resp) => {
        expect(resp.status, 'restored session should authenticate against Admin API').to.eq(200);
      });
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      authenticateUser(userType?: string): Chainable<void>;
      authenticateFresh(userType?: string): Chainable<void>;
      loginAttempt(userType: string, password?: string): Chainable<void>;
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
      cy.get('button[type="submit"]').should('be.visible').and('be.enabled');
      cy.contains('Show password').should('be.visible');
      
      cy.fixture('seeds/users').then((users) => {
        const user = users[userType];
        const password = Cypress.env('USER_PASSWORD');
        if (!password) {
          throw new Error('USER_PASSWORD Cypress env var is required');
        }
        
        cy.get('input[name="username"]')
          .should('be.enabled')
          .clear()
          .type(user.email);

        cy.get('input[name="password"]')
          .should('be.visible')
          .should('be.enabled')
          .clear()
          .type(password);
      });

      cy.get('button[type="submit"]').should('be.visible').click();
    });

    Navigation.waitForAuthenticatedApp();
    Validations.loginSuccess();
    Navigation.ensureNotOnUrl(URLS.COGNITO_DOMAIN);
  }, {
    // Reuse one healthy session across all ~18 spec files (avoids a hosted-UI login per
    // spec, cutting suite runtime), and validate it on restore so a silently-expired token
    // triggers a single invisible re-login instead of cascading failures.
    cacheAcrossSpecs: true,
    validate: validateAuthenticatedSession,
  });
});

/**
 * Mint a maximally-fresh token before the ~5-6 min playground island. The cached
 * session's validate callback only runs at spec boundaries, so it cannot catch a token that
 * expires mid-spec. Clearing the cached session forces authenticateUser's setup to re-run,
 * so the island starts with a brand-new token. With the app-client TTL at 60 min (confirmed
 * via DescribeUserPoolClient) a fresh token trivially outlives the suite — no mid-suite refresh needed.
 */
Cypress.Commands.add('authenticateFresh', (userType = 'testUser') => {
  Cypress.session.clearAllSavedSessions();
  cy.authenticateUser(userType);
});

Cypress.Commands.add('loginAttempt', (userType, passwordOverride?) => {
  cy.visit(Cypress.env('appUrl'));
  
  cy.origin(Cypress.env('cognitoOrigin'), { args: { userType, passwordOverride } }, ({ userType, passwordOverride }) => {
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
      const password = passwordOverride ?? Cypress.env('USER_PASSWORD');
      if (!password) {
        throw new Error('USER_PASSWORD Cypress env var is required');
      }
      
      // Re-query immediately before each action to avoid stale DOM references
      // when the Cognito hosted UI re-renders between commands (detached-DOM race)
      cy.get('input[name="username"]').should('be.visible').should('be.enabled').clear();
      cy.get('input[name="username"]').should('be.visible').type(user.email, { delay: 50 });
      
      cy.get('input[name="password"]').should('be.visible').should('be.enabled').clear();
      cy.get('input[name="password"]').should('be.visible').type(password, { delay: 50 });
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
