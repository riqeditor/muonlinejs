import './style.less';
import { FanDisclaimer } from '../fanDisclaimer';

// thegame: fundo das telas de entrada, no clima da tela inicial da 0.97d (entardecer no mar,
// navios ao longe), desenhado em SVG/CSS. Não usa imagens nem o logo da Webzen.

const Ship = ({ x, y, scale, delay }: { x: number; y: number; scale: number; delay: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <g className="ship" style={{ animationDelay: `${delay}s` }}>
      {/* casco */}
      <path d="M-60 0 L60 0 L48 16 L-44 16 Z" />
      <path d="M-60 0 L-72 -10 L-56 -4 Z" />
      {/* mastros */}
      <rect x="-2" y="-92" width="3" height="92" />
      <rect x="-32" y="-70" width="2.5" height="70" />
      <rect x="28" y="-62" width="2.5" height="62" />
      {/* velas */}
      <path d="M-24 -86 Q0 -78 24 -86 L22 -48 Q0 -42 -22 -48 Z" />
      <path d="M-22 -42 Q0 -36 22 -42 L20 -10 Q0 -5 -20 -10 Z" />
      <path d="M-50 -64 Q-31 -58 -14 -64 L-16 -30 Q-31 -26 -48 -30 Z" />
      <path d="M12 -56 Q29 -51 44 -56 L42 -24 Q29 -20 14 -24 Z" />
      <path d="M2 -92 L22 -98 L2 -100 Z" />
    </g>
  </g>
);

const STARS = [
  [120, 60], [340, 120], [520, 40], [760, 90], [980, 50],
  [1180, 130], [1420, 70], [1530, 160], [260, 210], [1320, 220],
];

export const TitleBackground = () => (
  <div className="title-background" aria-hidden="true">
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="tb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1026" />
          <stop offset="0.45" stopColor="#2a2550" />
          <stop offset="0.75" stopColor="#8a4a52" />
          <stop offset="1" stopColor="#e39a5a" />
        </linearGradient>
        <linearGradient id="tb-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3350" />
          <stop offset="0.3" stopColor="#1c1d33" />
          <stop offset="1" stopColor="#05060d" />
        </linearGradient>
        <radialGradient id="tb-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff2c4" stopOpacity="1" />
          <stop offset="0.25" stopColor="#ffc56e" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tb-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf86" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffcf86" stopOpacity="0" />
        </linearGradient>
        <filter id="tb-blur">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="tb-glow-blur" x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="40 10" />
        </filter>
      </defs>

      <rect width="1600" height="560" fill="url(#tb-sky)" />
      {/* estrelas */}
      <g fill="#fff" opacity="0.6">
        {STARS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} className="star" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
      </g>
      {/* sol no horizonte */}
      <circle cx="1060" cy="560" r="230" fill="url(#tb-sun)" />
      {/* nuvens */}
      <g filter="url(#tb-blur)" className="clouds">
        <ellipse cx="300" cy="300" rx="260" ry="28" fill="#6a4a6e" opacity="0.7" />
        <ellipse cx="900" cy="380" rx="340" ry="22" fill="#b0626a" opacity="0.6" />
        <ellipse cx="1350" cy="320" rx="240" ry="26" fill="#7a4d6a" opacity="0.6" />
        <ellipse cx="620" cy="450" rx="300" ry="16" fill="#d08060" opacity="0.5" />
      </g>
      {/* ilhas ao longe */}
      <path d="M0 560 L0 520 Q60 490 130 505 Q210 470 290 515 Q340 530 380 560 Z" fill="#2a1d2e" />
      <path d="M1250 560 Q1300 520 1360 530 Q1420 490 1500 512 Q1560 500 1600 520 L1600 560 Z" fill="#2a1d2e" />
      {/* mar */}
      <rect y="560" width="1600" height="340" fill="url(#tb-sea)" />
      <path d="M990 560 L1130 560 L1260 900 L860 900 Z" fill="url(#tb-glow)" filter="url(#tb-glow-blur)" />
      <g className="waves" stroke="#ffd59a" strokeLinecap="round">
        {Array.from({ length: 18 }, (_, i) => {
          const y = 572 + i * i + i * 6;
          const w = 40 + i * 9;
          const x = 1060 - w / 2 + ((i * 53) % 90) - 45;
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x + w}
              y2={y}
              strokeWidth={1 + i * 0.12}
              opacity={0.75 - i * 0.035}
              style={{ animationDelay: `${(i % 5) * 0.6}s` }}
            />
          );
        })}
      </g>
      {/* navios */}
      <g fill="#120c18">
        <Ship x={420} y={600} scale={1.25} delay={0} />
        <Ship x={700} y={575} scale={0.7} delay={1.3} />
        <Ship x={1400} y={590} scale={0.9} delay={0.6} />
      </g>
    </svg>
  </div>
);

export const TitleLogo = () => (
  <div className="title-logo">
    <h1>THEGAME</h1>
    <span className="subtitle">servidor 0.97d · projeto de fã</span>
  </div>
);

export const TitleFooter = () => (
  <>
    <span className="title-version">Versão 0.97d</span>
    <div className="title-footer">
      <FanDisclaimer />
    </div>
  </>
);
