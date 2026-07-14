#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates all required environment variables for production deployment
 */

const fs = require("fs");
const path = require("path");

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

const requiredVars = {
  DATABASE_URL: {
    description: "PostgreSQL connection string",
    pattern: /^postgresql:\/\//,
    example: "postgresql://user:password@host:5432/database",
  },
  SESSION_SECRET: {
    description: "Session encryption secret (32+ characters)",
    validate: (val) => val && val.length >= 32,
    example: "64-character-hex-string-from-crypto",
  },
  GITHUB_TOKEN: {
    description: "GitHub Personal Access Token",
    pattern: /^ghp_[a-zA-Z0-9_]{36,255}$/,
    example: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  NODE_ENV: {
    description: "Node environment",
    validate: (val) => ["production", "staging", "development"].includes(val),
    example: "production",
  },
};

const optionalVars = {
  PORT: {
    description: "Server port",
    default: "8000",
  },
  SYNC_INTERVAL_MINUTES: {
    description: "Background sync interval",
    default: "60",
  },
  LOG_LEVEL: {
    description: "Logging level",
    default: "info",
  },
};

function validateVar(name, config, value) {
  if (!value) {
    return { valid: false, reason: "not set" };
  }

  if (config.pattern && !config.pattern.test(value)) {
    return {
      valid: false,
      reason: `doesn't match expected format (${config.pattern})`,
    };
  }

  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      reason: "validation failed",
    };
  }

  return { valid: true };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  content.split("\n").forEach((line) => {
    if (!line.trim() || line.startsWith("#")) return;
    const [key, ...valueParts] = line.split("=");
    env[key.trim()] = valueParts.join("=").trim();
  });

  return env;
}

// Main validation
header("GitHub Dashboard - Environment Validation");

// Load from files and process.env
const envFile = path.join(process.cwd(), ".env.production");
const fileEnv = loadEnvFile(envFile);
const allEnv = { ...process.env, ...fileEnv };

let hasErrors = false;
let hasMissing = false;

// Check required variables
log("info", "Checking required environment variables...\n");

Object.entries(requiredVars).forEach(([name, config]) => {
  const value = allEnv[name];
  const validation = validateVar(name, config, value);

  if (validation.valid) {
    log("success", `${name}`);
    console.log(`        ${colors.green}${config.description}${colors.reset}`);
    if (value.length > 50) {
      console.log(
        `        Value: ${value.substring(0, 20)}...${value.substring(value.length - 20)}`
      );
    } else {
      console.log(`        Value: ${value}`);
    }
  } else {
    hasErrors = true;
    log("error", `${name}`);
    console.log(`        ${colors.red}${config.description}${colors.reset}`);
    console.log(`        ${colors.red}Issue: ${validation.reason}${colors.reset}`);
    console.log(`        Example: ${config.example}`);
  }
  console.log();
});

// Check optional variables
log("info", "Checking optional environment variables...\n");

Object.entries(optionalVars).forEach(([name, config]) => {
  const value = allEnv[name];

  if (value) {
    log("success", `${name}`);
    console.log(`        ${colors.green}${config.description}${colors.reset}`);
    console.log(`        Value: ${value}`);
  } else {
    log("warning", `${name} (not set, using default)`);
    console.log(`        ${colors.yellow}${config.description}${colors.reset}`);
    console.log(`        Default: ${config.default}`);
  }
  console.log();
});

// Database connectivity check
if (allEnv.DATABASE_URL) {
  log("info", "Database Connectivity Check\n");
  console.log(`   Attempting to validate database URL format...`);
  try {
    const url = new URL(allEnv.DATABASE_URL.replace(/^postgresql:/, "http:"));
    log("success", "Database URL is parseable");
    console.log(`        Host: ${url.hostname}`);
    console.log(`        Port: ${url.port || "5432"}`);
    console.log(`        Database: ${url.pathname.replace("/", "")}`);
    console.log();
  } catch (err) {
    log("error", "Database URL format is invalid");
    console.log(`        ${err.message}\n`);
    hasErrors = true;
  }
}

// GitHub token validation
if (allEnv.GITHUB_TOKEN) {
  log("info", "GitHub Token Validation\n");
  const token = allEnv.GITHUB_TOKEN;
  const isValid = token.startsWith("ghp_") && token.length > 30;
  if (isValid) {
    log("success", "GitHub token format is valid");
    console.log(`        Prefix: ghp_`);
    console.log(`        Length: ${token.length} characters\n`);
  } else {
    log("error", "GitHub token format is invalid");
    console.log(`        Expected: ghp_xxxxxxxxxxxx (36+ chars)\n`);
    hasErrors = true;
  }
}

// Final report
header("Validation Summary");

if (hasErrors) {
  log(
    "error",
    "Validation FAILED - Please fix the errors above before deploying"
  );
  console.log("\n📋 To fix:");
  console.log("   1. Update .env.production file");
  console.log("   2. Or set environment variables: export VAR=value");
  console.log("   3. Re-run this validation script\n");

  process.exit(1);
} else {
  log("success", "All required environment variables are valid!");
  console.log(
    "\n🚀 Environment is ready for deployment to Railway!\n"
  );

  if (hasMissing) {
    log(
      "warning",
      "Some optional variables are using defaults - review carefully"
    );
  }

  process.exit(0);
}
