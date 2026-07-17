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
        </div>
        <script>
          fetch("/api/auth/get-session", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((s) => {
              if (!s || !s.user) {
                location.href = "/sign-in";
                return;
              }
              document.getElementById("who").textContent = "Signed in as " + s.user.email;
              document.getElementById("content").hidden = false;
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
