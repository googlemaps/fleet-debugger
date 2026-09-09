# Fleet Debugger Release & Deployment Process

## Overview & Architecture

Fleet Debugger is an open-source, client-side React Single Page Application (SPA). The hosted version of the application is served via GitHub Pages:
https://googlemaps.github.io/fleet-debugger/

All event parsing, log inspection, and map rendering run entirely within the user's browser. There are no persistent backend services, databases, or containerized server fleets.

## CI/CD Pipeline & Deployment Automation

Deployments to GitHub Pages are fully automated via GitHub Actions workflows:

- **Test (`.github/workflows/test.yml`):** Runs linter and automated tests on all pull requests and pushes to `main`.
- **Docs & Deployment (`.github/workflows/docs.yml`):** On any merge or push to `main`, builds the application and deploys the static assets to the `gh-pages` branch.
- **Semantic Release (`.github/workflows/release.yml`):** Uses semantic-release to automatically determine version bumps based on Conventional Commits, cuts a new Git tag, and generates GitHub release notes.
- **Demo Builds (`.github/workflows/build-demos.yml`):** Rebuilds demo snapshots whenever source datasets or components change.

## Release Workflows

### 1. Standard / Routine Releases

1. **Pull Request:** Changes are proposed via pull requests against the `main` branch.
2. **Automated Checks:** GitHub Actions runs automated tests and linters.
3. **Review & Approval:** Changes must be reviewed and approved by a repository maintainer.
4. **Dependency & Vulnerability Updates:** Automated dependency update PRs (Dependabot) are verified by CI checks and merged via automated merge workflows (`.github/workflows/dependabot.yml`).
5. **Deployment:** Merging a pull request into `main` automatically triggers the build and deployment pipeline.
   - **Deployment Duration:** Typically **~1 to 2 minutes** from PR merge to live production on GitHub Pages.

### 2. Emergency Deployment / Hotfix Procedure

When an urgent bug fix or security remediation must be deployed rapidly:

1. **Hotfix PR:** Create a branch addressing the issue and open an urgent Pull Request targeting `main`.
2. **Expedited Review:** A designated repository maintainer reviews and merges the PR.
3. **Automated Production Push:** Upon merge, GitHub Actions immediately runs the build and publishes the updated bundle to the `gh-pages` branch.
4. **Immediate Client Rollout:** Because Fleet Debugger is a client-side web application, updating the static assets on GitHub Pages immediately distributes the patch to all users upon their next page load or refresh (within ~1 to 2 minutes of merge).

## Security Issue Reporting

To report a potential security vulnerability, please follow the guidelines in [SECURITY.md](../SECURITY.md) via [https://g.co/vulnz](https://g.co/vulnz) or GitHub Security Advisories.
