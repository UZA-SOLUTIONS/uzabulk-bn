import argparse
import json
import os
from io import BytesIO

import requests
from PIL import Image
import imagehash


def image_hash_from_url(url: str) -> imagehash.ImageHash:
    response = requests.get(url, timeout=6)
    response.raise_for_status()
    img = Image.open(BytesIO(response.content)).convert("RGB")
    return imagehash.phash(img)


def image_hash_from_path(path: str) -> imagehash.ImageHash:
    img = Image.open(path).convert("RGB")
    return imagehash.phash(img)


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
            phash = image_hash_from_url(image_url)
            meta.append({
                "offerId": offer_id,
                "imageUrl": image_url,
                "name": product.get("name", ""),
                "hash": str(phash),
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


def search_index(query_url: str, top_k: int, index_path: str, meta_path: str):
    if not os.path.exists(index_path):
        print(json.dumps({"status": "error", "message": "Index or meta not found", "results": []}))
        return

    with open(index_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    query_hash = image_hash_from_url(query_url)

    scored = []
    for item in meta:
        hash_str = str(item.get("hash", "")).strip()
        if not hash_str:
            continue
        try:
            candidate_hash = imagehash.hex_to_hash(hash_str)
        except Exception:
            continue
        distance = query_hash - candidate_hash
        similarity = max(0.0, 1.0 - (float(distance) / 64.0))
        scored.append({
            "offerId": item.get("offerId"),
            "imageUrl": item.get("imageUrl"),
            "name": item.get("name"),
            "similarity": similarity,
        })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    results = scored[: max(1, top_k)]
    print(json.dumps({"status": "ok", "count": len(results), "results": results}))

def search_live(query_url: str, top_k: int, products_json: str):
    if not os.path.exists(products_json):
        print(json.dumps({"status": "error", "message": "products_json not found", "results": []}))
        return

    with open(products_json, "r", encoding="utf-8") as f:
        products = json.load(f)

    query_hash = image_hash_from_url(query_url)
    scored = []
    for product in products:
        offer_id = str(product.get("offerId", "")).strip()
        image_url = str(product.get("imageUrl", "")).strip()
        if not offer_id or not image_url:
            continue
        try:
            candidate_hash = image_hash_from_url(image_url)
            distance = query_hash - candidate_hash
            similarity = max(0.0, 1.0 - (float(distance) / 64.0))
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
    s.add_argument("--query-url", required=True)
    s.add_argument("--top-k", type=int, default=32)
    s.add_argument("--index-path", required=True)
    s.add_argument("--meta-path", required=True)

    l = sub.add_parser("search-live")
    l.add_argument("--query-url", required=True)
    l.add_argument("--top-k", type=int, default=32)
    l.add_argument("--products-json", required=True)

    args = parser.parse_args()
    if args.mode == "build":
        build_index(args.products_json, args.index_path, args.meta_path)
    elif args.mode == "search":
        search_index(args.query_url, args.top_k, args.index_path, args.meta_path)
    else:
        search_live(args.query_url, args.top_k, args.products_json)


if __name__ == "__main__":
    main()
