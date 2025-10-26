// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PriceClass } from "aws-cdk-lib/aws-cloudfront";
import {
  Aspects,
  CfnCondition,
  CfnMapping,
  CfnOutput,
  CfnParameter,
  CfnRule,
  Fn,
  Stack,
  StackProps,
  Tags,
} from "aws-cdk-lib";
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
        "(Required) List the buckets (comma-separated) within your account that contain original image files. If you plan to use Thumbor or Custom image requests with this solution, the source bucket for those requests will default to the first bucket listed in this field. e.g. (defaultBucket,bucketNo2,bucketNo3,...)",
      allowedPattern: "^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](?:\\s*,\\s*[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])*$",
      constraintDescription: "Source bucket is required. Please provide at least one valid S3 bucket name that is present in your account.",
    });

    const deployDemoUIParameter = new CfnParameter(this, "DeployDemoUIParameter", {
      type: "String",
      description:
        "Would you like to deploy a demo UI to explore the features and capabilities of this solution? This will create an additional Amazon S3 bucket and Amazon CloudFront distribution in your account.",
      allowedValues: ["Yes", "No"],
      default: "Yes",
    });

    const logRetentionPeriodParameter = new CfnParameter(this, "LogRetentionPeriodParameter", {
      type: "String",
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
        "Infinite",
      ],
      default: "180",
    });

    const autoWebPParameter = new CfnParameter(this, "AutoWebPParameter", {
      type: "String",
      description: `Would you like to enable automatic formatting to WebP images when accept headers include "image/webp"? Select 'Yes' if so.`,
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
        "The AWS CloudFront price class to use. Lower price classes will avoid high cost edge locations, reducing cost at the expense of possibly increasing request latency. For more information see: https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_cloudfront/PriceClass.html",
      allowedValues: [PriceClass.PRICE_CLASS_ALL, PriceClass.PRICE_CLASS_200, PriceClass.PRICE_CLASS_100],
      default: PriceClass.PRICE_CLASS_ALL,
    });

    const originShieldRegionParameter = new CfnParameter(this, "OriginShieldRegionParameter", {
      type: "String",
      description:
        "Enabling Origin Shield may see reduced latency and increased cache hit ratios if your requests often come from many regions. If a region is selected, Origin Shield will be enabled and the Origin Shield caching layer will be set up in that region. For information on choosing a region, see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html#choose-origin-shield-region",
      allowedValues: [
        "Disabled",
        "us-east-1",
        "us-east-2",
        "us-west-2",
        "ap-south-1",
        "ap-northeast-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ap-northeast-1",
        "eu-central-1",
        "eu-west-1",
        "eu-west-2",
        "sa-east-1",
      ],
      default: "Disabled",
    });

    const enableS3ObjectLambdaParameter = new CfnParameter(this, "EnableS3ObjectLambdaParameter", {
      type: "String",
      description:
        "Deprecated: This option has been deprecated. Amazon S3 Object Lambda will no longer be open to new customers starting on November 7, 2025. If you were not an existing user of S3 Object Lambda before November 7, 2025, select 'No'. For more information, please visit https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazons3-ol-change.html. **Important: Modifying this value after initial template deployment will delete the existing CloudFront Distribution and create a new one, providing a new domain name and clearing the cache**.",
      allowedValues: ["Yes", "No"],
      default: "No",
    });

   
    console.warn("\n" + "=".repeat(80));
    console.warn("⚠️  S3 Object Lambda Feature Deprecation Notice");
    console.warn("=".repeat(80));
    console.warn("The EnableS3ObjectLambdaParameter has been DEPRECATED.");
    console.warn("");
    console.warn("❌ For NEW deployments: Do NOT set EnableS3ObjectLambdaParameter=Yes");
    console.warn("✅ For EXISTING deployments: You can continue using this feature");
    console.warn("📋 Default value is 'No' - recommended for all new deployments");
    console.warn("=".repeat(80) + "\n");

    const useExistingCloudFrontDistribution = new CfnParameter(this, "UseExistingCloudFrontDistributionParameter", {
      type: "String",
      description:
        "If you would like to use an existing CloudFront distribution, select 'Yes'. Otherwise, select 'No' to create a new CloudFront distribution. This option will require additional manual setup after deployment. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/attaching-existing-distribution.html",
      allowedValues: ["Yes", "No"],
      default: "No",
    });

    const existingCloudFrontDistributionId = new CfnParameter(this, "ExistingCloudFrontDistributionIdParameter", {
      type: "String",
      description:
        "The ID of the existing CloudFront distribution. This parameter is required if 'Use Existing CloudFront Distribution' is set to 'Yes'.",
      default: "",
      allowedPattern: "^$|^E[A-Z0-9]{8,}$",
    });

    /* eslint-disable no-new */
    new CfnRule(this, "ExistingDistributionIdRequiredRule", {
      ruleCondition: Fn.conditionEquals(useExistingCloudFrontDistribution.valueAsString, "Yes"),
      assertions: [
        {
          assert: Fn.conditionNot(Fn.conditionEquals(existingCloudFrontDistributionId.valueAsString, "")),
          assertDescription:
            "If 'UseExistingCloudFrontDistribution' is set to 'Yes', 'ExistingCloudFrontDistributionId' must be provided.",
        },
      ],
    });

    const solutionMapping = new CfnMapping(this, "Solution", {
      mapping: {
        Config: {
          AnonymousUsage: "Yes",
          DeployCloudWatchDashboard: "Yes",
          SolutionId: props.solutionId,
          Version: props.solutionVersion,
          SharpSizeLimit: "",
        },
      },
      lazy: false,
    });

    const anonymousUsage = `${solutionMapping.findInMap("Config", "AnonymousUsage")}`;
    const sharpSizeLimit = `${solutionMapping.findInMap("Config", "SharpSizeLimit")}`;
    const sendAnonymousStatistics = new CfnCondition(this, "SendAnonymousStatistics", {
      expression: Fn.conditionEquals(anonymousUsage, "Yes"),
    });
    const deployCloudWatchDashboard = new CfnCondition(this, "DeployCloudWatchDashboard", {
      expression: Fn.conditionEquals(`${solutionMapping.findInMap("Config", "DeployCloudWatchDashboard")}`, "Yes"),
    });

    const solutionConstructProps: SolutionConstructProps = {
      corsEnabled: corsEnabledParameter.valueAsString,
      corsOrigin: corsOriginParameter.valueAsString,
      sourceBuckets: sourceBucketsParameter.valueAsString,
      deployUI: deployDemoUIParameter.valueAsString as YesNo,
      logRetentionPeriod: logRetentionPeriodParameter.valueAsString,
      autoWebP: autoWebPParameter.valueAsString,
      enableSignature: enableSignatureParameter.valueAsString as YesNo,
      secretsManager: secretsManagerSecretParameter.valueAsString,
      secretsManagerKey: secretsManagerKeyParameter.valueAsString,
      enableDefaultFallbackImage: enableDefaultFallbackImageParameter.valueAsString as YesNo,
      fallbackImageS3Bucket: fallbackImageS3BucketParameter.valueAsString,
      fallbackImageS3KeyBucket: fallbackImageS3KeyParameter.valueAsString,
      originShieldRegion: originShieldRegionParameter.valueAsString,
      enableS3ObjectLambda: enableS3ObjectLambdaParameter.valueAsString,
      useExistingCloudFrontDistribution: useExistingCloudFrontDistribution.valueAsString as YesNo,
      existingCloudFrontDistributionId: existingCloudFrontDistributionId.valueAsString,
    };

    const commonResources = new CommonResources(this, "CommonResources", {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      solutionName: props.solutionName,
      ...solutionConstructProps,
    });

    commonResources.customResources.setupValidateSourceAndFallbackImageBuckets({
      sourceBuckets: sourceBucketsParameter.valueAsString,
      fallbackImageS3Bucket: fallbackImageS3BucketParameter.valueAsString,
      fallbackImageS3Key: fallbackImageS3KeyParameter.valueAsString,
      enableS3ObjectLambda: enableS3ObjectLambdaParameter.valueAsString,
    });

    const frontEnd = new FrontEnd(this, "FrontEnd", {
      logsBucket: commonResources.logsBucket,
      conditions: commonResources.conditions,
    });

    const backEnd = new BackEnd(this, "BackEnd", {
      solutionVersion: props.solutionVersion,
      solutionId: props.solutionId,
      solutionName: props.solutionName,
      secretsManagerPolicy: commonResources.secretsManagerPolicy,
      sendAnonymousStatistics,
      deployCloudWatchDashboard,
      logsBucket: commonResources.logsBucket,
      uuid: commonResources.customResources.uuid,
      regionedBucketName: commonResources.customResources.regionedBucketName,
      regionedBucketHash: commonResources.customResources.regionedBucketHash,
      cloudFrontPriceClass: cloudFrontPriceClassParameter.valueAsString,
      conditions: commonResources.conditions,
      sharpSizeLimit,
      createSourceBucketsResource: commonResources.customResources.createSourceBucketsResource,
      ...solutionConstructProps,
    });

    commonResources.customResources.setupWebsiteHostingBucketPolicy(frontEnd.websiteHostingBucket);

    commonResources.customResources.setupAnonymousMetric({
      anonymousData: anonymousUsage,
      ...solutionConstructProps,
    });

    commonResources.customResources.setupValidateSecretsManager({
      secretsManager: secretsManagerSecretParameter.valueAsString,
      secretsManagerKey: secretsManagerKeyParameter.valueAsString,
    });

    commonResources.customResources.setupValidateExistingDistribution({
      existingDistributionId: existingCloudFrontDistributionId.valueAsString,
      condition: commonResources.conditions.useExistingCloudFrontDistributionCondition,
    });

    commonResources.customResources.setupCopyWebsiteCustomResource({
      hostingBucket: frontEnd.websiteHostingBucket,
    });
    const singletonFunction = this.node.findChild("Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C");
    Aspects.of(singletonFunction).add(new ConditionAspect(commonResources.conditions.deployUICondition));

    const apiEndpointConditionString = Fn.conditionIf(
      commonResources.conditions.useExistingCloudFrontDistributionCondition.logicalId,
      `https://` + commonResources.customResources.existingDistributionDomainName,
      Fn.conditionIf(
        commonResources.conditions.disableS3ObjectLambdaCondition.logicalId,
        `https://` + backEnd.domainName,
        `https://` + backEnd.olDomainName
      )
    ).toString();

    commonResources.customResources.setupPutWebsiteConfigCustomResource({
      hostingBucket: frontEnd.websiteHostingBucket,
      apiEndpoint: apiEndpointConditionString,
    });

    this.templateOptions.metadata = {
      "AWS::CloudFormation::Interface": {
        ParameterGroups: [
          {
            Label: { default: "S3 Object Lambda" },
            Parameters: [enableS3ObjectLambdaParameter.logicalId],
          },
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
                "Image URL Signature (Note: Enabling signature is not compatible with previous image URLs, which could result in broken image links. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/architecture-details.html#image-url-signature)",
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
                "Default Fallback Image (Note: Enabling default fallback image returns the default fallback image instead of JSON object when error happens. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/architecture-details.html#default-fallback-image)",
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
          {
            Label: { default: "CloudFront" },
            Parameters: [
              originShieldRegionParameter.logicalId,
              cloudFrontPriceClassParameter.logicalId,
              useExistingCloudFrontDistribution.logicalId,
              existingCloudFrontDistributionId.logicalId,
            ],
          },
        ],
        ParameterLabels: {
          [enableS3ObjectLambdaParameter.logicalId]: {
            default: "Enable S3 Object Lambda (DEPRECATED)",
          },
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
          [originShieldRegionParameter.logicalId]: {
            default: "Origin Shield Region",
          },
          [useExistingCloudFrontDistribution.logicalId]: {
            default: "Use Existing CloudFront Distribution",
          },
          [existingCloudFrontDistributionId.logicalId]: {
            default: "Existing CloudFront Distribution Id",
          },
        },
      },
    };

    /* eslint-disable no-new */
    new CfnOutput(this, "ApiEndpoint", {
      value: apiEndpointConditionString,
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
    new CfnOutput(this, "CloudFrontLoggingBucket", {
      value: commonResources.logsBucket.bucketName,
      description: "Amazon S3 bucket for storing CloudFront access logs.",
    });
    new CfnOutput(this, "CloudFrontDashboard", {
      value: `https://console.aws.amazon.com/cloudwatch/home?#dashboards/dashboard/${backEnd.operationalDashboard.dashboardName}`,
      description: "CloudFront metrics dashboard for the distribution.",
      condition: deployCloudWatchDashboard,
    });

    Aspects.of(this).add(new SuppressLambdaFunctionCfnRulesAspect());
    Tags.of(this).add("SolutionId", props.solutionId);
  }
}
