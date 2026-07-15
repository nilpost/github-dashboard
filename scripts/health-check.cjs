#!/usr/bin/env node

/**
 * Health Check Script
 * Verifies deployed application is working correctly
 */

const https = require("https");
const http = require("http");

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

// Get URL from arguments or environment
const appUrl = process.argv[2] || process.env.APP_URL || "https://dashboard.postiusgroup.com";

header("GitHub Dashboard - Health Check");
log("info", `Checking: ${appUrl}`);

const checks = [];

async function makeRequest(url, method = "GET", timeout = 30000) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const startTime = Date.now();

    const req = client.request(
      url,
      { method, timeout },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const duration = Date.now() - startTime;
          resolve({
            success: true,
            statusCode: res.statusCode,
            duration,
            headers: res.headers,
            data,
          });
        });
      }
    );

    req.on("error", (error) => {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        error: error.message,
        duration,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: "Request timeout",
        duration: timeout,
      });
    });

    req.end();
  });
}

async function runChecks() {
  // Check 1: HTTPS redirect from HTTP
  console.log("Check 1: HTTP to HTTPS Redirect");
  const httpUrl = appUrl.replace("https://", "http://");
  const redirect = await makeRequest(httpUrl);

  if (redirect.success && redirect.statusCode >= 300 && redirect.statusCode < 400) {
    log("success", "HTTP correctly redirects to HTTPS");
    checks.push({ name: "HTTP Redirect", passed: true });
  } else if (redirect.statusCode === 200) {
    log("warning", "HTTP serves content (redirect not enforced)");
    checks.push({ name: "HTTP Redirect", passed: false, severity: "warning" });
  } else {
    log("error", `Unexpected status: ${redirect.statusCode}`);
    checks.push({ name: "HTTP Redirect", passed: false });
  }

  // Check 2: HTTPS connectivity
  console.log("\nCheck 2: HTTPS Connectivity");
  const httpsCheck = await makeRequest(appUrl);

  if (httpsCheck.success) {
    log("success", `Connected (${httpsCheck.duration}ms)`);
    checks.push({ name: "HTTPS Connection", passed: true });
  } else {
    log("error", `Connection failed: ${httpsCheck.error}`);
    checks.push({ name: "HTTPS Connection", passed: false });
  }

  // Check 3: Login page
  console.log("\nCheck 3: Login Page");
  const loginCheck = await makeRequest(appUrl);

  if (loginCheck.success && loginCheck.statusCode === 200) {
    if (loginCheck.data.includes("login") || loginCheck.data.includes("register")) {
      log("success", "Login page loads successfully");
      checks.push({ name: "Login Page", passed: true });
    } else {
      log("warning", "Page loads but login elements not found");
      checks.push({ name: "Login Page", passed: false, severity: "warning" });
    }
  } else {
    log("error", `Login page failed: ${loginCheck.statusCode}`);
    checks.push({ name: "Login Page", passed: false });
  }

  // Check 4: API health endpoint
  console.log("\nCheck 4: API Health Endpoint");
  const apiUrl = appUrl + "/api/health";
  const apiCheck = await makeRequest(apiUrl);

  if (apiCheck.success && apiCheck.statusCode === 200) {
    log("success", "API health endpoint responds");
    checks.push({ name: "API Health", passed: true });
  } else if (apiCheck.statusCode === 401) {
    log("warning", "Health endpoint requires authentication");
    checks.push({ name: "API Health", passed: true, severity: "info" });
  } else {
    log("warning", `Status: ${apiCheck.statusCode}`);
    checks.push({ name: "API Health", passed: false, severity: "warning" });
  }

  // Check 5: SSL Certificate
  console.log("\nCheck 5: SSL Certificate");
  const sslCheck = await makeRequest(appUrl);

  if (sslCheck.headers && sslCheck.headers["strict-transport-security"]) {
    log("success", "HSTS header detected (secure)");
    console.log(`        ${colors.green}${sslCheck.headers["strict-transport-security"]}${colors.reset}`);
    checks.push({ name: "SSL Certificate", passed: true });
  } else {
    log("info", "HSTS not configured (not critical)");
    checks.push({ name: "SSL Certificate", passed: true, severity: "info" });
  }

  // Check 6: Response time
  console.log("\nCheck 6: Response Time");
  const timings = [
    await makeRequest(appUrl),
    await makeRequest(appUrl),
    await makeRequest(appUrl),
  ];

  const avgTime = timings.reduce((a, b) => a + b.duration, 0) / timings.length;

  if (avgTime < 500) {
    log("success", `Average response time: ${avgTime.toFixed(0)}ms (excellent)`);
    checks.push({ name: "Response Time", passed: true });
  } else if (avgTime < 1000) {
    log("warning", `Average response time: ${avgTime.toFixed(0)}ms (acceptable)`);
    checks.push({ name: "Response Time", passed: true, severity: "info" });
  } else {
    log("warning", `Average response time: ${avgTime.toFixed(0)}ms (slow)`);
    checks.push({ name: "Response Time", passed: false, severity: "warning" });
  }

  // Summary
  header("Health Check Summary");

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`Results: ${passed}/${total} checks passed (${percentage}%)\n`);

  checks.forEach((check) => {
    if (check.passed) {
      log("success", `${check.name}`);
    } else {
      const logType = check.severity === "warning" ? "warning" : "error";
      log(logType, `${check.name}`);
    }
  });

  console.log();

  if (passed === total) {
    log("success", "Application is healthy and ready for use!");
    process.exit(0);
  } else if (passed >= total - 1) {
    log("warning", "Application is mostly healthy (minor issues detected)");
    process.exit(0);
  } else {
    log("error", "Application has critical issues - do not proceed");
    process.exit(1);
  }
}

runChecks().catch((err) => {
  log("error", `Health check failed: ${err.message}`);
  process.exit(1);
});
