export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Zybot">
      <defs>
        <linearGradient id="zybot-mark-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#16e285" />
          <stop offset="100%" stopColor="#00874a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#zybot-mark-gradient)" />
      <path
        d="M12 15.5C12 14.1193 13.1193 13 14.5 13H25.5C26.8807 13 28 14.1193 28 15.5V22.5C28 23.8807 26.8807 25 25.5 25H18L13.6 28.3C13.1 28.68 12.4 28.32 12.4 27.7V25H14.5C13.1193 25 12 23.8807 12 22.5V15.5Z"
        fill="white"
      />
      <circle cx="17" cy="19" r="1.5" fill="#00a85b" />
      <circle cx="23" cy="19" r="1.5" fill="#00a85b" />
    </svg>
  )
}

export function Logo({
  className = '',
  markClassName = 'w-8 h-8',
  textClassName = 'text-lg font-bold text-ink-900',
  showText = true,
}: {
  className?: string
  markClassName?: string
  textClassName?: string
  showText?: boolean
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      {showText && (
        <span className={textClassName}>
          Zybot
        </span>
      )}
    </span>
  )
}
