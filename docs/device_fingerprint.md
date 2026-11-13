# **Complete guide to browser fingerprinting, device identification and visitor intelligence**

Let's approach this as an engineering subject rather than just collecting some JavaScript properties and hashing them.

What you're exploring is a combination of several technologies:

1. **Browser fingerprinting** – identifying a browser using the characteristics it exposes.
2. **Device fingerprinting** – estimating whether visits originate from the same underlying device.
3. **Browser intelligence** – understanding the capabilities, configuration and environment of a visitor's browser.
4. **Visitor identification** – recognizing returning visitors across multiple sessions.
5. **Device profiling** – understanding device classes, display capabilities, hardware and browser configurations.
6. **Probabilistic identity resolution** – estimating whether two different visits belong to the same visitor or device.

These techniques are used in advertising technology, fraud detection, cybersecurity, analytics, payment security and bot detection.

There is an important engineering concept to understand from the beginning:

**A browser does not expose a permanent hardware identifier that websites can universally access.**

You cannot simply ask Chrome for a computer's serial number, motherboard ID, MAC address or Windows machine ID. Browsers deliberately restrict that information.

Instead, fingerprinting works by combining many individually imperfect characteristics into a statistical profile.

Let's build up the subject from the fundamentals.

# **1. What exactly is a browser fingerprint?**

Imagine 1,000 people visit your website.

You collect the following information:

| Property       | Visitor A | Visitor B | Visitor C |
| -------------- | --------- | --------- | --------- |
| Browser        | Chrome    | Chrome    | Firefox   |
| OS             | Windows   | Windows   | Windows   |
| Screen         | 1920×1080 | 1366×768  | 1920×1080 |
| CPU threads    | 8         | 4         | 8         |
| RAM estimate   | 8 GB      | 8 GB      | 16 GB     |
| Timezone       | Colombo   | Colombo   | London    |
| WebGL renderer | NVIDIA    | Intel     | AMD       |

Individually, none of these properties uniquely identifies somebody.

But when you combine enough properties, the resulting combination becomes increasingly distinctive.

For example:

```
{
  "browser": "Chrome",
  "os": "Windows",
  "screen": "1920x1080",
  "cpu": 8,
  "memory": 8,
  "timezone": "Asia/Colombo",
  "webgl": "NVIDIA",
  "touch": 10
}
```

This combination is a fingerprint candidate.

A website can normalize these characteristics and calculate a hash:

```
SHA256(normalized_fingerprint_data)
```

Result:

```
8f5b...e91c
```

On the next visit, it collects the same properties, calculates another hash and compares them.

If the hash matches, the browser environment appears identical.

If it doesn't match, something changed.

However, this leads to an important distinction:

- Exact hash match = same collected fingerprint attributes.
- Similar fingerprint = potentially the same browser/device.
- Neither proves that the same person visited.

# **2. Understanding all the browser data you can collect**

Let's break down the browser APIs and information available to ordinary websites.

I'll categorize them by what they tell you, how useful they are and how stable they tend to be.

## **2.1 Navigator API – browser and device information**

The `navigator` object is one of the first places to investigate.

```
console.log(navigator);
```

Some useful properties:

| Property            | What it tells you                   | Usefulness    |
| ------------------- | ----------------------------------- | ------------- |
| userAgent           | Browser identification string       | Medium        |
| platform            | Platform information                | Low–medium    |
| language            | Preferred language                  | Low           |
| languages           | Preferred language list             | Low–medium    |
| hardwareConcurrency | Reported logical CPU count          | Medium        |
| deviceMemory        | Approximate RAM category            | Medium        |
| maxTouchPoints      | Maximum simultaneous touch contacts | Medium        |
| cookieEnabled       | Cookie availability                 | Low           |
| doNotTrack          | DNT preference                      | Low           |
| pdfViewerEnabled    | Built-in PDF viewer availability    | Low           |
| vendor              | Browser vendor information          | Low           |
| webdriver           | WebDriver automation signal         | Bot detection |
| onLine              | Browser's online-status indication  | Low           |

### **Important: hardwareConcurrency**

```
navigator.hardwareConcurrency
```

Suppose it returns:

```
8
```

This generally means the browser reports eight logical processing threads.

It does not necessarily mean the computer has eight physical CPU cores.

Some browsers deliberately reduce the reported value for privacy or resource-management reasons.

### **Important: deviceMemory**

```
navigator.deviceMemory
```

Example:

```
8
```

This is an approximate RAM category, not an exact measurement.

It is also not universally supported.

### **Important: userAgent**

Example:

```
Mozilla/5.0 (Windows NT 10.0; Win64; x64)
AppleWebKit/537.36 (KHTML, like Gecko)
Chrome/131.0.0.0 Safari/537.36
```

This can help estimate:

- Browser family.
- Browser version.
- Operating system family.
- Architecture information, where exposed.
- Rendering engine.

However, modern browsers increasingly reduce user-agent information.

There is also the User-Agent Client Hints API:

```
navigator.userAgentData
```

Where available, it can provide additional browser information such as:

- Browser brands.
- Mobile indicator.
- Platform.
- Architecture.
- Bitness.
- Model information in some environments.

High-entropy hints require additional access through `getHighEntropyValues()` and may be restricted.

**My recommendation:** Collect browser identity for analytics and compatibility, but don't give it excessive weight in device matching.

## **2.2 Screen API – display characteristics**

```
screen.width
screen.height
screen.availWidth
screen.availHeight
screen.colorDepth
screen.pixelDepth
window.devicePixelRatio
```

You can gather:

- Physical display's reported CSS dimensions.
- Available screen area.
- Color depth.
- Pixel ratio.
- Orientation.
- Window dimensions.
- Browser viewport dimensions.

Example:

```
{
  screen: {
    width: 1920,
    height: 1080,
    colorDepth: 24
  },
  window: {
    innerWidth: 1440,
    innerHeight: 850,
    outerWidth: 1460,
    outerHeight: 950
  },
  devicePixelRatio: 1.25
}
```

Why is this useful?

A 1920×1080 display with a device pixel ratio of 1.25 produces a different rendering environment from a 1920×1080 display with a ratio of 1.

But remember:

- Users can change resolution.
- Users can zoom.
- Users can connect external monitors.
- Browser windows can be resized.
- Remote desktop sessions can change display properties.

**Use screen properties as supporting signals, not permanent identifiers.**

## **2.3 Internationalization API**

This is often overlooked.

```
Intl.DateTimeFormat().resolvedOptions()
```

Example:

```
{
  "locale": "en-US",
  "calendar": "gregory",
  "numberingSystem": "latn",
  "timeZone": "Asia/Colombo"
}
```

You can also collect:

```
navigator.language
navigator.languages
```

Useful information:

- Preferred locale.
- Timezone.
- Calendar system.
- Numbering system.
- Language preferences.

These can help understand the visitor's browser configuration.

However, don't assume timezone equals physical location. A visitor can travel, use a VPN or manually configure their timezone.

## **2.4 Connection API**

Where supported:

```
navigator.connection
```

Possible properties:

```
{
  effectiveType: "4g",
  downlink: 10,
  rtt: 50,
  saveData: false
}
```

This provides estimates about network conditions.

You can use it to:

- Optimize image sizes.
- Choose video quality.
- Understand network performance.
- Adapt your website to slower connections.

It is not a reliable device identifier.

Also, support varies between browsers.

## **2.5 Storage and browser capabilities**

You can inspect whether particular capabilities are available.

```
const capabilities = {
  localStorage: "localStorage" in window,
  sessionStorage: "sessionStorage" in window,
  indexedDB: "indexedDB" in window,
  serviceWorker: "serviceWorker" in navigator,
  webgl: !!document.createElement("canvas")
    .getContext("webgl"),
  webgl2: !!document.createElement("canvas")
    .getContext("webgl2"),
  touch: "ontouchstart" in window,
  bluetooth: "bluetooth" in navigator,
  usb: "usb" in navigator,
  geolocation: "geolocation" in navigator
};
```

These capabilities help establish what kind of browser environment you are dealing with.

For example, you might discover:

- A browser supports IndexedDB but not WebGL2.
- A browser supports service workers.
- A browser has touch input capabilities.
- A browser supports Bluetooth APIs.

But remember, API availability is not proof that the corresponding physical hardware exists.

## **2.6 Canvas fingerprinting – one of the most interesting techniques**

High-value fingerprinting signal

This is one of the techniques that makes browser fingerprinting particularly interesting.

HTML Canvas allows browsers to draw graphics using JavaScript.

But different rendering environments can produce slightly different results.

Why?

Because rendering depends on combinations of:

- Graphics hardware.
- GPU drivers.
- Operating system.
- Browser rendering engine.
- Font rendering.
- Anti-aliasing implementation.
- Graphics libraries.

Even when two computers draw the same image, the resulting pixel data may differ.

### **How it works**

First, create an invisible canvas:

```
const canvas = document.createElement("canvas");

canvas.width = 300;
canvas.height = 100;

const ctx = canvas.getContext("2d");
```

Draw text and shapes:

```
ctx.textBaseline = "top";

ctx.font = "14px Arial";

ctx.fillStyle = "#f60";

ctx.fillRect(10, 10, 100, 30);

ctx.fillStyle = "#069";

ctx.fillText(
    "Browser Fingerprinting",
    10,
    60
);

ctx.strokeStyle = "rgba(102, 204, 0, 0.7)";

ctx.beginPath();

ctx.arc(200, 50, 30, 0, Math.PI * 2);

ctx.stroke();
```

Now extract the rendered pixels:

```
const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
);

console.log(imageData.data);
```

The `imageData.data` property contains the pixel values.

You can hash those pixels.

```
async function sha256(data) {
    const buffer = new TextEncoder().encode(data);

    const hash = await crypto.subtle.digest(
        "SHA-256",
        buffer
    );

    return Array.from(new Uint8Array(hash))
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}
```

Usage:

```
const canvasHash = await sha256(
    Array.from(imageData.data).join(",")
);
```

Now you have a hash representing the output of that particular rendering test.

### **Why not just draw one rectangle?**

Because a simple rectangle might render identically across thousands of devices.

A more complex test involving:

- Multiple fonts.
- Different font sizes.
- Transparency.
- Gradients.
- Curves.
- Shadows.
- Overlapping shapes.

can reveal more rendering differences.

### **What can go wrong?**

Canvas fingerprinting can be affected by:

- Browser updates.
- GPU changes.
- Privacy extensions.
- Fingerprinting protection.
- Different rendering configurations.

Some privacy-focused browsers deliberately introduce noise or standardize outputs.

Therefore, canvas should be a useful signal, not a permanent identifier.

## **2.7 WebGL fingerprinting – graphics hardware information**

High-value fingerprinting signal

WebGL provides access to browser-based GPU rendering.

Start with:

```
const canvas = document.createElement("canvas");

const gl = canvas.getContext("webgl");
```

You can retrieve rendering capabilities:

```
const info = gl.getParameter(
    gl.RENDERER
);

const vendor = gl.getParameter(
    gl.VENDOR
);
```

However, these values often return generic browser-level information.

A commonly used extension is:

```
const extension = gl.getExtension(
    "WEBGL_debug_renderer_info"
);

if (extension) {
    const vendor = gl.getParameter(
        extension.UNMASKED_VENDOR_WEBGL
    );

    const renderer = gl.getParameter(
        extension.UNMASKED_RENDERER_WEBGL
    );

    console.log({ vendor, renderer });
}
```

Example output:

```
{
  "vendor": "Google Inc. (NVIDIA)",
  "renderer": "ANGLE (NVIDIA GeForce RTX ... Direct3D11)"
}
```

This can help distinguish different graphics environments.

### **You can collect additional WebGL information**

```
const webglCapabilities = {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),

    maxRenderBufferSize: gl.getParameter(
        gl.MAX_RENDERBUFFER_SIZE
    ),

    maxViewportDims: gl.getParameter(
        gl.MAX_VIEWPORT_DIMS
    ),

    maxTextureImageUnits: gl.getParameter(
        gl.MAX_TEXTURE_IMAGE_UNITS
    ),

    maxVertexAttribs: gl.getParameter(
        gl.MAX_VERTEX_ATTRIBS
    ),

    maxVaryingVectors: gl.getParameter(
        gl.MAX_VARYING_VECTORS
    ),

    maxVertexUniformVectors: gl.getParameter(
        gl.MAX_VERTEX_UNIFORM_VECTORS
    )
};
```

These are GPU-related capability limits.

Two devices with different GPUs may expose different limits.

### **A deeper technique: WebGL rendering**

You can create a WebGL scene, render triangles, gradients, textures and shaders, then read the rendered pixels.

The resulting output may differ depending on the graphics stack.

This is different from simply reading the GPU renderer name.

You have two separate signals:

1. GPU-reported characteristics.
2. Actual GPU rendering behavior.

Both can contribute to a fingerprint, although their results can change and privacy protections can interfere.

## **2.8 Audio fingerprinting**

Additional fingerprinting signal

Audio fingerprinting uses the Web Audio API.

A common approach is to construct an audio-processing graph without playing anything through the speakers.

For example:

```
const audioContext = new OfflineAudioContext(
    1,
    44100,
    44100
);

const oscillator = audioContext.createOscillator();

const compressor = audioContext.createDynamicsCompressor();

oscillator.type = "triangle";

oscillator.frequency.value = 10000;

oscillator.connect(compressor);

compressor.connect(audioContext.destination);

oscillator.start(0);

const audioBuffer = await audioContext.startRendering();

console.log(audioBuffer.getChannelData(0));
```

The resulting samples can be summarized and compared.

Why might they differ?

- Audio engine implementation.
- Browser version.
- Operating system.
- Floating-point processing.
- Audio processing behavior.

You can create a digest of the rendered output, but a full raw-sample hash can be fragile. Small changes can produce a completely different hash.

For identification, compare normalized or statistical characteristics rather than assuming every sample must match.

## **2.9 Font fingerprinting**

Fonts can reveal information about the software environment.

For example, some systems may have:

- Arial.
- Segoe UI.
- Calibri.
- Consolas.
- Aptos.
- Noto Sans.
- Roboto.

You can test whether a font is available by measuring rendered text.

A simple approach:

```
function fontAvailable(font) {
    const canvas = document.createElement("canvas");

    const ctx = canvas.getContext("2d");

    const sample = "mmmmmmmmmmlliWWWW";

    ctx.font = "72px monospace";

    const baseline = ctx.measureText(sample).width;

    ctx.font = `72px "${font}", monospace`;

    const candidate = ctx.measureText(sample).width;

    return candidate !== baseline;
}
```

You can test a predefined list.

However, font enumeration is increasingly restricted or standardized in privacy-focused browsers.

Also, detecting a font doesn't mean you know the user's exact operating system.

**My recommendation:** Use a small, predefined font-availability feature set only when there is a legitimate compatibility or security reason. Avoid exhaustive system-font enumeration.

## **2.10 Other useful browser and device characteristics**

There are several other categories worth understanding.

| Category         | Examples                             | Primary use                    |
| ---------------- | ------------------------------------ | ------------------------------ |
| CPU performance  | Benchmark duration                   | Performance classification     |
| Memory           | `performance.memory` where available | Browser resource management    |
| Battery          | Battery API where supported          | Limited device-state awareness |
| Input            | Pointer and touch capabilities       | UI adaptation                  |
| Media            | Media query capabilities             | Responsive design              |
| Graphics         | WebGL capabilities                   | Rendering compatibility        |
| Audio            | AudioContext                         | Audio compatibility            |
| Sensors          | Motion/orientation APIs              | Interactive experiences        |
| Browser features | API availability                     | Compatibility                  |
| Network          | Connection API, request timings      | Performance analytics          |
| Storage          | StorageManager estimates             | Storage planning               |

Some of these properties are sensitive, unavailable or heavily restricted. You should not collect them just because they exist.

# **3. Passive vs active fingerprinting**

This is a very important distinction in industry.

The W3C describes two major forms of fingerprinting.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.w3.org\&sz=32)

W3C



**Passive fingerprinting**

Information is obtained from requests and connection metadata without running special fingerprinting code.

Examples:

- IP address.
- HTTP headers.
- User-Agent header.
- Accept-Language header.
- TLS and network characteristics.

**Active fingerprinting**

JavaScript or other browser code actively examines the environment.

Examples:

- Canvas rendering.
- WebGL.
- Audio processing.
- Screen dimensions.
- Font measurements.
- Browser API capabilities.
- Performance characteristics.

Let's understand what your backend can collect without JavaScript.

## **3.1 HTTP request information**

Every time a browser makes a request to your server, it sends HTTP request information.

For example:

```
GET /track HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 ...
Accept: text/html,application/xhtml+xml
Accept-Language: en-US,en;q=0.9
Accept-Encoding: gzip, br
Connection: keep-alive
```

Your backend can potentially collect:

| Information               | Source                                        |
| ------------------------- | --------------------------------------------- |
| IP address                | Connection                                    |
| User-Agent                | HTTP header                                   |
| Accept-Language           | HTTP header                                   |
| Accept                    | HTTP header                                   |
| Accept-Encoding           | HTTP header                                   |
| Referer                   | HTTP header, if provided                      |
| Origin                    | HTTP header, if provided                      |
| Request timestamp         | Server                                        |
| Requested URL             | Server                                        |
| HTTP method               | Server                                        |
| TLS connection properties | Server/proxy, where available                 |
| HTTP protocol             | Server/proxy                                  |
| Client hints              | Request headers, when supported and requested |

This information can help with:

- Bot detection.
- Security analysis.
- Network analytics.
- Browser classification.
- Session correlation.

### **IP address**

An IP address is useful, but it is not a device identifier.

Consider:

| Situation                   | IP behavior                  |
| --------------------------- | ---------------------------- |
| Same device, home Wi-Fi     | Often same                   |
| Same device, mobile data    | May change                   |
| Multiple people, same Wi-Fi | Often same                   |
| VPN enabled                 | Changes apparent IP          |
| Carrier-grade NAT           | Many devices share public IP |
| Office network              | Many devices share public IP |

For this reason, use IP as a supporting network signal, not a primary identity.

Also, IP addresses can reveal approximate network location. They should be treated as potentially personal data.

## **3.2 Client Hints**

Modern Chromium-based browsers support User-Agent Client Hints.

Example:

```
const uaData = navigator.userAgentData;

if (uaData) {
    console.log(uaData.brands);
    console.log(uaData.mobile);
    console.log(uaData.platform);
}
```

Additional information can be requested:

```
const details = await uaData.getHighEntropyValues([
    "architecture",
    "bitness",
    "model",
    "platformVersion",
    "uaFullVersion"
]);

console.log(details);
```

Availability and returned information depend on the browser.

This is useful for device classification and serving appropriate content.

It is not a guaranteed device identification method.

# **4. Fingerprint entropy – why some combinations are more unique**

This is where the mathematics becomes interesting.

Suppose a property has the following possibilities:

- Browser: 4 possibilities.
- Operating system: 3 possibilities.
- Timezone: 24 common possibilities.
- CPU category: 4 possibilities.
- Screen category: 8 possibilities.

If all properties were independent and equally distributed, the theoretical number of combinations would be:

\\[ 4 \times 3 \times 24 \times 4 \times 8 = 9,216 \\]

But real-world data is not evenly distributed.

For example, Chrome and Windows are much more common than some other combinations.

This is why the number of possible combinations is not the same as the number of actually distinguishable users.

## **4.1 What is entropy?**

Entropy measures how much uncertainty a property reduces.

For a property with equally likely outcomes:

\\[ H(X)=\log_2(N) \\]

Where:

- \\(N\\) = number of possible outcomes.
- \\(H(X)\\) = entropy in bits.

For example:

| Possible outcomes | Theoretical entropy |
| ----------------- | ------------------- |
| 2                 | 1 bit               |
| 4                 | 2 bits              |
| 8                 | 3 bits              |
| 16                | 4 bits              |
| 32                | 5 bits              |
| 256               | 8 bits              |

But actual entropy depends on the distribution.

A browser property that is theoretically capable of returning 100 values may be almost useless if 95% of users return the same value.

## **4.2 Why adding more properties helps**

Suppose you collect:

```
Windows
Chrome
1920x1080
NVIDIA
8 CPU threads
Asia/Colombo
```

You may distinguish that visitor from many others.

Now add Canvas rendering, WebGL capabilities and font measurements.

You may increase the number of distinguishable configurations.

However, there are two important limitations:

1. Some properties are correlated. For example, OS and font availability are not independent.
2. The fingerprint may change when the browser, driver, display or environment changes.

This is why good fingerprint systems use empirical data rather than just adding theoretical entropy values.

# **5. How industry systems actually work**

Let's move from individual APIs to real-world architectures.

Different industries use different approaches because their objectives are different.

## **5.1 Advertising and analytics**

Advertising platforms generally want to understand:

- Whether someone has visited before.
- Whether two visits belong to the same browser.
- Whether an advertisement was shown previously.
- Whether a conversion followed an advertisement.
- How frequently someone visits.
- Whether a campaign reached a returning audience.

They may use combinations of:

- First-party cookies.
- Session IDs.
- Account identifiers.
- Advertising identifiers, where available.
- Device/browser characteristics.
- Consent and attribution information.

An important distinction: advertising analytics does not always need physical-device identification. A stable browser-level identifier is often sufficient.

## **5.2 Fraud prevention and payment security**

This is a more interesting application.

Consider an online payment.

A customer has:

- Previously used a browser.
- Previously completed successful payments.
- A familiar browser environment.
- A new IP address.
- A different payment card.

The payment security system can compare the new session against historical observations.

It might evaluate:

| Signal                | Observation           |
| --------------------- | --------------------- |
| Browser fingerprint   | Similar to historical |
| IP address            | New                   |
| Country               | Different             |
| Cookie                | Existing              |
| Account               | Existing              |
| Payment card          | New                   |
| Automation indicators | None detected         |

The system doesn't necessarily block the transaction.

Instead, it calculates a risk score.

Possible outcomes:

- Approve.
- Request additional authentication.
- Require manual review.
- Reject.

This is called risk-based authentication or risk-based fraud detection.

The important lesson is that a fingerprint is just one input into a larger risk model.

## **5.3 Bot detection**

Bot detection systems combine multiple categories:

- Browser characteristics.
- JavaScript execution behavior.
- Request patterns.
- Network characteristics.
- Automation indicators.
- Interaction patterns.
- Session consistency.

For example, a browser might claim to be Chrome on Windows, but its behavior could reveal automation.

`navigator.webdriver` is one publicly exposed signal, although it is not sufficient by itself.

Other behavioral indicators include:

- Unrealistic request frequency.
- Repeated identical interaction patterns.
- Inconsistent browser capabilities.
- Abnormal navigation sequences.

A sophisticated system does not simply block everyone with one unusual property.

## **5.4 Device recognition**

A device recognition system usually has several layers:

1. Recognize a known browser through a persistent identifier.
2. Compare the current browser environment with previous observations.
3. Evaluate whether the environment has changed.
4. Assign a confidence level.
5. Update its device history.

For example:

```
Visitor ID: V-10291

Previous observations:
- Windows
- Chrome
- NVIDIA GPU
- 1920x1080
- 8 CPU threads

Current observation:
- Windows
- Chrome
- NVIDIA GPU
- 2560x1440
- 8 CPU threads

Result:
Likely same browser/device environment.
Display configuration changed.
```

This is much more useful than declaring that every different hash represents a new device.

# **6. Industry tools and libraries worth studying**

There are established products and open-source projects in this area.

[FingerprintJS Company Profile Funding & Investors | YourStory](https://images.openai.com/static-rsc-4/npxxJrYjpxR8EPZDsWFek1NAng9TVyNUQ7MOAH9_iX7RUozTR6Uxbp9i6qziZEdsIuc8OQfepgC__Ha8VkZ4ua1MAt-v-qhDaBAbUA6GTGe6b_JWXQc9rjKQQUbZM1YVY8cksdpAlfbnoHGEvIDhMlMj2wcj_Zp8OgCFS6OXFRc?purpose=inline)

**FingerprintJS**

An open-source JavaScript library for browser fingerprinting. Useful for studying component collection, visitor identification and fingerprint stability.

Study first: browser-side collection and component architecture.

[GitHub repository](https://github.com/fingerprintjs/fingerprintjs?utm_source=chatgpt.com)

[Fingerprint Pro | Advanced Device Intelligence & Fraud Detection](https://images.openai.com/static-rsc-4/cHMuEXBTYclOHpxY__ckZ8jQheJuEktC9lubfovD2Z6pwEwhKi80eHRR3EFjklJepGOxgsz0il8gNUv2F0g7ajGgoZpq0N6exxABcm0FrD3ERnETbkvY1NKSYW2PjfUG4DZKe7hBWeE6zUJpqEHoKSrTWIeGkN0n0-ijTfbyQWQ?purpose=inline)

**Fingerprint Pro**

Commercial visitor identification platform with server-side intelligence and additional identification signals.

[Official website](https://fingerprint.com/?utm_source=chatgpt.com)

[7 Fraud Prevention Rules Using Device Fingerprinting](https://images.openai.com/static-rsc-4/bRCbk_WUAuJvI2BeWdvgUL41OWQDcZqe4J4KuEJAB0NEnGuF98WPBt-0gmWWoQTYdUlfijcynJ41J-qmp1q5gifotUXkm4FEuUnU58OKZavuYb2K5hX6BR5gcHwV7Fs7yrvZFyx8LcrvlB3iZAOt72s33n4WLIRZwq9HqIQVo5s?purpose=inline)

**Castle**

Focuses on account security, behavioral signals and fraud prevention.

[Official website](https://castle.io/?utm_source=chatgpt.com)

[Free High-Quality Cloudflare Logo Svg for Creative Design](https://images.openai.com/static-rsc-4/tIZITJeYvDdoDQ13Jy2h0JgFpVKxB6CT604NM1VJw8OEkpaeWGHYRj9ilRdeO9r4TCE_kcqisOqHkjeMmozHDPnCO_IRwVrihkjI_DZvdFMN7oKXkaGWeaL0G5W2SQLaVc-uL4JCOVRAeSsZdag7FoP0pIwGloafYn2ZVtxEKEc?purpose=inline)

**Cloudflare**

Provides bot management, network security and traffic analysis capabilities.

[Bot management](https://www.cloudflare.com/products/bot-management/?utm_source=chatgpt.com)

I would particularly recommend studying FingerprintJS first.

Don't just install it and use its output. Look at how it collects components, represents missing values, handles asynchronous collection and calculates visitor identifiers.

One important distinction: an open-source fingerprinting library and a commercial visitor-identification service are not necessarily equivalent. Commercial services may use additional server-side signals and proprietary matching systems.

# **7. The most important engineering concept: a fingerprint should not be one hash**

I want to correct and improve the architecture I proposed earlier.

A simplistic system looks like this:

```
Browser properties
       |
       v
   SHA-256
       |
       v
  Visitor ID
```

This works for exact comparisons, but it is not particularly intelligent.

Imagine this:

Yesterday:

```
{
  "browser": "Chrome",
  "screen": "1920x1080",
  "gpu": "NVIDIA",
  "cpu": 8
}
```

Today:

```
{
  "browser": "Chrome",
  "screen": "2560x1440",
  "gpu": "NVIDIA",
  "cpu": 8
}
```

The screen changed.

If you hash the entire JSON, you get a completely different hash.

But the visitor might be using exactly the same computer.

This is the fundamental weakness of exact fingerprint matching.

## **7.1 Store individual components, not just the final hash**

A better approach:

```
{
  "fingerprint_version": 1,

  "components": {
    "browser_family": "chrome",
    "os_family": "windows",
    "timezone": "Asia/Colombo",
    "cpu_threads": 8,
    "device_memory": 8,

    "canvas": "abc123",
    "webgl_renderer": "def456",
    "audio": "ghi789",

    "screen_width": 1920,
    "screen_height": 1080,
    "device_pixel_ratio": 1.25
  }
}
```

You can generate individual component hashes, retain selected normalized feature values, and compare each component independently.

For example:

```
Canvas:       MATCH
WebGL:        MATCH
Audio:        MATCH
CPU:          MATCH
Browser:      MATCH
Timezone:     MATCH
Screen:       DIFFERENT
```

Now your matching engine can recognize a potentially returning browser even when the display configuration changes.

## **7.2 Three types of matching**

Your backend should distinguish three different matching strategies.

**A. Exact matching**

Strong evidence of same fingerprint

Compare the complete normalized fingerprint.

Useful for detecting unchanged browser environments.

**B. Component matching**

More flexible

Compare individual signals and calculate how similar two observations are.

Useful when some browser characteristics change.

**C. Probabilistic matching**

Advanced

Use statistical models to estimate the probability that two observations belong to the same browser or device.

Useful when multiple signals change or are missing.

## **7.3 How probabilistic matching works**

Suppose your database contains an older fingerprint.

A new visitor arrives.

Your matching engine evaluates:

| Feature  | Previous   | Current    | Result  |
| -------- | ---------- | ---------- | ------- |
| Canvas   | A123       | A123       | Match   |
| WebGL    | NVIDIA     | NVIDIA     | Match   |
| Audio    | B123       | B123       | Match   |
| CPU      | 8          | 8          | Match   |
| Browser  | Chrome 131 | Chrome 157 | Changed |
| Screen   | 1920×1080  | 2560×1440  | Changed |
| Timezone | Colombo    | Colombo    | Match   |
| Language | en-US      | en-US      | Match   |

You have strong evidence that these observations could belong to the same environment, despite two changes.

However, this still doesn't prove they are the same physical device.

### **A more advanced matching algorithm**

You can start with a weighted similarity score.

\\[ S(A,B)= \frac{\sum_i w_i m_i}{\sum_i w_i} \\]

Where:

- \\(w_i\\) is the importance of a feature.
- \\(m_i\\) is its similarity between 0 and 1.
- \\(S\\) is the overall similarity.

For example:

| Feature  | Weight | Similarity |
| -------- | ------ | ---------- |
| Canvas   | 20     | 1.0        |
| WebGL    | 15     | 1.0        |
| Audio    | 10     | 1.0        |
| CPU      | 10     | 1.0        |
| Browser  | 10     | 0.5        |
| Timezone | 10     | 1.0        |
| Language | 5      | 1.0        |
| Screen   | 5      | 0.0        |
| Fonts    | 15     | 0.8        |

The resulting score is 87%.

That doesn't mean there is an 87% probability that this is the same device. It only means the weighted similarity is 87%.

This distinction is extremely important.

A similarity score and a statistically calibrated probability are different things.

### **What do mature systems do?**

More sophisticated systems can use:

- Feature normalization.
- Feature importance estimation.
- Historical observation comparisons.
- Missing-value handling.
- Time-dependent signal stability.
- Classification models.
- False-positive and false-negative optimization.

A possible future model is logistic regression:

\\[ P(\text{same device}\mid X) = \frac{1}{1+e^{-(b+\sum_i w_i x_i)}} \\]

Here, the model is trained on labeled examples of same-device and different-device observations.

You don't need machine learning initially. Start with component matching and collect enough evaluation data before introducing a trained model.

# **8. Another major concept: temporal stability**

Not all fingerprint components remain unchanged for the same amount of time.

Consider these examples:

| Component          | Expected stability    |
| ------------------ | --------------------- |
| Browser platform   | Relatively high       |
| Timezone           | Relatively high       |
| CPU threads        | Relatively high       |
| Canvas             | Medium–high           |
| WebGL renderer     | Medium–high           |
| Fonts              | Medium                |
| Browser version    | Changes periodically  |
| Screen resolution  | Can change anytime    |
| Window dimensions  | Changes frequently    |
| Network connection | Changes frequently    |
| IP address         | Can change frequently |

These are qualitative expectations, not guarantees.

This is why I recommend adding observation history.

Instead of only storing:

```
visitor_id
fingerprint_hash
last_seen
```

Store:

```
visitor_id
fingerprint_observation_id
fingerprint_version
first_seen
last_seen
observation_count
```

Each observation represents what the browser looked like at a particular time.

For example:

**Visitor V-10291**

Illustrative observation history

1. **November 1**

   Chrome 131 · 1920×1080 · NVIDIA
2. **November 8**

   Chrome 131 · 2560×1440 · NVIDIA

   Similar environment
3. **November 13**

   Chrome 157 · 2560×1440 · NVIDIA

   Similar environment

This is much more informative than keeping one permanent hash.

# **9. Recommended database architecture**

For a serious implementation, I would use four logical tables.

## **Table 1: visitors**

Represents the visitor identity within your system.

```
CREATE TABLE visitors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    visitor_uuid CHAR(36) NOT NULL UNIQUE,

    first_seen DATETIME NOT NULL,
    last_seen DATETIME NOT NULL,

    total_visits INT DEFAULT 1,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## **Table 2: visitor_devices**

Represents a browser/device candidate associated with a visitor.

```
CREATE TABLE visitor_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    visitor_id BIGINT NOT NULL,

    device_uuid CHAR(36) NOT NULL UNIQUE,

    first_seen DATETIME NOT NULL,
    last_seen DATETIME NOT NULL,

    identification_method VARCHAR(30),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (visitor_id)
        REFERENCES visitors(id)
);
```

The identification method could be:

```
persistent_id
exact_fingerprint
probabilistic_match
unknown
```

Don't treat probabilistic matches as confirmed identity associations.

## **Table 3: fingerprint_observations**

Stores individual observations.

```
CREATE TABLE fingerprint_observations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    device_id BIGINT,

    fingerprint_version INT NOT NULL,

    fingerprint_hash CHAR(64),

    hardware_hash CHAR(64),
    browser_hash CHAR(64),
    display_hash CHAR(64),

    feature_data JSON,

    observed_at DATETIME NOT NULL,

    FOREIGN KEY (device_id)
        REFERENCES visitor_devices(id),

    INDEX idx_fingerprint (fingerprint_hash),
    INDEX idx_observed (observed_at)
);
```

## **Table 4: visitor_sessions**

Stores individual visits.

```
CREATE TABLE visitor_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    visitor_id BIGINT,

    device_id BIGINT,

    session_uuid CHAR(36),

    ip_hash CHAR(64),

    user_agent TEXT,

    referrer TEXT,

    landing_page TEXT,

    started_at DATETIME NOT NULL,

    ended_at DATETIME,

    FOREIGN KEY (visitor_id)
        REFERENCES visitors(id),

    FOREIGN KEY (device_id)
        REFERENCES visitor_devices(id)
);
```

This separation gives you several advantages:

- One visitor can use multiple browsers.
- One browser can have multiple observations.
- One visitor can have multiple sessions.
- Browser changes don't require creating a completely new visitor.
- You can independently update your fingerprinting algorithm.

For production, I'd also add retention policies, indexes based on your query patterns, consent status and data-minimization controls. Don't retain raw network or fingerprint data indefinitely just because storage is cheap.

# **10. How I would implement the actual collection system**

Since you work with PHP APIs, MySQL and JavaScript, this is a practical architecture.

## **Browser intelligence architecture**

**Browser / Shortlink**

JavaScript collector

**Collection module**

- Navigator
- Screen
- Intl
- Canvas
- WebGL
- Audio
- Browser capabilities
- First-party visitor ID

**PHP API**

- Validate request
- Validate consent
- Normalize received features
- Generate server-side HMACs
- Assign observation ID

**Matching engine**

- Exact comparison
- Component comparison
- Confidence assessment
- Historical lookup

**MySQL**

Visitors · Devices · Observations · Sessions

## **10.1 Frontend collector**

I would create a modular collector rather than one enormous JavaScript file.

For example:

```
src/
  fingerprint/
    navigator.js
    screen.js
    intl.js
    canvas.js
    webgl.js
    audio.js
    capabilities.js
    collector.js

  visitor/
    visitor-id.js
    session.js

  api/
    tracking.js
```

Each module returns a normalized result.

For example:

```
// navigator.js

export function collectNavigator() {
    return {
        language: navigator.language,

        languages: navigator.languages,

        platform: navigator.platform,

        hardwareConcurrency:
            navigator.hardwareConcurrency ?? null,

        deviceMemory:
            navigator.deviceMemory ?? null,

        maxTouchPoints:
            navigator.maxTouchPoints,

        cookieEnabled:
            navigator.cookieEnabled,

        webdriver:
            navigator.webdriver
    };
}
```

The main collector combines these modules.

```
import { collectNavigator } from "./navigator.js";
import { collectScreen } from "./screen.js";
import { collectIntl } from "./intl.js";
import { collectCapabilities } from "./capabilities.js";

export async function collectFingerprint() {
    return {
        version: 1,

        navigator: collectNavigator(),

        screen: collectScreen(),

        intl: collectIntl(),

        capabilities: collectCapabilities()
    };
}
```

You would add the rendering-related modules separately.

An important design detail: return `null` when a property is unavailable. Don't replace missing values with arbitrary defaults such as `0`, because that makes different environments appear identical.

## **10.2 Server-side hashing**

I would not treat a client-generated hash as trusted evidence.

The browser is under the visitor's control. A visitor can modify JavaScript, fabricate properties or replay requests.

Instead, have the browser submit the normalized feature data to your PHP backend.

Your backend can calculate:

```
function fingerprintHash(array $features): string
{
    $json = json_encode(
        $features,
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    return hash_hmac(
        'sha256',
        $json,
        $_ENV['FINGERPRINT_SECRET']
    );
}
```

In a real implementation, canonicalize nested objects and their keys before encoding.

Use a separate secret and key version for this purpose.

This prevents someone who only knows the input values from directly reproducing your keyed hash without the secret.

However, HMAC does not prevent someone from submitting fabricated browser data.

It protects the server-side identifier, not the authenticity of the browser.

## **10.3 Sending data to PHP**

Example request:

```
const fingerprint = await collectFingerprint();

await fetch("/api/visitor/identify.php", {
    method: "POST",

    headers: {
        "Content-Type": "application/json"
    },

    body: JSON.stringify({
        fingerprint,
        visitor_id: getVisitorId()
    })
});
```

Your PHP backend should:

1. Validate the request.
2. Check the applicable consent and purpose.
3. Validate the data schema.
4. Normalize the properties.
5. Generate the HMAC.
6. Find exact matches.
7. Optionally compare historical observations.
8. Record the observation.
9. Return an opaque visitor/session reference.

Never accept an incoming `visitor_id` as proof that the caller owns that visitor record. Validate signed identifiers or use an appropriately protected first-party cookie.

# **11. What you cannot normally collect from a browser**

This is another important part of understanding browser intelligence.

A normal website cannot freely inspect the visitor's entire computer.

| Information                    | Available to ordinary websites?     |
| ------------------------------ | ----------------------------------- |
| Windows machine ID             | No                                  |
| Motherboard serial number      | No                                  |
| CPU serial number              | No                                  |
| MAC address                    | No                                  |
| Hard disk serial number        | No                                  |
| Exact installed RAM            | Generally no                        |
| Exact CPU model                | Not reliably                        |
| Installed Windows applications | No                                  |
| Windows username               | No                                  |
| Browser history                | No                                  |
| Saved passwords                | No                                  |
| Files on the computer          | Only through user-authorized access |
| Exact GPS coordinates          | Only through permission             |
| Camera access                  | Requires permission                 |
| Microphone access              | Requires permission                 |
| Connected media device details | Restricted and permission-dependent |
| Public IP address              | Usually available to your backend   |
| Approximate network location   | Can be estimated from IP            |
| Browser capabilities           | Yes, through feature detection      |

There are also more advanced browser and network techniques, but I would not recommend trying to bypass browser privacy restrictions.

The W3C's fingerprinting guidance explains why browsers limit these capabilities and why combining seemingly harmless properties can create privacy risks.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.w3.org\&sz=32)

W3C+1



# **12. How to measure whether your fingerprinting system actually works**

This is something I would strongly recommend before deploying your system.

Don't just collect fingerprints and assume they work.

You need to test two things.

**A. Same-device recognition**

Can your system recognize the same browser when it returns?

**B. Different-device separation**

Can your system distinguish two different browsers or devices?

Create a test dataset.

| Test                                 | Expected result                                       |
| ------------------------------------ | ----------------------------------------------------- |
| Same PC, same browser, same settings | Strong similarity                                     |
| Same PC, browser updated             | Potentially strong similarity                         |
| Same PC, screen resolution changed   | Potentially strong similarity                         |
| Same PC, different browser           | Separate browser identity                             |
| Same PC, incognito browser           | Separate storage identity; fingerprint may be similar |
| Different PC, same browser           | Usually distinguishable, but not guaranteed           |
| Different PC, similar specifications | May be difficult to distinguish                       |
| Same PC, privacy protection enabled  | Potentially unstable                                  |
| Same browser, different user account | Not necessarily distinguishable                       |

You should measure:

- False positive rate: different devices incorrectly matched.
- False negative rate: same device incorrectly classified as new.
- Match coverage: percentage of visits that can be confidently matched.
- Fingerprint stability: how often a browser's fingerprint changes over time.

For a fraud detection application, false positives can be particularly costly.

For ordinary website analytics, a slightly less accurate identification system may be perfectly adequate.

# **13. My recommended approach: build it in stages**

I wouldn't immediately build an advanced machine-learning fingerprinting system.

I'd build it progressively.

**Stage 01 – Browser intelligence**

Start here

Build the collection infrastructure.

- Navigator properties.
- Screen properties.
- Internationalization.
- Browser capabilities.
- Basic Canvas and WebGL tests.
- First-party visitor ID.
- Session tracking.

**Stage 02 – Fingerprint matching**

- Normalize feature values.
- Create component hashes.
- Generate versioned fingerprints.
- Implement exact matching.
- Implement similarity matching.
- Store historical observations.

**Stage 03 – Device intelligence**

- Browser change detection.
- Display configuration change detection.
- Browser upgrade detection.
- Returning visitor classification.
- Confidence calibration.
- Device history dashboard.

**Stage 04 – Advanced analytics**

- Statistical matching models.
- Bot and automation detection.
- Network risk indicators.
- Session anomaly detection.
- Cross-session analytics.
- Model evaluation and monitoring.

# **14. What I would actually build for your shortlink project**

Considering your earlier idea of gathering visitor information just by someone opening a shortlink, I'd separate the system into two products within the same backend.

# **Visitor Intelligence**

Understand the visitor's browser and device environment.

**Device analytics**

OS, browser, display, GPU category and device capabilities.

**Visitor recognition**

Persistent IDs and privacy-respecting fingerprint comparison.

**Network analytics**

IP-derived approximate geography, network and connection characteristics.

**Visit analytics**

First visit, returning visits, timestamps and referral sources.

## **Example of the resulting visitor record**

Imagine a visitor opens your shortlink.

Your dashboard could display:

**Visitor V-10291**

Returning visitor

First seen

**Nov 01, 2026**

Last seen

**Nov 13, 2026**

Total visits

# **14**

Known browser profiles

# **2**

**Latest browser observation**

**Windows Desktop**

Chrome · 1920 × 1080 · NVIDIA

**Identification information**

| Attribute             | Result         |
| --------------------- | -------------- |
| Persistent visitor ID | Found          |
| Previous fingerprint  | Similar        |
| Browser change        | Detected       |
| Network change        | Detected       |
| Identification basis  | First-party ID |

Illustrative dashboard data, not a real visitor.

This gives you much more useful information than a single fingerprint hash.

# **15. Privacy, consent and industry responsibilities**

One thing I don't want you to overlook: fingerprinting is not automatically exempt from privacy requirements just because you hash the information.

For example:

- The W3C describes the risks of identification and cross-session correlation.
- The European Data Protection Board's guidance addresses device fingerprinting under the ePrivacy framework.
- The UK's ICO explicitly discusses device fingerprinting as a storage and access technology. Its finalized guidance was published in April 2026.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://www.w3.org\&sz=32)

  W3C+3



If you intend to operate internationally, assess the applicable requirements for each target market, including Sri Lanka's applicable data-protection requirements.

For a responsible implementation:

1. Explain what information you collect.
2. Establish a legitimate, documented purpose.
3. Obtain consent where required.
4. Collect only necessary information.
5. Apply retention limits.
6. Secure visitor identifiers and stored data.
7. Provide appropriate deletion mechanisms.
8. Avoid using fingerprints as proof of identity or as the sole basis for consequential decisions.

# **16. Learning resources – what I'd study in order**

These are the resources I'd use to understand the subject technically.

**1. FingerprintJS**

Start here

Study how a real implementation collects browser components and produces a visitor identifier.

[Source code](https://github.com/fingerprintjs/fingerprintjs?utm_source=chatgpt.com)[Live demonstration](https://fingerprintjs.github.io/fingerprintjs/?utm_source=chatgpt.com)

**2. W3C Fingerprinting Guidance**

Understand browser fingerprinting, entropy, persistence, privacy risks and mitigation.

[Read the W3C document](https://www.w3.org/TR/fingerprinting-guidance/?utm_source=chatgpt.com)

**3. MDN Web Docs**

Learn individual APIs such as Canvas, WebGL, Navigator, Screen and AudioContext.

[Navigator API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator?utm_source=chatgpt.com)[Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API?utm_source=chatgpt.com)[WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API?utm_source=chatgpt.com)[OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext?utm_source=chatgpt.com)

**4. Electronic Frontier Foundation**

Understand how browser fingerprinting works from the privacy and tracking perspective.

[Cover Your Tracks](https://coveryourtracks.eff.org/?utm_source=chatgpt.com)

## **Final engineering advice**

There are three things I would remember from this entire subject:

1. **A fingerprint is a collection of signals, not a hardware ID.** Don't expect a single hash to identify a computer forever.
2. **Persistent IDs and fingerprints solve different problems.** Use first-party identifiers for returning-browser recognition and fingerprints as supplementary evidence.
3. **Historical observations are more valuable than one-time hashes.** A system that understands how a browser changes over time is substantially more useful than a system that simply compares two SHA-256 values.

If I were implementing this as a serious engineering project, I'd first study FingerprintJS's source code, build my own modular collector, store versioned observations in MySQL, and only then develop the matching engine.

That gives you a foundation you can eventually expand into a proper visitor-intelligence and device-analytics platform.