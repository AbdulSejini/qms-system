# Operator scripts | أدوات المشغّل

Plain Node ESM scripts that talk to Firestore with the **client** SDK, exactly like the
app does. There is no `firebase-admin` service account for this project, so every script
signs in as a real user and is bound by the deployed Firestore rules. No build step, no
extra dependencies.

سكربتات Node تعمل بحزمة Firebase العميل نفسها التي يستخدمها التطبيق. لا يوجد حساب خدمة
`firebase-admin` لهذا المشروع، لذلك تسجّل كل أداة الدخول كمستخدم حقيقي وتخضع لقواعد
Firestore المنشورة.

## Credentials | بيانات الدخول

Every script takes the same credentials, and none of them store the password. Use an
account that is allowed to read everything — a `system_admin`. `seed-org.mjs` **requires**
one: under the deployed rules only a `system_admin` may create `users` documents.

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

## `seed-org.mjs`

Creates the organisational structure — 8 departments, 42 sections and one employee record
per person named in `src/data/org-structure.json`, including its `auditors` roster of the
16 ISO 9001 internal auditors. **Run it once, when the directory is still empty**, to save
typing 50 records into the Users page by hand. It is the only script here that writes.

يُنشئ الهيكل التنظيمي: الإدارات والأقسام وسجلاً لكل موظف. يعمل بشكل تجريبي افتراضياً ولا
يكتب شيئاً إلا مع `--commit`.

```bash
# 1. look — this changes nothing:
QMS_OPERATOR_EMAIL=... QMS_OPERATOR_PASSWORD='...' node scripts/seed-org.mjs

# 2. then, only when the printed plan is right:
QMS_OPERATOR_EMAIL=... QMS_OPERATOR_PASSWORD='...' node scripts/seed-org.mjs --commit
```

**A dry run is the default.** Without `--commit` it signs in, reads, prints the exact plan
and exits having written nothing.

Document ids are the org-structure codes (`departments/OPS`, `sections/OPS-PROD-LV`) and a
slug of the person's name (`users/user-ajmal-khan`), so **re-running never duplicates
anything**. A document that already exists is reported `EXISTS` and left completely alone —
the script only ever adds. Correcting a record afterwards is the Users and Departments
pages' job, not this script's.

### The email addresses are guesses

The company gave us one verified address, `mabahwairith@saudicable.com`, which is
first-initial + middle-initial + surname. Every other address is that rule applied to a
transliterated name, and a transliterated name has several defensible spellings.

- Each guessed address is written with **`emailIsGuessed: true`** on the user document, so
  nobody later mistakes it for a verified one. Bahwairith's is written with `false`.
- The script prints a table of every guess with the alternatives it considered and why each
  is uncertain. **Correct them on the Users page before onboarding anyone** — nothing
  verifies these and there is no email service that would bounce a wrong one.
- Once you know a real address, add it to `CONFIRMED_EMAILS` at the top of the script and
  re-run; a confirmed address does not have to match the rule.
- If two guesses collide, the script refuses to write anything and exits `1`. It will not
  pick a winner: a wrong address is a sign-in that lands on somebody else's account.

### What it will not do

- **No Firebase Auth accounts, no passwords.** The records it creates are directory
  entries with no way to sign in. Onboarding stays on the Users page, which creates the
  Auth account and issues the one-time access code handed to the employee in person.
- **It never touches `users/system-admin-root`**, and never creates a second record for the
  person that document describes, even though the workbook names him as head and auditee of
  Governance, Risk & Compliance. Those two fields are left unset instead.

### Roles

`quality_manager` for Mohammed A. Bahwairith, `auditor` (with `canBeAuditor: true`) for the
other 15 people on the roster, `department_manager` for anyone the workbook names as a
department head, `employee` for the remaining section auditees. The auditor role wins over
any other hat a person wears, and every such overlap is printed under **NEEDS AN OPERATOR
DECISION** — along with unresolvable auditees, departments with no single named head, and
the auditors whose department had to be guessed from their position. Read that section.

`auditableDepartmentIds` / `auditableSectionIds` are left empty for everybody: who may
audit what is the quality manager's per-audit decision, and an auditor must not be handed
their own area by a seeding script.

| Exit | Meaning |
| ---- | ------- |
| `0` | the plan was printed (dry run), or every planned write succeeded |
| `1` | refused or incomplete — a guessed address collided, or a write failed |
| `2` | could not start (bad config, sign-in refused, `org-structure.json` unusable) |

Nothing is rolled back on a partial failure; re-running is safe and retries only what is
missing.

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
