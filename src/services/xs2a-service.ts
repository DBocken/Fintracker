import { supabase } from '@/integrations/supabase/client'

interface Institution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

interface Consent {
  id: string
  redirect_url: string
  status: string
}

interface Account {
  id: string
  iban: string
  name: string
  balance: number
  currency: string
}

interface Transaction {
  id: string
  date: string
  amount: number
  payee: string
  description: string
  currency: string
}

export class XS2AService {
  private static instance: XS2AService

  static getInstance(): XS2AService {
    if (!XS2AService.instance) {
      XS2AService.instance = new XS2AService()
    }
    return XS2AService.instance
  }

  async getInstitutions(country: string = 'DE'): Promise<Institution[]> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('xs2a-sync', {
      body: { 
        action: 'get-institutions', 
        country,
        userId: session.user.id 
      }
    })

    if (response.error) throw response.error
    return (response.data?.institutions || []) as Institution[]
  }

  async createConsent(institutionId: string, redirectUrl: string): Promise<Consent> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('xs2a-sync', {
      body: {
        action: 'create-consent',
        institution_id: institutionId,
        redirect_url: redirectUrl,
        user_reference: session.user.id,
        userId: session.user.id
      }
    })

    if (response.error) throw response.error
    return response.data?.consent as Consent
  }

  async getAccounts(consentId: string): Promise<Account[]> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('xs2a-sync', {
      body: {
        action: 'get-accounts',
        consent_id: consentId,
        userId: session.user.id
      }
    })

    if (response.error) throw response.error
    return response.data?.accounts as Account[]
  }

  async getTransactions(accountId: string, dateFrom: string, dateTo: string): Promise<Transaction[]> {
    const { data: { session } = { session: null } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('xs2a-sync', {
      body: {
        action: 'get-transactions',
        account_id: accountId,
        date_from: dateFrom,
        date_to: dateTo,
        userId: session.user.id
      }
    })

    if (response.error) throw response.error
    return response.data?.transactions as Transaction[]
  }
}

export const xs2aService = XS2AService.getInstance()