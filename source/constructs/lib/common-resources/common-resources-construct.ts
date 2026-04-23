// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { ArnFormat, Aws, CfnCondition, Fn, Stack, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import { addCfnCondition } from "../../utils/utils";
import { SolutionConstructProps } from "../types";
import { CustomResourcesConstruct } from "./custom-resources/custom-resource-construct";

export interface CommonResourcesProps extends SolutionConstructProps {
  readonly solutionId: string;
  readonly solutionVersion: string;
  readonly solutionName: string;
}

export interface Conditions {
  readonly deployUICondition: CfnCondition;
  readonly enableSignatureCondition: CfnCondition;
  readonly enableDefaultFallbackImageCondition: CfnCondition;
  readonly enableCorsCondition: CfnCondition;
  readonly autoWebPCondition: CfnCondition;
  readonly enableOriginShieldCondition: CfnCondition;
  readonly enableS3ObjectLambdaCondition: CfnCondition;
  readonly disableS3ObjectLambdaCondition: CfnCondition;
  readonly isLogRetentionPeriodInfinite: CfnCondition;
  readonly useExistingCloudFrontDistributionCondition: CfnCondition;
  readonly enableSignedUrlsCondition: CfnCondition;
}

/**
 * Construct that creates Common Resources for the solution.
 */
export class CommonResources extends Construct {
  public readonly conditions: Conditions;
  public readonly logsBucket: IBucket;
  public readonly secretsManagerPolicy: Policy;
  public readonly customResources: CustomResourcesConstruct;

  constructor(scope: Construct, id: string, props: CommonResourcesProps) {
    super(scope, id);

    this.conditions = {
      deployUICondition: new CfnCondition(this, "DeployDemoUICondition", {
        expression: Fn.conditionEquals(props.deployUI, "Yes"),
      }),
      enableSignatureCondition: new CfnCondition(this, "EnableSignatureCondition", {
        expression: Fn.conditionEquals(props.enableSignature, "Yes"),
      }),
      enableDefaultFallbackImageCondition: new CfnCondition(this, "EnableDefaultFallbackImageCondition", {
        expression: Fn.conditionEquals(props.enableDefaultFallbackImage, "Yes"),
      }),
      enableCorsCondition: new CfnCondition(this, "EnableCorsCondition", {
        expression: Fn.conditionEquals(props.corsEnabled, "Yes"),
      }),
      autoWebPCondition: new CfnCondition(this, "AutoWebPCondition", {
        expression: Fn.conditionEquals(props.autoWebP, "Yes"),
      }),
      enableOriginShieldCondition: new CfnCondition(this, "EnableOriginShieldCondition", {
        expression: Fn.conditionNot(Fn.conditionEquals(props.originShieldRegion, "Disabled")),
      }),
      enableS3ObjectLambdaCondition: new CfnCondition(this, "EnableS3ObjectLambdaCondition", {
        expression: Fn.conditionEquals(props.enableS3ObjectLambda, "Yes"),
      }),
      disableS3ObjectLambdaCondition: new CfnCondition(this, "DisableS3ObjectLambdaCondition", {
        expression: Fn.conditionNot(Fn.conditionEquals(props.enableS3ObjectLambda, "Yes")),
      }),
      isLogRetentionPeriodInfinite: new CfnCondition(this, "IsLogRetentionPeriodInfinite", {
        expression: Fn.conditionEquals(props.logRetentionPeriod, "Infinite"),
      }),
      useExistingCloudFrontDistributionCondition: new CfnCondition(this, "UseExistingCloudFrontDistributionCondition", {
        expression: Fn.conditionEquals(props.useExistingCloudFrontDistribution, "Yes"),
      }),
      enableSignedUrlsCondition: new CfnCondition(this, "EnableSignedUrlsCondition", {
        expression: Fn.conditionEquals(props.enableSignedUrls, "Yes"),
      }),
    };

    this.secretsManagerPolicy = new Policy(this, "SecretsManagerPolicy", {
      statements: [
        new PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [
            Stack.of(this).formatArn({
              partition: Aws.PARTITION,
              service: "secretsmanager",
              region: Aws.REGION,
              account: Aws.ACCOUNT_ID,
              resource: "secret",
              resourceName: `${props.secretsManager}*`,
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            }),
          ],
        }),
      ],
    });
    addCfnCondition(this.secretsManagerPolicy, this.conditions.enableSignatureCondition);

    this.customResources = new CustomResourcesConstruct(this, "CustomResources", {
      conditions: this.conditions,
      secretsManagerPolicy: this.secretsManagerPolicy,
      ...props,
    });

    this.logsBucket = this.customResources.createLogBucket();
  }
}  
