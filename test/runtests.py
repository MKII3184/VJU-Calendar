# -*- coding: utf-8 -*-
"""Test Runner tu dong chay tuan tu 96 Test Case (TC-01 -> TC-96) tren backend Flask.
Tu dong backup du lieu manual_state_snapshot.json va khoi phuc sau khi test xong.
"""
import os
import sys
import shutil
import json

webapp_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "webapp"))
if webapp_dir not in sys.path:
    sys.path.insert(0, webapp_dir)

from app import app
from state import STATE, reset_ket_qua
from snapshot import SNAPSHOT_PATH, load_snapshot

MOC_PATH = os.path.join(webapp_dir, "moc_hoan_tac.json")
BAK_SNAPSHOT = SNAPSHOT_PATH + ".bak"
BAK_MOC = MOC_PATH + ".bak"

def backup_data():
    if os.path.exists(SNAPSHOT_PATH):
        shutil.copy2(SNAPSHOT_PATH, BAK_SNAPSHOT)
    if os.path.exists(MOC_PATH):
        shutil.copy2(MOC_PATH, BAK_MOC)
    if os.path.exists(SNAPSHOT_PATH):
        os.remove(SNAPSHOT_PATH)
    if os.path.exists(MOC_PATH):
        os.remove(MOC_PATH)
    STATE["data"] = None
    STATE["extra"] = None
    STATE["co_huu"] = None
    STATE["co_huu_pending"] = None
    STATE["moc_hoan_tac"] = None
    reset_ket_qua()

def restore_data():
    if os.path.exists(BAK_SNAPSHOT):
        shutil.move(BAK_SNAPSHOT, SNAPSHOT_PATH)
    if os.path.exists(BAK_MOC):
        shutil.move(BAK_MOC, MOC_PATH)
    load_snapshot()

def run_tests():
    backup_data()
    client = app.test_client()
    results = []
    
    def log(tc_id, title, passed, detail=""):
        status = "PASS" if passed else "FAIL"
        results.append((tc_id, title, passed, detail))
        print(f"[{status}] {tc_id}: {title} {('- ' + detail) if detail else ''}")

    try:
        # ==========================================
        # A. GỌI API KHI CHƯA CÓ DỮ LIỆU (TC-01 -> TC-07)
        # ==========================================
        r = client.get('/api/state')
        d = r.get_json() or {}
        log("TC-01", "Đọc trạng thái khi chưa có dữ liệu", r.status_code == 200 and d.get("hasData") is False)

        r = client.get('/api/data')
        log("TC-02", "GET /api/data khi chưa init", r.status_code == 400 and "Chưa có dữ liệu" in (r.get_json() or {}).get("error", ""))

        r = client.get('/api/results')
        d = r.get_json() or {}
        log("TC-03", "GET /api/results khi chưa có dữ liệu (200 null)", r.status_code == 200 and d.get("guestResult") is None)

        r = client.post('/api/manual/teacher', json={"name": "X", "teacherType": "GUEST"})
        log("TC-04", "POST /api/manual/teacher khi chưa init", r.status_code == 400 and "Chưa có dữ liệu" in (r.get_json() or {}).get("error", ""))

        r = client.post('/api/solve-guest')
        log("TC-05", "POST /api/solve-guest khi chưa init", r.status_code == 400 and "Chưa có dữ liệu" in (r.get_json() or {}).get("error", ""))

        r = client.post('/api/solve-resident')
        log("TC-06", "POST /api/solve-resident khi chưa init", r.status_code == 400 and "Chưa có dữ liệu" in (r.get_json() or {}).get("error", ""))

        r = client.post('/api/manual/section/0/chot')
        log("TC-07", "POST /api/manual/section/0/chot khi chưa init", r.status_code == 400 and "Chưa có dữ liệu" in (r.get_json() or {}).get("error", ""))

        # ==========================================
        # B. KHỞI TẠO & MỐC HOÀN TÁC BAN ĐẦU (TC-08 -> TC-10)
        # ==========================================
        r = client.post('/api/manual/init')
        d = r.get_json() or {}
        log("TC-08", "Khởi tạo bộ dữ liệu rỗng (/api/manual/init)", r.status_code == 200 and (d.get("numDays") == 7 or d.get("params", {}).get("numDays") == 7))

        r = client.get('/api/state')
        d = r.get_json() or {}
        log("TC-09", "GET /api/state sau init", r.status_code == 200 and d.get("hasData") is True and d.get("overridesCount") == 0)

        r = client.post('/api/manual/hoan-tac')
        log("TC-10", "Hoàn tác khi chưa có mốc", r.status_code == 400 and "Chưa có mốc nào" in (r.get_json() or {}).get("error", ""))

        # ==========================================
        # C. NHẬP TAY GIẢNG VIÊN (TC-11 -> TC-18)
        # ==========================================
        r = client.post('/api/manual/teacher', json={"teacherType": "GUEST"})
        log("TC-11", "Thêm GV thiếu họ tên", r.status_code == 400)

        r = client.post('/api/manual/teacher', json={"name": "X", "teacherType": "VISITING"})
        log("TC-12", "Thêm GV với teacherType sai", r.status_code == 400)

        r = client.post('/api/manual/teacher', json={"name": "X", "teacherType": "GUEST", "availability": [78]})
        log("TC-13", "GV GUEST với availability ngoài phạm vi tuần (slot 78)", r.status_code == 400)

        r = client.post('/api/manual/teacher', json={"name": "Nguyễn Văn A", "org": "FATE", "teacherType": "GUEST", "availability": [0,1,2,13,14,15]})
        log("TC-14", "Thêm GV GUEST hợp lệ (Nguyễn Văn A)", r.status_code == 200)

        r = client.post('/api/manual/teacher', json={"name": "Trần Thị B", "org": "FATE", "teacherType": "RESIDENT"})
        log("TC-15", "Thêm GV RESIDENT không cần availability (Trần Thị B)", r.status_code == 200)

        r = client.patch('/api/manual/teacher/999', json={"org": "X"})
        log("TC-16", "PATCH GV id không tồn tại", r.status_code == 400)

        r = client.patch('/api/manual/teacher/1', json={"name": "   "})
        log("TC-17", "PATCH GV đổi tên thành rỗng", r.status_code == 400)

        r = client.patch('/api/manual/teacher/1', json={"title": "ThS.", "email": "b@example.com"})
        d = r.get_json() or {}
        t1 = next((t for t in d.get("teachers", []) if t.get("id") == 1), {})
        log("TC-18", "PATCH GV partial update", r.status_code == 200 and t1.get("title") == "ThS." and "Trần Thị B" in t1.get("name", ""))

        # ==========================================
        # D. NHẬP TAY HỌC PHẦN (TC-19 -> TC-24)
        # ==========================================
        r = client.post('/api/manual/course', json={"code": "CSE3013", "credits": 3})
        log("TC-19", "Thêm học phần thiếu tên", r.status_code == 400)

        r = client.post('/api/manual/course', json={"name": "X", "credits": "ba"})
        log("TC-20", "Thêm học phần với credits sai kiểu", r.status_code == 400)

        r = client.post('/api/manual/course', json={"code": "CSE3013", "name": "Cấu trúc dữ liệu", "credits": 3})
        log("TC-21", "Thêm học phần CSE3013 hợp lệ", r.status_code == 200)

        r1 = client.post('/api/manual/course', json={"code": "CSE3014", "name": "Cấu trúc dữ liệu (ESAS)", "credits": 3})
        r2 = client.post('/api/manual/course', json={"code": "CSE3015", "name": "Lập trình nâng cao", "credits": 3})
        log("TC-22", "Thêm 2 học phần CSE3014 và CSE3015", r1.status_code == 200 and r2.status_code == 200)

        r = client.patch('/api/manual/course/999', json={"name": "Y"})
        log("TC-23", "PATCH học phần không tồn tại", r.status_code == 400)

        r = client.patch('/api/manual/course/2', json={"name": "Lập trình nâng cao 2"})
        log("TC-24", "PATCH học phần hợp lệ", r.status_code == 200)

        r = client.patch('/api/manual/course/2', json={"credits": 2})
        log("TC-24b", "PATCH đổi tín chỉ bị từ chối", r.status_code == 400)

        # ==========================================
        # E. NHẬP TAY SECTION (LỚP HỌC PHẦN) (TC-25 -> TC-42)
        # ==========================================
        r = client.post('/api/manual/section', json={"courseId": 0, "duration": 3})
        log("TC-25", "Thêm section thiếu giảng viên", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [999], "courseId": 0, "duration": 3})
        log("TC-26", "Thêm section với GV không tồn tại", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [0], "courseId": 999, "duration": 3})
        log("TC-27", "Thêm section với học phần không tồn tại", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [0], "courseId": 0, "duration": 0})
        log("TC-28", "Thêm section với duration = 0", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [0], "courseId": 0, "duration": 3, "day": 2, "periodStart": 3, "periodEnd": 1})
        log("TC-29", "Thêm section với khoảng tiết ngược", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [0], "courseId": 0, "duration": 3, "day": 6, "periodStart": 1, "periodEnd": 3})
        log("TC-30", "Lớp GUEST nhập giờ Chủ nhật bị chặn", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [1], "courseId": 0, "duration": 3, "day": 5, "periodStart": 1, "periodEnd": 3})
        log("TC-31", "Lớp RESIDENT nhập giờ Thứ 7 bị chặn", r.status_code == 400)

        r = client.post('/api/manual/section', json={"teacherIds": [0], "courseId": 0, "duration": 3, "classCode": "CSE3013-1", "program": "FTH", "cohort": "VJU2026", "autoSchedule": True})
        log("TC-32", "Thêm section 0 (CSE3013-1 tự xếp)", r.status_code == 200)

        r = client.post('/api/manual/section', json={"teacherIds": [1], "courseId": 0, "duration": 3, "classCode": "CSE3013-2", "program": "FTH", "cohort": "VJU2026", "day": 2, "periodStart": 1, "periodEnd": 3})
        r_state = client.get('/api/state')
        log("TC-33", "Thêm section 1 (giờ chốt T4 tiết 1-3)", r.status_code == 200 and (r_state.get_json() or {}).get("overridesCount") == 1)

        r = client.post('/api/manual/section', json={"teacherIds": [0], "courseId": 1, "duration": 3, "classCode": "CSE3014-1", "program": "ESAS", "cohort": "VJU2026", "autoSchedule": True})
        log("TC-34", "Thêm section 2 (CSE3014-1 tự xếp)", r.status_code == 200)

        r = client.post('/api/manual/teacher', json={"name": "Phạm Văn C", "org": "FATE", "teacherType": "GUEST", "availability": [0]})
        log("TC-35", "Thêm GV GUEST Phạm Văn C (availability [0])", r.status_code == 200)

        r = client.post('/api/manual/section', json={"teacherIds": [2], "courseId": 2, "duration": 3, "classCode": "CSE3015-1", "program": "FTH", "cohort": "VJU2025", "autoSchedule": True})
        d = client.get('/api/data').get_json() or {}
        has_sec3_pending = any(p.get("sectionId") == 3 for p in d.get("pendingSections", []))
        log("TC-36", "Thêm section 3 (lớp thiếu giờ thật -> pending)", r.status_code == 200 and has_sec3_pending)

        r = client.post('/api/manual/section', json={"teacherIds": [2], "courseId": 2, "duration": 2, "classCode": "CSE3015-2", "program": "FTH", "cohort": "VJU2025", "autoSchedule": True})
        d = client.get('/api/data').get_json() or {}
        has_sec4_pending = any(p.get("sectionId") == 4 for p in d.get("pendingSections", []))
        log("TC-37", "Thêm section 4 (CSE3015-2 thiếu giờ)", r.status_code == 200 and has_sec4_pending)

        r = client.patch('/api/manual/section/2', json={"teacherIds": [0, 2], "courseId": 1, "duration": 3, "classCode": "CSE3014-1", "program": "ESAS", "cohort": "VJU2026", "autoSchedule": True})
        log("TC-38", "PATCH section thêm đồng giảng", r.status_code == 200)

        r = client.patch('/api/manual/section/2', json={"teacherIds": [0], "courseId": 1, "duration": 3, "classCode": "CSE3014-1", "program": "ESAS", "cohort": "VJU2026", "autoSchedule": True})
        log("TC-39", "PATCH section bớt GV (teacherIds=[0])", r.status_code == 200)

        r = client.patch('/api/manual/section/2', json={"teacherIds": [], "courseId": 1, "duration": 3})
        log("TC-40", "PATCH section với teacherIds rỗng", r.status_code == 400)

        r = client.delete('/api/manual/section/999')
        log("TC-41", "Xoá section không tồn tại", r.status_code == 400)

        r = client.get('/api/data')
        d = r.get_json() or {}
        log("TC-42", "Bất biến dữ liệu sau khối nhập tay", r.status_code == 200 and len(d.get("teachers", [])) == 3 and len(d.get("classes", [])) == 5)

        # ==========================================
        # F. GIẢI LỊCH (HAI GIAI ĐOẠN) (TC-43 -> TC-49)
        # ==========================================
        r = client.post('/api/solve-resident')
        log("TC-43", "solve-resident khi chưa chạy Giai đoạn 1", r.status_code == 400)

        r = client.post('/api/solve-guest')
        d = r.get_json() or {}
        log("TC-44", "solve-guest bị chặn khi còn lớp thiếu giờ", r.status_code == 400 and d.get("missingCount") == 2)

        r = client.patch('/api/manual/teacher/2', json={"availability": [0,1,2,3,4,5]})
        d = client.get('/api/data').get_json() or {}
        log("TC-45", "Sửa khung giờ GV2 cho đủ dài (sync pending rỗng)", r.status_code == 200 and len(d.get("pendingSections", [])) == 0)

        r = client.post('/api/solve-guest')
        d = r.get_json() or {}
        log("TC-46", "solve-guest thành công (toàn khoa, 4 lớp)", r.status_code == 200 and d.get("placedCount") == 4)

        r = client.post('/api/solve-resident')
        d = r.get_json() or {}
        log("TC-47", "solve-resident thành công (1 lớp cơ hữu giữ slot 26)", r.status_code == 200 and d.get("placedCount") == 1)

        r = client.get('/api/results')
        d = r.get_json() or {}
        log("TC-48", "GET /api/results sau khi giải xong (đầy đủ 2 GĐ)", r.status_code == 200 and d.get("guestResult") is not None and d.get("residentResult") is not None)

        r = client.get('/api/results')
        d = r.get_json() or {}
        l0 = next((l for l in d.get("guestResult", {}).get("lessons", []) if l.get("id") == 0), {})
        l1 = next((l for l in d.get("residentResult", {}).get("lessons", []) if l.get("id") == 1), {})
        s0 = l0.get("slot")
        s1 = l1.get("slot")
        no_clash = not (s0 is not None and s1 is not None and abs(s0 - s1) < 3 and (s0 // 13 == s1 // 13))
        log("TC-49", "Bất biến nhóm sinh viên (MEM không đè slot)", no_clash)

        # ==========================================
        # G. KÉO-THẢ & GHIM (TC-50 -> TC-59)
        # ==========================================
        r = client.post('/api/move-lesson', json={"sectionId": 0})
        log("TC-50", "move-lesson thiếu slot", r.status_code == 400)

        r = client.post('/api/move-lesson', json={"sectionId": 999, "slot": 0})
        log("TC-51", "move-lesson với sectionId không tồn tại", r.status_code == 400)

        r = client.post('/api/move-lesson', json={"sectionId": 0, "slot": 99999})
        log("TC-52", "move-lesson slot vượt phạm vi tuần", r.status_code == 400)

        r = client.post('/api/move-lesson', json={"sectionId": 0, "slot": 78})
        log("TC-53", "move-lesson lớp GUEST sang Chủ nhật", r.status_code == 400)

        r = client.post('/api/move-lesson', json={"sectionId": 1, "slot": 65})
        log("TC-54", "move-lesson lớp RESIDENT sang Thứ 7", r.status_code == 400)

        r = client.post('/api/move-lesson', json={"sectionId": 0, "slot": 39})
        log("TC-55", "move-lesson thành công vào ô trống (slot 39)", r.status_code == 200)

        r = client.post('/api/move-lesson', json={"sectionId": 2, "slot": 39})
        log("TC-56", "move-lesson trùng GV không ghi lý do (409 conflict)", r.status_code == 409)

        r = client.post('/api/move-lesson', json={"sectionId": 2, "slot": 39, "reason": "GV xin dời, chấp nhận trùng"})
        log("TC-57", "move-lesson trùng GV có lý do (cho qua)", r.status_code == 200)

        r = client.post('/api/clear-override', json={"sectionId": 2})
        log("TC-58", "clear-override bỏ ghim lớp 2", r.status_code == 200)

        r = client.post('/api/solve-guest')
        d = r.get_json() or {}
        l2 = next((l for l in d.get("lessons", []) if l.get("id") == 2), {})
        l0 = next((l for l in d.get("lessons", []) if l.get("id") == 0), {})
        log("TC-59", "solve-guest sau bỏ ghim (lớp 2 dời về khung, lớp 0 giữ 39)", r.status_code == 200 and l2.get("slot") != 39 and l0.get("slot") == 39)

        # ==========================================
        # H. LƯU TKB & HOÀN TÁC (TC-60 -> TC-63)
        # ==========================================
        r = client.post('/api/manual/save-schedule')
        d = r.get_json() or {}
        log("TC-60", "save-schedule đóng băng lưới thành giờ chính thức", r.status_code == 200 and d.get("savedCount") == 5)

        r = client.get('/api/state')
        d = r.get_json() or {}
        log("TC-61", "GET /api/state sau lưu", r.status_code == 200 and d.get("hasData") is True)

        client.post('/api/move-lesson', json={"sectionId": 0, "slot": 26})
        r_undo = client.post('/api/manual/hoan-tac')
        r_res = client.get('/api/results')
        l0 = next((l for l in (r_res.get_json() or {}).get("guestResult", {}).get("lessons", []) if l.get("id") == 0), {})
        log("TC-62", "Sửa tay sau lưu rồi hoàn tác (quay về slot 39)", r_undo.status_code == 200 and l0.get("slot") == 39)

        r = client.post('/api/manual/hoan-tac')
        log("TC-63", "Hoàn tác lần 2 (idempotent giữ nguyên mốc)", r.status_code == 200)

        # ==========================================
        # I. HỌC CHUNG (TC-64 -> TC-75)
        # ==========================================
        r = client.post('/api/manual/hoc-chung', json={"sectionIds": [0]})
        log("TC-64", "Tạo nhóm học chung ít hơn 2 lớp", r.status_code == 400)

        r = client.post('/api/manual/hoc-chung', json={"sectionIds": [0, 999]})
        log("TC-65", "Tạo nhóm với lớp không tồn tại", r.status_code == 400)

        r = client.post('/api/manual/hoc-chung', json={"sectionIds": [0, 1]})
        log("TC-66", "Tạo nhóm khác giai đoạn xếp lịch (GUEST + RESIDENT)", r.status_code == 400)

        r = client.post('/api/manual/hoc-chung', json={"sectionIds": [0, 4]})
        log("TC-67", "Tạo nhóm khác số tiết (3 tiết vs 2 tiết)", r.status_code == 400)

        r = client.post('/api/manual/hoc-chung', json={"sectionIds": [0, 2], "by": "Giáo vụ", "note": "test nhóm"})
        log("TC-68", "Tạo nhóm hợp lệ {0, 2} (đồng bộ về đại diện)", r.status_code == 200)

        r = client.get('/api/manual/hoc-chung')
        d = r.get_json() or {}
        log("TC-69", "GET /api/manual/hoc-chung (danh sách có 1 nhóm)", r.status_code == 200 and len(d.get("groups", [])) == 1)

        r = client.post('/api/manual/hoc-chung', json={"sectionIds": [0, 3]})
        log("TC-70", "Tạo nhóm chồng lên nhóm đã có", r.status_code == 400)

        r = client.patch('/api/manual/section/0', json={"teacherIds": [0], "courseId": 0, "duration": 2, "classCode": "CSE3013-1", "program": "FTH", "cohort": "VJU2026", "day": 3, "periodStart": 1, "periodEnd": 2})
        log("TC-71", "Sửa section phá nhóm (409 hocChungLocked)", r.status_code == 409)

        r = client.post('/api/move-lesson', json={"sectionId": 2, "slot": 13})
        r_res = client.get('/api/results')
        d = r_res.get_json() or {}
        l0 = next((l for l in d.get("guestResult", {}).get("lessons", []) if l.get("id") == 0), {})
        l2 = next((l for l in d.get("guestResult", {}).get("lessons", []) if l.get("id") == 2), {})
        log("TC-72", "Kéo-thả 1 thành viên = kéo cả nhóm (cùng slot 13)", r.status_code == 200 and l0.get("slot") == 13 and l2.get("slot") == 13)

        r = client.post('/api/manual/clear-times', json={"sectionIds": [0]})
        d = r.get_json() or {}
        log("TC-73", "Xoá giờ 1 thành viên = xoá cả nhóm (clearedCount=2)", r.status_code == 200 and d.get("clearedCount") == 2)

        r = client.delete('/api/manual/hoc-chung/0')
        log("TC-74", "Xoá nhóm học chung id=0", r.status_code == 200)

        r = client.delete('/api/manual/hoc-chung/999')
        log("TC-75", "Xoá nhóm không tồn tại", r.status_code == 400)

        # ==========================================
        # J. CHỐT LỊCH THEO LỚP HỌC PHẦN (TC-76 -> TC-85)
        # ==========================================
        r = client.post('/api/manual/section/999/chot')
        log("TC-76", "Chốt lớp học phần không tồn tại", r.status_code == 400)

        r = client.post('/api/manual/section/0/chot', json={"by": "Giáo vụ"})
        log("TC-77", "Chốt lớp học phần còn chưa có giờ (bị chặn 400)", r.status_code == 400)

        r = client.post('/api/solve-guest')
        log("TC-78", "Giải lại GĐ1 để lớp 0 có giờ", r.status_code == 200)

        r = client.post('/api/manual/section/0/chot', json={"by": "Giáo vụ", "note": "đã thống nhất"})
        d = r.get_json() or {}
        log("TC-79", "Chốt lớp học phần thành công", r.status_code == 200 and d.get("classCode") == "CSE3013-1")

        r = client.post('/api/move-lesson', json={"sectionId": 0, "slot": 0})
        log("TC-80", "Kéo-thả lớp đã chốt (409 locked)", r.status_code == 409)

        # TC-81: PATCH section đổi giờ của lớp đã chốt
        d_data = client.get('/api/data').get_json() or {}
        sec0 = next((s for s in d_data.get("classes", []) if s.get("sectionId") == 0), {})
        old_day = sec0.get("day", 1)
        new_day = 2 if old_day != 2 else 3
        r = client.patch('/api/manual/section/0', json={"teacherIds": [0], "courseId": 0, "duration": 3, "classCode": "CSE3013-1", "program": "FTH", "cohort": "VJU2026", "day": new_day, "periodStart": 1, "periodEnd": 3})
        log("TC-81", "PATCH section đổi giờ lớp đã chốt (409 locked)", r.status_code == 409)

        # TC-82: PATCH section GIỮ NGUYÊN giờ, chỉ đổi ghi chú
        d_data = client.get('/api/data').get_json() or {}
        sec0 = next((s for s in d_data.get("classes", []) if s.get("sectionId") == 0), {})
        p_start = sec0.get("periodStart")
        p_end = sec0.get("periodEnd")
        r = client.patch('/api/manual/section/0', json={
            "teacherIds": [0], "courseId": 0, "duration": 3, "classCode": "CSE3013-1", "program": "FTH", "cohort": "VJU2026",
            "day": sec0.get("day"), "periodStart": p_start, "periodEnd": p_end,
            "notes": "ghi chú mới"
        })
        log("TC-82", "PATCH section GIỮ NGUYÊN giờ, đổi ghi chú (cho qua 200)", r.status_code == 200)

        r = client.post('/api/manual/clear-times', json={"sectionIds": [0, 1]})
        d = r.get_json() or {}
        log("TC-83", "clear-times quét trúng lớp đã chốt (skippedChotCount=1)", r.status_code == 200 and d.get("skippedChotCount") == 1)

        r = client.delete('/api/manual/section/0/chot')
        log("TC-84", "Bỏ chốt lớp học phần section 0", r.status_code == 200)

        r = client.delete('/api/manual/section/0/chot')
        log("TC-85", "Bỏ chốt lớp học phần chưa chốt (400)", r.status_code == 400)

        # ==========================================
        # K. BỎ QUA (LỚP ĐƠN VỊ KHÁC ĐIỀU PHỐI) (TC-86 -> TC-91)
        # ==========================================
        r = client.get('/api/manual/bo-qua')
        log("TC-86", "Xem ứng viên bỏ qua (dữ liệu nhập tay = [])", r.status_code == 200)

        r = client.post('/api/manual/bo-qua', json={"sectionIds": "abc", "boQua": True})
        log("TC-87", "Đánh dấu bỏ qua với sectionIds sai kiểu", r.status_code == 400)

        r = client.post('/api/manual/bo-qua', json={"sectionIds": [3], "boQua": True})
        d = r.get_json() or {}
        log("TC-88", "Đánh dấu bỏ qua thủ công lớp 3", r.status_code == 200 and 3 in d.get("boQuaChanged", []))

        r = client.post('/api/move-lesson', json={"sectionId": 3, "slot": 0})
        log("TC-89", "Kéo-thả lớp bị bỏ qua (chặn 409 đơn vị khác)", r.status_code == 409 and not (r.get_json() or {}).get("locked"))

        r = client.post('/api/solve-guest')
        d = r.get_json() or {}
        lessons = d.get("lessons", [])
        l3 = next((l for l in lessons if l.get("id") == 3), None)
        # Lớp 3 không được solver xếp mới (placedCount = 3), nếu có trong lessons thì phải mang nhãn boQua = True
        log("TC-90", "Giải lại GĐ1 (lớp 3 bỏ qua không vào solver, placedCount=3)", r.status_code == 200 and d.get("placedCount") == 3 and (l3 is None or l3.get("boQua") is True))

        r = client.post('/api/manual/bo-qua', json={"sectionIds": [3], "boQua": False})
        log("TC-91", "Bỏ đánh dấu bỏ qua lớp 3", r.status_code == 200)

        # ==========================================
        # L. PHẠM VI XẾP (THEO CTĐT + KHOÁ) (TC-92 -> TC-95)
        # ==========================================
        r_res = client.get('/api/results')
        d_res = r_res.get_json() or {}
        old_slots = {l["id"]: l["slot"] for l in d_res.get("guestResult", {}).get("lessons", []) if l.get("id") in (0, 2)}
        
        r = client.post('/api/solve-guest', json={"phamVi": {"programs": ["FTH"], "cohorts": ["VJU2025"]}})
        d = r.get_json() or {}
        pv = d.get("phamVi") or {}
        new_slots = {l["id"]: l["slot"] for l in d.get("lessons", []) if l.get("id") in (0, 2)}
        log("TC-92", "solve-guest phạm vi FTH/VJU2025 (đóng băng lớp ngoài)", r.status_code == 200 and pv.get("ngoaiPhamViBiDoiGio") == 0 and old_slots == new_slots)

        r = client.post('/api/solve-resident')
        log("TC-93", "solve-resident giữ đúng phạm vi của GĐ1", r.status_code == 200)

        r = client.post('/api/solve-guest', json={"phamVi": {"programs": [], "cohorts": []}})
        d = r.get_json() or {}
        log("TC-94", "phamVi rỗng cả hai vế quay về toàn khoa", r.status_code == 200 and d.get("phamVi") is None)

        r = client.post('/api/solve-guest', json={"phamVi": "FTH"})
        d = r.get_json() or {}
        log("TC-95", "phamVi sai kiểu coi như toàn khoa", r.status_code == 200 and d.get("phamVi") is None)

        # ==========================================
        # M. XOÁ SECTION & DỌN MÃ LỚP (TC-96)
        # ==========================================
        r = client.delete('/api/manual/section/0')
        d_data = client.get('/api/data').get_json() or {}
        classes = d_data.get("classes", [])
        sec1 = next((c for c in classes if c.get("sectionId") == 1), {})
        sec0_exists = any(c.get("sectionId") == 0 for c in classes)
        renumbered = sec1.get("classCode") == "CSE3013-1" or sec1.get("class_code") == "CSE3013-1"
        log("TC-96", "Xoá section 0 (lớp 1 dồn số thành CSE3013-1)", r.status_code == 200 and not sec0_exists and renumbered)

    finally:
        restore_data()
        print("\n" + "="*60)
        pass_count = sum(1 for _, _, p, _ in results if p)
        total = len(results)
        print(f"KẾT QUẢ TỔNG THỂ: {pass_count}/{total} Test Cases PASS ({pass_count/total*100:.1f}%)")
        print("="*60)

if __name__ == "__main__":
    run_tests()
