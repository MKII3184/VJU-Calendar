import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubmissionsPage from "@/presentation/pages/SubmissionsPage";

const base = { programLabel: "BCSE", programParts: ["BCSE"], coordinator: "DPV", roomType: "LT", duration: 2, state: "UNREPORTED", windowSlots: [], isEmpty: true };
const sq = {
  queue: [1, 2, 3],
  guestCount: 3,
  doneCount: 0,
  coordinators: [],
  coordinatorsBehind: [],
  programs: ["BCSE"],
  numDays: 6,
  slotsPerDay: 12,
  residentCount: 0,
  unassigned: [{ ...base, sectionId: 11, courseName: "Môn trùng tên", reason: "chưa có GV" }],
  needsHours: [{ ...base, sectionId: 22, courseName: "Môn trùng tên", teacherId: 5, teacherName: "GV A" }],
  rows: [{ ...base, sectionId: 33, courseName: "Môn trùng tên", teacherName: "GV A" }],
};

vi.mock("@/adapters/submissionQueue", async (orig) => ({
  ...(await orig()),
  analyzeSubmissions: () => sq,
}));
vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({
    data: {
      classes: [{ sectionId: 11 }, { sectionId: 22 }, { sectionId: 33 }],
      teachers: [{ id: 5 }],
    },
    loading: false,
    error: null,
    updateManualTeacher: vi.fn(),
  }),
}));
vi.mock("@/presentation/manual/SectionEditDrawer", () => ({
  default: ({ section }) => <div data-testid="drawer">Sửa lớp {section.sectionId}</div>,
}));

describe("SubmissionsPage: bấm tên học phần mở Sửa lớp", () => {
  it("mở đúng lớp ở cả danh sách chưa phân công, bảng chưa khai giờ và bảng tra cứu", async () => {
    const user = userEvent.setup();
    render(<SubmissionsPage role="staff" />);

    await user.click(screen.getByRole("button", { name: /Sửa lớp #11/ }));
    expect(screen.getByTestId("drawer")).toHaveTextContent("Sửa lớp 11");

    await user.click(screen.getByRole("button", { name: /Sửa lớp #22/ }));
    expect(screen.getByTestId("drawer")).toHaveTextContent("Sửa lớp 22");

    await user.click(screen.getByRole("tab", { name: /Bảng tra cứu/ }));
    expect(screen.getByRole("tab", { name: /Bảng tra cứu/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Bảng tra cứu/ })).toHaveClass("teacher-type-tab-active");
    await user.click(screen.getByRole("button", { name: /Sửa lớp #33/ }));
    expect(screen.getByTestId("drawer")).toHaveTextContent("Sửa lớp 33");
  });

  it("vai trò chỉ xem: tên học phần không bấm được", () => {
    render(<SubmissionsPage role="viewer" />);
    expect(screen.queryByRole("button", { name: /Sửa lớp/ })).toBeNull();
  });
});
