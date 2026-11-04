import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_FILTER } from "@/adapters/scheduleView";
import ScheduleToolbar, { ScheduleActions } from "@/presentation/schedule/ScheduleToolbar";

const view = {
  programs: ["FTH", "BCSE"],
  cohorts: ["VJU2026", "VJU2025"],
  cohortsFor: () => ["VJU2026", "VJU2025"],
  lessons: [{ id: 1 }],
};

describe("ScheduleToolbar", () => {
  it("ưu tiên phạm vi và tìm kiếm, thu gọn các bộ lọc phụ", async () => {
    const user = userEvent.setup();
    const set = vi.fn();
    render(
      <ScheduleToolbar
        f={DEFAULT_FILTER}
        set={set}
        view={view}
        mode="grid"
        phamVi={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Tất cả chương trình" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Xem")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm môn, giảng viên, #id")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Bộ lọc thêm" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Bộ lọc hiển thị")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Bộ lọc hiển thị").closest(".glass-popover")).toBeInTheDocument();
    expect(screen.getByLabelText("Cách tô màu")).toBeInTheDocument();

    await user.click(screen.getByText("Chỉ buổi có vấn đề"));
    expect(set).toHaveBeenCalledWith({ onlyProblems: true, chiXemPhamVi: false });
    await user.click(screen.getByRole("button", { name: "Đóng bộ lọc thêm" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("hiện số bộ lọc phụ đang dùng", () => {
    render(
      <ScheduleToolbar
        f={{ ...DEFAULT_FILTER, resident: false, onlyProblems: true, colorBy: "program" }}
        set={vi.fn()}
        view={view}
        mode="grid"
        phamVi={null}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("ScheduleActions", () => {
  it("giữ thao tác xem cho viewer và ẩn thao tác chỉnh sửa", () => {
    render(
      <ScheduleActions
        data={{ hoanTac: { nhan: "mốc thử" } }}
        view={view}
        canEdit={false}
        loading={false}
        guestResult={{}}
        residentResult={{}}
        mode="grid"
        onModeChange={vi.fn()}
        fullscreen={false}
        onFullscreenChange={vi.fn()}
        onSaveSchedule={vi.fn()}
        onHoanTac={vi.fn()}
        onXuatLuoi={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Xuất lưới" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toàn màn hình" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu thời khoá biểu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ thay đổi" })).not.toBeInTheDocument();
  });
});
