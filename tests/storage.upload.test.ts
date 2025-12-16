import assert from 'assert';
import { NextRequest } from 'next/server';
import { POST, __resetTestOverrides, __setTestSupabaseClient, __setTestUserSession } from '@/app/api/storage/upload/route';

const uploadedPaths: string[] = [];

const mockSupabase = {
  auth: {
    async getSession() {
      return { data: { session: { user: { id: 'uploader' } } }, error: null };
    },
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File) {
          uploadedPaths.push(`${bucket}/${path}`);
          return { data: { path }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://example.com/${path}` }, error: null };
        },
      };
    },
  },
};

const mockUserSession = {
  user_id: 'uploader',
  email: 'upload@example.com',
  name: 'Uploader',
  role: 'facility_admin',
  company_id: null,
  company_name: null,
  facilities: [],
  current_facility_id: 'facility-upload',
  classes: [],
};

export async function run() {
  __setTestSupabaseClient(async () => mockSupabase as any);
  __setTestUserSession(async () => mockUserSession as any);

  const formData = new FormData();
  const blob = new Blob(['hello world'], { type: 'image/jpeg' });
  const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  formData.append('file', file);
  formData.append('activity_date', '2024-12-01');

  const request = new NextRequest('http://localhost/api/storage/upload', {
    method: 'POST',
    body: formData,
  });

  const response = await POST(request);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.mime_type, 'image/jpeg');
  assert.ok(uploadedPaths.length === 1);

  const invalidForm = new FormData();
  invalidForm.append('activity_date', '2024-12-01');
  const invalidRequest = new NextRequest('http://localhost/api/storage/upload', {
    method: 'POST',
    body: invalidForm,
  });

  const invalidResponse = await POST(invalidRequest);
  assert.equal(invalidResponse.status, 400);

  __resetTestOverrides();
}
