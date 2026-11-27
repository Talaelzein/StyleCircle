# StyleCircle — Database Schema (Current Implementation)

This document records the **implemented** MongoDB/Mongoose structure, updated from the Milestone 1 design. The Mongoose models in `server/src/models/` are the source of truth. The original milestone wireframes remain in [wireframes.md](wireframes.md).

## User (`User.js`)
- `_id`: MongoDB ObjectId.
- `username`: required, trimmed.
- `email`: required, unique, lowercase; used for login.
- `passwordHash`: bcrypt password hash; excluded from ordinary queries by `select: false`.
- `createdAt`, `updatedAt`: timestamps.

## ClothingItem (`ClothingItem.js`)
- `_id`: ObjectId.
- `ownerId`: required ObjectId reference to User, indexed.
- `name`: required; `category`: required enum (`top`, `bottom`, `dress`, `outerwear`, `shoes`, `bag`, `accessory`, `jewelry`, `glasses`).
- Optional styling details: `color`, `material`, `style`, `occasion`, `season`.
- Optional wardrobe metadata: `brand`, `size`, `price`, `purchaseDate`, `favorite`, `sourceUrl`.
- Images: optional direct `imageUrl`, or `imagePublicId` referencing an uploaded file in MongoDB GridFS (`clothingImages` bucket).
- `createdAt`, `updatedAt`; compound index on `ownerId` and descending `createdAt`.

Every protected wardrobe request filters by the authenticated `ownerId`; users cannot access another account's private closet via a guessed item ID.

## Outfit (`Outfit.js`)
- `_id`: ObjectId; `ownerId`: required User reference.
- `name`: required.
- `clothingItemIds`: array of ObjectId references to ClothingItem; **2–10 unique items** required.
- Optional `occasion`, `notes`; timestamps.
- Creating or editing outfits verifies that every referenced clothing item belongs to the logged-in user.
- Mongoose `populate()` expands references when retrieving outfits.

## FitCheck (`FitCheck.js`)
- `_id`: ObjectId; `ownerId`: required User reference.
- `question`: required, between 5 and 160 characters.
- `looks`: exactly two embedded look snapshots; each contains `outfitId`, `name`, and `pieces`.
- Each piece snapshot stores `name`, `category`, `color`, `imagePublicId`, `imageUrl` so a post can retain its preview even after wardrobe edits.
- `status`: `open` or `closed`; `photosShared`: boolean; timestamps.
- The server prevents the poll creator from voting on their own FitCheck.

## FitCheckVote (`FitCheckVote.js`)
- `_id`: ObjectId.
- `fitCheckId`: required ObjectId reference to FitCheck.
- `voterId`: required ObjectId reference to User.
- `choice`: `A` or `B`; timestamps.
- Unique compound index: `(fitCheckId, voterId)`. Each user has one current vote per poll and can change it.

## StyleEntry (`StyleEntry.js`)
One persisted model serves different collections of user-created content.
- `_id`: ObjectId; `ownerId`: required User reference.
- `kind`: `plan`, `wear`, `packing`, `wishlist`, or `moodboard`.
- `title`, `date`, `notes`, `url`, `imageUrl`, `price`, `completed`.
- Optional `itemIds[]` and `checkedIds[]` reference ClothingItem; `outfitId` references Outfit.
- Server-side validation checks referenced objects against the logged-in owner.
- Compound index on `ownerId`, `kind`, and `date`; timestamps.

## Relationship overview

```text
User (1) ───── (*) ClothingItem
User (1) ───── (*) Outfit (*) ───── (*) ClothingItem
User (1) ───── (*) StyleEntry
User (1) ───── (*) FitCheck (1) ───── (*) FitCheckVote (*) ───── (1) User
FitCheck (1) ───── (2) embedded look snapshots ───── (1 each) Outfit ID
```

## Authentication, storage, and data privacy
- API authentication uses signed JWT bearer tokens. Passwords are hashed with bcrypt.
- User-owned resources use the authenticated user's ID in database filters.
- Uploaded wardrobe images use private authenticated endpoints backed by MongoDB GridFS.
- The current AI fitting room sends selected images to an external Hugging Face service with explicit user consent; generated previews are saved **in the browser (IndexedDB)** when supported, not as a MongoDB collection.
- Database credentials, JWT signing secrets, and the Hugging Face token are environment variables and must not be committed.
