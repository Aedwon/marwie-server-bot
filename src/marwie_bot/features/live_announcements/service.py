from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LiveAnnouncementDraft:
    title: str
    topic: str | None
    tiktok_url: str | None


class LiveAnnouncementService:
    def __init__(self, authorized_user_id: int, tiktok_url: str | None) -> None:
        self.authorized_user_id = authorized_user_id
        self.tiktok_url = tiktok_url

    def create_draft(self, requester_id: int, topic: str | None) -> LiveAnnouncementDraft:
        if requester_id != self.authorized_user_id:
            raise PermissionError("Only Mar Wie can use this command.")

        normalized_topic = topic.strip() if topic is not None else None
        if not normalized_topic:
            normalized_topic = None

        return LiveAnnouncementDraft(
            title="Mar Wie is live on TikTok",
            topic=normalized_topic,
            tiktok_url=self.tiktok_url,
        )
