// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CfnOutput, CfnParameter, Stack, StackProps } from "aws-cdk-lib";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";
import { DalConstruct } from "../constructs/dal";
import { AuthConstruct, WebDistributionConstruct } from "../constructs/frontend";
import { CSPUpdaterConstruct } from "../constructs/frontend/csp-updater-construct";
import { MetricsConstruct } from "../constructs/metrics";
import { ImageProcessingStack } from "./image-processing-stack";

export interface ManagementStackProps extends StackProps {
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
  description: string;
}

export class ManagementStack extends Stack {
  constructor(scope: Construct, id: string, props?: ManagementStackProps) {
    super(scope, id, props);

    const adminEmail = new CfnParameter(this, "AdminEmail", {
      type: "String",
      description: "Email address of the admin user",
      allowedPattern: "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$",
      constraintDescription: "Must be a valid email address",
      minLength: 7,
      maxLength: 100,
    });

    const deploymentSize = new CfnParameter(this, "DeploymentSize", {
      type: "String",
      description:
        "T-shirt sizing for ECS Fargate deployment configuration. **Small**: 1 vCPU, 2GB RAM, 2 desired tasks (1-4 range). **Medium**: 2 vCPU, 4GB RAM, 3 desired tasks (2-8 range). **Large**: 2 vCPU, 4GB RAM, 8 desired tasks (6-20 range). **XLarge**: 2 vCPU, 4GB RAM, 30 desired tasks (24-96 range)",
      allowedValues: ["small", "medium", "large", "xlarge"],
      default: "small",
      constraintDescription: "Must be one of: small, medium, large, xlarge",
    });

    const originOverrideHeader = new CfnParameter(this, "OriginOverrideHeader", {
      type: "String",
      description:
        "HTTP header used to override the image origin (if present in request, mapping lookup is skipped). This is meant for advanced use-cases only, please refer to implementation guide.",
      default: "",
      constraintDescription: "Must be a valid HTTP header name or empty",
      allowedPattern: "^$|^[a-zA-Z0-9-]+$",
    });

    const webConstruct: WebDistributionConstruct = new WebDistributionConstruct(this, "WebDistribution");

    const authConstruct = new AuthConstruct(this, "Auth", {
      domainName: webConstruct.distribution.domainName,
      region: Aws.REGION,
      userEmail: adminEmail,
    });

    const dalConstruct = new DalConstruct(this, "DataAccessLayer", {
      userPool: authConstruct.userPool,
    });

    new CSPUpdaterConstruct(this, "CSPUpdater", {
      distribution: webConstruct.distribution,
      cognitoDomainUrl: authConstruct.cognitoDomainUrl,
      apiEndpoint: dalConstruct.api.url,
    });

    new s3deploy.BucketDeployment(this, "AdminUIDeployment", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../../../admin-ui/build/")),
        s3deploy.Source.jsonData("amplify-config.json", {
          Auth: {
            Cognito: {
              userPoolId: authConstruct.userPool.userPoolId,
              userPoolClientId: authConstruct.userPoolClient.userPoolClientId,
              loginWith: {
                oauth: {
                  domain: authConstruct.cognitoDomainUrl,
                  redirectSignIn: [`https://${webConstruct.distribution.domainName}/`],
                  redirectSignOut: [`https://${webConstruct.distribution.domainName}/auth/logout-complete`],
                  responseType: "code",
                  scopes: ["openid", "profile", "email", "aws.cognito.signin.user.admin", "dit-api/api"],
                  providers: [],
                },
              },
            },
          },
          API: {
            REST: {
              AdminAPI: {
                endpoint: dalConstruct.api.url,
              },
            },
          },
        }),
      ],
      destinationBucket: webConstruct.bucket,
      prune: true,
    });


    const metricsConstruct = new MetricsConstruct(this, "Metrics", {
      solutionId: props!.solutionId,
      solutionVersion: props!.solutionVersion,
      anonymousData: "Yes",
      useExistingCloudFrontDistribution: "n/a",
      deploymentSize: deploymentSize.valueAsString,
    });

    new ImageProcessingStack(this, "ImageProcessing", {
      configTable: dalConstruct.table,
      uuid: metricsConstruct.uuid,
      configTableArn: dalConstruct.table.tableArn,
      parameters: {
        DeploymentSize: deploymentSize.valueAsString,
        OriginOverrideHeader: originOverrideHeader.valueAsString,
      },
    });

    new CfnOutput(this, "WebPortalUrl", {
      value: `https://${webConstruct.distribution.domainName}`,
      description: "URL for the DIT Admin Web Portal",
    });

    new CfnOutput(this, "APIEndpoint", {
      value: dalConstruct.api.url,
      description: "URL for the DIT Admin API",
    });
  }
}
