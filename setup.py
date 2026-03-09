"""
setup.py — MovieStats API Key Setup
Run this once before starting the app to configure your API keys.

Usage:
    python setup.py
"""

import os
import sys
from pathlib import Path

ENV_PATH = Path(__file__).parent / "web" / "backend" / ".env"

KEYS = [
    {
        "key":      "TMDB_API_KEY",
        "label":    "TMDB API Key",
        "required": True,
        "hint":     "Get it free at: https://www.themoviedb.org/settings/api",
        "default":  None,
    },
    {
        "key":      "FANART_API_KEY",
        "label":    "fanart.tv API Key",
        "required": False,
        "hint":     "Optional — HD logos/artwork. Get it free at: https://fanart.tv/get-an-api-key/",
        "default":  None,
    },
    {
        "key":      "TRAKT_CLIENT_ID",
        "label":    "Trakt Client ID",
        "required": False,
        "hint":     "Optional — needed to import Trakt lists. Get it at: https://trakt.tv/oauth/applications",
        "default":  None,
    },
    {
        "key":      "PLEX_URL",
        "label":    "Plex Server URL",
        "required": False,
        "hint":     "Optional — your Plex server address, e.g. http://192.168.1.100:32400",
        "default":  "http://localhost:32400",
    },
    {
        "key":      "PLEX_TOKEN",
        "label":    "Plex Token",
        "required": False,
        "hint":     "Optional — find yours at: https://support.plex.tv/articles/204059436/",
        "default":  None,
    },
]


def read_existing_env() -> dict:
    """Read existing .env file into a dict."""
    existing = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                existing[k.strip()] = v.strip()
    return existing


def write_env(values: dict):
    """Write values dict to .env file."""
    ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for key, cfg in [(k["key"], k) for k in KEYS]:
        val = values.get(key, "")
        label = cfg["label"]
        required_tag = " (required)" if cfg["required"] else " (optional)"
        lines.append(f"# {label}{required_tag}")
        lines.append(f"{key}={val}")
        lines.append("")
    ENV_PATH.write_text("\n".join(lines))


def prompt_key(cfg: dict, existing_value: str | None) -> str:
    """Prompt user for a single API key. Returns the value to save."""
    label     = cfg["label"]
    required  = cfg["required"]
    hint      = cfg["hint"]
    default   = existing_value or cfg["default"] or ""
    tag       = "[required]" if required else "[optional]"

    print(f"\n  {label} {tag}")
    print(f"  {hint}")

    if default:
        # Mask existing value for display
        masked = default[:4] + "*" * (len(default) - 4) if len(default) > 4 else "****"
        prompt_text = f"  Value [{masked}] (press Enter to keep): "
    else:
        prompt_text = f"  Value (press Enter to skip): " if not required else f"  Value: "

    while True:
        val = input(prompt_text).strip()
        if not val:
            if default:
                return default          # keep existing/default
            if required:
                print("  ✗  This key is required. Please enter a value.")
                continue
            return ""                   # skip optional
        return val


def main():
    print("=" * 55)
    print("  MovieStats — API Key Setup")
    print("=" * 55)
    print(f"\n  Config will be saved to:\n  {ENV_PATH}\n")

    existing = read_existing_env()

    if existing:
        print("  Existing .env detected — press Enter to keep any value.\n")

    values = {}
    for cfg in KEYS:
        values[cfg["key"]] = prompt_key(cfg, existing.get(cfg["key"]))

    # Summary
    print("\n" + "─" * 55)
    print("  Summary\n")
    for cfg in KEYS:
        val = values[cfg["key"]]
        if val:
            masked = val[:4] + "*" * max(0, len(val) - 4)
            status = f"✓  {masked}"
        else:
            status = "—  (not set)"
        print(f"  {cfg['label']:<22}  {status}")

    print()
    answer = input("  Save to .env? (yes/no): ").strip().lower()
    if answer not in ("yes", "y"):
        print("\n  Cancelled — nothing saved.")
        sys.exit(0)

    write_env(values)
    print(f"\n  ✓  Saved to {ENV_PATH}")
    print("\n  Next steps:")
    print("    1. cd web/backend")
    print("    2. python -m venv venv")
    print("    3. venv\\Scripts\\activate   (Windows) or source venv/bin/activate (Mac/Linux)")
    print("    4. pip install -r requirements.txt")
    print("    5. python main.py")
    print()


if __name__ == "__main__":
    main()
