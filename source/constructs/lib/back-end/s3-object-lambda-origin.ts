// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnDistribution, OriginBase, OriginProps } from "aws-cdk-lib/aws-cloudfront";

export class S3ObjectLambdaOrigin extends OriginBase {
  public constructor(domainName: string, props: OriginProps = {}) {
    super(domainName, props);
  }

  protected renderS3OriginConfig(): CfnDistribution.S3OriginConfigProperty {
    return {};
  }
}
