
import {
  render,
  screen,
  fireEvent,
  cleanup
} from "@testing-library/react";

import { MemoryRouter } from "react-router-dom";

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from "vitest";

import FitCheck from "./FitCheck.jsx";

function mockResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data
  };
}

describe("StyleCircle FitCheck", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

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
      votes: { A: 2, B: 1 },
      looks: [
        {
          label: "A",
          name: "Casual Look",
          pieces: [
            {
              name: "White Shirt",
              category: "top",
              color: "White"
            }
          ]
        },
        {
          label: "B",
          name: "Formal Look",
          pieces: [
            {
              name: "Black Dress",
              category: "dress",
              color: "Black"
            }
          ]
        }
      ]
    };

    fetch.mockImplementation((url, options = {}) => {
      if (options.method === "PUT") {
        return Promise.resolve(
          mockResponse({
            myVote: "A",
            votes: { A: 3, B: 1 }
          })
        );
      }

      if (url.endsWith("/api/outfits")) {
        return Promise.resolve(
          mockResponse({ outfits: [] })
        );
      }

      return Promise.resolve(
        mockResponse({ polls: [poll] })
      );
    });

    render(
      <MemoryRouter>
        <FitCheck token="test-token" />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(
        "Which outfit should I wear?"
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Vote for A"
      })
    );

    expect(
      await screen.findByText(
        "Your vote was saved!"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Voted A/
      })
    ).toBeInTheDocument();
  });

  it("creates a poll using two saved outfits", async () => {
    const outfits = [
      { _id: "outfit1", name: "University Look" },
      { _id: "outfit2", name: "Dinner Look" }
    ];

    fetch.mockImplementation((url, options = {}) => {
      if (options.method === "POST") {
        return Promise.resolve(
          mockResponse({
            poll: {
              _id: "poll2",
              question:
                "Which outfit should I wear tonight?",
              status: "open",
              isOwner: true,
              myVote: null,
              votes: { A: 0, B: 0 },
              looks: [
                {
                  label: "A",
                  name: "University Look",
                  pieces: []
                },
                {
                  label: "B",
                  name: "Dinner Look",
                  pieces: []
                }
              ]
            }
          })
        );
      }

      if (url.endsWith("/api/outfits")) {
        return Promise.resolve(
          mockResponse({ outfits })
        );
      }

      return Promise.resolve(
        mockResponse({ polls: [] })
      );
    });

    render(
      <MemoryRouter>
        <FitCheck token="test-token" />
      </MemoryRouter>
    );

    const questionInput =
      await screen.findByLabelText(
        "Your question"
      );

    fireEvent.change(questionInput, {
      target: {
        value:
          "Which outfit should I wear tonight?"
      }
    });

    fireEvent.change(
      screen.getByLabelText("Outfit A"),
      {
        target: { value: "outfit1" }
      }
    );

    fireEvent.change(
      screen.getByLabelText("Outfit B"),
      {
        target: { value: "outfit2" }
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Post FitCheck"
      })
    );

    expect(
      await screen.findByText(
        "Your FitCheck is now posted!"
      )
    ).toBeInTheDocument();
  });
});
