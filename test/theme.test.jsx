import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { GLASS_KEY, MODE_KEY, loadTheme, setTheme } from "@/lib/theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    setTheme({ mode: "light", glass: true });
  });

  it("mặc định là sáng + kính khi chưa lưu gì", () => {
    localStorage.clear();
    expect(loadTheme()).toEqual({ mode: "light", glass: true });
  });

  it("4 tổ hợp: Sáng/Tối chọn một, kính độc lập, lưu localStorage và gán lên <html>", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const root = document.documentElement;
    const sang = screen.getByRole("button", { name: "Giao diện sáng" });
    const toi = screen.getByRole("button", { name: "Giao diện tối" });
    const kinh = screen.getByRole("button", { name: "Hiệu ứng Liquid Glass" });

    expect(sang).toHaveAttribute("aria-pressed", "true");
    expect(kinh).toHaveAttribute("aria-pressed", "true");
    expect(root).not.toHaveClass("dark");
    expect(root.dataset.glass).toBe("on");

    await user.click(toi);
    expect(toi).toHaveAttribute("aria-pressed", "true");
    expect(sang).toHaveAttribute("aria-pressed", "false");
    expect(root).toHaveClass("dark");
    expect(root.dataset.glass).toBe("on");

    await user.click(kinh);
    expect(kinh).toHaveAttribute("aria-pressed", "false");
    expect(root).toHaveClass("dark");
    expect(root.dataset.glass).toBe("off");
    expect(localStorage.getItem(MODE_KEY)).toBe("dark");
    expect(localStorage.getItem(GLASS_KEY)).toBe("0");
    expect(loadTheme()).toEqual({ mode: "dark", glass: false });

    await user.click(sang);
    expect(root).not.toHaveClass("dark");
    expect(root.dataset.glass).toBe("off");
  });
});
