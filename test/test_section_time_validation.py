from domain.sections import validate_section_body


def make_data():
    return {
        "teachers": {
            1: {"id": 1, "type": "RESIDENT"},
            2: {"id": 2, "type": "GUEST"},
        },
        "courses": {10: {"id": 10, "name": "Giải tích"}},
        "params": {"slotsPerDay": 12},
        "programs": [],
        "program_faculty": {},
        "coordinator_names": {},
        "program_names_reverse": {},
    }


def make_body(**overrides):
    body = {
        "teacherIds": [1],
        "courseId": 10,
        "duration": 3,
        "program": "BCSE",
        "day": 0,
        "periodStart": 1,
        "periodEnd": 3,
    }
    body.update(overrides)
    return body


def test_nhom_co_thinh_giang_duoc_chon_toi_thu_7_du_nguoi_dau_la_co_huu():
    fields, _teacher, _duration, time_info, error = validate_section_body(
        make_data(), make_body(teacherIds=[1, 2], day=5),
    )

    assert error is None
    assert fields["teacher_type"] == "GUEST"
    assert time_info["day"] == 5


def test_nhom_toan_co_huu_khong_duoc_chon_thu_7():
    _fields, _teacher, _duration, _time_info, error = validate_section_body(
        make_data(), make_body(day=5),
    )

    assert "Cơ hữu chỉ được dạy tới" in error


def test_nhap_tay_bat_buoc_dai_gio_khop_so_tiet_moi_buoi():
    _fields, _teacher, _duration, _time_info, error = validate_section_body(
        make_data(), make_body(periodEnd=2),
    )

    assert error == "Dải giờ phải dài đúng bằng Số tiết mỗi buổi dạy."


def test_du_lieu_lich_su_khong_bi_mat_vi_quy_tac_chon_tay_moi():
    fields, _teacher, _duration, time_info, error = validate_section_body(
        make_data(), make_body(day=5, periodEnd=2), enforce_day_cap=False,
    )

    assert error is None
    assert fields["duration"] == 3
    assert time_info == {"day": 5, "period_start": 1, "period_end": 2}
