// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PriceClass } from "aws-cdk-lib/aws-cloudfront";
import { Aspects, CfnMapping, CfnOutput, CfnParameter, Stack, StackProps, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ConditionAspect, SuppressLambdaFunctionCfnRulesAspect } from "../utils/aspects";
import { BackEnd } from "./back-end/back-end-construct";
import { CommonResources } from "./common-resources/common-resources-construct";
import { FrontEndConstruct as FrontEnd } from "./front-end/front-end-construct";
import { SolutionConstructProps, YesNo } from "./types";

export interface ServerlessImageHandlerStackProps extends StackProps {
  readonly solutionId: string;
  readonly solutionName: string;
  readonly solutionVersion: string;
}

export class ServerlessImageHandlerStack extends Stack {
  constructor(scope: Construct, id: string, props: ServerlessImageHandlerStackProps) {
    super(scope, id, props);

    const corsEnabledParameter = new CfnParameter(this, "CorsEnabledParameter", {
      type: "String",
      description: `Would you like to enable Cross-Origin Resource Sharing (CORS) for the image handler API? Select 'Yes' if so.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    });

    const corsOriginParameter = new CfnParameter(this, "CorsOriginParameter", {
      type: "String",
      description: `If you selected 'Yes' above, please specify an origin value here. A wildcard (*) value will support any origin. We recommend specifying an origin (i.e. https://example.domain) to restrict cross-site access to your API.`,
      default: "*",
    });

    const sourceBucketsParameter = new CfnParameter(this, "SourceBucketsParameter", {
      type: "String",
      description:
        "(Required) List the buckets (comma-separated) within your account that contain original image files. If you plan to use Thumbor or Custom image requests with this solution, the source bucket for those requests will be the first bucket listed in this field.",
      allowedPattern: ".+",
      default: "defaultBucket, bucketNo2, bucketNo3, ...",
    });

    const deployDemoUIParameter = new CfnParameter(this, "DeployDemoUIParameter", {
      type: "String",
      description:
        "Would you like to deploy a demo UI to explore the features and capabilities of this solution? This will create an additional Amazon S3 bucket and Amazon CloudFront distribution in your account.",
      allowedValues: ["Yes", "No"],
      default: "Yes",
    });

    const logRetentionPeriodParameter = new CfnParameter(this, "LogRetentionPeriodParameter", {
      type: "Number",
      description:
        "This solution automatically logs events to Amazon CloudWatch. Select the amount of time for CloudWatch logs from this solution to be retained (in days).",
      allowedValues: [
        "1",
        "3",
        "5",
        "7",
        "14",
        "30",
        "60",
        "90",
        "120",
        "150",
        "180",
        "365",
        "400",
        "545",
        "731",
        "1827",
        "3653",
      ],
      default: "1",
    });

    const autoWebPParameter = new CfnParameter(this, "AutoWebPParameter", {
      type: "String",
      description: `Would you like to enable automatic WebP based on accept headers? Select 'Yes' if so.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    });

    const enableSignatureParameter = new CfnParameter(this, "EnableSignatureParameter", {
      type: "String",
      description: `Would you like to enable the signature? If so, select 'Yes' and provide SecretsManagerSecret and SecretsManagerKey values.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    });

    const secretsManagerSecretParameter = new CfnParameter(this, "SecretsManagerSecretParameter", {
      type: "String",
      description: "The name of AWS Secrets Manager secret. You need to create your secret under this name.",
      default: "",
    });

    const secretsManagerKeyParameter = new CfnParameter(this, "SecretsManagerKeyParameter", {
      type: "String",
      description:
        "The name of AWS Secrets Manager secret key. You need to create secret key with this key name. The secret value would be used to check signature.",
      default: "",
    });

    const enableDefaultFallbackImageParameter = new CfnParameter(this, "EnableDefaultFallbackImageParameter", {
      type: "String",
      description: `Would you like to enable the default fallback image? If so, select 'Yes' and provide FallbackImageS3Bucket and FallbackImageS3Key values.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    });

    const fallbackImageS3BucketParameter = new CfnParameter(this, "FallbackImageS3BucketParameter", {
      type: "String",
      description:
        "The name of the Amazon S3 bucket which contains the default fallback image. e.g. my-fallback-image-bucket",
      default: "",
    });

    const fallbackImageS3KeyParameter = new CfnParameter(this, "FallbackImageS3KeyParameter", {
      type: "String",
      description: "The name of the default fallback image object key including prefix. e.g. prefix/image.jpg",
      default: "",
    });

    const cloudFrontPriceClassParameter = new CfnParameter(this, "CloudFrontPriceClassParameter", {
      type: "String",
      description:
        "The AWS CloudFront price class to use. For more information see: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PriceClass.html",
      allowedValues: [PriceClass.PRICE_CLASS_ALL, PriceClass.PRICE_CLASS_200, PriceClass.PRICE_CLASS_100],
      default: PriceClass.PRICE_CLASS_ALL,
    });

    const avifCacheBucketParameter = new CfnParameter(this, "AvifCacheBucketParameter", {
      type: "String",
      description: "The name of the S3 bucket used to cache AVIF images. Create this bucket manually before deploying.",
      default: "",
    });

    const vpcSubnetIdsParameter = new CfnParameter(this, "VpcSubnetIdsParameter", {
      type: "String",
      description: "Comma-separated list of private subnet IDs for Lambda VPC config (required for EFS access).",
      default: "",
    });

    const vpcSecurityGroupIdsParameter = new CfnParameter(this, "VpcSecurityGroupIdsParameter", {
      type: "String",
      description: "Comma-separated list of security group IDs for Lambda VPC config.",
      default: "",
    });

    const efsAccessPointArnParameter = new CfnParameter(this, "EfsAccessPointArnParameter", {
      type: "String",
      description: "ARN of the EFS access point to mount at /mnt/bw_images. Leave empty to disable EFS.",
      default: "",
    });

    const solutionMapping = new CfnMapping(this, "Solution", {
      mapping: {
        Config: {
          AnonymousUsage: "Yes",
          SolutionId: props.solutionId,
          Version: props.solutionVersion,
        },
      },
      lazy: true,
    });

    const anonymousUsage = `${solutionMapping.findInMap("Config", "AnonymousUsage")}`;

    const solutionConstructProps: SolutionConstructProps = {
      corsEnabled: corsEnabledParameter.valueAsString,
      corsOrigin: corsOriginParameter.valueAsString,
      sourceBuckets: sourceBucketsParameter.valueAsString,
      deployUI: deployDemoUIParameter.valueAsString as YesNo,
      logRetentionPeriod: logRetentionPeriodParameter.valueAsNumber,
      autoWebP: autoWebPParameter.valueAsString,
      enableSignature: enableSignatureParameter.valueAsString as YesNo,
      secretsManager: secretsManagerSecretParameter.valueAsString,
      secretsManagerKey: secretsManagerKeyParameter.valueAsString,
      enableDefaultFallbackImage: enableDefaultFallbackImageParameter.valueAsString as YesNo,
      fallbackImageS3Bucket: fallbackImageS3BucketParameter.valueAsString,
      fallbackImageS3KeyBucket: fallbackImageS3KeyParameter.valueAsString,
      avifCacheBucket: avifCacheBucketParameter.valueAsString,
      vpcSubnetIds: vpcSubnetIdsParameter.valueAsString,
      vpcSecurityGroupIds: vpcSecurityGroupIdsParameter.valueAsString,
      efsAccessPointArn: efsAccessPointArnParameter.valueAsString,
    };

    const commonResources = new CommonResources(this, "CommonResources", {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      solutionName: props.solutionName,
      ...solutionConstructProps,
    });

    const frontEnd = new FrontEnd(this, "FrontEnd", {
      logsBucket: commonResources.logsBucket,
      conditions: commonResources.conditions,
    });

    const backEnd = new BackEnd(this, "BackEnd", {
      solutionVersion: props.solutionVersion,
      solutionName: props.solutionName,
      secretsManagerPolicy: commonResources.secretsManagerPolicy,
      logsBucket: commonResources.logsBucket,
      uuid: commonResources.customResources.uuid,
      cloudFrontPriceClass: cloudFrontPriceClassParameter.valueAsString,
      ...solutionConstructProps,
    });

    commonResources.customResources.setupAnonymousMetric({
      anonymousData: anonymousUsage,
      ...solutionConstructProps,
    });

    commonResources.customResources.setupValidateSourceAndFallbackImageBuckets({
      sourceBuckets: sourceBucketsParameter.valueAsString,
      fallbackImageS3Bucket: fallbackImageS3BucketParameter.valueAsString,
      fallbackImageS3Key: fallbackImageS3KeyParameter.valueAsString,
    });

    commonResources.customResources.setupValidateSecretsManager({
      secretsManager: secretsManagerSecretParameter.valueAsString,
      secretsManagerKey: secretsManagerKeyParameter.valueAsString,
    });

    commonResources.customResources.setupCopyWebsiteCustomResource({
      hostingBucket: frontEnd.websiteHostingBucket,
    });
    const singletonFunction = this.node.findChild("Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C");
    Aspects.of(singletonFunction).add(new ConditionAspect(commonResources.conditions.deployUICondition));

    commonResources.customResources.setupPutWebsiteConfigCustomResource({
      hostingBucket: frontEnd.websiteHostingBucket,
      apiEndpoint: backEnd.domainName,
    });

    commonResources.appRegistryApplication({
      description: `${props.solutionId} - ${props.solutionName}. Version ${props.solutionVersion}`,
      solutionVersion: props.solutionVersion,
      solutionId: props.solutionId,
      applicationName: props.solutionName,
    });

    this.templateOptions.metadata = {
      "AWS::CloudFormation::Interface": {
        ParameterGroups: [
          {
            Label: { default: "CORS Options" },
            Parameters: [corsEnabledParameter.logicalId, corsOriginParameter.logicalId],
          },
          {
            Label: { default: "Image Sources" },
            Parameters: [sourceBucketsParameter.logicalId],
          },
          {
            Label: { default: "Demo UI" },
            Parameters: [deployDemoUIParameter.logicalId],
          },
          {
            Label: { default: "Event Logging" },
            Parameters: [logRetentionPeriodParameter.logicalId],
          },
          {
            Label: {
              default:
                "Image URL Signature (Note: Enabling signature is not compatible with previous image URLs, which could result in broken image links. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/considerations.html)",
            },
            Parameters: [
              enableSignatureParameter.logicalId,
              secretsManagerSecretParameter.logicalId,
              secretsManagerKeyParameter.logicalId,
            ],
          },
          {
            Label: {
              default:
                "Default Fallback Image (Note: Enabling default fallback image returns the default fallback image instead of JSON object when error happens. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/considerations.html)",
            },
            Parameters: [
              enableDefaultFallbackImageParameter.logicalId,
              fallbackImageS3BucketParameter.logicalId,
              fallbackImageS3KeyParameter.logicalId,
            ],
          },
          {
            Label: { default: "Auto WebP" },
            Parameters: [autoWebPParameter.logicalId],
          },
        ],
        ParameterLabels: {
          [corsEnabledParameter.logicalId]: { default: "CORS Enabled" },
          [corsOriginParameter.logicalId]: { default: "CORS Origin" },
          [sourceBucketsParameter.logicalId]: { default: "Source Buckets" },
          [deployDemoUIParameter.logicalId]: { default: "Deploy Demo UI" },
          [logRetentionPeriodParameter.logicalId]: {
            default: "Log Retention Period",
          },
          [autoWebPParameter.logicalId]: { default: "AutoWebP" },
          [enableSignatureParameter.logicalId]: { default: "Enable Signature" },
          [secretsManagerSecretParameter.logicalId]: {
            default: "SecretsManager Secret",
          },
          [secretsManagerKeyParameter.logicalId]: {
            default: "SecretsManager Key",
          },
          [enableDefaultFallbackImageParameter.logicalId]: {
            default: "Enable Default Fallback Image",
          },
          [fallbackImageS3BucketParameter.logicalId]: {
            default: "Fallback Image S3 Bucket",
          },
          [fallbackImageS3KeyParameter.logicalId]: {
            default: "Fallback Image S3 Key",
          },
          [cloudFrontPriceClassParameter.logicalId]: {
            default: "CloudFront PriceClass",
          },
        },
      },
    };

    /* eslint-disable no-new */
    new CfnOutput(this, "ApiEndpoint", {
      value: `https://${backEnd.domainName}`,
      description: "Link to API endpoint for sending image requests to.",
    });
    new CfnOutput(this, "DemoUrl", {
      value: `https://${frontEnd.domainName}/index.html`,
      description: "Link to the demo user interface for the solution.",
      condition: commonResources.conditions.deployUICondition,
    });
    new CfnOutput(this, "SourceBuckets", {
      value: sourceBucketsParameter.valueAsString,
      description: "Amazon S3 bucket location containing original image files.",
    });
    new CfnOutput(this, "CorsEnabled", {
      value: corsEnabledParameter.valueAsString,
      description: "Indicates whether Cross-Origin Resource Sharing (CORS) has been enabled for the image handler API.",
    });
    new CfnOutput(this, "CorsOrigin", {
      value: corsOriginParameter.valueAsString,
      description: "Origin value returned in the Access-Control-Allow-Origin header of image handler API responses.",
      condition: commonResources.conditions.enableCorsCondition,
    });
    new CfnOutput(this, "LogRetentionPeriod", {
      value: logRetentionPeriodParameter.valueAsString,
      description: "Number of days for event logs from Lambda to be retained in CloudWatch.",
    });

    Aspects.of(this).add(new SuppressLambdaFunctionCfnRulesAspect());
    Tags.of(this).add("SolutionId", props.solutionId);
  }
}
