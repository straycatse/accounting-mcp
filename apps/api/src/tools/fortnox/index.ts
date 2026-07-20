import { config } from "../../config.js";
import { fortnoxOpDefs } from "./generated-ops.js";
import { buildFortnoxTool } from "./util.js";
import type { ToolDef } from "../registry.js";

export { fortnoxOpDefs };

// The spec covers every Fortnox module, but an integration only gets the scopes
// ticked in the apps.fortnox.se portal — calls outside them 403 at runtime. So
// registering the full set would hand clients hundreds of tools that can only
// fail. FORTNOX_SCOPES is the single source of truth: widen it (and tick the
// matching permission in the portal) and the tools appear, no regeneration.
const grantedScopes = new Set(config.FORTNOX_SCOPES.split(/\s+/).filter(Boolean));

export const fortnoxOpDefsInScope = fortnoxOpDefs.filter((def) => grantedScopes.has(def.scope));

export const fortnoxTools: ToolDef[] = fortnoxOpDefsInScope.map(buildFortnoxTool);
