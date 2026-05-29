"""Runtime configuration. Sensible MVP defaults so the app runs with zero infra.

- DATABASE_URL unset  -> local SQLite (async) file.
- REDIS_URL unset     -> in-process pub/sub (single ASGI process MVP path).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./sudoku.db"
    redis_url: str | None = None
    cors_origins: str = "http://localhost:5173"
    pool_target: int = 8

    # match tuning
    countdown_seconds: int = 3
    min_players: int = 2
    max_players: int = 4
    progress_hz: float = 3.0
    move_rate_limit: int = 25  # max moves / second / connection

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
