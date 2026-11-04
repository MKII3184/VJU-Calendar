# -*- coding: utf-8 -*-
"""GIO RANH da khai bao: doc tu request, giao khung cua ca nhom day, suy ra cac
slot bat dau hop le.

Phan biet ro voi time_rules.py: o day la "GV/dieu phoi vien noi minh RANH luc
nao" (nhieu lua chon, solver se chon 1); ben do la "gio DA CHOT cho mot lop cu
the" (mot gia tri duy nhat).

Slot la mot so nguyen phang: slot = day * slotsPerDay + period (0-indexed) -
cung dinh dang voi data['submissions'] va voi SubmissionWindowGrid ben frontend.
"""

import scheduler_core as sc


def valid_starts_from_slots(available_slots, duration, slots_per_day):
    """Slot bat dau hop le = TOAN BO 'duration' slot lien tiep TU day (cung 1
    ngay, KHONG duoc vat sang ngay hom sau) deu nam trong tap slot GV ranh.
    available_slots la tap PHANG cac slot ranh - cung dinh dang voi
    data['submissions'], khong phai 1 khoang lien tuc duy nhat nhu ham cu
    (_expand_window_to_starts, da bo) - ho tro GV ranh nhieu doan rieng le trong
    cung 1 ngay (vd ranh tiet 1-3 VA rieng tiet 7-9), dong thoi tai dung dung
    dinh dang SubmissionWindowGrid da phat sinh san
    (frontend/src/adapters/submissionAdapter.js) - khong can widget rieng."""
    avail = set(available_slots)
    starts = []
    for slot in avail:
        _, period = divmod(slot, slots_per_day)
        if period + duration > slots_per_day:
            continue  # buoi hoc se vat sang ngay hom sau - khong hop le
        if all((slot + k) in avail for k in range(duration)):
            starts.append(slot)
    return sorted(starts)


def gio_ranh_chung(data, teacher_ids):
    """Khung gio ranh dung duoc cho CA NHOM = GIAO cac khung tung nguoi da khai.

    Nguoi CHUA khai gi khong bi tinh vao giao (xem C2: chua khai = ranh ca tuan),
    nen ho khong lam hep khung cua nguoi khac. Tra ve (cac_slot, so_nguoi_da_khai).
    """
    windows = data.get("manual_teacher_windows", {})
    da_khai = [set(windows.get(t) or []) for t in teacher_ids if windows.get(t)]
    if not da_khai:
        return [], 0
    return sorted(set.intersection(*da_khai)), len(da_khai)


def loi_gio_ranh_trung_gio_day(data, teacher_id, slots):
    """Giờ đang dạy (lớp đã chốt giờ) không phải giờ rảnh: trả về thông báo lỗi
    nếu `slots` chứa ô GV đang dạy, ngược lại None."""
    from domain.teachers import teaching_slots_of

    trung = sorted(set(slots) & teaching_slots_of(data, teacher_id))
    if not trung:
        return None
    slots_per_day = data["params"]["slotsPerDay"]
    ten = ", ".join(
        f"{DAY_LABELS[s // slots_per_day]} tiết {s % slots_per_day + 1}" for s in trung[:5]
    )
    them = f" và {len(trung) - 5} ô khác" if len(trung) > 5 else ""
    return f"Không thể khai giờ rảnh trùng giờ đang dạy: {ten}{them}."


DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]


def parse_availability_slots(data, body):
    """Doc 'availability' tu body: danh sach SO NGUYEN slot. Tra ve
    (slots, error) - slots la list da sap xep, error la str neu co gia tri
    ngoai pham vi tuan."""
    num_days, slots_per_day = data["params"]["numDays"], data["params"]["slotsPerDay"]
    # "availability" chi co tac dung voi GUEST (xem api/manual.py:
    # api_manual_add_teacher) - gioi han toi Thu 7 theo dung quy tac sc.MAX_DAY_INDEX.
    num_days = min(num_days, sc.max_day_index("GUEST") + 1)
    max_slot = num_days * slots_per_day
    try:
        slots = sorted({int(s) for s in (body.get("availability") or [])})
    except (TypeError, ValueError):
        return None, "availability phải là danh sách số nguyên (slot)."
    if any(s < 0 or s >= max_slot for s in slots):
        return None, "Có slot ngoài phạm vi tuần (thỉnh giảng chỉ dạy tới Thứ 7)."
    return slots, None
