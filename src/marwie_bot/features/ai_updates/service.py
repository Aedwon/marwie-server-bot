from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree


@dataclass(frozen=True, slots=True)
class FeedItem:
    title: str
    url: str
    published_at: datetime | None
    dedupe_key: str


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(element: ElementTree.Element, name: str) -> str:
    for child in element:
        if _local_name(child.tag) == name:
            return (child.text or "").strip()
    return ""


def _parse_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except ValueError:
        return None


def parse_feed(xml_text: str) -> list[FeedItem]:
    root = ElementTree.fromstring(xml_text)
    items: list[FeedItem] = []
    candidates = [
        element for element in root.iter() if _local_name(element.tag) in {"item", "entry"}
    ]
    for element in candidates:
        title = _child_text(element, "title")
        url = _child_text(element, "link")
        if not url:
            for child in element:
                if _local_name(child.tag) == "link":
                    href = child.attrib.get("href", "").strip()
                    rel = child.attrib.get("rel", "alternate")
                    if href and rel in {"alternate", ""}:
                        url = href
                        break
        published_raw = (
            _child_text(element, "pubDate")
            or _child_text(element, "published")
            or _child_text(element, "updated")
        )
        if not title or not url:
            continue
        published_at = _parse_date(published_raw)
        identity = f"{url}|{title}|{published_at.isoformat() if published_at else ''}"
        dedupe_key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        items.append(FeedItem(title[:500], url[:1500], published_at, dedupe_key))
    items.sort(key=lambda item: item.published_at or datetime.min.replace(tzinfo=UTC))
    return items
