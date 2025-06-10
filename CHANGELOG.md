# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.4] - 2025-06-10

### Security

- Bump `tar-fs` to mitigate [CVE-2025-48387](https://avd.aquasec.com/nvd/cve-2025-48387)
- Bump `aws-cdk-lib` to mitigate [GHSA-5pq3-h73f-66hr](https://github.com/advisories/GHSA-5pq3-h73f-66hr)

## [7.0.3] - 2025-05-10

### Fixed

- `SOLUTION_VERSION` environment variable in metrics lambda construct

## [7.0.2] - 2025-04-09

### Security

- Bump aws-cdk-lib to `2.188.0`
- Update solution metrics lambda runtime to `nodejs22.x`

## [7.0.1] - 2025-03-14

### Changed

- Updated metrics module to support identical metrics for different resources
- Updated aws-cdk-lib and aws-cdk package versions

### Security

- Upgraded esbuild to v0.25.0 for advisory [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- Upgraded axios to 1.8.2 for advisory [GHSA-jr5f-v2jv-69x6](https://github.com/axios/axios/security/advisories/GHSA-jr5f-v2jv-69x6)

### Fixed

- Minor eslint warnings

## [7.0.0] - 2025-01-27

### Changed

- Location of API Gateway infrastructure resources
- **Breaking** New condition on API gateway will cause a delete/create of ApiGateway::Deployment on stack update
- **Breaking:** Exception thrown on invalid resize parameters [#463](https://github.com/aws-solutions/serverless-image-handler/pull/463)
- Code formatting to align with ESLint rules
- **Breaking** Reduced passthrough of errors from external APIs to response body. Errors will still be logged.
- Modified CloudFront logging bucket to have versioning enabled by default
- CloudFront behaviour to redirect http requests to https rather than throwing forbidden error
- Set-Cookie was added to list of deny-listed response headers
- Name of solution from Serverless Image Handler on AWS to Dynamic Image Transformation for Amazon CloudFront.

### Added

- Ability to enable origin shield through a deployment parameter
- Ability to deploy solution without creating a CloudFront distribution
- CloudFront function to normalize accept headers when AutoWebP is enabled
- Alternative infrastructure using S3 Object Lambda to overcome 6 MB response size limit
- Query param named expires which can be used to define when a generated image should no longer be accessible
- Ability to include smart_crop as a filter for Thumbor style requests, taking advantage of AWS Rekognition face cropping
- Ability to set CloudWatch log retention period to Infinite
- Ability to specify Sharp input image size limit [#465](https://github.com/aws-solutions/serverless-image-handler/issues/465) [#476](https://github.com/aws-solutions/serverless-image-handler/pull/476)
- Query parameter based image editing [#184](https://github.com/aws-solutions/serverless-image-handler/issues/184)
- Query parameter normalization to improve cache hit rate
- CloudWatch dashboard to improve Solution observability
- Additional anonymized metrics to help understand how the solution is being used, identify areas of improvement, and drive future roadmap decisions.

### Removed

- Accept header being used in cache policy when AutoWebP is disabled

### Fixed

- Broken URLs in Signature and Fallback Image template parameters

## [6.3.3] - 2024-12-27

### Fixed

- Overlays not checking for valid S3 buckets
- Failures when updating deployments created in version 6.1.0 and prior [#559](https://github.com/aws-solutions/serverless-image-handler/issues/559)

### Security

- Added allowlist on sharp operations. [Info](https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/create-and-use-image-requests.html#restricted-operations)
- Added deny list on custom headers for base64 encoded requests. [Info](https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/create-and-use-image-requests.html#include-custom-response-headers)
- Added inference of Content-Type header if S3 Metadata provides an unsupported value

## [6.3.2] - 2024-11-22

### Fixed

- Upgrade cross-spawn to v7.0.6 for vulnerability [CVE-2024-9506](https://github.com/advisories/GHSA-5j4c-8p2g-v4jx)

## [6.3.1] - 2024-10-02

### Fixed

- Base-64 encoded overlayWith call requiring strings in top/left options rather than numbers
- CloudFront anonymized metrics missing for deployments outside of us-east-1

## [6.3.0] - 2024-09-09

### Added

- Additional anonymized metrics system to help understand how the solution is being used, identify areas of improvement, and drive future roadmap decisions.

### Changed

- Cdk update to 2.151.0
- Default log retention to 180 days
- Cache-control header on fallback images to use (in order of priority), fallback image metadata, header provided in image request, and default cache control [#563](https://github.com/aws-solutions/serverless-image-handler/issues/563)

### Security

- Upgraded micromatch to v4.0.8 for vulnerability CVE-2024-4067

## [6.2.7] - 2024-08-19

### Security

- Upgraded axios to v1.7.4 for vulnerability CVE-2024-39338

## [6.2.6] - 2024-06-27

### Added

- StackId tag to CloudFrontLoggingBucket and its bucket name as a CfnOutput [#529](https://github.com/aws-solutions/serverless-image-handler/issues/529)
- Test case to verify UTF-8 support in object key [#320](https://github.com/aws-solutions/serverless-image-handler/pull/320)
- Test cases to verify crop functionality [#459](https://github.com/aws-solutions/serverless-image-handler/pull/459)
- VERSION.txt and build script change to auto-update local package versions
- S3:bucket-name tag for defining which source bucket to use in thumbor style requests [#521](https://github.com/aws-solutions/serverless-image-handler/pull/521)
- Ability to override whether an image should be animated [#456](https://github.com/aws-solutions/serverless-image-handler/issues/456)
- Support for 8-bit depth AVIF image type inference [#360](https://github.com/aws-solutions/serverless-image-handler/issues/360)

### Changed

- Decreased permissions allotted to CustomResource Lambda and ImageHandler Lambda
- cdk update to 2.124.0
- aws-solutions-constructs update to 2.51.0
- SourceBucketsParameter to require explicit bucket names
- Demo-ui dependency update
- Demo-ui to be a package and manage script/stylesheet dependencies through NPM
- Modified JPEG SOI marker parsing to only check first 2 bytes [#429]

### Security

- Upgraded follow-redirects to v1.15.6 for vulnerability CVE-2024-28849
- Upgraded braces to v3.0.3 for vulnerability CVE-2024-4068

### Removed

- Unused CopyS3Assets custom resource

### Fixed

- Some error messages indicating incorrect file types
- Solution version and id not being passed to Backend Lambda
- Thumbor-style URL matching being overly permissive

## [6.2.5] - 2024-01-03

### Fixed

- Ensure accurate image metadata when generating Amazon Rekognition compatible images [#374](https://github.com/aws-solutions/serverless-image-handler/issues/374)
- Exclude demo-ui-config from being deleted upon BucketDeployment update sync when updating to a new version

### Changed

- Overlay requests with an overlay image with one or both dimensions greater than the base image now returns a 400 bad request status with the message "Image to overlay must have same dimensions or smaller", previously returned a 500 internal error [#405](https://github.com/aws-solutions/serverless-image-handler/issues/405)
- cdk update to 2.118.0
- typescript update to 5.3.3
- GIF files without multiple pages are now treated as non-animated, allowing all filters to be used on them [#460](https://github.com/aws-solutions/serverless-image-handler/issues/460)

### Security

- Upgraded axios to v1.6.5 for vulnerability CVE-2023-26159

## [6.2.4] - 2023-12-06

### Changed

- node 20.x Lambda runtimes
- cdk update to 2.111.0
- disable gzip compression in cloudfront cache option to improve cache hit ratio [#373](https://github.com/aws-solutions/serverless-image-handler/pull/373)
- requests for webp images supported for upper/lower case Accept header [#490](https://github.com/aws-solutions/serverless-image-handler/pull/490)
- changed axios version to 1.6.2 for github dependabot reported vulnerability CVE-2023-45857
- enabled thumbor filter chaining [#343](https://github.com/aws-solutions/serverless-image-handler/issues/343)

## [6.2.3] - 2023-10-20

### Fixed

- Fixing Security Vulnerabilities

### Changed

- Updated the versions of multiple dependencies

## [6.2.2] - 2023-09-29

### Changed

- Update package.json Author
- Modify some license headers to maintain consistency

### Security

- Upgraded sharp to v0.32.6 for vulnerability CVE-2023-4863
- Upgraded outdated NPM packages

## [6.2.1] - 2023-08-03

### Fixed

- Template fails to deploy unless demo UI is enabled [#499](https://github.com/aws-solutions/serverless-image-handler/issues/499)
- Thumbor requests of images without a file extension would fail
- CloudFormation template description was not being generated

### Changed

- Upgraded build requirement to Node 16

## [6.2.0] - 2023-08-01

### Added

- Add `cdk-helper` module to help with packaging cdk generated assets in solutions internal pipelines
- Use [DefaultStackSynthesizer](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.DefaultStackSynthesizer.html) with different configurations to generate template for `cdk deploy` and on internal solutions pipeline
- Add esbuild bundler for lambda functions using `NodejsFunction`, reference [aws_lambda_nodejs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html)
- Refactor pipeline scripts
- Changes semver dependency version to 7.5.2 for github reported vulnerability CVE-2022-25883
- Changes word-wrap dependency version to aashutoshrathi/word-wrap for github reported vulnerability CVE-2023-26115

## [6.1.2] - 2023-04-14

### Changed

- added s3 bucket ownership control permission and ownership parameter to S3 logging bucket to account for [changes in S3 default behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/create-bucket-faq.html)
- changed xml2js version to 0.5.0 for github dependabot reported vulnerability CVE-2023-0842

## [6.1.1] - 2023-02-09

### Added

- package-lock.json for all modules [#426](https://github.com/aws-solutions/serverless-image-handler/pull/426)
- github workflows for running unit test, eslint and prettier formatting, cdk nag, security scans [#402](https://github.com/aws-solutions/serverless-image-handler/pull/402)
- demo-ui unicode support [#416](https://github.com/aws-solutions/serverless-image-handler/issues/416)
- support for multiple cloudformation stack deployments in the same region [#438](https://github.com/aws-solutions/serverless-image-handler/pull/438)

### Changed

- axios version update to 1.2.3 [#425](https://github.com/aws-solutions/serverless-image-handler/pull/425)
- json5 version update to 1.0.2 [#428](https://github.com/aws-solutions/serverless-image-handler/pull/428)
- CodeQL advisory resolutions
- contributing guidelines

## [6.1.0] - 2022-11-10

### Added

- gif support
- tif support
- AWS Service Catalog AppRegistry

### Changed

- package version updates
- CDK v2 migration
- node 16.x Lambda runtimes

## [6.0.0] - 2021-12-21

### Changed

- **Note that** Version 6.0.0 does not support upgrading from previous versions due to the update that uses the AWS CDK to generate the AWS CloudFormation template.

### Added

- Crop feature in Thumbor URLs: [#202](https://github.com/aws-solutions/serverless-image-handler/pull/202)
- TypeScript typings: [#293](https://github.com/aws-solutions/serverless-image-handler/issues/293)
- Reduction effort support: [#289](https://github.com/aws-solutions/serverless-image-handler/issues/289)
- Allow custom requests for keys without file extensions: [#273](https://github.com/aws-solutions/serverless-image-handler/issues/273)

### Fixed

- Unexpected behavior after adding support for images without extension: [#307](https://github.com/aws-solutions/serverless-image-handler/issues/307)
- Quality filter does not work with format filter (thumbor): [#266](https://github.com/aws-solutions/serverless-image-handler/issues/266)
- Auto WebP activated, `Content-Type: image/webp` returned, but still it's JPG encoded: [#305](https://github.com/aws-solutions/serverless-image-handler/issues/305)
- `inferImageType` doesn't support binary/octet-stream but not application/octet-stream: [#306](https://github.com/aws-solutions/serverless-image-handler/issues/306)
- SmartCrop boundary exceeded: [#263](https://github.com/aws-solutions/serverless-image-handler/issues/263)
- Custom rewrite does not work without file extensions: [#268](https://github.com/aws-solutions/serverless-image-handler/issues/268)
- Secrets manager cost issue: [#291](https://github.com/aws-solutions/serverless-image-handler/issues/291)
- `inferImageType` is slow: [#303](https://github.com/aws-solutions/serverless-image-handler/issues/303)
- If the file name contain `()`，the API will return 404,NoSuchKey,The specified key does not exist: [#299](https://github.com/aws-solutions/serverless-image-handler/issues/299)
- `fit-in` segment in URL path generates 404: [#281](https://github.com/aws-solutions/serverless-image-handler/issues/281)
- `overlayWith` top/left return int after percent conversion: [#276](https://github.com/aws-solutions/serverless-image-handler/issues/276)

## [5.2.0] - 2021-01-29

### Added

- Support for ap-east-1 and me-south-1 regions: [#192](https://github.com/aws-solutions/serverless-image-handler/issues/192), [#228](https://github.com/aws-solutions/serverless-image-handler/issues/228), [#232](https://github.com/aws-solutions/serverless-image-handler/issues/232)
- Unit tests for custom-resource: `100%` coverage
- Cloudfront cache policy and origin request policy: [#229](https://github.com/aws-solutions/serverless-image-handler/issues/229)
- Circular cropping feature: [#214](https://github.com/aws-solutions/serverless-image-handler/issues/214), [#216](https://github.com/aws-solutions/serverless-image-handler/issues/216)
- Unit tests for image-handler: `100%` coverage
- Support for files without extension on thumbor requests: [#169](https://github.com/aws-solutions/serverless-image-handler/issues/169), [#188](https://github.com/aws-solutions/serverless-image-handler/issues/188)
- Inappropriate content detection feature: [#243](https://github.com/aws-solutions/serverless-image-handler/issues/243)
- Unit tests for image-request: `100%` coverage

### Fixed

- Graceful failure when no faces are detected using smartCrop and fail on resizing before smartCrop: [#132](https://github.com/aws-solutions/serverless-image-handler/issues/132), [#133](https://github.com/aws-solutions/serverless-image-handler/issues/133)
- Broken SVG returned if no edits specified and Auto-WebP enabled: [#247](https://github.com/aws-solutions/serverless-image-handler/issues/247)
- Removed "--recursive" from README.md: [#255](https://github.com/aws-solutions/serverless-image-handler/pull/255)
- fixed issue with failure on resize if width or height is float: [#254](https://github.com/aws-solutions/serverless-image-handler/issues/254)

### Changed

- Constructs test template for constructs unit test: `100%` coverage

## [5.1.0] - 2020-11-19

### Added

- Image URL signature: [#111](https://github.com/aws-solutions/serverless-image-handler/issues/111), [#203](https://github.com/aws-solutions/serverless-image-handler/issues/203), [#221](https://github.com/aws-solutions/serverless-image-handler/issues/221), [#227](https://github.com/aws-solutions/serverless-image-handler/pull/227)
- AWS Lambda `413` error handling. When the response payload is bigger than 6MB, it throws `TooLargeImageException`: [#35](https://github.com/aws-solutions/serverless-image-handler/issues/35), [#97](https://github.com/aws-solutions/serverless-image-handler/issues/97), [#193](https://github.com/aws-solutions/serverless-image-handler/issues/193), [#204](https://github.com/aws-solutions/serverless-image-handler/issues/204)
- Default fallback image: [#137](https://github.com/aws-solutions/serverless-image-handler/issues/137)
- Unit tests for custom resource: `100%` coverage
- Add `SVG` support. When any edits are used, the output would be automatically `PNG` unless the output format is specified: [#31](https://github.com/aws-solutions/serverless-image-handler/issues/31), [#234](https://github.com/aws-solutions/serverless-image-handler/issues/234)
- Custom headers: [#182](https://github.com/aws-solutions/serverless-image-handler/pull/182)
- Enabling ALB Support : [#201](https://github.com/aws-solutions/serverless-image-handler/pull/201)

### Fixed

- Thumbor paths broken if they include "-" and "100x100": [#208](https://github.com/aws-solutions/serverless-image-handler/issues/208)
- Rewrite doesn't seem to be working: [#121](https://github.com/aws-solutions/serverless-image-handler/issues/121)
- Correct EXIF: [#197](https://github.com/aws-solutions/serverless-image-handler/issues/197), [#220](https://github.com/aws-solutions/serverless-image-handler/issues/220), [#235](https://github.com/aws-solutions/serverless-image-handler/issues/235), [#236](https://github.com/aws-solutions/serverless-image-handler/issues/236), [#240](https://github.com/aws-solutions/serverless-image-handler/issues/240)
- Sub folder support in Thumbor `watermark` filter: [#231](https://github.com/aws-solutions/serverless-image-handler/issues/231)

### Changed

- AWS CDK and AWS Solutions Constructs version (from 1.57.0 to 1.64.1)
- sharp base version (from 0.25.4 to 0.26.1)
- Refactors the custom resource Lambda source code
- Migrate unit tests to use `jest`
- Move all `aws-sdk` in `ImageHandler` Lambda function to `index.js` for the best practice
- Enhance the default error message not to show empty JSON: [#206](https://github.com/aws-solutions/serverless-image-handler/issues/206)
- **Image URL Signature**: When image URL signature is enabled, all URLs including existing URLs should have `signature` query parameter.

### Removed

- Remove `manifest-generator`

## [5.0.0] - 2020-08-31

### Added

- AWS CDK and AWS Solutions Constructs to create AWS CloudFormation template

### Fixed

- Auto WebP does not work properly: [#195](https://github.com/aws-solutions/serverless-image-handler/pull/195), [#200](https://github.com/aws-solutions/serverless-image-handler/issues/200), [#205](https://github.com/aws-solutions/serverless-image-handler/issues/205)
- A bug where base64 encoding containing slash: [#194](https://github.com/aws-solutions/serverless-image-handler/pull/194)
- Thumbor issues:
  - `0` size support: [#183](https://github.com/aws-solutions/serverless-image-handler/issues/183)
  - `convolution` filter does not work: [#187](https://github.com/aws-solutions/serverless-image-handler/issues/187)
  - `fill` filter does not work: [#190](https://github.com/aws-solutions/serverless-image-handler/issues/190)
- **Note that** duplicated features has been merged gracefully.

### Removed

- AWS CloudFormation template: `serverless-image-handler.template`

### Changed

- sharp base version (from 0.23.4 to 0.25.4)
- Remove `Promise` to return since `async` functions return promises: [#189](https://github.com/aws-solutions/serverless-image-handler/issues/189)
- Unit test statement coverage improvement:
  - `image-handler.js`: `79.05%` to `100%`
  - `image-request.js`: `93.58%` to `100%`
  - `thumbor-mapping.js`: `99.29%` to `100%`
  - `overall`: `91.55%` to `100%`

## [4.2.0] - 2020-02-06

### Added

- Honor outputFormat Parameter from the pull request [#117](https://github.com/aws-solutions/serverless-image-handler/pull/117)
- Support serving images under s3 subdirectories, Fix to make /fit-in/ work; Fix for VipsJpeg: Invalid SOS error plus several other critical fixes from the pull request [#130](https://github.com/aws-solutions/serverless-image-handler/pull/130)
- Allow regex in SOURCE_BUCKETS for environment variable from the pull request [#138](https://github.com/aws-solutions/serverless-image-handler/pull/138)
- Fix build script on other platforms from the pull request [#139](https://github.com/aws-solutions/serverless-image-handler/pull/139)
- Add Cache-Control response header from the pull request [#151](https://github.com/aws-solutions/serverless-image-handler/pull/151)
- Add AUTO_WEBP option to automatically serve WebP if the client supports it from the pull request [#152](https://github.com/aws-solutions/serverless-image-handler/pull/152)
- Use HTTP 404 & forward Cache-Control, Content-Type, Expires, and Last-Modified headers from S3 from the pull request [#158](https://github.com/aws-solutions/serverless-image-handler/pull/158)
- fix: DeprecationWarning: Buffer() is deprecated from the pull request [#174](https://github.com/aws-solutions/serverless-image-handler/pull/174)
- Add hex color support for Thumbor `filters:background_color` and `filters:fill` [#154](https://github.com/aws-solutions/serverless-image-handler/issues/154)
- Add format and watermark support for Thumbor [#109](https://github.com/aws-solutions/serverless-image-handler/issues/109), [#131](https://github.com/aws-solutions/serverless-image-handler/issues/131), [#109](https://github.com/aws-solutions/serverless-image-handler/issues/142)
- **Note that** duplicated features has been merged gracefully.

### Changed

- sharp base version (from 0.23.3 to 0.23.4)
- Image handler Amazon CloudFront distribution `DefaultCacheBehavior.ForwardedValues.Header` to `["Origin", "Accept"]` for WebP
- Image resize process change for `filters:no_upscale()` handling by `withoutEnlargement` edit key [#144](https://github.com/aws-solutions/serverless-image-handler/issues/144)

### Fixed

- Add and fix Cache-control, Content-Type, Expires, and Last-Modified headers to response: [#103](https://github.com/aws-solutions/serverless-image-handler/issues/103), [#107](https://github.com/aws-solutions/serverless-image-handler/issues/107), [#120](https://github.com/aws-solutions/serverless-image-handler/issues/120)
- Fix Amazon S3 bucket subfolder issue: [#106](https://github.com/aws-solutions/serverless-image-handler/issues/106), [#112](https://github.com/aws-solutions/serverless-image-handler/issues/112), [#119](https://github.com/aws-solutions/serverless-image-handler/issues/119), [#123](https://github.com/aws-solutions/serverless-image-handler/issues/123), [#167](https://github.com/aws-solutions/serverless-image-handler/issues/167), [#175](https://github.com/aws-solutions/serverless-image-handler/issues/175)
- Fix HTTP status code for missing images from 500 to 404: [#159](https://github.com/aws-solutions/serverless-image-handler/issues/159)
- Fix European character in filename issue: [#149](https://github.com/aws-solutions/serverless-image-handler/issues/149)
- Fix image scaling issue for filename containing 'x' character: [#163](https://github.com/aws-solutions/serverless-image-handler/issues/163), [#176](https://github.com/aws-solutions/serverless-image-handler/issues/176)
- Fix regular expression issue: [#114](https://github.com/aws-solutions/serverless-image-handler/issues/114), [#121](https://github.com/aws-solutions/serverless-image-handler/issues/121), [#125](https://github.com/aws-solutions/serverless-image-handler/issues/125)
- Fix not working quality parameter: [#129](https://github.com/aws-solutions/serverless-image-handler/issues/129)

## [4.1.0] - 2019-12-31

### Added

- CHANGELOG file
- Access logging to API Gateway

### Changed

- Lambda functions runtime to nodejs12.x
- sharp version (from 0.21.3 to 0.23.3)
- Image handler function to use Composite API (<https://sharp.pixelplumbing.com/en/stable/api-composite/>)
- License to Apache-2.0

### Removed

- Reference to deprecated sharp function (overlayWith)
- Capability to resize images proportionally if width or height is set to 0 (sharp v0.23.1 and later check that the width and height - if present - are positive integers)
