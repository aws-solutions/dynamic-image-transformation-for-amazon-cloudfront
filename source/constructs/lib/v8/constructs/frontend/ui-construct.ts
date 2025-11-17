// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";

export class WebDistributionConstruct extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const webConstruct: CloudFrontToS3 = new CloudFrontToS3(this, "AdminUIDistributionToS3", {
      bucketProps: { serverAccessLogsBucket: undefined },
      cloudFrontDistributionProps: {
        comment: "Admin UI Distribution for Dynamic Image Transformation for Amazon CloudFront",
        enableLogging: true,
        logFilePrefix: "admin-ui-cloudfront/",
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
      },
      insertHttpSecurityHeaders: false,
    });

    this.bucket = webConstruct.s3Bucket!;
    this.distribution = webConstruct.cloudFrontWebDistribution;

    addCfnGuardSuppressRules(this.bucket, [
      {
        id: "S3_BUCKET_LOGGING_ENABLED",
        reason: "S3 access logging not required for this static website hosting bucket as CloudFront access logs provide sufficient visibility for web application monitoring."
      }
    ]);
  }
}
