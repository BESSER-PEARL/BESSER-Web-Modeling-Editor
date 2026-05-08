/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APPLICATION_SERVER_VERSION?: string;
  readonly DEPLOYMENT_URL?: string;
  readonly BACKEND_URL?: string;
  readonly SENTRY_DSN?: string;
  readonly POSTHOG_HOST?: string;
  readonly POSTHOG_KEY?: string;
  readonly UML_BOT_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
