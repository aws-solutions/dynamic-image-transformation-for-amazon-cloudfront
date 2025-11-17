// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Aws,
  CfnCondition,
  CfnMapping,
  CfnOutput,
  CfnParameter,
  CfnResource,
  Duration,
  Fn,
  NestedStack,
  NestedStackProps,
} from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as path from "path";
import { addCfnGuardSuppressRules } from "../../../utils/utils";
import { Utility } from "../constructs/common";
import { AlbEcsConstruct, ContainerConstruct, EcsConfig, NetworkConstruct } from "../constructs/processor";
import { SolutionsMetrics, ExecutionDay } from "metrics-utils";

interface ImageProcessingStackProps extends NestedStackProps {
  configTable: TableV2;
  uuid?: string;
  configTableArn?: string;
}

/**
 * CDK nested stack that deploys resources needed for DIT image processing engine running on ECS tasks
 *
 * Architecture:
 * - Production mode: Internal ALB + CloudFront with VPC Origins
 * - Development mode: Internet-facing ALB
 * - ECS Fargate service with configurable t-shirt sizing
 * - Health check endpoint at /health-check
 */
export class ImageProcessingStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ImageProcessingStackProps) {
    super(scope, id, props);

    // CloudFormation Parameters
    const deploymentSize = new CfnParameter(this, "DeploymentSize", {
      type: "String",
      description: "T-shirt sizing for ECS Fargate deployment configuration",
      allowedValues: ["small", "medium", "large", "xlarge"],
      default: "small",
      constraintDescription: "Must be one of: small, medium, large, xlarge",
    });

    const originOverrideHeader = new CfnParameter(this, "OriginOverrideHeader", {
      type: "String",
      description: "HTTP header name used to override the origin destination for image requests",
      default: "",
      constraintDescription: "Must be a valid HTTP header name or empty",
      allowedPattern: "^$|^[a-zA-Z0-9-]+$",
    });

    // Get VPC CIDR from context with fallback to default
    const vpcCidr = this.node.tryGetContext("vpcCidr") || "10.0.0.0/16";

    // Get deployment size from CloudFormation parameter
    const deploymentSizeValue = deploymentSize.valueAsString;

    // Get ECS configuration based on deployment size
    const ecsConfig = this.getEcsConfiguration(deploymentSizeValue);

    const networkConstruct = new NetworkConstruct(this, "Network", {
      vpcCidr,
    });

    const containerConstruct = new ContainerConstruct(this, "Container", {
      sourceDirectory: path.join(__dirname, "../../../../"), // Points to source/ directory
    });

    const albEcsConstruct = new AlbEcsConstruct(this, "AlbEcs", {
      vpc: networkConstruct.vpc,
      ecsSecurityGroup: networkConstruct.ecsSecurityGroup,
      albSecurityGroup: networkConstruct.albSecurityGroup,
      imageUri: containerConstruct.imageUri,
      ecsConfig,
      taskExecutionRole: containerConstruct.createTaskExecutionRole(),
      taskRole: containerConstruct.createTaskRole(props.configTable.tableArn),
      stackName: this.stackName,
      configTableArn: props.configTable.tableArn,
      originOverrideHeader: originOverrideHeader.valueAsString,
    });

    const deploymentMode = this.node.tryGetContext("deploymentMode") || "prod";
    const isDevMode = deploymentMode === "dev";

    let vpcOrigin: origins.VpcOrigin | undefined;
    if (!isDevMode) {
      vpcOrigin = origins.VpcOrigin.withApplicationLoadBalancer(albEcsConstruct.loadBalancer, {
        httpPort: 80,
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        customHeaders: {
          "X-Origin-Verify": "CloudFrontOrigin",
        },
        vpcOriginName: `dit-vpc-origin-${Aws.REGION}`,
      });
    }

    const hasOriginOverrideHeader = new CfnCondition(this, "HasOriginOverrideHeader", {
      expression: Fn.conditionNot(Fn.conditionEquals(originOverrideHeader.valueAsString, "")),
    });

    let distribution: cloudfront.Distribution | undefined;
    let loggingBucket: s3.Bucket | undefined;
    let ditCachePolicy: cloudfront.CachePolicy | undefined;
    let ditFunction: cloudfront.Function | undefined;

    if (!isDevMode) {
      loggingBucket = new s3.Bucket(this, "LoggingBucket", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        enforceSSL: true,
      });

      addCfnGuardSuppressRules(loggingBucket.node.defaultChild as CfnResource, [
        {
          id: "S3_BUCKET_LOGGING_ENABLED",
          reason:
            "This is a logging bucket for CloudFront distribution. Logging buckets don't need logging enabled to avoid circular logging.",
        },
      ]);

      ditFunction = new cloudfront.Function(this, "DitHeaderNormalizationFunction", {
        functionName: `dit-header-normalization-${Aws.REGION}`,
        code: cloudfront.FunctionCode.fromFile({
          filePath: path.join(__dirname, "../functions/dit-header-normalization.js"),
        }),
        comment: "DIT header normalization and cache key optimization function",
        runtime: cloudfront.FunctionRuntime.JS_2_0,
      });

      // Create custom cache policy for DIT with normalized headers
      ditCachePolicy = new cloudfront.CachePolicy(this, "DitCachePolicy", {
        cachePolicyName: `dit-cache-policy-${Aws.REGION}`,
        comment: "Cache policy optimized for DIT with normalized headers",
        defaultTtl: Duration.days(1),
        maxTtl: Duration.days(365),
        minTtl: Duration.seconds(0),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
          "dit-host",
          "dit-accept",
          "dit-dpr",
          "dit-viewport-width"
        ),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      });

      // Override the headers property with conditional logic
      const cfnCachePolicy = ditCachePolicy.node.defaultChild as cloudfront.CfnCachePolicy;
      cfnCachePolicy.addPropertyOverride(
        "CachePolicyConfig.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers",
        Fn.conditionIf(
          hasOriginOverrideHeader.logicalId,
          ["dit-host", "dit-accept", "dit-dpr", "dit-viewport-width", originOverrideHeader.valueAsString],
          ["dit-host", "dit-accept", "dit-dpr", "dit-viewport-width"]
        )
      );

      const imageResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, "ImageResponseHeadersPolicy", {
        responseHeadersPolicyName: `Image-Processing-Headers-${Aws.REGION}`,
        comment: "Security headers with Client Hints for image processing",
        securityHeadersBehavior: {
          strictTransportSecurity: {
            accessControlMaxAge: Duration.seconds(31536000),
            includeSubdomains: false,
            override: false,
          },
          contentTypeOptions: {
            override: true,
          },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN,
            override: false,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: false,
          },
          xssProtection: {
            modeBlock: true,
            protection: true,
            override: false,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "Accept-CH",
              value: "Sec-CH-DPR, Sec-CH-Viewport-Width",
              override: false,
            },
            {
              header: "Accept-CH-Lifetime",
              value: "86400",
              override: false,
            },
          ],
        },
      });

      distribution = new cloudfront.Distribution(this, "ImageProcessingDistribution", {
        comment: `Image Handler Distribution for Dynamic Image Transformation - ${deploymentMode} mode`,
        priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        defaultBehavior: {
          origin: vpcOrigin!,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: ditCachePolicy,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          responseHeadersPolicy: imageResponseHeadersPolicy,
          functionAssociations: [
            {
              function: ditFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
        logBucket: loggingBucket,
        logFilePrefix: "cloudfront-logs/",
        logIncludesCookies: false,
        errorResponses: [
          { httpStatus: 500, ttl: Duration.minutes(10) },
          { httpStatus: 501, ttl: Duration.minutes(10) },
          { httpStatus: 502, ttl: Duration.minutes(10) },
          { httpStatus: 503, ttl: Duration.minutes(10) },
          { httpStatus: 504, ttl: Duration.minutes(10) },
        ],
      });

      const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;

      new cloudfront.CfnMonitoringSubscription(this, 'DistributionMonitoring', {
        distributionId: distribution.distributionId,
        monitoringSubscription: {
          realtimeMetricsSubscriptionConfig: {
            realtimeMetricsSubscriptionStatus: 'Enabled',
          },
        },
      });

      // Add CFN Guard suppression for CloudFront Distribution TLS version requirement
      addCfnGuardSuppressRules(cfnDistribution, [
        {
          id: "CLOUDFRONT_MINIMUM_PROTOCOL_VERSION_RULE",
          reason:
            "Not creating custom certificate and using the default CloudFront certificate that doesn't use TLS 1.2",
        },
      ]);
    }

    new Utility(this, "UtilityLambda", {
      table: props.configTable,
      ecsService: albEcsConstruct.service,
      cluster: albEcsConstruct.cluster,
    });

    if (props.uuid && props.configTableArn) {
      const solutionsMetrics = new SolutionsMetrics(this, "SolutionMetrics", {
        uuid: props.uuid,
        executionDay: ExecutionDay.DAILY,
        configTableArn: props.configTableArn,
      });

      solutionsMetrics.addECSImageSizeMetrics({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addECSImageFormatMetrics({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addECSTransformationTimeBuckets({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addECSImageSizeBuckets({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addECSImageRequestCount({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addECSOriginTypeMetrics({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addECSTransformationUsageMetrics({
        logGroups: [albEcsConstruct.logGroup],
      });

      solutionsMetrics.addTransformationSourceMetrics({
        logGroups: [albEcsConstruct.logGroup],
      });

      if (!isDevMode && distribution) {
        solutionsMetrics.addCloudFrontMetric({
          distributionId: distribution.distributionId,
          metricName: "Requests",
        });

        solutionsMetrics.addCloudFrontMetric({
          distributionId: distribution.distributionId,
          metricName: "CacheHitRate",
          stat: "Average",
        });

        solutionsMetrics.addCloudFrontMetric({
          distributionId: distribution.distributionId,
          metricName: "BytesDownloaded",
        });
      }
    }

    new CfnOutput(this, "DeploymentMode", {
      value: deploymentMode,
      description: `Current deployment mode: ${deploymentMode} (dev=internet-facing ALB, prod=internal ALB with VPC Origins)`,
    });

    new CfnOutput(this, "LoadBalancerScheme", {
      value: isDevMode ? "internet-facing" : "internal",
      description: "ALB scheme indicating accessibility",
    });

    new CfnOutput(this, "VpcId", {
      value: networkConstruct.vpc.vpcId,
      description: "VPC ID for the image processing infrastructure",
    });

    new CfnOutput(this, "VpcCidr", {
      value: vpcCidr,
      description: "VPC CIDR block used for the image processing infrastructure",
    });

    const deploymentInfo = containerConstruct.getDeploymentInfo();
    new CfnOutput(this, "ContainerDeploymentMode", {
      value: deploymentInfo.mode,
      description: "Container deployment mode (local or production)",
    });

    new CfnOutput(this, "ImageUri", {
      value: deploymentInfo.imageUri,
      description: "Container image URI used by ECS tasks",
    });

    new CfnOutput(this, "LoadBalancerDNS", {
      value: albEcsConstruct.getAlbDnsName(),
      description: "DNS name of the Application Load Balancer",
    });

    if (!isDevMode && distribution) {
      new CfnOutput(this, "CloudFrontDistributionId", {
        value: distribution.distributionId,
        description: "CloudFront distribution ID for the image processing service",
      });

      new CfnOutput(this, "CloudFrontDistributionDomainName", {
        value: distribution.distributionDomainName,
        description: "CloudFront distribution domain name for accessing the image processing service",
      });
    }

    if (isDevMode) {
      new CfnOutput(this, "ALBEndpoint", {
        value: `http://${albEcsConstruct.getAlbDnsName()}`,
        description: "Direct ALB endpoint for development mode (bypasses CloudFront)",
      });
    }
  }

  /**
   * Returns ECS Fargate configuration using CloudFormation mappings for dynamic sizing
   */
  private getEcsConfiguration(deploymentSizeParam: string): EcsConfig {
    const ecsConfigMapping = new CfnMapping(this, "EcsConfigMapping", {
      mapping: {
        small: {
          cpu: "1024",
          memory: "2048",
          desiredCount: "2",
          minCapacity: "1",
          maxCapacity: "4",
          scaleInAmount: "-1",
          scaleOutAmount: "1",
        },
        medium: {
          cpu: "2048",
          memory: "4096",
          desiredCount: "3",
          minCapacity: "2",
          maxCapacity: "8",
          scaleInAmount: "-2",
          scaleOutAmount: "2",
        },
        large: {
          cpu: "2048",
          memory: "4096",
          desiredCount: "8",
          minCapacity: "6",
          maxCapacity: "20",
          scaleInAmount: "-3",
          scaleOutAmount: "3",
        },
        xlarge: {
          cpu: "2048",
          memory: "4096",
          desiredCount: "30",
          minCapacity: "24",
          maxCapacity: "96",
          scaleInAmount: "-6",
          scaleOutAmount: "6",
        },
      },
    });

    return {
      cpu: ecsConfigMapping.findInMap(deploymentSizeParam, "cpu"),
      memory: ecsConfigMapping.findInMap(deploymentSizeParam, "memory"),
      desiredCount: ecsConfigMapping.findInMap(deploymentSizeParam, "desiredCount"),
      minCapacity: ecsConfigMapping.findInMap(deploymentSizeParam, "minCapacity"),
      maxCapacity: ecsConfigMapping.findInMap(deploymentSizeParam, "maxCapacity"),
      scaleInAmount: ecsConfigMapping.findInMap(deploymentSizeParam, "scaleInAmount"),
      scaleOutAmount: ecsConfigMapping.findInMap(deploymentSizeParam, "scaleOutAmount"),
    };
  }
}
