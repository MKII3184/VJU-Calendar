# -*- coding: utf-8 -*-
"""SUA TAY TREN LUOI THOI KHOA BIEU: keo-tha, bo ghim, luu thoi khoa bieu."""

from flask import Blueprint, jsonify, request

from api.common import can_du_lieu, loi, tra_du_lieu
from domain.chot import khoa_vi_da_chot
from domain.hoc_chung import thanh_vien
from domain.luoi import attach_ca_hai, attach_override_metadata, dong_bo_ket_qua
from domain.pinning import bo_ghim_ca_nhom, detect_move_conflict
from domain.time_rules import apply_section_time, overlaps
from domain.hoan_tac import dat_moc, hoan_tac
from snapshot import save_snapshot
from state import DAY_LABELS_VN, STATE

import scheduler_core as sc

bp = Blueprint("schedule", __name__)


@bp.post("/api/move-lesson")
@can_du_lieu
def api_move_lesson(data):
    """Giao vu keo 1 buoi hoc sang o gio khac ('sua tay'). KHONG bi chan boi
    trung GV/het phong (dong 2 - cho phep vi pham rang buoc), nhung PHAI ghi ly
    do neu o do dang co van de. Buoi duoc GHIM (dong 1): luu vao STATE['overrides']
    de lan 'Giai lai' ke tiep CP-SAT chi con dung 1 lua chon la giu buoi nay o
    day (xem domain/pinning.py).
    Ngay sau khi luu, PATCH ngay ket qua dang cache (STATE['guestResult'] hoac
    ['residentResult']) de luoi hien vi tri moi TUC THI, khong phai cho giai lai
    moi thay doi tren man hinh.
    Chi Giao vu/DPV duoc goi (dong 3) - canEdit da chan o frontend; backend demo
    dung 1 STATE chung cho ca phien, khong co dang nhap nen khong check lai role."""
    body = request.get_json(force=True)
    try:
        section_id = int(body["sectionId"])
        slot = int(body["slot"])
    except (KeyError, TypeError, ValueError):
        return loi("Thiếu hoặc sai sectionId/slot.")
    reason = (body.get("reason") or "").strip() or None
    s = data["sections"].get(section_id)
    if not s:
        return loi(f"Không tìm thấy buổi #{section_id}.")

    # Lop do DON VI KHAC dieu phoi: van hien tren luoi (gio da chot, sinh vien dang
    # hoc that - xem domain/bo_qua.py) nhung khoa KHONG duoc doi gio cua ho. Chan o
    # day chu khong chi tat `draggable` o frontend: giao vu co the dang mo hai tab.
    #
    # PHAI dung TRUOC phep kiem "da chot lich": gan het lop loai nay deu co gio
    # chot san trong file, nen neu de sau thi nguoi dung nhan duoc loi "bo chot hoc
    # phan truoc khi sua gio" - lam theo xong van bi tu choi, va khong hieu tai sao.
    if not sc.khoa_phai_xep(s):
        return loi("Lớp này do đơn vị khác điều phối — khoa không đổi giờ được. "
                   "Bỏ đánh dấu “Bỏ qua” ở Dữ liệu học phần nếu muốn tự xếp.", 409)

    # Mon da chot lich = da cam ket voi giang vien -> khong keo-tha di cho khac
    # duoc nua. Chan o day chu khong chi an nut o frontend: giao vu co the dang
    # mo hai tab, ban luoi ben kia chua biet mon vua duoc chot.
    khoa = khoa_vi_da_chot(data, section_id)
    if khoa:
        return loi(khoa, 409, locked=True)

    p = data["params"]
    day, period = divmod(slot, p["slotsPerDay"])
    if not (0 <= day < p["numDays"]) or period + s["duration"] > p["slotsPerDay"]:
        return loi("Khung giờ không hợp lệ (vượt ngày hoặc vượt tiết).")
    if day > sc.max_day_index(s["teacher_type"]):
        max_label = DAY_LABELS_VN[sc.max_day_index(s["teacher_type"])]
        nhan = "Thỉnh giảng" if s["teacher_type"] == "GUEST" else "Cơ hữu"
        return loi(f"{nhan} chỉ được dạy tới {max_label}.")

    conflict = detect_move_conflict(data, section_id, slot)
    if conflict and not reason:
        return loi("Ô này đang trùng giờ giảng viên hoặc hết phòng — cần ghi lý do để xác nhận.",
                   409, conflict=conflict)

    # HOC CHUNG: keo mot thanh vien la keo CA NHOM - chung la mot buoi, de lai
    # mot lop o o cu la nhom vo va lan Giai sau bao trung gio tro lai.
    cung_buoi = thanh_vien(data, section_id) or [section_id]
    for sid_khac in cung_buoi:
        STATE["overrides"][sid_khac] = {"slot": slot, "reason": reason, "problem": conflict}
        # Ghim tay de len tren moi thu -> khong con la lop "de he thong xep lai".
        STATE["bo_ghim"].discard(sid_khac)

    kind = s["teacher_type"]
    result = STATE["guestResult"] if kind == "GUEST" else STATE["residentResult"]
    if result is not None:
        by_id = {l["id"]: l for l in result["lessons"]}
        for sid_khac in cung_buoi:
            if sid_khac in by_id and sid_khac != section_id:
                l = by_id[sid_khac]
                l["day"], l["period"], l["slot"] = day, period, slot
        if section_id in by_id:
            l = by_id[section_id]
            l["day"], l["period"], l["slot"] = day, period, slot
        else:
            # Truoc do khong xep duoc (nam trong 'unplaced') - giao vu tu tay dat
            # vao 1 cho, chuyen sang lessons de hien tren luoi ngay.
            unplaced = result.get("unplaced") or []
            u = next((x for x in unplaced if x["id"] == section_id), None)
            if u is not None:
                result["unplaced"] = [x for x in unplaced if x["id"] != section_id]
                result["lessons"].append({
                    "id": section_id, "teacherId": s["teacher_id"], "teacherName": u["teacherName"],
                    "courseName": u.get("courseName"), "program": s["program"],
                    "programLabel": u.get("programLabel"), "coordinator": u.get("coordinator"),
                    "roomType": s["room_type"], "day": day, "period": period, "slot": slot,
                    "duration": s["duration"], "teacherType": kind,
                })
                result["placedCount"] = result.get("placedCount", 0) + 1
        attach_override_metadata(data, result, kind)

    return jsonify({
        "sectionId": section_id, "slot": slot, "day": day, "period": period,
        "reason": reason, "problem": conflict,
        "guestResult": STATE["guestResult"], "residentResult": STATE["residentResult"],
    })


@bp.post("/api/clear-override")
@can_du_lieu
def api_clear_override(data):
    """Bo ghim 1 buoi. Chi anh huong lan 'Giai lai' KE TIEP (CP-SAT duoc tu do
    chon lai cho buoi do) - khong tu lui vi tri dang hien tren luoi, giong cach
    ban ghim cung chi thuc su co hieu luc tu lan giai ke tiep. Van tra ve
    guestResult/residentResult da cap nhat (giong /api/move-lesson) de frontend
    go ngay 'nhan ghim' tren the, du vi tri chua doi."""
    body = request.get_json(force=True)
    section_id = int(body["sectionId"])
    khoa = khoa_vi_da_chot(data, section_id)
    if khoa:
        return loi(khoa, 409, locked=True)
    STATE["overrides"].pop(section_id, None)
    # Xoa khoi overrides thoi la CHUA DU voi lop co gio chot trong file: solver van
    # ghim theo original_slot/submissions nen lan giai sau lop nam nguyen cho cu.
    # Ghi vao STATE['bo_ghim'] de ca hai duong ghim cung tha lop nay ra.
    if section_id in data["sections"]:
        STATE["bo_ghim"].add(section_id)
    # HOC CHUNG: tha mot nua thi lan Giai sau mot lop bi ghim cho cu, mot lop tu do
    # chon - hai lop "cung mot buoi" khong con o cung o gio.
    cung_nhom = bo_ghim_ca_nhom(data, section_id)

    attach_ca_hai(data)
    return jsonify({
        "sectionId": section_id, "cleared": True, "hocChungAlso": cung_nhom,
        "guestResult": STATE["guestResult"], "residentResult": STATE["residentResult"],
    })


@bp.post("/api/manual/save-schedule")
@can_du_lieu
def api_save_schedule(data):
    """'Lưu thời khoá biểu': đóng băng kết quả đang xem trên lưới (ghim tay >
    Giai đoạn 2 > Giai đoạn 1, đúng thứ tự ưu tiên detect_move_conflict/
    attach_override_metadata dùng) THÀNH dữ liệu chính thức của lớp học phần -
    ghi lại qua apply_section_time() (hàm nhập tay/import đang dùng, không tự
    viết lại), để cột Thứ/Tiết BĐ/Tiết KT ở màn 'Dữ liệu học phần' khớp với
    lưới. Không xoá guestResult/residentResult/overrides - chỉ sao chép giá trị
    sang sections, màn Thời khoá biểu hiển thị như cũ sau khi lưu."""
    if STATE["guestResult"] is None and STATE["residentResult"] is None:
        return loi("Chưa có kết quả xếp để lưu.")

    slots_per_day = data["params"]["slotsPerDay"]

    lessons_by_id = {}
    for res in (STATE["guestResult"], STATE["residentResult"]):
        if res:
            for l in res["lessons"]:
                lessons_by_id[l["id"]] = l

    saved_count = 0
    for sid, s in data["sections"].items():
        ov = STATE["overrides"].get(sid)
        slot = ov["slot"] if ov else None
        if slot is None:
            lesson = lessons_by_id.get(sid)
            if lesson is not None:
                slot = lesson["slot"]
        if slot is None:
            continue  # buoi chua tung duoc xep/ghim - giu nguyen, khong dung vao

        day, period0 = divmod(slot, slots_per_day)
        teacher = data["teachers"][s["teacher_id"]]
        was_auto = bool(s.get("time_assumed") or s.get("time_source") == "auto")
        apply_section_time(data, sid, teacher, s["duration"], {
            "day": day, "period_start": period0 + 1,
            "period_end": period0 + s["duration"],
        })
        if was_auto:
            s["time_source"] = "auto"
        saved_count += 1

    # Trang thai lich cho TOAN BO lop (khong chi cac lop vua luu) - quet trung
    # gio GV tren vi tri THUC vua ghi, dung lai cong thuc overlaps() o time_rules.
    by_teacher = {}
    for s in data["sections"].values():
        if s.get("day") is not None:
            by_teacher.setdefault(s["teacher_id"], []).append(s)

    problem_ids = set()
    for group in by_teacher.values():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                # HOC CHUNG: hai lop cung nhom la MOT buoi, cung gio la DUNG Y -
                # khong phai trung gio.
                if sc.cung_nhom_hoc_chung(data, a["id"], b["id"]):
                    continue
                slot_a = a["day"] * slots_per_day + (a["period_start"] - 1)
                slot_b = b["day"] * slots_per_day + (b["period_start"] - 1)
                if overlaps(slot_a, a["duration"], slot_b, b["duration"]):
                    problem_ids.add(a["id"])
                    problem_ids.add(b["id"])

    problem_count = missing_count = 0
    for s in data["sections"].values():
        if s["id"] in problem_ids:
            s["schedule_status"] = "problem"
            problem_count += 1
        elif s.get("day") is None:
            s["schedule_status"] = "missing"
            missing_count += 1
        else:
            s["schedule_status"] = "scheduled"

    # Gio vua duoc ghi thanh gio CHINH THUC cua lop - dong bo lai luoi de nhan/
    # ten/giai doan cua tung buoi khop voi ban vua luu (vi tri khong doi: chinh
    # vi tri dang hien vua duoc sao sang sections).
    dong_bo_ket_qua(data)
    save_snapshot()
    # Moi lan luu la mot "ban da chot" - ghi moc de nut "Huy thay doi" quay ve
    # duoc dung day (xem domain/hoan_tac.py: dat_moc).
    dat_moc("lần lưu thời khoá biểu")
    return tra_du_lieu(data, savedCount=saved_count, problemCount=problem_count,
                       missingCount=missing_count)


@bp.post("/api/manual/hoan-tac")
@can_du_lieu
def api_hoan_tac(data):
    """"Huy thay doi": tra toan bo ve dung trang thai cua lan LUU gan nhat (hoac
    luc vua nap file, neu chua luu lan nao).

    Khac han "Bo ghim" (mot buoi) va nut "Huy" o banner keo-tha (mot buoi CHUA
    luu): cai nay quay lai CA MAN - gio cua moi lop, ghim, trang thai chot, nhom
    hoc chung va ca luoi dang hien."""
    tt, err = hoan_tac()
    if err:
        return loi(err)
    return tra_du_lieu(STATE["data"], hoanTacVe=tt)
