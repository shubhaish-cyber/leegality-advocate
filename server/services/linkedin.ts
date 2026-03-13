import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decrypt } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const LINKEDIN_API = 'https://api.linkedin.com';

interface PublishResult {
  success: boolean;
  linkedInPostId?: string;
  error?: string;
}

const LINKEDIN_HEADERS = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'LinkedIn-Version': '202504',
  'X-Restli-Protocol-Version': '2.0.0',
});

/**
 * Poll a media asset (video or document) until LinkedIn finishes processing.
 * Status values: WAITING_UPLOAD → PROCESSING → AVAILABLE | PROCESSING_FAILED
 */
async function waitForMediaReady(
  accessToken: string,
  mediaUrn: string,
  endpoint: 'videos' | 'documents',
  maxAttempts = 30,
  intervalMs = 2000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${LINKEDIN_API}/rest/${endpoint}/${encodeURIComponent(mediaUrn)}`,
      { method: 'GET', headers: LINKEDIN_HEADERS(accessToken) }
    );
    if (res.ok) {
      const data = await res.json();
      const status = data.status;
      console.log(`[${endpoint}] Poll ${i + 1}/${maxAttempts}: status=${status}`);
      if (status === 'AVAILABLE') return;
      if (status === 'PROCESSING_FAILED') {
        throw new Error(`${endpoint} processing failed for ${mediaUrn}`);
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `${endpoint} processing timed out after ${(maxAttempts * intervalMs) / 1000}s`
  );
}

/**
 * Upload an image to LinkedIn and get the image URN
 */
async function uploadImage(
  accessToken: string,
  personUrn: string,
  filePath: string
): Promise<string> {
  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_API}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: LINKEDIN_HEADERS(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Failed to initialize image upload: ${initRes.status} ${err}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value.uploadUrl;
  const imageUrn = initData.value.image;

  // Step 2: Upload the image binary
  const fullPath = path.join(UPLOADS_DIR, filePath);
  const imageBuffer = fs.readFileSync(fullPath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload image: ${uploadRes.status} ${err}`);
  }

  return imageUrn;
}

/**
 * Upload a video to LinkedIn and get the video URN.
 * LinkedIn Videos API: initializeUpload → PUT binary → finalizeUpload
 */
async function uploadVideo(
  accessToken: string,
  personUrn: string,
  filePath: string
): Promise<string> {
  const fullPath = path.join(UPLOADS_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Video file not found: ${fullPath}`);
  }
  const fileBuffer = fs.readFileSync(fullPath);
  const fileSizeBytes = fileBuffer.length;
  console.log(`[video] Starting upload: file=${filePath}, size=${fileSizeBytes} bytes`);

  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_API}/rest/videos?action=initializeUpload`, {
    method: 'POST',
    headers: LINKEDIN_HEADERS(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Failed to initialize video upload: ${initRes.status} ${err}`);
  }

  const initData = await initRes.json();
  const instructions = initData.value?.uploadInstructions;
  if (!instructions || instructions.length === 0) {
    throw new Error('No upload instructions returned from LinkedIn');
  }
  const videoUrn = initData.value.video;
  const uploadToken = initData.value.uploadToken;
  console.log(`[video] Initialize OK: videoUrn=${videoUrn}, parts=${instructions.length}`);

  // Step 2: Upload each chunk per LinkedIn's upload instructions
  const uploadedPartIds: string[] = [];

  for (let partIdx = 0; partIdx < instructions.length; partIdx++) {
    const { uploadUrl: partUrl, firstByte, lastByte } = instructions[partIdx];
    const chunk = fileBuffer.slice(firstByte, lastByte + 1); // lastByte is inclusive

    console.log(`[video] Uploading part ${partIdx + 1}/${instructions.length} (bytes ${firstByte}-${lastByte}, ${chunk.length} bytes)`);

    const partRes = await fetch(partUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    });

    if (!partRes.ok) {
      const err = await partRes.text();
      console.error(`[video] Part ${partIdx + 1} upload failed: ${partRes.status}`, err.substring(0, 500));
      throw new Error(`Failed to upload video part ${partIdx + 1}: ${partRes.status} ${err.substring(0, 200)}`);
    }

    const etag = (partRes.headers.get('etag') || '').replace(/"/g, '');
    uploadedPartIds.push(etag);
    console.log(`[video] Part ${partIdx + 1} OK: etag="${etag}"`);
  }

  // Step 3: Finalize upload with all part ETags
  console.log(`[video] All ${uploadedPartIds.length} parts uploaded, finalizing...`);
  const finalizeRes = await fetch(`${LINKEDIN_API}/rest/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: LINKEDIN_HEADERS(accessToken),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken,
        uploadedPartIds,
      },
    }),
  });

  if (!finalizeRes.ok) {
    const err = await finalizeRes.text();
    console.error(`[video] Finalize failed: ${finalizeRes.status}`, err.substring(0, 500));
    throw new Error(`Failed to finalize video upload: ${finalizeRes.status} ${err.substring(0, 200)}`);
  }
  console.log(`[video] Finalize OK, waiting for processing...`);

  // Step 4: Wait for LinkedIn to finish processing the video
  await waitForMediaReady(accessToken, videoUrn, 'videos');

  console.log(`[video] Upload complete: ${videoUrn}`);
  return videoUrn;
}

/**
 * Upload a document (PDF) to LinkedIn and get the document URN.
 * LinkedIn Documents API: initializeUpload → PUT binary
 */
async function uploadDocument(
  accessToken: string,
  personUrn: string,
  filePath: string
): Promise<string> {
  const fullPath = path.join(UPLOADS_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Document file not found: ${fullPath}`);
  }
  const fileBuffer = fs.readFileSync(fullPath);
  console.log(`[document] Starting upload: file=${filePath}, size=${fileBuffer.length} bytes`);

  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_API}/rest/documents?action=initializeUpload`, {
    method: 'POST',
    headers: LINKEDIN_HEADERS(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Failed to initialize document upload: ${initRes.status} ${err}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value.uploadUrl;
  const documentUrn = initData.value.document;
  console.log(`[document] Initialize OK: documentUrn=${documentUrn}`);

  // Step 2: Upload the document binary
  console.log(`[document] Uploading binary (${fileBuffer.length} bytes) to LinkedIn...`);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error(`[document] Binary upload failed: ${uploadRes.status}`, err.substring(0, 500));
    throw new Error(`Failed to upload document: ${uploadRes.status} ${err.substring(0, 200)}`);
  }
  console.log(`[document] Binary upload OK, waiting for processing...`);

  // Step 3: Wait for LinkedIn to finish processing the document
  await waitForMediaReady(accessToken, documentUrn, 'documents');

  console.log(`[document] Upload complete: ${documentUrn}`);
  return documentUrn;
}

/**
 * Create a LinkedIn post with media (image, video, or document) on behalf of a user
 */
export async function publishToLinkedIn(
  encryptedAccessToken: string,
  linkedInId: string,
  caption: string,
  mediaFilename: string,
  mediaType: 'image' | 'video' | 'document' = 'image',
  mediaTitle?: string | null
): Promise<PublishResult> {
  try {
    console.log(`[publish] Starting: mediaType=${mediaType}, file=${mediaFilename}, linkedInId=${linkedInId}`);
    const accessToken = decrypt(encryptedAccessToken);
    const personUrn = `urn:li:person:${linkedInId}`;

    // Upload the media based on type
    let mediaUrn: string;
    switch (mediaType) {
      case 'video':
        mediaUrn = await uploadVideo(accessToken, personUrn, mediaFilename);
        break;
      case 'document':
        mediaUrn = await uploadDocument(accessToken, personUrn, mediaFilename);
        break;
      case 'image':
      default:
        mediaUrn = await uploadImage(accessToken, personUrn, mediaFilename);
        break;
    }

    // Build media object — LinkedIn requires different fields per media type:
    // Images support altText; videos and documents require title instead
    const mediaContent: Record<string, string> = { id: mediaUrn };
    if (mediaType === 'image') {
      mediaContent.altText = 'Shared via Leegality Advocate';
    } else {
      mediaContent.title = mediaTitle || 'Shared via Leegality Advocate';
    }

    // Create the post
    console.log(`[publish] Media uploaded: ${mediaUrn}, creating post...`);
    const postRes = await fetch(`${LINKEDIN_API}/rest/posts`, {
      method: 'POST',
      headers: LINKEDIN_HEADERS(accessToken),
      body: JSON.stringify({
        author: personUrn,
        commentary: caption,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: mediaContent,
        },
        lifecycleState: 'PUBLISHED',
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      console.error('LinkedIn post creation failed:', postRes.status, err);
      return { success: false, error: `LinkedIn API error: ${postRes.status}` };
    }

    // LinkedIn returns the post ID in the x-restli-id header
    const postId = postRes.headers.get('x-restli-id') || 'unknown';
    console.log(`LinkedIn post created successfully: ${postId} (mediaType=${mediaType})`);

    return { success: true, linkedInPostId: postId };
  } catch (err: any) {
    console.error('LinkedIn publish error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
