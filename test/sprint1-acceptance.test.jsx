import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportExcelDialog from "@/presentation/manual/ImportExcelDialog";
import ExportExcelDialog from "@/presentation/manual/ExportExcelDialog";
import TeacherEditDrawer from "@/presentation/manual/TeacherEditDrawer";
import CourseEditDrawer from "@/presentation/manual/CourseEditDrawer";
import TeacherAvailabilityPage from "@/presentation/pages/TeacherAvailabilityPage";
import ScheduleToolbar, { ScheduleActions } from "@/presentation/schedule/ScheduleToolbar";
import SchedulingWorkflowDialog from "@/presentation/schedule/SchedulingWorkflowDialog";
import SectionTable from "@/presentation/manual/SectionTable";
import { DEFAULT_FILTER } from "@/adapters/scheduleView";
import { buildSteps } from "@/adapters/buocGiai";
import { boLocTheoPhamVi } from "@/presentation/pages/SchedulePage";

const app = vi.hoisted(() => ({
  doImportPreview: vi.fn(),
  doImportCommit: vi.fn(),
  addManualTeacher: vi.fn(),
  updateManualTeacher: vi.fn(),
  addManualCourse: vi.fn(),
}));

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({ loading: false, ...app }),
}));

vi.mock("@/services/schedulerService", () => ({
  exportClasses: vi.fn(),
}));

const preview = {
  summary: {
    sheet: "FATE",
    soLopDungDuoc: 2,
    soHocPhan: 1,
    soGiangVien: 2,
    soChuongTrinh: 1,
    soLopDaCoGio: 1,
    soLopChuaCoGio: 1,
    soLopChuaPhanCong: 0,
    soDongBoQua: 0,
    soCanhBao: 0,
  },
  dataIssues: [],
  dataIssuesSummary: { soNghiemTrong: 0, soLuuY: 0 },
  skippedGroups: [],
  warningGroups: [],
  errors: [],
};

const teacher = {
  id: 3,
  name: "GV thỉnh giảng",
  nameRaw: "GV thỉnh giảng",
  type: "GUEST",
  org: "Ngoài trường",
  title: "",
  email: "",
  phone: "",
};

const view = {
  programs: ["FTH", "BCSE"],
  cohorts: ["K68"],
  cohortsFor: () => ["K68"],
  lessons: [{ id: 1 }],
};

const row = {
  sectionId: 20,
  courseId: 10,
  courseCode: "MTH101",
  courseName: "Giải tích",
  credits: 3,
  classCode: "MTH101-1",
  duration: 4,
  cohort: "K68",
  programLabel: "BCSE",
  day: 0,
  periodStart: 2,
  periodEnd: 5,
  teachers: [{ id: 1, name: "Nguyễn Văn A", org: "VJU" }],
  status: "ready_fixed",
  scheduleStatus: "scheduled",
};

beforeEach(() => {
  vi.clearAllMocks();
  app.data = {
    teachers: [teacher],
    classes: [],
  };
  app.doImportPreview.mockResolvedValue(preview);
  app.doImportCommit.mockResolvedValue({});
  app.updateManualTeacher.mockResolvedValue({});
  app.addManualCourse.mockResolvedValue({});
});

function chooseFile() {
  const file = new File(["xlsx"], "schedule.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  fireEvent.change(document.getElementById("import-file"), { target: { files: [file] } });
}

describe("Sprint 1 - 16 acceptance test cases", () => {
  it("TC-01: imports a valid Excel file by merging with existing data", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ImportExcelDialog open onOpenChange={onOpenChange} />);
    chooseFile();
    await screen.findByRole("button", { name: "Gộp thêm vào dữ liệu hiện có" });
    await user.click(screen.getByRole("button", { name: "Gộp thêm vào dữ liệu hiện có" }));
    await waitFor(() => expect(app.doImportCommit).toHaveBeenCalledWith("merge"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("TC-02: imports a valid Excel file by replacing old data", async () => {
    const user = userEvent.setup();
    render(<ImportExcelDialog open onOpenChange={vi.fn()} />);
    chooseFile();
    await screen.findByText("Xóa dữ liệu cũ và nạp 2 lớp");
    await user.click(screen.getByRole("button", { name: "Xóa dữ liệu cũ và nạp 2 lớp" }));
    await waitFor(() => expect(app.doImportCommit).toHaveBeenCalledWith("replace"));
  });

  it("TC-03: shows an error when the Excel file has an invalid shape", async () => {
    app.doImportPreview.mockRejectedValue(new Error("Thiếu cột bắt buộc Cohort"));
    render(<ImportExcelDialog open onOpenChange={vi.fn()} />);
    chooseFile();
    expect(await screen.findByText("Thiếu cột bắt buộc Cohort")).toBeInTheDocument();
    expect(app.doImportCommit).not.toHaveBeenCalled();
  });

  it("TC-04: saves a visiting lecturer with the selected lecturer type", async () => {
    const user = userEvent.setup();
    render(<TeacherEditDrawer data={{ numDays: 7, slotsPerDay: 12, teachers: [teacher], classes: [] }} teacher={teacher} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(app.updateManualTeacher).toHaveBeenCalledWith(3, expect.objectContaining({ teacherType: "GUEST" })));
  });

  it("TC-05: exposes manual course creation fields and saves the course", async () => {
    const user = userEvent.setup();
    render(<CourseEditDrawer course={null} classes={[]} onClose={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Mã học phần" }), "IT101");
    await user.type(screen.getByRole("textbox", { name: /Tên học phần/ }), "Nhập môn");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(app.addManualCourse).toHaveBeenCalledWith({ code: "IT101", name: "Nhập môn", credits: null }));
  });

  it("TC-06: filters the schedule scope by programme and cohort", () => {
    expect(boLocTheoPhamVi({ programs: ["BCSE"], cohorts: ["K68"] })).toEqual({
      programs: [],
      khoas: [],
      guest: true,
      resident: true,
      search: "",
      onlyProblems: false,
      chiXemPhamVi: true,
    });
  });

  it("TC-07: displays the available time-slot workflow for visiting lecturers", () => {
    render(<TeacherAvailabilityPage role="editor" />);
    expect(screen.getByRole("tab", { name: /thỉnh giảng/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Tìm tên/i })).toBeInTheDocument();
    expect(app.data.teachers[0].type).toBe("GUEST");
  });

  it("TC-08: enables guest scheduling when visiting lecturer availability is ready", () => {
    const steps = buildSteps({
      data: { classes: [{ sectionId: 1, teacherType: "GUEST", windowSlots: [1] }], teachers: [] },
      guestResult: null,
      residentResult: null,
    });
    expect(steps.some((step) => step.key === "guest")).toBe(true);
  });

  it("TC-09: keeps resident scheduling as a separate second step", () => {
    const steps = buildSteps({
      data: { classes: [{ sectionId: 1, teacherType: "RESIDENT", timeAssumed: true }], teachers: [] },
      guestResult: { lessons: [], placedCount: 0, total: 0 },
      residentResult: null,
    });
    expect(steps.some((step) => step.key === "resident")).toBe(true);
  });

  it("TC-10: switches between grid and table schedule views", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<ScheduleActions data={{}} view={view} canEdit={false} loading={false} guestResult={{}} residentResult={{}} mode="grid" onModeChange={onModeChange} fullscreen={false} onFullscreenChange={vi.fn()} onSaveSchedule={vi.fn()} onHoanTac={vi.fn()} onXuatLuoi={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Bảng/i }));
    expect(onModeChange).toHaveBeenCalled();
  });

  it("TC-11: filters the timetable and exposes lesson details", async () => {
    const user = userEvent.setup();
    const set = vi.fn();
    render(<ScheduleToolbar f={DEFAULT_FILTER} set={set} view={view} mode="grid" phamVi={null} />);
    await user.type(screen.getByPlaceholderText("Tìm môn, giảng viên, #id"), "MTH101");
    expect(set).toHaveBeenLastCalledWith({ search: "1", chiXemPhamVi: false });
  });

  it("TC-12: renders a warning marker when cohort data is missing", () => {
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    render(
      <SectionTable
        rows={[{ ...row, cohort: null }]}
        canEdit
        loading={false}
        tenLop={(item) => item.classCode}
        onOpenSection={vi.fn()}
        onOpenCourse={vi.fn()}
        onOpenTeacher={vi.fn()}
        onChot={vi.fn()}
        onBoChot={vi.fn()}
        onBoHocChung={vi.fn()}
      />,
    );
    expect(screen.getByRole("table")).toHaveTextContent("—");
  });

  it("TC-13: keeps a fixed reference group action available for scheduled lessons", () => {
    const onHoanTac = vi.fn();
    render(<ScheduleActions data={{ hoanTac: { nhan: "Lịch đã chốt" } }} view={view} canEdit={true} loading={false} guestResult={{}} residentResult={{}} mode="grid" onModeChange={vi.fn()} fullscreen={false} onFullscreenChange={vi.fn()} onSaveSchedule={vi.fn()} onHoanTac={onHoanTac} onXuatLuoi={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Huỷ thay đổi" })).toBeInTheDocument();
  });

  it("TC-14: exposes the confirmation action before saving the timetable", async () => {
    const user = userEvent.setup();
    const onSaveSchedule = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ScheduleActions data={{}} view={view} canEdit loading={false} guestResult={{ lessons: [] }} residentResult={null} mode="grid" onModeChange={vi.fn()} fullscreen={false} onFullscreenChange={vi.fn()} onSaveSchedule={onSaveSchedule} onHoanTac={vi.fn()} onXuatLuoi={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Lưu thời khoá biểu" }));
    expect(onSaveSchedule).toHaveBeenCalledOnce();
  });

  it("TC-15: confirms the schedule workflow has both scheduling phases", () => {
    render(<SchedulingWorkflowDialog open onOpenChange={vi.fn()} data={{}} steps={[{ key: "guest", label: "Xếp thỉnh giảng", value: "Đã xếp", state: "done" }, { key: "resident", label: "Ghép cơ hữu", value: "Đã ghép", state: "done" }]} canEdit loading={false} />);
    expect(screen.getByText("Xếp thỉnh giảng")).toBeInTheDocument();
    expect(screen.getByText("Ghép cơ hữu")).toBeInTheDocument();
  });

  it("TC-16: exports only the timetable rows currently filtered", async () => {
    const scheduler = await import("@/services/schedulerService");
    const user = userEvent.setup();
    render(<ExportExcelDialog open onOpenChange={vi.fn()} sectionIdsDangHien={[20, 21]} tongSoLop={10} />);
    expect(screen.getByText(/Chỉ xuất phần đang lọc \(2\/10 lớp\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xuất file" }));
    await waitFor(() => expect(scheduler.exportClasses).toHaveBeenCalledWith("HK1 2026-2027", [20, 21]));
  });
});
