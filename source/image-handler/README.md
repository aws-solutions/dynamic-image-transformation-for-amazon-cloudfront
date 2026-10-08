# image-handler (v7 Lambda)

The AWS Lambda function behind the v7 (Lambda) architecture. It receives image requests from API Gateway, or from S3 Object Lambda on older deployments, reads the source image from an S3 bucket, applies the edits with [Sharp](https://sharp.pixelplumbing.com/), and returns the result. With API Gateway, responses are limited to the Lambda payload size (6 MB); the v8 [container](../container/README.md) does not have that limit.

## Layout

| Path | What it holds |
|------|---------------|
| `index.ts` | Lambda handler: builds the request, calls the handler, formats the response or the fallback image |
| `image-request.ts` | Works out the request type (`Default` base64 JSON, `Thumbor`, or `Custom` rewrite), bucket, key, edits, and output format; checks signatures |
| `thumbor-mapper.ts`, `query-param-mapper.ts` | Turn Thumbor-style paths and query parameters into edits |
| `image-handler.ts` | Applies edits with Sharp, including smart crop and content moderation through Amazon Rekognition |
| `secret-provider.ts` | Reads the signing secret from Secrets Manager |
| `cloudfront-function-handlers/` | CloudFront Functions deployed with the API Gateway and S3 Object Lambda architectures |
| `lib/` | Enums, types, and constants |

Shared helpers come from [solution-utils](../solution-utils/README.md) by relative import.

## Develop

```bash
cd source/image-handler
npm test    # pretest deletes node_modules and runs npm ci
```

The Lambda is bundled by CDK from `index.ts`; there is no separate build step. Deploy with the `v7-Stack` steps in the [root README](../../README.md#3-build-and-deploy).

## Common tasks

- **Add a Thumbor filter:** `thumbor-mapper.ts`, then the edit in `image-handler.ts`.
- **Add an edit:** `image-handler.ts` (and `lib/enums.ts` for a new format).
- **Change how the bucket and key are chosen:** `image-request.ts`.

## Configuration

All of these are set by CDK in `source/constructs/lib/back-end/back-end-construct.ts`, mostly from stack parameters.

| Name | Read in | What it does |
|------|---------|--------------|
| `SOURCE_BUCKETS` | `image-request.ts` | Comma-separated buckets images may be read from. The first is the default |
| `AUTO_WEBP` | `image-request.ts` | `Yes` returns WebP when the `Accept` header allows it |
| `CORS_ENABLED`, `CORS_ORIGIN` | `index.ts` | Adds `Access-Control-Allow-Origin` to responses |
| `ENABLE_SIGNATURE`, `SECRETS_MANAGER`, `SECRET_KEY` | `image-request.ts` | Require a signature on requests; the secret name and the key inside it |
| `ENABLE_DEFAULT_FALLBACK_IMAGE`, `DEFAULT_FALLBACK_IMAGE_BUCKET`, `DEFAULT_FALLBACK_IMAGE_KEY` | `index.ts` | Image returned when a request fails |
| `ENABLE_S3_OBJECT_LAMBDA` | `index.ts` | Selects the S3 Object Lambda request and response format |
| `REWRITE_MATCH_PATTERN`, `REWRITE_SUBSTITUTION` | `image-request.ts`, `thumbor-mapper.ts` | Regex rewrite for `Custom` requests. CDK sets both empty; set them on the function to use custom URLs |
| `SHARP_SIZE_LIMIT` | `image-handler.ts` | Sharp `limitInputPixels`. Empty or not a number means Sharp's default |
| `SOLUTION_ID`, `SOLUTION_VERSION` | `../solution-utils/get-options.ts` | Adds the solution to the AWS SDK user agent |

## Related

- [constructs](../constructs/README.md): the `v7-Stack` that deploys this function
- [custom-resource](../custom-resource/README.md): deployment-time checks for the same stack
- [source/README.md](../README.md): the full package list
