// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TIMEOUTS } from './constants';

export const AppReady = {
  waitForAppReady(timeout = TIMEOUTS.LONG) {
    cy.get('body', { timeout }).should('be.visible');
    cy.get('body').then(($body) => {
      if ($body.find('[data-app-ready="true"], #app-ready').length > 0) {
        cy.get('[data-app-ready="true"], #app-ready').should('exist');
      }
    });
  },
};
