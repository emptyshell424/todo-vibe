# Supabase RLS with Clerk

This project uses Clerk user IDs as the ownership key in Supabase. Every user-owned table stores `user_id` as text, and RLS compares it with the Clerk JWT `sub` claim.

## 1. Clerk JWT template

In Clerk Dashboard:

1. Open **Configure > Sessions > JWT templates**.
2. Create a new template named `supabase`.
3. Use this claims payload:

```json
{
  "aud": "authenticated",
  "role": "authenticated",
  "email": "{{user.primary_email_address}}",
  "app_metadata": {},
  "user_metadata": {}
}
```

4. Save the template.

Do not add `sub` manually in Clerk. Clerk treats `sub` as a reserved claim and injects it automatically. The RLS migration reads that automatic `sub` claim and compares it with `public.*.user_id`, for example `user_...`.

## 2. Client token wiring

The browser Supabase client must send the Clerk Supabase JWT, not only the anon key. The current anon key is still needed as the public project key, but it is no longer the identity boundary.

Use Clerk's `getToken({ template: 'supabase' })` when creating or configuring the Supabase client, then send it as the bearer token for Supabase requests.

Conceptually:

```ts
const token = await getToken({ template: 'supabase' });

const supabase = createClient(url, anonKey, {
  global: {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
});
```

Do not treat `.eq('user_id', user.id)` as security. It is only a query filter. RLS is the security boundary.

## 3. Apply the migration

Run the migrations against the target Supabase project:

```bash
supabase db push
```

The RLS migration is:

```text
supabase/migrations/20260421_enable_clerk_rls.sql
```

It enables RLS for:

- `projects`
- `sections`
- `tasks`
- `labels`
- `task_labels`
- `reminders`
- `recurrences`

It also adds ownership checks for cross-table references. A user cannot attach their own `user_id` to another user's task, label, project, or section.

## 4. Verification checklist

After wiring the Clerk token and applying the migration:

1. Sign in as user A and create a project/task.
2. Sign in as user B in another browser profile.
3. Confirm user B cannot read, update, delete, label, remind, or recur user A's data.
4. Confirm user A can still create, update, complete, delete, and list their own data.
5. Confirm inserts fail if `user_id` does not match the Clerk user ID in JWT `sub`.

If all reads suddenly return empty arrays, the most likely cause is that the Supabase client is still using only the anon key without the Clerk JWT.
