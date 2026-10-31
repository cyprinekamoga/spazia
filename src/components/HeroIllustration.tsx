/**
 * A red Swedish house on a winter night, garage door open with warm light
 * and seasonal gear inside. Pure SVG so it is crisp and tiny.
 */
export function HeroIllustration({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 560 410" role="img" aria-label={title} className="h-auto w-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1630" />
          <stop offset="1" stopColor="#24406b" />
        </linearGradient>
        <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3ee6b0" stopOpacity="0" />
          <stop offset=".35" stopColor="#3ee6b0" stopOpacity=".55" />
          <stop offset=".7" stopColor="#5fd3f0" stopOpacity=".35" />
          <stop offset="1" stopColor="#8a7cf0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="garageLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe2a6" />
          <stop offset="1" stopColor="#ffb54d" />
        </linearGradient>
        <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc56e" stopOpacity=".75" />
          <stop offset="1" stopColor="#ffc56e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f7fb" />
          <stop offset="1" stopColor="#d6e1ee" />
        </linearGradient>
        <filter id="blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id="frame">
          <rect width="560" height="410" rx="28" />
        </clipPath>
      </defs>

      <g clipPath="url(#frame)">
        <rect width="560" height="440" fill="url(#sky)" />

        {/* aurora */}
        <g filter="url(#blur)">
          <path d="M-20 120C80 60 170 150 280 95S470 40 590 90" stroke="url(#aurora)" strokeWidth="34" fill="none" />
          <path d="M40 165C140 120 230 175 330 130S480 105 580 135" stroke="url(#aurora)" strokeWidth="18" fill="none" opacity=".6" />
        </g>

        {/* stars */}
        <g fill="#fff">
          {[
            [40, 40, 1.6],
            [110, 28, 1.2],
            [180, 54, 1.4],
            [250, 22, 1.1],
            [330, 48, 1.7],
            [400, 26, 1.2],
            [470, 58, 1.4],
            [520, 30, 1.1],
            [70, 190, 1.1],
            [500, 170, 1.3],
            [300, 175, 1],
            [150, 205, 1],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity=".85" />
          ))}
        </g>

        {/* distant hills */}
        <path d="M0 300C90 270 160 285 240 272s170-30 320-6V440H0z" fill="#2c4a78" opacity=".55" />

        {/* pines left */}
        <g>
          <path d="M44 330 70 250l26 80z" fill="#16304f" />
          <path d="M52 300 70 236l18 64z" fill="#1b3a5f" />
          <path d="M60 262 70 228l10 34z" fill="#21456f" />
          <path d="M62 256c4 3 12 3 16 0l-8-22z" fill="#eef3f9" />
        </g>
        <g>
          <path d="M500 335 522 268l22 67z" fill="#16304f" />
          <path d="M507 308 522 254l15 54z" fill="#1b3a5f" />
          <path d="M514 272c3 3 13 3 16 0l-8-18z" fill="#eef3f9" />
        </g>

        {/* snow ground */}
        <path d="M0 322C110 312 210 330 300 326s180-12 260-4V440H0z" fill="url(#snow)" />

        {/* light spill from garage */}
        <path d="M330 330h120l70 110H262z" fill="url(#spill)" />

        {/* house */}
        <g>
          <rect x="96" y="208" width="196" height="122" fill="#8e2f22" />
          {/* board lines */}
          <g stroke="#7a271c" strokeWidth="2">
            {[116, 136, 156, 176, 196, 216, 236, 256, 276].map((x) => (
              <line key={x} x1={x} y1="214" x2={x} y2="330" />
            ))}
          </g>
          {/* roof */}
          <path d="M80 214 194 138l114 76z" fill="#1d2a3f" />
          <path d="M80 214 194 138l114 76-10 4-104-68-104 68z" fill="#f4f7fb" />
          <path d="M104 198 194 140l90 58c-30-8-60-36-90-40-30 4-60 32-90 40z" fill="#f4f7fb" opacity=".9" />
          {/* chimney */}
          <rect x="236" y="150" width="18" height="34" fill="#5b2018" />
          <rect x="232" y="146" width="26" height="8" rx="3" fill="#f4f7fb" />
          {/* windows */}
          <g>
            <rect x="120" y="234" width="44" height="40" fill="#ffd68a" />
            <path d="M142 234v40M120 254h44" stroke="#fff" strokeWidth="4" />
            <rect x="120" y="234" width="44" height="40" fill="none" stroke="#fff" strokeWidth="5" />
            <rect x="224" y="234" width="44" height="40" fill="#ffd68a" />
            <path d="M246 234v40M224 254h44" stroke="#fff" strokeWidth="4" />
            <rect x="224" y="234" width="44" height="40" fill="none" stroke="#fff" strokeWidth="5" />
          </g>
          {/* door */}
          <rect x="178" y="270" width="32" height="60" fill="#2b3a55" />
          <rect x="178" y="270" width="32" height="60" fill="none" stroke="#fff" strokeWidth="4" />
          <circle cx="203" cy="302" r="2.5" fill="#ffc56e" />
          {/* corner trim */}
          <path d="M96 210v120M292 210v120" stroke="#fff" strokeWidth="5" />
        </g>

        {/* garage */}
        <g>
          <rect x="292" y="232" width="178" height="98" fill="#86291d" />
          <path d="M286 236 296 214h170l14 22z" fill="#1d2a3f" />
          <path d="M282 238c6-6 12-24 16-26h168c8 6 12 20 18 26-60-4-140-4-202 0z" fill="#f4f7fb" />
          {/* opening */}
          <rect x="318" y="252" width="128" height="78" fill="url(#garageLight)" />
          {/* raised door panel */}
          <rect x="318" y="252" width="128" height="12" fill="#e9eef5" />
          <path d="M318 258h128" stroke="#c9d4e2" strokeWidth="2" />
          {/* shelf */}
          <rect x="392" y="282" width="46" height="4" rx="1" fill="#9a5a20" />
          {/* boxes on shelf */}
          <rect x="396" y="266" width="18" height="16" rx="1.5" fill="#c98a45" />
          <path d="M405 266v16" stroke="#a96d2f" strokeWidth="2" />
          <rect x="417" y="270" width="17" height="12" rx="1.5" fill="#d79a52" />
          {/* boxes on floor */}
          <rect x="398" y="304" width="26" height="22" rx="2" fill="#c98a45" />
          <path d="M411 304v22" stroke="#a96d2f" strokeWidth="2.5" />
          <rect x="424" y="312" width="16" height="14" rx="2" fill="#d79a52" />
          {/* tyre stack */}
          <g>
            {[316, 302, 288, 274].map((y) => (
              <g key={y}>
                <rect x="330" y={y} width="40" height="13" rx="5" fill="#2a2f3a" />
                <rect x="340" y={y + 4} width="20" height="5" rx="2.5" fill="#545c6b" />
              </g>
            ))}
          </g>
          {/* skis leaning */}
          <rect x="378" y="262" width="6" height="66" rx="3" fill="#1f6f8b" transform="rotate(8 381 295)" />
          <rect x="386" y="262" width="6" height="66" rx="3" fill="#e8702a" transform="rotate(8 389 295)" />
          {/* frame trim */}
          <rect x="318" y="252" width="128" height="78" fill="none" stroke="#fff" strokeWidth="5" />
          {/* lamp */}
          <rect x="374" y="240" width="16" height="6" rx="3" fill="#ffe2a6" />
        </g>

        {/* foreground snow drift */}
        <path d="M0 360c70-14 120-6 180 2s140 10 200 0 120-14 180-6V440H0z" fill="#f4f7fb" />
        <path d="M0 392c90-10 170 6 260 4s190-18 300-10V440H0z" fill="#e7eef7" />
      </g>
    </svg>
  );
}
