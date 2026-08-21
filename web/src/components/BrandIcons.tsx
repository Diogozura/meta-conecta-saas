export function WhatsAppGlyph({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M21.53 18.34c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.19 5.06 4.47.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"
      />
      <path
        fill="#fff"
        d="M16.03 5.33A10.6 10.6 0 0 0 5.42 15.92c0 1.87.49 3.7 1.42 5.31L5.34 26.7l5.6-1.47a10.6 10.6 0 0 0 5.08 1.3h.01c5.85 0 10.6-4.76 10.61-10.61a10.55 10.55 0 0 0-3.1-7.51 10.55 10.55 0 0 0-7.51-3.08zm0 19.42h-.01a8.8 8.8 0 0 1-4.49-1.23l-.32-.19-3.35.88.9-3.27-.21-.34a8.8 8.8 0 0 1-1.35-4.68 8.83 8.83 0 0 1 8.84-8.81 8.78 8.78 0 0 1 6.24 2.59 8.75 8.75 0 0 1 2.58 6.24c0 4.87-3.96 8.81-8.83 8.81z"
      />
    </svg>
  )
}

export function InstagramGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  const gradientId = 'instagram-gradient'
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="2" y1="30" x2="30" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="25%" stopColor="#F56040" />
          <stop offset="50%" stopColor="#C13584" />
          <stop offset="75%" stopColor="#833AB4" />
          <stop offset="100%" stopColor="#5851DB" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <rect x="8.5" y="8.5" width="15" height="15" rx="4.2" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16" cy="16" r="3.6" stroke="#fff" strokeWidth="1.7" />
      <circle cx="20.6" cy="11.4" r="0.95" fill="#fff" />
    </svg>
  )
}

export function FacebookGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.5 8.5H16.5V5.3C16.16 5.25 15 5.15 13.65 5.15C10.82 5.15 8.9 6.88 8.9 10.05V12.7H5.8V16.25H8.9V22H12.55V16.25H15.53L16 12.7H12.55V10.42C12.55 9.4 12.83 8.5 14.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
