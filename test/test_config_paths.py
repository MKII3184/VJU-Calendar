import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parent.parent


def load_launcher():
    spec = importlib.util.spec_from_file_location("calendar_launcher", ROOT / "main.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_backend(tmp_path, content=None, cwd=None):
    source = tmp_path / "webapp"
    source.mkdir(exist_ok=True)
    shutil.copyfile(ROOT / "webapp" / "app_config.py", source / "app_config.py")
    config = tmp_path / "config" / "backend.json"
    if content is not None:
        config.parent.mkdir(exist_ok=True)
        config.write_text(content, encoding="utf-8")
    result = subprocess.run(
        [sys.executable, "-c", "import app_config; print(app_config.CONFIG_PATH)"],
        cwd=cwd or source,
        env={**os.environ, "PYTHONPATH": str(source), "PYTHONIOENCODING": "utf-8"},
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result, config


def test_launcher_paths_independent_of_cwd(tmp_path, monkeypatch):
    launcher = load_launcher()
    assert launcher.CONFIG_PATHS == (ROOT / "config" / "backend.json", ROOT / "config" / "frontend.json")
    monkeypatch.chdir(tmp_path)
    assert launcher.CONFIG_PATHS == (ROOT / "config" / "backend.json", ROOT / "config" / "frontend.json")


def test_launcher_removes_legacy_config_before_config_check(tmp_path, monkeypatch):
    launcher = load_launcher()
    legacy_path = tmp_path / "webapp" / "config.json"
    legacy_path.parent.mkdir()
    legacy_path.write_text("legacy", encoding="utf-8")
    monkeypatch.setattr(launcher, "LEGACY_CONFIG_PATH", legacy_path)
    monkeypatch.setattr(
        launcher,
        "ensure_config_files",
        lambda: (_ for _ in ()).throw(RuntimeError("config checked")) if not legacy_path.exists()
        else pytest.fail("legacy config was not removed first"),
    )
    monkeypatch.setattr(launcher, "install_missing_dependencies", lambda: pytest.fail("installed after config error"))
    assert launcher.main() == 1
    assert not legacy_path.exists()


def test_launcher_ignores_missing_legacy_config(tmp_path):
    launcher = load_launcher()
    legacy_path = tmp_path / "webapp" / "config.json"
    launcher.remove_legacy_config(legacy_path)
    assert not legacy_path.exists()


def test_launcher_creates_both_before_install(tmp_path, monkeypatch, capsys):
    launcher = load_launcher()
    paths = (tmp_path / "config" / "backend.json", tmp_path / "config" / "frontend.json")
    monkeypatch.setattr(launcher, "CONFIG_PATHS", paths)
    monkeypatch.setattr(launcher, "install_missing_dependencies", lambda: pytest.fail("installed before config check"))
    assert launcher.main() == 1
    assert all(path.is_file() and path.stat().st_size == 0 for path in paths)
    output = capsys.readouterr().err
    assert all(str(path) in output for path in paths)
    paths[0].write_text("preserve", encoding="utf-8")
    launcher.ensure_config_files(paths)
    assert paths[0].read_text(encoding="utf-8") == "preserve"


def test_launcher_filesystem_error_contains_path(tmp_path, monkeypatch):
    launcher = load_launcher()
    path = tmp_path / "config" / "backend.json"
    def deny_mkdir(self, *args, **kwargs):
        raise PermissionError("denied")
    monkeypatch.setattr(Path, "mkdir", deny_mkdir)
    with pytest.raises(RuntimeError, match="backend.json"):
        launcher.ensure_config_files((path,))


def test_launcher_builds_frontend_before_starting_services(monkeypatch):
    launcher = load_launcher()
    calls = []
    monkeypatch.setattr(launcher, "remove_legacy_config", lambda: calls.append("remove"))
    monkeypatch.setattr(launcher, "ensure_config_files", lambda: calls.append("config"))
    monkeypatch.setattr(launcher, "install_missing_dependencies", lambda: calls.append("install") or "npm")
    monkeypatch.setattr(launcher, "build_frontend", lambda npm: calls.append(("build", npm)))
    monkeypatch.setattr(launcher, "start_services", lambda npm: calls.append(("start", npm)) or 0)
    assert launcher.main() == 0
    assert calls == ["remove", "config", "install", ("build", "npm"), ("start", "npm")]


@pytest.mark.parametrize("cwd_name", ["webapp", "frontend", "elsewhere"])
def test_backend_missing_creates_file_at_project_root(tmp_path, cwd_name):
    cwd = tmp_path / cwd_name
    cwd.mkdir()
    result, config = run_backend(tmp_path, cwd=cwd)
    assert result.returncode != 0
    assert config.is_file() and config.stat().st_size == 0
    assert str(config) in result.stderr and "Đã tạo" in result.stderr


@pytest.mark.parametrize("content, message", [
    ("", "đang trống"),
    ("{not-json", "JSON không hợp lệ"),
    ("{}", "Thiếu hoặc sai cấu trúc"),
])
def test_backend_invalid_config_kept(tmp_path, content, message):
    result, config = run_backend(tmp_path, content)
    assert result.returncode != 0
    assert message in result.stderr and str(config) in result.stderr
    assert config.read_text(encoding="utf-8") == content


def test_backend_valid_config_at_new_path(tmp_path):
    config = {
        "calendar": {"numDays": 7, "slotsPerDay": 13, "defaultDuration": 2,
                     "maxImportedPeriod": 16, "dayLabels": ["d"] * 7, "slotDayNames": ["d"] * 7},
        "rooms": {"ltPool": 60, "labPool": 40},
        "teacherDayLimits": {"GUEST": 5, "RESIDENT": 4},
        "campuses": {"priority": [], "sessionBlocks": {}},
        "solver": {"timeLimitSeconds": 30, "numSearchWorkers": 8, "crossProgramCombinationLimit": 5000},
        "legacyDataParams": {"seed": 0, "pctPreSubmitted": 100, "numForcedConflicts": 0},
    }
    result, path = run_backend(tmp_path, json.dumps(config))
    assert result.returncode == 0, result.stderr
    assert str(path) in result.stdout
    assert not (tmp_path / "webapp" / "config.json").exists()
