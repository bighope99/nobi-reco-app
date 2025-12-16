import assert from 'assert';
import { NextRequest } from 'next/server';
import { POST, __resetTestOverrides, __setTestSupabaseClient, __setTestUserSession } from '@/app/api/activities/analyze/route';

const mockSupabase = {
  auth: {
    async getSession() {
      return { data: { session: { user: { id: 'user-1' } } }, error: null };
    },
  },
};

const mockUserSession = {
  user_id: 'user-1',
  email: 'test@example.com',
  name: 'Tester',
  role: 'facility_admin',
  company_id: null,
  company_name: null,
  facilities: [],
  current_facility_id: 'facility-1',
  classes: [],
};

export async function run() {
  __setTestSupabaseClient(async () => mockSupabase as any);
  __setTestUserSession(async () => mockUserSession as any);

  const body = {
    text: '今日は@たなかはるとくんが粘土遊びを楽しんでいました。',
    mentions: [
      { child_id: 'child-1', name: 'たなか はると' },
      { child_id: 'child-2', name: 'すずき ゆい' },
    ],
  };

  const request = new NextRequest('http://localhost/api/activities/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

  const response = await POST(request);
  const payload = await response.json();

  assert.equal(payload.success, true);
  assert.equal(payload.data.candidates.length, 2);
  assert.ok(payload.data.metadata.tokens_used >= 50);

  const firstCandidate = payload.data.candidates[0];
  assert.equal(firstCandidate.child_id, 'child-1');
  assert.ok(firstCandidate.extracted_fact.includes('たなか はると'));

  // invalid request should fail
  const invalidRequest = new NextRequest('http://localhost/api/activities/analyze', {
    method: 'POST',
    body: JSON.stringify({ text: '', mentions: [] }),
    headers: { 'content-type': 'application/json' },
  });

  const invalidResponse = await POST(invalidRequest);
  assert.equal(invalidResponse.status, 400);

  __resetTestOverrides();
}
