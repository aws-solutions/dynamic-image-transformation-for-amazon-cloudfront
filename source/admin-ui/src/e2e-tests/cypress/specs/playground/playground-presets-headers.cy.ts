// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PlaygroundPage } from '../../support/pages/PlaygroundPage';
import { PLAYGROUND } from '../../utils/constants';

describe('Playground - Presets & Custom Headers', { tags: ['@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    PlaygroundPage.navigateToPlayground();
    cy.intercept('GET', '**/test-images/**').as('imageRequest');
  });

  it('[@crud] should apply device preset and get a successful response', () => {
    cy.contains('Client Hint Presets').click();
    cy.contains('iPhone 14 Pro').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').then(({ request }) => {
      expect(request.headers['x-dit-sim-viewport']).to.equal('480');
      expect(request.headers['x-dit-sim-dpr']).to.equal('3');
    });
  });

  it('[@crud] should apply browser preset and get a successful response', () => {
    cy.contains('Client Hint Presets').click();
    cy.contains('Chrome Desktop').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').then(({ request }) => {
      expect(request.headers['accept']).to.include('image/avif');
    });
  });

  it('[@crud] should combine device and browser presets and get a successful response', () => {
    cy.contains('Client Hint Presets').click();
    cy.contains('iPhone 14 Pro').click();
    cy.contains('Chrome Desktop').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').then(({ request }) => {
      expect(request.headers['x-dit-sim-viewport']).to.equal('480');
      expect(request.headers['x-dit-sim-dpr']).to.equal('3');
      expect(request.headers['accept']).to.include('image/avif');
    });
  });

  it('[@crud] should reset presets when Clear All is clicked', () => {
    cy.contains('Client Hint Presets').click();
    cy.contains('iPhone 14 Pro').click();

    PlaygroundPage.clearAll();

    cy.contains('Client Hint Presets').click();
    cy.get('input[type="radio"][value="none"]').first().should('be.checked');
  });

  it('[@crud] should send custom headers with the request and get a successful response', () => {
    cy.contains('h3', 'Advanced Options').scrollIntoView().should('be.visible');
    cy.get('input[type="text"]').then(($inputs) => {
      const allInputs = $inputs.toArray();
      const emptyInputs = allInputs.filter(el => el.value === '' && el.type === 'text');
      expect(emptyInputs.length).to.be.at.least(2, 'Expected at least 2 empty text inputs for custom headers');
      cy.wrap(emptyInputs[emptyInputs.length - 2]).type('X-Custom-Test', { force: true });
      cy.wrap(emptyInputs[emptyInputs.length - 1]).type('test-value', { force: true });
    });

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').then(({ request }) => {
      expect(request.headers['x-custom-test']).to.equal('test-value');
    });
  });
});
