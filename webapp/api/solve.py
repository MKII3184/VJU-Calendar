# -*- coding: utf-8 -*-
"""CHAY THUAT TOAN: khai gio, Giai doan 1 (thinh giang), Giai doan 2 (co huu).

Thu tu bat buoc: GD1 xep thinh giang theo khung gio ho da bao -> dong bang ket
qua do -> GD2 ghep co huu vao cho con lai. Ca hai pha deu chay trong `with
tam_bo_ghim(...)` de nhung lop giao vu vua bam "Bo ghim" that su duoc xep lai.

NHOM SINH VIEN (CTDT x Khoa): ca hai pha deu nhan `cap_can_ne` - cac cap lop ma
sinh vien khong the hoc ca hai neu chung cung gio. Rang buoc MEM trong CP-SAT
(xem scheduler_core._rang_buoc_nhom_sinh_vien), luat gom nhom o
domain/nhom_sinh_vien.py.

LOP DO DON VI KHAC DIEU PHOI da co gio: khong vao model (khoa khong duoc xep lai
chung) nhung di vao ca hai pha duoi dang VAT CAN CO DINH cua nhom sinh vien, va
duoc gan lai vao ket qua de van hien tren luoi. Xem domain/bo_qua.py.

PHAM VI XEP (body {"phamVi": {"programs": [...], "cohorts": [...]}}): giai cho
RIENG mot chuong trinh dao tao + cac khoa cua no. Khong truyen = toan khoa, dung
y het hanh vi cu. Toan bo luat nam o domain/pham_vi.py - o day chi doc request,
goi domain, dong goi response.
"""

from flask import Blueprint, jsonify, request

from api.common import can_du_lieu, loi
from domain import nhom_sinh_vien as nsv
from domain import pham_vi as pv
from domain.luoi import (attach_ca_hai, attach_override_metadata, dong_bo_ket_qua,
                         gan_buoi_don_vi_khac)
from domain.pinning import (ghim_tay_o_giai_doan_2, solve_guest_with_overrides,
                            tam_bo_ghim)
from state import STATE

import scheduler_core as sc

bp = Blueprint("solve", __name__)


def _doc_pham_vi():
    """Pham vi cua lan bam nay. Body rong -> giu pham vi cua lan giai truoc.

    Vi sao giu lai: Giai doan 2 phai chay DUNG pham vi cua Giai doan 1 (GD1 da
    dong bang lop ngoai pham vi roi), ma frontend cu chi POST khong kem body.
    Giu o STATE thi ban cu van chay dung, va tai lai trang khong mat pham vi."""
    body = request.get_json(silent=True) or {}
    if "phamVi" not in body:
        return STATE.get("pham_vi")
    return pv.chuan_hoa(body.get("phamVi"))


def _bo_du_lieu_cua_pham_vi(data, pham_vi):
    """(tap section_id thuoc pham vi, gio dang hien truoc khi giai)."""
    return pv.sids_thuoc(data, pham_vi), pv.gio_truoc_khi_giai(data)


@bp.post("/api/solve-guest")
@can_du_lieu
def api_solve_guest(data):
    """Giai doan 1: xep cac lop THINH GIANG theo khung gio da bao."""
    pham_vi = _doc_pham_vi()
    trong, gio_truoc = _bo_du_lieu_cua_pham_vi(data, pham_vi)

    # CHAN giai khi con lop chua san sang: hoac chua co GV THAT (con la cho
    # trong), hoac co GV nhung chua bao gio THAT - ca hai deu khien solver phai
    # "danh tam" (gan cho trong, hoac coi la ranh ca tuan), ra mot lich khong
    # dung dieu kien thuc te. Dieu phoi vien/CTDT phai xu ly xong (man "Chuẩn bị
    # dữ liệu → Học phần") truoc khi xep, khong duoc bo qua buoc nay.
    #
    # Chi xet trong PHAM VI: lop chua san sang cua chuong trinh khac khong phai
    # viec cua lan bam nay (chung bi dong bang, khong duoc xep lai).
    con_thieu = sc.guest_sections_can_thu_gio(data, chi_xet=trong if pham_vi else None)
    if con_thieu:
        pham = f" của {pv.mo_ta(pham_vi)}" if pham_vi else ""
        return loi(
            f"Còn {len(con_thieu)} lớp thỉnh giảng{pham} chưa sẵn sàng (thiếu giảng viên hoặc "
            "thiếu giờ) — xử lý hết ở 'Chuẩn bị dữ liệu → Học phần' trước khi xếp.",
            missingCount=len(con_thieu),
        )

    with tam_bo_ghim(data):
        with pv.ghim_ngoai_pham_vi(data, trong, gio_truoc):
            # Giai doan 1 von khong biet gi ve lop CO HUU (GD2 chay sau se ne no).
            # Xep theo pham vi thi GD2 khong con quyen dich lop co huu NGOAI pham
            # vi nua, nen phai bao truoc cho GD1 biet ho o dau.
            result = solve_guest_with_overrides(
                data,
                dong_bang=_dong_bang_cho_gd1(data, pham_vi, trong, gio_truoc),
                # Lop thinh giang cua chuong trinh KHAC: da ghim vao cho cu, va
                # them mot lop bao ve nua - khong duoc hy sinh de xep lop cua pham
                # vi nay. Xem domain/pham_vi.khong_duoc_hy_sinh.
                uu_tien_giu=pv.khong_duoc_hy_sinh(data, trong, gio_truoc, "GUEST") if pham_vi else None,
                # Cac cap lop cung nhom sinh vien - tinh tren TOAN KHOA ke ca khi
                # xep theo pham vi: lop cua pham vi cung phai ne lop cua chuong
                # trinh khac ma sinh vien cua no cung hoc ("FTH.ESAS" chung nguoi
                # hoc voi ca hai ben).
                cap_can_ne=nsv.cac_cap_can_ne(data),
                # Gio cua lop CO HUU ma Giai doan 2 se khong doi duoc - GD1 phai
                # biet de khong de lop thinh giang len dung o do (chi ve phia sinh
                # vien; GV/phong van do GD2 lo nhu cu) - CONG voi gio cua lop do
                # don vi khac dieu phoi: khoa khong xep chung nhung sinh vien van
                # dang hoc luc do that.
                gio_lop_pha_khac={**_gio_co_huu_khong_doi_duoc(data),
                                  **nsv.gio_lop_khong_xep(data)})
    pv.bo_gio_bia_them(result, trong, gio_truoc)
    # Solver khong biet gi ve lop do don vi khac dieu phoi - gan lai de chung van
    # hien tren luoi sau khi giai (xem domain/luoi.gan_buoi_don_vi_khac).
    gan_buoi_don_vi_khac(data, result, "GUEST")
    result["phamVi"] = pv.tom_tat(data, pham_vi, trong, result, "GUEST", gio_truoc)
    attach_override_metadata(data, result, "GUEST")
    STATE["guestResult"] = result
    STATE["pham_vi"] = pham_vi

    # NGHIEM cua Giai doan 2 khong con hieu luc: no duoc tinh tu vi tri cac buoi
    # thinh giang vua doi (xem solve_resident_phase, tham so frozen_guest_lessons).
    # Giu lai la hien mot lich khong con ton trong GD1 nua.
    #
    # NHUNG khong duoc xoa trang: phan lon lop co huu da co GIO CHOT trong file va
    # da duoc ghim (nap HK1 2026-2027-3: 108/163 lop). Do la du kien, khong phai
    # san pham cua solver. Truoc day cho nay dat thang None nen bam "Giai" o buoc 2
    # la 80 buoi co huu BIEN MAT khoi luoi, phai bam tiep buoc 3 moi thay lai -
    # giao vu tuong he thong lam mat lich cua minh.
    #
    # Dung lai bang dong_bo_ket_qua(chi_pha="RESIDENT"): no dat lai cac buoi co gio
    # co dinh/ghim, gan initial=True nen thanh tien trinh van bao buoc 3 "chua chay"
    # va nut buoc 3 van la "Giai" (xem WorkflowStrip), khong ai hieu nham day la
    # ket qua da ghep.
    #
    # XEP THEO PHAM VI thi KHONG duoc huy: nghiem GD2 cua cac chuong trinh KHAC
    # van con nguyen gia tri (GD1 vua roi chi dich duoc lop thinh giang trong pham
    # vi, va no da dong bang lop co huu ngoai pham vi de khong dam vao ai). Huy sach
    # la 80 buoi cua chuong trinh khac mat cho, dung cai ma tinh nang nay sinh ra de
    # tranh.
    if not pham_vi:
        STATE["residentResult"] = None
    dong_bo_ket_qua(data, chi_pha="RESIDENT")
    if STATE["residentResult"]:
        # Con so tom tat cua LAN GHEP CO HUU truoc do khong con dung (buoc 3 phai
        # chay lai cho pham vi nay) - bo di, tha de trong con hon in mot con so cu.
        STATE["residentResult"].pop("phamVi", None)
    return jsonify({**result, "residentResult": STATE["residentResult"]})


def _gio_co_huu_khong_doi_duoc(data):
    """{section_id: slot} cua cac lop CO HUU ma Giai doan 2 SE KHONG dich duoc.

    Dung dung ba nguon ma solve_resident_phase dat mien theo (xem `ghim_tay` va
    `ghim_theo_file` o do), khong doan them: ghim tay cua giao vu > gio chot trong
    file > (con lai la tu do, khong ke vao day). Lop vua bam "Bo ghim" thi GD2
    duoc quyen xep lai nen cung khong ke.

    Sai lech giua day va GD2 khong lam hong gi - rang buoc nay MEM - nhung se lam
    GD1 ne mot o ma thuc ra khong ai giu, hoac khong ne o that su bi giu."""
    ra = {}
    for sid, s in data["sections"].items():
        if s["teacher_type"] != "RESIDENT" or not sc.khoa_phai_xep(s) or sid in STATE["bo_ghim"]:
            continue
        ov = STATE["overrides"].get(sid)
        if ov and ov.get("slot") is not None:
            ra[sid] = ov["slot"]
        elif not s.get("time_assumed") and s.get("original_slot") is not None:
            ra[sid] = s["original_slot"]
    return ra


def _khuon_dong_bang(data, gio):
    """{section_id: slot} -> danh sach buoi dung khuon ma tham so `dong_bang` cua
    solve_guest_phase doc (id/slot/duration/roomType/teacherId/teacherIds), tuc
    cung khuon lesson ma hai pha giai tra ve."""
    ra = []
    for sid, slot in sorted(gio.items()):
        s = data["sections"].get(sid)
        if s is None or slot is None:
            continue
        ra.append({
            "id": sid, "slot": slot, "duration": s["duration"],
            "roomType": s["room_type"], "teacherId": s["teacher_id"],
            "teacherIds": list(s.get("teacher_ids") or [s["teacher_id"]]),
        })
    return ra


def _dong_bang_cho_gd1(data, pham_vi, trong, gio_truoc):
    """Cac buoi CO HUU ma Giai doan 1 phai NE ra - ne ca gio giang vien lan phong.

    Gom hai nguon:

      1. LOP CO HUU DA GHIM (luon luon, ke ca xep toan khoa). Giai doan 2 chay sau
         se khong dich duoc chung: mien cua chung chi con DUNG MOT slot (ghim tay
         cua giao vu, hoac gio da chot trong file - xem solve_resident_phase). Neu
         GD1 khong biet ma dat mot lop thinh giang de len dung o do cua cung mot
         giang vien, thi GD2 khong con duong nao va lop co huu do roi thang vao
         "khong xep duoc" - mat mot lop DA CHOT GIO voi giang vien.

         Truoc day tham so `dong_bang` CHI duoc truyen khi xep theo pham vi, nen
         duong toan khoa (duong giao vu bam hang ngay) van ho lo hoan toan. Do tren
         du lieu that: mot lop thinh giang chua chot gio (#217 AET2019) dung giang
         vien voi ba lop co huu da ghim (#130, #274, #276) - chua no ra nhung khong
         co gi ngan.

         `gio_lop_pha_khac` KHONG thay the duoc: no chi vao rang buoc nhom sinh
         vien, khong vao rang buoc giang vien/phong (xem docstring cua no).

      2. LOP CO HUU NGOAI PHAM VI dang co cho (chi khi xep theo pham vi). Luc do
         GD2 khong duoc phep dich ho de nhuong cho nua, nen GD1 phai biet truoc ho
         o dau. Nguon nay dat SAU nguon 1 de thang: vi tri dang hien moi la cho
         phai giu, du lop do co ghim hay khong.

    Dong bang vao GD1 la interval OPTIONAL co trong so rat nang chu khong CO DINH
    (xem solve_guest_phase va _trong_so_giu_cho): tap nay khong dam bao sach - file
    that co dong nhap trung dat cung mot o cho cung mot nguoi - va hai interval CO
    DINH chong nhau se lam ca lan giai vo nghiem."""
    gio = dict(_gio_co_huu_khong_doi_duoc(data))
    if pham_vi:
        for sid, s in data["sections"].items():
            if sid in trong or s["teacher_type"] != "RESIDENT":
                continue
            if gio_truoc.get(sid) is not None:
                gio[sid] = gio_truoc[sid]
    return _khuon_dong_bang(data, gio)


@bp.post("/api/solve-resident")
@can_du_lieu
def api_solve_resident(data):
    """Giai doan 2: ghep cac lop CO HUU vao cho con lai sau Giai doan 1."""
    # "initial" = lich ban dau doc tu file, CHUA phai ket qua giai Giai doan 1
    # (xem pinning.lich_ban_dau) - van phai chay buoc 2 truoc.
    if STATE["guestResult"] is None or STATE["guestResult"].get("initial"):
        return loi("Cần chạy Giai đoạn 1 (thỉnh giảng) trước.")

    pham_vi = _doc_pham_vi()
    if pham_vi != STATE.get("pham_vi"):
        return loi("Phạm vi xếp đã đổi — cần chạy lại bước Xếp thỉnh giảng cho phạm vi này trước.")
    trong, gio_truoc = _bo_du_lieu_cua_pham_vi(data, pham_vi)

    with tam_bo_ghim(data):
        ghim_tay = pv.ghim_tay_ngoai_pham_vi(
            data, trong, gio_truoc, ghim_tay_o_giai_doan_2(data))
        result = sc.solve_resident_phase(
            data, STATE["guestResult"]["lessons"],
            ghim_tay=ghim_tay,
            bo_ghim=STATE["bo_ghim"],
            uu_tien_giu=pv.khong_duoc_hy_sinh(data, trong, gio_truoc, "RESIDENT") if pham_vi else None,
            cap_can_ne=nsv.cac_cap_can_ne(data),
            gio_lop_pha_khac=nsv.gio_lop_khong_xep(data))
    pv.bo_gio_bia_them(result, trong, gio_truoc)
    gan_buoi_don_vi_khac(data, result, "RESIDENT")
    result["phamVi"] = pv.tom_tat(data, pham_vi, trong, result, "RESIDENT", gio_truoc)
    attach_override_metadata(data, result, "RESIDENT")
    STATE["residentResult"] = result
    STATE["pham_vi"] = pham_vi
    return jsonify(result)


@bp.get("/api/results")
def api_results():
    """Tra lai ket qua giai dang cache trong STATE - dung khi SPA tai lai trang.

    Truoc khi co endpoint nay, guestResult/residentResult chi song trong state
    React: bam F5 la luoi trong va giao vu phai bam 'Giai' lai (2-30 giay) DU
    backend van con nguyen ket qua. /api/state co bao hasGuestResult nhung khong
    tra ve chinh ket qua, nen frontend biet 'co' ma khong lay duoc.

    Gan metadata ghim truoc khi tra de the buoi hien dung 'nhan ghim' ngay sau khi
    tai lai, khong doi den luot sua tay ke tiep."""
    if STATE["data"] is None:
        return jsonify({"guestResult": None, "residentResult": None, "phamVi": None})

    attach_ca_hai(STATE["data"])
    return jsonify({
        "guestResult": STATE["guestResult"],
        "residentResult": STATE["residentResult"],
        # Pham vi cua lan giai gan nhat - de tai lai trang van biet dang xep cho
        # chuong trinh nao, khong bam "Ghep co huu" nham sang pham vi khac.
        "phamVi": STATE.get("pham_vi"),
    })
