# -*- coding: utf-8 -*-
"""Test validate/fallback cua CONFIG["availabilityGenerator"] - xem
PROMPT-THEM-CHUC-NANG-GIO-RANH-GIANG-VIEN.md muc 6.1/6.2.

Chay: py -m pytest test/test_app_config_availability_generator.py -q
(hoac `py -m pytest test/ -q` de chay toan bo test cua backend)
"""

import copy

import pytest

import app_config
from app_config import DEFAULT_AVAILABILITY_GENERATOR, _resolve_availability_generator


SLOTS_PER_DAY = 13


def _default():
    return copy.deepcopy(DEFAULT_AVAILABILITY_GENERATOR)


def test_config_that_da_nap_hop_le():
    """File config that cua du an phai nap duoc voi gia tri mac dinh hoac tuy chinh hop le."""
    current = copy.deepcopy(app_config.CONFIG["availabilityGenerator"])
    assert _resolve_availability_generator(
        {"availabilityGenerator": current},
        app_config.CONFIG["calendar"]["slotsPerDay"],
    ) == current


def test_thieu_toan_bo_khoa_dung_bo_mac_dinh():
    """File cau hinh CU (chua co availabilityGenerator) van khoi dong duoc,
    dung nguyen bo mac dinh de tuong thich nguoc."""
    config = {"other": "khong lien quan"}
    result = _resolve_availability_generator(config, SLOTS_PER_DAY)
    assert result == DEFAULT_AVAILABILITY_GENERATOR


def test_hop_le_tuy_chinh_khong_bi_tu_choi():
    custom = _default()
    custom["maxGeneratedBlocksPerDay"] = 2
    config = {"availabilityGenerator": custom}
    result = _resolve_availability_generator(config, SLOTS_PER_DAY)
    assert result["maxGeneratedBlocksPerDay"] == 2


@pytest.mark.parametrize("mutate", [
    lambda c: c["sessionBlocks"]["morning"].update({"endPeriod": 6}),  # chong lan voi afternoon (6-9)
    lambda c: c["sessionBlocks"]["evening"].update({"endPeriod": 99}),  # vuot slotsPerDay
    lambda c: c["sessionBlocks"]["morning"].update({"selectionGroup": "khong_ton_tai"}),
    lambda c: c["selectionGroupWeights"].update({"daytime": 91}),  # tong != 100
    lambda c: c["selectionGroupWeights"].update({"daytime": True}),  # boolean khong duoc chap nhan
    lambda c: c["generationChanceByBlockStage"].pop("2"),  # thieu khoa bat buoc
    lambda c: c["generationChanceByBlockStage"].update({"1": 150}),  # ngoai 0-100
    lambda c: c.update({"maxGeneratedBlocksPerDay": 0}),  # < 1
    lambda c: c.update({"maxGeneratedBlocksPerDay": 4}),  # > so luong sessionBlocks (3)
    lambda c: c.update({"replaceExistingAvailability": False}),  # false chua duoc ho tro
    lambda c: c.update({"replaceExistingAvailability": "true"}),  # phai la boolean
    lambda c: c.update({"sessionBlocks": {}}),  # rong
])
def test_cau_hinh_sai_phai_dung_khoi_dong(mutate):
    custom = _default()
    mutate(custom)
    config = {"availabilityGenerator": custom}
    with pytest.raises(ValueError):
        _resolve_availability_generator(config, SLOTS_PER_DAY)


def test_khung_chi_cham_bien_khong_bi_tinh_la_chong_lan():
    """Hai khung LIEN TIEP (vd sang ket thuc tiet 5, chieu bat dau tiet 6) khong
    duoc coi la chong lan - chi cam khi co tiet CHUNG."""
    custom = _default()
    custom["sessionBlocks"]["morning"]["endPeriod"] = 5
    custom["sessionBlocks"]["afternoon"]["startPeriod"] = 6
    result = _resolve_availability_generator({"availabilityGenerator": custom}, SLOTS_PER_DAY)
    assert result["sessionBlocks"]["morning"]["endPeriod"] == 5
