import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * A boundary around the routed page. Keyed on the path so navigating away from a page that
 * threw gives a fresh mount: without the key, React keeps the error state and every later
 * page stays broken too.
 */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} label="This page">
      {children}
    </ErrorBoundary>
  );
}
