from http.server import BaseHTTPRequestHandler, HTTPServer


FLAG = "Securinets{gotham_docker_smoke_test}"


class ChallengeHandler(BaseHTTPRequestHandler):
    def _send(self, body: str, *, content_type: str = "text/html; charset=utf-8", status: int = 200) -> None:
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path == "/":
            self._send(
                """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Gotham Archive Node</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0a0f0b;
        color: #d7e2d8;
        font-family: monospace;
      }
      .panel {
        width: min(90vw, 760px);
        padding: 2rem;
        border: 1px solid #1f5e36;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(10,26,15,.95), rgba(8,15,11,.98));
        box-shadow: 0 0 24px rgba(34,197,94,.12);
      }
      h1 { margin-top: 0; color: #7ef0a7; }
      code { color: #9cf5bb; }
      .hint { color: #8ea495; }
    </style>
  </head>
  <body>
    <main class="panel">
      <h1>Gotham Archive Node</h1>
      <p>Operator note: the flag is not on the main page.</p>
      <p class="hint">Old admins always leave instructions where crawlers look first.</p>
      <p>Check standard recon paths and follow the trail.</p>
      <p><code>/health</code> is available for smoke tests.</p>
    </main>
  </body>
</html>"""
            )
        elif self.path == "/robots.txt":
            self._send("User-agent: *\nDisallow: /archive/ops-note.txt\n", content_type="text/plain; charset=utf-8")
        elif self.path == "/archive/ops-note.txt":
            self._send(
                "Archive note: this image is only for local spawner testing.\n"
                f"Flag: {FLAG}\n",
                content_type="text/plain; charset=utf-8",
            )
        elif self.path == "/health":
            self._send("ok\n", content_type="text/plain; charset=utf-8")
        else:
            self._send("Not found\n", content_type="text/plain; charset=utf-8", status=404)

    def log_message(self, fmt: str, *args) -> None:
        return


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8000), ChallengeHandler).serve_forever()
