/**
 * Model Loader - Carga y cache de modelos ML
 *
 * @deprecated Use AIEngine from './engine' instead.
 * AIEngine provides real Transformers.js integration with WebGPU support.
 * This module is kept for backwards compatibility only.
 *
 * Migration:
 * ```typescript
 * // Old (deprecated):
 * const loader = new ModelLoader();
 * await loader.load('model-name');
 *
 * // New (recommended):
 * import { AIEngine } from '@bitcoinbaby/ai';
 * const engine = new AIEngine();
 * await engine.initialize();
 * ```
 */

interface ModelInfo {
  name: string;
  task: string;
  size: number; // bytes
  quantized: boolean;
}

interface LoadProgress {
  model: string;
  progress: number; // 0-100
  loaded: number; // bytes
  total: number; // bytes
}

type ProgressCallback = (progress: LoadProgress) => void;

/**
 * Modelos recomendados para browser (pequenos y rapidos)
 */
export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    name: "Xenova/all-MiniLM-L6-v2",
    task: "feature-extraction",
    size: 25_000_000, // ~25MB
    quantized: true,
  },
  {
    name: "Xenova/distilbert-base-uncased",
    task: "text-classification",
    size: 65_000_000, // ~65MB
    quantized: true,
  },
  {
    name: "Xenova/whisper-tiny",
    task: "automatic-speech-recognition",
    size: 40_000_000, // ~40MB
    quantized: true,
  },
];

/**
 * Cargador de modelos con soporte de progreso y cache
 *
 * @deprecated Use AIEngine instead. This class simulates model loading
 * but does not actually load real ML models. See module docs for migration.
 */
export class ModelLoader {
  private loadedModels: Map<string, any> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  /**
   * Carga un modelo con reporte de progreso
   */
  async load(modelName: string, onProgress?: ProgressCallback): Promise<any> {
    // Si ya esta cargado, retornar
    if (this.loadedModels.has(modelName)) {
      return this.loadedModels.get(modelName);
    }

    // Si esta cargando, esperar
    if (this.loadingPromises.has(modelName)) {
      return this.loadingPromises.get(modelName);
    }

    // Iniciar carga
    const loadPromise = this.loadModel(modelName, onProgress);
    this.loadingPromises.set(modelName, loadPromise);

    try {
      const model = await loadPromise;
      this.loadedModels.set(modelName, model);
      return model;
    } finally {
      this.loadingPromises.delete(modelName);
    }
  }

  /**
   * Carga el modelo (implementacion interna)
   */
  private async loadModel(
    modelName: string,
    onProgress?: ProgressCallback,
  ): Promise<any> {
    // TODO: Implementar carga real con Transformers.js
    // import { pipeline } from '@huggingface/transformers';

    // Simular progreso
    if (onProgress) {
      const modelInfo = RECOMMENDED_MODELS.find((m) => m.name === modelName);
      const total = modelInfo?.size ?? 50_000_000;

      for (let i = 0; i <= 100; i += 10) {
        onProgress({
          model: modelName,
          progress: i,
          loaded: (total * i) / 100,
          total,
        });
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return { name: modelName, loaded: true };
  }

  /**
   * Verifica si un modelo esta en cache
   */
  isLoaded(modelName: string): boolean {
    return this.loadedModels.has(modelName);
  }

  /**
   * Descarga un modelo de memoria
   */
  unload(modelName: string): void {
    this.loadedModels.delete(modelName);
  }

  /**
   * Descarga todos los modelos
   */
  unloadAll(): void {
    this.loadedModels.clear();
  }

  /**
   * Lista modelos cargados
   */
  getLoadedModels(): string[] {
    return Array.from(this.loadedModels.keys());
  }
}
