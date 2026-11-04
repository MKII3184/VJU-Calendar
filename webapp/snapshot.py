# -*- coding: utf-8 -*-
"""LUU / NAP LAI du lieu nhap tay xuong Database va file JSON.

Day la nguon du lieu CHINH cua he thong (thay Excel):
- Ghi dong thoi vao Database (MySQL/SQLite qua database.py) de luu tru ben vung tren Cloud/Docker.
- Ghi them file JSON snapshot de du phong offline.
"""

import json
import logging
import os

from database import load_data_from_db, save_data_to_db
from domain.luoi import dat_lich_ban_dau
from state import STATE

logger = logging.getLogger(__name__)

SNAPSHOT_PATH = os.environ.get(
    "SNAPSHOT_PATH",
    os.path.join(os.path.dirname(__file__), "manual_state_snapshot.json")
)

# Cac dict dung INT lam key - JSON bien key thanh string nen phai chuyen lai khi
# nap. domain/hoan_tac.py dung lai hang nay (no chup cung mot cau truc `data`).
KHOA_INT = ("teachers", "sections", "submissions", "courses", "program_faculty",
             "coordinator_names", "program_names_reverse", "manual_teacher_windows")


def save_snapshot(raise_on_error=False):
    """Ghi STATE['data']/['extra']/['co_huu'] xuong Database va file JSON."""
    if STATE["data"] is None:
        return False

    # 1. Đồng bộ vào Database quan hệ (MySQL / SQLite)
    try:
        save_data_to_db(STATE["data"], STATE.get("extra"), STATE.get("co_huu"))
    except Exception as exc:
        logger.warning(f"Lỗi khi lưu dữ liệu vào Database: {exc}")

    # 2. Ghi file JSON dự phòng
    snapshot = {**STATE["data"],
                "forced_conflict_teacher_ids": sorted(STATE["data"].get("forced_conflict_teacher_ids") or [])}
    temp_path = f"{SNAPSHOT_PATH}.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump({"data": snapshot, "extra": STATE.get("extra"),
                       "coHuu": STATE.get("co_huu")}, f, ensure_ascii=False)
        os.replace(temp_path, SNAPSHOT_PATH)
        return True
    except OSError:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        if raise_on_error:
            raise
        return False


def _khoi_phuc_data(data, extra, co_huu):
    if not data:
        return
    STATE["co_huu"] = co_huu
    for key in KHOA_INT:
        if isinstance(data.get(key), dict):
            data[key] = {int(k): v for k, v in data[key].items()}
    data["forced_conflict_teacher_ids"] = set(data.get("forced_conflict_teacher_ids") or [])
    STATE["data"] = data
    STATE["extra"] = extra
    dat_lich_ban_dau(data)


def load_snapshot():
    """Nap lai du lieu khi Flask khoi dong: Uu tien Database truoc, fallback sang JSON."""
    # 1. Thử nạp từ Database
    try:
        db_data = load_data_from_db()
        if db_data and db_data.get("data"):
            logger.info("Đã nạp thành công dữ liệu từ Database.")
            _khoi_phuc_data(db_data["data"], db_data.get("extra"), db_data.get("co_huu"))
            return
    except Exception as exc:
        logger.warning(f"Không thể nạp dữ liệu từ Database: {exc}")

    # 2. Nếu Database chưa có dữ liệu, đọc từ file snapshot JSON
    if not os.path.exists(SNAPSHOT_PATH):
        return
    try:
        with open(SNAPSHOT_PATH, encoding="utf-8") as f:
            snap = json.load(f)
    except (OSError, json.JSONDecodeError):
        return

    data = snap.get("data")
    if data:
        _khoi_phuc_data(data, snap.get("extra"), snap.get("coHuu"))
        # Tự động nạp sang Database lần đầu
        try:
            save_data_to_db(STATE["data"], STATE.get("extra"), STATE.get("co_huu"))
        except Exception:
            pass
