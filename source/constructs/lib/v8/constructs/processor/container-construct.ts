// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, aws_ecr as ecr, aws_iam as iam, RemovalPolicy, Stack } from "aws-cdk-lib";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";

/**
 * Properties for ContainerConstruct
 */
export interface ContainerConstructProps {
  /**
   * Source directory path where container/Dockerfile is located
   * Only used in local development mode
   */
  sourceDirectory: string;
}

/**
 * Information about container deployment configuration
 */
export interface ContainerDeploymentInfo {
  mode: "local" | "production";
  imageUri: string;
  hasPrivateEcr: boolean;
  hasDockerAsset: boolean;
}

/**
 * Container construct that manages container images for the image processing service
 *
 * Supports two deployment modes:
 * 1. Local development: Builds Docker image from source/container/Dockerfile
 * 2. Production pipeline: Uses pre-built image from public ECR (via stack synthesizer)
 *
 * Creates:
 * - Private ECR repository (local mode only)
 * - Docker image asset (local mode only)
 * - Proper IAM permissions for ECS tasks
 */
export class ContainerConstruct extends Construct {
  private ecrRepository?: ecr.Repository;
  private dockerImageAsset?: DockerImageAsset;
  public readonly imageUri: string;
  public readonly isLocalBuild: boolean;

  constructor(scope: Construct, id: string, props?: ContainerConstructProps) {
    super(scope, id);

    // Determine deployment mode based on stack synthesizer context
    const stack = Stack.of(this);
    const productionImageUri = stack.node.tryGetContext("productionImageUri");

    this.isLocalBuild = !productionImageUri;

    if (this.isLocalBuild) {
      // Local development mode - build image and create ECR repository
      if (!props?.sourceDirectory) {
        throw new Error("sourceDirectory are required for local development mode");
      }
      this.setupLocalBuild(props);
      this.imageUri = this.dockerImageAsset!.imageUri;
    } else {
      // Production mode - use pre-built image from solutions public ECR
      this.imageUri = productionImageUri;
    }
  }

  /**
   * Setup local build mode with ECR repository and Docker image asset
   */
  private setupLocalBuild(props: ContainerConstructProps): void {
    this.ecrRepository = new ecr.Repository(this, "ImageProcessingRepository", {
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: RemovalPolicy.DESTROY, // For local environment and development
      lifecycleRules: [
        {
          description: "Keep last 10 images",
          maxImageCount: 10,
          rulePriority: 2,
        },
        {
          description: "Delete untagged images after 1 day",
          maxImageAge: Duration.days(1),
          rulePriority: 1,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
      ],
    });

    this.dockerImageAsset = new DockerImageAsset(this, "ImageProcessingDockerAsset", {
      directory: props.sourceDirectory,
      file: "Dockerfile",
      platform: Platform.LINUX_AMD64,
    });
  }

  /**
   * Create IAM role for ECS task execution with appropriate ECR permissions
   */
  public createTaskExecutionRole(): iam.Role {
    const taskExecutionRole = new iam.Role(this, "TaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS Task Execution Role for Image Processing Service",
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")],
    });

    if (this.isLocalBuild && this.ecrRepository) {
      // Local mode - grant pull permissions to private ECR
      this.ecrRepository.grantPull(taskExecutionRole);
    } else {
      // Production mode - grant pull permissions to public ECR
      taskExecutionRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ecr-public:GetAuthorizationToken",
            "ecr-public:BatchCheckLayerAvailability",
            "ecr-public:GetDownloadUrlForLayer",
            "ecr-public:BatchGetImage",
          ],
          resources: ["*"],
        })
      );
    }

    return taskExecutionRole;
  }

  /**
   * Create IAM role for ECS tasks with necessary permissions
   */
  public createTaskRole(configTableArn?: string): iam.Role {
    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS Task Role for Image Processing Service",
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: ["*"], // TODO: Validate perm, restricting might not be possible as customers add origin after deployment
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        resources: ["*"],
      })
    );

    if (configTableArn) {
      taskRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:GetItem",
            "dynamodb:BatchGetItem",
            "dynamodb:DescribeTable",
          ],
          resources: [configTableArn, `${configTableArn}/index/*`],
        })
      );
    }

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["rekognition:DetectFaces"],
        resources: ["*"],
      })
    );

    return taskRole;
  }

  /**
   * Get deployment mode information for debugging/logging
   */
  public getDeploymentInfo(): ContainerDeploymentInfo {
    return {
      mode: this.isLocalBuild ? "local" : "production",
      imageUri: this.imageUri,
      hasPrivateEcr: !!this.ecrRepository,
      hasDockerAsset: !!this.dockerImageAsset,
    };
  }
}
