import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { instanceName: string } }
) {
  const { instanceName } = params

  const { data } = await supabase()
    .from('whatsapp_instances')
    .select('phone')
    .eq('instance_name', instanceName)
    .single()

  const phoneNumber = data?.phone || instanceName

  const script = `(function() {
  var phone = '${phoneNumber.replace(/\D/g, '')}';
  var sourceUrl = encodeURIComponent(window.location.href);

  var btn = document.createElement('a');
  btn.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent('Olá! Vim pelo site: ' + window.location.href);
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.setAttribute('aria-label', 'Falar no WhatsApp');

  btn.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:9999',
    'width:56px',
    'height:56px',
    'border-radius:50%',
    'background-color:#25D366',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
    'cursor:pointer',
    'text-decoration:none',
    'transition:transform 0.2s ease,box-shadow 0.2s ease'
  ].join(';');

  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="#fff"><path d="M16 0C7.163 0 0 7.163 0 16c0 2.827.737 5.476 2.027 7.775L0 32l8.484-2.001A15.94 15.94 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333a13.27 13.27 0 0 1-6.763-1.847l-.485-.287-5.037 1.188 1.234-4.908-.317-.502A13.24 13.24 0 0 1 2.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333zm7.27-9.907c-.398-.199-2.354-1.162-2.72-1.294-.365-.133-.631-.199-.897.2-.266.398-1.03 1.294-1.263 1.56-.232.266-.465.3-.863.1-.398-.2-1.681-.619-3.202-1.977-1.183-1.056-1.982-2.36-2.214-2.758-.232-.398-.025-.613.174-.811.18-.178.398-.465.597-.698.2-.232.266-.398.398-.664.133-.266.067-.498-.033-.698-.1-.2-.897-2.16-1.229-2.957-.323-.776-.65-.671-.897-.683l-.764-.013c-.266 0-.698.1-1.063.498-.365.398-1.395 1.362-1.395 3.322s1.428 3.854 1.627 4.12c.2.265 2.809 4.288 6.806 6.016.951.41 1.693.655 2.271.839.954.304 1.823.261 2.51.158.766-.114 2.354-.962 2.687-1.891.332-.929.332-1.726.232-1.892-.099-.165-.365-.265-.763-.464z"/></svg>';

  btn.addEventListener('mouseenter', function() {
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
  });
  btn.addEventListener('mouseleave', function() {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  });

  document.body.appendChild(btn);
})();`

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
