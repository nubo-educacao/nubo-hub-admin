export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_errors: {
        Row: {
          created_at: string | null
          error_message: string | null
          error_type: string
          id: string
          metadata: Json | null
          recovery_attempted: boolean | null
          resolved: boolean | null
          resolved_by: string | null
          session_id: string | null
          stack_trace: string | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          error_type: string
          id?: string
          metadata?: Json | null
          recovery_attempted?: boolean | null
          resolved?: boolean | null
          resolved_by?: string | null
          session_id?: string | null
          stack_trace?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string
          id?: string
          metadata?: Json | null
          recovery_attempted?: boolean | null
          resolved?: boolean | null
          resolved_by?: string | null
          session_id?: string | null
          stack_trace?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_executions: {
        Row: {
          agent_name: string
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_payload: Json | null
          output_payload: Json | null
          status: string
          user_identifier: string
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_payload?: Json | null
          output_payload?: Json | null
          status: string
          user_identifier: string
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_payload?: Json | null
          output_payload?: Json | null
          status?: string
          user_identifier?: string
        }
        Relationships: []
      }
      agent_feedback: {
        Row: {
          content: string | null
          created_at: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          score: number | null
          session_id: string | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          score?: number | null
          session_id?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          score?: number | null
          session_id?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          created_at: string
          data_context: Json
          data_hash: string
          id: string
          insights: Json
        }
        Insert: {
          created_at?: string
          data_context: Json
          data_hash: string
          id?: string
          insights: Json
        }
        Update: {
          created_at?: string
          data_context?: Json
          data_hash?: string
          id?: string
          insights?: Json
        }
        Relationships: []
      }
      campus: {
        Row: {
          city: string | null
          created_at: string | null
          external_code: string | null
          id: string
          institution_id: string | null
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          external_code?: string | null
          id?: string
          institution_id?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          external_code?: string | null
          id?: string
          institution_id?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          sender: string | null
          user_id: string | null
          workflow: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          sender?: string | null
          user_id?: string | null
          workflow?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          sender?: string | null
          user_id?: string | null
          workflow?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          ibge_code: number | null
          id: number
          latitude: number | null
          longitude: number | null
          name: string
          state: string
        }
        Insert: {
          ibge_code?: number | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name: string
          state: string
        }
        Update: {
          ibge_code?: number | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
          state?: string
        }
        Relationships: []
      }
      concurrency_tag_rules: {
        Row: {
          tags: Json | null
          type_name: string
        }
        Insert: {
          tags?: Json | null
          type_name: string
        }
        Update: {
          tags?: Json | null
          type_name?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          campus_id: string | null
          course_code: string | null
          course_name: string
          created_at: string | null
          id: string
          updated_at: string | null
          vacancies: Json | null
        }
        Insert: {
          campus_id?: string | null
          course_code?: string | null
          course_name: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          vacancies?: Json | null
        }
        Update: {
          campus_id?: string | null
          course_code?: string | null
          course_name?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          vacancies?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campus"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      important_dates: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date: string
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          created_at: string | null
          external_code: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_code?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_code?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      institutionsinfoemec: {
        Row: {
          academic_organization: string | null
          address_seat: string | null
          administrative_category: string | null
          ci: string | null
          ci_ead: string | null
          ci_ead_year: string | null
          ci_year: string | null
          city: string | null
          cnpj: string | null
          created_at: string | null
          creation_date: string | null
          credentialing_type: string | null
          current_signs: string | null
          email: string | null
          id: string
          igc: string | null
          igc_year: string | null
          institution_id: string | null
          legal_nature: string | null
          legal_representative: string | null
          maintainer_code: string | null
          maintainer_name: string | null
          phone: string | null
          rector: string | null
          site: string | null
          state: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          academic_organization?: string | null
          address_seat?: string | null
          administrative_category?: string | null
          ci?: string | null
          ci_ead?: string | null
          ci_ead_year?: string | null
          ci_year?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          creation_date?: string | null
          credentialing_type?: string | null
          current_signs?: string | null
          email?: string | null
          id?: string
          igc?: string | null
          igc_year?: string | null
          institution_id?: string | null
          legal_nature?: string | null
          legal_representative?: string | null
          maintainer_code?: string | null
          maintainer_name?: string | null
          phone?: string | null
          rector?: string | null
          site?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_organization?: string | null
          address_seat?: string | null
          administrative_category?: string | null
          ci?: string | null
          ci_ead?: string | null
          ci_ead_year?: string | null
          ci_year?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          creation_date?: string | null
          credentialing_type?: string | null
          current_signs?: string | null
          email?: string | null
          id?: string
          igc?: string | null
          igc_year?: string | null
          institution_id?: string | null
          legal_nature?: string | null
          legal_representative?: string | null
          maintainer_code?: string | null
          maintainer_name?: string | null
          phone?: string | null
          rector?: string | null
          site?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutionsinfoemec_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutionsinfosisu: {
        Row: {
          academic_organization: string | null
          acronym: string | null
          administrative_category: string | null
          created_at: string | null
          id: string
          institution_id: string | null
          updated_at: string | null
        }
        Insert: {
          academic_organization?: string | null
          acronym?: string | null
          administrative_category?: string | null
          created_at?: string | null
          id?: string
          institution_id?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_organization?: string | null
          acronym?: string | null
          administrative_category?: string | null
          created_at?: string | null
          id?: string
          institution_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutionsinfosisu_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_examples: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          ideal_output: string
          input_query: string
          intent_category: string | null
          is_active: boolean | null
          reasoning: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          ideal_output: string
          input_query: string
          intent_category?: string | null
          is_active?: boolean | null
          reasoning?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          ideal_output?: string
          input_query?: string
          intent_category?: string | null
          is_active?: boolean | null
          reasoning?: string | null
          source?: string | null
        }
        Relationships: []
      }
      moderation_logs: {
        Row: {
          agent_reasoning: string | null
          created_at: string
          flagged_category: string | null
          id: string
          message_content: string
          user_id: string | null
        }
        Insert: {
          agent_reasoning?: string | null
          created_at?: string
          flagged_category?: string | null
          id?: string
          message_content: string
          user_id?: string | null
        }
        Update: {
          agent_reasoning?: string | null
          created_at?: string
          flagged_category?: string | null
          id?: string
          message_content?: string
          user_id?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          concurrency_tags: Json | null
          concurrency_type: string | null
          course_id: string | null
          created_at: string | null
          cutoff_score: number | null
          id: string
          is_nubo_pick: boolean | null
          opportunity_type: string | null
          raw_data: Json | null
          scholarship_tags: Json | null
          scholarship_type: string | null
          semester: string | null
          shift: string | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          concurrency_tags?: Json | null
          concurrency_type?: string | null
          course_id?: string | null
          created_at?: string | null
          cutoff_score?: number | null
          id?: string
          is_nubo_pick?: boolean | null
          opportunity_type?: string | null
          raw_data?: Json | null
          scholarship_tags?: Json | null
          scholarship_type?: string | null
          semester?: string | null
          shift?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          concurrency_tags?: Json | null
          concurrency_type?: string | null
          course_id?: string | null
          created_at?: string | null
          cutoff_score?: number | null
          id?: string
          is_nubo_pick?: boolean | null
          opportunity_type?: string | null
          raw_data?: Json | null
          scholarship_tags?: Json | null
          scholarship_type?: string | null
          semester?: string | null
          shift?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "mv_course_catalog"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "opportunities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_favorite_courses_ranking"
            referencedColumns: ["course_id"]
          },
        ]
      }
      opportunitiessisuvacancies: {
        Row: {
          created_at: string | null
          ds_mod_concorrencia: string | null
          id: string
          nota_minima_ciencias_humanas: string | null
          nota_minima_ciencias_natureza: string | null
          nota_minima_linguagens: string | null
          nota_minima_matematica: string | null
          nota_minima_redacao: string | null
          nu_media_minima_enem: string | null
          nu_perc_i: string | null
          nu_perc_lei: string | null
          nu_perc_pcd: string | null
          nu_perc_pp: string | null
          nu_perc_ppi: string | null
          nu_perc_q: string | null
          nu_percentual_bonus: string | null
          nu_vagas_autorizadas: string | null
          opportunity_id: string | null
          perc_uf_ibge_i: string | null
          perc_uf_ibge_pcd: string | null
          perc_uf_ibge_pp: string | null
          perc_uf_ibge_ppi: string | null
          perc_uf_ibge_q: string | null
          peso_ciencias_humanas: string | null
          peso_ciencias_natureza: string | null
          peso_linguagens: string | null
          peso_matematica: string | null
          peso_redacao: string | null
          qt_inscricao_2025: string | null
          qt_semestre: string | null
          qt_vagas_ofertadas: string | null
          qt_vagas_ofertadas_2025: string | null
          tp_cota: string | null
          tp_mod_concorrencia: string | null
          updated_at: string | null
          vagas_ociosas_2025: number | null
        }
        Insert: {
          created_at?: string | null
          ds_mod_concorrencia?: string | null
          id?: string
          nota_minima_ciencias_humanas?: string | null
          nota_minima_ciencias_natureza?: string | null
          nota_minima_linguagens?: string | null
          nota_minima_matematica?: string | null
          nota_minima_redacao?: string | null
          nu_media_minima_enem?: string | null
          nu_perc_i?: string | null
          nu_perc_lei?: string | null
          nu_perc_pcd?: string | null
          nu_perc_pp?: string | null
          nu_perc_ppi?: string | null
          nu_perc_q?: string | null
          nu_percentual_bonus?: string | null
          nu_vagas_autorizadas?: string | null
          opportunity_id?: string | null
          perc_uf_ibge_i?: string | null
          perc_uf_ibge_pcd?: string | null
          perc_uf_ibge_pp?: string | null
          perc_uf_ibge_ppi?: string | null
          perc_uf_ibge_q?: string | null
          peso_ciencias_humanas?: string | null
          peso_ciencias_natureza?: string | null
          peso_linguagens?: string | null
          peso_matematica?: string | null
          peso_redacao?: string | null
          qt_inscricao_2025?: string | null
          qt_semestre?: string | null
          qt_vagas_ofertadas?: string | null
          qt_vagas_ofertadas_2025?: string | null
          tp_cota?: string | null
          tp_mod_concorrencia?: string | null
          updated_at?: string | null
          vagas_ociosas_2025?: number | null
        }
        Update: {
          created_at?: string | null
          ds_mod_concorrencia?: string | null
          id?: string
          nota_minima_ciencias_humanas?: string | null
          nota_minima_ciencias_natureza?: string | null
          nota_minima_linguagens?: string | null
          nota_minima_matematica?: string | null
          nota_minima_redacao?: string | null
          nu_media_minima_enem?: string | null
          nu_perc_i?: string | null
          nu_perc_lei?: string | null
          nu_perc_pcd?: string | null
          nu_perc_pp?: string | null
          nu_perc_ppi?: string | null
          nu_perc_q?: string | null
          nu_percentual_bonus?: string | null
          nu_vagas_autorizadas?: string | null
          opportunity_id?: string | null
          perc_uf_ibge_i?: string | null
          perc_uf_ibge_pcd?: string | null
          perc_uf_ibge_pp?: string | null
          perc_uf_ibge_ppi?: string | null
          perc_uf_ibge_q?: string | null
          peso_ciencias_humanas?: string | null
          peso_ciencias_natureza?: string | null
          peso_linguagens?: string | null
          peso_matematica?: string | null
          peso_redacao?: string | null
          qt_inscricao_2025?: string | null
          qt_semestre?: string | null
          qt_vagas_ofertadas?: string | null
          qt_vagas_ofertadas_2025?: string | null
          tp_cota?: string | null
          tp_mod_concorrencia?: string | null
          updated_at?: string | null
          vagas_ociosas_2025?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunitiessisuvacancies_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          coverimage: string | null
          created_at: string
          dates: Json | null
          description: string | null
          id: string
          income: string | null
          link: string | null
          location: string | null
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          coverimage?: string | null
          created_at?: string
          dates?: Json | null
          description?: string | null
          id?: string
          income?: string | null
          link?: string | null
          location?: string | null
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          coverimage?: string | null
          created_at?: string
          dates?: Json | null
          description?: string | null
          id?: string
          income?: string | null
          link?: string | null
          location?: string | null
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rawemec: {
        Row: {
          "Ano CI": string | null
          "Ano CI-EaD": string | null
          "Ano IGC": string | null
          Categoria: string | null
          "Categoria Administrativa": string | null
          CI: string | null
          "CI-EaD": string | null
          CNPJ: string | null
          "Código IES": string | null
          "Código Mantenedora": string | null
          "Data do Ato de Criação da IES": string | null
          "e-Mail": string | null
          "Endereço Sede": string | null
          IGC: string | null
          "Instituição(IES)": string | null
          Município: string | null
          "Natureza Jurídica": string | null
          "Organização Acadêmica": string | null
          "Razão Social": string | null
          "Reitor/Dirigente Principal": string | null
          "Representante Legal": string | null
          Sigla: string | null
          "Sinalizações Vigentes": string | null
          Sitio: string | null
          "Situação da IES": string | null
          Telefone: string | null
          "Tipo de Credenciamento": string | null
          UF: string | null
        }
        Insert: {
          "Ano CI"?: string | null
          "Ano CI-EaD"?: string | null
          "Ano IGC"?: string | null
          Categoria?: string | null
          "Categoria Administrativa"?: string | null
          CI?: string | null
          "CI-EaD"?: string | null
          CNPJ?: string | null
          "Código IES"?: string | null
          "Código Mantenedora"?: string | null
          "Data do Ato de Criação da IES"?: string | null
          "e-Mail"?: string | null
          "Endereço Sede"?: string | null
          IGC?: string | null
          "Instituição(IES)"?: string | null
          Município?: string | null
          "Natureza Jurídica"?: string | null
          "Organização Acadêmica"?: string | null
          "Razão Social"?: string | null
          "Reitor/Dirigente Principal"?: string | null
          "Representante Legal"?: string | null
          Sigla?: string | null
          "Sinalizações Vigentes"?: string | null
          Sitio?: string | null
          "Situação da IES"?: string | null
          Telefone?: string | null
          "Tipo de Credenciamento"?: string | null
          UF?: string | null
        }
        Update: {
          "Ano CI"?: string | null
          "Ano CI-EaD"?: string | null
          "Ano IGC"?: string | null
          Categoria?: string | null
          "Categoria Administrativa"?: string | null
          CI?: string | null
          "CI-EaD"?: string | null
          CNPJ?: string | null
          "Código IES"?: string | null
          "Código Mantenedora"?: string | null
          "Data do Ato de Criação da IES"?: string | null
          "e-Mail"?: string | null
          "Endereço Sede"?: string | null
          IGC?: string | null
          "Instituição(IES)"?: string | null
          Município?: string | null
          "Natureza Jurídica"?: string | null
          "Organização Acadêmica"?: string | null
          "Razão Social"?: string | null
          "Reitor/Dirigente Principal"?: string | null
          "Representante Legal"?: string | null
          Sigla?: string | null
          "Sinalizações Vigentes"?: string | null
          Sitio?: string | null
          "Situação da IES"?: string | null
          Telefone?: string | null
          "Tipo de Credenciamento"?: string | null
          UF?: string | null
        }
        Relationships: []
      }
      rawprouni2025: {
        Row: {
          ANO: string | null
          CAMPUS: string | null
          CO_TURNO: string | null
          CODIGO_CAMPUS: string | null
          CODIGO_CURSO: string | null
          CODIGO_IES: string | null
          CURSO: string | null
          GRAU_FORMACAO: string | null
          IES: string | null
          MODALIDADE_DO_CURSO: string | null
          MUNICIPIO: string | null
          NOTA_DE_CORTE: string | null
          SEMESTRE: string | null
          TIPO_BOLSA: string | null
          TP_MODALIDADE: string | null
          UF: string | null
        }
        Insert: {
          ANO?: string | null
          CAMPUS?: string | null
          CO_TURNO?: string | null
          CODIGO_CAMPUS?: string | null
          CODIGO_CURSO?: string | null
          CODIGO_IES?: string | null
          CURSO?: string | null
          GRAU_FORMACAO?: string | null
          IES?: string | null
          MODALIDADE_DO_CURSO?: string | null
          MUNICIPIO?: string | null
          NOTA_DE_CORTE?: string | null
          SEMESTRE?: string | null
          TIPO_BOLSA?: string | null
          TP_MODALIDADE?: string | null
          UF?: string | null
        }
        Update: {
          ANO?: string | null
          CAMPUS?: string | null
          CO_TURNO?: string | null
          CODIGO_CAMPUS?: string | null
          CODIGO_CURSO?: string | null
          CODIGO_IES?: string | null
          CURSO?: string | null
          GRAU_FORMACAO?: string | null
          IES?: string | null
          MODALIDADE_DO_CURSO?: string | null
          MUNICIPIO?: string | null
          NOTA_DE_CORTE?: string | null
          SEMESTRE?: string | null
          TIPO_BOLSA?: string | null
          TP_MODALIDADE?: string | null
          UF?: string | null
        }
        Relationships: []
      }
      rawprounivacancies: {
        Row: {
          BOLSAS_AMPLA_OFERTADA: string | null
          BOLSAS_COTA_OFERTADA: string | null
          CO_CAMPUS: string | null
          CO_CURSO: string | null
          CO_IES: string | null
          DS_GRAU: string | null
          DS_TIPO_BOLSA: string | null
          DS_TURNO: string | null
          NO_CAMPUS: string | null
          NO_CURSO: string | null
          NO_IES: string | null
          NO_MUNICIPIO_CAMPUS: string | null
          NU_ANO: string | null
          SG_UF_CAMPUS: string | null
        }
        Insert: {
          BOLSAS_AMPLA_OFERTADA?: string | null
          BOLSAS_COTA_OFERTADA?: string | null
          CO_CAMPUS?: string | null
          CO_CURSO?: string | null
          CO_IES?: string | null
          DS_GRAU?: string | null
          DS_TIPO_BOLSA?: string | null
          DS_TURNO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NU_ANO?: string | null
          SG_UF_CAMPUS?: string | null
        }
        Update: {
          BOLSAS_AMPLA_OFERTADA?: string | null
          BOLSAS_COTA_OFERTADA?: string | null
          CO_CAMPUS?: string | null
          CO_CURSO?: string | null
          CO_IES?: string | null
          DS_GRAU?: string | null
          DS_TIPO_BOLSA?: string | null
          DS_TURNO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NU_ANO?: string | null
          SG_UF_CAMPUS?: string | null
        }
        Relationships: []
      }
      rawprounivacancies2025: {
        Row: {
          BOLSAS_AMPLA_OFERTADA: string | null
          BOLSAS_COTA_OFERTADA: string | null
          CO_CAMPUS: string | null
          CO_CURSO: string | null
          CO_IES: string | null
          DS_GRAU: string | null
          DS_TIPO_BOLSA: string | null
          DS_TURNO: string | null
          NO_CAMPUS: string | null
          NO_CURSO: string | null
          NO_IES: string | null
          NO_MUNICIPIO_CAMPUS: string | null
          NU_ANO: string | null
          SG_UF_CAMPUS: string | null
        }
        Insert: {
          BOLSAS_AMPLA_OFERTADA?: string | null
          BOLSAS_COTA_OFERTADA?: string | null
          CO_CAMPUS?: string | null
          CO_CURSO?: string | null
          CO_IES?: string | null
          DS_GRAU?: string | null
          DS_TIPO_BOLSA?: string | null
          DS_TURNO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NU_ANO?: string | null
          SG_UF_CAMPUS?: string | null
        }
        Update: {
          BOLSAS_AMPLA_OFERTADA?: string | null
          BOLSAS_COTA_OFERTADA?: string | null
          CO_CAMPUS?: string | null
          CO_CURSO?: string | null
          CO_IES?: string | null
          DS_GRAU?: string | null
          DS_TIPO_BOLSA?: string | null
          DS_TURNO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NU_ANO?: string | null
          SG_UF_CAMPUS?: string | null
        }
        Relationships: []
      }
      rawsisu2025: {
        Row: {
          CO_IES: string | null
          CO_IES_CURSO: string | null
          DS_CATEGORIA_ADM: string | null
          DS_GRAU: string | null
          DS_MOD_CONCORRENCIA: string | null
          DS_ORGANIZACAO_ACADEMICA: string | null
          DS_REGIAO_CAMPUS: string | null
          DS_TURNO: string | null
          EDICAO: string | null
          NO_CAMPUS: string | null
          NO_CURSO: string | null
          NO_IES: string | null
          NO_MUNICIPIO_CAMPUS: string | null
          NU_NOTACORTE: string | null
          NU_PERCENTUAL_BONUS: string | null
          QT_INSCRICAO: string | null
          QT_VAGAS_OFERTADAS: string | null
          SG_IES: string | null
          SG_UF_CAMPUS: string | null
          TIPO_CONCORRENCIA: string | null
          TP_MOD_CONCORRENCIA: string | null
        }
        Insert: {
          CO_IES?: string | null
          CO_IES_CURSO?: string | null
          DS_CATEGORIA_ADM?: string | null
          DS_GRAU?: string | null
          DS_MOD_CONCORRENCIA?: string | null
          DS_ORGANIZACAO_ACADEMICA?: string | null
          DS_REGIAO_CAMPUS?: string | null
          DS_TURNO?: string | null
          EDICAO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NU_NOTACORTE?: string | null
          NU_PERCENTUAL_BONUS?: string | null
          QT_INSCRICAO?: string | null
          QT_VAGAS_OFERTADAS?: string | null
          SG_IES?: string | null
          SG_UF_CAMPUS?: string | null
          TIPO_CONCORRENCIA?: string | null
          TP_MOD_CONCORRENCIA?: string | null
        }
        Update: {
          CO_IES?: string | null
          CO_IES_CURSO?: string | null
          DS_CATEGORIA_ADM?: string | null
          DS_GRAU?: string | null
          DS_MOD_CONCORRENCIA?: string | null
          DS_ORGANIZACAO_ACADEMICA?: string | null
          DS_REGIAO_CAMPUS?: string | null
          DS_TURNO?: string | null
          EDICAO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NU_NOTACORTE?: string | null
          NU_PERCENTUAL_BONUS?: string | null
          QT_INSCRICAO?: string | null
          QT_VAGAS_OFERTADAS?: string | null
          SG_IES?: string | null
          SG_UF_CAMPUS?: string | null
          TIPO_CONCORRENCIA?: string | null
          TP_MOD_CONCORRENCIA?: string | null
        }
        Relationships: []
      }
      rawsisuvacancies2025: {
        Row: {
          CO_IES: string | null
          CO_IES_CURSO: string | null
          DS_CATEGORIA_ADM: string | null
          DS_GRAU: string | null
          DS_MOD_CONCORRENCIA: string | null
          DS_ORGANIZACAO_ACADEMICA: string | null
          DS_PERIODICIDADE: string | null
          DS_REGIAO: string | null
          DS_TURNO: string | null
          EDICAO: string | null
          NO_CAMPUS: string | null
          NO_CURSO: string | null
          NO_IES: string | null
          NO_MUNICIPIO_CAMPUS: string | null
          NOTA_MINIMA_CIENCIAS_HUMANAS: string | null
          NOTA_MINIMA_CIENCIAS_NATUREZA: string | null
          NOTA_MINIMA_LINGUAGENS: string | null
          NOTA_MINIMA_MATEMATICA: string | null
          NOTA_MINIMA_REDACAO: string | null
          NU_MEDIA_MINIMA_ENEM: string | null
          NU_PERC_I: string | null
          NU_PERC_LEI: string | null
          NU_PERC_PCD: string | null
          NU_PERC_PP: string | null
          NU_PERC_PPI: string | null
          NU_PERC_Q: string | null
          NU_PERCENTUAL_BONUS: string | null
          NU_VAGAS_AUTORIZADAS: string | null
          PERC_UF_IBGE_I: string | null
          PERC_UF_IBGE_PCD: string | null
          PERC_UF_IBGE_PP: string | null
          PERC_UF_IBGE_PPI: string | null
          PERC_UF_IBGE_Q: string | null
          PESO_CIENCIAS_HUMANAS: string | null
          PESO_CIENCIAS_NATUREZA: string | null
          PESO_LINGUAGENS: string | null
          PESO_MATEMATICA: string | null
          PESO_REDACAO: string | null
          QT_SEMESTRE: string | null
          QT_VAGAS_OFERTADAS: string | null
          SG_IES: string | null
          SG_UF_CAMPUS: string | null
          TP_COTA: string | null
          TP_MOD_CONCORRENCIA: string | null
        }
        Insert: {
          CO_IES?: string | null
          CO_IES_CURSO?: string | null
          DS_CATEGORIA_ADM?: string | null
          DS_GRAU?: string | null
          DS_MOD_CONCORRENCIA?: string | null
          DS_ORGANIZACAO_ACADEMICA?: string | null
          DS_PERIODICIDADE?: string | null
          DS_REGIAO?: string | null
          DS_TURNO?: string | null
          EDICAO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NOTA_MINIMA_CIENCIAS_HUMANAS?: string | null
          NOTA_MINIMA_CIENCIAS_NATUREZA?: string | null
          NOTA_MINIMA_LINGUAGENS?: string | null
          NOTA_MINIMA_MATEMATICA?: string | null
          NOTA_MINIMA_REDACAO?: string | null
          NU_MEDIA_MINIMA_ENEM?: string | null
          NU_PERC_I?: string | null
          NU_PERC_LEI?: string | null
          NU_PERC_PCD?: string | null
          NU_PERC_PP?: string | null
          NU_PERC_PPI?: string | null
          NU_PERC_Q?: string | null
          NU_PERCENTUAL_BONUS?: string | null
          NU_VAGAS_AUTORIZADAS?: string | null
          PERC_UF_IBGE_I?: string | null
          PERC_UF_IBGE_PCD?: string | null
          PERC_UF_IBGE_PP?: string | null
          PERC_UF_IBGE_PPI?: string | null
          PERC_UF_IBGE_Q?: string | null
          PESO_CIENCIAS_HUMANAS?: string | null
          PESO_CIENCIAS_NATUREZA?: string | null
          PESO_LINGUAGENS?: string | null
          PESO_MATEMATICA?: string | null
          PESO_REDACAO?: string | null
          QT_SEMESTRE?: string | null
          QT_VAGAS_OFERTADAS?: string | null
          SG_IES?: string | null
          SG_UF_CAMPUS?: string | null
          TP_COTA?: string | null
          TP_MOD_CONCORRENCIA?: string | null
        }
        Update: {
          CO_IES?: string | null
          CO_IES_CURSO?: string | null
          DS_CATEGORIA_ADM?: string | null
          DS_GRAU?: string | null
          DS_MOD_CONCORRENCIA?: string | null
          DS_ORGANIZACAO_ACADEMICA?: string | null
          DS_PERIODICIDADE?: string | null
          DS_REGIAO?: string | null
          DS_TURNO?: string | null
          EDICAO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NOTA_MINIMA_CIENCIAS_HUMANAS?: string | null
          NOTA_MINIMA_CIENCIAS_NATUREZA?: string | null
          NOTA_MINIMA_LINGUAGENS?: string | null
          NOTA_MINIMA_MATEMATICA?: string | null
          NOTA_MINIMA_REDACAO?: string | null
          NU_MEDIA_MINIMA_ENEM?: string | null
          NU_PERC_I?: string | null
          NU_PERC_LEI?: string | null
          NU_PERC_PCD?: string | null
          NU_PERC_PP?: string | null
          NU_PERC_PPI?: string | null
          NU_PERC_Q?: string | null
          NU_PERCENTUAL_BONUS?: string | null
          NU_VAGAS_AUTORIZADAS?: string | null
          PERC_UF_IBGE_I?: string | null
          PERC_UF_IBGE_PCD?: string | null
          PERC_UF_IBGE_PP?: string | null
          PERC_UF_IBGE_PPI?: string | null
          PERC_UF_IBGE_Q?: string | null
          PESO_CIENCIAS_HUMANAS?: string | null
          PESO_CIENCIAS_NATUREZA?: string | null
          PESO_LINGUAGENS?: string | null
          PESO_MATEMATICA?: string | null
          PESO_REDACAO?: string | null
          QT_SEMESTRE?: string | null
          QT_VAGAS_OFERTADAS?: string | null
          SG_IES?: string | null
          SG_UF_CAMPUS?: string | null
          TP_COTA?: string | null
          TP_MOD_CONCORRENCIA?: string | null
        }
        Relationships: []
      }
      rawsisuvacancies2026: {
        Row: {
          CO_IES: string | null
          CO_IES_CURSO: string | null
          DS_CATEGORIA_ADM: string | null
          DS_GRAU: string | null
          DS_MOD_CONCORRENCIA: string | null
          DS_ORGANIZACAO_ACADEMICA: string | null
          DS_PERIODICIDADE: string | null
          DS_REGIAO: string | null
          DS_TURNO: string | null
          EDICAO: string | null
          NO_CAMPUS: string | null
          NO_CURSO: string | null
          NO_IES: string | null
          NO_MUNICIPIO_CAMPUS: string | null
          NOTA_MINIMA_CIENCIAS_HUMANAS: string | null
          NOTA_MINIMA_CIENCIAS_NATUREZA: string | null
          NOTA_MINIMA_LINGUAGENS: string | null
          NOTA_MINIMA_MATEMATICA: string | null
          NOTA_MINIMA_REDACAO: string | null
          NU_MEDIA_MINIMA_ENEM: string | null
          NU_PERC_I: string | null
          NU_PERC_LEI: string | null
          NU_PERC_PCD: string | null
          NU_PERC_PP: string | null
          NU_PERC_PPI: string | null
          NU_PERC_Q: string | null
          NU_PERCENTUAL_BONUS: string | null
          NU_VAGAS_AUTORIZADAS: string | null
          PERC_UF_IBGE_I: string | null
          PERC_UF_IBGE_PCD: string | null
          PERC_UF_IBGE_PP: string | null
          PERC_UF_IBGE_PPI: string | null
          PERC_UF_IBGE_Q: string | null
          PESO_CIENCIAS_HUMANAS: string | null
          PESO_CIENCIAS_NATUREZA: string | null
          PESO_LINGUAGENS: string | null
          PESO_MATEMATICA: string | null
          PESO_REDACAO: string | null
          QT_SEMESTRE: string | null
          QT_VAGAS_OFERTADAS: string | null
          SG_IES: string | null
          SG_UF_CAMPUS: string | null
          TP_COTA: string | null
          TP_MOD_CONCORRENCIA: string | null
        }
        Insert: {
          CO_IES?: string | null
          CO_IES_CURSO?: string | null
          DS_CATEGORIA_ADM?: string | null
          DS_GRAU?: string | null
          DS_MOD_CONCORRENCIA?: string | null
          DS_ORGANIZACAO_ACADEMICA?: string | null
          DS_PERIODICIDADE?: string | null
          DS_REGIAO?: string | null
          DS_TURNO?: string | null
          EDICAO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NOTA_MINIMA_CIENCIAS_HUMANAS?: string | null
          NOTA_MINIMA_CIENCIAS_NATUREZA?: string | null
          NOTA_MINIMA_LINGUAGENS?: string | null
          NOTA_MINIMA_MATEMATICA?: string | null
          NOTA_MINIMA_REDACAO?: string | null
          NU_MEDIA_MINIMA_ENEM?: string | null
          NU_PERC_I?: string | null
          NU_PERC_LEI?: string | null
          NU_PERC_PCD?: string | null
          NU_PERC_PP?: string | null
          NU_PERC_PPI?: string | null
          NU_PERC_Q?: string | null
          NU_PERCENTUAL_BONUS?: string | null
          NU_VAGAS_AUTORIZADAS?: string | null
          PERC_UF_IBGE_I?: string | null
          PERC_UF_IBGE_PCD?: string | null
          PERC_UF_IBGE_PP?: string | null
          PERC_UF_IBGE_PPI?: string | null
          PERC_UF_IBGE_Q?: string | null
          PESO_CIENCIAS_HUMANAS?: string | null
          PESO_CIENCIAS_NATUREZA?: string | null
          PESO_LINGUAGENS?: string | null
          PESO_MATEMATICA?: string | null
          PESO_REDACAO?: string | null
          QT_SEMESTRE?: string | null
          QT_VAGAS_OFERTADAS?: string | null
          SG_IES?: string | null
          SG_UF_CAMPUS?: string | null
          TP_COTA?: string | null
          TP_MOD_CONCORRENCIA?: string | null
        }
        Update: {
          CO_IES?: string | null
          CO_IES_CURSO?: string | null
          DS_CATEGORIA_ADM?: string | null
          DS_GRAU?: string | null
          DS_MOD_CONCORRENCIA?: string | null
          DS_ORGANIZACAO_ACADEMICA?: string | null
          DS_PERIODICIDADE?: string | null
          DS_REGIAO?: string | null
          DS_TURNO?: string | null
          EDICAO?: string | null
          NO_CAMPUS?: string | null
          NO_CURSO?: string | null
          NO_IES?: string | null
          NO_MUNICIPIO_CAMPUS?: string | null
          NOTA_MINIMA_CIENCIAS_HUMANAS?: string | null
          NOTA_MINIMA_CIENCIAS_NATUREZA?: string | null
          NOTA_MINIMA_LINGUAGENS?: string | null
          NOTA_MINIMA_MATEMATICA?: string | null
          NOTA_MINIMA_REDACAO?: string | null
          NU_MEDIA_MINIMA_ENEM?: string | null
          NU_PERC_I?: string | null
          NU_PERC_LEI?: string | null
          NU_PERC_PCD?: string | null
          NU_PERC_PP?: string | null
          NU_PERC_PPI?: string | null
          NU_PERC_Q?: string | null
          NU_PERCENTUAL_BONUS?: string | null
          NU_VAGAS_AUTORIZADAS?: string | null
          PERC_UF_IBGE_I?: string | null
          PERC_UF_IBGE_PCD?: string | null
          PERC_UF_IBGE_PP?: string | null
          PERC_UF_IBGE_PPI?: string | null
          PERC_UF_IBGE_Q?: string | null
          PESO_CIENCIAS_HUMANAS?: string | null
          PESO_CIENCIAS_NATUREZA?: string | null
          PESO_LINGUAGENS?: string | null
          PESO_MATEMATICA?: string | null
          PESO_REDACAO?: string | null
          QT_SEMESTRE?: string | null
          QT_VAGAS_OFERTADAS?: string | null
          SG_IES?: string | null
          SG_UF_CAMPUS?: string | null
          TP_COTA?: string | null
          TP_MOD_CONCORRENCIA?: string | null
        }
        Relationships: []
      }
      states: {
        Row: {
          name: string
          uf: string
        }
        Insert: {
          name: string
          uf: string
        }
        Update: {
          name?: string
          uf?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          partner_id: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          partner_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          partner_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "mv_course_catalog"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "user_favorites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_favorite_courses_ranking"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "user_favorites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          course_interest: string[] | null
          created_at: string | null
          device_latitude: number | null
          device_longitude: number | null
          enem_score: number | null
          family_income_per_capita: number | null
          id: string
          location_preference: string | null
          preferred_shifts: string[] | null
          program_preference: string | null
          quota_types: string[] | null
          state_preference: string | null
          university_preference: string | null
          updated_at: string | null
          user_id: string
          workflow_data: Json | null
        }
        Insert: {
          course_interest?: string[] | null
          created_at?: string | null
          device_latitude?: number | null
          device_longitude?: number | null
          enem_score?: number | null
          family_income_per_capita?: number | null
          id?: string
          location_preference?: string | null
          preferred_shifts?: string[] | null
          program_preference?: string | null
          quota_types?: string[] | null
          state_preference?: string | null
          university_preference?: string | null
          updated_at?: string | null
          user_id: string
          workflow_data?: Json | null
        }
        Update: {
          course_interest?: string[] | null
          created_at?: string | null
          device_latitude?: number | null
          device_longitude?: number | null
          enem_score?: number | null
          family_income_per_capita?: number | null
          id?: string
          location_preference?: string | null
          preferred_shifts?: string[] | null
          program_preference?: string | null
          quota_types?: string[] | null
          state_preference?: string | null
          university_preference?: string | null
          updated_at?: string | null
          user_id?: string
          workflow_data?: Json | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active_workflow: string | null
          age: number | null
          city: string | null
          created_at: string | null
          education: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          active_workflow?: string | null
          age?: number | null
          city?: string | null
          created_at?: string | null
          education?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active_workflow?: string | null
          age?: number | null
          city?: string | null
          created_at?: string | null
          education?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      mv_course_catalog: {
        Row: {
          city: string | null
          course_id: string | null
          course_name: string | null
          has_affirmative_action: boolean | null
          has_ead: boolean | null
          has_nubo_pick: boolean | null
          has_prouni: boolean | null
          has_sisu: boolean | null
          igc_raw: string | null
          igc_value: number | null
          institution_name: string | null
          latitude: number | null
          longitude: number | null
          max_cutoff: number | null
          min_cutoff: number | null
          opportunities_json: Json | null
          search_vector: unknown
          state: string | null
          vacancies_json: Json | null
        }
        Relationships: []
      }
      vw_favorite_courses_ranking: {
        Row: {
          campus_name: string | null
          course_id: string | null
          course_name: string | null
          institution_name: string | null
          sum_user: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      clean_numeric_string: { Args: { val: string }; Returns: number }
      earth: { Args: never; Returns: number }
      f_unaccent: { Args: { "": string }; Returns: string }
      get_courses_with_opportunities: {
        Args: {
          category?: string
          page_number: number
          page_size: number
          search_query?: string
          sort_by?: string
          user_city?: string
          user_lat?: number
          user_long?: number
          user_state?: string
        }
        Returns: {
          city: string
          course_name: string
          distance_km: number
          id: string
          institution_name: string
          opportunities: Json
          state: string
          vacancies: Json
        }[]
      }
      get_own_profile: { Args: never; Returns: Json }
      get_partners: {
        Args: never
        Returns: {
          coverimage: string | null
          created_at: string
          dates: Json | null
          description: string | null
          id: string
          income: string | null
          link: string | null
          location: string | null
          name: string
          type: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "partners"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_unique_course_names: {
        Args: never
        Returns: {
          course_name: string
        }[]
      }
      get_user_favorites: { Args: never; Returns: Json }
      get_user_favorites_details: { Args: never; Returns: Json }
      match_documents: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_opportunities: {
        Args: {
          city_names: string[]
          course_interests: string[]
          enem_score: number
          income_per_capita: number
          page_number?: number
          page_size?: number
          preferred_shifts: string[]
          program_preference: string
          quota_types: string[]
          state_names: string[]
          university_preference: string
          user_lat: number
          user_long: number
        }
        Returns: {
          campus_city: string
          campus_latitude: number
          campus_longitude: number
          campus_state: string
          concurrency_tags: Json
          course_id: string
          course_name: string
          cutoff_score: number
          institution_name: string
          opportunitiessisuvacancies: Json
          opportunity_type: string
          scholarship_tags: Json
          shift: string
        }[]
      }
      refresh_course_catalog: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      toggle_favorite: {
        Args: { p_id: string; p_type: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_own_profile: {
        Args: {
          p_age?: number
          p_city?: string
          p_education?: string
          p_full_name?: string
        }
        Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
