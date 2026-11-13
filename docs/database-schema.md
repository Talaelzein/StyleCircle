# StyleCircle database schema (Milestone 1 design)

## Users - implemented in Milestone 2
- `_id`: ObjectId, primary key
- `username`: required display name (not unique); email is the login identifier.
- `email`: unique, required, lowercase
- `passwordHash`: bcrypt hash; never sent in API responses
- `createdAt`, `updatedAt`: timestamps

## ClothingItems - implemented in Milestone 2
- `_id`: ObjectId, primary key
- `ownerId`: ObjectId -> Users, required
- `name`: required string
- `category`: enum `top, bottom, dress, outerwear, shoes, bag, accessory`
- `color`: optional string
- `imageUrl`: optional string (photo upload integration is future work)
- `imagePublicId`: optional, reserved for Cloudinary integration
- `createdAt`, `updatedAt`: timestamps

One User -> many ClothingItems. Every private query uses both `_id` and authenticated `ownerId`.

## Outfits - planned for Milestone 3+
- `_id`, `ownerId` -> Users, `title`, `itemIds[]` -> ClothingItems, timestamps
- Rule: all selected clothing items must belong to the outfit creator; at least one item required.

## Polls - planned for Milestone 3+
- `_id`, `ownerId` -> Users, `outfitIds[2]` -> Outfits, `optionSnapshots[2]`, `shareCode` (unique), `status`
- Rule: only the two selected outfits are visible to other signed-in voters; not the user's full closet.

## Votes - planned for Milestone 3+
- `_id`, `pollId` -> Polls, `voterId` -> Users, `selectedOutfitId` -> Outfits, `createdAt`
- UNIQUE INDEX `(pollId, voterId)` enforces one vote per user per poll.
- Poll creator cannot vote on own poll.

## Entity connections

```text
User (1) ---- (*) ClothingItem
User (1) ---- (*) Outfit ---- (*) ClothingItem
User (1) ---- (*) Poll ---- (2) Outfit
Poll (1) ---- (*) Vote ---- (1) User
```
