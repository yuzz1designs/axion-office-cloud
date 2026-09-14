import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { handleAivaApi } from './src/server/aivaApi';
import { handleGoogleSheetsApi } from './src/server/googleSheetsApi';
import { handleGoogleDriveApi } from './src/server/googleDriveApi';
import { handleGoogleOAuthApi } from './src/server/googleOAuthApi';
import { handleAuthApi } from './src/server/authApi';
import { handleGoogleWorkspaceApi } from './src/server/googleWorkspaceApi';
import { handleFinanceApi } from './src/server/financeApi';
import { handleTeamActivityApi } from './src/server/teamActivityApi';
import { handleNotificationApi } from './src/server/notificationApi';
import { handleClientApi } from './src/server/clientApi';
import { handleMeetingApi } from './src/server/meetingApi';

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), 'OPENAI_');
  const googleEnv = loadEnv(mode, process.cwd(), 'GOOGLE_');
  const axionEnv = loadEnv(mode, process.cwd(), 'AXION_');
  const supabaseEnv = loadEnv(mode, process.cwd(), 'SUPABASE_');
  Object.assign(process.env, serverEnv, googleEnv, axionEnv, supabaseEnv);
  return {
    publicDir: 'assets',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'aiva-secure-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => void handleAivaApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleGoogleSheetsApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleGoogleDriveApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleGoogleOAuthApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleGoogleWorkspaceApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleAuthApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleFinanceApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleTeamActivityApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleNotificationApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleClientApi(req, res, next));
          server.middlewares.use((req, res, next) => void handleMeetingApi(req, res, next));
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
