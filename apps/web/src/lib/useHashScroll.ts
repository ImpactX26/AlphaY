import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Scroll to the `#section` in the URL once it exists.
 *
 * A plain effect on mount is too early: these sections render after their query resolves, so the
 * element the hash names is usually not in the document yet. Browsers only honour a hash on a real
 * page load, and a client-side navigation to `/app/profile#video` is not one — without this, "Record
 * video" lands at the top of a long page and the recorder it asked for is below the fold.
 *
 * Gives up after a few seconds rather than observing forever, and leaves the page where it is if the
 * person has already started scrolling themselves.
 */
export function useHashScroll(deps: unknown[] = []) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    const startedAt = Date.now();
    let frame = 0;
    const look = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (Date.now() - startedAt < 4000) frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, ...deps]);
}
