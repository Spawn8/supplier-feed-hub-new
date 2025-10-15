'use client'

interface TimezoneSelectProps {
  value: string
  onChange: (timezone: string) => void
  className?: string
}

export default function TimezoneSelect({ value, onChange, className = '' }: TimezoneSelectProps) {
  const timezones = [
    { value: 'UTC', label: 'UTC - Coordinated Universal Time' },
    { value: 'America/New_York', label: 'America/New_York - Eastern Time' },
    { value: 'America/Chicago', label: 'America/Chicago - Central Time' },
    { value: 'America/Denver', label: 'America/Denver - Mountain Time' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles - Pacific Time' },
    { value: 'Europe/London', label: 'Europe/London - Greenwich Mean Time' },
    { value: 'Europe/Paris', label: 'Europe/Paris - Central European Time' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin - Central European Time' },
    { value: 'Europe/Rome', label: 'Europe/Rome - Central European Time' },
    { value: 'Europe/Madrid', label: 'Europe/Madrid - Central European Time' },
    { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam - Central European Time' },
    { value: 'Europe/Stockholm', label: 'Europe/Stockholm - Central European Time' },
    { value: 'Europe/Oslo', label: 'Europe/Oslo - Central European Time' },
    { value: 'Europe/Copenhagen', label: 'Europe/Copenhagen - Central European Time' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo - Japan Standard Time' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai - China Standard Time' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong - Hong Kong Time' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore - Singapore Time' },
    { value: 'Asia/Seoul', label: 'Asia/Seoul - Korea Standard Time' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata - India Standard Time' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney - Australian Eastern Time' },
    { value: 'Australia/Melbourne', label: 'Australia/Melbourne - Australian Eastern Time' },
    { value: 'Australia/Perth', label: 'Australia/Perth - Australian Western Time' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland - New Zealand Time' }
  ]

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
    >
      {timezones.map((timezone) => (
        <option key={timezone.value} value={timezone.value}>
          {timezone.label}
        </option>
      ))}
    </select>
  )
}