import { File, Paths } from 'expo-file-system';
import { UploadType } from 'expo-file-system';
import { finalizeEvent } from 'nostr-tools';

export async function uploadImage(uri: string, mimeType: string, privateKeyHex?: string): Promise<string | null> {
  try {
    const ext = mimeType.split('/')[1] || 'jpg';
    const uniqueId = Math.random().toString(36).slice(2, 8);
    const filename = 'upload_' + uniqueId + '.' + ext;

    const src = new File(uri);
    const dest = new File(Paths.cache, filename);
    await src.copy(dest);

    const headers: Record<string, string> = {};

    // NIP-98 auth for nostr.build
    if (privateKeyHex) {
      const sk = hexToBytes(privateKeyHex);
      const authEvent = finalizeEvent(
        {
          kind: 27235,
          content: 'Upload file',
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['u', 'https://nostr.build/api/v2/nip96/upload'],
            ['method', 'POST'],
          ],
        },
        sk,
      );
      const authB64 = btoa(JSON.stringify(authEvent));
      headers['Authorization'] = 'Nostr ' + authB64;
    }

    const result = await dest.upload('https://nostr.build/api/v2/nip96/upload', {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      httpMethod: 'POST',
      headers,
    });

    console.log('uploadImage: nostr.build responded', result.body);
    const json = JSON.parse(result.body);
    if (json?.status === 'success') {
      const urlTag = json.nip94_event?.tags?.find((t: string[]) => t[0] === 'url');
      if (urlTag?.[1]) return urlTag[1];
      if (json?.data?.url) return json.data.url;
    }

    return null;
  } catch (e) {
    console.error('uploadImage failed', e);
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
