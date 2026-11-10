import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSearchCodes, rankSuggestions, splitMatch, type Suggestion } from '../lib/suggest';

const RECENT = 'scnr_recent_search';
const readRecent = (): Suggestion[] => { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch { return []; } };
const saveRecent = (s: Suggestion) => {
  try { localStorage.setItem(RECENT, JSON.stringify([s, ...readRecent().filter(r => r.to !== s.to)].slice(0, 5))); } catch { /* storage blocked: recents are a convenience */ }
};

// Type-ahead for the top bar. Pure in-memory: pages and actions come from the layout, codes from what the Dashboard already loaded. No request, nothing rendered until focus.
function Suggest({ pages, live, urlValue, onChange, onEnter, placeholder, inputRef }: {
  pages: Suggestion[]; live: boolean; urlValue: string; onChange: (v: string) => void; onEnter: (v: string) => void; placeholder: string; inputRef: React.RefObject<HTMLInputElement>;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Own the typed text here: lifting it to the layout re-rendered the whole shell on every keystroke. On pages that filter live the URL (?q=) is the value.
  const [local, setLocal] = useState('');
  const value = live ? urlValue : local;
  const q = value;
  // Fixed app wording ranks on every keystroke (instant). The user's own code names are searched after a short pause, off the typing path.
  const [codeQ, setCodeQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setCodeQ(value), 250); return () => clearTimeout(t); }, [value]);
  const empty = !value.trim();
  const fixed = useMemo(() => (!open ? [] : empty ? readRecent() : rankSuggestions(pages, q)), [open, empty, q, pages]);
  const mine = useMemo(() => (!open || empty || !codeQ.trim() ? [] : rankSuggestions(getSearchCodes(), codeQ, 4)), [open, empty, codeQ]);
  const rows = useMemo(() => (empty ? fixed : [...fixed.slice(0, 8 - Math.min(mine.length, 4)), ...mine]), [fixed, mine, empty]);

  const pick = (s: Suggestion) => {
    saveRecent(s); setLocal(''); onChange(''); setOpen(false); inputRef.current?.blur(); navigate(s.to);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault(); setOpen(true);
      const last = rows.length - 1; // -1 means no row highlighted: the cycle passes through it
      setActive(a => (e.key === 'ArrowDown' ? (a >= last ? -1 : a + 1) : (a <= -1 ? last : a - 1)));
    } else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
    else if (e.key === 'Enter') { if (open && rows[active]) { e.preventDefault(); pick(rows[active]); } else onEnter(e.currentTarget.value); }
  };

  return (
    <>
      <input ref={inputRef} type="search" value={value} placeholder={placeholder} aria-label="Search"
        onChange={e => { if (!live) setLocal(e.target.value); onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }} onKeyDown={onKey} />
      {open && rows.length > 0 && (
        <ul className="suggest" role="listbox" onMouseDown={e => e.preventDefault()}>
          {rows.map((s, i) => {
            const [a, b, c] = empty ? [s.label, '', ''] : splitMatch(s.label, q);
            return (
              <li key={s.to + s.label} role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(s)}>
                {b ? <span><span className="dim">{a}</span><b>{b}</b><span className="dim">{c}</span></span> : <span>{a}</span>}
                {s.sub && <small>{s.sub}</small>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ponytail: on / and /pages the page already filters live per keystroke, and the dropdown measurably slowed that (about +20% typing time at 5,000 codes), so those pages get the plain input. Upgrade: find the render cost, then enable.
export default function SearchSuggest(p: React.ComponentProps<typeof Suggest>) {
  return p.live
    ? <input ref={p.inputRef} type="search" value={p.urlValue} placeholder={p.placeholder} aria-label="Search" onChange={e => p.onChange(e.target.value)} />
    : <Suggest {...p} />;
}
