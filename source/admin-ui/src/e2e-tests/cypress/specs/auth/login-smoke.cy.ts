// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Navigation } from "../../utils/navigation";
import { URLS } from "../../utils/urls";
import { MainPageSelectors } from '../../support/selectors';
import { TIMEOUTS } from '../../utils/constants';

describe('Authentication', { tags: ['@smoke'] }, () => {
  it('logs in successfully', () => {
    cy.authenticateUser();
    Navigation.ensureNotOnUrl(URLS.COGNITO_DOMAIN);
    cy.visit(Cypress.env('appUrl'));
    cy.get('button', { timeout: TIMEOUTS.MEDIUM }).contains(MainPageSelectors.CREATE_ORIGIN_BUTTON).should('be.visible');
  });
});
