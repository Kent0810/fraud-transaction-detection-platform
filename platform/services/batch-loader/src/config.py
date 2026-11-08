import os
from dataclasses import dataclass


class ConfigError(Exception):
    pass


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise ConfigError(f"{name} is not set")
    return value


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default))
    try:
        return int(raw)
    except ValueError:
        raise ConfigError(f"{name} must be an integer, got {raw!r}") from None


@dataclass(frozen=True)
class Config:
    bootstrap: str
    group_id: str
    topics: dict[str, str]
    bq_project: str | None
    raw_dataset: str
    interval_seconds: int
    max_rows: int
    ground_truth_file: str
    dim_card_file: str
    postgres_dsn: str

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            bootstrap=_require("KAFKA_BOOTSTRAP_SERVERS"),
            group_id=os.environ.get("KAFKA_GROUP_ID", "batch-loader"),
            topics={
                _require("TOPIC_DECISIONS"): "decisions",
                _require("TOPIC_SETTLEMENTS"): "settlements",
                _require("TOPIC_ALERTS"): "alerts",
            },
            bq_project=os.environ.get("BQ_PROJECT") or None,
            raw_dataset=_require("BQ_DATASET_RAW"),
            interval_seconds=_int("LOAD_INTERVAL_SECONDS", 300),
            max_rows=_int("MAX_ROWS_PER_LOAD", 200_000),
            ground_truth_file=_require("GROUND_TRUTH_FILE"),
            dim_card_file=_require("DIM_CARD_FILE"),
            postgres_dsn=(
                f"host={_require('POSTGRES_HOST')} port={_require('POSTGRES_PORT')} "
                f"dbname={_require('POSTGRES_DB')} user={_require('POSTGRES_USER')} "
                f"password={_require('POSTGRES_PASSWORD')}"
            ),
        )
