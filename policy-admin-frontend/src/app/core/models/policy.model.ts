export interface PolicyUser {
  _id: string;
  firstname: string;
  email?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  gender?: string;
  userType?: string;
}

export interface PolicyRef {
  _id: string;
  category_name?: string;
  company_name?: string;
  name?: string;
  account_name?: string;
}

export interface Policy {
  _id: string;
  user_id?: string;
  policy_number: string;
  policy_start_date?: string;
  policy_end_date?: string;
  premium_amount?: number;
  premium_amount_written?: number;
  policy_type?: string;
  policy_mode?: string;
  producer?: string;
  csr?: string;
  category_id?: PolicyRef;
  company_id?: PolicyRef;
  agent_id?: PolicyRef;
  account_id?: PolicyRef;
}

export interface SearchResponse {
  users: PolicyUser[];
  policies: Policy[];
}

export interface AggregatePolicyLine {
  policy_number: string;
  policy_start_date?: string;
  policy_end_date?: string;
  premium_amount?: number;
  category?: string;
  carrier?: string;
}

export interface AggregateUserResult {
  userId: string;
  firstname: string;
  email?: string;
  policyCount: number;
  premiumTotal: number;
  policies: AggregatePolicyLine[];
}

export interface UploadSummary {
  totalRows: number;
  policiesInserted: number;
  rowsSkipped: number;
  agents: number;
  users: number;
  accounts: number;
  categories: number;
  carriers: number;
}

export interface ScheduledJob {
  id: string;
  message?: string;
  day?: string;
  time?: string;
  scheduledFor: string;
  status: 'pending' | 'inserted' | 'failed';
  insertedAt?: string;
}

export interface SystemStatus {
  pid: number;
  uptimeSeconds: number;
  cpuPercent: number;
  restartThreshold: number;
  sustainedSamplesRequired: number;
  sustainedStreak: number;
  nearRestart: boolean;
}
