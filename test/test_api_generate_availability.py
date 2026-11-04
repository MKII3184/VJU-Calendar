# -*- coding: utf-8 -*-
"""Test endpoint POST /api/manual/teacher/<id>/generate-availability - xem
api/manual_teacher.py va PROMPT-THEM-CHUC-NANG-GIO-RANH-GIANG-VIEN.md muc 6.4.

Chay: py -m pytest test/test_api_generate_availability.py -q

KHONG dung file snapshot that: monkeypatch save_snapshot thanh no-op (giong
kiem_tra_nhom_sinh_vien.py) va tu dung STATE truc tiep thay vi nap file.
"""

import copy

import pytest

import api.manual_teacher as manual_teacher_api
from domain.sections import empty_manual_data
from state import STATE


@pytest.fixture(autouse=True)
def _khong_ghi_snapshot(monkeypatch):
    monkeypatch.setattr(manual_teacher_api, "save_snapshot", lambda *args, **kwargs: None)


@pytest.fixture
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture(autouse=True)
def _du_lieu_rong():
    """Moi test bat dau tu mot bo du lieu nhap tay TRONG, doc lap voi cac test
    khac va voi file snapshot that tren may."""
    STATE["data"] = empty_manual_data()
    STATE["data"]["teachers"][1] = {"id": 1, "name": "GV test", "type": "GUEST", "org": "", "title": "", "email": "", "phone": ""}
    STATE["extra"] = None
    STATE["guestResult"] = None
    STATE["residentResult"] = None
    yield
    STATE["data"] = None


def test_khong_tim_thay_giang_vien_tra_400_va_khong_doi_du_lieu(client):
    STATE["data"]["manual_teacher_windows"][1] = [1, 2, 3]
    res = client.post("/api/manual/teacher/999/generate-availability")
    assert res.status_code == 400
    assert "error" in res.get_json()
    # Du lieu GV #1 khong bi dung cham toi.
    assert STATE["data"]["manual_teacher_windows"][1] == [1, 2, 3]


def test_sinh_va_thay_the_toan_bo_gio_ranh_cu(client):
    STATE["data"]["manual_teacher_windows"][1] = [999]  # gio ranh CU vo ly, phai bi xoa het
    res = client.post("/api/manual/teacher/1/generate-availability")
    assert res.status_code == 200
    body = res.get_json()
    teacher = next(t for t in body["teachers"] if t["id"] == 1)
    assert 999 not in teacher["availabilitySlots"]
    assert "generatedSlotCount" in body
    assert body["generatedSlotCount"] == len(teacher["availabilitySlots"])


def test_giu_nguyen_gio_dang_day(client):
    # GV #1 dang day T2 tiet 2-3 (lop DA CHOT GIO: khong time_assumed, co original_slot).
    STATE["data"]["courses"][1] = {"id": 1, "code": "TEST101", "name": "Mon test", "credits": 3}
    STATE["data"]["program_faculty"]["Chung"] = 0
    STATE["data"]["sections"][1] = {
        "id": 1, "course_id": 1, "course_name": "Mon test", "teacher_id": 1, "teacher_ids": [1],
        "teacher_type": "GUEST", "duration": 2, "time_assumed": False,
        "original_slot": 1, "room_type": "LT", "program": "Chung", "program_ids": [],
        "class_code": "", "cohort": "",
    }
    res = client.post("/api/manual/teacher/1/generate-availability")
    assert res.status_code == 200
    body = res.get_json()
    teacher = next(t for t in body["teachers"] if t["id"] == 1)
    assert 1 in teacher["teachingSlots"] and 2 in teacher["teachingSlots"]
    # Khong duoc dam gio ranh moi vao dung gio dang day.
    assert 1 not in teacher["availabilitySlots"]
    assert 2 not in teacher["availabilitySlots"]


def test_loi_giua_chung_khong_lam_mat_gio_ranh_cu(client, monkeypatch):
    STATE["data"]["manual_teacher_windows"][1] = [5, 6, 7]

    def _loi(*a, **k):
        raise RuntimeError("gia lap loi giua thuat toan")

    monkeypatch.setattr(manual_teacher_api, "generate_teacher_availability", _loi)
    with pytest.raises(RuntimeError):
        client.post("/api/manual/teacher/1/generate-availability")
    # Loi truoc khi ghi -> gio ranh cu con nguyen, khong bi xoa nua chung.
    assert STATE["data"]["manual_teacher_windows"][1] == [5, 6, 7]


def _them_du_giang_vien_hang_loat():
    STATE["data"]["teachers"][2] = {
        "id": 2, "name": "GV co huu", "type": "RESIDENT", "org": "", "title": "", "email": "", "phone": "",
    }
    STATE["data"]["teachers"][3] = {
        "id": 3, "name": "Cho trong", "type": "GUEST", "placeholder": True,
        "org": "", "title": "", "email": "", "phone": "",
    }
    STATE["data"]["manual_teacher_windows"].update({1: [12], 2: [], 3: [71]})


def test_hang_loat_xu_ly_ca_hai_loai_bo_qua_placeholder_va_luu_mot_lan(client, monkeypatch):
    _them_du_giang_vien_hang_loat()
    generated_ids = []
    snapshots = []

    def _generate(data, teacher_id):
        generated_ids.append(teacher_id)
        return [teacher_id * 10]

    monkeypatch.setattr(manual_teacher_api, "generate_teacher_availability", _generate)
    monkeypatch.setattr(manual_teacher_api, "save_snapshot", lambda **kwargs: snapshots.append(kwargs))

    res = client.post("/api/manual/teachers/generate-availability")

    assert res.status_code == 200
    assert res.get_json()["generatedTeacherCount"] == 2
    assert generated_ids == [1, 2]
    assert STATE["data"]["manual_teacher_windows"] == {1: [10], 2: [20], 3: [71]}
    assert snapshots == [{"raise_on_error": True}]


def test_hang_loat_giu_gio_dang_day_va_thay_gio_ranh_cu(client):
    _them_du_giang_vien_hang_loat()
    STATE["data"]["courses"][1] = {"id": 1, "code": "TEST101", "name": "Mon test", "credits": 3}
    STATE["data"]["program_faculty"]["Chung"] = 0
    STATE["data"]["sections"][1] = {
        "id": 1, "course_id": 1, "course_name": "Mon test", "teacher_id": 1, "teacher_ids": [1],
        "teacher_type": "GUEST", "duration": 2, "time_assumed": False,
        "original_slot": 1, "room_type": "LT", "program": "Chung", "program_ids": [],
        "class_code": "", "cohort": "",
    }

    res = client.post("/api/manual/teachers/generate-availability")

    assert res.status_code == 200
    teacher = next(t for t in res.get_json()["teachers"] if t["id"] == 1)
    assert 12 not in teacher["availabilitySlots"]
    assert {1, 2}.issubset(teacher["teachingSlots"])
    assert not {1, 2}.intersection(teacher["availabilitySlots"])


def test_hang_loat_loi_o_giang_vien_giua_danh_sach_khong_doi_ai(client, monkeypatch):
    _them_du_giang_vien_hang_loat()
    before = copy.deepcopy(STATE["data"])
    snapshot_calls = []

    def _generate(data, teacher_id):
        if teacher_id == 2:
            raise RuntimeError("loi sinh")
        return [10]

    monkeypatch.setattr(manual_teacher_api, "generate_teacher_availability", _generate)
    monkeypatch.setattr(manual_teacher_api, "save_snapshot", lambda **kwargs: snapshot_calls.append(kwargs))

    with pytest.raises(RuntimeError):
        client.post("/api/manual/teachers/generate-availability")

    assert STATE["data"] == before
    assert snapshot_calls == []


@pytest.mark.parametrize("failing_step", ["teacher_sync", "grid_sync", "save"])
def test_hang_loat_loi_dong_bo_hoac_luu_phuc_hoi_toan_bo_state(client, monkeypatch, failing_step):
    _them_du_giang_vien_hang_loat()
    STATE["guestResult"] = {"lessons": [], "placedCount": 0, "total": 0, "unplaced": []}
    STATE["residentResult"] = {"lessons": [], "placedCount": 0, "total": 0, "unplaced": []}
    before = copy.deepcopy({
        "data": STATE["data"],
        "guestResult": STATE["guestResult"],
        "residentResult": STATE["residentResult"],
    })
    monkeypatch.setattr(
        manual_teacher_api,
        "generate_teacher_availability",
        lambda data, teacher_id: [teacher_id * 10],
    )
    if failing_step == "teacher_sync":
        monkeypatch.setattr(manual_teacher_api, "sync_teacher_sections", lambda *args: (_ for _ in ()).throw(RuntimeError("loi sync")))
    elif failing_step == "grid_sync":
        monkeypatch.setattr(manual_teacher_api, "dong_bo_ket_qua", lambda *args: (_ for _ in ()).throw(RuntimeError("loi grid")))
    else:
        monkeypatch.setattr(manual_teacher_api, "save_snapshot", lambda **kwargs: (_ for _ in ()).throw(OSError("loi save")))

    with pytest.raises((RuntimeError, OSError)):
        client.post("/api/manual/teachers/generate-availability")

    assert STATE["data"] == before["data"]
    assert STATE["guestResult"] == before["guestResult"]
    assert STATE["residentResult"] == before["residentResult"]


def test_hang_loat_khong_co_giang_vien_that_tra_400(client):
    STATE["data"]["teachers"][1]["placeholder"] = True

    res = client.post("/api/manual/teachers/generate-availability")

    assert res.status_code == 400
    assert res.get_json()["error"]


def _lop_dang_day(slot=1, duration=2):
    STATE["data"]["courses"][1] = {"id": 1, "code": "TEST101", "name": "Mon test", "credits": 3}
    STATE["data"]["program_faculty"]["Chung"] = 0
    STATE["data"]["sections"][1] = {
        "id": 1, "course_id": 1, "course_name": "Mon test", "teacher_id": 1, "teacher_ids": [1],
        "teacher_type": "GUEST", "duration": duration, "time_assumed": False,
        "original_slot": slot, "room_type": "LT", "program": "Chung", "program_ids": [],
        "class_code": "", "cohort": "",
    }


def test_patch_gio_ranh_trung_gio_dang_day_bi_tu_choi_va_giu_nguyen_du_lieu(client):
    _lop_dang_day(slot=1, duration=2)
    STATE["data"]["manual_teacher_windows"][1] = [5, 6]
    res = client.patch("/api/manual/teacher/1", json={"name": "Ten moi", "availability": [0, 2, 5]})
    assert res.status_code == 400
    assert "đang dạy" in res.get_json()["error"]
    assert STATE["data"]["manual_teacher_windows"][1] == [5, 6]
    assert STATE["data"]["teachers"][1]["name"] == "GV test"
    assert STATE["data"]["sections"][1]["original_slot"] == 1


def test_patch_gio_ranh_o_trong_van_luu_duoc(client):
    _lop_dang_day(slot=1, duration=2)
    res = client.patch("/api/manual/teacher/1", json={"availability": [0, 3, 4]})
    assert res.status_code == 200
    assert STATE["data"]["manual_teacher_windows"][1] == [0, 3, 4]