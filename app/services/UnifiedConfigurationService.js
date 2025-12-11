import { ConfigurationService } from "./ConfigurationService.js";
import { PrismaConfigurationService } from "./PrismaConfigurationService.js";

export class UnifiedConfigurationService {
  constructor(admin) {
    this.meta = new ConfigurationService(admin);
    this.db = new PrismaConfigurationService();
  }

  /** LOAD = carga Metafields y luego Prisma (sin romper si algo falla) */
  async loadAllConfigurations() {
    const metaConfig = await this.meta.loadAllConfigurations();

    let prismaConfig = {};
    try {
      const loaded = await this.db.load("single_units");
      prismaConfig = loaded && typeof loaded === "object" ? loaded : {};
    } catch (error) {
      console.warn("⚠️ Prisma load failed, using empty object:", error);
      prismaConfig = {};
    }

    return {
      ...metaConfig,
      prismaCopy: prismaConfig
    };
  }

  /** SAVE = guarda en Metafields + copia en Prisma (validando config) */
  async saveAllConfigurations(config) {

    // Si config no es un objeto → se reemplaza por {} para evitar crashes
    if (!config || typeof config !== "object") {
      console.warn("⚠️ Invalid config received in saveAllConfigurations:", config);
      config = {};
    }

    // 1. Guardar en Metafields
    const response = await this.meta.saveAllConfigurations(config);

    // 2. Guardar copia en Prisma, con try/catch para que no truene la app
    try {
      await this.db.save("single_units", config);
    } catch (error) {
      console.error("❌ Prisma save failed:", error);
    }

    return response;
  }  
}
