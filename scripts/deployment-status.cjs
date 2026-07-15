#!/usr/bin/env node

/**
 * Deployment Status Monitor
 * Checks the status of a deployed application
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(type, message) {
  const prefix = {
    info: `${colors.blue}ℹ️ ${colors.reset}`,
    success: `${colors.green}✅${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    warning: `${colors.yellow}⚠️ ${colors.reset}`,
  }[type];

  console.log(`${prefix} ${message}`);
}

function header(text) {
  console.log(`\n${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);
}

// Get deployment info
const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
);

const version = packageJson.version || "unknown";
const projectName = packageJson.name || "github-dashboard";
const appUrl = process.env.APP_URL || "https://dashboard.postiusgroup.com";

header("GitHub Dashboard - Deployment Status");

const status = {
  version: version,
  project: projectName,
  url: appUrl,
  timestamp: new Date().toISOString(),
};

// Check local git status
log("info", "Checking local repository status...\n");

try {
  const gitBranch = require("child_process")
    .execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" })
    .trim();

  const gitCommit = require("child_process")
    .execSync("git rev-parse --short HEAD", { encoding: "utf8" })
    .trim();

  const gitStatus = require("child_process")
    .execSync("git status --porcelain", { encoding: "utf8" })
    .trim();

  log("success", "Git Repository");
  console.log(`  Branch: ${gitBranch}`);
  console.log(`  Commit: ${gitCommit}`);
  console.log(`  Status: ${gitStatus ? "Changes pending" : "Clean"}\n`);

  status.git = {
    branch: gitBranch,
    commit: gitCommit,
    clean: gitStatus === "",
  };
} catch (err) {
  log("warning", "Could not read git status\n");
}

// Check environment
log("info", "Checking environment variables...\n");

const requiredEnv = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "GITHUB_TOKEN",
  "NODE_ENV",
];
const envStatus = {};

requiredEnv.forEach((env) => {
  const isSet = !!process.env[env];
  envStatus[env] = isSet;

  if (isSet) {
    const value = process.env[env];
    const display = value.length > 30 ? value.substring(0, 20) + "..." : value;
    console.log(`  ${colors.green}✓${colors.reset} ${env}: ${display}`);
  } else {
    console.log(`  ${colors.yellow}×${colors.reset} ${env}: NOT SET`);
  }
});

status.env = envStatus;
console.log();

// Check deployment files
log("info", "Checking deployment configuration files...\n");

const deploymentFiles = [
  "Dockerfile",
  "railway.json",
  ".env.production",
  "package.json",
  "tsconfig.json",
];

const fileStatus = {};

deploymentFiles.forEach((file) => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  fileStatus[file] = exists;

  if (exists) {
    const stats = fs.statSync(path.join(process.cwd(), file));
    console.log(
      `  ${colors.green}✓${colors.reset} ${file} (${stats.size} bytes)`
    );
  } else {
    console.log(
      `  ${colors.yellow}×${colors.reset} ${file}: NOT FOUND (optional)`
    );
  }
});

status.files = fileStatus;
console.log();

// Check application URL
log("info", "Checking deployed application...\n");

console.log(`  Attempting to reach: ${appUrl}`);

https
  .get(appUrl, (res) => {
    log("success", `Application is accessible (${res.statusCode})`);

    console.log(`  HTTPS: Working`);
    console.log(`  Status Code: ${res.statusCode}`);

    if (res.headers["strict-transport-security"]) {
      console.log(`  HSTS: Enabled`);
    }

    status.application = {
      accessible: true,
      statusCode: res.statusCode,
      url: appUrl,
    };

    console.log();

    // Final summary
    header("Deployment Summary");

    console.log(`Project: ${status.project}`);
    console.log(`Version: ${status.version}`);
    console.log(`URL: ${status.url}`);
    console.log(`Timestamp: ${new Date(status.timestamp).toLocaleString()}`);
    console.log();

    const allEnvSet =
      requiredEnv.every((env) => process.env[env]) || Object.values(envStatus).every((v) => v);

    if (status.git && status.git.clean && allEnvSet && status.application.accessible) {
      log(
        "success",
        "Deployment is healthy and ready for production use!"
      );
      console.log();
      console.log("Next steps:");
      console.log("  1. Monitor application logs in Railway dashboard");
      console.log("  2. Test all features in production");
      console.log("  3. Set up monitoring alerts (optional)");
    } else {
      log("warning", "Some deployment checks need attention:");
      if (!status.git || !status.git.clean) {
        console.log("  • Uncommitted git changes pending");
      }
      if (!allEnvSet) {
        console.log("  • Some environment variables not set");
      }
      if (!status.application.accessible) {
        console.log("  • Application not responding");
      }
    }

    console.log();

    process.exit(0);
  })
  .on("error", (err) => {
    log("error", `Cannot reach application: ${err.message}`);

    status.application = {
      accessible: false,
      error: err.message,
      url: appUrl,
    };

    console.log();

    // Final summary
    header("Deployment Status");

    console.log(`Project: ${status.project}`);
    console.log(`Version: ${status.version}`);
    console.log(`URL: ${status.url}`);
    console.log();

    log("warning", "Application is not currently accessible");
    console.log("\nPossible causes:");
    console.log("  1. Application not deployed to Railway yet");
    console.log("  2. DNS not configured in Cloudflare");
    console.log("  3. Application crash or deployment in progress");
    console.log("  4. Network connectivity issues");

    console.log("\nChecklist:");
    console.log("  • Is Railway deployment active?");
    console.log("  • Is Cloudflare CNAME record configured?");
    console.log("  • Are environment variables set in Railway?");
    console.log("  • Is database initialized?");

    console.log();

    process.exit(1);
  });
