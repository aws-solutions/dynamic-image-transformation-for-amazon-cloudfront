// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import { Effect, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction, Runtime, RuntimeFamily } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source as S3Source } from "aws-cdk-lib/aws-s3-deployment";
import { ArnFormat, Aspects, Aws, CfnCondition, CfnResource, CustomResource, Duration, Lazy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { addCfnSuppressRules } from "../../../utils/utils";

import { SolutionConstructProps } from "../../types";
import { CommonResourcesProps, Conditions } from "../common-resources-construct";
import { ConditionAspect } from "../../../utils/aspects";

export interface CustomResourcesConstructProps extends CommonResourcesProps {
  readonly conditions: Conditions;
  readonly secretsManagerPolicy: Policy;
}

export interface AnonymousMetricCustomResourceProps extends SolutionConstructProps {
  readonly anonymousData: string;
}

export interface ValidateSourceAndFallbackImageBucketsCustomResourceProps {
  readonly sourceBuckets: string;
  readonly fallbackImageS3Bucket: string;
  readonly fallbackImageS3Key: string;
}

export interface SetupCopyWebsiteCustomResourceProps {
  readonly hostingBucket: Bucket;
}

export interface SetupPutWebsiteConfigCustomResourceProps {
  readonly hostingBucket: Bucket;
  readonly apiEndpoint: string;
}

export interface SetupValidateSecretsManagerProps {
  readonly secretsManager: string;
  readonly secretsManagerKey: string;
}

export class CustomResourcesConstruct extends Construct {
  private readonly solutionVersion: string;
  private readonly conditions: Conditions;
  private readonly customResourceRole: Role;
  private readonly customResourceLambda: LambdaFunction;
  public readonly uuid: string;

  constructor(scope: Construct, id: string, props: CustomResourcesConstructProps) {
    super(scope, id);

    this.solutionVersion = props.solutionVersion;
    this.conditions = props.conditions;

    this.customResourceRole = new Role(this, "CustomResourceRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      path: "/",
      inlinePolicies: {
        CloudWatchLogsPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
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
              actions: [
                "s3:putBucketAcl",
                "s3:putEncryptionConfiguration",
                "s3:putBucketPolicy",
                "s3:CreateBucket",
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:PutBucketOwnershipControls",
              ],
              resources: [
                Stack.of(this).formatArn({
                  partition: Aws.PARTITION,
                  service: "s3",
                  region: "",
                  account: "",
                  resource: "*",
                  arnFormat: ArnFormat.COLON_RESOURCE_NAME,
                }),
              ],
            }),
          ],
        }),
        EC2Policy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["ec2:DescribeRegions"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    addCfnSuppressRules(this.customResourceRole, [
      {
        id: "W11",
        reason:
          "Allow '*' because it is required for making DescribeRegions API call as it doesn't support resource-level permissions and require to choose all resources.",
      },
    ]);

    props.secretsManagerPolicy.attachToRole(this.customResourceRole);

    this.customResourceLambda = new NodejsFunction(this, "CustomResourceFunction", {
      description: `${props.solutionName} (${props.solutionVersion}): Custom resource`,
      runtime: new Runtime("nodejs22.x", RuntimeFamily.NODEJS, { supportsInlineCode: true }),
      timeout: Duration.minutes(1),
      memorySize: 128,
      role: this.customResourceRole,
      entry: path.join(__dirname, "../../../../custom-resource/index.ts"),
      environment: {
        SOLUTION_ID: props.solutionId,
        RETRY_SECONDS: "5",
        SOLUTION_VERSION: props.solutionVersion,
      },
    });

    const customResourceUuid = this.createCustomResource("CustomResourceUuid", this.customResourceLambda, {
      Region: Aws.REGION,
      CustomAction: "createUuid",
    });
    this.uuid = customResourceUuid.getAttString("UUID");
  }

  public setupAnonymousMetric(props: AnonymousMetricCustomResourceProps) {
    this.createCustomResource("CustomResourceAnonymousMetric", this.customResourceLambda, {
      CustomAction: "sendMetric",
      Region: Aws.REGION,
      UUID: this.uuid,
      AnonymousData: props.anonymousData,
      CorsEnabled: props.corsEnabled,
      SourceBuckets: props.sourceBuckets,
      DeployDemoUi: props.deployUI,
      LogRetentionPeriod: props.logRetentionPeriod,
      AutoWebP: props.autoWebP,
      EnableSignature: props.enableSignature,
      EnableDefaultFallbackImage: props.enableDefaultFallbackImage,
    });
  }

  public setupValidateSourceAndFallbackImageBuckets(props: ValidateSourceAndFallbackImageBucketsCustomResourceProps) {
    this.createCustomResource("CustomResourceCheckSourceBuckets", this.customResourceLambda, {
      CustomAction: "checkSourceBuckets",
      Region: Aws.REGION,
      SourceBuckets: props.sourceBuckets,
    });

    this.createCustomResource(
      "CustomResourceCheckFallbackImage",
      this.customResourceLambda,
      {
        CustomAction: "checkFallbackImage",
        FallbackImageS3Bucket: props.fallbackImageS3Bucket,
        FallbackImageS3Key: props.fallbackImageS3Key,
      },
      this.conditions.enableDefaultFallbackImageCondition
    );
  }

  public setupCopyWebsiteCustomResource(props: SetupCopyWebsiteCustomResourceProps) {
    // Stage static assets for the front-end from the local
    /* eslint-disable no-new */
    const bucketDeployment = new BucketDeployment(this, "DeployWebsite", {
      sources: [S3Source.asset(path.join(__dirname, "../../../../demo-ui"))],
      destinationBucket: props.hostingBucket,
      exclude: ["demo-ui-config.js"],
    });
    Aspects.of(bucketDeployment).add(new ConditionAspect(this.conditions.deployUICondition));
  }

  public setupPutWebsiteConfigCustomResource(props: SetupPutWebsiteConfigCustomResourceProps) {
    this.createCustomResource(
      "PutWebsiteConfig",
      this.customResourceLambda,
      {
        CustomAction: "putConfigFile",
        Region: Aws.REGION,
        ConfigItem: { apiEndpoint: `https://${props.apiEndpoint}` },
        DestS3Bucket: props.hostingBucket.bucketName,
        DestS3key: "demo-ui-config.js",
      },
      this.conditions.deployUICondition
    );
  }

  public setupValidateSecretsManager(props: SetupValidateSecretsManagerProps) {
    this.createCustomResource(
      "CustomResourceCheckSecretsManager",
      this.customResourceLambda,
      {
        CustomAction: "checkSecretsManager",
        SecretsManagerName: props.secretsManager,
        SecretsManagerKey: props.secretsManagerKey,
      },
      this.conditions.enableSignatureCondition
    );
  }

  public createLogBucket(): IBucket {
    const bucketSuffix = `${Aws.STACK_NAME}-${Aws.REGION}-${Aws.ACCOUNT_ID}`;
    const logBucketCreationResult = this.createCustomResource("LogBucketCustomResource", this.customResourceLambda, {
      CustomAction: "createCloudFrontLoggingBucket",
      BucketSuffix: bucketSuffix,
    });

    const optInRegionAccessLogBucket = Bucket.fromBucketAttributes(this, "CloudFrontLoggingBucket", {
      bucketName: Lazy.string({
        produce: () => logBucketCreationResult.getAttString("BucketName"),
      }),
      region: Lazy.string({
        produce: () => logBucketCreationResult.getAttString("Region"),
      }),
    });

    return optInRegionAccessLogBucket;
  }

  private createCustomResource(
    id: string,
    customResourceFunction: LambdaFunction,
    props?: Record<string, unknown>,
    condition?: CfnCondition
  ): CustomResource {
    const customResource = new CustomResource(this, id, {
      serviceToken: customResourceFunction.functionArn,
      properties: props,
    });

    if (condition) {
      (customResource.node.defaultChild as CfnResource).cfnOptions.condition = condition;
    }

    return customResource;
  }
}
