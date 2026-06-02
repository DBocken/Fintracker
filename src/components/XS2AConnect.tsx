import { useState, useEffect } from 'react'
import { CreditCard, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { xs2aService } from '../services/xs2a-service'

interface Institution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

interface XS2AConnectProps {
  onConnectionSuccess: (accountId: string) => void
}

export function XS2AConnect({ onConnectionSuccess: _onConnectionSuccess }: XS2AConnectProps) { // Renamed to _onConnectionSuccess to mark as unused
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInstitutions()
  }, [])

  const loadInstitutions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await xs2aService.getInstitutions('DE')
      
      // Fallback für Entwicklung
      const fallbackInstitutions = [
        {
          id: 'XS2A_DEUTSCHE_BANK',
          name: 'Deutsche Bank (XS2A)',
          bic: 'DEUTDEFF',
          logo: '',
          countries: ['DE']
        },
        {
          id: 'XS2A_COMMERZBANK',
          name: 'Commerzbank (XS2A)',
          bic: 'COBADEDD',
          logo: '',
          countries: ['DE']
        },
        {
          id: 'XS2A_SPARKASSE',
          name: 'Sparkasse (XS2A)',
          bic: 'HELADEF1',
          logo: '',
          countries: ['DE']
        }
      ]
      
      setInstitutions(data.length > 0 ? data : fallbackInstitutions)
      
    } catch (err: any) {
      console.error('❌ XS2A Fehler:', err)
      setError(`Fehler: ${err.message}`)
      
      // Fallback bei Fehler
      const fallbackInstitutions = [
        {
          id: 'XS2A_TEST',
          name: 'XS2A Test Bank',
          bic: 'TEST123',
          logo: '',
          countries: ['DE']
        }
      ]
      setInstitutions(fallbackInstitutions)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!selectedInstitution) {
      setError('Bitte wähle eine Bank aus')
      return
    }

    try {
      setConnecting(true)
      setError(null)

      const redirectUrl = `${window.location.origin}/ausgabentracker/return`
      const consent = await xs2aService.createConsent(
        selectedInstitution,
        redirectUrl
      )

      window.location.href = consent.redirect_url
    } catch (err: any) {
      console.error('❌ XS2A Verbindungsfehler:', err)
      setError(`Verbindungsfehler: ${err.message}`)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <CreditCard className="h-5 w-5 text-blue-400" />
          Bankverbindung via XS2A
        </CardTitle>
        <CardDescription className="text-gray-400">
          Verbinde dein Bankkonto sicher über XS2A und importiere Transaktionen automatisch
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              Bank auswählen
            </label>
            <Select
              value={selectedInstitution}
              onValueChange={setSelectedInstitution}
              disabled={loading || connecting}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder={loading ? "Lädt..." : "Bank auswählen..."} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 max-h-64">
                {institutions.map((institution) => (
                  <SelectItem key={institution.id} value={institution.id}>
                    <div className="flex items-center gap-2">
                      <span>{institution.name}</span>
                      {institution.id.includes('TEST') && (
                        <span className="text-xs bg-blue-600 px-2 py-1 rounded">Test</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleConnect}
            disabled={!selectedInstitution || loading || connecting}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verbindung wird hergestellt...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Mit Bank verbinden
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>• Sichere Verbindung via XS2A-Standard</p>
          <p>• Keine Speicherung von Bankdaten</p>
          <p>• Jederzeit trennbar</p>
          <p>• Unterstützt alle deutschen Banken</p>
        </div>
      </CardContent>
    </Card>
  )
}