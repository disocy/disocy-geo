export interface GeoPopulateSourceUrls {
    unM49?: string;
    isoCountries?: string;
    isoSubdivisions?: string;
    admin2Subdivisions?: string;
    geonamesCities?: string;
    geonamesPostalCodes?: string;
    geonamesAlternateNamesBaseUrl?: string;
    shippingProfiles?: string;
}

export interface GeoPopulateOptions {
    sourceUrls?: GeoPopulateSourceUrls;
    dryRun?: boolean;
    onProgress?: (event: Record<string, unknown>) => void;
}

export interface GeoPopulateManifestEntry {
    url: string;
    recordCount: number;
}

export interface GeoPopulateResult {
    manifest: {
        populatedAt: string;
        dryRun: boolean;
        sources: Record<string, GeoPopulateManifestEntry>;
    };
    normalized: {
        unM49: Array<Record<string, unknown>>;
        isoCountries: Array<Record<string, unknown>>;
        isoSubdivisions: Array<Record<string, unknown>>;
        geonamesCities: Array<Record<string, unknown>>;
        geonamesPostalCodes: Array<Record<string, unknown>>;
        subdivisionAlternateNames: Array<Record<string, unknown>>;
        shippingProfiles: Record<string, unknown>;
    };
}

export function populateGeoSources(options?: GeoPopulateOptions): Promise<GeoPopulateResult>;
