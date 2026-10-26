import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { normalizeUrl } from '../lib/url';
import type { LinkInfo } from '../lib/linkCheck';

/** Checks that a typed address loads, 600 ms after typing stops. `data` is null until a check has finished or when the check itself could not run. */
export function useLinkCheck(input: string, enabled = true) {
  const [state, setState] = useState<{ loading: boolean; data: LinkInfo | null; url: string }>({ loading: false, data: null, url: '' });
  useEffect(() => {
    const n = enabled ? normalizeUrl(input) : null;
    if (!n?.ok) { setState({ loading: false, data: null, url: '' }); return; }
    const ctl = new AbortController();
    setState(s => ({ loading: true, data: s.url === n.url ? s.data : null, url: n.url }));
    const t = setTimeout(() => {
      apiFetch<LinkInfo>('/api/link-check', { method: 'POST', body: JSON.stringify({ url: n.url }), signal: ctl.signal })
        .then(data => setState({ loading: false, data, url: n.url }))
        .catch(() => { if (!ctl.signal.aborted) setState({ loading: false, data: null, url: n.url }); });
    }, 600);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [input, enabled]);
  return state;
}
