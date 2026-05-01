# Backend Export

This folder contains the server-side part of the project.

Included:

- `CTFd/` source code
- custom plugins
- migrations
- challenge images
- Discord first-blood bot service source
- deployment files such as `requirements.txt`, `manage.py`, and `wsgi.py`

Excluded:

- local database
- uploads
- logs
- secret keys
- `.env` files

This folder is meant for VPS deployment or backend code review, not GitHub Pages hosting.

## Minimal Deployment Flow

1. Copy the backend contents to the VPS
2. Create a virtual environment
3. Install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

4. Run migrations:

```bash
flask db upgrade
```

5. Start CTFd with Gunicorn:

```bash
gunicorn 'CTFd:create_app()' --bind 127.0.0.1:8000 --worker-class gevent --workers 2
```

6. Put Nginx in front of Gunicorn
