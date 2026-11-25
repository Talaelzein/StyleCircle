
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

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid outfit ID");

const createSchema = z.object({
  question: z.string().trim().min(5).max(160),
  outfitIds: z.array(objectId).length(2).refine(
    ([a, b]) => a.toLowerCase() !== b.toLowerCase(),
    "Choose two different outfits"
  )
}).strict();

const voteSchema = z.object({
  choice: z.enum(["A", "B"])
}).strict();

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid FitCheck ID" });
  }
  next();
}

function snapshotPiece(piece) {
  return {
    name: piece.name,
    category: piece.category,
    color: piece.color || "",
    imagePublicId: piece.imagePublicId || "",
    imageUrl: piece.imageUrl?.startsWith("https://") ? piece.imageUrl : ""
  };
}

function snapshotLook(outfit) {
  return {
    outfitId: outfit._id,
    name: outfit.name,
    pieces: outfit.clothingItemIds.filter(Boolean).map(snapshotPiece)
  };
}

function publicPoll(poll, userId, votes = { A: 0, B: 0 }, myVote = null) {
  const shared = Boolean(poll.photosShared);

  return {
    _id: poll._id,
    question: poll.question,
    status: poll.status,
    createdAt: poll.createdAt,
    photosShared: shared,
    isOwner: String(poll.ownerId) === String(userId),

    looks: poll.looks.map((look, index) => ({
      label: index === 0 ? "A" : "B",
      name: look.name,

      pieces: look.pieces.map((piece) => ({
        name: piece.name,
        category: piece.category,
        color: piece.color || "",
        hasPhoto: shared && Boolean(piece.imagePublicId),
        imageUrl: shared && piece.imageUrl?.startsWith("https://")
          ? piece.imageUrl
          : ""
      }))
    })),

    votes,
    myVote
  };
}

async function ownerOutfits(ids, ownerId) {
  return Outfit.find({ _id: { $in: ids }, ownerId }).populate({
    path: "clothingItemIds",
    match: { ownerId },
    select: "name category color imagePublicId imageUrl"
  });
}

// GET: Community FitChecks
router.get("/", async (req, res) => {
  const polls = await FitCheck.find()
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  const ids = polls.map((poll) => poll._id);

  const [totals, mine] = await Promise.all([
    FitCheckVote.aggregate([
      { $match: { fitCheckId: { $in: ids } } },
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

  for (const { _id, count } of totals) {
    const id = String(_id.fitCheckId);

    if (!counts.has(id)) {
      counts.set(id, { A: 0, B: 0 });
    }

    counts.get(id)[_id.choice] = count;
  }

  const choices = new Map(
    mine.map((vote) => [
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
        counts.get(id),
        choices.get(id) || null
      );
    })
  });
});

// POST: Create FitCheck with outfit photos
router.post("/", validateBody(createSchema), async (req, res) => {
  const { question, outfitIds } = req.validatedBody;
  const outfits = await ownerOutfits(outfitIds, req.userId);

  if (outfits.length !== 2) {
    return res.status(400).json({
      error: "Choose two outfits from your account"
    });
  }

  const lookup = new Map(
    outfits.map((outfit) => [String(outfit._id), outfit])
  );

  const looks = outfitIds.map((id) =>
    snapshotLook(lookup.get(id.toLowerCase()))
  );

  const poll = await FitCheck.create({
    ownerId: req.userId,
    question,
    looks,
    status: "open",
    photosShared: true
  });

  res.status(201).json({
    poll: publicPoll(poll, req.userId),
    message: "FitCheck posted successfully!"
  });
});

// PATCH: Share photos in an older FitCheck
router.patch("/:id/share-photos", validId, async (req, res) => {
  const poll = await FitCheck.findOne({
    _id: req.params.id,
    ownerId: req.userId
  });

  if (!poll) {
    return res.status(404).json({
      error: "FitCheck not found"
    });
  }

  const outfits = await ownerOutfits(
    poll.looks.map((look) => look.outfitId),
    req.userId
  );

  if (outfits.length !== 2) {
    return res.status(409).json({
      error: "Saved outfits are missing. Create a new FitCheck."
    });
  }

  const lookup = new Map(
    outfits.map((outfit) => [String(outfit._id), outfit])
  );

  for (const look of poll.looks) {
    const outfit = lookup.get(String(look.outfitId));

    if (!outfit) {
      return res.status(409).json({
        error: "One saved outfit is missing"
      });
    }

    look.pieces = snapshotLook(outfit).pieces;
  }

  poll.photosShared = true;
  poll.markModified("looks");
  await poll.save();

  const visible = publicPoll(poll, req.userId);

  res.json({
    looks: visible.looks,
    photosShared: visible.photosShared
  });
});

// PUT: Vote or change an existing vote
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

    if (String(poll.ownerId) === String(req.userId)) {
      return res.status(403).json({
        error: "You cannot vote on your own FitCheck"
      });
    }

    const choice = req.validatedBody.choice;
    const filter = {
      fitCheckId: poll._id,
      voterId: req.userId
    };

    try {
      await FitCheckVote.findOneAndUpdate(
        filter,
        { $set: { choice } },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;

      await FitCheckVote.updateOne(
        filter,
        { $set: { choice } }
      );
    }

    const [A, B] = await Promise.all(
      ["A", "B"].map((c) =>
        FitCheckVote.countDocuments({
          fitCheckId: poll._id,
          choice: c
        })
      )
    );

    res.json({
      message: "Vote saved successfully!",
      myVote: choice,
      votes: { A, B }
    });
  }
);

// PATCH: Close voting
router.patch("/:id/close", validId, async (req, res) => {
  const poll = await FitCheck.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.userId },
    { $set: { status: "closed" } },
    { new: true }
  );

  if (!poll) {
    return res.status(404).json({
      error: "FitCheck not found"
    });
  }

  res.json({
    status: poll.status,
    message: "Voting closed"
  });
});

// DELETE: Remove FitCheck and its votes
router.delete("/:id", validId, async (req, res) => {
  const poll = await FitCheck.findOneAndDelete({
    _id: req.params.id,
    ownerId: req.userId
  });

  if (!poll) {
    return res.status(404).json({
      error: "FitCheck not found"
    });
  }

  await FitCheckVote.deleteMany({
    fitCheckId: poll._id
  });

  res.status(204).end();
});

export default router;
