import { useState, useCallback } from "react";

export interface ProductIntel {
  slug: string;
  name: string;
  company: string;
  website: string;
  tagline: string;
  description: string;
  keyFeatures: string[];
  targetAudience: string;
  pricing: string;
  competitors: string[];
  differentiators: string[];
  commonObjections: { objection: string; counter: string }[];
  idealPitch: string;
  keyStats: string[];
  industryFocus: string[];
  painPoints: string[];
  qualifyingQuestions: string[];
  callScript: {
    opener: string;
    valueHook: string;
    qualifyingQuestion: string;
    closingAsk: string;
  };
  lastUpdated: number;
  source: string;
}

const CACHE_KEY = "atom_product_intel_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCache(): Record<string, ProductIntel> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, ProductIntel>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function useProductIntel() {
  const [intel, setIntel] = useState<ProductIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const research = useCallback(async (product: string): Promise<ProductIntel | null> => {
    if (!product || product.trim().length < 2) return null;

    const slug = product.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Check cache first
    const cache = getCache();
    const cached = cache[slug];
    if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) {
      setIntel(cached);
      return cached;
    }

    // Research via API
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/product-intel/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: product.trim() }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Research failed");
        throw new Error(errText);
      }

      const data: ProductIntel = await res.json();

      // Cache it
      cache[slug] = data;
      setCache(cache);

      setIntel(data);
      return data;
    } catch (err: any) {
      setError(err.message || "Failed to research product");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCached = useCallback((product: string): ProductIntel | null => {
    if (!product || product.trim().length < 2) return null;
    const slug = product.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cache = getCache();
    const cached = cache[slug];
    if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) {
      return cached;
    }
    return null;
  }, []);

  return { intel, loading, error, research, getCached };
}
