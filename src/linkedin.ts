import { readFile } from "node:fs/promises";

const API_VERSION = process.env.LINKEDIN_VERSION ?? "202608";

function config() {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;
  if (!accessToken || !personUrn) throw new Error("LinkedIn connection is not configured");
  return { accessToken, personUrn };
}

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Linkedin-Version": API_VERSION, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" };
}

export function isConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_PERSON_URN);
}

export async function publishText(text: string): Promise<string> {
  const { accessToken, personUrn } = config();
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST", headers: headers(accessToken), body: JSON.stringify({ author: personUrn, commentary: text, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }),
  });
  if (!response.ok) throw new Error(`LinkedIn publish failed (${response.status}): ${await response.text()}`);
  return response.headers.get("x-restli-id") ?? "published";
}

export async function publishImage(text: string, imagePath: string, altText?: string): Promise<string> {
  const { accessToken, personUrn } = config();
  const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", { method: "POST", headers: headers(accessToken), body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }) });
  if (!init.ok) throw new Error(`Image initialization failed (${init.status}): ${await init.text()}`);
  const data = (await init.json()) as { value: { uploadUrl: string; image: string } };
  const bytes = await readFile(imagePath);
  const upload = await fetch(data.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}` }, body: bytes });
  if (!upload.ok) throw new Error(`Image upload failed (${upload.status})`);
  const response = await fetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: headers(accessToken), body: JSON.stringify({ author: personUrn, commentary: text, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { id: data.value.image, ...(altText ? { altText } : {}) } }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }) });
  if (!response.ok) throw new Error(`LinkedIn publish failed (${response.status}): ${await response.text()}`);
  return response.headers.get("x-restli-id") ?? "published";
}
