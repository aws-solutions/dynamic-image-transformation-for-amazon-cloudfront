// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, Fn, RemovalPolicy, Token } from "aws-cdk-lib";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { IRole } from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";
import {
  CONTAINER_PORT,
  CPU_TARGET_UTILIZATION_SCALE_OUT,
  CPU_TARGET_UTILIZATION_SCALE_IN,
  HEALTH_CHECK_HEALTHY_HTTP_CODES,
  HEALTH_CHECK_HEALTHY_THRESHOLD_COUNT,
  HEALTH_CHECK_INTERVAL_SECONDS,
  HEALTH_CHECK_PATH,
  HEALTH_CHECK_TIMEOUT_SECONDS,
  HEALTH_CHECK_UNHEALTHY_THRESHOLD_COUNT,
  LOG_RETENTION_DAYS,
  SCALE_IN_COOLDOWN_MINUTES,
} from "../common";

/**
 * Configuration for ECS Fargate deployment
 * Values can be numbers (for local deployment) or strings (for CloudFormation tokens)
 */
export interface EcsConfig {
  cpu: number | string;
  memory: number | string;
  desiredCount: number | string;
  minCapacity: number | string;
  maxCapacity: number | string;
  scaleInAmount: number | string;
  scaleOutAmount: number | string;
}

/**
 * Properties for AlbEcsConstruct
 */
export interface AlbEcsConstructProps {
  vpc: IVpc;
  imageUri: string;
  ecsSecurityGroup: ISecurityGroup;
  albSecurityGroup: ISecurityGroup;
  ecsConfig: EcsConfig;
  taskRole: IRole;
  taskExecutionRole: IRole;
  stackName: string;
  configTableArn?: string;
  originOverrideHeader?: string;
}

/**
 * ALB + ECS construct that provisions Application Load Balancer and ECS Fargate service
 * Creates
 * - ECS cluster
 * - Task definition
 * - Service
 * - Application Load Balancer
 * - Target group
 * - Auto scaling policy
 */
export class AlbEcsConstruct extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly logGroup: logs.LogGroup;
  private readonly customHeaderName = "X-Origin-Verify";
  private readonly customHeaderValue = "CloudFrontOrigin";

  constructor(scope: Construct, id: string, props: AlbEcsConstructProps) {
    super(scope, id);

    const deploymentMode = this.node.tryGetContext("deploymentMode") || "prod";
    const isDevMode = deploymentMode === "dev";

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      clusterName: `dit-cluster`,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      memoryLimitMiB: Token.asNumber(props.ecsConfig.memory),
      cpu: Token.asNumber(props.ecsConfig.cpu),
      taskRole: props.taskRole,
      executionRole: props.taskExecutionRole,
    });

    this.logGroup = this.addContainerToTaskDefinition(
      this.taskDefinition,
      props.imageUri,
      props.ecsConfig,
      props.configTableArn,
      props.originOverrideHeader
    );

    // ALB configuration based on deployment mode
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc: props.vpc,
      internetFacing: isDevMode,
      vpcSubnets: {
        subnets: isDevMode ? props.vpc.publicSubnets : props.vpc.isolatedSubnets,
      },
      securityGroup: props.albSecurityGroup,
    });

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: props.vpc,
      port: CONTAINER_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: HEALTH_CHECK_PATH,
        protocol: elbv2.Protocol.HTTP,
        port: CONTAINER_PORT.toString(),
        healthyHttpCodes: HEALTH_CHECK_HEALTHY_HTTP_CODES,
        interval: Duration.seconds(HEALTH_CHECK_INTERVAL_SECONDS),
        timeout: Duration.seconds(HEALTH_CHECK_TIMEOUT_SECONDS),
        healthyThresholdCount: HEALTH_CHECK_HEALTHY_THRESHOLD_COUNT,
        unhealthyThresholdCount: HEALTH_CHECK_UNHEALTHY_THRESHOLD_COUNT,
      },
    });

    this.createListener(this.loadBalancer, [this.targetGroup]);
    const listener = this.loadBalancer.node.findChild("Listener") as elbv2.ApplicationListener;
    addCfnGuardSuppressRules(listener.node.defaultChild as elbv2.CfnListener, [
      {
        id: "ELBV2_LISTENER_SSL_POLICY_RULE",
        reason:
          "ALB uses HTTP-only listeners since TLS termination is handled by CloudFront. No TLS certificates are configured on the ALB.",
      },
      {
        id: "ELBV2_LISTENER_PROTOCOL_RULE",
        reason:
          "ALB uses HTTP protocol since TLS termination is handled by CloudFront. HTTPS is not configured on the ALB itself.",
      },
    ]);
    this.service = new ecs.FargateService(this, "Service", {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: Token.asNumber(props.ecsConfig.desiredCount),
      assignPublicIp: true,
      vpcSubnets: {
        subnets: props.vpc.publicSubnets,
      },
      securityGroups: [props.ecsSecurityGroup],
      serviceName: `dit-service`,
    });

    this.service.attachToApplicationTargetGroup(this.targetGroup);
    this.configureAutoScaling(this.service, props.ecsConfig);
  }

  public addContainerToTaskDefinition(
    taskDefinition: ecs.TaskDefinition,
    imageUri: string,
    ecsConfig: EcsConfig,
    configTableArn?: string,
    originOverrideHeader?: string
  ): logs.LogGroup {
    const logGroup = new logs.LogGroup(this, "ContainerLogGroup", {
      retention: LOG_RETENTION_DAYS,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Add CFN Guard suppression for KMS key requirement
    addCfnGuardSuppressRules(logGroup, [
      {
        id: "CLOUDWATCH_LOG_GROUP_ENCRYPTED",
        reason:
          "Using AWS managed encryption for CloudWatch Logs. No customer data is stored, so customer-managed KMS keys are not required to avoid unnecessary costs.",
      },
    ]);

    const environment: { [key: string]: string } = {
      SOLUTION_ID: "SO0023",
      SOLUTION_VERSION: "v8.0.0",
    };

    if (configTableArn) {
      environment.DDB_TABLE_NAME = Token.asString(Fn.select(1, Fn.split("/", configTableArn)));
    }

    // Indicates custom header for origin override functionality, mapping lookup is skipped if the header is present in request
    if (originOverrideHeader) {
      environment.CUSTOM_ORIGIN_HEADER = originOverrideHeader;
    }

    const container = taskDefinition.addContainer("ImageProcessingContainer", {
      image: ecs.ContainerImage.fromRegistry(imageUri),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "image-processing",
      }),
      environment,
    });

    container.addPortMappings({
      containerPort: CONTAINER_PORT,
      protocol: ecs.Protocol.TCP,
    });

    return logGroup;
  }

  public createListener(
    loadBalancer: elbv2.ApplicationLoadBalancer,
    targetGroups: elbv2.ApplicationTargetGroup[]
  ): void {
    const deploymentMode = this.node.tryGetContext("deploymentMode") || "prod";
    const isDevMode = deploymentMode === "dev";

    const listener = loadBalancer.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: isDevMode
        ? elbv2.ListenerAction.forward(targetGroups)
        : elbv2.ListenerAction.fixedResponse(403, {
            contentType: "text/plain",
            messageBody: "Access denied - requests must come from CloudFront",
          }),
    });

    if (!isDevMode) {
      listener.addAction("CloudFrontTraffic", {
        priority: 100,
        conditions: [elbv2.ListenerCondition.httpHeader(this.customHeaderName, [this.customHeaderValue])],
        action: elbv2.ListenerAction.forward(targetGroups),
      });
    }
  }

  public configureAutoScaling(service: ecs.FargateService, ecsConfig: EcsConfig): void {
    const scalableTarget = service.autoScaleTaskCount({
      minCapacity: Token.asNumber(ecsConfig.minCapacity),
      maxCapacity: Token.asNumber(ecsConfig.maxCapacity),
    });

    const scaleInAmount = Token.asNumber(ecsConfig.scaleInAmount);
    const scaleOutAmount = Token.asNumber(ecsConfig.scaleOutAmount);

    scalableTarget.scaleOnMetric("CpuScaling", {
      metric: service.metricCpuUtilization({
        period: Duration.minutes(1)
      }),
      scalingSteps: [
        { upper: CPU_TARGET_UTILIZATION_SCALE_IN, change: scaleInAmount },
        { lower: CPU_TARGET_UTILIZATION_SCALE_OUT, change: scaleOutAmount },
      ],
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: Duration.minutes(SCALE_IN_COOLDOWN_MINUTES),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
    });
  }

  public getAlbDnsName(): string {
    return this.loadBalancer.loadBalancerDnsName;
  }
}
