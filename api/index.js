const getStatusPayload = () => ({
  ok: true,
  service: 'BirdBot',
  deployment: 'vercel',
  note: 'Vercel can serve the status page and health checks, but the Discord bot process still needs a persistent host.',
  timestamp: new Date().toISOString(),
});

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export default function handler(request, response) {
  const payload = getStatusPayload();
  const pathname = request.url ? new URL(request.url, 'https://birdbot.vercel.app').pathname : '/';

  if (pathname === '/health' || pathname === '/api/health') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(payload, null, 2));
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BirdBot</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f2e8;
        --panel: rgba(255, 255, 255, 0.82);
        --text: #1f2937;
        --accent: #8f6b3f;
        --muted: #6b7280;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(143, 107, 63, 0.16), transparent 30%),
          radial-gradient(circle at right, rgba(96, 165, 250, 0.14), transparent 26%),
          linear-gradient(135deg, #faf6ef, #ecf5ff);
      }

      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }

      .hero,
      .card {
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 20px;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(12px);
      }

      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }

      .card {
        padding: 20px;
        margin-bottom: 16px;
      }

      h1,
      h2 {
        margin: 0 0 12px;
      }

      p {
        line-height: 1.6;
        margin: 0 0 10px;
      }

      .label {
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        margin-bottom: 10px;
      }

      code {
        background: rgba(143, 107, 63, 0.12);
        color: var(--accent);
        padding: 2px 6px;
        border-radius: 6px;
      }

      a {
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="label">BirdBot deployment</div>
        <h1>BirdBot is live on Vercel</h1>
        <p>This deployment serves the public status surface and health checks.</p>
        <p>The Discord bot process itself still needs a persistent host such as Docker, a VM, or another always-on platform.</p>
      </section>

      <section class="card">
        <h2>Status</h2>
        <p><strong>Deployment:</strong> ${escapeHtml(payload.deployment)}</p>
        <p><strong>Timestamp:</strong> ${escapeHtml(payload.timestamp)}</p>
        <p><strong>Health:</strong> <a href="/health">/health</a> or <a href="/api/health">/api/health</a></p>
      </section>
    </main>
  </body>
</html>`);
}
