import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import aiohttp
from dotenv import load_dotenv


load_dotenv()


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.fromtimestamp(0, tz=timezone.utc)
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.fromtimestamp(0, tz=timezone.utc)


@dataclass
class Settings:
    ctfd_url: str
    ctfd_api_token: str
    first_blood_webhook: str
    solves_webhook: str | None
    announce_solves: bool
    poll_seconds: int
    request_timeout: int
    state_file: Path
    first_blood_image_url: str | None
    solve_image_url: str | None
    first_blood_title: str
    solve_title: str
    first_blood_color: int
    solve_color: int
    bootstrap_existing: bool


def load_settings() -> Settings:
    ctfd_url = (os.getenv("CTFD_API_URL") or "").strip().rstrip("/")
    ctfd_api_token = (os.getenv("CTFD_API_TOKEN") or "").strip()
    first_blood_webhook = (os.getenv("DISCORD_FIRST_BLOOD_WEBHOOK") or "").strip()
    solves_webhook = (os.getenv("DISCORD_SOLVES_WEBHOOK") or "").strip() or None

    if not ctfd_url:
        raise RuntimeError("CTFD_API_URL is required")
    if not ctfd_api_token:
        raise RuntimeError("CTFD_API_TOKEN is required")
    if not first_blood_webhook:
        raise RuntimeError("DISCORD_FIRST_BLOOD_WEBHOOK is required")

    return Settings(
        ctfd_url=ctfd_url,
        ctfd_api_token=ctfd_api_token,
        first_blood_webhook=first_blood_webhook,
        solves_webhook=solves_webhook,
        announce_solves=env_bool("ANNOUNCE_SOLVES", False),
        poll_seconds=int(os.getenv("POLL_SECONDS", "20")),
        request_timeout=int(os.getenv("REQUEST_TIMEOUT", "20")),
        state_file=Path(os.getenv("STATE_FILE", "./state.json")).resolve(),
        first_blood_image_url=(os.getenv("FIRST_BLOOD_IMAGE_URL") or "").strip() or None,
        solve_image_url=(os.getenv("SOLVE_IMAGE_URL") or "").strip() or None,
        first_blood_title=os.getenv("FIRST_BLOOD_TITLE", "First Blood"),
        solve_title=os.getenv("SOLVE_TITLE", "Challenge Solved"),
        first_blood_color=int(os.getenv("FIRST_BLOOD_COLOR", "0x8b0000"), 16),
        solve_color=int(os.getenv("SOLVE_COLOR", "0x1f8f5f"), 16),
        bootstrap_existing=env_bool("BOOTSTRAP_EXISTING", True),
    )


class StateStore:
    def __init__(self, path: Path):
        self.path = path
        self.data = {
            "announced_solves": [],
            "announced_first_bloods": {},
            "bootstrapped": False,
        }

    def load(self) -> None:
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding="utf-8"))

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    @property
    def announced_solves(self) -> set[str]:
        return set(self.data.get("announced_solves", []))

    @property
    def announced_first_bloods(self) -> dict[str, str]:
        return dict(self.data.get("announced_first_bloods", {}))

    @property
    def bootstrapped(self) -> bool:
        return bool(self.data.get("bootstrapped", False))

    def mark_bootstrapped(self) -> None:
        self.data["bootstrapped"] = True

    def add_solve(self, key: str) -> None:
        solves = self.data.setdefault("announced_solves", [])
        if key not in solves:
            solves.append(key)

    def add_first_blood(self, challenge_id: int, solve_key: str) -> None:
        bloods = self.data.setdefault("announced_first_bloods", {})
        bloods[str(challenge_id)] = solve_key


class CTFdDiscordAnnouncer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.state = StateStore(settings.state_file)
        self.state.load()
        timeout = aiohttp.ClientTimeout(total=settings.request_timeout)
        self.session = aiohttp.ClientSession(timeout=timeout)

    async def close(self) -> None:
        await self.session.close()

    async def get_ctfd(self, endpoint: str) -> dict:
        headers = {
            "Authorization": f"Token {self.settings.ctfd_api_token}",
            "Content-Type": "application/json",
        }
        url = f"{self.settings.ctfd_url}/api/v1/{endpoint.lstrip('/')}"
        async with self.session.get(url, headers=headers) as response:
            text = await response.text()
            if response.status >= 400:
                raise RuntimeError(f"CTFd API {endpoint} failed: {response.status} {text}")
            return json.loads(text)

    async def post_discord_embed(self, webhook_url: str, embed: dict) -> None:
        payload = {"embeds": [embed]}
        async with self.session.post(webhook_url, json=payload) as response:
            if response.status >= 400:
                text = await response.text()
                raise RuntimeError(f"Discord webhook failed: {response.status} {text}")

    def build_embed(
        self,
        *,
        title: str,
        description: str,
        color: int,
        image_url: str | None,
        footer: str,
    ) -> dict:
        embed = {
            "title": title,
            "description": description,
            "color": color,
            "footer": {"text": footer},
            "timestamp": now_utc().isoformat(),
        }
        if image_url:
            embed["image"] = {"url": image_url}
        return embed

    async def announce_first_blood(self, *, challenge_name: str, account_name: str, solve_time: str) -> None:
        embed = self.build_embed(
            title=self.settings.first_blood_title,
            description=(
                f"{account_name} drew first blood🩸 on {challenge_name}.\n"
                f"Gotham just heard the first crack in the case."
            ),
            color=self.settings.first_blood_color,
            image_url=None,
            footer=f"First blood • {solve_time}",
        )
        await self.post_discord_embed(self.settings.first_blood_webhook, embed)

    async def announce_solve(self, *, challenge_name: str, account_name: str, solve_time: str) -> None:
        if not self.settings.announce_solves or not self.settings.solves_webhook:
            return
        embed = self.build_embed(
            title=self.settings.solve_title,
            description=f"**{account_name}** solved **{challenge_name}**.",
            color=self.settings.solve_color,
            image_url=None,
            footer=f"Solve reported • {solve_time}",
        )
        await self.post_discord_embed(self.settings.solves_webhook, embed)

    async def fetch_challenges(self) -> list[dict]:
        payload = await self.get_ctfd("challenges")
        return payload.get("data", [])

    async def fetch_solves(self, challenge_id: int) -> list[dict]:
        payload = await self.get_ctfd(f"challenges/{challenge_id}/solves")
        solves = payload.get("data", [])
        return sorted(solves, key=lambda solve: parse_timestamp(solve.get("date")))

    async def bootstrap(self) -> None:
        if self.state.bootstrapped or not self.settings.bootstrap_existing:
            return

        challenges = await self.fetch_challenges()
        for challenge in challenges:
            solves = await self.fetch_solves(challenge["id"])
            for solve in solves:
                solve_key = f"{challenge['id']}:{solve.get('account_id')}:{solve.get('date')}"
                self.state.add_solve(solve_key)
            if solves:
                first = solves[0]
                first_key = f"{challenge['id']}:{first.get('account_id')}:{first.get('date')}"
                self.state.add_first_blood(challenge["id"], first_key)

        self.state.mark_bootstrapped()
        self.state.save()

    async def poll_once(self) -> None:
        challenges = await self.fetch_challenges()
        announced_solves = self.state.announced_solves
        announced_bloods = self.state.announced_first_bloods

        for challenge in challenges:
            challenge_id = challenge["id"]
            challenge_name = challenge["name"]
            solves = await self.fetch_solves(challenge_id)

            for index, solve in enumerate(solves):
                solve_key = f"{challenge_id}:{solve.get('account_id')}:{solve.get('date')}"
                account_name = solve.get("name") or "Unknown account"
                solve_time = solve.get("date") or "Unknown time"

                if index == 0 and str(challenge_id) not in announced_bloods:
                    await self.announce_first_blood(
                        challenge_name=challenge_name,
                        account_name=account_name,
                        solve_time=solve_time,
                    )
                    self.state.add_first_blood(challenge_id, solve_key)

                if solve_key not in announced_solves:
                    await self.announce_solve(
                        challenge_name=challenge_name,
                        account_name=account_name,
                        solve_time=solve_time,
                    )
                    self.state.add_solve(solve_key)

        self.state.save()

    async def run(self) -> None:
        await self.bootstrap()
        while True:
            try:
                await self.poll_once()
            except Exception as exc:  # noqa: BLE001
                print(f"[discord-first-blood] poll failed: {exc}", flush=True)
            await asyncio.sleep(self.settings.poll_seconds)


async def main() -> None:
    settings = load_settings()
    announcer = CTFdDiscordAnnouncer(settings)
    try:
        await announcer.run()
    finally:
        await announcer.close()


if __name__ == "__main__":
    asyncio.run(main())
