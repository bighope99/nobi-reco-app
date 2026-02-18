"use client";

import * as React from "react";
import { useRef, useEffect, useState, useCallback } from "react";

import { cn } from "@/lib/utils";

interface StickyHorizontalScrollbarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A component that wraps content with a horizontally scrollable container
 * and displays a sticky scrollbar fixed at the bottom of the viewport.
 * The scrollbar is hidden when the bottom of the content is visible.
 */
export function StickyHorizontalScrollbar({
  children,
  className,
}: StickyHorizontalScrollbarProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dummyScrollRef = useRef<HTMLDivElement>(null);
  const dummyContentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [scrollWidth, setScrollWidth] = useState(0);
  const [isBottomVisible, setIsBottomVisible] = useState(false);

  // Track if we're currently syncing to prevent infinite loops
  const isSyncingRef = useRef(false);

  // Update dummy scrollbar width to match content
  const updateScrollWidth = useCallback(() => {
    if (contentRef.current) {
      setScrollWidth(contentRef.current.scrollWidth);
    }
  }, []);

  // Sync scroll position from content to dummy
  const handleContentScroll = useCallback(() => {
    if (isSyncingRef.current || !contentRef.current || !dummyScrollRef.current) {
      return;
    }

    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      if (contentRef.current && dummyScrollRef.current) {
        dummyScrollRef.current.scrollLeft = contentRef.current.scrollLeft;
      }
      isSyncingRef.current = false;
    });
  }, []);

  // Sync scroll position from dummy to content
  const handleDummyScroll = useCallback(() => {
    if (isSyncingRef.current || !contentRef.current || !dummyScrollRef.current) {
      return;
    }

    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      if (contentRef.current && dummyScrollRef.current) {
        contentRef.current.scrollLeft = dummyScrollRef.current.scrollLeft;
      }
      isSyncingRef.current = false;
    });
  }, []);

  // Setup IntersectionObserver to detect when bottom of content is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsBottomVisible(entry.isIntersecting);
        });
      },
      {
        root: null, // viewport
        rootMargin: "0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update scroll width on mount and when content changes
  useEffect(() => {
    updateScrollWidth();

    // Also observe resize changes
    const content = contentRef.current;
    if (!content) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScrollWidth();
    });

    resizeObserver.observe(content);

    // Observe children changes
    const mutationObserver = new MutationObserver(() => {
      updateScrollWidth();
    });

    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateScrollWidth]);

  // Determine if we need to show the scrollbar at all
  const hasHorizontalScroll =
    contentRef.current && contentRef.current.scrollWidth > contentRef.current.clientWidth;

  return (
    <div className={cn("relative", className)}>
      {/* Actual scrollable content */}
      <div
        ref={contentRef}
        className="overflow-x-auto"
        onScroll={handleContentScroll}
      >
        {children}
        {/* Sentinel element at the bottom of the scroll container */}
        <div ref={sentinelRef} className="h-0 w-full" />
      </div>

      {/* Sticky scrollbar fixed at bottom of viewport */}
      {!isBottomVisible && (
        <div
          ref={dummyScrollRef}
          className="fixed bottom-0 left-0 right-0 z-50 overflow-x-auto overflow-y-hidden bg-white/80 backdrop-blur-sm border-t border-gray-200"
          style={{ height: "16px" }}
          onScroll={handleDummyScroll}
          aria-hidden="true"
        >
          <div
            ref={dummyContentRef}
            style={{ width: scrollWidth, height: "1px" }}
          />
        </div>
      )}
    </div>
  );
}
