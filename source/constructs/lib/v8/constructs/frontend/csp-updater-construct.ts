// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CustomResource, Duration } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { DITNodejsFunction } from "../common";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";

export interface CSPUpdaterConstructProps {
  distribution: cloudfront.Distribution;
  cognitoDomainUrl: string;
  apiEndpoint: string;
}

export class CSPUpdaterConstruct extends Construct {
  constructor(scope: Construct, id: string, props: CSPUpdaterConstructProps) {
    super(scope, id);

    const enhancedCSPPolicy = new cloudfront.ResponseHeadersPolicy(this, "EnhancedCSPPolicy", {
      responseHeadersPolicyName: `CSP-for-DIT-Admin-UI-Enhanced-${Aws.REGION}`,
      comment: "Enhanced security headers for CSP with external services",
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "upgrade-insecure-requests",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'none'",
            "script-src 'self'",
            "style-src 'self'",
            "font-src 'self' data:",
            "img-src 'self' data: https:",
            `connect-src 'self' https://cognito-identity.${Aws.REGION}.amazonaws.com https://cognito-idp.${Aws.REGION}.amazonaws.com ${props.cognitoDomainUrl} ${props.apiEndpoint}`,
            "default-src 'self'"
          ].join("; ") + ";",
          override: false
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.seconds(47304000),
          includeSubdomains: true,
          override: true
        },
        contentTypeOptions: {
          override: true
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true
        }
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: "Cache-Control",
            value: "no-store, no-cache",
            override: true
          }
        ]
      }
    });

    const cspUpdaterFunction = new DITNodejsFunction(this, "CSPUpdaterFunction", {
      entry: require.resolve("./csp-updater-handler"),
    });

    cspUpdaterFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "cloudfront:GetDistributionConfig",
          "cloudfront:UpdateDistribution",
        ],
        resources: [`arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${props.distribution.distributionId}`],
      })
    );

    const provider = new Provider(this, "CSPUpdaterProvider", {
      onEventHandler: cspUpdaterFunction,
    });

    new CustomResource(this, "CSPUpdaterCustomResource", {
      serviceToken: provider.serviceToken,
      properties: {
        DistributionId: props.distribution.distributionId,
        ResponseHeadersPolicyId: enhancedCSPPolicy.responseHeadersPolicyId,
      },
    });

    addCfnGuardSuppressRules(cspUpdaterFunction, [
          {
            id: "LAMBDA_INSIDE_VPC",
            reason:
              "Management API Lambda does not require VPC access as it only interacts with DynamoDB and API Gateway, which are accessible via AWS service endpoints.",
          },
          {
            id: "LAMBDA_CONCURRENCY_CHECK",
            reason:
              "Management API Lambda uses default account-level concurrency limits. Reserved concurrency is not configured as this function does not have specific concurrency isolation requirements.",
          },
    ]);
  }
}
