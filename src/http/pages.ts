import { Hono } from "hono";
import { html } from "hono/html";

const shell = (title: string, body: unknown) => html`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title} — accounting-mcp</title>
      <style>
        :root { color-scheme: light dark; }
        body { font-family: system-ui, sans-serif; max-width: 26rem; margin: 4rem auto; padding: 0 1rem; }
        h1 { font-size: 1.3rem; }
        label { display: block; margin-top: 0.8rem; font-size: 0.9rem; }
        input { width: 100%; padding: 0.5rem; margin-top: 0.2rem; box-sizing: border-box; }
        button { margin-top: 1rem; padding: 0.55rem 1.2rem; cursor: pointer; }
        .muted { color: gray; font-size: 0.85rem; }
        .error { color: #c0392b; margin-top: 0.8rem; min-height: 1.2em; }
        .row { display: flex; gap: 0.8rem; }
        code { background: rgba(128,128,128,.15); padding: 0.1em 0.3em; border-radius: 3px; }
        ul { padding-left: 1.2rem; }
      </style>
    </head>
    <body>
      ${body}
      <p class="muted" style="margin-top:3rem">
        <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · Stray Cat AB
      </p>
    </body>
  </html>`;

export const pages = new Hono();

pages.get("/sign-in", (c) =>
  c.html(
    shell(
      "Sign in",
      html`
        <h1 id="title">Sign in</h1>
        <p class="muted">Continue to authorize access to your accounting data.</p>
        <form id="form">
          <label id="name-label" hidden>Name <input id="name" autocomplete="name" /></label>
          <label>Email <input id="email" type="email" required autocomplete="email" /></label>
          <label>Password <input id="password" type="password" required minlength="8" autocomplete="current-password" /></label>
          <button type="submit" id="submit">Sign in</button>
        </form>
        <p class="error" id="error"></p>
        <p class="muted">
          <a href="#" id="toggle">No account? Sign up</a>
        </p>
        <script>
          let mode = "in";
          const qs = location.search;
          document.getElementById("toggle").addEventListener("click", (e) => {
            e.preventDefault();
            mode = mode === "in" ? "up" : "in";
            document.getElementById("name-label").hidden = mode === "in";
            document.getElementById("title").textContent = mode === "in" ? "Sign in" : "Sign up";
            document.getElementById("submit").textContent = mode === "in" ? "Sign in" : "Sign up";
            document.getElementById("toggle").textContent =
              mode === "in" ? "No account? Sign up" : "Have an account? Sign in";
          });
          document.getElementById("form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const body = {
              email: document.getElementById("email").value,
              password: document.getElementById("password").value,
            };
            if (mode === "up") body.name = document.getElementById("name").value || body.email;
            const res = await fetch("/api/auth/sign-" + mode + "/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              document.getElementById("error").textContent = err.message ?? "Authentication failed";
              return;
            }
            // Continue the OAuth authorization this login interrupted, if any.
            if (new URLSearchParams(qs).has("client_id")) {
              location.href = "/api/auth/oauth2/authorize" + qs;
            } else {
              location.href = "/dashboard";
            }
          });
        </script>
      `,
    ),
  ),
);

pages.get("/consent", (c) =>
  c.html(
    shell(
      "Authorize access",
      html`
        <h1>Authorize access</h1>
        <p>
          Application <code id="client"></code> is requesting access with scopes:
        </p>
        <ul id="scopes"></ul>
        <div class="row">
          <button id="approve">Approve</button>
          <button id="deny">Deny</button>
        </div>
        <p class="error" id="error"></p>
        <script>
          const params = new URLSearchParams(location.search);
          document.getElementById("client").textContent =
            params.get("client_name") ?? params.get("client_id") ?? "unknown";
          const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);
          document.getElementById("scopes").innerHTML = scopes
            .map((s) => "<li><code>" + s.replace(/[<>&]/g, "") + "</code></li>")
            .join("") || "<li class=muted>(default)</li>";
          async function respond(accept) {
            const res = await fetch("/api/auth/oauth2/consent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ accept, oauth_query: location.search.slice(1) }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && (data.redirect_uri || data.url)) {
              location.href = data.redirect_uri ?? data.url;
            } else {
              document.getElementById("error").textContent =
                (data.error_description ?? data.message ?? data.error ?? "Consent failed") +
                " (HTTP " + res.status + ")";
            }
          }
          document.getElementById("approve").addEventListener("click", () => respond(true));
          document.getElementById("deny").addEventListener("click", () => respond(false));
        </script>
      `,
    ),
  ),
);

pages.get("/terms", (c) =>
  c.html(
    shell(
      "Terms of service",
      html`
        <h1>Terms of service</h1>
        <p class="muted">accounting-mcp is operated by Stray Cat AB, Sweden.</p>
        <ul>
          <li>The service lets you connect your own accounting software (currently Bokio) to AI
            assistants via the Model Context Protocol. You act on your own accounting data, on
            your own instruction, under your own Bokio agreement.</li>
          <li>After a free trial, continued use requires a paid subscription (price shown at
            checkout, per connected company, excl. VAT). You can cancel any time; access remains
            until the end of the paid period.</li>
          <li>The service is provided as-is. Always review AI-initiated bookkeeping changes; you
            are responsible for the correctness of your accounts.</li>
          <li>Support: <a href="mailto:simon@straycat.se">simon@straycat.se</a></li>
        </ul>
        <p class="muted"><em>Svenska:</em> Tjänsten drivs av Stray Cat AB. Efter en gratis
          provperiod krävs prenumeration (pris per anslutet företag, exkl. moms). Du ansvarar
          själv för din bokföring — granska alltid ändringar som görs via AI.</p>
      `,
    ),
  ),
);

pages.get("/privacy", (c) =>
  c.html(
    shell(
      "Privacy policy",
      html`
        <h1>Privacy policy</h1>
        <ul>
          <li>We store your email, password hash, and the OAuth tokens needed to reach your
            accounting provider. Provider tokens are encrypted at rest (AES-256-GCM).</li>
          <li>Accounting data is fetched from your provider on demand when you (via your AI
            assistant) request it, and passed through to your assistant. We do not store, resell,
            or use your accounting data for any other purpose, including training.</li>
          <li>A minimal audit log of tool activity (tool name, timestamp, success) is kept for
            security and support.</li>
          <li>Payments are processed by Stripe; we never see your card details.</li>
          <li>Disconnecting a company or deleting your account removes the stored tokens. Data
            controller: Stray Cat AB — contact
            <a href="mailto:simon@straycat.se">simon@straycat.se</a> for access or deletion
            requests (GDPR).</li>
        </ul>
        <p class="muted"><em>Svenska:</em> Vi lagrar endast det som krävs för att koppla din
          bokföring till din AI-assistent. Tokens krypteras, bokföringsdata vidarebefordras bara
          på din begäran och säljs aldrig vidare. Kontakta simon@straycat.se för
          registerutdrag eller radering.</p>
      `,
    ),
  ),
);

pages.get("/dashboard", (c) =>
  c.html(
    shell(
      "Dashboard",
      html`
        <h1>accounting-mcp</h1>
        <p id="who" class="muted">Checking session…</p>
        <div id="content" hidden>
          <h2 style="font-size:1.05rem">Connected companies</h2>
          <ul id="connections"><li class="muted">None yet.</li></ul>
          <p><a href="/connect/bokio"><button>Connect a Bokio company</button></a></p>
          <div id="billing" hidden>
            <h2 style="font-size:1.05rem">Billing</h2>
            <p id="billing-status" class="muted"></p>
            <div class="row">
              <button id="subscribe" hidden>Subscribe</button>
              <button id="portal" hidden>Manage billing</button>
            </div>
            <p class="error" id="billing-error"></p>
          </div>
        </div>
        <script>
          async function billingAction(path, body, button) {
            button.disabled = true;
            try {
              const res = await fetch(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.url) {
                location.href = data.url;
                return;
              }
              document.getElementById("billing-error").textContent =
                (data.message ?? data.error ?? "Billing request failed") + " (HTTP " + res.status + ")";
            } finally {
              button.disabled = false;
            }
          }
          function renderBilling(b) {
            if (!b || !b.billingEnabled) return;
            document.getElementById("billing").hidden = false;
            const status = document.getElementById("billing-status");
            const subscribeBtn = document.getElementById("subscribe");
            const portalBtn = document.getElementById("portal");
            const seatsNeeded = Math.max(b.activeConnections, 1);
            if (b.complimentary) {
              status.textContent = "Complimentary account — no subscription needed.";
            } else if (b.subscriptionStatus) {
              status.textContent =
                "Subscribed (" + b.seats + (b.seats === 1 ? " company" : " companies") +
                ", status: " + b.subscriptionStatus + ")";
              portalBtn.hidden = false;
              if (b.seats < seatsNeeded) {
                status.textContent += " — covers fewer companies than you have connected.";
                subscribeBtn.textContent = "Update subscription (" + seatsNeeded + " companies)";
                subscribeBtn.hidden = false;
              }
            } else if (b.trialActive) {
              const days = Math.ceil((new Date(b.trialEndsAt) - Date.now()) / 86400000);
              status.textContent = "Free trial: " + days + (days === 1 ? " day" : " days") + " left.";
              subscribeBtn.hidden = false;
            } else {
              status.textContent = b.trialEndsAt
                ? "Your free trial has ended — subscribe to keep using accounting tools."
                : "A subscription is required to use accounting tools.";
              subscribeBtn.hidden = false;
            }
            subscribeBtn.addEventListener("click", () =>
              billingAction("/api/auth/subscription/upgrade", {
                plan: "standard",
                seats: seatsNeeded,
                successUrl: "/dashboard",
                cancelUrl: "/dashboard",
              }, subscribeBtn),
            );
            portalBtn.addEventListener("click", () =>
              billingAction("/api/auth/subscription/billing-portal", { returnUrl: "/dashboard" }, portalBtn),
            );
          }
          fetch("/api/auth/get-session", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((s) => {
              if (!s || !s.user) {
                location.href = "/sign-in";
                return;
              }
              document.getElementById("who").textContent = "Signed in as " + s.user.email;
              document.getElementById("content").hidden = false;
              fetch("/api/billing", { credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .then(renderBilling);
              return fetch("/api/connections", { credentials: "include" })
                .then((r) => r.json())
                .then(({ connections }) => {
                  if (!connections || connections.length === 0) return;
                  document.getElementById("connections").innerHTML = connections
                    .map(
                      (conn) =>
                        "<li>" +
                        (conn.companyName ?? conn.tenantId).replace(/[<>&]/g, "") +
                        " — <code>" + conn.provider + "</code> (" + conn.status + ")</li>",
                    )
                    .join("");
                });
            });
        </script>
      `,
    ),
  ),
);
