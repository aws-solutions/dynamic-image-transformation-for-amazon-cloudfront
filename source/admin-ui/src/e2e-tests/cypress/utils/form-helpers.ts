// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TIMEOUTS } from './constants';

export const FormHelpers = {
  
  clickButton(selector: string, options = {}) {
    const defaultOptions = { timeout: TIMEOUTS.MEDIUM, force: false };
    const opts = { ...defaultOptions, ...options };
    
    cy.get(selector, { timeout: opts.timeout })
      .first()
      .click({ force: opts.force });
  }
};
