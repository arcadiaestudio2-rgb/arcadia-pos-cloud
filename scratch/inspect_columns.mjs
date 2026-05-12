import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzlkzoemyfefwgaywegn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGt6b2VteWZlZndnYXl3ZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDUwNDQsImV4cCI6MjA5MTkyMTA0NH0.Xf5uKEQ0ztv1xWbt5ZwFraMMRQXMOsI3pE6jYYWCGz4';

async function test() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
        .from('products')
        .select('id')
        .limit(1);
    
    if (data && data.length > 0) {
        // Table has data, retry select *
        const { data: allData } = await supabase.from('products').select('*').limit(1);
        console.log("Columns:", Object.keys(allData[0] || {}));
    } else {
        console.log("Table is empty. Cannot determine columns via select *.");
    }
}

test();
