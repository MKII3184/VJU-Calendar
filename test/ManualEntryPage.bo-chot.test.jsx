import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualEntryPage from "@/presentation/pages/ManualEntryPage";

const app = vi.hoisted(() => ({
  doBoChotSection: vi.fn(),
}));

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({
    data: {
      sourceLabel: "Nhập liệu thủ công",
      numSections: 1,
      numTeachers: 1,
      teachers: [{ id: 3, name: "GV A" }],
      courses: [],
      classes: [{
        sectionId: 7,
        teacherIds: [3],
        classCode: "MTH101-1",
        courseName: "Giải tích",
        programParts: ["BCSE"],
        cohortParts: ["K68"],
        sectionChot: { by: "Giáo vụ" },
      }],
    },
    loading: false,
    initManual: vi.fn(),
    doClearManualTimes: vi.fn(),
    doBoChotSection: app.doBoChotSection,
    doBoHocChung: vi.fn(),
    doBoQua: vi.fn(),
  }),
}));

vi.mock("@/presentation/manual/SectionTable", () => ({
  STATUS_META: {},
  default: ({ rows, onBoChot, onOpenSection }) => (
    <>
      <button type="button" onClick={(event) => onBoChot(rows[0])(event)}>Mở bỏ chốt</button>
      <button type="button" onClick={onOpenSection(rows[0].sectionId)}>Mở lớp</button>
    </>
  ),
}));
vi.mock("@/presentation/manual/SectionEditDrawer", () => ({
  default: ({ onOpenTeacher }) => (
    <div data-testid="section-popup"><button type="button" onClick={() => onOpenTeacher(3)}>Giờ dạy</button></div>
  ),
}));
vi.mock("@/presentation/manual/TeacherEditDrawer", () => ({
  default: ({ teacher, onClose }) => (
    <div data-testid="teacher-popup">Giảng viên #{teacher?.id}<button type="button" onClick={onClose}>Đóng giảng viên</button></div>
  ),
}));
vi.mock("@/presentation/manual/CourseEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ImportExcelDialog", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ExportExcelDialog", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ChotCourseDialog", () => ({ default: () => null }));

describe("ManualEntryPage - dialog bỏ chốt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("giữ popup Sửa lớp khi mở và đóng Giờ dạy giảng viên", async () => {
    const user = userEvent.setup();
    render(<ManualEntryPage role="editor" />);
    await user.click(screen.getByRole("button", { name: "Mở lớp" }));
    await user.click(screen.getByRole("button", { name: "Giờ dạy" }));
    expect(screen.getByTestId("section-popup")).toBeInTheDocument();
    expect(screen.getByTestId("teacher-popup")).toHaveTextContent("Giảng viên #3");
    await user.click(screen.getByRole("button", { name: "Đóng giảng viên" }));
    expect(screen.queryByTestId("teacher-popup")).not.toBeInTheDocument();
    expect(screen.getByTestId("section-popup")).toBeInTheDocument();
  });

  it("huy khong goi API, xac nhan moi bo chot dung lop", async () => {
    const user = userEvent.setup();
    app.doBoChotSection.mockResolvedValue({});
    render(<ManualEntryPage role="editor" />);

    await user.click(screen.getByRole("button", { name: "Mở bỏ chốt" }));
    let dialog = screen.getByRole("dialog", { name: "Bỏ chốt lớp MTH101-1?" });
    expect(dialog).toHaveTextContent(/trả giờ về trạng thái trước khi chốt/);
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Bỏ chốt lớp MTH101-1?" })).not.toBeInTheDocument());
    expect(app.doBoChotSection).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Mở bỏ chốt" }));
    dialog = screen.getByRole("dialog", { name: "Bỏ chốt lớp MTH101-1?" });
    await user.click(screen.getByRole("button", { name: "Xác nhận bỏ chốt" }));

    expect(app.doBoChotSection).toHaveBeenCalledWith(7);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
