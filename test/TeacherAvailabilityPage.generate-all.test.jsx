import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeacherAvailabilityPage from "@/presentation/pages/TeacherAvailabilityPage";

let appData;

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => appData,
}));

const teachers = [
  { id: 1, name: "GV thỉnh giảng", nameRaw: "GV thỉnh giảng", title: "Chuyên gia", type: "GUEST", org: "Ngoài trường", availabilitySlots: [1] },
  { id: 2, name: "GV cơ hữu", nameRaw: "GV cơ hữu", title: "TS.", type: "RESIDENT", org: "VJU", availabilitySlots: [] },
  { id: 3, name: "GV không có lớp", type: "RESIDENT", org: "VJU", availabilitySlots: [2] },
  { id: 4, name: "Phòng Đào tạo điều phối", type: "GUEST", isPlaceholder: true, availabilitySlots: [] },
];

beforeEach(() => {
  appData = {
    data: { teachers, classes: [] },
    loading: false,
    generateAllTeacherAvailability: vi.fn().mockResolvedValue({ generatedTeacherCount: 3 }),
    updateManualTeacher: vi.fn().mockResolvedValue({}),
    addManualTeacher: vi.fn(),
    generateTeacherAvailability: vi.fn(),
  };
});

describe("TeacherAvailabilityPage - Khai toàn bộ giờ rảnh", () => {
  it("chuyển hiệu ứng kính đỏ theo đúng tab đang chọn", async () => {
    const user = userEvent.setup();
    render(<TeacherAvailabilityPage role="editor" />);
    const guest = screen.getByRole("tab", { name: /thỉnh giảng/ });
    const resident = screen.getByRole("tab", { name: /cơ hữu/ });

    expect(guest).toHaveClass("teacher-type-tab-active");
    expect(resident).not.toHaveClass("teacher-type-tab-active");
    await user.click(resident);
    expect(resident).toHaveClass("teacher-type-tab-active");
    expect(guest).not.toHaveClass("teacher-type-tab-active");
  });

  it("đặt nút ngay cạnh ô tìm kiếm và chỉ hiện cho người được sửa", () => {
    const { rerender } = render(<TeacherAvailabilityPage role="editor" />);
    const search = screen.getByRole("textbox", { name: /Tìm tên, email, đơn vị/i });
    const button = screen.getByRole("button", { name: /Khai toàn bộ giờ rảnh/i });
    expect(search.parentElement.parentElement.nextElementSibling).toBe(button);

    rerender(<TeacherAvailabilityPage role="viewer" />);
    expect(screen.queryByRole("button", { name: /Khai toàn bộ giờ rảnh/i })).not.toBeInTheDocument();
  });

  it("đếm toàn bộ giảng viên thật thuộc cả hai loại, không phụ thuộc tab hoặc tìm kiếm", async () => {
    const user = userEvent.setup();
    render(<TeacherAvailabilityPage role="editor" />);

    await user.type(screen.getByRole("textbox", { name: /Tìm tên, email, đơn vị/i }), "không khớp");
    await user.click(screen.getByRole("button", { name: /Khai toàn bộ giờ rảnh/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/3 giảng viên/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/cả hai loại/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/không phụ thuộc tab/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/lịch đã chốt/i)).toBeInTheDocument();
  });

  it("Hủy không gọi API", async () => {
    const user = userEvent.setup();
    render(<TeacherAvailabilityPage role="editor" />);

    await user.click(screen.getByRole("button", { name: /Khai toàn bộ giờ rảnh/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));

    expect(appData.generateAllTeacherAvailability).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("chỉ gọi một API sau xác nhận, khóa thao tác khi đang chạy và đóng khi thành công", async () => {
    const user = userEvent.setup();
    let resolveRequest;
    appData.generateAllTeacherAvailability = vi.fn(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<TeacherAvailabilityPage role="editor" />);

    await user.click(screen.getByRole("button", { name: /Khai toàn bộ giờ rảnh/i }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận" });
    await user.click(confirm);

    expect(appData.generateAllTeacherAvailability).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /Đang xử lý/i })).toBeDisabled();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" })).toBeDisabled();

    resolveRequest({ generatedTeacherCount: 3 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(appData.generateAllTeacherAvailability).toHaveBeenCalledTimes(1);
  });

  it("giữ hộp thoại mở khi API lỗi và vô hiệu nút khi không có giảng viên thật", async () => {
    const user = userEvent.setup();
    appData.generateAllTeacherAvailability = vi.fn().mockRejectedValue(new Error("Lỗi mạng"));
    const { rerender } = render(<TeacherAvailabilityPage role="editor" />);

    await user.click(screen.getByRole("button", { name: /Khai toàn bộ giờ rảnh/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    appData = { ...appData, data: { teachers: [teachers[3]], classes: [] } };
    rerender(<TeacherAvailabilityPage role="editor" />);
    expect(screen.getByRole("button", { name: /Khai toàn bộ giờ rảnh/i })).toBeDisabled();
  });

  it("chỉ chọn học hàm/học vị trong bốn lựa chọn cố định rồi lưu đúng title", async () => {
    const user = userEvent.setup();
    render(<TeacherAvailabilityPage role="editor" />);

    await user.click(screen.getByRole("cell", { name: /GV thỉnh giảng/ }));
    const dialog = screen.getByRole("dialog", { name: "Sửa giảng viên #1" });
    const title = within(dialog).getByRole("button", { name: "Học hàm/học vị" });
    await user.click(title);
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "— Chưa có —",
      "ThS.",
      "TS.",
      "PGS.TS.",
      "GS.TS",
    ]);
    await user.click(within(menu).getByText("TS."));
    await user.click(within(dialog).getByRole("button", { name: "Lưu thông tin" }));

    await waitFor(() => expect(appData.updateManualTeacher).toHaveBeenCalledWith(1, expect.objectContaining({ title: "TS." })));
  });

  it("mở popup sửa giảng viên ở giữa màn hình và cho phép mở rộng, thu nhỏ", async () => {
    const user = userEvent.setup();
    appData.data = {
      ...appData.data,
      teachers: teachers.map((t) => t.id === 1 ? { ...t, teachingSlots: [1, 2, 3, 4, 5, 6, 7] } : t),
      classes: [
        { sectionId: 10, classCode: "TEST101", courseName: "Lớp thử", teacherIds: [1], periodStart: 1, periodEnd: 3 },
        { sectionId: 11, teacherIds: [1, 2], periodStart: 5, periodEnd: 6 },
        { sectionId: 12, teacherIds: [1], periodStart: null, periodEnd: null },
        { sectionId: 13, teacherIds: [2], periodStart: 1, periodEnd: 4 },
      ],
    };
    render(<TeacherAvailabilityPage role="editor" />);

    await user.click(screen.getByRole("cell", { name: /GV thỉnh giảng/ }));
    const dialog = screen.getByRole("dialog", { name: "Sửa giảng viên #1" });
    expect(dialog).toHaveClass("teacher-edit-dialog", "manual-edit-glass", "w-[min(1000px,calc(100vw-2rem))]", "h-[min(600px,calc(100dvh-2rem))]");
    const body = dialog.querySelector(".grid-cols-1");
    expect(body).toHaveClass("min-[900px]:grid-cols-2");
    expect(within(body.children[0]).getByText("Thông tin giảng viên")).toBeInTheDocument();
    const classCount = within(body.children[0]).getByRole("textbox", { name: "Lớp kỳ này" });
    const weeklyPeriods = within(body.children[0]).getByRole("textbox", { name: "Số Tiết trong tuần" });
    expect(classCount).toHaveValue("3");
    expect(weeklyPeriods).toHaveValue("5");
    expect(classCount).toHaveAttribute("readonly");
    expect(weeklyPeriods).toHaveAttribute("readonly");
    expect(within(dialog).queryByText("TEST101")).not.toBeInTheDocument();
    expect(within(body.children[1]).getByText("Giờ có thể dạy")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Đang dạy 7 tiết theo các lớp/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Lấy các giờ đang dạy làm khung đã khai" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Tick MỌI tiết giảng viên rảnh/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Kéo để quét cả vùng/)).not.toBeInTheDocument();

    expect(within(dialog).queryByRole("button", { name: /Mở rộng popup|Thu nhỏ popup/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toBeInTheDocument();
  });
});
