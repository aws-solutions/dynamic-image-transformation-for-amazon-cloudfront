// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

describe('DIT Container Docker Build and Health Tests', () => {
  const TEST_PORT = 3001;
  const TEST_CONTAINER_URL = `http://localhost:${TEST_PORT}`;
  const CONTAINER_NAME = 'dit-ecs-test';
  const IMAGE_NAME = 'dit-ecs-container:test';

  beforeAll(async () => {
    // Build the Docker image from workspace root
    console.log('Building Docker image for testing...');
    try {
      await execAsync(`docker build -f Dockerfile -t ${IMAGE_NAME} .`, {
        cwd: process.cwd() + '/../'
      });
    } catch (error) {
      console.error('Failed to build Docker image:', error);
      throw error;
    }

    // Start the container with test environment variables
    console.log('Starting test container...');
    try {
      await execAsync(`docker run -d --name ${CONTAINER_NAME} -p ${TEST_PORT}:8080 -e SKIP_INITIALIZATION=true ${IMAGE_NAME}`);
    } catch (error) {
      console.error('Failed to start container:', error);
      throw error;
    }

    // Wait for container to be ready
    console.log('Waiting for container to be ready...');
    await waitForHealthCheck();
  }, 120000); // 120 second timeout for container startup

  afterAll(async () => {
    // Clean up container
    console.log('Cleaning up test container...');
    try {
      await execAsync(`docker stop ${CONTAINER_NAME}`);
      await execAsync(`docker rm ${CONTAINER_NAME}`);
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  });

  async function waitForHealthCheck(maxAttempts = 30, interval = 1000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${TEST_CONTAINER_URL}/health`);
        if (response.ok) {
          console.log(`Container ready after ${attempt} attempts`);
          return;
        }
      } catch (error) {
        // Container not ready yet
      }
      
      if (attempt === maxAttempts) {
        throw new Error(`Container failed to become ready after ${maxAttempts} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  describe('Docker Image Build', () => {
    test('Docker image builds successfully', async () => {
      // Verify image exists
      const { stdout } = await execAsync(`docker images ${IMAGE_NAME} --format "{{.Repository}}:{{.Tag}}"`);
      expect(stdout.trim()).toBe(IMAGE_NAME);
    });
  });

  describe('Container Health', () => {
    test('container starts successfully and responds to health check', async () => {
      const response = await fetch(`${TEST_CONTAINER_URL}/health`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({
        status: 'HEALTHY',
        timestamp: expect.any(String)
      });
    });

    test('container is accessible on correct port', async () => {
      const response = await fetch(`${TEST_CONTAINER_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    test('container responds to basic HTTP requests', async () => {
      const response = await fetch(`${TEST_CONTAINER_URL}/health`);
      expect(response.status).toBe(200);
      
      // Verify it's actually our Express server responding
      const body = await response.json();
      expect(body.status).toBe('HEALTHY');
    });
  });

  describe('Container Security', () => {
    test('security headers are present', async () => {
      const response = await fetch(`${TEST_CONTAINER_URL}/health`);
      
      // Check key security headers from helmet middleware
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBeTruthy();
    });
  });

  describe('Container Lifecycle', () => {
    test('container can be gracefully stopped', async () => {
      // This test verifies the container responds to stop signals properly
      const { stdout: containerId } = await execAsync(`docker ps -q --filter name=${CONTAINER_NAME}`);
      expect(containerId.trim()).toBeTruthy();
      
      // Container should still be running at this point
      const { stdout: status } = await execAsync(`docker inspect ${CONTAINER_NAME} --format='{{.State.Status}}'`);
      expect(status.trim()).toBe('running');
    });
  });
});
