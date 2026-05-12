import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzlkzoemyfefwgaywegn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGt6b2VteWZlZndnYXl3ZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDUwNDQsImV4cCI6MjA5MTkyMTA0NH0.Xf5uKEQ0ztv1xWbt5ZwFraMMRQXMOsI3pE6jYYWCGz4';

async function test() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.rpc('update_product_v2', {
        p_id: 1,
        p_name: '',
        p_category: '',
        p_brand: '',
        p_season: '',
        p_status: '',
        p_total_stock_minimo: 0,
        p_variants: []
    });
    console.log(JSON.stringify(error, null, 2));
}

test();
