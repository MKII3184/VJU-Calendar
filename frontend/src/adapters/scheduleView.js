// Nguon du lieu cho man "Thoi khoa bieu" gop. Mot bo loc duy nhat quyet dinh
// nhin thay gi - thay cho viec truoc day moi pham vi la mot man rieng:
//   Giai doan 1  = layers{guest} + phase view
//   Giai doan 2  = layers{guest+resident}
//   Tra cuu GV   = scope{teacher}
//
// Bang mat do (navigator) cung tinh o day: no la thu bu lai cho viec luoi phai
// cuon khi the hien du thong tin ca hoc.

import { lessonToTimetableItem, mergeGuestAndResidentLessons } from "./lessonAdapter";
import { buoiThuoc, coPhamVi, moTa as moTaPhamVi } from "./phamVi";

// Chương trình và Khoá là hai ô lọc ĐA LỰA CHỌN, ghép (AND) với nhau - "FTH khoá
// 2024" là một nhóm người học có thật (xem adapters/nhomSinhVien.js). Trong mỗi ô
// các giá trị đã chọn là HỢP (OR). Mảng rỗng = không lọc. Danh sách khoá đi theo
// các chương trình đang chọn.
export const DEFAULT_FILTER = {
  programs: [],
  khoas: [],
  guest: true,
  resident: true,
  search: "",
  colorBy: "status",
  onlyProblems: false,
  // Chi hien cac buoi thuoc PHAM VI DANG XEP (chon o PhamViXepPanel). Khong luu
  // chinh pham vi vao bo loc ma chi luu mot co bat/tat: pham vi doi thi cai
  // dang xem phai doi theo ngay, khong om mot ban sao cu.
  chiXemPhamVi: false,
};

// Buoi nay va mot buoi khac CUNG GIANG VIEN, CUNG NGAY nhung KHAC CO SO -> tra ve
// ten co so kia. Doc tu chinh vu KHAC_CO_SO cua hop thu (adapters/problemInbox.js)
// chu khong quet lai: mot luat chi duoc co mot ban.
function coSoKhacCungNgay(lesson, problems) {
  const vu = (problems ?? []).find((p) => p.type === "KHAC_CO_SO");
  if (!vu) return null;
  const khac = (vu.sections ?? []).find(
    (x) => x.khuVuc && x.khuVuc !== lesson.khuVuc,
  );
  return khac ? khac.location || khac.khuVuc : null;
}

// Buoi "co van de" = nam trong bat ky vu nao cua hop thu.
function buildProblemSectionMap(inbox) {
  const map = new Map();
  for (const it of inbox?.items ?? []) {
    for (const sid of it.sectionIds) {
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid).push(it);
    }
  }
  return map;
}

export function buildScheduleView({ data, guestResult, residentResult, inbox, filter, phamVi }) {
  const f = { ...DEFAULT_FILTER, ...(filter ?? {}) };
  const numDays = data?.numDays ?? 7;
  const slotsPerDay = data?.slotsPerDay ?? 12;

  const all = mergeGuestAndResidentLessons(
    guestResult?.lessons ?? [],
    residentResult?.lessons ?? [],
  ).map((l) => (l.id != null ? l : lessonToTimetableItem(l)));

  const problemMap = buildProblemSectionMap(inbox);
  // Metadata ghim (reason/problem/pinFailed) nam o result.overrides[sid], KHONG
  // nam tren tung lesson - backend gan rieng vi 1 buoi co the dang trong
  // 'unplaced' (chua co lesson) luc override duoc tao. Ghep lai o day theo dung
  // phase cua tung buoi (GUEST doc tu guestResult, RESIDENT tu residentResult).
  const guestOverrides = guestResult?.overrides ?? {};
  const residentOverrides = residentResult?.overrides ?? {};

  // Ma lop hoc phan (vd "CSE3003-1") de hien THAY CHO "#<id noi bo>" tren the/
  // popup/hop thoai - id chi co nghia voi backend, giao vu nhan dien lop qua ma
  // lop. lesson (tu guestResult/residentResult) khong tu co field nay, phai
  // noi voi data.classes (bang mirror) qua sectionId.
  const classCodeById = new Map((data?.classes ?? []).map((c) => [c.sectionId, c.classCode]));
  // Khoa (cot "Khóa", vd VJU2026) khong nam tren lesson - noi tu bang lop qua
  // sectionId, cung cach lam voi classCode. Khong bat solver phai mang thong tin
  // hanh chinh nay chi de loc o giao dien.
  // O GHEP ("BCSE+MJM", "VJU2023+VJU2024") = lop cua CA HAI - loc theo THANH
  // PHAN, xem app._tach_phan(). Noi tu bang lop qua sectionId nhu classCode.
  const cohortById = new Map((data?.classes ?? []).map((c) => [c.sectionId, c.cohortParts ?? []]));
  const programPartsById = new Map((data?.classes ?? []).map((c) => [c.sectionId, c.programParts ?? []]));
  // Si so - the HOC CHUNG cong don de biet phong phai chua bao nhieu nguoi.
  const sinhVienById = new Map((data?.classes ?? []).map((c) => [c.sectionId, c.expectedStudents]));
  // "O giang vien la mot DON VI dieu phoi" (Phong Dao tao, JLE...) - khac boQua:
  // boQua la co giao vu DA bam bo qua, con donViDieuPhoi chi la nhan dien du lieu.
  // Lop ung vien chua bam bo qua van hien "Phong Dao tao dieu phoi" o cot GV nen
  // bang TKB khong duoc ghi loai "Thinh giang" cho no (xem LessonTable).
  const donViDieuPhoiById = new Map(
    (data?.classes ?? []).map((c) => [c.sectionId, !!c.donViDieuPhoi]),
  );

  const withFlags = all.map((l) => {
    const ovMap = l.teacherType === "RESIDENT" ? residentOverrides : guestOverrides;
    const override = ovMap[l.id] ?? ovMap[String(l.id)] ?? null;
    return {
      ...l,
      classCode: classCodeById.get(l.id) || null,
      donViDieuPhoi: donViDieuPhoiById.get(l.id) ?? false,
      cohortParts: cohortById.get(l.id) ?? [],
      programParts: programPartsById.get(l.id) ?? [],
      problems: problemMap.get(l.id) ?? [],
      hasProblem: problemMap.has(l.id),
      // Ten CO SO KHAC ma chinh giang vien nay con phai day trong cung ngay -
      // popup chi tiet in thang ra de giao vu doi chieu duoc ngay, khong phai mo
      // hop thu van de roi tu ghep. null = khong sao.
      khacCoSo: coSoKhacCungNgay(l, problemMap.get(l.id)),
      override,
      isPinned: !!override,
      hocChungId: l.hocChungId ?? null,
    };
  });

  // --- HOC CHUNG: gop cac buoi cung nhom thanh MOT THE ---------------------
  // Chung o CUNG mot o gio (solver ep vay - xem webapp/domain/hoc_chung.py) nen
  // neu de nguyen thi N the ve de len nhau trong mot o, khong doc duoc cai nao.
  // Mot buoi day vat ly thi mot the: giu buoi DAI DIEN, gan them danh sach cac
  // mon cung hoc de the/popup ke ra.
  //
  // Hop programParts/cohortParts/teacherIds cua ca nhom: bo loc theo CTDT/Khoa/GV
  // phai tim ra the nay qua BAT KY thanh vien nao - lop hoc chung thuoc ve moi
  // chuong trinh trong nhom.
  const gopHocChung = (ds) => {
    const theoNhom = new Map();
    for (const l of ds) {
      if (l.hocChungId == null) continue;
      if (!theoNhom.has(l.hocChungId)) theoNhom.set(l.hocChungId, []);
      theoNhom.get(l.hocChungId).push(l);
    }
    if (theoNhom.size === 0) return ds;
    const bo = new Set();
    const gop = new Map();
    for (const [nhomId, ds2] of theoNhom) {
      if (ds2.length < 2) continue;
      const sx = [...ds2].sort((a, b) => a.id - b.id);
      const rep = sx[0];
      sx.slice(1).forEach((l) => bo.add(l.id));
      gop.set(rep.id, {
        ...rep,
        programParts: [...new Set(sx.flatMap((l) => l.programParts ?? []))],
        cohortParts: [...new Set(sx.flatMap((l) => l.cohortParts ?? []))],
        teacherIds: [...new Set(sx.flatMap((l) => l.teacherIds ?? [l.teacherId]))],
        problems: sx.flatMap((l) => l.problems ?? []),
        hasProblem: sx.some((l) => l.hasProblem),
        hocChung: {
          id: nhomId,
          count: sx.length,
          members: sx.map((l) => ({
            id: l.id, classCode: l.classCode, courseName: l.courseName,
            programLabel: l.programLabel,
            expectedStudents: sinhVienById.get(l.id) ?? null,
          })),
          tongSV: sx.reduce((t, l) => t + (sinhVienById.get(l.id) ?? 0), 0) || null,
        },
      });
    }
    return ds.filter((l) => !bo.has(l.id)).map((l) => gop.get(l.id) ?? l);
  };
  const daGop = gopHocChung(withFlags);

  const q = f.search.trim().toLowerCase();
  const gridLessons = daGop.filter((l) => {
    if (l.teacherType === "GUEST" && !f.guest) return false;
    if (l.teacherType === "RESIDENT" && !f.resident) return false;
    if (f.programs.length && !f.programs.some((p) => l.programParts.includes(p))) return false;
    if (f.khoas.length && !f.khoas.some((k) => l.cohortParts.includes(k))) return false;
    // PHAM VI XEP - doc lap voi bo loc "Xem" o tren: mot ben la "toi dang xep cho
    // ai", mot ben la "toi dang muon nhin gi". Ket hop duoc ca hai (vd dang xep
    // FTH nhung muon soi rieng mot GV cua FTH).
    if (f.chiXemPhamVi && coPhamVi(phamVi) && !buoiThuoc(l, phamVi)) return false;
    if (f.onlyProblems && !l.hasProblem) return false;
    return true;
  });
  const matchesSearch = (l) => !q || (
    String(l.id) === q ||
    (l.classCode ?? "").toLowerCase().includes(q) ||
    (l.courseName ?? "").toLowerCase().includes(q) ||
    (l.teacherName ?? "").toLowerCase().includes(q) ||
    (l.programLabel ?? "").toLowerCase().includes(q) ||
    l.cohortParts.some((k) => k.toLowerCase().includes(q)) ||
    (l.hocChung?.members ?? []).some(
      (m) => String(m.id) === q
        || (m.courseName ?? "").toLowerCase().includes(q)
        || (m.classCode ?? "").toLowerCase().includes(q),
    )
  );
  const lessons = q ? gridLessons.filter(matchesSearch) : gridLessons;
  const searchMatchIds = new Set(q ? lessons.map((lesson) => lesson.id) : []);

  // --- Bang mat do: moi o = so buoi DANG HIEN dang dien ra o thoi diem do ---
  const grid = Array.from({ length: numDays }, () => new Array(slotsPerDay).fill(0));
  const idsAt = Array.from({ length: numDays }, () =>
    Array.from({ length: slotsPerDay }, () => []),
  );
  for (const l of gridLessons) {
    if (l.day == null || l.period == null) continue;
    for (let k = 0; k < (l.duration || 1); k++) {
      const p = l.period + k;
      if (l.day < numDays && p < slotsPerDay) {
        grid[l.day][p] += 1;
        idsAt[l.day][p].push(l.id);
      }
    }
  }
  let maxDensity = 0;
  for (const row of grid) for (const v of row) if (v > maxDensity) maxDensity = v;

  // Danh sach de do bo loc pham vi
  const programs = [...new Set(withFlags.flatMap((l) => l.programParts))].sort((a, b) =>
    a.localeCompare(b),
  );
  // Khoa moi nhat len dau (VJU2026 truoc VJU2023) - giao vu hay xem khoa moi.
  //
  // LOC THEO CHUONG TRINH dang chon: xem FTH thi o Khoa chi nen liet ke khoa FTH
  // thuc su co lop, khong phai ca 8 khoa cua toan khoa roi chon nham mot khoa
  // khong co lop nao va tuong luoi hong. Cung luat voi PhamViXepPanel (o "Xep
  // cho") - hai cho hoi cung mot cau thi phai ra cung mot danh sach.
  const cohortsFor = (progs) => [
    ...new Set(
      withFlags
        .filter((l) => !progs.length || progs.some((p) => l.programParts.includes(p)))
        .flatMap((l) => l.cohortParts),
    ),
  ].sort().reverse();
  const cohorts = cohortsFor(f.programs);

  return {
    lessons,
    gridLessons,
    searchMatchIds,
    totalLessons: withFlags.length,
    // Dem lop CUA KHOA: buoi cua don vi khac dieu phoi (boQua) co mat tren luoi
    // de khong ai xep de vao, nhung no khong phai phan viec cua khoa nen khong
    // duoc cong vao con so tien do.
    guestCount: gridLessons.filter((l) => l.teacherType === "GUEST" && !l.boQua).length,
    residentCount: gridLessons.filter((l) => l.teacherType === "RESIDENT" && !l.boQua).length,
    donViKhacCount: gridLessons.filter((l) => l.boQua).length,
    problemCount: gridLessons.filter((l) => l.hasProblem).length,
    grid,
    idsAt,
    maxDensity,
    programs,
    cohorts,
    cohortsFor,
    numDays,
    slotsPerDay,
    filter: f,
    // Mang theo de scopeLabel/thanh loc goi ten duoc pham vi dang xep.
    phamVi: phamVi ?? null,
  };
}

// Nhan gon cho biet dang xem pham vi nao - dung o thanh tieu de.
export function scopeLabel(view, data) {
  const f = view.filter;
  // Dang xem dung phan minh xep: goi thang ten pham vi, khong bao "Toan khoa".
  if (f.chiXemPhamVi && coPhamVi(view.phamVi)) return moTaPhamVi(view.phamVi);
  // "FTH · Khoá VJU2024" - dung mot nhom nguoi hoc, doc la biet ngay dang nhin ai.
  const ten = [f.programs.join(", "), f.khoas.length ? `Khoá ${f.khoas.join(", ")}` : ""]
    .filter(Boolean).join(" · ");
  if (ten) return f.programs.length ? ten : `Toàn khoa · ${ten}`;
  return `Toàn khoa · ${data?.numPrograms ?? "?"} chương trình`;
}
