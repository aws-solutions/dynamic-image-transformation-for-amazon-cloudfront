// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TIMEOUTS } from '../../utils/constants';

export class PlaygroundPage {
  static navigateToPlayground() {
    cy.get('nav').contains('Playground').click();
    cy.url({ timeout: TIMEOUTS.MEDIUM }).should('include', '/playground');
  }

  static getImagePathInput() {
    return cy.get('input[placeholder="/images/photo.jpg"]');
  }

  static getSendRequestButton() {
    return cy.get('button').contains('Send Request');
  }

  static getClearAllButton() {
    return cy.get('button').contains('Clear All');
  }

  static fillImagePath(path: string) {
    this.getImagePathInput().clear().type(path);
  }

  static sendRequest() {
    this.getSendRequestButton().click();
  }

  static clearAll() {
    this.getClearAllButton().click();
  }

  static waitForImageLoad() {
    cy.get('img[alt="Dynamic Image Transformation Result"]', { timeout: TIMEOUTS.IMAGE_LOAD }).should('be.visible');
  }
}
