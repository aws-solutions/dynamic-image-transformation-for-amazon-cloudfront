// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import { Effect, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source as S3Source } from "aws-cdk-lib/aws-s3-deployment";
import {
  ArnFormat,
  Aspects,
  Aws,
  CfnCondition,
  CfnResource,
  CustomResource,
  Duration,
  Fn,
  Lazy,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { addCfnCondition, addCfnSuppressRules } from "../../../utils/utils";

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
  readonly enableS3ObjectLambda: string;
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

export interface SetupValidateExistingDistributionProps {
  readonly existingDistributionId: string;
  readonly condition: CfnCondition;
}

export class CustomResourcesConstruct extends Construct {
  private readonly conditions: Conditions;
  private readonly customResourceRole: Role;
  private readonly customResourceLambda: LambdaFunction;
  public readonly uuid: string;
  public regionedBucketName: string;
  public regionedBucketHash: string;
  public appRegApplicationName: string;
  public existingDistributionDomainName: string;

  constructor(scope: Construct, id: string, props: CustomResourcesConstructProps) {
    super(scope, id);

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
          ],
        }),
        S3AccessPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["s3:ListBucket", "s3:GetBucketLocation"],
              resources: this.createSourceBucketsResource(),
            }),
            new PolicyStatement({
              actions: ["s3:GetObject"],
              resources: [`arn:aws:s3:::${props.fallbackImageS3Bucket}/${props.fallbackImageS3KeyBucket}`],
            }),
            new PolicyStatement({
              actions: [
                "s3:putBucketAcl",
                "s3:putEncryptionConfiguration",
                "s3:putBucketPolicy",
                "s3:CreateBucket",
                "s3:PutBucketOwnershipControls",
                "s3:PutBucketTagging",
                "s3:PutBucketVersioning",
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
            new PolicyStatement({
              actions: ["s3:ListBucket"],
              resources: [`arn:aws:s3:::sih-dummy-*`],
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
        AppRegistryPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["cloudformation:DescribeStackResources"],
              resources: [
                Stack.of(this).formatArn({
                  partition: Aws.PARTITION,
                  service: "cloudformation",
                  region: Aws.REGION,
                  account: Aws.ACCOUNT_ID,
                  resource: "stack",
                  resourceName: `${Aws.STACK_NAME}/*`,
                  arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
                }),
              ],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["servicecatalog:GetApplication"],
              resources: [
                Stack.of(this).formatArn({
                  partition: Aws.PARTITION,
                  service: "servicecatalog",
                  region: Aws.REGION,
                  account: Aws.ACCOUNT_ID,
                  resource: "applications",
                  resourceName: `*`,
                  arnFormat: ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME,
                }),
              ],
            }),
          ],
        }),
        ExistingDistributionPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["cloudfront:GetDistribution"],
              resources: [
                Stack.of(this).formatArn({
                  partition: Aws.PARTITION,
                  service: "cloudfront",
                  region: "",
                  account: Aws.ACCOUNT_ID,
                  resource: `distribution/${props.existingCloudFrontDistributionId}`,
                  arnFormat: ArnFormat.COLON_RESOURCE_NAME,
                }),
              ],
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
      {
        id: "F10",
        reason: "Using inline policy",
      },
    ]);

    props.secretsManagerPolicy.attachToRole(this.customResourceRole);

    this.customResourceLambda = new NodejsFunction(this, "CustomResourceFunction", {
      description: `${props.solutionName} (${props.solutionVersion}): Custom resource`,
      runtime: Runtime.NODEJS_20_X,
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

  public setupWebsiteHostingBucketPolicy(websiteHostingBucket: IBucket) {
    const websiteHostingBucketPolicy = new Policy(this, "WebsiteHostingBucketPolicy", {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ["s3:GetObject", "s3:PutObject"],
            resources: [websiteHostingBucket.bucketArn + "/*"],
          }),
        ],
      }),
      roles: [this.customResourceRole],
    });
    addCfnCondition(websiteHostingBucketPolicy, this.conditions.deployUICondition);
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
      EnableS3ObjectLambda: props.enableS3ObjectLambda,
      OriginShieldRegion: props.originShieldRegion,
      UseExistingCloudFrontDistribution: props.useExistingCloudFrontDistribution,
    });
  }

  public setupValidateSourceAndFallbackImageBuckets(props: ValidateSourceAndFallbackImageBucketsCustomResourceProps) {
    this.createCustomResource("CustomResourceCheckSourceBuckets", this.customResourceLambda, {
      CustomAction: "checkSourceBuckets",
      Region: Aws.REGION,
      SourceBuckets: props.sourceBuckets,
    });

    const regionedBucketValidationResults = this.createCustomResource(
      "CustomResourceCheckFirstBucketRegion",
      this.customResourceLambda,
      {
        CustomAction: "checkFirstBucketRegion",
        Region: Aws.REGION,
        SourceBuckets: Fn.select(0, Fn.split(",", props.sourceBuckets)), // Only pass the first bucket to prevent unecessary execution on SourceBucketsParameter changes
        UUID: this.uuid,
        S3ObjectLambda: props.enableS3ObjectLambda,
      }
    );
    this.regionedBucketName = Lazy.string({
      produce: () => regionedBucketValidationResults.getAttString("BucketName"),
    });
    this.regionedBucketHash = Lazy.string({
      produce: () => regionedBucketValidationResults.getAttString("BucketHash"),
    });

    const getAppRegApplicationNameResults = this.createCustomResource(
      "CustomResourceGetAppRegApplicationName",
      this.customResourceLambda,
      {
        CustomAction: "getAppRegApplicationName",
        Region: Aws.REGION,
        DefaultName: Fn.join("-", ["AppRegistry", Aws.STACK_NAME, Aws.REGION, Aws.ACCOUNT_ID]),
      }
    );
    this.appRegApplicationName = getAppRegApplicationNameResults.getAttString("ApplicationName");

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
      sources: [S3Source.asset(path.join(__dirname, "../../../../demo-ui"), { exclude: ["node_modules/*"] })],
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
        ConfigItem: { apiEndpoint: props.apiEndpoint },
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

  public setupValidateExistingDistribution(props: SetupValidateExistingDistributionProps) {
    const validateExistingDistributionResults = this.createCustomResource(
      "CustomResourceValidateExistingDistribution",
      this.customResourceLambda,
      {
        CustomAction: "validateExistingDistribution",
        Region: Aws.REGION,
        ExistingDistributionID: props.existingDistributionId,
      },
      props.condition
    );
    this.existingDistributionDomainName = validateExistingDistributionResults.getAttString("DistributionDomainName");
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

  public createSourceBucketsResource(resourceName: string = "") {
    return Fn.split(
      ",",
      Fn.sub(
        `arn:aws:s3:::\${rest}${resourceName}`,

        {
          rest: Fn.join(
            `${resourceName},arn:aws:s3:::`,
            Fn.split(",", Fn.join("", Fn.split(" ", Fn.ref("SourceBucketsParameter"))))
          ),
        }
      )
    );
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
