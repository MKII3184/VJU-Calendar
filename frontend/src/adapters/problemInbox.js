// HOP THU VAN DE - gop 4 nguon bao loi von nam roi rac o 4 man khac nhau:
//
//   Check trung lien chuong trinh  -> GV day >= 2 CT tu dung gio
//   Khung gio da bao               -> buoi chua co gio cu the
//   Giai doan 1                    -> buoi CP-SAT khong xep duoc
//   Tra cuu theo giang vien        -> GV tu dung gio (moi CT, ke ca 1 CT)
//
// Van de: BA nguon dau cung bao ve MOT su viec. Vi du that #52 <-> #59 xuat hien
// o ca 3 cho voi 3 cach dien dat khac nhau, nen giao vu tuong la 3 viec.
//
// O day gom lai theo SU VIEC, khong theo man phat hien ra no:
//   - Cap lop dung gio  -> khoa theo cap sectionId (khu trung lap giua cac nguon)
//   - Buoi khong xep duoc -> NEU do mot cap dung gio gay ra thi GAN VAO cap do,
//     khong dem thanh viec rieng
//   - Buoi chua co gio  -> gom theo dieu phoi vien phu trach
//   - Dong nghi trung lap trong file nguon -> loai moi, truoc day khong ai bao

import { DAY_LABELS, slotToDayPeriod } from "./dayPeriod";
import { taoCungBuoi } from "./hocChung";
import { slotRangeLabel } from "./crossConflictAnalysis";
import { analyzeSubmissions, SUB_STATE } from "./submissionQueue";
import { cacVuTrung, lopChuaGhiKhoa } from "./nhomSinhVien";
import { coPhamVi, sectionIdsTrongPhamVi } from "./phamVi";
import { analyzeUnplaced, REASON_META, UNPLACED_REASON } from "./unplacedAnalysis";

export const PROBLEM_TYPE = {
  CLASH: "CLASH", // hai buoi cua cung GV chac chan dung gio
  SINH_VIEN: "SINH_VIEN", // hai buoi cua cung mot nhom (CTDT x Khoa) chong gio
  DUPLICATE: "DUPLICATE", // nghi la 2 dong trung lap cua cung 1 lop
  UNPLACED: "UNPLACED", // CP-SAT khong xep duoc, khong do cap dung gio nao
  MISSING_HOURS: "MISSING_HOURS", // chua co khung gio cu the
  KHAC_CO_SO: "KHAC_CO_SO", // 1 GV bi xep ca hai co so trong cung mot ngay
  DI_LAI: "DI_LAI", // 1 GV phai len CUNG mot co so qua nhieu ngay trong tuan
};

// SUC CHUA MOT NGAY (so tiet) o mot co so = KHOI CA HOC DAI NHAT cua no
// (data.khoiCaHoc, tu scheduler_core.KHOI_CA_HOC). Hoa Lac co hai khoi 2-5 va
// 6-13 nen suc chua la 8 tiet.
//
// Dung de tinh SO NGAY IT NHAT mot giang vien phai len co so do. Truoc day cho
// nay la mot nguong tho ("tu 3 ngay tro len thi bao"), va no bao sai: mot thay
// day 18 tiet o Hoa Lac thi 3 ngay da la it nhat co the (18/8 = 2,25 -> 3), gom
// nua la khong the - bao ra chi lam giao vu mat cong doi chieu roi bo qua.
// Con so 8 khop dung du lieu that: trong 110 cap (GV, ngay) o Hoa Lac, KHONG cap
// nao vuot 8 tiet.
function sucChuaMotNgay(khoiCaHoc, khuVuc) {
  const khoi = khoiCaHoc?.[khuVuc];
  if (!khoi?.length) return null;         // co so khong khai bao khoi -> khong doan
  return Math.max(...khoi.map(([dau, cuoi]) => cuoi - dau + 1));
}

// CAC LOAI VU DUOC HA CAP KHI MOI LOP LIEN QUAN DA CHOT LICH.
//
// Chi la nhung vu "hai buoi dung nhau": khi ca hai ben deu da chot thi khong con
// viec gi de lam - muon go phai BO CHOT truoc, ma do la mot quyet dinh co y thuc
// cua con nguoi chu khong phai viec hop thu phai nhac.
//
// KHONG gom DUPLICATE (nghi trung lap du lieu - chot lich khong lam mot dong thua
// bot thua di), khong gom UNPLACED/MISSING_HOURS (viec CHUA XONG, khong phai cam
// ket da xong).
//
// DI_LAI cung vao day: cach go duy nhat la BO GHIM cac lop roi giai lai, ma lop
// thuoc mon da chot thi phai Bo chot truoc - lai la mot quyet dinh co y thuc cua
// con nguoi, khong phai viec hop thu phai nhac.
const LOAI_HA_CAP_KHI_CHOT = new Set(["CLASH", "SINH_VIEN", "KHAC_CO_SO", "DI_LAI"]);

export const PROBLEM_META = {
  CLASH: {
    label: "Trùng giảng viên",
    cls: "clash",
    severity: 0,
    fix: "Đổi giờ một trong hai buổi",
  },
  SINH_VIEN: {
    // Cung bac nang voi "trung giang vien": ca hai deu la lich KHONG DUNG DUOC,
    // khong phai lich xau - khong ai o hai cho mot luc.
    label: "Trùng lịch sinh viên",
    cls: "clash",
    severity: 0,
    fix: "Đổi giờ một trong hai buổi — sinh viên khóa đó của chương trình đó phải học cả hai",
  },
  DUPLICATE: {
    label: "Nghi trùng lặp dữ liệu",
    cls: "duplicate",
    severity: 1,
    fix: "Đối chiếu file nguồn — có thể là một lớp bị ghi hai dòng",
  },
  KHAC_CO_SO: {
    label: "Hai cơ sở trong một ngày",
    cls: "clash",
    severity: 1,
    fix: "Dồn về một cơ sở: đổi giờ một buổi sang ngày khác, hoặc đổi địa điểm",
  },
  DI_LAI: {
    label: "Đi lại nhiều ngày",
    cls: "duplicate",
    // Duoi moi loai khac: lich VAN DUNG DUOC, chi la ton cong di lai cua giang
    // vien. Xu sau khi da het cac vu lam lich sai.
    severity: 4,
    fix: "Bỏ ghim các lớp ở cơ sở đó rồi giải lại — hệ thống sẽ dồn về ít ngày hơn",
  },
  UNPLACED: {
    label: "Không xếp được",
    cls: "unplaced",
    severity: 2,
    fix: "Xem ràng buộc đang chặn",
  },
  MISSING_HOURS: {
    label: "Chưa có giờ",
    cls: "missing",
    severity: 3,
    fix: "Điều phối viên nộp khung giờ",
  },
};

// Hai buoi co thuoc cac chuong trinh KHAC nhau khong? Lop "BCSE+MJM" thuoc CA HAI
// nen no KHONG lien chuong trinh voi mot lop BCSE - so chuoi nhan ("BCSE+MJM" !==
// "BCSE") thi ra ket qua nguoc.
function khacChuongTrinh(a, b) {
  const ta = a.programIds?.length ? a.programIds : [a.program];
  const tb = b.programIds?.length ? b.programIds : [b.program];
  return !ta.some((p) => tb.includes(p));
}

function overlaps(a, durA, b, durB) {
  return !(a + durA <= b || b + durB <= a);
}

function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Quet TOAN BO giang vien thinh giang tim cap buoi chac chan dung gio.
// Rong hon check_cross_program_conflicts o backend: ham do co y bo qua GV chi day
// 1 chuong trinh, ma tren du lieu that 4/5 vu dung lai chinh la loai do.
function scanTeacherClashes(rows, cungBuoi = () => false) {
  const byTeacher = new Map();
  for (const r of rows) {
    if (r.state !== SUB_STATE.SET) continue;
    // Gom theo TUNG GV cua lop (dong giang day), khong chi GV chinh - cung ly le
    // voi scanPlacedClashes ben duoi.
    for (const tid of r.teacherIds?.length ? r.teacherIds : [r.teacherId]) {
      if (!byTeacher.has(tid)) byTeacher.set(tid, []);
      byTeacher.get(tid).push(r);
    }
  }

  const out = [];
  for (const [teacherId, list] of byTeacher) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        let always = true;
        for (const wa of a.windowSlots) {
          for (const wb of b.windowSlots) {
            if (!overlaps(wa, a.duration, wb, b.duration)) {
              always = false;
              break;
            }
          }
          if (!always) break;
        }
        // HOC CHUNG: cung gio la DUNG Y, khong phai trung.
        if (always && !cungBuoi(a.sectionId, b.sectionId)) out.push({ teacherId, a, b });
      }
    }
  }
  return out;
}

// Quet trung gio giua cac buoi DANG NAM THAT tren luoi.
//
// Khac scanTeacherClashes o tren: ham do doc data.submissions - tuc "khung gio
// DIEU PHOI VIEN DA BAO", va chi xet giang vien thinh giang. Hai gioi han do
// khien keo-tha sua tay khong duoc kiem lai:
//   1. /api/move-lesson chi ghi STATE['overrides'] + va cham vi tri trong ket qua
//      dang cache; no KHONG dong vao data['submissions']. Keo mot buoi vao o
//      dang co nguoi day -> khung gio da bao van y nguyen -> hop thu khong biet.
//   2. Buoi cua GV co huu bi analyzeSubmissions loai tu dau, nen keo-tha buoi
//      co huu truoc gio khong bao gio duoc kiem.
//
// Nguon nay doc thang vi tri thuc (ca hai giai doan, cong ca buoi dang cho luu)
// nen bat duoc ngay khi vua tha. Dung chung cong thuc overlaps() voi
// _detect_move_conflict ben backend de hai noi khong bao lech nhau.
function scanPlacedClashes(lessons, cungBuoi = () => false) {
  const byTeacher = new Map();
  for (const l of lessons) {
    if (l.teacherId == null || l.slot == null) continue;
    // Gom theo TUNG GV cua buoi (teacherIds - dong giang day), khong chi GV
    // chinh: mot lop 5 nguoi day thi 4 nguoi sau cung phai duoc kiem trung, y
    // nhu solver dang lam. Fallback teacherId cho ket qua giai cu chua co field.
    for (const tid of l.teacherIds?.length ? l.teacherIds : [l.teacherId]) {
      if (!byTeacher.has(tid)) byTeacher.set(tid, []);
      byTeacher.get(tid).push(l);
    }
  }

  const out = [];
  for (const [teacherId, list] of byTeacher) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // HOC CHUNG: hai buoi cung nhom PHAI o cung o gio - do la muc dich.
        if (a.id !== b.id && cungBuoi(a.id, b.id)) continue;
        if (overlaps(a.slot, a.duration ?? 1, b.slot, b.duration ?? 1)) {
          out.push({ teacherId, a, b });
        }
      }
    }
  }
  return out;
}

// Hai dong duoc coi la NGHI TRUNG LAP khi: cung giang vien, cung ten mon (da gom
// ca ma lop), cung khung gio, cung thoi luong. Khong khang dinh - chi danh dau de
// nguoi dung doi chieu file goc, vi ve ly thuyet co the la 2 lop that can 2 phong.
function looksDuplicated(a, b) {
  return (
    a.courseName &&
    a.courseName === b.courseName &&
    a.duration === b.duration &&
    a.windowSlots.length === 1 &&
    b.windowSlots.length === 1 &&
    a.windowSlots[0] === b.windowSlots[0]
  );
}

/**
 * @param residentResult ket qua Giai doan 2 - can de quet trung gio tren VI TRI
 *   THAT (xem scanPlacedClashes); truoc day hop thu chi doc khung gio da bao nen
 *   bo sot moi thay doi do keo-tha sua tay.
 * @param pendingMove buoi vua tha nhung CHUA luu ({sectionId, toSlot}) - tinh
 *   luon vao de mau/canh bao doi ngay khi tha, khong doi bam Luu.
 */
/**
 * Loc hop thu theo DUNG pham vi dang chon o luoi (bo loc cua man Thoi khoa bieu).
 *
 * Vi sao can: hop thu duoc dung tu du lieu GOC nen truoc day chon "chuong trinh
 * BCSE" hay mot khoa cu the thi luoi thu hep lai con hop thu van bao y nguyen
 * ca 33 van de - doc thanh "loc xong van con tung day van de trong pham vi nay",
 * tuc noi sai. Loc o day chu khong trong buildProblemInbox: `inbox` day du con
 * duoc buildScheduleView dung de to mau/danh dau buoi co van de tren luoi.
 *
 * Mot VU lien quan nhieu lop (trung gio giua hai lop). Giu vu do neu CO IT NHAT
 * MOT lop thuoc pham vi - bo di thi lop trong pham vi mat luon loi giai thich
 * vi sao no co van de.
 */
export function filterProblemInbox(inbox, data, filter, phamVi = null) {
  const programs = filter?.programs ?? [];
  const khoas = filter?.khoas ?? [];
  // Hop thu phai di theo CA bo loc "Xem" lan "chi xem pham vi dang xep", giong het
  // luoi - khong thi luoi hien 33 buoi cua FTH ma hop thu van ke ca van de cua
  // chuong trinh khac.
  const locTheoPhamVi = Boolean(filter?.chiXemPhamVi && coPhamVi(phamVi));
  const locTheoScope = programs.length > 0;
  const locTheoKhoa = khoas.length > 0;
  if (!inbox || (!locTheoScope && !locTheoPhamVi && !locTheoKhoa)) return inbox;

  const byId = new Map((data?.classes ?? []).map((c) => [c.sectionId, c]));
  const idsPhamVi = locTheoPhamVi ? sectionIdsTrongPhamVi(data, phamVi) : null;
  const trongPhamVi = (sid) => {
    const c = byId.get(sid);
    if (!c) return false;
    if (idsPhamVi && !idsPhamVi.has(sid)) return false;
    // Khoa la o loc doc lap, GIAO voi scope - xem adapters/scheduleView.js.
    if (locTheoKhoa && !khoas.some((k) => (c.cohortParts ?? []).includes(k))) return false;
    return !locTheoScope || programs.some((p) => (c.programParts ?? []).includes(p));
  };
  const hop = (ids) => (ids ?? []).some(trongPhamVi);

  const items = inbox.items.filter((it) => hop(it.sectionIds));
  const daChotItems = (inbox.daChotItems ?? []).filter((it) => hop(it.sectionIds));
  const byType = {};
  for (const it of items) byType[it.type] = (byType[it.type] ?? 0) + 1;
  const unplaced = (inbox.unplacedReport?.items ?? []).filter((u) => trongPhamVi(u.id ?? u.sectionId));

  return {
    ...inbox,
    items,
    daChotItems,
    byType,
    total: items.length,
    affectedSections: new Set(items.flatMap((i) => i.sectionIds)).size,
    // "Chua co gio" gom theo dieu phoi vien nen dem lai theo cac lop con lai.
    missingHoursCount: items
      .filter((i) => i.type === PROBLEM_TYPE.MISSING_HOURS)
      .reduce((n, i) => n + i.sectionIds.filter(trongPhamVi).length, 0),
    unplacedReport: inbox.unplacedReport && { ...inbox.unplacedReport, items: unplaced },
    daLoc: true,
  };
}

export function buildProblemInbox(data, guestResult, residentResult = null, pendingMove = null) {
  if (!data) return { items: [], counts: {}, total: 0, byType: {} };

  // Ma lop hoc phan (vd "CSE3003-1") de hien THAY CHO "#<id noi bo>" o moi cho
  // (title cap dung gio, cac the trong "Chi tiet") - id noi bo khong noi len gi
  // voi giao vu, ho nhan lop qua ma lop.
  const classCodeById = new Map((data?.classes ?? []).map((c) => [c.sectionId, c.classCode]));
  const codeOf = (id) => classCodeById.get(id) || `#${id}`;

  // HOC CHUNG: cap lop cung mot buoi thi cung gio la DUNG Y - khong phai
  // "trung giang vien". Backend quyet dinh (webapp/domain/hoc_chung.py), o day
  // chi dung lai ket luan.
  const cungBuoi = taoCungBuoi(data);

  const sq = analyzeSubmissions(data);
  const slotsPerDay = sq.slotsPerDay;
  // analyzeUnplaced doc guestResult.lessons de tim buoi nao DANG CHIEM CHO cua
  // buoi bi bo lai. Ban keo-tha CHUA luu khong nam trong do, nen neu khong va
  // vao day thi: keo buoi dang chan di cho khac roi, no VAN bi liet ke la thu
  // pham -> van nam trong sectionIds cua muc "khong xep duoc" -> van bi to do.
  // (Ban da LUU thi guestResult da co vi tri moi, khong can va.)
  const guestHieuLuc = pendingMove && guestResult
    ? {
        ...guestResult,
        lessons: (guestResult.lessons ?? []).map((l) =>
          l.id === pendingMove.sectionId ? { ...l, slot: pendingMove.toSlot } : l,
        ),
      }
    : guestResult;
  const unplacedReport = guestHieuLuc ? analyzeUnplaced(guestHieuLuc, data) : null;

  const items = [];
  // sectionId -> item da giai thich vi sao buoi do co van de (de khong dem 2 lan)
  const explainedBy = new Map();

  // Vi tri THAT cua moi buoi dang nam tren luoi (ca hai giai doan), da ap ban
  // keo-tha chua luu len tren.
  //
  // Tu day co CA buoi cua don vi khac dieu phoi (`boQua`) - chung nam tren luoi
  // de khong ai xep de vao (xem webapp/domain/bo_qua.py). Nhung chung KHONG tham
  // gia luat GIANG VIEN: o giang vien cua chung ghi mot DON VI ("Phong Dao tao
  // dieu phoi") chu khong phai mot con nguoi, bat vao AddNoOverlap/quet trung la
  // bao trung gio giua hai cai cho trong. Chung chi tham gia luat NHOM SINH VIEN.
  const daXep = [];
  for (const res of [guestResult, residentResult]) {
    for (const l of res?.lessons ?? []) {
      daXep.push(pendingMove && l.id === pendingMove.sectionId ? { ...l, slot: pendingMove.toSlot } : l);
    }
  }
  const slotThat = new Map(daXep.map((l) => [l.id, l.slot]));
  // Cac buoi CUA KHOA - dung cho moi luat xoay quanh giang vien.
  const daXepCuaKhoa = daXep.filter((l) => !l.boQua);

  // KHUNG GIO HIEU LUC cua tung buoi:
  //   - dang nam tren luoi  -> DUNG 1 o: vi tri that (ke ca ban keo chua luu)
  //   - chua/khong xep duoc -> cac khung gio da bao, vi do la tat ca thong tin co
  //
  // Day la cho phai sua tan goc. Truoc do quet trung gio doc thang windowSlots
  // ("khung gio dieu phoi vien da bao"), ma /api/move-lesson khong he dong vao
  // no - keo-tha bao nhieu lan thi khung gio da bao van y nguyen. Ban va dau chi
  // bo qua cap nao CA HAI buoi deu da xep, nen sot dung truong hop pho bien nhat:
  // cap "mot buoi da xep + mot buoi bi bo lai". Keo buoi da xep di cho khac thi
  // buoi kia van dang o gio cu -> van bi ket luan la trung, bao do ly.
  const rowsHieuLuc = sq.rows.map((r) => {
    const slot = slotThat.get(r.sectionId);
    if (slot == null) return r;
    return { ...r, windowSlots: [slot], state: SUB_STATE.SET };
  });
  // Tra cuu dong theo id - dung ban HIEU LUC de moi cho hien gio deu khop nhau.
  const rowById = new Map(rowsHieuLuc.map((r) => [r.sectionId, r]));

  // --- 1. Cap dung gio, xet tren khung gio hieu luc ---
  for (const { teacherId, a, b } of scanTeacherClashes(rowsHieuLuc, cungBuoi)) {
    const dup = looksDuplicated(a, b);
    const type = dup ? PROBLEM_TYPE.DUPLICATE : PROBLEM_TYPE.CLASH;
    const { day, period } = slotToDayPeriod(a.windowSlots[0], slotsPerDay);
    const when = slotRangeLabel(a.windowSlots[0], a.duration, slotsPerDay);
    // Dang rut gon cho cot hep: "T6·6-9" thay vi "Thứ 6 tiết 6-9".
    const whenShort = `T${day + 2 > 8 ? "CN" : day + 2}·${period + 1}${
      a.duration > 1 ? `-${period + a.duration}` : ""
    }`;
    const sameCoordinator = a.coordinator === b.coordinator;

    const item = {
      id: `${type}:${pairKey(a.sectionId, b.sectionId)}`,
      type,
      teacherId,
      teacherName: a.teacherName,
      sectionIds: [a.sectionId, b.sectionId],
      sections: [
        { ...a, classCode: classCodeById.get(a.sectionId) },
        { ...b, classCode: classCodeById.get(b.sectionId) },
      ],
      day,
      when,
      whenShort,
      title: `${codeOf(a.sectionId)} ⟷ ${codeOf(b.sectionId)}`,
      // Dong gon cho trang thai thu gon - chi ten mon, khong lap lai gio.
      brief: a.courseName === b.courseName ? a.courseName : `${a.courseName} / ${b.courseName}`,
      detail: dup
        ? `${a.courseName} — hai dòng giống hệt nhau: cùng giảng viên, cùng mã lớp, cùng ${when}.`
        : `${a.courseName === b.courseName ? a.courseName : `${a.courseName} / ${b.courseName}`} — cùng ${when}.`,
      coordinators: [...new Set([a.coordinator, b.coordinator].filter(Boolean))],
      sameCoordinator,
      crossProgram: khacChuongTrinh(a, b),
    };
    items.push(item);
    explainedBy.set(a.sectionId, item.id);
    explainedBy.set(b.sectionId, item.id);
  }

  // --- 1b. Trung gio tren VI TRI THAT dang nam tren luoi ---
  // Bat cac vu ma nguon 1 khong thay: buoi bi keo-tha sua tay, va buoi cua GV co
  // huu. Gop vao cung ho id `CLASH:<cap>` nen neu nguon 1 da bao roi thi bo qua,
  // khong dem hai lan.
  const daCo = new Set(items.map((it) => it.id));
  for (const { teacherId, a, b } of scanPlacedClashes(daXepCuaKhoa, cungBuoi)) {
    // Giu nguyen phan loai "nghi trung lap" khi hai buoi giong het nhau: neu chi
    // biet chung dung gio thi se bao thanh "trùng giảng viên" va mat hoan toan
    // goi y doi chieu file nguon - trong khi day moi la cach xu ly dung.
    const trungLap = a.courseName && a.courseName === b.courseName
      && a.duration === b.duration && a.slot === b.slot;
    const type = trungLap ? PROBLEM_TYPE.DUPLICATE : PROBLEM_TYPE.CLASH;
    const id = `${type}:${pairKey(a.id, b.id)}`;
    // Nguon 1 co the da bao cap nay duoi phan loai KIA (vd DUPLICATE) - kiem ca
    // hai ho id, khong thi mot cap se hien hai lan voi hai nhan khac nhau.
    if (daCo.has(id) || daCo.has(`${PROBLEM_TYPE.CLASH}:${pairKey(a.id, b.id)}`)
      || daCo.has(`${PROBLEM_TYPE.DUPLICATE}:${pairKey(a.id, b.id)}`)) continue;
    daCo.add(id);

    const { day, period } = slotToDayPeriod(a.slot, slotsPerDay);
    const when = slotRangeLabel(a.slot, a.duration ?? 1, slotsPerDay);
    const whenShort = `T${day + 2 > 8 ? "CN" : day + 2}·${period + 1}${
      (a.duration ?? 1) > 1 ? `-${period + a.duration}` : ""
    }`;
    // Uu tien dong da co san trong "khung gio da bao" (co day du ten CTDT/dieu
    // phoi vien); buoi co huu khong co dong do thi dung thang du lieu cua lesson.
    const nhu = (l) => ({
      ...(rowById.get(l.id) ?? {
        sectionId: l.id, teacherId: l.teacherId, teacherName: l.teacherName,
        courseName: l.courseName, programLabel: l.programLabel,
        program: l.program, programIds: l.programIds,
        coordinator: l.coordinator, duration: l.duration, windowSlots: [l.slot],
      }),
      classCode: classCodeById.get(l.id),
    });
    const ra = nhu(a);
    const rb = nhu(b);
    const dangCho = pendingMove
      && (a.id === pendingMove.sectionId || b.id === pendingMove.sectionId);

    const item = {
      id,
      type,
      teacherId,
      teacherName: a.teacherName,
      sectionIds: [a.id, b.id],
      sections: [ra, rb],
      day,
      when,
      whenShort,
      title: `${codeOf(a.id)} ⟷ ${codeOf(b.id)}`,
      brief: ra.courseName === rb.courseName ? ra.courseName : `${ra.courseName} / ${rb.courseName}`,
      detail: trungLap
        ? `${ra.courseName} — hai dòng giống hệt nhau: cùng giảng viên, cùng mã lớp, cùng ${when}.`
        : `${ra.courseName === rb.courseName ? ra.courseName : `${ra.courseName} / ${rb.courseName}`} — cùng ${when}${dangCho ? " (do buổi vừa kéo, chưa lưu)" : ""}.`,
      coordinators: [...new Set([ra.coordinator, rb.coordinator].filter(Boolean))],
      sameCoordinator: ra.coordinator === rb.coordinator,
      crossProgram: khacChuongTrinh(ra, rb),
      pendingMove: dangCho,
    };
    items.push(item);
    if (!explainedBy.has(a.id)) explainedBy.set(a.id, id);
    if (!explainedBy.has(b.id)) explainedBy.set(b.id, id);
  }

  // --- 1c. GOM cac cap trung lap cua CUNG MOT NHOM lai thanh MOT muc ---
  //
  // Quet o tren lam theo TUNG CAP. Ba lop giong het nhau sinh ra ba cap
  // (A-B, A-C, B-C) nen hop thu hien "SAS3021 ⟷ SAS3021" ba dong y het nhau -
  // doc khong ra la co MAY lop trung, ma dem so van de cung phong len. Nhom ba
  // dong do la MOT viec can lam: doi chieu file goc, xoa bot dong thua.
  //
  // Gom bang hop-nhom (union-find) tren sectionId thay vi gom theo khoa
  // (GV + gio + mon): hai cap chung mot buoi thi CHAC CHAN cung mot nhom, khong
  // phai doan bang cach dung khoa nao.
  {
    const cha = new Map();
    const tim = (x) => {
      while (cha.get(x) !== x) {
        cha.set(x, cha.get(cha.get(x)));
        x = cha.get(x);
      }
      return x;
    };
    const noi = (x, y) => {
      for (const v of [x, y]) if (!cha.has(v)) cha.set(v, v);
      const rx = tim(x), ry = tim(y);
      if (rx !== ry) cha.set(rx, ry);
    };
    const capTrung = items.filter((it) => it.type === PROBLEM_TYPE.DUPLICATE);
    for (const it of capTrung) noi(it.sectionIds[0], it.sectionIds[1]);

    const theoNhom = new Map();
    for (const it of capTrung) {
      const goc = tim(it.sectionIds[0]);
      if (!theoNhom.has(goc)) theoNhom.set(goc, []);
      theoNhom.get(goc).push(it);
    }

    const gopLai = [];
    for (const nhom of theoNhom.values()) {
      if (nhom.length === 1) {
        gopLai.push(nhom[0]);
        continue;
      }
      const dau = nhom[0];
      // Giu thu tu on dinh theo sectionId de nhan/id khong nhay moi lan giai lai.
      const ids = [...new Set(nhom.flatMap((it) => it.sectionIds))].sort((a, b) => a - b);
      const secs = [];
      for (const it of nhom) {
        for (const sec of it.sections) {
          if (!secs.some((x) => (x.sectionId ?? x.id) === (sec.sectionId ?? sec.id))) secs.push(sec);
        }
      }
      const ma = [...new Set(ids.map((id) => codeOf(id)))];
      const item = {
        ...dau,
        id: `${PROBLEM_TYPE.DUPLICATE}:${ids.join("-")}`,
        sectionIds: ids,
        sections: secs,
        // Cung mot ma lop lap N lan thi ghi "SAS3021 ×3" - "A ⟷ A ⟷ A" khong
        // them thong tin gi ma con dai.
        title: ma.length === 1 ? `${ma[0]} ×${ids.length}` : ma.join(" ⟷ "),
        detail: `${dau.brief} — ${ids.length} dòng giống hệt nhau (cùng giảng viên, cùng mã lớp, cùng ${dau.when}): ${ma.join(", ")}.`,
        coordinators: [...new Set(nhom.flatMap((it) => it.coordinators))],
        sameCoordinator: nhom.every((it) => it.sameCoordinator),
        crossProgram: nhom.some((it) => it.crossProgram),
        soDongTrung: ids.length,
      };
      gopLai.push(item);
      for (const id of ids) explainedBy.set(id, item.id);
    }

    const idGop = new Set(capTrung.map((it) => it.id));
    items.splice(0, items.length,
      ...items.filter((it) => !idGop.has(it.id)), ...gopLai);
  }

  // --- 1d. TRUNG LICH SINH VIEN: hai lop cua cung mot nhom (CTDT x Khoa) ---
  //
  // Nguon thu tu, doc lap han ba nguon tren: chung deu xoay quanh GIANG VIEN
  // ("mot nguoi khong day hai cho"), con day la NGUOI HOC ("mot nguoi khong hoc
  // hai cho"). Truoc day khong ai kiem, nen mot lich "khong trung" theo he thong
  // van co the bat sinh vien FTH khoa 2023 co mat o hai giang duong cung tiet.
  //
  // Quet tren VI TRI THAT dang nam tren luoi (daXep, da ap ban keo-tha chua luu)
  // chu khong tren khung gio da bao - cung ly le voi scanPlacedClashes.
  //
  // KHONG ghi vao explainedBy: mot buoi co the vua trung giang vien vua trung sinh
  // vien, do la hai viec phai sua khac nhau, khong duoc nuot mat mot cai.
  for (const vu of cacVuTrung(data, daXep)) {
    const { day, period } = slotToDayPeriod(vu.slot, slotsPerDay);
    const la = daXep.find((l) => l.id === vu.a);
    const lb = daXep.find((l) => l.id === vu.b);
    const when = slotRangeLabel(vu.slot, Math.max(la?.duration ?? 1, lb?.duration ?? 1), slotsPerDay);
    const nhu = (l) => ({
      ...(rowById.get(l.id) ?? {
        sectionId: l.id, teacherId: l.teacherId, teacherName: l.teacherName,
        courseName: l.courseName, programLabel: l.programLabel,
        duration: l.duration, windowSlots: [l.slot],
      }),
      classCode: classCodeById.get(l.id),
    });
    const ten = [la?.courseName, lb?.courseName].filter(Boolean);
    items.push({
      id: `${PROBLEM_TYPE.SINH_VIEN}:${pairKey(vu.a, vu.b)}`,
      type: PROBLEM_TYPE.SINH_VIEN,
      teacherId: null,
      teacherName: null,
      sectionIds: [vu.a, vu.b],
      sections: [la, lb].filter(Boolean).map(nhu),
      day,
      when,
      whenShort: `T${day + 2 > 8 ? "CN" : day + 2}·${period + 1}`,
      title: `${codeOf(vu.a)} ⟷ ${codeOf(vu.b)}`,
      // Nhan nhom la thong tin dat gia nhat o dong gon: no tra loi ngay "ai bi
      // anh huong", thay vi bat nguoi doc tu doi chieu CTDT cua hai lop.
      brief: `${vu.nhan} — ${ten.join(" / ")}`,
      detail: `Sinh viên ${vu.nhan} phải học cả ${ten.join(" và ")} — cùng ${when}.`,
      nhomSinhVien: vu.nhan,
      coordinators: [...new Set([rowById.get(vu.a)?.coordinator,
                                 rowById.get(vu.b)?.coordinator].filter(Boolean))],
    });
  }

  // --- 2. Buoi CP-SAT khong xep duoc ---
  // Neu da co cap dung gio giai thich roi thi KHONG tao muc moi, chi gan them
  // "hau qua" vao muc do - day la cho khu trung lap chinh.
  if (unplacedReport) {
    for (const u of unplacedReport.items) {
      const cause = explainedBy.get(u.id);
      if (cause) {
        const owner = items.find((it) => it.id === cause);
        if (owner) {
          owner.unplacedIds = [...(owner.unplacedIds ?? []), u.id];
        }
        continue;
      }
      if (u.reason === UNPLACED_REASON.NOT_SUBMITTED) continue; // se do muc "chua co gio" lo

      const row = rowById.get(u.id);
      items.push({
        id: `${PROBLEM_TYPE.UNPLACED}:${u.id}`,
        type: PROBLEM_TYPE.UNPLACED,
        teacherId: u.teacherId,
        teacherName: u.teacherName,
        sectionIds: [u.id, ...u.blockers.map((b) => b.lesson.id)],
        sections: row ? [{ ...row, classCode: classCodeById.get(u.id) }] : [],
        day: u.windows[0]?.day ?? null,
        when: u.windows[0]?.label ?? "—",
        whenShort: u.windows[0] ? `T${u.windows[0].day + 2}` : "—",
        title: codeOf(u.id),
        brief: u.courseName,
        detail: `${u.courseName} — ${REASON_META[u.reason].label.toLowerCase()}.`,
        coordinators: [u.coordinator].filter(Boolean),
        blockers: u.blockers,
        unplacedIds: [u.id],
      });
      explainedBy.set(u.id, `${PROBLEM_TYPE.UNPLACED}:${u.id}`);
    }
  }

  // --- 2b. Buoi CO HUU (Giai doan 2) khong xep duoc ---
  //
  // Truoc day Giai doan 2 khong the co buoi nao "khong xep duoc": mo hinh ep moi
  // lop phai xep, xep het thi OPTIMAL, khong thi INFEASIBLE mat trang ket qua
  // (xem chu thich o scheduler_core.solve_resident_phase). Nay GD2 GHIM gio da
  // chot trong file, nen se co lop khong xep duoc that - hay gap nhat la file khai
  // HAI lop khac nhau cho CUNG mot nguoi vao CUNG mot o gio. Phai bao ra kem thu
  // pham de giao vu sap lai, thay vi im lang thieu buoi tren luoi.
  for (const u of residentResult?.unplaced ?? []) {
    if (explainedBy.has(u.id)) continue;
    const row = rowById.get(u.id);
    const viTri = u.pinnedLabel ? `giờ đã chốt ${u.pinnedLabel}` : "chưa có giờ cụ thể";
    const doAi = u.blockers?.length
      ? ` — đang bị ${u.blockers.map((b) => codeOf(b.sectionId)).join(", ")} chiếm chỗ`
      : "";
    items.push({
      id: `${PROBLEM_TYPE.UNPLACED}:${u.id}`,
      type: PROBLEM_TYPE.UNPLACED,
      teacherId: u.teacherId,
      teacherName: u.teacherName,
      sectionIds: [u.id, ...(u.blockers ?? []).map((b) => b.sectionId)],
      sections: row ? [{ ...row, classCode: classCodeById.get(u.id) }] : [],
      day: u.pinnedSlot != null ? slotToDayPeriod(u.pinnedSlot, slotsPerDay).day : null,
      when: u.pinnedLabel ?? "—",
      whenShort:
        u.pinnedSlot != null ? `T${slotToDayPeriod(u.pinnedSlot, slotsPerDay).day + 2}` : "—",
      title: codeOf(u.id),
      brief: u.courseName,
      detail: `${u.courseName} — cơ hữu, ${viTri}${doAi}.`,
      coordinators: [u.coordinator].filter(Boolean),
      blockers: (u.blockers ?? []).map((b) => ({
        lesson: { id: b.sectionId, courseName: b.courseName, teacherName: b.teacherName },
        atLabels: [b.slotLabel],
      })),
      unplacedIds: [u.id],
    });
    explainedBy.set(u.id, `${PROBLEM_TYPE.UNPLACED}:${u.id}`);
  }

  // --- 3. Buoi chua co gio, gom theo dieu phoi vien ---
  // Lop cua NHIEU chuong trinh ("BCSE+MJM") co nhieu dieu phoi vien - no phai hien
  // trong viec-can-lam cua TUNG NGUOI, chu khong gom thanh mot muc chung mang ten
  // ca hai (luc do ca hai deu tuong nguoi kia lo).
  const missingByCoord = new Map();
  for (const r of sq.queue) {
    for (const key of r.coordinators?.length ? r.coordinators : [r.coordinator || "(không rõ)"]) {
      if (!missingByCoord.has(key)) missingByCoord.set(key, []);
      missingByCoord.get(key).push(r);
    }
  }
  for (const [coordinator, list] of missingByCoord) {
    items.push({
      id: `${PROBLEM_TYPE.MISSING_HOURS}:${coordinator}`,
      type: PROBLEM_TYPE.MISSING_HOURS,
      teacherId: null,
      teacherName: null,
      sectionIds: list.map((r) => r.sectionId),
      sections: list.map((r) => ({ ...r, classCode: classCodeById.get(r.sectionId) })),
      day: null,
      when: null,
      whenShort: `${list.length} buổi`,
      // Voi loai nay, dong gon nhat la TEN NGUOI phai lam - khong phai ma buoi.
      title: coordinator,
      brief: list
        .slice(0, 4)
        .map((r) => codeOf(r.sectionId))
        .join(" ") + (list.length > 4 ? ` +${list.length - 4}` : ""),
      detail: `${coordinator} phụ trách — ${list
        .slice(0, 3)
        .map((r) => codeOf(r.sectionId))
        .join(", ")}${list.length > 3 ? `, +${list.length - 3}` : ""}.`,
      coordinators: [coordinator],
    });
  }

  // --- 4. Mot giang vien bi xep CA HAI CO SO trong cung mot ngay ---
  // Hoa Lac va My Dinh cach rat xa, khong di chuyen kip trong ngay (xem
  // QUY-TRINH-NGHIEP-VU-XEP-TKB.md muc 6). Solver da tranh o nhung cho no duoc
  // quyen chon (webapp/scheduler_core.py: _rang_buoc_khu_vuc), nhung phan lon
  // gio la CHOT SAN trong file - nhung ca do chi con cach bao ra de giao vu tu
  // xu ly, khong ai go duoc bang thuat toan.
  const theoGvNgay = new Map();
  for (const l of daXepCuaKhoa) {
    if (!l.khuVuc || l.day == null) continue;
    for (const tid of l.teacherIds?.length ? l.teacherIds : [l.teacherId]) {
      const k = `${tid}|${l.day}`;
      if (!theoGvNgay.has(k)) theoGvNgay.set(k, { tid, day: l.day, theoKv: new Map() });
      const o = theoGvNgay.get(k).theoKv;
      if (!o.has(l.khuVuc)) o.set(l.khuVuc, []);
      o.get(l.khuVuc).push(l);
    }
  }
  for (const { tid, day, theoKv } of theoGvNgay.values()) {
    if (theoKv.size < 2) continue;
    const buoi = [...theoKv.values()].flat().sort((a, b) => a.slot - b.slot);
    const noi = [...theoKv.keys()].map(
      (kv) => theoKv.get(kv)[0].location || kv,
    );
    items.push({
      id: `${PROBLEM_TYPE.KHAC_CO_SO}:${tid}:${day}`,
      type: PROBLEM_TYPE.KHAC_CO_SO,
      teacherId: tid,
      teacherName: buoi[0].teacherName,
      sectionIds: buoi.map((l) => l.id),
      sections: buoi.map((l) => ({ ...l, classCode: classCodeById.get(l.id) })),
      day,
      when: DAY_LABELS[day],
      whenShort: `T${day + 2}`,
      title: buoi[0].teacherName,
      brief: noi.join(" ↔ "),
      detail:
        `${buoi[0].teacherName} bị xếp ở ${noi.join(" và ")} trong cùng ${DAY_LABELS[day]}` +
        ` — ${buoi.map((l) => `${codeOf(l.id)} (${l.location})`).join(", ")}.` +
        " Hai cơ sở cách nhau rất xa, không di chuyển kịp trong ngày.",
      coordinators: [],
    });
  }

  // --- 5. Mot giang vien phai len CUNG MOT CO SO qua nhieu ngay trong tuan ---
  //
  // Khac han muc 4: o do la hai co so trong MOT ngay (khong di chuyen kip trong
  // ngay); o day la MOT co so nhung rai ra nhieu ngay - lich van dung duoc, chi
  // la nguoi day phai vuot 30km len Hoa Lac ba lan cho sau tiet.
  //
  // Solver DA gom o nhung cho no duoc quyen chon (webapp/scheduler_core.py:
  // _phat_chuyen_di, muc 4 cua ham muc tieu). Nen chi bao khi con lop DANG GHIM:
  // do la thu duy nhat giao vu lam duoc them. Khong con lop ghim nao ma van rai
  // ra nhieu ngay thi thuat toan da het cach (khung gio giang vien da khai,
  // phong, hoac trung voi lop khac) - nhac nua chi lam day hop thu.
  const khoiCaHoc = data?.khoiCaHoc ?? {};
  // GHIM doc tu result.overrides - do la nguon that su ma solver ne theo, va no
  // gom CA gio chot trong file (webapp/domain/pinning.py: ghim_gio_da_chot) lan
  // ghim tay, dong thoi da tru cac lop vua bam "Bo ghim". Suy lai tu timeAssumed
  // ben data.classes se sai o dung cho do.
  const daGhim = new Set();
  for (const res of [guestResult, residentResult]) {
    for (const sid of Object.keys(res?.overrides ?? {})) daGhim.add(Number(sid));
  }

  const theoGvKhuVuc = new Map();
  for (const l of daXepCuaKhoa) {
    if (!l.khuVuc || l.day == null) continue;
    for (const tid of l.teacherIds?.length ? l.teacherIds : [l.teacherId]) {
      const k = `${tid}|${l.khuVuc}`;
      if (!theoGvKhuVuc.has(k)) theoGvKhuVuc.set(k, { tid, khuVuc: l.khuVuc, buoi: [] });
      theoGvKhuVuc.get(k).buoi.push(l);
    }
  }
  for (const { tid, khuVuc, buoi } of theoGvKhuVuc.values()) {
    const ngays = [...new Set(buoi.map((l) => l.day))].sort((a, b) => a - b);
    const sucChua = sucChuaMotNgay(khoiCaHoc, khuVuc);
    if (!sucChua) continue;               // co so khong rang buoc khoi -> khong bao

    // SO NGAY IT NHAT: dua vao TONG SO TIET, khong phai so lop. Buoi cua cung
    // mot ngay cong don lai; het suc chua mot ngay thi buoc phai sang ngay khac.
    // Chi bao khi so ngay THUC TE nhieu hon con so nay - tuc that su con gom
    // duoc. Bang nhau la da toi uu, du la 4 ngay: mot thay day so tiet le thi
    // di nhien co mot buoi le, do la bat kha khang chu khong phai lich xau.
    const tongTiet = buoi.reduce((n, l) => n + (l.duration ?? 0), 0);
    const itNhat = Math.max(1, Math.ceil(tongTiet / sucChua));
    if (ngays.length <= itNhat) continue;

    // Con phai CO LOP DANG GHIM thi giao vu moi lam duoc gi (bo ghim rooi giai
    // lai). Khong con lop ghim nao ma van rai ra thi thuat toan da het cach.
    const ghim = buoi.filter((l) => daGhim.has(l.id)).sort((a, b) => a.slot - b.slot);
    if (ghim.length === 0) continue;

    const noi = buoi[0].location || khuVuc;
    const ten = buoi[0].teacherName;
    const ke = ghim.slice(0, 3).map((l) => codeOf(l.id)).join(", ");
    items.push({
      id: `${PROBLEM_TYPE.DI_LAI}:${tid}:${khuVuc}`,
      type: PROBLEM_TYPE.DI_LAI,
      teacherId: tid,
      teacherName: ten,
      // CHI cac lop DANG GHIM, khong phai ca ${buoi.length} lop: day la danh sach
      // viec phai lam (bo ghim lop nao), va cung la cac the duoc danh dau tren
      // luoi - danh dau ca nhung lop solver da tu xep toi uu chi lam nhieu the
      // co dau "!" ma khong chi ra duoc phai dong vao dau.
      sectionIds: ghim.map((l) => l.id),
      sections: ghim.map((l) => ({ ...l, classCode: classCodeById.get(l.id) })),
      day: ngays[0],
      when: ngays.map((d) => DAY_LABELS[d]).join(", "),
      whenShort: `${ngays.length}→${itNhat} ngày`,
      title: ten,
      brief: `${noi} · ${ngays.length} ngày, gom được còn ${itNhat}`,
      detail:
        `${ten} phải lên ${noi} ${ngays.length} ngày trong tuần`
        + ` (${ngays.map((d) => DAY_LABELS[d]).join(", ")}) cho ${buoi.length} lớp,`
        + ` tổng ${tongTiet} tiết — gom lại chỉ cần ${itNhat} ngày`
        + ` (mỗi ngày ở ${noi} chứa được tối đa ${sucChua} tiết).`
        + ` ${ghim.length} lớp đang ghim: ${ke}${ghim.length > 3 ? `, +${ghim.length - 3}` : ""}.`
        + ` Bỏ ghim rồi giải lại để hệ thống dồn về ít ngày hơn.`,
      coordinators: [],
    });
  }

  items.sort(
    (x, y) =>
      PROBLEM_META[x.type].severity - PROBLEM_META[y.type].severity ||
      (x.day ?? 99) - (y.day ?? 99) ||
      (x.sectionIds[0] ?? 0) - (y.sectionIds[0] ?? 0),
  );

  // --- 5. VỤ MÀ MỌI LỚP LIÊN QUAN ĐỀU ĐÃ CHỐT LỊCH -> không tính là vấn đề ---
  //
  // "Chốt lịch" là một CAM KẾT với giảng viên (xem webapp/domain/chot.py): hệ
  // thống từ chối mọi thao tác đổi giờ cho tới khi có người bấm Bỏ chốt. Nên một
  // vụ mà CẢ HAI bên đều đã chốt thì không còn việc gì để làm — báo đỏ nó chỉ làm
  // hộp thư đầy và che mất những vụ còn sửa được.
  //
  // ĐIỀU KIỆN LÀ **MỌI** LỚP, không phải một lớp: còn một bên chưa chốt thì vẫn
  // đổi giờ bên đó được, tức vẫn là việc phải làm. Trên dữ liệu thật đây đúng là
  // ranh giới đáng kể: 26 vụ trùng lịch sinh viên tách thành 21 vụ "cả hai đã
  // chốt" và 5 vụ còn gỡ được — 5 vụ đó mới là thứ đáng hiện lên đỏ.
  //
  // KHÔNG XÓA mà chuyển sang danh sách riêng: người dùng vẫn phải tra cứu được
  // "khóa này có đụng gì không" khi ngồi đàm phán lại với giảng viên.
  const chotCuaLop = new Map((data?.classes ?? []).map((c) => [c.sectionId, !!c.sectionChot]));
  const moiLopDaChot = (it) =>
    LOAI_HA_CAP_KHI_CHOT.has(it.type)
    && (it.sectionIds ?? []).length > 0
    && it.sectionIds.every((sid) => chotCuaLop.get(sid));

  const daChotItems = items.filter(moiLopDaChot).map((it) => ({ ...it, daChot: true }));
  const conPhaiLam = items.filter((it) => !moiLopDaChot(it));

  const byType = {};
  for (const it of conPhaiLam) byType[it.type] = (byType[it.type] ?? 0) + 1;

  return {
    items: conPhaiLam,
    // Vụ đã lặng: không tính vào `total`, không tô cảnh báo lên thẻ trên lưới
    // (buildScheduleView chỉ đọc `items`), chỉ nằm trong một mục thu gọn cuối
    // hộp thư để tra cứu.
    daChotItems,
    byType,
    total: conPhaiLam.length,
    // So BUOI bi anh huong - khac so VU. Mot vu dung gio anh huong 2 buoi.
    affectedSections: new Set(conPhaiLam.flatMap((i) => i.sectionIds)).size,
    missingHoursCount: sq.queue.length,
    // Lop chua ghi cot Khoa -> khong quy duoc ve nhom sinh vien nao nen KHONG
    // duoc kiem trung. Phai hien ra canh con so vu trung, khong thi "0 vu" bi doc
    // thanh "ca khoa sach" (xem adapters/nhomSinhVien.js).
    chuaGhiKhoaCount: lopChuaGhiKhoa(data).length,
    slotsPerDay,
    numDays: sq.numDays,
    // Da tinh san o tren (unplacedReport, dung ca cho phan "Khong xep duoc" cua
    // items) - tra ra luon de tab "Chua xep duoc" (ProblemInbox) dung lai,
    // khong phai tinh trung mot lan nua.
    unplacedReport,
  };
}
