# -*- coding: utf-8 -*-
"""Backend Flask cho cong cu xep thoi khoa bieu (thinh giang truoc / co huu sau, CP-SAT).

Chay:  py app.py   -> mo http://127.0.0.1:5055
       (giao dien lay tu ../frontend/dist - can `npm run build` truoc, xem api/frontend.py)

BAN DO MA NGUON - tim loi o dau:

    app.py            file nay: tao app, dang ky route, nap lai snapshot
    state.py          STATE toan cuc + hang so dung chung
    snapshot.py       luu/nap du lieu nhap tay xuong manual_state_snapshot.json

    api/              tang HTTP - moi file mot nhom viec cua giao vu
      frontend.py     phuc vu giao dien React da build
      common.py       chan "chua co du lieu" + khuon response dung chung
      data.py         doc bo du lieu dang co
      lecturers.py    danh sach GV co huu (nguon phan loai co huu/thinh giang)
      import_excel.py nap file Excel ke hoach giang day
      manual.py       nhap tay GV / hoc phan / lop
      solve.py        chay CP-SAT hai giai doan (ca khoa, hoac RIENG mot CTDT)
      schedule.py     keo-tha sua tay + luu thoi khoa bieu
      chot.py         chot / bo chot lich theo hoc phan
      export.py       xuat .xlsx

    domain/           quy tac NGHIEP VU - khong biet gi ve Flask (xem domain/__init__.py)

    scheduler_core.py mo hinh CP-SAT + cac ham doc thuoc tinh lop (khong doi)
    fate_import.py    doc file Excel ke hoach giang day -> cac dong da chuan hoa
    fate_audit.py     soi loi TRONG CHINH FILE Excel (ma lop trung, email trung...)
    fate_export.py    ghi ra file Excel
    fate_lecturers.py doc file danh sach giang vien co huu

    kiem_tra_pham_vi.py  do lai 3 bat bien cua "xep theo pham vi" tren du lieu
                         that (py kiem_tra_pham_vi.py --bo-chan FTH VJU2026 ...)
"""

import os
from flask import Flask

from api import register_blueprints
from domain.hoan_tac import nap_moc
from snapshot import load_snapshot

app = Flask(__name__)
register_blueprints(app)

load_snapshot()  # phuc hoi du lieu nhap tay lan chay truoc (neu co) ngay khi module nap
nap_moc()        # va diem quay ve cua nut "Huy thay doi" - xem domain/hoan_tac.py


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 5055))
    app.run(host=host, port=port, debug=False)
