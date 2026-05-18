type GroupRow = {
  id: string;
  name: string;
  creator_email: string;
  season_type: string;
  range_start: string | null;
  range_end: string | null;
  invite_token: string;
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
  created_at: string;
};

type AvailabilityRow = {
  id: string;
  member_id: string;
  weekend_id: string;
  status: "available" | "busy";
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: GroupRow;
        Insert: Omit<GroupRow, "id" | "created_at" | "invite_token">;
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
        Insert: Omit<MemberRow, "id" | "created_at" | "member_token">;
        Update: Partial<Omit<MemberRow, "id" | "created_at" | "member_token">>;
        Relationships: [];
      };
      availability: {
        Row: AvailabilityRow;
        Insert: Omit<AvailabilityRow, "id" | "updated_at">;
        Update: Partial<Omit<AvailabilityRow, "id" | "updated_at">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
  };
};
