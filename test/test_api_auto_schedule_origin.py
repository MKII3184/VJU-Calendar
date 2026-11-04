# -*- coding: utf-8 -*-

import pytest

import api.manual_section as manual_section_api
import api.schedule as schedule_api
from app import app
from domain.sections import empty_manual_data
from state import STATE


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch):
    monkeypatch.setattr(manual_section_api, "save_snapshot", lambda *args, **kwargs: None)
    monkeypatch.setattr(schedule_api, "save_snapshot", lambda *args, **kwargs: None)
    monkeypatch.setattr(schedule_api, "dat_moc", lambda *args, **kwargs: None)
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


def section_payload(**overrides):
    payload = {
        "teacherIds": [1], "courseId": 1, "classCode": "TEST101-1",
        "program": "Chung", "duration": 2, "ltCredits": 3, "thCredits": 0,
        "cohort": "K68", "autoSchedule": True,
    }
    payload.update(overrides)
    return payload


def test_gio_tu_dong_di_tu_cho_xep_den_du_kien_roi_da_luu(client):
    created = client.post("/api/manual/section", json=section_payload())
    assert created.status_code == 200
    section = created.get_json()["classes"][0]
    assert STATE["data"]["sections"][section["sectionId"]]["time_source"] == "auto"
    assert section["timeSource"] == "auto"
    assert section["timeAssumed"] is True
    assert section["timePreview"] is False
    assert section["day"] is None

    STATE["guestResult"] = {
        "status": "FEASIBLE", "lessons": [{"id": section["sectionId"], "slot": 2}],
        "placedCount": 1, "total": 1, "unplaced": [],
    }
    preview = client.get("/api/data").get_json()["classes"][0]
    assert preview["timeAssumed"] is True
    assert preview["timePreview"] is True
    assert (preview["day"], preview["periodStart"], preview["periodEnd"]) == (0, 3, 4)

    metadata = client.patch(
        f"/api/manual/section/{section['sectionId']}",
        json=section_payload(notes="chỉ sửa ghi chú"),
    ).get_json()["classes"][0]
    assert metadata["timePreview"] is True
    assert (metadata["day"], metadata["periodStart"], metadata["periodEnd"]) == (0, 3, 4)

    saved = client.post("/api/manual/save-schedule")
    assert saved.status_code == 200
    section = saved.get_json()["classes"][0]
    assert section["timeAssumed"] is False
    assert section["timePreview"] is False
    assert section["timeSource"] == "auto"
    assert (section["day"], section["periodStart"], section["periodEnd"]) == (0, 3, 4)


def test_sua_metadata_lop_da_luu_giu_gio_va_nguon_tu_dong(client):
    created = client.post("/api/manual/section", json=section_payload())
    sid = created.get_json()["classes"][0]["sectionId"]
    STATE["guestResult"] = {
        "status": "FEASIBLE", "lessons": [{"id": sid, "slot": 2}],
        "placedCount": 1, "total": 1, "unplaced": [],
    }
    client.post("/api/manual/save-schedule")

    payload = section_payload(
        autoSchedule=False, day=0, periodStart=3, periodEnd=4,
        timeSource="auto", notes="đã sửa metadata",
    )
    updated = client.patch(f"/api/manual/section/{sid}", json=payload)
    assert updated.status_code == 200
    section = updated.get_json()["classes"][0]
    assert section["timeSource"] == "auto"
    assert section["timeAssumed"] is False
    assert section["timeLabel"] == "Thứ 2, tiết 3-4"
    assert section["notes"] == "đã sửa metadata"


def test_backend_chan_ghep_co_huu_khi_pham_vi_da_doi(client):
    STATE["guestResult"] = {"status": "FEASIBLE", "lessons": [], "placedCount": 0, "total": 0, "unplaced": []}
    STATE["pham_vi"] = {"programs": ["FTH"], "cohorts": ["K68"]}

    response = client.post(
        "/api/solve-resident",
        json={"phamVi": {"programs": ["BCSE"], "cohorts": ["K68"]}},
    )

    assert response.status_code == 400
    assert "Phạm vi xếp đã đổi" in response.get_json()["error"]
