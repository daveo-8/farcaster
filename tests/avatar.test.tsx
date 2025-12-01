import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Avatar, AvatarImage, AvatarFallback } from "../src/components/ui/avatar";
import React from "react";

describe("Avatar", () => {
  it("renders avatar root", () => {
    const { container } = render(<Avatar />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
