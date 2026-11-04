# -*- coding: utf-8 -*-
"""HOC PHAN nhap tay: them moi va sua. Mot hoc phan dung chung cho nhieu lop nen
sua o day anh huong TAT CA lop tham chieu toi no."""

from flask import Blueprint, request

from api.common import can_du_lieu, loi, tra_du_lieu
from domain.luoi import dong_bo_ket_qua
from domain.sections import id_moi, ke_hoach_doi_ma_lop
from snapshot import save_snapshot

bp = Blueprint("manual_course", __name__)


@bp.post("/api/manual/course")
@can_du_lieu
def api_manual_add_course(data):
    """Tao 1 hoc phan (dung chung cho nhieu lop - mirror cot B/C/D cua Excel,
    tuong tu 1 nhom dong merge-xuong). Body JSON: {code, name, credits}."""
    body = request.get_json(force=True)

    name = (body.get("name") or "").strip()
    if not name:
        return loi("Thiếu Tên học phần.")
    try:
        credits = int(body["credits"]) if body.get("credits") not in (None, "") else None
    except (TypeError, ValueError):
        return loi("Số tín chỉ phải là số nguyên.")

    courses = data.setdefault("courses", {})
    cid = id_moi(courses)
    courses[cid] = {"id": cid, "code": (body.get("code") or "").strip(),
                    "name": name, "credits": credits}

    save_snapshot()
    return tra_du_lieu(data)


@bp.patch("/api/manual/course/<int:course_id>")
@can_du_lieu
def api_manual_update_course(data, course_id):
    """Sua thong tin 1 hoc phan - anh huong tat ca lop tham chieu toi (course la
    entity rieng, khong can propagate tay xuong tung lop)."""
    course = data.setdefault("courses", {}).get(course_id)
    if course is None:
        return loi(f"Không tìm thấy học phần id={course_id}.")
    body = request.get_json(force=True)

    if "credits" in body:
        try:
            credits = int(body["credits"]) if body["credits"] not in (None, "") else None
        except (TypeError, ValueError):
            return loi("Số tín chỉ phải là số nguyên.")
        if credits != course.get("credits"):
            return loi("Không thể đổi Số tín chỉ của học phần đã tạo.")

    name = (body.get("name") or "").strip() if "name" in body else course.get("name")
    code = (body.get("code") or "").strip() if "code" in body else course.get("code") or ""
    if not name:
        return loi("Tên học phần không được để trống.")
    doi_ten, doi_ma = name != course.get("name"), code != (course.get("code") or "")
    if not doi_ten and not doi_ma:
        return tra_du_lieu(data)

    da_chot = [s for s in data["sections"].values() if s.get("course_id") == course_id and s.get("chot")]
    if da_chot:
        return loi(f"Không thể sửa Mã/Tên học phần vì đã có {len(da_chot)} lớp đã chốt. Hãy bỏ chốt hết các lớp trước.")

    doi, giu, giu_loi = {}, [], None
    if doi_ma:
        if code and any(
            c["id"] != course_id and (c.get("code") or "").strip().lower() == code.lower()
            for c in data["courses"].values()
        ):
            return loi(f"Mã học phần \"{code}\" đã tồn tại.")
        doi, giu, giu_loi = ke_hoach_doi_ma_lop(data, course_id, (course.get("code") or "").strip(), code)
        if giu_loi:
            return loi(giu_loi)

    course["name"], course["code"] = name, code
    for s in data["sections"].values():
        if s.get("course_id") == course_id:
            if s["id"] in doi:
                s["class_code"] = doi[s["id"]]
            s["course_name"] = f"{name} ({s['class_code']})" if s.get("class_code") else name

    # Ten mon / ma lop vua doi -> the buoi tren luoi Thoi khoa bieu phai ghi moi.
    dong_bo_ket_qua(data)
    save_snapshot()
    return tra_du_lieu(data, classCodesRenamed=len(set(doi.values())), classCodesKept=giu)
