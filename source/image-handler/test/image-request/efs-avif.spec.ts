import S3 from "aws-sdk/clients/s3";
import SecretsManager from "aws-sdk/clients/secretsmanager";

import { ImageRequest } from "../../image-request";
import { SecretProvider } from "../../secret-provider";

// Mock fs/promises for EFS reads
jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

// Mock AWS SDK
jest.mock("aws-sdk/clients/s3", () => jest.fn(() => ({})));
jest.mock("aws-sdk/clients/secretsmanager", () => jest.fn(() => ({})));

import fsPromises from "fs/promises";

describe("EFS with AVIF edits", () => {
  const s3Client = new S3();
  const secretsManager = new SecretsManager();
  const secretProvider = new SecretProvider(secretsManager);

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SOURCE_BUCKETS = "bwpaperclip-bwstaging";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should return content type image/avif when using EFS with avif edits", async () => {
    // This is the exact payload from the user's request:
    // {"bucket" => "bwpaperclip-bwstaging", "use_efs" => true, "key" => "item_images/...",
    //  "bw_original_version" => 1764178950, "edits" => {"resize" => {...}, "avif" => {"quality" => 70}}}

    const requestPayload = {
      bucket: "bwpaperclip-bwstaging",
      use_efs: true,
      key: "item_images/assets/2/000/076/423/original/test.jpg",
      bw_original_version: 1764178950,
      edits: {
        resize: { width: 750, height: 473, fit: "inside" },
        avif: { quality: 70 },
      },
    };

    const event = {
      path: "/" + Buffer.from(JSON.stringify(requestPayload)).toString("base64"),
    };

    // Mock EFS read with a valid JPEG buffer (JPEG signature: FF D8 FF E0)
    const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const sampleContent = Buffer.from("SampleJPEGImageContent");
    const mockReadFile = fsPromises.readFile as unknown as jest.Mock<Promise<Uint8Array>>;
    const jpegBuffer = Buffer.concat([jpegSignature, sampleContent] as Uint8Array[]);
    mockReadFile.mockResolvedValueOnce(jpegBuffer as Uint8Array);

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);

    // Assert
    expect(fsPromises.readFile).toHaveBeenCalledWith(
      "/mnt/bw_images/item_images/assets/2/000/076/423/original/test.jpg"
    );
    expect(imageRequestInfo.useEfs).toBe(true);
    expect(imageRequestInfo.edits).toHaveProperty("avif");
    expect(imageRequestInfo.edits.avif).toEqual({ quality: 70 });
    expect(imageRequestInfo.outputFormat).toBe("avif");
    expect(imageRequestInfo.contentType).toBe("image/avif");
  });

  it("Should return content type image/jpeg for EFS without avif edits (original JPEG)", async () => {
    // Test that without avif edits, the contentType is the original image type
    const requestPayload = {
      bucket: "bwpaperclip-bwstaging",
      use_efs: true,
      key: "item_images/assets/2/000/076/423/original/test.jpg",
      edits: {
        resize: { width: 750, height: 473, fit: "inside" },
      },
    };

    const event = {
      path: "/" + Buffer.from(JSON.stringify(requestPayload)).toString("base64"),
    };

    // Mock EFS read with a valid JPEG buffer
    const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const sampleContent = Buffer.from("SampleJPEGImageContent");
    const mockReadFile = fsPromises.readFile as unknown as jest.Mock<Promise<Uint8Array>>;
    const jpegBuffer = Buffer.concat([jpegSignature, sampleContent] as Uint8Array[]);
    mockReadFile.mockResolvedValueOnce(jpegBuffer as Uint8Array);

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);

    // Assert - without avif edits, contentType should be inferred from the original (JPEG)
    expect(imageRequestInfo.useEfs).toBe(true);
    expect(imageRequestInfo.contentType).toBe("image/jpeg");
    expect(imageRequestInfo.outputFormat).toBeUndefined();
  });
});
