// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TIMEOUTS, WAITS } from './constants';
import { AppReady } from './app-ready';

export const Navigation = {
  waitForUrl(urlPattern: string, timeout = TIMEOUTS.REDIRECT) {
    cy.url({ timeout }).should('include', urlPattern);
  },

  ensureNotOnUrl(urlPattern: string) {
    cy.url().should('not.include', urlPattern);
  },

  waitForPageLoad() {
    cy.get('body').should('be.visible');
  },

  visitAndWait(url: string) {
    cy.visit(url);
    this.waitForPageLoad();
    AppReady.waitForAppReady();
  },

  waitForAuthenticatedApp() {
    this.waitForUrl('cloudfront.net');
    AppReady.waitForAppReady();
    cy.wait(2000);
  }
};
