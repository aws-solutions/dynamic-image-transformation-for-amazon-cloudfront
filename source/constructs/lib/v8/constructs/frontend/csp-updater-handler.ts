// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } from '@aws-sdk/client-cloudfront';
import { Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { getOptions } from '../../../../../solution-utils/get-options';

const logger = new Logger();

interface CustomResourceEvent {
    RequestType: 'Create' | 'Update' | 'Delete';
    RequestId?: string;
    LogicalResourceId?: string;
    PhysicalResourceId?: string;
    ResourceProperties: {
        DistributionId: string;
        ResponseHeadersPolicyId: string;
    };
}

export const handler = async (event: CustomResourceEvent, context: Context) => {
    try {
        switch (event.RequestType) {
            case 'Create':
            case 'Update':
                return await applyCSPPolicy(event);
            case 'Delete':
                return await removeCSPPolicy(event);
            default:
                throw new Error(`Unknown request type: ${event.RequestType}`);
        }
    } catch (error) {
        logger.error('Error handling request', { requestType: event.RequestType, error });
        throw error;
    }
};

const applyCSPPolicy = async (event: CustomResourceEvent) => {
    logger.info('Applying enhanced CSP policy', { requestType: event.RequestType });
    
    const cfClient = new CloudFrontClient(getOptions());
    const distributionId = event.ResourceProperties.DistributionId;
    const responseHeadersPolicyId = event.ResourceProperties.ResponseHeadersPolicyId;
        const getConfigResponse = await cfClient.send(
        new GetDistributionConfigCommand({ Id: distributionId })
    );
    
    const config = getConfigResponse.DistributionConfig!;
    const etag = getConfigResponse.ETag!;
    config.DefaultCacheBehavior!.ResponseHeadersPolicyId = responseHeadersPolicyId;
    
    await cfClient.send(
        new UpdateDistributionCommand({
            Id: distributionId,
            DistributionConfig: config,
            IfMatch: etag
        })
    );
    
    logger.info('Successfully applied enhanced CSP policy', { 
        distributionId, 
        responseHeadersPolicyId 
    });
    
    return {
        PhysicalResourceId: 'csp-updater',
        Data: {
            DistributionId: distributionId,
            ResponseHeadersPolicyId: responseHeadersPolicyId
        }
    };
};
const removeCSPPolicy = async (event: CustomResourceEvent) => {
    logger.info('Removing CSP policy');
    
    const cfClient = new CloudFrontClient(getOptions());
    const distributionId = event.ResourceProperties.DistributionId;
    
    try {
        const getConfigResponse = await cfClient.send(
            new GetDistributionConfigCommand({ Id: distributionId })
        );

        const config = getConfigResponse.DistributionConfig!;
        const etag = getConfigResponse.ETag!;

        delete config.DefaultCacheBehavior!.ResponseHeadersPolicyId;

        await cfClient.send(
            new UpdateDistributionCommand({
                Id: distributionId,
                DistributionConfig: config,
                IfMatch: etag
            })
        );
    } catch (error) {
        if ((error as Error).name !== 'NoSuchDistribution') {
            throw error;
        }
        // warn, with the CloudFormation ids: this is the only trace if a delete passes that should not have.
        logger.warn('Distribution already deleted, nothing to remove', {
            distributionId,
            requestId: event.RequestId,
            logicalResourceId: event.LogicalResourceId,
            physicalResourceId: event.PhysicalResourceId
        });
        return {};
    }
    
    logger.info('Successfully removed CSP policy');
    
    // No PhysicalResourceId: Delete must keep the ID CloudFormation sent, which is not 'csp-updater' after a cancelled create.
    return {};
};
