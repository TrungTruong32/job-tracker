
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_flags": {
                  Row: {
                    "key": string
                  }
                  Insert: {
                    "key": string
                  }
                  Update: {
                    "key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"applications": {
                  Row: {
                    "ai_fit": Json | null,"ai_summary": Json | null,"applied_at": string,"company": string,"created_at": string,"cv_version_id": string | null,"id": string,"jd_text": string | null,"jd_url": string | null,"last_activity_at": string,"location": string | null,"next_action": string | null,"next_action_due": string | null,"position": string,"salary": string | null,"search": unknown,"source": string | null,"stage_id": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "ai_fit"?: Json | null,"ai_summary"?: Json | null,"applied_at"?: string,"company": string,"created_at"?: string,"cv_version_id"?: string | null,"id"?: string,"jd_text"?: string | null,"jd_url"?: string | null,"last_activity_at"?: string,"location"?: string | null,"next_action"?: string | null,"next_action_due"?: string | null,"position": string,"salary"?: string | null,"search"?: never,"source"?: string | null,"stage_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ai_fit"?: Json | null,"ai_summary"?: Json | null,"applied_at"?: string,"company"?: string,"created_at"?: string,"cv_version_id"?: string | null,"id"?: string,"jd_text"?: string | null,"jd_url"?: string | null,"last_activity_at"?: string,"location"?: string | null,"next_action"?: string | null,"next_action_due"?: string | null,"position"?: string,"salary"?: string | null,"search"?: never,"source"?: string | null,"stage_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_cv_version_id_workspace_id_fkey"
      columns: ["cv_version_id","workspace_id"]
isOneToOne: false
      referencedRelation: "cv_versions"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "applications_stage_id_workspace_id_fkey"
      columns: ["stage_id","workspace_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "applications_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"cv_versions": {
                  Row: {
                    "created_at": string,"extracted_text": string,"file_path": string | null,"file_type": string | null,"id": string,"is_default": boolean,"name": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"extracted_text"?: string,"file_path"?: string | null,"file_type"?: string | null,"id"?: string,"is_default"?: boolean,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"extracted_text"?: string,"file_path"?: string | null,"file_type"?: string | null,"id"?: string,"is_default"?: boolean,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cv_versions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "ai_chain": NonNullable<Json>,"ai_connections": NonNullable<Json>,"ai_timeout_s": number,"created_at": string,"stale_days": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "ai_chain"?: NonNullable<Json>,"ai_connections"?: NonNullable<Json>,"ai_timeout_s"?: number,"created_at"?: string,"stale_days"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ai_chain"?: NonNullable<Json>,"ai_connections"?: NonNullable<Json>,"ai_timeout_s"?: number,"created_at"?: string,"stale_days"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_events": {
                  Row: {
                    "application_id": string,"created_at": string,"event_date": string,"id": string,"interviewer": string | null,"notes": string | null,"questions": string | null,"stage_id": string | null,"type": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "application_id": string,"created_at"?: string,"event_date"?: string,"id"?: string,"interviewer"?: string | null,"notes"?: string | null,"questions"?: string | null,"stage_id"?: string | null,"type"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"event_date"?: string,"id"?: string,"interviewer"?: string | null,"notes"?: string | null,"questions"?: string | null,"stage_id"?: string | null,"type"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_events_application_id_workspace_id_fkey"
      columns: ["application_id","workspace_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "stage_events_stage_id_workspace_id_fkey"
      columns: ["stage_id","workspace_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "stage_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"stages": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"name": string,"position": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name": string,"position"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"position"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stages_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"role": string,"user_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"role"?: string,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"role"?: string,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_id": string,"personal": boolean,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id": string,"personal"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"personal"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_personal_workspace":
{ Args: { "p_email": string,"p_user": string }; Returns: string
                           },
"ensure_user_setup":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"has_workspace_access":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"invite_member":
{ Args: { "p_email": string,"p_ws": string }; Returns: undefined
                           },
"is_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"is_member_folder":
{ Args: { "folder": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "ws": string }; Returns: boolean
                           },
"jwt_email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"jwt_email_trusted":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"move_application":
{ Args: { "p_app": string,"p_date"?: string,"p_stage": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
