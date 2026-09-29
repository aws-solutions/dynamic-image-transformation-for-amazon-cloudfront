// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient as AwsRekognitionClient, DetectFacesCommand, DetectLabelsCommand, DetectTextCommand, DetectModerationLabelsCommand, DetectCustomLabelsCommand } from '@aws-sdk/client-rekognition';
import { mockClient } from 'aws-sdk-client-mock';
import { RekognitionClient } from './rekognition-client';
import { RekognitionApiError, CustomLabelsModelNotRunningError } from './errors';

const rekMock = mockClient(AwsRekognitionClient);
const imageBytes = Buffer.from('test-image');
const modelArn = 'arn:aws:rekognition:us-east-1:123456789012:project/my-model/version/1';

beforeEach(() => {
  rekMock.reset();
});

describe('RekognitionClient', () => {
  const client = new RekognitionClient(new AwsRekognitionClient({}));

  describe('detectFaces', () => {
    it('should return normalized bounding boxes from FaceDetails', async () => {
      rekMock.on(DetectFacesCommand).resolves({
        FaceDetails: [
          { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.4 }, Confidence: 99.5 },
          { BoundingBox: { Left: 0.5, Top: 0.6, Width: 0.1, Height: 0.1 }, Confidence: 87.2 },
        ],
      });

      const result = await client.detectFaces(imageBytes);

      expect(result.detection.apiName).toBe('DetectFaces');
      expect(result.detection.boundingBoxes).toEqual([
        { left: 0.1, top: 0.2, width: 0.3, height: 0.4, label: 'Face', confidence: 99.5 },
        { left: 0.5, top: 0.6, width: 0.1, height: 0.1, label: 'Face', confidence: 87.2 },
      ]);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no faces detected', async () => {
      rekMock.on(DetectFacesCommand).resolves({ FaceDetails: [] });

      const result = await client.detectFaces(imageBytes);

      expect(result.detection.boundingBoxes).toEqual([]);
    });

    it('should handle undefined FaceDetails', async () => {
      rekMock.on(DetectFacesCommand).resolves({});

      const result = await client.detectFaces(imageBytes);

      expect(result.detection.boundingBoxes).toEqual([]);
    });
  });

  describe('detectLabels', () => {
    it('should flatMap label instances into normalized boxes', async () => {
      rekMock.on(DetectLabelsCommand).resolves({
        Labels: [
          {
            Name: 'Car',
            Confidence: 95,
            Instances: [
              { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.4 }, Confidence: 92 },
              { BoundingBox: { Left: 0.5, Top: 0.5, Width: 0.2, Height: 0.2 }, Confidence: 88 },
            ],
          },
          {
            Name: 'Person',
            Confidence: 99,
            Instances: [
              { BoundingBox: { Left: 0.0, Top: 0.0, Width: 0.5, Height: 0.8 }, Confidence: 97 },
            ],
          },
        ],
      });

      const result = await client.detectLabels(imageBytes);

      expect(result.detection.apiName).toBe('DetectLabels');
      expect(result.detection.boundingBoxes).toHaveLength(3);
      expect(result.detection.boundingBoxes[0]).toEqual({ left: 0.1, top: 0.2, width: 0.3, height: 0.4, label: 'Car', confidence: 92 });
      expect(result.detection.boundingBoxes[2].label).toBe('Person');
    });

    it('should skip labels without instances', async () => {
      rekMock.on(DetectLabelsCommand).resolves({
        Labels: [
          { Name: 'Nature', Confidence: 99, Instances: [] },
          { Name: 'Outdoors', Confidence: 95 },
        ],
      });

      const result = await client.detectLabels(imageBytes);

      expect(result.detection.boundingBoxes).toEqual([]);
    });

    it('should fall back to label confidence when instance confidence is missing', async () => {
      rekMock.on(DetectLabelsCommand).resolves({
        Labels: [
          {
            Name: 'Dog',
            Confidence: 90,
            Instances: [{ BoundingBox: { Left: 0, Top: 0, Width: 0.5, Height: 0.5 } }],
          },
        ],
      });

      const result = await client.detectLabels(imageBytes);

      expect(result.detection.boundingBoxes[0].confidence).toBe(90);
    });
  });

  describe('detectText', () => {
    it('should return only LINE type detections', async () => {
      rekMock.on(DetectTextCommand).resolves({
        TextDetections: [
          { Type: 'LINE', DetectedText: 'Hello World', Confidence: 99, Geometry: { BoundingBox: { Left: 0.1, Top: 0.1, Width: 0.8, Height: 0.05 } } },
          { Type: 'WORD', DetectedText: 'Hello', Confidence: 99, Geometry: { BoundingBox: { Left: 0.1, Top: 0.1, Width: 0.3, Height: 0.05 } } },
          { Type: 'WORD', DetectedText: 'World', Confidence: 99, Geometry: { BoundingBox: { Left: 0.5, Top: 0.1, Width: 0.3, Height: 0.05 } } },
        ],
      });

      const result = await client.detectText(imageBytes);

      expect(result.detection.apiName).toBe('DetectText');
      expect(result.detection.boundingBoxes).toHaveLength(1);
      expect(result.detection.boundingBoxes[0].label).toBe('Text');
    });

    it('should handle missing Geometry gracefully', async () => {
      rekMock.on(DetectTextCommand).resolves({
        TextDetections: [{ Type: 'LINE', DetectedText: 'Test', Confidence: 80 }],
      });

      const result = await client.detectText(imageBytes);

      expect(result.detection.boundingBoxes[0]).toEqual({ left: 0, top: 0, width: 0, height: 0, label: 'Text', confidence: 80 });
    });
  });

  describe('detectModerationLabels', () => {
    it('should return only top-level taxonomy labels', async () => {
      rekMock.on(DetectModerationLabelsCommand).resolves({
        ModerationLabels: [
          { Name: 'Violence', Confidence: 95, TaxonomyLevel: 1 },
          { Name: 'Graphic Violence', Confidence: 90, TaxonomyLevel: 2 },
        ],
      });

      const result = await client.detectModerationLabels(imageBytes);

      expect(result.detection.apiName).toBe('DetectModerationLabels');
      expect(result.detection.boundingBoxes).toHaveLength(1);
      expect(result.detection.boundingBoxes[0].label).toBe('Violence');
    });

    it('should normalize to zero-dimension box when no geometry exists', async () => {
      rekMock.on(DetectModerationLabelsCommand).resolves({
        ModerationLabels: [{ Name: 'Suggestive', Confidence: 80, TaxonomyLevel: 1 }],
      });

      const result = await client.detectModerationLabels(imageBytes);

      expect(result.detection.boundingBoxes[0]).toEqual({ left: 0, top: 0, width: 0, height: 0, label: 'Suggestive', confidence: 80 });
    });
  });

  describe('detectCustomLabels', () => {
    it('should return normalized boxes from custom model', async () => {
      rekMock.on(DetectCustomLabelsCommand).resolves({
        CustomLabels: [
          { Name: 'Defect', Confidence: 91, Geometry: { BoundingBox: { Left: 0.2, Top: 0.3, Width: 0.1, Height: 0.1 } } },
        ],
      });

      const result = await client.detectCustomLabels(imageBytes, modelArn);

      expect(result.detection.apiName).toBe('DetectCustomLabels');
      expect(result.detection.boundingBoxes[0]).toEqual({ left: 0.2, top: 0.3, width: 0.1, height: 0.1, label: 'Defect', confidence: 91 });
    });

    it('should pass ProjectVersionArn to the SDK command', async () => {
      rekMock.on(DetectCustomLabelsCommand).resolves({ CustomLabels: [] });

      await client.detectCustomLabels(imageBytes, modelArn);

      const call = rekMock.commandCalls(DetectCustomLabelsCommand)[0];
      expect(call.args[0].input.ProjectVersionArn).toBe(modelArn);
    });

    it('should throw CustomLabelsModelNotRunningError on ResourceNotReadyException', async () => {
      const error = new Error('Model is not running');
      error.name = 'ResourceNotReadyException';
      rekMock.on(DetectCustomLabelsCommand).rejects(error);

      await expect(client.detectCustomLabels(imageBytes, modelArn))
        .rejects.toThrow(CustomLabelsModelNotRunningError);
    });
  });

  describe('error handling', () => {
    it('should throw RekognitionApiError on SDK failure', async () => {
      rekMock.on(DetectFacesCommand).rejects(new Error('Service unavailable'));

      await expect(client.detectFaces(imageBytes)).rejects.toThrow(RekognitionApiError);
      await expect(client.detectFaces(imageBytes)).rejects.toThrow('Service unavailable');
    });

    it('should include apiName on RekognitionApiError', async () => {
      rekMock.on(DetectLabelsCommand).rejects(new Error('Throttled'));

      try {
        await client.detectLabels(imageBytes);
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(RekognitionApiError);
        expect((error as RekognitionApiError).apiName).toBe('DetectLabels');
      }
    });

    it('should propagate SDK httpStatusCode into RekognitionApiError', async () => {
      const sdkError = Object.assign(new Error('Throttled'), { $metadata: { httpStatusCode: 429 } });
      rekMock.on(DetectFacesCommand).rejects(sdkError);

      try {
        await client.detectFaces(imageBytes);
        fail('Expected error');
      } catch (error) {
        expect((error as RekognitionApiError).statusCode).toBe(429);
      }
    });

    it('should default to 502 when SDK error has no httpStatusCode', async () => {
      rekMock.on(DetectFacesCommand).rejects(new Error('Unknown'));

      try {
        await client.detectFaces(imageBytes);
        fail('Expected error');
      } catch (error) {
        expect((error as RekognitionApiError).statusCode).toBe(502);
      }
    });

    it('should attach original SDK error as cause', async () => {
      const sdkError = new Error('Access denied');
      rekMock.on(DetectFacesCommand).rejects(sdkError);

      try {
        await client.detectFaces(imageBytes);
        fail('Expected error');
      } catch (error) {
        expect((error as RekognitionApiError).cause).toBe(sdkError);
      }
    });

    it('should throw RekognitionApiError (not CustomLabelsModelNotRunningError) for non-custom-labels ResourceNotReadyException', async () => {
      const error = new Error('Not ready');
      error.name = 'ResourceNotReadyException';
      rekMock.on(DetectFacesCommand).rejects(error);

      await expect(client.detectFaces(imageBytes)).rejects.toThrow(RekognitionApiError);
      await expect(client.detectFaces(imageBytes)).rejects.not.toThrow(CustomLabelsModelNotRunningError);
    });
  });

  describe('bounding box normalization', () => {
    it('should default missing BoundingBox fields to 0', async () => {
      rekMock.on(DetectFacesCommand).resolves({
        FaceDetails: [{ BoundingBox: {}, Confidence: 50 }],
      });

      const result = await client.detectFaces(imageBytes);

      expect(result.detection.boundingBoxes[0]).toEqual({ left: 0, top: 0, width: 0, height: 0, label: 'Face', confidence: 50 });
    });

    it('should default missing confidence to 0', async () => {
      rekMock.on(DetectFacesCommand).resolves({
        FaceDetails: [{ BoundingBox: { Left: 0.1, Top: 0.1, Width: 0.2, Height: 0.2 } }],
      });

      const result = await client.detectFaces(imageBytes);

      expect(result.detection.boundingBoxes[0].confidence).toBe(0);
    });
  });
});
