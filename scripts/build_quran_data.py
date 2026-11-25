#!/usr/bin/env python3
"""Build the offline Quran dataset shipped with Rattil.

Sources (both mirrored on GitHub so the build is reproducible):
  * AlaaJabre/quran-hafs-uthmani - Hafs an Asim, Madinah mushaf, from
    api.quran.com `text_uthmani`, including page and juz numbers.
  * risan/quran-json - chapter metadata and en/id translations.

The Uthmani text is copied verbatim: no normalisation or editing is applied to
the displayed ayat. The separate `simple` field is mechanically derived from
that same Uthmani text (vowel marks removed, hamza/alef variants unified) for
the speech recogniser. It is never shown as the mushaf text. Deriving it from
the displayed text guarantees that the word positions used by the recitation
matcher correspond exactly to the words in the mushaf.

Usage: python3 scripts/build_quran_data.py
"""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "quran-sources"
OUT = ROOT / "assets" / "data" / "quran.json"

SOURCES = {
    "uthmani": "https://codeload.github.com/AlaaJabre/quran-hafs-uthmani/tar.gz/refs/heads/main",
    "risan": "https://codeload.github.com/risan/quran-json/tar.gz/refs/heads/main",
}


def download(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / f"{name}.tar.gz"
    if not archive.exists():
        print(f"downloading {name} ...")
        urllib.request.urlretrieve(SOURCES[name], archive)
    import tarfile

    target = CACHE / name
    if not target.exists():
        with tarfile.open(archive, "r:gz") as tar:
            tar.extractall(target)
    return next(p for p in target.iterdir() if p.is_dir())


def clean_translation(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\[[0-9,]+\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


TASHKEEL = re.compile(r"[\u064b-\u065f\u0670\u06d6-\u06ed\u08d3-\u08e1]")
TATWEEL = re.compile(r"\u0640")
PUNCTUATION = re.compile(r"[.,!?؟؛:،،\"'`()\[\]{}«»‹›/\\|_\-–—*#&%$^~=+<>۞]")


def matching_text(uthmani: str) -> str:
    """Mirror of src/recitation/normalize.ts::normalizeArabic."""
    text = TASHKEEL.sub("", uthmani)
    text = TATWEEL.sub("", text)
    for source, target in zip("٠١٢٣٤٥٦٧٨٩", "0123456789"):
        text = text.replace(source, target)
    for letter in "آأإٱى":
        text = text.replace(letter, "ا")
    text = text.replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي").replace("ء", "")
    text = PUNCTUATION.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    uthmani_root = download("uthmani")
    risan_root = download("risan")

    raw = json.loads((uthmani_root / "quran-hafs-uthmani.json").read_text("utf-8"))
    chapters = json.loads((risan_root / "data/tanzil/chapters.json").read_text("utf-8"))["chapters"]
    en_raw = json.loads((risan_root / "data/quranenc/english_saheeh.json").read_text("utf-8"))
    id_raw = json.loads((risan_root / "data/quranenc/indonesian_sabiq.json").read_text("utf-8"))

    assert len(raw["verses"]) == 6236, "unexpected verse count"
    assert len(chapters) == 114, "unexpected chapter count"

    en = {
        f"{v['chapter']}:{v['verse']}": clean_translation(v["text"])
        for verses in en_raw.values()
        for v in verses
    }
    idn = {
        f"{v['chapter']}:{v['verse']}": clean_translation(v["text"])
        for verses in id_raw.values()
        for v in verses
    }

    by_surah: dict[int, list[list]] = {i: [] for i in range(1, 115)}
    for verse in raw["verses"]:
        surah, ayah = (int(n) for n in verse["verse_key"].split(":"))
        key = f"{surah}:{ayah}"
        simple_text = matching_text(verse["text_uthmani"])
        by_surah[surah].append(
            [
                verse["page_number"],
                verse["juz_number"],
                verse["text_uthmani"],
                simple_text,
                en.get(key, ""),
                idn.get(key, ""),
            ]
        )

    for surah, verses in by_surah.items():
        assert len(verses) == chapters[surah - 1]["total_verses"], surah

    surahs = []
    for chapter in chapters:
        verses = by_surah[chapter["id"]]
        surahs.append(
            {
                "id": chapter["id"],
                "name": chapter["name"],
                "en": chapter["transliteration"],
                "type": chapter["type"],
                "verses": len(verses),
                "page": verses[0][0],
                "juz": verses[0][1],
            }
        )

    payload = {
        "version": 1,
        "meta": {
            "riwaya": raw["riwaya"],
            "mushaf": raw["mushaf"],
            "textSource": raw["source"],
            "fetched": raw["fetched"],
            "matchingSource": "Derived from the bundled Uthmani text by stripping tashkeel and unifying alef/hamza forms",
            "translations": {
                "en": "Saheeh International (QuranEnc)",
                "id": "Tafsir Sabiq (QuranEnc)",
            },
        },
        "surahs": surahs,
        "verses": [by_surah[i] for i in range(1, 115)],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB, {sum(len(v) for v in by_surah.values())} ayat)")


if __name__ == "__main__":
    main()
