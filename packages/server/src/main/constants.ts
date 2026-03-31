import fs from 'fs';
import path from 'path';

const webapp2Path = path.resolve(__dirname, `../../../../build/webapp2`);
const webappLegacyPath = path.resolve(__dirname, `../../../../build/webapp`);

export const webappPath = fs.existsSync(webapp2Path) ? webapp2Path : webappLegacyPath;
export const indexHtml = path.resolve(webappPath, `./index.html`);

export const diagramStoragePath = path.resolve(__dirname, `../../../../diagrams`);

export const tokenLength = 20;
