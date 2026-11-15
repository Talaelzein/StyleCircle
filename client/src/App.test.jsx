
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App.jsx";

describe("StyleCircle Authentication", () => {
  beforeEach(() => {
    // Start each test without a saved session.
    sessionStorage.clear();

    // Navigate to the login page.
    window.history.replaceState({}, "", "/login");
  });

  it("displays the login page correctly", async () => {
    // Arrange: render the application.
    render(<App />);

    // Wait for session restoration to finish.
    const heading = await screen.findByRole("heading", {
      name: /welcome back/i
    });

    // Assert: check the visible interface.
    expect(heading).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /log in/i
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /sign up/i
      })
    ).toBeInTheDocument();
  });
});
