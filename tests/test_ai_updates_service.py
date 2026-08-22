from marwie_bot.features.ai_updates.service import parse_feed


def test_parse_rss_feed() -> None:
    items = parse_feed(
        """<?xml version='1.0'?><rss><channel><item><title>Release</title><link>https://example.com/release</link><pubDate>Fri, 21 Aug 2026 10:00:00 GMT</pubDate></item></channel></rss>"""
    )
    assert len(items) == 1
    assert items[0].title == "Release"
    assert items[0].url == "https://example.com/release"
    assert items[0].published_at is not None


def test_parse_atom_feed() -> None:
    items = parse_feed(
        """<feed xmlns='http://www.w3.org/2005/Atom'><entry><title>Model update</title><link href='https://example.com/model'/><updated>2026-08-21T12:00:00Z</updated></entry></feed>"""
    )
    assert len(items) == 1
    assert items[0].url == "https://example.com/model"
