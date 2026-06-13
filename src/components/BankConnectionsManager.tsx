import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useBankConnections, useRevokeBankConnection, useDeleteBankConnection } from '@/services/bank-connection-service'
import { Building2, AlertTriangle, CheckCircle2, Clock, Shield, Trash2, RefreshCw } from 'lucide-react'

export function BankConnectionsManager() {
  const { data: bankConnections, isLoading, error, refetch } = useBankConnections()
  const revokeConnection = useRevokeBankConnection()
  const deleteConnection = useDeleteBankConnection()
  
  const [connectionToRevoke, setConnectionToRevoke] = useState<string | null>(null)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)

  const handleRevoke = async () => {
    if (!connectionToRevoke) return
    
    try {
      await revokeConnection.mutateAsync(connectionToRevoke)
      setConnectionToRevoke(null)
      refetch()
    } catch (err: any) {
      console.error('Failed to revoke connection:', err)
      alert('Fehler beim Widerrufen der Verbindung')
    }
  }

  const handleDelete = async () => {
    if (!connectionToDelete) return
    
    try {
      await deleteConnection.mutateAsync(connectionToDelete)
      setConnectionToDelete(null)
      refetch()
    } catch (err: any) {
      console.error('Failed to delete connection:', err)
      alert('Fehler beim Löschen der Verbindung')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-positive/20 text-positive"><CheckCircle2 className="h-3 w-3 mr-1" /> Aktiv</Badge>
      case 'expired':
        return <Badge variant="outline" className="text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" /> Abgelaufen</Badge>
      case 'revoked':
        return <Badge variant="outline" className="text-warning border-warning/30"><AlertTriangle className="h-3 w-3 mr-1" /> Widerrufen</Badge>
      case 'suspended':
        return <Badge variant="outline" className="text-muted-foreground border-border">Pausiert</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card className="premium-card">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Building2 className="h-5 w-5 text-brand" />
              Verknüpfte Banken
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Deine Bankverbindungen sind sicher gespeichert und auf allen Geräten verfügbar
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-accent-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Fehler beim Laden der Bankverbindungen
            </AlertDescription>
          </Alert>
        )}

        {!bankConnections || bankConnections.length === 0 ? (
          <Alert className="bg-muted border-border">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-muted-foreground">
              Noch keine Bankverbindungen vorhanden. Verbinde deine erste Bank über PSD2.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {bankConnections.map((connection) => (
              <div
                key={connection.id}
                className="p-4 bg-muted border border-border rounded-lg hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-5 w-5 text-brand flex-shrink-0" />
                      <h3 className="font-semibold text-foreground truncate">
                        {connection.institution_name}
                      </h3>
                      {getStatusBadge(connection.status)}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      {connection.institution_bic && (
                        <p className="flex items-center gap-2">
                          <span className="text-muted-foreground">BIC:</span>
                          <span className="font-mono text-xs">{connection.institution_bic}</span>
                        </p>
                      )}
                      {connection.institution_country && (
                        <p className="flex items-center gap-2">
                          <span className="text-muted-foreground">Land:</span>
                          <span>{connection.institution_country}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground">Verknüpft am:</span>
                        <span>{new Date(connection.created_at).toLocaleDateString('de-DE')}</span>
                      </p>
                      {connection.last_sync_at && (
                        <p className="flex items-center gap-2">
                          <span className="text-muted-foreground">Letzter Sync:</span>
                          <span>{new Date(connection.last_sync_at).toLocaleDateString('de-DE')}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    {connection.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConnectionToRevoke(connection.id)}
                        className="text-warning border-warning/30 hover:bg-warning/10"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Widerrufen
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConnectionToDelete(connection.id)}
                      className="text-warning border-warning/30 hover:bg-warning/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {connection.status === 'revoked' && (
                  <Alert className="mt-3 bg-warning/10 border-warning/30">
                    <Clock className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-warning text-sm">
                      Diese Bankverbindung wurde widerrufen. Um erneut auf deine Konten zuzugreifen, musst du die Verbindung neu herstellen.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        )}

        <Alert className="bg-brand/10 border-brand/30">
          <Shield className="h-4 w-4 text-brand" />
          <AlertDescription className="text-brand text-sm">
            <strong>🔒 Sicherheit:</strong> Deine Bankverbindungen sind verschlüsselt gespeichert und nur für dich zugänglich. 
            Zugriff tokens sind sicher in der Datenbank geschützt.
          </AlertDescription>
        </Alert>
      </CardContent>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!connectionToRevoke} onOpenChange={() => setConnectionToRevoke(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Bankverbindung widerrufen?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Dies wird den Zugriff auf deine Bankkonten über diese Verbindung deaktivieren. 
              Du kannst die Verbindung jederzeit neu herstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-accent">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-warning hover:bg-warning text-white"
            >
              Widerrufen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!connectionToDelete} onOpenChange={() => setConnectionToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Bankverbindung löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Dies wird die Bankverbindung vollständig aus deiner Liste entfernen. 
              Deine Kontodaten bleiben erhalten, aber du musst die Verbindung neu herstellen, um neue Transaktionen abzurufen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-accent">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-warning hover:bg-warning text-white"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}