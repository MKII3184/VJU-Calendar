import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualEntryPage from "@/presentation/pages/ManualEntryPage";

const classes = [
  { sectionId: 1, classCode: "VJU2002-1", courseName: "Môn A", programParts: ["BCSE"], cohortParts: ["K68"], status: "ready_auto", sectionChot: null },
  { sectionId: 2, classCode: "VJU2003-1", courseName: "Môn B", programParts: ["MJM"], cohortParts: ["K67"], status: "ready_fixed", sectionChot: {}, boQua: true },
  { sectionId: 3, classCode: "VJU2002-1", courseName: "Môn ngoài nhóm", programParts: ["BCSE"], cohortParts: ["K68"], status: "ready_auto", sectionChot: null },
];

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({
    data: { sourceLabel: "Nhập liệu thủ công", classes, teachers: [], courses: [] },
    loading: false,
    initManual: vi.fn(),
    doClearManualTimes: vi.fn(),
    doBoChotSection: vi.fn(),
    doBoHocChung: vi.fn(),
    doBoQua: vi.fn(),
  }),
}));

vi.mock("@/presentation/manual/SectionTable", () => ({
  STATUS_META: {
    ready_auto: { label: "Tự động xếp", tone: "amber" },
    ready_fixed: { label: "Có giờ cố định", tone: "emerald" },
  },
  default: ({ rows }) => <div data-testid="rows">{rows.map((row) => row.sectionId).join(",")}</div>,
}));
vi.mock("@/presentation/manual/SectionEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/TeacherEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/CourseEditDrawer", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ImportExcelDialog", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ExportExcelDialog", () => ({ default: () => null }));
vi.mock("@/presentation/manual/ChotCourseDialog", () => ({ default: () => null }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

function Harness() {
  const [open, setOpen] = useState(true);
  const [viewState, setViewState] = useState();
  return (
    <>
      <button type="button" onClick={() => setOpen((value) => !value)}>Đổi module</button>
      {open && <ManualEntryPage role="staff" viewState={viewState} onViewStateChange={setViewState} />}
    </>
  );
}

function FocusHarness({ handled }) {
  const [viewState, setViewState] = useState({
    search: "tìm cũ",
    programFilter: "BCSE",
    cohortFilter: "K68",
    statusFilter: "ready_auto",
    chotFilter: "chua",
    hienBoQua: false,
    targetSectionIds: null,
  });
  return (
    <ManualEntryPage
      role="staff"
      viewState={viewState}
      onViewStateChange={setViewState}
      focusRequest={{ seq: 1, targets: [{ id: 1, classCode: "VJU2002-1" }, { id: 2, classCode: "VJU2003-1" }] }}
      onFocusHandled={handled}
    />
  );
}

describe("ManualEntryPage - giữ và ưu tiên tìm kiếm", () => {
  it("giữ từ khóa khi rời module rồi quay lại trong cùng phiên app", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("textbox", { name: /Tìm mã lớp/ }), "VJU2002");
    expect(screen.getByTestId("rows")).toHaveTextContent("1,3");
    await user.click(screen.getByRole("button", { name: "Đổi module" }));
    await user.click(screen.getByRole("button", { name: "Đổi module" }));

    expect(screen.getByRole("textbox", { name: /Tìm mã lớp/ })).toHaveValue("VJU2002");
    expect(screen.getByTestId("rows")).toHaveTextContent("1,3");
  });

  it("ưu tiên đúng các section của thẻ học chung, bỏ bộ lọc che kết quả và hiện lớp bỏ qua", async () => {
    const handled = vi.fn();
    render(<FocusHarness handled={handled} />);

    await waitFor(() => expect(handled).toHaveBeenCalledWith(1));
    expect(screen.getByRole("textbox", { name: /Tìm mã lớp/ })).toHaveValue("VJU2002-1, VJU2003-1");
    expect(screen.getByTestId("rows")).toHaveTextContent("1,2");
    expect(screen.getByTestId("rows")).not.toHaveTextContent("3");
  });
});
