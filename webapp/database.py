# -*- coding: utf-8 -*-
"""Ket noi va dong bo Co so du lieu quan he theo ERD chuan (7 bang).

Thiet ke theo dung ERD: Untitled diagram-2026-10-28-065235.pdf:
1. coordinators (Dieu phoi vien)
2. lecturers (Giang vien)
3. lecturer_availabilities (Khung gio ranh)
4. courses (Hoc phan / Mon hoc)
5. classes (Lop hoc phan)
6. rooms (Phong hoc)
7. schedules (Thoi khoa bieu / Lich hoc)

Ho tro tu dong:
- Ket noi MySQL neu co cau hinh (DB_HOST, DB_USER, DB_PASSWORD, DATABASE_URL).
- Tu dong fallback sang SQLite cuc bo neu chua bat MySQL de ung dung luon hoat dong 100%.
- Dong bo 2 chieu: moi thao tac nhap lieu / luu TKB deu ghi truc tiep vao Database that.
"""

import os
import json
import uuid
import logging
from pathlib import Path
from sqlalchemy import (
    create_engine, MetaData, Table, Column, String, Integer, SmallInteger,
    Text, Boolean, JSON, ForeignKey, select, delete, insert, text
)
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

def _clean_for_json(obj):
    if isinstance(obj, set):
        return sorted(list(obj))
    if isinstance(obj, dict):
        return {str(k): _clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean_for_json(v) for v in obj]
    return obj


# Thư mục chứa SQLite fallback
BASE_DIR = Path(__file__).resolve().parent
DB_FALLBACK_FILE = BASE_DIR / "vju_calendar.db"

metadata = MetaData()

# 1. Bảng Điều phối viên (coordinators)
coordinators_table = Table(
    "coordinators", metadata,
    Column("id", String(36), primary_key=True),
    Column("full_name", String(255), nullable=False),
    Column("email", String(255), nullable=False, unique=True),
    Column("phone", String(50), nullable=True),
    Column("program_code", String(50), nullable=True),
)

# 2. Bảng Giảng viên (lecturers)
lecturers_table = Table(
    "lecturers", metadata,
    Column("id", String(36), primary_key=True),
    Column("lecturer_code", String(50), nullable=False, unique=True),
    Column("full_name", String(255), nullable=False),
    Column("email", String(255), nullable=True),
    Column("lecturer_type", String(20), nullable=False, default="RESIDENT"), # RESIDENT / GUEST
    Column("coordinator_id", String(36), ForeignKey("coordinators.id", ondelete="SET NULL"), nullable=True),
)

# 3. Bảng Khung giờ có thể dạy của Giảng viên (lecturer_availabilities)
lecturer_availabilities_table = Table(
    "lecturer_availabilities", metadata,
    Column("id", String(36), primary_key=True),
    Column("lecturer_id", String(36), ForeignKey("lecturers.id", ondelete="CASCADE"), nullable=False),
    Column("day_of_week", SmallInteger, nullable=False), # 0=Thu 2 ... 6=Chu nhat
    Column("shift", String(50), nullable=True),
    Column("available_periods", JSON, nullable=True),
    Column("notes", Text, nullable=True),
)

# 4. Bảng Học phần / Môn học (courses)
courses_table = Table(
    "courses", metadata,
    Column("id", String(36), primary_key=True),
    Column("course_code", String(50), nullable=False, unique=True),
    Column("course_name", String(255), nullable=False),
    Column("credits", Integer, nullable=False, default=3),
    Column("theory_periods", Integer, nullable=False, default=30),
    Column("practice_periods", Integer, nullable=False, default=15),
    Column("program", String(50), nullable=True),
)

# 5. Bảng Lớp học phần (classes)
classes_table = Table(
    "classes", metadata,
    Column("id", String(36), primary_key=True),
    Column("class_code", String(100), nullable=False, unique=True),
    Column("course_id", String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
    Column("lecturer_id", String(36), ForeignKey("lecturers.id", ondelete="SET NULL"), nullable=True),
    Column("cohort", String(50), nullable=True),
    Column("semester", String(50), nullable=True),
    Column("expected_students", Integer, nullable=False, default=40),
    Column("status", String(50), nullable=False, default="unassigned"),
)

# 6. Bảng Phòng học (rooms)
rooms_table = Table(
    "rooms", metadata,
    Column("id", String(36), primary_key=True),
    Column("room_code", String(50), nullable=False, unique=True),
    Column("building", String(100), nullable=True),
    Column("capacity", Integer, nullable=False, default=50),
    Column("room_type", String(50), nullable=False, default="LT"), # LT / LAB
)

# 7. Bảng Thời khóa biểu / Lịch học (schedules)
schedules_table = Table(
    "schedules", metadata,
    Column("id", String(36), primary_key=True),
    Column("class_id", String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
    Column("lecturer_id", String(36), ForeignKey("lecturers.id", ondelete="SET NULL"), nullable=True),
    Column("room_id", String(36), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True),
    Column("day_of_week", SmallInteger, nullable=False),
    Column("start_period", SmallInteger, nullable=False),
    Column("end_period", SmallInteger, nullable=False),
    Column("scheduling_phase", String(50), nullable=True), # GUEST / RESIDENT / MANUAL
    Column("is_locked", Boolean, nullable=False, default=False),
)

# Bang luu thong tin meta (extra, params, co_huu) de tai tao nguyen ven STATE
metadata_table = Table(
    "system_metadata", metadata,
    Column("key", String(100), primary_key=True),
    Column("value", JSON, nullable=True),
)

_ENGINE = None
_SESSION = None
_DB_TYPE = "unknown"

def get_engine():
    global _ENGINE, _SESSION, _DB_TYPE
    if _ENGINE is not None:
        return _ENGINE

    db_url = os.environ.get("DATABASE_URL")
    db_host = os.environ.get("DB_HOST")
    db_port = os.environ.get("DB_PORT", "3306")
    db_user = os.environ.get("DB_USER", "root")
    db_password = os.environ.get("DB_PASSWORD", "dmcvmkii28")
    db_name = os.environ.get("DB_NAME", "vju_calendar")

    if not db_url and db_host:
        db_url = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"

    if db_url and db_url.startswith("mysql"):
        try:
            u = make_url(db_url)
            root_url = u.set(database="")
            temp_engine = create_engine(root_url)
            with temp_engine.connect() as conn:
                conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{u.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            temp_engine.dispose()

            engine = create_engine(db_url, pool_pre_ping=True, pool_recycle=3600)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            _ENGINE = engine
            _DB_TYPE = "mysql"
            logger.info(f"Kết nối thành công tới MySQL Database: {u.database} tại {u.host}")
        except Exception as exc:
            logger.warning(f"Không thể kết nối MySQL ({exc}). Đang chuyển sang SQLite fallback: {DB_FALLBACK_FILE}")
            _ENGINE = None

    if _ENGINE is None:
        # Fallback sang SQLite
        sqlite_url = f"sqlite:///{DB_FALLBACK_FILE}"
        _ENGINE = create_engine(sqlite_url, connect_args={"check_same_thread": False})
        _DB_TYPE = "sqlite"
        logger.info(f"Đang sử dụng SQLite database: {DB_FALLBACK_FILE}")

    # Tạo bảng nếu chưa có
    metadata.create_all(_ENGINE)
    _SESSION = sessionmaker(bind=_ENGINE)
    return _ENGINE

def get_db_info():
    get_engine()
    return {"type": _DB_TYPE, "engine": str(_ENGINE.url)}

def save_data_to_db(data, extra=None, co_huu=None):
    """Dong bo toan bo du lieu hoc phan, giang vien va lich hoc vao 7 bang Database."""
    if not data or not isinstance(data, dict):
        return False

    engine = get_engine()
    teachers = data.get("teachers") or {}
    courses = data.get("courses") or {}
    sections = data.get("sections") or {}
    coord_names = data.get("coordinator_names") or {}
    teacher_windows = data.get("manual_teacher_windows") or {}
    slots_per_day = (data.get("params") or {}).get("slotsPerDay", 13)

    with engine.begin() as conn:
        # 1. Lưu coordinators
        conn.execute(delete(schedules_table))
        conn.execute(delete(classes_table))
        conn.execute(delete(lecturer_availabilities_table))
        conn.execute(delete(lecturers_table))
        conn.execute(delete(coordinators_table))
        conn.execute(delete(courses_table))
        conn.execute(delete(rooms_table))
        conn.execute(delete(metadata_table))

        coord_id_map = {}
        for cid, name in coord_names.items():
            u_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"coord_{cid}_{name}"))
            email = f"coord_{cid}@vju.edu.vn"
            conn.execute(insert(coordinators_table).values(
                id=u_id,
                full_name=str(name),
                email=email,
                phone=None,
                program_code=str(cid)
            ))
            coord_id_map[str(cid)] = u_id
            coord_id_map[str(name)] = u_id

        # 2. Lưu lecturers
        teacher_id_to_uuid = {}
        for tid, t in teachers.items():
            u_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"lecturer_{tid}_{t.get('name')}"))
            teacher_id_to_uuid[tid] = u_id
            c_name = t.get("coordinator")
            c_id = coord_id_map.get(str(c_name)) if c_name else None
            conn.execute(insert(lecturers_table).values(
                id=u_id,
                lecturer_code=str(t.get("code") or f"GV_{tid}"),
                full_name=t.get("name") or f"Giảng viên #{tid}",
                email=t.get("email"),
                lecturer_type="RESIDENT" if t.get("type") == "RESIDENT" else "GUEST",
                coordinator_id=c_id
            ))

        # 3. Lưu lecturer_availabilities
        for tid, slots in teacher_windows.items():
            if tid not in teacher_id_to_uuid:
                continue
            lec_uuid = teacher_id_to_uuid[tid]
            by_day = {}
            for s in slots:
                d = s // slots_per_day
                p = (s % slots_per_day) + 1
                by_day.setdefault(d, []).append(p)
            for d, periods in by_day.items():
                conn.execute(insert(lecturer_availabilities_table).values(
                    id=str(uuid.uuid4()),
                    lecturer_id=lec_uuid,
                    day_of_week=int(d),
                    shift="Sáng" if min(periods) <= 5 else "Chiều",
                    available_periods=sorted(periods),
                    notes=None
                ))

        # 4. Lưu courses
        course_id_to_uuid = {}
        for cid, c in courses.items():
            u_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"course_{cid}_{c.get('code')}"))
            course_id_to_uuid[cid] = u_id
            conn.execute(insert(courses_table).values(
                id=u_id,
                course_code=str(c.get("code") or f"HP_{cid}"),
                course_name=str(c.get("name") or f"Môn học #{cid}"),
                credits=int(c.get("credits") or 3),
                theory_periods=int(c.get("theory_periods") or 30),
                practice_periods=int(c.get("practice_periods") or 15),
                program=c.get("program")
            ))

        # 5. Lưu rooms mặc định
        room_uuid_map = {}
        for r_code, r_type in [("LT-60-01", "LT"), ("LT-60-02", "LT"), ("LAB-40-01", "LAB"), ("LAB-40-02", "LAB")]:
            r_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"room_{r_code}"))
            room_uuid_map[r_type] = r_uuid
            conn.execute(insert(rooms_table).values(
                id=r_uuid,
                room_code=r_code,
                building="VJU Campus",
                capacity=60 if r_type == "LT" else 40,
                room_type=r_type
            ))

        # 6. Lưu classes và schedules
        for sid, s in sections.items():
            u_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"class_{sid}"))
            c_uuid = course_id_to_uuid.get(s.get("course_id"))
            l_uuid = teacher_id_to_uuid.get(s.get("teacher_id"))

            conn.execute(insert(classes_table).values(
                id=u_id,
                class_code=str(s.get("class_code") or f"LOP_{sid}"),
                course_id=c_uuid if c_uuid else list(course_id_to_uuid.values())[0] if course_id_to_uuid else None,
                lecturer_id=l_uuid,
                cohort=str(s.get("cohort") or ""),
                semester=str(s.get("semester") or "HK1 2026-2027"),
                expected_students=int(s.get("expected_students") or 40),
                status=str(s.get("schedule_status") or "unassigned")
            ))

            # 7. Lưu schedules nếu lớp đã có lịch
            day = s.get("day")
            start = s.get("period_start")
            end = s.get("period_end")
            if day is not None and start is not None and end is not None:
                r_type = s.get("room_type") or "LT"
                r_uuid = room_uuid_map.get(r_type) or list(room_uuid_map.values())[0] if room_uuid_map else None
                conn.execute(insert(schedules_table).values(
                    id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"schedule_{sid}")),
                    class_id=u_id,
                    lecturer_id=l_uuid,
                    room_id=r_uuid,
                    day_of_week=int(day),
                    start_period=int(start),
                    end_period=int(end),
                    scheduling_phase="GUEST" if teachers.get(s.get("teacher_id"), {}).get("type") == "GUEST" else "RESIDENT",
                    is_locked=bool(s.get("sectionChot", False))
                ))

        # Lưu metadata
        conn.execute(insert(metadata_table).values(key="extra", value=_clean_for_json(extra)))
        conn.execute(insert(metadata_table).values(key="co_huu", value=_clean_for_json(co_huu)))
        conn.execute(insert(metadata_table).values(key="raw_state", value=_clean_for_json(data)))

    logger.info("Đã đồng bộ thành công dữ liệu sang Database (7 bảng).")
    return True

def load_data_from_db():
    """Tải dữ liệu từ Database lên cấu trúc STATE['data']."""
    engine = get_engine()
    try:
        with engine.connect() as conn:
            res = conn.execute(select(metadata_table).where(metadata_table.c.key == "raw_state")).fetchone()
            if res and res[1]:
                extra_res = conn.execute(select(metadata_table).where(metadata_table.c.key == "extra")).fetchone()
                co_huu_res = conn.execute(select(metadata_table).where(metadata_table.c.key == "co_huu")).fetchone()
                return {
                    "data": res[1],
                    "extra": extra_res[1] if extra_res else None,
                    "co_huu": co_huu_res[1] if co_huu_res else None,
                }
    except Exception as exc:
        logger.warning(f"Lỗi khi nạp dữ liệu từ Database: {exc}")
    return None
