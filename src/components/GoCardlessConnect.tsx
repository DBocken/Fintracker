import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { gocardlessService } from '../services/gocardless-service'
import { CreditCard, ExternalLink, Loader2, RefreshCw, AlertTriangle, Search, Building2, Check } from 'lucide-react'
import { getRedirectOrigin, PRODUCTION_APP_ORIGIN } from '@/lib/app-origin'
import InfoButton from '@/components/common/InfoSheet'

interface Institution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
  transaction_total_days?: string
}

interface GoCardlessConnectProps {
  onConnectionSuccess: (accountId: string) => void
}


export function GoCardlessConnect({ onConnectionSuccess: _onConnectionSuccess }: GoCardlessConnectProps) {

  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [filteredInstitutions, setFilteredInstitutions] = useState<Institution[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [requisition, setRequisition] = useState<{ id: string; link?: string; redirect?: string } | null>(null)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  useEffect(() => {
    loadInstitutions()
    try {
      localStorage.removeItem('gocardless_public_url')
    } catch {
    }
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredInstitutions([])
      return
    }

    const query = searchQuery.toLowerCase().trim()
    const queryParts = query.split(/\s+/)

    const filtered = institutions.filter(inst => {
      const name = inst.name.toLowerCase()
      const bic = inst.bic?.toLowerCase() || ''
      
      return queryParts.every(part => 
        name.includes(part) || bic.includes(part)
      )
    })

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    
    const sorted = filtered.sort((a, b) => {
      if (isDev) {
        const aIsSandbox = a.id.includes('SANDBOX')
        const bIsSandbox = b.id.includes('SANDBOX')
        if (aIsSandbox && !bIsSandbox) return -1
        if (bIsSandbox && !aIsSandbox) return 1
      }

      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      const aBic = a.bic?.toLowerCase() || ''
      const bBic = b.bic?.toLowerCase() || ''

      if (aName === query || aBic === query) return -1
      if (bName === query || bBic === query) return 1

      const aStartsWith = aName.startsWith(query) || aBic.startsWith(query)
      const bStartsWith = bName.startsWith(query) || bBic.startsWith(query)
      if (aStartsWith && !bStartsWith) return -1
      if (bStartsWith && !aStartsWith) return 1

      return a.name.localeCompare(b.name)
    })

    setFilteredInstitutions(sorted.slice(0, 20))
  }, [searchQuery, institutions])

  const loadInstitutions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await gocardlessService.getInstitutions('DE')
      console.log('[gocardless-connect] Institutions loaded', { count: data.length })
      
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name))
      setInstitutions(sorted)
      
    } catch (err: unknown) {
      const e = err as { message?: string; setup_required?: boolean; details?: string };
      console.error('[gocardless-connect] Failed to load institutions:', { message: e.message })

      if (e.setup_required || (e.details && e.details.includes('nicht konfiguriert'))) {
        setError('API_SETUP_REQUIRED')
      } else {
        setError(`Fehler: ${e.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowDropdown(value.trim().length > 0)
    if (selectedInstitution) {
      setSelectedInstitution(null)
    }
  }

  const handleSelectInstitution = (institution: Institution) => {
    setSelectedInstitution(institution)
    setSearchQuery(institution.name)
    setShowDropdown(false)
  }

  const handleConnect = async () => {

    if (!selectedInstitution) {
      setError('Bitte wähle eine Bank aus')
      return
    }

    try {
      setConnecting(true)
      setError(null)

      const redirectOrigin = getRedirectOrigin()

      if (!redirectOrigin.startsWith('https://') && !selectedInstitution.id.includes('SANDBOX')) {
        setError('Die Redirect-URL muss HTTPS sein, oder benutze die Sandbox-Testbank.')
        setConnecting(false)
        return
      }

      const redirectUrl = `${redirectOrigin}/ausgabentracker/return`
      
      const rq = await gocardlessService.createRequisition(

        selectedInstitution.id,
        redirectUrl
      )

      console.log('[gocardless-connect] Requisition created')
      setRequisition(rq)
      setShowAuthDialog(true)

      sessionStorage.setItem('gocardless_requisition_id', rq.id)

    } catch (err: unknown) {
      const e = err as { message?: string; setup_required?: boolean };
      console.error('[gocardless-connect] Connection failed:', { message: e.message })

      if (e.setup_required) {
        setError('API_SETUP_REQUIRED')
      } else {
        setError(`Verbindungsfehler: ${e.message}`)
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleRetry = () => {
    setInstitutions([])
    setFilteredInstitutions([])
    setSearchQuery('')
    setSelectedInstitution(null)
    setError(null)
    loadInstitutions()
  }

  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false)
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setError(null)
      alert('Link kopiert')
    } catch {
      setError('Fehler beim Kopieren')
    }
  }

  const openAuthInThisTab = (link: string) => {
    setShowAuthDialog(false)
    window.location.href = link
  }

  const openAuthInNewTab = (link: string) => {
    window.open(link, '_blank')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-positive dark:text-positive" />
          Bank verbinden
        </CardTitle>
        <CardDescription>
          Suche deine Bank und verbinde dich sicher und automatisch
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {showAuthDialog && requisition && (
          <div className="p-4 bg-muted/40 border rounded-md space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-foreground">Authentifizierungslink</div>
                <div className="text-xs text-muted-foreground truncate max-w-full break-words">{requisition.link ?? requisition.redirect ?? ''}</div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => copyLink(requisition.link ?? requisition.redirect ?? '')} variant="outline">Kopieren</Button>
                <Button onClick={() => openAuthInNewTab(requisition.link ?? requisition.redirect ?? '')}>In neuem Tab öffnen</Button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-foreground mb-2">QR-Code scannen (öffne auf dem Handy)</div>
                <img src={`https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(requisition.link ?? requisition.redirect ?? '')}`} alt="QR Code" className="w-40 h-40 bg-white p-1 rounded" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-foreground">oder</div>
                <div className="mt-2">
                  <Button onClick={() => openAuthInThisTab(requisition.link ?? requisition.redirect ?? '')} className="w-full">Auf diesem Gerät öffnen</Button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Wenn du auf diesem Gerät weiter machst, wirst du direkt zur Bank geleitet und nach erfolgreicher Auth zurück zur App.</div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setShowAuthDialog(false)}>Schließen</Button>
            </div>
          </div>
        )}

        {error === 'API_SETUP_REQUIRED' ? (
          <Alert variant="destructive" className="border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="space-y-2">
              <p className="font-medium text-warning dark:text-warning">GoCardless API nicht konfiguriert</p>
              <p className="text-sm text-foreground">
                Die GoCardless API-Schlüssel fehlen. Um Bankkonten zu verbinden, musst du folgende Schritte ausführen:
              </p>
              <ol className="text-sm text-foreground list-decimal list-inside space-y-1 ml-2">
                <li>Erstelle einen kostenlosen Account bei <a href="https://bankaccountdata.gocardless.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GoCardless</a></li>
                <li>Gehe zu deinem GoCardless Dashboard und erstelle ein Secret</li>
                <li>Gehe im Supabase Dashboard zu: Project Settings → Edge Functions</li>
                <li>Füge folgende Secrets hinzu:
                  <ul className="list-disc list-inside ml-4 mt-1 font-mono text-xs text-muted-foreground">
                    <li>GOCARDLESS_SECRET_ID</li>
                    <li>GOCARDLESS_SECRET_KEY</li>
                  </ul>
                </li>
                <li>Die App kann dann Bankverbindungen herstellen</li>
              </ol>
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="relative">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Bank suchen
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (searchQuery.trim()) setShowDropdown(true)
                }}
                placeholder={loading ? "Banken werden geladen..." : "z.B. Revolut, Sparkasse, Deutsche Bank..."}
                disabled={loading || connecting}
                className="pl-10"
              />
              {selectedInstitution && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-positive dark:text-positive" />
              )}
            </div>

            {showDropdown && filteredInstitutions.length > 0 && (
              <div 
                className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {filteredInstitutions.map((institution) => (
                  <button
                    key={institution.id}
                    onClick={() => handleSelectInstitution(institution)}
                    className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {institution.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>BIC: {institution.bic || 'N/A'}</span>
                          {institution.transaction_total_days && (
                            <span>• {institution.transaction_total_days} Tage Verlauf</span>
                          )}
                        </div>
                      </div>
                      {institution.id.includes('SANDBOX') && (
                        <Badge className="bg-positive/15 text-positive dark:text-positive text-xs ml-2 shrink-0">
                          Test
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
                {filteredInstitutions.length === 20 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t">
                    Mehr Ergebnisse verfügbar - tippe spezifischer
                  </div>
                )}
              </div>
            )}

            {showDropdown && searchQuery.trim() && filteredInstitutions.length === 0 && !loading && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-4 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Keine Banken gefunden für &quot;{searchQuery}&quot;</p>
                <p className="text-xs mt-1 text-muted-foreground">Tippe z.B. &quot;Sparkasse&quot;, &quot;Volksbank&quot;, oder &quot;Deutsche Bank&quot;</p>
              </div>
            )}
          </div>

          {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.protocol !== 'https:' && (
            <Alert className="bg-brand/10 border-brand/30">
              <AlertTriangle className="h-4 w-4 text-brand" />
              <AlertDescription className="text-sm text-brand dark:text-brand">
                <strong>Entwicklungsmodus:</strong> In der lokalen Umgebung funktioniert die Bankverbindung nur mit der
                <strong> Sandbox Finance (Test-Bank)</strong>. Für echte Bankverbindungen brauchst du eine HTTPS-URL.
                <br /><br />
                Nutze für echte Bankverbindungen die veröffentlichte App unter {PRODUCTION_APP_ORIGIN}.

              </AlertDescription>
            </Alert>
          )}

          {window.location.protocol === 'https:' && (
            <Alert className="bg-positive/10 border-positive/30">
              <Check className="h-4 w-4 text-positive dark:text-positive" />
              <AlertDescription className="text-sm text-positive dark:text-positive">
                <strong>HTTPS erkannt!</strong> Du kannst jetzt alle Banken verbinden, da du eine sichere Verbindung nutzt.
              </AlertDescription>
            </Alert>
          )}

          {selectedInstitution && (
            <div className="p-3 bg-positive/10 border border-positive/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-positive dark:text-positive" />
                <span className="text-sm text-positive dark:text-positive">
                  Ausgewählt: <strong>{selectedInstitution.name}</strong>
                  {selectedInstitution.id.includes('SANDBOX') && (
                    <Badge className="ml-2 bg-positive/20 text-positive dark:text-positive">Test-Modus</Badge>
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Redirect URL: {getRedirectOrigin()}/ausgabentracker/return
                {getRedirectOrigin().startsWith('https:') ? (
                  <span className="text-positive dark:text-positive ml-1">(HTTPS ✓)</span>
                ) : (
                  <span className="text-warning dark:text-warning ml-1">(HTTP - nur Test-Bank!)</span>
                )}
              </div>
            </div>
          )}

          {!loading && institutions.length > 0 && (

            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{institutions.length.toLocaleString('de-DE')} Banken verfügbar</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="h-6 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Neu laden
              </Button>
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={!selectedInstitution || loading || connecting}
            className="w-full"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verbindung wird hergestellt...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Mit {selectedInstitution ? selectedInstitution.name : 'Bank'} verbinden
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">Du behältst die Kontrolle</p>
            <InfoButton title="Technische Details der Bankanbindung" description="Was im Hintergrund passiert">
              <p>• Du wirst zur sicheren Anmeldung deiner Bank weitergeleitet.</p>
              <p>• Nach der Authentifizierung werden deine Konten angezeigt.</p>
              <p>• Rate Limit: 4 Abrufe/Tag pro Konto.</p>
              <p>• Es werden maximal 90 Tage Historie geladen.</p>
              <p>• Die Verbindung läuft verschlüsselt (HTTPS) und ist jederzeit trennbar.</p>
            </InfoButton>
          </div>
          <p>Deine Verbindung ist jederzeit trennbar – Finanzdaten bleiben lokal auf deinem Gerät.</p>
        </div>
      </CardContent>
    </Card>
  )
}