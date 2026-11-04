# -*- coding: utf-8 -*-

import pytest

import api.manual_section as manual_section_api
import api.manual_teacher as manual_teacher_api
from app import app
from domain.sections import empty_manual_data
from state import STATE


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch):
    monkeypatch.setattr(manual_section_api, "save_snapshot", lambda *args, **kwargs: None)
    monkeypatch.setattr(manual_teacher_api, "save_snapshot", lambda *args, **kwargs: None)
    data = empty_manual_data()
    data["teachers"][1] = {
        "id": 1, "name": "GV test", "type": "GUEST", "org": "",
        "title": "", "email": "", "phone": "",
    }
    data["courses"][1] = {"id": 1, "code": "TEST101", "name": "Môn test", "credits": 3}
    data["programs"] = ["Chung"]
    data["program_faculty"]["Chung"] = 0
    data["program_names_reverse"]["Chung"] = "Chung"
    data["coordinator_names"]["Chung"] = ""
    data["num_programs"] = 1
    data["num_guest"] = 1
    STATE["data"] = data
    STATE["guestResult"] = None
    STATE["residentResult"] = None
    STATE["overrides"] = {}
    STATE["bo_ghim"] = set()
    STATE["pham_vi"] = None
    yield
    STATE["data"] = None


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def payload(**overrides):
    body = {
        "teacherIds": [1], "courseId": 1, "classCode": "TEST101-1",
        "program": "Chung", "duration": 2, "ltCredits": 3, "thCredits": 0,
        "cohort": "K68", "autoSchedule": True,
    }
    body.update(overrides)
    return body


@pytest.mark.parametrize("override", [
    {"duration": 4}, {"duration": 1},
    {"expectedStudents": 200}, {"expectedStudents": 150}, {"expectedStudents": 0}, {"expectedStudents": ""},
    {"teachingHoursLt": 50, "teachingHoursTh": 50}, {"teachingHoursLt": 12.5},
])
def test_gia_tri_trong_gioi_han_duoc_luu(client, override):
    assert client.post("/api/manual/section", json=payload(**override)).status_code == 200


@pytest.mark.parametrize("override", [
    {"duration": 5}, {"duration": 0}, {"duration": 2.5}, {"duration": "x"},
    {"expectedStudents": 201}, {"expectedStudents": -1}, {"expectedStudents": "abc"},
    {"teachingHoursLt": 51}, {"teachingHoursTh": 51}, {"teachingHoursLt": -1},
])
def test_gia_tri_vuot_gioi_han_bi_chan_va_khong_ghi_mot_phan(client, override):
    response = client.post("/api/manual/section", json=payload(**override))
    assert response.status_code == 400
    assert STATE["data"]["sections"] == {}


def test_sua_lop_cu_vuot_gioi_han_phai_sua_lai_truoc_khi_luu(client):
    sid = client.post("/api/manual/section", json=payload()).get_json()["classes"][0]["sectionId"]
    section = STATE["data"]["sections"][sid]
    section["duration"] = 5
    section["expected_students"] = 250

    bad = client.patch(f"/api/manual/section/{sid}", json=payload(duration=5, expectedStudents=250))
    assert bad.status_code == 400
    assert section["duration"] == 5

    fixed = client.patch(f"/api/manual/section/{sid}", json=payload(duration=3, expectedStudents=150))
    assert fixed.status_code == 200
    assert section["duration"] == 3


def test_so_dien_thoai_hop_le_va_khong_hop_le(client):
    for phone in ["", "0123456789", "123"]:
        assert client.post("/api/manual/teacher", json={
            "name": "A", "teacherType": "RESIDENT", "phone": phone,
        }).status_code == 200
    for phone in ["01234567890", "012 345", "+84123456", "09ab", "0123456789\n", 123]:
        response = client.post("/api/manual/teacher", json={
            "name": "B", "teacherType": "RESIDENT", "phone": phone,
        })
        assert response.status_code == 400, phone
    assert STATE["data"]["teachers"][1]["phone"] == ""


def test_sua_giang_vien_chan_phone_sai_nhung_khong_ep_khi_chi_luu_gio_ranh(client):
    teacher = STATE["data"]["teachers"][1]
    teacher["phone"] = "0123456789012"

    bad = client.patch("/api/manual/teacher/1", json={"name": "Đổi tên", "phone": teacher["phone"]})
    assert bad.status_code == 400
    assert teacher["name"] == "GV test"

    availability = client.patch("/api/manual/teacher/1", json={"availability": []})
    assert availability.status_code == 200
    assert teacher["phone"] == "0123456789012"

    ok = client.patch("/api/manual/teacher/1", json={"name": "Đổi tên", "phone": "0912345678"})
    assert ok.status_code == 200
    assert teacher["phone"] == "0912345678"
