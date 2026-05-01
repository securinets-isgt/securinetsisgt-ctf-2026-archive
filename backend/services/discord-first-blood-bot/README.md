# Discord First Blood Bot

A small standalone notifier inspired by [ArcusTen/CTFd-Discord-First-Blood](https://github.com/ArcusTen/CTFd-Discord-First-Blood), adapted for this CTFd setup.

## What changed

- Uses your own Batman/Riddler image assets from the live site instead of generic gifs
- Persists announced solves/first bloods to `state.json`
- Avoids duplicate spam after restart
- Removes the fragile `user_id + 1` hack
- Supports first-blood-only mode by default
- Runs cleanly as a `systemd` service on the challenge VPS

## Required secrets

- `CTFD_API_TOKEN`
- `DISCORD_FIRST_BLOOD_WEBHOOK`
- optionally `DISCORD_SOLVES_WEBHOOK`

## Local run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 main.py
```

## Systemd

Use the included service template and point `EnvironmentFile` at the deployed `.env`.
