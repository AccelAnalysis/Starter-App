# Data-backed Starter

Use this starter when the app needs authenticated users, persistent records, and explicit per-user access control.

The included example supports Email/Password authentication and create/read/update/delete operations under:

```text
/users/{uid}/records/{recordId}
```

Firestore security rules—not the interface—enforce that only the matching authenticated user can access that path.

## 1. Install

```bash
npm install
```

## 2. Configure Firebase

1. Create or select a Firebase project.
2. Add a Web App.
3. Enable **Authentication → Email/Password**.
4. Create a Firestore database.
5. Copy `.env.example` to `.env.local` and fill in the public Firebase web configuration values.
6. Authenticate the Firebase CLI and select the project:

```bash
npx firebase login
npx firebase use --add
```

The Firebase web configuration is intended for client apps; access protection comes from Authentication and Firestore rules. Never place service-account credentials or other private keys in `NEXT_PUBLIC_*` variables.

## 3. Test security rules

The rule tests launch a Firestore emulator and verify owner, cross-user, guest, schema, and immutable-createdAt behavior.

```bash
npm run test:rules
```

Java is required by the Firestore emulator.

## 4. Deploy rules

```bash
npm run deploy:rules
```

Deploy rules before inviting real users.

## 5. Run the app

```bash
npm run dev
```

## Quality gates

```bash
npm run verify
```

This runs ESLint, strict TypeScript checking, Firestore rule tests, and a production Next.js build.

## Customize safely

- Replace the example record fields with the smallest schema the real workflow needs.
- Update `firestore.rules` and its tests at the same time as the schema.
- Keep queries scoped to paths the current user is authorized to read.
- Add roles or shared/team records only when the product actually requires them; owner-only is the safer default.
- Keep preview and production Firebase projects separate when test data must not touch production.
