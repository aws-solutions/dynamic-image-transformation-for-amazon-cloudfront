// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import {
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
} from "aws-cdk-lib/aws-cloudfront";
import { Policy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Conditions } from "../common-resources/common-resources-construct";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { CfnLogGroup, LogGroup, QueryString } from "aws-cdk-lib/aws-logs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { ArnFormat, Aspects, Aws, CfnCondition, CfnResource, Duration, Fn, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { addCfnSuppressRules } from "../../utils/utils";
import { SolutionConstructProps } from "../types";
import { ApiGatewayArchitecture } from "./api-gateway-architecture";
import { S3ObjectLambdaArchitecture } from "./s3-object-lambda-architecture";
import { SolutionsMetrics, ExecutionDay } from "metrics-utils";
import { ConditionAspect } from "../../utils/aspects";
import { OperationalInsightsDashboard } from "../dashboard/ops-insights-dashboard";
import { Dashboard } from "aws-cdk-lib/aws-cloudwatch";

export interface BackEndProps extends SolutionConstructProps {
  readonly solutionVersion: string;
  readonly solutionId: string;
  readonly solutionName: string;
  readonly sendAnonymousStatistics: CfnCondition;
  readonly deployCloudWatchDashboard: CfnCondition;
  readonly secretsManagerPolicy: Policy;
  readonly logsBucket: IBucket;
  readonly uuid: string;
  readonly regionedBucketName: string;
  readonly regionedBucketHash: string;
  readonly cloudFrontPriceClass: string;
  readonly conditions: Conditions;
  readonly sharpSizeLimit: string;
  readonly createSourceBucketsResource: (key?: string) => string[];
}

export class BackEnd extends Construct {
  public domainName: string;
  public olDomainName: string;
  public operationalDashboard: Dashboard;

  constructor(scope: Construct, id: string, props: BackEndProps) {
    super(scope, id);

    const imageHandlerLambdaFunctionRole = new Role(this, "ImageHandlerFunctionRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      path: "/",
    });
    props.secretsManagerPolicy.attachToRole(imageHandlerLambdaFunctionRole);

    const imageHandlerLambdaFunctionRolePolicy = new Policy(this, "ImageHandlerFunctionPolicy", {
      statements: [
        new PolicyStatement({
          actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
          resources: [
            Stack.of(this).formatArn({
              service: "logs",
              resource: "log-group",
              resourceName: "/aws/lambda/*",
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            }),
          ],
        }),
        new PolicyStatement({
          actions: ["s3:GetObject"],
          resources: props.createSourceBucketsResource("/*"),
        }),
        new PolicyStatement({
          actions: ["s3:ListBucket"],
          resources: props.createSourceBucketsResource(),
        }),
        new PolicyStatement({
          actions: ["s3:GetObject"],
          resources: [`arn:aws:s3:::${props.fallbackImageS3Bucket}/${props.fallbackImageS3KeyBucket}`],
        }),
        new PolicyStatement({
          actions: ["rekognition:DetectFaces", "rekognition:DetectModerationLabels"],
          resources: ["*"],
        }),
      ],
    });

    addCfnSuppressRules(imageHandlerLambdaFunctionRolePolicy, [
      { id: "W12", reason: "rekognition:DetectFaces requires '*' resources." },
    ]);
    imageHandlerLambdaFunctionRole.attachInlinePolicy(imageHandlerLambdaFunctionRolePolicy);

    const imageHandlerLambdaFunction = new NodejsFunction(this, "ImageHandlerLambdaFunction", {
      description: `${props.solutionName} (${props.solutionVersion}): Performs image edits and manipulations`,
      memorySize: 1024,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(29),
      role: imageHandlerLambdaFunctionRole,
      entry: path.join(__dirname, "../../../image-handler/index.ts"),
      environment: {
        AUTO_WEBP: props.autoWebP,
        CORS_ENABLED: props.corsEnabled,
        CORS_ORIGIN: props.corsOrigin,
        SOURCE_BUCKETS: props.sourceBuckets,
        REWRITE_MATCH_PATTERN: "",
        REWRITE_SUBSTITUTION: "",
        ENABLE_SIGNATURE: props.enableSignature,
        SECRETS_MANAGER: props.secretsManager,
        SECRET_KEY: props.secretsManagerKey,
        ENABLE_DEFAULT_FALLBACK_IMAGE: props.enableDefaultFallbackImage,
        DEFAULT_FALLBACK_IMAGE_BUCKET: props.fallbackImageS3Bucket,
        DEFAULT_FALLBACK_IMAGE_KEY: props.fallbackImageS3KeyBucket,
        ENABLE_S3_OBJECT_LAMBDA: props.enableS3ObjectLambda,
        SOLUTION_VERSION: props.solutionVersion,
        SOLUTION_ID: props.solutionId,
        SHARP_SIZE_LIMIT: props.sharpSizeLimit,
      },
      bundling: {
        externalModules: ["sharp"],
        nodeModules: ["sharp"],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          beforeInstall(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              `cd ${outputDir}`,
              "rm -rf node_modules/sharp && npm install --cpu=x64 --os=linux --libc=glibc sharp", // npm 10.4.0+ --libc=glibc is needed for the platform-specific deps to be installed when cross-compiling sharp from mac to linux
            ];
          },
        },
      },
    });

    const imageHandlerLogGroup = new LogGroup(this, "ImageHandlerLogGroup", {
      logGroupName: `/aws/lambda/${imageHandlerLambdaFunction.functionName}`,
    });

    // Access the underlying CfnLogGroup to add conditions
    const cfnLogGroup = imageHandlerLogGroup.node.defaultChild as CfnLogGroup;

    cfnLogGroup.addOverride(
      "Properties.RetentionInDays",
      Fn.conditionIf(props.conditions.isLogRetentionPeriodInfinite.logicalId, Aws.NO_VALUE, props.logRetentionPeriod)
    );

    addCfnSuppressRules(imageHandlerLogGroup, [
      {
        id: "W84",
        reason: "CloudWatch log group is always encrypted by default.",
      },
      {
        id: "W86",
        reason: "Retention days are configured with property override",
      },
    ]);

    const cachePolicy = new CachePolicy(this, "CachePolicy", {
      cachePolicyName: `ServerlessImageHandler-${props.uuid}`,
      defaultTtl: Duration.days(1),
      minTtl: Duration.seconds(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: false,
      headerBehavior: CacheHeaderBehavior.allowList("origin", "accept"),
      queryStringBehavior: CacheQueryStringBehavior.all(),
    });

    const cachePolicyResource = this.node.findChild("CachePolicy").node.defaultChild as CfnResource;
    cachePolicyResource.addOverride(
      "Properties.CachePolicyConfig.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers",
      {
        "Fn::If": [props.conditions.autoWebPCondition.logicalId, ["origin", "accept"], ["origin"]],
      }
    );

    const originRequestPolicy = new OriginRequestPolicy(this, "OriginRequestPolicy", {
      originRequestPolicyName: `ServerlessImageHandler-${props.uuid}`,
      headerBehavior: OriginRequestHeaderBehavior.allowList("origin", "accept"),
      queryStringBehavior: OriginRequestQueryStringBehavior.all(),
    });

    const existingDistribution = Distribution.fromDistributionAttributes(this, "ExistingDistribution", {
      domainName: "",
      distributionId: props.existingCloudFrontDistributionId,
    });

    const apiGatewayArchitecture = new ApiGatewayArchitecture(this, {
      imageHandlerLambdaFunction,
      originRequestPolicy,
      cachePolicy,
      existingDistribution,
      ...props,
    });

    const s3ObjectLambdaArchitecture = new S3ObjectLambdaArchitecture(this, {
      imageHandlerLambdaFunction,
      originRequestPolicy,
      cachePolicy,
      existingDistribution,
      ...props,
    });

    const shortLogRetentionCondition: CfnCondition = new CfnCondition(this, "ShortLogRetentionCondition", {
      expression: Fn.conditionOr(
        Fn.conditionEquals(props.logRetentionPeriod.toString(), "1"),
        Fn.conditionEquals(props.logRetentionPeriod.toString(), "3"),
        Fn.conditionEquals(props.logRetentionPeriod.toString(), "5")
      ),
    });
    const solutionsMetrics = new SolutionsMetrics(this, "SolutionMetrics", {
      uuid: props.uuid,
      executionDay: Fn.conditionIf(
        shortLogRetentionCondition.logicalId,
        ExecutionDay.DAILY,
        ExecutionDay.MONDAY
      ).toString(),
    });

    const conditionalCloudFrontDistributionId = Fn.conditionIf(
      props.conditions.useExistingCloudFrontDistributionCondition.logicalId,
      existingDistribution.distributionId,
      Fn.conditionIf(
        props.conditions.enableS3ObjectLambdaCondition.logicalId,
        s3ObjectLambdaArchitecture.imageHandlerCloudFrontDistribution.distributionId,
        apiGatewayArchitecture.imageHandlerCloudFrontDistribution.distributionId
      ).toString()
    ).toString();

    solutionsMetrics.addLambdaInvocationCount({ functionName: imageHandlerLambdaFunction.functionName });
    solutionsMetrics.addLambdaBilledDurationMemorySize({
      logGroups: [imageHandlerLogGroup],
      queryDefinitionName: "BilledDurationMemorySizeQuery",
    });
    solutionsMetrics.addQueryDefinition({
      logGroups: [imageHandlerLogGroup],
      queryString: new QueryString({
        parseStatements: [
          `@message "requestType: 'Default'" as DefaultRequests`,
          `@message "requestType: 'Thumbor'" as ThumborRequests`,
          `@message "requestType: 'Custom'" as CustomRequests`,
          `@message "Query param edits:" as QueryParamRequests`,
          `@message "expires" as ExpiresRequests`,
        ],
        stats:
          "count(DefaultRequests) as DefaultRequestsCount, count(ThumborRequests) as ThumborRequestsCount, count(CustomRequests) as CustomRequestsCount, count(QueryParamRequests) as QueryParamRequestsCount, count(ExpiresRequests) as ExpiresRequestsCount",
      }),
      queryDefinitionName: "RequestInfoQuery",
    });

    solutionsMetrics.addCloudFrontMetric({
      distributionId: conditionalCloudFrontDistributionId,
      metricName: "Requests",
    });
    solutionsMetrics.addCloudFrontMetric({
      distributionId: conditionalCloudFrontDistributionId,
      metricName: "BytesDownloaded",
    });

    Aspects.of(solutionsMetrics).add(new ConditionAspect(props.sendAnonymousStatistics));

    const operationalInsightsDashboard = new OperationalInsightsDashboard(
      Stack.of(this),
      "OperationalInsightsDashboard",
      {
        enabled: props.conditions.deployUICondition,
        backendLambdaFunctionName: imageHandlerLambdaFunction.functionName,
        cloudFrontDistributionId: conditionalCloudFrontDistributionId,
        namespace: Aws.REGION,
      }
    );
    this.operationalDashboard = operationalInsightsDashboard.dashboard;

    Aspects.of(operationalInsightsDashboard).add(new ConditionAspect(props.deployCloudWatchDashboard));
  }
}
