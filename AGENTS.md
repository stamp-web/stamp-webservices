# Guidelines for AI Agents

Welcome! This document outlines the patterns, best practices, and guidelines for agentic development in the `stamp-webservices` repository.

---

## 1. Test Execution with ESM

This project is configured as an ES Module (`"type": "module"` in `package.json`). Jest requires specific environment options to run ES Modules.

### How to Run Tests
- **All tests:**
  ```bash
  npm test
  ```
- **Single test file:**
  Always specify the `NODE_OPTIONS` environment variable with `--experimental-vm-modules`:
  ```bash
  npx cross-env NODE_OPTIONS=--experimental-vm-modules jest test/services-albums-test.js --runInBand
  ```

---

## 2. Asynchronous Testing Guidelines

All tests must be written using **async/await** and **Promises**. Do not use `done` callbacks in tests or hook blocks (`beforeAll`, `afterAll`).

### Session Lifecycle in Hooks
The integration session helper (`test/util/integration-session.js`) supports promise-based setup and cleanup:
```javascript
import session from './util/integration-session.js';

beforeAll(async () => {
    await session.initialize();
});

afterAll(async () => {
    await session.cleanup();
});
```

### Asserting API Failures (No Try/Catch)
To assert that an API request fails with a specific HTTP status code, **do not** use try/catch blocks with conditional `expect` calls (this violates the `jest/no-conditional-expect` ESLint rule).

Instead, assert directly on the returned Promise:
```javascript
// Correct pattern:
await expect(superagent.post('http://localhost:9002/rest/albums').send(body))
    .rejects.toHaveProperty('status', 409);
```

### Direct Database Queries in Tests
When executing direct database queries in tests using the raw connection, wrap them in a Promise to prevent async race conditions:
```javascript
const rows = await new Promise((resolve, reject) => {
    session.getConnection().query('SELECT * FROM ALBUMS_COUNTRIES WHERE ALBUMS_ID=?', [albumId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
    });
});
expect(rows.length).toEqual(0);
```

---

## 3. ESLint Rules
Ensure all ESLint checks pass by running:
```bash
npm run eslint
```
The recommended Jest lint rules are fully enabled. Avoid introducing `done` callbacks or conditional expects.

## 4. Database & Query Safety (SQL Injection Prevention)
When translating and building SQL queries from client-supplied filters (such as OData filters translated in `mysql-translator.js`), ensure all user inputs are properly escaped to prevent SQL injection.
- Use `mysql.escape()` from the `mysql` library for all string or other parameters embedded into SQL statements.
- Convert wildcard placeholders (e.g., `*` to `%` for `LIKE` clauses) before passing strings to `mysql.escape()`.
- Special types like date/timestamp parameters should be parsed and reformatted explicitly rather than raw-concatenated.

---

## 5. Maintenance of AGENTS.md
After completing any development or debugging task, the agent must evaluate whether to update this document (`AGENTS.md`) with new patterns, learnings, environment details, or best practices discovered during the activity, without needing explicit instructions from the user.

---

## 6. Cluster Worker Restart and Rate Limiting
When running clustered servers (e.g. `server-manager.js` using Node.js `cluster` module), crashes/failures on startup can trigger infinite restart loops if not throttled.
- **Rate-limit Restarts:** Use a sliding window rate limiter (such as `RestartTracker`) to count the number of worker failures/restarts within a given time window (e.g. max 10 restarts in 60 seconds). If exceeded, exit the primary process (`process.exit(1)`) to avoid infinite loops and 100% CPU usage.
- **Prevent Double-Forking:** When a worker crashes, Node's cluster module can emit both `disconnect` and `exit` events. To prevent duplicate workers from being created, track worker replacement status on the worker object (e.g., setting a `worker.hasBeenReplaced = true` flag) so that only one new worker is spawned per crash.

---

## 7. Managing Dependency Vulnerabilities (npm audit)
When addressing npm audit vulnerability reports for nested dependencies, use npm `overrides` in `package.json` to force upgrading the vulnerable packages to a secure version.
Avoid using `npm audit fix --force` if it introduces breaking changes (such as downgrading packages or changing major versions of direct dependencies like `jest`).



