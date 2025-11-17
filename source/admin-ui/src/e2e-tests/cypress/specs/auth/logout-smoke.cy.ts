// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { URLS } from "../../utils/urls";

describe('Logout', { tags: ['@smoke'] }, () => {
  it('logs out successfully', () => {
    cy.authenticateUser();
    cy.logoutUser();
    cy.url().should('include', URLS.LOGOUT_COMPLETE);
  });
});
