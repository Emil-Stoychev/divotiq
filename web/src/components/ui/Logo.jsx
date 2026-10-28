export default function Logo({ size = 'md', tagline = false, href = '/' }) {
  const content = (
    <>
      <span className="logo__word">Дивотия</span>
      <span className="logo__spark logo__spark--1" aria-hidden="true">✦</span>
      <span className="logo__spark logo__spark--2" aria-hidden="true">✦</span>
      {tagline && <span className="logo__tagline">Нормална вечер не обещаваме.</span>}
    </>
  )
  return href ? (
    <a className={`logo logo--${size}`} href={href} aria-label="Дивотия — начало">
      {content}
    </a>
  ) : (
    <span className={`logo logo--${size}`}>{content}</span>
  )
}
