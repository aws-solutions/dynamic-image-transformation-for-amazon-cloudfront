// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginPage } from '../../support/pages/OriginPage';
import { OriginFactory } from '../../support/factories/OriginFactory';

describe('Origin Types - Creation Tests', { tags: ['@smoke', '@crud'] }, () => {
  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
  });

  it('[@smoke] should create a basic origin', () => {
    const originData = OriginFactory.createBasicOrigin();
    OriginPage.provisionOrigin(originData);
  });

  it('[@crud] should create an S3 origin', () => {
    const originData = OriginFactory.createS3Origin();
    OriginPage.provisionOrigin(originData);
  });

  it('[@crud] should create an API origin with multiple headers', () => {
    const originData = OriginFactory.createApiOrigin();
    OriginPage.provisionOrigin(originData);
  });
});
