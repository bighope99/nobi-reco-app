import { render, screen, act } from '@testing-library/react';
import ChildForm from '@/components/children/ChildForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

beforeEach(() => {
  global.fetch = jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url === '/api/children/classes') {
      return {
        ok: true,
        json: async () => ({ success: true, data: { classes: [] } }),
      } as Response;
    }
    if (url === '/api/schools') {
      return {
        ok: true,
        json: async () => ({ success: true, data: { schools: [] } }),
      } as Response;
    }
    return { ok: false, json: async () => ({ success: false }) } as Response;
  });
  window.alert = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ChildForm scroll spy', () => {
  it('updates active section based on scroll position', () => {
    // Mock getBoundingClientRect for each section
    const originalGetElementById = document.getElementById.bind(document);
    jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      const element = originalGetElementById(id);
      if (element) {
        // Simulate: affiliation section has scrolled past the offset threshold
        jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
          top: id === 'basic' ? -200 : id === 'affiliation' ? 50 : 800,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        });
      }
      return element;
    });

    render(<ChildForm mode="new" />);

    // Trigger scroll event
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // The "basic" section should be active because its top (-200) is <= offset (120)
    // and "affiliation" section's top (50) is also <= 120, so "affiliation" should be the active one
    const navLinks = screen.getAllByRole('link');
    const affiliationLink = navLinks.find((link) =>
      link.textContent?.includes('所属・契約')
    );

    expect(affiliationLink?.className).toContain('bg-indigo-50');
  });

  it('activates first section when at top of page', () => {
    const originalGetElementById = document.getElementById.bind(document);
    jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      const element = originalGetElementById(id);
      if (element) {
        // All sections are below the viewport offset
        jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
          top: 200,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        });
      }
      return element;
    });

    render(<ChildForm mode="new" />);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // When no section has scrolled past the offset, "basic" (first) should be active
    const navLinks = screen.getAllByRole('link');
    const basicLink = navLinks.find((link) =>
      link.textContent?.includes('基本情報')
    );

    expect(basicLink?.className).toContain('bg-indigo-50');
  });
});
