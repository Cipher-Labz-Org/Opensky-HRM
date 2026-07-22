import { LOGIN_WAVE } from "@/lib/opensky-theme";

/** Mockup shadow waves — soft pale-blue layers + embossed color bands */
export function LoginWaveBackground() {
  const w = LOGIN_WAVE;

  const navyTop =
    "M0,628 C160,612 340,650 520,662 C700,670 860,664 1000,642 C1140,620 1260,592 1360,574 C1400,568 1440,562 1440,562";
  const navyTopReverse =
    "L1440,562 C1440,562 1400,568 1360,574 C1260,592 1140,620 1000,642 C860,664 700,670 520,662 C340,650 160,612 0,628";

  const blueTop =
    "M0,548 C130,536 300,578 480,614 C660,646 820,654 960,640 C1100,622 1220,586 1340,556 C1390,542 1420,536 1440,534";
  const blueTopReverse =
    "L1440,534 C1420,536 1390,542 1340,556 C1220,586 1100,622 960,640 C820,654 660,646 480,614 C300,578 130,536 0,548";

  const greenTop =
    "M0,478 C110,466 270,510 440,558 C610,600 760,622 900,610 C1040,594 1160,552 1280,512 C1360,488 1400,482 1440,484";

  // Pale shadow ribbons — stacked translucent blues (mockup style)
  const shadowRibbon1 =
    "M0,598 C200,578 400,618 620,636 C840,650 1040,638 1240,608 C1360,588 1420,578 1440,572 L1440,720 L0,720 Z";
  const shadowRibbon2 =
    "M0,562 C180,545 380,582 600,602 C820,618 1020,608 1220,578 C1340,558 1400,548 1440,542 L1440,720 L0,720 Z";
  const shadowRibbon3 =
    "M0,528 C160,512 360,548 580,568 C800,585 1000,575 1200,548 C1320,528 1380,518 1440,512 L1440,720 L0,720 Z";
  const shadowRibbon4 =
    "M0,498 C140,484 320,518 540,538 C760,555 960,548 1160,522 C1280,502 1360,492 1440,488 L1440,720 L0,720 Z";

  return (
    <div className="login-wave-bg pointer-events-none absolute inset-x-0 bottom-0" aria-hidden>
      <svg
        className="login-wave-svg"
        viewBox="0 0 1440 720"
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="geometricPrecision"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave-horiz-fade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="42%" stopColor="white" stopOpacity="1" />
            <stop offset="52%" stopColor="white" stopOpacity="0.88" />
            <stop offset="62%" stopColor="white" stopOpacity="0.62" />
            <stop offset="72%" stopColor="white" stopOpacity="0.35" />
            <stop offset="82%" stopColor="white" stopOpacity="0.14" />
            <stop offset="92%" stopColor="white" stopOpacity="0.04" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="wave-shadow-fade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="55%" stopColor="white" stopOpacity="0.92" />
            <stop offset="72%" stopColor="white" stopOpacity="0.5" />
            <stop offset="88%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Embossed crest gradients — darker at top edge, lighter below */}
          <linearGradient id="wave-navy" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0A2540" />
            <stop offset="18%" stopColor={w.navyDeep} />
            <stop offset="100%" stopColor={w.navy} />
          </linearGradient>

          <linearGradient id="wave-blue" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#153270" stopOpacity="0.55" />
            <stop offset="12%" stopColor={w.blueDeep} />
            <stop offset="55%" stopColor={w.blueMid} />
            <stop offset="100%" stopColor={w.blueLight} />
          </linearGradient>

          <linearGradient id="wave-green" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4A8A1E" stopOpacity="0.4" />
            <stop offset="14%" stopColor={w.greenDark} />
            <stop offset="55%" stopColor={w.green} />
            <stop offset="100%" stopColor={w.greenLight} />
          </linearGradient>

          <linearGradient id="shadow-ribbon-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={w.shadowMid} stopOpacity="0.55" />
            <stop offset="40%" stopColor={w.shadowLight} stopOpacity="0.42" />
            <stop offset="100%" stopColor={w.background} stopOpacity="0.15" />
          </linearGradient>

          <linearGradient id="shadow-ribbon-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={w.shadowMid} stopOpacity="0.45" />
            <stop offset="50%" stopColor={w.shadowLight} stopOpacity="0.32" />
            <stop offset="100%" stopColor={w.background} stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id="shadow-ribbon-3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={w.shadowLight} stopOpacity="0.5" />
            <stop offset="100%" stopColor={w.background} stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="shadow-ribbon-4" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={w.accentLight} stopOpacity="0.65" />
            <stop offset="60%" stopColor={w.shadowLight} stopOpacity="0.28" />
            <stop offset="100%" stopColor={w.background} stopOpacity="0" />
          </linearGradient>

          <filter id="wave-soft-lift" x="-6%" y="-8%" width="112%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#173A63" floodOpacity="0.14" />
          </filter>

          <mask id="wave-fade-mask">
            <rect width="1440" height="720" fill="url(#wave-horiz-fade)" />
          </mask>

          <mask id="wave-shadow-mask">
            <rect width="1440" height="720" fill="url(#wave-shadow-fade)" />
          </mask>

          <clipPath id="wave-navy-clip">
            <path d={`${navyTop} L1440,720 L0,720 Z`} />
          </clipPath>
        </defs>

        {/* Translucent pale-blue shadow wave ribbons */}
        <g mask="url(#wave-shadow-mask)">
          <path fill="url(#shadow-ribbon-1)" d={shadowRibbon1} />
          <path fill="url(#shadow-ribbon-2)" d={shadowRibbon2} />
          <path fill="url(#shadow-ribbon-3)" d={shadowRibbon3} />
          <path fill="url(#shadow-ribbon-4)" d={shadowRibbon4} />
        </g>

        <g mask="url(#wave-fade-mask)">
          {/* Main color bands */}
          <path fill="url(#wave-navy)" d={`${navyTop} L1440,720 L0,720 Z`} />

          <path
            fill="url(#wave-blue)"
            filter="url(#wave-soft-lift)"
            d={`${blueTop} ${navyTopReverse} Z`}
          />

          <path
            fill="url(#wave-green)"
            filter="url(#wave-soft-lift)"
            d={`${greenTop} ${blueTopReverse} Z`}
          />

          {/* Soft crest highlights — embossed edge (no hard strokes) */}
          <path
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.5"
            d={greenTop}
          />
          <path
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.2"
            d={blueTop}
          />

          {/* Contour mesh on navy */}
          <g clipPath="url(#wave-navy-clip)" stroke="rgba(255,255,255,0.13)" strokeWidth="0.85" fill="none">
            <path d="M0,668 C180,656 360,676 540,682 C720,686 860,678 1000,658" />
            <path d="M0,648 C200,636 400,656 580,664 C760,670 900,662 1040,642" />
            <path d="M0,632 C220,622 440,640 620,648 C800,654 940,646 1080,628" />
          </g>

          {/* Light topographical lines across shadow + color area */}
          <path
            fill="none"
            stroke={w.contourA}
            strokeWidth="1"
            strokeOpacity="0.42"
            d="M0,508 C200,538 400,582 600,608 C800,628 960,632 1100,618 C1220,598 1320,562 1400,532"
          />
          <path
            fill="none"
            stroke={w.contourB}
            strokeWidth="0.9"
            strokeOpacity="0.34"
            d="M0,488 C220,516 440,562 660,592 C880,612 1040,618 1180,600 C1300,578 1380,542 1420,512"
          />
          <path
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.75"
            d="M0,468 C240,496 480,542 700,572 C920,592 1080,595 1220,572 C1340,548 1400,518 1440,502"
          />
          <g stroke="rgba(255,255,255,0.09)" strokeWidth="0.65" fill="none">
            <path d="M0,548 C150,562 300,586 470,602 C640,614 780,618 900,608 C1020,594 1140,562 1260,530" />
            <path d="M0,528 C170,544 340,570 510,588 C680,602 820,606 940,596 C1060,582 1180,548 1300,516" />
          </g>
        </g>
      </svg>
    </div>
  );
}
