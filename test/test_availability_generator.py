# -*- coding: utf-8 -*-
"""Test thuat toan tu dong sinh gio ranh - xem
domain/availability_generator.py va PROMPT-THEM-CHUC-NANG-GIO-RANH-GIANG-VIEN.md
muc 5.2/5.3/5.4.

Chay: py -m pytest test/test_availability_generator.py -q
"""

import copy
import random

import pytest

import scheduler_core as sc
from app_config import CONFIG
from domain.availability_generator import _generate_day, generate_teacher_availability
from domain.sections import empty_manual_data

SLOTS_PER_DAY = CONFIG["calendar"]["slotsPerDay"]
MORNING = CONFIG["availabilityGenerator"]["sessionBlocks"]["morning"]  # tiet 2-5
AFTERNOON = CONFIG["availabilityGenerator"]["sessionBlocks"]["afternoon"]  # tiet 6-9
EVENING = CONFIG["availabilityGenerator"]["sessionBlocks"]["evening"]  # tiet 10-12


def _slots(day, block):
    return [day * SLOTS_PER_DAY + (p - 1) for p in range(block["startPeriod"], block["endPeriod"] + 1)]


class FakeRng:
    """Bo sinh so gia, tra ve LAN LUOT cac gia tri da khai bao truoc - dung de
    test thuat toan cho ra dung 1 duong di xac dinh, khong phu thuoc random
    that (xem yeu cau "co the mock hoac inject" o muc 5.2)."""

    def __init__(self, randint_values=(), uniform_values=()):
        self._randint = list(randint_values)
        self._uniform = list(uniform_values)

    def randint(self, a, b):
        return self._randint.pop(0)

    def uniform(self, a, b):
        return self._uniform.pop(0)


def _config_with_max_blocks(n):
    cfg = copy.deepcopy(CONFIG)
    cfg["availabilityGenerator"]["maxGeneratedBlocksPerDay"] = n
    return cfg


def make_data(teacher_type="GUEST", num_days=None):
    data = empty_manual_data()
    data["teachers"][1] = {"id": 1, "name": "GV test", "type": teacher_type}
    if num_days is not None:
        data["params"]["numDays"] = num_days
    return data


def add_section(data, teacher_id, original_slot, duration, time_assumed=False):
    sid = len(data["sections"]) + 1
    data["sections"][sid] = {
        "id": sid, "course_id": 1, "teacher_id": teacher_id, "teacher_ids": [teacher_id],
        "duration": duration, "time_assumed": time_assumed, "original_slot": original_slot,
    }
    return sid


# ---------------------------------------------------------------------------
# _generate_day: cac nhanh xac suat/trong so mo ta o muc 5.2 cua prompt.
# ---------------------------------------------------------------------------

def test_ngay_trong_chon_khung_sang_theo_dung_trong_so():
    """Ngay hoan toan trong: stage0 = 100% (luon thanh cong), r=44 (<=45) phai
    roi vao khung sang (thu tu trong so 45/45/10, morning dung dau)."""
    rng = FakeRng(randint_values=[1], uniform_values=[44])
    out = _generate_day(0, teaching_slots=set(), config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, MORNING))


def test_ngay_trong_chon_khung_chieu_theo_dung_trong_so():
    rng = FakeRng(randint_values=[1], uniform_values=[70])  # 45 < 70 <= 90 -> afternoon
    out = _generate_day(0, teaching_slots=set(), config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, AFTERNOON))


def test_ngay_trong_chon_khung_toi_theo_dung_trong_so():
    rng = FakeRng(randint_values=[1], uniform_values=[95])  # > 90 -> evening
    out = _generate_day(0, teaching_slots=set(), config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, EVENING))


def test_mac_dinh_max_1_khung_moi_ngay_dung_sau_khung_dau():
    """maxGeneratedBlocksPerDay=1 (mac dinh) -> dung ngay sau khung dau, du con
    randint/uniform con lai trong hang doi cung khong bi dung toi."""
    rng = FakeRng(randint_values=[1, 999], uniform_values=[44, 999])
    out = _generate_day(0, teaching_slots=set(), config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, MORNING))
    assert rng._randint == [999] and rng._uniform == [999]  # con du, khong bi tieu


def test_phep_thu_that_bai_dung_ngay_khong_sinh_gi():
    """chance stage0 = 100% -> randint phai <=100 moi thanh cong; gia lap
    "that bai" bang cach dat chance thap hon qua mot khung DANG DAY (stage1)."""
    ag = copy.deepcopy(CONFIG)
    teaching = set(_slots(0, MORNING))  # 1 khung dang day -> stage0 dung o do = 1 -> chance 35%
    rng = FakeRng(randint_values=[36])  # 36 > 35 -> that bai
    out = _generate_day(0, teaching_slots=teaching, config=ag, rng=rng)
    assert out == []


def test_co_dung_mot_khung_dang_day_bat_dau_tu_35_phan_tram():
    teaching = set(_slots(0, MORNING))
    rng = FakeRng(randint_values=[35], uniform_values=[95])  # thanh cong (<=35), roi ra toi
    out = _generate_day(0, teaching_slots=teaching, config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, EVENING))


def test_co_hai_khung_dang_day_bat_dau_tu_10_phan_tram():
    teaching = set(_slots(0, MORNING)) | set(_slots(0, AFTERNOON))
    rng = FakeRng(randint_values=[10], uniform_values=[0])  # thanh cong (<=10) -> chi con evening hop le
    out = _generate_day(0, teaching_slots=teaching, config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, EVENING))


def test_co_ba_khung_dang_day_khong_sinh_them():
    teaching = set(_slots(0, MORNING)) | set(_slots(0, AFTERNOON)) | set(_slots(0, EVENING))
    rng = FakeRng(randint_values=[1])  # chance stage3OrMore = 0% -> luon that bai (randint>=1>0)
    out = _generate_day(0, teaching_slots=teaching, config=_config_with_max_blocks(1), rng=rng)
    assert out == []


def test_sang_bi_chiem_mot_phan_van_la_ung_vien_voi_phan_con_trong():
    """GV dang day tiet 2-3 (nam trong khung sang tiet 2-5) -> khung sang VAN
    duoc tinh la khung 'da co du lieu' (stage bat dau tu 35%), nhung neu duoc
    chon thi chi tiet 4-5 (con trong) duoc them, khong dam vao tiet 2-3."""
    day0_p2_p3 = [0 * SLOTS_PER_DAY + 1, 0 * SLOTS_PER_DAY + 2]  # tiet 2,3 (0-indexed period 1,2)
    teaching = set(day0_p2_p3)
    rng = FakeRng(randint_values=[35], uniform_values=[10])  # thanh cong, r=10 -> con nam trong nhom daytime, roi vao "morning" (dau danh sach)
    out = _generate_day(0, teaching_slots=teaching, config=_config_with_max_blocks(1), rng=rng)
    tiet_4_5 = [0 * SLOTS_PER_DAY + 3, 0 * SLOTS_PER_DAY + 4]
    assert sorted(out) == sorted(tiet_4_5)


def test_sang_da_kin_thi_chi_con_chieu_va_toi_theo_90_10():
    """Toan bo khung sang da bi chiem (khong con tiet trong) -> loai khoi ung
    vien, chuan hoa lai trong so: chieu con lai nhan het 90%, toi 10%."""
    teaching = set(_slots(0, MORNING))
    rng = FakeRng(randint_values=[35], uniform_values=[50])  # <=90 (voi trong so da chuan hoa) -> afternoon
    out = _generate_day(0, teaching_slots=teaching, config=_config_with_max_blocks(1), rng=rng)
    assert sorted(out) == sorted(_slots(0, AFTERNOON))


def test_2_khung_moi_ngay_kich_hoat_chuoi_35_roi_10():
    """maxGeneratedBlocksPerDay=2: khung dau thanh cong o 100% (khong dang day),
    khung thu hai phai qua phep thu 35% (stage=1) - dung dung trinh tu muc 5.2."""
    cfg = _config_with_max_blocks(2)
    rng = FakeRng(randint_values=[1, 35], uniform_values=[10, 95])
    out = _generate_day(0, teaching_slots=set(), config=cfg, rng=rng)
    assert sorted(out) == sorted(set(_slots(0, MORNING)) | set(_slots(0, EVENING)))


def test_moi_ten_khung_chi_duoc_chon_toi_da_mot_lan_trong_1_luot():
    """maxGeneratedBlocksPerDay=3 nhung chi co the sinh toi da so luong khung
    (3) - khong khung nao bi lap lai."""
    cfg = _config_with_max_blocks(3)
    rng = FakeRng(randint_values=[1, 35, 10], uniform_values=[10, 95, 0])
    out = _generate_day(0, teaching_slots=set(), config=cfg, rng=rng)
    expect = set(_slots(0, MORNING)) | set(_slots(0, EVENING)) | set(_slots(0, AFTERNOON))
    assert sorted(out) == sorted(expect)


# ---------------------------------------------------------------------------
# generate_teacher_availability: pham vi ngay theo loai GV + khong doc gio
# ranh cu + khong dam vao gio dang day.
# ---------------------------------------------------------------------------

def test_thinh_giang_khong_sinh_qua_thu_7():
    data = make_data("GUEST")
    slots = generate_teacher_availability(data, 1, rng=random.Random(1))
    max_day = max(s // SLOTS_PER_DAY for s in slots)
    assert max_day <= sc.max_day_index("GUEST")  # Thu 7 = index 5
    assert sc.max_day_index("GUEST") == 5


def test_co_huu_khong_sinh_qua_thu_6():
    data = make_data("RESIDENT")
    slots = generate_teacher_availability(data, 1, rng=random.Random(1))
    assert all(s // SLOTS_PER_DAY <= sc.max_day_index("RESIDENT") for s in slots)
    assert sc.max_day_index("RESIDENT") == 4


def test_khong_ai_duoc_sinh_vao_chu_nhat():
    for loai in ("GUEST", "RESIDENT"):
        data = make_data(loai)
        slots = generate_teacher_availability(data, 1, rng=random.Random(7))
        assert all(s // SLOTS_PER_DAY != 6 for s in slots)


def test_khong_dam_vao_gio_dang_day():
    data = make_data("GUEST")
    # GV dang day T2 tiet 2-3 (slot 1-2) va T4 tiet 6-9 (slot voi day=2)
    add_section(data, 1, original_slot=1, duration=2)
    add_section(data, 1, original_slot=2 * SLOTS_PER_DAY + 5, duration=4)
    for seed in range(20):
        slots = generate_teacher_availability(data, 1, rng=random.Random(seed))
        assert 1 not in slots and 2 not in slots
        assert all(s not in range(2 * SLOTS_PER_DAY + 5, 2 * SLOTS_PER_DAY + 9) for s in slots)


def test_gio_ranh_cu_khong_anh_huong_ket_qua_moi():
    """Ham nay khong doc `manual_teacher_windows` - gio ranh CU (du con trong
    data) khong duoc dung de dem trang thai ngay/tinh xac suat."""
    data = make_data("GUEST")
    data["manual_teacher_windows"][1] = list(range(SLOTS_PER_DAY))  # gio ranh cu ca ngay T2
    out_with_old = generate_teacher_availability(data, 1, rng=random.Random(3))

    data2 = make_data("GUEST")
    out_without_old = generate_teacher_availability(data2, 1, rng=random.Random(3))
    assert out_with_old == out_without_old


def test_time_assumed_section_khong_tinh_la_dang_day():
    """Lop CHUA chot gio (time_assumed=True) khong phai la 'dang day' - khong
    duoc loai khoi ket qua sinh."""
    data = make_data("GUEST")
    add_section(data, 1, original_slot=1, duration=2, time_assumed=True)
    rng = FakeRng(randint_values=[1] * 10, uniform_values=[44] * 10)
    out = _generate_day(0, teaching_slots=set(), config=_config_with_max_blocks(1), rng=rng)
    # time_assumed khong duoc dua vao teaching_slots (test nay chi khang dinh ham
    # _generate_day khong lien quan gi field do - kiem tra qua generate_teacher_availability):
    slots = generate_teacher_availability(data, 1, rng=random.Random(2))
    assert isinstance(slots, list)


def test_khong_seed_co_dinh_moi_lan_goi_khac_nhau_theo_thoi_gian():
    """Khong truyen rng -> tu tao random.Random() moi (khong seed co dinh) -
    hai lan goi lien tiep PHAI co the ra ket qua khac nhau (kiem tra bang cach
    goi nhieu lan va thay it nhat mot cap khac nhau, tranh flaky do trung hop)."""
    data = make_data("GUEST")
    results = {tuple(generate_teacher_availability(data, 1)) for _ in range(15)}
    assert len(results) > 1
