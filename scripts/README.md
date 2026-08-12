# Operator scripts | أدوات المشغّل

Plain Node ESM scripts that talk to Firestore with the **client** SDK, exactly like the
app does. There is no `firebase-admin` service account for this project, so every script
signs in as a real user and is bound by the deployed Firestore rules. No build step, no
extra dependencies.

سكربتات Node تعمل بحزمة Firebase العميل نفسها التي يستخدمها التطبيق. لا يوجد حساب خدمة
`firebase-admin` لهذا المشروع، لذلك تسجّل كل أداة الدخول كمستخدم حقيقي وتخضع لقواعد
Firestore المنشورة.

## Credentials | بيانات الدخول

Both scripts take the same credentials, and never store them. Use an account that is
allowed to read everything — a `system_admin`.

```bash
QMS_OPERATOR_EMAIL=admin@example.com QMS_OPERATOR_PASSWORD='...' \
  node scripts/backup-firestore.mjs
```

`--email` / `--password` also work, but the password is then visible in `ps` output and in
your shell history, so prefer the environment variables.

The credentials are deliberately **not** read from `.env.local`: that file is long-lived
and shared, and an administrator password does not belong in it.

The operator account must already exist in Firebase Auth. Accounts are created lazily the
first time someone signs in through the app with their legacy password — so sign in to the
app once yourself before running these.

يجب أن يكون حساب المشغّل موجوداً مسبقاً في Firebase Auth. تُنشأ الحسابات تلقائياً عند أول
تسجيل دخول عبر التطبيق باستخدام كلمة المرور القديمة.

## `backup-firestore.mjs`

Exports every collection into a timestamped JSON file under `backups/` (gitignored — it
holds real company audit data). Strictly read-only.

**Run it before anything that changes or deletes data**: before deploying new Firestore
rules, before starting the migration window, and before deleting the legacy `passwords`
documents.

```bash
QMS_OPERATOR_EMAIL=... QMS_OPERATOR_PASSWORD='...' node scripts/backup-firestore.mjs
```

| Exit | Meaning |
| ---- | ------- |
| `0` | complete backup written |
| `1` | file written but one or more collections failed — **not** a restore point |
| `2` | could not start (bad config, sign-in refused) |

A collection that fails is recorded as an `error` object inside the JSON instead of an
array, so a partial backup can never be mistaken for a complete one.

## `check-auth-migration.mjs`

Read-only status report answering one question: **has every user been through the new
Firebase Auth sign-in path yet?** Run it to decide when it is safe to close the migration
window. It never writes.

تقرير للاطلاع فقط: هل انتقل جميع المستخدمين إلى تسجيل الدخول عبر Firebase Auth؟

```bash
QMS_OPERATOR_EMAIL=... QMS_OPERATOR_PASSWORD='...' node scripts/check-auth-migration.mjs
```

It reports how many `users` documents exist, how many carry an `authUid`, how many
`authUsers/{authUid}` mapping documents exist, and names every user who has not migrated.

It needs to *list* both `users` and `authUsers`. Sign-in itself only ever reads a single
known `authUsers` document, so if this script stops with `permission denied` on
`authUsers`, the rules allow the `get` but not the `list` — grant `list` to `system_admin`
rather than working around it here.

Options:

- `--ignore-inactive` — do not let deactivated users, who will never sign in on their own,
  hold the gate open.
- `--check-legacy-passwords` — also read `passwords` to flag users who **cannot**
  self-migrate: no stored password, or a plaintext one shorter than the six characters
  Firebase Auth requires. Those need an administrator to reset the password. Stored values
  are never printed.

| Exit | Meaning |
| ---- | ------- |
| `0` | every user migrated — the window can be closed |
| `1` | users are still unmigrated or half-migrated |
| `2` | the check could not be completed (sign-in or a read was refused) |

Anything non-zero means *do not proceed*. The script abandons the report rather than
printing an incomplete one, because a report that says "everyone is migrated" only because
a read failed is worse than no report at all.

## The migration in order | ترتيب الخطوات

1. `node scripts/backup-firestore.mjs` — take a restore point.
2. Deploy the new Firestore rules and announce the migration window.
3. Users sign in normally. Each first sign-in creates the Auth account and the
   `authUsers` mapping. Nothing is deleted.
4. `node scripts/check-auth-migration.mjs` — repeat until it exits `0`.
5. Back up again, then, as a separate deliberate decision, delete the legacy `passwords`
   documents. **No script here does that**, and none of this work removes data.

الخطوة الأخيرة (حذف كلمات المرور القديمة) قرار منفصل يقوم به المشغّل يدوياً بعد التأكد من
اكتمال الترحيل وأخذ نسخة احتياطية.
