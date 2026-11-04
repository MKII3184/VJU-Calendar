# -*- coding: utf-8 -*-
"""PATCH /api/manual/course/<id>: khoa khi co lop da chot, khoa tin chi, danh lai
ma lop khi doi ma hoc phan. Chay: py -m pytest test/test_api_course_edit.py -q"""

import pytest

import api.manual_course as manual_course_api
from domain.sections import empty_manual_data
from state import STATE


@pytest.fixture(autouse=True)
def _khong_ghi_snapshot(monkeypatch):
    monkeypatch.setattr(manual_course_api, "save_snapshot", lambda *a, **k: None)


@pytest.fixture
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _lop(sid, ma, chot=None, course_id=1):
    return {
        "id": sid, "course_id": course_id, "course_name": f"Mon ({ma})" if ma else "Mon",
        "teacher_id": 1, "teacher_ids": [1], "teacher_type": "GUEST", "duration": 2,
        "time_assumed": True, "original_slot": None, "room_type": "LT", "program": 0,
        "program_ids": [], "class_code": ma, "cohort": "", **({"chot": chot} if chot else {}),
    }


@pytest.fixture(autouse=True)
def _du_lieu():
    d = empty_manual_data()
    d["teachers"][1] = {"id": 1, "name": "GV", "type": "GUEST", "org": "", "title": "", "email": "", "phone": ""}
    d["program_faculty"][0] = 0
    d["courses"][1] = {"id": 1, "code": "VJU2022", "name": "Mon", "credits": 3}
    d["courses"][2] = {"id": 2, "code": "XYZ1", "name": "Khac", "credits": 2}
    STATE["data"] = d
    STATE["extra"] = None
    STATE["guestResult"] = None
    STATE["residentResult"] = None
    yield
    STATE["data"] = None


def _ma(sid):
    return STATE["data"]["sections"][sid]["class_code"]


def test_doi_ma_danh_lai_ma_lop_giu_nhieu_buoi_cung_ma_va_ma_tuy_chinh(client):
    s = STATE["data"]["sections"]
    s[1] = _lop(1, "VJU2022-1")
    s[2] = _lop(2, "VJU2022-3")  # nhay so -> khong bo so
    s[3] = _lop(3, "VJU2022-3")  # buoi thu hai cua cung lop
    s[4] = _lop(4, "VJU2022")  # khong hau to: giu
    s[5] = _lop(5, "TUYCHINH")  # tuy chinh: giu
    s[6] = _lop(6, "VJU2022-1", course_id=2)  # hoc phan khac: khong dong vao
    res = client.patch("/api/manual/course/1", json={"code": "ABC2022"})
    assert res.status_code == 200
    assert [_ma(i) for i in (1, 2, 3, 4, 5, 6)] == ["ABC2022-1", "ABC2022-2", "ABC2022-2", "VJU2022", "TUYCHINH", "VJU2022-1"]
    body = res.get_json()
    assert body["classCodesRenamed"] == 2
    assert sorted(body["classCodesKept"]) == ["TUYCHINH", "VJU2022"]
    assert s[2]["course_name"] == "Mon (ABC2022-2)"
    assert STATE["data"]["courses"][1]["code"] == "ABC2022"


def test_chi_doi_ten_khong_danh_lai_ma_lop(client):
    STATE["data"]["sections"][1] = _lop(1, "VJU2022-1")
    res = client.patch("/api/manual/course/1", json={"name": "Ten moi"})
    assert res.status_code == 200
    assert _ma(1) == "VJU2022-1"
    assert STATE["data"]["sections"][1]["course_name"] == "Ten moi (VJU2022-1)"
    assert res.get_json()["classCodesRenamed"] == 0


def test_mot_lop_da_chot_khoa_sua_ma_ten_va_khong_doi_gi(client):
    s = STATE["data"]["sections"]
    s[1] = _lop(1, "VJU2022-1", chot={"by": "gv"})
    s[2] = _lop(2, "VJU2022-2")
    res = client.patch("/api/manual/course/1", json={"code": "ABC2022", "name": "Moi"})
    assert res.status_code == 400
    assert "đã chốt" in res.get_json()["error"]
    assert STATE["data"]["courses"][1]["code"] == "VJU2022"
    assert STATE["data"]["courses"][1]["name"] == "Mon"
    assert [_ma(1), _ma(2)] == ["VJU2022-1", "VJU2022-2"]


def test_bo_chot_het_thi_sua_duoc(client):
    s = STATE["data"]["sections"]
    s[1] = _lop(1, "VJU2022-1")
    assert client.patch("/api/manual/course/1", json={"code": "ABC2022"}).status_code == 200
    assert _ma(1) == "ABC2022-1"


def test_khong_cho_doi_tin_chi_nhung_gui_nguyen_gia_tri_thi_qua(client):
    res = client.patch("/api/manual/course/1", json={"credits": 4})
    assert res.status_code == 400
    assert STATE["data"]["courses"][1]["credits"] == 3
    assert client.patch("/api/manual/course/1", json={"credits": 3, "name": "Moi"}).status_code == 200
    assert STATE["data"]["courses"][1]["name"] == "Moi"


def test_trung_ma_lop_hoac_ma_hoc_phan_bi_tu_choi_khong_luu_do_dang(client):
    s = STATE["data"]["sections"]
    s[1] = _lop(1, "VJU2022-1")
    s[2] = _lop(2, "ABC2022-1", course_id=2)  # dang giu ma dich
    res = client.patch("/api/manual/course/1", json={"code": "ABC2022", "name": "Moi"})
    assert res.status_code == 400
    assert STATE["data"]["courses"][1]["code"] == "VJU2022" and STATE["data"]["courses"][1]["name"] == "Mon"
    assert _ma(1) == "VJU2022-1"
    res = client.patch("/api/manual/course/1", json={"code": "xyz1"})
    assert res.status_code == 400
    assert STATE["data"]["courses"][1]["code"] == "VJU2022"