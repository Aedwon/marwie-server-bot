from __future__ import annotations

import json
from pathlib import Path


def test_vercel_deploys_only_production_site_and_final_review_branches() -> None:
    config = json.loads(Path("vercel.json").read_text())

    policy = config["git"]["deploymentEnabled"]

    assert policy == {
        "**": False,
        "web/rob-bot-site-production": True,
        "vercel-ready-*": True,
    }
