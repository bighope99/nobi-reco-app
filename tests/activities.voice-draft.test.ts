import assert from 'assert';
import { NextRequest } from 'next/server';
import { POST, __resetTestOverrides, __setTestSupabaseClient, __setTestUserSession } from '@/app/api/activities/voice-draft/route';

const mockSupabase = {
  auth: {
    async getSession() {
      return { data: { session: { user: { id: 'user-voice' } } }, error: null };
    },
  },
};

const mockUserSession = {
  user_id: 'user-voice',
  email: 'voice@example.com',
  name: 'Voice Tester',
  role: 'facility_admin',
  company_id: null,
  company_name: null,
  facilities: [],
  current_facility_id: 'facility-voice',
  classes: [],
};

export async function run() {
  __setTestSupabaseClient(async () => mockSupabase as any);
  __setTestUserSession(async () => mockUserSession as any);

  const request = new NextRequest('http://localhost/api/activities/voice-draft', {
    method: 'POST',
    body: JSON.stringify({ audio_url: 'https://example.com/audio.wav', language: 'ja' }),
    headers: { 'content-type': 'application/json' },
  });

  const response = await POST(request);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.ok(payload.data.transcript.length > 0);

  const invalidRequest = new NextRequest('http://localhost/api/activities/voice-draft', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
  });

  const invalidResponse = await POST(invalidRequest);
  assert.equal(invalidResponse.status, 400);

  __resetTestOverrides();
}
