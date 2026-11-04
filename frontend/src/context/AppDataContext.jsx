import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as scheduler from "../services/schedulerService";
import { chuanHoa as chuanHoaPhamVi } from "../adapters/phamVi";
import { useEventLog } from "./EventLogContext";

const AppDataContext = createContext(null);

// Noi giu du lieu dang lam viec cua toan SPA - guong lai STATE ben Flask (1
// "data" dang active + ket qua Giai doan 1/2) de moi trang doc chung ma
// khong phai fetch lai/prop-drilling qua nhieu tang component.
export function AppDataProvider({ children }) {
  const { log } = useEventLog();
  const [data, setData] = useState(null); // shape cua _build_data_response()
  const [guestResult, setGuestResult] = useState(null);
  // PHAM VI XEP dang chon: {programs, cohorts} hoac null (= toan khoa). Song o
  // day chu khong o SchedulePage vi ca hai nut "Xep"/"Ghep" deu phai gui dung
  // mot pham vi, va F5 phai lay lai duoc tu backend (xem /api/results).
  const [phamVi, setPhamVi] = useState(null);
  const [residentResult, setResidentResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Nghiem Giai doan 2 vua bi HUY vi Giai doan 1 chay lai (no duoc tinh tu vi tri
  // cac buoi thinh giang da doi - xem api/solve.py). Man hinh phai NOI RA: truoc
  // day buoc 3 lang le tu "158/163" ve "108 buoi chot tu file", giao vu chi thay
  // con so doi ma khong biet minh vua mat ket qua ghep.
  const [gd2HetHieuLuc, setGd2HetHieuLuc] = useState(false);

  // Bao 1 action bang loading/error + ghi log; messageFn(result) tra ve dong
  // log khi thanh cong (khong bat buoc), errorPrefix ghep vao khi loi.
  const runAction = useCallback(async (fn, { onSuccess, messageFn, errorPrefix } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      onSuccess?.(result);
      if (messageFn) log(messageFn(result), "success");
      return result;
    } catch (err) {
      setError(err.message);
      log(`${errorPrefix || "Lỗi"}: ${err.message}`, "error");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [log]);

  // Gan MOT LUOT ca du lieu hoc phan VA luoi Thoi khoa bieu tu mot phan hoi.
  //
  // Moi endpoint sua du lieu deu tra kem guestResult/residentResult da dong bo
  // (xem api/common.py: tra_du_lieu + domain/pinning.py: dong_bo_ket_qua). Truoc
  // day cac handler o duoi chi goi setData, nen sua form o "Du lieu hoc phan"
  // xong thi bang doi ngay ma man "Thoi khoa bieu" van hien ban CU: lop moi them
  // khong xuat hien, lop doi Thu/Tiet van nam o o cu, xoa gio roi buoi van con
  // tren luoi, doi loai GV thi buoi ket lai o giai doan cu. Hai man noi hai
  // chuyen khac nhau ve cung mot lop cho toi khi bam Giai lai hoac F5.
  //
  // Phan biet "khong gui" voi "gui null" bang `in`: null la gia tri HOP LE (chua
  // giai lan nao / vua xoa het du lieu), phai gan de luoi trong that su.
  const apDungPhanHoi = useCallback((res) => {
    if (!res) return;
    // Bo du lieu vua doi/vua nap -> khong con "nghiem GD2 vua bi huy" nao treo lai.
    if (res.guestResult !== undefined || res.classes) setGd2HetHieuLuc(false);
    if (res.classes) setData(res);
    if ("guestResult" in res) setGuestResult(res.guestResult);
    if ("residentResult" in res) setResidentResult(res.residentResult);
  }, []);

  const refreshData = useCallback(() => runAction(
    () => scheduler.getData(),
    { onSuccess: apDungPhanHoi, errorPrefix: "Không lấy được dữ liệu" },
  ), [runAction, apDungPhanHoi]);

  // Nap lai TOAN BO trang thai dang co ben Flask NGAY khi mo app: du lieu hoc
  // phan + ket qua giai.
  //
  // Truoc day chi ManualEntryPage goi refreshData() luc mount, nen vao thang bat
  // ky trang nao khac deu bao "Chua co du lieu" du backend van dang giu nguyen
  // (STATE["data"] con duoc persist xuong manual_state_snapshot.json, song qua ca
  // restart server). Nguoi dung phai vong qua "Du lieu hoc phan" roi quay lai moi
  // thay - khong ai doan duoc dieu do. Chinh docstring cua GET /api/data cung noi
  // endpoint do sinh ra cho "SPA chuyen man/refresh".
  //
  // Tuong tu, guestResult/residentResult truoc chi song trong state React: bam F5
  // la luoi trong va phai bam "Giai" lai (2-30 giay) du backend con nguyen ket
  // qua. GET /api/results (them moi) tra lai chung.
  //
  // KHONG di qua refreshData/runAction o day: /api/data tra 400 khi that su chua
  // co du lieu, ma do la trang thai HOP LE luc dau hoc ky - qua runAction se ghi
  // mot dong do vao Nhat ky va set error ngay man dau tien, bao loi cho thu khong
  // phai loi. Cac loi khac (mat mang, 500) van phai bao binh thuong.
  useEffect(() => {
    let cancelled = false;

    scheduler.getData()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Chi hoi ket qua giai KHI da co du lieu - khong co du lieu thi chac chan
        // khong co ket qua, hoi them chi ton mot vong goi.
        return scheduler.getResults().then((r) => {
          if (cancelled) return;
          if (r.guestResult) setGuestResult(r.guestResult);
          if (r.residentResult) setResidentResult(r.residentResult);
          // Pham vi cua lan giai gan nhat - F5 xong van biet dang xep cho chuong
          // trinh nao, khong bam "Ghep co huu" nham sang pham vi khac.
          setPhamVi(chuanHoaPhamVi(r.phamVi));
        });
      })
      .catch((err) => {
        if (cancelled || err.status === 400) return; // chua co du lieu - binh thuong
        setError(err.message);
        log(`Không lấy được dữ liệu: ${err.message}`, "error");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Con so trong Nhat ky phai la con so NGUOI DUNG vua yeu cau: xep rieng FTH ma
  // bao "166/166" (so toan khoa, vi model van la ca khoa) thi khong ai biet phan
  // cua minh ra sao. Backend gui kem res.phamVi cho dung viec nay.
  const ketQuaGiai = (nhan, res) => {
    const pv = res.phamVi;
    if (!pv) return `${nhan}: ${res.status} — ${res.placedCount}/${res.total} xếp được (${res.elapsedSeconds}s).`;
    return (
      `${nhan} cho ${pv.moTa}: ${pv.daXep}/${pv.tong} lớp đã có giờ` +
      (pv.vuaXep ? ` (vừa xếp mới ${pv.vuaXep})` : "") +
      (pv.khongXepDuoc ? ` · ${pv.khongXepDuoc} không xếp được` : "") +
      ` (${res.elapsedSeconds}s).`
    );
  };

  const solveGuest = useCallback((pv = null) => runAction(
    () => scheduler.solveGuest(pv),
    {
      // Backend tra kem residentResult da dung lai tu gio da chot cua lop co huu
      // (xem api/solve.py) - KHONG hardcode null nua: lam vay la xoa 108 buoi co
      // huu khoi luoi du chung co gio chot san trong file.
      onSuccess: (res) => {
        // Co nghiem GD2 THAT truoc do? Vay nghiem do vua bi huy - phai bao.
        setGd2HetHieuLuc(Boolean(residentResult && !residentResult.initial));
        const { residentResult: rr, ...g } = res;
        setGuestResult(g);
        setResidentResult(rr ?? null);
        setPhamVi(chuanHoaPhamVi(pv));
      },
      messageFn: (res) => ketQuaGiai("Giai đoạn 1", res),
      errorPrefix: "Giải Giai đoạn 1 thất bại",
    },
  ), [runAction, residentResult]);

  const solveResident = useCallback((pv = null) => runAction(
    () => scheduler.solveResident(pv),
    {
      onSuccess: (res) => {
        setResidentResult(res);
        setGd2HetHieuLuc(false);
        setPhamVi(chuanHoaPhamVi(pv));
      },
      messageFn: (res) => ketQuaGiai("Giai đoạn 2", res),
      errorPrefix: "Giải Giai đoạn 2 thất bại",
    },
  ), [runAction]);

  // Keo-tha sua tay (thay "Tu choi - luan chuyen" cu). KHONG di qua runAction:
  // ham do tu dong log MOI loi thanh dong do trong Nhat ky, nhung 409 "can ghi
  // ly do" la MOT BUOC BINH THUONG cua luong keo-tha (component se tu mo hop
  // thoai xin ly do), khong phai that bai - log no vao Nhat ky la nhieu.
  const doMoveLesson = useCallback(async (sectionId, slot, reason) => {
    setLoading(true);
    setError(null);
    try {
      const res = await scheduler.moveLesson(sectionId, slot, reason);
      setGuestResult(res.guestResult);
      setResidentResult(res.residentResult);
      log(
        `Đã sửa tay buổi #${sectionId} sang ${res.day != null ? `Ngày ${res.day + 1} tiết ${res.period + 1}` : "giờ khác"}` +
          (reason ? ` — lý do: ${reason}` : ""),
        "success",
      );
      return res;
    } catch (err) {
      if (err.status !== 409) {
        setError(err.message);
        log(`Sửa tay thất bại: ${err.message}`, "error");
      }
      throw err; // component tu quyet dinh: 409 -> mo hop thoai xin ly do, con lai -> bao loi
    } finally {
      setLoading(false);
    }
  }, [log]);

  const doClearOverride = useCallback((sectionId) => runAction(
    () => scheduler.clearOverride(sectionId),
    {
      onSuccess: (res) => { setGuestResult(res.guestResult); setResidentResult(res.residentResult); },
      messageFn: () => `Đã bỏ ghim buổi #${sectionId} — có hiệu lực từ lần "Giải lại" tiếp theo.`,
      errorPrefix: "Bỏ ghim thất bại",
    },
  ), [runAction]);

  const doSaveSchedule = useCallback(() => runAction(
    () => scheduler.saveSchedule(),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) => `Đã lưu ${res.savedCount} buổi vào Dữ liệu học phần` +
        (res.problemCount ? ` — ${res.problemCount} buổi có vấn đề` : "") +
        (res.missingCount ? `, ${res.missingCount} buổi vẫn chưa có giờ` : "") + ".",
      errorPrefix: "Lưu thời khoá biểu thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  // Huy thay doi: quay ve moc (lan Luu gan nhat / luc vua nap file).
  const doHoanTac = useCallback(() => runAction(
    () => scheduler.hoanTac(),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) => `Đã huỷ thay đổi — quay về ${res.hoanTacVe?.nhan || "mốc gần nhất"}`
        + (res.hoanTacVe?.at ? ` (${res.hoanTacVe.at.slice(11, 16)} ngày ${res.hoanTacVe.at.slice(8, 10)}/${res.hoanTacVe.at.slice(5, 7)}).` : "."),
      errorPrefix: "Không huỷ được",
    },
  ), [runAction, apDungPhanHoi]);

  const initManual = useCallback(() => runAction(
    () => scheduler.initManual(),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => "Đã xóa dữ liệu cũ, bắt đầu nhập liệu thủ công từ đầu.",
      errorPrefix: "Khởi tạo nhập liệu thủ công thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  // Doc file va tra ve ban xem truoc. KHONG setData - buoc nay chua ghi gi ca,
  // nen cung khong duoc dong vao du lieu dang hien tren man.
  // Chot lich / bo chot rieng mot lop hoc phan. Tra ve ban data moi de bang doi
  // trang thai ngay, khong doi refresh.
  const doChotSection = useCallback((sectionId, payload) => runAction(
    () => scheduler.chotSection(sectionId, payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) =>
        `Đã chốt lớp "${res.classCode || res.courseName}" — ghim cứng.`,
      errorPrefix: "Không chốt được",
    },
  ), [runAction, apDungPhanHoi]);

  const doBoChotSection = useCallback((sectionId) => runAction(
    () => scheduler.boChotSection(sectionId),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) => `Đã bỏ chốt lớp "${res.classCode || res.courseName}" — giờ trả về trạng thái trước khi chốt.`,
      errorPrefix: "Không bỏ chốt được",
    },
  ), [runAction, apDungPhanHoi]);

  const doImportPreview = useCallback((file) => runAction(
    () => scheduler.importPreview(file),
    {
      messageFn: (res) =>
        `Đã đọc "${res.fileName}": ${res.summary.soLopDungDuoc} lớp, ` +
        `${res.summary.soHocPhan} học phần, ${res.summary.soGiangVien} giảng viên — chưa ghi gì.`,
      errorPrefix: "Không đọc được file",
    },
  ), [runAction]);

  // Danh sach GV co huu: xem truoc (khong ghi gi) roi moi nap.
  const doLecturersPreview = useCallback((file) => runAction(
    () => scheduler.lecturersPreview(file),
    {
      messageFn: (res) =>
        `Đã đọc "${res.fileName}": ${res.count} giảng viên cơ hữu, ${res.khop} người đang dạy kỳ này` +
        ` — sẽ đổi loại ${res.doiSangCoHuu.length + res.doiSangThinhGiang.length} người. Chưa ghi gì.`,
      errorPrefix: "Không đọc được danh sách",
    },
  ), [runAction]);

  const doLecturersCommit = useCallback(() => runAction(
    () => scheduler.lecturersCommit(),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) =>
        `Đã nạp danh sách ${res.count} giảng viên cơ hữu` +
        (res.changed?.length ? ` — đổi loại ${res.changed.length} người.` : " — không ai bị đổi loại."),
      errorPrefix: "Không nạp được danh sách",
    },
  ), [runAction, apDungPhanHoi]);

  const doImportCommit = useCallback((mode = "replace") => runAction(
    () => scheduler.importCommit(mode),
    {
      onSuccess: (res) => {
        setData(res);
        // Nap file xong da co LICH BAN DAU tu cac gio chot trong file (backend
        // dung san, ghim luon) - dat thang vao de man TKB hien ngay, thay vi de
        // null roi bao "chua co lich nao".
        setGuestResult(res.guestResult ?? null);
        setResidentResult(res.residentResult ?? null);
      },
      messageFn: (res) => {
        const g = res.mergeReport;
        // Gop them: noi ro da THEM bao nhieu va BO QUA bao nhieu lop trung, chu
        // khong bao "xong" mo ho - so lop tong khong noi len duoc dieu do.
        if (g) {
          return (
            `Đã gộp thêm ${g.soLopThem} lớp từ ${res.importedFrom || "file Excel"}` +
            (g.soLopTrung ? ` (bỏ qua ${g.soLopTrung} lớp đã có)` : "") +
            ` — tổng ${(res.classes || []).length} lớp` +
            // Noi so tiet/ngay da bi noi ra: doi tham so cua CA thoi khoa bieu,
            // khong duoc am tham.
            (g.soTietMoiNgay ? `, đã nới lên ${g.soTietMoiNgay} tiết/ngày` : "") +
            "."
          );
        }
        return (
          `Đã nạp ${(res.classes || []).length} lớp từ ${res.importedFrom || "file Excel"} — ` +
          `dữ liệu cũ đã bị thay thế.`
        );
      },
      errorPrefix: "Nạp dữ liệu thất bại",
    },
  ), [runAction]);

  const addManualTeacher = useCallback((payload) => runAction(
    () => scheduler.addManualTeacher(payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => `Đã thêm giảng viên "${payload.name}" (${payload.teacherType === "GUEST" ? "thỉnh giảng" : "cơ hữu"}).`,
      errorPrefix: "Thêm giảng viên thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const updateManualTeacher = useCallback((teacherId, payload) => runAction(
    () => scheduler.updateManualTeacher(teacherId, payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => (payload.availability
        ? `Đã lưu giờ có thể dạy cho giảng viên #${teacherId}.`
        : `Đã lưu thông tin giảng viên #${teacherId}.`),
      errorPrefix: "Sửa giảng viên thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const generateTeacherAvailability = useCallback((teacherId) => runAction(
    () => scheduler.generateTeacherAvailability(teacherId),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) =>
        `Đã tự động sinh lại giờ rảnh cho giảng viên #${teacherId} (${res.generatedSlotCount ?? 0} tiết).`,
      errorPrefix: "Tự động khai giờ rảnh thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const generateAllTeacherAvailability = useCallback(() => runAction(
    () => scheduler.generateAllTeacherAvailability(),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) =>
        `Đã khai lại giờ rảnh cho ${res.generatedTeacherCount ?? 0} giảng viên (${res.generatedSlotCount ?? 0} tiết).`,
      errorPrefix: "Khai toàn bộ giờ rảnh thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const addManualCourse = useCallback((payload) => runAction(
    () => scheduler.addManualCourse(payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => `Đã thêm học phần "${payload.name}".`,
      errorPrefix: "Thêm học phần thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const updateManualCourse = useCallback((courseId, payload) => runAction(
    () => scheduler.updateManualCourse(courseId, payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) => `Đã sửa học phần #${courseId}.`
        + (res?.classCodesRenamed ? ` Đã đánh lại mã ${res.classCodesRenamed} lớp.` : "")
        + (res?.classCodesKept?.length ? ` Giữ nguyên mã lớp không theo mẫu: ${res.classCodesKept.join(", ")}.` : ""),
      errorPrefix: "Sửa học phần thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const addManualSection = useCallback((payload) => runAction(
    () => scheduler.addManualSection(payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => `Đã thêm lớp "${payload.classCode || payload.courseId}".`,
      errorPrefix: "Thêm lớp thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const updateManualSection = useCallback((sectionId, payload) => runAction(
    () => scheduler.updateManualSection(sectionId, payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => `Đã lưu lớp #${sectionId}.`,
      errorPrefix: "Sửa lớp thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  // HOC CHUNG: danh dau / bo danh dau nhieu lop la MOT buoi day.
  // Lop do don vi khac dieu phoi: danh dau bo qua / hien lai. Backend tra ve
  // nguyen bo du lieu + luoi da dong bo (tra_du_lieu) nen chi viec ap lai.
  const doBoQua = useCallback((sectionIds = null, boQua = true) => runAction(
    () => scheduler.datBoQua(sectionIds, boQua),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) => {
        const n = res.boQuaChanged?.length ?? 0;
        return boQua
          ? `Đã bỏ qua ${n} lớp do đơn vị khác điều phối — không còn trong danh sách và không đưa vào thuật toán.`
          : `Đã hiện lại ${n} lớp.`;
      },
      errorPrefix: boQua ? "Bỏ qua thất bại" : "Hiện lại thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const doHocChung = useCallback((sectionIds, payload) => runAction(
    () => scheduler.markHocChung(sectionIds, payload),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) => {
        const n = res.hocChungGroup?.sectionIds?.length ?? sectionIds.length;
        return `Đã đánh dấu ${n} lớp học chung một buổi — hệ thống sẽ luôn xếp chúng cùng giờ, `
          + `cùng một phòng, và không báo trùng giảng viên nữa.`;
      },
      errorPrefix: "Không đánh dấu được học chung",
    },
  ), [runAction, apDungPhanHoi]);

  const doBoHocChung = useCallback((groupId) => runAction(
    () => scheduler.unmarkHocChung(groupId),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => "Đã bỏ nhóm học chung — các lớp trở lại độc lập, "
        + "từ lần Giải sau hệ thống lại coi chúng là trùng giờ.",
      errorPrefix: "Không bỏ được nhóm học chung",
    },
  ), [runAction, apDungPhanHoi]);

  const doClearManualTimes = useCallback((sectionIds) => runAction(
    () => scheduler.clearManualTimes(sectionIds),
    {
      onSuccess: apDungPhanHoi,
      messageFn: (res) =>
        `Đã xoá giờ của ${res.clearedCount} lớp — chuyển về "để hệ thống tự xếp".` +
        // Mon da chot khong bi xoa gio (backend chan) - phai noi ra, neu khong
        // giao vu tuong da xoa het roi di lam viec khac.
        (res.skippedChotCount ? ` Bỏ qua ${res.skippedChotCount} lớp đã chốt lịch hoặc học chung với lớp đã chốt.` : ""),
      errorPrefix: "Xoá giờ thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const deleteManualSection = useCallback((sectionId) => runAction(
    () => scheduler.deleteManualSection(sectionId),
    {
      onSuccess: apDungPhanHoi,
      messageFn: () => `Đã xóa lớp #${sectionId}.`,
      errorPrefix: "Xóa lớp thất bại",
    },
  ), [runAction, apDungPhanHoi]);

  const value = {
    data, guestResult, residentResult, loading, error, gd2HetHieuLuc,
    phamVi, setPhamVi,
    refreshData,
    solveGuest, solveResident, doMoveLesson, doClearOverride, doSaveSchedule,
    initManual, doImportPreview, doImportCommit,
    doLecturersPreview, doLecturersCommit, doChotSection, doBoChotSection,
    addManualTeacher, updateManualTeacher, generateTeacherAvailability, generateAllTeacherAvailability,
    addManualCourse, updateManualCourse,
    addManualSection, updateManualSection, deleteManualSection, doClearManualTimes,
    doHocChung, doBoHocChung, doHoanTac, doBoQua,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData phai dung trong AppDataProvider");
  return ctx;
}
