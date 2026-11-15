
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import FitCheck from "../models/FitCheck.js";
import FitCheckVote from "../models/FitCheckVote.js";
import Outfit from "../models/Outfit.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid outfit ID");

const createSchema = z.object({
  question: z.string().trim().min(5).max(160),

  outfitIds: z
    .array(objectIdSchema)
    .length(2, "Select exactly two outfits")
    .refine(
      (ids) =>
        ids[0].toLowerCase() !== ids[1].toLowerCase(),
      "Choose two different outfits"
    )
}).strict();

const voteSchema = z.object({
  choice: z.enum(["A", "B"])
}).strict();

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid FitCheck ID"
    });
  }

  next();
}

// Return only information that can be shared publicly
// with other logged-in StyleCircle users.
function publicPoll(
  poll,
  userId,
  votes = { A: 0, B: 0 },
  myVote = null
) {
  return {
    _id: poll._id,
    question: poll.question,
    status: poll.status,
    createdAt: poll.createdAt,

    isOwner:
      String(poll.ownerId) === String(userId),

    looks: poll.looks.map((look, index) => ({
      label: index === 0 ? "A" : "B",
      name: look.name,
      pieces: look.pieces.map((piece) => ({
        name: piece.name,
        category: piece.category,
        color: piece.color || ""
      }))
    })),

    votes,
    myVote
  };
}

// GET /api/fitchecks
// View the latest polls from StyleCircle users.
router.get("/", async (req, res) => {
  const polls = await FitCheck.find()
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  const ids = polls.map((poll) => poll._id);

  const [totals, myVotes] = await Promise.all([
    FitCheckVote.aggregate([
      {
        $match: {
          fitCheckId: { $in: ids }
        }
      },
      {
        $group: {
          _id: {
            fitCheckId: "$fitCheckId",
            choice: "$choice"
          },
          count: { $sum: 1 }
        }
      }
    ]),

    FitCheckVote.find({
      fitCheckId: { $in: ids },
      voterId: req.userId
    }).lean()
  ]);

  const counts = new Map();

  for (const row of totals) {
    const id = String(row._id.fitCheckId);

    if (!counts.has(id)) {
      counts.set(id, { A: 0, B: 0 });
    }

    const result = counts.get(id);

    result[row._id.choice] = row.count;
  }

  const userChoices = new Map(
    myVotes.map((vote) => [
      String(vote.fitCheckId),
      vote.choice
    ])
  );

  res.json({
    polls: polls.map((poll) => {
      const id = String(poll._id);

      return publicPoll(
        poll,
        req.userId,
        counts.get(id) || { A: 0, B: 0 },
        userChoices.get(id) || null
      );
    })
  });
});

// POST /api/fitchecks
// Share two saved outfits in a new poll.
router.post(
  "/",
  validateBody(createSchema),
  async (req, res) => {
    const { question, outfitIds } = req.validatedBody;

    // Both outfits must belong to the current user.
    const outfits = await Outfit.find({
      _id: { $in: outfitIds },
      ownerId: req.userId
    }).populate({
      path: "clothingItemIds",
      match: { ownerId: req.userId },
      select: "name category color"
    });

    if (outfits.length !== 2) {
      return res.status(400).json({
        error:
          "Select two saved outfits belonging to your account"
      });
    }

    // Preserve the A/B order chosen by the user.
    const looks = outfitIds.map((id) => {
      const outfit = outfits.find(
        (item) =>
          String(item._id) === id.toLowerCase()
      );

      return {
        outfitId: outfit._id,
        name: outfit.name,

        pieces: outfit.clothingItemIds
          .filter(Boolean)
          .map((piece) => ({
            name: piece.name,
            category: piece.category,
            color: piece.color || ""
          }))
      };
    });

    const poll = await FitCheck.create({
      ownerId: req.userId,
      question,
      looks,
      status: "open"
    });

    res.status(201).json({
      poll: publicPoll(poll, req.userId),
      message: "FitCheck posted successfully!"
    });
  }
);

// PUT /api/fitchecks/:id/vote
// Vote A or B, or change an existing vote.
router.put(
  "/:id/vote",
  validId,
  validateBody(voteSchema),
  async (req, res) => {
    const poll = await FitCheck.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({
        error: "FitCheck not found"
      });
    }

    if (poll.status !== "open") {
      return res.status(400).json({
        error: "Voting is closed"
      });
    }

    if (
      String(poll.ownerId) === String(req.userId)
    ) {
      return res.status(403).json({
        error: "You cannot vote on your own FitCheck"
      });
    }

    const choice = req.validatedBody.choice;
    const filter = {
      fitCheckId: poll._id,
      voterId: req.userId
    };

    // Upsert creates a vote or updates the existing one.
    try {
      await FitCheckVote.findOneAndUpdate(
        filter,
        { $set: { choice } },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      );
    } catch (error) {
      // If two simultaneous first votes collide,
      // the unique index prevents duplicate votes.
      if (error.code !== 11000) throw error;

      await FitCheckVote.updateOne(
        filter,
        { $set: { choice } }
      );
    }

    const [A, B] = await Promise.all([
      FitCheckVote.countDocuments({
        fitCheckId: poll._id,
        choice: "A"
      }),

      FitCheckVote.countDocuments({
        fitCheckId: poll._id,
        choice: "B"
      })
    ]);

    res.json({
      message: "Vote saved successfully!",
      myVote: choice,
      votes: { A, B }
    });
  }
);

// PATCH /api/fitchecks/:id/close
// Only the owner can close the poll.
router.patch(
  "/:id/close",
  validId,
  async (req, res) => {
    const poll = await FitCheck.findOneAndUpdate(
      {
        _id: req.params.id,
        ownerId: req.userId
      },
      {
        $set: { status: "closed" }
      },
      {
        new: true
      }
    );

    if (!poll) {
      return res.status(404).json({
        error: "FitCheck not found"
      });
    }

    res.json({
      message: "Voting closed",
      status: poll.status
    });
  }
);

// DELETE /api/fitchecks/:id
// Only the owner can delete the poll.
router.delete(
  "/:id",
  validId,
  async (req, res) => {
    const poll = await FitCheck.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.userId
    });

    if (!poll) {
      return res.status(404).json({
        error: "FitCheck not found"
      });
    }

    // Remove votes attached to the deleted poll.
    await FitCheckVote.deleteMany({
      fitCheckId: poll._id
    });

    res.status(204).end();
  }
);

export default router;
