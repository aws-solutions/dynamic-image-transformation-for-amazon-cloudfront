// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PlaygroundPage } from '../../support/pages/PlaygroundPage';
import { PLAYGROUND } from '../../utils/constants';

describe('Playground - Transformations', { tags: ['@crud'] }, () => {
  before(() => {
    cy.task('playground:getBucketInfo').then((info: any) => {
      // Bucket + config fixtures are provisioned at t=0 in the before:run hook (plugins/index.ts).
      if (!info) throw new Error('Playground fixtures missing — before:run provisioning did not run');
      Cypress.env('playgroundBucketDomain', info.bucketDomain);
      Cypress.env('playgroundBucketName', info.bucketName);
    });
  });

  beforeEach(() => {
    cy.authenticateUser();
    cy.visit(Cypress.env('appUrl'));
    PlaygroundPage.navigateToPlayground();
    cy.intercept('GET', '**/test-images/**').as('imageRequest');
  });

  it('[@crud] should apply grayscale transformation and get a successful response', () => {
    cy.contains('Color & Filters').click();
    cy.contains('Grayscale').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'grayscale=true');
  });

  it('[@crud] should apply resize transformation and get a successful response', () => {
    cy.contains('Resize').click();
    cy.get('input[placeholder="e.g. 400"]').first().type('200');
    cy.get('input[placeholder="e.g. 300"]').first().type('200', { force: true });

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').then(({ request }) => {
      expect(request.url).to.include('resize.width=200');
      expect(request.url).to.include('resize.height=200');
    });
  });

  it('[@crud] should apply format conversion and verify output format', () => {
    cy.contains('Format & Quality').click();
    cy.contains('Not set').click();
    cy.get('[role="option"]').contains('WebP').click({ force: true });

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();
    cy.contains('WEBP').should('exist');

    cy.wait('@imageRequest').its('request.url').should('include', 'format=webp');
  });

  it('[@crud] should apply multiple transformations simultaneously and get a successful response', () => {
    cy.contains('Resize').click();
    cy.get('input[placeholder="e.g. 400"]').first().type('300');

    cy.contains('Color & Filters').click();
    cy.contains('Grayscale').click();

    cy.contains('Format & Quality').click();
    cy.get('input[placeholder="1-100"]').type('70');

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').then(({ request }) => {
      expect(request.url).to.include('resize.width=300');
      expect(request.url).to.include('grayscale=true');
      expect(request.url).to.include('quality=70');
    });
  });

  it('[@crud] should apply smart crop simple mode and get a successful response', () => {
    cy.contains('Smart Crop').click();
    cy.contains('Simple (Face Detection)').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'smartCrop=true');
  });

  it('[@crud] should apply content moderation simple mode and get a successful response', () => {
    cy.contains('Content Moderation').click();
    cy.contains('Simple (blur all inappropriate content)').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'contentModeration=true');
  });

  it('[@crud] should apply watermark and get a successful response', () => {
    const watermarkUrl = `https://${Cypress.env('playgroundBucketDomain')}/test-images/aws_logo.png`;

    cy.contains('Watermark').click();
    cy.get('input[placeholder="https://example.com/logo.png"]').type(watermarkUrl);
    cy.get('input[placeholder="10 or 50p"]').first().type('10');
    cy.get('input[placeholder="10 or 50p"]').eq(1).type('10');
    cy.get('input[placeholder="0.3"]').first().type('0.3');

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'watermark%5B0%5D=');
  });

  it('[@crud] should apply blur and get a successful response', () => {
    cy.contains('Advanced').click();
    cy.get('input[placeholder="0.3-1000"]').type('5');

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'blur=5');
  });

  it('[@crud] should apply rotate and get a successful response', () => {
    cy.contains('Operations').click();
    cy.get('input[placeholder="0-360"]').type('90');

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'rotate=90');
  });

  it('[@crud] should apply flip and get a successful response', () => {
    cy.contains('Operations').click();
    cy.contains('Flip (vertical)').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'flip=true');
  });

  it('[@crud] should apply flop and get a successful response', () => {
    cy.contains('Operations').click();
    cy.contains('Flop (horizontal)').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'flop=true');
  });

  it('[@crud] should apply sharpen and get a successful response', () => {
    cy.contains('Advanced').click();
    cy.contains('Sharpen').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'sharpen.sigma=1');
  });

  it('[@crud] should apply normalize and get a successful response', () => {
    cy.contains('Color & Filters').click();
    cy.contains('Normalize').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'normalize=true');
  });

  it('[@crud] should apply tint and get a successful response', () => {
    cy.contains('Color & Filters').click();
    cy.get('input[placeholder="#FF0000"]').type('#FF0000');

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'tint=%23FF0000');
  });

  it('[@crud] should apply strip EXIF and get a successful response', () => {
    cy.contains('Advanced').click();
    cy.contains('Strip EXIF metadata').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'stripExif=true');
  });

  it('[@crud] should apply strip ICC and get a successful response', () => {
    cy.contains('Advanced').click();
    cy.contains('Strip ICC profile').click();

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'stripIcc=true');
  });

  it('[@crud] should apply convolve and get a successful response', () => {
    cy.contains('Convolve').click();
    cy.get('input[placeholder="-1,0,1,-2,0,2,-1,0,1"]').type('-1,0,1,-2,0,2,-1,0,1');

    PlaygroundPage.fillImagePath(PLAYGROUND.TEST_IMAGE_PATH);
    PlaygroundPage.sendRequest();
    PlaygroundPage.waitForImageLoad();

    cy.wait('@imageRequest').its('request.url').should('include', 'convolve.width=3');
  });
});
