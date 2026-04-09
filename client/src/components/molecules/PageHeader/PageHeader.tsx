import { ConnectionStatus } from '../../atoms/ConnectionStatus'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  showStatus?: boolean
  landscape?: boolean
}

export function PageHeader({
  title,
  subtitle,
  actions,
  showStatus = true,
  landscape = false
}: PageHeaderProps) {
  return (
    <>
      {showStatus && <ConnectionStatus />}
      <div className={`pt-12 p-4 border-b border-border flex justify-between items-center ${landscape ? 'landscape:hidden' : ''}`}>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </>
  )
}
