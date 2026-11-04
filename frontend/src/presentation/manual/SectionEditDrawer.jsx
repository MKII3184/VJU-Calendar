import { useEffect, useState } from "react";
import { ChevronDown, CopyPlus, Plus, TriangleAlert, Trash2, X } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import ClassTimeSlotPicker from "./ClassTimeSlotPicker";
import { FilterSelect } from "@/components/shared/filter-select";
import { FormRow } from "@/components/shared/form-row";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DrawerBody, DrawerSection } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const LOCATION_OPTIONS = ["Hòa Lạc", "Mỹ Đình", "Khác"];
const TEACHING_MODE_OPTIONS = ["Trực tiếp", "Trực tuyến", "LMS"];
const PROGRAM_OPTIONS = ["BCSE", "BICA", "BJS", "Chung", "ECE", "ESAS", "ESCT", "FTH", "MJM"];
const DURATION_OPTIONS = [1, 2, 3, 4];
const MAX_STUDENTS = 200;
const MAX_TEACHING_HOURS = 50;

const joinPair = (parts) => parts.filter(Boolean).join("+");
const splitCohorts = (value) => [...new Set((value || "").split(/[+,;/]/).map((part) => part.trim()).filter(Boolean))];
const splitPrograms = (value) => {
  const raw = value || "";
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "(") depth++;
    else if (raw[i] === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (raw[i] === "+" || raw[i] === ".")) {
      parts.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(raw.slice(start).trim());
  return [...new Set(parts.filter(Boolean))];
};
const programForSave = (value) => joinPair(splitPrograms(value));

function MultiValueSelect({ id, label, parts, options, onToggle }) {
  const display = joinPair(parts);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        id={id}
        aria-label={label}
        className="glass-control border-input hover:bg-accent focus-visible:ring-ring/50 flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <span className="truncate" title={display || undefined}>{display || "— Không —"}</span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="grid max-h-[min(16rem,calc(100dvh-2rem))] w-[min(20rem,calc(100vw-2rem))] grid-cols-3 gap-1 overflow-y-auto"
        onWheel={(event) => { event.currentTarget.scrollTop += event.deltaY; }}
      >
        {options.length === 0 && <span className="text-muted-foreground col-span-3 px-2 py-1.5 text-sm">Chưa có lựa chọn</span>}
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={parts.includes(option)}
            className={option.length > 8 ? "col-span-3" : ""}
            onCheckedChange={(checked) => onToggle(option, checked)}
            onSelect={(event) => event.preventDefault()}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const isBlank = (v) => v === "" || v == null;
const validInt = (v, max) => /^\d+$/.test(String(v).trim()) && Number(v) <= max;
const validNumber = (v, max) => /^\d+(\.\d+)?$/.test(String(v).trim()) && Number(v) <= max;

// Gioi han CHI ap cho thao tac luu tay (khop webapp/domain/sections.py:
// kiem_tra_gioi_han_nhap_tay) - du lieu cu tu Excel vuot gioi han van duoc XEM,
// nhung bam Luu / "Them buoi khac" thi phai sua lai.
function validateLimits(form, section) {
  const errors = {};
  if (!DURATION_OPTIONS.includes(Number(form.duration))) {
    errors.duration = section?.sectionChot
      ? "Số tiết cũ vượt giới hạn 1–4 và lớp đang chốt: cần bỏ chốt lớp trước khi sửa và lưu."
      : "Số tiết / buổi phải là 1, 2, 3 hoặc 4 — hãy chọn lại.";
  }
  if (!isBlank(form.expectedStudents) && !validInt(form.expectedStudents, MAX_STUDENTS)) {
    errors.expectedStudents = `Số SV dự kiến phải là số nguyên từ 0 đến ${MAX_STUDENTS} hoặc để trống.`;
  }
  if ((!isBlank(form.teachingHoursLt) && !validNumber(form.teachingHoursLt, MAX_TEACHING_HOURS))
    || (!isBlank(form.teachingHoursTh) && !validNumber(form.teachingHoursTh, MAX_TEACHING_HOURS))) {
    errors.teachingHours = `Mỗi ô Số giờ dạy (LT / TH) phải từ 0 đến ${MAX_TEACHING_HOURS} hoặc để trống.`;
  }
  return errors;
}

function suggestTeacherType(org) {
  const t = (org || "").toLowerCase();
  return t.includes("việt nhật") || t.includes("viet nhat") ? "RESIDENT" : "GUEST";
}

function emptyForm() {
  return {
    teacherIds: [""], courseId: "", classCode: "", program: "",
    ltCredits: "", thCredits: "", cohort: "", expectedStudents: "",
    duration: "2", autoSchedule: true, timeSource: "auto", day: null, periodStart: null, periodEnd: null,
    location: "", teachingMode: "", language: "", otherRequirements: "", notes: "",
    coordinatorOverride: "", prevTeacherName: "", prevTeacherOrg: "",
    teachingHoursLt: "", teachingHoursTh: "",
  };
}

function formFromClass(c) {
  return {
    // MOI giang vien cua lop, vai tro ngang nhau (khong co "GV chinh").
    teacherIds: (c.teacherIds?.length ? c.teacherIds : [c.teacherId]).map(String),
    courseId: c.courseId != null ? String(c.courseId) : "",
    classCode: c.classCode || "", program: c.programName || "",
    ltCredits: c.ltCredits ?? "", thCredits: c.thCredits ?? "",
    cohort: c.cohort || "", expectedStudents: c.expectedStudents ?? "",
    duration: String(c.duration ?? "2"),
    autoSchedule: c.timeSource === "auto" || c.timeAssumed,
    timeSource: c.timeSource || (c.timeAssumed ? "auto" : "fixed"),
    day: c.day, periodStart: c.periodStart, periodEnd: c.periodEnd,
    location: c.location || "", teachingMode: c.teachingMode || "",
    language: c.language || "", otherRequirements: c.otherRequirements || "", notes: c.notes || "",
    coordinatorOverride: c.coordinatorOverride || "",
    prevTeacherName: c.prevTeacherName || "", prevTeacherOrg: c.prevTeacherOrg || "",
    teachingHoursLt: c.teachingHoursLt ?? "", teachingHoursTh: c.teachingHoursTh ?? "",
  };
}

// Side-panel: tao lop moi (section=null) hoac sua lop da co (section=1 dong tu
// data.classes). Tu goi useAppData() truc tiep (khong qua props tu trang cha) vi
// day la 1 "man con" kha doc lap voi nhieu hanh dong rieng (them GV nhanh,
// luu, xoa) - giam prop-drilling qua ManualEntryPage.
// onOpenTeacher: mo ngan cua MOT giang vien trong lop (de sua thong tin/khai gio
// co the day) - trang cha giu state ngan nao dang mo nen phai di qua props.
export default function SectionEditDrawer({ data, section, onClose, onDuplicated, onOpenTeacher }) {
  const { loading, addManualTeacher, addManualSection, updateManualSection, deleteManualSection, doBoQua } = useAppData();
  const [form, setForm] = useState(section ? formFromClass(section) : emptyForm());
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: "", org: "", teacherType: "GUEST" });

  // Khoa theo sectionId (so nguyen on dinh), KHONG khoa theo object 'section':
  // moi lan them nhanh GV (+ Giang vien moi) lam setData()
  // thay THE CA data -> selectedSection ben ManualEntryPage la object MOI du cung
  // sectionId, neu dependency la object se reset mat sach cac o khac dang go nua
  // chung. Chi reset khi THUC SU chuyen sang sua 1 lop khac (hoac dong/mo lai).
  const sectionKey = section?.sectionId ?? "new";
  useEffect(() => {
    setForm(section ? formFromClass(section) : emptyForm());
    setError(null);
    setFieldErrors({});
    setShowAddTeacher(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  const teachers = data?.teachers || [];
  const programParts = splitPrograms(form.program);
  const cohortParts = splitCohorts(form.cohort);
  const programOptions = [...new Set([...PROGRAM_OPTIONS, ...programParts.filter(Boolean)])];
  const cohortOptions = [...new Set((data?.classes || [])
    .flatMap((c) => c.cohortParts?.length ? c.cohortParts : (c.cohort || "").split(/[+,;/]/))
    .map((part) => part.trim()).filter(Boolean))]
    .sort().reverse();
  for (const part of cohortParts) if (part && !cohortOptions.includes(part)) cohortOptions.push(part);
  const togglePart = (key, split) => (part, checked) => setForm((current) => {
    const parts = split(current[key]);
    return { ...current, [key]: joinPair(checked ? [...parts, part] : parts.filter((p) => p !== part)) };
  });
  const courses = data?.courses || [];
  const numDays = data?.numDays ?? 7;
  const slotsPerDay = data?.slotsPerDay ?? 12;
  const teacherTypeFor = (ids) => ids.some((id) => teachers.find((t) => String(t.id) === String(id))?.type === "GUEST")
    ? "GUEST"
    : "RESIDENT";
  const maxDayFor = (ids) => Math.min(numDays - 1, teacherTypeFor(ids) === "GUEST" ? 5 : 4);
  const maxDayIndex = maxDayFor(form.teacherIds.filter(Boolean));
  const timeLocked = Boolean(section?.sectionChot || section?.hocChungLockedBy);
  const hasDisplayedTime = form.day != null && form.periodStart != null && form.periodEnd != null;

  const clearFieldError = (key) => setFieldErrors((errs) => {
    if (!errs[key]) return errs;
    const { [key]: _removed, ...rest } = errs;
    return rest;
  });
  const set = (key) => (e) => {
    clearFieldError(key === "teachingHoursLt" || key === "teachingHoursTh" ? "teachingHours" : key);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const setDuration = (e) => {
    const duration = e.target.value;
    clearFieldError("duration");
    setForm((f) => {
      if (section?.sectionChot || f.day == null) return { ...f, duration };
      const selectedLength = f.periodEnd - f.periodStart + 1;
      return selectedLength === Number(duration)
        ? { ...f, duration }
        : { ...f, duration, day: null, periodStart: null, periodEnd: null };
    });
  };
  const setTeacherAt = (index, teacherId) => setForm((f) => {
    const teacherIds = f.teacherIds.map((id, i) => (i === index ? teacherId : id));
    const invalidDay = !section?.sectionChot && f.day != null && f.day > maxDayFor(teacherIds.filter(Boolean));
    return {
      ...f,
      teacherIds,
      ...(invalidDay ? { day: null, periodStart: null, periodEnd: null } : {}),
    };
  });
  const removeTeacherAt = (index) => setForm((f) => {
    const teacherIds = f.teacherIds.filter((_, i) => i !== index);
    const invalidDay = !section?.sectionChot && f.day != null && f.day > maxDayFor(teacherIds.filter(Boolean));
    return {
      ...f,
      teacherIds,
      ...(invalidDay ? { day: null, periodStart: null, periodEnd: null } : {}),
    };
  });

  const submitNewTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim()) return;
    const res = await addManualTeacher({
      name: newTeacher.name.trim(), org: newTeacher.org.trim(), teacherType: newTeacher.teacherType,
    });
    const created = res.teachers[res.teachers.length - 1];
    // GV vua tao vao dong dang trong dau tien, khong thi them dong moi.
    setForm((f) => {
      const i = f.teacherIds.findIndex((x) => !x);
      const ids = [...f.teacherIds];
      if (i >= 0) ids[i] = String(created.id);
      else ids.push(String(created.id));
      return { ...f, teacherIds: ids };
    });
    setNewTeacher({ name: "", org: "", teacherType: "GUEST" });
    setShowAddTeacher(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.teacherIds.filter(Boolean).length) return setError("Chưa chọn giảng viên.");
    if (!form.courseId) return setError("Chưa chọn học phần.");
    const limitErrors = validateLimits(form, section);
    setFieldErrors(limitErrors);
    if (Object.keys(limitErrors).length) return setError("Có ô nhập chưa hợp lệ — xem thông báo đỏ dưới từng ô.");
    const duration = Number(form.duration);
    if (duration > slotsPerDay) {
      return setError(`Số tiết mỗi buổi dạy phải là số nguyên từ 1 đến ${slotsPerDay}.`);
    }
    if (!form.autoSchedule && (form.day == null || form.periodStart == null || form.periodEnd == null)) {
      return setError("Chưa chọn giờ — bấm một ô trong bảng tuần, hoặc chọn \"Để hệ thống tự xếp giờ\".");
    }
    const originalTimeUnchanged = section
      && form.day === section.day
      && form.periodStart === section.periodStart
      && form.periodEnd === section.periodEnd;
    if (section?.sectionChot && !form.autoSchedule) {
      const teacherIdsUnchanged = form.teacherIds.filter(Boolean).map(Number).join(",")
        === (section.teacherIds?.length ? section.teacherIds : [section.teacherId]).map(Number).join(",");
      if (!teacherIdsUnchanged && form.day > maxDayIndex) {
        return setError("Nhóm giảng viên mới không được chọn ngày đang khóa. Hãy bỏ chốt lớp trước khi đổi giảng viên.");
      }
      if (duration !== Number(section.duration)
        && form.periodEnd - form.periodStart + 1 !== duration) {
        return setError("Không thể đổi Số tiết / buổi làm lệch giờ đang khóa. Hãy bỏ chốt lớp trước.");
      }
    }
    if (!form.autoSchedule && !section?.sectionChot && !originalTimeUnchanged) {
      if (form.day < 0 || form.day >= numDays || form.day > maxDayIndex
        || form.periodStart < 1 || form.periodEnd > slotsPerDay
        || form.periodEnd - form.periodStart + 1 !== duration) {
        return setError("Giờ đã chọn không còn hợp lệ với số tiết hoặc nhóm giảng viên. Vui lòng chọn lại.");
      }
    }

    const payload = {
      teacherIds: form.teacherIds.filter(Boolean).map(Number),
      courseId: Number(form.courseId),
      classCode: form.classCode.trim(), program: programForSave(form.program),
      ltCredits: form.ltCredits === "" ? 0 : Number(form.ltCredits),
      thCredits: form.thCredits === "" ? 0 : Number(form.thCredits),
      cohort: joinPair(splitCohorts(form.cohort)),
      expectedStudents: form.expectedStudents === "" ? null : Number(form.expectedStudents),
      duration: Number(form.duration),
      location: form.location, teachingMode: form.teachingMode,
      language: form.language.trim(), otherRequirements: form.otherRequirements.trim(),
      notes: form.notes.trim(), coordinatorOverride: form.coordinatorOverride.trim(),
      prevTeacherName: form.prevTeacherName.trim(), prevTeacherOrg: form.prevTeacherOrg.trim(),
      teachingHoursLt: form.teachingHoursLt === "" ? null : Number(form.teachingHoursLt),
      teachingHoursTh: form.teachingHoursTh === "" ? null : Number(form.teachingHoursTh),
    };
    if (form.autoSchedule && (!hasDisplayedTime || section?.timeAssumed || section?.timePreview)) {
      payload.autoSchedule = true;
      payload.timeSource = "auto";
    } else {
      payload.day = form.day;
      payload.periodStart = form.periodStart;
      payload.periodEnd = form.periodEnd;
      payload.timeSource = form.autoSchedule ? "auto" : "manual";
    }

    try {
      if (section) await updateManualSection(section.sectionId, payload);
      else await addManualSection(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!section) return;
    if (!window.confirm(`Xóa lớp "${section.classCode || section.courseName}" (#${section.sectionId})? Không thể hoàn tác.`)) return;
    await deleteManualSection(section.sectionId);
    onClose();
  };

  // "1 lop hoc N buoi/tuan khac ngay" = N dong cung Ma lop, khac Thoi gian (xem
  // giai thich voi giao vu) - nut nay sao chep MOI THONG TIN DANG CO trong form
  // (hoc phan/GV/TC/dia diem...) sang 1 dong MOI, CHI xoa rieng gio (bat auto)
  // de khoi phai go lai tu dau, rieng gio thi bat buoc chon lai cho buoi khac.
  const handleDuplicate = async () => {
    setError(null);
    if (!form.teacherIds.filter(Boolean).length || !form.courseId) {
      return setError("Cần chọn học phần và giảng viên trước khi nhân bản.");
    }
    const limitErrors = validateLimits(form, section);
    setFieldErrors(limitErrors);
    if (Object.keys(limitErrors).length) return setError("Có ô nhập chưa hợp lệ — xem thông báo đỏ dưới từng ô.");
    const payload = {
      teacherIds: form.teacherIds.filter(Boolean).map(Number),
      courseId: Number(form.courseId),
      classCode: form.classCode.trim(), program: programForSave(form.program),
      ltCredits: form.ltCredits === "" ? 0 : Number(form.ltCredits),
      thCredits: form.thCredits === "" ? 0 : Number(form.thCredits),
      cohort: joinPair(splitCohorts(form.cohort)),
      expectedStudents: form.expectedStudents === "" ? null : Number(form.expectedStudents),
      duration: Number(form.duration),
      location: form.location, teachingMode: form.teachingMode,
      language: form.language.trim(), otherRequirements: form.otherRequirements.trim(),
      notes: form.notes.trim(), coordinatorOverride: form.coordinatorOverride.trim(),
      prevTeacherName: form.prevTeacherName.trim(), prevTeacherOrg: form.prevTeacherOrg.trim(),
      teachingHoursLt: form.teachingHoursLt === "" ? null : Number(form.teachingHoursLt),
      teachingHoursTh: form.teachingHoursTh === "" ? null : Number(form.teachingHoursTh),
      autoSchedule: true, // buoi moi CHUA co gio - bat GV chon rieng cho buoi nay
    };
    try {
      const res = await addManualSection(payload);
      const created = res.classes[res.classes.length - 1];
      onDuplicated?.(created.sectionId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="teacher-edit-dialog manual-edit-glass flex h-[min(750px,calc(100dvh-2rem))] w-[min(1500px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b px-5 py-3">
          <DialogTitle className="text-xl tracking-tight">
            {section ? `Sửa lớp ${section.classCode || `#${section.sectionId}`}` : "Thêm lớp mới"}
          </DialogTitle>
          <DialogDescription className="sr-only">Chỉnh sửa thông tin lớp học phần.</DialogDescription>
          <DialogClose className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none">
            <X className="size-4" />
            <span className="sr-only">Đóng</span>
          </DialogClose>
        </DialogHeader>
        <form id="section-form" onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody className="grid grid-cols-1 !space-y-0 !overflow-y-auto !p-0 min-[1100px]:grid-cols-3 min-[1100px]:!overflow-hidden">
            <div className="min-h-0 min-w-0 space-y-5 px-5 py-4 min-[1100px]:overflow-y-auto">
              {error && (
                <Notice tone="red" icon={TriangleAlert}>
                  {error}
                </Notice>
              )}

          <DrawerSection title="Học phần">
            <FormRow label="Học phần" required>
              {(id) => (
                <FilterSelect
                  id={id}
                  label="— Chọn học phần —"
                  emptyLabel="— Chọn học phần —"
                  searchPlaceholder="Tìm mã hoặc tên học phần…"
                  searchable
                  full
                  modal={false}
                  value={form.courseId || null}
                  options={courses.map((c) => ({
                    value: String(c.id),
                    label: c.code ? `${c.code} — ${c.name}` : c.name,
                  }))}
                  onChange={(courseId) => setForm((f) => ({ ...f, courseId: courseId ?? "" }))}
                />
              )}
            </FormRow>
          </DrawerSection>

          <DrawerSection title="Lớp học phần">
            <FormRow label="Mã lớp">
              {(id) => <Input id={id} value={form.classCode} onChange={set("classCode")} placeholder="IT101.1" readOnly={Boolean(section)} />}
            </FormRow>
            <FormRow label="Chương trình (CTĐT)">
              {(id) => (
                <MultiValueSelect
                  id={id} label="Chương trình (CTĐT)"
                  parts={programParts} options={programOptions}
                  onToggle={togglePart("program", splitPrograms)}
                />
              )}
            </FormRow>
            <FormRow label="Phân bổ TC (LT / TH)">
              <div className="flex gap-2">
                <Input type="number" min={0} step="0.5" value={form.ltCredits} onChange={set("ltCredits")} placeholder="Lý thuyết" />
                <Input type="number" min={0} step="0.5" value={form.thCredits} onChange={set("thCredits")} placeholder="Thực hành" />
              </div>
            </FormRow>
            <FormRow label="Khóa">
              {(id) => (
                <MultiValueSelect
                  id={id} label="Khóa"
                  parts={cohortParts} options={cohortOptions}
                  onToggle={togglePart("cohort", splitCohorts)}
                />
              )}
            </FormRow>
            <FormRow label="Số SV dự kiến" error={fieldErrors.expectedStudents}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  value={form.expectedStudents}
                  onChange={set("expectedStudents")}
                  aria-invalid={Boolean(fieldErrors.expectedStudents)}
                />
              )}
            </FormRow>
            <FormRow label="Số tiết / buổi" required error={fieldErrors.duration}>
              {(id) => (
                <NativeSelect
                  id={id}
                  containerClassName="w-full"
                  value={form.duration}
                  onChange={setDuration}
                  aria-invalid={Boolean(fieldErrors.duration)}
                >
                  {!DURATION_OPTIONS.includes(Number(form.duration)) && (
                    <option value={form.duration}>{form.duration} — vượt giới hạn, hãy chọn lại</option>
                  )}
                  {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </NativeSelect>
              )}
            </FormRow>
          </DrawerSection>

          <DrawerSection title="Giờ dạy & hình thức">
            <FormRow label="Số giờ dạy (LT / TH)" error={fieldErrors.teachingHours}>
              <div className="flex gap-2">
                <Input type="number" step="any" value={form.teachingHoursLt} onChange={set("teachingHoursLt")} placeholder="Lý thuyết" aria-label="Số giờ dạy lý thuyết" />
                <Input type="number" step="any" value={form.teachingHoursTh} onChange={set("teachingHoursTh")} placeholder="Thực hành" aria-label="Số giờ dạy thực hành" />
              </div>
            </FormRow>
            <FormRow label="Địa điểm giảng dạy">
              {(id) => (
                <NativeSelect id={id} className="w-full" value={form.location} onChange={set("location")}>
                  <option value="">— Không rõ —</option>
                  {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </NativeSelect>
              )}
            </FormRow>
            <FormRow label="Hình thức giảng dạy">
              {(id) => (
                <NativeSelect id={id} className="w-full" value={form.teachingMode} onChange={set("teachingMode")}>
                  <option value="">— Không rõ —</option>
                  {TEACHING_MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </NativeSelect>
              )}
            </FormRow>
          </DrawerSection>
            </div>

            <div className="min-h-0 min-w-0 space-y-5 border-white/70 px-5 py-4 min-[1100px]:overflow-y-auto min-[1100px]:border-l">
          <DrawerSection title="Giảng viên kỳ này">
            {/* DANH SACH ngang hang, khong phai "1 GV chinh + tick dong giang".
                Ban tick cu khong theo doi duoc: nguoi thu 2 tro di nam trong mot
                hop tick dai, khong thay email/SDT/don vi cua ho, va nhin khong ra
                lop dang co bao nhieu nguoi. Nay moi nguoi mot dong, doi/xoa tai
                cho, kem nut mo ngan cua chinh nguoi do de khai gio co the day. */}
            {form.teacherIds.map((tid, i) => {
              const gv = teachers.find((t) => String(t.id) === String(tid));
              return (
                <div key={`${tid}-${i}`} className="flex items-start gap-2">
                  <FilterSelect
                    label="— Chọn giảng viên —"
                    emptyLabel="— Chọn giảng viên —"
                    searchPlaceholder="Tìm tên giảng viên…"
                    searchable
                    full
                    modal={false}
                    value={tid || null}
                    options={teachers.map((t) => ({
                      value: String(t.id),
                      label: `${t.name} · ${t.type === "GUEST" ? "Thỉnh giảng" : "Cơ hữu"}`,
                    }))}
                    onChange={(teacherId) => setTeacherAt(i, teacherId ?? "")}
                  />
                  {gv && onOpenTeacher && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Mở giảng viên này để sửa thông tin / khai giờ có thể dạy"
                      onClick={() => onOpenTeacher(gv.id)}
                    >
                      Giờ dạy
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={form.teacherIds.length <= 1}
                    title={form.teacherIds.length <= 1 ? "Lớp phải có ít nhất một giảng viên" : "Bỏ người này khỏi lớp"}
                    onClick={() => removeTeacherAt(i)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForm((f) => ({ ...f, teacherIds: [...f.teacherIds, ""] }))}
            >
              <Plus className="size-4" />
              Thêm giảng viên cùng dạy
            </Button>
            {!showAddTeacher ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddTeacher(true)}>
                <Plus className="size-4" />
                Giảng viên mới
              </Button>
            ) : (
              <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                <Input
                  className="min-w-36 flex-1"
                  placeholder="Họ tên"
                  value={newTeacher.name}
                  onChange={(e) => setNewTeacher((f) => ({ ...f, name: e.target.value }))}
                />
                <Input
                  className="min-w-36 flex-1"
                  placeholder="Đơn vị công tác"
                  value={newTeacher.org}
                  onChange={(e) =>
                    setNewTeacher((f) => ({ ...f, org: e.target.value, teacherType: suggestTeacherType(e.target.value) }))
                  }
                />
                <NativeSelect
                  value={newTeacher.teacherType}
                  onChange={(e) => setNewTeacher((f) => ({ ...f, teacherType: e.target.value }))}
                >
                  <option value="GUEST">Thỉnh giảng</option>
                  <option value="RESIDENT">Cơ hữu</option>
                </NativeSelect>
                <Button type="button" size="sm" onClick={submitNewTeacher}>Thêm</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddTeacher(false)}>
                  Hủy
                </Button>
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Giảng viên kỳ trước">
            <FormRow label="Họ tên">
              {(id) => <Input id={id} value={form.prevTeacherName} onChange={set("prevTeacherName")} placeholder="Không bắt buộc" />}
            </FormRow>
            <FormRow label="Đơn vị công tác">
              {(id) => <Input id={id} value={form.prevTeacherOrg} onChange={set("prevTeacherOrg")} placeholder="Không bắt buộc" />}
            </FormRow>
          </DrawerSection>

          {/* BỎ QUA MỘT LỚP — trước đây chỉ bỏ qua được cả cụm "lớp do đơn vị
              khác điều phối" ở đầu màn (một nút, một danh sách hệ thống tự đề
              xuất). Nhưng lý do bỏ qua không chỉ có một: môn linh động chỉ ghi
              vào cho có trong danh sách đăng ký cũng là lớp khoa không xếp, và
              nó không nằm trong danh sách đề xuất nào cả.

              Đặt ngay dưới "Hình thức" vì đó là chỗ người dùng vừa trả lời "lớp
              này học kiểu gì" — câu tiếp theo tự nhiên là "vậy có xếp nó không".

              Bấm là ĂN NGAY, không đợi "Lưu": đây là một hành động riêng chứ
              không phải một ô của biểu mẫu, y như "Xóa lớp"/"Thêm buổi khác". */}
          {section && (
            <DrawerSection title="Có xếp lớp này không?">
              <Label htmlFor="sec-bo-qua" className="text-sm font-normal">
                <Checkbox
                  id="sec-bo-qua"
                  checked={!!section.boQua}
                  disabled={loading}
                  onCheckedChange={(v) => doBoQua([section.sectionId], v === true)}
                />
                Bỏ qua lớp này — khoa không xếp
              </Label>
              {/* Lớp học chung là MỘT buổi dạy, bỏ qua nửa nhóm là vô nghĩa nên
                  backend kéo cả nhóm đi theo (domain/bo_qua.py: _lan_hoc_chung).
                  Phải nói trước, không thì bấm một lớp mà mất ba. */}
              {section.hocChungWith?.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Lớp này học chung một buổi với {section.hocChungWith.length} lớp khác — cả nhóm
                  sẽ được bỏ qua cùng.
                </p>
              )}
            </DrawerSection>
          )}

          <details className="rounded-lg border">
            <summary className="hover:bg-muted/60 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium">
              Khác (ngôn ngữ, yêu cầu khác, ghi chú, điều phối viên)
            </summary>
            <div className="space-y-3 border-t px-3 py-3">
              <FormRow label="Ngôn ngữ giảng dạy">
                {(id) => <Input id={id} value={form.language} onChange={set("language")} placeholder="Không bắt buộc" />}
              </FormRow>
              <FormRow label="Yêu cầu khác">
                {(id) => <Input id={id} value={form.otherRequirements} onChange={set("otherRequirements")} placeholder="Không bắt buộc" />}
              </FormRow>
              <FormRow label="Ghi chú">
                {(id) => <Input id={id} value={form.notes} onChange={set("notes")} placeholder="Không bắt buộc" />}
              </FormRow>
              <FormRow label="Điều phối viên">
                {(id) => <Input id={id} value={form.coordinatorOverride} onChange={set("coordinatorOverride")} placeholder="Nếu khác mặc định" />}
              </FormRow>
            </div>
          </details>
            </div>

            <div className="min-h-0 min-w-0 space-y-5 border-white/70 px-5 py-4 min-[1100px]:overflow-y-auto min-[1100px]:border-l">
              <DrawerSection title="Thời gian">
                <Label htmlFor="sed-auto" className="text-sm font-normal">
                  <Checkbox
                    id="sed-auto"
                    checked={form.autoSchedule}
                    disabled={timeLocked}
                    onCheckedChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        autoSchedule: v === true,
                        timeSource: v === true ? "auto" : "manual",
                        day: null, periodStart: null, periodEnd: null,
                      }))
                    }
                  />
                  Để hệ thống tự xếp giờ
                </Label>
                {form.autoSchedule && !hasDisplayedTime && (
                  <Notice tone="slate">
                    Đang chờ xếp. Lựa chọn này chỉ giao giờ cho solver; hệ thống không tự chạy khi bạn tick hoặc lưu form.
                  </Notice>
                )}
                {form.autoSchedule && hasDisplayedTime && (
                  <Notice tone={section?.timePreview ? "amber" : "emerald"}>
                    {section?.timePreview
                      ? "Giờ dự kiến do hệ thống xếp — chưa lưu thời khoá biểu."
                      : "Giờ đã lưu, nguồn gốc: Để hệ thống tự xếp giờ."}
                  </Notice>
                )}
                {!form.autoSchedule && section?.timeSource === "auto" && !timeLocked && (
                  <Notice tone="amber">
                    Chọn một dải giờ bên dưới sẽ thay giờ do hệ thống xếp bằng giờ nhập tay.
                  </Notice>
                )}
                {hasDisplayedTime && (form.autoSchedule || timeLocked) && (
                  <ClassTimeSlotPicker
                    numDays={numDays}
                    slotsPerDay={slotsPerDay}
                    duration={form.duration}
                    maxDayIndex={maxDayIndex}
                    disabled
                    value={{ day: form.day, periodStart: form.periodStart, periodEnd: form.periodEnd }}
                    onChange={() => {}}
                  />
                )}
                {!form.autoSchedule && !timeLocked && (
                  <ClassTimeSlotPicker
                    numDays={numDays}
                    slotsPerDay={slotsPerDay}
                    duration={form.duration}
                    maxDayIndex={maxDayIndex}
                    disabled={false}
                    value={hasDisplayedTime ? { day: form.day, periodStart: form.periodStart, periodEnd: form.periodEnd } : null}
                    onChange={(v) => setForm((f) => ({ ...f, day: v?.day ?? null, periodStart: v?.periodStart ?? null, periodEnd: v?.periodEnd ?? null }))}
                  />
                )}
                {timeLocked && section?.hocChungLockedBy && (
                  <Notice tone="slate">Giờ bị khóa vì lớp học chung đã chốt; bạn vẫn có thể sửa thông tin khác.</Notice>
                )}
              </DrawerSection>
            </div>
          </DrawerBody>
          <DialogFooter className="shrink-0 flex-row flex-wrap items-center border-t px-5 py-3">
            {section && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive min-[640px]:mr-auto"
                disabled={loading}
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Xóa lớp
              </Button>
            )}
            {section && (
              <Button type="button" variant="outline" disabled={loading} onClick={handleDuplicate}>
                <CopyPlus className="size-4" />
                Thêm buổi khác
              </Button>
            )}
            {/* "Hủy" ro rang canh "Lưu" - dua vao dau X goc tren hoac Esc de
                thoat la bat nguoi dung phai DOAN rang bo di thi khong ghi gi. */}
            <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
