/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOCKS_API_URL: string;
  readonly VITE_BLOCKS_APP_DOMAIN: string;
  readonly VITE_BLOCKS_OIDC_URL: string;
  readonly VITE_BLOCKS_OIDC_CLIENT_ID: string;
  readonly VITE_BLOCKS_OIDC_SCOPE?: string;
  readonly VITE_BLOCKS_X_BLOCKS_KEY: string;
  readonly VITE_BLOCKS_DEV_HOST?: string;
  readonly VITE_BLOCKS_DEV_PORT?: string;
  readonly VITE_AI_WORKFLOW_WEBHOOK_URL?: string;
  readonly VITE_SHOW_DEBUG_PANELS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
