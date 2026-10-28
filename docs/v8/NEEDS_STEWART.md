# Needs Stewart

Only things Claude cannot do. Each item says what Claude is doing meanwhile. None of these block work.

1. **Optional: clear 17 stale git worktree records.** `git worktree prune` could not delete folders
   under `.git\worktrees\` (permission denied from inside the session). They are harmless leftovers
   from the old OneDrive location. If you want them gone, run this in a fresh Windows PowerShell window:

   ```powershell
   cd "C:\Users\stewa\Documents\Claude\gardensync"; git worktree prune -v
   ```

   Meanwhile: nothing depends on them.
