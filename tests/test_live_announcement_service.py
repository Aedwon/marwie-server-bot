import pytest

from marwie_bot.features.live_announcements.service import LiveAnnouncementService

MAR_WIE_USER_ID = 703986808962285621
TIKTOK_URL = "https://www.tiktok.com/@marwie/live"


def test_authorized_user_can_create_live_announcement() -> None:
    service = LiveAnnouncementService(
        authorized_user_id=MAR_WIE_USER_ID,
        tiktok_url=TIKTOK_URL,
    )

    draft = service.create_draft(
        requester_id=MAR_WIE_USER_ID,
        topic="  Building agents with tool calling  ",
    )

    assert draft.title == "Mar Wie is live on TikTok"
    assert draft.topic == "Building agents with tool calling"
    assert draft.tiktok_url == TIKTOK_URL


def test_blank_topic_is_normalized_to_none() -> None:
    service = LiveAnnouncementService(
        authorized_user_id=MAR_WIE_USER_ID,
        tiktok_url=None,
    )

    draft = service.create_draft(requester_id=MAR_WIE_USER_ID, topic="   ")

    assert draft.topic is None
    assert draft.tiktok_url is None


def test_other_user_cannot_create_live_announcement() -> None:
    service = LiveAnnouncementService(
        authorized_user_id=MAR_WIE_USER_ID,
        tiktok_url=TIKTOK_URL,
    )

    with pytest.raises(PermissionError, match="Mar Wie"):
        service.create_draft(requester_id=123456789, topic=None)
