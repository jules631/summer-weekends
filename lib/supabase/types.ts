type GroupRow = {
  id: string;
  name: string;
  creator_email: string;
  season_type: string;
  range_start: string | null;
  range_end: string | null;
  invite_token: string;
  group_type: "permanent" | "seasonal";
  created_at: string;
};

type WeekendRow = {
  id: string;
  group_id: string;
  start_date: string;
  end_date: string;
  label: string | null;
  sort_order: number;
  created_at: string;
};

type MemberRow = {
  id: string;
  group_id: string;
  name: string;
  member_token: string;
  user_identity_id: string | null;
  created_at: string;
};

type AvailabilityRow = {
  id: string;
  member_id: string;
  weekend_id: string;
  status: "available" | "busy";
  updated_at: string;
};

type PlanRow = {
  id: string;
  group_id: string;
  weekend_id: string;
  member_id: string;
  title: string;
  day: "fri" | "sat" | "sun" | null;
  created_at: string;
};

type PlanCommitRow = {
  id: string;
  plan_id: string;
  member_id: string;
  status: "in" | "pass";
  created_at: string;
};

type PlanCommentRow = {
  id: string;
  plan_id: string;
  member_id: string;
  body: string;
  created_at: string;
};

type UserIdentityRow = {
  id: string;
  user_token: string;
  email: string;
  email_verified: boolean;
  created_at: string;
};

type EmailClaimTokenRow = {
  id: string;
  token: string;
  email: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

type AvailabilityExceptionRow = {
  id: string;
  member_id: string;
  weekend_id: string;
  day: "fri" | "sat" | "sun" | "mon";
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: GroupRow;
        Insert: Omit<GroupRow, "id" | "created_at" | "invite_token" | "group_type"> & { group_type?: "permanent" | "seasonal" };
        Update: Partial<Omit<GroupRow, "id" | "created_at" | "invite_token">>;
        Relationships: [];
      };
      weekends: {
        Row: WeekendRow;
        Insert: Omit<WeekendRow, "id" | "created_at">;
        Update: Partial<Omit<WeekendRow, "id" | "created_at">>;
        Relationships: [];
      };
      members: {
        Row: MemberRow;
        Insert: Omit<MemberRow, "id" | "created_at" | "member_token" | "user_identity_id"> & { user_identity_id?: string | null };
        Update: Partial<Omit<MemberRow, "id" | "created_at" | "member_token">>;
        Relationships: [];
      };
      availability: {
        Row: AvailabilityRow;
        Insert: Omit<AvailabilityRow, "id" | "updated_at">;
        Update: Partial<Omit<AvailabilityRow, "id" | "updated_at">>;
        Relationships: [];
      };
      plans: {
        Row: PlanRow;
        Insert: Omit<PlanRow, "id" | "created_at">;
        Update: Partial<Pick<PlanRow, "title" | "day">>;
        Relationships: [];
      };
      plan_commits: {
        Row: PlanCommitRow;
        Insert: Omit<PlanCommitRow, "id" | "created_at">;
        Update: Partial<Pick<PlanCommitRow, "status">>;
        Relationships: [];
      };
      plan_comments: {
        Row: PlanCommentRow;
        Insert: Omit<PlanCommentRow, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      availability_exceptions: {
        Row: AvailabilityExceptionRow;
        Insert: Omit<AvailabilityExceptionRow, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      user_identities: {
        Row: UserIdentityRow;
        Insert: Omit<UserIdentityRow, "id" | "user_token" | "created_at">;
        Update: Partial<Pick<UserIdentityRow, "email_verified">>;
        Relationships: [];
      };
      email_claim_tokens: {
        Row: EmailClaimTokenRow;
        Insert: Omit<EmailClaimTokenRow, "id" | "token" | "created_at" | "used_at"> & { used_at?: string | null };
        Update: Partial<Pick<EmailClaimTokenRow, "used_at">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
  };
};
