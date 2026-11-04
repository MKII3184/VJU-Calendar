import { Fragment, useMemo, useState } from "react";
import { CircleCheck, TriangleAlert, UserRoundPlus, X } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import SubmissionWindowGrid from "../submissions/SubmissionWindowGrid";
import SectionEditDrawer from "../manual/SectionEditDrawer";
import { analyzeSubmissions, filterRows, SUB_STATE, SUB_STATE_META } from "../../adapters/submissionQueue";
import { slotRangeLabel } from "../../adapters/crossConflictAnalysis";
import { FilterSelect } from "@/components/shared/filter-select";
import { ListSearch } from "@/components/shared/list-search";
import { Notice } from "@/components/shared/notice";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAGE_STEP = 25;
const QUEUE_STEP = 15;
const MAX_WINDOW_CHIPS = 4;

const STATE_OPTIONS = [
  { value: SUB_STATE.SET, label: SUB_STATE_META.SET.label },
  { value: SUB_STATE.UNREPORTED, label: SUB_STATE_META.UNREPORTED.label },
];

// Man hinh cua DIEU PHOI VIEN. Ba viec khac nhau -> BA MAN CON, khong don tat ca
// vao mot trang dai: ban truoc do cao ~4300px va co hai vung cuon long nhau (hang
// doi tu cuon trong khung 520px, ben duoi lai do tiep 60 dong bang).
const VIEW = { QUEUE: "queue", TABLE: "table", COORDS: "coords" };

/** Tên học phần: với vai trò sửa được thì là nút mở form "Sửa lớp" đúng lớp đó. */
function CourseName({ name, sectionId, onOpen }) {
  if (!onOpen) return <span>{name}</span>;
  return (
    <button
      type="button"
      className="course-name-link focus-visible:ring-ring/50 rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
      title={`Sửa lớp #${sectionId}`}
      aria-label={`Sửa lớp #${sectionId}: ${name}`}
      onClick={() => onOpen(sectionId)}
    >
      {name}
    </button>
  );
}

/** Khung the dung chung cho ba man con. */
function Card({ title, note, children, headExtra }) {
  return (
    <section className="glass-panel rounded-xl border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <h3 className="mr-1 text-sm font-semibold">{title}</h3>
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
        {headExtra}
      </div>
      {children}
    </section>
  );
}

export default function SubmissionsPage({ role }) {
  const { data, loading, error, updateManualTeacher } = useAppData();
  const [view, setView] = useState(null);
  // Nhap gio la mot GIANG VIEN dang mo, khong phai 1 lop: mot GV thuong day
  // nhieu lop cung mon (AET2014-1/2...), khai gio ranh la chuyen CUA NGUOI DO,
  // ap dung cho toan bo lop ho day - khong phai chuyen tung lop rieng le. Truoc
  // day khai theo lop nen 1 GV day 2 lop phai khai 2 lan giong nhau.
  const [openTeacherId, setOpenTeacherId] = useState(null);
  // Lop dang mo SectionEditDrawer de PHAN CONG giang vien (khac openTeacherId -
  // cai do mo luoi Nhap gio cho MOT NGUOI). Hai viec khac han nhau (chon NGUOI
  // vs chon GIO) nen dung hai state, khong tai dung 1 bien roi if/else theo "loai".
  const [assignSectionId, setAssignSectionId] = useState(null);
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [limit, setLimit] = useState(PAGE_STEP);
  const [queueLimit, setQueueLimit] = useState(QUEUE_STEP);
  const [unassignedLimit, setUnassignedLimit] = useState(QUEUE_STEP);
  const [coordFilter, setCoordFilter] = useState(null);
  const canEdit = role !== "viewer";

  const sq = useMemo(() => (data ? analyzeSubmissions(data) : null), [data]);

  if (!data || !sq) {
    return (
      <Notice tone="slate">
        Chưa có dữ liệu — sang "Dữ liệu học phần" để nhập hoặc nạp dữ liệu trước.
      </Notice>
    );
  }

  // Mo thang vao viec neu con gio phai thu.
  const activeView = view ?? (sq.queue.length > 0 ? VIEW.QUEUE : VIEW.TABLE);
  const pct = sq.guestCount ? Math.round((sq.doneCount / sq.guestCount) * 100) : 0;

  // Luu gio ranh cho CA GIANG VIEN (khong phai 1 lop) - dung LAI dung API voi
  // tab "Giảng viên" (xem TeacherEditDrawer.handleSaveAvailability): backend tu
  // ap dung cho MOI lop cua nguoi nay dang "de he thong tu xep"
  // (domain/teachers.py: sync_teacher_sections), nen 1 GV day nhieu lop chi
  // khai MOT LAN duy nhat, khong phai lam lai cho tung lop.
  const handleSaveTeacherAvailability = async (teacherId, slots) => {
    try {
      await updateManualTeacher(teacherId, { availability: slots });
      setOpenTeacherId(null);
    } catch {
      // updateManualTeacher da tu ghi Nhat ky + gan `error` (hien ben duoi) -
      // nuot loi o day de khong bao "Unhandled promise rejection" tren console;
      // KHONG dong panel, de dieu phoi vien con nguyen luoi dang chon de sua/thu lai.
    }
  };

  const tabs = [
    { key: VIEW.QUEUE, label: "Cần xử lý", count: sq.queue.length, urgent: sq.queue.length > 0 },
    { key: VIEW.TABLE, label: "Bảng tra cứu", count: sq.guestCount },
    { key: VIEW.COORDS, label: "Theo điều phối viên", count: sq.coordinatorsBehind.length },
  ];

  const assignSection = assignSectionId != null
    ? (data.classes || []).find((c) => c.sectionId === assignSectionId) ?? null
    : null;

  return (
    <div className="space-y-3">
      {error && (
        <Notice tone="red" icon={TriangleAlert}>
          {error}
        </Notice>
      )}

      {/* Tien do xu ly - so lieu quan trong nhat cua man nay, de len dau. Hai
          viec CHUA XONG (phan cong GV / khai gio) deu tinh vao day, vi ca hai
          deu la dieu kien can truoc khi Giai doan 1 xep duoc dung. */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
        <p className="text-muted-foreground max-w-prose text-xs">
          Mỗi lớp thỉnh giảng cần đủ hai việc trước khi xếp: có giảng viên thật (không phải chỗ
          trống), và giảng viên đó đã khai giờ có thể dạy. Buổi của GV cơ hữu không thuộc bước này.
        </p>
        <div className="min-w-56">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {sq.doneCount}
            <span className="text-muted-foreground text-base font-normal">
              /{sq.guestCount}
            </span>
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              buổi sẵn sàng
            </span>
          </p>
          <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="glass-segmented inline-flex h-9 items-center rounded-lg border p-0.75" role="tablist">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.key}
            role="tab"
            aria-selected={activeView === t.key}
            onClick={() => setView(t.key)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              activeView === t.key
                ? "glass-segmented-active teacher-type-tab-active text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded px-1.5 text-xs tabular-nums",
                t.urgent ? "bg-red-500/15 text-red-700" : "bg-muted-foreground/15",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {activeView === VIEW.QUEUE && (
        <QueueView
          sq={sq}
          teachers={data.teachers || []}
          canEdit={canEdit}
          loading={loading}
          openTeacherId={openTeacherId}
          setOpenTeacherId={setOpenTeacherId}
          onAssign={setAssignSectionId}
          onSaveTeacherAvailability={handleSaveTeacherAvailability}
          onGoTable={() => setView(VIEW.TABLE)}
          coordFilter={coordFilter}
          onClearCoord={() => {
            setCoordFilter(null);
            setQueueLimit(QUEUE_STEP);
            setUnassignedLimit(QUEUE_STEP);
          }}
          limit={queueLimit}
          onMore={() => setQueueLimit(queueLimit + QUEUE_STEP)}
          unassignedLimit={unassignedLimit}
          onMoreUnassigned={() => setUnassignedLimit(unassignedLimit + QUEUE_STEP)}
        />
      )}

      {activeView === VIEW.TABLE && (
        <TableView
          sq={sq}
          canEdit={canEdit}
          onOpenSection={setAssignSectionId}
          search={search}
          program={program}
          stateFilter={stateFilter}
          limit={limit}
          onSearch={(v) => { setSearch(v); setLimit(PAGE_STEP); }}
          onProgram={(v) => { setProgram(v); setLimit(PAGE_STEP); }}
          onStateFilter={(v) => { setStateFilter(v); setLimit(PAGE_STEP); }}
          onMore={() => setLimit(limit + PAGE_STEP)}
        />
      )}

      {activeView === VIEW.COORDS && (
        <CoordsView
          sq={sq}
          onPickCoord={(name) => {
            setCoordFilter(name);
            setQueueLimit(QUEUE_STEP);
            setUnassignedLimit(QUEUE_STEP);
            setView(VIEW.QUEUE);
          }}
        />
      )}

      {/* Phan cong giang vien dung LAI form cua "Dữ liệu học phần" (khong viet
          mot form rieng): PATCH lop doi hoi gui DU CA form (validate_section_body
          o backend khong merge tung phan), tu viet mot ban rut gon o day de "gan
          nhanh" se de am tham lam rong cac truong khac cua lop. */}
      {assignSection && (
        <SectionEditDrawer
          data={data}
          section={assignSection}
          onClose={() => setAssignSectionId(null)}
        />
      )}
    </div>
  );
}

function QueueView({
  sq, teachers, canEdit, loading, openTeacherId, setOpenTeacherId, onAssign, onSaveTeacherAvailability, onGoTable,
  coordFilter, onClearCoord, limit, onMore, unassignedLimit, onMoreUnassigned,
}) {
  if (sq.queue.length === 0) {
    return (
      <Notice
        tone="emerald"
        icon={CircleCheck}
        action={
          <Button variant="outline" size="sm" onClick={onGoTable}>
            Xem bảng tra cứu
          </Button>
        }
      >
        Cả {sq.guestCount} buổi thỉnh giảng đều đã có giảng viên và giờ cụ thể — không còn gì
        phải xử lý.
      </Notice>
    );
  }

  const unassigned = coordFilter
    ? sq.unassigned.filter((r) => r.coordinator === coordFilter)
    : sq.unassigned;
  const needsHours = coordFilter
    ? sq.needsHours.filter((r) => r.coordinator === coordFilter)
    : sq.needsHours;
  const coordNote = coordFilter && (
    <span className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 text-xs">
      Đang lọc theo <strong className="text-foreground">{coordFilter}</strong>
      <Button variant="ghost" size="sm" onClick={onClearCoord}>
        <X className="size-3.5" />
        bỏ lọc
      </Button>
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Nhom 1: THIEU GV THAT - phai giai quyet TRUOC, vi "Nhap gio" cho mot
          cho trong la vo nghia (khong ai la nguoi that de hoi ranh luc nao). */}
      {unassigned.length > 0 && (
        <UnassignedCard
          rows={unassigned}
          total={sq.unassigned.length}
          coordFilter={coordFilter}
          coordNote={coordNote}
          canEdit={canEdit}
          onAssign={onAssign}
          limit={unassignedLimit}
          onMore={onMoreUnassigned}
        />
      )}

      {/* Nhom 2: DA CO GV thinh giang, chi thieu gio - liet ke theo HOC PHAN,
          nhung "Nhap gio" van la hanh dong CUA GIANG VIEN (xem NeedsHoursCard). */}
      {needsHours.length > 0 && (
        <NeedsHoursCard
          sq={sq}
          teachers={teachers}
          rows={needsHours}
          coordNote={unassigned.length > 0 ? null : coordNote}
          canEdit={canEdit}
          loading={loading}
          openTeacherId={openTeacherId}
          setOpenTeacherId={setOpenTeacherId}
          onSaveTeacherAvailability={onSaveTeacherAvailability}
          onOpenSection={canEdit ? onAssign : undefined}
          limit={limit}
          onMore={onMore}
        />
      )}
    </div>
  );
}

function UnassignedCard({ rows, total, coordFilter, coordNote, canEdit, onAssign, limit, onMore }) {
  const shown = rows.slice(0, limit);
  return (
    <Card
      title={`Chưa phân công giảng viên (${rows.length}${coordFilter ? ` / ${total}` : ""})`}
      note={
        canEdit
          ? 'Lớp này đang gán cho một "chỗ trống" — bấm "Phân công giảng viên" để chọn người thật.'
          : 'Vai trò "Xem thôi" không phân công được.'
      }
      headExtra={coordNote}
    >
      <ul className="divide-y">
        {shown.map((r) => (
          <li key={r.sectionId} className="flex flex-wrap items-start justify-between gap-3 p-3">
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-muted-foreground tabular-nums">#{r.sectionId}</span>
                <CourseName name={r.courseName} sectionId={r.sectionId} onOpen={canEdit ? onAssign : undefined} />
              </p>
              <p className="text-muted-foreground text-xs">
                {r.programLabel} · {r.coordinator} · {r.roomType} · {r.duration} tiết
                <span className="ml-2 text-red-700">{r.reason}</span>
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => onAssign(r.sectionId)}>
                <UserRoundPlus className="size-4" />
                Phân công giảng viên
              </Button>
            )}
          </li>
        ))}
      </ul>

      {rows.length > shown.length && (
        <div className="flex justify-center border-t p-3">
          <Button variant="outline" size="sm" onClick={onMore}>
            Hiện thêm {Math.min(QUEUE_STEP, rows.length - shown.length)} lớp (còn{" "}
            {rows.length - shown.length})
          </Button>
        </div>
      )}
    </Card>
  );
}

// Bang liet ke theo HOC PHAN (moi dong = 1 lop) de tra loi dung cau hoi "hoc
// phan nao chua khai gio, GV nao day hoc phan do" - nhung "Nhap gio" van la
// hanh dong CUA GIANG VIEN (mot GV day nhieu lop chi hien MOT nut, dat o dong
// DAI DIEN dau tien cua ho; cac dong con lai cung GV chi ghi chu tro ve dong
// do, khong bay them nut de tranh mo 2 luoi trung nhau cho cung 1 nguoi).
function NeedsHoursCard({
  sq, teachers, rows, coordNote, canEdit, loading,
  openTeacherId, setOpenTeacherId, onSaveTeacherAvailability, onOpenSection, limit, onMore,
}) {
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("");

  const programs = useMemo(
    () => [...new Set(rows.flatMap((r) => r.programParts ?? []))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (program && !(r.programParts ?? []).includes(program)) return false;
      if (!q) return true;
      return [r.courseName, r.teacherName, r.coordinator, String(r.sectionId)]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, search, program]);

  const teacherCount = useMemo(
    () => new Set(filtered.map((r) => r.teacherId)).size,
    [filtered],
  );
  const shown = filtered.slice(0, limit);
  // Dong DAI DIEN (dau tien) cho tung GV trong TRANG dang hien - chi dong nay
  // moi co nut + luoi, tinh lai moi lan render nen luon dung voi `shown` hien tai.
  const seenTeacher = new Set();

  return (
    <Card
      title={`Học phần chưa khai giờ (${filtered.length} lớp${filtered.length !== rows.length ? `/${rows.length}` : ""} · ${teacherCount} giảng viên)`}
      note={
        canEdit
          ? 'Bấm "Nhập giờ" để khai giờ rảnh cho giảng viên — áp dụng chung cho MỌI lớp của người đó.'
          : 'Vai trò "Xem thôi" không nộp giờ được.'
      }
      headExtra={
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ListSearch
            value={search}
            onChange={setSearch}
            placeholder="Tìm học phần, giảng viên, điều phối viên"
            className="w-full sm:w-64"
          />
          <FilterSelect
            label="Mọi chương trình"
            searchable
            value={program || null}
            options={programs}
            onChange={(v) => setProgram(v ?? "")}
          />
          {coordNote}
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Học phần</TableHead>
            <TableHead>Giảng viên</TableHead>
            <TableHead>Chương trình</TableHead>
            <TableHead>Điều phối viên</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => {
            const isAnchor = !seenTeacher.has(r.teacherId);
            if (isAnchor) seenTeacher.add(r.teacherId);
            const isOpen = openTeacherId === r.teacherId;
            const teacher = teachers.find((t) => t.id === r.teacherId);
            return (
              <Fragment key={r.sectionId}>
                <TableRow className={cn(isOpen && "bg-muted/40")}>
                  <TableCell className="whitespace-normal">
                    <CourseName name={r.courseName} sectionId={r.sectionId} onOpen={onOpenSection} />
                    <span className="text-muted-foreground ml-1 text-xs">
                      #{r.sectionId} · {r.roomType} · {r.duration} tiết
                    </span>
                  </TableCell>
                  <TableCell>{r.teacherName}</TableCell>
                  <TableCell>{r.programLabel}</TableCell>
                  <TableCell className="text-muted-foreground">{r.coordinator}</TableCell>
                  <TableCell className="text-right">
                    {!canEdit ? null : isAnchor ? (
                      <Button
                        size="sm"
                        variant={isOpen ? "outline" : "default"}
                        onClick={() => setOpenTeacherId(isOpen ? null : r.teacherId)}
                      >
                        {isOpen ? "Đóng" : "Nhập giờ"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        ↑ cùng GV ở trên
                      </span>
                    )}
                  </TableCell>
                </TableRow>

                {isOpen && isAnchor && canEdit && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="bg-muted/40 p-3">
                      <SubmissionWindowGrid
                        // Man nay chi lam viec voi GV THINH GIANG - gioi han toi
                        // Thu 7 (index 5), dung quy tac sc.MAX_DAY_INDEX["GUEST"].
                        numDays={Math.min(sq.numDays, 6)}
                        slotsPerDay={sq.slotsPerDay}
                        initialSlots={teacher?.availabilitySlots || []}
                        teachingSlots={teacher?.teachingSlots || []}
                        saving={loading}
                        onSave={(slots) => onSaveTeacherAvailability(r.teacherId, slots)}
                        onCancel={() => setOpenTeacherId(null)}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {shown.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                Không có lớp nào khớp bộ lọc.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {filtered.length > shown.length && (
        <div className="flex justify-center border-t p-3">
          <Button variant="outline" size="sm" onClick={onMore}>
            Hiện thêm {Math.min(QUEUE_STEP, filtered.length - shown.length)} lớp (còn{" "}
            {filtered.length - shown.length})
          </Button>
        </div>
      )}
    </Card>
  );
}

function TableView({ sq, canEdit, onOpenSection, search, program, stateFilter, limit, onSearch, onProgram, onStateFilter, onMore }) {
  const visible = filterRows(sq.rows, { search, program, state: stateFilter });
  const shown = visible.slice(0, limit);

  const renderWindowCell = (r) => {
    if (r.state === SUB_STATE.UNREPORTED) {
      return (
        <Pill tone="slate">
          {r.isEmpty ? "Chưa nộp" : `Tự do cả tuần · ${r.windowSlots.length}`}
        </Pill>
      );
    }
    const labels = r.windowSlots.map((w) => slotRangeLabel(w, r.duration, sq.slotsPerDay));
    return (
      <span className="flex flex-wrap items-center gap-1">
        {labels.slice(0, MAX_WINDOW_CHIPS).map((l, i) => (
          <Pill key={i} tone="emerald">{l}</Pill>
        ))}
        {labels.length > MAX_WINDOW_CHIPS && (
          <Pill tone="slate">+{labels.length - MAX_WINDOW_CHIPS}</Pill>
        )}
      </span>
    );
  };

  return (
    <Card
      title={`Buổi thỉnh giảng (${visible.length}${
        visible.length !== sq.guestCount ? `/${sq.guestCount}` : ""
      })`}
      headExtra={
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ListSearch
            value={search}
            onChange={onSearch}
            placeholder="Tìm tên GV, môn, điều phối viên, #id"
            className="w-full sm:w-72"
          />
          <FilterSelect
            label="Mọi chương trình"
            searchable
            value={program || null}
            options={sq.programs}
            onChange={(v) => onProgram(v ?? "")}
          />
          <FilterSelect
            label="Mọi trạng thái"
            value={stateFilter || null}
            options={STATE_OPTIONS}
            onChange={(v) => onStateFilter(v ?? "")}
          />
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Giảng viên</TableHead>
            <TableHead>Môn học</TableHead>
            <TableHead>Chương trình</TableHead>
            <TableHead>Điều phối viên</TableHead>
            <TableHead>Khung giờ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => {
            const meta = SUB_STATE_META[r.state];
            return (
              <TableRow key={r.sectionId}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {r.sectionId}
                </TableCell>
                <TableCell>
                  {r.isUnassigned ? (
                    <Pill tone="red">Chưa phân công GV</Pill>
                  ) : (
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  )}
                </TableCell>
                <TableCell>{r.teacherName}</TableCell>
                <TableCell className="whitespace-normal">
                  <CourseName name={r.courseName} sectionId={r.sectionId} onOpen={canEdit ? onOpenSection : undefined} />
                </TableCell>
                <TableCell>{r.programLabel}</TableCell>
                <TableCell className="text-muted-foreground">{r.coordinator}</TableCell>
                <TableCell className="whitespace-normal">{renderWindowCell(r)}</TableCell>
              </TableRow>
            );
          })}
          {shown.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                Không có buổi nào khớp bộ lọc.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {visible.length > shown.length && (
        <div className="flex justify-center border-t p-3">
          <Button variant="outline" size="sm" onClick={onMore}>
            Hiện thêm {Math.min(PAGE_STEP, visible.length - shown.length)} buổi (còn{" "}
            {visible.length - shown.length})
          </Button>
        </div>
      )}

      {sq.residentCount > 0 && (
        <p className="text-muted-foreground border-t p-3 text-xs">
          {sq.residentCount} buổi của GV cơ hữu không nằm trong bảng này: không điều phối
          viên nào nộp giờ cho họ, Giai đoạn 2 tự chọn giờ trong toàn tuần.
        </p>
      )}
    </Card>
  );
}

// Thanh bar do bang SO BUOI CON THIEU (khong phai % da xong) de do dai bar trung
// voi thu tu sap xep va voi viec can lam - bar dai nhat = nhieu viec nhat.
function CoordsView({ sq, onPickCoord }) {
  const maxMissing = Math.max(1, ...sq.coordinators.map((c) => c.missing));

  return (
    <Card
      title={`Theo điều phối viên (${sq.coordinators.length})`}
      note="Độ dài thanh = số buổi còn thiếu GV hoặc thiếu giờ · bấm một dòng để mở việc của riêng người đó"
    >
      <ul className="divide-y">
        {sq.coordinators.map((c) => {
          const isDone = c.missing === 0;
          const Row = isDone ? "div" : "button";
          return (
            <li key={c.coordinator}>
              <Row
                type={isDone ? undefined : "button"}
                onClick={isDone ? undefined : () => onPickCoord(c.coordinator)}
                title={isDone ? c.coordinator : `Mở ${c.missing} buổi cần xử lý của ${c.coordinator}`}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                  !isDone && "hover:bg-muted transition-colors",
                  isDone && "text-muted-foreground",
                )}
              >
                <span className="w-40 shrink-0 truncate">{c.coordinator}</span>
                <span className="bg-muted h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                  {c.missing > 0 && (
                    <span
                      className="block h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.round((c.missing / maxMissing) * 100)}%` }}
                    />
                  )}
                </span>
                <span className="w-24 shrink-0 text-right text-xs">
                  {isDone ? (
                    <span className="text-emerald-700">đủ ✓</span>
                  ) : (
                    <span className="text-amber-700">thiếu {c.missing}</span>
                  )}
                </span>
                <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
                  {c.done}/{c.total}
                </span>
              </Row>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
