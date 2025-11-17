// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnResource, aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";

/**
 * Properties for NetworkConstruct
 */
export interface NetworkConstructProps {
  /**
   * IPv4 CIDR block for the VPC
   * Must be /16 to /24 prefix
   */
  vpcCidr: string;
}

/**
 * Network construct that provisions VPC infrastructure for image processing stack
 *
 * Creates:
 * - VPC with customer-specified CIDR
 * - Public subnets across different availability zones (for ECS tasks and dev mode ALB)
 * - Isolated subnets with no internet access (for prod mode ALB with VPC Origins)
 * - Internet Gateway for ECS tasks to download images from external sources
 * - Security groups for ALB and ECS with deployment mode-specific ingress/egress rules
 * - ALB placement varies by mode: public subnets (dev) or isolated subnets (prod)
 */
export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly isolatedSubnets: ec2.ISubnet[];
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly deploymentMode: "dev" | "prod";

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    this.deploymentMode = this.node.tryGetContext("deploymentMode") || "prod";

    this.vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 26, // /26 gives 64 IPs per subnet (62 usable)
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 26, // /26 gives 64 IPs per subnet (62 usable)
          name: "IsolatedSubnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    this.publicSubnets = this.vpc.publicSubnets;
    this.isolatedSubnets = this.vpc.isolatedSubnets;

    // Add suppression for the SUBNET_AUTO_ASSIGN_PUBLIC_IP_DISABLED rule
    this.publicSubnets.forEach((subnet) => {
      const cfnSubnet = subnet.node.defaultChild as CfnResource;
      if (cfnSubnet) {
        addCfnGuardSuppressRules(cfnSubnet, [
          {
            id: "SUBNET_AUTO_ASSIGN_PUBLIC_IP_DISABLED",
            reason:
              "Public subnets with auto-assigned IPs are required. ECS Fargate tasks need public IPs to access internet for downloading images. NAT gateways are not used to reduce costs.",
          },
        ]);
      }
    });

    // Validate we have at least 2 subnets across different AZs (3 preferred for production)
    if (this.publicSubnets.length < 2) {
      throw new Error(
        `Expected at least 2 public subnets, but got ${this.publicSubnets.length}. Ensure your region has at least 2 availability zones.`
      );
    }

    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for Application Load Balancer",
      allowAllOutbound: false,
    });

    if (this.deploymentMode === "dev") {
      this.albSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(80),
        "Allow HTTP traffic from internet for dev mode local testing"
      );
      this.albSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(443),
        "Allow HTTPS traffic from internet for dev mode local testing"
      );
      addCfnGuardSuppressRules(this.albSecurityGroup, [
        {
          id: "EC2_SECURITY_GROUP_INGRESS_OPEN_TO_WORLD_RULE",
          reason:
            "Dev mode allows internet access for local testing and debugging. Production mode uses CloudFront VPC Origins with isolated subnets.",
        },
      ]);
    } else {
      this.albSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(props.vpcCidr),
        ec2.Port.tcp(80),
        "Allow HTTP traffic from VPC for CloudFront VPC Origins connectivity"
      );
    }

    this.ecsSecurityGroup = new ec2.SecurityGroup(this, "EcsSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for ECS Fargate tasks",
      allowAllOutbound: false,
    });

    this.albSecurityGroup.addEgressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(8080),
      "Allow traffic to ECS security group"
    );

    // Add suppression for the EC2_SECURITY_GROUP_EGRESS_OPEN_TO_WORLD_RULE
    addCfnGuardSuppressRules(this.ecsSecurityGroup, [
      {
        id: "EC2_SECURITY_GROUP_EGRESS_OPEN_TO_WORLD_RULE",
        reason:
          "ECS tasks need unrestricted egress to download images from external sources. We won't know the IP addresses of external domains where images will be sourced from.",
      },
    ]);

    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(8080),
      "Allow traffic from ALB to ECS tasks"
    );

    this.ecsSecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS outbound for ECR access");

    this.ecsSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP outbound for downloading images from external sources"
    );
  }

  /**
   * Get availability zones used by the VPC
   */
  public getAvailabilityZones(): string[] {
    return this.publicSubnets.map((subnet) => subnet.availabilityZone);
  }

  /**
   * Get subnet IDs for use in other constructs
   */
  public getSubnetIds(): string[] {
    return this.publicSubnets.map((subnet) => subnet.subnetId);
  }
}
