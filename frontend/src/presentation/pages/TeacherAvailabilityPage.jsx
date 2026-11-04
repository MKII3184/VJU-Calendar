import { useMemo, useState } from "react";
import { GraduationCap, Plus, TriangleAlert, Upload, Wand2 } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import TeacherEditDrawer from "../manual/TeacherEditDrawer";
import ImportLecturersDialog from "../manual/ImportLecturersDialog";
import { ListSearch } from "@/components/shared/list-search";
import { FilterSelect } from "@/components/shared/filter-select";
import { Notice } from "@/components/shared/notice";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Trang nay GOP HAI man truoc day: "Giảng viên" (nhom rieng ngang hang, 2 tab
// Co huu/Thinh giang) va "Chuẩn bị dữ liệu → Giờ rảnh GV" (chi xem/khai gio cua
// THINH GIANG). Ca hai deu la MOT viec - quan ly giang vien - chi khac o loc
// theo loai truoc khi tim ten, nen gio con MOT man duy nhat: chon loai (Co huu/
// Thinh giang) bang nhan o dau trang, roi loc/tim TEN trong dung loai do. Bam
// vao mot dong mo TeacherEditDrawer - ngan keo do da co san CA thong tin GV VA
// luoi "gio co the day" (ke ca co huu, xem TeacherEditDrawer) nen khong can
// luoi rieng ngay tren trang danh sach nua.
const LOAI = {
  RESIDENT: {
    nhan: "cơ hữu",
    moTa: "Giảng viên của trường — lớp của họ được xếp ở Giai đoạn 2.",
  },
  GUEST: {
    nhan: "thỉnh giảng",
    moTa: "Khách mời từ đơn vị khác — lớp của họ được xếp ở Giai đoạn 1, theo khung giờ đã khai.",
  },
};

function tongTiet(classes, teacherId) {
  let n = 0;
  for (const c of classes) {
    if (!(c.teacherIds ?? [c.teacherId]).includes(teacherId)) continue;
    if (c.periodStart == null || c.periodEnd == null) continue;
    n += c.periodEnd - c.periodStart + 1;
  }
  return n;
}

export default function TeacherAvailabilityPage({ role }) {
  const { data, loading, generateAllTeacherAvailability } = useAppData();
  // Mac dinh THINH GIANG: day la nhom co viec "khai gio" cap thiet hon (Giai
  // doan 1 phu thuoc khung gio ho bao), con co huu Giai doan 2 tu do chon gio.
  const [loai, setLoai] = useState("GUEST");
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [drawerId, setDrawerId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [generateAllOpen, setGenerateAllOpen] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);

  const meta = LOAI[loai];
  const canEdit = role !== "viewer";
  const classes = data?.classes || [];

  // Lop cua tung nguoi: gom theo teacherIds (CA nhom dong giang), khong chi GV
  // chinh - nguoi thu hai tro di cung day lop do that.
  const lopTheoGv = useMemo(() => {
    const m = new Map();
    for (const c of classes) {
      for (const tid of c.teacherIds ?? [c.teacherId]) {
        if (!m.has(tid)) m.set(tid, []);
        m.get(tid).push(c);
      }
    }
    return m;
  }, [classes]);

  // Ban ghi "cho trong" (lop chua phan cong giang vien) khong phai con nguoi -
  // loc khoi ca hai loai, neu khong tab thinh giang ngap hang chuc dong
  // "Phòng Đào tạo điều phối".
  const all = useMemo(
    () => (data?.teachers || []).filter((t) => !t.isPlaceholder),
    [data],
  );
  const theoLoai = useMemo(() => {
    const m = { RESIDENT: [], GUEST: [] };
    for (const t of all) if (m[t.type]) m[t.type].push(t);
    return m;
  }, [all]);
  const cuaLoai = theoLoai[loai] ?? [];

  const orgs = useMemo(
    () => [...new Set(cuaLoai.map((t) => (t.org || "").trim()).filter(Boolean))].sort(),
    [cuaLoai],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cuaLoai
      .filter((t) => {
        if (orgFilter && (t.org || "").trim() !== orgFilter) return false;
        if (!q) return true;
        return [t.nameRaw, t.name, t.email, t.org]
          .some((v) => (v || "").toLowerCase().includes(q));
      })
      .sort((a, b) => (a.nameRaw || a.name || "").localeCompare(b.nameRaw || b.name || ""));
  }, [cuaLoai, orgFilter, search]);

  const drawerTeacher =
    drawerId === "new" ? null : (data?.teachers || []).find((t) => t.id === drawerId) ?? null;

  // Chua nap danh sach chinh thuc thi he thong dang DOAN loai GV tu o "Don vi
  // cong tac" trong file ke hoach - o do giao vu go tay nen sai du kieu. Noi ro
  // ra thay vi de nguoi dung tin bang nay la chuan.
  const chuaNapDanhSach = all.length > 0 && all.every((t) => t.inLecturerList == null);
  const ngoaiDanhSach = cuaLoai.filter((t) => t.inLecturerList === false);

  const handleGenerateAll = async () => {
    if (generatingAll) return;
    setGeneratingAll(true);
    try {
      await generateAllTeacherAvailability();
      setGenerateAllOpen(false);
    } catch {
      return;
    } finally {
      setGeneratingAll(false);
    }
  };

  if (!data) {
    return (
      <Notice tone="slate">
        Chưa có dữ liệu — sang “Dữ liệu học phần” để nhập hoặc nạp dữ liệu trước.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass-panel rounded-xl border">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {/* Loc LOAI GV truoc tien - day la bo loc CAP MOT, quyet dinh ca danh
              sach ben duoi va nghia cua cot "Giờ có thể dạy". Dung chung mot
              kieu "segmented" voi tab man "Học phần" de dong bo. */}
          <div className="glass-segmented inline-flex h-9 items-center rounded-lg border p-0.75" role="tablist">
            {Object.entries(LOAI).map(([key, m]) => (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={loai === key}
                onClick={() => { setLoai(key); setOrgFilter(""); }}
                className={cn(
                  "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium capitalize transition-colors",
                  loai === key
                    ? "glass-segmented-active teacher-type-tab-active text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.nhan}
                <span className="bg-muted-foreground/15 rounded px-1.5 text-xs tabular-nums">
                  {theoLoai[key]?.length ?? 0}
                </span>
              </button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs">{meta.moTa}</span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder="Tìm tên, email, đơn vị"
              className="w-full sm:w-60"
            />
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading || generatingAll || all.length === 0}
                onClick={() => setGenerateAllOpen(true)}
              >
                <Wand2 className="size-4" />
                {generatingAll ? "Đang xử lý…" : "Khai toàn bộ giờ rảnh"}
              </Button>
            )}
            <FilterSelect
              label="Mọi đơn vị"
              searchable
              value={orgFilter || null}
              options={orgs}
              onChange={(v) => setOrgFilter(v ?? "")}
            />
            {canEdit && loai === "RESIDENT" && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setImportOpen(true)}
                title="Nạp file danh sách giảng viên cơ hữu của trường (.xlsx) — dùng làm nguồn chính thức để phân loại"
              >
                <Upload className="size-4" />
                Nhập danh sách cơ hữu
              </Button>
            )}
            {canEdit && (
              <Button size="sm" disabled={loading} onClick={() => setDrawerId("new")}>
                <Plus className="size-4" />
                Thêm giảng viên
              </Button>
            )}
          </div>
        </div>

        {chuaNapDanhSach && loai === "RESIDENT" && (
          <div className="border-b p-3">
            <Notice tone="amber" icon={TriangleAlert}>
              Chưa nạp danh sách giảng viên cơ hữu. Hệ thống đang <strong>đoán</strong> loại giảng
              viên từ ô “Đơn vị công tác” trong file kế hoạch giảng dạy — ô đó giáo vụ gõ tay mỗi kỳ
              nên hay bỏ trống hoặc ghi mỗi dòng một kiểu. Bấm <strong>Nhập danh sách cơ hữu</strong>{" "}
              để phân loại theo danh sách chính thức.
            </Notice>
          </div>
        )}

        {ngoaiDanhSach.length > 0 && (
          <div className="border-b p-3">
            <Notice tone="amber" icon={TriangleAlert}>
              {ngoaiDanhSach.length} người ở tab này <strong>không có trong danh sách cơ hữu</strong>{" "}
              nhưng đang được xếp {meta.nhan}: {ngoaiDanhSach.slice(0, 5).map((t) => t.nameRaw || t.name).join(", ")}
              {ngoaiDanhSach.length > 5 && `, +${ngoaiDanhSach.length - 5}`}. Nên bổ sung vào danh
              sách hoặc chuyển loại tại đây.
            </Notice>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Đơn vị công tác</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead className="text-right">Lớp kỳ này</TableHead>
                <TableHead className="text-right">Tiết/tuần</TableHead>
                <TableHead>Giờ có thể dạy</TableHead>
                <TableHead>Nguồn phân loại</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-6 text-center">
                    Không có giảng viên {meta.nhan} nào khớp.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((t) => {
                const lop = lopTheoGv.get(t.id) || [];
                const daKhai = t.availabilitySlots?.length ?? 0;
                return (
                  <TableRow
                    key={t.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setDrawerId(t.id)}
                  >
                    <TableCell className="text-muted-foreground tabular-nums">{t.id}</TableCell>
                    <TableCell className="font-medium">
                      {t.title ? `${t.title} ` : ""}
                      {t.nameRaw || t.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[16rem] truncate">
                      {t.org || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.phone || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{lop.length}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tongTiet(classes, t.id) || "—"}
                    </TableCell>
                    <TableCell>
                      {daKhai > 0 ? (
                        <Pill tone="emerald">{daKhai} tiết đã khai</Pill>
                      ) : (
                        <Pill tone="slate">chưa khai — tự do cả tuần</Pill>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.inLecturerList === true && <Pill tone="emerald">danh sách cơ hữu</Pill>}
                      {t.inLecturerList === false && <Pill tone="slate">ngoài danh sách</Pill>}
                      {t.inLecturerList == null && (
                        <Pill tone="amber">đoán từ ô đơn vị</Pill>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="text-muted-foreground border-t px-3 py-2 text-xs">
          <GraduationCap className="mr-1 inline size-3.5" />
          Bấm vào một dòng để sửa thông tin, khai giờ có thể dạy hoặc chuyển loại cơ hữu ⇄ thỉnh giảng.
        </div>
      </div>

      <Dialog open={generateAllOpen} onOpenChange={(open) => !generatingAll && setGenerateAllOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khai toàn bộ giờ rảnh?</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ sinh lại giờ rảnh cho <strong>{all.length} giảng viên</strong> thuộc cả hai
              loại cơ hữu và thỉnh giảng, không phụ thuộc tab, từ khóa tìm kiếm hay bộ lọc đơn vị.
              Toàn bộ giờ rảnh đã khai sẽ bị thay bằng kết quả mới. Giờ đang dạy và lịch đã chốt
              được giữ nguyên.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={generatingAll}
              onClick={() => setGenerateAllOpen(false)}
            >
              Hủy
            </Button>
            <Button type="button" disabled={generatingAll} onClick={handleGenerateAll}>
              {generatingAll ? "Đang xử lý…" : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {drawerId != null && (
        <TeacherEditDrawer
          data={data}
          teacher={drawerTeacher}
          onClose={() => setDrawerId(null)}
        />
      )}

      {importOpen && <ImportLecturersDialog open onOpenChange={setImportOpen} />}
    </div>
  );
}
