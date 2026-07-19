import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { createApp } from "./http/app.js";

const app = createApp();

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`accounting-mcp listening on http://localhost:${info.port} (${config.NODE_ENV})`);
});
