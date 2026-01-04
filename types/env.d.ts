declare namespace NodeJS {
    interface ProcessEnv {
        NEXT_PUBLIC_SUPABASE_URL: string;
        NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    }
}

// BarcodeDetector API の型定義
interface BarcodeDetectorInstance {
    detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmapSource): Promise<Array<{ rawValue: string }>>
}

interface BarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): BarcodeDetectorInstance
    getSupportedFormats?(): Promise<string[]>
}

interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
}
