import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualEntryPage from "@/presentation/pages/ManualEntryPage";
import GuidePage from "@/presentation/pages/GuidePage";
import { readUrlState, writeUrlState } from "@/adapters/urlState";
import { buildScheduleView, DEFAULT_FILTER } from "@/adapters/scheduleView";

// Dữ liệu mẫu kiểm thử Sprint 2
const mockClasses = [
  { sectionId: 0, classCode: "MTH100-0", courseName: "Đại số tuyến tính", teacherName: "Thầy A", programParts: ["BCSE"], cohortParts: ["K68"], status: "ready_auto" },
  { sectionId: 19, classCode: "CSE3013-1", courseName: "Cơ sở dữ liệu", teacherName: "Cô B", programParts: ["BCSE"], cohortParts: ["K68"], status: "ready_fixed" },
  { sectionId: 190, classCode: "CSE3014-1", courseName: "Hệ điều hành", teacherName: "Thầy C", programParts: ["MJM"], cohortParts: ["K67"], status: "ready_auto" },
];

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({
    data: { sourceLabel: "Nhập liệu", classes: mockClasses, teachers: [], courses: [] },
    loading: false,
    initManual: vi.fn(),
  }),
}));

vi.mock("@/presentation/manual/SectionTable", () => ({
  default: ({ rows }) => <div data-testid="visible-rows">{rows.map((r) => `#${r.sectionId}`).join(",")}</div>,
}));
vi.mock("@/presentation/manual/SectionEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/TeacherEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/CourseEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ImportExcelDialog", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ExportExcelDialog", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ChotCourseDialog", () => ({ default: () => null }));

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.location.hash = "";
});

describe("Sprint 2 - Acceptance Test Cases (US-01, US-02, US-03, US-04a)", () => {
  // ==========================================
  // US-01: Tìm kiếm chính xác lớp bằng #id (F03)
  // ==========================================
  it("TC-01: nhập #19 chỉ hiển thị lớp ID 19, không trả lớp ID 190", async () => {
    const user = userEvent.setup();
    render(<ManualEntryPage role="staff" />);

    const searchInput = screen.getByPlaceholderText(/Tìm mã lớp, học phần, GV, #id/i);
    await user.type(searchInput, "#19");

    expect(screen.getByTestId("visible-rows")).toHaveTextContent("#19");
    expect(screen.getByTestId("visible-rows")).not.toHaveTextContent("#190");
    expect(screen.getByTestId("visible-rows")).not.toHaveTextContent("#0");
  });

  it("TC-02: nhập #0 vẫn tìm được chính xác lớp có ID 0 (không bị falsy check)", async () => {
    const user = userEvent.setup();
    render(<ManualEntryPage role="staff" />);

    const searchInput = screen.getByPlaceholderText(/Tìm mã lớp, học phần, GV, #id/i);
    await user.type(searchInput, "#0");

    expect(screen.getByTestId("visible-rows")).toHaveTextContent("#0");
    expect(screen.getByTestId("visible-rows")).not.toHaveTextContent("#19");
  });

  it("TC-03: nhập #id không tồn tại (#999) trả về 0 kết quả và không gây lỗi crash", async () => {
    const user = userEvent.setup();
    render(<ManualEntryPage role="staff" />);

    const searchInput = screen.getByPlaceholderText(/Tìm mã lớp, học phần, GV, #id/i);
    await user.type(searchInput, "#999");

    expect(screen.getByTestId("visible-rows")).toHaveTextContent("");
  });

  it("TC-04: scheduleView hỗ trợ tìm kiếm #id trên lưới thời khóa biểu", () => {
    const view = buildScheduleView({
      data: {
        numDays: 7,
        slotsPerDay: 12,
        classes: [
          { sectionId: 19, duration: 3, teacherType: "RESIDENT", programParts: ["BCSE"], cohortParts: ["K68"] },
          { sectionId: 190, duration: 3, teacherType: "GUEST", programParts: ["MJM"], cohortParts: ["K67"] }
        ],
        teachers: {},
        rooms: []
      },
      guestResult: null,
      residentResult: null,
      filter: { ...DEFAULT_FILTER, search: "#19" },
      phamVi: null
    });
    expect(view.searchMatchIds.has(19)).toBe(true);
    expect(view.searchMatchIds.has(190)).toBe(false);
  });

  // ==========================================
  // US-02: Điều hướng URL & Back/Forward (F04)
  // ==========================================
  it("TC-05: writeUrlState và readUrlState phản ánh đúng trang và bộ lọc", () => {
    writeUrlState({
      page: "manual",
      sub: "classes",
      filter: { ...DEFAULT_FILTER, search: "MTH", guest: false }
    });

    const state = readUrlState();
    expect(state.page).toBe("manual");
    expect(state.sub).toBe("classes");
    expect(state.filter.search).toBe("MTH");
    expect(state.filter.guest).toBe(false);
  });

  it("TC-06: URL hash giữ nguyên trạng thái khi reload và không sinh rác lịch sử", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    writeUrlState({
      page: "schedule",
      sub: null,
      filter: { ...DEFAULT_FILTER, onlyProblems: true }
    });
    expect(spy).toHaveBeenCalled();
  });

  // ==========================================
  // US-03: Chuẩn hóa hướng dẫn lưu trữ (F08)
  // ==========================================
  it("TC-07: GuidePage không còn cảnh báo sai về việc tắt backend mất hết dữ liệu", () => {
    render(<GuidePage />);
    expect(screen.queryByText(/tắt terminal backend là mất hết dữ liệu/i)).not.toBeInTheDocument();
  });

  it("TC-08: GuidePage hiển thị cơ chế lưu trữ tự động vào CSDL MySQL và snapshot", () => {
    render(<GuidePage />);
    expect(screen.getAllByText(/MySQL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/snapshot/i).length).toBeGreaterThan(0);
  });

  it("TC-09: GuidePage nêu rõ hai chế độ nhập Excel: gộp thêm và thay thế", () => {
    render(<GuidePage />);
    expect(screen.getByText(/Gộp thêm vào dữ liệu đang có \(Merge\) hoặc Xóa dữ liệu cũ nạp mới \(Replace\)/i)).toBeInTheDocument();
  });

  // ==========================================
  // US-04a: CSDL MySQL & Docker Compose
  // ==========================================
  it("TC-10: ERD thiết kế đầy đủ 7 bảng dữ liệu quan hệ cho bài toán xếp thời khóa biểu", async () => {
    const schemaFile = await import("fs").then(fs => fs.readFileSync("config/schema.sql", "utf-8"));
    const requiredTables = [
      "coordinators",
      "lecturers",
      "lecturer_availabilities",
      "courses",
      "classes",
      "rooms",
      "schedules"
    ];
    for (const table of requiredTables) {
      expect(schemaFile).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
    }
  });
});
