// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFormationClient, DescribeStacksCommand, Stack, Output, DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';

export interface DITStackOutputs {
  cloudFrontDomain: string;
  configTableName: string;
  testBucketName: string;
  region: string;
  stackName: string;
}

export class CfnClient {
  private cfnClient: CloudFormationClient;

  constructor(region: string) {
    this.cfnClient = new CloudFormationClient({ region });
  }

  async readStackDetails(stackName: string, region: string): Promise<DITStackOutputs> {
    const mainStack = await this.getCfnStack(stackName);
    const nestedStackId = await this.getNestedStackId(stackName);
    const nestedStack = await this.getCfnStack(nestedStackId);
    
    const cloudFrontDomain = this.getOutput(nestedStack, 'CloudFrontDistributionDomainName');
    const configTableName = this.getOutput(mainStack, 'DataAccessLayerConfigTable');
    const testBucketName = process.env.TEST_BUCKET || 'dit-test-bucket';
    
    return { cloudFrontDomain, configTableName, testBucketName, region, stackName };
  }

  private async getCfnStack(stackName: string): Promise<Stack> {
    const response = await this.cfnClient.send(new DescribeStacksCommand({ StackName: stackName }));
    
    if (!response.Stacks || response.Stacks.length === 0) {
      throw new Error(`Stack ${stackName} not found`);
    }
    
    return response.Stacks[0];
  }

  private async getNestedStackId(parentStackName: string): Promise<string> {
    const response = await this.cfnClient.send(
      new DescribeStackResourcesCommand({ StackName: parentStackName })
    );
    
    const resource = response.StackResources?.find(
      r => r.LogicalResourceId?.startsWith('ImageProcessingNestedStack') && r.ResourceType === 'AWS::CloudFormation::Stack'
    );
    if (!resource?.PhysicalResourceId) {
      throw new Error(`ImageProcessing nested stack not found in ${parentStackName}`);
    }
    
    return resource.PhysicalResourceId;
  }

  private getOutput(stack: Stack, outputKeyPrefix: string): string {
    const output = stack.Outputs?.find((o: Output) => o.OutputKey?.startsWith(outputKeyPrefix));
    
    if (!output?.OutputValue) {
      console.log('Available outputs:', stack.Outputs?.map(o => o.OutputKey));
      throw new Error(`Output starting with ${outputKeyPrefix} not found in stack`);
    }
    
    return output.OutputValue;
  }

  async getNestedStackOutput(parentStackName: string, outputKeyPrefix: string): Promise<string> {
    const nestedStackId = await this.getNestedStackId(parentStackName);
    const nestedStack = await this.getCfnStack(nestedStackId);
    return this.getOutput(nestedStack, outputKeyPrefix);
  }
}
