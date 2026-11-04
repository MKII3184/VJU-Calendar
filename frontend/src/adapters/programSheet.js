// Dung du lieu cho che do "BANG CHUONG TRINH" trong toan man hinh - bo cuc
// giong sheet TKB giay khoa van dung: hang = (Ngay, Tiet, Gio), cot = chuong
// trinh dao tao gom theo khoa, mot buoi nhieu tiet gop DOC dung so tiet.
//
// Khac voi LUOI (cot = ngay, cac buoi trung gio xep canh nhau): o day mot buoi
// xuat hien o MOI cot (khoa, chuong trinh) ma lop do phuc vu - lop "BCSE+MJM"
// hien o ca 2 cot, y nhu sheet giay cho sinh vien moi nganh doc cot cua minh.

import { DAY_LABELS } from "./dayPeriod";

// Gio chuan tung tiet theo khuon sheet TKB: tiet 50 phut + 10 phut nghi,
// sang tiet 1-5 (7:00-11:50), nghi trua 12:00-13:00, chieu-toi tiet 6 tro di
// (tiet 6 = 13:00). Khop cot "Time" trong file ke hoach giang day goc.
const GIO_SANG = 7 * 60;
const GIO_CHIEU = 13 * 60;
const TIET_SANG = 5;
const PHUT_MOT_TIET = 50;
const BUOC_TIET = 60;

const fm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export function gioTiet(period) {
  const start =
    period < TIET_SANG ? GIO_SANG + period * BUOC_TIET : GIO_CHIEU + (period - TIET_SANG) * BUOC_TIET;
  return `${fm(start)}–${fm(start + PHUT_MOT_TIET)}`;
}

export function dungSheetChuongTrinh(lessons = [], numDays = 7, slotsPerDay = 12) {
  const colByKey = new Map(); // `${cohort}\n${program}` -> {cohort, program}
  // O theo TIET BAT DAU: `${colKey}|${day}|${period}` -> {day, period, lessons:[]}
  const starts = new Map();
  const cuoi = (l) => Math.min((l.period ?? 0) + (l.duration || 1), slotsPerDay);

  for (const l of lessons) {
    if (l.day == null || l.period == null) continue;
    const khoas = l.cohortParts?.length ? l.cohortParts : ["—"];
    const ctdt = l.programParts?.length ? l.programParts : [l.programLabel || "—"];
    for (const k of khoas) {
      for (const p of ctdt) {
        const key = `${k}\n${p}`;
        if (!colByKey.has(key)) colByKey.set(key, { cohort: k, program: p });
        const cKey = `${key}|${l.day}|${l.period}`;
        if (!starts.has(cKey)) starts.set(cKey, { day: l.day, period: l.period, lessons: [] });
        starts.get(cKey).lessons.push(l);
      }
    }
  }

  // Gop cac o bi CHONG GIO vao o goc phu chung (hai buoi cung chuong trinh
  // bat dau khi buoi kia dang dien ra - dung tinh huong "co van de"). Neu de
  // nguyen theo tiet bat dau thi buoi bat dau sau bi o gop tren "nuot" mat
  // khoi bang - mat du lieu ngay cho can bao quan trong nhat.
  //
  // Duyet tung (cot, ngay) theo tiet tang dan: o nao nam trong vung gop cua o
  // truoc thi don buoi vao o do; rowspan cua o goc = can tren lon nhat cua
  // toan bo buoi chua trong no.
  const theoCotNgay = new Map(); // `${colKey}|${day}` -> [cells theo tiet tang]
  for (const [cKey, cell] of starts) {
    const ck = cKey.slice(0, cKey.lastIndexOf("|"));
    if (!theoCotNgay.has(ck)) theoCotNgay.set(ck, []);
    theoCotNgay.get(ck).push(cell);
  }

  const cells = new Map(); // cKey cua o GOC -> cell
  const covered = new Set(); // `${colKey}|${day}|${period}` bi gop doc phu
  const rowspan = new Map();
  for (const [ck, ds] of theoCotNgay) {
    ds.sort((a, b) => a.period - b.period);
    let goc = null; // o goc dang mo (co the nhan them buoi chong gio)
    for (const cell of ds) {
      if (goc && cell.period < goc.cuoi) {
        goc.lessons.push(...cell.lessons);
        goc.cuoi = Math.max(goc.cuoi, ...cell.lessons.map(cuoi));
      } else {
        goc = { ...cell, cuoi: Math.max(cell.period + 1, ...cell.lessons.map(cuoi)) };
        cells.set(`${ck}|${cell.period}`, goc);
      }
    }
  }
  for (const [cKey, g] of cells) {
    rowspan.set(cKey, g.cuoi - g.period);
    const ck = cKey.slice(0, cKey.lastIndexOf("|"));
    for (let p = g.period + 1; p < g.cuoi; p++) covered.add(`${ck}|${p}`);
  }

  // Cot gom theo KHOA: hang tieu de tren gop ngang qua cac chuong trinh cua
  // mot khoa ("Khoa VJU2024"), hang duoi la ma chuong trinh - dung bo cuc
  // dau bang cua sheet giay. Khoa xep tang dan (VJU2021 -> VJU2026).
  const khoaMap = new Map();
  for (const c of colByKey.values()) {
    if (!khoaMap.has(c.cohort)) khoaMap.set(c.cohort, []);
    khoaMap.get(c.cohort).push(c.program);
  }
  const khoas = [...khoaMap.keys()].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
  for (const ds of khoaMap.values()) ds.sort((a, b) => a.localeCompare(b, "vi"));

  const columns = khoas.flatMap((k) =>
    khoaMap.get(k).map((p) => ({ cohort: k, program: p, key: `${k}\n${p}` })),
  );

  return {
    days: DAY_LABELS.slice(0, numDays),
    slotsPerDay,
    khoas: khoas.map((k) => ({ cohort: k, programs: khoaMap.get(k) })),
    columns,
    cells,
    covered,
    rowspan,
    cellKey: (col, day, period) => `${col.key}|${day}|${period}`,
  };
}
