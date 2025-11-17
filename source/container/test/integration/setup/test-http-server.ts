// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import express from 'express';
import { createServer, Server } from 'http';
import sharp from 'sharp';

export class TestHttpServer {
  private app: express.Application;
  private server: Server;
  private port: number;

  constructor(port = 0) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Valid test images
    this.app.get('/test.jpg', async (req, res) => {
      const buffer = await sharp({
        create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } }
      })
      .withExif({
        IFD0: {
          Make: 'Test Camera',
          Model: 'Test Model',
          Software: 'Test Software',
          DateTime: '2024:01:01 12:00:00'
        }
      })
      .jpeg().toBuffer();
      res.set('Content-Type', 'image/jpeg').send(buffer);
    });

    this.app.get('/test.png', async (req, res) => {
      const buffer = await sharp({
        create: { width: 200, height: 150, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } }
      }).png().toBuffer();
      res.set('Content-Type', 'image/png').send(buffer);
    });

    // Error scenarios
    this.app.get('/404', (req, res) => res.status(404).send('Not Found'));
    this.app.get('/500', (req, res) => res.status(500).send('Server Error'));
    this.app.get('/timeout', (req, res) => {
      // Never respond to simulate timeout
    });
    this.app.get('/invalid-content-type', (req, res) => {
      res.set('Content-Type', 'text/html').send('<html>Not an image</html>');
    });

    this.app.get('/test.gif', async (req, res) => {
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 255 } }
      }).gif().toBuffer();
      res.set('Content-Type', 'image/gif').send(buffer);
    });

  }

  async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        const address = this.server.address();
        const actualPort = typeof address === 'object' ? address?.port : this.port;
        resolve(`http://localhost:${actualPort}`);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}