// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TIMEOUTS } from './constants';
import { URLS } from './urls';
import { MainPageSelectors } from '../support/selectors';

export const Validations = {
  elementExists(selector: string, timeout = TIMEOUTS.MEDIUM) {
    cy.get(selector, { timeout }).should('exist').should('be.visible');
  },

  elementContainsText(selector: string, text: string, timeout = TIMEOUTS.MEDIUM) {
    cy.get(selector, { timeout }).should('contain.text', text);
  },

  buttonContainsText(text: string, timeout = TIMEOUTS.MEDIUM) {
    cy.get('button', { timeout }).contains(text).should('be.visible');
  },

  loginSuccess() {
    this.buttonContainsText(MainPageSelectors.CREATE_ORIGIN_BUTTON);
  },

  logoutSuccess() {
    cy.url().should('include', URLS.LOGOUT_COMPLETE);
  }
};
