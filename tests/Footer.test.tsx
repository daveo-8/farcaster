import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Footer } from "../src/components/ui/Footer";
import React from "react";

describe("Footer", () => {
  it("renders and handles tab change", () => {
    const setActiveTab = vi.fn();
    const { getByText } = render(<Footer activeTab="Home" setActiveTab={setActiveTab} />);
    fireEvent.click(getByText("Home"));
    expect(setActiveTab).toHaveBeenCalled();
  });
});
