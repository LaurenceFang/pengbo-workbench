from __future__ import annotations

from .api.factory import create_app
from .runtime import RuntimeSettings

app = create_app(RuntimeSettings.from_env())
