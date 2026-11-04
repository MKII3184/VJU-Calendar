// Test nut "Tự động khai giờ rảnh" + hop thoai xac nhan cua no trong
// SubmissionWindowGrid - xem PROMPT-THEM-CHUC-NANG-GIO-RANH-GIANG-VIEN.md muc 4
// (yeu cau giao dien) va muc 9 (tieu chi nghiem thu).
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubmissionWindowGrid from "@/presentation/submissions/SubmissionWindowGrid";

const baseProps = { numDays: 6, slotsPerDay: 12, initialSlots: [], teachingSlots: [] };

describe("SubmissionWindowGrid - nut Tự động khai giờ rảnh", () => {
  it("chi ap dung giao dien bang kinh khi duoc yeu cau", () => {
    const { container, rerender } = render(<SubmissionWindowGrid {...baseProps} onSave={() => {}} />);
    expect(container.querySelector(".availability-glass-grid")).not.toHaveClass("liquid-data-grid");
    rerender(<SubmissionWindowGrid {...baseProps} onSave={() => {}} gridClassName="liquid-data-grid" />);
    expect(container.querySelector(".availability-glass-grid")).toHaveClass("liquid-data-grid");
  });

  it("khong hien nut khi khong truyen onGenerateAvailability (vd man Khung giờ đã báo)", () => {
    render(<SubmissionWindowGrid {...baseProps} onSave={() => {}} />);
    expect(screen.queryByRole("button", { name: /Tự động khai giờ rảnh/i })).not.toBeInTheDocument();
  });

  it("hien nut va mo hop thoai xac nhan noi ro se xoa het gio ranh cu, giu nguyen gio dang day", async () => {
    const user = userEvent.setup();
    render(
      <SubmissionWindowGrid {...baseProps} onSave={() => {}} onGenerateAvailability={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /Tự động khai giờ rảnh/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/xóa/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/giữ nguyên/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Xác nhận sinh lại/i })).toBeInTheDocument();
  });

  it("bam Hủy dong hop thoai va KHONG goi API sinh gio ranh", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<SubmissionWindowGrid {...baseProps} onSave={() => {}} onGenerateAvailability={onGenerate} />);

    await user.click(screen.getByRole("button", { name: /Tự động khai giờ rảnh/i }));
    await user.click(screen.getByRole("button", { name: "Hủy" }));

    expect(onGenerate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("bam Xác nhận sinh lại goi API mot lan va tu dong dong hop thoai khi thanh cong", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(<SubmissionWindowGrid {...baseProps} onSave={() => {}} onGenerateAvailability={onGenerate} />);

    await user.click(screen.getByRole("button", { name: /Tự động khai giờ rảnh/i }));
    await user.click(screen.getByRole("button", { name: /Xác nhận sinh lại/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("neu API loi thi GIU hop thoai mo, khong bao thanh cong gia", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockRejectedValue(new Error("Lỗi mạng"));
    render(<SubmissionWindowGrid {...baseProps} onSave={() => {}} onGenerateAvailability={onGenerate} />);

    await user.click(screen.getByRole("button", { name: /Tự động khai giờ rảnh/i }));
    await user.click(screen.getByRole("button", { name: /Xác nhận sinh lại/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    // Hop thoai van con do loi - khong duoc lam nhu da thanh cong.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("khoa nut khi luoi dang o trang thai saving (vd dang luu thao tac khac)", () => {
    render(
      <SubmissionWindowGrid
        {...baseProps} onSave={() => {}} onGenerateAvailability={vi.fn()} saving
      />,
    );
    expect(screen.getByRole("button", { name: /Tự động khai giờ rảnh/i })).toBeDisabled();
  });
});
