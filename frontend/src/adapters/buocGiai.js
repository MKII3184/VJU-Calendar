import { analyzeSubmissions } from "./submissionQueue";
import { coPhamVi, lopTrongPhamVi, moTa as moTaPhamVi } from "./phamVi";

// BA BUOC cua thanh tien trinh (WorkflowStrip) - tach khoi SchedulePage vi day
// la LUAT chu khong phai giao dien: buoc nao xong, nut ghi chu gi, khi nao bi
// khoa. Sua cach dem hay cach dat ten nut thi sua o day, khong phai loi trong
// 700 dong JSX.

// Dem theo GIAI DOAN: bao nhieu lop DA co gio chot san (tu file/go tay) va bao
// nhieu lop CHUA co gio. Con so thu hai moi la VIEC ma nut "Giai" phai lam -
// truoc day nut chi ghi "Giai" nen khong ai doan duoc no se dong vao cai gi.
export function demTheoPha(data, phamVi = null) {
  const m = { GUEST: { daChot: 0, chua: 0 }, RESIDENT: { daChot: 0, chua: 0 } };
  // XEP THEO PHAM VI: chi dem phan ma lan bam nay se dong toi. Dem ca khoa thi
  // nut ghi "Xep 75 lop chua co gio" trong khi no chi xep 12 lop cua FTH.
  // Di qua lopTrongPhamVi (co lan theo nhom hoc chung) chu khong tu loc bang
  // lopThuoc - mot luat chi duoc co MOT ban.
  for (const c of lopTrongPhamVi(data, phamVi)) {
    const o = m[c.teacherType];
    if (!o) continue;
    if (c.timeAssumed) o.chua += 1;
    else o.daChot += 1;
  }
  return m;
}

// "153/165 đã xếp · 2 không xếp được" - doc mot cai la biet ket qua ra sao.
const ketQua = (res) =>
  `${res.placedCount}/${res.total} đã xếp` +
  (res.unplaced?.length ? ` · ${res.unplaced.length} không xếp được` : "");

// guestResult/residentResult co the la LICH BAN DAU doc tu file (initial), chua
// phai ket qua giai - moi cho hien trang thai deu phai phan biet, khong thi nap
// file xong buoc 2/3 hien "done" ma chua ai bam Giai.
const daGiai = (res) => Boolean(res && !res.initial);

const cungDanhSach = (a = [], b = []) =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

const dungPhamVi = (res, phamVi) => {
  if (!daGiai(res)) return false;
  if (!phamVi) return !res.phamVi;
  return Boolean(
    res.phamVi
    && cungDanhSach(res.phamVi.programs, phamVi.programs)
    && cungDanhSach(res.phamVi.cohorts, phamVi.cohorts),
  );
};

const coLopChuaXep = (res) => Boolean(
  res?.unplaced?.length || res?.phamVi?.khongXepDuoc,
);

export function buildSteps({
  data,
  guestResult,
  residentResult,
  gd2HetHieuLuc,
  solveGuest,
  solveResident,
  phamVi = null,
}) {
  // Ba buoc deu doc THEO PHAM VI dang chon: dem lop, chan giai, dat ten nut. Mot
  // cho quen la giao vu doc mot con so cua ca khoa roi bam mot nut chi lam viec
  // cho mot chuong trinh - hai thu khong khop nhau.
  const sq = data ? analyzeSubmissions(data, phamVi) : null;
  const dem = demTheoPha(data, phamVi);
  const trongPhamVi = coPhamVi(phamVi);
  const guestDaChay = dungPhamVi(guestResult, phamVi);
  const residentDaChay = dungPhamVi(residentResult, phamVi);
  const chuaGiai = (pha) =>
    `${dem[pha].daChot} lớp đã chốt giờ · ${dem[pha].chua} chưa có giờ`;

  // Ket qua giai deu tra kem res.phamVi khi xep theo pham vi - dung con so DO
  // thay cho placedCount/total (von dem ca khoa vi model van la ca khoa).
  const ketQuaPha = (res) => {
    const pv = res?.phamVi;
    if (!pv) return ketQua(res);
    return (
      `${pv.daXep}/${pv.tong} lớp đã có giờ` +
      (pv.khongXepDuoc ? ` · ${pv.khongXepDuoc} không xếp được` : "")
    );
  };

  return [
    {
      key: "collect",
      label: "Học phần",
      value: sq
        ? `${sq.doneCount}/${sq.guestCount} lớp thỉnh giảng sẵn sàng` +
          (sq.unassigned.length > 0
            ? ` · ${sq.unassigned.length} chưa có GV`
            : "")
        : "—",
      note: trongPhamVi
        ? `Chỉ đếm lớp của ${moTaPhamVi(phamVi)} — lớp của chương trình khác không chặn bước này.`
        : undefined,
      state: sq && sq.queue.length === 0 ? "done" : "blocked",
    },
    {
      key: "guest",
      label: "Xếp thỉnh giảng",
      value: guestDaChay ? ketQuaPha(guestResult) : chuaGiai("GUEST"),
      // Con lop thinh giang CHUA SAN SANG (buoc 1 chua xong - thieu GV THAT
      // hoac thieu gio) thi khong cho giai: solver se gan cho trong hoac lay
      // tam "ranh ca tuan" cho nhung lop do, ra mot lich khong dung dieu kien
      // THAT - phai xu ly xong truoc, xem webapp/scheduler_core.py:
      // guest_sections_can_thu_gio/apply_section_time (qua sync_teacher_sections).
      note:
        sq && sq.queue.length > 0
          ? `Còn ${sq.queue.length} lớp thỉnh giảng chưa sẵn sàng` +
            (sq.unassigned.length > 0
              ? ` (${sq.unassigned.length} chưa có GV)`
              : "") +
            ` — hoàn tất bước "Chuẩn bị dữ liệu" ở trên trước khi xếp.`
          : guestDaChay
            ? coLopChuaXep(guestResult)
              ? "Đã chạy nhưng còn lớp không xếp được; bạn vẫn có thể tiếp tục ghép cơ hữu."
              : undefined
            : trongPhamVi
              ? `Chỉ xếp lớp của ${moTaPhamVi(phamVi)}; lớp của chương trình khác giữ nguyên giờ.`
              : "Xếp giờ cho các lớp chưa có giờ; lớp đã chốt giữ nguyên chỗ.",
      state: sq && sq.queue.length > 0
        ? "blocked"
        : guestDaChay
          ? coLopChuaXep(guestResult) ? "partial" : "done"
          : "todo",
      action: solveGuest,
      disabled: Boolean(sq && sq.queue.length > 0),
      // Nut ghi thang VIEC no lam, khong phai chu "Giai" chung chung.
      actionLabel: guestDaChay
        ? "Xếp lại"
        : dem.GUEST.chua > 0
          ? `Xếp ${dem.GUEST.chua} lớp chưa có giờ`
          : "Xếp lại",
      // "Xep lai" khi khong con lop nao chua co gio VAN co viec de lam (giai lai
      // co the tim cach xep tot hon) - giu nguyen hanh vi cu.
    },
    {
      key: "resident",
      label: "Ghép cơ hữu",
      value: residentDaChay
        ? ketQuaPha(residentResult)
        : chuaGiai("RESIDENT"),
      // Nut buoc 3 bi mo khi chua chay buoc 2 - phai noi VI SAO, khong de nguoi
      // dung bam mai khong duoc ma khong hieu.
      note: !guestDaChay
        ? "Cần xếp thỉnh giảng (bước 2) cho đúng phạm vi này trước — cơ hữu ghép vào chỗ còn lại."
        : residentDaChay
          ? coLopChuaXep(residentResult)
            ? "Đã ghép nhưng vẫn còn lớp không xếp được."
            : undefined
          : "Ghép các lớp chưa có giờ vào chỗ thỉnh giảng chưa chiếm.",
      state: !guestDaChay
        ? "blocked"
        : residentDaChay
          ? coLopChuaXep(residentResult) ? "partial" : "done"
          : "todo",
      // Nghiem GD2 vua bi huy vi buoc 2 chay lai - noi ro, khong de con so lang
      // le tu "158/163" ve "108 buoi chot tu file" (xem gd2HetHieuLuc).
      hint: gd2HetHieuLuc
        ? trongPhamVi
          ? `Vừa xếp lại thỉnh giảng cho ${moTaPhamVi(phamVi)} — chạy lại bước này ` +
            "cho cùng phạm vi. Lớp của chương trình khác không bị ảnh hưởng."
          : "Kết quả ghép cơ hữu trước đó đã hết hiệu lực vì vừa xếp lại thỉnh giảng — " +
            "các buổi đang hiện là giờ đã chốt sẵn. Chạy lại bước này."
        : undefined,
      action: solveResident,
      actionLabel: residentDaChay
        ? "Ghép lại"
        : dem.RESIDENT.chua > 0
          ? `Ghép ${dem.RESIDENT.chua} lớp chưa có giờ`
          : "Ghép lại",
      // Lich ban dau khong tinh la "da chay Giai doan 1" (backend cung chan).
      disabled: !guestDaChay,
    },
  ];
}
