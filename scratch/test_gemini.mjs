
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "http://127.0.0.1:7897";
console.log("Using proxy:", proxyUrl);

setGlobalDispatcher(new ProxyAgent(proxyUrl));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function test() {
  try {
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    console.log("Using model:", modelName);
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
    
    const result = await model.generateContent("Hello, are you there?");
    const response = await result.response;
    console.log("Response:", response.text());
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
