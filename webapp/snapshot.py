# -*- coding: utf-8 -*-
"""LUU / NAP LAI du lieu nhap tay xuong file JSON.

Day la nguon du lieu CHINH cua he thong (thay Excel), khong phai cache: mat file
nay la mat toan bo cong nhap lieu cua giao vu. Nen moi endpoint /api/manual/* co
sua du lieu deu goi save_snapshot() truoc khi tra ve.

CHI lo viec ben-vung-hoa du lieu dang lam viec. "Moc hoan tac" (nut Huy thay doi)
la mot viec KHAC - ban chup mot thoi diem de quay ve - nam o domain/hoan_tac.py.
Truoc day hai thu o chung mot file va de bi lan: ca hai deu "ghi trang thai xuong
JSON" nhung mot cai chay sau MOI thao tac, cai kia chi o hai thoi diem.
"""

import json
import os

from domain.luoi import dat_lich_ban_dau
from state import STATE

SNAPSHOT_PATH = os.environ.get(
    "SNAPSHOT_PATH",
    os.path.join(os.path.dirname(__file__), "manual_state_snapshot.json")
)

# Cac dict dung INT lam key - JSON bien key thanh string nen phai chuyen lai khi
# nap. domain/hoan_tac.py dung lai hang nay (no chup cung mot cau truc `data`).
KHOA_INT = ("teachers", "sections", "submissions", "courses", "program_faculty",
             "coordinator_names", "program_names_reverse", "manual_teacher_windows")


def save_snapshot(raise_on_error=False):
    """Ghi STATE['data']/['extra']/['co_huu'] xuong file JSON sau moi thay doi.

    Loi ghi file (vd het dung luong) khong duoc chan luong nhap lieu cua nguoi
    dung - chi bo qua, demo local 1 nguoi dung."""
    if STATE["data"] is None:
        return False
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


def load_snapshot():
    """Nap lai snapshot nhap tay khi Flask khoi dong (neu co) - dao nguoc dung
    save_snapshot()."""
    if not os.path.exists(SNAPSHOT_PATH):
        return
    try:
        with open(SNAPSHOT_PATH, encoding="utf-8") as f:
            snap = json.load(f)
    except (OSError, json.JSONDecodeError):
        return
    # Nap danh sach co huu TRUOC data: dat_lich_ban_dau() o cuoi ham doc
    # teacher_type, ma phan loai do phu thuoc danh sach nay.
    STATE["co_huu"] = snap.get("coHuu")
    data = snap.get("data")
    if not data:
        return
    for key in KHOA_INT:
        if isinstance(data.get(key), dict):
            data[key] = {int(k): v for k, v in data[key].items()}
    data["forced_conflict_teacher_ids"] = set(data.get("forced_conflict_teacher_ids") or [])
    STATE["data"] = data
    STATE["extra"] = snap.get("extra")
    # Snapshot chi luu data/extra (ket qua giai khong luu - giai lai la ra). Nhung
    # LICH BAN DAU tu gio da chot thi dung lai duoc ngay, khong thi mo lai app la
    # man TKB trong tron du du lieu co day gio.
    dat_lich_ban_dau(data)
