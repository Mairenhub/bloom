export type KlingCreateTaskInput = {
  model_name?: string;
  image: string;
  image_tail: string;
  prompt: string;
  negative_prompt?: string;
  mode?: "std" | "pro";
  duration?: "5" | "10" | 5 | 10;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  callback_url?: string | null;
  external_task_id?: string;
};

export type KlingTaskResponse = {
  code: number;
  message: string;
  request_id?: string;
  data?: any;
};

export function getKlingBaseUrl(): string {
  // Use the KlingAI API URL for external API calls
  const baseUrl = process.env.NEXT_PUBLIC_KLINGAI_URL || "https://api-singapore.klingai.com";
  return baseUrl;
}

import jwt from 'jsonwebtoken';

export function buildJWTToken(): string | undefined {
  const accessKey = process.env.NEXT_PUBLIC_KLING_ACCESS_KEY;
  const secretKey = process.env.NEXT_PUBLIC_KLING_SECRET_KEY;
  
  
  if (!accessKey || !secretKey) {
    console.log("❌ [KLING DEBUG] Missing credentials - returning undefined");
    return undefined;
  }
  
  try {
    const headers = {
      "alg": "HS256",
      "typ": "JWT"
    };
    
    const payload = {
      "iss": accessKey,
      "exp": Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
      "nbf": Math.floor(Date.now() / 1000) - 5 // 5 seconds ago
    };
    
    const token = jwt.sign(payload, secretKey, { header: headers });

    return token;
  } catch (error) {
    console.log("❌ [KLING DEBUG] JWT token creation failed:", error);
    return undefined;
  }
}

export function createKlingHeaders(): HeadersInit {

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const jwtToken = buildJWTToken();
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  } else {
    console.log("⚠️ [KLING DEBUG] No JWT authorization header added");
  }
  return headers;
}

export function stripDataUrlPrefix(possiblyDataUrl: string): string {
  // If value is a data URL like: data:image/png;base64,XXXXX → return only the base64 payload
  
  const commaIndex = possiblyDataUrl.indexOf(",");
  if (possiblyDataUrl.startsWith("data:") && commaIndex !== -1) {
    const result = possiblyDataUrl.slice(commaIndex + 1);
    return result;
  }
  console.log("ℹ️ [KLING DEBUG] No data URL prefix to strip, returning original");
  return possiblyDataUrl;
}



