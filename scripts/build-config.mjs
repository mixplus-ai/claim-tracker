// Netlify build step: writes web/config.js from the CLAIM_API_URL environment variable.
// Without the variable, the committed web/config.js is kept as is.
import { writeFileSync } from "node:fs";

const url = (process.env.CLAIM_API_URL || "").trim();
if (!url) {
  console.log("CLAIM_API_URL is not set; keeping web/config.js from the repository.");
  process.exit(0);
}
if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[\w-]+\/exec$/.test(url)) {
  console.error(`CLAIM_API_URL must be an Apps Script web app URL ending in /exec, got: ${url}`);
  process.exit(1);
}
writeFileSync(
  new URL("../web/config.js", import.meta.url),
  `/* generated at build time from CLAIM_API_URL */\nwindow.CLAIM_CONFIG = ${JSON.stringify({ apiUrl: url })};\n`
);
console.log("web/config.js written with CLAIM_API_URL.");
