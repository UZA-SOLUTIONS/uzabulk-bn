import argparse
import json
import os
from io import BytesIO

import requests
from PIL import Image
import imagehash


def image_hashes_from_image(img: Image.Image) -> dict:
    rgb = img.convert("RGB")
    return {
        "phash": str(imagehash.phash(rgb)),
        "dhash": str(imagehash.dhash(rgb)),
        "ahash": str(imagehash.average_hash(rgb)),
    }


def image_hashes_from_url(url: str) -> dict:
    response = requests.get(url, timeout=6)
    response.raise_for_status()
    img = Image.open(BytesIO(response.content))
    return image_hashes_from_image(img)


def image_hashes_from_path(path: str) -> dict:
    img = Image.open(path)
    return image_hashes_from_image(img)


def image_hash_from_url(url: str) -> imagehash.ImageHash:
    return imagehash.hex_to_hash(image_hashes_from_url(url)["phash"])


def image_hash_from_path(path: str) -> imagehash.ImageHash:
    return imagehash.hex_to_hash(image_hashes_from_path(path)["phash"])


def combined_similarity(query_hashes: dict, item: dict) -> float:
    """Blend pHash + dHash + aHash for fewer false positives than pHash alone."""
    stored = item.get("hashes") if isinstance(item.get("hashes"), dict) else None
    if not stored:
        hash_str = str(item.get("hash", "")).strip()
        if not hash_str:
            return 0.0
        try:
            distance = imagehash.hex_to_hash(query_hashes["phash"]) - imagehash.hex_to_hash(hash_str)
            return max(0.0, 1.0 - (float(distance) / 64.0))
        except Exception:
            return 0.0

    scores = []
    weights = {"phash": 0.5, "dhash": 0.3, "ahash": 0.2}
    for key, weight in weights.items():
        q = str(query_hashes.get(key) or "").strip()
        c = str(stored.get(key) or "").strip()
        if not q or not c:
            continue
        try:
            distance = imagehash.hex_to_hash(q) - imagehash.hex_to_hash(c)
            scores.append((max(0.0, 1.0 - (float(distance) / 64.0)), weight))
        except Exception:
            continue

    if not scores:
        return 0.0
    total_w = sum(w for _, w in scores) or 1.0
    return sum(sim * w for sim, w in scores) / total_w


def build_index(products_json: str, index_path: str, meta_path: str):
    with open(products_json, "r", encoding="utf-8") as f:
        products = json.load(f)

    meta = []
    for product in products:
        offer_id = str(product.get("offerId", "")).strip()
        image_url = str(product.get("imageUrl", "")).strip()
        if not offer_id or not image_url:
            continue
        try:
            hashes = image_hashes_from_url(image_url)
            meta.append({
                "offerId": offer_id,
                "imageUrl": image_url,
                "name": product.get("name", ""),
                "hash": hashes["phash"],
                "hashes": hashes,
            })
        except Exception:
            continue

    if not meta:
        print(json.dumps({"status": "error", "message": "No hashes created"}))
        return

    os.makedirs(os.path.dirname(index_path), exist_ok=True)
    os.makedirs(os.path.dirname(meta_path), exist_ok=True)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)

    print(json.dumps({"status": "ok", "count": len(meta), "indexPath": index_path, "metaPath": meta_path}))


def resolve_query_hashes(query_url: str = "", query_file: str = "") -> dict:
    if query_file:
        return image_hashes_from_path(query_file)
    if query_url:
        return image_hashes_from_url(query_url)
    raise ValueError("query_url or query_file is required")


def resolve_query_hash(query_url: str = "", query_file: str = ""):
    hashes = resolve_query_hashes(query_url=query_url, query_file=query_file)
    return imagehash.hex_to_hash(hashes["phash"])


def search_index(query_url: str, top_k: int, index_path: str, meta_path: str, query_file: str = ""):
    if not os.path.exists(index_path):
        print(json.dumps({"status": "error", "message": "Index or meta not found", "results": []}))
        return

    with open(index_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    query_hashes = resolve_query_hashes(query_url=query_url, query_file=query_file)

    scored = []
    for item in meta:
        similarity = combined_similarity(query_hashes, item)
        if similarity <= 0:
            continue
        scored.append({
            "offerId": item.get("offerId"),
            "imageUrl": item.get("imageUrl"),
            "name": item.get("name"),
            "similarity": similarity,
        })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    results = scored[: max(1, top_k)]
    print(json.dumps({"status": "ok", "count": len(results), "results": results}))


def search_live(query_url: str, top_k: int, products_json: str, query_file: str = ""):
    if not os.path.exists(products_json):
        print(json.dumps({"status": "error", "message": "products_json not found", "results": []}))
        return

    with open(products_json, "r", encoding="utf-8") as f:
        products = json.load(f)

    query_hashes = resolve_query_hashes(query_url=query_url, query_file=query_file)
    scored = []
    for product in products:
        offer_id = str(product.get("offerId", "")).strip()
        image_url = str(product.get("imageUrl", "")).strip()
        if not offer_id or not image_url:
            continue
        try:
            hashes = image_hashes_from_url(image_url)
            similarity = combined_similarity(query_hashes, {
                "hash": hashes["phash"],
                "hashes": hashes,
            })
            scored.append({
                "offerId": offer_id,
                "imageUrl": image_url,
                "name": product.get("name", ""),
                "similarity": similarity,
            })
        except Exception:
            continue

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    results = scored[: max(1, top_k)]
    print(json.dumps({"status": "ok", "count": len(results), "results": results}))


def main():
    parser = argparse.ArgumentParser(description="Local image similarity search")
    sub = parser.add_subparsers(dest="mode", required=True)

    b = sub.add_parser("build")
    b.add_argument("--products-json", required=True)
    b.add_argument("--index-path", required=True)
    b.add_argument("--meta-path", required=True)

    s = sub.add_parser("search")
    s.add_argument("--query-url", default="")
    s.add_argument("--query-file", default="")
    s.add_argument("--top-k", type=int, default=32)
    s.add_argument("--index-path", required=True)
    s.add_argument("--meta-path", required=True)

    l = sub.add_parser("search-live")
    l.add_argument("--query-url", default="")
    l.add_argument("--query-file", default="")
    l.add_argument("--top-k", type=int, default=32)
    l.add_argument("--products-json", required=True)

    args = parser.parse_args()
    if args.mode == "build":
        build_index(args.products_json, args.index_path, args.meta_path)
    elif args.mode == "search":
        search_index(args.query_url, args.top_k, args.index_path, args.meta_path, args.query_file)
    else:
        search_live(args.query_url, args.top_k, args.products_json, args.query_file)


if __name__ == "__main__":
    main()
