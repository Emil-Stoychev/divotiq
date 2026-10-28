import { AVATARS } from '@/game/avatars'

export default function AvatarPicker({ value, onChange, label = 'Избери аватар' }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label={label}>
      {AVATARS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="radio"
          aria-checked={value === emoji}
          className={`avatar-picker__option ${value === emoji ? 'avatar-picker__option--active' : ''}`}
          onClick={() => onChange(emoji)}
        >
          <span className="emoji">{emoji}</span>
        </button>
      ))}
    </div>
  )
}
