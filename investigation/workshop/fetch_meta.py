"""Read each workshop item's public Steam page and store its metadata in C:\\dgm-workshop\\meta.json.

    python investigation/workshop/fetch_meta.py            # every item under C:\\dgm-workshop\\items
    python investigation/workshop/fetch_meta.py --offline  # parse the cached pages only

Pages are cached in C:\\dgm-workshop\\pages (local only, never committed). Steam throttles readers
after about 20 pages, so pages are 5 s apart and a 429 waits 2 minutes; the bulk numbers come first
from Steam's public file-details call, one request for every item. Fields: title, author,
subscribers, favourites, unique visitors,
star rating (Steam shows 1-5 stars once an item has enough ratings, else none), number of
ratings when shown, tags, posted and updated dates, change notes, and the description as text.
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

ROOT = os.environ.get("DGM_WORKSHOP", r"C:\dgm-workshop")
ITEMS = os.path.join(ROOT, "items")
PAGES = os.path.join(ROOT, "pages")
OUT = os.path.join(ROOT, "meta.json")
URL = "https://steamcommunity.com/sharedfiles/filedetails/?id={}"
UA = "Mozilla/5.0 (Dam Good Maps workshop study; one request a second)"


API = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"
DELAY = 10.0         # seconds between page requests (Steam throttles faster readers)
BACKOFF = 300.0      # seconds to wait after a 429 before trying again


def fetch(item_id: str, offline: bool) -> str | None:
    path = os.path.join(PAGES, f"{item_id}.html")
    if os.path.exists(path) and os.path.getsize(path) > 10_000:
        with open(path, encoding="utf-8") as f:
            return f.read()
    if offline:
        return None
    for attempt in range(3):
        req = urllib.request.Request(URL.format(item_id), headers={"User-Agent": UA, "Accept-Language": "en-US,en"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                text = r.read().decode("utf-8", "replace")
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 2:
                raise
            print(f"  429 on {item_id}: waiting {BACKOFF:.0f} s", flush=True)
            time.sleep(BACKOFF)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    time.sleep(DELAY)
    return text


def fetch_api(ids: list[str], offline: bool) -> dict:
    """One request for every item: Steam's public file-details call (no key needed)."""
    path = os.path.join(ROOT, "steam_api.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    if offline:
        return {}
    form = {"itemcount": str(len(ids))}
    for k, i in enumerate(ids):
        form[f"publishedfileids[{k}]"] = i
    data = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(API, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        got = json.loads(r.read().decode("utf-8"))
    out = {d["publishedfileid"]: d for d in got.get("response", {}).get("publishedfiledetails", [])}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    time.sleep(1.2)
    return out


def _day(ts) -> str | None:
    return datetime.utcfromtimestamp(int(ts)).strftime("%Y-%m-%d") if ts else None


def merge_api(r: dict, a: dict) -> dict:
    """The page's fields, completed from the API: dates, lifetime counts, views and tags."""
    if not a or a.get("result") != 1:
        return r
    r.setdefault("title", a.get("title"))
    if not r.get("title"):
        r["title"] = a.get("title")
    r["posted"] = _day(a.get("time_created")) or r.get("posted")
    r["updated"] = _day(a.get("time_updated")) if a.get("time_updated") != a.get("time_created") else r.get("updated")
    r["subscribers"] = r.get("subscribers") if r.get("subscribers") is not None else a.get("subscriptions")
    r["favourites"] = r.get("favourites") if r.get("favourites") is not None else a.get("favorited")
    r["lifetime_subscribers"] = a.get("lifetime_subscriptions")
    r["lifetime_favourites"] = a.get("lifetime_favorited")
    r["views"] = a.get("views")
    r["creator_steamid"] = a.get("creator")
    if not r.get("tags"):
        r["tags"] = sorted(t["tag"] for t in a.get("tags", []))
    if not r.get("description"):
        r["description"] = re.sub(r"\[/?[a-z0-9*=#]+[^\]]*\]", "", a.get("description", ""))[:4000]
    return r


def _text(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(fragment).strip()


def _num(s: str) -> int | None:
    s = s.replace(",", "").replace(".", "").strip()
    return int(s) if s.isdigit() else None


def _date(s: str) -> str | None:
    s = s.strip()
    for fmt in ("%b %d, %Y @ %I:%M%p", "%d %b, %Y @ %I:%M%p", "%b %d @ %I:%M%p", "%d %b @ %I:%M%p"):
        try:
            d = datetime.strptime(s, fmt)
            if d.year == 1900:  # this year's dates omit the year
                d = d.replace(year=datetime.now().year)
            return d.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse(item_id: str, s: str) -> dict:
    out: dict = {"id": item_id, "url": URL.format(item_id)}
    m = re.search(r'class="workshopItemTitle">([^<]*)<', s)
    out["title"] = html.unescape(m.group(1)).strip() if m else None
    m = re.search(r'class="friendBlockContent">\s*([^<]+)<', s)
    out["author"] = html.unescape(m.group(1)).strip() if m else None
    m = re.search(r'class="creatorsBlock".*?href="(https://steamcommunity.com/(?:id|profiles)/[^"]+)"', s, re.S)
    out["author_url"] = m.group(1) if m else None
    stats = {}
    for n, label in re.findall(r"<td>([\d,.]+)</td>\s*<td>([^<]+)</td>", s):
        stats[label.strip()] = _num(n)
    out["visitors"] = stats.get("Unique Visitors")
    out["subscribers"] = stats.get("Current Subscribers")
    out["favourites"] = stats.get("Current Favorites")
    m = re.search(r'fileRatingDetails"><img src="[^"]*/(\d)-star_large\.png', s)
    out["stars"] = int(m.group(1)) if m else None
    m = re.search(r'class="numRatings">([\d,.]+)\s*ratings?<', s)
    out["ratings"] = _num(m.group(1)) if m else None
    out["tags"] = sorted({html.unescape(t) for t in re.findall(r"requiredtags%5B%5D=[^\"]*\">([^<]+)</a>", s)})
    left = re.findall(r'class="detailsStatLeft">([^<]*)<', s)
    right = re.findall(r'class="detailsStatRight">([^<]*)<', s)
    for k, v in zip(left, right):
        k = k.strip().lower()
        if k.startswith("posted"):
            out["posted"] = _date(v)
        elif k.startswith("updated"):
            out["updated"] = _date(v)
        elif k.startswith("file size"):
            out["file_size"] = v.strip()
    m = re.search(r'class="detailsStatNumChangeNotes">\s*([\d,]+)\s*Change Note', s)
    out["change_notes"] = _num(m.group(1)) if m else None
    m = re.search(r'id="highlightContent">(.*?)</div>', s, re.S)
    out["description"] = _text(m.group(1))[:4000] if m else ""
    return out


def main() -> None:
    offline = "--offline" in sys.argv
    os.makedirs(PAGES, exist_ok=True)
    ids = sorted(d for d in os.listdir(ITEMS) if d.isdigit())
    api = fetch_api(ids, offline)
    meta = {}
    failures = 0
    for k, item_id in enumerate(ids):
        if failures >= 3:  # still throttled: keep the API's numbers and read the pages another time
            offline = True
        try:
            s = fetch(item_id, offline)
            failures = 0
        except Exception as e:  # keep going; the item keeps what the API gave, with the error
            failures += 1
            meta[item_id] = merge_api({"id": item_id, "url": URL.format(item_id), "page_error": str(e)}, api.get(item_id, {}))
            print(f"{k + 1}/{len(ids)} {item_id}: {e}", flush=True)
            time.sleep(DELAY)
            continue
        if s is None:
            meta[item_id] = merge_api({"id": item_id, "url": URL.format(item_id), "page_error": "not cached"}, api.get(item_id, {}))
            continue
        meta[item_id] = merge_api(parse(item_id, s), api.get(item_id, {}))
        r = meta[item_id]
        print(f"{k + 1}/{len(ids)} {item_id}: {r['title']} by {r['author']}, {r['subscribers']} subs, {r['stars']} stars", flush=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
    print(f"wrote {OUT}: {len(meta)} items")


if __name__ == "__main__":
    main()
