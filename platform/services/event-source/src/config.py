import os
from dataclasses import dataclass


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    bootstrap: str
    topic: str
    path: str
    speed: float
    log_every: int

    @staticmethod
    def _require(name: str) -> str:
        value = os.environ.get(name)
        if not value:
            raise ConfigError(f"{name} is not set")
        return value

    @staticmethod
    def _parse(name: str, raw: str, kind: type):
        try:
            return kind(raw)
        except ValueError:
            raise ConfigError(f"{name} must be {kind.__name__}, got {raw!r}") from None

    @classmethod
    def from_env(cls) -> "Config":
        speed = cls._parse("REPLAY_SPEED", cls._require("REPLAY_SPEED"), float)
        if speed <= 0:
            raise ValueError(f"REPLAY_SPEED must be greater than 0, got {speed}")

        return cls(
            bootstrap=cls._require("KAFKA_BOOTSTRAP_SERVERS"),
            topic=cls._require("TOPIC_TRANSACTIONS"),
            path=cls._require("EVENTS_SOURCE_FILE"),
            speed=speed,
            log_every=cls._parse("LOG_EVERY", os.environ.get("LOG_EVERY", "1000"), int),
        )
