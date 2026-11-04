import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eraser, Eye, EyeOff, GraduationCap, Lock, Plus, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import SectionEditDrawer from "../manual/SectionEditDrawer";
import TeacherEditDrawer from "../manual/TeacherEditDrawer";
import CourseEditDrawer from "../manual/CourseEditDrawer";
import ImportExcelDialog from "../manual/ImportExcelDialog";
import ExportExcelDialog from "../manual/ExportExcelDialog";
import ChotSectionDialog from "../manual/ChotCourseDialog";
import { FilterSelect } from "@/components/shared/filter-select";
import { ListSearch } from "@/components/shared/list-search";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SectionTable, { STATUS_META } from "../manual/SectionTable";

const PAGE_STEP = 25;

export const DEFAULT_MANUAL_VIEW_STATE = {
  search: "",
  programFilter: "",
  cohortFilter: "",
  hienBoQua: false,
  statusFilter: "",
  chotFilter: "",
  targetSectionIds: null,
};

// STATUS_META dung chung voi bang - xem manual/SectionTable.jsx.
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({
  value,
  label: m.label,
}));

// Loc theo TRANG THAI CHOT cua hoc phan - khac han "Trang thai" o tren (von noi
// ve gio cua tung lop). Giao vu chot dan tung mon nen phai tra loi duoc ngay
// "con nhung mon nao chua chot".
const CHOT_OPTIONS = [
  { value: "chua", label: "Chưa chốt lịch" },
  { value: "roi", label: "Đã chốt lịch" },
];

// Thay the "Nhap lieu thu cong" don gian cu (2 form roi rac, khong co khai niem
// "hoc phan" tach rieng): bang tong quan mirror 29 cot Excel + click 1 dong mo
// side-panel (SectionEditDrawer) de hoan thien du lieu. Day la NGUON DUY NHAT
// dua ca day sang "Thoi khoa bieu" thay cho tai Excel.
//
// BANG tom tat giu nguyen CSS cu (.xls-*): cau truc dua tren file Excel goc,
// hien 17 cot voi header 2 tang va rowSpan merge-xuong. Padding
// px-3 py-3 cua shadcn Table se lam no phinh gap may lan va mat cong dung. Chi
// phan khung (thanh loc, trang thai, nut) chuyen sang design system.
export default function ManualEntryPage({
  role,
  viewState,
  onViewStateChange,
  focusRequest,
  onFocusHandled,
}) {
  const { data, loading, initManual, doClearManualTimes, doBoChotSection,
          doBoHocChung, doBoQua } = useAppData();
  const canEdit = role !== "viewer";
  const [localViewState, setLocalViewState] = useState(DEFAULT_MANUAL_VIEW_STATE);
  const currentViewState = { ...DEFAULT_MANUAL_VIEW_STATE, ...(viewState ?? localViewState) };
  const updateViewState = (patch) => {
    const next = typeof patch === "function" ? patch(currentViewState) : { ...currentViewState, ...patch };
    setLocalViewState(next);
    onViewStateChange?.(next);
  };
  const {
    search, programFilter, cohortFilter, hienBoQua, statusFilter, chotFilter, targetSectionIds,
  } = currentViewState;
  const setSearch = (searchValue) => updateViewState({ search: searchValue, targetSectionIds: null });
  const setProgramFilter = (value) => updateViewState({ programFilter: value });
  const setCohortFilter = (value) => updateViewState({ cohortFilter: value });
  const setHienBoQua = (value) => updateViewState({ hienBoQua: value });
  const setStatusFilter = (value) => updateViewState({ statusFilter: value });
  const setChotFilter = (value) => updateViewState({ chotFilter: value });

  // Da BO lenh refreshData() luc mount o day: AppDataProvider nay nap du lieu
  // ngay khi mo app cho MOI trang, khong rieng trang nay. Giu lai chi lam goi
  // /api/data hai lan o lan tai dau tien.

  // Lop do DON VI KHAC dieu phoi va da bam bo qua: an khoi bang - do dung la cai
  // giao vu muon. Van mo xem lai duoc de bo danh dau khi nham.
  // Lop hoc phan dang mo hop thoai chot (null = dong).
  const [chotSection, setChotSection] = useState(null);
  const [boChotSection, setBoChotSection] = useState(null);
  const [limit, setLimit] = useState(PAGE_STEP);
  // { type: "section"|"teacher"|"course", id: number|"new" } | null (dong) - moi
  // domain co 1 form rieng (SectionEditDrawer/TeacherEditDrawer/CourseEditDrawer),
  // mo dung form theo O nguoi dung click trong bang, khong dong tat ca vao 1 form.
  const [drawer, setDrawer] = useState(null);
  const [teacherPopupId, setTeacherPopupId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const isManualMode = data?.sourceLabel === "Nhập liệu thủ công";
  const classes = data?.classes || [];
  const handledFocusRef = useRef(null);

  useEffect(() => {
    if (!focusRequest || handledFocusRef.current === focusRequest.seq) return;
    const ids = new Set(focusRequest.targets.map((target) => String(target.id)));
    const targets = classes.filter((item) => ids.has(String(item.sectionId)));
    if (targets.length !== ids.size) return;
    handledFocusRef.current = focusRequest.seq;
    updateViewState({
      search: focusRequest.targets.map((target) => target.classCode || `#${target.id}`).join(", "),
      targetSectionIds: focusRequest.targets.map((target) => target.id),
      programFilter: programFilter && targets.every((item) => (item.programParts ?? []).includes(programFilter)) ? programFilter : "",
      cohortFilter: cohortFilter && targets.every((item) => (item.cohortParts ?? []).includes(cohortFilter)) ? cohortFilter : "",
      statusFilter: statusFilter && targets.every((item) => item.status === statusFilter) ? statusFilter : "",
      chotFilter: chotFilter && targets.every((item) => chotFilter === "roi" ? item.sectionChot : !item.sectionChot) ? chotFilter : "",
      hienBoQua: hienBoQua || targets.some((item) => item.boQua),
    });
    setLimit(Math.max(PAGE_STEP, targets.length));
    onFocusHandled?.(focusRequest.seq);
  }, [focusRequest?.seq, classes]);

  // O GHEP ("BCSE+MJM", "VJU2023+VJU2024") = lop cua CA HAI -> danh sach chon la
  // cac ma DON (backend tach san o programParts/cohortParts). Nho vay chon "BCSE"
  // ra ca lop "BCSE+MJM", va het canh "VJU2023+VJU2024" voi "VJU2024+VJU2023"
  // nam thanh hai muc gan giong nhau trong danh sach.
  const programs = useMemo(
    () => [...new Set(classes.flatMap((c) => c.programParts ?? []))].sort(),
    [classes],
  );

  // Khoa (cot "Khóa", vd VJU2026) - lay tu chinh du lieu dang co, khong chot cung
  // danh sach: moi ky file lai co khoa moi. Sap giam dan de khoa moi nhat len dau.
  const cohorts = useMemo(
    () => [...new Set(classes.flatMap((c) => c.cohortParts ?? []))].sort().reverse(),
    [classes],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const targetIds = targetSectionIds ? new Set(targetSectionIds.map(String)) : null;
    return classes.filter((c) => {
      if (targetIds && !targetIds.has(String(c.sectionId))) return false;
      if (c.boQua && !hienBoQua) return false;
      if (programFilter && !(c.programParts ?? []).includes(programFilter)) return false;
      if (cohortFilter && !(c.cohortParts ?? []).includes(cohortFilter)) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (chotFilter === "roi" && !c.sectionChot) return false;
      if (chotFilter === "chua" && c.sectionChot) return false;
      if (targetIds || !q) return true;
      return [c.courseName, c.classCode, c.teacherName, String(c.sectionId)]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [classes, search, programFilter, cohortFilter, statusFilter, chotFilter, hienBoQua, targetSectionIds]);

  // Hai con so cho khoi "don vi khac dieu phoi" ngay tren bang.
  const soBoQua = useMemo(() => classes.filter((c) => c.boQua).length, [classes]);
  const soDeXuatBoQua = useMemo(
    () => classes.filter((c) => c.donViDieuPhoi && !c.boQua).length,
    [classes],
  );
  const shown = visible.slice(0, limit);

  // Tooltip nhom hoc chung phai goi lop bang MA LOP, khong phai id noi bo (#317)
  // - dung quy uoc chung cua du an (xem adapters/problemInbox.js).
  const maLopTheoId = useMemo(
    () => new Map(classes.map((c) => [c.sectionId, c.classCode])),
    [classes],
  );
  const tenLop = (sid) => maLopTheoId.get(sid) || `#${sid}`;

  const tienDoChot = useMemo(() => {
    const tong = classes.length;
    const roi = classes.filter((c) => c.sectionChot).length;
    return { tong, roi, con: tong - roi };
  }, [classes]);

  const handleBoChot = (c) => (e) => {
    e.stopPropagation();
    setBoChotSection(c);
  };

  const confirmBoChot = async () => {
    if (!boChotSection) return;
    try {
      await doBoChotSection(boChotSection.sectionId);
      setBoChotSection(null);
    } catch {
      return;
    }
  };

  const handleStart = async () => {
    if (data && (data.numSections > 0 || data.numTeachers > 0)) {
      const ok = window.confirm(
        "Bắt đầu học kỳ mới sẽ XÓA HẾT dữ liệu hiện tại (kể cả dữ liệu đã nạp từ Excel). Tiếp tục?",
      );
      if (!ok) return;
    }
    await initManual();
    setDrawer(null);
  };

  // Xoa gio hang loat: CHINH XAC cac lop dang hien theo bo loc/tim kiem hien
  // tai (visible, chua cat trang limit) - WYSIWYG, khong phai toan bo du lieu.
  const handleClearTimes = async () => {
    if (visible.length === 0) return;
    const ok = window.confirm(
      `Xoá giờ (Thứ/Tiết đầu/Tiết cuối) của ${visible.length} lớp đang hiển thị? ` +
      `Các lớp này sẽ chuyển về "để hệ thống tự xếp". Không hoàn tác được.`,
    );
    if (!ok) return;
    await doClearManualTimes(visible.map((c) => c.sectionId));
  };

  const openSection = (id) => (e) => { e?.stopPropagation(); setDrawer({ type: "section", id }); };
  const openTeacher = (id) => (e) => { e?.stopPropagation(); setDrawer({ type: "teacher", id }); };
  const openCourse = (id) => (e) => { e?.stopPropagation(); setDrawer({ type: "course", id }); };

  const selectedSection = drawer?.type === "section" && drawer.id !== "new"
    ? classes.find((c) => c.sectionId === drawer.id) || null
    : null;
  const selectedTeacherId = teacherPopupId ?? (drawer?.type === "teacher" ? drawer.id : null);
  const selectedTeacher = selectedTeacherId != null && selectedTeacherId !== "new"
    ? (data?.teachers || []).find((t) => t.id === selectedTeacherId) || null
    : null;
  const selectedCourse = drawer?.type === "course" && drawer.id !== "new"
    ? (data?.courses || []).find((c) => c.id === drawer.id) || null
    : null;

  return (
    // KHONG boc trong the: bang mirror 29 cot da rong hon man hinh san, ngoi
    // trong the co padding + vien chi lam no cuon ngang som hon can thiet.
    // AppLayout duoc goi voi bleed=true cho trang nay (xem BLEED_PAGES trong
    // App.jsx) nen vung noi dung khong con padding - thanh cong cu va bang tu lo
    // le trai/phai cua rieng chung.
    //
    // CHIEM TRON chieu cao con lai (AppLayout duoc goi voi fullHeight=true cho
    // trang nay): canh bao va thanh cong cu la flex item co dinh, BANG lay het
    // phan con lai va tu cuon - co the bang moi "dong bang" duoc hang tieu de va
    // 5 cot dau (xem .xls-scroll trong styles.css).
    <div className="flex min-h-0 flex-1 flex-col">
      {(!canEdit || (canEdit && !isManualMode)) && (
        <div className="shrink-0 px-4 pt-3 md:px-6">
          {!canEdit && (
            <Notice tone="slate" icon={Eye}>
              Vai trò "Xem thôi" — không thể sửa.
            </Notice>
          )}
          {canEdit && !isManualMode && (
            <Notice tone="amber" icon={TriangleAlert}>
              Chưa ở chế độ nhập liệu — bấm "Bắt đầu học kỳ mới".
            </Notice>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Thanh cong cu LUON hien: bang co toi vai tram lop, cuon xuong ma mat
            o tim/bo loc/nut thi phai cuon nguoc len moi lam tiep duoc.

            Truoc day dat `sticky top-(--page-header-h)` vi ca trang cuon chung.
            Nay trang la mot cot flex chiem tron chieu cao, cuon doc do CHINH
            bang lo (xem fullHeight trong AppLayout) - thanh nay chi can la flex
            item khong co lai (`shrink-0`) la da dung yen, khong can sticky nua. */}
        <div className="glass-toolbar shrink-0 border-b">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
          <h2 className="mr-1 text-sm font-semibold">
            Lớp đã nhập ({visible.length}
            {visible.length !== classes.length && `/${classes.length}`})
          </h2>

          <ListSearch
            value={search}
            onChange={setSearch}
            placeholder="Tìm mã lớp, học phần, GV, #id"
            className="w-full sm:w-64"
          />
          <FilterSelect
            label="Mọi chương trình"
            searchable
            value={programFilter || null}
            options={programs}
            onChange={(v) => setProgramFilter(v ?? "")}
          />
          <FilterSelect
            label="Mọi khoá"
            searchable
            value={cohortFilter || null}
            options={cohorts}
            onChange={(v) => setCohortFilter(v ?? "")}
          />
          <FilterSelect
            label="Mọi trạng thái"
            value={statusFilter || null}
            options={STATUS_OPTIONS}
            onChange={(v) => setStatusFilter(v ?? "")}
          />
          <FilterSelect
            label="Mọi tình trạng chốt lịch"
            value={chotFilter || null}
            options={CHOT_OPTIONS}
            onChange={(v) => setChotFilter(v ?? "")}
          />
          {/* Tien do tinh tren CA KY, khong theo bo loc dang hien: dem tung lop
              hoc phan vi moi lop co khoa doc lap. */}
          {tienDoChot.tong > 0 && (
            <button
              type="button"
              data-slot="button"
              data-variant="outline"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
              title={`${tienDoChot.roi} lớp đã chốt lịch, còn ${tienDoChot.con} chưa chốt. Bấm để lọc.`}
              onClick={() => setChotFilter(chotFilter === "chua" ? "" : "chua")}
            >
              <Lock className="size-3.5" />
              Chốt lịch{" "}
              <strong className="tabular-nums">
                {tienDoChot.roi}/{tienDoChot.tong}
              </strong>{" "}
              lớp
              {tienDoChot.con > 0 && (
                <span className="text-amber-700">· còn {tienDoChot.con}</span>
              )}
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canEdit && isManualMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setDrawer({ type: "teacher", id: "new" })}>
                  <GraduationCap className="size-4" />
                  Giảng viên
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDrawer({ type: "course", id: "new" })}>
                  <Plus className="size-4" />
                  Học phần
                </Button>
                <Button size="sm" onClick={() => setDrawer({ type: "section", id: "new" })}>
                  <Plus className="size-4" />
                  Thêm lớp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || visible.length === 0}
                  onClick={handleClearTimes}
                  title={`Đặt lại Thứ/Tiết đầu/Tiết cuối của ${visible.length} lớp đang hiển thị thành "để hệ thống tự xếp"`}
                >
                  <Eraser className="size-4" />
                  Xoá giờ ({visible.length})
                </Button>
              </>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setImportOpen(true)}
                title="Nạp file kế hoạch giảng dạy (.xlsx) của kỳ cũ vào form"
              >
                <Upload className="size-4" />
                Nhập từ Excel
              </Button>
            )}
            {classes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen(true)}
                title="Xuất Dữ liệu học phần ra file .xlsx theo khuôn FATE"
              >
                <Download className="size-4" />
                Xuất file
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={loading}
                onClick={handleStart}
                title="Xóa hết dữ liệu hiện tại và bắt đầu lại"
              >
                <RotateCcw className="size-4" />
                {loading ? "Đang xử lý…" : "Bắt đầu học kỳ mới"}
              </Button>
            )}
          </div>
        </div>

        {/* Chu giai cho ba vung nen trong bang: bam vao vung nao mo form nao.
            O mau lay DUNG mau nen cua vung (bien --xls-z-*), khong go tay lai -
            de doi mau vung thi chu giai tu theo. Nam TRONG khoi sticky de cuon
            sau van con doc duoc. */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5 text-[11px] md:px-6">
          <span className="font-medium">Bấm vào ô để mở form:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="xls-swatch xls-z-course" aria-hidden="true" />
            4 cột đầu → <strong className="text-foreground font-medium">Học phần</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="xls-swatch xls-z-teacher" aria-hidden="true" />
            nhóm “Thông tin giảng viên” → <strong className="text-foreground font-medium">Giảng viên</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="xls-swatch" aria-hidden="true" />
            các cột còn lại → <strong className="text-foreground font-medium">Lớp học phần</strong>
          </span>
        </div>
        </div>

        {/* LOP DO DON VI KHAC DIEU PHOI - o giang vien khong ghi ten nguoi ma ghi
            "Phong Dao tao dieu phoi"/"JLE dieu phoi". Do la mon chung (Triet hoc,
            GDTC, tieng Nhat...) don vi khac lo, khoa khong xep. Tren du lieu that
            la 66 dong khong lien quan, va 55 trong so do dang CHAN nut Giai.
            Xem webapp/domain/bo_qua.py. */}
        {canEdit && soDeXuatBoQua > 0 && (
          <Notice tone="amber" icon={EyeOff}>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <strong>{soDeXuatBoQua} lớp</strong> do đơn vị khác điều phối (ô giảng
                viên ghi "Phòng Đào tạo điều phối" / "JLE điều phối") — khoa không xếp
                những lớp này.
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => doBoQua(null, true)}
                title="Ẩn khỏi danh sách và loại khỏi thuật toán. Dữ liệu vẫn còn, hiện lại được."
              >
                <EyeOff className="size-4" />
                Bỏ qua {soDeXuatBoQua} lớp
              </Button>
            </span>
          </Notice>
        )}

        {soBoQua > 0 && (
          <Notice tone="slate" icon={EyeOff}>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Đang bỏ qua <strong>{soBoQua} lớp</strong> do đơn vị khác điều phối —
                không hiện trong danh sách, không đưa vào thuật toán. Dữ liệu vẫn còn
                và vẫn xuất ra Excel được.
              </span>
              <Button size="sm" variant="ghost" onClick={() => setHienBoQua(!hienBoQua)}>
                {hienBoQua ? "Ẩn lại" : "Xem"}
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => doBoQua(null, false)}
                  title="Đưa toàn bộ các lớp này trở lại danh sách và thuật toán"
                >
                  <Eye className="size-4" />
                  Hiện lại tất cả
                </Button>
              )}
            </span>
          </Notice>
        )}

        <SectionTable
          rows={shown}
          canEdit={canEdit}
          loading={loading}
          tenLop={tenLop}
          onOpenSection={openSection}
          onOpenCourse={openCourse}
          onOpenTeacher={openTeacher}
          onChot={setChotSection}
          onBoChot={handleBoChot}
          onBoHocChung={doBoHocChung}
        />

        {visible.length > shown.length && (
          <div className="flex shrink-0 justify-center border-t p-3">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_STEP)}>
              Hiện thêm {Math.min(PAGE_STEP, visible.length - shown.length)} lớp (còn{" "}
              {visible.length - shown.length})
            </Button>
          </div>
        )}
      </div>

      {drawer?.type === "section" && (
        <SectionEditDrawer
          data={data}
          section={selectedSection}
          onClose={() => { setTeacherPopupId(null); setDrawer(null); }}
          onDuplicated={(newId) => setDrawer({ type: "section", id: newId })}
          // Bam "Giờ dạy" canh mot giang vien trong lop -> mo popup cua
          // chinh nguoi do (co muc khai gio co the day) tren popup Sua lop.
          onOpenTeacher={setTeacherPopupId}
        />
      )}
      {(drawer?.type === "teacher" || (drawer?.type === "section" && teacherPopupId != null)) && (
        <TeacherEditDrawer
          data={data}
          teacher={selectedTeacher}
          onClose={() => { setTeacherPopupId(null); if (drawer?.type === "teacher") setDrawer(null); }}
        />
      )}
      {drawer?.type === "course" && (
        <CourseEditDrawer
          course={selectedCourse}
          classes={classes}
          onClose={() => setDrawer(null)}
        />
      )}

      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} />
      {/* Xuat theo BO LOC dang dung: gui thang danh sach dang hien (`visible`,
          KHONG phai `shown` - `shown` con bi cat theo phan trang, xuat theo no
          la mat lop chi vi dang xem trang 1). */}
      <ExportExcelDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        sectionIdsDangHien={visible.map((c) => c.sectionId)}
        tongSoLop={classes.length}
      />
      {boChotSection && (
        <Dialog open onOpenChange={(open) => !open && !loading && setBoChotSection(null)}>
          <DialogContent className="manual-edit-glass">
            <DialogHeader>
              <DialogTitle>Bỏ chốt lớp {boChotSection.classCode || `#${boChotSection.sectionId}`}?</DialogTitle>
              <DialogDescription>
                Giờ của lớp đang bị khóa để giữ đúng lịch đã xác nhận. Bỏ chốt sẽ trả giờ về trạng thái
                trước khi chốt; các lớp khác không bị thay đổi.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={loading} onClick={() => setBoChotSection(null)}>
                Hủy
              </Button>
              <Button type="button" disabled={loading} onClick={confirmBoChot}>
                {loading ? "Đang bỏ chốt…" : "Xác nhận bỏ chốt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {chotSection && (
        <ChotSectionDialog
          open
          section={chotSection}
          onOpenChange={(o) => !o && setChotSection(null)}
        />
      )}
    </div>
  );
}
