import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SectionEditDrawer from "@/presentation/manual/SectionEditDrawer";

const app = vi.hoisted(() => ({
  updateManualSection: vi.fn(),
  addManualSection: vi.fn(),
  addManualTeacher: vi.fn(),
  deleteManualSection: vi.fn(),
  doBoQua: vi.fn(),
}));

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({ loading: false, ...app }),
}));

const data = {
  numDays: 7,
  slotsPerDay: 12,
  teachers: [
    { id: 1, name: "GV cơ hữu", type: "RESIDENT" },
    { id: 2, name: "GV thỉnh giảng", type: "GUEST" },
  ],
  courses: [
    { id: 10, code: "MTH101", name: "Giải tích" },
    { id: 11, code: "MTH102", name: "Đại số tuyến tính" },
    { id: 12, code: "PHY101", name: "Vật lý đại cương" },
  ],
};

function makeSection(overrides = {}) {
  return {
    sectionId: 20,
    teacherIds: [1],
    courseId: 10,
    classCode: "MTH101-1",
    programName: "BCSE",
    ltCredits: 3,
    thCredits: 0,
    cohort: "K68",
    expectedStudents: 30,
    duration: 3,
    timeAssumed: false,
    day: 0,
    periodStart: 1,
    periodEnd: 3,
    location: "Hòa Lạc",
    teachingMode: "Trực tiếp",
    ...overrides,
  };
}

describe("SectionEditDrawer", () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  beforeEach(() => vi.clearAllMocks());

  it("dung popup 1500x750 ba cot, dat Thoi gian o cot cuoi va khong them nhanh hoc phan", () => {
    render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Sửa lớp MTH101-1" });
    expect(dialog).toHaveClass("w-[min(1500px,calc(100vw-2rem))]", "h-[min(750px,calc(100dvh-2rem))]");
    const body = dialog.querySelector(".grid-cols-1");
    expect(body).toHaveClass("min-[1100px]:grid-cols-3");
    expect(body.children).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Thời gian" }).closest("section").parentElement).toBe(body.children[2]);
    expect(screen.queryByRole("button", { name: "Học phần mới" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Hệ thống tạm suy ra vì file không ghi giờ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chuẩn bị dữ liệu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MỌI NGƯỜI VAI TRÒ NGANG NHAU/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chỉ để đối chiếu/)).not.toBeInTheDocument();
  });

  it("loc danh sach hoc phan theo ma hoac ten khi nguoi dung nhap", async () => {
    const user = userEvent.setup();
    render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Học phần/ }));
    const search = screen.getByPlaceholderText("Tìm mã hoặc tên học phần…");
    await user.type(search, "đại số");

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("MTH102 — Đại số tuyến tính")).toBeInTheDocument();
    expect(within(menu).queryByText("MTH101 — Giải tích")).not.toBeInTheDocument();
    expect(within(menu).queryByText("PHY101 — Vật lý đại cương")).not.toBeInTheDocument();

    await user.click(within(menu).getByText("MTH102 — Đại số tuyến tính"));
    expect(screen.getByRole("button", { name: /Học phần/ })).toHaveTextContent("MTH102 — Đại số tuyến tính");
  });

  it("cuộn danh sách học phần trong popup bằng con lăn chuột", async () => {
    const user = userEvent.setup();
    render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Học phần/ }));
    const menu = screen.getByRole("menu");
    fireEvent.wheel(menu, { deltaY: 120 });
    expect(menu.scrollTop).toBe(120);
  });

  it("tìm giảng viên theo tên trong từng ô chọn", async () => {
    const user = userEvent.setup();
    render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /GV cơ hữu/ }));
    const search = screen.getByPlaceholderText("Tìm tên giảng viên…");
    await user.type(search, "thỉnh giảng");
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText(/GV thỉnh giảng/)).toBeInTheDocument();
    expect(within(menu).queryByText(/GV cơ hữu/)).not.toBeInTheDocument();
    await user.click(within(menu).getByText(/GV thỉnh giảng/));
    expect(screen.getByRole("button", { name: /GV thỉnh giảng/ })).toBeInTheDocument();
  });

  it("xoa gio dang chon khi doi so tiet lam sai do dai", async () => {
    const user = userEvent.setup();
    render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);

    const duration = screen.getByRole("combobox", { name: /Số tiết \/ buổi/ });
    await user.selectOptions(duration, "2");

    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.getByText("Bấm một ô để chọn đủ 2 tiết liên tiếp trong cùng ngày.")).toBeInTheDocument();
  });

  it("xoa gio Thu 7 khi doi nhom tu thinh giang sang co huu", async () => {
    const user = userEvent.setup();
    render(
      <SectionEditDrawer
        data={data}
        section={makeSection({ teacherIds: [2], day: 5, periodStart: 1, periodEnd: 3 })}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /GV thỉnh giảng/ }));
    await user.click(within(screen.getByRole("menu")).getByText(/GV cơ hữu/));

    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.getByText("Bấm một ô để chọn đủ 3 tiết liên tiếp trong cùng ngày.")).toBeInTheDocument();
  });

  it("khoa bang gio lop da chot va luu nguyen dai gio", async () => {
    const user = userEvent.setup();
    app.updateManualSection.mockResolvedValue({});
    render(
      <SectionEditDrawer
        data={data}
        section={makeSection({ sectionChot: { by: "Giáo vụ", at: "2026-09-29T10:00:00" } })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Để hệ thống tự xếp giờ" })).toBeDisabled();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
    expect(app.updateManualSection.mock.calls[0][1]).toMatchObject({
      day: 0,
      periodStart: 1,
      periodEnd: 3,
    });
  });

  it("phan biet dang cho xep va gio du kien chua luu", () => {
    const { unmount } = render(
      <SectionEditDrawer
        data={data}
        section={makeSection({ timeAssumed: true, timeSource: "auto", day: null, periodStart: null, periodEnd: null })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Đang chờ xếp/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);

    unmount();
    render(
      <SectionEditDrawer
        data={data}
        section={makeSection({ timeAssumed: true, timeSource: "auto", timePreview: true })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Giờ dự kiến do hệ thống xếp — chưa lưu/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    expect(screen.getAllByRole("button", { pressed: true })[0]).toBeDisabled();
  });

  it("sua metadata lop da luu gio tu dong khong gui autoSchedule de xoa gio", async () => {
    const user = userEvent.setup();
    app.updateManualSection.mockResolvedValue({});
    render(
      <SectionEditDrawer
        data={data}
        section={makeSection({ timeSource: "auto", timeAssumed: false })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Giờ đã lưu, nguồn gốc/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
    expect(app.updateManualSection.mock.calls[0][1]).toMatchObject({
      day: 0,
      periodStart: 1,
      periodEnd: 3,
      timeSource: "auto",
    });
    expect(app.updateManualSection.mock.calls[0][1]).not.toHaveProperty("autoSchedule");
  });

  it("khoa gio hoc chung da chot nhung van cho luu metadata", async () => {
    const user = userEvent.setup();
    app.updateManualSection.mockResolvedValue({});
    render(
      <SectionEditDrawer
        data={data}
        section={makeSection({ timeSource: "auto", hocChungLockedBy: 99 })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Để hệ thống tự xếp giờ" })).toBeDisabled();
    expect(screen.getByText(/Giờ bị khóa vì lớp học chung đã chốt/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
  });

  describe("gioi han va o chon", () => {
    const withClasses = { ...data, classes: [
      { sectionId: 1, cohort: "VJU2024" }, { sectionId: 2, cohort: "VJU2025" }, { sectionId: 3, cohort: "" },
    ] };

    it("chi khoa Ma lop khi sua, them lop moi van nhap duoc", () => {
      const { unmount } = render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);
      expect(screen.getByRole("textbox", { name: "Mã lớp" })).toHaveAttribute("readonly");
      unmount();
      render(<SectionEditDrawer data={data} section={null} onClose={vi.fn()} />);
      expect(screen.getByRole("textbox", { name: "Mã lớp" })).not.toHaveAttribute("readonly");
    });

    it("tick nhiều chương trình trên một menu gọn và lưu với dấu cộng", async () => {
      const user = userEvent.setup();
      app.updateManualSection.mockResolvedValue({});
      render(<SectionEditDrawer data={data} section={makeSection({ programName: "BCSE" })} onClose={vi.fn()} />);

      const trigger = screen.getByRole("button", { name: "Chương trình (CTĐT)" });
      expect(trigger).toHaveTextContent("BCSE");
      await user.click(trigger);
      const menu = screen.getByRole("menu");
      expect(menu).toHaveClass("grid-cols-3");
      expect(within(menu).getByRole("menuitemcheckbox", { name: "BCSE" })).toHaveAttribute("aria-checked", "true");
      await user.click(within(menu).getByRole("menuitemcheckbox", { name: "MJM" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      await user.click(within(menu).getByRole("menuitemcheckbox", { name: "ECE" }));
      expect(trigger).toHaveTextContent("BCSE+MJM+ECE");
      await user.click(within(menu).getByRole("menuitemcheckbox", { name: "MJM" }));
      expect(trigger).toHaveTextContent("BCSE+ECE");
      await user.click(within(menu).getByRole("menuitemcheckbox", { name: "MJM" }));
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
      expect(app.updateManualSection.mock.calls[0][1]).toMatchObject({ program: "BCSE+ECE+MJM", classCode: "MTH101-1" });
    });

    it("tick nhiều khóa trong menu gọn, giữ khóa cũ và lưu với dấu cộng", async () => {
      const user = userEvent.setup();
      app.updateManualSection.mockResolvedValue({});
      render(<SectionEditDrawer data={withClasses} section={makeSection({ cohort: "K68+K69" })} onClose={vi.fn()} />);
      const trigger = screen.getByRole("button", { name: "Khóa" });
      expect(trigger).toHaveTextContent("K68+K69");
      await user.click(trigger);
      const menu = screen.getByRole("menu");
      expect(menu).toHaveClass("grid-cols-3");
      expect(within(menu).getAllByRole("menuitemcheckbox")).toHaveLength(4);
      expect(within(menu).getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(2);
      await user.click(within(menu).getByRole("menuitemcheckbox", { name: "VJU2025" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(trigger).toHaveTextContent("K68+K69+VJU2025");
      await user.click(within(menu).getByRole("menuitemcheckbox", { name: "K68" }));
      expect(trigger).toHaveTextContent("K69+VJU2025");
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
      expect(app.updateManualSection.mock.calls[0][1]).toMatchObject({ cohort: "K69+VJU2025" });
    });

    it("đọc dữ liệu ghép cũ, đổi dấu chấm sang dấu cộng và giữ được cả ba chương trình", async () => {
      const user = userEvent.setup();
      app.updateManualSection.mockResolvedValue({});
      render(<SectionEditDrawer data={data} section={makeSection({ programName: "FTH.ESAS+MJM" })} onClose={vi.fn()} />);
      const trigger = screen.getByRole("button", { name: "Chương trình (CTĐT)" });
      expect(trigger).toHaveTextContent("FTH+ESAS+MJM");
      await user.click(trigger);
      expect(within(screen.getByRole("menu")).getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(3);
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
      expect(app.updateManualSection.mock.calls[0][1].program).toBe("FTH+ESAS+MJM");
    });

    it("giữ nguyên chú thích CTĐT cũ khi lưu và cho tick thêm chương trình", async () => {
      const user = userEvent.setup();
      app.updateManualSection.mockResolvedValue({});
      render(<SectionEditDrawer data={data} section={makeSection({ programName: "BICA (+ESCT)" })} onClose={vi.fn()} />);
      const trigger = screen.getByRole("button", { name: "Chương trình (CTĐT)" });
      await user.click(trigger);
      expect(within(screen.getByRole("menu")).getByRole("menuitemcheckbox", { name: "BICA (+ESCT)" })).toHaveAttribute("aria-checked", "true");
      await user.click(within(screen.getByRole("menu")).getByRole("menuitemcheckbox", { name: "MJM" }));
      expect(trigger).toHaveTextContent("BICA (+ESCT)+MJM");
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
      expect(app.updateManualSection.mock.calls[0][1].program).toBe("BICA (+ESCT)+MJM");
    });

    it("tách dữ liệu Khóa cũ nhiều hơn hai mục, bỏ trùng và lưu thành dấu cộng", async () => {
      const user = userEvent.setup();
      app.updateManualSection.mockResolvedValue({});
      render(<SectionEditDrawer data={withClasses} section={makeSection({ cohort: "K68;K69/VJU2024;K68" })} onClose={vi.fn()} />);
      const trigger = screen.getByRole("button", { name: "Khóa" });
      expect(trigger).toHaveTextContent("K68+K69+VJU2024");
      await user.click(trigger);
      expect(within(screen.getByRole("menu")).getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(3);
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
      expect(app.updateManualSection.mock.calls[0][1].cohort).toBe("K68+K69+VJU2024");
    });

    it("menu Khóa dài cuộn bên trong mà không làm dài popup Sửa lớp", async () => {
      const user = userEvent.setup();
      const manyClasses = { ...data, classes: Array.from({ length: 24 }, (_, index) => ({ cohort: `VJU${2000 + index}` })) };
      render(<SectionEditDrawer data={manyClasses} section={makeSection()} onClose={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Khóa" }));
      const menu = screen.getByRole("menu");
      expect(menu).toHaveClass("overflow-y-auto", "grid-cols-3");
      expect(within(menu).getAllByRole("menuitemcheckbox")).toHaveLength(25);
      fireEvent.wheel(menu, { deltaY: 120 });
      expect(menu.scrollTop).toBe(120);
      expect(screen.getByRole("dialog", { name: "Sửa lớp MTH101-1" })).toHaveClass("h-[min(750px,calc(100dvh-2rem))]");
    });

    it("Khóa không có lựa chọn khi chưa có lớp nào", async () => {
      const user = userEvent.setup();
      render(<SectionEditDrawer data={data} section={null} onClose={vi.fn()} />);
      const trigger = screen.getByRole("button", { name: "Khóa" });
      expect(trigger).toHaveTextContent("— Không —");
      await user.click(trigger);
      expect(within(screen.getByRole("menu")).queryAllByRole("menuitemcheckbox")).toHaveLength(0);
      expect(within(screen.getByRole("menu")).getByText("Chưa có lựa chọn")).toBeInTheDocument();
    });

    it("So tiet chi cho chon 1-4", () => {
      render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);
      const duration = screen.getByRole("combobox", { name: /Số tiết \/ buổi/ });
      expect(within(duration).getAllByRole("option").map((o) => o.value)).toEqual(["1", "2", "3", "4"]);
    });

    it("so tiet cu > 4 hien ro, buoc chon lai va chan ca Luu lan Them buoi khac", async () => {
      const user = userEvent.setup();
      render(<SectionEditDrawer data={data} section={makeSection({ duration: 5, periodEnd: 5 })} onClose={vi.fn()} />);

      const duration = screen.getByRole("combobox", { name: /Số tiết \/ buổi/ });
      expect(duration).toHaveValue("5");
      expect(within(duration).getByRole("option", { name: /5 — vượt giới hạn/ })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Lưu" }));
      expect(screen.getByText(/Số tiết \/ buổi phải là 1, 2, 3 hoặc 4/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Thêm buổi khác/ }));
      expect(app.updateManualSection).not.toHaveBeenCalled();
      expect(app.addManualSection).not.toHaveBeenCalled();

      await user.selectOptions(duration, "3");
      expect(screen.queryByText(/Số tiết \/ buổi phải là 1, 2, 3 hoặc 4/)).not.toBeInTheDocument();
    });

    it("lop da chot co so tiet cu > 4 bao can bo chot truoc", async () => {
      const user = userEvent.setup();
      render(
        <SectionEditDrawer
          data={data}
          section={makeSection({ duration: 5, periodEnd: 5, sectionChot: { by: "Giáo vụ" } })}
          onClose={vi.fn()}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      expect(screen.getByText(/cần bỏ chốt lớp trước khi sửa và lưu/)).toBeInTheDocument();
      expect(app.updateManualSection).not.toHaveBeenCalled();
    });

    it.each([["200", true], ["150", true], ["0", true], ["", true], ["201", false], ["-1", false], ["1.5", false]])(
      "So SV du kien %s -> hop le: %s", async (value, ok) => {
        const user = userEvent.setup();
        app.updateManualSection.mockResolvedValue({});
        render(<SectionEditDrawer data={data} section={makeSection({ expectedStudents: "" })} onClose={vi.fn()} />);
        const field = screen.getByRole("spinbutton", { name: "Số SV dự kiến" });
        if (value) await user.type(field, value);
        await user.click(screen.getByRole("button", { name: "Lưu" }));
        if (ok) await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
        else {
          expect(screen.getByText(/Số SV dự kiến phải là số nguyên từ 0 đến 200/)).toBeInTheDocument();
          expect(app.updateManualSection).not.toHaveBeenCalled();
        }
      },
    );

    it("moi o so gio day LT/TH co gioi han 50 rieng, khong cong don", async () => {
      const user = userEvent.setup();
      app.updateManualSection.mockResolvedValue({});
      render(<SectionEditDrawer data={data} section={makeSection()} onClose={vi.fn()} />);
      const lt = screen.getByRole("spinbutton", { name: "Số giờ dạy lý thuyết" });
      const th = screen.getByRole("spinbutton", { name: "Số giờ dạy thực hành" });

      await user.type(lt, "50");
      await user.type(th, "50");
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(app.updateManualSection).toHaveBeenCalled());
      expect(app.updateManualSection.mock.calls[0][1]).toMatchObject({ teachingHoursLt: 50, teachingHoursTh: 50 });

      app.updateManualSection.mockClear();
      await user.clear(th);
      await user.type(th, "51");
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      expect(screen.getByText(/Mỗi ô Số giờ dạy \(LT \/ TH\) phải từ 0 đến 50/)).toBeInTheDocument();
      expect(app.updateManualSection).not.toHaveBeenCalled();
    });

    it("buoc sua gia tri cu vuot gioi han du chi sua truong khac", async () => {
      const user = userEvent.setup();
      render(<SectionEditDrawer data={data} section={makeSection({ expectedStudents: 250, teachingHoursLt: 80 })} onClose={vi.fn()} />);

      expect(screen.getByRole("spinbutton", { name: "Số SV dự kiến" })).toHaveValue(250);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      expect(app.updateManualSection).not.toHaveBeenCalled();
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    });
  });
});
