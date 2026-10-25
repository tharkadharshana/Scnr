import React, { useEffect, useRef, useState } from 'react';
import './phoneframe.css';

const W = 390, H = 780; // a common phone viewport; the page inside lays out at this size, then scales to fit the frame
const NO_SCROLLBAR = '<style>html{scrollbar-width:none}::-webkit-scrollbar{display:none}</style>';

/** A phone around an iframe, so a preview looks like the page a scan opens. The iframe stays sandboxed. */
export default function PhoneFrame({ title, srcDoc }: { title: string; srcDoc: string }) {
  const screen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = screen.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const doc = /<head[^>]*>/i.test(srcDoc) ? srcDoc.replace(/<head[^>]*>/i, m => m + NO_SCROLLBAR) : NO_SCROLLBAR + srcDoc;
  return (
    <div className="phone">
      <i className="phone-notch" aria-hidden="true" />
      <div className="phone-screen" ref={screen} style={{ height: H * scale }}>
        <iframe title={title} srcDoc={doc} sandbox="" style={{ width: W, height: H, transform: `scale(${scale})` }} />
      </div>
    </div>
  );
}
