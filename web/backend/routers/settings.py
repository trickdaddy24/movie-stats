"""
routers/settings.py — API key status and configuration
"""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["settings"])

ENV_PATH = Path(__file__).parent.parent / ".env"

KNOWN_KEYS = [
    {"key": "TMDB_API_KEY",     "label": "TMDB API Key",       "required": True,  "hint": "https://www.themoviedb.org/settings/api"},
    {"key": "FANART_API_KEY",   "label": "fanart.tv API Key",   "required": False, "hint": "https://fanart.tv/get-an-api-key/"},
    {"key": "TRAKT_CLIENT_ID",  "label": "Trakt Client ID",     "required": False, "hint": "https://trakt.tv/oauth/applications"},
    {"key": "PLEX_URL",         "label": "Plex Server URL",     "required": False, "hint": "e.g. http://192.168.1.100:32400"},
    {"key": "PLEX_TOKEN",       "label": "Plex Token",          "required": False, "hint": "https://support.plex.tv/articles/204059436/"},
    {"key": "RADARR_URL",       "label": "Radarr Server URL",   "required": False, "hint": "e.g. http://192.168.1.100:7878"},
    {"key": "RADARR_API_KEY",   "label": "Radarr API Key",      "required": False, "hint": "Settings → General → Security in Radarr"},
]

PLACEHOLDER_VALUES = {
    "TMDB_API_KEY":    "your_tmdb_api_key_here",
    "FANART_API_KEY":  "your_fanart_api_key_here",
    "TRAKT_CLIENT_ID": "your_trakt_client_id_here",
    "PLEX_URL":        "http://192.168.1.100:32400",
    "PLEX_TOKEN":      "your_plex_token_here",
    "RADARR_URL":      "http://192.168.1.100:7878",
    "RADARR_API_KEY":  "your_radarr_api_key_here",
}


def _read_env() -> dict:
    values = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                values[k.strip()] = v.strip()
    return values


def _write_env(values: dict):
    ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for cfg in KNOWN_KEYS:
        tag = " (required)" if cfg["required"] else " (optional)"
        lines.append(f"# {cfg['label']}{tag}")
        lines.append(f"{cfg['key']}={values.get(cfg['key'], '')}")
        lines.append("")
    ENV_PATH.write_text("\n".join(lines))


def _is_set(key: str, value: str) -> bool:
    """True if the value is non-empty and not a placeholder."""
    return bool(value) and value != PLACEHOLDER_VALUES.get(key, "")


@router.get("/keys")
def get_key_status():
    """Return status (set/not set) for each API key — never returns actual values."""
    env = _read_env()
    result = []
    for cfg in KNOWN_KEYS:
        val = env.get(cfg["key"], "")
        configured = _is_set(cfg["key"], val)
        result.append({
            "key":        cfg["key"],
            "label":      cfg["label"],
            "required":   cfg["required"],
            "hint":       cfg["hint"],
            "configured": configured,
            # return masked value so UI can show it's set without exposing full key
            "masked":     (val[:4] + "*" * max(0, len(val) - 4)) if configured else "",
        })
    return result


class KeyUpdate(BaseModel):
    updates: dict[str, str]   # {KEY_NAME: new_value}  empty string = clear


@router.patch("/keys")
def update_keys(body: KeyUpdate):
    """Save one or more API keys to .env. Empty string clears the key."""
    allowed = {cfg["key"] for cfg in KNOWN_KEYS}
    bad = [k for k in body.updates if k not in allowed]
    if bad:
        raise HTTPException(status_code=400, detail=f"Unknown keys: {bad}")

    env = _read_env()

    for k, v in body.updates.items():
        env[k] = v.strip()
        # also update in-memory env so backend picks it up without restart
        os.environ[k] = v.strip()

    _write_env(env)

    # return updated status
    return get_key_status()
