# RenewLoop Admin (User Management + Push Notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a RenewLoop tile to the `myadmin` dashboard with two admin capabilities backed by the sbmint Express/MongoDB backend: user management (list/search/view/delete end users) and push notifications (broadcast + single-user send).

**Architecture:** sbmint backend gains a minimal `isAdmin` flag on its existing `User` model, a `requireAdmin` route guard, and a new `/admin/*` module (users + push) that reuses existing models/services (subscription counts, `sendPushNotification`). The `myadmin` Angular shell adds a `service-credential` app tile (same pattern as Verdiq): it silently logs into sbmint as a seeded admin account, attaches that token via a URL-scoped interceptor, and renders two pages (Users, Notifications) inside the shared `AppShellComponent`.

**Tech Stack:** Backend — Node/Express, MongoDB driver, Zod, Jest (existing stack, no new deps). Frontend — Angular (standalone components, signals), existing Tailwind utility classes (as used in `admin-push.component.html`).

**Spec:** `docs/superpowers/specs/2026-08-16-renewloop-admin-design.md` (this repo)

## Global Constraints

- Backend: follow existing module layout (`routes.js` / `controller.js` / `service.js` / `validation.js` per module), existing error convention (`class XError extends Error { constructor(message, statusCode) }`, caught by the shared `errorMiddleware`, which returns `{ errors: [message] }` — **no error-code fields**, message text is the only signal the frontend gets).
- Backend: `/auth/login` stays generic — it must not reject non-admin credentials. Every `/admin/*` route is individually guarded by `requireAuth` + `requireAdmin`.
- Backend tests: TDD via Jest, `npm test` (already configured as `jest --runInBand`). Model tests hit the real test DB (`env.mongodbUriTest`) per the existing `user.model.test.js` convention; service tests mock the model layer (`jest.mock(...)`) per the existing `subscription.service.test.js` convention.
- Frontend: no new unit tests (Karma/Jasmine are intentionally not used in this project). Implement each piece, then do one manual end-to-end verification pass in the browser at the end of the plan.
- Frontend: RenewLoop end users are never promoted to admin through this UI — no toggle-admin control (unlike Verdiq's Users page).
- Out of scope (do not build): admin-user management UI, scheduled/cron push campaigns, multi-device-per-user push tracking.

---

## Task 1: sbmint — `isAdmin` on the User model + admin listing/search helpers

**Files:**
- Modify: `backend/src/models/user.model.js`
- Modify: `backend/src/models/user.model.test.js`

**Interfaces:**
- Produces: `userModel.createUser({name,email,passwordHash})` now returns a doc with `isAdmin: false`; `userModel.setUserIsAdmin(userId, isAdmin)`; `userModel.searchUsersPage({search, skip, limit})`; `userModel.countUsers({search})`; `userModel.findUsersWithDeviceToken()`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/models/user.model.test.js` (inside the existing `describe('user model', ...)` block, after the last existing test):

```javascript
  test('createUser defaults isAdmin to false', async () => {
    const user = await userModel.createUser({ name: 'Ada', email: 'ada@example.com', passwordHash: 'hashed' });
    expect(user.isAdmin).toBe(false);
  });

  test('setUserIsAdmin flips the flag', async () => {
    const user = await userModel.createUser({ name: 'Ada', email: 'ada@example.com', passwordHash: 'hashed' });
    await userModel.setUserIsAdmin(user._id, true);
    const found = await userModel.findUserById(user._id);
    expect(found.isAdmin).toBe(true);
  });

  describe('searchUsersPage / countUsers', () => {
    beforeEach(async () => {
      await userModel.createUser({ name: 'Ada Lovelace', email: 'ada@example.com', passwordHash: 'h' });
      await userModel.createUser({ name: 'Grace Hopper', email: 'grace@example.com', passwordHash: 'h' });
      await userModel.createUser({ name: 'Katherine Johnson', email: 'katherine@example.com', passwordHash: 'h' });
    });

    test('with no search, returns all users newest first, respecting skip/limit', async () => {
      const page = await userModel.searchUsersPage({ search: undefined, skip: 0, limit: 2 });
      expect(page).toHaveLength(2);
      expect(page[0].email).toBe('katherine@example.com');
      const total = await userModel.countUsers({ search: undefined });
      expect(total).toBe(3);
    });

    test('search matches name or email, case-insensitively', async () => {
      const byName = await userModel.searchUsersPage({ search: 'grace', skip: 0, limit: 20 });
      expect(byName.map((u) => u.email)).toEqual(['grace@example.com']);

      const byEmail = await userModel.searchUsersPage({ search: 'KATHERINE@', skip: 0, limit: 20 });
      expect(byEmail.map((u) => u.email)).toEqual(['katherine@example.com']);

      const count = await userModel.countUsers({ search: 'grace' });
      expect(count).toBe(1);
    });
  });

  describe('findUsersWithDeviceToken', () => {
    test('returns only users with a non-null deviceToken', async () => {
      const withToken = await userModel.createUser({ name: 'Ada', email: 'ada@example.com', passwordHash: 'h' });
      await userModel.setDeviceToken(withToken._id, 'fcm-token-1');
      await userModel.createUser({ name: 'Grace', email: 'grace@example.com', passwordHash: 'h' });

      const rows = await userModel.findUsersWithDeviceToken();
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('ada@example.com');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/models/user.model.test.js -t "isAdmin|searchUsersPage|findUsersWithDeviceToken"`
Expected: FAIL — `userModel.setUserIsAdmin is not a function` (and similar for the other new functions).

- [ ] **Step 3: Implement**

In `backend/src/models/user.model.js`, add `isAdmin: false` to the doc built in `createUser` (right after `remindersEnabled: true,`):

```javascript
    remindersEnabled: true,
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
```

Add these functions (near `setDeviceToken`, before `module.exports`):

```javascript
async function setUserIsAdmin(userId, isAdmin) {
  await usersCollection().updateOne({ _id: userId }, { $set: { isAdmin, updatedAt: new Date() } });
}

function buildSearchFilter(search) {
  if (!search) return {};
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');
  return { $or: [{ name: pattern }, { email: pattern }] };
}

async function searchUsersPage({ search, skip, limit }) {
  return usersCollection()
    .find(buildSearchFilter(search))
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

async function countUsers({ search }) {
  return usersCollection().countDocuments(buildSearchFilter(search));
}

async function findUsersWithDeviceToken() {
  return usersCollection().find({ deviceToken: { $ne: null } }).toArray();
}
```

Update `module.exports` to include the four new functions:

```javascript
module.exports = {
  ensureUserIndexes,
  createUser,
  findUserByEmail,
  findUserById,
  setResetToken,
  findUserByResetTokenHash,
  updatePasswordAndClearReset,
  setDeviceToken,
  updateProfile,
  updatePreferences,
  deleteUser,
  setUserIsAdmin,
  searchUsersPage,
  countUsers,
  findUsersWithDeviceToken,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/models/user.model.test.js`
Expected: PASS (all tests in the file, including pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/user.model.js backend/src/models/user.model.test.js
git commit -m "feat(backend): add isAdmin flag and admin search/listing helpers to User model"
```

---

## Task 2: sbmint — `requireAdmin` middleware

**Files:**
- Modify: `backend/src/middleware/auth.middleware.js`
- Modify: `backend/src/middleware/auth.middleware.test.js`

**Interfaces:**
- Consumes: `userModel.findUserById(objectId)` from Task 1 (returns a doc with `isAdmin`).
- Produces: `requireAdmin(req, res, next)` — Express middleware, expects `req.userId` to already be set (i.e. must run after `requireAuth`). On success calls `next()`; on failure responds `403 { errors: ['Admin access required.'] }` and does not call `next()`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/middleware/auth.middleware.test.js`:

```javascript
const { requireAuth, requireAdmin } = require('./auth.middleware');
const { signToken } = require('../utils/jwt');
const userModel = require('../models/user.model');

jest.mock('../models/user.model');

// ...(keep the existing requireAuth describe block as-is)...

describe('requireAdmin', () => {
  afterEach(() => jest.clearAllMocks());

  test('responds 403 when req.userId has no matching user', async () => {
    userModel.findUserById.mockResolvedValue(null);
    const req = { userId: '507f1f77bcf86cd799439011' };
    const res = mockRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('responds 403 when the user is not an admin', async () => {
    userModel.findUserById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', isAdmin: false });
    const req = { userId: '507f1f77bcf86cd799439011' };
    const res = mockRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next for an admin user', async () => {
    userModel.findUserById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', isAdmin: true });
    const req = { userId: '507f1f77bcf86cd799439011' };
    const res = mockRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('responds 403 when req.userId is not a valid ObjectId', async () => {
    const req = { userId: 'not-an-id' };
    const res = mockRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(userModel.findUserById).not.toHaveBeenCalled();
  });
});
```

Note: this adds `jest.mock('../models/user.model')` at the top of the file, which also affects the existing `requireAuth` tests above it — that's fine, `requireAuth` never touches `userModel`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/middleware/auth.middleware.test.js -t requireAdmin`
Expected: FAIL — `requireAdmin is not a function`.

- [ ] **Step 3: Implement**

Replace the full contents of `backend/src/middleware/auth.middleware.js`:

```javascript
const { ObjectId } = require('mongodb');
const { verifyToken } = require('../utils/jwt');
const userModel = require('../models/user.model');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ errors: ['Authentication required.'] });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ errors: ['Invalid or expired token.'] });
  }
}

async function requireAdmin(req, res, next) {
  if (!ObjectId.isValid(req.userId)) {
    return res.status(403).json({ errors: ['Admin access required.'] });
  }
  const user = await userModel.findUserById(new ObjectId(req.userId));
  if (!user || user.isAdmin !== true) {
    return res.status(403).json({ errors: ['Admin access required.'] });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/middleware/auth.middleware.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.middleware.js backend/src/middleware/auth.middleware.test.js
git commit -m "feat(backend): add requireAdmin middleware"
```

---

## Task 3: sbmint — `isAdmin` claim on login/register + `/auth/me`

**Files:**
- Modify: `backend/src/modules/auth/auth.service.js`
- Modify: `backend/src/modules/auth/auth.service.test.js`

**Interfaces:**
- Consumes: `userModel.createUser`/`findUserByEmail` now return `isAdmin` (Task 1).
- Produces: `authService.toPublicUser(user)` now includes `isAdmin`; the JWT payload signed in `register`/`login` now includes `isAdmin`.

- [ ] **Step 1: Write the failing tests**

The existing file mocks `../../models/user.model`, `../../models/subscription.model`,
`../../models/notification.model`, and `../../utils/email` — but **not**
`../../utils/jwt` or `../../utils/password`, so `signToken`/`hashPassword`/
`comparePassword` run for real. Match that: verify the claim by decoding the
real returned token with `verifyToken`, not by mocking `signToken`.

Add to `backend/src/modules/auth/auth.service.test.js`, inside the existing
`describe('login', ...)` block (after the `'returns user and token on success'`
test):

```javascript
    test('signs a token whose payload includes isAdmin', async () => {
      const { hashPassword } = require('../../utils/password');
      const { verifyToken } = require('../../utils/jwt');
      const passwordHash = await hashPassword('correct-password');
      userModel.findUserByEmail.mockResolvedValue({
        _id: new ObjectId(),
        name: 'Ada',
        email: 'ada@example.com',
        passwordHash,
        isAdmin: true,
        createdAt: new Date(),
      });

      const result = await authService.login({ email: 'ada@example.com', password: 'correct-password' });

      expect(verifyToken(result.token)).toMatchObject({ isAdmin: true });
    });
```

Add a new top-level `describe`, after the `describe('login', ...)` block closes:

```javascript
  describe('toPublicUser', () => {
    test('includes isAdmin, defaulting to false when absent', () => {
      const withFlag = authService.toPublicUser({
        _id: new ObjectId(),
        email: 'a@b.com',
        isAdmin: true,
        createdAt: new Date(),
      });
      expect(withFlag.isAdmin).toBe(true);

      const withoutFlag = authService.toPublicUser({
        _id: new ObjectId(),
        email: 'a@b.com',
        createdAt: new Date(),
      });
      expect(withoutFlag.isAdmin).toBe(false);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/modules/auth/auth.service.test.js -t "isAdmin"`
Expected: FAIL — `signToken` payload lacks `isAdmin`, and `toPublicUser` result lacks `isAdmin`.

- [ ] **Step 3: Implement**

In `backend/src/modules/auth/auth.service.js`, update `toPublicUser`:

```javascript
function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin === true,
    // Fallback defaults cover accounts created before these preference
    // fields existed on the User model.
    defaultReminderDays: user.defaultReminderDays ?? 3,
    defaultCurrency: user.defaultCurrency ?? 'INR',
    remindersEnabled: user.remindersEnabled ?? true,
    createdAt: user.createdAt,
  };
}
```

Update the two `signToken` call sites (`register` and `login`):

```javascript
  const token = signToken({ sub: user._id.toString(), isAdmin: user.isAdmin === true });
```

(There are two occurrences of `const token = signToken({ sub: user._id.toString() });` — replace both.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/modules/auth/auth.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/auth/auth.service.js backend/src/modules/auth/auth.service.test.js
git commit -m "feat(backend): include isAdmin in JWT claims and the public user shape"
```

---

## Task 4: sbmint — FCM credential-status check + stale-token error helper

**Files:**
- Modify: `backend/src/utils/fcm.js`
- Modify: `backend/src/utils/fcm.test.js`

**Interfaces:**
- Produces: `fcm.isConfigured()` → `boolean`; `fcm.isStaleTokenError(err)` → `boolean` (checks `err.code` against the two FCM "dead token" codes).

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/utils/fcm.test.js`:

```javascript
const { sendPushNotification, isConfigured, isStaleTokenError } = require('./fcm');

describe('fcm.isConfigured', () => {
  test('returns false when FCM is not configured', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isConfigured()).toBe(false);
  });
});

describe('fcm.isStaleTokenError', () => {
  test('recognizes the two FCM dead-token error codes', () => {
    expect(isStaleTokenError({ code: 'messaging/registration-token-not-registered' })).toBe(true);
    expect(isStaleTokenError({ code: 'messaging/invalid-registration-token' })).toBe(true);
  });

  test('returns false for other errors', () => {
    expect(isStaleTokenError({ code: 'messaging/internal-error' })).toBe(false);
    expect(isStaleTokenError(new Error('boom'))).toBe(false);
    expect(isStaleTokenError(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/utils/fcm.test.js -t "isConfigured|isStaleTokenError"`
Expected: FAIL — both are not exported/not functions.

- [ ] **Step 3: Implement**

In `backend/src/utils/fcm.js`, add after `getFirebaseApp`:

```javascript
function isConfigured() {
  return getFirebaseApp() !== null;
}

function isStaleTokenError(err) {
  const code = err && err.code;
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}
```

Update `module.exports`:

```javascript
module.exports = { sendPushNotification, isConfigured, isStaleTokenError };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/utils/fcm.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/fcm.js backend/src/utils/fcm.test.js
git commit -m "feat(backend): add fcm.isConfigured and fcm.isStaleTokenError helpers"
```

---

## Task 5: sbmint — `/admin/users` (list, detail, delete)

**Files:**
- Create: `backend/src/modules/admin/admin.validation.js`
- Create: `backend/src/modules/admin/admin.service.js`
- Create: `backend/src/modules/admin/admin.service.test.js`
- Create: `backend/src/modules/admin/admin.controller.js`
- Create: `backend/src/modules/admin/admin.routes.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `userModel.searchUsersPage`, `userModel.countUsers`, `userModel.findUserById`, `userModel.deleteUser` (Task 1); `subscriptionModel.countSubscriptionsByUserId` (existing); `notificationModel.deleteNotificationsByUserId` (existing); `subscriptionModel.deleteSubscriptionsByUserId` (existing); `buildPaginationMeta` from `utils/pagination.js` (existing).
- Produces: `adminService.AdminError`, `adminService.listUsers({search,page,limit})`, `adminService.getUser(id)`, `adminService.deleteUser(requestingUserId, id)`. These are also consumed by Task 6 (push routes live in the same service file).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/admin/admin.service.test.js`:

```javascript
jest.mock('../../models/user.model');
jest.mock('../../models/subscription.model');
jest.mock('../../models/notification.model');

const { ObjectId } = require('mongodb');
const userModel = require('../../models/user.model');
const subscriptionModel = require('../../models/subscription.model');
const notificationModel = require('../../models/notification.model');
const adminService = require('./admin.service');

function sampleUser(overrides = {}) {
  return {
    _id: new ObjectId(),
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    deviceToken: null,
    remindersEnabled: true,
    defaultReminderDays: 3,
    defaultCurrency: 'INR',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('admin.service', () => {
  afterEach(() => jest.clearAllMocks());

  describe('listUsers', () => {
    test('paginates and enriches each row with subscriptionsCount', async () => {
      const user = sampleUser();
      userModel.searchUsersPage.mockResolvedValue([user]);
      userModel.countUsers.mockResolvedValue(1);
      subscriptionModel.countSubscriptionsByUserId.mockResolvedValue(4);

      const result = await adminService.listUsers({ search: undefined, page: 1, limit: 20 });

      expect(userModel.searchUsersPage).toHaveBeenCalledWith({ search: undefined, skip: 0, limit: 20 });
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toMatchObject({
        id: user._id,
        email: 'ada@example.com',
        subscriptionsCount: 4,
        hasDeviceToken: false,
      });
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe('getUser', () => {
    test('throws AdminError 404 for a malformed id (no DB call)', async () => {
      await expect(adminService.getUser('not-an-id')).rejects.toMatchObject({ statusCode: 404 });
      expect(userModel.findUserById).not.toHaveBeenCalled();
    });

    test('throws AdminError 404 when the user does not exist', async () => {
      userModel.findUserById.mockResolvedValue(null);
      await expect(adminService.getUser(new ObjectId().toString())).rejects.toMatchObject({ statusCode: 404 });
    });

    test('returns the enriched detail when found', async () => {
      const user = sampleUser({ deviceToken: 'tok' });
      userModel.findUserById.mockResolvedValue(user);
      subscriptionModel.countSubscriptionsByUserId.mockResolvedValue(2);

      const result = await adminService.getUser(user._id.toString());

      expect(result).toMatchObject({ id: user._id, subscriptionsCount: 2, hasDeviceToken: true });
    });
  });

  describe('deleteUser', () => {
    test('throws AdminError 400 when deleting your own account', async () => {
      const id = new ObjectId().toString();
      await expect(adminService.deleteUser(id, id)).rejects.toMatchObject({ statusCode: 400 });
      expect(userModel.findUserById).not.toHaveBeenCalled();
    });

    test('throws AdminError 404 when the target does not exist', async () => {
      userModel.findUserById.mockResolvedValue(null);
      await expect(
        adminService.deleteUser(new ObjectId().toString(), new ObjectId().toString())
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cascades subscriptions, notifications, then the user', async () => {
      const target = sampleUser();
      userModel.findUserById.mockResolvedValue(target);

      await adminService.deleteUser(new ObjectId().toString(), target._id.toString());

      expect(subscriptionModel.deleteSubscriptionsByUserId).toHaveBeenCalledWith(target._id);
      expect(notificationModel.deleteNotificationsByUserId).toHaveBeenCalledWith(target._id);
      expect(userModel.deleteUser).toHaveBeenCalledWith(target._id);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/modules/admin/admin.service.test.js`
Expected: FAIL — `Cannot find module './admin.service'`.

- [ ] **Step 3: Implement**

Create `backend/src/modules/admin/admin.validation.js`:

```javascript
const { z } = require('zod');

const usersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const pushBodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  body: z.string().trim().min(1, 'Body is required.'),
});

module.exports = { usersQuerySchema, pushBodySchema };
```

Create `backend/src/modules/admin/admin.service.js`:

```javascript
const { ObjectId } = require('mongodb');
const userModel = require('../../models/user.model');
const subscriptionModel = require('../../models/subscription.model');
const notificationModel = require('../../models/notification.model');
const { sendPushNotification, isConfigured, isStaleTokenError } = require('../../utils/fcm');
const { buildPaginationMeta } = require('../../utils/pagination');

class AdminError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

async function toUserRow(doc) {
  const subscriptionsCount = await subscriptionModel.countSubscriptionsByUserId(doc._id);
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    createdAt: doc.createdAt,
    subscriptionsCount,
    hasDeviceToken: !!doc.deviceToken,
    remindersEnabled: doc.remindersEnabled ?? true,
  };
}

async function listUsers({ search, page, limit }) {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    userModel.searchUsersPage({ search, skip, limit }),
    userModel.countUsers({ search }),
  ]);
  const users = await Promise.all(docs.map(toUserRow));
  return { users, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getUser(id) {
  const objectId = toObjectId(id);
  if (!objectId) {
    throw new AdminError('User not found.', 404);
  }
  const user = await userModel.findUserById(objectId);
  if (!user) {
    throw new AdminError('User not found.', 404);
  }
  const subscriptionsCount = await subscriptionModel.countSubscriptionsByUserId(objectId);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    subscriptionsCount,
    hasDeviceToken: !!user.deviceToken,
    remindersEnabled: user.remindersEnabled ?? true,
    defaultReminderDays: user.defaultReminderDays ?? 3,
    defaultCurrency: user.defaultCurrency ?? 'INR',
  };
}

async function deleteUser(requestingUserId, id) {
  if (id === requestingUserId) {
    throw new AdminError('Ask another admin to remove your account.', 400);
  }
  const objectId = toObjectId(id);
  if (!objectId) {
    throw new AdminError('User not found.', 404);
  }
  const user = await userModel.findUserById(objectId);
  if (!user) {
    throw new AdminError('User not found.', 404);
  }
  await subscriptionModel.deleteSubscriptionsByUserId(objectId);
  await notificationModel.deleteNotificationsByUserId(objectId);
  await userModel.deleteUser(objectId);
}

async function getCredentialStatus() {
  return { configured: isConfigured() };
}

async function broadcastPush({ title, body }) {
  const users = await userModel.findUsersWithDeviceToken();
  let sent = 0;
  let failed = 0;
  let staleRemoved = 0;
  for (const user of users) {
    try {
      await sendPushNotification(user.deviceToken, { title, body });
      sent += 1;
    } catch (err) {
      if (isStaleTokenError(err)) {
        await userModel.setDeviceToken(user._id, null);
        staleRemoved += 1;
      } else {
        failed += 1;
      }
    }
  }
  return { sent, failed, staleRemoved, total: users.length };
}

async function sendPushToUser(id, { title, body }) {
  const objectId = toObjectId(id);
  if (!objectId) {
    throw new AdminError('User not found.', 404);
  }
  const user = await userModel.findUserById(objectId);
  if (!user) {
    throw new AdminError('User not found.', 404);
  }
  if (!user.deviceToken) {
    throw new AdminError('This user has no registered device.', 400);
  }
  try {
    await sendPushNotification(user.deviceToken, { title, body });
    return { sent: true };
  } catch (err) {
    if (isStaleTokenError(err)) {
      await userModel.setDeviceToken(objectId, null);
      throw new AdminError('This device is no longer registered; the stale token was removed.', 400);
    }
    throw new AdminError('Failed to send the notification.', 502);
  }
}

module.exports = {
  AdminError,
  listUsers,
  getUser,
  deleteUser,
  getCredentialStatus,
  broadcastPush,
  sendPushToUser,
};
```

Create `backend/src/modules/admin/admin.controller.js`:

```javascript
const adminService = require('./admin.service');

async function listUsers(req, res, next) {
  try {
    const { users, pagination } = await adminService.listUsers(req.validatedQuery);
    res.status(200).json({ users, pagination });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await adminService.getUser(req.params.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    await adminService.deleteUser(req.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function credentialStatus(req, res, next) {
  try {
    const status = await adminService.getCredentialStatus();
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

async function broadcastPush(req, res, next) {
  try {
    const result = await adminService.broadcastPush(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function sendPushToUser(req, res, next) {
  try {
    const result = await adminService.sendPushToUser(req.params.id, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, deleteUser, credentialStatus, broadcastPush, sendPushToUser };
```

Create `backend/src/modules/admin/admin.routes.js`:

```javascript
const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validation.middleware');
const { usersQuerySchema, pushBodySchema } = require('./admin.validation');
const controller = require('./admin.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/users', validateQuery(usersQuerySchema), controller.listUsers);
router.get('/users/:id', controller.getUser);
router.delete('/users/:id', controller.deleteUser);
router.get('/push/credential-status', controller.credentialStatus);
router.post('/push/broadcast', validateBody(pushBodySchema), controller.broadcastPush);
router.post('/push/users/:id', validateBody(pushBodySchema), controller.sendPushToUser);

module.exports = router;
```

In `backend/src/app.js`, add the require near the other route requires:

```javascript
const adminRoutes = require('./modules/admin/admin.routes');
```

And mount it after the existing routes (right after `app.use('/analytics', analyticsRoutes);`):

```javascript
  app.use('/analytics', analyticsRoutes);
  app.use('/admin', adminRoutes);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/modules/admin/admin.service.test.js`
Expected: PASS.

Then run the full suite to confirm nothing else broke: `cd backend && npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/admin backend/src/app.js
git commit -m "feat(backend): add /admin routes for user management and push notifications"
```

---

## Task 6: sbmint — seed-admin script + env docs

**Files:**
- Create: `backend/scripts/seed-admin.js`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `userModel.findUserByEmail`, `userModel.createUser`, `userModel.setUserIsAdmin`, `userModel.updatePasswordAndClearReset` (Task 1, existing), `hashPassword` (existing `utils/password.js`), `connectDb`/`closeDb` (existing `config/database.js`).

This is a one-off operational script, not exercised by the automated test suite (matching the existing `scripts/send-test-push.js`, which also has no test file) — verified manually per Step 3 below instead of via Jest.

- [ ] **Step 1: Implement**

Create `backend/scripts/seed-admin.js`:

```javascript
// One-off manual bootstrap: creates (or promotes) a single admin account so
// the myadmin dashboard's RenewLoop tile has a service-credential account to
// silently log in as. Safe to re-run — updates the password/isAdmin flag on
// an existing account with the same email instead of erroring.
//
// Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=long-random-string node scripts/seed-admin.js
require('dotenv').config();
const { connectDb, closeDb } = require('../src/config/database');
const env = require('../src/config/env');
const userModel = require('../src/models/user.model');
const { hashPassword } = require('../src/utils/password');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.js');
    process.exit(1);
  }

  await connectDb(env.mongodbUri);
  await userModel.ensureUserIndexes();

  const passwordHash = await hashPassword(password);
  const existing = await userModel.findUserByEmail(email);
  if (existing) {
    await userModel.updatePasswordAndClearReset(existing._id, passwordHash);
    await userModel.setUserIsAdmin(existing._id, true);
    console.log(`Updated existing account "${email}" to admin and reset its password.`);
  } else {
    const user = await userModel.createUser({ name: 'Admin', email, passwordHash });
    await userModel.setUserIsAdmin(user._id, true);
    console.log(`Created admin account "${email}".`);
  }

  await closeDb();
}

main().catch((err) => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});
```

Add an `npm` script in `backend/package.json`'s `"scripts"` block, alongside `send-test-push`:

```json
    "seed-admin": "node scripts/seed-admin.js",
```

Add documentation lines to `backend/.env.example` (append at the end, after `FIREBASE_SERVICE_ACCOUNT_PATH=`):

```
# Used only by `npm run seed-admin` (backend/scripts/seed-admin.js) — not
# read by the running server. Set these as one-off shell env vars when you
# run that script, not as permanent values here.
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

- [ ] **Step 2: Verify manually**

Run against your local dev DB: `cd backend && ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=some-long-password node scripts/seed-admin.js`
Expected output: `Created admin account "admin@example.com".` — then confirm via `POST /auth/login` with those credentials that the returned JWT decodes (e.g. paste into jwt.io) to include `"isAdmin": true`.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/seed-admin.js backend/package.json backend/.env.example
git commit -m "feat(backend): add seed-admin script for bootstrapping the dashboard service account"
```

---

## Task 7: myadmin — RenewLoop tile, environment config, and core services

**Files:**
- Modify: `myadmin/src/app/core/models/app-registry.model.ts`
- Modify: `myadmin/src/environments/environment.ts`
- Create: `myadmin/src/app/core/services/renewloop/storage.ts`
- Create: `myadmin/src/app/core/services/renewloop/renewloop-auth.ts`
- Create: `myadmin/src/app/core/models/renewloop/user.model.ts`
- Create: `myadmin/src/app/core/services/renewloop/admin-api.ts`

**Interfaces:**
- Consumes (from sbmint, Task 5): `POST /auth/login` → `{ user: {id,name,email,isAdmin,...}, token }`; `GET /admin/users?search=&page=&limit=` → `{ users: UserRow[], pagination }`; `GET /admin/users/:id` → `{ user: UserDetail }`; `DELETE /admin/users/:id` → `204`; `GET /admin/push/credential-status` → `{ configured }`; `POST /admin/push/broadcast` → `{ sent, failed, staleRemoved, total }`; `POST /admin/push/users/:id` → `{ sent: true }`.
- Produces: `RenewloopAuthService` (`login`, `logout`, `getToken`, `isTokenExpired`, `user`, `isAuthenticated`); `RenewloopAdminApi` (`getUsers`, `getUser`, `deleteUser`, `getCredentialStatus`, `broadcastPush`, `sendPushToUser`) — consumed by Task 8's guard/interceptor and Task 9's pages.

- [ ] **Step 1: Add the app-registry tile**

In `myadmin/src/app/core/models/app-registry.model.ts`, add a fourth entry to `APP_REGISTRY` (after the `verdiq` entry):

```typescript
  {
    id: 'renewloop',
    name: 'RenewLoop',
    icon: '💰',
    accentColor: 'var(--color-primary)',
    route: '/apps/renewloop/users',
    tagline: 'Subscription renewals: user accounts and push notifications.',
    authMode: 'service-credential',
  },
```

- [ ] **Step 2: Add environment config**

In `myadmin/src/environments/environment.ts`, add a `renewloop` block alongside `verdiq`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://backend-usqv.onrender.com/api',
  siteUrl: 'https://vamaha.tech',
  verdiq: {
    apiBaseUrl: 'https://know-ingredients-backend.onrender.com',
    // Fill in a real verdiq-backend admin account before running locally —
    // never commit real values here.
  serviceEmail: 'REPLACE_WITH_SERVICE_ACCOUNT_EMAIL',
    servicePassword: 'REPLACE_WITH_SERVICE_ACCOUNT_PASSWORD',
  },
  renewloop: {
    apiBaseUrl: 'http://127.0.0.1:3300',
    // Created via `npm run seed-admin` in the sbmint backend. Fill in a real
    // account before running locally — never commit real values here.
    serviceEmail: 'REPLACE_WITH_SERVICE_ACCOUNT_EMAIL',
    servicePassword: 'REPLACE_WITH_SERVICE_ACCOUNT_PASSWORD',
  },
};
```

(Keep the existing `verdiq` block's odd indentation on `serviceEmail` untouched — that's pre-existing, not something to fix here.)

- [ ] **Step 3: Create the RenewLoop model file**

Create `myadmin/src/app/core/models/renewloop/user.model.ts`:

```typescript
// RenewLoop end users — shapes for sbmint's /admin/users and /admin/push routes.

export interface UserRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscriptionsCount: number;
  hasDeviceToken: boolean;
  remindersEnabled: boolean;
}

export interface UserDetail extends UserRow {
  defaultReminderDays: number;
  defaultCurrency: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsersPage {
  users: UserRow[];
  pagination: Pagination;
}

export interface CredentialStatus {
  configured: boolean;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  staleRemoved: number;
  total: number;
}

export interface AdminUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: { id: string; name: string; email: string; isAdmin: boolean };
  token: string;
}
```

- [ ] **Step 4: Create the storage service**

Create `myadmin/src/app/core/services/renewloop/storage.ts`:

```typescript
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const TOKEN_KEY = 'renewloop_admin_token';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(TOKEN_KEY);
  }
}
```

- [ ] **Step 5: Create the auth service**

Create `myadmin/src/app/core/services/renewloop/renewloop-auth.ts`:

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { StorageService } from './storage';
import { AdminUser, Credentials, LoginResponse } from '../../models/renewloop/user.model';

// Decodes the payload of a JWT without verifying it (verification is the
// server's job). We only read it to know isAdmin/email for the UI + guards.
function decodeJwt(token: string): { sub: string; email: string; isAdmin?: boolean } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// sbmint's /auth/login returns a plain { user, token } body — unlike
// vamaha-backend/verdiq's { success, data } envelope — so this service
// reads the response directly with no unwrapping step.
@Injectable({ providedIn: 'root' })
export class RenewloopAuthService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);
  private base = environment.renewloop.apiBaseUrl;

  private readonly userSig = signal<AdminUser | null>(this.userFromStoredToken());
  readonly user = this.userSig.asReadonly();
  readonly isAuthenticated = computed(() => this.userSig() !== null);

  login(creds: Credentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, creds).pipe(
      tap((res) => {
        this.storage.setToken(res.token);
        const claims = decodeJwt(res.token);
        this.userSig.set({
          id: res.user.id,
          email: res.user.email,
          isAdmin: claims?.isAdmin ?? res.user.isAdmin,
        });
      }),
    );
  }

  logout(): void {
    this.storage.clearToken();
    this.userSig.set(null);
  }

  getToken(): string | null {
    return this.storage.getToken();
  }

  isTokenExpired(): boolean {
    const token = this.storage.getToken();
    if (!token) return true;
    const claims = decodeJwt(token) as { exp?: number } | null;
    if (!claims || typeof claims.exp !== 'number') return true;
    return claims.exp * 1000 <= Date.now();
  }

  private userFromStoredToken(): AdminUser | null {
    const token = this.storage.getToken();
    if (!token) return null;
    const claims = decodeJwt(token);
    if (!claims) return null;
    return { id: claims.sub, email: claims.email, isAdmin: claims.isAdmin ?? false };
  }
}
```

- [ ] **Step 6: Create the admin API client**

Create `myadmin/src/app/core/services/renewloop/admin-api.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  BroadcastResult,
  CredentialStatus,
  UserDetail,
  UsersPage,
} from '../../models/renewloop/user.model';

// Typed client for sbmint's /admin/* routes. No component talks to
// HttpClient directly for RenewLoop data.
@Injectable({ providedIn: 'root' })
export class RenewloopAdminApi {
  private http = inject(HttpClient);
  private base = environment.renewloop.apiBaseUrl;

  getUsers(search: string, page = 1, limit = 20): Observable<UsersPage> {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (search) params = params.set('search', search);
    return this.http.get<UsersPage>(`${this.base}/admin/users`, { params });
  }

  getUser(id: string): Observable<{ user: UserDetail }> {
    return this.http.get<{ user: UserDetail }>(`${this.base}/admin/users/${id}`);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/users/${id}`);
  }

  getCredentialStatus(): Observable<CredentialStatus> {
    return this.http.get<CredentialStatus>(`${this.base}/admin/push/credential-status`);
  }

  broadcastPush(title: string, body: string): Observable<BroadcastResult> {
    return this.http.post<BroadcastResult>(`${this.base}/admin/push/broadcast`, { title, body });
  }

  sendPushToUser(id: string, title: string, body: string): Observable<{ sent: true }> {
    return this.http.post<{ sent: true }>(`${this.base}/admin/push/users/${id}`, { title, body });
  }
}
```

- [ ] **Step 7: Verify it compiles**

Run: `cd myadmin && npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing the files created/modified in this task. (Pre-existing unrelated errors, if any, are not this task's concern.)

- [ ] **Step 8: Commit**

```bash
git add src/app/core/models/app-registry.model.ts src/environments/environment.ts \
  src/app/core/services/renewloop src/app/core/models/renewloop
git commit -m "feat(admin): add RenewLoop tile, environment config, and core auth/API services"
```

---

## Task 8: myadmin — session wiring (guard, interceptor, AppSessionService)

**Files:**
- Modify: `myadmin/src/app/core/services/app-session.service.ts`
- Create: `myadmin/src/app/core/guards/renewloop-session.guard.ts`
- Create: `myadmin/src/app/core/interceptors/renewloop-auth.interceptor.ts`
- Modify: `myadmin/src/app/app.config.ts`

**Interfaces:**
- Consumes: `RenewloopAuthService` (Task 7); `environment.renewloop.apiBaseUrl` (Task 7).
- Produces: `AppSessionService.ensureRenewloopSession()`; `renewloopSessionGuard` — consumed by Task 9's route definitions.

- [ ] **Step 1: Extend AppSessionService**

Replace the full contents of `myadmin/src/app/core/services/app-session.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VerdiqAuthService } from './verdiq/verdiq-auth';
import { RenewloopAuthService } from './renewloop/renewloop-auth';

/**
 * Cross-backend silent-login for apps whose backend differs from
 * vamaha-backend (currently Verdiq and RenewLoop). Each auth service already
 * persists its own token via its own StorageService, so this only logs in
 * when no valid token exists yet this browser session.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly verdiqAuth = inject(VerdiqAuthService);
  private readonly renewloopAuth = inject(RenewloopAuthService);

  async ensureVerdiqSession(): Promise<void> {
    if (this.verdiqAuth.getToken() && !this.verdiqAuth.isTokenExpired()) return;
    await firstValueFrom(
      this.verdiqAuth.login({
        email: environment.verdiq.serviceEmail,
        password: environment.verdiq.servicePassword,
      }),
    );
  }

  async ensureRenewloopSession(): Promise<void> {
    if (this.renewloopAuth.getToken() && !this.renewloopAuth.isTokenExpired()) return;
    await firstValueFrom(
      this.renewloopAuth.login({
        email: environment.renewloop.serviceEmail,
        password: environment.renewloop.servicePassword,
      }),
    );
  }

  /** Clears every service-credential session. Called from AuthService.logout()
   * so signing out of the shell doesn't leave a service-account JWT behind
   * in localStorage for any app backend. */
  clearVerdiqSession(): void {
    this.verdiqAuth.logout();
    this.renewloopAuth.logout();
  }
}
```

(`clearVerdiqSession` keeps its existing name — it's already called from `AuthService.logout()` — but now clears both service sessions. Renaming it repo-wide is out of scope for this plan.)

- [ ] **Step 2: Create the session guard**

Create `myadmin/src/app/core/guards/renewloop-session.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AppSessionService } from '../services/app-session.service';

/**
 * Ensures a RenewLoop-backend (sbmint) session exists before any
 * apps/renewloop/* route activates, so every page component can assume a
 * valid token is already in place when it fires its first HTTP call.
 */
export const renewloopSessionGuard: CanActivateFn = async () => {
  try {
    await inject(AppSessionService).ensureRenewloopSession();
  } catch (err) {
    console.error('RenewLoop session login failed', err);
  }
  return true;
};
```

- [ ] **Step 3: Create the auth interceptor**

Create `myadmin/src/app/core/interceptors/renewloop-auth.interceptor.ts`:

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RenewloopAuthService } from '../services/renewloop/renewloop-auth';
import { environment } from '../../../environments/environment';

/**
 * Attaches the RenewLoop-backend (sbmint) JWT, obtained via silent
 * service-credential login (see AppSessionService), to sbmint calls only.
 * Mirrors verdiqAuthInterceptor's URL-prefix gating so other backends'
 * calls are untouched.
 */
const RENEWLOOP_BASE = environment.renewloop.apiBaseUrl.replace(/\/$/, '') + '/';

export const renewloopAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(RenewloopAuthService).getToken();
  if (token && req.url.startsWith(RENEWLOOP_BASE)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
```

- [ ] **Step 4: Register the interceptor**

In `myadmin/src/app/app.config.ts`, add the import and register it in the `withInterceptors` array:

```typescript
import { renewloopAuthInterceptor } from './core/interceptors/renewloop-auth.interceptor';
```

```typescript
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, verdiqAuthInterceptor, renewloopAuthInterceptor, loadingInterceptor]),
    ),
```

- [ ] **Step 5: Verify it compiles**

Run: `cd myadmin && npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/app-session.service.ts src/app/core/guards/renewloop-session.guard.ts \
  src/app/core/interceptors/renewloop-auth.interceptor.ts src/app/app.config.ts
git commit -m "feat(admin): wire RenewLoop silent login, session guard, and auth interceptor"
```

---

## Task 9: myadmin — Users page (list, search, detail, delete)

**Files:**
- Create: `myadmin/src/app/pages/apps/renewloop/users/users.ts`
- Create: `myadmin/src/app/pages/apps/renewloop/users/users.html`
- Modify: `myadmin/src/app/app.routes.ts`

**Interfaces:**
- Consumes: `RenewloopAdminApi` (Task 7), `RenewloopAuthService.user` (Task 7), `ConfirmDeleteModal` (existing shared component), `authGuard` + `renewloopSessionGuard` (existing + Task 8).

- [ ] **Step 1: Create the component**

Create `myadmin/src/app/pages/apps/renewloop/users/users.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { UserDetail, UserRow, UsersPage } from '../../../../core/models/renewloop/user.model';
import { ConfirmDeleteModal } from '../../../../shared/components/verdiq/confirm-delete-modal/confirm-delete-modal';

@Component({
  selector: 'app-renewloop-users',
  standalone: true,
  imports: [DatePipe, FormsModule, ConfirmDeleteModal],
  templateUrl: './users.html',
})
export class RenewloopUsers {
  private api = inject(RenewloopAdminApi);

  readonly page = signal<UsersPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  search = '';
  currentPage = 1;

  readonly detail = signal<UserDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly deleteTarget = signal<UserRow | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getUsers(this.search.trim(), this.currentPage, 20).subscribe({
      next: (p) => {
        this.page.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load users.');
        this.loading.set(false);
      },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.load();
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.load();
  }

  openDetail(row: UserRow): void {
    this.detail.set(null);
    this.detailLoading.set(true);
    this.api.getUser(row.id).subscribe({
      next: (res) => {
        this.detail.set(res.user);
        this.detailLoading.set(false);
      },
      error: () => {
        this.error.set('Could not load user detail.');
        this.detailLoading.set(false);
      },
    });
  }

  closeDetail(): void {
    this.detail.set(null);
  }

  openDelete(row: UserRow): void {
    this.deleteError.set(null);
    this.deleteTarget.set(row);
  }

  closeDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.api.deleteUser(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.notice.set(`Deleted ${target.email}.`);
        if (this.detail()?.id === target.id) this.detail.set(null);
        this.load();
      },
      error: (e) => {
        this.deleting.set(false);
        const message = e?.error?.errors?.[0] ?? 'Could not delete the user.';
        this.deleteError.set(message);
      },
    });
  }
}
```

- [ ] **Step 2: Create the template**

Create `myadmin/src/app/pages/apps/renewloop/users/users.html`:

```html
<div class="min-h-screen bg-bg text-text">
  <div class="max-w-[1400px] mx-auto px-6 lg:px-8 py-10 space-y-8">
    <section class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">Users</h1>
        <p class="text-text2 text-sm">RenewLoop end users, subscriptions, and device registration.</p>
      </div>
      <div class="flex gap-2">
        <input
          [(ngModel)]="search"
          (keyup.enter)="onSearch()"
          placeholder="Search name or email…"
          class="border border-border rounded-lg px-3 py-2 bg-surface text-sm"
        />
        <button (click)="onSearch()" class="border border-border rounded-lg px-4 py-2 text-sm">Search</button>
      </div>
    </section>

    @if (notice()) {
      <p class="text-sm text-green-600">{{ notice() }}</p>
    }
    @if (error()) {
      <p class="text-sm text-red-600">{{ error() }}</p>
    }

    @if (loading()) {
      <p class="text-text2 text-sm">Loading…</p>
    } @else if (page(); as p) {
      @if (p.users.length === 0) {
        <p class="text-text2 text-sm">No users found.</p>
      } @else {
        <div class="overflow-x-auto border border-border rounded-xl">
          <table class="w-full text-sm">
            <thead class="bg-surface text-text2 text-left">
              <tr>
                <th class="px-4 py-2">Name</th>
                <th class="px-4 py-2">Email</th>
                <th class="px-4 py-2">Subscriptions</th>
                <th class="px-4 py-2">Device</th>
                <th class="px-4 py-2">Joined</th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              @for (u of p.users; track u.id) {
                <tr class="border-t border-border">
                  <td class="px-4 py-2">{{ u.name }}</td>
                  <td class="px-4 py-2">{{ u.email }}</td>
                  <td class="px-4 py-2">{{ u.subscriptionsCount }}</td>
                  <td class="px-4 py-2">
                    @if (u.hasDeviceToken) {
                      <span class="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-600">registered</span>
                    } @else {
                      <span class="text-xs text-text2">none</span>
                    }
                  </td>
                  <td class="px-4 py-2">{{ u.createdAt | date: 'mediumDate' }}</td>
                  <td class="px-4 py-2 flex gap-2">
                    <button (click)="openDetail(u)" class="text-xs border border-border rounded-lg px-3 py-1">View</button>
                    <button (click)="openDelete(u)" class="text-xs border border-red-500/40 text-red-600 rounded-lg px-3 py-1">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex items-center gap-3 text-sm">
          <button
            (click)="goToPage(p.pagination.page - 1)"
            [disabled]="p.pagination.page <= 1"
            class="border border-border rounded-lg px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span class="text-text2">Page {{ p.pagination.page }} of {{ p.pagination.totalPages }}</span>
          <button
            (click)="goToPage(p.pagination.page + 1)"
            [disabled]="p.pagination.page >= p.pagination.totalPages"
            class="border border-border rounded-lg px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      }
    }

    @if (detailLoading()) {
      <p class="text-text2 text-sm">Loading detail…</p>
    } @else if (detail(); as d) {
      <section class="border border-border rounded-xl p-6 space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold">{{ d.name }}</h2>
          <button (click)="closeDetail()" class="text-sm text-text2">Close</button>
        </div>
        <p class="text-sm">{{ d.email }}</p>
        <p class="text-sm text-text2">Joined {{ d.createdAt | date: 'medium' }}</p>
        <p class="text-sm">Subscriptions: {{ d.subscriptionsCount }}</p>
        <p class="text-sm">Device registered: {{ d.hasDeviceToken ? 'Yes' : 'No' }}</p>
        <p class="text-sm">Reminders enabled: {{ d.remindersEnabled ? 'Yes' : 'No' }} ({{ d.defaultReminderDays }} days, {{ d.defaultCurrency }})</p>
      </section>
    }

    <app-confirm-delete-modal
      [open]="deleteTarget() !== null"
      [itemLabel]="deleteTarget()?.email ?? ''"
      [expectedText]="deleteTarget()?.email ?? ''"
      (confirmed)="confirmDelete()"
      (closed)="closeDelete()"
    ></app-confirm-delete-modal>
    @if (deleteError()) {
      <p class="text-sm text-red-600">{{ deleteError() }}</p>
    }
  </div>
</div>
```

- [ ] **Step 3: Register the RenewLoop shell + route**

In `myadmin/src/app/app.routes.ts`, add the import at the top:

```typescript
import { renewloopSessionGuard } from './core/guards/renewloop-session.guard';
```

Add a new top-level route block (after the `apps/verdiq` block, before the `{ path: '**', redirectTo: '' }` catch-all):

```typescript
  {
    path: 'apps/renewloop',
    canActivate: [authGuard, renewloopSessionGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appName: 'RenewLoop',
      appIcon: '💰',
      navItems: [
        { label: 'Users', icon: '👥', path: 'users' },
        { label: 'Notifications', icon: '🔔', path: 'notifications' },
      ],
    },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/apps/renewloop/users/users').then(m => m.RenewloopUsers),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/apps/renewloop/notifications/notifications').then(
            m => m.RenewloopNotifications,
          ),
      },
    ],
  },
```

(The `notifications` import is added now so the route table is complete; the component itself is created in Task 10 — the app will fail to build until Task 10 lands, so run Task 10 immediately after this one before attempting a build.)

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/renewloop/users src/app/app.routes.ts
git commit -m "feat(admin): add RenewLoop Users page (list, search, detail, delete)"
```

---

## Task 10: myadmin — Notifications page (broadcast + single-user send)

**Files:**
- Create: `myadmin/src/app/pages/apps/renewloop/notifications/notifications.ts`
- Create: `myadmin/src/app/pages/apps/renewloop/notifications/notifications.html`

**Interfaces:**
- Consumes: `RenewloopAdminApi` (Task 7).
- Produces: `RenewloopNotifications` — referenced by Task 9's route (`./pages/apps/renewloop/notifications/notifications`).

- [ ] **Step 1: Create the component**

Create `myadmin/src/app/pages/apps/renewloop/notifications/notifications.ts`:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { BroadcastResult, CredentialStatus, UserRow } from '../../../../core/models/renewloop/user.model';

@Component({
  selector: 'app-renewloop-notifications',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notifications.html',
})
export class RenewloopNotifications implements OnInit {
  private api = inject(RenewloopAdminApi);

  readonly credential = signal<CredentialStatus | null>(null);
  readonly credentialError = signal<string | null>(null);

  broadcastTitle = '';
  broadcastBody = '';
  readonly broadcastStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly broadcastResult = signal<BroadcastResult | null>(null);
  readonly broadcastError = signal('');

  userSearch = '';
  readonly userResults = signal<UserRow[]>([]);
  readonly userSearchLoading = signal(false);
  selectedUser: UserRow | null = null;
  singleTitle = '';
  singleBody = '';
  readonly singleStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly singleError = signal('');
  readonly singleSent = signal(false);

  ngOnInit(): void {
    this.api.getCredentialStatus().subscribe({
      next: (status) => this.credential.set(status),
      error: () => this.credentialError.set('Could not load credential status.'),
    });
  }

  sendBroadcast(): void {
    if (this.broadcastStatus() === 'sending') return;
    const title = this.broadcastTitle.trim();
    const body = this.broadcastBody.trim();
    if (!title || !body) {
      this.broadcastStatus.set('error');
      this.broadcastError.set('Title and body are both required.');
      return;
    }
    if (!confirm('Send this notification to every user with a registered device?')) return;

    this.broadcastStatus.set('sending');
    this.broadcastError.set('');
    this.broadcastResult.set(null);
    this.api.broadcastPush(title, body).subscribe({
      next: (result) => {
        this.broadcastResult.set(result);
        this.broadcastStatus.set('idle');
        this.broadcastTitle = '';
        this.broadcastBody = '';
      },
      error: () => {
        this.broadcastStatus.set('error');
        this.broadcastError.set('Broadcast failed. Please try again.');
      },
    });
  }

  searchUsers(): void {
    const term = this.userSearch.trim();
    if (!term) {
      this.userResults.set([]);
      return;
    }
    this.userSearchLoading.set(true);
    this.api.getUsers(term, 1, 10).subscribe({
      next: (page) => {
        this.userResults.set(page.users);
        this.userSearchLoading.set(false);
      },
      error: () => this.userSearchLoading.set(false),
    });
  }

  selectUser(user: UserRow): void {
    this.selectedUser = user;
    this.userResults.set([]);
    this.userSearch = user.email;
    this.singleSent.set(false);
    this.singleError.set('');
  }

  sendToUser(): void {
    if (this.singleStatus() === 'sending' || !this.selectedUser) return;
    const title = this.singleTitle.trim();
    const body = this.singleBody.trim();
    if (!title || !body) {
      this.singleStatus.set('error');
      this.singleError.set('Title and body are both required.');
      return;
    }
    this.singleStatus.set('sending');
    this.singleError.set('');
    this.singleSent.set(false);
    this.api.sendPushToUser(this.selectedUser.id, title, body).subscribe({
      next: () => {
        this.singleStatus.set('idle');
        this.singleSent.set(true);
        this.singleTitle = '';
        this.singleBody = '';
      },
      error: (e) => {
        this.singleStatus.set('error');
        this.singleError.set(e?.error?.errors?.[0] ?? 'Failed to send the notification.');
      },
    });
  }
}
```

- [ ] **Step 2: Create the template**

Create `myadmin/src/app/pages/apps/renewloop/notifications/notifications.html`:

```html
<div class="min-h-screen bg-bg text-text">
  <div class="max-w-[1400px] mx-auto px-6 lg:px-8 py-10 space-y-12">
    <section class="flex items-center gap-4 flex-wrap">
      <h1 class="text-2xl font-bold">Push notifications</h1>
      @if (credential(); as c) {
        @if (c.configured) {
          <span class="text-xs font-medium px-3 py-1.5 rounded-full bg-green-500/10 text-green-600">Firebase configured</span>
        } @else {
          <span class="text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-600">Not configured — sends will no-op</span>
        }
      }
    </section>
    @if (credentialError()) {
      <p class="text-sm text-red-600">{{ credentialError() }}</p>
    }

    <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 class="text-xl font-bold mb-4">Broadcast to all users</h2>
        <div class="space-y-3">
          <input
            [(ngModel)]="broadcastTitle"
            placeholder="Title"
            class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          />
          <textarea
            [(ngModel)]="broadcastBody"
            placeholder="Body"
            rows="3"
            class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          ></textarea>
          @if (broadcastStatus() === 'error') {
            <p class="text-sm text-red-600">{{ broadcastError() }}</p>
          }
          @if (broadcastResult(); as r) {
            <p class="text-sm text-green-600">
              Sent: {{ r.sent }} · Failed: {{ r.failed }} · Stale removed: {{ r.staleRemoved }} · Total: {{ r.total }}
            </p>
          }
          <button
            (click)="sendBroadcast()"
            [disabled]="broadcastStatus() === 'sending'"
            class="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {{ broadcastStatus() === 'sending' ? 'Sending…' : 'Send to all devices' }}
          </button>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-bold mb-4">Send to one user</h2>
        <div class="space-y-3">
          <input
            [(ngModel)]="userSearch"
            (keyup.enter)="searchUsers()"
            placeholder="Search by name or email…"
            class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          />
          <button (click)="searchUsers()" class="text-xs border border-border rounded-lg px-3 py-1">Search</button>

          @if (userSearchLoading()) {
            <p class="text-text2 text-sm">Searching…</p>
          } @else if (userResults().length > 0) {
            <ul class="border border-border rounded-lg divide-y divide-border">
              @for (u of userResults(); track u.id) {
                <li>
                  <button (click)="selectUser(u)" class="w-full text-left px-3 py-2 text-sm hover:bg-surface">
                    {{ u.name }} — {{ u.email }}
                    @if (!u.hasDeviceToken) { <span class="text-text2"> (no device)</span> }
                  </button>
                </li>
              }
            </ul>
          }

          @if (selectedUser; as su) {
            <p class="text-sm">Selected: <strong>{{ su.email }}</strong></p>
            @if (!su.hasDeviceToken) {
              <p class="text-sm text-amber-600">This user has no registered device — sending will fail.</p>
            }
            <input
              [(ngModel)]="singleTitle"
              placeholder="Title"
              class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
            />
            <textarea
              [(ngModel)]="singleBody"
              placeholder="Body"
              rows="3"
              class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
            ></textarea>
            @if (singleStatus() === 'error') {
              <p class="text-sm text-red-600">{{ singleError() }}</p>
            }
            @if (singleSent()) {
              <p class="text-sm text-green-600">Sent.</p>
            }
            <button
              (click)="sendToUser()"
              [disabled]="singleStatus() === 'sending'"
              class="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {{ singleStatus() === 'sending' ? 'Sending…' : 'Send' }}
            </button>
          }
        </div>
      </div>
    </section>
  </div>
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd myadmin && npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors — this also confirms Task 9's route import of `RenewloopNotifications` now resolves.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/renewloop/notifications
git commit -m "feat(admin): add RenewLoop Notifications page (broadcast + single-user send)"
```

---

## Task 11: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the backend test suite**

Run: `cd backend && npm test`
Expected: all tests pass, including the new `admin.service.test.js`, `user.model.test.js` additions, `auth.middleware.test.js` additions, `auth.service.test.js` additions, and `fcm.test.js` additions.

- [ ] **Step 2: Start sbmint locally and seed an admin**

```bash
cd backend
npm run dev
```

In a second terminal:

```bash
cd backend
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=some-long-password node scripts/seed-admin.js
```

- [ ] **Step 3: Point myadmin's environment at the local backend**

Confirm `myadmin/src/environments/environment.ts`'s `renewloop.apiBaseUrl` is `http://127.0.0.1:3300` (set in Task 7) and fill in `serviceEmail`/`servicePassword` locally with the values from Step 2 (do not commit real credentials — this is a local-only edit for the verification pass; revert before committing anything further).

- [ ] **Step 4: Run the admin dashboard and verify in the browser**

```bash
cd myadmin
npm start
```

Log into the shell, click the RenewLoop tile, and verify:
- Users page loads, search filters by name/email, pagination works if you have 20+ users (or just confirm the controls render correctly with fewer).
- Clicking a row's "View" shows the detail panel with subscriptions count and device status.
- Deleting a user requires typing the exact email in the confirm modal, then removes it from the list.
- Notifications page shows the Firebase credential-status badge correctly (red if `FIREBASE_SERVICE_ACCOUNT_PATH` isn't set in the backend's `.env`, green if it is).
- Broadcast form validates empty title/body, and (if you have at least one user with a `deviceToken` set — register one via the sbmint mobile app's device endpoint, or manually set one via Mongo for a test user) shows a `{sent, failed, staleRemoved, total}` result after confirming.
- Single-user send: search for a user, select them, and confirm the "no registered device" warning appears for a user without a token, and that sending to a user with a token returns "Sent."

- [ ] **Step 5: Revert local-only environment edits**

```bash
cd myadmin && git status
```

Confirm `environment.ts` shows no diff beyond the `renewloop` block committed in Task 7 (i.e. the placeholder `serviceEmail`/`servicePassword` strings, not your real local values) — `git checkout -- src/environments/environment.ts` if you edited it in place for Step 3, or `git diff` it and manually restore the placeholders.

No commit for this task — it's verification only.
