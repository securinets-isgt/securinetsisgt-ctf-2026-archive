# Simple Web Flag

Small first Docker challenge for testing the `CTFd-Docker-Challenges` plugin locally.

## Challenge idea

- Category: `Web`
- Type: `docker`
- Difficulty: very easy
- Goal: find the flag by doing basic web recon

## Flag

`Securinets{gotham_docker_smoke_test}`

## Local build

From the repo root:

```powershell
docker build -t local/simple-web-flag:latest .\challenge-images\simple-web-flag
```

## Local run

```powershell
docker run --rm -p 8000:8000 local/simple-web-flag:latest
```

Then open:

- `http://localhost:8000/`
- `http://localhost:8000/robots.txt`

## CTFd Docker plugin setup

Use this image name in the Docker Challenges plugin:

`local/simple-web-flag:latest`

Suggested challenge text for CTFd:

> Gotham left an archive node online for testing. The main page is clean, but the old operators were never good at hiding breadcrumbs.

Suggested connection info in CTFd:

`http://host:port/`

The plugin replaces `host` and `port` automatically after the container starts.
