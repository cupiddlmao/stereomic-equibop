"""Connect the prepared build to Equibop. Run while Equibop is closed."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil

project = Path(__file__).resolve().parent
build = project / "Equicord" / "dist"
config = Path.home() / ".config" / "equibop"
for filename in ("main.js", "preload.js", "renderer.js"):
    if not (build / "equibop" / filename).is_file():
        raise SystemExit(f"Missing build file: {filename}")
if "StereoMic" not in (build / "equibop" / "renderer.js").read_text():
    raise SystemExit("The build does not contain StereoMic")

# Equibop stores the custom build location in state.json, not settings.json.
state_path = config / "state.json"
settings_path = config / "settings" / "settings.json"
state = json.loads(state_path.read_text())
settings = json.loads(settings_path.read_text())
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
backup = project / "installation-backups" / stamp
backup.mkdir(parents=True, mode=0o700)
shutil.copy2(state_path, backup / "state.json")
shutil.copy2(settings_path, backup / "equicord-settings.json")

state["equicordDir"] = str(build)
plugin = settings.setdefault("plugins", {}).setdefault("StereoMic", {})
plugin["enabled"] = True
plugin.setdefault("bitrate", 128000)
plugin.setdefault("disableProcessing", True)

for path, data in ((state_path, state), (settings_path, settings)):
    temporary = path.with_name(path.name + ".stereomic.tmp")
    try:
        with temporary.open("x") as handle:
            os.chmod(temporary, path.stat().st_mode & 0o777)
            json.dump(data, handle, indent=4)
            handle.write("\n")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)

assert json.loads(state_path.read_text())["equicordDir"] == str(build)
assert json.loads(settings_path.read_text())["plugins"]["StereoMic"]["enabled"]
print("Configured build:", build)
print("StereoMic enabled; requested bitrate:", plugin.get("bitrate", 128000) // 1000, "kbps")
print("Backups:", backup)
