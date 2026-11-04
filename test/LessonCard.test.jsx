import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LessonCard from "@/presentation/timetable/LessonCard";

const lesson = {
  id: 1,
  classCode: "CSE1001-1",
  courseName: "Môn học thử",
  teacherType: "GUEST",
  teacherName: "Nguyễn Văn A",
  roomType: "LT",
  programLabel: "FTH",
  duration: 2,
};

const centeredRect = {
  left: 400,
  right: 500,
  top: 100,
  bottom: 160,
  width: 100,
  height: 60,
  x: 400,
  y: 100,
  toJSON: () => {},
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
});

describe("LessonCard popup", () => {
  it("mở bên phải khi chuột đi vào từ trái và bên trái khi đi vào từ phải", () => {
    const { container } = render(<LessonCard lesson={lesson} />);
    const bar = container.querySelector(".lesson-bar");
    bar.getBoundingClientRect = () => centeredRect;

    fireEvent.mouseEnter(bar, { clientX: 410 });
    expect(document.body.querySelector(".lesson-popover")).not.toHaveClass("flip-left");
    expect(document.body.querySelector(".lesson-popover")).toHaveClass("pass-through");

    fireEvent.click(bar);
    expect(document.body.querySelector(".lesson-popover")).toHaveClass("interactive");
    fireEvent.click(bar);
    fireEvent.mouseLeave(bar);
    fireEvent.mouseEnter(bar, { clientX: 490 });
    expect(document.body.querySelector(".lesson-popover")).toHaveClass("flip-left");
  });

  it("báo đúng buổi được bấm đúp mà không thay hành vi bấm đơn", () => {
    const onOpenManual = vi.fn();
    const { container } = render(<LessonCard lesson={lesson} onOpenManual={onOpenManual} />);
    const bar = container.querySelector(".lesson-bar");
    bar.getBoundingClientRect = () => centeredRect;

    fireEvent.click(bar);
    expect(document.body.querySelector(".lesson-popover")).toHaveClass("interactive");
    expect(onOpenManual).not.toHaveBeenCalled();
    fireEvent.doubleClick(bar);
    expect(onOpenManual).toHaveBeenCalledWith(lesson);
  });

  it("đổi phía để popup không tràn cạnh phải màn hình", () => {
    const { container } = render(<LessonCard lesson={lesson} />);
    const bar = container.querySelector(".lesson-bar");
    bar.getBoundingClientRect = () => ({
      ...centeredRect,
      left: 800,
      right: 900,
      x: 800,
    });

    fireEvent.mouseEnter(bar, { clientX: 810 });
    expect(document.body.querySelector(".lesson-popover")).toHaveClass("flip-left");
  });
});
