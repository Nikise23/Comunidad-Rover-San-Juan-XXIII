import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export type Project = {
  id: string;
  name: string;
  description?: string;
  budgetTarget: number;
  startDate?: string;
  endDate?: string;
  status: string;
  events?: Event[];
  beneficiaries?: Beneficiary[];
};

export type Beneficiary = {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  /** Fecha de nacimiento en formato ISO (YYYY-MM-DD) */
  birthDate?: string | null;
  contact?: string;
  role?: string;
  /** Si entregó documentación */
  documentationSubmitted?: boolean;
  projects?: Project[];
};

export type Event = {
  id: string;
  name: string;
  type: string;
  date: string;
  income: number;
  expenses: number;
  projectId: string;
  project?: Project;
  responsibleId?: string;
  responsible?: Beneficiary;
  products?: Product[];
};

export type Product = {
  id: string;
  name: string;
  unit?: string;
  pricePerUnit: number;
  /** Ganancia del scout por unidad. null = total (precio); número = monto fijo por unidad */
  scoutEarningsPerUnit?: number | null;
  totalQuantity?: number;
  eventId: string;
};

export type Sale = {
  id: string;
  quantity: number;
  amount: number;
  beneficiaryId: string;
  beneficiary?: Beneficiary;
  eventId: string;
  event?: Event;
  productId: string;
  product?: Product;
};

export type Raffle = {
  id: string;
  name: string;
  pricePerNumber: number;
  totalNumbers: number;
  /** Ganancia del scout por número vendido. null = total (precio del número) */
  scoutEarningsPerNumber?: number | null;
  eventId: string;
  event?: Event;
  numbers?: RaffleNumber[];
};

export type RaffleNumberStatus = 'disponible' | 'asignado' | 'reservado' | 'vendido' | 'no_vendido';

export type RaffleNumber = {
  id: string;
  number: number;
  status: RaffleNumberStatus;
  raffleId: string;
  beneficiaryId?: string | null;
  beneficiary?: Beneficiary;
  soldTo?: string | null;
};

export type DashboardData = {
  projects: { id: string; name: string; budgetTarget: number; totalRaised: number; progressPercent: number; eventsCount: number; status: string }[];
  recentEvents: { id: string; name: string; type: string; date: string; income: number; expenses: number; netProfit: number }[];
  beneficiaryRanking: { beneficiaryId: string; fullName: string; total: number }[];
  scoutRaffleEarnings: { beneficiaryId: string; fullName: string; totalScoutEarnings: number; totalContributions: number; byEvent: { eventId: string; eventName: string; scoutEarnings: number }[] }[];
  evolution: { label: string; total: number }[];
};

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: Partial<Project> & { beneficiaryIds?: string[] }) => api.post<Project>('/projects', data),
  update: (id: string, data: Partial<Project> & { beneficiaryIds?: string[] }) => api.patch<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const beneficiariesApi = {
  list: () => api.get<Beneficiary[]>('/beneficiaries'),
  get: (id: string) => api.get<Beneficiary>(`/beneficiaries/${id}`),
  create: (data: Partial<Beneficiary> & { projectIds?: string[] }) => api.post<Beneficiary>('/beneficiaries', data),
  update: (id: string, data: Partial<Beneficiary> & { projectIds?: string[] }) => api.patch<Beneficiary>(`/beneficiaries/${id}`, data),
  delete: (id: string) => api.delete(`/beneficiaries/${id}`),
  exportCsv: () => api.get<Blob>('/beneficiaries/export/csv', { responseType: 'blob' as any }),
};

export const eventsApi = {
  list: (projectId?: string) => api.get<Event[]>('/events', { params: projectId ? { projectId } : {} }),
  get: (id: string) => api.get<Event>(`/events/${id}`),
  create: (data: Partial<Event>) => api.post<Event>('/events', data),
  update: (id: string, data: Partial<Event>) => api.patch<Event>(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
  addProduct: (data: Partial<Product>) => api.post<Product>('/events/products', data),
  updateProduct: (id: string, data: Partial<Product>) => api.patch<Product>(`/events/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/events/products/${id}`),
};

export const salesApi = {
  list: (params?: { eventId?: string; beneficiaryId?: string }) => api.get<Sale[]>('/sales', { params }),
  get: (id: string) => api.get<Sale>(`/sales/${id}`),
  create: (data: { quantity: number; beneficiaryId: string; eventId: string; productId: string }) => api.post<Sale>('/sales', data),
  update: (id: string, data: Partial<Sale>) => api.patch<Sale>(`/sales/${id}`, data),
  delete: (id: string) => api.delete(`/sales/${id}`),
  ranking: (eventId: string) => api.get<{ beneficiaryId: string; fullName: string; total: number; scoutEarnings: number }[]>(`/sales/ranking/${eventId}`),
};

export type RaffleSummary = {
  total: number;
  available: number;
  assigned: number;
  reserved: number;
  sold: number;
  notSold: number;
  pricePerNumber: number;
  byBeneficiary: {
    beneficiaryId: string;
    fullName: string;
    assigned: number;
    sold: number;
    remaining: number;
    moneyCollected: number;
    scoutEarnings: number;
  }[];
};

export const rafflesApi = {
  list: (eventId?: string) => api.get<Raffle[]>('/raffles', { params: eventId ? { eventId } : {} }),
  get: (id: string) => api.get<Raffle>(`/raffles/${id}`),
  getSummary: (id: string) => api.get<RaffleSummary>(`/raffles/${id}/summary`),
  create: (data: { name: string; pricePerNumber: number; totalNumbers: number; eventId: string; scoutEarningsPerNumber?: number | null }) => api.post<Raffle>('/raffles', data),
  update: (id: string, data: Partial<Raffle>) => api.patch<Raffle>(`/raffles/${id}`, data),
  delete: (id: string) => api.delete(`/raffles/${id}`),
  assignNumber: (raffleId: string, data: { number: number; beneficiaryId?: string; status?: string }) => api.post<RaffleNumber>(`/raffles/${raffleId}/numbers/assign`, data),
  assignByBlocks: (raffleId: string, data: { beneficiaryIds: string[]; numbersPerBlock?: number }) => api.post<{ assigned: number }>(`/raffles/${raffleId}/numbers/assign-blocks`, data),
  assignContinuous: (raffleId: string, data: { assignments: { beneficiaryId: string; count: number }[] }) => api.post<{ assigned: number }>(`/raffles/${raffleId}/numbers/assign-continuous`, data),
  assignRandom: (raffleId: string, data: { beneficiaryIds: string[] }) => api.post<{ assigned: number }>(`/raffles/${raffleId}/numbers/assign-random`, data),
  assignByRanges: (raffleId: string, data: { beneficiaryId: string; ranges: string }) => api.post<{ assigned: number }>(`/raffles/${raffleId}/numbers/assign-ranges`, data),
  setBulkStatus: (raffleId: string, data: { ranges: string; status: RaffleNumberStatus; soldTo?: string }) => api.patch<{ updated: number }>(`/raffles/${raffleId}/numbers/bulk-status`, data),
  releaseUnsold: (raffleId: string) => api.post<{ released: number }>(`/raffles/${raffleId}/numbers/release-unsold`),
  setNumberStatus: (raffleId: string, number: number, data: { status: RaffleNumberStatus; soldTo?: string }) => api.patch(`/raffles/${raffleId}/numbers/${number}/status`, data),
  exportCsv: (raffleId: string) => api.get<Blob>(`/raffles/${raffleId}/export/csv`, { responseType: 'blob' }),
  draw: (raffleId: string, count: number) => api.post<{ winners: { number: number; soldTo: string | null; beneficiaryName: string }[] }>(`/raffles/${raffleId}/draw`, { count }),
};

export type Contribution = {
  id: string;
  beneficiaryId: string;
  beneficiary?: Beneficiary;
  projectId: string;
  amount: number;
  date?: string;
  note?: string;
  createdAt: string;
};

export const contributionsApi = {
  listByProject: (projectId: string) => api.get<Contribution[]>(`/contributions/project/${projectId}`),
  create: (projectId: string, data: { beneficiaryId: string; amount: number; date?: string; note?: string }) =>
    api.post<Contribution>(`/contributions/project/${projectId}`, data),
  update: (id: string, data: { beneficiaryId?: string; amount?: number; date?: string; note?: string }) =>
    api.patch<Contribution>(`/contributions/${id}`, data),
  delete: (id: string) => api.delete(`/contributions/${id}`),
};

export const reportsApi = {
  dashboard: (projectId?: string) => api.get<DashboardData>('/reports/dashboard', { params: projectId ? { projectId } : {} }),
  projectFinancial: (id: string) => api.get<{
    totalRaised: number;
    budgetTarget: number;
    progressPercent: number;
    eventsCount: number;
    incomeByEvent: { eventId: string; eventName: string; income: number; expenses: number; net: number }[];
    beneficiaryRanking: { beneficiaryId: string; fullName: string; total: number }[];
  }>(`/reports/project/${id}/financial`),
  getProjectScoutSummary: (projectId: string) => api.get<{
    beneficiaryId: string;
    fullName: string;
    totalContributions: number;
    totalEarningsFromEvents: number;
    total: number;
  }[]>(`/reports/project/${projectId}/scout-summary`),
  getEventRaffleRanking: (eventId: string) => api.get<{ beneficiaryId: string; fullName: string; totalSold: number; scoutEarnings: number }[]>(`/reports/events/${eventId}/raffle-ranking`),
};
