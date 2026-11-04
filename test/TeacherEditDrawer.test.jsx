import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeacherEditDrawer from "@/presentation/manual/TeacherEditDrawer";

const app = vi.hoisted(() => ({
  addManualTeacher: vi.fn(),
  updateManualTeacher: vi.fn(),
  generateTeacherAvailability: vi.fn(),
}));

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({ loading: false, ...app }),
}));

const teacher = { id: 3, nameRaw: "GV A", name: "GV A", type: "GUEST", org: "", title: "", email: "", phone: "0123456789" };
const data = { numDays: 7, slotsPerDay: 12, teachers: [teacher], classes: [] };

describe("TeacherEditDrawer", () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  beforeEach(() => vi.clearAllMocks());

  it("khong con nut mo rong popup va giu kich thuoc mac dinh", () => {
    render(<TeacherEditDrawer data={data} teacher={teacher} onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Mở rộng popup|Thu nhỏ popup/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("w-[min(1000px,calc(100vw-2rem))]", "h-[min(600px,calc(100dvh-2rem))]");
  });

  it("luu duoc so dien thoai 10 chu so giu so 0 dau", async () => {
    const user = userEvent.setup();
    app.updateManualTeacher.mockResolvedValue({});
    render(<TeacherEditDrawer data={data} teacher={teacher} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(app.updateManualTeacher).toHaveBeenCalledWith(3, expect.objectContaining({ phone: "0123456789" })));
  });

  it.each(["01234567890", "012 345", "+8412345", "09ab"])("chan so dien thoai %s", async (phone) => {
    const user = userEvent.setup();
    render(<TeacherEditDrawer data={data} teacher={{ ...teacher, phone: "" }} onClose={vi.fn()} />);

    await user.type(screen.getByRole("textbox", { name: "Số điện thoại" }), phone);
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(screen.getByText("Số điện thoại chỉ gồm chữ số 0-9, tối đa 10 chữ số.")).toBeInTheDocument();
    expect(app.updateManualTeacher).not.toHaveBeenCalled();
  });

  it("so cu khong hop le van hien nguyen goc nhung khong luu duoc cho den khi sua", async () => {
    const user = userEvent.setup();
    app.updateManualTeacher.mockResolvedValue({});
    render(<TeacherEditDrawer data={data} teacher={{ ...teacher, phone: "09123456789012" }} onClose={vi.fn()} />);

    const phone = screen.getByRole("textbox", { name: "Số điện thoại" });
    expect(phone).toHaveValue("09123456789012");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(app.updateManualTeacher).not.toHaveBeenCalled();

    await user.clear(phone);
    await user.type(phone, "0912345678");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(app.updateManualTeacher).toHaveBeenCalledWith(3, expect.objectContaining({ phone: "0912345678" })));
  });

  it("so dien thoai de trong van hop le", async () => {
    const user = userEvent.setup();
    app.updateManualTeacher.mockResolvedValue({});
    render(<TeacherEditDrawer data={data} teacher={{ ...teacher, phone: "" }} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(app.updateManualTeacher).toHaveBeenCalledWith(3, expect.objectContaining({ phone: "" })));
  });
});
