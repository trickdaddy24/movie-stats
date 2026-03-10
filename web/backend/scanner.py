import re
from pathlib import Path

MOVIE_EXTENSIONS = {'.mkv', '.mp4', '.avi', '.mov', '.m4v', '.ts', '.wmv', '.flv', '.webm', '.iso'}

STRIP_TAGS = re.compile(
    r'\b(1080p|720p|480p|4K|2160p|UHD|HD|SD|BluRay|Blu-Ray|BDRip|BRRip|WEBRip|'
    r'WEB-DL|WEB|HDRip|DVDRip|HDTV|x264|x265|H\.264|H\.265|HEVC|AVC|XviD|DivX|'
    r'AAC|DTS|AC3|MP3|FLAC|TrueHD|Atmos|HDR|HDR10|REMUX|PROPER|REPACK|'
    r'EXTENDED|THEATRICAL|YIFY|YTS|RARBG|NF|AMZN|DSNP|HMAX)\b',
    re.IGNORECASE
)


def parse_filename(filename: str) -> dict:
    """Extract title and year from a movie filename."""
    name = Path(filename).stem

    # Normalize separators first so year detection works for Movie_2008, Movie.2008 etc.
    name = re.sub(r'[._\-]+', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()

    # Extract year (1900-2099), including when wrapped in brackets like (2008) or [2008]
    year_match = re.search(r'[\[\(]?\s*(19\d{2}|20\d{2})\s*[\]\)]?', name)
    year = int(year_match.group(1)) if year_match else None
    if year_match:
        # Cut everything from the year token onward; strip any dangling open bracket
        name = name[:year_match.start()].rstrip('([')

    name = STRIP_TAGS.sub('', name)
    name = re.sub(r'[\[\(].*?[\]\)]', '', name)   # remove remaining [bracketed] content
    name = re.sub(r'\s+', ' ', name).strip()
    return {'title': name, 'year': year, 'filename': filename}


def scan_folder(folder_path: str, recursive: bool = True) -> list[dict]:
    """Return list of parsed movie dicts from a folder."""
    path = Path(folder_path)
    if not path.exists() or not path.is_dir():
        raise ValueError(f"Folder not found: {folder_path}")
    pattern = '**/*' if recursive else '*'
    results = []
    for f in path.glob(pattern):
        if f.suffix.lower() in MOVIE_EXTENSIONS and f.is_file():
            parsed = parse_filename(f.name)
            parsed['path'] = str(f)
            if parsed['title']:
                results.append(parsed)
    return results
