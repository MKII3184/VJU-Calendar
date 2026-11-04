import { describe, expect, it, vi } from "vitest";
import { buildScheduleView, DEFAULT_FILTER } from "@/adapters/scheduleView";
import { boLocTheoPhamVi, boLocXemDeKhoiPhuc, openLessonInManual } from "@/presentation/pages/SchedulePage";

const classes = [
  { sectionId: 1, programParts: ["BCSE"], cohortParts: ["VJU2025"] },
  { sectionId: 2, programParts: ["BCSE"], cohortParts: ["VJU2024"] },
  { sectionId: 3, programParts: ["BCSE"], cohortParts: ["VJU2023"] },
  { sectionId: 4, programParts: ["FTH"], cohortParts: ["VJU2025"] },
];

const lessons = classes.map((section, index) => ({
  id: section.sectionId,
  day: 0,
  period: index,
  slot: index,
  duration: 1,
  teacherId: index + 1,
  teacherType: "GUEST",
}));

describe("SchedulePage - đồng bộ phạm vi xếp với lưới", () => {
  it("bật xem đúng phạm vi gần nhất khi mở hoặc thay đổi Xếp cho", () => {
    expect(boLocTheoPhamVi({ programs: ["BCSE"], cohorts: ["VJU2025", "VJU2024"] })).toEqual({
      programs: [],
      khoas: [],
      guest: true,
      resident: true,
      search: "",
      onlyProblems: false,
      chiXemPhamVi: true,
    });
    expect(boLocTheoPhamVi(null).chiXemPhamVi).toBe(false);
    expect(boLocXemDeKhoiPhuc(DEFAULT_FILTER)).toEqual(DEFAULT_FILTER);
    expect(boLocXemDeKhoiPhuc({ ...DEFAULT_FILTER, programs: ["FTH"], chiXemPhamVi: true }))
      .toMatchObject({ programs: ["FTH"], chiXemPhamVi: false });
  });

  it("chọn nhiều chương trình/khoá: hợp trong mỗi ô, giao giữa hai ô", () => {
    const run = (filter) => buildScheduleView({
      data: { classes, numDays: 7, slotsPerDay: 12 },
      guestResult: { lessons },
      residentResult: null,
      inbox: { items: [] },
      filter: { ...DEFAULT_FILTER, ...filter },
      phamVi: null,
    });
    expect(run({ programs: ["BCSE", "FTH"] }).lessons.map((l) => l.id)).toEqual([1, 2, 3, 4]);
    expect(run({ programs: ["BCSE"], khoas: ["VJU2025", "VJU2024"] }).lessons.map((l) => l.id)).toEqual([1, 2]);
    expect(run({ programs: ["FTH"] }).cohorts).toEqual(["VJU2025"]);
    expect(run({}).cohortsFor(["BCSE"])).toEqual(["VJU2025", "VJU2024", "VJU2023"]);
  });

  it("chặn viewer và hỏi trước khi rời lịch có thay đổi chưa lưu", () => {
    const onOpen = vi.fn();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const lesson = { id: 1, classCode: "VJU2002-1" };

    expect(openLessonInManual({ role: "viewer", lesson, onOpen })).toBe(false);
    expect(alert).toHaveBeenCalled();
    expect(openLessonInManual({ role: "staff", lesson, pendingMove: {}, onOpen })).toBe(false);
    expect(confirm).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    expect(openLessonInManual({ role: "staff", lesson, pendingMove: {}, onOpen })).toBe(true);
    expect(onOpen).toHaveBeenCalledWith([{ id: 1, classCode: "VJU2002-1" }]);
  });

  it("gửi toàn bộ thành viên của thẻ học chung, kể cả lớp thiếu mã", () => {
    const onOpen = vi.fn();
    const lesson = {
      id: 1,
      classCode: "VJU2002-1",
      hocChung: { members: [{ id: 1, classCode: "VJU2002-1" }, { id: 9, classCode: null }] },
    };

    expect(openLessonInManual({ role: "staff", lesson, onOpen })).toBe(true);
    expect(onOpen).toHaveBeenCalledWith(lesson.hocChung.members);
  });

  it("giữ toàn bộ buổi trên lưới nhưng vẫn lọc danh sách bảng theo từ khóa", () => {
    const view = buildScheduleView({
      data: {
        classes: [
          { sectionId: 1, classCode: "VJU2002-1", programParts: ["BCSE"], cohortParts: ["K68"] },
          { sectionId: 2, classCode: "VJU2003-1", programParts: ["BCSE"], cohortParts: ["K68"] },
        ],
        numDays: 7,
        slotsPerDay: 12,
      },
      guestResult: { lessons: [
        { id: 1, day: 0, period: 0, duration: 1, teacherType: "GUEST", teacherName: "An", courseName: "Giải tích" },
        { id: 2, day: 0, period: 1, duration: 1, teacherType: "GUEST", teacherName: "Bình", courseName: "Đại số" },
      ] },
      residentResult: null,
      inbox: { items: [] },
      filter: { ...DEFAULT_FILTER, search: "VJU2002-1" },
      phamVi: null,
    });

    expect(view.gridLessons.map((lesson) => lesson.id)).toEqual([1, 2]);
    expect(view.lessons.map((lesson) => lesson.id)).toEqual([1]);
    expect([...view.searchMatchIds]).toEqual([1]);
    expect(view.grid[0][1]).toBe(1);
  });

  it("tìm được thành viên không đại diện của thẻ học chung", () => {
    const sharedLessons = [
      { id: 1, hocChungId: 5, day: 0, period: 0, duration: 1, teacherType: "GUEST", courseName: "Môn A" },
      { id: 2, hocChungId: 5, day: 0, period: 0, duration: 1, teacherType: "GUEST", courseName: "Môn B" },
    ];
    const view = buildScheduleView({
      data: { classes: [
        { sectionId: 1, classCode: "A-1", programParts: [], cohortParts: [] },
        { sectionId: 2, classCode: "B-1", programParts: [], cohortParts: [] },
      ] },
      guestResult: { lessons: sharedLessons },
      residentResult: null,
      inbox: { items: [] },
      filter: { ...DEFAULT_FILTER, search: "B-1" },
      phamVi: null,
    });

    expect(view.gridLessons).toHaveLength(1);
    expect(view.lessons).toHaveLength(1);
    expect([...view.searchMatchIds]).toEqual([1]);
  });

  it("hien dong thoi cac lop BCSE cua hai khoa da chon", () => {
    const phamVi = { programs: ["BCSE"], cohorts: ["VJU2025", "VJU2024"] };
    const view = buildScheduleView({
      data: { classes, numDays: 7, slotsPerDay: 12 },
      guestResult: { lessons },
      residentResult: null,
      inbox: { items: [] },
      filter: { ...DEFAULT_FILTER, ...boLocTheoPhamVi(phamVi) },
      phamVi,
    });

    expect(view.lessons.map((lesson) => lesson.id)).toEqual([1, 2]);
  });
});
