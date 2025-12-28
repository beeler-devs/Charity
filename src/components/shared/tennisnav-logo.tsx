export function TennisNavLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/logo.jpg"
        alt="TennisNav Logo"
        className="h-12 w-auto"
        style={{ maxWidth: '250px' }}
      />
    </div>
  )
}
