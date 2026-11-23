import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileMediaType } from '../src/users/profile-media';

test('profile upload identifies image and video formats from bytes', () => {
  const formats = [
    ['image/gif', '474946383961010001000000'],
    ['image/webp', '524946461400000057454250'],
    ['image/png', '89504e470d0a1a0a0000000d49484452'],
    ['image/jpeg', 'ffd8ffe000104a4649460001'],
    ['video/mp4', '000000246674797069736f6d'],
    ['video/webm', '1a45dfa3014282847765626d'],
  ];
  for (const [type, hex] of formats) assert.equal(profileMediaType(Buffer.from(hex, 'hex')), type);
  assert.equal(profileMediaType(Buffer.from('<svg onload="alert()"/>')), undefined);
  assert.equal(profileMediaType(Buffer.from('RIFFfakeWAVE')), undefined);
  assert.equal(profileMediaType(Buffer.from('GIF')), undefined);
});
