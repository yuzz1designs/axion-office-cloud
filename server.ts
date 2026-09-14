import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAivaApi } from "./src/server/aivaApi";
import { handleGoogleSheetsApi } from "./src/server/googleSheetsApi";
import { handleGoogleDriveApi } from "./src/server/googleDriveApi";
import { handleGoogleOAuthApi } from "./src/server/googleOAuthApi";
import { handleAuthApi } from "./src/server/authApi";
import { handleGoogleWorkspaceApi } from "./src/server/googleWorkspaceApi";
import { handleFinanceApi } from "./src/server/financeApi";
import { handleTeamActivityApi } from "./src/server/teamActivityApi";
import { handleNotificationApi } from "./src/server/notificationApi";
import { handleClientApi } from "./src/server/clientApi";
import { handleMeetingApi } from "./src/server/meetingApi";

const app = express();
const port = Number(process.env.PORT || 3000);
const directory = process.env.AXION_APP_ROOT || path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use((req, res, next) => void handleAivaApi(req, res, next));
app.use((req, res, next) => void handleGoogleSheetsApi(req, res, next));
app.use((req, res, next) => void handleGoogleDriveApi(req, res, next));
app.use((req, res, next) => void handleGoogleOAuthApi(req, res, next));
app.use((req, res, next) => void handleGoogleWorkspaceApi(req, res, next));
app.use((req, res, next) => void handleAuthApi(req, res, next));
app.use((req, res, next) => void handleFinanceApi(req, res, next));
app.use((req, res, next) => void handleTeamActivityApi(req, res, next));
app.use((req, res, next) => void handleNotificationApi(req, res, next));
app.use((req, res, next) => void handleClientApi(req, res, next));
app.use((req, res, next) => void handleMeetingApi(req, res, next));
app.use(express.static(path.join(directory, "dist")));
app.get("*", (_req, res) => res.sendFile(path.join(directory, "dist", "index.html")));

app.listen(port, process.env.AXION_SERVER_HOST || "0.0.0.0", () => {
  console.log(`AXION OFFICE disponível em http://localhost:${port}`);
});
