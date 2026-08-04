import { useSportTerms } from '@/hooks/useSportTerms'
import { Button } from '@/components/atoms/Button'
import { Plus } from 'lucide-react'

export interface CreateCourtButtonProps {
  existingNames: string[]
  onCreate: (name: string) => void
  disabled?: boolean
  loading?: boolean
  label?: string
}

export function CreateCourtButton({
  existingNames,
  onCreate,
  disabled,
  loading,
  label,
}: CreateCourtButtonProps) {
  const { terms, i18nText, sport } = useSportTerms()

  const handleClick = () => {
    let next = existingNames.length + 1
    let name = i18nText(`sportTerm.clubAdminDefaultCourtName.${sport}`, { number: String(next) })
    while (existingNames.includes(name)) {
      next++
      name = i18nText(`sportTerm.clubAdminDefaultCourtName.${sport}`, { number: String(next) })
    }
    onCreate(name)
  }

  return (
    <div className="flex justify-center">
      <Button
        variant="outline"
        className="w-full border-dashed border-2 py-6 text-text/70 hover:text-primary hover:border-primary/50"
        onClick={handleClick}
        disabled={disabled}
        loading={loading}
      >
        <Plus size={18} className="mr-2" />
        {label || terms.clubAdminCreateCourt}
      </Button>
    </div>
  )
}
