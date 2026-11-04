# -*- coding: utf-8 -*-
"""LOP HOC PHAN (section): bo du lieu rong, validate body, khoa nhan dien lop."""

import re

import fate_import
from app_config import default_data_params
from domain.programs import program_ids_cua_lop
from domain.teachers import loai_lop
from domain.time_rules import parse_class_time

# Ma lop dang "<gi_do>-<so>" (vd "AET2014-3") - GIU CHU DAU, so O CUOI. Dung de
# don gian sau khi xoa mot lop trong hoc phan (xem don_ma_lop_sau_xoa).
_MA_LOP_SO_CUOI = re.compile(r"^(.*-)(\d+)$")


def empty_manual_data():
    """Bo du lieu rong de bat dau 'nhap lieu thu cong' - dung cau truc ma
    solve_guest_phase/solve_resident_phase/check_cross_program_conflicts/
    build_data_response dung duoc khong can sua gi.
    numDays/slotsPerDay mac dinh doc tu config.json; luong nap file con noi them
    slotsPerDay theo tiet lon nhat co trong file - xem
    domain/merge.py: noi_slots_per_day()."""
    return {
        "params": default_data_params(),
        "programs": [],
        "faculty_names": ["Chưa phân khoa"],
        "program_faculty": {},
        "coordinator_names": {},
        "teachers": {},
        "courses": {},  # course_id -> {id, code, name, credits} - 1 hoc phan dung chung cho nhieu lop
        "sections": {},
        "submissions": {},
        "forced_conflict_teacher_ids": set(),
        "pending_section_ids": [],
        "valid_starts": [],
        "num_resident": 0,
        "num_guest": 0,
        "num_programs": 0,
        "program_names_reverse": {},
        "manual_teacher_windows": {},  # teacher_id -> [slot, ...] (slot=day*slotsPerDay+period)
        # Nhieu lop (nhieu ma mon) la MOT buoi day - xem domain/hoc_chung.py
        "hoc_chung": [],
        "num_time_assumed": 0,
    }


MAX_SO_TIET_BUOI = 4
MAX_SO_SV_DU_KIEN = 200
MAX_SO_GIO_DAY = 50
_SO_NGUYEN = re.compile(r"^\d+$")
_SO_THUC = re.compile(r"^\d+(\.\d+)?$")


def _doc_so(value, nguyen):
    """Doc so tu body JSON (so hoac chuoi so, khong am). None neu khong hop le;
    bool khong tinh la so."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if nguyen and value != int(value):
            return None
        return value if value >= 0 else None
    if isinstance(value, str) and (_SO_NGUYEN if nguyen else _SO_THUC).match(value.strip()):
        return float(value) if not nguyen else int(value)
    return None


def kiem_tra_gioi_han_nhap_tay(body):
    """Gioi han RIENG cho thao tac LUU TAY (POST/PATCH /api/manual/section, ke ca
    "Them buoi khac"): So tiet/buoi 1..4, So SV du kien 0..200 (hoac trong), moi o
    So gio day LT/TH 0..50 (hoac trong, KHONG cong hai o). Tra ve thong bao loi
    hoac None. KHONG goi o duong nap Excel - du lieu cu vuot gioi han van duoc nhap."""
    duration = _doc_so(body.get("duration"), True)
    if duration is None or not 1 <= duration <= MAX_SO_TIET_BUOI:
        return f"Số tiết / buổi phải là số nguyên từ 1 đến {MAX_SO_TIET_BUOI}."
    sv = body.get("expectedStudents")
    if sv not in (None, ""):
        v = _doc_so(sv, True)
        if v is None or v > MAX_SO_SV_DU_KIEN:
            return f"Số SV dự kiến phải là số nguyên từ 0 đến {MAX_SO_SV_DU_KIEN} hoặc để trống."
    for key, nhan in (("teachingHoursLt", "Lý thuyết"), ("teachingHoursTh", "Thực hành")):
        gio = body.get(key)
        if gio in (None, ""):
            continue
        v = _doc_so(gio, False)
        if v is None or v > MAX_SO_GIO_DAY:
            return f"Số giờ dạy ({nhan}) phải từ 0 đến {MAX_SO_GIO_DAY} hoặc để trống."
    return None


def validate_section_body(data, body, enforce_day_cap=True):
    """Doc + validate toan bo body cho 1 lop - dung chung cho POST tao moi va
    PATCH sua (PATCH doi hoi gui DU ca form, khong merge tung phan field-mot, de
    tranh tinh sai submissions khi chi doi 1 vai field ma thieu ngu canh gio/GV
    hien tai). Tra ve (fields, teacher, duration, time_info, None) neu hop le,
    hoac (None, None, None, None, error_message) neu khong.
    enforce_day_cap=False: xem parse_class_time - danh cho luong nap file, KHONG
    danh cho nhap tay qua form (POST/PATCH /api/manual/section luon giu True)."""
    # GIANG VIEN CUA LOP: mot DANH SACH, moi nguoi vai tro NGANG NHAU.
    #
    # `teacherIds` la dang chinh. Van nhan `teacherId` (+ `coTeacherIds` cu) de
    # cac ban goi cu khong vo, nhung ben trong khong con khai niem "GV chinh":
    # teacher_ids[0] chi la nguoi dau danh sach, dung lam khoa hien thi o cac man
    # von chi cho 1 ten (luoi TKB, tra cuu theo GV).
    #
    # Solver dua CUNG MOT interval vao NoOverlap cua tung nguoi trong danh sach
    # (scheduler_core: mot lop, nhieu nguoi, khong nhan doi nhu cau phong);
    # check_cross_program_conflicts, loai lop (teachers.loai_lop) va gio ranh cua
    # lop (availability.gio_ranh_chung) cung tinh theo ca danh sach.
    tho = body.get("teacherIds")
    if tho is None:
        tho = ([body["teacherId"]] if "teacherId" in body else []) + list(body.get("coTeacherIds") or [])
    teacher_ids = []
    for raw in tho:
        try:
            tid = int(raw)
        except (TypeError, ValueError):
            return None, None, None, None, f"Danh sách giảng viên có giá trị sai: {raw!r}."
        if tid not in data["teachers"]:
            return None, None, None, None, f"Không tìm thấy giảng viên id={tid}."
        if tid not in teacher_ids:
            teacher_ids.append(tid)
    if not teacher_ids:
        return None, None, None, None, "Lớp phải có ít nhất một giảng viên."
    teacher_id = teacher_ids[0]
    teacher = data["teachers"][teacher_id]

    try:
        course_id = int(body["courseId"])
    except (KeyError, TypeError, ValueError):
        return None, None, None, None, "Thiếu hoặc sai courseId."
    course = data.get("courses", {}).get(course_id)
    if course is None:
        return None, None, None, None, f"Không tìm thấy học phần id={course_id}."

    try:
        duration = int(body.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0
    if duration <= 0:
        return None, None, None, None, "Số tiết mỗi buổi dạy phải là số nguyên > 0."

    teacher_type = loai_lop(data, teacher_ids)
    time_info, time_err = parse_class_time(
        body, data["params"]["slotsPerDay"], teacher_type, enforce_cap=enforce_day_cap,
    )
    if time_err:
        return None, None, None, None, time_err
    if enforce_day_cap and time_info is not None and time_info["period_end"] - time_info["period_start"] + 1 != duration:
        return None, None, None, None, "Dải giờ phải dài đúng bằng Số tiết mỗi buổi dạy."

    class_code = (body.get("classCode") or "").strip()
    lt_credits = body.get("ltCredits")
    th_credits = body.get("thCredits")
    # Mot lop co the thuoc NHIEU chuong trinh ("BCSE+MJM"). program_ids la danh
    # sach day du; "program" chi la nguoi dau danh sach, dung lam khoa hien thi/
    # sap xep o cac man von chi cho 1 gia tri (giong teacher_id vs teacher_ids).
    program_ids = program_ids_cua_lop(data, body.get("program"))
    room_type = "LAB" if (th_credits or 0) else "LT"

    fields = {
        "program": program_ids[0], "program_ids": program_ids,
        # Nguyen van o CTDT trong file - de hien thi (A3: giu nguyen nhu file).
        "program_raw": (body.get("program") or "").strip() or "Chung",
        "course_id": course_id,
        "course_name": f"{course['name']} ({class_code})" if class_code else course["name"],
        # teacher_id = nguoi dau danh sach (khoa hien thi), teacher_ids = CA NHOM.
        "teacher_id": teacher_id, "teacher_ids": teacher_ids,
        # Loai lop tinh theo CA NHOM - xem teachers.loai_lop().
        "teacher_type": teacher_type,
        "room_type": room_type, "duration": duration,
        "class_code": class_code, "lt_credits": lt_credits, "th_credits": th_credits,
        "cohort": (body.get("cohort") or "").strip(),
        "expected_students": body.get("expectedStudents"),
        "location": (body.get("location") or "").strip(),
        "teaching_mode": (body.get("teachingMode") or "").strip(),
        "language": (body.get("language") or "").strip(),
        "other_requirements": (body.get("otherRequirements") or "").strip(),
        "notes": (body.get("notes") or "").strip(),
        "coordinator_override": (body.get("coordinatorOverride") or "").strip(),
        "prev_teacher_name": (body.get("prevTeacherName") or "").strip(),
        "prev_teacher_org": (body.get("prevTeacherOrg") or "").strip(),
        "teaching_hours_lt": body.get("teachingHoursLt"),
        "teaching_hours_th": body.get("teachingHoursTh"),
    }
    return fields, teacher, duration, time_info, None


def id_moi(d):
    """Id nguyen nho nhat chua bi dung trong dict `d` (sections/courses/teachers).

    Truoc day moi cho tao ban ghi tu go lai `i = len(d); while i in d: i += 1` -
    5 ban sao cua cung mot phep tinh."""
    i = len(d)
    while i in d:
        i += 1
    return i


def don_ma_lop_sau_xoa(data, course_id, ma_lop_da_xoa):
    """Sau khi xoa 1 lop dang "<prefix>-<so>" (vd hoc phan AET2014 co cac lop
    AET2014-1..AET2014-7, xoa AET2014-2), don lai SO cua cac lop CON LAI trong
    CUNG hoc phan de khong de trong: lop nao co so LON HON so vua xoa thi giam
    di 1 (AET2014-3 -> AET2014-2, AET2014-4 -> AET2014-3...), giu nguyen do dai
    so (dem 0 dau, neu co) cua tung lop.

    CHI dong vao lop co CUNG hoc phan VA cung tien to chu (phan truoc dau "-"
    cuoi) voi ma vua xoa - ma lop khac dang (khong khop mau "-<so>") thi bo qua,
    tranh doi nham nhung ma go tay khong theo qui uoc nay."""
    if course_id is None:
        return
    m = _MA_LOP_SO_CUOI.match((ma_lop_da_xoa or "").strip())
    if not m:
        return
    tien_to, so_da_xoa = m.group(1), int(m.group(2))
    for s in data["sections"].values():
        if s.get("course_id") != course_id:
            continue
        cm = _MA_LOP_SO_CUOI.match((s.get("class_code") or "").strip())
        if not cm or cm.group(1) != tien_to:
            continue
        so = int(cm.group(2))
        if so > so_da_xoa:
            do_dai = len(cm.group(2))
            s["class_code"] = f"{tien_to}{so - 1:0{do_dai}d}"


def ke_hoach_doi_ma_lop(data, course_id, ma_cu, ma_moi):
    """Lap KE HOACH (khong ghi) doi ma lop khi doi ma hoc phan `ma_cu` -> `ma_moi`.

    Chi lop co ma dung mau "<ma_cu>-<so>" duoc danh lai thanh "<ma_moi>-1", "-2"...
    theo thu tu on dinh (so cu tang dan, roi id lop nho nhat), KHONG bo so. Cac buoi
    cua cung 1 lop dang CUNG ma lop thi nhan cung ma moi (khong tach lop). Ma tuy
    chinh/khong dung mau (ke ca khong co hau to) giu nguyen va duoc bao lai.

    Tra ve (doi, giu, loi): doi = {section_id: ma_moi}, giu = danh sach ma bi giu
    nguyen, loi = str neu ma moi se trung voi ma lop khac (khi do khong duoc luu)."""
    cua_hp = [s for s in data["sections"].values() if s.get("course_id") == course_id]
    mau = re.compile(rf"^{re.escape(ma_cu)}-(\d+)$") if ma_cu else None
    nhom = {}
    giu = []
    for s in sorted(cua_hp, key=lambda x: x["id"]):
        ma = (s.get("class_code") or "").strip()
        m = mau.match(ma) if mau else None
        if m:
            nhom.setdefault(ma, {"so": int(m.group(1)), "ids": []})["ids"].append(s["id"])
        elif ma and ma not in giu:
            giu.append(ma)
    doi = {}
    thu_tu = sorted(nhom.values(), key=lambda g: (g["so"], g["ids"][0]))
    for i, g in enumerate(thu_tu, 1):
        for sid in g["ids"]:
            doi[sid] = f"{ma_moi}-{i}"
    moi = set(m.lower() for m in doi.values())
    for s in data["sections"].values():
        if s["id"] in doi:
            continue
        ma = (s.get("class_code") or "").strip().lower()
        if ma and ma in moi:
            return doi, giu, f"Mã lớp \"{s.get('class_code')}\" đã tồn tại, không thể đổi mã học phần sang \"{ma_moi}\"."
    return doi, giu, None


def khoa_lop(data, s):
    """Khoa nhan dien MOT LOP de biet gop them co bi trung: ma lop + hoc phan +
    GV chinh + gio. Trung ca 4 thu nay thi gan nhu chac chan la nap lai dung dong
    do (vd nap lai file da sua vai o), khong phai lop that thu hai."""
    hp = data.get("courses", {}).get(s.get("course_id")) or {}
    gv = data["teachers"].get(s["teacher_id"], {})
    return (
        (s.get("class_code") or "").strip().lower(),
        fate_import.khoa_gv(hp.get("name") or s.get("course_name") or ""),
        fate_import.khoa_gv(gv.get("name") or ""),
        s.get("original_slot"),
    )
