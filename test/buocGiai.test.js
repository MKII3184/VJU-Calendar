import { describe, expect, it, vi } from "vitest";
import { buildSteps } from "@/adapters/buocGiai";

function makeData({ submissions = [], classes = [] } = {}) {
  return {
    numDays: 7,
    slotsPerDay: 12,
    submissions,
    classes,
    teachers: submissions.map((s) => ({ id: s.teacherId, type: s.teacherType, isPlaceholder: s.isPlaceholder })),
  };
}

describe("buildSteps", () => {
  it("chan buoc 2 khi con lop thinh giang thieu GV hoac gio", () => {
    const data = makeData({
      submissions: [
        { sectionId: 1, teacherId: 1, teacherType: "GUEST", windowSlots: [1], availabilityAssumed: false },
        { sectionId: 2, teacherId: 2, teacherType: "GUEST", windowSlots: [], availabilityAssumed: false },
      ],
      classes: [
        { sectionId: 1, teacherType: "GUEST", timeAssumed: true },
        { sectionId: 2, teacherType: "GUEST", timeAssumed: true },
      ],
    });

    const steps = buildSteps({ data, solveGuest: vi.fn(), solveResident: vi.fn() });
    expect(steps[0].value).toContain("1/2 lớp thỉnh giảng sẵn sàng");
    expect(steps[0].state).toBe("blocked");
    expect(steps[1]).toMatchObject({ state: "blocked", disabled: true });
  });

  it("cho chay buoc 2 voi 0/0 va khong coi ket qua initial la da chay", () => {
    const data = makeData({ classes: [{ sectionId: 3, teacherType: "RESIDENT", timeAssumed: true }] });
    const steps = buildSteps({
      data,
      guestResult: { initial: true, lessons: [], placedCount: 0, total: 0 },
      solveGuest: vi.fn(),
      solveResident: vi.fn(),
    });

    expect(steps[0]).toMatchObject({ value: expect.stringContaining("0/0"), state: "done" });
    expect(steps[1]).toMatchObject({ state: "todo", disabled: false });
    expect(steps[2]).toMatchObject({ state: "blocked", disabled: true });
  });

  it("bao ket qua mot phan mau canh bao nhung van mo buoc 3", () => {
    const data = makeData({ classes: [{ sectionId: 1, teacherType: "GUEST", timeAssumed: true }] });
    const steps = buildSteps({
      data,
      guestResult: { lessons: [], placedCount: 0, total: 1, unplaced: [{ id: 1 }] },
      solveGuest: vi.fn(),
      solveResident: vi.fn(),
    });

    expect(steps[1].state).toBe("partial");
    expect(steps[2]).toMatchObject({ state: "todo", disabled: false });
  });

  it("khong dung ket qua cu cua pham vi khac", () => {
    const data = makeData({ classes: [{ sectionId: 1, teacherType: "GUEST", timeAssumed: true, programParts: ["FTH"], cohortParts: ["K68"] }] });
    const steps = buildSteps({
      data,
      phamVi: { programs: ["FTH"], cohorts: ["K68"] },
      guestResult: { lessons: [], placedCount: 0, total: 1, unplaced: [], phamVi: { programs: ["BCSE"], cohorts: ["K68"] } },
      solveGuest: vi.fn(),
      solveResident: vi.fn(),
    });

    expect(steps[1].state).toBe("todo");
    expect(steps[2]).toMatchObject({ state: "blocked", disabled: true });
  });
});
