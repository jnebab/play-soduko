"""Process-wide singletons for the single-process MVP.

The scale path replaces these with stateless gateways + Redis pub/sub +
authority owners sharded by consistent hash of matchId (same protocol).
"""

from __future__ import annotations

from .config import get_settings
from .connections import ConnectionManager
from .matchmaking import Matchmaking

settings = get_settings()
manager = ConnectionManager()
matchmaking = Matchmaking(manager, settings)
