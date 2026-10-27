// Text of the public free tools. The page (src/pages/Tools.tsx) adds the interactive part;
// src/lib/seo.ts turns the title and description into <title>, sitemap and structured data.
export interface FreeTool { slug: string; title: string; h1: string; intro: string; description: string }

export const FREE_QR_TOOLS: FreeTool[] = [
  { slug: 'qr-scanner', title: 'Free QR Code Scanner Online', h1: 'QR code scanner', intro: 'Point your camera at a QR code, or upload a photo of one. You see what is inside before anything opens.', description: 'Scan any QR code with your camera or from a photo. Free, no sign-in, and nothing leaves your device.' },
  { slug: 'utm-builder', title: 'Free UTM Link Builder', h1: 'UTM link builder', intro: 'Add source, medium and campaign tags to a link so your analytics shows which flyer, post or poster brought the visit.', description: 'Free UTM link builder. Add utm_source, utm_medium and utm_campaign tags to any link and copy it.' },
  { slug: 'google-review-link', title: 'Google Review Link Generator', h1: 'Google review link maker', intro: 'Make a link that opens the review box for your business on Google. Put it on a receipt, a table tent or a QR code.', description: 'Free Google review link generator. Turn your Place ID into a direct link to the review box.' },
  { slug: 'whatsapp-link', title: 'Free WhatsApp Link Generator', h1: 'WhatsApp link maker', intro: 'Make a click-to-chat link that opens WhatsApp with your number and, if you like, a message already typed.', description: 'Free WhatsApp link generator. Create a wa.me click-to-chat link with a ready message.' },
  { slug: 'qr-generator', title: 'Free QR Code Generator (PNG, SVG)', h1: 'Free QR code generator', intro: 'Make a static QR code for a link or text, in your colours. Download it as PNG or SVG.', description: 'Free QR code generator. Make a static QR code for a link or text with your own colours and download PNG or SVG.' },
];
