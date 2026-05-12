import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzlkzoemyfefwgaywegn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGt6b2VteWZlZndnYXl3ZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDUwNDQsImV4cCI6MjA5MTkyMTA0NH0.Xf5uKEQ0ztv1xWbt5ZwFraMMRQXMOsI3pE6jYYWCGz4';

async function test() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.rpc('upsert_variants');
    console.log("Upsert Variants Hint:", error?.hint);
}

test();
