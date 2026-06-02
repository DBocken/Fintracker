import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUserId } from './auth-service';
import { getAccounts } from './account-service';
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from './local-finance-store';

export interface BankConnection {
  id: string;
  user_id: string;
  institution_id: string;
  institution_name: string;
  institution_bic?: string;
  institution_logo?: string;
  institution_country?: string;
  requisition_id?: string;
  reference?: string;
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  agreement_id?: string;
  agreement_accepted_at?: string;
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
}

export interface CreateBankConnectionParams {
  institution_id: string;
  institution_name: string;
  institution_bic?: string;
  institution_logo?: string;
  institution_country?: string;
  requisition_id: string;
  reference: string;
  access_token?: string;
  agreement_id?: string;
}

export interface UpdateBankConnectionParams {
  id: string;
  access_token?: string;
  status?: BankConnection['status'];
  last_sync_at?: string;
  agreement_id?: string;
  requisition_id?: string;
  reference?: string;
}

export interface ConsentStatus {
  hasConsentDate: boolean;
  acceptedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
}

const CONSENT_VALIDITY_DAYS = 90;

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || 'local';
}

export function getConsentStatus(connection: Pick<BankConnection, 'agreement_accepted_at'>): ConsentStatus {
  if (!connection.agreement_accepted_at) {
    return {
      hasConsentDate: false,
      acceptedAt: null,
      expiresAt: null,
      isExpired: false,
      daysRemaining: null,
    };
  }

  const acceptedAt = new Date(connection.agreement_accepted_at);
  const expiresAtDate = new Date(acceptedAt.getTime() + CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = expiresAtDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  return {
    hasConsentDate: true,
    acceptedAt: acceptedAt.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
    isExpired: diffMs <= 0,
    daysRemaining,
  };
}

async function hydrateConnectionsFromAccounts(): Promise<BankConnection[]> {
  const existing = await readLocalFinanceList<BankConnection>('bankConnections');
  if (existing.length > 0) return existing;

  const accounts = await getAccounts();
  const connectedAccounts = accounts.filter(
    (account) => account.gocardless_account_id || account.bank_connection_id || account.gocardless_requisition_id,
  );

  if (connectedAccounts.length === 0) return [];

  const userId = await localUserId();
  const now = new Date().toISOString();

  const hydratedConnections: BankConnection[] = connectedAccounts.map((account) => ({
    id: account.bank_connection_id || crypto.randomUUID(),
    user_id: userId,
    institution_id: account.gocardless_institution_id || account.gocardless_requisition_id || account.id,
    institution_name: account.gocardless_institution_name || account.name,
    institution_country: 'DE',
    requisition_id: account.gocardless_requisition_id || undefined,
    reference: account.gocardless_account_id || account.id,
    status: 'active',
    created_at: account.last_sync_at || now,
    updated_at: now,
    last_sync_at: account.last_sync_at || undefined,
  }));

  await writeLocalFinanceList('bankConnections', hydratedConnections);
  return hydratedConnections;
}

class BankConnectionService {
  async getBankConnections(): Promise<BankConnection[]> {
    const connections = await hydrateConnectionsFromAccounts();
    return connections.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  async getBankConnectionById(id: string): Promise<BankConnection | null> {
    const connections = await this.getBankConnections();
    return connections.find((connection) => connection.id === id) || null;
  }

  async getBankConnectionByRequisitionId(requisitionId: string): Promise<BankConnection | null> {
    const connections = await this.getBankConnections();
    return connections.find((connection) => connection.requisition_id === requisitionId) || null;
  }

  async getBankConnectionByReference(reference: string): Promise<BankConnection | null> {
    const connections = await this.getBankConnections();
    return connections.find((connection) => connection.reference === reference) || null;
  }

  async createBankConnection(params: CreateBankConnectionParams): Promise<BankConnection> {
    const now = new Date().toISOString();
    return upsertLocalFinanceItem<BankConnection>('bankConnections', {
      id: crypto.randomUUID(),
      user_id: await localUserId(),
      institution_id: params.institution_id,
      institution_name: params.institution_name,
      institution_bic: params.institution_bic,
      institution_logo: params.institution_logo,
      institution_country: params.institution_country,
      requisition_id: params.requisition_id,
      reference: params.reference,
      status: 'active',
      agreement_id: params.agreement_id,
      agreement_accepted_at: params.agreement_id ? now : undefined,
      created_at: now,
      updated_at: now,
    });
  }

  async updateBankConnection(params: UpdateBankConnectionParams): Promise<BankConnection> {
    const updateData: Partial<BankConnection> = {
      updated_at: new Date().toISOString(),
    };

    if (params.status) updateData.status = params.status;
    if (params.last_sync_at) updateData.last_sync_at = params.last_sync_at;
    if (params.agreement_id) {
      updateData.agreement_id = params.agreement_id;
      updateData.agreement_accepted_at = new Date().toISOString();
    }
    if (params.requisition_id !== undefined) updateData.requisition_id = params.requisition_id;
    if (params.reference !== undefined) updateData.reference = params.reference;

    return updateLocalFinanceItem<BankConnection>('bankConnections', params.id, updateData);
  }

  async deleteBankConnection(id: string): Promise<void> {
    await deleteLocalFinanceItem<BankConnection>('bankConnections', id);
  }

  async updateLastSync(id: string): Promise<void> {
    await this.updateBankConnection({
      id,
      last_sync_at: new Date().toISOString(),
    });
  }

  async revokeBankConnection(id: string): Promise<BankConnection> {
    return this.updateBankConnection({
      id,
      status: 'revoked',
    });
  }
}

export const bankConnectionService = new BankConnectionService();

export const useBankConnections = () => {
  return useQuery({
    queryKey: ['bank-connections'],
    queryFn: () => bankConnectionService.getBankConnections(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useBankConnection = (id: string) => {
  return useQuery({
    queryKey: ['bank-connection', id],
    queryFn: () => bankConnectionService.getBankConnectionById(id),
    enabled: !!id,
  });
};

export const useBankConnectionByRequisitionId = (requisitionId: string) => {
  return useQuery({
    queryKey: ['bank-connection-by-requisition', requisitionId],
    queryFn: () => bankConnectionService.getBankConnectionByRequisitionId(requisitionId),
    enabled: !!requisitionId,
  });
};

export const useCreateBankConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateBankConnectionParams) => bankConnectionService.createBankConnection(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

export const useUpdateBankConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UpdateBankConnectionParams) => bankConnectionService.updateBankConnection(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

export const useDeleteBankConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bankConnectionService.deleteBankConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

export const useRevokeBankConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bankConnectionService.revokeBankConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};