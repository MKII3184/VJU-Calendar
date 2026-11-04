# -*- coding: utf-8 -*-
"""NHAP LIEU THU CONG - khoi tao bo du lieu rong va xoa gio hang loat.

Day la duong du lieu CHINH cua he thong (thay Excel). Luong nap file
(api/import_excel.py) chay lai dung nhung ham o day (domain/excel_rows.py) nen
du lieu hai duong khong khac nhau cho nao.

Ba thuc the tach ra ba file rieng - moi cai mot form ben giao dien:
    api/manual_teacher.py   giang vien
    api/manual_course.py    hoc phan
    api/manual_section.py   lop hoc phan
"""

from flask import Blueprint, request

from api.common import can_du_lieu, loi, tra_du_lieu
from domain.chot import khoa_vi_da_chot
from domain.hoc_chung import thanh_vien
from domain.luoi import dong_bo_ket_qua
from domain.pinning import ghim_theo_gio_form
from domain.sections import empty_manual_data
from domain.time_rules import apply_section_time
from snapshot import save_snapshot
from state import STATE, reset_ket_qua

bp = Blueprint("manual", __name__)


@bp.post("/api/manual/init")
def api_manual_init():
    """Bat dau 'nhap lieu thu cong': XOA HET du lieu dang co, bat dau tu 1 bo du
    lieu rong roi giao vu tu them GV/lop bang tay qua /api/manual/teacher va
    /api/manual/section."""
    data = empty_manual_data()
    extra = {"isRealData": False, "sourceLabel": "Nhập liệu thủ công", "numTimeAssumed": 0}
    STATE["data"] = data
    STATE["extra"] = extra
    reset_ket_qua()
    save_snapshot()
    return tra_du_lieu(data)


@bp.post("/api/manual/clear-times")
@can_du_lieu
def api_manual_clear_times(data):
    """'Xoá giờ' hàng loạt tren man 'Du lieu hoc phan': dat lai Thu/Tiet dau/Tiet
    cuoi cua NHIEU lop cung luc thanh 'de he thong tu xep' (time_info=None),
    dung LAI apply_section_time() dung nhu sua tung lop mot. Body JSON:
    {sectionIds: [int, ...]} - danh sach lop dang hien theo bo loc HIEN TAI o
    frontend, de xoa dung nhung dong giao vu dang thay tren man (WYSIWYG), khong
    phai toan bo du lieu."""
    body = request.get_json(force=True)
    try:
        section_ids = [int(x) for x in (body.get("sectionIds") or [])]
    except (TypeError, ValueError):
        return loi("sectionIds phải là danh sách số nguyên.")

    # HOC CHUNG: xoa gio mot thanh vien la xoa gio CA BUOI - mo rong danh sach
    # sang cac lop cung nhom, ke ca khi giao vu chi chon mot lop tren bang.
    mo_rong = list(section_ids)
    for sid in section_ids:
        for khac in thanh_vien(data, sid):
            if khac not in mo_rong:
                mo_rong.append(khac)
    theo_nhom = [x for x in mo_rong if x not in section_ids]
    section_ids = mo_rong

    cleared = 0
    bo_qua_da_chot = 0
    da_xoa = []
    for sid in section_ids:
        s = data["sections"].get(sid)
        teacher = data["teachers"].get(s["teacher_id"]) if s else None
        if s is None or teacher is None:
            continue
        # Xoa gio hang loat KHONG duoc pha mon da chot: nut nay xoa theo bo loc
        # dang hien nen rat de quet trung vao mon da cam ket voi giang vien.
        if khoa_vi_da_chot(data, sid):
            bo_qua_da_chot += 1
            continue
        apply_section_time(data, sid, teacher, s["duration"], None)
        s["time_source"] = "auto"
        # Go ghim: khong go thi lop van bi ep ve gio vua xoa o lan Giai ke tiep,
        # tuc nut "Xoa gio" khong lam gi ca (xem ghim_theo_gio_form).
        ghim_theo_gio_form(data, sid, None)
        # Gio cu khong con - "Trang thai lich" (tu Luu thoi khoa bieu) da het
        # nghia, khong the de nguyen kieu "Da xep" tren mot lop vua bi xoa gio.
        s["schedule_status"] = None
        da_xoa.append(sid)
        cleared += 1

    # Lop vua bi xoa gio phai RUNG KHOI luoi Thoi khoa bieu - xem bo_vi_tri_cu.
    dong_bo_ket_qua(data, da_xoa)
    save_snapshot()
    return tra_du_lieu(data, clearedCount=cleared, skippedChotCount=bo_qua_da_chot,
                       hocChungAlso=theo_nhom)
