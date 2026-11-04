# -*- coding: utf-8 -*-
"""DUNG JSON TRA VE cho frontend - tang hien thi, khong chua quyet dinh nghiep vu.

build_data_response() la khuon DUY NHAT ma moi endpoint tra du lieu deu dung, nen
them mot truong o day la tat ca cac man hinh doc duoc ngay. Doi lai: khong duoc
SUA `data` o trong module nay (chi doc + tinh de hien thi) - vai cho phai tinh
lai gio hien tai tu overrides thi ghi ro "chi hien thi, khong ghi lai vao s".
"""

import scheduler_core as sc
from domain import bo_qua
from domain.chot import khoa_vi_da_chot
from domain.hoc_chung import nhom_cua
from domain.programs import KHOA_SPLIT_RE, tach_phan
from domain.teachers import co_huu_theo_danh_sach, teaching_slots_by_teacher
from state import DAY_LABELS_VN, STATE


def _section_status(data, s):
    """Trang thai 1 lop cho man hinh 'Du lieu hoc phan' - CHI ap dung y nghia cho
    lop nhap qua UI moi (co course_id); lop tu Excel khong co field nay se
    ra 'ready_fixed'/'ready_auto' tuy time_assumed, khong anh huong gi khac."""
    if s.get("time_assumed"):
        if s["teacher_type"] == "GUEST" and s["id"] in data["pending_section_ids"]:
            return "missing_time"
        return "ready_auto"
    if s.get("time_source") == "auto":
        return "ready_auto"
    return "ready_fixed"


def build_classes_list(data):
    """Bang phang 'moi lop 1 dong' mirror 29 cot Excel, dung cho man hinh nhap
    lieu thay Excel - CHI cong THEM vao response, khong doi gi cau truc
    submissions/pendingSections hien co (2 man hinh 'Khung gio da bao'/check-trung
    khong bi anh huong)."""
    # {sid: [cac sid cung buoi]} - tinh MOT LAN cho ca bang, khong tra cuu lai
    # trong tung dong (343 lop x quet het nhom la cham vo ich).
    cung_buoi = {}
    for ds in sc.cac_nhom_hoc_chung(data):
        for sid0 in ds:
            cung_buoi[sid0] = ds

    solver_slots = {}
    for result in (STATE.get("guestResult"), STATE.get("residentResult")):
        for lesson in (result or {}).get("lessons") or []:
            solver_slots[lesson["id"]] = lesson["slot"]

    out = []
    for sid, s in data["sections"].items():
        course = data.get("courses", {}).get(s.get("course_id")) or {}
        teacher = data["teachers"].get(s["teacher_id"], {})
        # MOI giang vien cua lop, VAI TRO NGANG NHAU (khong co "GV chinh" -
        # teacher_ids[0] chi la nguoi dau danh sach). Bang mirror hien tung nguoi
        # MOT DONG trong o giang vien, dung nhu file Excel goc, de doc duoc email/
        # SDT cua TUNG nguoi va bam vao tung nguoi de khai gio.
        tids = [t for t in (s.get("teacher_ids") or [s["teacher_id"]]) if t in data["teachers"]]

        # Lop DA CHOT GIO nhung gio do nam NGOAI khung ranh nguoi ta vua khai.
        # Thu tu uu tien da chot: gio chot trong file KHONG bi doi, nen he thong
        # giu nguyen - nhung phai noi ra, khong thi giao vu khai gio xong thay lop
        # van nam cho khac va khong hieu vi sao.
        def _ngoai_khung(tid):
            khung = set(data.get("manual_teacher_windows", {}).get(tid) or [])
            if not khung or s.get("time_assumed") or s.get("original_slot") is None:
                return False
            return any(s["original_slot"] + k not in khung for k in range(s["duration"]))

        gv_cua_lop = [
            {
                "id": t, "name": data["teachers"][t].get("name"),
                # Gio da chot cua lop nay khong nam trong khung nguoi do da khai.
                "outsideDeclared": _ngoai_khung(t),
                "title": data["teachers"][t].get("title") or "",
                "org": data["teachers"][t].get("org") or "",
                "email": data["teachers"][t].get("email") or "",
                "phone": data["teachers"][t].get("phone") or "",
                "type": data["teachers"][t].get("type"),
                "isPlaceholder": bool(data["teachers"][t].get("placeholder")),
                "availabilitySlots": len(
                    data.get("manual_teacher_windows", {}).get(t) or []),
            }
            for t in tids
        ]

        # Lop tu Excel khong co day/period_start/period_end (chi co original_slot)
        # - suy ra tu original_slot de bang van hien duoc gio thay vi de trong,
        # KHONG ghi lai vao s (chi hien thi).
        day, p_start = s.get("day"), s.get("period_start")
        p_end = s.get("period_end")
        if day is None and not s.get("time_assumed") and s.get("original_slot") is not None:
            slots_per_day = data["params"]["slotsPerDay"]
            day, period0 = divmod(s["original_slot"], slots_per_day)
            p_start = period0 + 1
            p_end = p_start + s["duration"] - 1

        # Giao vu keo-tha sua tay tren man TKB -> STATE['overrides'] giu gio moi,
        # nhung s['day']/['period_start'] KHONG doi (dung y do: override la mot
        # lop phu, "Bỏ ghim" phai tra ve duoc gio cu). Neu khong doc lop phu do o
        # day thi cac man khac (bang 29 cot, cot "Thời gian" o Giờ rảnh GV) van
        # in gio CU, trong khi luoi TKB in gio MOI - cung mot lop, hai man noi hai
        # gio khac nhau. Chi hien thi, khong ghi lai vao s.
        ov = STATE["overrides"].get(sid)
        if ov and ov.get("slot") is not None:
            slots_per_day = data["params"]["slotsPerDay"]
            day, period0 = divmod(ov["slot"], slots_per_day)
            p_start = period0 + 1
            p_end = p_start + s["duration"] - 1

        time_assumed = bool(s.get("time_assumed")) and not ov
        time_preview = False
        if time_assumed and day is None and sid in solver_slots:
            slots_per_day = data["params"]["slotsPerDay"]
            day, period0 = divmod(solver_slots[sid], slots_per_day)
            p_start = period0 + 1
            p_end = p_start + s["duration"] - 1
            time_preview = True
        time_label = f"{DAY_LABELS_VN[day]}, tiết {p_start}-{p_end}" if day is not None else None
        time_source = s.get("time_source") or ("auto" if s.get("time_assumed") else "fixed")

        out.append({
            "sectionId": sid,
            # CHOT LICH theo LOP HOC PHAN: moi dong mang trang thai doc lap.
            "sectionChot": s.get("chot") and {
                k: v for k, v in s["chot"].items() if k != "truoc"},
            "courseId": s.get("course_id"), "courseCode": course.get("code"),
            "courseName": course.get("name") or s.get("course_name"), "credits": course.get("credits"),
            "classCode": s.get("class_code"), "ltCredits": s.get("lt_credits"), "thCredits": s.get("th_credits"),
            # Lop do DON VI KHAC dieu phoi, giao vu da bam bo qua: van gui ra
            # (du lieu that, con phai xuat lai va bo danh dau duoc) nhung co nay
            # cho bang biet de an di va cho solver biet de khong xep.
            # Xem domain/bo_qua.py.
            "boQua": bool(s.get("bo_qua")),
            "donViDieuPhoi": bo_qua.la_don_vi_dieu_phoi(data, s),
            "cohort": s.get("cohort"), "program": s["program"],
            # Hien thi NGUYEN VAN nhu file ("BCSE+MJM"); ben trong lop thuoc CA HAI
            # chuong trinh (programIds) - xem programs.program_ids_cua_lop.
            "programName": (s.get("program_raw")
                            or data.get("program_names_reverse", {}).get(s["program"])),
            "programLabel": sc.section_program_label(data, s),
            "programIds": sc.section_program_ids(s),
            "facultyName": sc.section_faculty_name(data, s),
            "coordinators": sc.section_coordinators(data, s),
            # O ghi GHEP ("BCSE+MJM", "VJU2023+VJU2024") = lop cua CA HAI - tach
            # san de bo loc tinh dung. CTDT lay thang ten cua tung program_id (da
            # tach luc tao lop), khoa thi tach tai day - xem programs.tach_phan().
            "programParts": sc.section_program_names(data, s),
            "cohortParts": tach_phan(s.get("cohort"), KHOA_SPLIT_RE),
            "expectedStudents": s.get("expected_students"),
            "day": day, "periodStart": p_start, "periodEnd": p_end,
            "timeAssumed": time_assumed, "timeLabel": time_label,
            "timeSource": time_source, "timePreview": time_preview,
            # Gio dang hien la do giao vu keo-tha dat, khong phai gio goc trong
            # du lieu - de man hinh noi ro thay vi im lang doi mot con so.
            "timeFromOverride": bool(ov and ov.get("slot") is not None),
            # DANH SACH giang vien cua lop - nguon duy nhat cho bang mirror va form
            # sua lop. Cac truong teacher* so it ben duoi la NGUOI DAU danh sach,
            # giu lai cho cac man chi can 1 ten (luoi TKB, tra cuu theo GV).
            "teachers": gv_cua_lop,
            "teacherIds": tids,
            "teacherId": s["teacher_id"], "teacherName": sc.teacher_display(data, s["teacher_id"]),
            "teacherNameRaw": teacher.get("name"),  # khong co hau to "(GV#n)" - dung cho bang mirror Excel
            "teacherType": s["teacher_type"], "teacherOrg": teacher.get("org"), "teacherTitle": teacher.get("title"),
            "teacherEmail": teacher.get("email"), "teacherPhone": teacher.get("phone"),
            "prevTeacherName": s.get("prev_teacher_name"), "prevTeacherOrg": s.get("prev_teacher_org"),
            "teachingHoursLt": s.get("teaching_hours_lt"), "teachingHoursTh": s.get("teaching_hours_th"),
            "location": s.get("location"), "teachingMode": s.get("teaching_mode"),
            "language": s.get("language"), "otherRequirements": s.get("other_requirements"),
            "notes": s.get("notes"), "coordinatorOverride": s.get("coordinator_override"),
            "roomType": s["room_type"], "duration": s["duration"],
            # True = so tiet moi buoi la HE THONG SUY RA, chua ai xac nhan. Bang
            # "Du lieu hoc phan" danh dau de giao vu biet cho nao can kiem lai.
            "durationAssumed": bool(s.get("duration_assumed")),
            # HOC CHUNG: lop nay la MOT buoi cung voi cac lop nao (xem
            # domain/hoc_chung.py). None = khong hoc chung. Frontend dung de bo
            # qua bao "trung giang vien" va de gop the tren luoi.
            "hocChungId": (nhom_cua(data, sid) or {}).get("id"),
            "hocChungWith": [x for x in cung_buoi.get(sid, []) if x != sid],
            # Lop nay CHUA chot, nhung HOC CHUNG voi mot lop da chot -> gio bi
            # khoa (xem chot.khoa_vi_da_chot). Gui ly do ra de giao dien noi ro.
            "hocChungLockedBy": (khoa_vi_da_chot(data, sid)
                                 if (cung_buoi.get(sid) and not s.get("chot"))
                                 else None),
            "status": _section_status(data, s),
            # Trang thai lich sau khi "Luu thoi khoa bieu" - None khi chua bam
            # luu lan nao (khac "status" o tren, von chi noi ve gio gia dinh/co
            # dinh, khong noi ve co trung gio hay khong).
            "scheduleStatus": s.get("schedule_status"),
        })
    out.sort(key=lambda x: x["sectionId"])
    return out


def _thong_tin_moc():
    """Mo ta moc hoan tac. Import TRONG HAM co chu y: domain/hoan_tac.py import
    snapshot.py, ma snapshot import domain/pinning.py - import o dau file se thanh
    vong tron (response -> hoan_tac -> snapshot -> luoi -> ...)."""
    from domain.hoan_tac import thong_tin_moc
    return thong_tin_moc()


def build_data_response(data, extra=None):
    """Khuon `data` DUY NHAT tra ve frontend - dung chung cho moi endpoint doc/ghi
    du lieu, nen them mot truong o day la moi man hinh doc duoc ngay."""
    params = data["params"]

    multi_program_count = sum(1 for t in data["teachers"].values() if "second_program" in t)

    manual_windows = data.get("manual_teacher_windows", {})

    # Cac o gio moi GV DANG THUC SU DAY, suy tu cac lop DA CHOT GIO. Khac han
    # "availabilitySlots" (gio GV/giao vu KHAI):
    #   - dang day  = BANG CHUNG nguoi do day duoc luc do (lop da chot gio, GV va
    #     dieu phoi vien da thong nhat) -> phai hien ra o luoi "Gio co the day",
    #     neu khong thi nap file xong luoi trong tron, nhin nhu chua biet gi.
    #   - da khai   = GIOI HAN CUNG khi xep cac lop CHUA co gio (xem
    #     time_rules.apply_section_time). Nhap gio dang day vao day thi cac lop
    #     chua co gio cua ho chi con duoc xep dung vao nhung o DA BI CHIEM ->
    #     khong xep duoc.
    # Nen hai thu di RIENG, luoi hien hai mau khac nhau.
    dang_day = teaching_slots_by_teacher(data)

    teachers = [
        {
            "id": t["id"], "name": sc.teacher_display(data, t["id"]), "type": t["type"],
            "org": t.get("org"),
            # nameRaw/title/email/phone: dung de PREFILL form sua GV (TeacherEditDrawer) -
            # khac "name" o tren (da gan them hau to "(GV#n)" de phan biet tren cac man khac).
            "nameRaw": t.get("name"), "title": t.get("title"), "email": t.get("email"), "phone": t.get("phone"),
            "availabilitySlots": sorted(manual_windows.get(t["id"], [])),
            "availabilityWindows": [sc.slot_label(s, params["slotsPerDay"]) for s in sorted(manual_windows.get(t["id"], []))],
            # O gio nguoi nay DANG DAY theo cac lop da chot gio (xem dang_day o
            # tren) - de hien tren luoi "Gio co the day" nhu bang chung, khong
            # phai gio da khai.
            "teachingSlots": sorted(dang_day.get(t["id"], [])),
            # True = cho trong cho lop CHUA phan cong giang vien (nap tu Excel),
            # khong phai mot con nguoi. Cac man danh cho GV that loc bang co nay.
            "isPlaceholder": bool(t.get("placeholder")),
            # None = chua nap danh sach co huu (dang doan theo o "Don vi cong
            # tac"); True/False = co/khong co ten trong danh sach chinh thuc.
            "inLecturerList": (None if t.get("placeholder")
                               else co_huu_theo_danh_sach(t.get("name"))),
        }
        for t in sorted(data["teachers"].values(), key=lambda t: t["id"])
    ]

    submissions = []
    for sid, windows in data["submissions"].items():
        s = data["sections"][sid]
        submissions.append({
            "sectionId": sid,
            "teacherId": s["teacher_id"],
            # TAT CA GV cua lop (dong giang day) - cac man kiem trung phai gom theo
            # tung nguoi, khong chi GV chinh (xem problemInbox.scanTeacherClashes,
            # unplacedAnalysis). Thieu field nay thi nguoi thu 2 tro di vo hinh.
            "teacherIds": list(s.get("teacher_ids") or [s["teacher_id"]]),
            "teacherName": sc.teacher_display(data, s["teacher_id"]),
            # teacherType + duration: man hinh "Khung gio da bao" phai phan biet
            # lop THINH GIANG (dieu phoi vien nop gio) voi lop CO HUU (Giai doan 2
            # tu chon gio, khong ai nop gio ho) - truoc day tron ca 2 vao 1 bang
            # nen dem "da nop" bi sai. duration de biet 1 window keo dai may tiet.
            "teacherType": s["teacher_type"],
            "duration": s["duration"],
            # Lop do don vi khac dieu phoi da bam bo qua - man "Khung gio da bao"
            # va phep dem "con N lop chua san sang" phai bo qua no, khong thi bam
            # "Bo qua" xong nut Giai VAN bi khoa boi chinh 55 lop vua bo.
            "boQua": bool(s.get("bo_qua")),
            "courseName": s.get("course_name"),
            "program": s["program"],
            "programLabel": sc.section_program_label(data, s),
            "programParts": sc.section_program_names(data, s),
            # Khoa (cot "Khóa") tach san nhu programParts - de man hinh dem duoc
            # "con bao nhieu lop cua FTH khoa 2026 chua khai gio" khi XEP THEO
            # PHAM VI (xem frontend/src/adapters/phamVi.js). Khong co truong nay
            # thi bo dem chi loc duoc theo CTDT, con Khoa thi chiu.
            "cohortParts": tach_phan(s.get("cohort"), KHOA_SPLIT_RE),
            "coordinator": ", ".join(sc.section_coordinators(data, s)),
            "coordinators": sc.section_coordinators(data, s),
            "facultyId": data["program_faculty"][s["program"]],
            "facultyName": data["faculty_names"][data["program_faculty"][s["program"]]],
            "roomType": s["room_type"],
            "windowSlots": windows,
            "windowLabels": [sc.slot_label(w, params["slotsPerDay"]) for w in windows],
            "isSingleFixedWindow": len(windows) == 1,
            # CHUA ai khai gio ranh, he thong dang tam coi la ranh ca tuan (xem
            # time_rules.apply_section_time). Phai gui co nay chu khong de frontend
            # TU DOAN bang cach dem so khung: nguong cu (>=90% so o cua ca tuan)
            # tinh weekTotal theo 7 ngay, con khung "ca tuan" cua thinh giang chi
            # co 6 ngay (khong ai day Chu nhat) -> 72/84 = 86% < 90% -> bi xep nham
            # la "Da chot gio", tuc man hinh noi nguoc han su thuc.
            "availabilityAssumed": bool(s.get("availability_assumed")),
        })
    submissions.sort(key=lambda x: (x["teacherId"], x["sectionId"]))

    cross_conflicts = sc.check_cross_program_conflicts(data)

    # Bo sung duration RIENG cua tung lop vao ket qua check-trung. Man hinh
    # Check-trung moi ve dai khung gio tren luoi tuan nen phai biet 1 window keo
    # dai bao nhieu tiet - du lieu that co duration khac nhau tung lop
    # (p_end - p_start + 1), khong dung chung params["duration"] duoc.
    for c in cross_conflicts:
        for s in c["sections"]:
            s["duration"] = data["sections"][s["sectionId"]]["duration"]

    pending_sections = []
    for sid in data["pending_section_ids"]:
        s = data["sections"][sid]
        pending_sections.append({
            "sectionId": sid,
            "teacherId": s["teacher_id"],
            # TAT CA GV cua lop (dong giang day) - cac man kiem trung phai gom theo
            # tung nguoi, khong chi GV chinh (xem problemInbox.scanTeacherClashes,
            # unplacedAnalysis). Thieu field nay thi nguoi thu 2 tro di vo hinh.
            "teacherIds": list(s.get("teacher_ids") or [s["teacher_id"]]),
            "teacherName": sc.teacher_display(data, s["teacher_id"]),
            "courseName": s.get("course_name"),
            "program": s["program"],
            "programLabel": sc.section_program_label(data, s),
            "programParts": sc.section_program_names(data, s),
            "coordinator": ", ".join(sc.section_coordinators(data, s)),
            "coordinators": sc.section_coordinators(data, s),
            "roomType": s["room_type"],
        })
    pending_sections.sort(key=lambda x: (x["program"], x["teacherId"]))

    faculty_stats = []
    for f_id, f_name in enumerate(data["faculty_names"]):
        progs = [p for p, fid in data["program_faculty"].items() if fid == f_id]
        # Lop thuoc nhieu CTDT ("BCSE+MJM") duoc tinh cho MOI chuong trinh no
        # thuoc - dung y nghia "lop cua ca hai".
        secs = [s for s in data["sections"].values()
                if any(pid in progs for pid in sc.section_program_ids(s))]
        faculty_stats.append({
            "facultyId": f_id, "facultyName": f_name,
            "numPrograms": len(progs),
            "numSections": len(secs),
            "numGuestSections": sum(1 for s in secs if s["teacher_type"] == "GUEST"),
            "numResidentSections": sum(1 for s in secs if s["teacher_type"] == "RESIDENT"),
        })

    return {
        "numPrograms": data["num_programs"],
        "numTeachers": len(data["teachers"]),
        "teachers": teachers,
        "submissions": submissions,
        "pendingSections": pending_sections,
        "crossProgramConflicts": cross_conflicts,
        "facultyStats": faculty_stats,
        "facultyNames": data["faculty_names"],
        "numResident": data["num_resident"],
        "numGuest": data["num_guest"],
        "numSections": len(data["sections"]),
        "numGuestSections": sum(1 for s in data["sections"].values() if s["teacher_type"] == "GUEST"),
        "numResidentSections": sum(1 for s in data["sections"].values() if s["teacher_type"] == "RESIDENT"),
        "multiProgramGuestTeachers": multi_program_count,
        "ltPool": params["ltPool"],
        "labPool": params["labPool"],
        "numDays": params["numDays"],
        "slotsPerDay": params["slotsPerDay"],
        "duration": params["duration"],
        # THU TU CO SO tu XA den GAN (scheduler_core.THU_TU_KHU_VUC) - muc 4 cua
        # ham muc tieu gom chuyen di theo dung thu tu nay. Gui ra de hop thu van
        # de biet co so nao dang ngat som hon, thay vi chep lai mot ban thu hai
        # ben JS roi hai noi lech nhau sau lan sua ke tiep.
        "thuTuKhuVuc": list(sc.THU_TU_KHU_VUC),
        # KHOI CA HOC cua tung co so (scheduler_core.KHOI_CA_HOC), dang [[tiet dau,
        # tiet cuoi], ...]. Hop thu van de doc de biet MOT NGAY chua duoc toi da bao
        # nhieu tiet, tu do tinh "so ngay it nhat phai len co so nay" - khong co no
        # thi hop thu bao "di lai nhieu" cho ca nhung nguoi khong the gom hon duoc.
        "khoiCaHoc": {kv: [list(k) for k in khoi]
                      for kv, khoi in sc.KHOI_CA_HOC.items()},
        "isRealData": bool(extra and extra.get("isRealData")),
        "sourceLabel": (extra or {}).get("sourceLabel"),
        "numTimeAssumed": (extra or {}).get("numTimeAssumed", 0),
        # So lop dang xep bang gia dinh "GV chua khai gio ranh nen coi nhu ranh ca
        # tuan" - de man hinh noi ro day KHONG phai gio GV da xac nhan.
        "numAvailabilityAssumed": data.get("num_availability_assumed", 0),
        # So lop dang chay bang SO TIET MOI BUOI DO HE THONG SUY RA (file khong ghi
        # gio nen khong doc duoc) - xem domain/excel_rows.doan_so_tiet().
        "numDurationAssumed": sum(1 for s in data["sections"].values()
                                  if s.get("duration_assumed")),
        # Ten file Excel da nap (neu du lieu den tu /api/manual/import/commit).
        # sourceLabel van phai la "Nhap lieu thu cong" de form cho sua, nen nguon
        # goc phai di rieng o day - khong thi giao vu khong con biet dang lam
        # tren file nao.
        "importedFrom": (extra or {}).get("importedFrom"),
        # Moc de nut "Huy thay doi" biet no se tra ve dau (None = chua co moc).
        "hoanTac": _thong_tin_moc(),
        "courses": sorted(data.get("courses", {}).values(), key=lambda c: c["id"]),
        # Cac nhom HOC CHUNG dang co - frontend can ca danh sach de ve the gop va
        # de biet cap nao khong phai "trung giang vien".
        "hocChungGroups": [n for n in (data.get("hoc_chung") or [])
                           if len([x for x in (n.get("sectionIds") or [])
                                   if x in data["sections"]]) > 1],
        "classes": build_classes_list(data),
    }
