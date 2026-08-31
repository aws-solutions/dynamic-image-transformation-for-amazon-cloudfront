// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PlaygroundPage } from '../../support/pages/PlaygroundPage';
import { TIMEOUTS, PLAYGROUND } from '../../utils/constants';

describe('Playground - Optimization Impact', { tags: ['@crud'] }, () => {
  // First playground spec alphabetically — gates the whole island. Fixtures are provisioned
  // at t=0 in the before:run hook (see plugins/index.ts + tasks/playground.ts); here we just
  // (a) wait for the config change to finish propagating to ECS via a freshness-keyed poll,
  // and (b) mint a fresh token so the island starts maximally fresh. Both run once for the
  // whole playground suite.
  before(() => {
    cy.task('playground:awaitReady', {}, { timeout: 15 * 60 * 1000 });
    cy.authenticateFresh();
  });

  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    PlaygroundPage.navigateToPlayground();
  });

  it('[@crud] should display optimization impact metrics after a successful authenticated request', () => {
    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    // Performance Metrics
    cy.contains('Performance Metrics').should('be.visible');
    cy.contains('Client Response Time').should('be.visible');
    cy.contains('Origin Fetch').should('exist');
    cy.contains('Transformation').should('exist');
    cy.contains('Total Server Time').should('exist');

    // Optimization Impact
    cy.contains('Optimization Impact', { timeout: TIMEOUTS.MEDIUM }).should('be.visible');
    cy.contains('Original Size').should('be.visible');
    cy.contains('Output Size').should('be.visible');
    cy.contains('Size Reduction').should('be.visible');
    cy.contains('Original Dimensions').should('exist');
    cy.contains('Output Dimensions').should('exist');
    cy.contains('Format Changed').should('be.visible');
  });
});
