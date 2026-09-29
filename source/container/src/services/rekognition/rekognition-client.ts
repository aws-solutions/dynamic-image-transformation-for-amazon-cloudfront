// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  RekognitionClient as AwsRekognitionClient,
  DetectFacesCommand,
  DetectLabelsCommand,
  DetectTextCommand,
  DetectModerationLabelsCommand,
  DetectCustomLabelsCommand,
} from '@aws-sdk/client-rekognition';
import { getOptions } from '../../utils/get-options';
import { DetectionResult, NormalizedBoundingBox, RekognitionApiName, RekognitionClientResult } from './types';
import { RekognitionApiError, CustomLabelsModelNotRunningError } from './errors';

interface AwsBoundingBox {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
}

export class RekognitionClient {
  private client: AwsRekognitionClient;

  constructor(client?: AwsRekognitionClient) {
    this.client = client ?? new AwsRekognitionClient(getOptions());
  }

  async detectFaces(imageBytes: Buffer): Promise<RekognitionClientResult> {
    return this.invoke('DetectFaces', () =>
      this.client.send(new DetectFacesCommand({ Image: { Bytes: imageBytes } })),
      (response) =>
        (response.FaceDetails ?? []).map((face) =>
          this.normalizeBox(face.BoundingBox, 'Face', face.Confidence)
        ),
    );
  }

  async detectLabels(imageBytes: Buffer): Promise<RekognitionClientResult> {
    return this.invoke('DetectLabels', () =>
      this.client.send(new DetectLabelsCommand({ Image: { Bytes: imageBytes } })),
      (response) =>
        (response.Labels ?? []).flatMap((label) =>
          (label.Instances ?? []).map((instance) =>
            this.normalizeBox(instance.BoundingBox, label.Name, instance.Confidence ?? label.Confidence)
          )
        ),
    );
  }

  async detectText(imageBytes: Buffer): Promise<RekognitionClientResult> {
    return this.invoke('DetectText', () =>
      this.client.send(new DetectTextCommand({ Image: { Bytes: imageBytes } })),
      (response) =>
        (response.TextDetections ?? [])
          .filter((t) => t.Type === 'LINE')
          .map((t) =>
            this.normalizeBox(t.Geometry?.BoundingBox, 'Text', t.Confidence)
          ),
    );
  }

  async detectModerationLabels(imageBytes: Buffer): Promise<RekognitionClientResult> {
    return this.invoke('DetectModerationLabels', () =>
      this.client.send(new DetectModerationLabelsCommand({ Image: { Bytes: imageBytes } })),
      (response) =>
        (response.ModerationLabels ?? [])
          .filter((l) => l.TaxonomyLevel === 1)
          .map((l) => this.normalizeBox(undefined, l.Name, l.Confidence)),
    );
  }

  async detectCustomLabels(imageBytes: Buffer, modelArn: string): Promise<RekognitionClientResult> {
    return this.invoke('DetectCustomLabels', () =>
      this.client.send(new DetectCustomLabelsCommand({
        Image: { Bytes: imageBytes },
        ProjectVersionArn: modelArn,
      })),
      (response) =>
        (response.CustomLabels ?? []).map((label) =>
          this.normalizeBox(label.Geometry?.BoundingBox, label.Name, label.Confidence)
        ),
      modelArn,
    );
  }

  private async invoke<T>(
    apiName: RekognitionApiName,
    call: () => Promise<T>,
    extract: (response: T) => NormalizedBoundingBox[],
    modelArn?: string,
  ): Promise<RekognitionClientResult> {
    const start = Date.now();
    try {
      const response = await call();
      const boundingBoxes = extract(response);
      if (boundingBoxes.length === 0) {
        console.log(JSON.stringify({ component: 'RekognitionClient', event: 'empty_extraction', apiName, message: 'Rekognition returned a response but no bounding boxes were extracted' }));
      }
      return {
        detection: {
          apiName,
          boundingBoxes,
        },
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      if (modelArn && error?.name === 'ResourceNotReadyException') {
        console.log(JSON.stringify({ component: 'RekognitionClient', apiName, customLabelsModelStatus: 'model_not_running', modelArn }));
        throw new CustomLabelsModelNotRunningError(modelArn);
      }
      throw new RekognitionApiError(apiName, error?.message ?? 'Unknown Rekognition error', error?.$metadata?.httpStatusCode ?? 502, { cause: error });
    }
  }

  private normalizeBox(box?: AwsBoundingBox, label?: string, confidence?: number): NormalizedBoundingBox {
    return {
      left: box?.Left ?? 0,
      top: box?.Top ?? 0,
      width: box?.Width ?? 0,
      height: box?.Height ?? 0,
      label,
      confidence: confidence ?? 0,
    };
  }
}
