// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient as AWSDynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { TEST_POLICY_ID, TEST_THUMBNAIL_POLICY_ID, TEST_SMARTCROP_POLICY_ID, TEST_MODERATION_POLICY_ID, TEST_AUTO_FORMAT_POLICY_ID, TEST_ORIGIN_ID, TEST_MAPPING_ID, TEST_EXTERNAL_ORIGIN_ID, TEST_EXTERNAL_MAPPING_ID, TEST_FORMAT_FALLBACK_POLICY_ID, TEST_QUALITY_FALLBACK_POLICY_ID, TEST_AUTOSIZE_FALLBACK_POLICY_ID, TEST_NO_FALLBACK_POLICY_ID } from './test-constants';

// Every fixed ID a full seed can create. Used by standalone teardown, which runs in a
// fresh process with no in-memory record of what was seeded.
const ALL_TEST_IDS = [
  TEST_POLICY_ID, TEST_THUMBNAIL_POLICY_ID, TEST_SMARTCROP_POLICY_ID, TEST_MODERATION_POLICY_ID,
  TEST_AUTO_FORMAT_POLICY_ID, TEST_FORMAT_FALLBACK_POLICY_ID, TEST_QUALITY_FALLBACK_POLICY_ID,
  TEST_AUTOSIZE_FALLBACK_POLICY_ID, TEST_NO_FALLBACK_POLICY_ID, TEST_ORIGIN_ID, TEST_MAPPING_ID,
  TEST_EXTERNAL_ORIGIN_ID, TEST_EXTERNAL_MAPPING_ID
];

export class DynamoDBClient {
  private docClient: DynamoDBDocumentClient;
  private testRunId = `e2e-${Date.now()}`;
  private createdIds: string[] = [];

  constructor(private region: string, private tableName: string) {
    const ddbClient = new AWSDynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(ddbClient);
  }

  async seedTestData(): Promise<{ policyId: string; originId: string; mappingId: string }> {
    console.log('Seeding DynamoDB test data...');
    const policyId = await this.seedDefaultPolicy();
    await this.seedThumbnailPolicy();
    await this.seedSmartCropPolicy();
    await this.seedModerationPolicy();
    await this.seedAutoFormatPolicy();
    await this.seedFormatFallbackPolicy();
    await this.seedQualityFallbackPolicy();
    await this.seedAutosizeFallbackPolicy();
    await this.seedNoFallbackPolicy();
    const originId = await this.seedOrigins();
    const mappingId = await this.seedMappings(originId, policyId);
    console.log(`✓ Test data seeded: policy=${policyId}, origin=${originId}, mapping=${mappingId}`);
    return { policyId, originId, mappingId };
  }

  async seedExternalOrigin(externalOriginUrl: string): Promise<{ originId: string; mappingId: string }> {
    console.log(`Seeding external origin: ${externalOriginUrl}`);
    const originId = TEST_EXTERNAL_ORIGIN_ID;
    const mappingId = TEST_EXTERNAL_MAPPING_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(originId, mappingId);

    const url = new URL(externalOriginUrl);
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: originId,
        GSI1PK: 'ORIGIN',
        GSI1SK: 'e2e-external-origin',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          originName: 'e2e-external-origin',
          originDomain: url.hostname,
          originPath: url.pathname || '/'
        }
      }
    }));

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: mappingId,
        GSI1PK: 'PATH_MAPPING',
        GSI1SK: '/external/*',
        GSI2PK: `ORIGIN#${originId}`,
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          mappingName: 'e2e-external-mapping',
          description: '',
          originId
        }
      }
    }));

    console.log(`✓ External origin seeded: origin=${originId}, mapping=${mappingId}`);
    return { originId, mappingId };
  }

  private async seedDefaultPolicy(): Promise<string> {
    const policyId = TEST_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating default policy: ${policyId}`);

    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: 'quality', value: 85 }
      ]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'e2e-default-policy',
        GSI2PK: 'DEFAULT_POLICY',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: 'e2e-default-policy',
          description: '',
          policyJSON,
          isDefault: true
        }
      }
    }));

    console.log(`  ✓ Default policy created`);
    return policyId;
  }

  private async seedThumbnailPolicy(): Promise<string> {
    const policyId = TEST_THUMBNAIL_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating thumbnail policy: ${policyId}`);

    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: 'resize', value: { width: 100, height: 100, fit: 'cover' } }
      ]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'thumbnail',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: 'thumbnail',
          description: '',
          policyJSON,
          isDefault: false
        }
      }
    }));

    console.log(`  ✓ Thumbnail policy created`);
    return policyId;
  }

  private async seedSmartCropPolicy(): Promise<string> {
    const policyId = TEST_SMARTCROP_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating smart-crop policy: ${policyId}`);

    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: 'smartCrop', value: { faces: true, aspectRatio: '4:3', padding: '5%' } }
      ]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'smartcrop-e2e',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: 'smartcrop-e2e',
          description: '',
          policyJSON,
          isDefault: false
        }
      }
    }));

    console.log(`  ✓ Smart-crop policy created`);
    return policyId;
  }

  private async seedModerationPolicy(): Promise<string> {
    const policyId = TEST_MODERATION_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating moderation policy: ${policyId}`);

    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: 'contentModeration', value: { blur: 200, minConfidence: 30 } }
      ]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'moderation-e2e',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: 'moderation-e2e',
          description: '',
          policyJSON,
          isDefault: false
        }
      }
    }));

    console.log(`  ✓ Moderation policy created`);
    return policyId;
  }

  private async seedAutoFormatPolicy(): Promise<string> {
    const policyId = TEST_AUTO_FORMAT_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating auto-format policy: ${policyId}`);

    const policyJSON = JSON.stringify({
      transformations: [],
      outputs: [{ type: 'format', value: 'auto' }]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'auto-format-e2e',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: 'auto-format-e2e',
          description: '',
          policyJSON,
          isDefault: false
        }
      }
    }));

    console.log(`  ✓ Auto-format policy created`);
    return policyId;
  }

  private async seedFormatFallbackPolicy(): Promise<string> {
    const policyId = TEST_FORMAT_FALLBACK_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating format-fallback policy: ${policyId}`);

    // format=auto + fallback.format=jpeg: when dit-accept absent, image is converted to jpeg
    const policyJSON = JSON.stringify({
      outputs: [{ type: 'format', value: 'auto', fallback: { format: 'jpeg' } }]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'format-fallback',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: { policyName: 'format-fallback', policyJSON, isDefault: false }
      }
    }));

    console.log(`  ✓ Format-fallback policy created`);
    return policyId;
  }

  private async seedQualityFallbackPolicy(): Promise<string> {
    const policyId = TEST_QUALITY_FALLBACK_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating quality-fallback policy: ${policyId}`);

    // quality=[90,[1,2,90],[2,3,80]] + fallback.dpr=2.5: when dit-dpr absent, DPR 2.5 maps to quality 80
    const policyJSON = JSON.stringify({
      outputs: [{ type: 'quality', value: [90, [1, 2, 90], [2, 3, 80]], fallback: { dpr: 2.5 } }]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'quality-fallback',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: { policyName: 'quality-fallback', policyJSON, isDefault: false }
      }
    }));

    console.log(`  ✓ Quality-fallback policy created`);
    return policyId;
  }

  private async seedAutosizeFallbackPolicy(): Promise<string> {
    const policyId = TEST_AUTOSIZE_FALLBACK_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating autosize-fallback policy: ${policyId}`);

    // autosize=[320,480,640,768] + fallback.viewportWidth=400: CloudFront function sets dit-viewport-width
    // via device detection; all breakpoints <= source width (800) to avoid upscale prevention
    const policyJSON = JSON.stringify({
      outputs: [{ type: 'autosize', value: [320, 480, 640, 768], fallback: { viewportWidth: 400 } }]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'autosize-fallback',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: { policyName: 'autosize-fallback', policyJSON, isDefault: false }
      }
    }));

    console.log(`  ✓ Autosize-fallback policy created`);
    return policyId;
  }

  private async seedNoFallbackPolicy(): Promise<string> {
    const policyId = TEST_NO_FALLBACK_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating no-fallback policy: ${policyId}`);

    // format=auto with NO fallback: when dit-accept absent, no format conversion is applied
    const policyJSON = JSON.stringify({
      outputs: [{ type: 'format', value: 'auto' }]
    });

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'no-fallback',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: { policyName: 'no-fallback', policyJSON, isDefault: false }
      }
    }));

    console.log(`  ✓ No-fallback policy created`);
    return policyId;
  }

  private async seedOrigins(): Promise<string> {
    const originId = TEST_ORIGIN_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(originId);
    console.log(`  Creating origin: ${originId}`);

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: originId,
        GSI1PK: 'ORIGIN',
        GSI1SK: 'e2e-test-origin',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          originName: 'e2e-test-origin',
          originDomain: `${process.env.TEST_BUCKET}.s3.${this.region}.amazonaws.com`,
          originPath: '/'
        }
      }
    }));

    console.log(`  ✓ Origin created`);
    return originId;
  }

  private async seedMappings(originId: string, policyId?: string): Promise<string> {
    const mappingId = TEST_MAPPING_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(mappingId);
    console.log(`  Creating mapping: ${mappingId}`);

    const item: Record<string, any> = {
      PK: mappingId,
      GSI1PK: 'PATH_MAPPING',
      GSI1SK: '/*',
      GSI2PK: `ORIGIN#${originId}`,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Data: {
        mappingName: 'e2e-catch-all',
        description: '',
        originId
      }
    };

    if (policyId) {
      item.GSI3PK = `POLICY#${policyId}`;
      item.Data.policyId = policyId;
    }

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item
    }));

    console.log(`  ✓ Mapping created`);
    return mappingId;
  }

  async clearTestData(): Promise<void> {
    // Prefer IDs tracked during this process's own seeding; fall back to the full
    // set of known constant IDs so standalone teardown (`test:e2e:down`) — which
    // never seeded in-process — still removes everything a bootstrap created.
    const idsToDelete = this.createdIds.length > 0 ? this.createdIds : ALL_TEST_IDS;

    console.log(`Cleaning up DynamoDB test data (${idsToDelete.length} items)...`);
    for (const id of idsToDelete) {
      await this.docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: id }
      }));
      console.log(` Deleted: ${id}`)
    }
    console.log(`✓ DynamoDB test data cleared`);
  }

  getTestRunId(): string {
    return this.testRunId;
  }
}
