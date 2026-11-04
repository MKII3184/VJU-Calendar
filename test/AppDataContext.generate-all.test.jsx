import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppDataProvider, useAppData } from "@/context/AppDataContext";

const mocks = vi.hoisted(() => ({
  generateAll: vi.fn(),
  getData: vi.fn(),
  getResults: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/services/schedulerService", () => ({
  generateAllTeacherAvailability: mocks.generateAll,
  getData: mocks.getData,
  getResults: mocks.getResults,
}));

vi.mock("@/context/EventLogContext", () => ({
  useEventLog: () => ({ log: mocks.log }),
}));

function Probe() {
  const { data, error, generateAllTeacherAvailability } = useAppData();
  return (
    <>
      <button type="button" onClick={() => generateAllTeacherAvailability().catch(() => {})}>
        Chạy hàng loạt
      </button>
      <output aria-label="data">{data?.marker || ""}</output>
      <output aria-label="error">{error || ""}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getData.mockRejectedValue(Object.assign(new Error("Chưa có dữ liệu"), { status: 400 }));
});

describe("AppDataContext - khai toàn bộ giờ rảnh", () => {
  it("áp dụng response mới và thông báo đúng số giảng viên khi thành công", async () => {
    const user = userEvent.setup();
    mocks.generateAll.mockResolvedValue({
      classes: [],
      marker: "mới nhất",
      generatedTeacherCount: 4,
      generatedSlotCount: 20,
      guestResult: null,
      residentResult: null,
    });
    render(<AppDataProvider><Probe /></AppDataProvider>);

    await user.click(screen.getByRole("button", { name: "Chạy hàng loạt" }));

    await waitFor(() => expect(screen.getByLabelText("data")).toHaveTextContent("mới nhất"));
    expect(mocks.generateAll).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith(
      "Đã khai lại giờ rảnh cho 4 giảng viên (20 tiết).",
      "success",
    );
  });

  it("giữ dữ liệu cũ và báo lỗi theo cơ chế hiện có khi API thất bại", async () => {
    const user = userEvent.setup();
    mocks.generateAll.mockRejectedValue(new Error("Mất kết nối"));
    render(<AppDataProvider><Probe /></AppDataProvider>);

    await user.click(screen.getByRole("button", { name: "Chạy hàng loạt" }));

    await waitFor(() => expect(screen.getByLabelText("error")).toHaveTextContent("Mất kết nối"));
    expect(screen.getByLabelText("data")).toHaveTextContent("");
    expect(mocks.log).toHaveBeenCalledWith(
      "Khai toàn bộ giờ rảnh thất bại: Mất kết nối",
      "error",
    );
  });
});
