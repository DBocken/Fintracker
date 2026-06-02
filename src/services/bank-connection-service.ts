import { supabase } from '@/integrations/supabase/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface BankConnection {
  id: string
  user_id: string
  institution_id: string
  institution_name: string
  institution_bic?: string
  institution_logo?: string
  institution_country?: string
  requisition_id?: string
  reference?: string
  status: 'active' | 'expired' | 'revoked' | 'suspended'
  agreement_id?: string
  agreement_accepted_at?: string
  created_at: string
  updated_at: string
  last_sync_at?: string
}

export interface CreateBankConnectionParams {
  institution_id: string
  institution_name: string
  institution_bic?: string
  institution_logo?: string
  institution_country?: string
  requisition_id: string
  reference: string
  access_token?: string
  agreement_id?: string
}

export interface UpdateBankConnectionParams {
  id: string
  access_token?: string
  status?: BankConnection['status']
  last_sync_at?: string
  agreement_id?: string
  requisition_id?: string
  reference?: string
}

export interface ConsentStatus {
  hasConsentDate: boolean
  acceptedAt: string | null
  expiresAt: string | null
  isExpired: boolean
  daysRemaining: number | null
}

const CONSENT_VALIDITY_DAYS = 90

export function getConsentStatus(connection: Pick<BankConnection, 'agreement_accepted_at'>): ConsentStatus {
  if (!connection.agreement_accepted_at) {
    return {
      hasConsentDate: false,
      acceptedAt: null,
      expiresAt: null,
      isExpired: false,
      daysRemaining: null,
    }
  }

  const acceptedAt = new Date(connection.agreement_accepted_at)
  const expiresAtDate = new Date(acceptedAt.getTime() + CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()
  const diffMs = expiresAtDate.getTime() - now.getTime()
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

  return {
    hasConsentDate: true,
    acceptedAt: acceptedAt.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
    isExpired: diffMs <= 0,
    daysRemaining,
  }
}

class BankConnectionService {
  async getBankConnections(): Promise<BankConnection[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as BankConnection[]
  }

  async getBankConnectionById(id: string): Promise<BankConnection | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as BankConnection
  }

  async getBankConnectionByRequisitionId(requisitionId: string): Promise<BankConnection | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('requisition_id', requisitionId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as BankConnection
  }

  async getBankConnectionByReference(reference: string): Promise<BankConnection | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('reference', reference)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as BankConnection
  }

  async createBankConnection(params: CreateBankConnectionParams): Promise<BankConnection> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const connectionData: any = {
      user_id: user.id,
      institution_id: params.institution_id,
      institution_name: params.institution_name,
      requisition_id: params.requisition_id,
      reference: params.reference,
      status: 'active'
    }

    if (params.institution_bic) connectionData.institution_bic = params.institution_bic
    if (params.institution_logo) connectionData.institution_logo = params.institution_logo
    if (params.institution_country) connectionData.institution_country = params.institution_country
    if (params.agreement_id) connectionData.agreement_id = params.agreement_id
    if (params.agreement_id) connectionData.agreement_accepted_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('bank_connections')
      .insert(connectionData)
      .select()
      .single()

    if (error) throw error
    return data as BankConnection
  }

  async updateBankConnection(params: UpdateBankConnectionParams): Promise<BankConnection> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (params.status) updateData.status = params.status
    if (params.last_sync_at) updateData.last_sync_at = params.last_sync_at
    if (params.agreement_id) {
      updateData.agreement_id = params.agreement_id
      updateData.agreement_accepted_at = new Date().toISOString()
    }
    if (params.requisition_id !== undefined) updateData.requisition_id = params.requisition_id
    if (params.reference !== undefined) updateData.reference = params.reference

    const { data, error } = await supabase
      .from('bank_connections')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return data as BankConnection
  }

  async deleteBankConnection(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('bank_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
  }

  async updateLastSync(id: string): Promise<void> {
    await this.updateBankConnection({
      id,
      last_sync_at: new Date().toISOString()
    })
  }

  async revokeBankConnection(id: string): Promise<BankConnection> {
    return this.updateBankConnection({
      id,
      status: 'revoked'
    })
  }
}

export const bankConnectionService = new BankConnectionService()

export const useBankConnections = () => {
  return useQuery({
    queryKey: ['bank-connections'],
    queryFn: () => bankConnectionService.getBankConnections(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useBankConnection = (id: string) => {
  return useQuery({
    queryKey: ['bank-connection', id],
    queryFn: () => bankConnectionService.getBankConnectionById(id),
    enabled: !!id,
  })
}

export const useBankConnectionByRequisitionId = (requisitionId: string) => {
  return useQuery({
    queryKey: ['bank-connection-by-requisition', requisitionId],
    queryFn: () => bankConnectionService.getBankConnectionByRequisitionId(requisitionId),
    enabled: !!requisitionId,
  })
}

export const useCreateBankConnection = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: CreateBankConnectionParams) =>
      bankConnectionService.createBankConnection(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export const useUpdateBankConnection = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: UpdateBankConnectionParams) =>
      bankConnectionService.updateBankConnection(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export const useDeleteBankConnection = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bankConnectionService.deleteBankConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export const useRevokeBankConnection = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bankConnectionService.revokeBankConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}