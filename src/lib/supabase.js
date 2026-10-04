import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xocwwcmuxrqaesjbbtpg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvY3d3Y211eHJxYWVzamJidHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjM0NDEsImV4cCI6MjA4ODc5OTQ0MX0.MpI6dle3xTDBbEVRfhb3nWkUy2GuMWKsVHnDaucOSEc'
)
