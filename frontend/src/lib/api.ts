// ...existing code...

// ...existing code...
import type { User } from '@/types';
// API Configuration for MTG Deck Optimizer
// This file configures the API endpoints for both development and production

const API_CONFIG = {
  // Base URL for the API
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
  
  // API endpoints
  endpoints: {
    // Authentication
    register: '/api/auth/register',
    login: '/api/auth/login',
    me: '/api/auth/me',
    
    // Collections
    collections: '/api/collections',
    parseCollection: '/api/parse-collection',
    parseCollectionPublic: '/api/parse-collection-public',
    loadSampleCollection: '/api/load-sample-collection',
    
    // Deck operations
    findCommanders: '/api/find-commanders',
    generateDeck: '/api/generate-deck',
    
    // Pricing
    enrichCollectionPricing: '/api/pricing/enrich-collection',
    getCollectionValue: '/api/pricing/collection-value',
    getCollectionValuePublic: '/api/pricing/collection-value-public',
    
    // Settings
    settings: '/api/settings',
    
    // Health

    health: '/health',
  },
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
};

// Helper function to get API URL
export const getApiUrl = (endpoint: keyof typeof API_CONFIG.endpoints): string => {
  return `${API_CONFIG.baseURL}${API_CONFIG.endpoints[endpoint]}`;
};

// Helper function to get auth headers
export const getAuthHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = { ...API_CONFIG.defaultHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// API client class
export class ApiClient {
  // ...existing code...

  // Deck detail methods
  async getDeckById(deckId: string) {
    // Assumes endpoint: /api/decks/{deck_id}
    return this.request(`/api/decks/${deckId}`);
  }

  async deleteDeck(deckId: string) {
    // Assumes endpoint: /api/decks/{deck_id}
    return this.request(`/api/decks/${deckId}`, {
      method: 'DELETE',
    });
  }
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  // Advanced Analytics
  async getCardEfficiencyIndex() {
    const url = `${this.baseURL}/api/analytics/cei`;
    const resp = await fetch(url, { headers: this.defaultHeaders });
    if (!resp.ok) throw new Error('Failed to fetch Card Efficiency Index');
    return resp.json();
  }

  async getDeckCostToWin() {
    const url = `${this.baseURL}/api/analytics/deck-cost-to-win`;
    const resp = await fetch(url, { headers: this.defaultHeaders });
    if (!resp.ok) throw new Error('Failed to fetch Deck Cost-to-Win');
    return resp.json();
  }

  async getInvestmentWatch() {
    const url = `${this.baseURL}/api/analytics/investment-watch`;
    const resp = await fetch(url, { headers: this.defaultHeaders });
    if (!resp.ok) throw new Error('Failed to fetch Investment Watch');
    return resp.json();
  }

  async getCollectionROI(collection: any) {
    const url = `${this.baseURL}/api/analytics/collection-roi`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(collection),
    });
    if (!resp.ok) throw new Error('Failed to fetch Collection ROI');
    return resp.json();
  }

  constructor(token?: string) {
    this.baseURL = API_CONFIG.baseURL;
    this.defaultHeaders = getAuthHeaders(token);
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.detail || errorJson.message || errorMessage;
        } catch {
          // If it's not JSON, use the raw text
          errorMessage = errorData || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
  }

  // Authentication methods
  async register(userData: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
  }) {
    return this.request(API_CONFIG.endpoints.register, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: { email: string; password: string }) {
    return this.request(API_CONFIG.endpoints.login, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getProfile() {
    return this.request(API_CONFIG.endpoints.me);
  }

  // Collection methods
  async getCollections() {
    return this.request(API_CONFIG.endpoints.collections);
  }

  async deleteCollectionById(collectionId: string) {
    // Assumes API_CONFIG.endpoints.collections is something like '/api/collections'
    return this.request(`${API_CONFIG.endpoints.collections}/${collectionId}`, {
      method: 'DELETE',
    });
  }

  async saveCollection(collectionData: Record<string, unknown>) {
    return this.request(API_CONFIG.endpoints.collections, {
      method: 'POST',
      body: JSON.stringify(collectionData),
    });
  }

  async parseCollection(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(API_CONFIG.endpoints.parseCollection, {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type header to let browser set it with boundary
        ...Object.fromEntries(
          Object.entries(this.defaultHeaders).filter(([key]) => 
            key.toLowerCase() !== 'content-type'
          )
        ),
      },
    });
  }

  async parseCollectionPublic(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(API_CONFIG.endpoints.parseCollectionPublic, {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type header for file upload
      },
    });
  }

  async loadSampleCollection() {
    return this.request(API_CONFIG.endpoints.loadSampleCollection);
  }

  // Deck methods
  async findCommanders(collection: Array<Record<string, unknown>>) {
    return this.request(API_CONFIG.endpoints.findCommanders, {
      method: 'POST',
      body: JSON.stringify({ collection }),
    });
  }

  async generateDeck(collection: Array<Record<string, unknown>>, commanderId: string, bracket: number) {
    return this.request(API_CONFIG.endpoints.generateDeck, {
      method: 'POST',
      body: JSON.stringify({ collection, commander_id: commanderId, bracket }),
    });
  }

  // Pricing methods
  async enrichCollectionPricing(collection: Array<Record<string, unknown>>, source = 'tcgplayer') {
    return this.request(API_CONFIG.endpoints.enrichCollectionPricing, {
      method: 'POST',
      body: JSON.stringify({ collection, source }),
    });
  }

  async getCollectionValue(collection: Array<Record<string, unknown>>, source = 'tcgplayer') {
    return this.request(API_CONFIG.endpoints.getCollectionValue, {
      method: 'POST',
      body: JSON.stringify({ collection, source }),
    });
  }

  async getCollectionValuePublic(collection: Array<Record<string, unknown>>, source = 'tcgplayer') {
    return this.request(API_CONFIG.endpoints.getCollectionValuePublic, {
      method: 'POST',
      body: JSON.stringify({ collection, source }),
    });
  }

  // Settings methods
  async getSettings() {
    return this.request(API_CONFIG.endpoints.settings);
  }

  async updateSettings(settings: Record<string, unknown>) {
    return this.request(API_CONFIG.endpoints.settings, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Health check
  async healthCheck() {
    return this.request(API_CONFIG.endpoints.health);
  }

  // Profile methods
  async updateProfile(profile: Partial<User>) {
    // Adjust endpoint as needed; assuming /api/auth/me for profile update
    return this.request(API_CONFIG.endpoints.me, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  async changePassword(data: { oldPassword: string; newPassword: string }) {
    // Adjust endpoint as needed; assuming /api/auth/change-password
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export default API_CONFIG;
