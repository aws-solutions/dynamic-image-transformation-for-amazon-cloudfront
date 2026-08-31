// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Wrap the real Sharp module so image buffers still decode normally, while recording every
// invocation so we can assert the `limitInputPixels` option instantiateSharpImage() derives from
// the LIMIT_INPUT_PIXELS env var (set per deployment size by the CDK: 50 MP on the 2 GB tier,
// 100 MP on the 4 GB tiers).
jest.mock('sharp', () => {
  const actual = jest.requireActual('sharp');
  const mock = jest.fn((...args: unknown[]) => (actual as (...a: unknown[]) => unknown)(...args));
  Object.assign(mock, actual);
  return { __esModule: true, default: mock };
});

import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';
import { ImageProcessingRequest } from '../../types/image-processing-request';

const sharpMock = sharp as unknown as jest.Mock;

let TEST_JPEG_BUFFER: Buffer;

beforeAll(async () => {
  TEST_JPEG_BUFFER = await jest
    .requireActual('sharp')({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
    })
    .jpeg()
    .toBuffer();
});

/** The limitInputPixels the service passed on its last decode (second arg of the instantiate call). */
function lastDecodeLimit(): number | undefined {
  for (let i = sharpMock.mock.calls.length - 1; i >= 0; i--) {
    const [, options] = sharpMock.mock.calls[i];
    if (options && typeof options.limitInputPixels === 'number') {
      return options.limitInputPixels;
    }
  }
  return undefined;
}

describe('ImageProcessorService LIMIT_INPUT_PIXELS', () => {
  let service: ImageProcessorService;
  const originalEnv = process.env.LIMIT_INPUT_PIXELS;

  beforeEach(() => {
    jest.clearAllMocks();
    service = ImageProcessorService.getInstance();
    jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
      buffer: TEST_JPEG_BUFFER,
      metadata: { size: TEST_JPEG_BUFFER.length, format: 'jpeg' }
    });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LIMIT_INPUT_PIXELS;
    } else {
      process.env.LIMIT_INPUT_PIXELS = originalEnv;
    }
  });

  const request = (): ImageProcessingRequest => ({
    requestId: 'test-limit',
    timestamp: Date.now(),
    origin: { url: 'https://example.com/image.jpg' },
    transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
    response: { headers: {} }
  });

  it.each([
    ['small (2 GB) tier', '50000000', 50000000],
    ['medium/large/xlarge (4 GB) tier', '100000000', 100000000]
  ])('honors the CDK-supplied limit for the %s', async (_label, envValue, expected) => {
    process.env.LIMIT_INPUT_PIXELS = envValue as string;

    await service.process(request());

    expect(lastDecodeLimit()).toBe(expected);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['non-numeric', 'not-a-number']
  ])('falls back to the smallest-tier ceiling (50 MP) when the env var is %s', async (_label, envValue) => {
    if (envValue === undefined) {
      delete process.env.LIMIT_INPUT_PIXELS;
    } else {
      process.env.LIMIT_INPUT_PIXELS = envValue;
    }

    await service.process(request());

    expect(lastDecodeLimit()).toBe(50000000);
  });

  it('never falls back to the old effectively-unlimited 1-billion-pixel ceiling', async () => {
    delete process.env.LIMIT_INPUT_PIXELS;

    await service.process(request());

    expect(lastDecodeLimit()).not.toBe(1000000000);
  });
});
