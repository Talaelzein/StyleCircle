import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import FitCheck from "./FitCheck.jsx";

const user = { id: "test-user", username: "TestUser" };
const mockResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data
});

const renderFitCheck = () => render(
  <MemoryRouter>
    <FitCheck token="test-token" user={user} />
  </MemoryRouter>
);

describe("StyleCircle FitCheck", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a community poll and allows voting", async () => {
    const poll = {
      _id: "poll1",
      question: "Which outfit should I wear?",
      status: "open",
      isOwner: false,
      myVote: null,
      votes: null,
      canViewResults: false,
      looks: [
        { label: "A", name: "Casual Look", pieces: [
          { name: "White Shirt", category: "top", color: "White" }
        ] },
        { label: "B", name: "Formal Look", pieces: [
          { name: "Black Dress", category: "dress", color: "Black" }
        ] }
      ]
    };

    fetch.mockImplementation((url, options = {}) => {
      if (options.method === "PUT")
        return Promise.resolve(mockResponse({
          myVote: "A", votes: { A: 3, B: 1 }
        }));

      return Promise.resolve(mockResponse(
        url.endsWith("/api/outfits")
          ? { outfits: [] }
          : { polls: [poll] }
      ));
    });

    renderFitCheck();

    expect(await screen.findByText(
      "Which outfit should I wear?"
    )).toBeInTheDocument();

    expect(screen.getByText("Vote to reveal the results.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "Vote for A"
    }));

    expect(await screen.findByText(
      "Your final vote was saved!"
    )).toBeInTheDocument();

    expect(screen.getByText("Your final vote: A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vote for B/ })).not.toBeInTheDocument();
    expect(screen.getByText(/3 vote\(s\)/)).toBeInTheDocument();
  });

  it("creates a poll using two saved outfits", async () => {
    const outfits = [
      { _id: "outfit1", name: "University Look" },
      { _id: "outfit2", name: "Dinner Look" }
    ];

    fetch.mockImplementation((url, options = {}) => {
      if (options.method === "POST")
        return Promise.resolve(mockResponse({
          poll: {
            _id: "poll2",
            question: "Which outfit should I wear tonight?",
            status: "open",
            isOwner: true,
            myVote: null,
            votes: { A: 0, B: 0 },
            looks: [
              { label: "A", name: "University Look", pieces: [] },
              { label: "B", name: "Dinner Look", pieces: [] }
            ]
          }
        }));

      return Promise.resolve(mockResponse(
        url.endsWith("/api/outfits")
          ? { outfits }
          : { polls: [] }
      ));
    });

    renderFitCheck();

    fireEvent.change(await screen.findByLabelText("Your question"), {
      target: { value: "Which outfit should I wear tonight?" }
    });

    fireEvent.change(screen.getByLabelText("Outfit A"), {
      target: { value: "outfit1" }
    });

    fireEvent.change(screen.getByLabelText("Outfit B"), {
      target: { value: "outfit2" }
    });

    fireEvent.click(screen.getByRole("button", {
      name: "Post FitCheck"
    }));

    expect(await screen.findByText(
      "Your FitCheck is now posted!"
    )).toBeInTheDocument();
  });
});
