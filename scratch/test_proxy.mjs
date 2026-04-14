
import { ProxyAgent, request } from "undici";
import fs from "fs";

// Manually parse .env.local since dotenv might not be installed
const envFile = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envFile.split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const proxyUrl = env.HTTPS_PROXY || env.HTTP_PROXY || "http://127.0.0.1:7897";
const apiKey = env.GEMINI_API_KEY;

console.log("Testing proxy:", proxyUrl);
console.log("API Key found:", apiKey ? "Yes (starts with " + apiKey.slice(0, 5) + ")" : "No");

async function test() {
  const dispatcher = new ProxyAgent(proxyUrl);
  try {
    const modelName = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    console.log("Fetching URL:", url.replace(apiKey, "REDACTED"));
    
    const { statusCode, body } = await request(url, {
      method: "POST",
      dispatcher,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello, what is your name?" }] }]
      }),
    });

    console.log("Status Code:", statusCode);
    const result = await body.json();
    console.log("Response Body:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

test();
