import path from 'path';

export const webappPath = path.resolve(__dirname, `../../../../build/webapp`);
export const indexHtml = path.resolve(webappPath, `./index.html`);

export const diagramStoragePath = path.resolve(__dirname, `../../../../diagrams`);

export const tokenLength = 20;
