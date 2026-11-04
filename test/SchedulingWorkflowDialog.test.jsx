import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SchedulingWorkflowDialog from "@/presentation/schedule/SchedulingWorkflowDialog";

vi.mock("@/presentation/schedule/PhamViXepPanel", () => ({
  default: () => <div>Xếp cho: Toàn khoa</div>,
}));

const steps = [
  { key: "collect", label: "Học phần", value: "1/1 lớp thỉnh giảng sẵn sàng", state: "done" },
  { key: "guest", label: "Xếp thỉnh giảng", value: "Chưa chạy", state: "todo", action: vi.fn(), actionLabel: "Xếp" },
  { key: "resident", label: "Ghép cơ hữu", value: "Chưa chạy", state: "blocked", disabled: true, action: vi.fn(), actionLabel: "Ghép", note: "Cần bước 2" },
];

describe("SchedulingWorkflowDialog", () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("hien popup 1000x600 o phia tren giua, quy trinh ben trai va hop thu ben phai", () => {
    render(
      <SchedulingWorkflowDialog
        open
        onOpenChange={vi.fn()}
        data={{}}
        steps={steps}
        canEdit
        loading={false}
        problemInbox={<aside>Hộp thư vấn đề</aside>}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Quy trình xếp lịch" });
    expect(dialog).toHaveClass(
      "schedule-workflow-glass",
      "w-[min(1000px,calc(100vw-2rem))]",
      "h-[min(600px,calc(100dvh-2rem))]",
      "top-[46%]",
    );
    const body = screen.getByText("Xếp cho: Toàn khoa").parentElement.parentElement;
    expect(body).toHaveClass(
      "overflow-y-auto",
      "min-[720px]:grid-cols-[minmax(0,2.25fr)_minmax(230px,0.75fr)]",
      "min-[720px]:items-stretch",
    );
    expect(screen.getByText("Xếp cho: Toàn khoa").parentElement).not.toHaveClass("overflow-y-auto");
    expect(screen.getByText("Hộp thư vấn đề").parentElement).toHaveClass("schedule-workflow-inbox", "self-stretch");
    expect(screen.getByText("Bị chặn")).toHaveClass("font-bold", "text-black");
  });

  it("dong bang nut close va khong tu chay buoc nao", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <SchedulingWorkflowDialog
        open
        onOpenChange={onOpenChange}
        data={{}}
        steps={steps}
        canEdit
        loading={false}
      />,
    );

    expect(steps[1].action).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("giu ket qua gan nhat khi dong roi mo lai popup", () => {
    const completedSteps = steps.map((step) => (
      step.key === "guest"
        ? { ...step, state: "done", value: "8/8 đã xếp", actionLabel: "Xếp lại" }
        : step
    ));
    const props = {
      onOpenChange: vi.fn(),
      data: {},
      steps: completedSteps,
      canEdit: true,
      loading: false,
    };
    const { rerender } = render(<SchedulingWorkflowDialog {...props} open />);
    expect(screen.getByText("8/8 đã xếp")).toBeInTheDocument();

    rerender(<SchedulingWorkflowDialog {...props} open={false} />);
    rerender(<SchedulingWorkflowDialog {...props} open />);

    expect(screen.getByText("8/8 đã xếp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xếp lại" })).toBeInTheDocument();
  });

  it("viewer khong co nut chay va loi API hien mau canh bao tuong phan", () => {
    render(
      <SchedulingWorkflowDialog
        open
        onOpenChange={vi.fn()}
        data={{}}
        steps={steps}
        canEdit={false}
        loading={false}
        error="Solver không phản hồi"
      />,
    );

    expect(screen.queryByRole("button", { name: "Xếp" })).not.toBeInTheDocument();
    expect(screen.getByText("Solver không phản hồi").closest("div")).toHaveClass("font-bold", "text-black");
  });
});
