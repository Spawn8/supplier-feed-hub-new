-- ============================================================================
-- Supplier Feed Hub - Complete Database Schema
-- Multi-tenant SaaS for supplier feed aggregation, normalization, and export
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- Core Multi-tenant Tables
-- ============================================================================

-- Workspaces (multi-tenant isolation)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    default_currency VARCHAR(3) DEFAULT 'USD',
    default_language VARCHAR(5) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    billing_plan VARCHAR(50) DEFAULT 'free',
    billing_status VARCHAR(20) DEFAULT 'active'
);

-- Workspace members (user access control)
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'viewer')),
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- ============================================================================
-- Supplier Management
-- ============================================================================

-- Suppliers (feed sources)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('url', 'upload')),
    endpoint_url TEXT,
    auth_username VARCHAR(255),
    auth_password TEXT, -- encrypted
    schedule_cron VARCHAR(100), -- cron expression
    schedule_enabled BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'sync_needed', 'syncing', 'failed')),
    error_message TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'
);

-- Supplier files (for upload sources)
CREATE TABLE supplier_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    storage_path TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- Field Management & Mapping
-- ============================================================================

-- Custom fields (workspace schema)
CREATE TABLE custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key VARCHAR(100) NOT NULL,
    datatype VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (datatype IN ('text', 'number', 'bool', 'date', 'json')),
    description TEXT,
    is_required BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, key)
);

-- Field mappings (supplier-specific)
CREATE TABLE field_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    source_key VARCHAR(255) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    transform_type VARCHAR(50) DEFAULT 'direct',
    transform_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, supplier_id, source_key)
);

-- ============================================================================
-- Category Management
-- ============================================================================

-- Workspace categories (normalized)
CREATE TABLE workspace_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL, -- e.g., "Electronics > Phones > Smartphones"
    parent_id UUID REFERENCES workspace_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, path)
);

-- Category mappings (supplier to workspace)
CREATE TABLE category_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_category VARCHAR(500) NOT NULL,
    workspace_category_id UUID REFERENCES workspace_categories(id),
    mapping_type VARCHAR(20) DEFAULT 'manual' CHECK (mapping_type IN ('manual', 'auto', 'rule')),
    rule_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, supplier_id, supplier_category)
);

-- ============================================================================
-- Product Data Storage
-- ============================================================================

-- Raw products (as ingested)
CREATE TABLE products_raw (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    ingestion_id UUID NOT NULL,
    uid VARCHAR(255) NOT NULL, -- unique identifier from source
    ean VARCHAR(50),
    sku VARCHAR(255),
    title TEXT,
    description TEXT,
    price DECIMAL(10,2),
    currency VARCHAR(3),
    quantity INTEGER,
    category VARCHAR(500),
    brand VARCHAR(255),
    image_url TEXT,
    raw JSONB NOT NULL,
    source_file VARCHAR(255),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, supplier_id, uid)
);

-- Mapped products (after field mapping)
CREATE TABLE products_mapped (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    ingestion_id UUID NOT NULL,
    uid VARCHAR(255) NOT NULL,
    fields JSONB NOT NULL DEFAULT '{}',
    source_file VARCHAR(255),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, supplier_id, uid)
);

-- Final products (after deduplication and rules)
CREATE TABLE products_final (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uid VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sku VARCHAR(255),
    ean VARCHAR(50),
    price DECIMAL(10,2),
    currency VARCHAR(3),
    quantity INTEGER DEFAULT 0,
    in_stock BOOLEAN DEFAULT true,
    category_id UUID REFERENCES workspace_categories(id),
    brand VARCHAR(255),
    image_url TEXT,
    images JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    winning_supplier_id UUID NOT NULL REFERENCES suppliers(id),
    winning_reason VARCHAR(100), -- 'lowest_price', 'preferred', 'highest_stock', etc.
    other_suppliers JSONB DEFAULT '[]', -- array of {supplier_id, reason_lost}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, uid)
);

-- ============================================================================
-- Deduplication & Selection Rules
-- ============================================================================

-- Deduplication rules (workspace-level)
CREATE TABLE deduplication_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    match_key VARCHAR(50) NOT NULL DEFAULT 'ean' CHECK (match_key IN ('ean', 'sku', 'title')),
    selection_policy VARCHAR(50) NOT NULL DEFAULT 'lowest_price' CHECK (selection_policy IN ('lowest_price', 'preferred_supplier', 'highest_stock', 'first_available')),
    preferred_suppliers JSONB DEFAULT '[]', -- ordered list of supplier IDs
    exclusion_rules JSONB DEFAULT '{}', -- price ranges, stock rules, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Export System
-- ============================================================================

-- Export profiles
CREATE TABLE export_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    output_format VARCHAR(20) NOT NULL CHECK (output_format IN ('csv', 'json', 'xml')),
    platform VARCHAR(50), -- 'woocommerce', 'shopify', 'custom', etc.
    field_selection JSONB NOT NULL DEFAULT '[]', -- array of field keys
    field_ordering JSONB NOT NULL DEFAULT '[]', -- array of field keys in order
    filters JSONB DEFAULT '{}', -- stock, price, category filters
    template_config JSONB DEFAULT '{}', -- platform-specific settings
    file_naming VARCHAR(255) DEFAULT 'export_{timestamp}',
    delivery_method VARCHAR(20) DEFAULT 'download' CHECK (delivery_method IN ('download', 'webhook', 's3')),
    delivery_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export history
CREATE TABLE export_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    export_profile_id UUID NOT NULL REFERENCES export_profiles(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    item_count INTEGER,
    generation_time_ms INTEGER,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Integration System
-- ============================================================================

-- Integration connections
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'woocommerce', 'shopify', etc.
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}', -- API keys, endpoints, etc.
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'idle',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Logging & Monitoring
-- ============================================================================

-- Feed ingestion logs
CREATE TABLE feed_ingestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    items_total INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_success INTEGER DEFAULT 0,
    items_errors INTEGER DEFAULT 0,
    error_message TEXT,
    source_file VARCHAR(255),
    created_by UUID REFERENCES auth.users(id)
);

-- Feed errors (detailed error tracking)
CREATE TABLE feed_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    ingestion_id UUID NOT NULL,
    item_index INTEGER,
    code VARCHAR(50),
    message TEXT NOT NULL,
    raw JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs (user actions)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Notifications
-- ============================================================================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Billing & Subscriptions
-- ============================================================================

-- Billing plans
CREATE TABLE billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    limits JSONB NOT NULL DEFAULT '{}', -- workspaces, suppliers, products, etc.
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace subscriptions
CREATE TABLE workspace_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES billing_plans(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Workspace isolation indexes
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- Supplier indexes
CREATE INDEX idx_suppliers_workspace_id ON suppliers(workspace_id);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_next_sync ON suppliers(next_sync_at) WHERE schedule_enabled = true;

-- Product indexes
CREATE INDEX idx_products_raw_workspace_supplier ON products_raw(workspace_id, supplier_id);
CREATE INDEX idx_products_raw_uid ON products_raw(uid);
CREATE INDEX idx_products_mapped_workspace_supplier ON products_mapped(workspace_id, supplier_id);
CREATE INDEX idx_products_final_workspace ON products_final(workspace_id);
CREATE INDEX idx_products_final_sku ON products_final(sku);
CREATE INDEX idx_products_final_ean ON products_final(ean);

-- Field mapping indexes
CREATE INDEX idx_field_mappings_workspace_supplier ON field_mappings(workspace_id, supplier_id);
CREATE INDEX idx_custom_fields_workspace ON custom_fields(workspace_id);

-- Category indexes
CREATE INDEX idx_workspace_categories_workspace ON workspace_categories(workspace_id);
CREATE INDEX idx_category_mappings_workspace_supplier ON category_mappings(workspace_id, supplier_id);

-- Export indexes
CREATE INDEX idx_export_profiles_workspace ON export_profiles(workspace_id);
CREATE INDEX idx_export_history_workspace ON export_history(workspace_id);
CREATE INDEX idx_export_history_profile ON export_history(export_profile_id);

-- Logging indexes
CREATE INDEX idx_feed_ingestions_workspace ON feed_ingestions(workspace_id);
CREATE INDEX idx_feed_ingestions_supplier ON feed_ingestions(supplier_id);
CREATE INDEX idx_feed_errors_workspace ON feed_errors(workspace_id);
CREATE INDEX idx_activity_logs_workspace ON activity_logs(workspace_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);

-- Notification indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_mapped ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduplication_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_ingestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;

-- Workspace access policies
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
    FOR SELECT USING (
        id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update workspaces they own" ON workspaces
    FOR UPDATE USING (
        id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Workspace members policies
CREATE POLICY "Users can view workspace members of their workspaces" ON workspace_members
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Supplier policies
CREATE POLICY "Users can view suppliers in their workspaces" ON suppliers
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage suppliers in their workspaces" ON suppliers
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Product data policies
CREATE POLICY "Users can view products in their workspaces" ON products_raw
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view mapped products in their workspaces" ON products_mapped
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view final products in their workspaces" ON products_final
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_final_updated_at BEFORE UPDATE ON products_final FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_export_profiles_updated_at BEFORE UPDATE ON export_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspace_subscriptions_updated_at BEFORE UPDATE ON workspace_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Insert default billing plans
INSERT INTO billing_plans (name, description, price_monthly, price_yearly, limits, features) VALUES
('Free', 'Perfect for getting started', 0.00, 0.00, 
 '{"workspaces": 1, "suppliers": 1, "products": 1000, "exports": 5, "scheduling": false}'::jsonb,
 '["Basic field mapping", "CSV/JSON export", "Email support"]'::jsonb),
('Pro', 'For growing businesses', 29.00, 290.00,
 '{"workspaces": 3, "suppliers": 10, "products": 50000, "exports": 100, "scheduling": true}'::jsonb,
 '["Advanced mapping", "All export formats", "Scheduling", "Priority support"]'::jsonb),
('Business', 'For agencies and enterprises', 99.00, 990.00,
 '{"workspaces": 10, "suppliers": 50, "products": 200000, "exports": 500, "scheduling": true}'::jsonb,
 '["White-label", "API access", "Custom integrations", "Dedicated support"]'::jsonb);

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Workspace dashboard view
CREATE VIEW workspace_dashboard AS
SELECT 
    w.id,
    w.name,
    w.slug,
    w.billing_plan,
    w.billing_status,
    COUNT(DISTINCT s.id) as supplier_count,
    COUNT(DISTINCT pf.id) as product_count,
    COUNT(DISTINCT ep.id) as export_profile_count,
    MAX(fi.completed_at) as last_sync_at
FROM workspaces w
LEFT JOIN suppliers s ON s.workspace_id = w.id
LEFT JOIN products_final pf ON pf.workspace_id = w.id
LEFT JOIN export_profiles ep ON ep.workspace_id = w.id
LEFT JOIN feed_ingestions fi ON fi.workspace_id = w.id
GROUP BY w.id, w.name, w.slug, w.billing_plan, w.billing_status;

-- Supplier status view
CREATE VIEW supplier_status AS
SELECT 
    s.id,
    s.workspace_id,
    s.name,
    s.source_type,
    s.status,
    s.last_sync_at,
    s.next_sync_at,
    s.error_message,
    fi.status as last_ingestion_status,
    fi.items_total,
    fi.items_success,
    fi.items_errors,
    fi.completed_at as last_ingestion_completed_at
FROM suppliers s
LEFT JOIN LATERAL (
    SELECT * FROM feed_ingestions 
    WHERE supplier_id = s.id 
    ORDER BY started_at DESC 
    LIMIT 1
) fi ON true;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE workspaces IS 'Multi-tenant workspaces for isolating data and users';
COMMENT ON TABLE workspace_members IS 'User access control for workspaces';
COMMENT ON TABLE suppliers IS 'Feed sources (URL or file upload)';
COMMENT ON TABLE custom_fields IS 'Workspace-specific field definitions';
COMMENT ON TABLE field_mappings IS 'Maps supplier fields to workspace fields';
COMMENT ON TABLE products_raw IS 'Raw product data as ingested from suppliers';
COMMENT ON TABLE products_mapped IS 'Products after field mapping and normalization';
COMMENT ON TABLE products_final IS 'Final products after deduplication and rules';
COMMENT ON TABLE export_profiles IS 'Export configuration templates';
COMMENT ON TABLE integrations IS 'Third-party platform connections';
COMMENT ON TABLE feed_ingestions IS 'Ingestion job tracking and statistics';
COMMENT ON TABLE activity_logs IS 'User action audit trail';
