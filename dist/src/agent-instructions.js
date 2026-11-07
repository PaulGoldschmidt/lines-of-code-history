/** Instructions a coding agent can follow to add the chart to a private repository via the Action. */
export const AGENT_INSTRUCTIONS = `Add a weekly lines-of-code chart to this repo's README using the GitHub Action PaulGoldschmidt/lines-of-code-history@v1:
hand-drawn style, one light and one dark version chosen by the reader's GitHub theme. The repo is private, so use the
Action, not the hosted loc-history.com chart. Open one PR and do not merge it.

1. Create .github/workflows/loc-history.yml with exactly this content. Only LOC_EXCLUDE changes per repo:

# Weekly lines-of-code chart for the README (PaulGoldschmidt/lines-of-code-history), committed as
# .github/loc-history-light.svg and -dark.svg; the README's <picture> picks one by the reader's GitHub theme.
# The push uses GITHUB_TOKEN, which does not trigger other workflows.
name: Lines of code history

on:
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  chart:
    runs-on: ubuntu-latest
    env:
      LOC_EXCLUDE: >-
        <repo-specific patterns, comma-separated, one per line>,
        .github/loc-history*.svg
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: PaulGoldschmidt/lines-of-code-history@v1
        id: loc
        with:
          path: .github/loc-history-light.svg
          theme: light
          style: sketch
          exclude: \${{ env.LOC_EXCLUDE }}
      - uses: PaulGoldschmidt/lines-of-code-history@v1
        with:
          path: .github/loc-history-dark.svg
          theme: dark
          style: sketch
          exclude: \${{ env.LOC_EXCLUDE }}
      - name: Commit the charts
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .github/loc-history-light.svg .github/loc-history-dark.svg
          git diff --cached --quiet || git commit -m "update lines of code chart (\${{ steps.loc.outputs.total_lines }} lines)"
          git push

2. Excludes. Only hand-written code should count. Exclude:
   - lockfiles (package-lock.json, composer.lock, *.lock, ...)
   - compiled or minified CSS and JS
   - vendored code (vendor/**, a bundled CMS core, ...)
   - data dumps (*.sql, *.csv)
   - generated files (GraphQL schema introspection, generated types, ...)
   The action's glob rules: a pattern without a slash matches that file name anywhere; a pattern with a slash
   matches from the repo root; ** crosses directories.
   Find candidates with: git ls-files | xargs wc -l | sort -rn | head -40 (ignore binary files).

3. Render both charts locally with the action's own code, on a branch cut from the latest default branch:
   - Download the v1 tarball (gh api repos/PaulGoldschmidt/lines-of-code-history/tarball/v1) and unpack it into a temp dir.
     It ships a prebuilt dist and has no dependencies.
   - Run once with --theme light and once with --theme dark:
     node <dir>/dist/src/cli.js "$PWD" --out .github/loc-history-<theme>.svg --theme <theme> --style sketch --label <owner>/<repo> --data <tmp>/loc.json
     followed by one --exclude <pattern> per pattern.
   - Check the weekly "net" values in loc.json for big jumps. The history also counts files that were deleted since,
     so a spike can come from generated or vendored files that no longer exist. If a jump comes from such files,
     add them to the excludes and render again.
   - Commit both SVGs in the PR, so the README shows the chart before the first scheduled run.

4. README: add only this under the intro paragraph, with no caption or other text:
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset=".github/loc-history-dark.svg">
     <img alt="Lines of code in this repository over time" src=".github/loc-history-light.svg">
   </picture>

5. If the repo's CLAUDE.md lists workflows, add a one-line entry for loc-history.yml.

6. Check that the default branch accepts the bot's push:
   gh api repos/<owner>/<repo>/branches/<default branch> --jq .protected
   If it is protected, say so in the PR.

In the PR description, give the total line count, the excludes and why each one is there. After the merge the workflow
runs every Monday at 03:17 UTC; gh workflow run loc-history.yml starts it by hand.`;
//# sourceMappingURL=agent-instructions.js.map