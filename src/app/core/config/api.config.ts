/**
 * API Configuration for the PS Analyzer application.
 * Defines the base URL for the backend analysis engine.
 */
export const API_CONFIG = {
    /** 
     * Base URL for the FastAPI server.
     * In Tauri, it uses the local sidecar. In a web deployment, it uses the /api proxy.
     */
    baseUrl: (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) 
        ? 'http://127.0.0.1:8000' 
        : '/api'
};
