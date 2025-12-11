import { json } from "@remix-run/node";
import crypto from "crypto";
import prisma from "../db.server";

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * Verifica la firma de Shopify App Proxy.
 * NOTA: App Proxy usa "signature", no "hmac"
 */
function verifyProxySignature(fullUrl) {
  try {
    const url = new URL(fullUrl);
    const signature = url.searchParams.get("signature");
    const timestamp = url.searchParams.get("timestamp");
    
    console.log("🔍 Verificando signature:", signature);
    console.log("🔍 Timestamp:", timestamp);
    
    if (!signature) {
      console.error("❌ No hay parámetro 'signature' en la URL");
      return false;
    }
    
    if (!timestamp) {
      console.error("❌ No hay parámetro 'timestamp' en la URL");
      return false;
    }

    // 1. Verificar que el timestamp no sea demasiado viejo (opcional)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    
    if (Math.abs(currentTime - requestTime) > 90) { // 90 segundos de margen
      console.error(`❌ Timestamp expirado. Actual: ${currentTime}, Request: ${requestTime}`);
      // Puedes decidir si rechazar o no requests viejos
      // return false;
    }

    // 2. Crear el string a verificar
    // Ordenar todos los parámetros alfabéticamente, EXCEPTO 'signature'
    const params = new URLSearchParams(url.search);
    params.delete("signature");
    
    // Convertir a array, ordenar y unir
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('');
    
    console.log("🔍 String para verificar:", sortedParams);
    console.log("🔍 API Secret presente:", !!SHOPIFY_API_SECRET);

    // 3. Calcular el HMAC
    const calculatedSignature = crypto
      .createHmac("sha256", SHOPIFY_API_SECRET)
      .update(sortedParams)
      .digest("hex");

    console.log("🔍 Signature calculada:", calculatedSignature);
    console.log("🔍 Signature recibida:", signature);

    // 4. Comparar (usando timingSafeEqual para seguridad)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
    
    console.log(isValid ? "✅ Signature válida" : "❌ Signature inválida");
    return isValid;

  } catch (error) {
    console.error("💥 Error en verifyProxySignature:", error);
    return false;
  }
}

/**
 * Obtiene una configuración desde AppConfiguration según el título.
 */
async function getAppConfig(title) {
  if (!title) return null;

  try {
    const configRow = await prisma.appConfiguration.findUnique({
      where: { title },
    });
    return configRow ? configRow.config : null;
  } catch (error) {
    console.error(`Error obteniendo config ${title}:`, error);
    return null;
  }
}

/**
 * Obtiene múltiples configuraciones: ?config=a,b,c
 */
async function getMultipleConfigs(configList) {
  const results = {};

  for (const title of configList) {
    try {
      const config = await getAppConfig(title);
      results[title] = config ?? null;
    } catch (err) {
      console.error(`Error fetching config ${title}:`, err);
      results[title] = null;
    }
  }

  return results;
}

/**
 * Loader del App Proxy.
 */
export async function loader({ request }) {
  console.log("=== APP PROXY CALLED ===");
  console.log("Full URL:", request.url);
  
  const url = new URL(request.url);

  // 1. Validar signature del proxy
  if (!verifyProxySignature(request.url)) {
    return json(
      { 
        error: "Invalid signature",
        message: "La firma de Shopify no es válida",
        details: "Verifica tu SHOPIFY_API_SECRET"
      }, 
      { status: 401 }
    );
  }

  // 2. Leer parámetro: ?config=
  const configParam = url.searchParams.get("config");

  if (!configParam) {
    return json(
      { 
        error: "Missing parameter", 
        message: "Falta el parámetro 'config'. Ejemplo: ?config=nombre_oferta"
      }, 
      { status: 400 }
    );
  }

  // 3. Separar múltiples configuraciones
  const titles = configParam.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (titles.length === 0) {
    return json(
      { error: "Invalid config parameter" }, 
      { status: 400 }
    );
  }

  // 4. Obtener las configuraciones solicitadas
  console.log("🔍 Buscando configuraciones:", titles);
  const configs = await getMultipleConfigs(titles);

  return json(
    {
      success: true,
      count: titles.length,
      configs,
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
    }
  );
}

// Handler para otros métodos HTTP
export async function action({ request }) {
  return json({ error: "Method not allowed" }, { status: 405 });
}