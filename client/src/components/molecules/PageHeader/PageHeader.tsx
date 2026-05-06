import { ConnectionStatus, type ConnectionStatusLabels } from '../../atoms/ConnectionStatus'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  showStatus?: boolean
  landscape?: boolean
  connectionLabels?: ConnectionStatusLabels
}

export function PageHeader({
  title,
  subtitle,
  actions,
  showStatus = true,
  landscape = false,
  connectionLabels,
}: PageHeaderProps) {
  return (
    <>
      {showStatus && <div className={`${landscape ? 'landscape:hidden' : ''}`}>
        <ConnectionStatus labels={connectionLabels} />
      </div>}
      <header className={`p-4 m-2 border-b border-border flex justify-between items-center ${landscape ? 'landscape:hidden' : ''}`}>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
    </>
  )
}
