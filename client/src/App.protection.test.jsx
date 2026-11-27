import { render, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import App from "./App.jsx";

describe("Protected client-side routes", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  for (const path of ["/wardrobe", "/outfits", "/fitchecks", "/fitting-room", "/planner"]) {
    it(`redirects an anonymous visitor from ${path} to login`, async () => {
      window.history.replaceState({}, "", path);
      render(<App />);
      expect(await screen.findByRole("heading", {
        name: /welcome back/i
      })).toBeInTheDocument();
    });
  }
});
