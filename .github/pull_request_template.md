## What and why

<!-- What does this change, and why? Link the issue if there is one: "Closes #123". -->

## How to test

<!-- Steps a reviewer can follow, and what they should see. Add screenshots for UI changes, with made-up data only. -->

## Outside the code

<!-- Anything a maintainer must do by hand before or after deploying: an Appwrite table or column, an env var, a scheduled job, a setting in a third-party service. Write "Nothing" if there isn't anything. -->

## Checklist

- [ ] `bun run check-types` passes
- [ ] `bun x ultracite check` passes on the files I changed
- [ ] Tests pass in every workspace I touched, and I added tests where it made sense
- [ ] I updated the docs page that covers this code, or nothing about how it behaves changed
- [ ] Any new build-time env var is in `turbo.json`
- [ ] No secrets, and no real students' or members' data, in the code, tests or screenshots
