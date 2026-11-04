// Dựng dữ liệu cho file Excel XUẤT TỪ LƯỚI thời khóa biểu.
//
// Vì sao dựng ở đây chứ không để backend tự tính: yêu cầu là file xuất ra phải
// khớp ĐÚNG những gì đang hiện trên màn hình — cùng bộ lọc, cùng bố cục, cùng
// màu. Bộ lọc và bố cục đều là kết quả tính của giao diện (buildScheduleView +
// luoiLayout), nên nơi duy nhất biết chắc "màn hình đang hiện cái gì" là chính
// giao diện. Bắt backend đoán lại là mở đường cho hai bên lệch nhau.
//
// Backend chỉ việc ghi ra .xlsx (xem webapp/fate_export_luoi.py) — nó không
// quyết định gì cả.

import { chiaCotTheoNgay, soCotMoiNgay } from "./luoiLayout";
import { groupKeyOf, STATUS_COLORS } from "./colorGrouping";
import { getColor } from "./colorPalette";
import { DAY_LABELS } from "./dayPeriod";

// Đúng một màu mà thẻ trên lưới đang dùng — xem LessonCard: nhóm "Trạng thái"
// có bảng màu cố định, ba nhóm còn lại băm theo tên (getColor).
function mauCuaBuoi(lesson, colorBy) {
  const key = groupKeyOf(lesson, colorBy);
  return (colorBy === "status" ? STATUS_COLORS[key] : null) ?? getColor(key);
}

export function dungDuLieuXuatLuoi({ view, label, moTaBoLoc }) {
  const lessons = view?.lessons ?? [];
  const numDays = view?.numDays ?? 7;
  const slotsPerDay = view?.slotsPerDay ?? 12;
  const colorBy = view?.filter?.colorBy ?? "status";

  const layout = chiaCotTheoNgay(lessons);
  const soCot = soCotMoiNgay(lessons, layout, numDays);

  const cells = lessons
    .filter((l) => l.day != null && l.period != null)
    .map((l) => ({
      day: l.day,
      period: l.period,
      duration: l.duration || 1,
      col: layout[l.id]?.colIndex ?? 0,
      // Mã lớp học phần là cách giáo vụ nhận diện lớp; "#id" chỉ có nghĩa với
      // backend nên chỉ dùng khi thật sự không có mã (quy ước chung của dự án).
      maLop: l.classCode || `#${l.id}`,
      // HỌC CHUNG: một thẻ là MỘT buổi cho nhiều mã môn — phải kể ra đủ, không
      // thì người đọc file tưởng hệ thống bỏ sót lớp.
      tenMon: l.hocChung
        ? l.hocChung.members.map((m) => m.courseName).join(" + ")
        : l.courseName,
      giangVien: l.teacherName,
      loaiPhong: l.roomType,
      // ĐỊA ĐIỂM (cơ sở) — người đọc file phải đối chiếu được "ngày đó có bị dạy
      // cả hai cơ sở không", đúng việc mà màn hình đang giúp làm.
      diaDiem: l.location || "",
      khacCoSo: l.khacCoSo || null,
      soTiet: l.duration || 1,
      daGhim: !!l.isPinned,
      coVanDe: !!l.hasProblem,
      hocChung: l.hocChung ? l.hocChung.count : null,
      mau: mauCuaBuoi(l, colorBy),
    }));

  return {
    label: (label || "").trim() || "TKB",
    moTaBoLoc: moTaBoLoc || "",
    numDays,
    slotsPerDay,
    tenNgay: DAY_LABELS.slice(0, numDays),
    soCotMoiNgay: soCot,
    cells,
  };
}

// Nhãn học kỳ để đặt tên file — bóc từ tên file nguồn đã nạp.
//
// `data.importedFrom` ghi cả tên file lẫn tên sheet:
//     "FATE.TKB.HK1 2026-2027.xlsx (sheet 'Giảng dạy cho FATE & BJS')"
// Dùng thẳng chuỗi đó làm nhãn thì tên file xuất ra thành
//     FATE.TKB.FATE.TKB.HK1 2026-2027.xlsx (sheet '...').luoi.xlsx
// nên phải bóc lấy đúng phần học kỳ. Không bóc được thì trả "TKB" — thà tên
// chung chung còn hơn một tên dài vô nghĩa.
export function nhanHocKy(data) {
  const nguon = (data?.importedFrom || "").trim();
  if (!nguon) return "TKB";
  const ten = nguon
    .replace(/\s*\(sheet[^)]*\)\s*$/i, "")  // bỏ phần "(sheet '...')"
    .replace(/\.xlsx?$/i, "")                // bỏ đuôi file
    .replace(/^FATE\.TKB\./i, "")            // bỏ tiền tố đã có sẵn trong tên file xuất
    .trim();
  return ten || "TKB";
}

// Dòng mô tả bộ lọc, in ngay dưới tiêu đề file. Người nhận file phải đọc được
// "đây là lịch của cái gì" mà không cần hỏi lại người xuất.
export function moTaBoLocDangDung(view, data, phamVi) {
  const f = view?.filter ?? {};
  const phan = [];
  if (f.programs?.length) phan.push(`Chương trình: ${f.programs.join(", ")}`);
  if (f.khoas?.length) phan.push(`Khoá: ${f.khoas.join(", ")}`);
  if (f.chiXemPhamVi && phamVi) {
    const ve = [];
    if (phamVi.programs?.length) ve.push(phamVi.programs.join(", "));
    if (phamVi.cohorts?.length) ve.push(phamVi.cohorts.join(", "));
    phan.push(`Phạm vi đang xếp: ${ve.join(" · ")}`);
  }
  if (!f.guest) phan.push("Ẩn lớp thỉnh giảng");
  if (!f.resident) phan.push("Ẩn lớp cơ hữu");
  if (f.onlyProblems) phan.push("Chỉ buổi có vấn đề");
  if (f.search?.trim()) phan.push(`Tìm: "${f.search.trim()}"`);
  if (!phan.length) phan.push("Toàn khoa");
  return phan.join(" · ");
}
