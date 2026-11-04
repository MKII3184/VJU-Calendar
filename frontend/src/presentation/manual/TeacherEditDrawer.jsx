import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import SubmissionWindowGrid from "../submissions/SubmissionWindowGrid";
import { FilterSelect } from "@/components/shared/filter-select";
import { FormRow } from "@/components/shared/form-row";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DrawerBody, DrawerSection } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const TITLE_SUGGESTIONS = ["ThS.", "TS.", "PGS.TS.", "GS.TS"];

function suggestTeacherType(org) {
  const t = (org || "").toLowerCase();
  return t.includes("việt nhật") || t.includes("viet nhat") ? "RESIDENT" : "GUEST";
}

function emptyForm() {
  return { name: "", org: "", title: "", email: "", phone: "", teacherType: "GUEST" };
}
function formFromTeacher(t) {
  return {
    name: t.nameRaw || "", org: t.org || "", title: t.title || "",
    email: t.email || "", phone: t.phone == null ? "" : String(t.phone), teacherType: t.type,
  };
}

// Form RIENG cho 1 giang vien: thong tin ca nhan + (chi GUEST) gio co the day -
// tach khoi SectionEditDrawer vi day la du lieu cua RIENG GV, dung chung cho
// nhieu lop (sua o day anh huong tat ca lop cua GV nay). 2 khoi luu DOC LAP
// (thong tin va gio ranh) - KHONG gop thanh 1 nut chung, vi luc TAO MOI chua
// co id de gan gio ranh (phai tao xong GV truoc), va SubmissionWindowGrid von
// da co san nut luu rieng, tai dung nguyen khong sua de khong dong den 1
// component dang dung o man "Khung gio da bao".
export default function TeacherEditDrawer({ data, teacher, onClose }) {
  const { loading, addManualTeacher, updateManualTeacher, generateTeacherAvailability } = useAppData();
  const [teacherId, setTeacherId] = useState(teacher?.id ?? null);
  const [form, setForm] = useState(teacher ? formFromTeacher(teacher) : emptyForm());
  const [typeTouched, setTypeTouched] = useState(Boolean(teacher));
  const [error, setError] = useState(null);
  const [phoneError, setPhoneError] = useState(null);
  const teacherKey = teacher?.id ?? "new";

  useEffect(() => {
    setTeacherId(teacher?.id ?? null);
    setForm(teacher ? formFromTeacher(teacher) : emptyForm());
    setTypeTouched(Boolean(teacher));
    setError(null);
    setPhoneError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherKey]);

  // "Gio co the day" chi ap dung cho GUEST, gioi han toi Thu 7 (index 5) -
  // dung quy tac sc.MAX_DAY_INDEX["GUEST"] o backend, tranh tick o Chu nhat
  // roi bi tu choi khi luu.
  const numDays = Math.min(data?.numDays ?? 7, 6);
  const slotsPerDay = data?.slotsPerDay ?? 12;
  // Sau khi vua tao xong trong phien nay, doc lai ban ghi moi nhat tu
  // data.teachers de co availabilitySlots hien tai (form nay khong tu giu).
  const liveTeacher = teacherId != null ? (data?.teachers || []).find((t) => t.id === teacherId) : null;
  const teacherClasses = teacherId == null ? [] : (data?.classes || []).filter(
    (c) => (c.teacherIds ?? [c.teacherId]).includes(teacherId),
  );
  const weeklyPeriods = teacherClasses.reduce(
    (total, c) => total + (c.periodStart == null || c.periodEnd == null ? 0 : c.periodEnd - c.periodStart + 1),
    0,
  );

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setError(null);
    setPhoneError(null);
    if (!form.name.trim()) return setError("Chưa nhập Họ tên.");
    if (!/^[0-9]{0,10}$/.test(form.phone)) {
      setPhoneError("Số điện thoại chỉ gồm chữ số 0-9, tối đa 10 chữ số.");
      return setError("Số điện thoại chưa hợp lệ — hãy sửa lại trước khi lưu.");
    }
    const payload = {
      name: form.name.trim(), org: form.org.trim(), title: form.title.trim(),
      email: form.email.trim(), phone: form.phone, teacherType: form.teacherType,
    };
    try {
      if (teacherId != null) {
        await updateManualTeacher(teacherId, payload);
      } else {
        const res = await addManualTeacher(payload);
        const created = res.teachers[res.teachers.length - 1];
        setTeacherId(created.id); // khong dong drawer - de khai tiep gio ranh ngay neu la GUEST
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveAvailability = async (slots) => {
    if (teacherId == null) return;
    setError(null);
    try {
      await updateManualTeacher(teacherId, { availability: slots });
    } catch (err) {
      setError(err.message);
    }
  };

  // "Tự động khai giờ rảnh": backend TU sinh va LUU NGAY (xoa het gio ranh cu,
  // giu nguyen gio dang day) - xem POST .../generate-availability. Khong tu
  // random ben FE, chi goi API va de apDungPhanHoi cap nhat lai liveTeacher.
  const handleGenerateAvailability = async () => {
    if (teacherId == null) return;
    setError(null);
    try {
      await generateTeacherAvailability(teacherId);
    } catch (err) {
      setError(err.message);
      throw err; // de GenerateAvailabilityButton biet loi, giu hop thoai mo
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="teacher-edit-dialog manual-edit-glass flex h-[min(600px,calc(100dvh-2rem))] w-[min(1000px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b px-5 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-xl tracking-tight">
              {teacherId != null ? `Sửa giảng viên #${teacherId}` : "Thêm giảng viên mới"}
            </DialogTitle>
            <DialogDescription className="sr-only">Chỉnh sửa thông tin giảng viên.</DialogDescription>
          </div>
          <DialogClose className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none">
            <X className="size-4" />
            <span className="sr-only">Đóng</span>
          </DialogClose>
        </DialogHeader>
        <DrawerBody className={`grid grid-cols-1 !space-y-0 !overflow-y-auto !p-0 ${teacherId != null ? "min-[900px]:grid-cols-2 min-[900px]:!overflow-hidden" : ""}`}>
          <div className="min-h-0 min-w-0 space-y-5 px-5 py-4 min-[900px]:overflow-y-auto">
        {error && (
          <Notice tone="red" icon={TriangleAlert}>
            {error}
          </Notice>
        )}

        <form onSubmit={handleSaveInfo}>
          <DrawerSection title="Thông tin giảng viên">
            <FormRow label="Học hàm/học vị">
              {(id) => (
                <FilterSelect
                  id={id}
                  label="— Chưa có —"
                  emptyLabel="— Chưa có —"
                  full
                  modal={false}
                  value={form.title || null}
                  options={TITLE_SUGGESTIONS}
                  onChange={(title) => setForm((current) => ({ ...current, title: title ?? "" }))}
                />
              )}
            </FormRow>
            <FormRow label="Họ tên" required>
              {(id) => (
                <Input
                  id={id}
                  value={form.name}
                  onChange={setField("name")}
                  placeholder="Nguyễn Văn A"
                  required
                />
              )}
            </FormRow>
            <FormRow label="Đơn vị công tác">
              {(id) => (
                <Input
                  id={id}
                  value={form.org}
                  onChange={(e) => {
                    const org = e.target.value;
                    setForm((f) => ({
                      ...f,
                      org,
                      teacherType: typeTouched ? f.teacherType : suggestTeacherType(org),
                    }));
                  }}
                  placeholder="Trường Đại học Việt Nhật / Trường ABC…"
                />
              )}
            </FormRow>
            <FormRow label="Loại giảng viên">
              {(id) => (
                <>
                  <NativeSelect
                    id={id}
                    className="w-full"
                    value={form.teacherType}
                    onChange={(e) => {
                      setTypeTouched(true);
                      setForm((f) => ({ ...f, teacherType: e.target.value }));
                    }}
                  >
                    <option value="GUEST">Thỉnh giảng</option>
                    <option value="RESIDENT">Cơ hữu</option>
                  </NativeSelect>
                  {/* Danh sach co huu la NGUON CHINH THUC: nap lai file danh sach
                      se ghi de lua chon tay o day. Noi truoc, khong de nguoi dung
                      sua roi thay no tu quay lai. */}
                  {teacher?.inLecturerList === false && form.teacherType === "RESIDENT" && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Người này <strong>không có trong danh sách cơ hữu</strong> — nạp lại danh sách
                      sẽ chuyển họ về thỉnh giảng. Nên bổ sung vào file danh sách.
                    </p>
                  )}
                  {teacher?.inLecturerList === true && form.teacherType === "GUEST" && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Người này <strong>có trong danh sách cơ hữu</strong> — nạp lại danh sách sẽ
                      chuyển họ về cơ hữu.
                    </p>
                  )}
                </>
              )}
            </FormRow>
            <FormRow label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={form.email}
                  onChange={setField("email")}
                  placeholder="Không bắt buộc"
                />
              )}
            </FormRow>
            <FormRow label="Số điện thoại" error={phoneError}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  aria-invalid={Boolean(phoneError)}
                  value={form.phone}
                  onChange={(e) => { setPhoneError(null); setField("phone")(e); }}
                  placeholder="Không bắt buộc"
                />
              )}
            </FormRow>
            {teacherId != null && (
              <>
                <FormRow label="Lớp kỳ này">
                  {(id) => <Input id={id} value={teacherClasses.length} readOnly />}
                </FormRow>
                <FormRow label="Số Tiết trong tuần">
                  {(id) => <Input id={id} value={weeklyPeriods || "—"} readOnly />}
                </FormRow>
              </>
            )}

            {/* Nut nam TRONG muc thong tin chu khong o chan ngan keo: ngan keo
                nay co HAI viec luu doc lap (thong tin GV va gio co the day),
                mot nut "Lưu" chung o chan se khong biet dang luu cai nao. */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Đang lưu…" : teacherId != null ? "Lưu thông tin" : "Tạo giảng viên"}
              </Button>
            </div>
          </DrawerSection>
        </form>
          </div>
          {teacherId != null && (
            <div className="min-h-0 min-w-0 border-white/70 px-5 py-4 min-[900px]:overflow-y-auto min-[900px]:border-l">
              {/* Khai gio cho MOI giang vien (ca co huu) va co TAC DUNG THAT: da khai
                  thi chi xep trong khung do. Luoi con hien them cac o nguoi nay DANG
                  DAY (suy tu lop da chot gio) bang mau nhat - de nap file xong nhin ra
                  ngay "nguoi nay dang day T5 tiet 3-5", chu khong phai luoi trong tron.
                  Hai loai o KHONG tron lam mot: xem chu thich o SubmissionWindowGrid. */}
              <DrawerSection title="Giờ có thể dạy">
                <SubmissionWindowGrid
                  numDays={numDays} slotsPerDay={slotsPerDay}
                  initialSlots={liveTeacher?.availabilitySlots || []}
                  teachingSlots={liveTeacher?.teachingSlots || []}
                  saving={loading}
                  allowEmpty
                  gridClassName="liquid-data-grid"
                  showInstructions={false}
                  saveLabel={(n) => (n === 0 ? "Xóa hết giờ rảnh" : `Lưu ${n} khung giờ`)}
                  onSave={handleSaveAvailability}
                  onGenerateAvailability={handleGenerateAvailability}
                />
              </DrawerSection>
            </div>
          )}
        </DrawerBody>
      </DialogContent>
    </Dialog>
  );
}
