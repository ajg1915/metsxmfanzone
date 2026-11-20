import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// MetsXMFanZone own gear: price is decided here, never by the browser.
// Keep in sync with src/lib/merchCatalog.ts
const GEAR: Record<string, { title: string; sizes: string[]; price: (size: string) => number }> = {
  tshirt: { title: 'MetsXMFanZone T-Shirt', sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'], price: (s) => (['2XL', '3XL'].includes(s) ? 26.99 : 24.56) },
  longsleeve: { title: 'MetsXMFanZone Long Sleeve', sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'], price: (s) => (['2XL', '3XL'].includes(s) ? 26.99 : 24.56) },
  hoodie: { title: 'MetsXMFanZone Hoodie', sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'], price: () => 40 },
  jacket: { title: 'MetsXMFanZone Jacket', sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'], price: () => 40 },
  cap: { title: 'MetsXMFanZone Cap', sizes: ['One size'], price: () => 15 },
};

async function getPayPalAccessToken(api: string, clientId: string, secret: string) {
  const res = await fetch(`${api}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { productId, sku, size, color, design, quantity, customerName, customerEmail, shippingAddress, returnOrigin } = await req.json();

    if ((!productId && !sku) || !customerName || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Product ID, customer name, and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let product: { title: string; price: number; stock_quantity: number | null };
    let itemNote: string | null = null;
    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 10);

    if (sku) {
      // MetsXMFanZone gear with size pricing
      const gear = GEAR[String(sku)];
      if (!gear || !gear.sizes.includes(String(size))) {
        return new Response(
          JSON.stringify({ error: 'Pick a valid product and size' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const COLOR_NAMES: Record<string, string> = { royal: 'Royal Blue', black: 'Black', gray: 'Gray', white: 'White' };
      const colorName = COLOR_NAMES[String(color || 'royal')];
      if (!colorName) {
        return new Response(
          JSON.stringify({ error: 'Pick a valid color' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const podcast = design === 'podcast' && (sku === 'hoodie' || sku === 'cap');
      const fullTitle = `${gear.title}${podcast ? ' - Podcast Shop design' : ''}`;
      product = { title: `${fullTitle} (${colorName}, ${size})`, price: gear.price(String(size)), stock_quantity: null };
      itemNote = `${fullTitle} | Color ${colorName} | Size ${size}`;
    } else {
      // Fetch product details server-side (never trust client prices)
      const { data, error: productError } = await supabase
        .from('shop_products')
        .select('*')
        .eq('id', productId)
        .eq('published', true)
        .single();

      if (productError || !data) {
        return new Response(
          JSON.stringify({ error: 'Product not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      product = data;

      if (product.stock_quantity !== null && product.stock_quantity < qty) {
        return new Response(
          JSON.stringify({ error: 'Insufficient stock' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const totalAmount = (product.price * qty).toFixed(2);
    const baseUrl = returnOrigin || 'https://www.metsxmfanzone.com';

    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!;
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')!;
    const PAYPAL_API = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com';

    const accessToken = await getPayPalAccessToken(PAYPAL_API, PAYPAL_CLIENT_ID, PAYPAL_SECRET);

    // Create PayPal order (one-time purchase)
    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `metsxm-shop-${productId || sku}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: product.title,
          amount: {
            currency_code: 'USD',
            value: totalAmount,
            breakdown: {
              item_total: { currency_code: 'USD', value: totalAmount },
            },
          },
          items: [{
            name: product.title,
            quantity: qty.toString(),
            unit_amount: { currency_code: 'USD', value: product.price.toFixed(2) },
            category: 'PHYSICAL_GOODS',
          }],
          shipping: shippingAddress ? {
            name: { full_name: customerName },
            address: {
              address_line_1: shippingAddress.line1,
              address_line_2: shippingAddress.line2 || '',
              admin_area_2: shippingAddress.city,
              admin_area_1: shippingAddress.state,
              postal_code: shippingAddress.zip,
              country_code: shippingAddress.country || 'US',
            },
          } : undefined,
        }],
        application_context: {
          brand_name: 'MetsXMFanZone Shop',
          locale: 'en-US',
          shipping_preference: shippingAddress ? 'SET_PROVIDED_ADDRESS' : 'GET_FROM_FILE',
          user_action: 'PAY_NOW',
          return_url: `${baseUrl}/shop/order-success`,
          cancel_url: `${baseUrl}/merch`,
        },
      }),
    });

    const orderData = await orderRes.json();
    console.log('PayPal order created:', { status: orderData.status || '[UNKNOWN]', id: '[REDACTED]' });

    if (!orderRes.ok) {
      console.error('PayPal order error:', JSON.stringify(orderData));
      throw new Error('Failed to create PayPal order');
    }

    // Get authenticated user if available
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Create order record
    const { error: insertError } = await supabase
      .from('shop_orders')
      .insert({
        product_id: productId || null,
        notes: itemNote,
        user_id: userId,
        quantity: qty,
        unit_price: product.price,
        total_amount: parseFloat(totalAmount),
        status: 'pending',
        paypal_order_id: orderData.id,
        customer_name: customerName,
        customer_email: customerEmail,
        shipping_address_line1: shippingAddress?.line1,
        shipping_address_line2: shippingAddress?.line2,
        shipping_city: shippingAddress?.city,
        shipping_state: shippingAddress?.state,
        shipping_zip: shippingAddress?.zip,
        shipping_country: shippingAddress?.country || 'US',
      });

    if (insertError) {
      console.error('Error creating order record:', insertError);
      throw insertError;
    }

    const approvalUrl = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

    return new Response(
      JSON.stringify({ approvalUrl, orderId: orderData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating shop order:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
