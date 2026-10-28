import { segmentGeometry } from '@/game'

const R = 96

function point(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180
  return [Math.sin(rad) * radius, -Math.cos(rad) * radius]
}

function arcPath(start, sweep) {
  if (sweep >= 359.99) return `M 0 ${-R} A ${R} ${R} 0 1 1 -0.01 ${-R} Z`
  const [x1, y1] = point(start, R)
  const [x2, y2] = point(start + sweep, R)
  return `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
}

// Purely presentational: it renders whatever rotation the engine decided.
export default function WheelGraphic({
  segments,
  probability = 'equal',
  rotation = 0,
  durationMs = 0,
  onSpinEnd,
  highlightId,
  showLabels = true,
  className = '',
}) {
  const geometry = segmentGeometry(segments, probability)
  return (
    <div className={`wheel-graphic ${className}`}>
      <svg className="wheel-graphic__pointer" viewBox="0 0 40 46" aria-hidden="true">
        <path d="M20 44 L4 10 A16 16 0 1 1 36 10 Z" fill="#fff" stroke="#1b1347" strokeWidth="3" />
        <circle cx="20" cy="16" r="6" fill="#ff4fa3" />
      </svg>
      <div className="wheel-graphic__rim">
        <svg
          className="wheel-graphic__disc"
          viewBox="-100 -100 200 200"
          style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${durationMs}ms` }}
          onTransitionEnd={(e) => e.propertyName === 'transform' && onSpinEnd?.()}
          role="img"
          aria-label={`Колело с ${segments.length} сегмента`}
        >
          {geometry.map(({ segment, start, sweep }) => {
            const mid = start + sweep / 2
            const [ix, iy] = point(mid, sweep < 30 ? 70 : 64)
            const [lx, ly] = point(mid, 36)
            const dim = highlightId && highlightId !== segment.id
            return (
              <g key={segment.id} className={dim ? 'wheel-graphic__segment wheel-graphic__segment--dim' : 'wheel-graphic__segment'}>
                <path d={arcPath(start, sweep)} fill={segment.color} stroke="rgba(10,6,30,0.55)" strokeWidth="1.2" />
                <text x={ix} y={iy} fontSize={sweep < 26 ? 13 : 17} textAnchor="middle" dominantBaseline="central" transform={`rotate(${mid} ${ix} ${iy})`} className="emoji">
                  {segment.icon}
                </text>
                {showLabels && sweep >= 34 && (
                  <text
                    x={lx}
                    y={ly}
                    fontSize="6.2"
                    fontWeight="800"
                    fill="#fff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${mid - 90} ${lx} ${ly})`}
                    className="wheel-graphic__label"
                  >
                    {segment.label.length > 14 ? `${segment.label.slice(0, 13)}…` : segment.label}
                  </text>
                )}
              </g>
            )
          })}
          <circle r="97" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          {geometry.map(({ start }, i) => {
            const [x, y] = point(start, 92)
            return <circle key={i} cx={x} cy={y} r="2.2" fill="#ffe9a8" />
          })}
        </svg>
      </div>
    </div>
  )
}
