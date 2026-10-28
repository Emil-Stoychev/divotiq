export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`tabs__tab ${value === tab.value ? 'tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon && <span className="emoji">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && <span className="tabs__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
