export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Organization, 'id'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'id'>>;
      };
      employees: {
        Row: Employee;
        Insert: Omit<Employee, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Employee, 'id'>>;
      };
      work_plans: {
        Row: WorkPlan;
        Insert: Omit<WorkPlan, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<WorkPlan, 'id'>>;
      };
      schedule_days: {
        Row: ScheduleDay;
        Insert: Omit<ScheduleDay, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ScheduleDay, 'id'>>;
      };
      attendance_logs: {
        Row: AttendanceLog;
        Insert: Omit<AttendanceLog, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<AttendanceLog, 'id'>>;
      };
      requests: {
        Row: Request;
        Insert: Omit<Request, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Request, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Notification, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'owner' | 'admin' | 'manager' | 'employee';
      request_type: 'vacation' | 'sick' | 'correction' | 'other';
      request_status: 'pending' | 'approved' | 'rejected';
      draft_type: 'A' | 'B';
    };
  };
}

// ─── Entity types ────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Profile {
  id: string; // references auth.users.id
  organization_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'owner' | 'admin' | 'manager' | 'employee';
  avatar_url: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  organization_id: string;
  profile_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  labels: string[];
  tier: number;
  can_saturday: boolean;
  max_saturdays: number;
  target_hours: number;
  active: boolean;
  created_at: string;
}

export interface WorkPlan {
  id: string;
  organization_id: string;
  employee_id: string;
  date: string; // ISO date string
  work_type: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
}

export interface ScheduleDay {
  id: string;
  organization_id: string;
  draft: 'A' | 'B';
  date: string;
  day_name: string | null;
  day_type: string;
  required_total: number;
  assigned_employees: Json;
  assigned_count: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  organization_id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  created_at: string;
}

export interface Request {
  id: string;
  organization_id: string;
  employee_id: string;
  type: 'vacation' | 'sick' | 'correction' | 'other';
  date_from: string;
  date_to: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  profile_id: string | null;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: string;
}
