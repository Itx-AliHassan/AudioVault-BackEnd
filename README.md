# AudioVault API Documentation

> Backend API documentation for **AudioVault** — including authentication, audio management, admin APIs, health checks, Cloudinary handling, and the problems/bugs encountered during development.

---

## 📌 Base URL

For local development:

```text
http://localhost:PORT
```

Replace `PORT` with the port used by the backend.

---

# 🩺 Health API

## `GET /health`

Checks whether the API server is alive and reachable.

### Authentication
None.

### Response

```json
{
  "status": "ok",
  "message": "AudioVault API is healthy 😎"
}
```

### Why it exists

- Quickly check if the backend is running.
- Useful for deployment/hosting health checks.
- Useful for monitoring.
- Useful when debugging frontend/backend connection problems.

---

# 🔐 Authentication APIs

## `POST /auth/register`

Creates a new AudioVault user.

### Authentication
Public.

### Purpose

Registers a new account.

### Main data

```text
fullName
username
email
password
```

The password is hashed with `bcrypt` before being stored.

---

## `POST /auth/login`

Logs a user into AudioVault.

### Authentication
Public.

### Purpose

- Verifies email/password.
- Updates the user's login status.
- Creates a JWT.
- JWT contains:

```json
{
  "id": "user_id",
  "email": "user@email.com",
  "role": "user"
}
```

The JWT expires after **30 days**.

### JWT helper

```js
const createToken = (id, email, role) => {
    return jwt.sign(
        { id, email, role },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
    )
}
```

---

## `POST /auth/logout`

Logs the user out.

### Authentication
Private.

### Purpose

Logs the user out and clears the authentication state/cookie.

---

## `GET /auth/profile`

Gets the currently authenticated user's profile.

### Authentication
Private.

### Purpose

Uses the user ID from the JWT to fetch the user's profile.

Password is excluded from the response.

---

## `PUT /auth/profile`

Updates the currently authenticated user's profile.

### Authentication
Private.

### Purpose

Allows the user to update:

```text
fullName
username
email
password
```

The password is hashed again when a new password is supplied.

---

# 🎧 Audio APIs

## `POST /audio`

Uploads a new audio.

### Authentication
Private.

### Middleware

```text
authMiddleware
        ↓
uploadMiddleware
        ↓
uploadAudio
```

### Files

Multer accepts two possible files:

```js
uploadMiddleware.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 }
])
```

### Files sent by frontend

```text
audioFile → audio
coverFile → optional cover
```

### Storage

Both files are uploaded to **Cloudinary**.

Audio uses:

```text
resource_type: video
```

The cover uses:

```text
resource_type: image
```

### Stored in MongoDB

```text
title
description
audioUrl
audioPublicID
coverUrl
coverPublicID
userId
```

### Placeholder cover

If no cover is provided, AudioVault uses a `placehold.co` URL based on the audio title instead of uploading an image to Cloudinary.

---

## `GET /audio`

Gets all public audios.

### Authentication
Public.

### Purpose

Used by the frontend to display the available audio library.

### MongoDB

```js
const audios = await audioModel.find()
```

---

## `GET /audio/:id`

Gets one audio by its MongoDB `_id`.

### Authentication
Public.

### Purpose

Used when the frontend needs details for one specific audio.

### MongoDB

```js
const audio = await audioModel.findById(id)
```

If no audio exists:

```text
404 Audio not found
```

---

## `PUT /audio/:id`

Updates an audio.

### Authentication
Private.

### Middleware

```text
authMiddleware
        ↓
audioMiddleware
        ↓
uploadMiddleware
        ↓
updateAudio
```

### What can be updated

```text
title
description
cover image
```

The audio file itself is intentionally **not updated**.

### Title/description behavior

If a new title is sent:

```js
audio.title = title || audio.title
```

If no new title is sent, the old title stays.

The same approach is used for the description.

### Cover replacement

If a new cover is uploaded:

1. Delete the previous Cloudinary image.
2. Upload the new cover.
3. Save the new `secure_url`.
4. Save the new `public_id`.

---

## `DELETE /audio/:id`

Deletes an audio.

### Authentication
Private.

### Middleware

```text
authMiddleware
        ↓
audioMiddleware
        ↓
deleteAudio
```

### What gets deleted

From Cloudinary:

```text
audio file → resource_type: video
cover file → resource_type: image
```

From MongoDB:

```text
audio document
```

### Important

Placeholder covers don't have a Cloudinary `public_id`, so the Cloudinary delete helper should safely ignore empty IDs.

---

## `GET /audio/my`

Gets audios uploaded by the currently authenticated user.

### Authentication
Private.

### MongoDB

```js
const audios = await audioModel.find({
    userId: req.user.id
})
```

### Purpose

Used for the user's own audio/library management page.

---

# 👑 Admin APIs

Admin APIs are protected by:

```text
authMiddleware
        ↓
isAdmin
        ↓
admin controller
```

The `isAdmin` middleware only checks the role because `authMiddleware` already verifies the JWT.

```js
const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin privileges required'
        })
    }

    next()
}
```

---

## `GET /admin/dashboard`

Gets statistics for the admin dashboard.

### Authentication

Private + Admin.

### Stats

```text
totalUsers
totalAudios
totalAdmins
```

### MongoDB

```js
const totalUsers = await userModel.countDocuments()

const totalAudios = await audioModel.countDocuments()

const totalAdmins = await userModel.countDocuments({
    role: 'admin'
})
```

### Why it exists

The admin dashboard shouldn't download every user/audio just to calculate numbers.

Instead, the backend returns a small stats object.

Example:

```json
{
  "stats": {
    "totalUsers": 100,
    "totalAudios": 250,
    "totalAdmins": 2
  }
}
```

---

## `GET /admin/users`

Gets all users.

### Authentication

Private + Admin.

### Important

Passwords must never be returned.

```js
const users = await userModel.find().select('-password')
```

---

## `PUT /admin/users/:id`

Updates a user's role.

### Authentication

Private + Admin.

### Supported roles

```text
user
admin
```

### Validation

The role should be validated before saving:

```js
if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({
        message: 'Invalid role'
    })
}
```

### Why

Without validation, invalid values could potentially be stored if the schema doesn't prevent them.

---

## `DELETE /admin/users/:id`

Deletes a user and all of their uploaded audio.

### Authentication

Private + Admin.

### Deletion flow

```text
Find user
    ↓
Find all user's audios
    ↓
Delete audio from Cloudinary
    ↓
Delete cover from Cloudinary
    ↓
Delete audio documents
    ↓
Delete user
```

### Cloudinary cleanup

For each audio:

```js
await destroyFromCloudinary(audio.audioPublicID, 'video')
await destroyFromCloudinary(audio.coverPublicID, 'image')
```

Then:

```js
await audioModel.deleteMany({ userId: id })
await user.deleteOne()
```

### Important

The Cloudinary delete helper should handle missing IDs:

```js
const destroyFromCloudinary = async (
    publicId,
    resource_type = 'image'
) => {
    if (!publicId) return

    await cloudinary.uploader.destroy(
        publicId,
        { resource_type }
    )
}
```

This is important for placeholder covers.

---

## `GET /admin/audios`

Gets all audios for the admin audio-management page.

### Authentication

Private + Admin.

### Why this exists

The normal `/audio` endpoint can be public, while the admin endpoint can later return admin-specific information or be protected separately.

The admin can use this endpoint to inspect/manage all uploaded audio.

---

## `DELETE /admin/audios/:id`

Deletes an audio as an administrator.

### Authentication

Private + Admin.

### Purpose

Allows an administrator to remove an audio without being its uploader.

The same Cloudinary cleanup logic is used:

```text
audio → Cloudinary
cover → Cloudinary
MongoDB audio document
```

---

# ☁️ Cloudinary

AudioVault uses Cloudinary for **both audio and cover images**.

## Cloudinary configuration

```js
const cloudinary = require('cloudinary').v2

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
})
```

---

## Upload helper

The upload helper uses `upload_stream()` because Multer stores uploaded files in memory as buffers.

Conceptually:

```text
Frontend
   ↓
Multer
   ↓
buffer
   ↓
Cloudinary upload_stream()
   ↓
secure_url + public_id
```

Cloudinary upload options use:

```text
folder: AudioVault
resource_type: image/video
```

---

## Delete helper

```js
const destroyFromCloudinary = async (
    publicId,
    resource_type = 'image'
) => {
    if (!publicId) return

    await cloudinary.uploader.destroy(
        publicId,
        { resource_type }
    )
}
```

The `resource_type` matters:

```text
image → cover
video → audio
```

---

# 📦 Multer: Two File Uploads

The audio upload endpoint accepts two fields:

```js
uploadMiddleware.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 }
])
```

This means:

```text
audioFile → maximum 1 file
coverFile → maximum 1 file
```

Access them with:

```js
const audioFile = req.files.audioFile[0]
const coverFile = req.files.coverFile?.[0]
```

The `?.` makes the cover optional.

---

# 🔐 Authentication Header

AudioVault originally uses a custom JWT prefix:

```text
SpiderMan <JWT>
```

Example:

```http
Authorization: SpiderMan eyJhbGciOi...
```

The important separation is:

```text
JWT itself
    ↓
normal JWT

Authorization header
    ↓
SpiderMan + JWT
```

`SpiderMan` is **not part of the JWT payload**.

The frontend adds the prefix when sending the token.

---

# 🧠 Problems & How They Were Solved

## 1. Wrong Cloudinary upload variable

### Problem

The original code attempted to upload:

```js
cloudinary.uploader.upload(file)
```

but `file` didn't exist.

### Solution

Multer gives the uploaded file as:

```js
audioFile.buffer
coverFile.buffer
```

So the upload helper receives the buffer and uses:

```js
upload_stream()
```

---

## 2. Audio needed the correct Cloudinary resource type

### Problem

Cloudinary treats normal uploads as images by default.

Audio was being uploaded without specifying its resource type.

### Solution

Audio uploads use:

```js
resource_type: 'video'
```

because Cloudinary uses the `video` resource type for audio/media files.

---

## 3. `coverFile` can be undefined

### Problem

A cover image is optional.

Directly doing:

```js
req.files.coverFile[0]
```

can crash when no cover was uploaded.

### Solution

Use:

```js
const coverFile = req.files.coverFile?.[0]
```

---

## 4. Placeholder cover isn't stored on Cloudinary

### Problem

AudioVault uses a `placehold.co` URL when the user doesn't upload a cover.

That URL doesn't have a Cloudinary `public_id`.

### Solution

Store the placeholder URL as `coverUrl` and keep:

```text
coverPublicID = null
```

Then make the Cloudinary delete helper ignore empty IDs.

---

## 5. Updating an audio accidentally included audio-file replacement

### Problem

The update endpoint originally had code for replacing the audio file.

The intended behavior was only:

```text
title
description
cover
```

### Solution

Remove audio-file replacement from `updateAudio`.

---

## 6. Updating title/description should be optional

### Problem

A PUT request shouldn't overwrite an existing value when no new value was supplied.

### Solution

Use:

```js
audio.title = title || audio.title
audio.description = description || audio.description
```

This keeps the old value when no new value is provided.

---

## 7. Old Cloudinary cover wasn't being deleted

### Problem

Uploading a new cover without deleting the old one leaves unused files in Cloudinary.

### Solution

Before uploading the new cover:

```js
await destroyFromCloudinary(
    audio.coverPublicID,
    'image'
)
```

Then upload the replacement and save its:

```text
secure_url
public_id
```

---

## 8. Wrong `destroy()` syntax

### Problem

Cloudinary's destroy function needs options such as `resource_type`.

### Correct approach

```js
await cloudinary.uploader.destroy(
    publicId,
    { resource_type }
)
```

---

## 9. `remove()` was replaced with `deleteOne()`

### Problem

Older code used:

```js
await audio.remove()
await user.remove()
```

### Solution

Use the current Mongoose method:

```js
await audio.deleteOne()
await user.deleteOne()
```

For multiple documents:

```js
await audioModel.deleteMany({ userId: id })
```

---

## 10. Deleting a user must also clean Cloudinary

### Problem

Deleting only the MongoDB user would leave the user's audio and cover files in Cloudinary.

### Solution

Before deleting the user's MongoDB records:

```text
Find user's audios
    ↓
Delete each audio from Cloudinary
    ↓
Delete each cover from Cloudinary
    ↓
Delete audio documents
    ↓
Delete user
```

---

## 11. Admin middleware initially relied on missing role data

### Problem

The JWT originally contained only:

```js
{
    id,
    email
}
```

But `isAdmin` needed:

```js
req.user.role
```

### Solution

Add `role` to the JWT:

```js
const createToken = (id, email, role) => {
    return jwt.sign(
        { id, email, role },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
    )
}
```

Then:

```js
const token = createToken(
    user._id,
    user.email,
    user.role
)
```

---

## 12. Admin middleware was doing duplicate JWT work

### Problem

The first admin middleware implementation verified the JWT itself.

But the normal `authMiddleware` already does that.

### Solution

Keep responsibilities separate:

```text
authMiddleware
    ↓
Verify JWT
    ↓
Set req.user
    ↓
isAdmin
    ↓
Check req.user.role
```

Optimized `isAdmin`:

```js
const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin privileges required'
        })
    }

    next()
}
```

---

## 13. `getAllUsers` should not expose passwords

### Problem

Using:

```js
userModel.find()
```

could return password hashes.

### Solution

```js
userModel.find().select('-password')
```

Even though the passwords are hashed, they should not be sent to the frontend.

---

## 14. `getAudioById` wasn't needed as a separate admin API

### Problem

There was already a normal:

```text
GET /audio/:id
```

Creating:

```text
GET /admin/audios/:id
```

would duplicate functionality without a specific admin requirement.

### Solution

Don't create unnecessary APIs.

Keep the admin API only when it provides admin-specific functionality.

---

## 15. Admin role validation

### Problem

An admin role update should not accept arbitrary strings.

Bad:

```json
{
    "role": "banana"
}
```

### Solution

Validate:

```js
if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({
        message: 'Invalid role'
    })
}
```

---

# 🌐 CORS

CORS belongs in `app.js` because `app.js` is responsible for configuring the Express application.

`server.js` should mainly start the server.

### Structure

```text
app.js
 ├── Express setup
 ├── CORS
 ├── body parser
 ├── routes
 └── error/middleware setup

server.js
 └── app.listen(...)
```

### Install

```bash
npm install cors
```

### Basic setup

```js
const cors = require('cors')

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))
```

### Environment variable

Local development example:

```env
FRONTEND_URL=http://localhost:5173
```

Production should use the actual frontend origin.

### Why `credentials: true`?

AudioVault uses authentication cookies, so the browser needs permission to include credentials in cross-origin requests.

Do not use:

```js
origin: '*'
```

together with credentialed authentication.

---

# 🧩 Middleware Overview

## `authMiddleware`

Responsible for:

- Reading the Authorization header/cookie.
- Extracting the JWT.
- Verifying the JWT.
- Setting:

```js
req.user
```

Example:

```text
Authorization: SpiderMan <JWT>
```

---

## `isAdmin`

Responsible only for:

```js
req.user?.role === 'admin'
```

It should be placed after `authMiddleware`.

---

## `audioMiddleware`

Used for audio authorization/ownership checks before update/delete operations.

Conceptually:

```text
User requests update/delete
        ↓
JWT verified
        ↓
Audio ownership/permission checked
        ↓
Controller runs
```

---

## `uploadMiddleware`

Multer middleware responsible for receiving uploaded files.

For audio creation/update:

```js
uploadMiddleware.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 }
])
```

---

# 🛣️ Route Overview

## Public routes

```text
POST   /auth/register
POST   /auth/login

GET    /audio
GET    /audio/:id

GET    /health
```

## Private user routes

```text
POST   /auth/logout
GET    /auth/profile
PUT    /auth/profile

POST   /audio
PUT    /audio/:id
DELETE /audio/:id

GET    /audio/my
```

## Admin routes

```text
GET    /admin/dashboard
GET    /admin/users
PUT    /admin/users/:id
DELETE /admin/users/:id

GET    /admin/audios
DELETE /admin/audios/:id
```

---

# 🏗️ Recommended Middleware Order

## Audio upload

```text
authMiddleware
      ↓
uploadMiddleware
      ↓
uploadAudio
```

## Audio update/delete

```text
authMiddleware
      ↓
audioMiddleware
      ↓
uploadMiddleware (update only)
      ↓
controller
```

## Admin API

```text
authMiddleware
      ↓
isAdmin
      ↓
admin controller
```

---

# 📊 AudioVault Backend at a Glance

```text
                    AudioVault API
                         │
        ┌────────────────┼────────────────┐
        │                │                │
       Auth            Audio            Admin
        │                │                │
     Register         Upload           Dashboard
     Login            Get All          Users
     Logout           Get One          Update Role
     Profile          Update           Delete User
     Update           Delete           Audios
                      My Audios         Delete Audio
        │                │                │
        └────────────────┼────────────────┘
                         │
                  Authentication
                         │
                       JWT
                         │
                  SpiderMan prefix
                         │
                 ┌───────┴───────┐
                 │               │
              MongoDB         Cloudinary
                               │
                         Audio + Images
```

---

# 🚀 Development Lessons

The biggest lessons from building these APIs:

1. **Don't create an API just because it sounds useful.** Create it when the frontend/business logic needs it.
2. Keep authentication and authorization separate.
3. Never return passwords from user APIs.
4. Save Cloudinary `public_id` values when uploading files so they can be deleted later.
5. When deleting database records that reference external files, clean the external files too.
6. Use `deleteOne()` / `deleteMany()` instead of old `remove()` usage.
7. Validate role values before saving them.
8. Keep `app.js` for Express configuration and `server.js` for starting the server.
9. Keep health checks lightweight.
10. Keep CORS restricted to trusted frontend origins in production.

---

# 🎧 AudioVault API Status

The core backend API set is complete:

```text
✅ Authentication APIs
✅ Profile APIs
✅ Audio upload
✅ Audio retrieval
✅ Audio update
✅ Audio deletion
✅ User audio listing
✅ Admin dashboard stats
✅ Admin user management
✅ Admin audio management
✅ Cloudinary upload
✅ Cloudinary deletion
✅ Multer multi-file upload
✅ JWT authentication
✅ Admin authorization
✅ Health API
🔄 CORS configuration
```

> **AudioVault backend: cooked. 🕷️🎧🔥**
