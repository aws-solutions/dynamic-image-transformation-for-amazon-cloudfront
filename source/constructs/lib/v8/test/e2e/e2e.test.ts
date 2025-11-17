// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";

describe("Image Processing Stack - E2E Tests", () => {
  let albDnsName: string;
  let cloudFrontDomain: string;
  const deploymentMode = process.env.DEPLOYMENT_MODE || "prod";
  beforeAll(async () => {
    try {
      const cfClient = new CloudFormationClient({
        region: process.env.STACK_REGION || "us-east-1",
      });
      const stackName = process.env.STACK_NAME || "v8-ImageProcessingStack";

      const response = await cfClient.send(
        new DescribeStacksCommand({
          StackName: stackName,
        })
      );

      const stack = response.Stacks?.[0];
      if (!stack?.Outputs) {
        throw new Error(`No outputs found for stack ${stackName}`);
      }

      // Extract all outputs
      const outputs = stack.Outputs.reduce((acc, output) => {
        if (output.OutputKey && output.OutputValue) {
          acc[output.OutputKey] = output.OutputValue;
        }
        return acc;
      }, {} as Record<string, string>);

      albDnsName = outputs.LoadBalancerDNS;
      cloudFrontDomain = outputs.CloudFrontDistributionDomainName;

      console.log(`Testing ${deploymentMode} mode - ALB DNS: ${albDnsName}`);
    } catch (error) {
      console.error("Failed to get stack outputs:", error);
      throw error;
    }
  }, 10000);

  test("Health check endpoint", async () => {
    if (deploymentMode === "dev") {
      // DEV: Test health check via ALB directly
      if (!albDnsName) {
        console.log("Skipping health check test - ALB DNS not available");
        return;
      }

      const response = await fetch(`http://${albDnsName}/health`);
      expect(response.status).toBe(200);

      const body: any = await response.json();
      expect(body).toMatchObject({
        status: "HEALTHY",
        timestamp: expect.any(String),
      });
      console.log("Dev mode health check via ALB: PASSED");
    } else {
      // PROD: Test health check via CloudFront only
      if (!cloudFrontDomain) {
        console.log("Skipping CloudFront health check test - no domain available");
        return;
      }

      const response = await fetch(`https://${cloudFrontDomain}/health`);
      expect(response.status).toBe(200);

      const body: any = await response.json();
      expect(body).toMatchObject({
        status: "HEALTHY",
        timestamp: expect.any(String),
      });
      console.log("Prod mode health check via CloudFront: PASSED");
    }
  });

  test("ALB accessibility based on deployment mode", async () => {
    if (!albDnsName) {
      console.log("Skipping accessibility test - ALB DNS not available");
      return;
    }

    const testUrl = `http://${albDnsName}/health`;

    if (deploymentMode === "dev") {
      // DEV: ALB should be directly accessible for development testing
      const response = await fetch(testUrl, {
        method: "GET",
        headers: { "User-Agent": "DIT-E2E-Test" },
      });
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      console.log(`Dev mode ALB accessible: ${response.status}`);
    } else {
      // PROD: ALB should NOT be accessible
      try {
        await fetch(testUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "DIT-E2E-Test" },
        });
        fail("ALB should not be accessible in prod mode");
      } catch (error) {
        console.log("Prod mode ALB correctly inaccessible");
        expect(error).toBeDefined();
        expect(error).toHaveProperty("name", "TimeoutError");
      }
    }
  }, 10000);

  test("CloudFront distribution is accessible", async () => {
    if (deploymentMode === "dev") {
      console.log("Skipping CloudFront test in dev mode - CloudFront not deployed");
      return;
    }

    if (!cloudFrontDomain) {
      console.log("Skipping CloudFront test - no domain available");
      return;
    }

    const response = await fetch(`https://${cloudFrontDomain}/health`);
    expect(response.status).toBeLessThan(500);
    console.log(`CloudFront accessible: ${response.status}`);
  });
});
