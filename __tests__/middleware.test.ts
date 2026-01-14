import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';

// Mock getSession function that will be controlled in tests
const mockGetSession = jest.fn();

// Helper function to create a mock JWT token with encoded app_metadata
function createMockJWT(role?: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    app_metadata: role ? { role } : {},
    sub: 'test-user-id',
    exp: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
  };

  // Base64URL encode (simplified for testing)
  const encodeBase64URL = (obj: object): string => {
    const json = JSON.stringify(obj);
    return Buffer.from(json).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = encodeBase64URL(header);
  const payloadEncoded = encodeBase64URL(payload);
  const signature = 'mock-signature';

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn((options?: { request: { headers: Headers } }) => ({
      cookies: {
        set: jest.fn(),
      },
    })),
    redirect: jest.fn((url: URL) => ({
      url: url.toString(),
      type: 'redirect',
    })),
  },
  NextRequest: jest.fn(),
}));

// Mock Supabase SSR
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

describe('middleware', () => {
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock request
    mockRequest = {
      nextUrl: {
        pathname: '/login',
      } as URL,
      url: 'http://localhost:3000/login',
      cookies: {
        get: jest.fn(),
        set: jest.fn(),
      } as any,
      headers: new Headers(),
    };
  });

  describe('Role-based redirect for logged-in users accessing /login', () => {
    it('should redirect site_admin to /admin', async () => {
      // Setup: site_admin role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('site_admin'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/admin', mockRequest.url)
      );
    });

    it('should redirect company_admin to /admin', async () => {
      // Setup: company_admin role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('company_admin'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/admin', mockRequest.url)
      );
    });

    it('should redirect facility_admin to /dashboard', async () => {
      // Setup: facility_admin role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('facility_admin'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });

    it('should redirect staff to /dashboard', async () => {
      // Setup: staff role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('staff'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });

    it('should fallback to /dashboard when role is not available', async () => {
      // Setup: no role in JWT token (undefined)
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT(), // no role parameter
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });
  });

  describe('Authentication redirect', () => {
    it('should redirect to /login when not authenticated', async () => {
      // Setup: no session
      mockGetSession.mockResolvedValue({
        data: {
          session: null,
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/dashboard';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/login', mockRequest.url)
      );
    });

    it('should allow access to /login when not authenticated', async () => {
      // Setup: no session
      mockGetSession.mockResolvedValue({
        data: {
          session: null,
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow access to /password/setup when not authenticated', async () => {
      // Setup: no session
      mockGetSession.mockResolvedValue({
        data: {
          session: null,
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/password/setup';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe('/admin access control', () => {
    it('should redirect to /login when not authenticated accessing /admin', async () => {
      // Setup: no session
      mockGetSession.mockResolvedValue({
        data: {
          session: null,
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/admin';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/login', mockRequest.url)
      );
    });

    it('should allow site_admin to access /admin', async () => {
      // Setup: site_admin role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('site_admin'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/admin';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow company_admin to access /admin', async () => {
      // Setup: company_admin role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('company_admin'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/admin';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should redirect facility_admin from /admin to /dashboard', async () => {
      // Setup: facility_admin role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('facility_admin'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/admin';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });

    it('should redirect staff from /admin to /dashboard', async () => {
      // Setup: staff role in JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT('staff'),
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/admin';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });

    it('should redirect to /dashboard when role is not available accessing /admin', async () => {
      // Setup: no role in JWT token (undefined)
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: createMockJWT(), // no role parameter
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/admin';

      const response = await middleware(mockRequest as NextRequest);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JWT gracefully', async () => {
      // Setup: session with invalid JWT token
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'invalid.jwt.token',
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      // Should fallback to /dashboard when JWT decode fails
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });

    it('should handle getSession error gracefully', async () => {
      // Setup: getSession returns error
      mockGetSession.mockResolvedValue({
        data: {
          session: null,
        },
        error: {
          message: 'Invalid token',
          status: 401,
        } as any,
      });

      mockRequest.nextUrl!.pathname = '/dashboard';

      const response = await middleware(mockRequest as NextRequest);

      // Should redirect to /login
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/login', mockRequest.url)
      );
    });

    it('should handle JWT with missing app_metadata', async () => {
      // Setup: JWT token without app_metadata
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = {
        sub: 'test-user-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        // app_metadata is missing
      };

      const encodeBase64URL = (obj: object): string => {
        const json = JSON.stringify(obj);
        return Buffer.from(json).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      };

      const headerEncoded = encodeBase64URL(header);
      const payloadEncoded = encodeBase64URL(payload);
      const token = `${headerEncoded}.${payloadEncoded}.mock-signature`;

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: token,
            user: { id: 'test-user-id' },
          },
        },
        error: null,
      });

      mockRequest.nextUrl!.pathname = '/login';

      const response = await middleware(mockRequest as NextRequest);

      // Should fallback to /dashboard
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/dashboard', mockRequest.url)
      );
    });
  });
});
