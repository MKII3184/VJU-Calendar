import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SubmissionWindowGrid from "@/presentation/submissions/SubmissionWindowGrid";

// Thu 4 (idx 2) tiet 6 (idx 5) = slot 2*12+5 = 29 dang day.
const props = { numDays: 6, slotsPerDay: 12, initialSlots: [], teachingSlots: [29], allowEmpty: true };
const cell = (name) => screen.getByRole("checkbox", { name: new RegExp(name) });

describe("SubmissionWindowGrid - o dang day", () => {
  it("bam, ban phim khong chon duoc o dang day; o trong van chon", () => {
    render(<SubmissionWindowGrid {...props} onSave={() => {}} />);
    const busy = cell("Thứ 4 tiết 6");
    expect(busy).toHaveAttribute("aria-disabled", "true");
    fireEvent.pointerDown(busy);
    fireEvent.pointerUp(window);
    fireEvent.keyDown(busy, { key: " " });
    expect(busy).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("0 ô")).toBeInTheDocument();
    fireEvent.pointerDown(cell("Thứ 4 tiết 7"));
    fireEvent.pointerUp(window);
    expect(screen.getByText("1 ô")).toBeInTheDocument();
  });

  it("chon ca ngay/cot/keo vung bo qua o dang day va khong luu no", () => {
    const onSave = vi.fn();
    render(<SubmissionWindowGrid {...props} onSave={onSave} saveLabel={() => "Luu"} />);
    fireEvent.click(screen.getByRole("button", { name: "Thứ 4".replace("Thứ ", "T") }));
    expect(screen.getByText("11 ô")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiết 6" }));
    expect(screen.getByText("16 ô")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Luu" }));
    const slots = onSave.mock.calls[0][0];
    expect(slots).not.toContain(29);
    expect(slots).toHaveLength(16);
  });

  it("bo o dang day khoi ban nhap khi du lieu cu lo chua no", () => {
    render(<SubmissionWindowGrid {...props} initialSlots={[29, 30]} onSave={() => {}} />);
    expect(screen.getByText("1 ô")).toBeInTheDocument();
    expect(screen.queryByText("chưa lưu")).not.toBeInTheDocument();
  });
});