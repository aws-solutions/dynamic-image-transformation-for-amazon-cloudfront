// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PlaygroundPage } from '../../support/pages/PlaygroundPage';
import { TIMEOUTS, PLAYGROUND } from '../../utils/constants';

describe('Playground - Basic Request Flow', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    PlaygroundPage.navigateToPlayground();
  });

  it('[@crud] should display error message when image path is invalid or returns 404', () => {
    PlaygroundPage.fillImagePath('/nonexistent/image.jpg');
    PlaygroundPage.sendRequest();
    cy.contains('Image Load Error', { timeout: TIMEOUTS.LONG }).should('be.visible');
  });

  it('[@crud] should clear image path when Clear All is clicked', () => {
    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();
    cy.contains('Client Response Time').should('be.visible');

    PlaygroundPage.clearAll();

    PlaygroundPage.getImagePathInput().should('have.value', '');
  });
});
