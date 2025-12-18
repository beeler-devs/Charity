import { Badge } from '@/components/ui/badge'

export interface MatchResultBadgeProps {
  result: 'win' | 'loss' | 'tie' | 'pending'
  scoreSummary?: string
}

export function MatchResultBadge({ result, scoreSummary }: MatchResultBadgeProps) {
  const getVariant = () => {
    switch (result) {
      case 'win':
        return 'default' // Will style as green
      case 'loss':
        return 'destructive' // Red
      case 'tie':
        return 'secondary' // Yellow/gray
      case 'pending':
      default:
        return 'outline' // Gray outline
    }
  }

  const getText = () => {
    if (result === 'pending') {
      return 'Pending'
    }
    
    const resultText = result.charAt(0).toUpperCase() + result.slice(1)
    
    if (scoreSummary) {
      return `${resultText} ${scoreSummary}`
    }
    
    return resultText
  }

  const getClassName = () => {
    switch (result) {
      case 'win':
        return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
      case 'loss':
        return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
      case 'tie':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  return (
    <Badge 
      variant={getVariant()}
      className={getClassName()}
    >
      {getText()}
    </Badge>
  )
}

