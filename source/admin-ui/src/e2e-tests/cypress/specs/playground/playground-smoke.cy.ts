// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PlaygroundPage } from '../../support/pages/PlaygroundPage';

describe('Playground - Navigation & Page Load', { tags: ['@smoke'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
  });

  it('[@smoke] should navigate to Playground and display all major sections', () => {
    PlaygroundPage.navigateToPlayground();
    cy.url().should('include', '/playground');
    cy.contains('h1', 'Playground').should('be.visible');

    // Action controls
    PlaygroundPage.getImagePathInput().should('be.visible');
    PlaygroundPage.getSendRequestButton().should('be.visible');
    PlaygroundPage.getClearAllButton().should('be.visible');

    // Main sections
    cy.contains('h3', 'Transformations').should('be.visible');
    cy.contains('h3', 'Output Optimizations').should('be.visible');
    cy.contains('h3', 'Advanced Options').should('be.visible');
    cy.contains('h2', 'Image Result').should('be.visible');

    // Initial state
    cy.contains('No Image Loaded').should('be.visible');
    cy.contains('Base URL:').should('be.visible');
  });

  it('[@smoke] should display device and browser presets in Output Optimizations', () => {
    PlaygroundPage.navigateToPlayground();
    cy.contains('Client Hint Presets').click();

    // Device presets
    cy.contains('iPhone 14 Pro').should('exist');
    cy.contains('Desktop 1080p').should('exist');
    cy.contains('Desktop 4K').should('exist');

    // Browser presets
    cy.contains('Chrome Desktop').should('exist');
    cy.contains('Safari iOS').should('exist');
    cy.contains('Legacy Browser').should('exist');
  });
});
