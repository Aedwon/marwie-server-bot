from importlib import import_module

import pytest

from marwie_bot.bot import EXTENSIONS


@pytest.mark.parametrize("extension", EXTENSIONS)
def test_extension_imports(extension: str) -> None:
    module = import_module(extension)
    assert callable(getattr(module, "setup", None))
