import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, LayoutGrid, Map as MapIcon, Sheet, TriangleAlert, X } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import { buildProblemInbox, filterProblemInbox } from "../../adapters/problemInbox";
import { buildScheduleView, scopeLabel, DEFAULT_FILTER } from "../../adapters/scheduleView";
import { buildSteps } from "../../adapters/buocGiai";
import { STATUS_COLORS, buildLegend } from "../../adapters/colorGrouping";
import LessonGridBoard from "../timetable/LessonGridBoard";
import ProgramSheetBoard from "../timetable/ProgramSheetBoard";
import LessonTable from "../timetable/LessonTable";
import ProblemInbox from "../schedule/ProblemInbox";
import DensityNavigator from "../schedule/DensityNavigator";
import SchedulingWorkflowDialog from "../schedule/SchedulingWorkflowDialog";
import ScheduleToolbar, { ScheduleActions } from "../schedule/ScheduleToolbar";
import MoveReasonDialog from "../schedule/MoveReasonDialog";
import SaveMoveDialog from "../schedule/SaveMoveDialog";
import PendingMoveBanner from "../schedule/PendingMoveBanner";
import { slotRangeLabel } from "../../adapters/crossConflictAnalysis";
import { dungDuLieuXuatLuoi, moTaBoLocDangDung, nhanHocKy } from "../../adapters/xuatLuoi";
import * as scheduler from "../../services/schedulerService";
import SolverProgress from "../SolverProgress";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// MAN TRUNG TAM sau refactor - gop Giai doan 1, Giai doan 2, Tra cuu theo giang
// vien va Check trung lien chuong trinh.
//
// Ca bon von la CUNG MOT luoi tuan voi bo loc khac nhau; cai khac nhau that su
// chi la pham vi du lieu va nut bam. Nay dung la nhu vay: mot luoi, mot thanh
// loc, mot hop thu van de, mot thanh tien trinh giu lai rang buoc GD2-sau-GD1.
//
// File nay giu TRANG THAI va lap ghep; hai manh tach ra rieng vi tu chung duoc:
//   adapters/buocGiai.js       luat 3 buoc cua thanh tien trinh
//   schedule/ScheduleToolbar   thanh loc + cac nut hanh dong
export function boLocTheoPhamVi(phamVi) {
  return {
    programs: [],
    khoas: [],
    guest: true,
    resident: true,
    search: "",
    onlyProblems: false,
    chiXemPhamVi: Boolean(phamVi),
  };
}

export function boLocXemDeKhoiPhuc(filter) {
  return { ...DEFAULT_FILTER, ...(filter ?? {}), chiXemPhamVi: false };
}

export function openLessonInManual({ role, lesson, pendingMove, onOpen }) {
  if (role === "viewer") {
    window.alert("Vai trò Xem thôi không có quyền mở Dữ liệu học phần.");
    return false;
  }
  if (pendingMove && !window.confirm("Thao tác kéo-thả chưa được lưu và sẽ mất nếu rời lịch. Tiếp tục?")) {
    return false;
  }
  const targets = lesson.hocChung?.members ?? [{ id: lesson.id, classCode: lesson.classCode }];
  onOpen?.(targets.map(({ id, classCode }) => ({ id, classCode })));
  return true;
}

export default function SchedulePage({ role, filter, onFilterChange, onOpenManualSections }) {
  const {
    data, guestResult, residentResult, loading, error, solveGuest, solveResident,
    phamVi, setPhamVi,
    doMoveLesson, doClearOverride, doSaveSchedule, doHocChung, doBoHocChung, doHoanTac,
    gd2HetHieuLuc,
  } = useAppData();
  const [activeProblem, setActiveProblem] = useState(null);
  // Buoi can cuon toi tren luoi - { id, seq }; xem pickProblem.
  const [scrollTarget, setScrollTarget] = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [mode, setMode] = useState("grid");
  // Keo-tha xong CHUA goi API ngay - chi TAM GIU vao pendingMove (thi giac: the
  // hien o vi tri moi qua displayLessons ben duoi), cho toi khi bam "Luu" tren
  // banner roi xac nhan trong SaveMoveDialog thi moi thuc su goi doMoveLesson().
  // { sectionId, lesson, fromSlot, toSlot }
  const [pendingMove, setPendingMove] = useState(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  // Khi tha vao o dang trung GV/het phong, backend tra 409 kem chi tiet xung
  // dot - luu lai de mo hop thoai xin ly do (xem handleConfirmSave/handleConfirmReason).
  const [moveDialog, setMoveDialog] = useState(null);
  // Toan man hinh = che do "du chu": the co dinh 180px, luoi duoc phep rong hon
  // man hinh va cuon ca 2 chieu. Chi tiet ca hoc CHI hien o day - o che do thuong
  // the van la thanh mau, de cung mot man khong cho ra ngay nay co chu ngay kia
  // khong (be rong cot phu thuoc so lop chong gio cua tung ngay).
  const [fullscreen, setFullscreen] = useState(false);
  // Trong toan man hinh: "sheet" = bang chuong trinh kieu sheet giay (hang
  // ngay/tiet/gio, cot chuong trinh theo khoa - de doc nhu TKB phat hanh);
  // "grid" = luoi the chi tiet nhu truoc (nhin tong quan tuan, keo-tha nhanh).
  // Mac dinh mo vao la sheet - dung cho canh "so lich voi ban giay".
  const [fsView, setFsView] = useState("sheet");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const boLocXemTruocKhiXep = useRef(null);
  const canEdit = role !== "viewer";

  useEffect(() => {
    if (!fullscreen) return;
    // Esc dong lop dang mo tren cung truoc, het lop moi thoat toan man hinh.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Dialog dang mo dong truoc (khong huy pendingMove - banner van con de
      // bam Luu lai), roi moi den cac lop ngan keo, cuoi cung la thoat toan man hinh.
      // Hai dialog gio la Radix Dialog nen chung TU xu ly Esc; nhanh o day chi
      // con de "nuot" phim, khong cho Esc rot xuong lam thoat toan man hinh oan.
      if (moveDialog) setMoveDialog(null);
      else if (saveConfirmOpen) setSaveConfirmOpen(false);
      else if (inboxOpen) setInboxOpen(false);
      else if (navOpen) setNavOpen(false);
      else setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen, inboxOpen, navOpen, moveDialog, saveConfirmOpen]);

  const f = { ...DEFAULT_FILTER, ...(filter ?? {}) };
  const set = (patch) => onFilterChange({ ...f, ...patch });
  const handlePhamViChange = (next) => {
    setPhamVi(next);
    set(boLocTheoPhamVi(next));
  };
  const openSetup = () => {
    boLocXemTruocKhiXep.current = boLocXemDeKhoiPhuc(f);
    set(boLocTheoPhamVi(phamVi));
    setSetupOpen(true);
  };
  const handleSetupOpenChange = (open) => {
    setSetupOpen(open);
    if (open || !boLocXemTruocKhiXep.current) return;
    onFilterChange(boLocXemTruocKhiXep.current);
    boLocXemTruocKhiXep.current = null;
  };

  // pendingMove nam trong deps: vua tha xong la hop thu + mau tren luoi phai
  // tinh lai NGAY theo vi tri moi, khong doi bam Luu moi biet co dam vao ai khong.
  const inbox = useMemo(
    () => buildProblemInbox(data, guestResult, residentResult, pendingMove),
    [data, guestResult, residentResult, pendingMove],
  );
  const view = useMemo(
    () => buildScheduleView({ data, guestResult, residentResult, inbox, filter: f, phamVi }),
    [data, guestResult, residentResult, inbox, filter, phamVi],
  );
  // Hop thu hien tren man: DA LOC theo dung pham vi dang chon o luoi. `inbox`
  // day du van duoc buildScheduleView dung (to mau buoi co van de) - loc ban do
  // se lam buoi ngoai pham vi mat danh dau khi doi bo loc.
  const inboxHien = useMemo(
    () => filterProblemInbox(inbox, data, f, phamVi),
    [inbox, data, f.programs, f.khoas, f.chiXemPhamVi, phamVi],
  );

  const legendLessons = mode === "grid" ? view.gridLessons : view.lessons;
  const legend = useMemo(() => buildLegend(legendLessons, f.colorBy), [legendLessons, f.colorBy]);

  // XUAT LUOI ra Excel. Gui thang cai `view` dang render (da loc, da chia cot,
  // da to mau) nen file ra khop DUNG man hinh - xem adapters/xuatLuoi.js.
  //
  // Ten hoc ky boc tu chinh file da nap - khong bat giao vu go lai mot thu he
  // thong da biet (xem nhanHocKy: importedFrom con kem ca ten sheet, dung thang
  // se ra mot ten file dai vo nghia).
  const handleXuatLuoi = async () => {
    try {
      const exportView = mode === "grid"
        ? { ...view, lessons: view.gridLessons, filter: { ...view.filter, search: "" } }
        : view;
      await scheduler.exportLuoi(dungDuLieuXuatLuoi({
        view: exportView,
        label: nhanHocKy(data),
        moTaBoLoc: moTaBoLocDangDung(exportView, data, phamVi),
      }));
    } catch (e) {
      window.alert(`Xuất lưới thất bại: ${e.message}`);
    }
  };

  // Phu 1 lop hien thi len tren view.lessons: buoi dang pendingMove (chua luu)
  // hien o VI TRI MOI ngay lap tuc, du chua goi API - nguoi dung phai thay ro
  // "keo xong se ra sao" truoc khi bam Luu, khong the chi bam nut ma khong thay
  // gi doi tren luoi.
  const displayLessons = useMemo(() => {
    const source = mode === "grid" ? view.gridLessons : view.lessons;
    if (!pendingMove) return source;
    return source.map((l) =>
      l.id === pendingMove.sectionId
        ? { ...l, day: pendingMove.toDay, period: pendingMove.toPeriod, slot: pendingMove.toSlot, pendingSave: true }
        : l,
    );
  }, [mode, view.gridLessons, view.lessons, pendingMove]);

  // LUOI DAY: mot ngay chong tu ~12 buoi tro len thi thanh mau mong duoi 10px,
  // khong con cho cho chu - chi con xem "hinh dang tuan". Hien mot dong goi y
  // cach thu hep (bo loc "Xem", re chuot/Tab de doc tung thanh, che do "Bang")
  // thay vi de nguoi dung tu phat hien bo loc sau bao lan cuon.
  const luoiDay = useMemo(() => {
    const byDay = new Map();
    for (const l of view.gridLessons) {
      if (l.day == null) continue;
      byDay.set(l.day, (byDay.get(l.day) ?? 0) + 1);
    }
    return Math.max(0, ...byDay.values()) >= 12;
  }, [view.gridLessons]);

  const fromLabel = pendingMove
    ? slotRangeLabel(pendingMove.fromSlot, pendingMove.lesson.duration || 1, view.slotsPerDay)
    : "";
  const toLabel = pendingMove
    ? slotRangeLabel(pendingMove.toSlot, pendingMove.lesson.duration || 1, view.slotsPerDay)
    : "";

  // Phai o TREN nhanh thoat "chua co du lieu" ben duoi - hook chay co dieu kien
  // la vi pham rules of hooks.
  // Ca hai nut deu bam kem PHAM VI dang chon - lan bam nay chi duoc dong toi lop
  // cua chuong trinh do (xem adapters/phamVi.js va webapp/domain/pham_vi.py).
  const steps = useMemo(
    () => buildSteps({
      data, guestResult, residentResult, gd2HetHieuLuc, phamVi,
      // Bo nuoc keo-tha DANG CHO LUU truoc khi giai: banner con lai se moi giao
      // vu "Luu" mot nuoc di tinh tren vi tri CU, trong khi luoi da la ket qua
      // moi - bam Luu la ghi de len ket qua vua xep.
      solveGuest: () => { setPendingMove(null); return solveGuest(phamVi); },
      solveResident: () => { setPendingMove(null); return solveResident(phamVi); },
    }),
    [data, guestResult, residentResult, gd2HetHieuLuc, phamVi, solveGuest, solveResident],
  );
  const completedSteps = steps.filter((step) => step.state === "done").length;
  const setupWarning = steps.some((step) => step.hint || ["blocked", "partial", "error"].includes(step.state));

  if (!data) {
    return (
      <Notice tone="slate">
        Chưa có dữ liệu — sang "Chuẩn bị dữ liệu" để sinh hoặc nạp dữ liệu trước.
      </Notice>
    );
  }

  // Buoi duoc lam noi: uu tien vu dang chon trong hop thu, sau do la o gio dang
  // chon tren bang mat do.
  const highlighted = new Set(
    activeProblem
      ? activeProblem.sectionIds
      : activeCell
      ? view.idsAt[activeCell.day]?.[activeCell.period] ?? []
      : mode === "grid" && f.search.trim() && view.searchMatchIds.size > 0
      ? view.searchMatchIds
      : [],
  );

  const pickProblem = (item) => {
    setActiveProblem(item);
    setActiveCell(null);
    if (!item) return;
    // Vu dan duong cho khung nhin: mo rong pham vi de chac chan thay duoc buoi
    // lien quan, thay vi de nguoi dung tu doi bo loc. Phai go CA scope va hai o
    // tich loai GV - chi go onlyProblems/search nhu truoc thi buoi nam ngoai
    // chuong trinh dang loc van bi an, va cuon toi mot the khong ton tai.
    set({
      onlyProblems: false,
      search: "",
      programs: [],
      khoas: [],
      guest: true,
      resident: true,
    });

    // ...roi CUON THANG toi buoi do. To sang thoi la chua du: luoi rong hon man
    // hinh ca hai chieu (15 chuong trinh x 7 ngay x 12 tiet), the duoc to sang
    // hoan toan co the dang nam ngoai khung nhin va nguoi dung van phai tu tim.
    //
    // Chon buoi DAU TIEN cua vu ma thuc su co mat tren luoi: vu "trung giang
    // vien" co 2 buoi (mot bi bo lai, mot da xep) va buoi bi bo lai khong co o
    // nao de cuon toi.
    const tren = new Set(view.gridLessons.map((l) => l.id));
    const dich = (item.sectionIds || []).find((id) => tren.has(id));
    if (dich != null) setScrollTarget((truoc) => ({ id: dich, seq: (truoc?.seq ?? 0) + 1 }));
  };

  // ===== Luong keo-tha 3 buoc: tha (tam giu) -> bam Luu -> xac nhan -> goi API =====

  // 1. Tha 1 buoi vao 1 o - CHUA goi API, chi tam giu de banner + hien vi tri moi
  // ngay tren luoi (qua displayLessons). "Luu" o day CHi luu ban ghi TAM, khong
  // phai luu vao backend.
  const handleDropLesson = (sectionId, toSlot) => {
    const lesson = view.gridLessons.find((l) => l.id === sectionId);
    if (!lesson || lesson.slot === toSlot) return; // tha lai dung cho cu - bo qua
    setPendingMove({
      sectionId, lesson,
      fromSlot: lesson.slot,
      toSlot, toDay: Math.floor(toSlot / view.slotsPerDay), toPeriod: toSlot % view.slotsPerDay,
    });
  };

  // 2. Bam "Luu" tren banner -> mo hop thoai xac nhan (chua goi API).
  const openSaveConfirm = () => setSaveConfirmOpen(true);

  // 3. Xac nhan trong hop thoai -> THUC SU goi API lan dau, KHONG kem ly do.
  // Sach (khong xung dot) thi xong luon; 409 thi chuyen sang hop thoai xin ly do
  // (buoc 4), pendingMove van giu nguyen de con "Luu" lai duoc.
  const handleConfirmSave = async () => {
    setSaveConfirmOpen(false);
    try {
      await doMoveLesson(pendingMove.sectionId, pendingMove.toSlot);
      setPendingMove(null);
    } catch (err) {
      if (err.status === 409) {
        setMoveDialog({ sectionId: pendingMove.sectionId, slot: pendingMove.toSlot, conflict: err.body?.conflict });
      }
    }
  };

  // 4. Xac nhan trong hop thoai xin ly do (chi toi khi co xung dot) -> goi API
  // lan 2 kem ly do.
  const handleConfirmReason = async (reason) => {
    try {
      await doMoveLesson(moveDialog.sectionId, moveDialog.slot, reason);
      setMoveDialog(null);
      setPendingMove(null);
    } catch {
      // doMoveLesson da tu ghi Nhat ky + error state - dong hop thoai, banner
      // pendingMove giu nguyen de nguoi dung bam Luu thu lai.
      setMoveDialog(null);
    }
  };

  const cancelPendingMove = () => {
    setPendingMove(null);
    setSaveConfirmOpen(false);
    setMoveDialog(null);
  };
  const handleOpenManual = (lesson) => openLessonInManual({
    role,
    lesson,
    pendingMove,
    onOpen: onOpenManualSections,
  });

  const densityBlock = (
    <>
      <DensityNavigator
        view={view}
        activeCell={activeCell}
        onPickCell={(cell) => {
          setActiveCell(cell);
          setActiveProblem(null);
        }}
      />
    </>
  );

  const inboxBlock = (
    <ProblemInbox
      inbox={inboxHien}
      activeId={activeProblem?.id ?? null}
      onPick={pickProblem}
      onClear={() => setActiveProblem(null)}
      // Tab "Chua xep duoc": bam 1 khung gio con trong la GHIM luon buoi vao do -
      // dung lai chinh doMoveLesson() ma keo-tha tren luoi dang dung, khong viet
      // duong rieng. Khong kem reason: cac khung goi y da duoc loc chi con o
      // KHONG bi trung GV/het phong (xem unplacedAnalysis.js), nen thuong di
      // thang, 409 (hiem, vd 2 giao vu bam gan nhau) se hien qua thong bao loi
      // ngay trong tab.
      onPlace={(sectionId, slot) => doMoveLesson(sectionId, slot)}
      // "Danh dau hoc chung": cach sua thu hai cho vu trung giang vien - xem
      // ProblemInbox va webapp/domain/hoc_chung.py.
      onHocChung={canEdit ? (sectionIds) => doHocChung(sectionIds) : undefined}
    />
  );

  return (
    <div
      className={cn(
        fullscreen
          // Nen phai DAC. Dung bg-muted/40 nhu nen canvas cua AppLayout thi lop
          // phu trong suot 40%, page header + bang canh bao ben duoi xuyen qua
          // va de chong len hang chu giai.
          ? "bg-background fixed inset-0 z-200 flex flex-col gap-2 overflow-hidden p-3"
          : "space-y-3",
        "schedule-workspace",
      )}
    >
      {/* Toan man hinh la ban lam viec: bo thanh tien trinh de nhuong cho luoi. */}
      <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-stretch">
        <div className="glass-panel flex min-w-0 flex-1 flex-col justify-center gap-2 rounded-xl border px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Đang xem</span>
            <strong className="text-foreground text-base">{scopeLabel(view, data)}</strong>
            <span className="text-muted-foreground text-sm tabular-nums">
              {displayLessons.length}/{view.totalLessons} buổi
            </span>
            {/* Bam vao badge = bat/tat bo loc "Chi buoi co van de" - duong tat
                nhanh nhat tu "co 51 buoi can chu y" toi luoi chi con dung 51
                thanh do, thay vi phai mo "Bo loc them" de tim o tick. */}
            {view.problemCount > 0 && (
              <button
                type="button"
                onClick={() => set({ onlyProblems: !f.onlyProblems })}
                aria-pressed={f.onlyProblems}
                title={
                  f.onlyProblems
                    ? "Đang chỉ hiện các buổi có vấn đề — bấm để hiện lại toàn bộ"
                    : "Bấm để lọc lưới chỉ còn các buổi có vấn đề"
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                  f.onlyProblems
                    ? "bg-red-500/25 text-red-700 ring-1 ring-red-500/60"
                    : "bg-red-500/10 text-red-700 hover:bg-red-500/20",
                )}
              >
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                {view.problemCount} buổi có vấn đề
              </button>
            )}
            {/* Toan man hinh co HAI cach nhin: "Bang chuong trinh" (sheet giay,
                hang tiet x cot chuong trinh) va "Luoi buoi" (the 180px). */}
            {fullscreen && mode === "grid" && (
              <div className="glass-segmented ml-auto inline-flex h-8 items-center rounded-lg border p-0.75">
                {[
                  { key: "sheet", label: "Bảng chương trình", icon: Sheet },
                  { key: "grid", label: "Lưới buổi", icon: LayoutGrid },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setFsView(m.key)}
                    aria-pressed={fsView === m.key}
                    className={cn(
                      "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      fsView === m.key
                        ? "glass-segmented-active text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <m.icon className="size-3.5" aria-hidden="true" />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {mode === "grid" && view.totalLessons > 0 && (f.colorBy === "status" ? (
            <div className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px]">
              {Object.entries(STATUS_COLORS).map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: c.border }}
                    aria-hidden="true"
                  />
                  {k}
                </span>
              ))}
            </div>
          ) : (
            // Ba lop mau con lai (Chuong trinh/Loai GV/Khoa) dung getColor()
            // hash theo ten nhom - khong co chu giai thi mau vo nghia. Cap 8
            // nhom, phan du gap vao "+n khac" (khong ve o).
            legend?.length > 0 && (
              <div className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px]">
                {legend.map((it) => (
                  <span key={it.key} className="inline-flex items-center gap-1.5">
                    {it.color && (
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: it.color.border }}
                        aria-hidden="true"
                      />
                    )}
                    {it.key}
                  </span>
                ))}
              </div>
            )
          ))}
        </div>
        <ScheduleActions
          data={data}
          view={view}
          canEdit={canEdit}
          loading={loading}
          guestResult={guestResult}
          residentResult={residentResult}
          mode={mode}
          onModeChange={setMode}
          fullscreen={fullscreen}
          onFullscreenChange={setFullscreen}
          onSaveSchedule={doSaveSchedule}
          onHoanTac={doHoanTac}
          onXuatLuoi={handleXuatLuoi}
        />
      </div>

      <ScheduleToolbar f={f} set={set} view={view} mode={mode} phamVi={phamVi} />

      {/* "Xep cho ai" doc TRUOC "bam gi" trong popup; bo loc tren toolbar chi
          quyet dinh lich dang xem, khong thay doi pham vi solver. */}
      {!fullscreen && canEdit && (
        <section>
          <button
            type="button"
            onClick={openSetup}
            aria-haspopup="dialog"
            className={cn(
              "glass-panel flex w-full items-center gap-3 rounded-xl border border-red-500/60 bg-red-500/10 px-3.5 py-2.5 text-left shadow-[0_0_0_1px_rgba(239,68,68,.15),0_4px_16px_-4px_rgba(239,68,68,.35)] backdrop-blur-md transition-colors hover:border-red-500 hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25",
            )}
          >
            <CalendarClock className="size-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-red-700 dark:text-red-300">Xếp lịch</span>
              <span className="text-muted-foreground block text-xs">
                {completedSteps}/{steps.length} bước hoàn tất · Mở quy trình xếp lịch
              </span>
            </span>
            {setupWarning && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                Cần chú ý
              </span>
            )}
          </button>
        </section>
      )}

      <SchedulingWorkflowDialog
        open={setupOpen}
        onOpenChange={handleSetupOpenChange}
        data={data}
        phamVi={phamVi}
        onPhamViChange={handlePhamViChange}
        ketQuaPhamVi={residentResult?.phamVi ?? guestResult?.phamVi ?? null}
        steps={steps}
        canEdit={canEdit}
        loading={loading}
        error={error}
        problemInbox={inboxBlock}
      />

      {error && (
        <Notice tone="red" icon={TriangleAlert}>
          {error}
        </Notice>
      )}

      <PendingMoveBanner
        pending={pendingMove}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onSave={openSaveConfirm}
        onCancel={cancelPendingMove}
      />

      {loading && <SolverProgress label="Đang giải" />}

      <div
        className={cn(
          "grid items-start gap-3",
          fullscreen ? "min-h-0 flex-1 grid-cols-1" : "grid-cols-1",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col gap-2.5",
            fullscreen && "h-full min-h-0",
          )}
        >
          {view.totalLessons === 0 ? (
            <Notice tone="slate">
              {canEdit
                ? <>Chưa có lịch nào — mở "Xếp lịch" và chạy bước 2.</>
                : "Chưa có lịch nào để xem."}
            </Notice>
          ) : mode === "grid" ? (
            <>
              {f.search.trim() && view.searchMatchIds.size === 0 && (
                <Notice tone="slate">Không có buổi nào khớp từ khóa; lưới được làm mờ để bạn tiếp tục đối chiếu.</Notice>
              )}
              {luoiDay && !fullscreen && (
                <p className="text-muted-foreground text-xs">
                  Lưới đang rất dày — thu hẹp bằng ô lọc "Xem" phía trên, rê chuột
                  hoặc Tab tới từng thanh để xem chi tiết, hoặc chuyển sang "Bảng" để tra cứu nhanh.
                </p>
              )}
              {fullscreen && fsView === "sheet" ? (
                <ProgramSheetBoard
                  lessons={displayLessons}
                  numDays={view.numDays}
                  slotsPerDay={view.slotsPerDay}
                  highlightedIds={highlighted}
                  colorBy={f.colorBy}
                  searchState={
                    activeProblem || activeCell || !f.search.trim()
                      ? null
                      : view.searchMatchIds.size > 0 ? "match" : "none"
                  }
                  onMoveLesson={canEdit ? handleDropLesson : undefined}
                />
              ) : (
              <LessonGridBoard
                lessons={displayLessons}
                numDays={view.numDays}
                slotsPerDay={view.slotsPerDay}
                highlightedIds={highlighted}
                searchState={
                  activeProblem || activeCell || !f.search.trim()
                    ? null
                    : view.searchMatchIds.size > 0 ? "match" : "none"
                }
                colorBy={f.colorBy}
                onPickProblem={pickProblem}
                onOpenManual={handleOpenManual}
                scrollTarget={scrollTarget}
                detailed={fullscreen}
                // BUG DA SUA: truoc day gate them "&& !pendingMove" o day -
                // nhung onMoveLesson=undefined lam dragEnabled (= detailed &&
                // !!onMoveLesson, xem LessonGridBoard) sup xuong false, KEO
                // THEO tat ca o body mat luon onDrop (ke ca o TRONG) va tat ca
                // the mat luon draggable - khong chi chan "keo tiep" nhu du
                // dinh, ma tat ca het toan bo he thong keo-tha ngay sau lan
                // dau. Keo tiep gio se THAY THE pendingMove cu (chua luu gi nen
                // khong mat du lieu) thay vi bi khoa.
                onMoveLesson={canEdit ? handleDropLesson : undefined}
                onClearOverride={canEdit ? doClearOverride : undefined}
                onTachHocChung={canEdit ? doBoHocChung : undefined}
              />
              )}
            </>
          ) : (
            <LessonTable lessons={displayLessons} />
          )}

          {/* Che do thuong: ban do mat do va hop thu van de nam canh nhau.
              Toan man hinh: KHONG hien o day - chung an mat mot dai ngang lon
              ma nua phai bo trong, trong khi cho do phai danh cho luoi. Chuyen
              thanh nut o goc duoi, can moi mo. */}
          {!fullscreen && (
            <div
              className={cn(
                "grid items-start gap-2.5 *:min-w-0",
                view.totalLessons > 0 && !canEdit && "lg:grid-cols-2",
              )}
            >
              {view.totalLessons > 0 && <div className="space-y-2.5">{densityBlock}</div>}
              {!canEdit && <div>{inboxBlock}</div>}
            </div>
          )}
        </div>

        {/* Toan man hinh: hop thu thu ve mot nut co badge, bam moi bung ra dang
            ngan keo - luoi lay tron be ngang. */}
        {fullscreen ? (
          <>
            {/* Hai nut cung mot cum o goc phai duoi - luon hien, bam de bat/tat
                lop tuong ung. */}
            <div className="fixed right-4 bottom-4 z-210 flex items-center gap-2">
              <Button
                variant={navOpen ? "default" : "outline"}
                className="rounded-full shadow-lg"
                onClick={() => setNavOpen(!navOpen)}
                aria-pressed={navOpen}
              >
                <MapIcon className="size-4" />
                Bản đồ tuần
              </Button>
              {inbox.total > 0 && (
                <Button
                  variant="destructive"
                  className="rounded-full shadow-lg"
                  onClick={() => setInboxOpen(!inboxOpen)}
                  aria-pressed={inboxOpen}
                >
                  <TriangleAlert className="size-4" />
                  Vấn đề
                  <span className="rounded-full bg-white/25 px-2 tabular-nums">
                    {inbox.total}
                  </span>
                </Button>
              )}
            </div>

            {navOpen && (
              <div className="glass-popover fixed right-4 bottom-17 z-215 flex max-h-[74vh] max-w-[min(760px,94vw)] flex-col gap-2 overflow-auto rounded-xl border p-2.5">
                <DrawerClose onClick={() => setNavOpen(false)} />
                {densityBlock}
              </div>
            )}
            {inboxOpen && (
              <div className="glass-drawer fixed inset-y-0 right-0 z-220 flex w-90 max-w-[92vw] flex-col gap-2 overflow-hidden border-l p-2.5">
                <DrawerClose onClick={() => setInboxOpen(false)} />
                <div className="min-h-0 flex-1 overflow-auto">{inboxBlock}</div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* pending chi truyen khi saveConfirmOpen=true - co pendingMove khong co
          nghia la hop thoai dang mo, chi la CO the doi da tam giu (banner). */}
      <SaveMoveDialog
        pending={saveConfirmOpen ? pendingMove : null}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
      />

      <MoveReasonDialog
        pending={moveDialog}
        onCancel={() => setMoveDialog(null)}
        onConfirm={handleConfirmReason}
      />
    </div>
  );
}

function DrawerClose({ onClick }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-muted-foreground self-end"
    >
      <X className="size-4" />
      Đóng
    </Button>
  );
}
