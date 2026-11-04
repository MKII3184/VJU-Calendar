import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClassTimeSlotPicker from "@/presentation/manual/ClassTimeSlotPicker";

function Harness(props) {
  const [value, setValue] = useState(props.value ?? null);
  return <ClassTimeSlotPicker {...props} value={value} onChange={setValue} />;
}

describe("ClassTimeSlotPicker", () => {
  it("chon mot o bat dau se chon dung ca dai tiet lien tiep", async () => {
    const user = userEvent.setup();
    render(<Harness numDays={6} slotsPerDay={12} duration="3" maxDayIndex={5} />);

    await user.click(screen.getByRole("button", { name: /Thứ 2 tiết 1: Chọn Thứ 2, tiết 1–3/ }));

    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    expect(screen.getByText("Đã chọn: Thứ 2, tiết 1–3")).toBeInTheDocument();
  });

  it("vo hieu hoa tiet bat dau bi tran ngay va ngay vuot gioi han giang vien", () => {
    render(<Harness numDays={7} slotsPerDay={12} duration="3" maxDayIndex={4} />);

    expect(screen.getByRole("button", { name: /Thứ 2 tiết 11: Không đủ 3 tiết/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Thứ 7 tiết 1: Thứ 7 nằm ngoài giới hạn/ })).toBeDisabled();
  });

  it("thay ca dai cu khi bam mot o bat dau khac", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <ClassTimeSlotPicker
        numDays={6} slotsPerDay={12} duration="2" maxDayIndex={5}
        value={{ day: 0, periodStart: 1, periodEnd: 2 }} onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Thứ 4 tiết 5: Chọn Thứ 4, tiết 5–6/ }));
    expect(onChange).toHaveBeenCalledWith({ day: 2, periodStart: 5, periodEnd: 6 });

    rerender(
      <ClassTimeSlotPicker
        numDays={6} slotsPerDay={12} duration="2" maxDayIndex={5}
        value={{ day: 2, periodStart: 5, periodEnd: 6 }} onChange={onChange}
      />,
    );
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
  });

  it("van hien gio goc ngoai quy tac va khoa tuong tac khi lop da chot", () => {
    render(
      <ClassTimeSlotPicker
        numDays={7} slotsPerDay={12} duration="2" maxDayIndex={4} disabled
        value={{ day: 5, periodStart: 1, periodEnd: 2 }} onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Giờ gốc: Thứ 7, tiết 1–2/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Xóa giờ" })).not.toBeInTheDocument();
  });
});
