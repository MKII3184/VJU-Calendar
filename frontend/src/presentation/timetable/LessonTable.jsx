import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DAY_LABELS } from "../../adapters/dayPeriod";
import { Pill } from "@/components/shared/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Che do xem "Bang" - thay the cho luoi khi phai xem CA TRUONG cung luc (279+
// buoi chong len nhau tren luoi thi khong doc duoc chu). Bang luon doc duoc du
// mat do bao nhieu, co the sap xep theo cot, dung lam noi ra soat hang loat;
// luoi (LessonGridBoard) chi nen dung khi da loc con 1 pham vi nho.
const COLUMNS = [
  { key: "id", label: "#", get: (l) => l.id },
  { key: "courseName", label: "Buổi học", get: (l) => l.courseName },
  { key: "teacherName", label: "Giảng viên", get: (l) => l.teacherName },
  {
    key: "teacherType",
    label: "Loại",
    // Lop do DON VI KHAC dieu phoi ("Phong Dao tao dieu phoi", JLE...) khong co
    // "loai giang vien": o GV la mot don vi, khong phai nguoi. Ghi "Thinh
    // giang"/"Co huu" tren dong do la gan nham hai khai niem - tach thanh nhan
    // rieng, khop badge "DON VI KHAC" tren luoi/popup. Bat ca hai co: boQua (da
    // bam bo qua) lan donViDieuPhoi (chi moi la ung vien, chua bam).
    get: (l) =>
      l.boQua || l.donViDieuPhoi
        ? "Đơn vị khác"
        : l.teacherType === "GUEST" ? "Thỉnh giảng" : "Cơ hữu",
    // Thinh giang = xanh duong (khop STATUS_COLORS trong colorGrouping), co huu
    // = xanh la. Khong dung do: do la mau thuong hieu va danh cho buoi co van de.
    render: (l) =>
      l.boQua || l.donViDieuPhoi ? (
        <Pill tone="slate">Đơn vị khác</Pill>
      ) : l.teacherType === "GUEST" ? (
        <Pill tone="blue">Thỉnh giảng</Pill>
      ) : (
        <Pill tone="emerald">Cơ hữu</Pill>
      ),
  },
  { key: "programLabel", label: "Chương trình", get: (l) => l.programLabel },
  { key: "roomType", label: "Phòng", get: (l) => l.roomType },
  {
    key: "time",
    label: "Thời gian",
    get: (l) =>
      l.day == null
        ? ""
        : `${DAY_LABELS[l.day]} · Tiết ${l.period + 1}–${l.period + (l.duration || 1)}`,
    sortValue: (l) => (l.day == null ? -1 : l.day * 100 + l.period),
  },
];

export default function LessonTable({ lessons = [] }) {
  const [sortKey, setSortKey] = useState("time");
  const [sortDir, setSortDir] = useState(1);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const valueOf = col.sortValue || col.get;
    return [...lessons].sort((a, b) => {
      const va = valueOf(a), vb = valueOf(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }, [lessons, sortKey, sortDir]);

  // Chi phan nhom theo Thu khi dang sort theo "time" - sort theo cot khac
  // (GV, chuong trinh...) ma van chia theo ngay thi nhom se khong con y nghia.
  const rowsWithSeparators = useMemo(() => {
    if (sortKey !== "time") return sorted.map((l) => ({ type: "row", lesson: l }));
    const out = [];
    let lastGroup;
    sorted.forEach((l) => {
      const group = l.day == null ? "Chưa xếp lịch" : DAY_LABELS[l.day];
      if (group !== lastGroup) {
        out.push({ type: "sep", label: group });
        lastGroup = group;
      }
      out.push({ type: "row", lesson: l });
    });
    return out;
  }, [sorted, sortKey]);

  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const numCols = COLUMNS.length;

  if (sorted.length === 0) {
    return (
      <div className="liquid-data-grid text-muted-foreground rounded-xl border p-6 text-center text-sm">
        Không có buổi nào.
      </div>
    );
  }

  return (
    <div className="liquid-data-grid overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((c) => {
              const on = sortKey === c.key;
              return (
                <TableHead key={c.key}>
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "hover:text-foreground inline-flex items-center gap-1 uppercase transition-colors",
                      on && "text-foreground",
                    )}
                  >
                    {c.label}
                    {on &&
                      (sortDir === 1 ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      ))}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowsWithSeparators.map((item, i) =>
            item.type === "sep" ? (
              <TableRow key={`sep-${i}`} className="hover:bg-transparent">
                <TableCell
                  colSpan={numCols}
                  className="bg-white/35 text-muted-foreground py-1.5 text-xs font-semibold"
                >
                  {item.label}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={item.lesson.id}>
                {COLUMNS.map((c) => (
                  <TableCell
                    key={c.key}
                    className={c.key === "id" ? "text-muted-foreground tabular-nums" : undefined}
                  >
                    {c.render ? c.render(item.lesson) : c.get(item.lesson)}
                  </TableCell>
                ))}
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
