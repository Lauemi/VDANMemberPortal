<?php
http_response_code(410);
header('Content-Type: text/plain; charset=UTF-8');
echo "Deprecated endpoint. Please use the secured contact flow via Supabase Edge Function.";
?>
