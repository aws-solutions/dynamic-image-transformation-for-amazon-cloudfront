// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ECSClient, DescribeServicesCommand, waitUntilServicesStable } from '@aws-sdk/client-ecs';

export class EcsClient {
  private ecsClient: ECSClient;

  constructor(private region: string) {
    this.ecsClient = new ECSClient({ region });
  }

  async waitForDeployment(clusterName: string, serviceName: string, maxWaitSeconds = 600): Promise<void> {
    console.log('Waiting for ECS service to stabilize...');
    await waitUntilServicesStable(
      { client: this.ecsClient, maxWaitTime: maxWaitSeconds },
      { cluster: clusterName, services: [serviceName] }
    );
    
    console.log('Verifying deployment completed successfully...');
    await this.verifyDeploymentCompleted(clusterName, serviceName);
    
    console.log('ECS deployment completed and verified');
  }

  private async verifyDeploymentCompleted(cluster: string, service: string): Promise<void> {
    const response = await this.ecsClient.send(
      new DescribeServicesCommand({ cluster, services: [service] })
    );
    
    const svc = response.services?.[0];
    if (!svc) throw new Error(`Service ${service} not found`);
    
    const primaryDeployments = svc.deployments?.filter(d => d.status === 'PRIMARY') ?? [];
    if (primaryDeployments.length !== 1) {
      throw new Error(`Expected 1 PRIMARY deployment, found ${primaryDeployments.length}`);
    }
    
    const deployment = primaryDeployments[0];
    
    if (deployment.rolloutState !== 'COMPLETED') {
      throw new Error(`Deployment rollout not completed: ${deployment.rolloutState}`);
    }
    
    const activeDeployments = svc.deployments?.filter(d => d.status === 'ACTIVE') ?? [];
    if (activeDeployments.length > 0) {
      throw new Error(`${activeDeployments.length} ACTIVE deployments still exist`);
    }
    
    console.log(`Deployment ${deployment.id} verified: rolloutState=${deployment.rolloutState}`);
  }
}
