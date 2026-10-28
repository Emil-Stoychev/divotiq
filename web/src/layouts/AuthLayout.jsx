import SiteLayout from './SiteLayout'

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <SiteLayout>
      <div className="auth container">
        <div className="auth__card card card--glass">
          <span className="auth__emoji emoji" aria-hidden="true">🎉</span>
          <h1 className="auth__title">{title}</h1>
          {subtitle && <p className="auth__subtitle">{subtitle}</p>}
          {children}
        </div>
        <ul className="auth__perks">
          <li><span className="emoji">💾</span> Запазени игри и компании</li>
          <li><span className="emoji">📜</span> История и резултати</li>
          <li><span className="emoji">✍️</span> Свои предизвикателства и фрази</li>
          <li><span className="emoji">🌍</span> Споделяне в библиотеката</li>
        </ul>
      </div>
    </SiteLayout>
  )
}
