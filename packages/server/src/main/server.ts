import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import express, { RequestHandler } from 'express';
import * as Sentry from '@sentry/node';
import { indexHtml, webappPath } from './constants';
import { register } from './routes';
import { registerStudySite } from './study-site';

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

}

registerStudySite(app);

// Study mode: serve the prebuilt default museum website (SPA, built with base /study-default/).
const studyDefaultSite = path.resolve(process.cwd(), 'study-default');
if (process.env.STUDY_AGENT_URL_PATH && fs.existsSync(studyDefaultSite)) {
  app.use('/study-default', express.static(studyDefaultSite, { index: 'index.html', fallthrough: true }), (req, res) => {
    if (req.path.includes('.')) { res.sendStatus(404); return; }
    res.sendFile(path.join(studyDefaultSite, 'index.html'));
  });
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
