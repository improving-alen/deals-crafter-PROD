// services/PrismaConfigurationService.js
import prisma from "../db.server";

export class PrismaConfigurationService {
    
  async save(title, config) {

    console.log("🔥 SAVE to Prisma:", { title, config });

    // Validación fuerte para evitar crashes
    if (!config || typeof config !== "object") {
      console.warn(`⚠️ [PrismaConfigurationService.save] Configuración inválida para "${title}". Recibido:`, config);
      // Guardamos un objeto vacío en vez de null
      config = {};
    }

    try {
      return await prisma.appConfiguration.upsert({
        where: { title },
        update: { config },
        create: { title, config }
      });
    } catch (error) {
      console.error("❌ Prisma upsert error:", error);
      throw error;
    }
  }

  async load(title) {

    //validate if prisma is loaded and define
    if (!prisma) {
      console.warn("⚠️ [PrismaConfigurationService.load] Prisma no cargado.");
      return {};
    } else {
      console.log("✅ [PrismaConfigurationService.load] Prisma cargado correctamente.");
    }   
    console.log(">>> [PrismaConfigurationService.load] called");
    console.log("🔥 LOAD from Prisma:", title);


    try {
      const item = await prisma.appConfiguration.findUnique({
        where: { title }
      });

      // Nunca devolver null → Remix revienta
      if (!item || !item.config) {
        console.warn(`⚠️ [PrismaConfigurationService.load] No existe config para "${title}".`);
        return {}; // ← importante
      }

      return item.config;

    } catch (error) {
      console.error("❌ Prisma load error:", error);
      return {}; // Seguridad para no romper el loader
    }
  }

  async delete(title) {
    try {
      await prisma.appConfiguration.delete({ where: { title } });
    } catch (err) {
      console.warn("⚠️ No se pudo borrar (no existe):", title);
    }
  }
}
