// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Aspects } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";

import { ConditionAspect } from "../../utils/aspects";
import { addCfnSuppressRules } from "../../utils/utils";
import { Conditions } from "../common-resources/common-resources-construct";

export interface FrontEndProps {
  readonly logsBucket: IBucket;
  readonly conditions: Conditions;
}

/**
 * Construct that creates the front-end resources for the solution. A CloudFront Distribution, S3 bucket.
 */
export class FrontEndConstruct extends Construct {
  public readonly domainName: string;
  public readonly websiteHostingBucket: Bucket;

  constructor(scope: Construct, id: string, props: FrontEndProps) {
    super(scope, id);

    const cloudFrontToS3 = new CloudFrontToS3(this, "DistributionToS3", {
      bucketProps: { serverAccessLogsBucket: undefined },
      cloudFrontDistributionProps: {
        comment: "Demo UI Distribution for Dynamic Image Transformation for Amazon CloudFront",
        enableLogging: true,
        logBucket: props.logsBucket,
        logFilePrefix: "ui-cloudfront/",
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

    // S3 bucket does not require access logging, calls are logged by CloudFront
    cloudFrontToS3.node.tryRemoveChild("S3LoggingBucket");
    addCfnSuppressRules(cloudFrontToS3.s3Bucket, [
      { id: "W35", reason: "This S3 bucket does not require access logging." },
    ]);

    this.domainName = cloudFrontToS3.cloudFrontWebDistribution.domainName;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.websiteHostingBucket = cloudFrontToS3.s3Bucket!;

    Aspects.of(this).add(new ConditionAspect(props.conditions.deployUICondition));
  }
}
