import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import express, { RequestHandler } from 'express';
import * as Sentry from '@sentry/node';
import { indexHtml, webappPath } from './constants';
import { register } from './routes';

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

// Replace build-time placeholders with runtime env values.
// Vite outputs JS into webapp/assets/, so scan that subdirectory.
// FORCE_ANALYTICS_CONSENT is injected into index.html as a meta tag
// (JS bundles can't carry it because Vite constant-folds string comparisons).
if (fs.existsSync(webappPath)) {
  const assetsPath = path.join(webappPath, 'assets');
  const scanDir = fs.existsSync(assetsPath) ? assetsPath : webappPath;
  const jsFiles = fs.readdirSync(scanDir).filter((file) => file.endsWith('.js'));
  jsFiles.forEach((file) => {
    const filePath = path.join(scanDir, file);
    const content = fs.readFileSync(filePath, 'utf8')
        .replace(/http:\/\/localhost:8080/g, process.env.DEPLOYMENT_URL || 'http://localhost:8080')
        .replace(/__BACKEND_URL__/g, process.env.BACKEND_URL || '')
        .replace(/__POSTHOG_KEY__/g, process.env.POSTHOG_KEY || '')
        .replace(/__POSTHOG_HOST__/g, process.env.POSTHOG_HOST || '');
    fs.writeFileSync(filePath, content);
  });

  if (fs.existsSync(indexHtml)) {
    const html = fs.readFileSync(indexHtml, 'utf8')
        .replace(/__FORCE_ANALYTICS_CONSENT__/g, process.env.FORCE_ANALYTICS_CONSENT === 'true' ? 'true' : '')
        .replace(/__POSTHOG_ENABLE_RECORDINGS__/g, process.env.POSTHOG_ENABLE_RECORDINGS === 'true' ? 'true' : '');
    fs.writeFileSync(indexHtml, html);
  }
}

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

const server = app.listen(port, () => {
  console.log('BESSER Standalone Server listening at http://localhost:%s', port);
});
