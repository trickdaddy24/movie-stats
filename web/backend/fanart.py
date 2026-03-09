import os
import httpx
from dotenv import load_dotenv

load_dotenv()

FANART_API_KEY = os.getenv("FANART_API_KEY", "")
BASE_URL = "https://webservice.fanart.tv/v3"

TYPE_MAP = {
    "movieposter": "poster",
    "moviebackground": "backdrop",
    "hdmovielogo": "logo",
    "movielogo": "logo",
    "moviedisc": "disc",
    "moviebanner": "banner",
    "hdmovieclearart": "clearart",
    "movieclearart": "clearart",
}


def get_movie_art(tmdb_id: int) -> dict:
    if not FANART_API_KEY or FANART_API_KEY == "your_fanart_api_key_here":
        return {}

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{BASE_URL}/movies/{tmdb_id}",
                params={"api_key": FANART_API_KEY},
            )
            if resp.status_code == 404:
                return {}
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {}

    result: dict[str, list] = {
        "logos": [],
        "posters": [],
        "backdrops": [],
        "discs": [],
        "banners": [],
        "clearart": [],
    }

    type_to_key = {
        "poster": "posters",
        "backdrop": "backdrops",
        "logo": "logos",
        "disc": "discs",
        "banner": "banners",
        "clearart": "clearart",
    }

    for fanart_key, art_type in TYPE_MAP.items():
        items = data.get(fanart_key, [])
        key = type_to_key.get(art_type, art_type)
        for item in items:
            entry = {
                "source": "fanart",
                "type": art_type,
                "url": item.get("url", ""),
                "language": item.get("lang") or None,
                "likes": int(item.get("likes", 0)),
            }
            if key in result:
                result[key].append(entry)

    for key in result:
        result[key].sort(key=lambda x: x["likes"], reverse=True)

    return result


def get_movie_art_flat(tmdb_id: int) -> list:
    art = get_movie_art(tmdb_id)
    flat = []
    for items in art.values():
        flat.extend(items)
    return flat
