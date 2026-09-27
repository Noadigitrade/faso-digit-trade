// ============================================================
// SUPABASE EDGE FUNCTION - send-push
// Déclenchée par un Database Webhook sur INSERT dans "orders".
// Envoie une notification push à tous les abonnés (admin).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
  "mailto:adminoadigitrade@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {

  try {

    const payload = await req.json();
    const order = payload.record;

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) {
      throw error;
    }

    const { count: pendingCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const notificationPayload = JSON.stringify({
      title: "Nouvelle commande",
      body: `Commande #${order?.id ?? ""} reçue.`,
      url: "./admin.html",
      badgeCount: pendingCount ?? 1
    });

    const results = await Promise.allSettled(
      (subscriptions || []).map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          notificationPayload
        )
      )
    );

    return new Response(JSON.stringify({ ok: true, results: results.length }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {

    console.error("Erreur send-push:", err);

    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });

  }

});
