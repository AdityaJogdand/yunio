"""Auth, field whitelist and upload cap hold. Run: uv run python scripts/check_security.py (no keys needed)."""
import os

os.environ["YUNIO_TOKEN"] = "test-token-1234567890"
from fastapi.testclient import TestClient  # noqa: E402

from yunio.server import CASES, app  # noqa: E402

c = TestClient(app)
H = {"X-Yunio-Token": os.environ["YUNIO_TOKEN"]}
for path in ("/api/cases", "/api/review", "/api/tts?text=a&lang=hi-IN"):
    assert c.get(path).status_code == 401, path
    assert c.get(path, headers={"X-Yunio-Token": "wrong"}).status_code == 401, path
assert c.post("/api/reunite", json={"lost": "L-0001", "found": "F-0001"}).status_code == 401
assert c.get("/api/cases", headers=H).status_code == 200

r = c.post("/api/cases", headers=H, json={"kind": "lost", "name": "x" * 999, "status": "reunited", "camp": 99, "evil": 1})
saved = next(k for k in CASES if k["id"] == r.json()["id"])
assert "status" not in saved and saved["camp"] == 3 and "evil" not in saved and len(saved["name"]) == 200, saved

r = c.post("/api/intake", headers=H, data={"lang": "hi-IN", "kind": "lost"}, files={"audio": ("a.m4a", b"0" * 2_000_001)})
assert r.status_code == 413, r.status_code
print("security checks ok")
