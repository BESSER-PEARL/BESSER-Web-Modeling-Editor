import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import express, { RequestHandler } from 'express';
import * as Sentry from '@sentry/node';
import { indexHtml, webappPath } from './constants';
import { register } from './routes';
import { CollaborationService } from './services/collaboration-service/collaboration-service';

const port = 8080;

const app = express();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.DEPLOYMENT_URL?.split('//')[1] || '',
    tracesSampleRate: 0.5,
  });

  Sentry.setTag('package', 'server');
}

// Replace http://localhost:8080 with the actual process.env.DEPLOYMENT_URL
const jsFiles = fs.readdirSync(webappPath).filter((file) => file.endsWith('.js'));
jsFiles.forEach((file) => {
  const filePath = path.join(webappPath, file);
  const content = fs.readFileSync(filePath, 'utf8')
      .replace(/http:\/\/localhost:8080/g, process.env.DEPLOYMENT_URL || 'http://localhost:8080');
  fs.writeFileSync(filePath, content);
});

app.use('/', express.static(webappPath));
app.use(bodyParser.json() as RequestHandler);
app.use(
  bodyParser.urlencoded({
    extended: true,
  }) as RequestHandler,
);

// registers routes
register(app);

// if nothing matches return webapp
// must be registered after other routes
app.get('/*', (req, res) => {
  res.sendFile(indexHtml);
});
const collaborationService = new CollaborationService();

const server = app.listen(port, () => {
  console.log('Apollon Standalone Server listening at http://localhost:%s', port);
});

server.on('upgrade', (request, socket, head) => {
  collaborationService.handleUpgrade(request, socket, head);
});
