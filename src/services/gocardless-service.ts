import { supabase } from '@/integrations/supabase/client'
import { bankConnectionService, type CreateBankConnectionParams } from './bank-connection-service'

export interface Institution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

interface Requisition {
  id: string
  redirect: string
  status: string
  accounts: string[]
  link?: string
  reference?: string
}

interface Transaction {
  transactionId: string
  bookingDate: string
  transactionAmount: {
    amount: string
    currency: string
  }
  debtorName?: string
  creditorName?: string
  debtorAccount?: { iban?: string }
  creditorAccount?: { iban?: string }
  remittanceInformationUnstructured?: string
}

export interface GoCardlessBalance {
  balanceAmount: {
    amount: string
    currency: string
  }
  balanceType: string
  referenceDate?: string
  lastChangeDateTime?: string
}

interface GoCardlessError extends Error {
  setup_required?: boolean
  details?: string
}

function parseEdgeBody(error: unknown): Record<string, unknown> | null {
  const err = error as Record<string, unknown> | null | undefined;
  const body = (err?.context as Record<string, unknown> | undefined)?.body;
  if (!body) return null

  if (typeof body === 'object') return body as Record<string, unknown>

  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return { error: body }
    }
  }

  return null
}

function parseError(error: unknown): GoCardlessError {
  const e = error as Record<string, unknown>;
  const edge = parseEdgeBody(error)
  const messageFromEdge = edge?.error || edge?.message

  const err = new Error((messageFromEdge as string | undefined) || (e.message as string | undefined) || 'Unknown error') as GoCardlessError

  if (edge?.details) {
    err.details = edge.details as string
  } else if (e?.details) {
    err.details = e.details as string
  }

  if (
    edge?.setup_required ||
    e.setup_required ||
    (err.details && err.details.includes('nicht konfiguriert')) ||
    (err.message && err.message.includes('nicht konfiguriert'))
  ) {
    err.setup_required = true
  }

  return err
}

export class GoCardlessService {
  private static instance: GoCardlessService

  static getInstance(): GoCardlessService {
    if (!GoCardlessService.instance) {
      GoCardlessService.instance = new GoCardlessService()
    }
    return GoCardlessService.instance
  }

  async getInstitutions(country: string = 'DE'): Promise<Institution[]> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('gocardless-sync', {
      body: {
        action: 'get-institutions',
        country,
      },
    })

    if (response.error) {
      throw parseError(response.error)
    }
    return (response.data?.institutions || []) as Institution[]
  }

  async createRequisition(institutionId: string, redirectUrl: string): Promise<Requisition> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('gocardless-sync', {
      body: {
        action: 'create-requisition',
        institution_id: institutionId,
        redirect_url: redirectUrl,
      },
    })

    if (response.error) {
      throw parseError(response.error)
    }
    return response.data?.requisition as Requisition
  }

  async getTransactions(requisitionId: string, accountId: string, dateFrom: string, dateTo: string): Promise<Transaction[]> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('gocardless-sync', {
      body: {
        action: 'get-transactions',
        requisition_id: requisitionId,
        account_id: accountId,
        date_from: dateFrom,
        date_to: dateTo,
      },
    })

    if (response.error) {
      throw parseError(response.error)
    }
    return response.data?.transactions as Transaction[]
  }

  async getAccounts(requisitionId: string): Promise<{ requisition: Requisition; accounts: (Record<string, unknown> & { balances?: GoCardlessBalance[] })[] }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await supabase.functions.invoke('gocardless-sync', {
      body: {
        action: 'get-accounts',
        requisition_id: requisitionId,
      },
    })

    if (response.error) {
      throw parseError(response.error)
    }
    return response.data as { requisition: Requisition; accounts: (Record<string, unknown> & { balances?: GoCardlessBalance[] })[] }
  }

  async createRequisitionWithBankConnection(
    institutionId: string,
    institutionName: string,
    redirectUrl: string,
    institutionBic?: string
  ): Promise<Requisition> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const requisition = await this.createRequisition(institutionId, redirectUrl)

    const connectionParams: CreateBankConnectionParams = {
      institution_id: institutionId,
      institution_name: institutionName,
      institution_bic: institutionBic,
      requisition_id: requisition.id,
      reference: requisition.id
    }

    await bankConnectionService.createBankConnection(connectionParams)

    return requisition
  }

  async reconnectBankConnection(bankConnectionId: string, redirectUrl: string): Promise<Requisition> {
    const connection = await bankConnectionService.getBankConnectionById(bankConnectionId)

    if (!connection) {
      throw new Error('Bankverbindung nicht gefunden')
    }

    const requisition = await this.createRequisition(connection.institution_id, redirectUrl)

    await bankConnectionService.updateBankConnection({
      id: connection.id,
      requisition_id: requisition.id,
      reference: requisition.id,
      status: 'active',
    })

    return requisition
  }

  async completeBankConnection(
    requisitionId: string,
    accessToken?: string,
    agreementId?: string
  ): Promise<void> {
    let connection = await bankConnectionService.getBankConnectionByRequisitionId(requisitionId)

    if (!connection) {
      connection = await bankConnectionService.getBankConnectionByReference(requisitionId)
    }

    if (!connection) {
      console.warn(`No bank connection found for requisition ${requisitionId}`)
      return
    }

    await bankConnectionService.updateBankConnection({
      id: connection.id,
      access_token: accessToken,
      agreement_id: agreementId
    })
  }
}

export const gocardlessService = GoCardlessService.getInstance()