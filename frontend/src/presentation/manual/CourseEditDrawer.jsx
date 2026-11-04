import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import { FormRow } from "@/components/shared/form-row";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DrawerBody, DrawerSection } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const CREDIT_OPTIONS = [1, 2, 3, 4, 5, 10, 12];

function emptyForm() {
  return { code: "", name: "", credits: "" };
}
function formFromCourse(c) {
  return { code: c.code || "", name: c.name || "", credits: c.credits ?? "" };
}

// Form RIENG cho 1 hoc phan (Ma HP/Ten HP/So TC) - tach khoi SectionEditDrawer
// vi day la thong tin dung CHUNG cho nhieu lop, sua o day anh huong tat ca lop
// thuoc hoc phan nay (khong gan voi 1 lop cu the).
function demSoLop(classes, courseId) {
  if (courseId == null) return 0;
  const keys = new Set();
  (classes || []).forEach((c) => {
    if (c.courseId !== courseId) return;
    const code = (c.classCode || "").trim();
    keys.add(code ? `code:${code}` : `section:${c.sectionId}`);
  });
  return keys.size;
}

export default function CourseEditDrawer({ course, classes, onClose }) {
  const { loading, addManualCourse, updateManualCourse } = useAppData();
  const [form, setForm] = useState(course ? formFromCourse(course) : emptyForm());
  const [error, setError] = useState(null);
  const courseKey = course?.id ?? "new";

  useEffect(() => {
    setForm(course ? formFromCourse(course) : emptyForm());
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey]);

  // Chot nam o TUNG LOP: chi can 1 lop con da chot la khoa sua Ma/Ten hoc phan.
  const soLopChot = course
    ? (classes || []).filter((c) => c.courseId === course.id && c.sectionChot).length
    : 0;
  const daChot = soLopChot > 0;
  const lyDoKhoa = `Không thể sửa Mã/Tên học phần vì đã có ${soLopChot} lớp đã chốt. Hãy bỏ chốt hết các lớp trước.`;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Chưa nhập Tên học phần.");
    if (course && daChot) return setError(lyDoKhoa);
    const payload = course
      ? { code: form.code.trim(), name: form.name.trim() }
      : {
          code: form.code.trim(), name: form.name.trim(),
          credits: form.credits === "" ? null : Number(form.credits),
        };
    try {
      if (course) await updateManualCourse(course.id, payload);
      else await addManualCourse(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="teacher-edit-dialog manual-edit-glass flex h-[min(600px,calc(100dvh-2rem))] w-[min(1000px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b px-5 py-3">
          <DialogTitle className="text-xl tracking-tight">
            {course ? `Sửa học phần #${course.id}` : "Thêm học phần mới"}
          </DialogTitle>
          <DialogDescription className="sr-only">Chỉnh sửa thông tin học phần.</DialogDescription>
          <DialogClose className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none">
            <X className="size-4" />
            <span className="sr-only">Đóng</span>
          </DialogClose>
        </DialogHeader>
        <form id="course-form" onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            {error && (
              <Notice tone="red" icon={TriangleAlert}>
                {error}
              </Notice>
            )}
            {course && daChot && (
              <Notice tone="amber" icon={TriangleAlert}>
                {lyDoKhoa}
              </Notice>
            )}

            <DrawerSection title="Học phần">
              <FormRow label="Mã học phần">
                {(id) => (
                  <Input id={id} value={form.code} onChange={set("code")} placeholder="IT101" readOnly={Boolean(course) && daChot} />
                )}
              </FormRow>
              <FormRow label="Tên học phần" required>
                {(id) => (
                  <Input
                    id={id}
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Nhập môn Công nghệ thông tin"
                    required
                    readOnly={Boolean(course) && daChot}
                  />
                )}
              </FormRow>
              <FormRow label="Số tín chỉ">
                {(id) => (
                  <NativeSelect id={id} containerClassName="w-full" value={form.credits} onChange={set("credits")} disabled={Boolean(course)}>
                    <option value="">— Không rõ —</option>
                    {CREDIT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    {form.credits !== "" && !CREDIT_OPTIONS.includes(Number(form.credits)) && (
                      <option value={form.credits}>{form.credits}</option>
                    )}
                  </NativeSelect>
                )}
              </FormRow>
              <FormRow label="Tổng số lớp học phần">
                {(id) => <Input id={id} value={demSoLop(classes, course?.id)} readOnly />}
              </FormRow>
            </DrawerSection>
          </DrawerBody>
          <DialogFooter className="shrink-0 flex-row border-t px-5 py-3">
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
