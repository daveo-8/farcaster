

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./app";
import React from "react";


describe("App component", () => {
  it("renders without crashing", () => {
    expect(() => {
      render(<App />);
    }).not.toThrow();
  });
});
