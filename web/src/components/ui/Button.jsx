import Icon from './Icon'

// variant: primary | secondary | ghost | success | danger | soft
export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  loading = false,
  block = false,
  className = '',
  children,
  type = 'button',
  href,
  ...props
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block && 'btn--block',
    loading && 'btn--loading',
    !children && 'btn--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const content = (
    <>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : icon && <Icon name={icon} className="btn__icon" />}
      {children && <span className="btn__label">{children}</span>}
      {iconEnd && <Icon name={iconEnd} className="btn__icon" />}
    </>
  )
  if (href) {
    return (
      <a className={classes} href={href} {...props}>
        {content}
      </a>
    )
  }
  return (
    <button type={type} className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  )
}
