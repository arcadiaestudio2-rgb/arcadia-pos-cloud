import { supabase } from './lib/supabase';

async function testFetch() {
  const { data, error } = await supabase
    .from('variants')
    .select(`
      id,
      product_id,
      sku,
      color,
      size,
      stock,
      stock_minimo,
      cost,
      margin,
      pvp,
      is_custom,
      products!inner (
        name,
        category,
        brand,
        season,
        barcode,
        status
      )
    `)
    .neq('products.status', 'deleted');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data length:', data?.length);
    console.log('First item:', JSON.stringify(data?.[0], null, 2));
  }
}

testFetch();
