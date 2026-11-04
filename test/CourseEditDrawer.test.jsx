import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CourseEditDrawer from "@/presentation/manual/CourseEditDrawer";

const app = vi.hoisted(() => ({
  addManualCourse: vi.fn(),
  updateManualCourse: vi.fn(),
}));

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({ loading: false, ...app }),
}));

describe("CourseEditDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dung cung kich thuoc popup giang vien va bo cac dong mo ta thua", () => {
    render(
      <CourseEditDrawer
        course={{ id: 10, code: "MTH101", name: "Giải tích", credits: 3 }}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Sửa học phần #10" });
    expect(dialog).toHaveClass(
      "teacher-edit-dialog",
      "manual-edit-glass",
      "w-[min(1000px,calc(100vw-2rem))]",
      "h-[min(600px,calc(100dvh-2rem))]",
    );
    expect(screen.queryByText("Chuẩn bị dữ liệu / Học phần")).not.toBeInTheDocument();
    expect(screen.queryByText("Sửa ở đây áp dụng cho tất cả lớp thuộc học phần này.")).not.toBeInTheDocument();
  });

  it("sua duoc Ma/Ten khi khong co lop da chot va khong gui tin chi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    app.updateManualCourse.mockResolvedValue({});
    render(
      <CourseEditDrawer
        course={{ id: 10, code: "MTH101", name: "Giải tích", credits: 3 }}
        classes={[{ sectionId: 1, courseId: 10, classCode: "MTH101-1", sectionChot: null }]}
        onClose={onClose}
      />,
    );

    const name = screen.getByRole("textbox", { name: /Tên học phần/ });
    const code = screen.getByRole("textbox", { name: "Mã học phần" });
    expect(name).not.toHaveAttribute("readonly");
    expect(code).not.toHaveAttribute("readonly");
    await user.type(name, " nâng cao");
    await user.clear(code);
    await user.type(code, "MTH102");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(app.updateManualCourse).toHaveBeenCalledWith(10, {
      code: "MTH102",
      name: "Giải tích nâng cao",
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it("khoa sua Ma/Ten khi co it nhat 1 lop da chot", async () => {
    const user = userEvent.setup();
    render(
      <CourseEditDrawer
        course={{ id: 10, code: "MTH101", name: "Giải tích", credits: 3 }}
        classes={[
          { sectionId: 1, courseId: 10, classCode: "MTH101-1", sectionChot: { by: "gv" } },
          { sectionId: 2, courseId: 10, classCode: "MTH101-2", sectionChot: null },
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: /Tên học phần/ })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Mã học phần" })).toHaveAttribute("readonly");
    expect(screen.getByText(/đã có 1 lớp đã chốt/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(app.updateManualCourse).not.toHaveBeenCalled();
  });
  it("them hoc phan moi van nhap duoc ma va ten", async () => {
    const user = userEvent.setup();
    app.addManualCourse.mockResolvedValue({});
    render(<CourseEditDrawer course={null} classes={[]} onClose={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Mã học phần" })).not.toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Tổng số lớp học phần" })).toHaveValue("0");
    await user.type(screen.getByRole("textbox", { name: "Mã học phần" }), "IT101");
    await user.type(screen.getByRole("textbox", { name: /Tên học phần/ }), "Nhập môn");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(app.addManualCourse).toHaveBeenCalledWith({
      code: "IT101", name: "Nhập môn", credits: null,
    }));
  });

  it("dem tong so lop theo ma lop khac nhau tren toan bo du lieu cua hoc phan", () => {
    const course = { id: 10, code: "VJU2002", name: "Môn", credits: 3 };
    const classes = [
      { sectionId: 1, courseId: 10, classCode: "VJU2002-1" },
      { sectionId: 2, courseId: 10, classCode: " VJU2002-1 " },
      { sectionId: 3, courseId: 10, classCode: "VJU2002-2", boQua: true },
      { sectionId: 4, courseId: 10, classCode: "" },
      { sectionId: 5, courseId: 10, classCode: null },
      { sectionId: 6, courseId: 11, classCode: "OTHER-1" },
    ];
    const { unmount } = render(<CourseEditDrawer course={course} classes={classes} onClose={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Tổng số lớp học phần" })).toHaveValue("4");
    unmount();

    render(<CourseEditDrawer course={{ ...course, id: 99 }} classes={classes} onClose={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Tổng số lớp học phần" })).toHaveValue("0");
  });

  it("so tin chi chi xem trong form sua, giu muc cu ngoai danh sach", () => {
    render(
      <CourseEditDrawer
        course={{ id: 10, code: "MTH101", name: "Giải tích", credits: 7 }}
        onClose={vi.fn()}
      />,
    );
    const credits = screen.getByRole("combobox", { name: "Số tín chỉ" });
    expect(credits).toHaveValue("7");
    expect(credits).toBeDisabled();
  });

  it("form them hoc phan van chon duoc so tin chi tu danh sach co dinh", async () => {
    const user = userEvent.setup();
    app.addManualCourse.mockResolvedValue({});
    render(<CourseEditDrawer course={null} classes={[]} onClose={vi.fn()} />);

    const credits = screen.getByRole("combobox", { name: "Số tín chỉ" });
    expect(credits).not.toBeDisabled();
    expect(credits.parentElement).toHaveClass("w-full");
    expect(within(credits).getAllByRole("option").map((o) => o.value)).toEqual(
      ["", "1", "2", "3", "4", "5", "10", "12"],
    );
    await user.selectOptions(credits, "10");
    await user.type(screen.getByRole("textbox", { name: /Tên học phần/ }), "X");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(app.addManualCourse).toHaveBeenCalledWith({ code: "", name: "X", credits: 10 }));
  });
});