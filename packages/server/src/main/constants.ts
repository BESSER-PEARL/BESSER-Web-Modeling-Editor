import path from 'path';

// The container starts in build/server; local builds may run from another cwd.
export const webappPath = path.resolve(process.env.WEBAPP_PATH || path.join(process.cwd(), '../webapp'));
export const indexHtml = path.resolve(webappPath, `./index.html`);

export const diagramStoragePath = path.resolve(__dirname, `../../../../diagrams`);

export const tokenLength = 20;
