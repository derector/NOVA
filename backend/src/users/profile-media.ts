export const profileMediaLimit = 8 * 1024 * 1024;
export type MediaSlot = 'avatar' | 'cover';

export function profileMediaType(data: Buffer): string | undefined {
  if (data.length < 12) return;
  if (data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && data.toString('ascii', 12, 16) === 'IHDR') return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  const prefix = data.toString('latin1', 0, 6);
  if (prefix === 'GIF87a' || prefix === 'GIF89a') return 'image/gif';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (data.toString('ascii', 4, 8) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V )$/.test(data.toString('ascii', 8, 12))) return 'video/mp4';
  if (data.readUInt32BE() === 0x1a45dfa3 && data.subarray(0, 64).includes(Buffer.from('\x42\x82\x84webm', 'latin1'))) return 'video/webm';
}
