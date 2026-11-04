# -*- coding: utf-8 -*-
"""GIANG VIEN nhap tay: them moi va sua (ke ca khung gio ranh)."""

import copy
import re

from flask import Blueprint, request

from api.common import can_du_lieu, loi, tra_du_lieu
from domain.availability import loi_gio_ranh_trung_gio_day, parse_availability_slots
from domain.availability_generator import generate_teacher_availability
from domain.hoc_chung import tach_nhom_khong_hop_le
from domain.luoi import dong_bo_ket_qua
from domain.sections import id_moi
from domain.teachers import dem_lai_so_gv, sync_teacher_sections
from snapshot import save_snapshot
from state import STATE

bp = Blueprint("manual_teacher", __name__)

_SDT_HOP_LE = re.compile(r"[0-9]{0,10}")


def _loi_so_dien_thoai(body):
    """So dien thoai tuy chon: chi chu so 0-9, toi da 10. Chi kiem khi body CO
    truong `phone` (PATCH luu gio ranh khong gui phone). So cu tu Excel khong hop
    le van duoc HIEN THI, nhung luu thong tin GV thi phai sua lai."""
    if "phone" not in body:
        return None
    phone = body.get("phone")
    phone = "" if phone is None else phone
    if not isinstance(phone, str) or not _SDT_HOP_LE.fullmatch(phone):
        return "Số điện thoại chỉ gồm chữ số 0-9, tối đa 10 chữ số."
    return None


@bp.post("/api/manual/teacher")
@can_du_lieu
def api_manual_add_teacher(data):
    """Them 1 giang vien nhap tay. Body JSON:
    {name, org, title, email, phone, teacherType: 'GUEST'|'RESIDENT', availability: [slot, ...]}
    'availability' CHI co tac dung voi GUEST (co huu Giai doan 2 luon tu do chon
    gio, khong can khai bao - theo quyet dinh cua giao vu), la danh sach slot
    PHANG GV ranh (xem availability.parse_availability_slots) - tick MOI tiet
    ranh, khong chi tiet bat dau, he thong tu tim gio bat dau hop le qua
    valid_starts_from_slots(). title/email/phone la tuy chon (fill-rate thuc
    te trong Excel rat thap)."""
    body = request.get_json(force=True)

    name = (body.get("name") or "").strip()
    if not name:
        return loi("Thiếu Họ tên giảng viên.")
    teacher_type = body.get("teacherType")
    if teacher_type not in ("GUEST", "RESIDENT"):
        return loi("teacherType phải là 'GUEST' hoặc 'RESIDENT'.")
    err = _loi_so_dien_thoai(body)
    if err:
        return loi(err)

    slots = []
    if teacher_type == "GUEST":
        slots, err = parse_availability_slots(data, body)
        if err:
            return loi(err)

    tid = id_moi(data["teachers"])
    data["teachers"][tid] = {
        "id": tid, "name": name, "type": teacher_type,
        "org": (body.get("org") or "").strip(),
        "title": (body.get("title") or "").strip(),
        "email": (body.get("email") or "").strip(),
        "phone": (body.get("phone") or "").strip(),
    }
    data.setdefault("manual_teacher_windows", {})[tid] = slots
    dem_lai_so_gv(data)

    save_snapshot()
    return tra_du_lieu(data)


@bp.patch("/api/manual/teacher/<int:teacher_id>")
@can_du_lieu
def api_manual_update_teacher(data, teacher_id):
    """Sua thong tin 1 GV va/hoac gio ranh - PARTIAL update (chi field co mat
    trong body moi bi ghi de), khac PATCH section (can gui du ca form): cac
    field GV doc lap voi nhau, khong can ngu canh cheo nhu section (thoi
    gian/GV/duration lien quan nhau). Sau khi doi teacherType/availability,
    dong bo lai cac lop dang cho GV nay qua sync_teacher_sections()."""
    teacher = data["teachers"].get(teacher_id)
    if teacher is None:
        return loi(f"Không tìm thấy giảng viên id={teacher_id}.")
    body = request.get_json(force=True)

    err = _loi_so_dien_thoai(body)
    if err:
        return loi(err)
    # Kiem tra het truoc khi ghi bat ky field nao: bi tu choi thi du lieu da luu
    # giu nguyen, khong luu do dang (vd doi ten roi moi bao loi gio ranh).
    slots = None
    if "availability" in body:
        slots, err = parse_availability_slots(data, body)
        if err:
            return loi(err)
        err = loi_gio_ranh_trung_gio_day(data, teacher_id, slots)
        if err:
            return loi(err)
    if "name" in body and not (body.get("name") or "").strip():
        return loi("Họ tên không được để trống.")
    if "teacherType" in body and body["teacherType"] not in ("GUEST", "RESIDENT"):
        return loi("teacherType phải là 'GUEST' hoặc 'RESIDENT'.")

    if "name" in body:
        teacher["name"] = body["name"].strip()
    for field in ("org", "title", "email", "phone"):
        if field in body:
            teacher[field] = (body.get(field) or "").strip()
    if "teacherType" in body:
        teacher["type"] = body["teacherType"]
    if slots is not None:
        data.setdefault("manual_teacher_windows", {})[teacher_id] = slots

    dem_lai_so_gv(data)
    sync_teacher_sections(data, teacher_id)
    # Doi loai GV co the lam mot nhom hoc chung LECH PHA (mot lop sang thinh giang,
    # lop kia con co huu) - o thao tac nay khong con "phep sua" nao de tu choi, nen
    # phai tach nhom va noi ra (xem tach_nhom_khong_hop_le).
    tach = tach_nhom_khong_hop_le(data)

    # Doi loai GV lam cac lop cua ho NHAY GIAI DOAN (thinh giang <-> co huu), va
    # doi ten thi the buoi tren luoi phai ghi ten moi. KHONG truyen bo_vi_tri_cu:
    # cac lop nay khong bi ghi lai gio, nghiem cua lan giai truoc van la thong tin
    # dung nhat ve cho cua chung.
    dong_bo_ket_qua(data)
    save_snapshot()
    return tra_du_lieu(data, hocChungSplit=tach)


@bp.post("/api/manual/teacher/<int:teacher_id>/generate-availability")
@can_du_lieu
def api_manual_generate_availability(data, teacher_id):
    """Tu dong sinh lai TOAN BO gio ranh cua 1 GV theo cac khung buoi cau hinh
    san (CONFIG["availabilityGenerator"] - xem domain/availability_generator.py
    va PROMPT-THEM-CHUC-NANG-GIO-RANH-GIANG-VIEN.md). LUON THAY THE toan bo
    availabilitySlots cu (replaceExistingAvailability chi ho tro True), GIU
    NGUYEN gio dang day (khong doc/khong ghi lai cac lop da chot gio).

    All-or-nothing: ket qua duoc sinh xong trong bien tam (khong dung/khong doc
    manual_teacher_windows hien co) roi moi ghi de mot lan; loi truoc do (vd
    khong tim thay GV) khong lam mat gio ranh cu."""
    teacher = data["teachers"].get(teacher_id)
    if teacher is None:
        return loi(f"Không tìm thấy giảng viên id={teacher_id}.")

    slots = generate_teacher_availability(data, teacher_id)

    data.setdefault("manual_teacher_windows", {})[teacher_id] = slots
    dem_lai_so_gv(data)
    sync_teacher_sections(data, teacher_id)
    tach = tach_nhom_khong_hop_le(data)
    dong_bo_ket_qua(data)
    save_snapshot()
    return tra_du_lieu(data, hocChungSplit=tach, generatedSlotCount=len(slots))


@bp.post("/api/manual/teachers/generate-availability")
@can_du_lieu
def api_manual_generate_all_availability(data):
    teacher_ids = sorted(
        teacher_id for teacher_id, teacher in data["teachers"].items()
        if not teacher.get("placeholder") and teacher.get("type") in ("GUEST", "RESIDENT")
    )
    if not teacher_ids:
        return loi("Không có giảng viên thật nào để khai giờ rảnh.")

    generated = {
        teacher_id: generate_teacher_availability(data, teacher_id)
        for teacher_id in teacher_ids
    }
    working_data = copy.deepcopy(data)
    windows = working_data.setdefault("manual_teacher_windows", {})
    for teacher_id, slots in generated.items():
        windows[teacher_id] = slots
    dem_lai_so_gv(working_data)
    for teacher_id in teacher_ids:
        sync_teacher_sections(working_data, teacher_id)
    tach = tach_nhom_khong_hop_le(working_data)

    previous = {
        "data": STATE["data"],
        "guestResult": STATE["guestResult"],
        "residentResult": STATE["residentResult"],
    }
    STATE["data"] = working_data
    STATE["guestResult"] = copy.deepcopy(previous["guestResult"])
    STATE["residentResult"] = copy.deepcopy(previous["residentResult"])
    try:
        dong_bo_ket_qua(working_data)
        save_snapshot(raise_on_error=True)
    except Exception:
        STATE.update(previous)
        raise

    return tra_du_lieu(
        working_data,
        hocChungSplit=tach,
        generatedTeacherCount=len(teacher_ids),
        generatedSlotCount=sum(len(slots) for slots in generated.values()),
    )
