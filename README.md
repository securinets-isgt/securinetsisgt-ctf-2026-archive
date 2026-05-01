# Public Export

This folder is a clean, public-safe split of the project for publishing or archiving.

Structure:

- `frontend/`
  - Public-safe theme/frontend files
  - Includes a GitHub Pages-ready static page in `frontend/docs/`
- `backend/`
  - CTFd source, plugins, services, and deployment code
  - Excludes runtime data and secrets

Intentionally excluded:

- `.ctfd_secret_key`
- `.flaskenv`
- `CTFd/ctfd.db`
- `CTFd/uploads/`
- `CTFd/logs/`
- `.env` files
- local caches, temp folders, and `node_modules`

Important:

- GitHub Pages can host only the static content in `frontend/docs/`
- The real CTFd backend in `backend/` still needs a VPS or other server
- Before pushing publicly, do one final review if you add new deployment files later
