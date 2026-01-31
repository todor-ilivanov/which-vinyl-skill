import express, { Express } from 'express';
import { Server } from 'http';

let app: Express | null = null;
let server: Server | null = null;

export function getApp(): Express {
  if (!app) {
    app = express();
  }
  return app;
}

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve();
      return;
    }

    const expressApp = getApp();
    server = expressApp.listen(3000, '127.0.0.1', () => {
      console.log('🌐 Callback server started on http://127.0.0.1:3000');
      resolve();
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to start callback server: ${err.message}`));
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.closeAllConnections();
    server.close(() => {
      server = null;
      app = null;
      resolve();
    });
  });
}
